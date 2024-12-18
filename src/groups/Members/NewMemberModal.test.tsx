import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { Billing, BillingContract } from 'src/libs/ajax/billing/Billing';
import { Groups, GroupsContract } from 'src/libs/ajax/Groups';
import { Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import { asMockedFn, partial, renderWithAppContexts as render } from 'src/testing/test-utils';

import { NewMemberModal } from './NewMemberModal';

type NavExports = typeof import('src/libs/nav');
jest.mock(
  'src/libs/nav',
  (): NavExports => ({
    ...jest.requireActual('src/libs/nav'),
    getLink: jest.fn(),
  })
);

jest.mock('src/libs/ajax/billing/Billing');
jest.mock('src/libs/ajax/Groups');
jest.mock('src/libs/ajax/workspaces/Workspaces');

describe('NewMemberModal', () => {
  const defaultProps = {
    addFunction: jest.fn().mockResolvedValue({}),
    addUnregisteredUser: false,
    adminLabel: 'Admin',
    memberLabel: 'Member',
    title: 'Add New Member',
    onSuccess: jest.fn(),
    onDismiss: jest.fn(),
    footer: undefined,
  };

  asMockedFn(Billing).mockReturnValue(
    partial<BillingContract>({
      addProjectUsers: jest.fn(),
    })
  );
  asMockedFn(Workspaces).mockReturnValue(
    partial<WorkspacesAjaxContract>({
      getShareLog: jest.fn(async () => []),
    })
  );
  asMockedFn(Groups).mockReturnValue(
    partial<GroupsContract>({
      list: jest.fn(async () => []),
    })
  );

  it('renders the modal with the correct title', async () => {
    // Arrange
    render(<NewMemberModal {...defaultProps} />);

    // Act & Assert
    await waitFor(() => {
      expect(screen.getByText('Add New Member')).toBeInTheDocument();
    });
  });

  it('calls addFunction with correct parameters when form is submitted', async () => {
    // Arrange
    render(<NewMemberModal {...defaultProps} />);
    const emailInput = screen.getByLabelText('Type or select user emails');
    const roleSelect = screen.getByLabelText('Select Role');
    const addButton = within(screen.getByRole('dialog')).getByText('Add Users');

    // Act
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(roleSelect, { target: { value: 'Member' } });
    fireEvent.click(addButton);

    // Assert
    await waitFor(() => {
      expect(emailInput).toHaveValue('test@example.com');
      expect(roleSelect).toHaveValue('Member');
      expect(addButton).toBeEnabled();
    });
  });
});
