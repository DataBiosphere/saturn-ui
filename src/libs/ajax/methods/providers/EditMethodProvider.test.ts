import { asMockedFn, partial } from '@terra-ui-packages/test-utils';
import { Ajax, AjaxContract } from 'src/libs/ajax';
import { Methods, MethodsAjaxContract } from 'src/libs/ajax/methods/Methods';
import { MethodResponse } from 'src/libs/ajax/methods/methods-models';
import { editMethodProvider } from 'src/libs/ajax/methods/providers/EditMethodProvider';
import { oidcStore } from 'src/libs/state';

jest.mock('src/libs/ajax');
// jest.mock('src/auth/auth');
// jest.mock('src/libs/ajax/methods/Methods');
type MethodAjaxContract = MethodsAjaxContract['method'];

// type MethodsAjaxNeeds = MethodsAjaxContract['method'];

// const mockMethodsNeeds = (): MethodsAjaxNeeds => {
//   const partialMethods: MethodsAjaxNeeds = {
//     method: jest.fn().mockReturnValue({
//       createSnapshot: jest.fn(),
//     }),
//   };
//   asMockedFn(Methods).mockReturnValue(partial<MethodsAjaxContract>(partialMethods));
//
//   return partialMethods;
// };

// const mockMethodsNeeds = (): MethodsAjaxNeeds => {
// const partialMethods: MethodsAjaxNeeds = {
//   method: jest.fn((namespace, name, snapshotId) => {
//     return partial<ReturnType<MethodsAjaxContract>>({
//       createSnapshot: jest.fn(),
//     }) as MethodAjaxContract;
//   }),
// };
//   asMockedFn(Methods).mockReturnValue(partial<MethodsAjaxContract>(partialMethods));
//
//   return partialMethods;
// };
//
// const mockCreateSnapshotImpl = jest.fn().mockReturnValue(Promise.resolve(mockMethodResponse));
//
// interface AjaxMocks {
//   createSnapshotImpl?: jest.Mock;
// }
//
// const mockAjax = (mocks: AjaxMocks = {}) => {
//   const { createSnapshotImpl } = mocks;
//   const mockAjax: DeepPartial<AjaxContract> = {
//     Methods: {
//       method: jest.fn().mockReturnValue({
//         createSnapshot: createSnapshotImpl || mockCreateSnapshotImpl,
//       }),
//     },
//   };
//   asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract);
// };

// const mockAjax = () => {
//   asMockedFn(Methods).mockReturnValue({
//     method: {
//       createSnapshot: mockCreateSnapshotImpl,
//     },
//   } as DeepPartial<MethodsAjaxContract> as MethodsAjaxContract);
// };

// const mockCreateSnapshotImpl = jest.fn().mockReturnValue(Promise.resolve(mockMethodResponse));

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

// type MethodsExports = typeof import('src/libs/ajax/methods/Methods');
// const testFun = () => {
// asMockedFn(Methods).mockReturnValue({
//   method: jest.fn((namespace, name, id) => ({
//     createSnapshot: jest.fn().mockReturnValue(Promise.resolve(mockMethodResponse)),
//   })),
// });

// asMockedFn(Ajax).mockReturnValue({
//   Methods: {
//     method: jest.fn((namespace, name, id) => {
//       return partial<ReturnType<MethodAjaxContract>>({
//         createSnapshot: jest.fn().mockReturnValue(Promise.resolve(mockMethodResponse)),
//       });
//     }),
//   } as MethodsAjaxContract,
// });

// jest.mock('src/libs/ajax/methods/Methods', (): DeepPartial<MethodsExports> => {
//   return {
//     method: {
//       createSnapshot: jest.fn().mockReturnValue(Promise.resolve(mockMethodResponse)),
//     },
//   };
// });
// };

// const mockUser = (email: string): Partial<TerraUser> => ({ email });
//
// const mockUserState = (email: string): Partial<TerraUserState> => {
//   return { terraUser: mockUser(email) as TerraUser };
// };

jest.spyOn(oidcStore, 'get').mockImplementation(
  jest.fn().mockReturnValue({
    userManager: { getUser: jest.fn() },
  })
);

const mockAjax = () => {
  asMockedFn(Ajax).mockReturnValue({
    Methods: {
      method: jest.fn(() => {
        return partial<ReturnType<MethodAjaxContract>>({
          createSnapshot: jest.fn().mockReturnValue(mockMethodResponse),
        });
      }) as MethodAjaxContract,
    } as MethodsAjaxContract,
  } as AjaxContract);
};

// let mockCreateSnapshotImpl;
// type MethodsExports = typeof import('src/libs/ajax/methods/Methods');

describe('EditMethodProvider', () => {
  // beforeAll(() => {
  //   mockCreateSnapshotImpl = jest.fn().mockReturnValue(Promise.resolve(mockMethodResponse));
  //
  //   jest.mock('src/libs/ajax/methods/Methods', (): DeepPartial<MethodsExports> => {
  //     return {
  //       Methods: {
  //         method: {
  //           createSnapshot: mockCreateSnapshotImpl,
  //         },
  //       },
  //     };
  //   });
  // });

  it('handles create new snapshot call', async () => {
    // Arrange
    mockAjax();

    // set the user's email
    // jest.spyOn(userStore, 'get').mockImplementation(jest.fn().mockReturnValue(mockUserState('hello@world.org')));

    // testFun();
    // const methodsMock = mockMethodsNeeds();
    // asMockedFn(methodsMock.method.createSnapshot).mockResolvedValue(mockMethodResponse);
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
    expect(Ajax().Methods.method).toHaveBeenCalledWith('groot-namespace', 'groot-method', 3);
    expect(Ajax().Methods.method('groot-namespace', 'groot-method', 3).createSnapshot).toHaveBeenCalledWith({
      namespace: 'groot-namespace',
      name: 'groot-method',
      snapshotId: 3,
      redactPreviousSnapshot: true,
      payload: 'workflow myGreatWorkflow {}',
      documentation: 'documentation',
      synopsis: 'synopsis',
      snapshotComment: 'snapshot comment',
      entityType: 'Workflow',
    });
    expect(result).toEqual(mockMethodResponse);

    // expect(Methods).toBeCalledTimes(1);
    // expect(Methods).toBeCalledWith(signal);
    // expect(methodsMock.method.createSnapshot).toBeCalledTimes(1);
    // expect(methodsMock.method.createSnapshot).toBeCalledWith({
    //   namespace: 'groot-namespace',
    //   name: 'groot-method',
    //   snapshotId: 3,
    //   redactPreviousSnapshot: true,
    //   payload: 'workflow myGreatWorkflow {}',
    //   documentation: 'documentation',
    //   synopsis: 'synopsis',
    //   snapshotComment: 'snapshot comment',
    //   entityType: 'Workflow',
    // });
    // expect(result).toEqual(mockMethodResponse);
  });
});
