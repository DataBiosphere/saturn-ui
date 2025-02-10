import { sessionExpirationErrorMessage } from 'src/auth/auth-errors';
import { removeUserFromLocalState } from 'src/auth/oidc-broker';
import { signOutCallbackLinkName } from 'src/auth/signout/SignOutPage';
import { leoCookieProvider } from 'src/libs/ajax/leonardo/providers/LeoCookieProvider';
import { Metrics } from 'src/libs/ajax/Metrics';
import { getSessionStorage } from 'src/libs/browser-storage';
import Events, { MetricsEventName } from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import { notify, sessionExpirationProps } from 'src/libs/notifications';
import { azureCookieReadyStore, cookieReadyStore } from 'src/libs/state';
import { authStore, MetricState, metricStore, oidcStore, TokenMetadata, userStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { DEFAULT, getTimestampMetricLabel, switchCase } from 'src/libs/utils';

export type SignOutCause =
  | 'requested'
  | 'disabled'
  | 'declinedTos'
  | 'errorRefreshingAuthToken'
  | 'idleStatusMonitor'
  | 'unspecified';

export type SignOutRedirect = {
  name: string;
  query: Record<string, string>;
  params: Record<string, string>;
};

type SignOutState = {
  signOutRedirect: SignOutRedirect;
  signOutCause: SignOutCause;
};

export const signOut = (signOutCause: SignOutCause = 'unspecified'): void => {
  // sendSignOutMetrics should _not_ be awaited. It's fire-and-forget, and we don't want to block the user's signout
  sendSignOutMetrics(signOutCause);
  doSignOut(signOutCause);
};

// exported for unit tests only
export const doSignOut = async (signOutCause: SignOutCause = 'unspecified'): Promise<void> => {
  await leoCookieProvider.unsetCookies();
  try {
    const userManager = oidcStore.get().userManager;
    const redirectUrl = `${Nav.getWindowOrigin()}${Nav.getPath(signOutCallbackLinkName)}`;
    // This will redirect to the logout callback page, which calls `userSignedOut` and then redirects to the homepage.
    const { name, query, params }: SignOutRedirect = Nav.getCurrentRoute();
    const signOutState: SignOutState = { signOutRedirect: { name, query, params }, signOutCause };
    const encodedState = btoa(JSON.stringify(signOutState));
    const user = await userManager!.getUser();
    if (user) {
      userManager!.signoutRedirect({
        post_logout_redirect_uri: redirectUrl,
        extraQueryParams: { state: encodedState },
      });
    } else {
      userSignedOut(signOutCause, true);
    }
  } catch (e: unknown) {
    console.error('Signing out with B2C failed. Falling back on local signout', e);
    userSignedOut(signOutCause, true);
  }
};

const sendSignOutMetrics = async (cause: SignOutCause): Promise<void> => {
  const eventToFire: MetricsEventName = switchCase<SignOutCause, MetricsEventName>(
    cause,
    ['requested', () => Events.user.signOut.requested],
    ['disabled', () => Events.user.signOut.disabled],
    ['declinedTos', () => Events.user.signOut.declinedTos],
    ['errorRefreshingAuthToken', () => Events.user.signOut.errorRefreshingAuthToken],
    ['idleStatusMonitor', () => Events.user.signOut.idleStatusMonitor],
    ['unspecified', () => Events.user.signOut.unspecified],
    [DEFAULT, () => Events.user.signOut.unspecified]
  );
  const sessionEndTime: number = Date.now();
  const metricStoreState: MetricState = metricStore.get();
  const tokenMetadata: TokenMetadata = metricStoreState.authTokenMetadata;

  await Metrics().captureEvent(eventToFire, {
    sessionEndTime: Utils.makeCompleteDate(sessionEndTime),
    sessionDurationInSeconds:
      metricStoreState.sessionStartTime < 0 ? undefined : (sessionEndTime - metricStoreState.sessionStartTime) / 1000.0,
    authTokenCreatedAt: getTimestampMetricLabel(tokenMetadata.createdAt),
    authTokenExpiresAt: getTimestampMetricLabel(tokenMetadata.expiresAt),
    totalAuthTokensUsedThisSession: metricStoreState.authTokenMetadata.totalTokensUsedThisSession,
    totalAuthTokenLoadAttemptsThisSession: metricStoreState.authTokenMetadata.totalTokenLoadAttemptsThisSession,
  });
};

export const userSignedOut = (cause?: SignOutCause, redirectFailed = false) => {
  // At this point, we are guaranteed to not have a valid token, if the redirect succeeded.
  cookieReadyStore.reset();
  azureCookieReadyStore.reset();
  getSessionStorage().clear();

  if (cause === 'errorRefreshingAuthToken') {
    notify('info', sessionExpirationErrorMessage, sessionExpirationProps);
  }

  if (redirectFailed) {
    removeUserFromLocalState();
  }

  const { cookiesAccepted } = authStore.get();

  authStore.reset();
  authStore.update((state) => ({
    ...state,
    signInStatus: 'signedOut',
    // TODO: If allowed, this should be moved to the cookie store https://broadworkbench.atlassian.net/browse/ID-1172
    // Load whether a user has input a cookie acceptance in a previous session on this system,
    // or whether they input cookie acceptance previously in this session
    cookiesAccepted,
  }));
  oidcStore.update((state) => ({
    ...state,
    user: undefined,
  }));
  const anonymousId: string | undefined = metricStore.get().anonymousId;
  metricStore.reset();
  metricStore.update((state) => ({
    ...state,
    anonymousId,
  }));
  userStore.reset();
};
