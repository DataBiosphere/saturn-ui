import _ from 'lodash/fp';
import * as qs from 'qs';
import { authOpts } from 'src/auth/auth-session';
import { fetchEcm } from 'src/libs/ajax/ajax-common';
import { OAuth2Provider } from 'src/profile/external-identities/OAuth2Providers';

export interface EcmLinkAccountResponse {
  externalUserId: string;
  expirationTimestamp: Date;
  authenticated: boolean;
}
export const ExternalCredentials = (signal?: AbortSignal) => (oAuth2Provider: OAuth2Provider) => {
  const { key: providerKey, queryParams, supportsAccessToken, supportsIdToken } = oAuth2Provider;
  const oauthRoot = `api/oauth/v1/${providerKey}`;
  const oidcRoot = `api/oidc/v1/${providerKey}`;

  return {
    getAccountLinkStatus: async (): Promise<EcmLinkAccountResponse | undefined> => {
      try {
        const res = await fetchEcm(oauthRoot, _.merge(authOpts(), { signal }));
        const json = await res.json();
        return {
          externalUserId: json.externalUserId,
          expirationTimestamp: new Date(json.expirationTimestamp),
          authenticated: json.authenticated,
        };
      } catch (error: unknown) {
        if (error instanceof Response && error.status === 404) {
          return undefined;
        }
        throw error;
      }
    },
    getAuthorizationUrl: async (): Promise<string> => {
      const res = await fetchEcm(
        `${oauthRoot}/authorization-url?${qs.stringify(queryParams, { indices: false })}`,
        _.merge(authOpts(), { signal })
      );
      return res.text();
    },
    linkAccountWithAuthorizationCode: async (oauthcode: string, state: string): Promise<EcmLinkAccountResponse> => {
      const res = await fetchEcm(
        `${oauthRoot}/oauthcode?${qs.stringify(
          {
            ...queryParams,
            oauthcode,
            state,
          },
          { indices: false }
        )}`,
        _.merge(authOpts(), { signal, method: 'POST' })
      );
      const json = await res.json();
      return {
        externalUserId: json.externalUserId,
        expirationTimestamp: new Date(json.expirationTimestamp),
        authenticated: json.authenticated,
      };
    },
    unlinkAccount: async (): Promise<void> => {
      await fetchEcm(oauthRoot, _.merge(authOpts(), { signal, method: 'DELETE' }));
    },
    getAccessToken: async (): Promise<string> => {
      if (!supportsAccessToken) {
        throw new Error(`Provider ${providerKey} does not support access tokens`);
      }
      return await fetchEcm(`${oauthRoot}/access-token`, _.merge(authOpts(), { signal }));
    },
    getIdentityToken: async (): Promise<string> => {
      if (!supportsIdToken) {
        throw new Error(`Provider ${providerKey} does not support identity tokens`);
      }
      const res = await fetchEcm(`${oidcRoot}/passport`, _.merge(authOpts(), { signal }));
      return res.text();
    },
  };
};

export type ExternalCredentialsContract = ReturnType<ReturnType<typeof ExternalCredentials>>;
