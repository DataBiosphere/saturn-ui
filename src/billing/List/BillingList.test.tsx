import { act, screen } from '@testing-library/react';
import React from 'react';
import { BillingProject } from 'src/billing-core/models';
import { Billing, BillingContract } from 'src/libs/ajax/billing/Billing';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import { asMockedFn, partial, renderWithAppContexts as render } from 'src/testing/test-utils';
import { defaultAzureWorkspace, defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';
import { useWorkspaces } from 'src/workspaces/common/state/useWorkspaces';

import { BillingList, BillingListProps } from './BillingList';

// Mocking for using Nav.getLink
jest.mock('src/libs/nav', () => ({
  ...jest.requireActual('src/libs/nav'),
  getPath: jest.fn(() => '/test/'),
  getLink: jest.fn(() => '/'),
}));

jest.mock('src/libs/ajax/Metrics');
asMockedFn(Metrics).mockImplementation(() => partial<MetricsContract>({ captureEvent: jest.fn() }));

type UseWorkspacesExports = typeof import('src/workspaces/common/state/useWorkspaces');
jest.mock('src/workspaces/common/state/useWorkspaces', (): UseWorkspacesExports => {
  return {
    ...jest.requireActual<UseWorkspacesExports>('src/workspaces/common/state/useWorkspaces'),
    useWorkspaces: jest.fn(),
  };
});
asMockedFn(useWorkspaces).mockReturnValue({
  workspaces: [defaultAzureWorkspace, defaultGoogleWorkspace],
  loading: false,
  refresh: () => Promise.resolve(),
  status: 'Ready',
});

type AuthExports = typeof import('src/auth/auth');
jest.mock('src/libs/ajax/billing/Billing');
asMockedFn(Billing).mockReturnValue(
  partial<BillingContract>({
    listProjects: async () => [
      partial<BillingProject>({
        billingAccount: 'billingAccounts/FOO-BAR-BAZ',
        cloudPlatform: 'GCP',
        invalidBillingAccount: false,
        projectName: 'Google Billing Project',
        roles: ['Owner'],
        status: 'Ready',
      }),
    ],
    getProject: async () => partial<BillingProject>({ projectName: 'Google Billing Project' }),
  })
);

jest.mock('src/auth/auth', (): AuthExports => {
  const originalModule = jest.requireActual<AuthExports>('src/auth/auth');
  return {
    ...originalModule,
    hasBillingScope: jest.fn(),
    tryBillingScope: jest.fn(),
    getAuthToken: jest.fn(),
    getAuthTokenFromLocalStorage: jest.fn(),
    sendRetryMetric: jest.fn(),
  };
});

jest.mock('src/libs/feature-previews', () => ({
  isFeaturePreviewEnabled: jest.fn(),
}));

describe('BillingList', () => {
  let billingListProps: BillingListProps;

  it('renders link to consolidated spend report if feature preview is on', async () => {
    (isFeaturePreviewEnabled as jest.Mock).mockReturnValue(true);
    billingListProps = { queryParams: { selectedName: 'name', type: undefined } };

    // Act
    await act(async () => render(<BillingList {...billingListProps} />));

    // Assert
    expect(screen.getByText('Consolidated Spend Report')).not.toBeNull();
  });

  it('does not render link to consolidated spend report if feature preview is off', async () => {
    (isFeaturePreviewEnabled as jest.Mock).mockReturnValue(false);
    billingListProps = { queryParams: { selectedName: 'name', type: undefined } };

    // Act
    await act(async () => render(<BillingList {...billingListProps} />));

    // Assert
    expect(screen.queryByText('Consolidated Spend Report')).toBeNull();
  });
});
