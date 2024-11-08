import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import React from 'react';
import { Workspaces } from 'src/billing/Workspaces/Workspaces';
import { GoogleBillingAccount } from 'src/billing-core/models';
import { azureBillingProject, gcpBillingProject } from 'src/testing/billing-project-fixtures';
import { renderWithAppContexts } from 'src/testing/test-utils';
import {
  defaultAzureWorkspace,
  defaultGoogleWorkspace,
  makeAzureWorkspace,
  makeGoogleWorkspace,
} from 'src/testing/workspace-fixtures';

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
describe('Workspaces', () => {
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
    await user.click(screen.getByLabelText('expand workspace secondWorkspace'));

    // Assert
    const userTable = screen.getByRole('table');
    expect(userTable).toHaveAccessibleName(`workspaces in billing project ${azureBillingProject.projectName}`);
    const users = within(userTable).getAllByRole('row');
    expect(users).toHaveLength(3); // 1 header row + 2 workspace rows
    // users sort initially by name, resource group ID comes from the billing project
    expect(users[1]).toHaveTextContent(
      /secondWorkspacejustin@gmail.comMar 15, 2023Resource Group IDaaaabbbb-cccc-dddd-0000-111122223333/
    );
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
    const user = userEvent.setup();
    const testBillingAccount: GoogleBillingAccount = {
      accountName: gcpBillingProject.billingAccount,
      displayName: 'Test Billing Account',
    };
    const billingAccounts: Record<string, GoogleBillingAccount> = {};
    billingAccounts[`${secondWorkspace.workspace.billingAccount}`] = testBillingAccount;
    const secondWorkspaceInfo = `secondWorkspacegroot@gmail.comMar 15, 2023Google Project${secondWorkspace.workspace.googleProject}Billing Account${testBillingAccount.displayName}${errorMessage}`;

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
    // Expand the first workspace to render (alphabetically) so we can test its details
    await user.click(screen.getByLabelText('expand workspace secondWorkspace'));

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
    within(users[1]).getByLabelText('billing account in error state');
    expect(users[2]).toHaveTextContent('test-gcp-ws-namegroot@gmail.comMar 15, 2023');
    within(users[2]).getByLabelText('billing account updating');
    expect(users[3]).toHaveTextContent('thirdWorkspacegroot@gmail.comMar 15, 2023');
    within(users[3]).getByLabelText('billing account up-to-date');
    // Verify accessibility
    expect(await axe(container)).toHaveNoViolations();
  });
});
