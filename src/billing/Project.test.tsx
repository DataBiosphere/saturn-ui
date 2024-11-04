import { asMockedFn, MockedFn, partial } from '@terra-ui-packages/test-utils';
import { act, screen } from '@testing-library/react';
import React from 'react';
import Project, { groupByBillingAccountStatus } from 'src/billing/Project';
import { GCPBillingProject, GoogleBillingAccount } from 'src/billing-core/models';
import { Billing, BillingContract } from 'src/libs/ajax/billing/Billing';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { azureBillingProject, gcpBillingProject } from 'src/testing/billing-project-fixtures';
import { renderWithAppContexts } from 'src/testing/test-utils';
import { defaultAzureWorkspace, defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';

jest.mock('src/libs/ajax/billing/Billing');
jest.mock('src/libs/ajax/Metrics');

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

describe('groupByBillingAccountStatus', () => {
  it('returns an empty mapping if there are no workspaces', () => {
    // Act
    const result = groupByBillingAccountStatus(gcpBillingProject, []);

    // Assert
    expect(result).toEqual({});
  });

  it('groups Azure workspaces as done', () => {
    // Act
    const result = groupByBillingAccountStatus(azureBillingProject, [defaultAzureWorkspace.workspace]);

    // Assert
    expect(result).toEqual({ done: new Set([defaultAzureWorkspace.workspace]) });
  });

  it('groups workspaces with matching billing account as done', () => {
    // Arrange
    const testBillingAccount: GoogleBillingAccount = {
      accountName: defaultGoogleWorkspace.workspace.billingAccount,
      displayName: 'Test Billing Account',
    };
    const googleBillingProject: GCPBillingProject = {
      billingAccount: testBillingAccount.accountName,
      cloudPlatform: 'GCP',
      invalidBillingAccount: false,
      projectName: 'Google Billing Project',
      roles: ['Owner'],
      status: 'Ready',
    };
    // Act
    const result = groupByBillingAccountStatus(googleBillingProject, [defaultGoogleWorkspace.workspace]);

    // Assert
    expect(result).toEqual({ done: new Set([defaultGoogleWorkspace.workspace]) });
  });

  it('groups workspaces without matching billing account and no errorMessage as updating', () => {
    // Arrange
    const googleBillingProject: GCPBillingProject = {
      billingAccount: 'billingAccounts/does-not-match',
      cloudPlatform: 'GCP',
      invalidBillingAccount: false,
      projectName: 'Google Billing Project',
      roles: ['Owner'],
      status: 'Ready',
    };
    // Act
    const result = groupByBillingAccountStatus(googleBillingProject, [defaultGoogleWorkspace.workspace]);

    // Assert
    expect(result).toEqual({ updating: new Set([defaultGoogleWorkspace.workspace]) });
  });

  it('groups workspaces without matching billing account and errorMessage as error', () => {
    // Arrange
    const googleBillingProject: GCPBillingProject = {
      billingAccount: 'billingAccounts/does-not-match',
      cloudPlatform: 'GCP',
      invalidBillingAccount: false,
      projectName: 'Google Billing Project',
      roles: ['Owner'],
      status: 'Ready',
    };
    const workspace = { ...defaultGoogleWorkspace.workspace, errorMessage: 'billing error message' };
    // Act
    const result = groupByBillingAccountStatus(googleBillingProject, [workspace]);

    // Assert
    expect(result).toEqual({ error: new Set([workspace]) });
  });

  it('can group multiple workspaces of the same type', () => {
    // Arrange
    const googleBillingProject: GCPBillingProject = {
      billingAccount: 'billingAccounts/does-not-match',
      cloudPlatform: 'GCP',
      invalidBillingAccount: false,
      projectName: 'Google Billing Project',
      roles: ['Owner'],
      status: 'Ready',
    };
    const firstWorkspace = { ...defaultGoogleWorkspace.workspace, errorMessage: 'billing error message' };
    const secondWorkspace = {
      ...defaultGoogleWorkspace.workspace,
      name: 'secondWorkspace',
      errorMessage: 'billing error message 2',
    };
    const updatingWorkspace = { ...defaultGoogleWorkspace.workspace, name: 'updatingWorkspace' };
    const secondUpdatingWorkspace = { ...defaultGoogleWorkspace.workspace, name: 'secondUpdatingWorkspace' };
    // Act
    const result = groupByBillingAccountStatus(googleBillingProject, [
      firstWorkspace,
      secondWorkspace,
      updatingWorkspace,
      secondUpdatingWorkspace,
    ]);

    // Assert
    expect(result).toEqual({
      error: new Set([firstWorkspace, secondWorkspace]),
      updating: new Set([updatingWorkspace, secondUpdatingWorkspace]),
    });
  });
});

describe('Project', () => {
  const listProjectUsers: MockedFn<BillingContract['listProjectUsers']> = jest.fn();

  beforeEach(() => {
    asMockedFn(Billing).mockReturnValue(
      partial<BillingContract>({
        listProjectUsers,
        removeProjectUser: jest.fn(),
      })
    );
    asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent: jest.fn() }));
  });

  it('shows all tabs if the user is an owner', async () => {
    // Arrange
    listProjectUsers.mockResolvedValue([
      {
        email: 'testuser1@example.com',
        role: 'Owner',
      },
      {
        email: 'testuser3@example.com',
        role: 'User',
      },
    ]);

    // Act
    await act(async () =>
      renderWithAppContexts(
        <Project
          authorizeAndLoadAccounts={jest.fn()}
          billingAccounts={{}}
          billingProject={azureBillingProject}
          isOwner
          reloadBillingProject={jest.fn()}
          workspaces={[]}
          refreshWorkspaces={jest.fn()}
        />
      )
    );

    // Assert
    // Verify that the tab has the correct name ("Members" since user is owner);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toEqual(3);
    expect(tabs[0]).toHaveTextContent('Workspaces');
    expect(tabs[1]).toHaveTextContent('Members');
    expect(tabs[2]).toHaveTextContent('Spend report');
  });

  it('shows only the workspaces and owners tab is the user is not an owner', async () => {
    // Arrange
    // Returns only owners if the user is not an owner.
    listProjectUsers.mockResolvedValue([
      {
        email: 'testuser1@example.com',
        role: 'Owner',
      },
      {
        email: 'testuser2@example.com',
        role: 'Owner',
      },
    ]);

    // Act
    await act(async () =>
      renderWithAppContexts(
        <Project
          authorizeAndLoadAccounts={jest.fn()}
          billingAccounts={{}}
          billingProject={azureBillingProject}
          isOwner={false}
          reloadBillingProject={jest.fn()}
          workspaces={[]}
          refreshWorkspaces={jest.fn()}
        />
      )
    );

    // Assert
    // Verify that the tab has the correct name ("Owners");
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toEqual(2);
    expect(tabs[0]).toHaveTextContent('Workspaces');
    expect(tabs[1]).toHaveTextContent('Owners');
    // Verify warning about a single owner is not shown.
    expect(screen.queryByText(/This shared billing project has only one owner/)).toBeNull();
  });

  it('does not show a warning if the user is the only owner of a billing project with no other users', async () => {
    // Arrange
    listProjectUsers.mockResolvedValue([
      {
        email: 'testuser1@example.com',
        role: 'Owner',
      },
    ]);

    // Act
    await act(async () =>
      renderWithAppContexts(
        <Project
          authorizeAndLoadAccounts={jest.fn()}
          billingAccounts={{}}
          billingProject={azureBillingProject}
          isOwner
          reloadBillingProject={jest.fn()}
          workspaces={[]}
          refreshWorkspaces={jest.fn()}
        />
      )
    );

    // Assert
    expect(screen.queryByText(/You are the only owner of this shared billing project/)).toBeNull();
  });

  it('shows a warning if the user is the only owner of a billing project that has other users', async () => {
    // Arrange
    listProjectUsers.mockResolvedValue([
      {
        email: 'testuser1@example.com',
        role: 'Owner',
      },
      {
        email: 'testuser2@example.com',
        role: 'User',
      },
    ]);

    // Act
    await act(async () =>
      renderWithAppContexts(
        <Project
          authorizeAndLoadAccounts={jest.fn()}
          billingAccounts={{}}
          billingProject={azureBillingProject}
          isOwner
          reloadBillingProject={jest.fn()}
          workspaces={[]}
          refreshWorkspaces={jest.fn()}
        />
      )
    );

    // Assert
    screen.getByText(/You are the only owner of this shared billing project/);
  });

  it('shows a warning if the billing project has only one owner, and the user is not an owner', async () => {
    // Arrange
    // This method only returns owners if the user is not an owner.
    listProjectUsers.mockResolvedValue([
      {
        email: 'testuser1@example.com',
        role: 'Owner',
      },
    ]);

    // Act
    await act(async () =>
      renderWithAppContexts(
        <Project
          authorizeAndLoadAccounts={jest.fn()}
          billingAccounts={{}}
          billingProject={azureBillingProject}
          isOwner={false}
          reloadBillingProject={jest.fn()}
          workspaces={[]}
          refreshWorkspaces={jest.fn()}
        />
      )
    );

    // Assert
    screen.getByText(/This shared billing project has only one owner/);
  });

  it('shows a link to the Azure portal for Azure billing projects', async () => {
    // Arrange
    listProjectUsers.mockResolvedValue([
      {
        email: 'testuser1@example.com',
        role: 'Owner',
      },
    ]);

    // Act
    await act(async () =>
      renderWithAppContexts(
        <Project
          authorizeAndLoadAccounts={jest.fn()}
          billingAccounts={{}}
          billingProject={azureBillingProject}
          isOwner
          reloadBillingProject={jest.fn()}
          workspaces={[]}
          refreshWorkspaces={jest.fn()}
        />
      )
    );

    // Assert
    screen.getByText(/View project resources in Azure Portal/);
  });

  it('does not show a link to the Azure portal for GCP billing projects', async () => {
    // Arrange
    listProjectUsers.mockResolvedValue([
      {
        email: 'testuser1@example.com',
        role: 'Owner',
      },
    ]);

    // Act
    await act(async () =>
      renderWithAppContexts(
        <Project
          authorizeAndLoadAccounts={jest.fn()}
          billingAccounts={{}}
          billingProject={gcpBillingProject}
          isOwner
          reloadBillingProject={jest.fn()}
          workspaces={[]}
          refreshWorkspaces={jest.fn()}
        />
      )
    );

    // Assert
    expect(screen.queryByText(/View project resources in Azure Portal/)).toBeNull();
  });
});
