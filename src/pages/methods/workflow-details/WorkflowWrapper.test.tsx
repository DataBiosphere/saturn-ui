import { delay } from '@terra-ui-packages/core-utils';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import _ from 'lodash/fp';
import React from 'react';
import * as breadcrumbs from 'src/components/breadcrumbs';
import { MethodAjaxContract, Methods, MethodsAjaxContract } from 'src/libs/ajax/methods/Methods';
import { MethodConfigACL, MethodResponse, Snapshot } from 'src/libs/ajax/methods/methods-models';
import { editMethodProvider } from 'src/libs/ajax/methods/providers/EditMethodProvider';
import { postMethodProvider } from 'src/libs/ajax/methods/providers/PostMethodProvider';
import * as ExportWorkflowToWorkspaceProvider from 'src/libs/ajax/workspaces/providers/ExportWorkflowToWorkspaceProvider';
import { errorWatcher } from 'src/libs/error.mock';
import { goToPath } from 'src/libs/nav';
import * as Nav from 'src/libs/nav';
import { forwardRefWithName } from 'src/libs/react-utils';
import { snapshotsListStore, snapshotStore, TerraUser, TerraUserState, userStore } from 'src/libs/state';
import { WorkflowsContainer, wrapWorkflows } from 'src/pages/methods/workflow-details/WorkflowWrapper';
import { asMockedFn, MockedFn, partial, renderWithAppContexts as render, SelectHelper } from 'src/testing/test-utils';
import { useWorkspaces } from 'src/workspaces/common/state/useWorkspaces';
import { AzureContext, WorkspaceInfo, WorkspaceWrapper } from 'src/workspaces/utils';

jest.mock('src/libs/ajax/methods/Methods');

jest.mock('src/libs/notifications');

type NavExports = typeof import('src/libs/nav');

type WDLEditorExports = typeof import('src/workflows/methods/WDLEditor');
jest.mock('src/workflows/methods/WDLEditor', (): WDLEditorExports => {
  const mockWDLEditorModule = jest.requireActual('src/workflows/methods/WDLEditor.mock');
  return {
    WDLEditor: mockWDLEditorModule.MockWDLEditor,
  };
});

jest.mock(
  'src/libs/nav',
  (): NavExports => ({
    ...jest.requireActual('src/libs/nav'),
    getLink: jest.fn((name, pathParams?) =>
      name === 'workflow-dashboard' ? `#methods/${pathParams!.namespace}/${pathParams!.name}` : `#${name}`
    ),
    goToPath: jest.fn(),
  })
);

const mockSnapshot: Snapshot = {
  managers: ['hello@world.org'],
  name: 'testname',
  createDate: '2024-09-04T15:37:57Z',
  documentation: 'mock documentation',
  entityType: 'Workflow',
  snapshotComment: 'mock version comment',
  snapshotId: 1,
  namespace: 'testnamespace',
  payload:
    // eslint-disable-next-line no-template-curly-in-string
    'task echo_files {\\n  String? input1\\n  String? input2\\n  String? input3\\n  \\n  output {\\n    String out = read_string(stdout())\\n  }\\n\\n  command {\\n    echo \\"result: ${input1} ${input2} ${input3}\\"\\n  }\\n\\n  runtime {\\n    docker: \\"ubuntu:latest\\"\\n  }\\n}\\n\\nworkflow echo_strings {\\n  call echo_files\\n}',
  url: 'http://agora.dsde-dev.broadinstitute.org/api/v1/methods/sschu/echo-strings-test/1',
  public: true,
  synopsis: '',
};

const mockSnapshotWithAdditionalOwners: Snapshot = {
  managers: ['hello@world.org', 'new@owner.com'],
  name: 'testname',
  createDate: '2024-09-04T15:37:57Z',
  documentation: '',
  entityType: 'Workflow',
  snapshotComment: '',
  snapshotId: 1,
  namespace: 'testnamespace',
  payload:
    // eslint-disable-next-line no-template-curly-in-string
    'task echo_files {\\n  String? input1\\n  String? input2\\n  String? input3\\n  \\n  output {\\n    String out = read_string(stdout())\\n  }\\n\\n  command {\\n    echo \\"result: ${input1} ${input2} ${input3}\\"\\n  }\\n\\n  runtime {\\n    docker: \\"ubuntu:latest\\"\\n  }\\n}\\n\\nworkflow echo_strings {\\n  call echo_files\\n}',
  url: 'http://agora.dsde-dev.broadinstitute.org/api/v1/methods/sschu/echo-strings-test/1',
  public: false,
  synopsis: '',
};

const mockDeleteSnapshot: Snapshot = {
  managers: ['revali@gale.com', 'hello@WORLD.org', 'sam@i.am'],
  name: 'testname',
  createDate: '2024-09-04T15:37:57Z',
  documentation: '',
  entityType: 'Workflow',
  snapshotComment: '',
  snapshotId: 3,
  namespace: 'methodnamespace',
  payload:
    // eslint-disable-next-line no-template-curly-in-string
    'task echo_files {\\n  String? input1\\n  String? input2\\n  String? input3\\n  \\n  output {\\n    String out = read_string(stdout())\\n  }\\n\\n  command {\\n    echo \\"result: ${input1} ${input2} ${input3}\\"\\n  }\\n\\n  runtime {\\n    docker: \\"ubuntu:latest\\"\\n  }\\n}\\n\\nworkflow echo_strings {\\n  call echo_files\\n}',
  url: 'http://agora.dsde-dev.broadinstitute.org/api/v1/methods/sschu/echo-strings-test/1',
  public: true,
  synopsis: '',
};

const mockPermissions: MethodConfigACL = [
  {
    role: 'OWNER',
    user: 'user1@foo.com',
  },
  {
    role: 'READER',
    user: 'user2@bar.com',
  },
];

type ErrorExports = typeof import('src/libs/error');
jest.mock('src/libs/error', (): ErrorExports => {
  const errorModule = jest.requireActual('src/libs/error');
  const mockErrorModule = jest.requireActual('src/libs/error.mock');
  return {
    ...errorModule,
    withErrorReporting: mockErrorModule.mockWithErrorReporting,
  };
});

interface AjaxMocks {
  listImpl?: MockedFn<MethodsAjaxContract['list']>;
  getImpl?: MockedFn<MethodAjaxContract['get']>;
  deleteImpl?: MockedFn<MethodAjaxContract['delete']>;
}

const defaultListImpl: MockedFn<MethodsAjaxContract['list']> = jest.fn();
const defaultGetImpl: (namespace: any) => MockedFn<MethodAjaxContract['get']> = (namespace) =>
  jest.fn(async () => (namespace === 'testnamespace' ? mockSnapshot : mockDeleteSnapshot));
const defaultDeleteImpl: MockedFn<MethodAjaxContract['delete']> = jest.fn();
const setPermissionsWatch: jest.Mock = jest.fn();

const mockAjax = (mocks: AjaxMocks = {}) => {
  const { listImpl, getImpl, deleteImpl } = mocks;
  asMockedFn(Methods).mockReturnValue(
    partial<MethodsAjaxContract>({
      list: listImpl || defaultListImpl,
      method: jest.fn((namespace, name, snapshotId) => {
        return partial<MethodAjaxContract>({
          get: getImpl || defaultGetImpl(namespace),
          delete: deleteImpl || defaultDeleteImpl,
          permissions: jest.fn(async () => mockPermissions),
          setPermissions: () => setPermissionsWatch(namespace, name, snapshotId),
        });
      }),
    })
  );
};

type UseWorkspacesExports = typeof import('src/workspaces/common/state/useWorkspaces');
jest.mock('src/workspaces/common/state/useWorkspaces', (): UseWorkspacesExports => {
  return {
    ...jest.requireActual<UseWorkspacesExports>('src/workspaces/common/state/useWorkspaces'),
    useWorkspaces: jest.fn(),
  };
});

const mockUseWorkspaces = (workspaces: WorkspaceWrapper[]) => {
  asMockedFn(useWorkspaces).mockReturnValue({
    workspaces,
    loading: false,
    refresh: jest.fn(),
    status: 'Ready',
  });
};

const mockUser = (email: string): Partial<TerraUser> => ({ email });

const mockUserState = (email: string): Partial<TerraUserState> => {
  return { terraUser: mockUser(email) as TerraUser };
};

const MockWrappedWorkflowComponent = _.flow(
  forwardRefWithName('MockWrappedWorkflowComponent'),
  wrapWorkflows({
    breadcrumbs: () => breadcrumbs.commonPaths.workflowList(),
    activeTab: 'dashboard',
  })
)(() => {
  return 'children';
});

const mockWorkspace: WorkspaceInfo = {
  workspaceId: 'Workspace1',
  name: 'name1',
  namespace: 'namespace',
  cloudPlatform: 'Gcp',
  googleProject: 'project',
  billingAccount: 'account',
  bucketName: 'bucket',
  authorizationDomain: [],
  createdDate: '2023-02-15T19:17:15.711Z',
  createdBy: 'groot@gmail.com',
  lastModified: '2023-03-15T19:17:15.711Z',
};

const mockWorkspaces: Partial<WorkspaceWrapper>[] = [
  {
    workspace: mockWorkspace,
    accessLevel: 'WRITER',
  },
  {
    workspace: {
      workspaceId: 'Workspace2',
      name: 'name2',
      namespace: 'namespace',
      cloudPlatform: 'Gcp',
      googleProject: 'project',
      billingAccount: 'account',
      bucketName: 'bucket',
      authorizationDomain: [],
      createdDate: '2023-02-15T19:17:15.711Z',
      createdBy: 'groot@gmail.com',
      lastModified: '2023-03-15T19:17:15.711Z',
    },
    accessLevel: 'OWNER',
  },
  {
    workspace: {
      workspaceId: 'Workspace3',
      name: 'name3',
      namespace: 'namespace',
      cloudPlatform: 'Gcp',
      googleProject: 'project',
      billingAccount: 'account',
      bucketName: 'bucket',
      authorizationDomain: [],
      createdDate: '2023-02-15T19:17:15.711Z',
      createdBy: 'groot@gmail.com',
      lastModified: '2023-03-15T19:17:15.711Z',
    },
    accessLevel: 'READER',
  },
  {
    workspace: {
      workspaceId: 'Workspace4',
      name: 'name4',
      namespace: 'namespace',
      cloudPlatform: 'Azure',
      authorizationDomain: [],
      createdDate: '2023-02-15T19:17:15.711Z',
      createdBy: 'groot@gmail.com',
      lastModified: '2023-03-15T19:17:15.711Z',
    },
    azureContext: {} as AzureContext,
    accessLevel: 'PROJECT_OWNER',
  },
];

const snapshotStoreInitialValue = {
  createDate: '',
  entityType: '',
  managers: [],
  name: '',
  namespace: '',
  payload: '',
  public: undefined,
  snapshotComment: '',
  snapshotId: 0,
  synopsis: '',
  url: '',
};

const mockCloneSnapshotResponse: MethodResponse = {
  name: 'testname_copy',
  createDate: '2024-11-15T15:41:38Z',
  documentation: 'mock documentation',
  synopsis: '',
  entityType: 'Workflow',
  snapshotComment: 'groot-new-snapshot',
  snapshotId: 1,
  namespace: 'groot-new-namespace',
  payload:
    // eslint-disable-next-line no-template-curly-in-string
    'task echo_files {\\n  String? input1\\n  String? input2\\n  String? input3\\n  \\n  output {\\n    String out = read_string(stdout())\\n  }\\n\\n  command {\\n    echo \\"result: ${input1} ${input2} ${input3}\\"\\n  }\\n\\n  runtime {\\n    docker: \\"ubuntu:latest\\"\\n  }\\n}\\n\\nworkflow echo_strings {\\n  call echo_files\\n}',
  url: 'http://agora.dsde-dev.broadinstitute.org/api/v1/methods/groot-new-namespace/testname_copy/1',
};

const mockNewSnapshotResponse: MethodResponse = {
  ...mockSnapshot,
  snapshotComment: "groot's new snapshot",
  snapshotId: 2,
};

describe('workflow wrapper', () => {
  it('displays the method not found page if a method does not exist or the user does not have access', async () => {
    // Arrange
    mockAjax({ listImpl: jest.fn(async (_params) => []) });

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('hello@world.org')));

    // Act
    await act(async () => {
      render(
        <MockWrappedWorkflowComponent
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    // Assert

    // should not display the loading spinner
    const spinner = document.querySelector('[data-icon="loadingSpinner"]');
    expect(spinner).not.toBeInTheDocument();

    // should not display an error toast
    expect(errorWatcher).not.toHaveBeenCalled();

    // should not display the tab bar or children
    expect(screen.queryByText(/dashboard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/wdl/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/snapshot:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(`${mockSnapshot.snapshotId}`)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export to workspace/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Version action menu' })).not.toBeInTheDocument();
    expect(screen.queryByText('children')).not.toBeInTheDocument();

    // should only display the 404 error page, with the correct info filled in
    expect(screen.getByText('Could not display workflow')).toBeInTheDocument();
    expect(
      screen.getByText(
        'You cannot access this method because either it does not exist or you do not have access to it.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('hello@world.org')).toBeInTheDocument();
    expect(
      screen.getByText(
        'To view a version of an existing workflow, an owner of the version must give you permission to view it or make it publicly readable.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('The workflow may also have been deleted by one of its owners.')).toBeInTheDocument();

    const returnToMethodsListButton = screen.getByRole('link', { name: 'Return to Workflows List' });
    expect(returnToMethodsListButton).toBeInTheDocument();

    // mock link path based on internal nav path name
    expect(returnToMethodsListButton).toHaveAttribute('href', '#workflows');
  });

  it('displays an error toast when there is an unexpected error loading a method', async () => {
    // Arrange
    mockAjax({
      listImpl: jest.fn(async (_params) => {
        throw new Error('BOOM');
      }),
    });

    // Act
    await act(async () => {
      render(
        <MockWrappedWorkflowComponent
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    // Assert

    // should not display the loading spinner
    const spinner = document.querySelector('[data-icon="loadingSpinner"]');
    expect(spinner).not.toBeInTheDocument();

    // should not display the tab bar or children
    expect(screen.queryByText(/dashboard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/wdl/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/version:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(`${mockSnapshot.snapshotId}`)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export to workspace/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Version action menu' })).not.toBeInTheDocument();
    expect(screen.queryByText('children')).not.toBeInTheDocument();

    // should not display the 404 error page
    expect(screen.queryByText('Could not display workflow')).not.toBeInTheDocument();
    expect(screen.queryByText('Could not display version')).not.toBeInTheDocument();

    // should only display an error toast
    expect(errorWatcher).toHaveBeenCalledWith('Error loading method', expect.anything());
  });
});

describe('workflows container', () => {
  // Keep this test first to avoid potential issues with Jest and stores
  it('performs the correct non-visual operations when a snapshot deletion is confirmed', async () => {
    // Arrange
    mockAjax();

    jest.spyOn(window.history, 'replaceState');

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('hello@world.org')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockDeleteSnapshot.namespace}
          name={mockDeleteSnapshot.name}
          snapshotId={`${mockDeleteSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Delete version' })); // open modal
    await user.click(screen.getByRole('button', { name: 'Delete version' })); // confirm deletion

    // Assert

    // The first call is to load the snapshot; the second is to delete it
    expect(Methods().method).toHaveBeenNthCalledWith(
      2,
      mockDeleteSnapshot.namespace,
      mockDeleteSnapshot.name,
      mockDeleteSnapshot.snapshotId
    );

    expect(
      Methods().method(mockDeleteSnapshot.namespace, mockDeleteSnapshot.name, mockDeleteSnapshot.snapshotId).delete
    ).toHaveBeenCalled();

    // Refers to FCUI `#methods`
    expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '#methods/methodnamespace/testname');

    expect(snapshotStore.get()).toEqual(snapshotStoreInitialValue);

    expect(snapshotsListStore.get()).toBeUndefined();

    expect(goToPath).toHaveBeenCalledWith('workflows');
  });

  it('renders the save as new method modal when the corresponding button is pressed', async () => {
    // Arrange
    mockAjax();

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('hello@world.org')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Save as' }));

    const dialog = screen.getByRole('dialog', { name: /create new workflow/i });

    // Assert
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Namespace *' })).toHaveDisplayValue('');
    expect(within(dialog).getByRole('textbox', { name: 'Name *' })).toHaveDisplayValue('testname_copy');
    expect(within(dialog).getByRole('textbox', { name: 'Documentation' })).toHaveDisplayValue('mock documentation');
    expect(within(dialog).getByRole('textbox', { name: 'Synopsis (80 characters max)' })).toHaveDisplayValue('');
    expect(within(dialog).getByRole('textbox', { name: 'Version comment' })).toHaveDisplayValue('');
    expect(within(dialog).getByTestId('wdl editor')).toHaveDisplayValue(mockSnapshot.payload.toString());
  });

  it('calls right provider with expected arguments when snapshot is cloned', async () => {
    // Arrange
    mockAjax();

    jest.spyOn(postMethodProvider, 'postMethod').mockResolvedValue(mockCloneSnapshotResponse);

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Save as' }));

    const dialog = screen.getByRole('dialog', { name: /create new workflow/i });

    // Assert
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Namespace *' })).toHaveDisplayValue('');
    expect(within(dialog).getByRole('textbox', { name: 'Name *' })).toHaveDisplayValue('testname_copy');
    expect(within(dialog).getByRole('textbox', { name: 'Documentation' })).toHaveDisplayValue('mock documentation');
    expect(within(dialog).getByRole('textbox', { name: 'Synopsis (80 characters max)' })).toHaveDisplayValue('');
    expect(within(dialog).getByRole('textbox', { name: 'Version comment' })).toHaveDisplayValue('');
    expect(within(dialog).getByTestId('wdl editor')).toHaveDisplayValue(mockSnapshot.payload.toString());

    // Act
    fireEvent.change(screen.getByRole('textbox', { name: 'Namespace *' }), {
      target: { value: 'groot-new-namespace' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Version comment' }), {
      target: { value: 'groot-new-snapshot' },
    });

    await user.click(screen.getByRole('button', { name: 'Create new workflow' }));

    // Assert
    expect(postMethodProvider.postMethod).toHaveBeenCalled();
    expect(postMethodProvider.postMethod).toHaveBeenCalledWith(
      'groot-new-namespace',
      'testname_copy',
      mockSnapshot.payload,
      'mock documentation',
      '',
      'groot-new-snapshot'
    );

    expect(Nav.goToPath).toHaveBeenCalledWith('workflow-dashboard', {
      name: 'testname_copy',
      namespace: 'groot-new-namespace',
      snapshotId: 1,
    });
  });

  it('hides the save as new method modal when it is dismissed', async () => {
    // Arrange
    mockAjax();

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('hello@world.org')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Save as' }));

    // Assert
    const dialog1 = screen.queryByRole('dialog', { name: /create new workflow/i });
    expect(dialog1).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    const dialog2 = screen.queryByRole('dialog', { name: /create new workflow/i });
    expect(dialog2).not.toBeInTheDocument();
  });

  it('renders edit method modal when corresponding button is pressed', async () => {
    // Arrange
    mockAjax();

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('hello@world.org')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    const dialog = screen.getByRole('dialog', { name: /edit/i });

    // Assert
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Namespace' })).toHaveAttribute('placeholder', 'testnamespace');
    expect(within(dialog).getByRole('textbox', { name: 'Namespace' })).toHaveAttribute('disabled');
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveAttribute('placeholder', 'testname');
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveAttribute('disabled');
    expect(within(dialog).getByRole('textbox', { name: 'Documentation' })).toHaveDisplayValue('mock documentation');
    expect(within(dialog).getByRole('textbox', { name: 'Synopsis (80 characters max)' })).toHaveDisplayValue('');
    expect(within(dialog).getByRole('textbox', { name: 'Version comment' })).toHaveDisplayValue('');
    expect(within(dialog).getByTestId('wdl editor')).toHaveDisplayValue(mockSnapshot.payload.toString());
    expect(within(dialog).getByRole('checkbox', { name: 'Delete version 1' })).not.toBeChecked();
  });

  it('calls the right provider with expected arguments when new snapshot is created', async () => {
    // Arrange
    mockAjax();

    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('hello@world.org')));
    jest.spyOn(editMethodProvider, 'createNewSnapshot').mockResolvedValue(mockNewSnapshotResponse);

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    fireEvent.change(screen.getByRole('textbox', { name: 'Version comment' }), {
      target: { value: "groot's new improved version" },
    });
    await user.click(screen.getByRole('checkbox', { name: 'Delete version 1' }));

    await user.click(screen.getByRole('button', { name: 'Create new version' }));

    // Assert
    expect(editMethodProvider.createNewSnapshot).toHaveBeenCalled();
    expect(editMethodProvider.createNewSnapshot).toHaveBeenCalledWith(
      mockSnapshot.namespace,
      mockSnapshot.name,
      mockSnapshot.snapshotId,
      true,
      mockSnapshot.synopsis,
      mockSnapshot.documentation,
      mockSnapshot.payload,
      "groot's new improved version"
    );

    expect(Nav.goToPath).toHaveBeenCalledWith('workflow-dashboard', {
      name: 'testname',
      namespace: 'testnamespace',
      snapshotId: 2,
    });
  });

  it('hides the edit method modal when it is dismissed', async () => {
    // Arrange
    mockAjax();

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('hello@world.org')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    // Assert
    const dialog1 = screen.queryByRole('dialog', { name: /edit/i });
    expect(dialog1).toBeInTheDocument();

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    const dialog2 = screen.queryByRole('dialog', { name: /edit/i });
    expect(dialog2).not.toBeInTheDocument();
  });

  it('hides the delete version modal and displays a loading spinner when the deletion is confirmed', async () => {
    // Arrange
    mockAjax({
      deleteImpl: jest.fn(async () => {
        await delay(100);
      }),
    });

    // ensure that an additional loading spinner does not appear due to the
    // snapshot store being reset, so that we can test only the spinner that
    // should appear while the delete version operation is being performed
    jest.spyOn(snapshotStore, 'reset').mockImplementation(_.noop);

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('hello@world.org')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockDeleteSnapshot.namespace}
          name={mockDeleteSnapshot.name}
          snapshotId={`${mockDeleteSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Delete version' })); // open modal
    await user.click(screen.getByRole('button', { name: 'Delete version' })); // confirm deletion

    // Assert
    const dialog = screen.queryByRole('dialog', { name: /delete version/i });
    const spinner = document.querySelector('[data-icon="loadingSpinner"]');

    expect(dialog).not.toBeInTheDocument();
    expect(spinner).toBeInTheDocument();
  });

  it('renders the delete version modal when the corresponding button is pressed if the user is a version owner', async () => {
    // Arrange
    mockAjax();

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('hElLo@world.org')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockDeleteSnapshot.namespace}
          name={mockDeleteSnapshot.name}
          snapshotId={`${mockDeleteSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Delete version' }));

    // Assert
    const dialog = screen.getByRole('dialog', { name: /delete version/i });

    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('methodnamespace', { exact: false })).toBeInTheDocument();
    expect(within(dialog).getByText('testname', { exact: false })).toBeInTheDocument();
    expect(within(dialog).getByText('3', { exact: false })).toBeInTheDocument();
  });

  it('only allows the delete version modal to be opened if the user is a snapshot owner', async () => {
    // Arrange
    mockAjax();

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('hello2@world.org')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockDeleteSnapshot.namespace}
          name={mockDeleteSnapshot.name}
          snapshotId={`${mockDeleteSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Delete version' }));

    // Assert
    const dialog = screen.queryByRole('dialog', { name: /delete version/i });

    expect(dialog).not.toBeInTheDocument();
  });

  it('hides the delete version modal when it is dismissed', async () => {
    // Arrange
    mockAjax();

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('hello@world.org')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockDeleteSnapshot.namespace}
          name={mockDeleteSnapshot.name}
          snapshotId={`${mockDeleteSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Delete version' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    const dialog = screen.queryByRole('dialog', { name: /delete version/i });

    expect(dialog).not.toBeInTheDocument();
  });

  it('displays an error message when there is an error deleting a snapshot', async () => {
    // Arrange
    mockAjax({
      deleteImpl: jest.fn(() => {
        throw new Error('BOOM');
      }),
    });

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('hello@world.org')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockDeleteSnapshot.namespace}
          name={mockDeleteSnapshot.name}
          snapshotId={`${mockDeleteSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Delete version' })); // open modal
    await user.click(screen.getByRole('button', { name: 'Delete version' })); // confirm deletion

    // Assert
    expect(errorWatcher).toHaveBeenCalledWith('Error deleting version', expect.anything());
  });

  it('displays the snapshot not found page if a snapshot does not exist or the user does not have access', async () => {
    // Arrange
    mockAjax({ getImpl: jest.fn().mockRejectedValue(new Response('{ "message": "Not found"}', { status: 404 })) });

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('hello@world.org')));

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        >
          children
        </WorkflowsContainer>
      );
    });

    // Assert

    // should not display the loading spinner
    const spinner = document.querySelector('[data-icon="loadingSpinner"]');
    expect(spinner).not.toBeInTheDocument();

    // should not display the children
    expect(screen.queryByText('children')).not.toBeInTheDocument();

    // should not display an error toast
    expect(errorWatcher).not.toHaveBeenCalled();

    // should display the tab bar, but with the export button and action menu disabled
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/wdl/i)).toBeInTheDocument();
    expect(screen.getByText(/version:/i)).toBeInTheDocument();
    expect(screen.getByText(`${mockSnapshot.snapshotId}`)).toBeInTheDocument();

    const exportButton = screen.getByRole('button', { name: /export to workspace/i });
    expect(exportButton).toBeInTheDocument();
    expect(exportButton).toHaveAttribute('disabled');
    expect(exportButton).toHaveAttribute('aria-disabled');

    const actionMenu = screen.getByRole('button', { name: 'Version action menu' });
    expect(actionMenu).toBeInTheDocument();
    expect(actionMenu).toHaveAttribute('disabled');
    expect(actionMenu).toHaveAttribute('aria-disabled');

    // should display the 404 error page, with the correct info filled in
    expect(screen.getByText('Could not display version')).toBeInTheDocument();
    expect(
      screen.getByText(
        'You cannot access this workflow version because either it does not exist or you do not have access to it.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('hello@world.org')).toBeInTheDocument();
    expect(
      screen.getByText(
        'To view an existing workflow version, an owner of the snapshot must give you permission to view it or make it publicly readable.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('The snapshot may also have been deleted by one of its owners.')).toBeInTheDocument();
    expect(screen.getByText('Please select a different snapshot from the dropdown above.')).toBeInTheDocument();

    expect(screen.queryByRole('link', { name: 'Return to Methods List' })).not.toBeInTheDocument();
  });

  it('displays an error toast when there is an unexpected error loading a snapshot', async () => {
    // Arrange
    mockAjax({
      getImpl: jest.fn(() => {
        throw new Error('BOOM');
      }),
    });

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        >
          children
        </WorkflowsContainer>
      );
    });

    // Assert

    // should not display the loading spinner
    const spinner = document.querySelector('[data-icon="loadingSpinner"]');
    expect(spinner).not.toBeInTheDocument();

    // should not display the tab bar or children
    expect(screen.queryByText(/dashboard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/wdl/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/snapshot:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(`${mockSnapshot.snapshotId}`)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export to workspace/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Version action menu' })).not.toBeInTheDocument();
    expect(screen.queryByText('children')).not.toBeInTheDocument();

    // should not display the 404 error page
    expect(screen.queryByText('Could not display method')).not.toBeInTheDocument();
    expect(screen.queryByText('Could not display snapshot')).not.toBeInTheDocument();

    // should only display an error toast
    expect(errorWatcher).toHaveBeenCalledWith('Error loading version', expect.anything());
  });

  it('displays export to workspace modal when export button is pressed', async () => {
    // Arrange
    mockAjax();
    mockUseWorkspaces([]);

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Export to Workspace' }));

    // Assert
    const dialog = screen.getByRole('dialog', { name: /export to workspace/i });

    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Export to Workspace')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('hides export to workspace modal when it is dismissed', async () => {
    // Arrange
    mockAjax();
    mockUseWorkspaces([]);

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Export to Workspace' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(screen.queryByRole('dialog', { name: /export to workspace/i })).not.toBeInTheDocument();
  });

  it('properly filters destination workspace options in export to workspace modal', async () => {
    // Arrange
    mockAjax();
    mockUseWorkspaces(mockWorkspaces as WorkspaceWrapper[]);

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Export to Workspace' }));

    // Assert
    const workspaceSelector = new SelectHelper(screen.getByRole('combobox', { name: 'Select a workspace' }), user);
    const workspaceOptions = await workspaceSelector.getOptions();

    // should display GCP workspace with WRITER access level and GCP workspace
    // with OWNER access level; should not display GCP workspace with READER
    // access level or Azure workspace
    expect(workspaceOptions).toEqual([expect.stringMatching('name1'), expect.stringMatching('name2')]);
  });

  it('uses the workflow name as the default name in the export to workspace modal', async () => {
    // Arrange
    mockAjax();
    mockUseWorkspaces(mockWorkspaces as WorkspaceWrapper[]);

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Export to Workspace' }));

    // Assert
    expect(screen.getByRole('textbox', { name: 'Name *' })).toHaveDisplayValue(mockSnapshot.name);
  });

  it('uses the correct export provider for the export to workspace modal', async () => {
    // Arrange
    mockAjax();
    mockUseWorkspaces(mockWorkspaces as WorkspaceWrapper[]);

    const exportWorkflowFromMethodsRepoProviderFactory = jest.spyOn(
      ExportWorkflowToWorkspaceProvider,
      'makeExportWorkflowFromMethodsRepoProvider'
    );

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Export to Workspace' }));

    // Assert
    expect(exportWorkflowFromMethodsRepoProviderFactory).toHaveBeenCalledWith({
      methodNamespace: mockSnapshot.namespace,
      methodName: mockSnapshot.name,
      methodVersion: mockSnapshot.snapshotId,
    });
  });

  it('navigates to the correct location when viewing an exported workflow', async () => {
    // Arrange
    mockAjax();
    mockUseWorkspaces(mockWorkspaces as WorkspaceWrapper[]);

    // So that clicking the export button does not fail
    jest.spyOn(ExportWorkflowToWorkspaceProvider, 'makeExportWorkflowFromMethodsRepoProvider').mockReturnValue({
      export: () => Promise.resolve(),
    });

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Export to Workspace' }));

    const workspaceSelector = new SelectHelper(screen.getByRole('combobox', { name: 'Select a workspace' }), user);
    await workspaceSelector.selectOption('cloud_google_icon.svg name1');
    fireEvent.change(screen.getByRole('textbox', { name: 'Name *' }), { target: { value: 'newname' } });

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('button', { name: /go to exported workflow/i }));

    // Assert
    expect(goToPath).toHaveBeenCalledWith('workflow', {
      namespace: mockWorkspace.namespace,
      name: mockWorkspace.name,
      workflowNamespace: mockSnapshot.namespace,
      workflowName: 'newname',
    });
  });

  it('renders edit permissions modal', async () => {
    // Arrange
    mockAjax();

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('hElLo@world.org')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Edit version permissions' }));

    // Assert
    expect(screen.getByText('Edit Version Permissions'));
  });

  it('hides edit permissions modal when it is dismissed', async () => {
    // Arrange
    mockAjax();

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('hElLo@world.org')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Edit version permissions' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(screen.queryByText('Edit Version Permissions')).not.toBeInTheDocument();
  });

  it("allows the currently displayed snapshot's permissions to be edited", async () => {
    // Arrange
    mockAjax();

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('hElLo@world.org')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Edit version permissions' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(setPermissionsWatch).toHaveBeenCalledTimes(1);
    expect(setPermissionsWatch).toHaveBeenCalledWith(
      mockSnapshot.namespace,
      mockSnapshot.name,
      mockSnapshot.snapshotId
    );
  });

  it('reloads the displayed snapshot after its permissions are edited', async () => {
    // Arrange
    mockAjax();

    // set the user's email
    jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('hElLo@world.org')));

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowsContainer
          namespace={mockSnapshot.namespace}
          name={mockSnapshot.name}
          snapshotId={`${mockSnapshot.snapshotId}`}
          tabName='dashboard'
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Edit version permissions' }));

    // Simulate the snapshot being updated with new owners in the backend when
    // the save button is pressed
    mockAjax({
      getImpl: jest.fn().mockResolvedValue(mockSnapshotWithAdditionalOwners),
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(snapshotStore.get().managers).toEqual(mockSnapshotWithAdditionalOwners.managers);
    expect(snapshotStore.get().public).toEqual(mockSnapshotWithAdditionalOwners.public);
  });
});
