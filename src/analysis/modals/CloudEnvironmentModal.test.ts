import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h, p } from 'react-hyperscript-helpers';
import {
  azureDisk,
  azureRuntime,
  defaultTestDisk,
  galaxyRunning,
  generateTestApp,
  getGoogleRuntime,
} from 'src/analysis/_testData/testData';
import { CloudEnvironmentModal } from 'src/analysis/modals/CloudEnvironmentModal';
import { PeriodicAzureCookieSetter } from 'src/analysis/runtime-common-components';
import { appToolLabels, tools } from 'src/analysis/utils/tool-utils';
import { GoogleStorage } from 'src/libs/ajax/GoogleStorage';
import { Apps } from 'src/libs/ajax/leonardo/Apps';
import { App } from 'src/libs/ajax/leonardo/models/app-models';
import { Runtimes } from 'src/libs/ajax/leonardo/Runtimes';
import { cloudProviderTypes } from 'src/libs/workspace-utils';
import { asMockedFn, renderWithAppContexts as render } from 'src/testing/test-utils';
import { defaultAzureWorkspace, defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';

type RuntimesAjaxExports = typeof import('src/libs/ajax/leonardo/Runtimes');
type AppsAjaxExports = typeof import('src/libs/ajax/leonardo/Apps');

jest.mock('src/analysis/runtime-common-components', () => {
  return {
    ...jest.requireActual('src/analysis/runtime-common-components'),
    PeriodicAzureCookieSetter: jest.fn().mockReturnValue(null),
    setAzureCookieOnUrl: jest.fn().mockReturnValue(null),
  };
});

jest.mock('src/libs/ajax/leonardo/Runtimes', (): RuntimesAjaxExports => {
  return {
    ...jest.requireActual('src/libs/ajax/leonardo/Runtimes'),
    Runtimes: jest.fn(),
  };
});

jest.mock('src/libs/ajax/leonardo/Apps', (): AppsAjaxExports => {
  return {
    ...jest.requireActual('src/libs/ajax/leonardo/Apps'),
    Apps: jest.fn(),
  };
});

type AppsContract = ReturnType<typeof Apps>;
type AppsAppContract = ReturnType<AppsContract['app']>;
type RuntimesContract = ReturnType<typeof Runtimes>;

const stubReactModal = ({ modalName }) => {
  return p(modalName);
};

type AzureComputeModalExports = typeof import('src/analysis/modals/ComputeModal/AzureComputeModal/AzureComputeModal');
jest.mock('src/analysis/modals/ComputeModal/AzureComputeModal/AzureComputeModal', (): AzureComputeModalExports => {
  return {
    ...jest.requireActual('src/analysis/modals/ComputeModal/AzureComputeModal/AzureComputeModal'),
    AzureComputeModalBase: (_obj: any) => stubReactModal({ modalName: 'AzureComputeModalBase' }),
  };
});
type GcpComputeModalExports = typeof import('src/analysis/modals/ComputeModal/GcpComputeModal/GcpComputeModal');
jest.mock('src/analysis/modals/ComputeModal/GcpComputeModal/GcpComputeModal', (): GcpComputeModalExports => {
  return {
    ...jest.requireActual('src/analysis/modals/ComputeModal/GcpComputeModal/GcpComputeModal'),
    GcpComputeModalBase: (_obj: any) => stubReactModal({ modalName: 'GcpComputeModalBase' }),
  };
});
type CromwellComputeModalExports = typeof import('src/analysis/modals/CromwellModal');
jest.mock('src/analysis/modals/CromwellModal', (): CromwellComputeModalExports => {
  return {
    ...jest.requireActual('src/analysis/modals/CromwellModal'),
    CromwellModalBase: (_obj: any) => stubReactModal({ modalName: 'CromwellModalBase' }),
  };
});
type GalaxyComputeModalExports = typeof import('src/analysis/modals/GalaxyModal');
jest.mock('src/analysis/modals/GalaxyModal', (): GalaxyComputeModalExports => {
  return {
    ...jest.requireActual('src/analysis/modals/GalaxyModal'),
    GalaxyModalBase: (_obj: any) => stubReactModal({ modalName: 'GalaxyModalBase' }),
  };
});

const AzureCloudEnvironmentModalDefaultProps: any = {
  isOpen: true,
  canCompute: true,
  runtimes: [],
  apps: [],
  appDataDisks: [],
  workspace: {
    azureContext: {
      managedResourceGroupId: 'mrg-terra-dev-jan23-20230123125907',
      subscriptionId: '3efc5bdf-be0e-44e7-b1d7-c08931e3c16c',
      tenantId: '0cb7a640-45a2-4ed6-be9f-63519f86e04b',
    },
    workspaceSubmissionStats: {
      runningSubmissionsCount: 0,
    },
    accessLevel: 'OWNER',
    owners: ['liz.baldo.dev@gmail.com', 'broadterraui@gmail.com'],
    workspace: {
      attributes: { description: 'for IA-4028' },
      authorizationDomain: [],
      bucketName: '',
      cloudPlatform: 'Azure',
      createdBy: 'broadterraui@gmail.com',
      createdDate: '2023-02-06T20:35:22.794Z',
      googleProject: '',
      isLocked: false,
      lastModified: '2023-02-06T20:35:22.797Z',
      name: 'jake-test-azure',
      namespace: 'azure-dev-2023-01-23',
      workspaceId: 'b6adedd9-d41f-4f06-a1de-9cb62a12caf2',
      workspaceType: 'mc',
      workspaceVersion: 'v2',
    },
    canShare: true,
    canCompute: true,
    workspaceInitialized: true,
  },
  persistentDisks: [],
  location: 'eastus',
  computeRegion: 'eastus',
  workspace2: {
    workspace: {
      namespace: 'azure-dev-2023-01-23',
      name: 'jake-test-azure',
    },
  },
  refreshRuntimes: () => {},
  refreshApps: () => {},
  onSuccess: () => {},
  onDismiss: () => {},
};

const CloudEnvironmentModalDefaultProps: any = {
  isOpen: true,
  onSuccess: () => {},
  onDismiss: () => {},
  canCompute: true,
  runtimes: [],
  apps: [],
  appDataDisks: [],
  refreshRuntimes: () => {},
  refreshApps: () => {},
  workspace: defaultGoogleWorkspace,
  persistentDisks: [],
  location: 'NORTHAMERICA-NORTHEAST1',
  computeRegion: 'NORTHAMERICA-NORTHEAST1',
  filterForTool: undefined,
};

const cromwellRunning: App = {
  workspaceId: null,
  accessScope: null,
  appName: 'terra-app-83f46705-524c-4fc8-xcyc-97fdvcfby14f',
  appType: 'CROMWELL',
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-28T20:28:01.998494Z',
    destroyedDate: null,
    dateAccessed: '2021-11-28T20:28:01.998494Z',
  },
  diskName: 'saturn-pd-026594ac-d829-423d-a8df-55fe36f5b4e8',
  errors: [],
  kubernetesRuntimeConfig: { numNodes: 1, machineType: 'n1-highmem-8', autoscalingEnabled: false },
  labels: {},
  cloudContext: {
    cloudProvider: cloudProviderTypes.AZURE,
    cloudResource: 'path/to/cloud/resource',
  },
  proxyUrls: {
    'cromwell-service':
      'https://leonardo-fiab.dsde-dev.broadinstitute.org/fd0cfbb14f/cromwell-service/swagger/cromwell.yaml',
    'cbas-ui': 'testValue',
  },
  status: 'RUNNING',
  region: 'us-central1',
};

const hailBatchAppRunning: App = {
  workspaceId: null,
  accessScope: null,
  appName: 'test-hail-batch-app',
  cloudContext: {
    cloudProvider: 'AZURE',
    cloudResource: 'path/to/cloud/resource',
  },
  kubernetesRuntimeConfig: {
    numNodes: 1,
    machineType: 'Standard_A2_v2',
    autoscalingEnabled: false,
  },
  errors: [],
  status: 'RUNNING',
  proxyUrls: {
    batch: 'https://lz123.servicebus.windows.net/test-hail-batch-app/batch',
  },
  diskName: null,
  customEnvironmentVariables: {},
  auditInfo: {
    creator: 'abc.testerson@gmail.com',
    createdDate: '2023-01-18T23:28:47.605176Z',
    destroyedDate: null,
    dateAccessed: '2023-01-18T23:28:47.605176Z',
  },
  appType: appToolLabels.HAIL_BATCH,
  labels: {
    cloudContext: 'path/to/cloud/context',
    appName: 'test-cromwell-app',
    clusterServiceAccount: '/subscriptions/123/pet-101',
    creator: 'abc.testerson@gmail.com',
  },
  region: 'us-central1',
};

type NavExports = typeof import('src/libs/nav');

jest.mock(
  'src/libs/nav',
  (): Partial<NavExports> => ({
    getCurrentUrl: jest.fn().mockReturnValue(new URL('https://app.terra.bio')),
    getLink: jest.fn(),
    goToPath: jest.fn(),
  })
);

describe('CloudEnvironmentModal', () => {
  // vanilla envs
  it('Renders cloud environment modal with minimal details', () => {
    // Arrange
    const cloneCEM = { ...CloudEnvironmentModalDefaultProps };
    // Act
    const vdom = render(h(CloudEnvironmentModal, cloneCEM));
    // Assert
    expect(vdom.getByText('Cloud Environment Details'));
    expect(vdom.getByAltText('Jupyter'));
    expect(vdom.getByAltText('RStudio'));
    expect(vdom.getByAltText('GALAXY'));
  });

  it('Renders azure cloud environment modal with minimal details', () => {
    // Arrange
    const cloneAzure = { ...AzureCloudEnvironmentModalDefaultProps };
    // Act
    const vdom = render(h(CloudEnvironmentModal, cloneAzure));
    // Assert
    expect(vdom.getByText('Cloud Environment Details'));
    expect(vdom.getByAltText('JupyterLab'));
  });
  // populated envs
  it('Renders populated cloud environment', () => {
    // Arrange
    const CloneCEM = {
      ...CloudEnvironmentModalDefaultProps,
      runtimes: [getGoogleRuntime()],
      apps: [generateTestApp({})],
      appDataDisks: [defaultTestDisk],
    };
    // Act
    const vdom = render(h(CloudEnvironmentModal, CloneCEM));
    // Assert
    expect(vdom.getByText('Cloud Environment Details'));
    expect(vdom.getByAltText('Jupyter'));
    expect(vdom.getByAltText('RStudio'));
    expect(vdom.getByAltText('GALAXY'));
    expect(vdom.getAllByText(/Running/).length).toBe(2);
    expect(vdom.getAllByText('Pause').length).toBe(3);
    expect(vdom.getAllByText('Open').length).toBe(3);
  });

  it('Renders populated azure cloud environment modal', () => {
    // Arrange
    const cloneAzure = {
      ...AzureCloudEnvironmentModalDefaultProps,
      workspace: defaultAzureWorkspace,
      persistentDisks: [azureDisk],
    };
    // Act
    const vdom = render(h(CloudEnvironmentModal, cloneAzure));
    // Assert
    expect(vdom.getByText('Cloud Environment Details'));
    expect(vdom.getByAltText('JupyterLab'));
    expect(vdom.getAllByText('Pause').length).toBe(1);
    expect(vdom.getAllByText('Open').length).toBe(1);
    expect(vdom.getAllByText('No Environment found').length).toBe(2);
    expect(vdom.getAllByText('No Environment found')[0]).not.toBeVisible();
  });

  // runtime/app status checks

  it.each([
    {
      // Deleting
      runtimeStatus: 'DELETING',
      appStatus: 'DELETING',
      runtimeRegex: /Deleting/,
      appRegex: /Deleting/,
      opName: 'Deleting',
    },
    {
      // Error
      runtimeStatus: 'ERROR',
      appStatus: 'ERROR',
      runtimeRegex: /Error/,
      appRegex: /Error/,
      opName: 'Error',
    },
    {
      // stopped/stopped
      runtimeStatus: 'STOPPED',
      appStatus: 'STOPPED',
      runtimeRegex: /Paused/,
      appRegex: /Paused/,
      opName: 'Stopped',
    },
    {
      // stopped/stopping
      runtimeStatus: 'STOPPED',
      appStatus: 'STOPPING',
      runtimeRegex: /Paused/,
      appRegex: /Stopping/,
      opName: 'stopped/stopping',
    },
    {
      // stopped/provisioning
      runtimeStatus: 'STOPPED',
      appStatus: 'PROVISIONING',
      runtimeRegex: /Paused/,
      appRegex: /Provisioning/,
      opName: 'stopped/provisioning',
    },
    {
      // stopped/starting
      runtimeStatus: 'STOPPED',
      appStatus: 'STARTING',
      runtimeRegex: /Paused/,
      appRegex: /Starting/,
      opName: 'stopped/starting',
    },
  ])('Shows indicators for $opName on GCE', (props) => {
    // Arrange
    const { runtimeStatus, appStatus, runtimeRegex, appRegex } = props;
    const CloneCEM = {
      ...CloudEnvironmentModalDefaultProps,
      runtimes: [{ ...getGoogleRuntime(), status: runtimeStatus }],
      apps: [{ ...generateTestApp({}), status: appStatus }],
      appDataDisks: [defaultTestDisk],
    };
    // Act
    const vdom = render(h(CloudEnvironmentModal, CloneCEM));
    // Assert
    expect(vdom.getAllByText(runtimeRegex).length > 0);
    expect(vdom.getAllByText(appRegex).length > 0);
  });

  it.each([
    {
      // Deleting
      runtimeStatus: 'DELETING',
      appStatus: 'DELETING',
      runtimeRegex: /Deleting/,
      appRegex: /Deleting/,
      opName: 'Deleting',
    },
    {
      // Error
      runtimeStatus: 'ERROR',
      appStatus: 'ERROR',
      runtimeRegex: /Error/,
      appRegex: /Error/,
      opName: 'Error',
    },
    {
      // stopped/stopped
      runtimeStatus: 'STOPPED',
      appStatus: 'STOPPED',
      runtimeRegex: /Paused/,
      appRegex: /Paused/,
      opName: 'Stopped',
    },
    {
      // stopped/stopping
      runtimeStatus: 'STOPPED',
      appStatus: 'STOPPING',
      runtimeRegex: /Paused/,
      appRegex: /Paused/,
      opName: 'stopped/stopping',
    },
    {
      // stopped/provisioning
      runtimeStatus: 'STOPPED',
      appStatus: 'PROVISIONING',
      runtimeRegex: /Paused/,
      appRegex: /Paused/,
      opName: 'stopped/provisioning',
    },
    {
      // stopped/starting
      runtimeStatus: 'STOPPED',
      appStatus: 'STARTING',
      runtimeRegex: /Paused/,
      appRegex: /Paused/,
      opName: 'stopped/starting',
    },
  ])('Shows indicators for $opName on Azure', (props) => {
    // Arrange
    const { runtimeStatus, appStatus, runtimeRegex, appRegex } = props;
    const cloneAzure = {
      ...AzureCloudEnvironmentModalDefaultProps,
      runtimes: [{ ...azureRuntime, status: runtimeStatus }],
      apps: [{ ...generateTestApp({}), status: appStatus }],
      workspace: defaultAzureWorkspace,
      persistentDisks: [azureDisk],
    };
    // Act
    const vdom = render(h(CloudEnvironmentModal, cloneAzure));
    // Assert
    expect(vdom.getAllByText(runtimeRegex).length > 0);
    expect(vdom.getAllByText(appRegex).length > 0);
  });

  // button tests(pause)
  it.each([
    {
      // Jupyter
      input: {
        ...CloudEnvironmentModalDefaultProps,
        runtimes: [getGoogleRuntime()],
        apps: [
          generateTestApp({
            appName: 'app1',
            status: 'RUNNING',
          }),
        ],
        appDataDisks: [defaultTestDisk],
      },
      expectedOutput: {
        buttonIndex: 0,
        stopTimes: 1,
        pauseTimes: 0,
      },
      toolName: 'Jupyter',
    },
    {
      // RStudio
      input: {
        ...CloudEnvironmentModalDefaultProps,
        runtimes: [
          getGoogleRuntime({
            tool: tools.RStudio,
          }),
        ],
        appDataDisks: [defaultTestDisk],
      },
      expectedOutput: {
        buttonIndex: 1,
        stopTimes: 1,
        pauseTimes: 0,
      },
      toolName: 'RStudio',
    },
    {
      // Galaxy
      input: {
        ...CloudEnvironmentModalDefaultProps,
        runtimes: [getGoogleRuntime()],
        apps: [galaxyRunning],
        appDataDisks: [defaultTestDisk],
      },
      expectedOutput: {
        buttonIndex: 2,
        stopTimes: 0,
        pauseTimes: 1,
      },
      toolName: 'Galaxy',
    },
  ])(
    'Invokes ajax call for pause button for $toolName on a populated google cloud environments instance',
    async ({ input, expectedOutput }) => {
      // Arrange
      const user = userEvent.setup();
      // stop mock
      const stopFn = jest.fn();
      const mockRuntimes: Partial<RuntimesContract> = {
        runtimeWrapper: jest.fn(),
      };

      asMockedFn((mockRuntimes as RuntimesContract).runtimeWrapper).mockImplementation(() => {
        type RuntimesWrapperContract = ReturnType<RuntimesContract['runtimeWrapper']>;

        const mockAppContract: Partial<RuntimesWrapperContract> = {
          stop: stopFn,
        };
        const stopContract = mockAppContract as RuntimesWrapperContract;
        asMockedFn(stopContract.stop);
        return stopContract;
      });

      asMockedFn(Runtimes).mockImplementation(() => mockRuntimes as RuntimesContract);
      // pause mock
      const pauseFn = jest.fn();
      const mockApps: Partial<AppsContract> = {
        app: jest.fn(),
      };

      asMockedFn((mockApps as AppsContract).app).mockImplementation(() => {
        const mockAppContract: Partial<AppsAppContract> = {
          pause: pauseFn,
        };
        const pauseContract = mockAppContract as AppsAppContract;
        asMockedFn(pauseContract.pause);
        return pauseContract;
      });
      asMockedFn(Apps).mockImplementation(() => mockApps as AppsContract);

      asMockedFn(GoogleStorage);

      // Act
      render(h(CloudEnvironmentModal, input));
      // Assert
      const pauseButtons = screen.getAllByText('Pause');
      expect(pauseButtons.length).toBe(3);
      await user.click(pauseButtons[expectedOutput.buttonIndex]);
      expect(stopFn).toBeCalledTimes(expectedOutput.stopTimes);
      expect(pauseFn).toBeCalledTimes(expectedOutput.pauseTimes);
    }
  );

  it('Invokes ajax call for pause button on a populated azure cloud environments instance', async () => {
    // Arrange
    const user = userEvent.setup();
    // stop mock
    const stopFn = jest.fn();
    const mockRuntimes: Partial<RuntimesContract> = {
      runtimeWrapper: jest.fn(),
      list: jest.fn(),
      invalidateCookie: jest.fn(),
      setCookie: jest.fn(),
      runtime: jest.fn(),
      azureProxy: jest.fn(),
      listV2: jest.fn(),
      listV2WithWorkspace: jest.fn(),
      runtimeV2: jest.fn(),
      fileSyncing: jest.fn(),
    };

    asMockedFn((mockRuntimes as RuntimesContract).runtimeWrapper).mockImplementation(() => {
      type AjaxRuntimesWrapperContract = ReturnType<RuntimesContract['runtimeWrapper']>;

      const mockAppContract: Partial<AjaxRuntimesWrapperContract> = {
        stop: stopFn,
      };
      const stopContract = mockAppContract as AjaxRuntimesWrapperContract;
      asMockedFn(stopContract.stop);
      return stopContract;
    });

    asMockedFn(Runtimes).mockImplementation(() => mockRuntimes as RuntimesContract);
    // pause mock
    const mockApps: Partial<AppsContract> = {
      app: jest.fn(),
    };

    asMockedFn(Apps).mockImplementation(() => mockApps as AppsContract);

    const cloneAzure = {
      ...AzureCloudEnvironmentModalDefaultProps,
      workspace: defaultAzureWorkspace,
      runtimes: [azureRuntime],
    };

    // Act
    render(h(CloudEnvironmentModal, cloneAzure));
    // Assert
    const pauseButton = screen.getByText('Pause');
    await user.click(pauseButton);
    expect(stopFn).toBeCalledTimes(1);
  });

  // button tests(launch)
  it.each([
    {
      // Jupyter
      input: {
        ...CloudEnvironmentModalDefaultProps,
        runtimes: [getGoogleRuntime()],
        apps: [
          generateTestApp({
            appName: 'app1',
            status: 'RUNNING',
          }),
        ],
        appDataDisks: [defaultTestDisk],
      },
      buttonIndex: 0,
      toolName: 'Jupyter',
    },
    {
      // RStudio
      input: {
        ...CloudEnvironmentModalDefaultProps,
        runtimes: [
          getGoogleRuntime({
            tool: tools.RStudio,
          }),
        ],
        appDataDisks: [defaultTestDisk],
      },
      buttonIndex: 1,
      toolName: 'RStudio',
    },
    {
      // Galaxy
      input: {
        ...CloudEnvironmentModalDefaultProps,
        runtimes: [getGoogleRuntime()],
        apps: [galaxyRunning],
        appDataDisks: [defaultTestDisk],
      },
      buttonIndex: 2,
      toolName: 'Galaxy',
    },
  ])(
    'Invokes dismiss call for launch button for $toolName on a populated google cloud environments instance',
    async ({ input, buttonIndex }) => {
      // Arrange
      const dismissFn = jest.fn();
      const modalInput = {
        ...input,
        onDismiss: dismissFn,
      };

      // Act
      render(h(CloudEnvironmentModal, modalInput));
      // Assert
      const startButtons = screen.getAllByText('Open');
      expect(startButtons.length).toBe(3);
      expect(startButtons[buttonIndex]).toBeEnabled(); // TODO: can't check dismissed is called becuase HREF redirects
    }
  );

  it.each([0, 1])(
    'Invokes dismiss call for launch button on a populated azure cloud environments instance',
    async (buttonIndex) => {
      // Arrange
      const cloneAzure = {
        ...AzureCloudEnvironmentModalDefaultProps,
        // workspace: defaultAzureWorkspace,
        // runtime: azureRuntime,
      };

      // Act
      render(h(CloudEnvironmentModal, cloneAzure));
      // Assert
      const startButtons = screen.getAllByText('Open');
      expect(startButtons.length).toBe(1);
      expect(startButtons[buttonIndex]).toBeEnabled(); // TODO: can't check dismissed is called becuase HREF redirects
    }
  );

  // button tests(settings)
  it.each([
    {
      // Jupyter
      input: {
        ...CloudEnvironmentModalDefaultProps,
        runtimes: [getGoogleRuntime()],
        apps: [
          generateTestApp({
            appName: 'app1',
            status: 'RUNNING',
          }),
        ],
        appDataDisks: [defaultTestDisk],
      },
      buttonIndex: 0,
      modalName: 'GcpComputeModalBase',
      toolName: 'Jupyter',
    },
    {
      // RStudio
      input: {
        ...CloudEnvironmentModalDefaultProps,
        runtimes: [
          getGoogleRuntime({
            tool: tools.RStudio,
          }),
        ],
        appDataDisks: [defaultTestDisk],
      },
      buttonIndex: 1,
      modalName: 'GcpComputeModalBase',
      toolName: 'RStudio',
    },
    {
      // Galaxy
      input: {
        ...CloudEnvironmentModalDefaultProps,
        runtimes: [getGoogleRuntime()],
        apps: [galaxyRunning],
        appDataDisks: [defaultTestDisk],
      },
      buttonIndex: 2,
      modalName: 'GalaxyModalBase',
      toolName: 'Galaxy',
    },
  ])('Shows corresponding $toolName Compute Modal component for GCP', async ({ input, buttonIndex, modalName }) => {
    // Arrange
    const user = userEvent.setup();

    // Act
    render(h(CloudEnvironmentModal, input));
    // Assert
    const settingsButtons = screen.getAllByText('Settings');
    expect(settingsButtons.length).toBe(3);
    await user.click(settingsButtons[buttonIndex]);
    screen.getByText(modalName);
  });

  it('Shows corresponding Compute Modal component for Azure', async () => {
    // Arrange
    const user = userEvent.setup();
    const cloneAzure = {
      ...AzureCloudEnvironmentModalDefaultProps,
    };

    // Act
    render(h(CloudEnvironmentModal, cloneAzure));
    // Assert
    const settingsButton = screen.getByText('Settings');
    await user.click(settingsButton);
    screen.getByText('AzureComputeModalBase');
  });
});

describe('renderToolButtons', () => {
  it('should render PeriodicAzureCookieSetter for Cromwell', async () => {
    // Arrange
    const mockRuntimes: Partial<RuntimesContract> = {
      invalidateCookie: jest.fn(),
      setCookie: jest.fn(),
      runtime: jest.fn(),
      azureProxy: jest.fn(),
      listV2: jest.fn(),
      listV2WithWorkspace: jest.fn(),
      runtimeV2: jest.fn(),
      fileSyncing: jest.fn(),
    };

    asMockedFn(Runtimes).mockImplementation(() => mockRuntimes as RuntimesContract);

    const testProps = {
      ...AzureCloudEnvironmentModalDefaultProps,
      apps: [cromwellRunning],
    };
    // Act
    render(h(CloudEnvironmentModal, testProps));

    // Assert
    expect(PeriodicAzureCookieSetter).toHaveBeenCalled();
  });
  it('should render PeriodicAzureCookieSetter for Hail Batch', async () => {
    // Arrange
    const mockRuntimes: Partial<RuntimesContract> = {
      invalidateCookie: jest.fn(),
      setCookie: jest.fn(),
      runtime: jest.fn(),
      azureProxy: jest.fn(),
      listV2: jest.fn(),
      listV2WithWorkspace: jest.fn(),
      runtimeV2: jest.fn(),
      fileSyncing: jest.fn(),
    };

    asMockedFn(Runtimes).mockImplementation(() => mockRuntimes as RuntimesContract);

    const testProps = {
      ...AzureCloudEnvironmentModalDefaultProps,
      filterForTool: appToolLabels.HAIL_BATCH,
      apps: [hailBatchAppRunning],
    };
    // Act
    render(h(CloudEnvironmentModal, testProps));

    // Assert
    expect(PeriodicAzureCookieSetter).toHaveBeenCalled();
  });
});
