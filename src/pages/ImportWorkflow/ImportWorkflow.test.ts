import { DeepPartial } from '@terra-ui-packages/core-utils';
import { AuditInfo, CloudContext } from '@terra-ui-packages/leonardo-data-client';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import _ from 'lodash';
import { h } from 'react-hyperscript-helpers';
import { Billing, BillingContract } from 'src/libs/ajax/billing/Billing';
import { BillingProject } from 'src/libs/ajax/billing/billing-models';
import { GroupContract, Groups, GroupsContract } from 'src/libs/ajax/Groups';
import { Apps, AppsAjaxContract } from 'src/libs/ajax/leonardo/Apps';
import { ListAppItem } from 'src/libs/ajax/leonardo/models/app-models';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { Cbas, CbasAjaxContract, CbasMethodsContract } from 'src/libs/ajax/workflows-app/Cbas';
import { errorWatcher } from 'src/libs/error.mock';
import * as Nav from 'src/libs/nav';
import { getTerraUser } from 'src/libs/state';
import { asMockedFn, partial, renderWithAppContexts as render, SelectHelper } from 'src/testing/test-utils';
import { useWorkspaces } from 'src/workspaces/common/state/useWorkspaces';
import { WorkspaceWrapper } from 'src/workspaces/utils';

import { importDockstoreWorkflow } from './importDockstoreWorkflow';
import { ImportWorkflow } from './ImportWorkflow';
import { useDockstoreWdl } from './useDockstoreWdl';

jest.mock('src/libs/ajax');
jest.mock('src/libs/ajax/leonardo/Apps');
jest.mock('src/libs/ajax/billing/Billing');
jest.mock('src/libs/ajax/workflows-app/Cbas');
jest.mock('src/libs/ajax/Groups');
jest.mock('src/libs/ajax/Metrics');

type UseWorkspacesExports = typeof import('src/workspaces/common/state/useWorkspaces');
jest.mock('src/workspaces/common/state/useWorkspaces', (): UseWorkspacesExports => {
  return {
    ...jest.requireActual<UseWorkspacesExports>('src/workspaces/common/state/useWorkspaces'),
    useWorkspaces: jest.fn(),
  };
});

type ImportDockstoreWorkflowExports = typeof import('./importDockstoreWorkflow');
jest.mock(
  './importDockstoreWorkflow',
  (): ImportDockstoreWorkflowExports => ({
    importDockstoreWorkflow: jest.fn().mockResolvedValue(undefined),
  })
);

type FeaturePrev = typeof import('src/libs/feature-previews');
jest.mock(
  'src/libs/feature-previews',
  (): FeaturePrev => ({
    ...jest.requireActual('src/libs/feature-previews'),
    isFeaturePreviewEnabled: jest.fn(),
  })
);

type UseDockstoreWdlExports = typeof import('./useDockstoreWdl');
jest.mock(
  './useDockstoreWdl',
  (): UseDockstoreWdlExports => ({
    useDockstoreWdl: jest.fn().mockReturnValue({
      status: 'Ready',
      wdl: 'workflow TestWorkflow {}',
    }),
  })
);

type RuntimeCommonComponentsExports = typeof import('src/analysis/runtime-common-components.js');
jest.mock(
  'src/analysis/runtime-common-components.js',
  (): Partial<RuntimeCommonComponentsExports> => ({
    setAzureCookieOnUrl: jest.fn().mockResolvedValue(undefined),
  })
);

type NavExports = typeof import('src/libs/nav');
jest.mock(
  'src/libs/nav',
  (): NavExports => ({
    ...jest.requireActual('src/libs/nav'),
    goToPath: jest.fn(),
    getLink: jest.fn().mockReturnValue(''),
  })
);

type ErrorExports = typeof import('src/libs/error');
jest.mock('src/libs/error', (): ErrorExports => {
  const errorModule = jest.requireActual('src/libs/error');
  const mockErrorModule = jest.requireActual('src/libs/error.mock');
  return {
    ...errorModule,
    withErrorReporting: mockErrorModule.mockWithErrorReporting,
  };
});

type StateExports = typeof import('src/libs/state');
jest.mock(
  'src/libs/state',
  (): StateExports => ({
    ...jest.requireActual('src/libs/state'),
    getTerraUser: jest.fn(),
  })
);

type ReactNotificationsComponentExports = typeof import('react-notifications-component');
jest.mock('react-notifications-component', (): DeepPartial<ReactNotificationsComponentExports> => {
  return {
    Store: {
      addNotification: jest.fn(),
      removeNotification: jest.fn(),
    },
  };
});

describe('ImportWorkflow', () => {
  const mockAppResponse: ListAppItem[] = [
    partial<ListAppItem>({
      workspaceId: '79201ea6-519a-4077-a9a4-75b2a7c4cdeb',
      cloudContext: partial<CloudContext>({
        cloudProvider: 'AZURE',
      }),
      status: 'RUNNING',
      proxyUrls: {
        cbas: 'https://abc.servicebus.windows.net/terra-app-3b8d9c55-7eee-49e9-a998-e8c6db05e374-79201ea6-519a-4077-a9a4-75b2a7c4cdeb/cbas',
        'cbas-ui':
          'https://abc.servicebus.windows.net/terra-app-3b8d9c55-7eee-49e9-a998-e8c6db05e374-79201ea6-519a-4077-a9a4-75b2a7c4cdeb/',
        cromwell:
          'https://abc.servicebus.windows.net/terra-app-3b8d9c55-7eee-49e9-a998-e8c6db05e374-79201ea6-519a-4077-a9a4-75b2a7c4cdeb/cromwell',
      },
      appName: 'terra-app-3b8d9c55-7eee-49e9-a998-e8c6db05e374',
      appType: 'CROMWELL',
      auditInfo: partial<AuditInfo>({
        creator: 'abc@gmail.com',
      }),
    }),
    partial<ListAppItem>({
      workspaceId: '79201ea6-519a-4077-a9a4-75b2a7c4cdeb',
      cloudContext: partial<CloudContext>({
        cloudProvider: 'AZURE',
      }),
      status: 'RUNNING',
      proxyUrls: {
        wds: 'https://abc.servicebus.windows.net/wds-79201ea6-519a-4077-a9a4-75b2a7c4cdeb-79201ea6-519a-4077-a9a4-75b2a7c4cdeb/',
      },
      appName: 'wds-79201ea6-519a-4077-a9a4-75b2a7c4cdeb',
      appType: 'WDS',
      auditInfo: partial<AuditInfo>({
        creator: 'abc@gmail.com',
      }),
    }),
  ];

  beforeAll(() => {
    // Arrange
    asMockedFn(useWorkspaces).mockReturnValue({
      workspaces: [
        {
          workspace: {
            namespace: 'test',
            name: 'gcp-workspace1',
            workspaceId: '6771d2c8-cd58-47da-a54c-6cdafacc4175',
            cloudPlatform: 'Gcp',
          },
          accessLevel: 'WRITER',
        },
        {
          workspace: {
            namespace: 'test',
            name: 'gcp-workspace2',
            workspaceId: '5cfa16d8-d604-4de8-8e8a-acde05d71b99',
            cloudPlatform: 'Gcp',
          },
          accessLevel: 'WRITER',
        },
        {
          workspace: {
            namespace: 'azure-test1',
            name: 'azure-workspace1',
            workspaceId: '79201ea6-519a-4077-a9a4-75b2a7c4cdeb',
            cloudPlatform: 'Azure',
            createdBy: 'abc@gmail.com',
          },
          accessLevel: 'OWNER',
        },
        {
          workspace: {
            namespace: 'azure-test2',
            name: 'azure-workspace2',
            workspaceId: 'c2486653-f5dc-4a86-826a-4ba8c6624d10',
            cloudPlatform: 'Azure',
            createdBy: 'not-abc@gmail.com',
          },
          accessLevel: 'WRITER',
        },
      ] as WorkspaceWrapper[],
      refresh: () => Promise.resolve(),
      loading: false,
      status: 'Ready',
    });

    asMockedFn(getTerraUser).mockReturnValue({
      email: 'abc@gmail.com',
    });

    asMockedFn(Billing).mockReturnValue(
      partial<BillingContract>({
        listProjects: async () => [
          partial<BillingProject>({
            billingAccount: 'billingAccounts/FOO-BAR-BAZ',
            cloudPlatform: 'GCP',
            invalidBillingAccount: false,
            projectName: 'Google Billing Project',
            roles: ['Owner'],
            status: 'Ready',
          }),
          partial<BillingProject>({
            // billingAccount: 'billingAccounts/BAA-RAM-EWE',
            cloudPlatform: 'AZURE',
            invalidBillingAccount: false,
            projectName: 'Azure Billing Project',
            roles: ['Owner'],
            status: 'Ready',
          }),
        ],
      })
    );

    asMockedFn(Groups).mockReturnValue(
      partial<GroupsContract>({
        list: async () => {
          return [];
        },
        group: (_groupName) =>
          partial<GroupContract>({
            isMember: async () => {
              return true;
            },
          }),
      })
    );

    asMockedFn(Metrics).mockReturnValue(
      partial<MetricsContract>({
        captureEvent: async () => {}, // do nothing
      })
    );
  });

  it('fetches and renders WDL', () => {
    // Act
    render(
      h(ImportWorkflow, {
        path: 'github.com/DataBiosphere/test-workflows/test-workflow',
        version: 'v1.0.0',
        source: 'dockstore',
      })
    );

    // Assert
    expect(useDockstoreWdl).toHaveBeenCalledWith({
      path: 'github.com/DataBiosphere/test-workflows/test-workflow',
      version: 'v1.0.0',
      isTool: false,
    });

    const wdlContainer = document.querySelector('code')!;
    expect(wdlContainer).toHaveTextContent('workflow TestWorkflow {}');
  });

  describe('workflow name', () => {
    it('defaults workflow name based on path', () => {
      // Act
      render(
        h(ImportWorkflow, {
          path: 'github.com/DataBiosphere/test-workflows/test-workflow',
          version: 'v1.0.0',
          source: 'dockstore',
        })
      );

      // Assert
      const nameInput = screen.getByLabelText('Workflow Name');
      expect(nameInput).toHaveValue('test-workflow');
    });

    it('validates name based on allowed symbols', async () => {
      // Act
      render(
        h(ImportWorkflow, {
          path: 'github.com/DataBiosphere/test-workflows/test-workflow',
          version: 'v1.0.0',
          source: 'dockstore',
        })
      );

      const nameInput = screen.getByLabelText('Workflow Name');

      fireEvent.change(nameInput, { target: { value: 'a new workflow name' } });

      // Assert
      screen.getByText('Workflow name can only contain letters, numbers, underscores, dashes, and periods');
    });

    it('validates name based on maximum length', async () => {
      // Act
      render(
        h(ImportWorkflow, {
          path: 'github.com/DataBiosphere/test-workflows/test-workflow',
          version: 'v1.0.0',
          source: 'dockstore',
        })
      );

      const nameInput = screen.getByLabelText('Workflow Name');

      fireEvent.change(nameInput, { target: { value: _.repeat('a', 255) } });

      // Assert
      screen.getByText('Workflow name is too long (maximum is 254 characters)');
    });
  });

  it('it imports the workflow into the selected workspace', async () => {
    // Arrange
    const user = userEvent.setup();

    const testWorkflow = {
      path: 'github.com/DataBiosphere/test-workflows/test-workflow',
      version: 'v1.0.0',
      source: 'dockstore',
    };

    render(h(ImportWorkflow, { ...testWorkflow }));

    // Act
    const workspaceMenu = new SelectHelper(screen.getByLabelText('Destination Workspace'), user);
    await workspaceMenu.selectOption(/gcp-workspace1/);

    const importButton = screen.getByText('Import');
    await user.click(importButton);

    // Assert
    expect(importDockstoreWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: expect.objectContaining({ namespace: 'test', name: 'gcp-workspace1' }),
        workflow: testWorkflow,
      }),
      { overwrite: false }
    );
  });

  it('it imports the workflow into the selected Azure workspace', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockPostMethodResponse = {
      method_id: '031e1da5-b977-4467-b1d7-acc7054fe72d',
      run_set_id: 'd250fe2e-d5c2-4ccc-8484-3cd6179e312c',
    };
    const mockListAppsFn = jest.fn(() => Promise.resolve(mockAppResponse));
    const mockPostMethodAppsFn = jest.fn(() => Promise.resolve(mockPostMethodResponse));

    asMockedFn(Cbas).mockReturnValue(
      partial<CbasAjaxContract>({
        methods: partial<CbasMethodsContract>({ post: mockPostMethodAppsFn }),
      })
    );

    asMockedFn(Apps).mockReturnValue(
      partial<AppsAjaxContract>({
        listAppsV2: mockListAppsFn,
      })
    );

    const testWorkflow = {
      path: 'github.com/DataBiosphere/test-workflows/test-workflow',
      version: 'v1.0.0',
      source: 'dockstore',
    };

    render(h(ImportWorkflow, { ...testWorkflow }));

    // Act
    const workspaceMenu = new SelectHelper(screen.getByLabelText('Destination Workspace'), user);
    await workspaceMenu.selectOption(/azure-workspace1/);

    const importButton = screen.getByText('Import');
    await user.click(importButton);

    // Assert
    expect(mockListAppsFn).toHaveBeenCalledWith('79201ea6-519a-4077-a9a4-75b2a7c4cdeb');

    expect(mockPostMethodAppsFn).toHaveBeenCalledWith(
      'https://abc.servicebus.windows.net/terra-app-3b8d9c55-7eee-49e9-a998-e8c6db05e374-79201ea6-519a-4077-a9a4-75b2a7c4cdeb/cbas',
      expect.objectContaining({
        method_name: 'test-workflow',
        method_description: null,
        method_source: 'Dockstore',
        method_version: 'v1.0.0',
        method_url: 'github.com/DataBiosphere/test-workflows/test-workflow',
        method_input_mappings: [],
        method_output_mappings: [],
      })
    );

    expect(Nav.goToPath).toHaveBeenCalledWith('workspace-workflows-app', {
      methodId: '031e1da5-b977-4467-b1d7-acc7054fe72d',
      name: 'azure-workspace1',
      namespace: 'azure-test1',
    });
  });

  it("it should not import workflow into workspace where workspace wasn't created by current user", async () => {
    // Arrange
    const user = userEvent.setup();
    const mockListAppsFn: jest.MockedFunction<AppsAjaxContract['listAppsV2']> = jest.fn();
    mockListAppsFn.mockResolvedValue(mockAppResponse);

    asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listAppsV2: mockListAppsFn }));

    const testWorkflow = {
      path: 'github.com/DataBiosphere/test-workflows/test-workflow',
      version: 'v1.0.0',
      source: 'dockstore',
    };

    render(h(ImportWorkflow, { ...testWorkflow }));

    // Act
    const workspaceMenu = new SelectHelper(screen.getByLabelText('Destination Workspace'), user);
    await workspaceMenu.selectOption(/azure-workspace2/);

    const importButton = screen.getByText('Import');
    await user.click(importButton);

    // Assert
    expect(mockListAppsFn).toBeCalledTimes(0);
    expect(errorWatcher).toHaveBeenCalledWith('Error importing workflow', expect.any(Error));
  });

  it('opens new workspace modal with azure disabled', async () => {
    // Arrange
    const user = userEvent.setup();

    const testWorkflow = {
      path: 'github.com/DataBiosphere/test-workflows/test-workflow',
      version: 'v1.0.0',
      source: 'dockstore',
    };

    render(h(ImportWorkflow, { ...testWorkflow }));

    // Act
    const createWorkspaceButton = screen.getByText('create a new workspace');
    await user.click(createWorkspaceButton);

    screen.getByText(
      'Importing directly into new Azure workspaces is not currently supported. To create a new workspace with an Azure billing project, visit the main',
      { exact: false }
    );
  });

  it('confirms overwrite if workflow already exists', async () => {
    // Arrange
    const user = userEvent.setup();

    asMockedFn(importDockstoreWorkflow).mockRejectedValueOnce(new Response('{}', { status: 409 }));

    const testWorkflow = {
      path: 'github.com/DataBiosphere/test-workflows/test-workflow',
      version: 'v1.0.0',
      source: 'dockstore',
    };

    render(h(ImportWorkflow, { ...testWorkflow }));

    // Act
    const workspaceMenu = new SelectHelper(screen.getByLabelText('Destination Workspace'), user);
    await workspaceMenu.selectOption(/gcp-workspace1/);

    const importButton = screen.getByText('Import');
    await user.click(importButton);
    const firstImportDockstoreWorkflowCallArgs = asMockedFn(importDockstoreWorkflow).mock.calls[0];

    const confirmationMessageShown = !!screen.queryByText(
      'The selected workspace already contains a workflow named "test-workflow". Are you sure you want to overwrite it?'
    );
    const confirmButton = screen.getByText('Overwrite');
    await user.click(confirmButton);
    const secondImportDockstoreWorkflowCallArgs = asMockedFn(importDockstoreWorkflow).mock.calls[1];

    // Assert
    expect(firstImportDockstoreWorkflowCallArgs).toEqual([
      expect.objectContaining({
        workspace: expect.objectContaining({ namespace: 'test', name: 'gcp-workspace1' }),
        workflow: testWorkflow,
      }),
      { overwrite: false },
    ]);

    expect(confirmationMessageShown).toBe(true);

    expect(secondImportDockstoreWorkflowCallArgs).toEqual([
      expect.objectContaining({
        workspace: expect.objectContaining({ namespace: 'test', name: 'gcp-workspace1' }),
        workflow: testWorkflow,
      }),
      { overwrite: true },
    ]);
  });
});
