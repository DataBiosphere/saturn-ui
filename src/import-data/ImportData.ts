import _ from 'lodash/fp';
import { Fragment, ReactNode, useState } from 'react';
import { div, h, h2 } from 'react-hyperscript-helpers';
import { spinnerOverlay } from 'src/components/common';
import { Ajax } from 'src/libs/ajax';
import { resolveWdsUrl, WdsDataTableProvider } from 'src/libs/ajax/data-table-providers/WdsDataTableProvider';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import { notify } from 'src/libs/notifications';
import { useOnMount } from 'src/libs/react-utils';
import { asyncImportJobStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { WorkspaceInfo } from 'src/libs/workspace-utils';
import { notifyDataImportProgress } from 'src/workspace-data/import-jobs';

import {
  BagItImportRequest,
  CatalogDatasetImportRequest,
  EntitiesImportRequest,
  ImportRequest,
  PFBImportRequest,
  TDRSnapshotExportImportRequest,
  TDRSnapshotReferenceImportRequest,
  TemplateWorkspaceInfo,
} from './import-types';
import { ImportDataDestination } from './ImportDataDestination';
import { ImportDataOverview } from './ImportDataOverview';
import { getImportSource } from './protected-data-utils';
import { useImportRequest } from './useImportRequest';

export interface ImportDataProps {
  importRequest: ImportRequest;
}

export const ImportData = (props: ImportDataProps): ReactNode => {
  const { importRequest } = props;
  const {
    query: { ad, format, wid, template },
  } = Nav.useRoute();
  const [templateWorkspaces, setTemplateWorkspaces] = useState<{ [key: string]: TemplateWorkspaceInfo[] }>();
  const [userHasBillingProjects, setUserHasBillingProjects] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  // Normalize the snapshot name:
  // Importing snapshot will throw an "enum" error if the name has any spaces or special characters
  // Replace all whitespace characters with _
  // Then replace all non alphanumeric characters with nothing
  const normalizeSnapshotName = (input) => _.flow(_.replace(/\s/g, '_'), _.replace(/[^A-Za-z0-9-_]/g, ''))(input);

  useOnMount(() => {
    const loadTemplateWorkspaces = _.flow(
      Utils.withBusyState(setIsImporting),
      withErrorReporting('Error loading initial data')
    )(async () => {
      const templates = await Ajax().FirecloudBucket.getTemplateWorkspaces();
      setTemplateWorkspaces(templates);
      const projects = await Ajax().Billing.listProjects();
      setUserHasBillingProjects(projects.length > 0);
    });
    loadTemplateWorkspaces();
  });

  const importPFB = async (importRequest: PFBImportRequest, workspace: WorkspaceInfo) => {
    if (workspace.cloudPlatform === 'Azure') {
      const wdsUrl = await Ajax().Apps.listAppsV2(workspace.workspaceId).then(resolveWdsUrl);
      const { namespace, name, cloudPlatform } = workspace;
      const { jobId } = await Ajax().WorkspaceData.startImportJob(wdsUrl, workspace.workspaceId, {
        url: importRequest.url.toString(),
        type: 'PFB',
      });
      // TODO a better way to make this conform to expected shape?
      asyncImportJobStore.update(
        Utils.append({
          targetWorkspace: { namespace, name, workspace: { cloudPlatform, workspaceId: workspace.workspaceId } },
          jobId,
          wdsProxyUrl: wdsUrl,
        })
      );
      notifyDataImportProgress(jobId);
    } else {
      const { namespace, name } = workspace;
      const { jobId } = await Ajax()
        .Workspaces.workspace(namespace, name)
        .importJob(importRequest.url.toString(), 'pfb', null);
      // TODO does it make sense to include cloudPlatform both places here or is there another way
      asyncImportJobStore.update(
        Utils.append({ targetWorkspace: { namespace, name, workspace: { cloudPlatform: 'gcp' } }, jobId })
      );
      notifyDataImportProgress(jobId);
    }
  };

  const importBagit = async (importRequest: BagItImportRequest, workspace: WorkspaceInfo) => {
    const { namespace, name } = workspace;
    await Ajax().Workspaces.workspace(namespace, name).importBagit(importRequest.url.toString());
    notify('success', 'Data imported successfully.', { timeout: 3000 });
  };

  const importEntitiesJson = async (importRequest: EntitiesImportRequest, workspace: WorkspaceInfo) => {
    const { namespace, name } = workspace;
    await Ajax().Workspaces.workspace(namespace, name).importJSON(importRequest.url.toString());
    notify('success', 'Data imported successfully.', { timeout: 3000 });
  };

  const importTdrExport = async (importRequest: TDRSnapshotExportImportRequest, workspace: WorkspaceInfo) => {
    if (workspace.cloudPlatform === 'Azure') {
      // find wds for this workspace
      const wdsUrl = await Ajax().Apps.listAppsV2(workspace.workspaceId).then(resolveWdsUrl);
      const wdsDataTableProvider = new WdsDataTableProvider(workspace.workspaceId, wdsUrl);

      // call import snapshot
      await wdsDataTableProvider.importTdr(workspace.workspaceId, importRequest.snapshot.id);
    } else {
      const { namespace, name } = workspace;
      const { jobId } = await Ajax()
        .Workspaces.workspace(namespace, name)
        .importJob(importRequest.manifestUrl.toString(), 'tdrexport', {
          tdrSyncPermissions: importRequest.syncPermissions,
        });
      asyncImportJobStore.update(Utils.append({ targetWorkspace: { namespace, name }, jobId }));
      notifyDataImportProgress(jobId);
    }
  };

  const importSnapshot = async (importRequest: TDRSnapshotReferenceImportRequest, workspace: WorkspaceInfo) => {
    const { namespace, name } = workspace;
    await Ajax()
      .Workspaces.workspace(namespace, name)
      .importSnapshot(importRequest.snapshot.id, normalizeSnapshotName(importRequest.snapshot.name));
    notify('success', 'Snapshot imported successfully.', { timeout: 3000 });
  };

  const exportCatalog = async (importRequest: CatalogDatasetImportRequest, workspace: WorkspaceInfo) => {
    const { workspaceId } = workspace;
    await Ajax().Catalog.exportDataset({ id: importRequest.datasetId, workspaceId });
    notify('success', 'Catalog dataset imported successfully.', { timeout: 3000 });
  };

  const onImport = _.flow(
    Utils.withBusyState(setIsImporting),
    withErrorReporting('Import Error')
  )(async (workspace: WorkspaceInfo) => {
    switch (importRequest.type) {
      case 'pfb':
        await importPFB(importRequest, workspace);
        break;
      case 'bagit':
        await importBagit(importRequest, workspace);
        break;
      case 'entities':
        await importEntitiesJson(importRequest, workspace);
        break;
      case 'tdr-snapshot-export':
        await importTdrExport(importRequest, workspace);
        break;
      case 'tdr-snapshot-reference':
        await importSnapshot(importRequest, workspace);
        break;
      case 'catalog-dataset':
        await exportCatalog(importRequest, workspace);
        break;
      default:
        // Use TypeScript to verify that this switch handles all possible values.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const exhaustiveGuard: never = importRequest;
    }

    const { namespace, name } = workspace;
    Ajax().Metrics.captureEvent(Events.workspaceDataImport, {
      format,
      ...extractWorkspaceDetails(workspace),
      importSource: 'url' in importRequest ? getImportSource(importRequest.url) : undefined,
    });
    Nav.goToPath('workspace-data', { namespace, name });
  });

  return h(Fragment, [
    h(ImportDataOverview, {
      importRequest,
    }),
    h(ImportDataDestination, {
      importRequest,
      initialSelectedWorkspaceId: wid,
      requiredAuthorizationDomain: ad,
      templateWorkspaces,
      template,
      userHasBillingProjects,
      onImport,
    }),
    isImporting && spinnerOverlay,
  ]);
};

/**
 * Validate the import request from the URL.
 */
export const ImportDataContainer = () => {
  const result = useImportRequest();

  if (result.status === 'Loading') {
    return spinnerOverlay;
  }

  if (result.status === 'Error') {
    return div(
      {
        style: {
          flexGrow: 1,
          padding: '1rem 1.25rem',
          border: `1px solid ${colors.warning(0.8)}`,
          borderRadius: '0.5rem',
          backgroundColor: colors.warning(0.15),
          fontWeight: 'bold',
        },
      },
      [
        h2(
          {
            style: {
              fontSize: 24,
              fontWeight: 600,
              color: colors.dark(),
              margin: '0 0 1rem 0',
            },
          },
          ['Invalid import request.']
        ),
        result.error.message,
      ]
    );
  }

  return h(ImportData, { importRequest: result.importRequest });
};
