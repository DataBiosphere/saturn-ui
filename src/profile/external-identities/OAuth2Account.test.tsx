import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import React from 'react';
import { ExternalCredentials, ExternalCredentialsContract } from 'src/libs/ajax/ExternalCredentials';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import Events from 'src/libs/events';
import { getCurrentRoute } from 'src/libs/nav';
import { authStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { OAuth2Provider } from 'src/profile/external-identities/OAuth2Providers';
import { asMockedFn, MockedFn, partial, renderWithAppContexts as render } from 'src/testing/test-utils';

import { OAuth2Account } from './OAuth2Account';

jest.mock('src/libs/ajax/ExternalCredentials');
jest.mock('src/libs/ajax/Metrics');

jest.mock('src/auth/auth', () => ({
  ...jest.requireActual('src/auth/auth'),
  loadTerraUser: jest.fn(),
}));

jest.mock('src/libs/config', () => ({
  ...jest.requireActual('src/libs/config'),
  getConfig: jest.fn().mockReturnValue({ externalCreds: { providers: ['github'], urlRoot: 'https/foo.bar.com' } }),
}));

jest.mock('react-notifications-component', () => {
  return {
    Store: {
      addNotification: jest.fn(),
      removeNotification: jest.fn(),
    },
  };
});

type NavExports = typeof import('src/libs/nav');
jest.mock(
  'src/libs/nav',
  (): NavExports => ({
    ...jest.requireActual<NavExports>('src/libs/nav'),
    goToPath: jest.fn(),
    getLink: jest.fn(),
    getCurrentRoute: jest.fn().mockReturnValue({ path: '/#profile?tab=externalIdentities' }),
  })
);

const testAccessTokenProvider: OAuth2Provider = {
  key: 'github',
  name: 'Test Provider',
  short: 'Test',
  queryParams: {
    redirectUri: 'localhost/oauth_callback',
  },
  supportsAccessToken: true,
  supportsIdToken: false,
  isFence: false,
};

describe('OAuth2Account', () => {
  describe('When no account is linked', () => {
    it('shows the button to link an account', async () => {
      // Arrange
      const getLinkStatusFn: MockedFn<ExternalCredentialsContract['getAccountLinkStatus']> = jest.fn();
      getLinkStatusFn.mockResolvedValue(undefined);
      const getAuthorizationUrlFn: MockedFn<ExternalCredentialsContract['getAuthorizationUrl']> = jest.fn();
      getAuthorizationUrlFn.mockResolvedValue('https://foo.bar.com/oauth2/authorize');
      asMockedFn(ExternalCredentials).mockReturnValue(() =>
        partial<ExternalCredentialsContract>({
          getAccountLinkStatus: getLinkStatusFn,
          getAuthorizationUrl: getAuthorizationUrlFn,
        })
      );

      // Act
      const { container } = await act(() =>
        render(<OAuth2Account queryParams={{}} provider={testAccessTokenProvider} />)
      );

      // Assert
      screen.getByText(`Log in to ${testAccessTokenProvider.short}`);
      expect(getAuthorizationUrlFn).not.toHaveBeenCalled();
      expect(await axe(container)).toHaveNoViolations();
    });
  });
  describe('When the link account button is clicked', () => {
    it('reaches out to ECM to get an authorization url and opens a new window/tab', async () => {
      // Arrange
      const user = userEvent.setup();
      jest.spyOn(window, 'open').mockImplementation(() => null);

      const getLinkStatusFn: MockedFn<ExternalCredentialsContract['getAccountLinkStatus']> = jest.fn();
      getLinkStatusFn.mockResolvedValue(undefined);
      const getAuthorizationUrlFn: MockedFn<ExternalCredentialsContract['getAuthorizationUrl']> = jest.fn();
      getAuthorizationUrlFn.mockResolvedValue('https://foo.bar.com/oauth2/authorize');

      asMockedFn(ExternalCredentials).mockReturnValue(() =>
        partial<ExternalCredentialsContract>({
          getAccountLinkStatus: getLinkStatusFn,
          getAuthorizationUrl: getAuthorizationUrlFn,
        })
      );

      // Act
      await act(() => render(<OAuth2Account queryParams={{}} provider={testAccessTokenProvider} />));

      // Assert
      const button = screen.getByText(`Log in to ${testAccessTokenProvider.short}`);
      await user.click(button);
      expect(getAuthorizationUrlFn).toHaveBeenCalled();
      expect(window.open).toHaveBeenCalled();
    });
    it('links the account when the user is redirected back to Terra', async () => {
      // Arrange
      asMockedFn(getCurrentRoute).mockImplementation(() => ({ name: 'oauth-callback' }));
      const queryParams = {
        oauthcode: 'abcde12345',
        state: btoa(JSON.stringify({ provider: testAccessTokenProvider.key, nonce: 'abcxyz' })),
      };

      const getLinkStatusFn: MockedFn<ExternalCredentialsContract['getAccountLinkStatus']> = jest.fn();
      getLinkStatusFn.mockResolvedValue(undefined);
      const getAuthorizationUrlFn: MockedFn<ExternalCredentialsContract['getAuthorizationUrl']> = jest.fn();
      getAuthorizationUrlFn.mockResolvedValue('https://foo.bar.com/oauth2/authorize');
      const linkAccountFn: MockedFn<ExternalCredentialsContract['linkAccountWithAuthorizationCode']> = jest.fn();
      linkAccountFn.mockResolvedValue({
        externalUserId: 'testUser',
        expirationTimestamp: new Date(),
        authenticated: true,
      });
      const captureEventFn: MockedFn<MetricsContract['captureEvent']> = jest.fn();

      asMockedFn(ExternalCredentials).mockReturnValue(() =>
        partial<ExternalCredentialsContract>({
          getAccountLinkStatus: getLinkStatusFn,
          getAuthorizationUrl: getAuthorizationUrlFn,
          linkAccountWithAuthorizationCode: linkAccountFn,
        })
      );
      asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent: captureEventFn }));

      // Act
      await act(() => render(<OAuth2Account queryParams={queryParams} provider={testAccessTokenProvider} />));

      // Assert
      expect(linkAccountFn).toHaveBeenCalled();
      expect(captureEventFn).toHaveBeenCalledWith(Events.user.externalCredential.link, {
        provider: testAccessTokenProvider.key,
      });
    });
  });
  describe('When an account is already linked', () => {
    it('shows the linked account status', async () => {
      // Arrange
      const linkStatus = { externalUserId: 'testUser', expirationTimestamp: new Date(), authenticated: true };
      authStore.update((state) => ({ ...state, oAuth2AccountStatus: { [testAccessTokenProvider.key]: linkStatus } }));
      // Act
      await act(() => render(<OAuth2Account queryParams={{}} provider={testAccessTokenProvider} />));

      // Assert
      screen.getByText(`Renew your ${testAccessTokenProvider.short} link`);
      screen.getByText('Unlink');
      screen.getByText('Username:');
      screen.getByText(linkStatus.externalUserId);
      screen.getByText('Link Expiration:');
      screen.getByText(Utils.makeCompleteDate(linkStatus.expirationTimestamp));
    });

    it("unlinks the account when 'Unlink' is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      const linkStatus = { externalUserId: 'testUser', expirationTimestamp: new Date(), authenticated: true };
      authStore.update((state) => ({ ...state, oAuth2AccountStatus: { [testAccessTokenProvider.key]: linkStatus } }));

      const unlinkAccountFn: MockedFn<ExternalCredentialsContract['unlinkAccount']> = jest.fn();
      unlinkAccountFn.mockResolvedValue(undefined);
      const captureEventFn: MockedFn<MetricsContract['captureEvent']> = jest.fn();

      asMockedFn(ExternalCredentials).mockReturnValue(() =>
        partial<ExternalCredentialsContract>({
          unlinkAccount: unlinkAccountFn,
        })
      );
      asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent: captureEventFn }));

      // Act
      const { container } = await act(() =>
        render(<OAuth2Account queryParams={{}} provider={testAccessTokenProvider} />)
      );
      const unlinkButton = screen.getByText('Unlink');
      await user.click(unlinkButton);

      const okButton = screen.getByText('OK');
      await user.click(okButton);

      // Assert
      expect(unlinkAccountFn).toHaveBeenCalled();
      screen.getByText(`Log in to ${testAccessTokenProvider.short}`);

      expect(captureEventFn).toHaveBeenCalledWith(Events.user.externalCredential.unlink, {
        provider: testAccessTokenProvider.key,
      });

      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
