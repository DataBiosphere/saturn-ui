import { Methods, MethodsAjaxContract } from 'src/libs/ajax/methods/Methods';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import {
  makeExportWorkflowFromMethodsRepoProvider,
  makeExportWorkflowFromWorkspaceProvider,
} from 'src/libs/ajax/workspaces/providers/ExportWorkflowToWorkspaceProvider';
import { MethodConfiguration, MethodRepoMethod } from 'src/libs/ajax/workspaces/workspace-models';
import { WorkspaceContract, Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import { asMockedFn, MockedFn, partial } from 'src/testing/test-utils';
import { WorkspaceInfo } from 'src/workspaces/utils';

jest.mock('src/libs/ajax/Metrics');
jest.mock('src/libs/ajax/methods/Methods');
jest.mock('src/libs/ajax/workspaces/Workspaces');

type MethodConfigContract = ReturnType<WorkspaceContract['methodConfig']>;

const sourceWorkspace: WorkspaceInfo = {
  workspaceId: 'Workspace1',
  name: 'name1',
  namespace: 'namespace1',
  cloudPlatform: 'Azure',
  authorizationDomain: [],
  createdDate: '2023-02-15T19:17:15.711Z',
  createdBy: 'groot@gmail.com',
  lastModified: '2023-03-15T19:17:15.711Z',
};

const destWorkspace: WorkspaceInfo = {
  workspaceId: 'Workspace2',
  name: 'name2',
  namespace: 'namespace2',
  cloudPlatform: 'Azure',
  authorizationDomain: [],
  createdDate: '2023-02-15T19:17:15.711Z',
  createdBy: 'groot@gmail.com',
  lastModified: '2023-03-15T19:17:15.711Z',
};

const mockMethodRepoMethod: MethodRepoMethod = { methodVersion: 1 };

const mockMethodConfiguration: MethodConfiguration = {
  namespace: 'namespace',
  name: 'name',
  methodRepoMethod: mockMethodRepoMethod,
};

beforeAll(() => {
  asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent: jest.fn() }));
});

describe('export workflow from workspace provider', () => {
  it('handles export call', async () => {
    // Arrange
    const mockCopyTo: MockedFn<MethodConfigContract['copyTo']> = jest.fn();
    const mockWorkspace: MockedFn<WorkspacesAjaxContract['workspace']> = jest.fn();
    const mockMethodConfig: MockedFn<WorkspaceContract['methodConfig']> = jest.fn();

    mockMethodConfig.mockReturnValue(partial<MethodConfigContract>({ copyTo: mockCopyTo }));
    mockWorkspace.mockReturnValue(partial<WorkspaceContract>({ methodConfig: mockMethodConfig }));

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: mockWorkspace,
      })
    );

    const signal = new window.AbortController().signal;

    // Act
    await makeExportWorkflowFromWorkspaceProvider(sourceWorkspace, mockMethodConfiguration).export(
      destWorkspace,
      'newname',
      {
        signal,
      }
    );

    // Assert
    expect(Workspaces).toHaveBeenCalledTimes(1);
    expect(Workspaces).toHaveBeenCalledWith(signal);
    expect(mockWorkspace).toHaveBeenCalledTimes(1);
    expect(mockWorkspace).toHaveBeenCalledWith(sourceWorkspace.namespace, sourceWorkspace.name);
    expect(mockMethodConfig).toHaveBeenCalledTimes(1);
    expect(mockMethodConfig).toHaveBeenCalledWith(mockMethodConfiguration.namespace, mockMethodConfiguration.name);
    expect(mockCopyTo).toHaveBeenCalledTimes(1);
    expect(mockCopyTo).toHaveBeenCalledWith({
      destConfigNamespace: destWorkspace.namespace,
      destConfigName: 'newname',
      workspaceName: {
        namespace: destWorkspace.namespace,
        name: destWorkspace.name,
      },
    });
  });
});

describe('export workflow from methods repo provider', () => {
  it('handles export call', async () => {
    // Arrange
    const mockWorkspace: MockedFn<WorkspacesAjaxContract['workspace']> = jest.fn();
    const mockImportMethodConfig: MockedFn<WorkspaceContract['importMethodConfig']> = jest.fn();

    mockWorkspace.mockReturnValue(partial<WorkspaceContract>({ importMethodConfig: mockImportMethodConfig }));

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: mockWorkspace,
      })
    );

    const mockTemplate: MockedFn<MethodsAjaxContract['template']> = jest.fn();
    mockTemplate.mockResolvedValue({
      rootEntityType: 'shouldberemoved',
      inputs: {
        shouldBeKept: '',
      },
    });

    asMockedFn(Methods).mockReturnValue(
      partial<MethodsAjaxContract>({
        template: mockTemplate,
      })
    );

    const signal = new window.AbortController().signal;

    // Act
    await makeExportWorkflowFromMethodsRepoProvider(mockMethodRepoMethod).export(destWorkspace, 'newname', {
      signal,
    });

    // Assert
    expect(Workspaces).toHaveBeenCalledTimes(1);
    expect(Workspaces).toHaveBeenCalledWith(signal);
    expect(mockTemplate).toHaveBeenCalledTimes(1);
    expect(mockTemplate).toHaveBeenCalledWith(mockMethodRepoMethod);

    expect(Methods).toHaveBeenCalledTimes(1);
    expect(Methods).toHaveBeenCalledWith(signal);
    expect(mockWorkspace).toHaveBeenCalledTimes(1);
    expect(mockWorkspace).toHaveBeenCalledWith(destWorkspace.namespace, destWorkspace.name);
    expect(mockImportMethodConfig).toHaveBeenCalledTimes(1);
    expect(mockImportMethodConfig).toHaveBeenCalledWith({
      inputs: {
        shouldBeKept: '',
      },
      name: 'newname',
      namespace: mockMethodRepoMethod.methodNamespace,
    });
  });
});
