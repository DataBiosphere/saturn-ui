import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h } from 'react-hyperscript-helpers';
import { Apps } from 'src/libs/ajax/leonardo/Apps';
import { leoDiskProvider } from 'src/libs/ajax/leonardo/providers/LeoDiskProvider';
import { Runtimes } from 'src/libs/ajax/leonardo/Runtimes';
import { Methods } from 'src/libs/ajax/methods/Methods';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import { PREVIEW_COST_CAPPING } from 'src/libs/feature-previews-config';
import { getLocalPref, setLocalPref } from 'src/libs/prefs';
import DataStepContent from 'src/pages/workspaces/workspace/workflows/DataStepContent';
import { chooseRootType } from 'src/pages/workspaces/workspace/workflows/EntitySelectionType';
import LaunchAnalysisModal from 'src/pages/workspaces/workspace/workflows/LaunchAnalysisModal';
import { WorkflowView } from 'src/pages/workspaces/workspace/workflows/WorkflowView';
import { asMockedFn, renderWithAppContexts as render, SelectHelper } from 'src/testing/test-utils';

jest.mock('src/libs/ajax/Dockstore');
jest.mock('src/libs/ajax/GoogleStorage');
jest.mock('src/libs/ajax/leonardo/Apps');
jest.mock('src/libs/ajax/leonardo/Runtimes');
jest.mock('src/libs/ajax/methods/Methods');
jest.mock('src/libs/ajax/Metrics');
jest.mock('src/libs/ajax/workspaces/Workspaces');

jest.mock('src/libs/nav', () => ({
  getCurrentUrl: jest.fn().mockReturnValue(new URL('https://app.terra.bio')),
  getLink: jest.fn(),
  goToPath: jest.fn(),
}));

jest.mock('src/libs/notifications', () => ({
  notify: jest.fn(),
}));
jest.mock('src/libs/ajax/leonardo/providers/LeoDiskProvider');
jest.mock('src/libs/prefs');

// Space for tables is rendered based on the available space. In unit tests, there is no available space, and so we must mock out the space needed to get the data table to render.
jest.mock('react-virtualized', () => {
  const actual = jest.requireActual('react-virtualized');

  const { AutoSizer } = actual;

  class MockAutoSizer extends AutoSizer {
    state = {
      height: 1000,
      width: 1000,
    };

    setState = () => {};
  }

  return {
    ...actual,
    AutoSizer: MockAutoSizer,
  };
});

jest.mock('src/libs/feature-previews', () => ({
  ...jest.requireActual('src/libs/feature-previews'),
  isFeaturePreviewEnabled: jest.fn(),
}));

describe('Workflow View (GCP)', () => {
  const initializedGoogleWorkspace = {
    accessLevel: 'OWNER',
    owners: ['bar@foo.com'],
    workspace: {
      attributes: {
        description: '',
      },
      authorizationDomain: [],
      billingAccount: 'billingAccounts/google-billing-account',
      bucketName: 'bucket-name',
      cloudPlatform: 'Gcp',
      completedCloneWorkspaceFileTransfer: '2023-02-03T22:29:04.319Z',
      createdBy: 'bar@foo.com',
      createdDate: '2023-02-03T22:26:06.124Z',
      googleProject: 'google-project-id',
      isLocked: false,
      lastModified: '2023-02-03T22:26:06.202Z',
      name: 'echo_to_file-configured',
      namespace: 'gatk',
      workspaceId: 'google-workspace-id',
      workspaceType: 'rawls',
      workspaceVersion: 'v2',
    },
    canShare: true,
    canCompute: true,
    workspaceInitialized: true,
  };

  const selectionKey = 'foobar';
  const mockStorageDetails = {
    fetchedLocation: 'SUCCESS',
  };
  const methodList = [
    {
      name: 'echo_to_file',
      createDate: '2019-11-21T19:10:23Z',
      url: 'http://agora.dsde-dev.broadinstitute.org/api/v1/methods/gatk/echo_to_file/12',
      synopsis: '',
      entityType: 'Workflow',
      snapshotComment: '',
      snapshotId: 12,
      namespace: 'gatk',
    },
  ];
  const mockAgoraResponse = {
    managers: ['public', 'zarsky@test.firecloud.org'],
    name: 'echo_to_file',
    createDate: '2019-11-21T19:10:23Z',
    public: true,
    entityType: 'Workflow',
    snapshotId: 12,
    namespace: 'gatk',
    payload: '',
    url: 'http://agora.dsde-dev.broadinstitute.org/api/v1/methods/gatk/echo_to_file/12',
  };
  const entityMetadata = {
    sra: {
      attributeNames: ['string', 'num'],
      count: 2,
      idName: 'sra',
    },
  };

  const mockValidate = {
    extraInputs: [],
    invalidInputs: {},
    invalidOutputs: {},
    methodConfiguration: {
      deleted: false,
      inputs: {
        'echo_strings.echo_to_file.input1': 'this.input',
      },
      methodConfigVersion: 1,
      methodRepoMethod: {
        methodName: 'echo_to_file',
        methodVersion: 12,
        methodNamespace: 'gatk',
        methodUri: 'agora://gatk/echo_to_file/12',
        sourceRepo: 'agora',
      },
      name: 'echo_to_file-configured',
      namespace: 'gatk',
      outputs: {
        'echo_strings.echo_to_file.out': 'this.output',
      },
      prerequisites: {},
      rootEntityType: 'test_entity',
    },
    missingInputs: [],
    validInputs: ['echo_strings.echo_to_file.input1'],
    validOutputs: ['echo_strings.echo_to_file.out'],
  };
  const mockConfigInputOutputs = {
    inputs: [
      {
        inputType: 'String?',
        name: 'echo_strings.echo_to_file.input1',
        optional: true,
      },
    ],
    outputs: [
      {
        name: 'echo_strings.echo_to_file.out',
        outputType: 'String',
      },
    ],
  };
  const paginatedEntitiesOfType = jest.fn().mockImplementation(() =>
    Promise.resolve({
      parameters: {
        fields: {},
        filterOperator: 'and',
        page: 1,
        pageSize: 100,
        sortDirection: 'asc',
        sortField: 'name',
      },
      resultMetadata: {
        filteredCount: 3,
        filteredPageCount: 1,
        unfilteredCount: 3,
      },
      results: [
        {
          attributes: {
            string: 'abc',
            num: 1,
          },
          entityType: 'sra',
          name: 'your-sample-1-id',
        },
        {
          attributes: {
            string: 'foo',
            num: 2,
          },
          entityType: 'sra',
          name: 'your-sample-2-id',
        },
      ],
    })
  );
  const mockSave = {
    extraInputs: [],
    invalidInputs: {},
    invalidOutputs: {},
    methodConfiguration: {
      deleted: false,
      inputs: {
        'echo_strings.echo_to_file.input1': 'this.newString',
      },
      methodConfigVersion: 2,
      methodRepoMethod: {
        methodName: 'echo_to_file',
        methodVersion: 12,
        methodNamespace: 'gatk',
        methodUri: 'agora://gatk/echo_to_file/12',
        sourceRepo: 'agora',
      },
      name: 'echo_to_file-configured',
      namespace: 'gatk',
      outputs: {
        'echo_strings.echo_to_file.out': 'this.output',
      },
      prerequisites: {},
      rootEntityType: 'sra',
    },
    missingInputs: [],
    validInputs: ['echo_strings.echo_to_file.input1'],
    validOutputs: ['echo_strings.echo_to_file.out'],
  };
  const mockCreateEntity = {
    attributes: {
      participants: {
        itemsType: 'EntityReference',
        items: [
          {
            entityType: 'sra',
            entityName: 'your-sample-1-id',
          },
          {
            entityType: 'sra',
            entityName: 'your-sample-2-id',
          },
        ],
      },
    },
    entityType: 'sra_set',
    name: 'echo_to_file-configured_2024-01-17T18-55-52',
  };
  const mockLaunchResponse = jest.fn(() => Promise.resolve({ submissionId: 'abc123', ...initializedGoogleWorkspace.workspaceId }));

  const mockDefaultAjax = () => {
    Methods.mockReturnValue({
      list: jest.fn(() => Promise.resolve(methodList)),
      method: () => ({
        get: jest.fn(() => Promise.resolve(mockAgoraResponse)),
      }),
      configInputsOutputs: jest.fn(() => Promise.resolve(mockConfigInputOutputs)),
    });
    Workspaces.mockReturnValue({
      workspace: (_namespace, _name) => ({
        details: jest.fn().mockResolvedValue(initializedGoogleWorkspace),
        entityMetadata: jest.fn().mockReturnValue(entityMetadata),
        listSnapshots: jest.fn().mockResolvedValue({
          gcpDataRepoSnapshots: [],
        }),
        checkBucketReadAccess: jest.fn(),
        storageCostEstimateV2: jest.fn(),
        checkBucketLocation: jest.fn().mockResolvedValue(mockStorageDetails),
        methodConfig: () => ({
          save: jest.fn().mockReturnValue(mockSave),
          validate: jest.fn().mockReturnValue(mockValidate),
          get: jest.fn().mockResolvedValue({
            methodRepoMethod: {
              methodNamespace: 'gatk',
              methodName: 'echo_to_file',
              sourceRepo: 'agora',
              methodUri: 'agora://gatk/echo_to_file/12',
              methodVersion: 12,
            },
            rootEntityType: 'sra',
            name: 'echo_to_file-configured',
          }),
        }),
      }),
    });
    Apps.mockReturnValue({ list: jest.fn().mockReturnValue([]) });
    Runtimes.mockReturnValue({ listV2: jest.fn() });
    asMockedFn(leoDiskProvider.list).mockImplementation(jest.fn());
  };

  it('view workflow in workspace from mock import', async () => {
    mockDefaultAjax();

    // Act
    await act(async () => {
      render(h(WorkflowView, { queryParams: { selectionKey } }));
    });

    expect(
      screen.getAllByRole('button', {
        name: /inputs/i,
      })
    );

    expect(screen.getByText('echo_to_file-configured'));
  });

  it('can select data given a data table', async () => {
    // Arrange
    const user = userEvent.setup();
    const namespace = 'gatk';
    const name = 'echo_to_file-configured';

    mockDefaultAjax();

    // Act
    await act(async () => {
      render(h(WorkflowView, { name, namespace, queryParams: { selectionKey } }));
    });

    const selectDataButton = screen.getAllByRole('button').filter((button) => button.textContent.includes('Select Data'))[0];
    expect(selectDataButton).toHaveTextContent('Select Data');

    expect(screen.getByText('sra')).toBeInTheDocument();

    const dropdown = screen.getByLabelText('Entity type selector');
    const dropdownHelper = new SelectHelper(dropdown, user);
    await dropdownHelper.selectOption('sra');

    expect(selectDataButton).toHaveAttribute('aria-disabled', 'false');
  });

  it('can select data to submit and ok', async () => {
    // Arrange
    const user = userEvent.setup();
    const namespace = 'gatk';
    const name = 'echo_to_file-configured';
    const onDismiss = jest.fn();
    const onSuccess = jest.fn();
    const rootEntityType = 'sra';

    const workspace = {
      workspace: {
        namespace,
        name,
        googleProject: 'google-project-id',
        attributes: {
          'workspace-column-defaults': 'Symbol(choose-root-type)',
        },
      },
    };

    const ws = jest.fn().mockReturnValue(Promise.resolve(initializedGoogleWorkspace.workspace));

    Workspaces.mockImplementation(() => ({
      workspace: (_namespace, _name) => ({
        ws,
        paginatedEntitiesOfType,
      }),
    }));

    const entitySelectionModel = {
      newSetName: 'new_set',
      selectedEntities: {},
      type: chooseRootType,
    };

    const entityMetadata = {
      sra: {
        attributeNames: ['string', 'num'],
        count: 2,
        idName: 'sra',
      },
    };

    // Act
    await act(async () => {
      render(
        h(DataStepContent, {
          entitySelectionModel,
          onDismiss,
          onSuccess,
          entityMetadata,
          rootEntityType,
          workspace,
        })
      );
    });

    const allSelectRadioButton = screen.getByLabelText('Select all');
    await user.click(allSelectRadioButton);

    const okButton = screen.getAllByRole('button').filter((button) => button.textContent.includes('OK'))[0];
    expect(okButton).toHaveAttribute('aria-disabled', 'false');
  });

  it('updating inputs allows config save', async () => {
    // Arrange
    const user = userEvent.setup();
    const namespace = 'gatk';
    const name = 'echo_to_file-configured';

    mockDefaultAjax();

    // Act
    await act(async () => {
      render(h(WorkflowView, { name, namespace, queryParams: { selectionKey } }));
    });

    const attributeTextbox = screen.getByRole('textbox', { name: /echo_to_file input1 attribute/i });
    fireEvent.change(attributeTextbox, { target: { value: 'this.newString' } });

    const saveButton = screen.getAllByRole('button').filter((button) => button.textContent.includes('Save'))[0];
    await user.click(saveButton);

    expect(screen.getByText('Saved!'));
  });

  it('saves workflow options to local storage', async () => {
    // Arrange
    const user = userEvent.setup();
    const namespace = 'gatk';
    const name = 'echo_to_file-configured';

    mockDefaultAjax();

    // Act
    await act(async () => {
      render(h(WorkflowView, { name, namespace, queryParams: { selectionKey } }));
    });

    // Assert
    // check that workflow options are initially unchecked
    const refDisksCheckbox = screen.getByRole('checkbox', { name: 'Use reference disks' });
    expect(refDisksCheckbox).not.toBeChecked();
    const ignoreOutputsCheckbox = screen.getByRole('checkbox', { name: 'Ignore empty outputs' });
    expect(ignoreOutputsCheckbox).not.toBeChecked();

    // Act
    await user.click(refDisksCheckbox);

    // Assert
    // check 'useReferenceDisks' was saved to local storage
    expect(refDisksCheckbox).toBeChecked();
    expect(setLocalPref).toHaveBeenCalledWith(`${namespace}/${name}/workflow_options`, { useReferenceDisks: true });

    // Act
    await user.click(ignoreOutputsCheckbox);

    // Assert
    // check both 'useReferenceDisks' and 'ignoreEmptyOutputs' were saved to local storage
    expect(ignoreOutputsCheckbox).toBeChecked();
    expect(setLocalPref).toHaveBeenCalledWith(`${namespace}/${name}/workflow_options`, {
      useReferenceDisks: true,
      ignoreEmptyOutputs: true,
    });
  });

  it('reads workflow options from local storage', async () => {
    // Arrange
    const namespace = 'gatk';
    const name = 'echo_to_file-configured';

    mockDefaultAjax();

    getLocalPref.mockReturnValue({ useReferenceDisks: true, ignoreEmptyOutputs: true });

    // Act
    await act(async () => {
      render(h(WorkflowView, { name, namespace, queryParams: { selectionKey } }));
    });

    const refDisksCheckbox = screen.getByRole('checkbox', { name: 'Use reference disks' });
    const ignoreOutputsCheckbox = screen.getByRole('checkbox', { name: 'Ignore empty outputs' });

    // Assert
    // check that both 'useReferenceDisks' and 'ignoreEmptyOutputs' are by default checked
    expect(refDisksCheckbox).toBeChecked();
    expect(ignoreOutputsCheckbox).toBeChecked();
  });

  it('removes workflow options from local storage', async () => {
    // Arrange
    const user = userEvent.setup();
    const namespace = 'gatk';
    const name = 'echo_to_file-configured';

    mockDefaultAjax();

    getLocalPref.mockReturnValue({ useReferenceDisks: true, ignoreEmptyOutputs: true });

    // Act
    await act(async () => {
      render(h(WorkflowView, { name, namespace, queryParams: { selectionKey } }));
    });

    const refDisksCheckbox = screen.getByRole('checkbox', { name: 'Use reference disks' });
    const ignoreOutputsCheckbox = screen.getByRole('checkbox', { name: 'Ignore empty outputs' });

    // Assert
    // check that both 'useReferenceDisks' and 'ignoreEmptyOutputs' are by default checked
    expect(refDisksCheckbox).toBeChecked();
    expect(ignoreOutputsCheckbox).toBeChecked();

    // Act
    // user unchecks 'useReferenceDisks'
    await user.click(refDisksCheckbox);

    // Assert
    // check 'useReferenceDisks' is removed from local storage
    expect(refDisksCheckbox).not.toBeChecked();
    expect(setLocalPref).toHaveBeenCalledWith(`${namespace}/${name}/workflow_options`, { ignoreEmptyOutputs: true });

    // Act
    // user unchecks 'ignoreEmptyOutputs'
    await user.click(ignoreOutputsCheckbox);

    // Assert
    // check that 'undefined' was sent as value for workflow options in local storage (which removes it from local storage)
    expect(ignoreOutputsCheckbox).not.toBeChecked();
    expect(setLocalPref).toHaveBeenCalledWith(`${namespace}/${name}/workflow_options`, undefined);
  });

  it('stores call cache in local storage if it is disabled and removes it when enabled', async () => {
    // Arrange
    const user = userEvent.setup();
    const namespace = 'gatk';
    const name = 'echo_to_file-configured';

    getLocalPref.mockReturnValue(undefined);

    mockDefaultAjax();

    // Act
    await act(async () => {
      render(h(WorkflowView, { name, namespace, queryParams: { selectionKey } }));
    });

    // Assert
    // check that call caching is initially checked
    const useCallCacheCheckbox = screen.getByRole('checkbox', { name: 'Use call caching' });
    expect(useCallCacheCheckbox).toBeChecked();

    // Act
    // user unchecks call caching
    await user.click(useCallCacheCheckbox);

    // Assert
    // check 'useCallCache' was saved to local storage
    expect(useCallCacheCheckbox).not.toBeChecked();
    expect(setLocalPref).toHaveBeenCalledWith(`${namespace}/${name}/workflow_options`, { useCallCache: false });

    // Act
    // user checks call caching
    await user.click(useCallCacheCheckbox);

    // Assert
    // check that 'undefined' was sent as value for workflow options in local storage (which removes it from local storage)
    expect(useCallCacheCheckbox).toBeChecked();
    expect(setLocalPref).toHaveBeenCalledWith(`${namespace}/${name}/workflow_options`, undefined);
  });

  it('renders run analysis modal and check workflow option expectations', async () => {
    // Arrange
    const user = userEvent.setup();
    const namespace = 'gatk';
    const name = 'echo_to_file-configured';
    const bucketName = initializedGoogleWorkspace.workspace.bucketName;
    const googleProject = initializedGoogleWorkspace.workspace.googleProject;
    const rootEntityType = 'sra';

    const selectedEntities = {
      'your-sample-1-id': {
        attributes: {
          string: 'abc',
          num: 1,
        },
        entityType: 'sra',
        name: 'your-sample-1-id',
      },
      'your-sample-2-id': {
        attributes: {
          string: 'abc',
          num: 1,
        },
        entityType: 'sra',
        name: 'your-sample-2-id',
      },
    };

    Workspaces.mockImplementation(() => ({
      workspace: (_namespace, _name) => ({
        checkBucketAccess: jest.fn().mockResolvedValue({}),
        checkBucketLocation: jest.fn().mockResolvedValue(mockStorageDetails),
        createEntity: jest.fn().mockResolvedValue(mockCreateEntity),
        methodConfig: () => ({
          launch: jest.fn(mockLaunchResponse),
        }),
      }),
    }));

    // Act
    await act(async () => {
      render(
        h(LaunchAnalysisModal, {
          onDismiss: jest.fn(),
          entityMetadata,
          initializedGoogleWorkspace,
          workspace: {
            workspace: { namespace, name, bucketName, googleProject },
          },
          processSingle: false,
          entitySelectionModel: { type: chooseRootType, selectedEntities, newSetName: 'newSetName' },
          mockValidate,
          config: { rootEntityType },
          useCallCache: true,
          deleteIntermediateOutputFiles: false,
          useReferenceDisks: false,
          retryWithMoreMemory: false,
          retryMemoryFactor: jest.fn(),
          ignoreEmptyOutputs: true,
          enableResourceMonitoring: true,
          monitoringScript: 'some_script',
          monitoringImage: '',
          monitoringImageScript: '',
          onSuccess: jest.fn(),
        })
      );
    });

    const launchButton = screen.getAllByRole('button').filter((button) => button.textContent.includes('Launch'))[0];
    await user.click(launchButton);

    expect(mockLaunchResponse).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Launching analysis...')).toBeInTheDocument;

    // check various workflow options
    expect(mockLaunchResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        useCallCache: true,
        deleteIntermediateOutputFiles: false,
        ignoreEmptyOutputs: true,
        useReferenceDisks: false,
        memoryRetryMultiplier: undefined,
        monitoringScript: 'some_script',
        monitoringImage: undefined,
        monitoringImageScript: undefined,
      })
    );
  });

  asMockedFn(isFeaturePreviewEnabled).mockImplementation((id) => id === PREVIEW_COST_CAPPING);

  it('does not show cost capping input if the feature flag is disabled', async () => {
    // Arrange
    asMockedFn(isFeaturePreviewEnabled).mockReturnValue(false);

    const namespace = 'gatk';
    const name = 'echo_to_file-configured';

    mockDefaultAjax();

    // Act
    await act(async () => {
      render(h(WorkflowView, { name, namespace, queryParams: { selectionKey } }));
    });

    // Assert
    // check that workflow cost capping is not shown
    expect(screen.queryByText('Set cost limit per workflow (BETA)')).toBeNull();
  });

  it('does show cost capping input if the feature flag is enabled', async () => {
    // Arrange
    asMockedFn(isFeaturePreviewEnabled).mockReturnValue(true);

    const namespace = 'gatk';
    const name = 'echo_to_file-configured';

    mockDefaultAjax();

    // Act
    await act(async () => {
      render(h(WorkflowView, { name, namespace, queryParams: { selectionKey } }));
    });

    // Assert
    // check that workflow cost capping is shown
    expect(screen.queryByText('Set cost limit per workflow (BETA)')).not.toBeNull();
  });
});
