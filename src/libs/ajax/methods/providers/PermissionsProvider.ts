import { AbortOption } from '@terra-ui-packages/data-client-core';
import { Methods } from 'src/libs/ajax/methods/Methods';
import { MethodConfigACL } from 'src/libs/ajax/methods/methods-models';

export interface PermissionsProvider {
  getPermissions: (
    namespace: string,
    name?: string,
    snapshotId?: number,
    options?: AbortOption
  ) => Promise<MethodConfigACL>;
  updatePermissions: (
    namespace: string,
    updatedPermissions: MethodConfigACL,
    name?: string,
    snapshotId?: number,
    options?: AbortOption
  ) => Promise<MethodConfigACL>;
}

/**
 * Permissions provider to fetch and update the namespace permissions in Broad Methods Repository
 */
export const namespacePermissionsProvider: PermissionsProvider = {
  getPermissions: async (
    namespace: string,
    _name?: string,
    _snapshotId?: number,
    options: AbortOption = {}
  ): Promise<MethodConfigACL> => {
    const { signal } = options;
    return await Methods(signal).getNamespacePermissions(namespace);
  },

  updatePermissions: async (
    namespace: string,
    updatedPermissions: MethodConfigACL,
    _name?: string,
    _snapshotId?: number,
    options: AbortOption = {}
  ): Promise<MethodConfigACL> => {
    const { signal } = options;
    return await Methods(signal).setNamespacePermissions(namespace, updatedPermissions);
  },
};

/**
 * Permissions provider to fetch and update the method snapshot permissions in Broad Methods Repository
 */
export const snapshotPermissionsProvider: PermissionsProvider = {
  getPermissions: async (
    namespace: string,
    name?: string,
    snapshotId?: number,
    options: AbortOption = {}
  ): Promise<MethodConfigACL> => {
    const { signal } = options;
    return await Methods(signal).method(namespace, name, snapshotId).permissions();
  },
  updatePermissions: async (
    namespace,
    updatedPermissions: MethodConfigACL,
    name?: string,
    snapshotId?: number,
    options: AbortOption = {}
  ): Promise<MethodConfigACL> => {
    const { signal } = options;
    return await Methods(signal).method(namespace, name, snapshotId).setPermissions(updatedPermissions);
  },
};
