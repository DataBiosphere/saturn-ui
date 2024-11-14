import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import React from 'react';
import { Workspaces } from 'src/billing/Workspaces/Workspaces';
import { GoogleBillingAccount } from 'src/billing-core/models';
import { Billing, BillingContract } from 'src/libs/ajax/billing/Billing';
import { BillingProject, SpendReport as SpendReportServerResponse } from 'src/libs/ajax/billing/billing-models';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import { azureBillingProject, gcpBillingProject } from 'src/testing/billing-project-fixtures';
import { asMockedFn, partial, renderWithAppContexts } from 'src/testing/test-utils';
import {
  defaultAzureWorkspace,
  defaultGoogleWorkspace,
  makeAzureWorkspace,
  makeGoogleWorkspace,
} from 'src/testing/workspace-fixtures';
import { WorkspaceInfo } from 'src/workspaces/utils';

import { BillingAccountStatus } from '../utils';

type NavExports = typeof import('src/libs/nav');
jest.mock(
  'src/libs/nav',
  (): NavExports => ({
    ...jest.requireActual<NavExports>('src/libs/nav'),
    getLink: jest.fn(() => '/'),
    goToPath: jest.fn(),
    useRoute: jest.fn().mockReturnValue({ query: {} }),
    updateSearch: jest.fn(),
  })
);
jest.mock('src/libs/ajax/billing/Billing');
jest.mock('src/libs/ajax/Metrics');
jest.mock('src/libs/feature-previews', () => ({
  isFeaturePreviewEnabled: jest.fn(),
}));

describe('Workspaces', () => {
  const getSpendReport = jest.fn().mockResolvedValue({} as SpendReportServerResponse);

  const renderSpendWorkspaces = async (
    billingProject: BillingProject,
    workspacesInProject: WorkspaceInfo[],
    billingAccounts: Record<string, GoogleBillingAccount>,
    billingAccountsOutOfDate: boolean,
    groups: Partial<Record<BillingAccountStatus, Set<WorkspaceInfo>>>
  ) => {
    await act(async () => {
      renderWithAppContexts(
        <Workspaces
          billingProject={billingProject}
          workspacesInProject={workspacesInProject}
          billingAccounts={billingAccounts}
          billingAccountsOutOfDate={billingAccountsOutOfDate}
          groups={groups}
        />
      );
    });
  };

  beforeEach(() => {
    asMockedFn(Billing).mockReturnValue(partial<BillingContract>({ getSpendReport }));
    asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent: jest.fn() }));
  });

  it('renders a message when there are no workspaces', async () => {
    // Act
    await act(async () => {
      renderWithAppContexts(
        <Workspaces
          billingProject={azureBillingProject}
          workspacesInProject={[]}
          billingAccounts={{}}
          billingAccountsOutOfDate={false}
          groups={{}}
        />
      );
    });

    // Assert
    // Will throw an exception if the text is not present.
    screen.getByText('Use this Terra billing project to create');
  });

  it('does not renders a message about creating workspaces when there are workspaces', async () => {
    // Act
    await act(async () => {
      renderWithAppContexts(
        <Workspaces
          billingProject={azureBillingProject}
          workspacesInProject={[defaultAzureWorkspace.workspace]}
          billingAccounts={{}}
          billingAccountsOutOfDate={false}
          groups={{ done: new Set([defaultAzureWorkspace.workspace]) }}
        />
      );
    });

    // Assert
    expect(screen.queryByText('Use this Terra billing project to create')).toBeNull();
  });

  it('renders Azure workspaces', async () => {
    // Arrange
    const secondWorkspace = makeAzureWorkspace({ workspace: { name: 'secondWorkspace', workspaceId: 'secondId' } });

    // Act
    await act(async () => {
      renderWithAppContexts(
        <Workspaces
          billingProject={azureBillingProject}
          workspacesInProject={[defaultAzureWorkspace.workspace, secondWorkspace.workspace]}
          billingAccounts={{}}
          billingAccountsOutOfDate={false}
          groups={{ done: new Set([defaultAzureWorkspace.workspace, secondWorkspace.workspace]) }}
        />
      );
    });

    // Assert
    const userTable = screen.getByRole('table');
    expect(userTable).toHaveAccessibleName(`workspaces in billing project ${azureBillingProject.projectName}`);
    const users = within(userTable).getAllByRole('row');
    expect(users).toHaveLength(3); // 1 header row + 2 workspace rows
    // users sort initially by name, resource group ID comes from the billing project
    expect(users[1]).toHaveTextContent(/secondWorkspacejustin@gmail.comMar 15, 2023/);
    expect(users[2]).toHaveTextContent(/test-azure-ws-namejustin@gmail.comMar 15, 2023/);
  });

  it('renders Google workspaces, including errorMessage', async () => {
    // Arrange
    const errorMessage = 'billing error message'; // only displayed for Google workspaces
    const secondWorkspace = makeGoogleWorkspace({
      workspace: {
        name: 'secondWorkspace',
        billingAccount: 'second-billing-account',
        workspaceId: 'secondId',
        errorMessage,
      },
    });
    const testBillingAccount: GoogleBillingAccount = {
      accountName: gcpBillingProject.billingAccount,
      displayName: 'Test Billing Account',
    };
    const billingAccounts: Record<string, GoogleBillingAccount> = {};
    billingAccounts[`${secondWorkspace.workspace.billingAccount}`] = testBillingAccount;
    const secondWorkspaceInfo = 'secondWorkspacegroot@gmail.comMar 15, 2023';

    // Act
    await act(async () => {
      renderWithAppContexts(
        <Workspaces
          billingProject={gcpBillingProject}
          workspacesInProject={[defaultGoogleWorkspace.workspace, secondWorkspace.workspace]}
          billingAccounts={billingAccounts}
          billingAccountsOutOfDate={false}
          groups={{ done: new Set([defaultGoogleWorkspace.workspace, secondWorkspace.workspace]) }}
        />
      );
    });

    // Assert
    const userTable = screen.getByRole('table');
    expect(userTable).toHaveAccessibleName(`workspaces in billing project ${gcpBillingProject.projectName}`);
    const users = within(userTable).getAllByRole('row');
    expect(users).toHaveLength(3); // 1 header row + 2 workspace rows
    // users sort initially by name
    expect(users[1]).toHaveTextContent(new RegExp(secondWorkspaceInfo));
    expect(users[2]).toHaveTextContent(/test-gcp-ws-namegroot@gmail.comMar 15, 2023/);
  });

  it('supports sorting', async () => {
    // Arrange
    const secondWorkspace = makeAzureWorkspace({
      workspace: { name: 'secondWorkspace', workspaceId: 'secondId', createdBy: 'zoo@gmail.com' },
    });
    const user = userEvent.setup();

    // Act
    await act(async () => {
      renderWithAppContexts(
        <Workspaces
          billingProject={azureBillingProject}
          workspacesInProject={[defaultAzureWorkspace.workspace, secondWorkspace.workspace]}
          billingAccounts={{}}
          billingAccountsOutOfDate={false}
          groups={{ done: new Set([defaultAzureWorkspace.workspace, secondWorkspace.workspace]) }}
        />
      );
    });
    // Expand the first workspace to render (alphabetically) so we can test its details
    await user.click(screen.getByText('Created By'));

    // Assert
    const userTable = screen.getByRole('table');
    const users = within(userTable).getAllByRole('row');
    expect(users).toHaveLength(3); // 1 header row + 2 workspace rows
    expect(users[1]).toHaveTextContent(/test-azure-ws-namejustin@gmail.comMar 15, 2023/);
    expect(users[2]).toHaveTextContent(/secondWorkspacezoo@gmail.comMar 15, 2023/);
  });

  it('renders icons if billing accounts are synchronizing with no accessibility errors', async () => {
    // Arrange
    const secondWorkspace = makeGoogleWorkspace({ workspace: { name: 'secondWorkspace', workspaceId: 'secondId' } });
    const thirdWorkspace = makeGoogleWorkspace({ workspace: { name: 'thirdWorkspace', workspaceId: 'thirdId' } });

    // Act
    let container;
    await act(async () => {
      container = renderWithAppContexts(
        <Workspaces
          billingProject={gcpBillingProject}
          workspacesInProject={[defaultGoogleWorkspace.workspace, secondWorkspace.workspace, thirdWorkspace.workspace]}
          billingAccounts={{}}
          billingAccountsOutOfDate
          groups={{
            updating: new Set([defaultGoogleWorkspace.workspace]),
            error: new Set([secondWorkspace.workspace]),
            done: new Set([thirdWorkspace.workspace]),
          }}
        />
      ).container;
    });

    // Assert
    const userTable = screen.getByRole('table');
    const users = within(userTable).getAllByRole('row');
    expect(users).toHaveLength(4); // 1 header row + 4 workspace rows
    // users sort initially by name
    expect(users[1]).toHaveTextContent('secondWorkspacegroot@gmail.comMar 15, 2023');
    expect(users[2]).toHaveTextContent('test-gcp-ws-namegroot@gmail.comMar 15, 2023');
    expect(users[3]).toHaveTextContent('thirdWorkspacegroot@gmail.comMar 15, 2023');
    // Verify accessibility
    expect(await axe(container)).toHaveNoViolations();
  });

  it('fetches and filters workspaces based on spend report and search value', async () => {
    // Mock the return value of isFeaturePreviewEnabled
    (isFeaturePreviewEnabled as jest.Mock).mockReturnValue(true);

    const testNamespace = 'test-gcp-ws-namespace';
    const testWorkspaceName = 'test-gcp-ws-name';

    // Arrange
    const mockSpendReport = {
      spendDetails: [
        {
          aggregationKey: 'Workspace',
          spendData: [
            {
              cost: '100.00',
              credits: '0.00',
              currency: 'USD',
              googleProjectId: 'test-gcp-ws-project',
              subAggregation: {
                aggregationKey: 'Category',
                spendData: [
                  { category: 'Compute', cost: '60.00', credits: '0.00', currency: 'USD' },
                  { category: 'Storage', cost: '40.00', credits: '0.00', currency: 'USD' },
                ],
              },
              workspace: { namespace: testNamespace, name: testWorkspaceName },
            },
          ],
        },
      ],
      spendSummary: {
        cost: '100.00',
        credits: '0.00',
        currency: 'USD',
        endTime: '2024-11-15T00:00:00Z',
        startTime: '2024-10-15T00:00:00Z',
      },
    };
    const user = userEvent.setup();

    getSpendReport.mockResolvedValue(mockSpendReport);

    // Act
    await renderSpendWorkspaces(gcpBillingProject, [defaultGoogleWorkspace.workspace], {}, false, {});

    // Assert
    expect(getSpendReport).toHaveBeenCalledWith({
      billingProjectName: gcpBillingProject.projectName,
      startDate: expect.any(String),
      endDate: expect.any(String),
      aggregationKeys: ['Workspace~Category'],
    });

    // Apply search filter
    await user.type(screen.getByPlaceholderText('Search by name, project or bucket'), testWorkspaceName);
    await waitFor(() => {
      const workspaceTable = screen.getByRole('table');
      const workspaces = within(workspaceTable).getAllByRole('row');
      expect(workspaces).toHaveLength(2); // 1 header row + 1 workspace row
      expect(workspaces[1]).toHaveTextContent(/test-gcp-ws-name/);
      expect(workspaces[1]).toHaveTextContent(/\$100.00/);
      expect(workspaces[1]).toHaveTextContent(/\$60.00/);
      expect(workspaces[1]).toHaveTextContent(/\$40.00/);
    });
  });

  it('fetches and filters workspaces without on spend report and search value', async () => {
    // Mock the return value of isFeaturePreviewEnabled
    (isFeaturePreviewEnabled as jest.Mock).mockReturnValue(true);

    const testWorkspaceName = 'test-gcp-ws-name';

    // Arrange
    const user = userEvent.setup();

    getSpendReport.mockResolvedValue({});

    // Act
    await renderSpendWorkspaces(gcpBillingProject, [defaultGoogleWorkspace.workspace], {}, false, {});

    // Assert
    expect(getSpendReport).toHaveBeenCalledWith({
      billingProjectName: gcpBillingProject.projectName,
      startDate: expect.any(String),
      endDate: expect.any(String),
      aggregationKeys: ['Workspace~Category'],
    });

    // Apply search filter
    await user.type(screen.getByPlaceholderText('Search by name, project or bucket'), testWorkspaceName);
    await waitFor(() => {
      const workspaceTable = screen.getByRole('table');
      const workspaces = within(workspaceTable).getAllByRole('row');
      expect(workspaces).toHaveLength(2); // 1 header row + 1 workspace row
      expect(workspaces[1]).toHaveTextContent(/test-gcp-ws-name/);
      expect(workspaces[1]).toHaveTextContent(/N\/A/);
      expect(workspaces[1]).toHaveTextContent(/N\/A/);
      expect(workspaces[1]).toHaveTextContent(/N\/A/);
    });
  });
});
