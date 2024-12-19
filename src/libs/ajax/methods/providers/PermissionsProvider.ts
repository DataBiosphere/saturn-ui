import { AbortOption } from '@terra-ui-packages/data-client-core';
import { Methods } from 'src/libs/ajax/methods/Methods';
import { MethodConfigACL } from 'src/libs/ajax/methods/methods-models';

export interface PermissionsProvider {
  getPermissions: (methodNamespace: string, options?: AbortOption) => Promise<MethodConfigACL>;
  updatePermissions: (
    methodNamespace: string,
    updatedPermissions: MethodConfigACL,
    options?: AbortOption
  ) => Promise<MethodConfigACL>;
}

/**
 * Permissions provider to fetch and update the namespace permissions in Broad Methods Repository
 */
export const namespacePermissionsProvider: PermissionsProvider = {
  getPermissions: async (methodNamespace: string, options: AbortOption = {}): Promise<MethodConfigACL> => {
    const { signal } = options;
    return await Methods(signal).getNamespacePermissions(methodNamespace);
  },

  updatePermissions: async (
    methodNamespace: string,
    updatedPermissions: MethodConfigACL,
    options: AbortOption = {}
  ): Promise<MethodConfigACL> => {
    const { signal } = options;
    return await Methods(signal).setNamespacePermissions(methodNamespace, updatedPermissions);
  },
};

/**
 * Permissions provider to fetch and update the method snapshot permissions in Broad Methods Repository
 */
export const snapshotPermissionsProvider = (methodName: string, snapshotId: number): PermissionsProvider => {
  return {
    getPermissions: async (methodNamespace: string, options: AbortOption = {}): Promise<MethodConfigACL> => {
      const { signal } = options;
      return await Methods(signal).method(methodNamespace, methodName, snapshotId).permissions();
    },
    updatePermissions: async (
      methodNamespace,
      updatedPermissions: MethodConfigACL,
      options: AbortOption = {}
    ): Promise<MethodConfigACL> => {
      const { signal } = options;
      return await Methods(signal).method(methodNamespace, methodName, snapshotId).setPermissions(updatedPermissions);
    },
  };
};
