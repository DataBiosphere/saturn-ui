import { Methods, MethodsAjaxContract } from 'src/libs/ajax/methods/Methods';
import { WorkspaceContract, Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import { asMockedFn, MockedFn, partial } from 'src/testing/test-utils';

import { importDockstoreWorkflow } from './importDockstoreWorkflow';

jest.mock('src/libs/ajax/methods/Methods');
jest.mock('src/libs/ajax/workspaces/Workspaces');

describe('importDockstoreWorkflow', () => {
  const testWorkspace = {
    namespace: 'test',
    name: 'import-workflow',
  };

  const testWorkflow = {
    path: 'github.com/DataBiosphere/test-workflows/test-workflow',
    version: 'v1.0.0',
    source: 'dockstore',
  };

  let workspaceMethodConfigAjax: MockedFn<WorkspaceContract['methodConfig']>;
  let methodConfigInputsOutputs: MockedFn<MethodsAjaxContract['configInputsOutputs']>;
  let importMethodConfig: MockedFn<WorkspaceContract['importMethodConfig']>;
  let deleteMethodConfig: MockedFn<ReturnType<WorkspaceContract['methodConfig']>['delete']>;

  type MethodConfigContract = ReturnType<WorkspaceContract['methodConfig']>;

  beforeEach(() => {
    // Arrange
    importMethodConfig = jest.fn(async (_config) => partial<Response>({}));
    deleteMethodConfig = jest.fn(async () => partial<Response>({}));

    workspaceMethodConfigAjax = jest.fn((_namespace, _name) =>
      partial<MethodConfigContract>({
        delete: deleteMethodConfig,
      })
    );

    methodConfigInputsOutputs = jest.fn(async (_configs) => ({
      inputs: [],
      outputs: [
        { name: 'taskA.output1', outputType: 'String' },
        { name: 'taskA.output2', outputType: 'String' },
      ],
    }));

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            entityMetadata: async () => ({
              participant: { count: 1, idName: 'participant_id', attributeNames: [] },
              sample: { count: 1, idName: 'sample_id', attributeNames: [] },
            }),
            importMethodConfig,
            methodConfig: workspaceMethodConfigAjax,
          }),
      })
    );
    asMockedFn(Methods).mockReturnValue(
      partial<MethodsAjaxContract>({ configInputsOutputs: methodConfigInputsOutputs })
    );
  });

  it('imports workflow into workspace', async () => {
    // Act
    await importDockstoreWorkflow({ workspace: testWorkspace, workflow: testWorkflow, workflowName: 'test-workflow' });

    // Assert
    expect(importMethodConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: testWorkspace.namespace,
        name: 'test-workflow',
        methodConfigVersion: 1,
        deleted: false,
        methodRepoMethod: {
          sourceRepo: testWorkflow.source,
          methodPath: testWorkflow.path,
          methodVersion: testWorkflow.version,
        },
      })
    );
  });

  it('sets a default root entity type', async () => {
    // Act
    await importDockstoreWorkflow({ workspace: testWorkspace, workflow: testWorkflow, workflowName: 'test-workflow' });

    // Assert
    expect(importMethodConfig).toHaveBeenCalledWith(expect.objectContaining({ rootEntityType: 'participant' }));
  });

  it('configures default outputs', async () => {
    // Act
    await importDockstoreWorkflow({ workspace: testWorkspace, workflow: testWorkflow, workflowName: 'test-workflow' });

    // Assert
    expect(importMethodConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        outputs: {
          'taskA.output1': 'this.output1',
          'taskA.output2': 'this.output2',
        },
      })
    );
  });

  describe('when overwriting an existing workflow', () => {
    it('attempts to delete existing workflow', async () => {
      // Act
      await importDockstoreWorkflow(
        { workspace: testWorkspace, workflow: testWorkflow, workflowName: 'test-workflow' },
        { overwrite: true }
      );

      // Assert
      expect(workspaceMethodConfigAjax).toHaveBeenCalledWith('test', 'test-workflow');
      expect(deleteMethodConfig).toHaveBeenCalled();
    });

    it('does not error if workflow does not exist', async () => {
      // Arrange
      deleteMethodConfig.mockRejectedValue(new Response('{}', { status: 404 }));

      // Act
      const result = importDockstoreWorkflow(
        { workspace: testWorkspace, workflow: testWorkflow, workflowName: 'test-workflow' },
        { overwrite: true }
      );

      // Assert
      await expect(result).resolves.toEqual(undefined);
    });
  });
});
