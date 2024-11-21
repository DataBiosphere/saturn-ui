import { asMockedFn, partial } from '@terra-ui-packages/test-utils';
import { Methods, MethodsAjaxContract } from 'src/libs/ajax/methods/Methods';
import { MethodResponse } from 'src/libs/ajax/methods/methods-models';
import { editMethodProvider } from 'src/libs/ajax/methods/providers/EditMethodProvider';
import { oidcStore } from 'src/libs/state';

jest.mock('src/libs/ajax/methods/Methods');

type MethodAjaxContract = MethodsAjaxContract['method'];

const mockMethodResponse: MethodResponse = {
  name: 'groot-method',
  createDate: '2024-11-20T14:40:32Z',
  documentation: 'documentation',
  synopsis: 'synopsis',
  entityType: 'Workflow',
  snapshotComment: 'snapshot comment',
  snapshotId: 4,
  namespace: 'groot-namespace',
  payload: 'workflow myGreatWorkflow {}',
  url: 'http://agora.dsde-dev.broadinstitute.org/api/v1/methods/groot-namespace/groot-method/4',
};

jest.spyOn(oidcStore, 'get').mockImplementation(
  jest.fn().mockReturnValue({
    userManager: { getUser: jest.fn() },
  })
);

const mockAjax = () => {
  const mockCreateSnapshot = jest.fn().mockReturnValue(mockMethodResponse);
  asMockedFn(Methods).mockReturnValue({
    method: jest.fn(() => {
      return partial<ReturnType<MethodAjaxContract>>({
        createSnapshot: mockCreateSnapshot,
      });
    }) as MethodAjaxContract,
  } as MethodsAjaxContract);
};

describe('EditMethodProvider', () => {
  it('handles create new snapshot call', async () => {
    // Arrange
    mockAjax();

    const signal = new window.AbortController().signal;

    // Act
    const result = await editMethodProvider.createNewSnapshot(
      'groot-namespace',
      'groot-method',
      3,
      true,
      'synopsis',
      'documentation',
      'workflow myGreatWorkflow {}',
      'snapshot comment',
      { signal }
    );

    // Assert
    expect(Methods).toBeCalledTimes(1);
    expect(Methods).toBeCalledWith(signal);
    expect(Methods().method).toHaveBeenCalledWith('groot-namespace', 'groot-method', 3);
    expect(Methods().method('groot-namespace', 'groot-method', 3).createSnapshot).toHaveBeenCalledWith(
      {
        payload: 'workflow myGreatWorkflow {}',
        documentation: 'documentation',
        synopsis: 'synopsis',
        snapshotComment: 'snapshot comment',
      },
      true
    );
    expect(result).toEqual(mockMethodResponse);
  });
});
