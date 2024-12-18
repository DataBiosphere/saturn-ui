import { fireEvent, screen, waitFor } from '@testing-library/react';
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
jest.mock('src/billing/utils', () => ({
  validateUserEmails: jest.fn().mockReturnValue(''),
}));

const mockAddFunction = jest.fn();
const mockOnSuccess = jest.fn();
const mockOnDismiss = jest.fn();

describe('NewMemberModal', () => {
  const defaultProps = {
    addFunction: mockAddFunction,
    adminLabel: 'Admin',
    memberLabel: 'Member',
    title: 'Add New Members',
    onSuccess: mockOnSuccess,
    onDismiss: mockOnDismiss,
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal with correct elements', async () => {
    // Arrange
    render(<NewMemberModal {...defaultProps} />);

    // Act & Assert
    await waitFor(() => {
      expect(screen.getByText('Add New Members')).toBeInTheDocument();
      expect(screen.getByText('Add Users')).toBeInTheDocument();
    });
  });

  it('handles user input for emails and roles', async () => {
    // Arrange
    render(<NewMemberModal {...defaultProps} />);
    const emailInput = screen.getByLabelText('Type or select user emails');
    const roleSelect = screen.getByLabelText('Select Role');

    // Act
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.keyDown(emailInput, { key: 'Enter', code: 'Enter' });

    fireEvent.change(roleSelect, { target: { value: 'Admin' } });
    fireEvent.click(roleSelect);

    // Assert
    await waitFor(() => {
      expect(emailInput).toHaveValue(''); // The input clears after adding
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });
  });

  it('submits valid data and calls addFunction', async () => {
    // Arrange
    render(<NewMemberModal {...defaultProps} />);
    const emailInput = screen.getByLabelText('Type or select user emails');
    const addButton = screen.getByText('Add Users');
    const userEmails = ['test1@example.com', 'test2@example.com'];
    const userRole = 'Member';

    // Act
    fireEvent.change(emailInput, { target: { value: userEmails } });
    fireEvent.keyDown(emailInput, { key: 'Enter', code: 'Enter' });
    fireEvent.click(addButton);

    // Assert
    await waitFor(() => {
      userEmails.forEach((userEmail) => {
        expect(screen.getByText(userEmail)).toBeInTheDocument();
      });
      expect(screen.getByText(userRole)).toBeInTheDocument();
      expect(addButton).not.toBeDisabled();
      expect(mockAddFunction).toHaveBeenCalledWith([userRole], userEmails);
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('displays an error message on submit failure', async () => {
    mockAddFunction.mockRejectedValueOnce({ status: 400, json: async () => ({ message: 'Error adding user' }) });

    render(<NewMemberModal {...defaultProps} />);

    const emailInput = screen.getByLabelText('Type or select user emails');
    const addButton = screen.getByText('Add Users');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.keyDown(emailInput, { key: 'Enter', code: 'Enter' });

    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Error adding user')).toBeInTheDocument();
    });
  });
});
