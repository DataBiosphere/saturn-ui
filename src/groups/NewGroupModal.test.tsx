import { fireEvent, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React from 'react';
import { NewGroupModal } from 'src/groups/NewGroupModal';
import { GroupContract, Groups, GroupsContract } from 'src/libs/ajax/Groups';
import { asMockedFn, MockedFn, partial, renderWithAppContexts as render } from 'src/testing/test-utils';

type ErrorExports = typeof import('src/libs/error');
const mockReportError = jest.fn();

jest.mock(
  'src/libs/error',
  (): ErrorExports => ({
    ...jest.requireActual('src/libs/error'),
    reportError: (...args) => mockReportError(...args),
  })
);

jest.mock('src/libs/ajax/Groups');

describe('NewGroupModal', () => {
  it('renders correctly', () => {
    // Arrange
    // Act
    const { getByText } = render(<NewGroupModal onDismiss={jest.fn()} onSuccess={jest.fn()} existingGroups={[]} />);
    // Assert
    expect(getByText('Create Group')).toBeInTheDocument();
  });

  it('updates the admin notifier checkbox state correctly', async () => {
    // Arrange
    const user = userEvent.setup();
    const { getByLabelText } = render(
      <NewGroupModal onDismiss={jest.fn()} onSuccess={jest.fn()} existingGroups={[]} />
    );
    const checkbox = getByLabelText('Allow anyone to request access');
    expect(checkbox).toBeChecked();
    // Act
    await user.click(checkbox);
    // Assert
    expect(checkbox).not.toBeChecked();
  });

  it('enables the create button if the form is valid', async () => {
    // Arrange
    const { getByText, getByLabelText } = render(
      <NewGroupModal onDismiss={jest.fn()} onSuccess={jest.fn()} existingGroups={[]} />
    );
    // Act
    expect(getByText('Create Group')).toHaveAttribute('aria-disabled', 'true');
    const nameInput = getByLabelText('Enter a unique name *');
    fireEvent.change(nameInput, { target: { value: 'ValidName' } });
    // Assert
    await waitFor(() => expect(getByText('Create Group')).not.toBeDisabled());
  });

  it('displays an error for invalid input', async () => {
    // Arrange
    const { getByText, getByLabelText } = render(
      <NewGroupModal onDismiss={jest.fn()} onSuccess={jest.fn()} existingGroups={[]} />
    );
    // Act
    const nameInput = getByLabelText('Enter a unique name *');
    fireEvent.change(nameInput, { target: { value: 'Invalid Name&' } });

    // Assert
    waitFor(() =>
      expect(getByText('Group name can only contain letters, numbers, underscores, and dashes')).toBeInTheDocument()
    );
  });

  it('detects when the group name is empty but has been changed', async () => {
    // Arrange
    const user = userEvent.setup();
    const { getByText, getByLabelText } = render(
      <NewGroupModal onDismiss={jest.fn()} onSuccess={jest.fn()} existingGroups={[]} />
    );
    // Act
    const nameInput = getByLabelText('Enter a unique name *');
    fireEvent.change(nameInput, { target: { value: 'Valid Name' } });
    await waitFor(() => expect(nameInput).toHaveValue('Valid Name'));
    await user.clear(nameInput);
    // Assert
    expect(getByText("Group name can't be blank")).toBeInTheDocument();
  });

  it('does not allow a group name that already exists ', async () => {
    // Arrange
    const existingName = 'Existing name';
    const { getByText, getByLabelText } = render(
      <NewGroupModal onDismiss={jest.fn()} onSuccess={jest.fn()} existingGroups={[existingName]} />
    );
    // Act
    const nameInput = getByLabelText('Enter a unique name *');
    fireEvent.change(nameInput, { target: { value: existingName } });
    // Assert
    await waitFor(() => expect(getByText('Group name already exists')).toBeInTheDocument());
  });

  it('calls submit function on form submission with valid data', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockCreateFn: MockedFn<GroupContract['create']> = jest.fn(async () => undefined);
    const mockSetPolicyFn: MockedFn<GroupContract['setPolicy']> = jest.fn(async (_name, _value) => undefined);
    asMockedFn(Groups).mockReturnValue(
      partial<GroupsContract>({
        group: () =>
          partial<GroupContract>({
            create: mockCreateFn,
            setPolicy: mockSetPolicyFn,
          }),
      })
    );
    const mockOnSuccessFn = jest.fn();
    const { getByText, getByLabelText } = render(
      <NewGroupModal onDismiss={jest.fn()} onSuccess={mockOnSuccessFn} existingGroups={[]} />
    );
    const nameInput = getByLabelText('Enter a unique name *');
    fireEvent.change(nameInput, { target: { value: 'ValidName' } });
    await waitFor(() => expect(nameInput).toHaveValue('ValidName'));
    const submitButton = getByText('Create Group');
    expect(submitButton).toBeEnabled();
    // Act
    await user.click(submitButton);
    // Assert
    expect(mockCreateFn).toHaveBeenCalled();
    expect(mockSetPolicyFn).toHaveBeenCalledWith('admin-notifier', true);
    expect(mockOnSuccessFn).toHaveBeenCalled();
  });
});
