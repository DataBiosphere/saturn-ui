import { jsonBody } from '@terra-ui-packages/data-client-core';
import _ from 'lodash/fp';
import { authOpts } from 'src/auth/auth-session';
import { fetchSam } from 'src/libs/ajax/ajax-common';
import { appIdentifier } from 'src/libs/ajax/fetch/fetch-core';

type RequesterPaysProject = undefined | string;

export interface FullyQualifiedResourceId {
  resourceTypeName: string;
  resourceId: string;
}

export const SamResources = (signal?: AbortSignal) => ({
  leave: (samResourceType, samResourceId): Promise<void> =>
    fetchSam(
      `api/resources/v2/${samResourceType}/${samResourceId}/leave`,
      _.mergeAll([authOpts(), appIdentifier, { method: 'DELETE' }])
    ),
  getRequesterPaysSignedUrl: async (
    gsPath: string,
    requesterPaysProject: RequesterPaysProject = undefined
  ): Promise<string> => {
    const res = await fetchSam(
      'api/google/v1/user/signedUrlForBlob',
      _.mergeAll([jsonBody({ gsPath, requesterPaysProject }), authOpts(), appIdentifier, { signal, method: 'POST' }])
    );
    return res.json();
  },

  getSignedUrl: async (
    bucket: string,
    object: string,
    requesterPaysProject: RequesterPaysProject = undefined
  ): Promise<string> => {
    return SamResources(signal).getRequesterPaysSignedUrl(`gs://${bucket}/${object}`, requesterPaysProject);
  },

  getResourcePolicies: async (fqResourceId: FullyQualifiedResourceId): Promise<object> => {
    const res = await fetchSam(
      `api/admin/v1/resources/${fqResourceId.resourceTypeName}/${fqResourceId.resourceId}/policies`,
      _.mergeAll([authOpts(), appIdentifier])
    );
    return res.json();
  },

  getAuthDomains: async (fqResourceId: FullyQualifiedResourceId): Promise<string[]> => {
    return fetchSam(
      `api/resources/v2/${fqResourceId.resourceTypeName}/${fqResourceId.resourceId}/authDomain`,
      _.mergeAll([authOpts(), { signal }])
    ).then((r) => r.json());
  },

  canDelete: async (fqResourceId: FullyQualifiedResourceId): Promise<boolean> => {
    return fetchSam(
      `api/resources/v2/${fqResourceId.resourceTypeName}/${fqResourceId.resourceId}/action/delete`,
      _.mergeAll([authOpts(), { signal }])
    ).then((r) => r.json());
  },
});

export type SamResourcesContract = ReturnType<typeof SamResources>;
