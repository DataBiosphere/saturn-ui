import { act, screen, within } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import React from 'react';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import DeleteSnapshotModal from 'src/workflows/methods/modals/DeleteSnapshotModal';

const mockOnConfirm = jest.fn();
const mockOnDismiss = jest.fn();

describe('delete snapshot modal', () => {
  it('displays relevant snapshot information', async () => {
    // Act
    await act(async () => {
      render(
        <DeleteSnapshotModal
          namespace='testnamespace'
          name='methodname'
          snapshotId='3'
          onConfirm={mockOnConfirm}
          onDismiss={mockOnDismiss}
        />
      );
    });

    // Assert
    const dialog = screen.getByRole('dialog', { name: 'Delete version' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('3', { exact: false })).toBeInTheDocument();
    expect(within(dialog).getByText('testnamespace', { exact: false })).toBeInTheDocument();
    expect(within(dialog).getByText('methodname', { exact: false })).toBeInTheDocument();
  });

  it('calls onConfirm callback when the delete snapshot button is pressed', async () => {
    // Arrange
    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <DeleteSnapshotModal
          namespace='testnamespace'
          name='methodname'
          snapshotId='3'
          onConfirm={mockOnConfirm}
          onDismiss={mockOnDismiss}
        />
      );
    });

    await user.click(screen.getByRole('button', { name: /delete version/i }));

    // Assert
    expect(mockOnConfirm).toHaveBeenCalled();
    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it('calls onDismiss callback when the modal is dismissed', async () => {
    // Arrange
    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <DeleteSnapshotModal
          namespace='testnamespace'
          name='methodname'
          snapshotId='3'
          onConfirm={mockOnConfirm}
          onDismiss={mockOnDismiss}
        />
      );
    });

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    // Assert
    expect(mockOnConfirm).not.toHaveBeenCalled();
    expect(mockOnDismiss).toHaveBeenCalled();
  });
});
