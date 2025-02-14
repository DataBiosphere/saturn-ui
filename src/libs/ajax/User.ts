import { jsonBody } from '@terra-ui-packages/data-client-core';
import _ from 'lodash/fp';
import { authOpts } from 'src/auth/auth-session';
import { fetchOrchestration, fetchSam } from 'src/libs/ajax/ajax-common';
import { SamUserTermsOfServiceDetails } from 'src/libs/ajax/TermsOfService';
import { TerraUserProfile } from 'src/libs/state';
import { SupportSummary } from 'src/support/SupportResourceType';

export interface SamUserRegistrationStatusResponse {
  userSubjectId: string;
  userEmail: string;
  enabled: boolean;
}

export interface SamUserAllowancesDetails {
  enabled: boolean;
  termsOfService: boolean;
}

export interface SamUserAllowances {
  allowed: boolean;
  details: SamUserAllowancesDetails;
}

export type TerraUserPreferences = {
  starredWorkspaces?: string;
} & {
  // These are the key value pairs from the workspace notification settings in the form of:
  // 'notifications/SuccessfulSubmissionNotification/${workspace.workspace.namespace}/${workspace.workspace.name}' : true
  // TODO for a follow-up ticket:
  //  Change this data structure to be an array of:
  //  {
  //    workspaceId: string,
  //    successfulSubmissionNotification: boolean,
  //    failedSubmissionNotification: boolean,
  //    abortedSubmissionNotification: boolean,
  //  }
  // and extract these values from the result inside profile.setPreferences
  [key: string]: string;
};

export interface OrchestrationUserProfileResponse {
  userId: string;
  keyValuePairs: { key: string; value: string }[];
}

// These types are marked as optional to be aligned with required fields for registration
export type CreateTerraUserProfileRequest = {
  firstName: string;
  lastName: string;
  title?: string;
  contactEmail: string;
  institute?: string;
  department?: string;
  interestInTerra?: string;
};

// These types are marked as optional to be aligned with required fields for updating the profile
export interface UpdateTerraUserProfileRequest extends CreateTerraUserProfileRequest {
  programLocationCity?: string;
  programLocationState?: string;
  programLocationCountry?: string;
  researchArea?: string;
}

export interface OrchestrationUpsertTerraUserProfileRequest {
  firstName: string;
  lastName: string;
  title: string;
  contactEmail?: string;
  institute: string;
  programLocationCity: string;
  programLocationState: string;
  programLocationCountry: string;
  termsOfService?: string;
  researchArea?: string;
  department?: string;
  interestInTerra?: string;
}

export const generateAPIBodyForCreateUserProfile = (
  request: CreateTerraUserProfileRequest
): OrchestrationUpsertTerraUserProfileRequest => {
  return generateAPIBodyForUpdateUserProfile(request);
};

export const generateAPIBodyForUpdateUserProfile = (
  request: UpdateTerraUserProfileRequest
): OrchestrationUpsertTerraUserProfileRequest => {
  return {
    // first name and last name are REQUIRED for this request, and they are populated from the oidc token claims,
    // so they should not be undefined
    firstName: request.firstName,
    lastName: request.lastName,

    // contact email is NOT REQUIRED for this request, but it is populated from the oidc token claims,
    // so it should not be undefined
    contactEmail: request.contactEmail!,

    // title and institute are REQUIRED for this request, but they do not necessarily
    // get set during registration
    title: _.isEmpty(request.title) ? 'N/A' : request.title,
    institute: _.isEmpty(request.institute) ? 'N/A' : request.institute,
    // department and interestedInTerra NOT REQUIRED for this request, and they do not necessarily
    // get set during registration
    department: !_.isEmpty(request.department) ? request.department : undefined,
    interestInTerra: !_.isEmpty(request.interestInTerra) ? request.interestInTerra : undefined,

    // program locations are REQUIRED for the request
    // but are not present during a registration. They could exist in setting profile
    programLocationCity: !_.isEmpty(request.programLocationCity) ? request.programLocationCity : 'N/A',
    programLocationState: !_.isEmpty(request.programLocationState) ? request.programLocationState : 'N/A',
    programLocationCountry: !_.isEmpty(request.programLocationCountry) ? request.programLocationCountry : 'N/A',

    // researchArea is NOT REQUIRED for this request,
    // but are not present during a registration. They could exist in setting profile
    researchArea: !_.isEmpty(request.researchArea) ? request.researchArea : undefined,
  };
};

/**
 * Orchestration's /register/profile endpoint returns profile attributes as an
 * array of { key, value } objects. This converts that array into single object.
 */
export const kvArrayToObject = (kvArray: { key: string; value: any }[] | undefined): Record<string, any> => {
  return Object.fromEntries((kvArray ?? []).map(({ key, value }) => [key, value]));
};

export interface OrchestrationUserPreferLegacyFireCloudResponse {
  preferTerra: boolean;
  preferTerraLastUpdated: number;
}

export interface NihDatasetPermission {
  name: string;
  authorized: boolean;
}

export interface OrchestrationNihStatusResponse {
  linkedNihUsername: string;
  datasetPermissions: NihDatasetPermission[];
  linkExpireTime: number;
}

export interface SamInviteUserResponse {
  userSubjectId: string;
  userEmail: string;
}

export interface SamUserResponse {
  id: string | undefined;
  googleSubjectId?: string;
  email: string | undefined;
  azureB2CId?: string;
  allowed: boolean | undefined;
  createdAt: Date | undefined;
  registeredAt: Date | undefined;
  updatedAt: Date | undefined;
}

export type SamUserAttributes = {
  marketingConsent: boolean;
};

export type SamUserAttributesRequest = {
  marketingConsent: boolean | undefined;
};

export type SamUserCombinedStateResponse = {
  samUser: SamUserResponse;
  terraUserAllowances: SamUserAllowances;
  terraUserAttributes: SamUserAttributes;
  termsOfService: SamUserTermsOfServiceDetails;
  enterpriseFeatures: string[];
};

export type OrchestrationUserRegistrationRequest = object;

export const User = (signal?: AbortSignal) => {
  return {
    getStatus: async (): Promise<SamUserRegistrationStatusResponse> => {
      const res = await fetchSam('register/user/v2/self/info', _.mergeAll([authOpts(), { signal }]));
      return res.json();
    },

    getUserAttributes: async (): Promise<SamUserAttributes> => {
      const res = await fetchSam('api/users/v2/self/attributes', _.mergeAll([authOpts(), { signal }]));
      return res.json().then((obj) => {
        const { userId: _, ...rest } = obj;
        return rest;
      });
    },

    setUserAttributes: async (userAttributes: SamUserAttributesRequest): Promise<SamUserAttributes> => {
      const res = await fetchSam(
        'api/users/v2/self/attributes',
        _.mergeAll([authOpts(), jsonBody(userAttributes), { signal, method: 'PATCH' }])
      );
      return res.json();
    },

    getSamUserCombinedState: async (): Promise<SamUserCombinedStateResponse> => {
      const res = await fetchSam('api/users/v2/self/combinedState', _.mergeAll([authOpts(), { signal }]));
      const responseJson = await res.json();
      const samUser: SamUserResponse = {
        id: responseJson.samUser.id,
        googleSubjectId: responseJson.samUser.googleSubjectId,
        email: responseJson.samUser.email,
        azureB2CId: responseJson.samUser.azureB2CId,
        allowed: responseJson.samUser.allowed,
        createdAt: responseJson.samUser.createdAt ? new Date(responseJson.samUser.createdAt) : undefined,
        registeredAt: responseJson.samUser.registeredAt ? new Date(responseJson.samUser.registeredAt) : undefined,
        updatedAt: responseJson.samUser.updatedAt ? new Date(responseJson.samUser.updatedAt) : undefined,
      };

      const terraUserAllowances: SamUserAllowances = responseJson.allowances;

      const terraUserAttributes: SamUserAttributes = { marketingConsent: responseJson.attributes.marketingConsent };

      const termsOfService: SamUserTermsOfServiceDetails = {
        latestAcceptedVersion: responseJson.termsOfServiceDetails.latestAcceptedVersion,
        acceptedOn: responseJson.termsOfServiceDetails.acceptedOn
          ? new Date(responseJson.termsOfServiceDetails.acceptedOn)
          : undefined,
        permitsSystemUsage: responseJson.termsOfServiceDetails.permitsSystemUsage,
        isCurrentVersion: responseJson.termsOfServiceDetails.isCurrentVersion,
      };

      const enterpriseFeatures = responseJson.additionalDetails.enterpriseFeatures
        ? responseJson.additionalDetails.enterpriseFeatures.resources.map((resource) => resource.resourceId)
        : [];

      return {
        samUser,
        terraUserAllowances,
        terraUserAttributes,
        termsOfService,
        enterpriseFeatures,
      };
    },

    registerWithProfile: async (
      acceptsTermsOfService: boolean,
      profile: CreateTerraUserProfileRequest
    ): Promise<SamUserResponse> => {
      // call orchestration and convert the response to json
      const res = await fetchOrchestration(
        'api/users/v1/registerWithProfile',
        _.mergeAll([
          authOpts(),
          jsonBody({ acceptsTermsOfService, profile: generateAPIBodyForCreateUserProfile(profile) }),
          { signal, method: 'POST' },
        ])
      );
      const json = await res.json();
      return {
        id: json.id,
        googleSubjectId: json.googleSubjectId,
        email: json.email,
        azureB2CId: json.azureB2CId,
        allowed: json.allowed,
        createdAt: json.createdAt ? new Date(json.createdAt) : undefined,
        registeredAt: json.registeredAt ? new Date(json.registeredAt) : undefined,
        updatedAt: json.updatedAt ? new Date(json.updatedAt) : undefined,
      };
    },

    profile: {
      get: async (): Promise<TerraUserProfile> => {
        const res = await fetchOrchestration('register/profile', _.merge(authOpts(), { signal }));
        const rawResponseJson: OrchestrationUserProfileResponse = await res.json();
        return kvArrayToObject(rawResponseJson.keyValuePairs) as TerraUserProfile;
      },

      update: async (request: UpdateTerraUserProfileRequest): Promise<void> => {
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForUpdateUserProfile(request);
        return fetchOrchestration(
          'register/profile',
          _.mergeAll([authOpts(), jsonBody(apiBody), { signal, method: 'POST' }])
        );
      },

      setPreferences: async (preferences: TerraUserPreferences): Promise<void> => {
        return fetchOrchestration(
          'api/profile/preferences',
          _.mergeAll([authOpts(), jsonBody(preferences), { signal, method: 'POST' }])
        );
      },

      preferLegacyFirecloud: async (): Promise<OrchestrationUserPreferLegacyFireCloudResponse> => {
        return fetchOrchestration('api/profile/terra', _.mergeAll([authOpts(), { signal, method: 'DELETE' }]));
      },
    },

    // Returns the proxy group email of the user with the given email
    getProxyGroup: async (email: string): Promise<string> => {
      const res = await fetchOrchestration(
        `api/proxyGroup/${encodeURIComponent(email)}`,
        _.merge(authOpts(), { signal })
      );
      return res.json();
    },

    getNihStatus: async (): Promise<OrchestrationNihStatusResponse | undefined> => {
      try {
        const res = await fetchOrchestration('api/nih/status', _.merge(authOpts(), { signal }));
        return res.json();
      } catch (error: unknown) {
        if (error instanceof Response && error.status === 404) {
          return;
        }
        throw error;
      }
    },

    linkNihAccount: async (token: string): Promise<OrchestrationNihStatusResponse> => {
      const res = await fetchOrchestration(
        'api/nih/callback',
        _.mergeAll([authOpts(), jsonBody({ jwt: token }), { signal, method: 'POST' }])
      );
      return res.json();
    },

    unlinkNihAccount: async (): Promise<void> => {
      await fetchOrchestration('api/nih/account', _.mergeAll([authOpts(), { signal, method: 'DELETE' }]));
    },

    isUserRegistered: async (email: string): Promise<boolean> => {
      try {
        await fetchSam(`api/users/v1/${encodeURIComponent(email)}`, _.merge(authOpts(), { signal, method: 'GET' }));
      } catch (error: unknown) {
        if (error instanceof Response && error.status === 404) {
          return false;
        }
        throw error;
      }
      return true;
    },

    inviteUser: async (email: string): Promise<SamInviteUserResponse> => {
      return fetchSam(
        `api/users/v1/invite/${encodeURIComponent(email)}`,
        _.merge(authOpts(), { signal, method: 'POST' })
      );
    },

    getSupportSummary: async (email: string): Promise<SupportSummary> => {
      const res = await fetchSam(
        `api/admin/v1/user/email/${email}/supportSummary?groupsContributingToMostMembershipsLimit=10`,
        _.merge(authOpts(), { signal })
      );
      return res.json();
    },
  };
};

export type UserContract = ReturnType<typeof User>;
export type UserProfileContract = UserContract['profile'];
