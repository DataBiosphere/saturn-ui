import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import React from 'react';
import { Members } from 'src/billing/Members/Members';
import { Member } from 'src/groups/Members/MemberTable';
import { Billing, BillingContract } from 'src/libs/ajax/billing/Billing';
import { Groups, GroupsContract } from 'src/libs/ajax/Groups';
import { Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import { asMockedFn, MockedFn, partial, renderWithAppContexts } from 'src/testing/test-utils';

jest.mock('src/libs/ajax/billing/Billing');
jest.mock('src/libs/ajax/Groups');
jest.mock('src/libs/ajax/workspaces/Workspaces');

describe('Members', () => {
  it('renders a list of members in the billing project with no accessibility errors', async () => {
    // Arrange
    const projectUsers: Member[] = [
      { email: 'x_owner@test.email.org', roles: ['Owner'] },
      { email: 'user@test.email.org', roles: ['User'] },
    ];

    // Act
    const { container } = renderWithAppContexts(
      <Members
        billingProjectName='test-project'
        isOwner
        projectMembers={projectUsers}
        memberAdded={jest.fn()}
        memberEdited={jest.fn()}
        deleteMember={jest.fn()}
      />
    );

    // Assert
    const userTable = screen.getByRole('table');
    expect(userTable).toHaveAccessibleName('users in billing project test-project');
    const users = within(userTable).getAllByRole('row');
    expect(users).toHaveLength(3); // 1 header row + 2 user rows
    // users sort initially by email
    expect(users[1]).toHaveTextContent(/user@test.email.orgUser/);
    expect(users[2]).toHaveTextContent(/x_owner@test.email.orgOwnerThis user is the only Owner/);
    // Verify accessibility
    expect(await axe(container)).toHaveNoViolations();
  });

  it('supports sorting members', async () => {
    // Arrange
    const projectUsers: Member[] = [
      { email: 'x_owner@test.email.org', roles: ['Owner'] },
      { email: 'user@test.email.org', roles: ['User'] },
    ];
    const user = userEvent.setup();

    // Act
    renderWithAppContexts(
      <Members
        billingProjectName='test-project'
        isOwner
        projectMembers={projectUsers}
        memberAdded={jest.fn()}
        memberEdited={jest.fn()}
        deleteMember={jest.fn()}
      />
    );

    // Assert
    const roleButton = screen.getByText('Roles');
    await user.click(roleButton);
    const userTable = screen.getByRole('table');
    const users = within(userTable).getAllByRole('row');
    expect(users).toHaveLength(3); // 1 header row + 2 user rows
    // users sort initially by email, clicking on role causes sorting by role
    expect(users[1]).toHaveTextContent(/x_owner@test.email.orgOwner/);
    expect(users[2]).toHaveTextContent(/user@test.email.orgUser/);
  });

  it('supports adding a member for owners', async () => {
    // Arrange
    const projectUsers: Member[] = [{ email: 'owner@test.email.org', roles: ['Owner'] }];
    const user = userEvent.setup();

    const addProjectUsers: MockedFn<BillingContract['addProjectUsers']> = jest.fn();
    asMockedFn(Billing).mockReturnValue(partial<BillingContract>({ addProjectUsers }));
    // Next 2 mocks are needed for suggestions in the NewUserModal.
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

    const userAddedCallback = jest.fn();

    // Act
    renderWithAppContexts(
      <Members
        billingProjectName='test-project'
        isOwner
        projectMembers={projectUsers}
        memberAdded={userAddedCallback}
        memberEdited={jest.fn()}
        deleteMember={jest.fn()}
      />
    );
    // Open add users dialog
    const addUserButton = screen.getByText('Add Users');
    await user.click(addUserButton);
    // Get the email select and type in a user email
    const emailSelect = screen.getByLabelText('Type or select user emails');
    await user.type(emailSelect, 'test-user@company.com');
    // Save button ("Add Users") within the dialog, as opposed to the one that opened the dialog.
    const saveButton = within(screen.getByRole('dialog')).getByText('Add Users');
    await user.click(saveButton);

    // Assert
    // expect(emailSelect).toHaveValue('test-user@company.com');
    // expect(userAddedCallback).toHaveBeenCalled();
    // expect(addProjectUsers).toHaveBeenCalledWith('test-project', ['User'], ['test-user@company.com']);

    // The actual display of the dialog to add a user is done in the parent file.
  });

  it('does not show the Add Users button for non-owners', async () => {
    // Arrange
    const projectUsers: Member[] = [{ email: 'owner@test.email.org', roles: ['Owner'] }];

    // Act
    renderWithAppContexts(
      <Members
        billingProjectName='test-project'
        isOwner={false}
        projectMembers={projectUsers}
        memberAdded={jest.fn()}
        memberEdited={jest.fn()}
        deleteMember={jest.fn()}
      />
    );

    // Assert
    expect(screen.queryByText('Add Users')).toBeNull();
  });

  it('disables the action menu for an owner if there are not multiple owners', async () => {
    // Arrange
    const ownerEmail = 'owner@test.email.org';
    const projectUsers: Member[] = [{ email: ownerEmail, roles: ['Owner'] }];

    // Act
    renderWithAppContexts(
      <Members
        billingProjectName='test-project'
        isOwner
        projectMembers={projectUsers}
        memberAdded={jest.fn()}
        memberEdited={jest.fn()}
        deleteMember={jest.fn()}
      />
    );

    // Assert
    expect(screen.getByLabelText(`Menu for User: ${ownerEmail}`)).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not show an action menu if the user is not an owner', async () => {
    // Arrange
    const userEmail = 'user@test.email.org';
    const projectUsers: Member[] = [
      { email: 'owner@test.email.org', roles: ['Owner'] },
      { email: userEmail, roles: ['User'] },
    ];

    // Act
    renderWithAppContexts(
      <Members
        billingProjectName='test-project'
        isOwner={false}
        projectMembers={projectUsers}
        memberAdded={jest.fn()}
        memberEdited={jest.fn()}
        deleteMember={jest.fn()}
      />
    );

    // Assert
    expect(screen.queryByLabelText(`Menu for User: ${userEmail}`)).toBeNull();
  });

  it('supports deleting an owner if there are multiple owners', async () => {
    // Arrange
    const ownerEmail = 'owner@test.email.org';
    const projectUsers: Member[] = [
      { email: ownerEmail, roles: ['Owner'] },
      { email: 'owner2@test.email.org', roles: ['Owner'] },
    ];
    const user = userEvent.setup();
    const deleteMemberCallback = jest.fn();

    // Act
    renderWithAppContexts(
      <Members
        billingProjectName='test-project'
        isOwner
        projectMembers={projectUsers}
        memberAdded={jest.fn()}
        memberEdited={jest.fn()}
        deleteMember={deleteMemberCallback}
      />
    );
    const menu = screen.getByLabelText(`Menu for User: ${ownerEmail}`);
    expect(menu).toHaveAttribute('aria-disabled', 'false');
    await user.click(menu);
    const removeButton = screen.getByText('Remove User');
    await user.click(removeButton);
    // Confirm the remove
    await user.click(screen.getByText('Remove'));

    // Assert
    expect(deleteMemberCallback).toHaveBeenCalledWith({ email: ownerEmail, roles: ['Owner'] });
  });

  it('supports deleting a non-owner', async () => {
    // Arrange
    const userEmail = 'user@test.email.org';
    const projectUsers: Member[] = [
      { email: 'owner@test.email.org', roles: ['Owner'] },
      { email: userEmail, roles: ['User'] },
    ];
    const user = userEvent.setup();
    const deleteMemberCallback = jest.fn();

    // Act
    renderWithAppContexts(
      <Members
        billingProjectName='test-project'
        isOwner
        projectMembers={projectUsers}
        memberAdded={jest.fn()}
        memberEdited={jest.fn()}
        deleteMember={deleteMemberCallback}
      />
    );
    const menu = screen.getByLabelText(`Menu for User: ${userEmail}`);
    await user.click(menu);
    const removeButton = screen.getByText('Remove User');
    await user.click(removeButton);
    // Confirm the remove
    await user.click(screen.getByText('Remove'));

    // Assert
    expect(deleteMemberCallback).toHaveBeenCalledWith({ email: userEmail, roles: ['User'] });
  });

  it('supports editing a non-owner', async () => {
    // Arrange
    const userEmail = 'user@test.email.org';
    const projectUsers: Member[] = [
      { email: 'owner@test.email.org', roles: ['Owner'] },
      { email: userEmail, roles: ['User'] },
    ];
    const user = userEvent.setup();

    const changeUserRoles: MockedFn<BillingContract['changeUserRoles']> = jest.fn();
    asMockedFn(Billing).mockReturnValue(partial<BillingContract>({ changeUserRoles }));

    const editingUserCallback = jest.fn();

    // Act
    renderWithAppContexts(
      <Members
        billingProjectName='test-project'
        isOwner
        projectMembers={projectUsers}
        memberAdded={jest.fn()}
        memberEdited={editingUserCallback}
        deleteMember={jest.fn()}
      />
    );
    const menu = screen.getByLabelText(`Menu for User: ${userEmail}`);
    await user.click(menu);
    const editButton = screen.getByText('Edit Role');
    await user.click(editButton);
    // Toggle the checkbox
    const changeRoleButton = screen.getByLabelText('Can manage users (Owner)');
    await user.click(changeRoleButton);
    // Save the change.
    await user.click(screen.getByText('Change Role'));

    // Assert
    expect(editingUserCallback).toHaveBeenCalled();
    expect(changeUserRoles).toHaveBeenCalledWith('test-project', userEmail, ['User'], ['Owner']);
  });

  it('supports editing an owner if there are multiple owners', async () => {
    // Arrange
    const ownerEmail = 'owner@test.email.org';
    const projectUsers: Member[] = [
      { email: ownerEmail, roles: ['Owner'] },
      { email: 'owner2@test.email.org', roles: ['Owner'] },
    ];
    const user = userEvent.setup();

    const changeUserRoles: MockedFn<BillingContract['changeUserRoles']> = jest.fn();
    asMockedFn(Billing).mockReturnValue(partial<BillingContract>({ changeUserRoles }));

    const userEditedCallback = jest.fn();

    // Act
    renderWithAppContexts(
      <Members
        billingProjectName='test-project'
        isOwner
        projectMembers={projectUsers}
        memberAdded={jest.fn()}
        memberEdited={userEditedCallback}
        deleteMember={jest.fn()}
      />
    );
    const menu = screen.getByLabelText(`Menu for User: ${ownerEmail}`);
    await user.click(menu);
    const editButton = screen.getByText('Edit Role');
    await user.click(editButton);
    // Toggle the checkbox
    const changeRoleButton = screen.getByLabelText('Can manage users (Owner)');
    await user.click(changeRoleButton);
    // Save the change.
    await user.click(screen.getByText('Change Role'));

    // Assert
    expect(userEditedCallback).toHaveBeenCalled();
    expect(changeUserRoles).toHaveBeenCalledWith('test-project', ownerEmail, ['Owner'], ['User']);
  });
});
