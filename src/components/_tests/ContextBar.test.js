import '@testing-library/jest-dom'

import { fireEvent, render, screen } from '@testing-library/react'
import { div, h } from 'react-hyperscript-helpers'
import { tools } from 'src/components/notebook-utils'
import { MenuTrigger } from 'src/components/PopupTrigger'
import { Ajax } from 'src/libs/ajax'
import { CloudEnvironmentModal } from 'src/pages/workspaces/workspace/analysis/modals/CloudEnvironmentModal'

import { ContextBar } from '../ContextBar'


// Mocking for terminalLaunchLink using Nav.getLink
jest.mock('src/libs/nav', () => {
  const originalModule = jest.requireActual('src/libs/nav')

  return {
    ...originalModule,
    getPath: jest.fn(() => '/test/'),
    getLink: jest.fn(() => '/')
  }
})

// Mocking PopupTrigger to avoid test environment issues with React Portal's requirement to use
// DOM measure services which are not available in jest environment
jest.mock('src/components/PopupTrigger', () => {
  const originalModule = jest.requireActual('src/components/PopupTrigger')
  return {
    ...originalModule,
    MenuTrigger: jest.fn()
  }
})

jest.mock('src/pages/workspaces/workspace/analysis/modals/CloudEnvironmentModal', () => {
  const originalModule = jest.requireActual('src/pages/workspaces/workspace/analysis/modals/CloudEnvironmentModal')
  return {
    ...originalModule,
    CloudEnvironmentModal: jest.fn()
  }
})

jest.mock('src/libs/ajax')

jest.mock('src/libs/config', () => {
  const originalModule = jest.requireActual('src/libs/config')
  return {
    ...originalModule,
    isCromwellAppVisible: () => {
      return true
    }
  }
})

const mockRuntimesStartFn = jest.fn()
const mockRuntime = jest.fn()

beforeEach(() => {
  MenuTrigger.mockImplementation(({ content }) => { return div([content]) })
  CloudEnvironmentModal.mockImplementation(({ isOpen, filterForTool, onSuccess, onDismiss, ...props }) => {
    return isOpen ? div([
      'Cloud Environment Details',
      div(filterForTool),
      div({ label: 'Success Button', onClick: () => onSuccess() }, 'SuccessButton'),
      div({ label: 'Success Button', onClick: () => onDismiss() }, 'DismissButton')
    ]) : div([])
  })

  Ajax.mockImplementation(() => {
    mockRuntime.mockReturnValue({ start: mockRuntimesStartFn })
    return {
      Metrics: {
        captureEvent: () => {}
      },
      Runtimes: {
        runtime: mockRuntime
      }
    }
  })
})

afterEach(() => {
  jest.clearAllMocks()
})

//Note - These constants are copied from src/libs/runtime-utils.test.js
const galaxyRunning = {
  appName: 'terra-app-69200c2f-89c3-47db-874c-b770d8de737f',
  appType: 'GALAXY',
  auditInfo: {
    creator: 'cahrens@gmail.com', createdDate: '2021-11-29T20:19:13.162484Z', destroyedDate: null, dateAccessed: '2021-11-29T20:19:13.162484Z'
  },
  diskName: 'saturn-pd-026594ac-d829-423d-a8df-76fe96f5b4e7',
  errors: [],
  googleProject: 'terra-test-e4000484',
  kubernetesRuntimeConfig: { numNodes: 1, machineType: 'n1-highmem-8', autoscalingEnabled: false },
  labels: {},
  proxyUrls: { galaxy: 'https://leonardo-fiab.dsde-dev.broadinstitute.org/a-app-69200c2f-89c3-47db-874c-b770d8de737f/galaxy' },
  status: 'RUNNING'
}

const cromwellRunning = {
  appName: 'terra-app-83f46705-524c-4fc8-xcyc-97fdvcfby14f',
  appType: 'CROMWELL',
  auditInfo: {
    creator: 'cahrens@gmail.com', createdDate: '2021-11-28T20:28:01.998494Z', destroyedDate: null, dateAccessed: '2021-11-28T20:28:01.998494Z'
  },
  diskName: 'saturn-pd-693a9707-634d-4134-bb3a-xyz73cd5a8ce',
  errors: [],
  googleProject: 'terra-test-e4000484',
  kubernetesRuntimeConfig: { numNodes: 1, machineType: 'n1-highmem-8', autoscalingEnabled: false },
  labels: {},
  proxyUrls: { 'cromwell-service': 'https://leonardo-fiab.dsde-dev.broadinstitute.org/fd0cfbb14f/cromwell-service/swagger/cromwell.yaml' },
  status: 'RUNNING'
}

const cromwellDisk = {
  auditInfo: {
    creator: 'cahrens@gmail.com', createdDate: '2021-11-26T20:19:13.162484Z', destroyedDate: null, dateAccessed: '2021-11-29T20:19:14.114Z'
  },
  blockSize: 4096,
  diskType: 'pd-standard',
  googleProject: 'terra-test-e4000484',
  id: 16,
  labels: { saturnApplication: 'CROMWELL', saturnWorkspaceName: 'test-workspace' },
  name: 'saturn-pd-026594ac-d829-423d-a8df-55fe36f5b4e8',
  size: 500,
  status: 'Ready',
  zone: 'us-central1-a'
}

const galaxyDisk = {
  auditInfo: {
    creator: 'cahrens@gmail.com', createdDate: '2021-11-29T20:19:13.162484Z', destroyedDate: null, dateAccessed: '2021-11-29T20:19:14.114Z'
  },
  blockSize: 4096,
  diskType: 'pd-standard',
  googleProject: 'terra-test-e4000484',
  id: 10,
  labels: { saturnApplication: 'galaxy', saturnWorkspaceName: 'test-workspace' }, // Note 'galaxy' vs. 'GALAXY', to represent our older naming scheme
  name: 'saturn-pd-026594ac-d829-423d-a8df-76fe96f5b4e7',
  size: 500,
  status: 'Ready',
  zone: 'us-central1-a'
}

const jupyter1 = {
  id: 75239,
  workspaceId: null,
  runtimeName: 'saturn-eae9168f-9b99-4910-945e-dbab66e04d91',
  googleProject: 'terra-dev-cf677740',
  cloudContext: {
    cloudProvider: 'GCP',
    cloudResource: 'terra-dev-cf677740'
  },
  auditInfo: {
    creator: 'testuser123@broad.com',
    createdDate: '2022-07-18T18:35:32.012698Z',
    destroyedDate: null,
    dateAccessed: '2022-07-18T21:44:17.565Z'
  },
  runtimeConfig: {
    machineType: 'n1-standard-1',
    persistentDiskId: 14692,
    cloudService: 'GCE',
    bootDiskSize: 120,
    zone: 'us-central1-a',
    gpuConfig: null
  },
  proxyUrl: 'https://leonardo.dsde-dev.broadinstitute.org/proxy/terra-dev-cf677740/saturn-eae9168f-9b99-4910-945e-dbab66e04d91/jupyter',
  status: 'Running',
  labels: {
    saturnWorkspaceNamespace: 'general-dev-billing-account',
    'saturn-iframe-extension': 'https://bvdp-saturn-dev.appspot.com/jupyter-iframe-extension.js',
    creator: 'testuser123@broad.com',
    clusterServiceAccount: 'pet-26534176105071279add1@terra-dev-cf677740.iam.gserviceaccount.com',
    saturnAutoCreated: 'true',
    clusterName: 'saturn-eae9168f-9b99-4910-945e-dbab66e04d91',
    saturnWorkspaceName: 'Broad Test Workspace',
    saturnVersion: '6',
    tool: 'Jupyter',
    runtimeName: 'saturn-eae9168f-9b99-4910-945e-dbab66e04d91',
    cloudContext: 'Gcp/terra-dev-cf677740',
    googleProject: 'terra-dev-cf677740'
  },
  patchInProgress: false
}


const azureRunning = {
  auditInfo: {
    createdDate: '2022-09-09T20:20:06.982538Z',
    creator: 'ncl.hedwig@gmail.com',
    dateAccessed: '2022-09-09T20:20:08.185Z',
    destroyedDate: null
  },
  cloudContext: {
    cloudProvider: 'AZURE',
    cloudResource: 'fad90753-2022-4456-9b0a-c7e5b934e408/3efc5bdf-be0e-44e7-b1d7-c08931e3c16c/mrg-terra-workspace-20220412104730'
  },
  googleProject: 'fad90753-2022-4456-9b0a-c7e5b934e408/3efc5bdf-be0e-44e7-b1d7-c08931e3c16c/mrg-terra-workspace-20220412104730',
  id: 76996,
  labels: {
    cloudContext: 'Azure/fad90753-2022-4456-9b0a-c7e5b934e408/3efc5bdf-be0e-44e7-b1d7-c08931e3c16c/mrg-terra-workspace-20220412104730',
    clusterName: 'saturn-b2eecc2d-75d5-44f5-8eb2-5147db41874a',
    clusterServiceAccount: 'ncl.hedwig@gmail.com',
    creator: 'ncl.hedwig@gmail.com',
    runtimeName: 'saturn-b2eecc2d-75d5-44f5-8eb2-5147db41874a',
    saturnAutoCreated: 'true',
    saturnVersion: '6',
    saturnWorkspaceName: 'isAzure',
    saturnWorkspaceNamespace: 'alpha-azure-billing-project-20220407',
    tool: 'Azure'
  },
  patchInProgress: false,
  proxyUrl: 'https://relay-ns-2a77dcb5-882c-46b9-a3bc-5d251aff14d0.servicebus.windows.net/saturn-b2eecc2d-75d5-44f5-8eb2-5147db41874a',
  runtimeConfig: {
    cloudService: 'AZURE_VM',
    machineType: 'Standard_DS1_v2',
    persistentDiskId: 15778,
    region: 'eastus',
    runtimeName: 'saturn-b2eecc2d-75d5-44f5-8eb2-5147db41874a',
    status: 'Running',
    workspaceId: '2a77dcb5-882c-46b9-a3bc-5d251aff14d0'
  }
}

const jupyter1Disk = {
  id: 14692,
  googleProject: 'terra-dev-cf677740',
  cloudContext: {
    cloudProvider: 'GCP',
    cloudResource: 'terra-dev-cf677740'
  },
  zone: 'us-central1-a',
  name: 'saturn-pd-c4aea6ef-5618-47d3-b674-5d456c9dcf4f',
  status: 'Ready',
  auditInfo: {
    creator: 'testuser123@broad.com',
    createdDate: '2022-07-18T18:35:32.012698Z',
    destroyedDate: null,
    dateAccessed: '2022-07-18T20:34:56.092Z'
  },
  size: 50,
  diskType: {
    label: 'pd-standard',
    displayName: 'Standard',
    regionToPricesName: 'monthlyStandardDiskPrice'
  },
  blockSize: 4096,
  labels: {
    saturnWorkspaceNamespace: 'general-dev-billing-account',
    saturnWorkspaceName: 'Broad Test Workspace'
  }
}

const rstudioRuntime = {
  id: 76979,
  workspaceId: null,
  runtimeName: 'saturn-48afb74a-15b1-4aad-8b23-d039cf8253fb',
  googleProject: 'terra-dev-98897219',
  cloudContext: {
    cloudProvider: 'GCP',
    cloudResource: 'terra-dev-98897219'
  },
  auditInfo: {
    creator: 'ncl.hedwig@gmail.com',
    createdDate: '2022-09-08T19:46:37.396597Z',
    destroyedDate: null,
    dateAccessed: '2022-09-08T19:47:21.206Z'
  },
  runtimeConfig: {
    machineType: 'n1-standard-4',
    persistentDiskId: 15774,
    cloudService: 'GCE',
    bootDiskSize: 120,
    zone: 'us-central1-a',
    gpuConfig: null
  },
  proxyUrl: 'https://leonardo.dsde-dev.broadinstitute.org/proxy/terra-dev-98897219/saturn-48afb74a-15b1-4aad-8b23-d039cf8253fb/rstudio',
  status: 'Creating',
  labels: {
    saturnWorkspaceNamespace: 'general-dev-billing-account',
    'saturn-iframe-extension': 'https://bvdp-saturn-dev.appspot.com/jupyter-iframe-extension.js',
    creator: 'ncl.hedwig@gmail.com',
    clusterServiceAccount: 'pet-26534176105071279add1@terra-dev-98897219.iam.gserviceaccount.com',
    saturnAutoCreated: 'true',
    clusterName: 'saturn-48afb74a-15b1-4aad-8b23-d039cf8253fb',
    saturnWorkspaceName: 'N8s Space',
    saturnVersion: '6',
    tool: 'RStudio',
    runtimeName: 'saturn-48afb74a-15b1-4aad-8b23-d039cf8253fb',
    cloudContext: 'Gcp/terra-dev-98897219',
    googleProject: 'terra-dev-98897219'
  },
  patchInProgress: false
}

const contextBarProps = {
  runtimes: [],
  apps: [],
  appDataDisks: [],
  refreshRuntimes: () => '',
  location: 'US-CENTRAL1',
  locationType: '',
  refreshApps: () => '',
  workspace: {
    workspace: {
      namespace: 'namespace'
    },
    namespace: 'Broad Test Workspace'
  }
}

describe('ContextBar - buttons', () => {
  it('will render default icons', () => {
    // Act
    render(h(ContextBar, contextBarProps))

    // Assert
    expect(screen.getByText('Rate:'))
    expect(screen.getByLabelText('Environment Configuration'))
    expect(screen.getByLabelText('Terminal button')).toHaveAttribute('disabled')
  })

  it('will render Jupyter button with an enabled Terminal Button', () => {
    // Arrange
    const jupyterContextBarProps = {
      ...contextBarProps,
      runtimes: [jupyter1],
      persistentDisks: [jupyter1Disk]
    }

    // Act
    render(h(ContextBar, jupyterContextBarProps))

    //Assert
    expect(screen.getByText('Rate:'))
    expect(screen.getByLabelText('Environment Configuration'))
    expect(screen.getByLabelText(new RegExp(/Jupyter Environment/i)))
    expect(screen.getByLabelText('Terminal button')).toBeEnabled()
  })

  it('will render Galaxy and RStudio buttons with a disabled Terminal Button', () => {
    // Arrange
    const rstudioGalaxyContextBarProps = {
      ...contextBarProps,
      runtimes: [rstudioRuntime],
      apps: [galaxyRunning],
      appDataDisks: [galaxyDisk],
      persistentDisks: [jupyter1Disk]
    }

    // Act
    render(h(ContextBar, rstudioGalaxyContextBarProps))

    //Assert
    expect(screen.getByText('Rate:'))
    expect(screen.getByLabelText('Environment Configuration'))
    expect(screen.getByLabelText(new RegExp(/RStudio Environment/i)))
    expect(screen.getByLabelText(new RegExp(/Galaxy Environment/i)))
    expect(screen.getByLabelText('Terminal button')).toHaveAttribute('disabled')
  })

  it('will render a Cromwell button with a disabled Terminal Button', () => {
    // Arrange
    const rstudioGalaxyContextBarProps = {
      ...contextBarProps,
      apps: [cromwellRunning],
      appDataDisks: [cromwellDisk]
    }

    // Act
    render(h(ContextBar, rstudioGalaxyContextBarProps))

    //Assert
    expect(screen.getByText('Rate:'))
    expect(screen.getByLabelText('Environment Configuration'))
    expect(screen.getByLabelText('Terminal button')).toHaveAttribute('disabled')
    expect(screen.getByLabelText(new RegExp(/Cromwell Environment/i)))
  })

  it('will render Azure Environment button', () => {
    const jupyterContextBarProps = {
      ...contextBarProps,
      runtimes: [azureRunning],
      persistentDisks: []
    }

    // Act
    render(h(ContextBar, jupyterContextBarProps))

    //Assert
    expect(screen.getByText('Rate:'))
    expect(screen.getByLabelText('Environment Configuration'))
    expect(screen.getByLabelText(new RegExp(/Azure Environment/i)))
    expect(screen.getByLabelText('Terminal button')).toHaveAttribute('disabled')
  })

  it('will render Azure Environment button', () => {
    const jupyterContextBarProps = {
      ...contextBarProps,
      runtimes: [
        {
          ...jupyter1,
          status: 'error'
        }
      ],
      persistentDisks: []
    }

    // Act
    render(h(ContextBar, jupyterContextBarProps))

    //Assert
    expect(screen.getByText('Rate:'))
    expect(screen.getByLabelText('Environment Configuration'))
    expect(screen.getByLabelText(new RegExp(/Jupyter Environment/i)))
  })
})

describe('ContextBar - actions', () => {
  it('clicking environment configuration opens CloudEnvironmentModal', () => {
    // Act
    render(h(ContextBar, contextBarProps))
    const envConf = screen.getByLabelText('Environment Configuration')
    fireEvent.click(envConf)

    // Assert
    screen.getByText('Cloud Environment Details')
  })
  it('clicking Jupyter opens CloudEnvironmentModal with Jupyter as filter for tool.', () => {
    // Arrange
    const jupyterContextBarProps = {
      ...contextBarProps,
      runtimes: [jupyter1],
      persistentDisks: [jupyter1Disk]
    }

    // Act
    render(h(ContextBar, jupyterContextBarProps))
    fireEvent.click(screen.getByLabelText(new RegExp(/Jupyter Environment/i)))

    // Assert
    screen.getByText('Cloud Environment Details')
    screen.getByText(tools.Jupyter.label)
  })
  it('clicking Galaxy opens CloudEnvironmentModal with Galaxy as filter for tool.', () => {
    // Arrange
    const galaxyContextBarProps = {
      ...contextBarProps,
      apps: [galaxyRunning],
      appDataDisks: [galaxyDisk]
    }

    // Act
    render(h(ContextBar, galaxyContextBarProps))
    fireEvent.click(screen.getByLabelText(new RegExp(/Galaxy Environment/i)))

    // Assert
    screen.getByText('Cloud Environment Details')
    screen.getByText(tools.Galaxy.label)
  })
  it('clicking RStudio opens CloudEnvironmentModal with RStudio as filter for tool.', () => {
    // Act
    const rstudioContextBarProps = {
      ...contextBarProps,
      runtimes: [rstudioRuntime],
      apps: [galaxyRunning],
      appDataDisks: [galaxyDisk],
      persistentDisks: [jupyter1Disk]
    }

    // Act
    render(h(ContextBar, rstudioContextBarProps))
    fireEvent.click(screen.getByLabelText(new RegExp(/RStudio Environment/i)))

    // Assert
    screen.getByText('Cloud Environment Details')
    screen.getByText(tools.RStudio.label)
  })

  it('clicking Terminal will attempt to start currently stopped runtime', () => {
    // Arrange
    global.window = Object.create(window)
    const url = 'http://dummy.com'
    Object.defineProperty(window, 'location', {
      value: {
        href: url
      },
      writable: true,
      hash: '/'
    })
    const jupyterContextBarProps = {
      ...contextBarProps,
      runtimes: [{
        ...jupyter1,
        status: 'Stopped'
      }],
      persistentDisks: [jupyter1Disk]
    }

    // Act
    render(h(ContextBar, jupyterContextBarProps))
    fireEvent.click(screen.getByLabelText('Terminal button'))

    // Assert
    expect(Ajax().Runtimes.runtime).toBeCalledWith(jupyter1.googleProject, jupyter1.runtimeName)
    expect(mockRuntimesStartFn).toBeCalledTimes(1)
  })

  it('clicking Terminal will not attempt to start an already running Jupyter notebook', () => {
    // Arrange
    global.window = Object.create(window)
    const url = 'http://dummy.com'
    Object.defineProperty(window, 'location', {
      value: {
        href: url
      },
      writable: true,
      hash: '/'
    })
    const jupyterContextBarProps = {
      ...contextBarProps,
      runtimes: [
        jupyter1
      ],
      persistentDisks: [jupyter1Disk]
    }

    // Act
    render(h(ContextBar, jupyterContextBarProps))
    fireEvent.click(screen.getByLabelText('Terminal button'))

    // Assert
    expect(mockRuntimesStartFn).toBeCalledTimes(0)
  })

  it('onSuccess will close modal', () => {
    // Act
    render(h(ContextBar, contextBarProps))
    const envConf = screen.getByLabelText('Environment Configuration')
    fireEvent.click(envConf)
    screen.getByText('Cloud Environment Details')
    fireEvent.click(screen.getByText('SuccessButton'))

    // Assert
    expect(screen.queryByText('Cloud Environment Details')).toBeFalsy()
  })

  it('onDismiss will close modal', () => {
    // Act
    render(h(ContextBar, contextBarProps))
    const envConf = screen.getByLabelText('Environment Configuration')
    fireEvent.click(envConf)
    screen.getByText('Cloud Environment Details')
    fireEvent.click(screen.getByText('DismissButton'))

    // Assert
    expect(screen.queryByText('Cloud Environment Details')).toBeFalsy()
  })
})
