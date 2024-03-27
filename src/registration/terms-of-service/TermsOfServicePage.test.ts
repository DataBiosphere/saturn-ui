import { DeepPartial } from '@terra-ui-packages/core-utils';
import { act, fireEvent, screen } from '@testing-library/react';
import { h } from 'react-hyperscript-helpers';
import { Ajax } from 'src/libs/ajax';
import { SamUserTermsOfServiceDetails } from 'src/libs/ajax/TermsOfService';
import { SamUserAllowances } from 'src/libs/ajax/User';
import { AuthState, authStore } from 'src/libs/state';
import { TermsOfServicePage } from 'src/registration/terms-of-service/TermsOfServicePage';
import { asMockedFn, renderWithAppContexts as render } from 'src/testing/test-utils';

jest.mock('src/libs/ajax');
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
  })
);

type AuthExports = typeof import('src/auth/auth');

type SignOutExports = typeof import('src/auth/signout/sign-out');
jest.mock(
  'src/auth/signout/sign-out',
  (): SignOutExports => ({
    ...jest.requireActual<SignOutExports>('src/auth/signout/sign-out'),
    signOut: jest.fn(),
  })
);

jest.mock(
  'src/auth/auth',
  (): AuthExports => ({
    ...jest.requireActual<AuthExports>('src/auth/auth'),
  })
);

interface TermsOfServiceSetupResult {
  getTosFn: jest.Mock;
  getTermsOfServiceComplianceStatusFn: jest.Mock;
  acceptTosFn: jest.Mock;
  rejectTosFn: jest.Mock;
}

const setupMockAjax = async (
  termsOfService: SamUserTermsOfServiceDetails,
  signedIn = true
): Promise<TermsOfServiceSetupResult> => {
  const signInStatus = signedIn ? 'userLoaded' : 'signedOut';
  const terraUserAllowances: SamUserAllowances = {
    allowed: termsOfService.permitsSystemUsage,
    details: { enabled: true, termsOfService: termsOfService.permitsSystemUsage },
  };

  const getTermsOfServiceText = jest.fn().mockResolvedValue('some text');
  const getUserTermsOfServiceDetails = jest
    .fn()
    .mockResolvedValue(termsOfService satisfies SamUserTermsOfServiceDetails);
  const acceptTermsOfService = jest.fn().mockResolvedValue(undefined);
  const rejectTermsOfService = jest.fn().mockResolvedValue(undefined);
  const getNihStatus = jest.fn();

  type AjaxExports = typeof import('src/libs/ajax');
  type AjaxContract = ReturnType<AjaxExports['Ajax']>;

  asMockedFn(Ajax).mockImplementation(
    () =>
      ({
        Metrics: {
          captureEvent: jest.fn(),
        },
        User: {
          getUserAttributes: jest.fn().mockResolvedValue({ marketingConsent: true }),
          getUserAllowances: jest.fn().mockResolvedValue(terraUserAllowances),
          getEnterpriseFeatures: jest.fn().mockResolvedValue([]),
          profile: {
            get: jest.fn().mockResolvedValue({ keyValuePairs: [] }),
            update: jest.fn().mockResolvedValue({ keyValuePairs: [] }),
            setPreferences: jest.fn().mockResolvedValue({}),
            preferLegacyFirecloud: jest.fn().mockResolvedValue({}),
          },
          getNihStatus,
        },
        TermsOfService: {
          getUserTermsOfServiceDetails,
          acceptTermsOfService,
          rejectTermsOfService,
          getTermsOfServiceText,
        },
        Groups: {
          list: jest.fn(),
        },
      } as DeepPartial<AjaxContract> as AjaxContract)
  );

  await act(async () => {
    authStore.update((state: AuthState) => ({ ...state, termsOfService, signInStatus, terraUserAllowances }));
  });

  return Promise.resolve({
    getTosFn: getTermsOfServiceText,
    getTermsOfServiceComplianceStatusFn: getUserTermsOfServiceDetails,
    acceptTosFn: acceptTermsOfService,
    rejectTosFn: rejectTermsOfService,
  });
};

describe('TermsOfService', () => {
  it('fetches the Terms of Service text from Sam', async () => {
    // Arrange
    const termsOfService = {
      latestAcceptedVersion: '0',
      acceptedOn: new Date(),
      permitsSystemUsage: true,
      isCurrentVersion: true,
    };

    const { getTosFn } = await setupMockAjax(termsOfService);

    // Act
    await act(async () => {
      render(h(TermsOfServicePage));
    });

    // Assert
    expect(getTosFn).toHaveBeenCalled();

    screen.getByText('some text');
  });

  it('shows only require terms of service buttons when the user has not accepted the latest ToS but is still allowed to use Terra', async () => {
    // Arrange
    const termsOfService = {
      latestAcceptedVersion: '0',
      acceptedOn: new Date(),
      permitsSystemUsage: true,
      isCurrentVersion: false,
    };

    await setupMockAjax(termsOfService);

    // Act
    await act(async () => {
      render(h(TermsOfServicePage));
    });

    // Assert
    const backToTerraButton = screen.queryByText('Back to Terra');
    expect(backToTerraButton).toBeNull();
    screen.getByText('Accept');
    screen.getByText('Decline and Sign Out');
  });

  it('show only require terms of service buttons when the user has not accepted the latest ToS and is not allowed to use Terra', async () => {
    // Arrange
    const termsOfService = {
      latestAcceptedVersion: '0',
      acceptedOn: new Date(),
      permitsSystemUsage: false,
      isCurrentVersion: false,
    };

    await setupMockAjax(termsOfService);

    // Act
    await act(async () => {
      render(h(TermsOfServicePage));
    });

    // Assert
    const backToTerraButton = screen.queryByText('Back to Terra');
    expect(backToTerraButton).toBeNull();
    screen.getByText('Accept');
    screen.getByText('Decline and Sign Out');
  });

  it('only shows the back button when the user has accepted the latest ToS and is allowed to use Terra', async () => {
    // Arrange
    const termsOfService = {
      latestAcceptedVersion: '0',
      acceptedOn: new Date(),
      permitsSystemUsage: true,
      isCurrentVersion: true,
    };

    await setupMockAjax(termsOfService);

    // Act
    await act(async () => {
      render(h(TermsOfServicePage));
    });

    // Assert
    screen.getByText('Back to Terra');
    const acceptButton = screen.queryByText('Accept');
    expect(acceptButton).toBeNull();
    const declineButton = screen.queryByText('Decline and Sign Out');
    expect(declineButton).toBeNull();
  });

  it('only shows the back button when the user has not signed in to Terra', async () => {
    // Arrange
    const termsOfService = {
      latestAcceptedVersion: '0',
      acceptedOn: new Date(),
      permitsSystemUsage: false,
      isCurrentVersion: false,
    };

    await setupMockAjax(termsOfService, false);

    // Act
    await act(async () => {
      render(h(TermsOfServicePage));
    });

    // Assert
    screen.getByText('Back to Terra');
    const acceptButton = screen.queryByText('Accept');
    expect(acceptButton).toBeNull();
    const declineButton = screen.queryByText('Decline and Sign Out');
    expect(declineButton).toBeNull();
  });

  it('calls the acceptTos endpoint when the accept tos button is clicked', async () => {
    // Arrange
    const termsOfService = {
      latestAcceptedVersion: '0',
      acceptedOn: new Date(),
      permitsSystemUsage: false,
      isCurrentVersion: false,
    };
    const { acceptTosFn } = await setupMockAjax(termsOfService);

    // Act
    await act(async () => {
      render(h(TermsOfServicePage));
    });
    const acceptButton = screen.getByText('Accept');
    await act(async () => fireEvent.click(acceptButton));

    // Assert
    expect(acceptTosFn).toHaveBeenCalled();
  });

  it('calls the rejectTos endpoint when the reject tos button is clicked', async () => {
    // Arrange
    const termsOfService = {
      latestAcceptedVersion: '0',
      acceptedOn: new Date(),
      permitsSystemUsage: false,
      isCurrentVersion: false,
    };

    const { rejectTosFn } = await setupMockAjax(termsOfService);

    // Act
    await act(async () => {
      render(h(TermsOfServicePage));
    });
    const rejectButton = screen.getByText('Decline and Sign Out');
    await act(async () => fireEvent.click(rejectButton));

    // Assert
    expect(rejectTosFn).toHaveBeenCalled();
  });
});
