import { ExtraSigninRequestArgs, IdTokenClaims, User, UserManager, WebStorageStateStore } from 'oidc-client-ts';
import { AuthContextProps } from 'react-oidc-context';
import { getLocalStorage } from 'src/libs/browser-storage';
import { getConfig } from 'src/libs/config';
import { oidcStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';

// Our config for b2C claims are defined here: https://github.com/broadinstitute/terraform-ap-deployments/tree/master/azure/b2c/policies
// The standard b2C claims are defined here: https://learn.microsoft.com/en-us/azure/active-directory/develop/id-token-claims-reference
export interface B2cIdTokenClaims extends IdTokenClaims {
  email_verified?: boolean;
  idp?: string;
  idp_access_token?: string;
  tid?: string;
  ver?: string;
}

export interface OidcUser extends User {
  profile: B2cIdTokenClaims;
}

export const getOidcConfig = () => {
  const metadata = {
    authorization_endpoint: `${getConfig().orchestrationUrlRoot}/oauth2/authorize`,
    token_endpoint: `${getConfig().orchestrationUrlRoot}/oauth2/token`,
    end_session_endpoint: `${getConfig().orchestrationUrlRoot}/oauth2/logout`,
  };
  return {
    authority: `${getConfig().orchestrationUrlRoot}/oauth2/authorize`,
    // The clientId from oidcStore.config is not undefined, setup in initializeClientId on appLoad
    client_id: oidcStore.get().config.clientId!,
    popup_redirect_uri: `${window.origin}/redirect-from-oauth`,
    silent_redirect_uri: `${window.origin}/redirect-from-oauth-silent`,
    metadata,
    prompt: 'consent login',
    scope: 'openid email profile',
    stateStore: new WebStorageStateStore({ store: getLocalStorage() }),
    userStore: new WebStorageStateStore({ store: getLocalStorage() }),
    automaticSilentRenew: true,
    // Leo's setCookie interval is currently 5 min, set refresh auth then 5 min 30 seconds to guarantee that setCookie's token won't expire between 2 setCookie api calls
    accessTokenExpiringNotificationTimeInSeconds: 330,
    includeIdTokenInSilentRenew: true,
    includeIdTokenInSilentSignout: true,
    extraQueryParams: { access_type: 'offline' },
    redirect_uri: '', // this field is not being used currently, but is expected from UserManager
  };
};

export const initializeOidcUserManager = () => {
  const userManager: UserManager = new UserManager(getOidcConfig());
  oidcStore.update((state) => ({ ...state, userManager }));
};

// Instantiate a UserManager directly to populate the logged-in user at app initialization time.
// All other auth usage should use the AuthContext from oidcStore.
export const getCurrentOidcUser = async (): Promise<OidcUser | null> => {
  return oidcStore.get().userManager!.getUser();
};

export const getAuthInstance = (): AuthContextProps => {
  const authContext: AuthContextProps | undefined = oidcStore.get().authContext;
  if (authContext === undefined) {
    console.error('getAuthInstance must not be called before authContext is initialized.');
    throw new Error('Error initializing authentication.');
  }
  return authContext;
};

export const getSignInArgs = (includeBillingScope: boolean): ExtraSigninRequestArgs => {
  return Utils.cond(
    [!includeBillingScope, (): ExtraSigninRequestArgs => ({})],
    // For B2C use a dedicated policy endpoint configured for the GCP cloud-billing scope.
    (): ExtraSigninRequestArgs => ({
      extraQueryParams: { access_type: 'offline', p: getConfig().b2cBillingPolicy },
      extraTokenParams: { p: getConfig().b2cBillingPolicy },
    })
  );
};

/**
 * Args required for oidcSignIn
 * @popUp whether signIn is attempted with a popup, or silently in the background.
 * @includeBillingScope determines whether to include extra billing scope args in oidcSignIn
 */
export interface OidcSignInArgs {
  includeBillingScope: boolean;
  popUp: boolean;
}

export const oidcSignIn = async (args: OidcSignInArgs): Promise<OidcUser | null> => {
  const extraArgs: ExtraSigninRequestArgs = getSignInArgs(args.includeBillingScope);
  const authInstance: AuthContextProps = getAuthInstance();

  return args.popUp
    ? // returns Promise<OidcUser>, uses a fresh refresh token to get a new authToken
      authInstance.signinPopup(extraArgs)
    : // returns Promise<OidcUser | null>, attempts to use the refresh token to get a new authToken
      authInstance.signinSilent(extraArgs);
};

export const removeUserFromLocalState = async (): Promise<void> => {
  // send back auth instance, so we can use it for remove and clear stale state
  const auth: AuthContextProps = getAuthInstance();
  auth.removeUser();
  auth.clearStaleState();
};
