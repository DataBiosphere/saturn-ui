import { getConfig } from 'src/libs/config';

export type OAuth2ProviderKey = 'github' | 'ras' | 'fence' | 'dcf-fence' | 'kids-first' | 'anvil';
export type OAuth2Callback =
  | { name: 'oauth-callback'; link: 'oauth_callback' }
  | { name: 'ecm-callback'; link: 'ecm-callback' }
  | { name: 'fence-callback'; link: '#fence-callback' };

export type OAuth2Provider = {
  key: OAuth2ProviderKey;
  name: string;
  short: string;
  queryParams: {
    scopes?: string[];
    redirectUri: string;
  };
  supportsAccessToken: boolean;
  supportsIdToken: boolean;
};

const createRedirectUri = (callback: OAuth2Callback['link']) => {
  return `${window.location.hostname === 'localhost' ? getConfig().devUrlRoot : window.location.origin}/${callback}`;
};
export const oauth2Provider = (providerKey: OAuth2ProviderKey): OAuth2Provider => {
  switch (providerKey) {
    case 'github':
      return {
        key: providerKey,
        name: 'GitHub',
        short: 'GitHub',
        queryParams: {
          redirectUri: createRedirectUri('oauth_callback'),
        },
        supportsAccessToken: true,
        supportsIdToken: false,
      };
    case 'ras':
      return {
        key: providerKey,
        name: 'RAS',
        short: 'RAS',
        queryParams: {
          scopes: ['openid', 'email', 'ga4gh_passport_v1'],
          redirectUri: createRedirectUri('ecm-callback'),
        },
        supportsAccessToken: false,
        supportsIdToken: false, // turning off clipboard copying for now.
      };
    case 'fence':
      return {
        key: providerKey,
        name: 'NHLBI BioData Catalyst Framework Services',
        short: 'NHLBI',
        queryParams: {
          redirectUri: createRedirectUri('#fence-callback'),
        },
        supportsAccessToken: true,
        supportsIdToken: false,
      };
    case 'dcf-fence':
      return {
        key: providerKey,
        name: 'NCI CRDC Framework Services',
        short: 'NCI',
        queryParams: {
          redirectUri: createRedirectUri('#fence-callback'),
        },
        supportsAccessToken: true,
        supportsIdToken: false,
      };
    case 'kids-first':
      return {
        key: providerKey,
        name: 'Kids First DRC Framework Services',
        short: 'Kids First',
        queryParams: {
          redirectUri: createRedirectUri('#fence-callback'),
        },
        supportsAccessToken: true,
        supportsIdToken: false,
      };
    case 'anvil':
      return {
        key: providerKey,
        name: 'NHGRI AnVIL Data Commons Framework Services',
        short: 'AnVIL',
        queryParams: {
          redirectUri: createRedirectUri('#fence-callback'),
        },
        supportsAccessToken: true,
        supportsIdToken: false,
      };
    default:
      throw new Error(`Unknown OAuth2 provider key: ${providerKey}`);
  }
};
