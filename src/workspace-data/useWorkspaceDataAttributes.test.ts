import { asMockedFn, MockedFn, partial } from '@terra-ui-packages/test-utils';
import { GoogleWorkspaceInfo, WorkspaceWrapper } from 'src/libs/ajax/workspaces/workspace-models';
import { WorkspaceContract, Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import { renderHookInActWithAppContexts } from 'src/testing/test-utils';

import { useWorkspaceDataAttributes } from './useWorkspaceDataAttributes';

jest.mock('src/libs/ajax/workspaces/Workspaces');

describe('useWorkspaceDataAttributes', () => {
  it('should call Ajax.Workspaces.workspace with the correct arguments', async () => {
    // Arrange
    const workspaceDetails: MockedFn<WorkspaceContract['details']> = jest.fn();
    workspaceDetails.mockResolvedValue(
      partial<WorkspaceWrapper>({
        workspace: partial<GoogleWorkspaceInfo>({ attributes: {} }),
      })
    );
    const workspace: MockedFn<WorkspacesAjaxContract['workspace']> = jest.fn();
    workspace.mockReturnValue(partial<WorkspaceContract>({ details: workspaceDetails }));

    asMockedFn(Workspaces).mockReturnValue(partial<WorkspacesAjaxContract>({ workspace }));

    // Act
    await renderHookInActWithAppContexts(() => useWorkspaceDataAttributes('namespace', 'name'));

    // Assert
    expect(workspace).toHaveBeenCalledWith('namespace', 'name');
    expect(workspaceDetails).toHaveBeenCalledWith(['workspace.attributes']);
  });

  it('extracts workspace data attributes from all workspace attributes', async () => {
    // Arrange
    const workspaceAttributes = {
      description: 'workspace description',
      'sys:attr': 'namespaced attribute',
      referenceData_attr: 'gs://bucket/path',
      attr1: 'value1',
      attr2: 'value2',
      __DESCRIPTION__attr1: 'description1',
    };

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            details: () =>
              Promise.resolve(
                partial<WorkspaceWrapper>({
                  workspace: partial<GoogleWorkspaceInfo>({ attributes: workspaceAttributes }),
                })
              ),
          }),
      })
    );

    // Act
    const { result: hookReturnRef } = await renderHookInActWithAppContexts(() =>
      useWorkspaceDataAttributes('namespace', 'name')
    );

    // Assert
    expect(hookReturnRef.current[0].state).toEqual([
      ['attr1', 'value1', 'description1'],
      ['attr2', 'value2', undefined],
    ]);
  });
});
