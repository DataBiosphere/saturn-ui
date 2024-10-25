import { Methods, MethodsAjaxContract } from 'src/libs/ajax/methods/Methods';
import { MethodResponse } from 'src/libs/ajax/methods/methods-models';
import { createMethodProvider } from 'src/libs/ajax/methods/providers/CreateMethodProvider';
import { asMockedFn, partial } from 'src/testing/test-utils';

jest.mock('src/libs/ajax/methods/Methods');

type MethodsAjaxNeeds = Pick<MethodsAjaxContract, 'postMethod'>;

const mockMethodsNeeds = (): MethodsAjaxNeeds => {
  const partialMethods: MethodsAjaxNeeds = {
    postMethod: jest.fn(),
  };
  asMockedFn(Methods).mockReturnValue(partial<MethodsAjaxContract>(partialMethods));

  return partialMethods;
};

const mockMethodResponse: MethodResponse = {
  name: 'response-name',
  createDate: '2024-01-01T15:41:38Z',
  documentation: 'response docs',
  synopsis: 'response synopsis',
  entityType: 'Workflow',
  snapshotComment: 'response comment',
  snapshotId: 1,
  namespace: 'response-namespace',
  payload: 'workflow response {}',
  url: 'http://agora.dsde-dev.broadinstitute.org/api/v1/methods/sschu/response-test/1',
};

describe('create method provider', () => {
  it('handles create call', async () => {
    // Arrange
    const methodsMock = mockMethodsNeeds();
    asMockedFn(methodsMock.postMethod).mockResolvedValue(mockMethodResponse);
    const signal = new window.AbortController().signal;

    // Act
    const result = await createMethodProvider.create(
      'input-namespace',
      'input-name',
      'workflow input {}',
      'input docs',
      'input synopsis',
      'input comment',
      { signal }
    );

    // Assert
    expect(Methods).toBeCalledTimes(1);
    expect(Methods).toBeCalledWith(signal);
    expect(methodsMock.postMethod).toBeCalledTimes(1);
    expect(methodsMock.postMethod).toBeCalledWith({
      namespace: 'input-namespace',
      name: 'input-name',
      payload: 'workflow input {}',
      documentation: 'input docs',
      synopsis: 'input synopsis',
      snapshotComment: 'input comment',
      entityType: 'Workflow',
    });
    expect(result).toEqual(mockMethodResponse);
  });
});
