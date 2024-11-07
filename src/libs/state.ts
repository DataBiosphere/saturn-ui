import { AnyPromiseFn, Atom, atom } from '@terra-ui-packages/core-utils';
import { UserManager } from 'oidc-client-ts';
import { AuthContextProps } from 'react-oidc-context';
import { AuthTokenState } from 'src/auth/auth';
import { OidcUser } from 'src/auth/oidc-broker';
import { Dataset } from 'src/libs/ajax/Catalog';
import { EcmLinkAccountResponse } from 'src/libs/ajax/ExternalCredentials';
import { Snapshot } from 'src/libs/ajax/methods/methods-models';
import { OidcConfig } from 'src/libs/ajax/OAuth2';
import { SamTermsOfServiceConfig } from 'src/libs/ajax/TermsOfService';
import { NihDatasetPermission, SamUserAllowances, SamUserAttributes, SamUserResponse } from 'src/libs/ajax/User';
import { getLocalStorage, getSessionStorage, staticStorageSlot } from 'src/libs/browser-storage';
import type { WorkspaceInfo, WorkspaceWrapper } from 'src/workspaces/utils';

export const routeHandlersStore = atom<unknown[]>([]);

export interface SystemState {
  termsOfServiceConfig: SamTermsOfServiceConfig;
}

/**
This store is for keeping track of static system properties
which are not expected to change during the apps lifecycle
 */
export const systemStore: Atom<SystemState> = atom<SystemState>({
  termsOfServiceConfig: {
    enforced: false,
    currentVersion: '',
    inRollingAcceptanceWindow: false,
  },
});

export interface TermsOfServiceStatus {
  permitsSystemUsage: boolean | undefined;
  isCurrentVersion: boolean | undefined;
}

export interface NihStatus {
  linkedNihUsername: string;
  linkExpireTime: number;
  datasetPermissions: NihDatasetPermission[];
}

export type Initializable<T> = T | 'uninitialized';

export type SignInStatusState =
  // The user has signed in via B2C, but information has not yet been loaded from Sam.
  | 'authenticated'
  // The user has signed in via B2C, but does not exist in Sam.
  | 'unregistered'
  // The user has signed in via B2C and their information has been loaded from Sam.
  | 'userLoaded'
  // The user is not signed in via B2C.
  | 'signedOut';

export type SignInStatus = Initializable<SignInStatusState>;

export interface OAuth2AccountStatus {
  [key: string]: EcmLinkAccountResponse;
}

export interface AuthState {
  cookiesAccepted: boolean | undefined;
  oAuth2AccountStatus: OAuth2AccountStatus;
  hasGcpBillingScopeThroughB2C: boolean | undefined;
  signInStatus: SignInStatus;
  userJustSignedIn: boolean;
  isTimeoutEnabled?: boolean | undefined;
  nihStatus?: NihStatus;
  nihStatusLoaded: boolean;
  termsOfService: TermsOfServiceStatus;
  terraUserAllowances: SamUserAllowances;
}

/**
 * The authStore is for keeping track of properties which allow the user to access different part of the app.
 */
export const authStore: Atom<AuthState> = atom<AuthState>({
  cookiesAccepted: undefined,
  oAuth2AccountStatus: {},
  hasGcpBillingScopeThroughB2C: false,
  signInStatus: 'uninitialized',
  userJustSignedIn: false,
  nihStatusLoaded: false,
  termsOfService: {
    permitsSystemUsage: undefined,
    isCurrentVersion: undefined,
  },
  terraUserAllowances: {
    allowed: false,
    details: {
      enabled: false,
      termsOfService: false,
    },
  },
});

export interface TerraUser {
  token?: string | undefined;
  scope?: string | undefined;
  id?: string | undefined;
  email?: string | undefined;
  name?: string | undefined;
  givenName?: string | undefined;
  familyName?: string | undefined;
  imageUrl?: string | undefined;
  idp?: string | undefined;
}

export interface TerraUserProfile {
  // TODO: anonymousGroup is here from getProfile from orch
  // TODO: for future ticket, separate items updated via register/profile (personal info)
  //  from things that are updated via api/profile/preferences (starred workspaces, notification settings)
  firstName: string | undefined;
  lastName: string | undefined;
  institute: string | undefined;
  contactEmail: string | undefined;
  title: string | undefined;
  department: string | undefined;
  interestInTerra: string | undefined;
  programLocationCity?: string;
  programLocationState?: string;
  programLocationCountry?: string;
  researchArea?: string;
  starredWorkspaces?: string;
}

export interface TerraUserState {
  profile: TerraUserProfile;
  terraUser: TerraUser;
  terraUserAttributes: SamUserAttributes;
  enterpriseFeatures: string[];
  samUser: SamUserResponse;
}

/**
 * The userStore is for keeping track of user data which may be updated by the user.
 */
export const userStore: Atom<TerraUserState> = atom<TerraUserState>({
  profile: {
    firstName: undefined,
    lastName: undefined,
    contactEmail: undefined,
    title: undefined,
    institute: undefined,
    department: undefined,
    programLocationCity: undefined,
    programLocationState: undefined,
    programLocationCountry: undefined,
    interestInTerra: undefined,
    starredWorkspaces: undefined,
  },
  terraUser: {
    token: undefined,
    scope: undefined,
    id: undefined,
    email: undefined,
    name: undefined,
    givenName: undefined,
    familyName: undefined,
    imageUrl: undefined,
    idp: undefined,
  },
  terraUserAttributes: {
    marketingConsent: true,
  },
  enterpriseFeatures: [],
  samUser: {
    id: undefined,
    googleSubjectId: undefined,
    email: undefined,
    azureB2CId: undefined,
    allowed: undefined,
    createdAt: undefined,
    registeredAt: undefined,
    updatedAt: undefined,
  },
});

export const getTerraUser = (): TerraUser => userStore.get().terraUser;

export const getTerraUserProfile = (): TerraUserProfile => userStore.get().profile;

export interface TokenMetadata {
  token: string | undefined; // do not log or send this to mixpanel
  id: string | undefined;
  createdAt: number;
  expiresAt: number;
  totalTokensUsedThisSession: number;
  totalTokenLoadAttemptsThisSession: number;
}

export interface MetricState {
  anonymousId: string | undefined;
  authTokenMetadata: TokenMetadata;
  refreshTokenMetadata: TokenMetadata;
  sessionId?: string | undefined;
  sessionStartTime: number;
}

/**
 * The metricStore is for keeping track of data that is purely inteded on being collected for metrics
 * and does not control any logic of the app except for logic which strictly pertains to metric collection.
 */
export const metricStore: Atom<MetricState> = atom<MetricState>({
  anonymousId: undefined,
  authTokenMetadata: {
    token: undefined,
    id: undefined,
    createdAt: -1,
    expiresAt: -1,
    totalTokenLoadAttemptsThisSession: 0,
    totalTokensUsedThisSession: 0,
  },
  refreshTokenMetadata: {
    token: undefined,
    id: undefined,
    createdAt: -1,
    expiresAt: -1,
    totalTokenLoadAttemptsThisSession: 0,
    totalTokensUsedThisSession: 0,
  },
  sessionId: undefined,
  sessionStartTime: -1,
});

export const getSessionId = () => metricStore.get().sessionId;

export interface OidcState {
  authContext: AuthContextProps | undefined;
  authTokenState: AuthTokenState | undefined;
  user: OidcUser | undefined;
  userManager: UserManager | undefined;
  config: OidcConfig;
}

/**
 * The oidcStore is for keeping track of data which is obtained from our OAuth2 provider and
 * any data we keep track of as part of the oidc-client library we use.
 */
export const oidcStore: Atom<OidcState> = atom<OidcState>({
  authContext: undefined,
  authTokenState: undefined,
  user: undefined,
  userManager: undefined,
  config: {
    authorityEndpoint: undefined,
    clientId: undefined,
  },
});

export const cookieReadyStore = atom(false);
export const azureCookieReadyStore = atom({
  readyForRuntime: false,
  readyForApp: false,
});

export const lastActiveTimeStore = staticStorageSlot(getLocalStorage(), 'idleTimeout');
lastActiveTimeStore.update((v) => v || {});

export const toggleStateAtom = staticStorageSlot(getSessionStorage(), 'toggleState');
toggleStateAtom.update((v) => v || { notebooksTab: true });

export const notificationStore = atom<any[]>([]);

export const contactUsActive = atom(false);

export type InitializedWorkspaceWrapper = WorkspaceWrapper & { workspaceInitialized: boolean };

export const workspaceStore = atom<InitializedWorkspaceWrapper | undefined>(undefined);

export const workspacesStore = atom<WorkspaceWrapper[]>([]);

export const cloningWorkspacesStore = atom<WorkspaceInfo[]>([]);

export const rerunFailuresStatus = atom<unknown>(undefined);

export const errorNotifiedRuntimes = atom<number[]>([]);

export const errorNotifiedApps = atom<string[]>([]);

export const knownBucketRequesterPaysStatuses = atom({});

export const requesterPaysProjectStore = atom<string | undefined>(undefined);

export const workflowSelectionStore = atom({
  key: undefined,
  entityType: undefined,
  entities: undefined,
});

export type GCPAsyncImportJob = {
  jobId: string;
  targetWorkspace: {
    namespace: string;
    name: string;
  };
};

export type AzureAsyncImportJob = {
  jobId: string;
  targetWorkspace: {
    namespace: string;
    name: string;
  };
  wdsProxyUrl: string;
};

export type AsyncImportJob = AzureAsyncImportJob | GCPAsyncImportJob;

export const asyncImportJobStore = atom<AsyncImportJob[]>([]);

export const snapshotsListStore = atom<Snapshot[] | undefined>(undefined);

export const snapshotStore = atom<Snapshot>({
  createDate: '',
  entityType: '',
  managers: [],
  name: '',
  namespace: '',
  payload: '',
  public: undefined,
  snapshotComment: '',
  snapshotId: 0,
  synopsis: '',
  url: '',
});

export const dataCatalogStore = atom<Dataset[]>([]);

export type AjaxOverride = {
  fn: (fetch: AnyPromiseFn) => AnyPromiseFn;
  filter:
    | {
        url: RegExp;
        method?: string;
      }
    | ((...args: any[]) => boolean);
};

declare global {
  interface Window {
    ajaxOverridesStore: Atom<AjaxOverride[]>;
    configOverridesStore: any;
  }
}

/*
 * Modifies ajax responses for testing purposes.
 * Can be set to an array of objects of the form { fn, filter }.
 * The fn should be a fetch wrapper (oldFetch => newFetch) that modifies the request process. (See ajaxOverrideUtils)
 * If present, filter should be a RegExp that is matched against the url to target specific requests.
 */
export const ajaxOverridesStore = atom<AjaxOverride[]>([]);
window.ajaxOverridesStore = ajaxOverridesStore;

/*
 * Modifies config settings for testing purposes.
 * Can be set to an object which will be merged with the loaded config object.
 */
export const configOverridesStore = staticStorageSlot(getSessionStorage(), 'config-overrides');
window.configOverridesStore = configOverridesStore;

// enum for status of app proxy url
export const AppProxyUrlStatus = Object.freeze({
  None: 'None',
  Ready: 'Ready',
  Error: 'Error',
});

/*
 * Stores the proxy urls for WDS and Azure Workflows apps for a workspace.
 * Status can be one of None, Ready and Error. The proxy url will be in 'state' field when 'status' is Ready.
 * When 'state' is Error the 'state' field will contain the error that was returned from Leo (if any).
 */
export const workflowsAppStore = atom({
  workspaceId: undefined,
  wdsProxyUrlState: { status: AppProxyUrlStatus.None, state: '' },
  cbasProxyUrlState: { status: AppProxyUrlStatus.None, state: '' },
  cromwellProxyUrlState: { status: AppProxyUrlStatus.None, state: '' },
});
