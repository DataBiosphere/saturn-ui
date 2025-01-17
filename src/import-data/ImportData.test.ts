import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h } from 'react-hyperscript-helpers';
import { Billing, BillingContract } from 'src/libs/ajax/billing/Billing';
import { BillingProject } from 'src/libs/ajax/billing/billing-models';
import { Catalog, CatalogContract } from 'src/libs/ajax/Catalog';
import { DataRepo, DataRepoContract, DataRepoSnapshotContract, Snapshot } from 'src/libs/ajax/DataRepo';
import { FirecloudBucket, FirecloudBucketAjaxContract } from 'src/libs/ajax/firecloud/FirecloudBucket';
import { Apps, AppsAjaxContract } from 'src/libs/ajax/leonardo/Apps';
import { ListAppItem } from 'src/libs/ajax/leonardo/models/app-models';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { SamResources, SamResourcesContract } from 'src/libs/ajax/SamResources';
import { WDSJob, WorkspaceData, WorkspaceDataAjaxContract } from 'src/libs/ajax/WorkspaceDataService';
import { WorkspaceContract, Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import { ENABLE_AZURE_PFB_IMPORT, ENABLE_AZURE_TDR_IMPORT } from 'src/libs/feature-previews-config';
import { useRoute } from 'src/libs/nav';
import { asMockedFn, MockedFn, partial, renderWithAppContexts as render, SelectHelper } from 'src/testing/test-utils';
import { defaultAzureWorkspace, defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';
import { useWorkspaces } from 'src/workspaces/common/state/useWorkspaces';

import { ImportDataContainer } from './ImportData';
import { selectExistingWorkspacePrompt } from './ImportDataDestination';

type UserEvent = ReturnType<typeof userEvent.setup>;

type UseWorkspacesExports = typeof import('src/workspaces/common/state/useWorkspaces');
jest.mock('src/workspaces/common/state/useWorkspaces', (): UseWorkspacesExports => {
  return {
    ...jest.requireActual<UseWorkspacesExports>('src/workspaces/common/state/useWorkspaces'),
    useWorkspaces: jest.fn(),
  };
});

jest.mock('src/libs/ajax/billing/Billing');
jest.mock('src/libs/ajax/Catalog');
jest.mock('src/libs/ajax/firecloud/FirecloudBucket');
jest.mock('src/libs/ajax/leonardo/Apps');
jest.mock('src/libs/ajax/Metrics');
jest.mock('src/libs/ajax/WorkspaceDataService');
jest.mock('src/libs/ajax/workspaces/Workspaces');
jest.mock('src/libs/ajax/DataRepo');
jest.mock('src/libs/ajax/SamResources');

type DataRepoExports = typeof import('src/libs/ajax/DataRepo');
jest.mock('src/libs/ajax/DataRepo', (): DataRepoExports => {
  return {
    ...jest.requireActual<DataRepoExports>('src/libs/ajax/DataRepo'),
    DataRepo: jest.fn(),
  };
});

type SamResourcesExports = typeof import('src/libs/ajax/SamResources');
jest.mock('src/libs/ajax/SamResources', (): SamResourcesExports => {
  return {
    ...jest.requireActual<SamResourcesExports>('src/libs/ajax/SamResources'),
    SamResources: jest.fn(),
  };
});

type FeaturePreviewExports = typeof import('src/libs/feature-previews');
jest.mock(
  'src/libs/feature-previews',
  (): FeaturePreviewExports => ({
    ...jest.requireActual('src/libs/feature-previews'),
    isFeaturePreviewEnabled: jest.fn().mockReturnValue(false),
  })
);

type NavExports = typeof import('src/libs/nav');
jest.mock('src/libs/nav', (): NavExports => {
  return {
    ...jest.requireActual<NavExports>('src/libs/nav'),
    goToPath: jest.fn(),
    useRoute: jest.fn(),
  };
});

type NotificationsExports = typeof import('src/libs/notifications');
jest.mock('src/libs/notifications', (): NotificationsExports => {
  return {
    ...jest.requireActual<NotificationsExports>('src/libs/notifications'),
    notify: jest.fn(),
  };
});

type DataBrowserUtilsExports = typeof import('src/data-catalog/data-browser-utils');
jest.mock('src/data-catalog/data-browser-utils', (): DataBrowserUtilsExports => {
  return {
    ...jest.requireActual<DataBrowserUtilsExports>('src/data-catalog/data-browser-utils'),
    fetchDataCatalog: jest.fn(),
  };
});

const azureSnapshotFixture: Snapshot = {
  id: 'aaaabbbb-cccc-dddd-0000-111122223333',
  name: 'test-snapshot',
  source: [
    {
      dataset: {
        id: 'aaaabbbb-cccc-dddd-0000-111122223333',
        name: 'test-dataset',
        secureMonitoringEnabled: false,
      },
    },
  ],
  cloudPlatform: 'azure',
};

const googleSnapshotFixture: Snapshot = {
  id: '00001111-2222-3333-aaaa-bbbbccccdddd',
  name: 'test-snapshot',
  source: [
    {
      dataset: {
        id: '00001111-2222-3333-aaaa-bbbbccccdddd',
        name: 'test-dataset',
        secureMonitoringEnabled: false,
      },
    },
  ],
  cloudPlatform: 'gcp',
};

interface SetupOptions {
  queryParams: { [key: string]: unknown };
}

const setup = async (opts: SetupOptions) => {
  const { queryParams } = opts;

  asMockedFn(DataRepo).mockReturnValue(
    partial<DataRepoContract>({
      snapshot: (snapshotId: string) =>
        partial<DataRepoSnapshotContract>({
          details: jest.fn(async () => {
            if (snapshotId === azureSnapshotFixture.id) {
              return azureSnapshotFixture;
            }
            if (snapshotId === googleSnapshotFixture.id) {
              return googleSnapshotFixture;
            }
            throw new Response('{"message":"Snapshot not found"}', { status: 404 });
          }),
        }),
    })
  );

  asMockedFn(SamResources).mockReturnValue(
    partial<SamResourcesContract>({
      getAuthDomains: jest.fn().mockResolvedValue([]),
    })
  );

  const exportDataset: MockedFn<CatalogContract['exportDataset']> = jest.fn();

  const importBagit: MockedFn<WorkspaceContract['importBagit']> = jest.fn();
  const importJob: MockedFn<WorkspaceContract['importJob']> = jest.fn(async (_url, _type, _options) => ({
    jobId: 'new-job',
  }));
  const importJSON: MockedFn<WorkspaceContract['importJSON']> = jest.fn();
  const importSnapshot: MockedFn<WorkspaceContract['importSnapshot']> = jest.fn();

  const getWorkspaceApi: WorkspacesAjaxContract['workspace'] = jest.fn((_namespace, _name) =>
    partial<WorkspaceContract>({
      importBagit,
      importJob,
      importJSON,
      importSnapshot,
    })
  );

  const startImportJob: MockedFn<WorkspaceDataAjaxContract['startImportJob']> = jest.fn(async (_root, _id, _file) =>
    partial<WDSJob>({ jobId: 'new-job' })
  );

  const wdsProxyUrl = 'https://proxyurl';

  asMockedFn(Apps).mockReturnValue(
    partial<AppsAjaxContract>({
      listAppsV2: jest.fn(async (_id) => [
        partial<ListAppItem>({
          appType: 'WDS',
          appName: `wds-${defaultAzureWorkspace.workspace.workspaceId}`,
          status: 'RUNNING',
          proxyUrls: { wds: wdsProxyUrl },
          workspaceId: defaultAzureWorkspace.workspace.workspaceId,
        }),
      ]),
    })
  );
  asMockedFn(Billing).mockReturnValue(
    partial<BillingContract>({
      listProjects: jest.fn(async () => [partial<BillingProject>({})]),
    })
  );
  asMockedFn(Catalog).mockReturnValue(
    partial<CatalogContract>({
      exportDataset,
    })
  );
  asMockedFn(FirecloudBucket).mockReturnValue(
    partial<FirecloudBucketAjaxContract>({
      getTemplateWorkspaces: jest.fn(async () => []),
    })
  );
  asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent: jest.fn() }));
  asMockedFn(WorkspaceData).mockReturnValue(
    partial<WorkspaceDataAjaxContract>({
      startImportJob,
    })
  );
  asMockedFn(Workspaces).mockReturnValue(
    partial<WorkspacesAjaxContract>({
      workspace: getWorkspaceApi,
    })
  );

  asMockedFn(useRoute).mockReturnValue({
    query: queryParams,
  });

  render(h(ImportDataContainer));

  await waitFor(() => {
    expect(screen.queryByTestId('loading-spinner')).toBeNull();
    expect(screen.queryByText('Loading...')).toBeNull();
  });

  return {
    exportDataset,
    getWorkspaceApi,
    importBagit,
    importJob,
    importJSON,
    importSnapshot,
    startImportJob,
    wdsProxyUrl,
  };
};

const importIntoExistingWorkspace = async (user: UserEvent, workspaceName: string): Promise<void> => {
  const existingWorkspace = screen.getByText(selectExistingWorkspacePrompt, { exact: false });
  await user.click(existingWorkspace);

  const workspaceSelect = new SelectHelper(screen.getByLabelText('Select a workspace'), user);
  await workspaceSelect.selectOption(new RegExp(workspaceName));

  await user.click(screen.getByRole('button', { name: 'Import' }));
};

describe('ImportData', () => {
  beforeEach(() => {
    // Arrange
    asMockedFn(useWorkspaces).mockReturnValue({
      workspaces: [defaultAzureWorkspace, defaultGoogleWorkspace],
      loading: false,
      refresh: () => Promise.resolve(),
      status: 'Ready',
    });
  });

  describe('files', () => {
    describe('PFB files', () => {
      it('imports PFB files into GCP workspaces', async () => {
        // Arrange
        const user = userEvent.setup();

        const importUrl = 'https://example.com/path/to/file.pfb';
        const { getWorkspaceApi, importJob, startImportJob } = await setup({
          queryParams: {
            format: 'PFB',
            url: importUrl,
          },
        });

        // Act
        await importIntoExistingWorkspace(user, defaultGoogleWorkspace.workspace.name);

        // Assert
        expect(getWorkspaceApi).toHaveBeenCalledWith(
          defaultGoogleWorkspace.workspace.namespace,
          defaultGoogleWorkspace.workspace.name
        );

        expect(importJob).toHaveBeenCalledWith(importUrl, 'pfb', null);
        expect(startImportJob).not.toHaveBeenCalled();
      });

      it('imports PFB files into Azure workspaces', async () => {
        // Arrange
        const user = userEvent.setup();

        asMockedFn(isFeaturePreviewEnabled).mockImplementation(
          (featurePreview) => featurePreview === ENABLE_AZURE_PFB_IMPORT
        );

        const importUrl = 'https://example.com/path/to/file.pfb';
        const { importJob, startImportJob, wdsProxyUrl } = await setup({
          queryParams: {
            format: 'PFB',
            url: importUrl,
          },
        });

        // Act
        await importIntoExistingWorkspace(user, defaultAzureWorkspace.workspace.name);

        // Assert
        expect(startImportJob).toHaveBeenCalledWith(wdsProxyUrl, defaultAzureWorkspace.workspace.workspaceId, {
          url: importUrl,
          type: 'PFB',
        });
        expect(importJob).not.toHaveBeenCalled();
      });
    });

    it('imports BagIt files when format is unspecified', async () => {
      // Arrange
      const user = userEvent.setup();

      const importUrl = 'https://example.com/path/to/file.bagit';
      const { getWorkspaceApi, importBagit } = await setup({
        queryParams: {
          url: importUrl,
        },
      });

      // Act
      await importIntoExistingWorkspace(user, defaultGoogleWorkspace.workspace.name);

      // Assert
      expect(getWorkspaceApi).toHaveBeenCalledWith(
        defaultGoogleWorkspace.workspace.namespace,
        defaultGoogleWorkspace.workspace.name
      );

      expect(importBagit).toHaveBeenCalledWith(importUrl);
    });

    it('imports Rawls entities JSON files', async () => {
      // Arrange
      const user = userEvent.setup();

      const importUrl = 'https://example.com/path/to/file.json';
      const { getWorkspaceApi, importJSON } = await setup({
        queryParams: {
          format: 'entitiesJson',
          url: importUrl,
        },
      });

      // Act
      await importIntoExistingWorkspace(user, defaultGoogleWorkspace.workspace.name);

      // Assert
      expect(getWorkspaceApi).toHaveBeenCalledWith(
        defaultGoogleWorkspace.workspace.namespace,
        defaultGoogleWorkspace.workspace.name
      );

      expect(importJSON).toHaveBeenCalledWith(importUrl);
    });
  });

  describe('TDR', () => {
    describe('snapshot exports', () => {
      const commonSnapshotExportQueryParams = {
        format: 'tdrexport',
        tdrmanifest: 'https://example.com/path/to/manifest.json',
        tdrSyncPermissions: 'true',
        url: 'https://data.terra.bio',
      };

      it('imports snapshot exports into Google workspaces', async () => {
        // Arrange
        const user = userEvent.setup();

        const queryParams = {
          ...commonSnapshotExportQueryParams,
          snapshotId: googleSnapshotFixture.id,
        };
        const { getWorkspaceApi, importJob } = await setup({ queryParams });

        // Act
        await importIntoExistingWorkspace(user, defaultGoogleWorkspace.workspace.name);

        // Assert
        expect(getWorkspaceApi).toHaveBeenCalledWith(
          defaultGoogleWorkspace.workspace.namespace,
          defaultGoogleWorkspace.workspace.name
        );

        expect(importJob).toHaveBeenCalledWith(queryParams.tdrmanifest, 'tdrexport', { tdrSyncPermissions: true });
      });

      it('imports snapshots into Azure workspaces', async () => {
        // Arrange
        const user = userEvent.setup();

        asMockedFn(isFeaturePreviewEnabled).mockImplementation(
          (featurePreview) => featurePreview === ENABLE_AZURE_TDR_IMPORT
        );

        // Azure tdr import expects the tdrmanifest to be a URL object, not a string
        const queryParams = {
          ...commonSnapshotExportQueryParams,
          snapshotId: azureSnapshotFixture.id,
        };
        const { importJob, startImportJob, wdsProxyUrl } = await setup({ queryParams });

        // Act
        await importIntoExistingWorkspace(user, defaultAzureWorkspace.workspace.name);

        expect(startImportJob).toHaveBeenCalledWith(wdsProxyUrl, defaultAzureWorkspace.workspace.workspaceId, {
          url: queryParams.tdrmanifest,
          type: 'TDRMANIFEST',
        });
        expect(importJob).not.toHaveBeenCalled();
      });
    });

    describe('snapshot references', () => {
      it('imports a snapshot by reference', async () => {
        // Arrange
        const user = userEvent.setup();

        const queryParams = {
          format: 'snapshot',
          snapshotId: googleSnapshotFixture.id,
        };
        const { getWorkspaceApi, importSnapshot } = await setup({ queryParams });

        // Act
        await importIntoExistingWorkspace(user, defaultGoogleWorkspace.workspace.name);

        // Assert
        expect(getWorkspaceApi).toHaveBeenCalledWith(
          defaultGoogleWorkspace.workspace.namespace,
          defaultGoogleWorkspace.workspace.name
        );

        expect(importSnapshot).toHaveBeenCalledWith(queryParams.snapshotId, googleSnapshotFixture.name);
      });
    });
  });

  describe('catalog', () => {
    it('imports from the data catalog', async () => {
      // Arrange
      const user = userEvent.setup();

      const queryParams = {
        format: 'catalog',
        catalogDatasetId: '00001111-2222-3333-aaaa-bbbbccccdddd',
      };
      const { exportDataset } = await setup({ queryParams });

      // Act
      await importIntoExistingWorkspace(user, defaultGoogleWorkspace.workspace.name);

      // Assert
      expect(exportDataset).toHaveBeenCalledWith({
        id: queryParams.catalogDatasetId,
        workspaceId: defaultGoogleWorkspace.workspace.workspaceId,
      });
    });
  });

  it.each([
    { queryParams: { format: 'pfb' }, expectedErrorMessage: 'A URL is required' },
    {
      queryParams: { format: 'tdrexport' },
      expectedErrorMessage: 'A snapshot ID is required',
    },
  ] as { queryParams: Record<string, any>; expectedErrorMessage: string }[])(
    'renders an error message for invalid import requests',
    async ({ queryParams, expectedErrorMessage }) => {
      // Act
      await setup({ queryParams });

      // Assert
      screen.getByText('Invalid import request.');
      screen.getByText(expectedErrorMessage);
    }
  );
});
