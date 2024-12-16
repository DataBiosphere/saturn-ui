import { asMockedFn, partial } from '@terra-ui-packages/test-utils';
import { Methods, MethodsAjaxContract } from 'src/libs/ajax/methods/Methods';
import {
  namespacePermissionsProvider,
  snapshotPermissionsProvider,
} from 'src/libs/ajax/methods/providers/PermissionsProvider';
import { WorkflowsPermissions } from 'src/workflows/methods/workflows-acl-utils';

jest.mock('src/libs/ajax/methods/Methods');

const mockPermissions: WorkflowsPermissions = [
  {
    role: 'OWNER',
    user: 'groot@gmail.com',
  },
  {
    role: 'READER',
    user: 'rocket.racoon@gmail.com',
  },
];

const updatedMockPermissions: WorkflowsPermissions = [
  {
    role: 'OWNER',
    user: 'groot@gmail.com',
  },
  {
    role: 'OWNER',
    user: 'rocket.racoon@gmail.com',
  },
];

type MethodsNamespaceAjaxNeeds = Pick<MethodsAjaxContract, 'getNamespacePermissions' | 'setNamespacePermissions'>;

const mockSnapshotAjax = () => {
  const mockGetSnapshotPermissions = jest.fn().mockReturnValue(mockPermissions);
  const mockSetSnapshotPermissions = jest.fn().mockReturnValue(updatedMockPermissions);
  asMockedFn(Methods).mockReturnValue({
    method: jest.fn(() => {
      return partial<ReturnType<MethodsAjaxContract['method']>>({
        permissions: mockGetSnapshotPermissions,
        setPermissions: mockSetSnapshotPermissions,
      });
    }) as MethodsAjaxContract['method'],
  } as MethodsAjaxContract);
};

const mockNamespaceAjax = (): MethodsNamespaceAjaxNeeds => {
  const partialMethods: MethodsNamespaceAjaxNeeds = {
    getNamespacePermissions: jest.fn().mockReturnValue(mockPermissions),
    setNamespacePermissions: jest.fn().mockReturnValue(updatedMockPermissions),
  };
  asMockedFn(Methods).mockReturnValue(partial<MethodsAjaxContract>(partialMethods));

  return partialMethods;
};

describe('PermissionsProvider', () => {
  it('handles get snapshot permissions call', async () => {
    // Arrange
    mockSnapshotAjax();
    const signal = new window.AbortController().signal;

    // Act
    const result = await snapshotPermissionsProvider.getPermissions('groot-namespace', 'groot-method', 3, { signal });

    // Assert
    expect(Methods).toBeCalledTimes(1);
    expect(Methods().method).toHaveBeenCalledWith('groot-namespace', 'groot-method', 3);
    expect(Methods().method('groot-namespace', 'groot-method', 3).permissions).toHaveBeenCalled();
    expect(result).toEqual(mockPermissions);
  });

  it('handles set snapshot permissions call', async () => {
    // Arrange
    mockSnapshotAjax();
    const signal = new window.AbortController().signal;

    // Act
    const result = await snapshotPermissionsProvider.updatePermissions(
      'groot-namespace',
      [
        {
          role: 'OWNER',
          user: 'rocket.racoon@gmail.com',
        },
      ],
      'groot-method',
      3,
      { signal }
    );

    // Assert
    expect(Methods).toBeCalledTimes(1);
    expect(Methods().method).toHaveBeenCalledWith('groot-namespace', 'groot-method', 3);
    expect(Methods().method('groot-namespace', 'groot-method', 3).setPermissions).toHaveBeenCalledWith([
      {
        role: 'OWNER',
        user: 'rocket.racoon@gmail.com',
      },
    ]);
    expect(result).toEqual(updatedMockPermissions);
  });

  it('handles get namespace permissions call', async () => {
    // Arrange
    mockNamespaceAjax();
    const signal = new window.AbortController().signal;

    // Act
    const result = await namespacePermissionsProvider.getPermissions('groot-namespace', 'groot-method', 3, { signal });

    // Assert
    expect(Methods).toBeCalledTimes(1);
    expect(Methods().getNamespacePermissions).toHaveBeenCalledWith('groot-namespace');
    expect(result).toEqual(mockPermissions);
  });

  it('handles set namespace permissions call', async () => {
    // Arrange
    mockNamespaceAjax();
    const signal = new window.AbortController().signal;

    // Act
    const result = await namespacePermissionsProvider.updatePermissions(
      'groot-namespace',
      [
        {
          role: 'OWNER',
          user: 'rocket.racoon@gmail.com',
        },
      ],
      undefined,
      undefined,
      { signal }
    );

    // Assert
    expect(Methods).toBeCalledTimes(1);
    expect(Methods().setNamespacePermissions).toHaveBeenCalledWith('groot-namespace', [
      {
        role: 'OWNER',
        user: 'rocket.racoon@gmail.com',
      },
    ]);
    expect(result).toEqual(updatedMockPermissions);
  });
});
