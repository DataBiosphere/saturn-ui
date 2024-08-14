import { LeoCookies } from 'src/libs/ajax/leonardo/LeoCookies';
import { azureCookieReadyStore, cookieReadyStore } from 'src/libs/state';

export interface LeoCookieProvider {
  unsetCookies: () => Promise<void>;
}

export const leoCookieProvider: LeoCookieProvider = {
  unsetCookies: async () => {
    // TODO: call azure invalidate cookie once endpoint exists, https://broadworkbench.atlassian.net/browse/IA-3498

    await LeoCookies()
      .unsetCookie()
      .catch((error) => {
        if (error instanceof Response && error.status === 401) {
          console.error('Invalid cookie. This is expected if the token is expired', error);
        } else {
          throw error;
        }
      });

    cookieReadyStore.reset();
    azureCookieReadyStore.reset();
  },
};
