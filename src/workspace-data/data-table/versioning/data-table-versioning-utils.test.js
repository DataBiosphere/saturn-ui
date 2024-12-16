import JSZip from 'jszip';
import { GoogleStorage } from 'src/libs/ajax/GoogleStorage';
import { Metrics } from 'src/libs/ajax/Metrics';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { getTerraUser } from 'src/libs/state';

import { importDataTableVersion, saveDataTableVersion, tableNameForImport } from './data-table-versioning-utils';

jest.mock('src/libs/ajax/GoogleStorage');
jest.mock('src/libs/ajax/Metrics');
jest.mock('src/libs/ajax/workspaces/Workspaces');

jest.mock('src/libs/state', () => ({
  ...jest.requireActual('src/libs/state'),
  getTerraUser: jest.fn(),
}));

describe('tableNameForImport', () => {
  it('names imported table with version timestamp', () => {
    expect(
      tableNameForImport({
        url: 'gs://workspace-bucket/.data-table-versions/thing/thing.v1663096364243',
        createdBy: 'user@example.com',
        entityType: 'thing',
        timestamp: 1663096364243,
        description: 'A version',
      })
    ).toBe('thing_2022-09-13_19-12-44');
  });
});

describe('saveDataTableVersion', () => {
  const workspace = { workspace: { namespace: 'test', name: 'test', googleProject: 'test-project', bucketName: 'test-bucket' } };

  const entityMetadata = {
    thing: {
      attributeNames: ['attribute_one', 'attribute_two'],
      count: 3,
      id_name: 'thing_id',
    },
    thing_set: {
      attributeNames: ['things', 'attribute_one'],
      count: 1,
      id_name: 'thing_set_id',
    },
  };

  const entities = {
    thing: [
      {
        name: 'thing_one',
        entityType: 'thing',
        attributes: {
          attribute_one: 'a',
          attribute_two: 1,
        },
      },
      {
        name: 'thing_two',
        entityType: 'thing',
        attributes: {
          attribute_one: 'b',
          attribute_two: 2,
        },
      },
      {
        name: 'thing_three',
        entityType: 'thing',
        attributes: {
          attribute_one: 'c',
          attribute_two: 3,
        },
      },
    ],
    thing_set: [
      {
        name: 'some_things',
        entityType: 'thing_set',
        attributes: {
          attribute_one: 'a',
          things: {
            itemsType: 'EntityReference',
            items: [
              { entityType: 'thing', entityName: 'thing_one' },
              { entityType: 'thing', entityName: 'thing_two' },
            ],
          },
        },
      },
    ],
  };

  let getEntityMetadata;
  let paginatedEntitiesOfType;
  let uploadObject;
  let patchObject;

  beforeEach(() => {
    getEntityMetadata = jest.fn().mockReturnValue(Promise.resolve(entityMetadata));
    paginatedEntitiesOfType = jest.fn().mockImplementation((entityType, { page }) =>
      Promise.resolve({
        resultMetadata: {
          filteredPageCount: Math.ceil((entities[entityType] || []).length / 2),
        },
        results: (entities[entityType] || []).slice(2 * (page - 1), 2 * page),
      })
    );
    uploadObject = jest.fn();
    patchObject = jest.fn();

    GoogleStorage.mockReturnValue({ upload: uploadObject, patch: patchObject });
    Metrics.mockReturnValue({ captureEvent: jest.fn() });
    Workspaces.mockReturnValue({
      workspace: () => ({
        entityMetadata: getEntityMetadata,
        paginatedEntitiesOfType,
      }),
    });

    getTerraUser.mockReturnValue({
      email: 'user@example.com',
    });
  });

  it('downloads entities', async () => {
    await saveDataTableVersion(workspace, 'thing', {});
    expect(paginatedEntitiesOfType).toHaveBeenCalledWith('thing', expect.objectContaining({ page: 1 }));
  });

  it('downloads related sets', async () => {
    await saveDataTableVersion(workspace, 'thing', { includedSetEntityTypes: ['thing_set'] });
    expect(paginatedEntitiesOfType).toHaveBeenCalledWith('thing', expect.objectContaining({ page: 1 }));
    expect(paginatedEntitiesOfType).toHaveBeenCalledWith('thing_set', expect.objectContaining({ page: 1 }));
  });

  it('uploads zip file of data', async () => {
    await saveDataTableVersion(workspace, 'thing', { includedSetEntityTypes: ['thing_set'] });
    expect(uploadObject).toHaveBeenCalledWith('test-project', 'test-bucket', '.data-table-versions/thing/', expect.any(File));
  });

  describe('uploaded zip file', () => {
    let file;

    beforeEach(async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1664838597117);
      await saveDataTableVersion(workspace, 'thing', { includedSetEntityTypes: ['thing_set'] });
      file = uploadObject.mock.calls[0][3];
    });

    it('is named with version timestamp', () => {
      expect(file.name).toBe('thing.v1664838597117.zip');
    });

    it('contains JSON export of table', async () => {
      const zip = await JSZip.loadAsync(file);
      expect(await zip.file('json/thing.json').async('text')).toBe(
        JSON.stringify([
          {
            name: 'thing_one',
            entityType: 'thing',
            attributes: {
              attribute_one: 'a',
              attribute_two: 1,
            },
          },
          {
            name: 'thing_two',
            entityType: 'thing',
            attributes: {
              attribute_one: 'b',
              attribute_two: 2,
            },
          },
          {
            name: 'thing_three',
            entityType: 'thing',
            attributes: {
              attribute_one: 'c',
              attribute_two: 3,
            },
          },
        ])
      );
    });

    it('contains JSON export of set tables', async () => {
      const zip = await JSZip.loadAsync(file);
      expect(await zip.file('json/thing_set.json').async('text')).toBe(
        JSON.stringify([
          {
            name: 'some_things',
            entityType: 'thing_set',
            attributes: {
              attribute_one: 'a',
              things: {
                itemsType: 'EntityReference',
                items: [
                  { entityType: 'thing', entityName: 'thing_one' },
                  { entityType: 'thing', entityName: 'thing_two' },
                ],
              },
            },
          },
        ])
      );
    });
  });

  it('attaches metadata to uploaded zip file', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1664838597117);
    await saveDataTableVersion(workspace, 'thing', {
      description: 'This is a test',
      includedSetEntityTypes: ['thing_set'],
    });
    expect(patchObject).toHaveBeenCalledWith('test-project', 'test-bucket', '.data-table-versions/thing/thing.v1664838597117.zip', {
      metadata: {
        createdBy: 'user@example.com',
        entityType: 'thing',
        includedSetEntityTypes: 'thing_set',
        timestamp: 1664838597117,
        description: 'This is a test',
      },
    });
  });
});

describe('importDataTableVersion', () => {
  const workspace = { workspace: { namespace: 'test', name: 'test', googleProject: 'test-project', bucketName: 'test-bucket' } };
  const version = {
    url: 'gs://workspace-bucket/.data-table-versions/thing/thing.v1663096364243.zip',
    createdBy: 'user@example.com',
    entityType: 'thing',
    includedSetEntityTypes: ['thing_set'],
    timestamp: 1663096364243,
    description: 'A version',
  };

  const versionFile = new JSZip();
  versionFile.file(
    'json/thing.json',
    JSON.stringify([
      {
        name: 'thing_one',
        entityType: 'thing',
        attributes: {
          attribute_one: 'a',
          attribute_two: 1,
        },
      },
      {
        name: 'thing_two',
        entityType: 'thing',
        attributes: {
          attribute_one: 'b',
          attribute_two: 2,
        },
      },
      {
        name: 'thing_three',
        entityType: 'thing',
        attributes: {
          attribute_one: 'c',
          attribute_two: 3,
        },
      },
    ])
  );
  versionFile.file(
    'json/thing_set.json',
    JSON.stringify([
      {
        name: 'some_things',
        entityType: 'thing_set',
        attributes: {
          attribute_one: 'a',
          things: {
            itemsType: 'EntityReference',
            items: [
              { entityType: 'thing', entityName: 'thing_one' },
              { entityType: 'thing', entityName: 'thing_two' },
            ],
          },
        },
      },
    ])
  );

  let getObjectPreview;
  let upsertEntities;

  beforeEach(() => {
    getObjectPreview = jest.fn().mockReturnValue(Promise.resolve({ blob: () => versionFile.generateAsync({ type: 'blob' }) }));
    upsertEntities = jest.fn().mockReturnValue(Promise.resolve({}));

    GoogleStorage.mockReturnValue({ getObjectPreview });
    Metrics.mockReturnValue({ captureEvent: jest.fn() });
    Workspaces.mockReturnValue({ workspace: () => ({ upsertEntities }) });
  });

  it('downloads version from GCS', async () => {
    await importDataTableVersion(workspace, version);
    expect(getObjectPreview).toHaveBeenCalledWith('test-project', 'test-bucket', '.data-table-versions/thing/thing.v1663096364243.zip', true);
  });

  it('imports table and set tables', async () => {
    await importDataTableVersion(workspace, version);
    expect(upsertEntities).toHaveBeenCalledTimes(2);
  });

  it('rewrites entity type', async () => {
    await importDataTableVersion(workspace, version);

    const entities = upsertEntities.mock.calls[0][0];
    expect(entities[0].entityType).toBe('thing_2022-09-13_19-12-44');

    const setEntities = upsertEntities.mock.calls[1][0];
    expect(setEntities[0].entityType).toBe('thing_2022-09-13_19-12-44_set');

    const setEntityOperations = setEntities[0].operations;
    expect(setEntityOperations).toEqual(
      expect.arrayContaining([
        {
          op: 'AddUpdateAttribute',
          attributeName: 'things',
          addUpdateAttribute: {
            itemsType: 'EntityReference',
            items: [
              {
                entityType: 'thing_2022-09-13_19-12-44',
                entityName: 'thing_one',
              },
              {
                entityType: 'thing_2022-09-13_19-12-44',
                entityName: 'thing_two',
              },
            ],
          },
        },
      ])
    );
  });

  it('returns imported table name', async () => {
    const { tableName } = await importDataTableVersion(workspace, version);
    expect(tableName).toBe('thing_2022-09-13_19-12-44');
  });
});
