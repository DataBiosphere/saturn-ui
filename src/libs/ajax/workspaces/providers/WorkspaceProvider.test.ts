import { Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import { asMockedFn, partial } from 'src/testing/test-utils';

import { workspaceProvider } from './WorkspaceProvider';

jest.mock('src/libs/ajax/workspaces/Workspaces');

type WorkspacesAjaxNeeds = Pick<WorkspacesAjaxContract, 'list'>;

interface AjaxMockNeeds {
  workspaces: WorkspacesAjaxNeeds;
}

/**
 * local test utility - sets up mocks for needed ajax data-calls with as much type-saftely as possible.
 *
 * @return collection of key data-call fns for easy
 * mock overrides and/or method spying/assertions
 */
const mockAjaxNeeds = (): AjaxMockNeeds => {
  const partialWorkspaces: WorkspacesAjaxNeeds = {
    list: jest.fn(),
  };
  asMockedFn(Workspaces).mockReturnValue(partial<WorkspacesAjaxContract>(partialWorkspaces));

  return { workspaces: partialWorkspaces };
};
describe('workspacesProvider', () => {
  it('handles list call', async () => {
    // Arrange
    const ajaxMock = mockAjaxNeeds();
    asMockedFn(ajaxMock.workspaces.list).mockResolvedValue([]);
    const signal = new window.AbortController().signal;

    // Act
    const result = await workspaceProvider.list(['field1', 'field2'], { stringAttributeMaxLength: 50, signal });

    // Assert;
    expect(Workspaces).toBeCalledTimes(1);
    expect(Workspaces).toBeCalledWith(signal);
    expect(ajaxMock.workspaces.list).toBeCalledTimes(1);
    expect(ajaxMock.workspaces.list).toBeCalledWith(['field1', 'field2'], 50);
    expect(result).toEqual([]);
  });
});
