import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h } from 'react-hyperscript-helpers';
import { Ajax } from 'src/libs/ajax';
import DataStepContent from 'src/pages/workspaces/workspace/workflows/DataStepContent';
import { chooseRootType } from 'src/pages/workspaces/workspace/workflows/EntitySelectionType';
import LaunchAnalysisModal from 'src/pages/workspaces/workspace/workflows/LaunchAnalysisModal';
import { WorkflowView } from 'src/pages/workspaces/workspace/workflows/WorkflowView';
import { renderWithAppContexts as render, SelectHelper } from 'src/testing/test-utils';

jest.mock('src/libs/ajax');
jest.mock('src/libs/nav', () => ({
  getCurrentUrl: jest.fn().mockReturnValue(new URL('https://app.terra.bio')),
  getLink: jest.fn(),
  goToPath: jest.fn(),
}));

jest.mock('src/libs/notifications', () => ({
  notify: jest.fn(),
}));

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

  const renderWorkflowView = () => {
    Ajax.mockImplementation(() => ({
      Methods: {
        list: jest.fn(() => Promise.resolve(methodList)),
        method: () => ({
          get: jest.fn(() => Promise.resolve(mockAgoraResponse)),
        }),
        configInputsOutputs: jest.fn(() => Promise.resolve(mockConfigInputOutputs)),
      },
      Workspaces: {
        workspace: (_namespace, _name) => ({
          details: jest.fn().mockResolvedValue(initializedGoogleWorkspace),
          entityMetadata: jest.fn().mockReturnValue(entityMetadata),
          listSnapshots: jest.fn().mockResolvedValue({
            gcpDataRepoSnapshots: [],
          }),
          checkBucketReadAccess: jest.fn(),
          storageCostEstimate: jest.fn(),
          bucketUsage: jest.fn(),
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
      },
      Disks: {
        disksV1: () => ({
          list: jest.fn(),
        }),
      },
      Runtimes: {
        listV2: jest.fn(),
      },
      Apps: {
        list: jest.fn().mockReturnValue([]),
      },
    }));
  };

  it('view workflow in workspace from mock import', async () => {
    renderWorkflowView();

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

    renderWorkflowView();

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

    Ajax.mockImplementation(() => ({
      Workspaces: {
        workspace: (_namespace, _name) => ({
          ws,
          paginatedEntitiesOfType,
        }),
      },
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

    renderWorkflowView();

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

  it('renders run analysis modal', async () => {
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

    Ajax.mockImplementation(() => ({
      Workspaces: {
        workspace: (_namespace, _name) => ({
          checkBucketAccess: jest.fn().mockResolvedValue({}),
          checkBucketLocation: jest.fn().mockResolvedValue(mockStorageDetails),
          createEntity: jest.fn().mockResolvedValue(mockCreateEntity),
          methodConfig: () => ({
            launch: jest.fn(mockLaunchResponse),
          }),
        }),
      },
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
          useCallCache: false,
          deleteIntermediateOutputFiles: false,
          useReferenceDisks: false,
          retryWithMoreMemory: false,
          retryMemoryFactor: jest.fn(),
          ignoreEmptyOutputs: true,
          monitoringScript: jest.fn(),
          monitoringImage: jest.fn(),
          monitoringImageScript: jest.fn(),
          onSuccess: jest.fn(),
        })
      );
    });

    const launchButton = screen.getAllByRole('button').filter((button) => button.textContent.includes('Launch'))[0];
    await user.click(launchButton);

    expect(mockLaunchResponse).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Launching analysis...')).toBeInTheDocument;
  });
});
