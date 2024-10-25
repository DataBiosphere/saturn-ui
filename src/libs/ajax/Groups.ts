import { jsonBody } from '@terra-ui-packages/data-client-core';
import _ from 'lodash/fp';
import { authOpts } from 'src/auth/auth-session';
import { fetchSam } from 'src/libs/ajax/ajax-common';
import { SupportSummary } from 'src/support/SupportResourceType';

export type GroupRole = 'admin' | 'member';

export interface CurrentUserGroupMembership {
  groupEmail: string;
  groupName: string;
  role: GroupRole;
}

export const Groups = (signal?: AbortSignal) => ({
  list: async (): Promise<CurrentUserGroupMembership[]> => {
    const res = await fetchSam('api/groups/v1', _.merge(authOpts(), { signal }));
    return res.json();
  },

  group: (groupName: string) => {
    const root = `api/groups/v1/${groupName}`;
    const resourceRoot = `api/resources/v1/managed-group/${groupName}`;

    const addRole = (role: GroupRole, email: string): Promise<void> => {
      return fetchSam(`${root}/${role}/${encodeURIComponent(email)}`, _.merge(authOpts(), { signal, method: 'PUT' }));
    };

    const removeRole = (role: GroupRole, email: string): Promise<void> => {
      return fetchSam(
        `${root}/${role}/${encodeURIComponent(email)}`,
        _.merge(authOpts(), { signal, method: 'DELETE' })
      );
    };

    return {
      create: (): Promise<void> => {
        return fetchSam(root, _.merge(authOpts(), { signal, method: 'POST' }));
      },

      delete: (): Promise<void> => {
        return fetchSam(root, _.merge(authOpts(), { signal, method: 'DELETE' }));
      },

      listAdmins: async (): Promise<string[]> => {
        const res = await fetchSam(`${root}/admin`, _.merge(authOpts(), { signal }));
        return res.json();
      },

      listMembers: async (): Promise<string[]> => {
        const res = await fetchSam(`${root}/member`, _.merge(authOpts(), { signal }));
        return res.json();
      },

      addUser: (roles: GroupRole[], email: string): Promise<void[]> => {
        return Promise.all(_.map((role) => addRole(role, email), roles));
      },

      removeUser: (roles: GroupRole[], email: string): Promise<void[]> => {
        return Promise.all(_.map((role) => removeRole(role, email), roles));
      },

      changeUserRoles: async (email: string, oldRoles: GroupRole[], newRoles: GroupRole[]): Promise<void[] | void> => {
        if (!_.isEqual(oldRoles, newRoles)) {
          await Promise.all(_.map((role: GroupRole) => addRole(role, email), _.difference(newRoles, oldRoles)));
          return Promise.all(_.map((role: GroupRole) => removeRole(role, email), _.difference(oldRoles, newRoles)));
        }
      },

      requestAccess: async (): Promise<void> => {
        await fetchSam(`${root}/requestAccess`, _.merge(authOpts(), { signal, method: 'POST' }));
      },

      getPolicy: async (policyName: string): Promise<boolean> => {
        const res = await fetchSam(`${resourceRoot}/policies/${policyName}/public`, _.merge(authOpts(), { signal }));
        return await res.json();
      },

      setPolicy: (policyName: string, value: boolean): Promise<void> => {
        return fetchSam(
          `${resourceRoot}/policies/${policyName}/public`,
          _.mergeAll([authOpts(), { signal, method: 'PUT' }, jsonBody(value)])
        );
      },

      isMember: async (): Promise<boolean> => {
        const res = await fetchSam(`${resourceRoot}/action/use`, _.merge(authOpts(), { signal }));
        return res.json();
      },

      // we could provide a more specific type here, but we don't use it and don't want to limit future additions
      getSupportSummary: async (): Promise<SupportSummary> => {
        const res = await fetchSam(`api/admin/v1/groups/${groupName}/supportSummary`, _.merge(authOpts(), { signal }));
        return res.json();
      },
    };
  },
});
export type GroupsContract = ReturnType<typeof Groups>;
export type GroupContract = ReturnType<GroupsContract['group']>;
