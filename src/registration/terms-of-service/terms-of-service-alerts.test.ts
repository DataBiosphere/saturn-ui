import { asMockedFn } from '@terra-ui-packages/test-utils';
import { act } from '@testing-library/react';
import { h } from 'react-hyperscript-helpers';
import { AlertsIndicator } from 'src/alerts/Alerts';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { authStore, TermsOfServiceStatus } from 'src/libs/state';
import * as TosAlerts from 'src/registration/terms-of-service/terms-of-service-alerts';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

jest.mock('src/libs/ajax/Metrics');

jest.mock('src/libs/nav', () => ({
  ...jest.requireActual('src/libs/nav'),
  getLink: jest.fn().mockReturnValue(''),
}));

jest.mock('react-notifications-component', () => {
  return {
    Store: {
      addNotification: jest.fn(),
      removeNotification: jest.fn(),
    },
  };
});

beforeAll(() => {
  asMockedFn(Metrics).mockReturnValue({
    captureEvent: jest.fn(),
  } as Partial<MetricsContract> as MetricsContract);
});

afterEach(() => {
  jest.restoreAllMocks();
  TosAlerts.tosAlertsStore.reset();
});

const renderAlerts = async (termsOfService: TermsOfServiceStatus) => {
  await act(async () => {
    render(h(AlertsIndicator));
  });

  const signInStatus = 'authenticated';
  await act(async () => {
    authStore.update((state) => ({ ...state, termsOfService, signInStatus }));
  });
};

describe('terms-of-service-alerts', () => {
  it('adds a notification when the user has a new Terms of Service to accept', async () => {
    // Arrange
    jest.spyOn(TosAlerts, 'useTermsOfServiceAlerts');

    const termsOfService = {
      isCurrentVersion: false,
      permitsSystemUsage: true,
    };

    // Act
    await renderAlerts(termsOfService);

    // Assert
    expect(TosAlerts.useTermsOfServiceAlerts).toHaveBeenCalled();
    expect(TosAlerts.tosAlertsStore.get().length).toEqual(1);
    expect(TosAlerts.tosAlertsStore.get()[0].id).toEqual('new-terms-of-service-alert');
  });

  it('does not add a notification when the user does not have a new Terms of Service to accept', async () => {
    // Arrange
    jest.spyOn(TosAlerts, 'useTermsOfServiceAlerts');

    const termsOfService = {
      isCurrentVersion: true,
      permitsSystemUsage: true,
    };

    // Act
    await renderAlerts(termsOfService);

    // Assert
    expect(TosAlerts.useTermsOfServiceAlerts).toHaveBeenCalled();
    expect(TosAlerts.tosAlertsStore.get().length).toEqual(0);
  });
});
