import { addMinutes, format } from 'date-fns/fp';
import JSZip from 'jszip';
import _ from 'lodash/fp';
import { useState } from 'react';
import { parseGsUri } from 'src/components/data/data-utils';
import { GoogleStorage } from 'src/libs/ajax/GoogleStorage';
import { Metrics } from 'src/libs/ajax/Metrics';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { notify } from 'src/libs/notifications';
import { useCancellation } from 'src/libs/react-utils';
import { getTerraUser } from 'src/libs/state';
import * as Utils from 'src/libs/utils';

export const dataTableVersionsPathRoot = '.data-table-versions';

const getAllEntities = async (workspace, entityType) => {
  const {
    workspace: { namespace, name },
  } = workspace;

  const pageSize = 100_000;
  const firstPageResponse = await Workspaces().workspace(namespace, name).paginatedEntitiesOfType(entityType, { page: 1, pageSize });

  let entities = firstPageResponse.results;
  const numPages = firstPageResponse.resultMetadata.filteredPageCount;

  for (let page = 2; page <= numPages; page += 1) {
    const pageResponse = await Workspaces().workspace(namespace, name).paginatedEntitiesOfType(entityType, { page, pageSize });
    entities = _.concat(entities, pageResponse.results);
  }

  return entities;
};

export const saveDataTableVersion = async (workspace, entityType, { description = null, includedSetEntityTypes = [] } = {}) => {
  void Metrics().captureEvent(Events.dataTableVersioningSaveVersion, {
    ...extractWorkspaceDetails(workspace.workspace),
    tableName: entityType,
  });

  const {
    workspace: { googleProject, bucketName },
  } = workspace;

  const timestamp = Date.now();
  const versionName = `${entityType}.v${timestamp}`;

  const allEntities = await Promise.all(
    _.map(async (type) => ({ type, entities: await getAllEntities(workspace, type) }), [entityType, ...includedSetEntityTypes])
  );

  const zip = new JSZip();
  _.forEach(({ type, entities }) => {
    zip.file(`json/${type}.json`, JSON.stringify(entities));
  }, allEntities);
  const zipContent = await zip.generateAsync({ type: 'blob' });

  const zipFile = new File([zipContent], `${versionName}.zip`, { type: 'application/zip' });
  await GoogleStorage().upload(googleProject, bucketName, `${dataTableVersionsPathRoot}/${entityType}/`, zipFile);

  const objectName = `${dataTableVersionsPathRoot}/${entityType}/${versionName}.zip`;
  const createdBy = getTerraUser().email;
  await GoogleStorage().patch(googleProject, bucketName, objectName, {
    metadata: {
      createdBy,
      entityType,
      includedSetEntityTypes: _.join(',', includedSetEntityTypes),
      timestamp,
      description,
    },
  });

  return {
    url: `gs://${bucketName}/${objectName}`,
    createdBy,
    entityType,
    includedSetEntityTypes,
    timestamp,
    description,
  };
};

export const listDataTableVersions = async (workspace, entityType, { signal } = {}) => {
  const {
    workspace: { googleProject, bucketName },
  } = workspace;

  const prefix = `${dataTableVersionsPathRoot}/${entityType}/`;
  const { items } = await GoogleStorage(signal).listAll(googleProject, bucketName, { prefix });

  return _.flow(
    _.filter((item) => item.name.endsWith('.zip') && item.metadata?.entityType && item.metadata?.timestamp),
    _.map((item) => ({
      url: `gs://${item.bucket}/${item.name}`,
      createdBy: item.metadata.createdBy,
      entityType,
      includedSetEntityTypes: _.compact(_.split(',', item.metadata.includedSetEntityTypes)),
      timestamp: parseInt(item.metadata.timestamp),
      description: item.metadata.description,
    })),
    _.sortBy((version) => -version.timestamp)
  )(items);
};

export const deleteDataTableVersion = async (workspace, version) => {
  void Metrics().captureEvent(Events.dataTableVersioningDeleteVersion, {
    ...extractWorkspaceDetails(workspace.workspace),
    tableName: version.entityType,
  });

  const {
    workspace: { googleProject, bucketName },
  } = workspace;

  const [, objectName] = parseGsUri(version.url);
  await GoogleStorage().delete(googleProject, bucketName, objectName);
};

export const tableNameForImport = (version) => {
  const timestamp = new Date(version.timestamp);
  return `${version.entityType}_${format('yyyy-MM-dd_HH-mm-ss', addMinutes(timestamp.getTimezoneOffset(), timestamp))}`;
};

export const importDataTableVersion = async (workspace, version) => {
  void Metrics().captureEvent(Events.dataTableVersioningImportVersion, {
    ...extractWorkspaceDetails(workspace.workspace),
    tableName: version.entityType,
  });

  const {
    workspace: { namespace, name, googleProject, bucketName },
  } = workspace;

  const [, objectName] = parseGsUri(version.url);
  const zipData = await GoogleStorage()
    .getObjectPreview(googleProject, bucketName, objectName, true)
    .then((r) => r.blob());

  const zip = await JSZip.loadAsync(zipData);

  const importedTableName = tableNameForImport(version);
  const entities = JSON.parse(await zip.file(`json/${version.entityType}.json`).async('text'));
  const entityUpdates = _.map(
    ({ name, attributes }) => ({
      entityType: importedTableName,
      name,
      operations: Object.entries(attributes).map(([k, v]) => ({ op: 'AddUpdateAttribute', attributeName: k, addUpdateAttribute: v })),
    }),
    entities
  );

  await Workspaces().workspace(namespace, name).upsertEntities(entityUpdates);

  for (const setTableName of _.sortBy(_.identity, version.includedSetEntityTypes)) {
    const originalSetTableMemberType = setTableName.slice(0, -4);

    const importedSetTableName = _.replace(version.entityType, importedTableName, setTableName);
    const importedSetTableMemberType = importedSetTableName.slice(0, -4);

    const setTableEntities = JSON.parse(await zip.file(`json/${setTableName}.json`).async('text'));
    const setTableEntityUpdates = _.map(
      ({ name, attributes }) => ({
        entityType: importedSetTableName,
        name,
        operations: Object.entries({
          ...attributes,
          [`${originalSetTableMemberType}s`]: _.update(
            'items',
            _.map(_.set('entityType', importedSetTableMemberType)),
            attributes[`${originalSetTableMemberType}s`]
          ),
        }).map(([k, v]) => ({ op: 'AddUpdateAttribute', attributeName: k, addUpdateAttribute: v })),
      }),
      setTableEntities
    );

    await Workspaces().workspace(namespace, name).upsertEntities(setTableEntityUpdates);
  }

  return { tableName: importedTableName };
};

export const useDataTableVersions = (workspace) => {
  const signal = useCancellation();
  // { [entityType: string]: { loading: boolean, error: boolean, versions: Version[], savingNewVersion: boolean }
  const [dataTableVersions, setDataTableVersions] = useState({});

  return {
    dataTableVersions,

    loadDataTableVersions: async (entityType) => {
      setDataTableVersions(_.update(entityType, _.flow(_.set('loading', true), _.set('error', false))));
      try {
        const versions = await listDataTableVersions(workspace, entityType, { signal });
        setDataTableVersions(_.update(entityType, _.set('versions', versions)));
      } catch (err) {
        setDataTableVersions(_.update(entityType, _.set('error', true)));
        throw err;
      } finally {
        setDataTableVersions(_.update(entityType, _.set('loading', false)));
      }
    },

    saveDataTableVersion: async (entityType, options = {}) => {
      setDataTableVersions(_.update(entityType, _.set('savingNewVersion', true)));
      try {
        const newVersion = await saveDataTableVersion(workspace, entityType, options);
        notify('success', `Saved version of ${entityType}`, { timeout: 3000 });
        setDataTableVersions(
          _.update(
            [entityType, 'versions'],
            _.flow(
              _.defaultTo([]),
              Utils.append(newVersion),
              _.sortBy((version) => -version.timestamp)
            )
          )
        );
      } finally {
        setDataTableVersions(_.update(entityType, _.set('savingNewVersion', false)));
      }
    },

    deleteDataTableVersion: async (version) => {
      await deleteDataTableVersion(workspace, version);
      setDataTableVersions(_.update([version.entityType, 'versions'], _.remove({ timestamp: version.timestamp })));
    },

    importDataTableVersion: (version) => {
      return importDataTableVersion(workspace, version);
    },
  };
};
