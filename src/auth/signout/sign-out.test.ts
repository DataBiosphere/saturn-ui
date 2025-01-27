import { removeUserFromLocalState } from 'src/auth/oidc-broker';
import { doSignOut, signOut } from 'src/auth/signout/sign-out';
import { leoCookieProvider } from 'src/libs/ajax/leonardo/providers/LeoCookieProvider';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import Events from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import { goToPath } from 'src/libs/nav';
import { OidcState, oidcStore } from 'src/libs/state';
import { asMockedFn } from 'src/testing/test-utils';

jest.mock('src/auth/oidc-broker');

jest.mock('react-oidc-context');

jest.mock('src/libs/ajax/Metrics');

type LeoCookieProviderExports = typeof import('src/libs/ajax/leonardo/providers/LeoCookieProvider');
jest.mock(
  'src/libs/ajax/leonardo/providers/LeoCookieProvider',
  (): LeoCookieProviderExports => ({
    ...jest.requireActual('src/libs/ajax/leonardo/providers/LeoCookieProvider'),
    leoCookieProvider: {
      unsetCookies: jest.fn(async () => {}),
    },
  })
);

const currentRoute = {
  name: 'routeName',
  query: { a: 'a', b: 'b' },
  params: { foo: 'bar' },
};

type NavExports = typeof import('src/libs/nav');
jest.mock('src/libs/nav', (): NavExports => {
  return {
    ...jest.requireActual<NavExports>('src/libs/nav'),
    getPath: jest.fn().mockReturnValue('/signout'),
    goToPath: jest.fn(),
    getWindowOrigin: jest.fn(),
    getCurrentRoute: jest.fn().mockReturnValue(currentRoute),
  };
});

type StateExports = typeof import('src/libs/state');
jest.mock('src/libs/state', (): StateExports => {
  const state = jest.requireActual<StateExports>('src/libs/state');
  return {
    ...state,
    oidcStore: {
      ...state.oidcStore,
      get: jest.fn().mockReturnValue({
        userManager: {
          signoutRedirect: jest.fn(() => 'Default signOutRedirectFn'),
        },
      }),
    },
  };
});

describe('sign-out', () => {
  it('sends sign out metrics', async () => {
    // Arrange
    const captureEventFn = jest.fn();
    asMockedFn(Metrics).mockReturnValue({
      captureEvent: captureEventFn,
    } as Partial<MetricsContract> as MetricsContract);

    // Act
    signOut();
    // Assert
    expect(captureEventFn).toHaveBeenCalledWith(Events.user.signOut.unspecified, expect.any(Object));
  });
  it('sends sign out metrics with a specified event', async () => {
    // Arrange
    const captureEventFn = jest.fn();
    asMockedFn(Metrics).mockReturnValue({
      captureEvent: captureEventFn,
    } as Partial<MetricsContract> as MetricsContract);

    // Act
    signOut('idleStatusMonitor');
    // Assert
    expect(captureEventFn).toHaveBeenCalledWith(Events.user.signOut.idleStatusMonitor, expect.any(Object));
  });
  it('redirects to the signout callback page', async () => {
    // Arrange
    const unsetCookiesFn = jest.fn();
    const signOutRedirectFn = jest.fn();
    const hostname = 'https://mycoolhost.horse';
    const link = '/signout';
    const expectedState = btoa(JSON.stringify({ signOutRedirect: currentRoute, signOutCause: 'unspecified' }));
    asMockedFn(oidcStore.get).mockReturnValue({
      userManager: { signoutRedirect: signOutRedirectFn },
    } as unknown as OidcState);
    asMockedFn(leoCookieProvider.unsetCookies).mockImplementation(unsetCookiesFn);
    asMockedFn(Nav.getPath).mockReturnValue(link);
    asMockedFn(Nav.getWindowOrigin).mockReturnValue(hostname);
    asMockedFn(Nav.getCurrentRoute).mockReturnValue(currentRoute);
    // Act
    await doSignOut();
    // Assert
    expect(unsetCookiesFn).toHaveBeenCalled();
    expect(signOutRedirectFn).toHaveBeenCalledWith({
      post_logout_redirect_uri: `${hostname}${link}`,
      extraQueryParams: { state: expectedState },
    });
  });
  it('logs an error and calls userSignedOut if signOutRedirect throws', async () => {
    // Arrange
    const signOutRedirectFn = jest.fn(() => {
      throw new Error('test error');
    });
    const removeUserFromLocalStateFn = jest.fn();
    const goToRootFn = jest.fn();
    asMockedFn(oidcStore.get).mockReturnValue({
      userManager: {
        signoutRedirect: signOutRedirectFn,
      },
    } as unknown as OidcState);
    asMockedFn(removeUserFromLocalState).mockImplementation(removeUserFromLocalStateFn);
    asMockedFn(goToPath).mockImplementation(goToRootFn);
    const consoleErrorFn = jest.spyOn(console, 'error').mockImplementation(() => {});
    // Act
    await doSignOut();
    // Assert
    expect(consoleErrorFn).toHaveBeenCalledWith(
      'Signing out with B2C failed. Falling back on local signout',
      expect.any(Error)
    );
    expect(removeUserFromLocalStateFn).toHaveBeenCalled();
    expect(goToRootFn).toHaveBeenCalledWith('root');
  });
});
