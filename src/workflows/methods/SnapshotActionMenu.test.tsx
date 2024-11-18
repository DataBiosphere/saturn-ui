import { act, screen } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import React from 'react';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import SnapshotActionMenu from 'src/workflows/methods/SnapshotActionMenu';

const mockOnDelete = jest.fn();
const mockOnEditPermissions = jest.fn();
const mockOnClone = jest.fn();

describe('snapshot action menu', () => {
  it('honors the disabled prop', async () => {
    // Act
    await act(async () => {
      render(
        <SnapshotActionMenu
          disabled
          isSnapshotOwner
          onEditPermissions={mockOnEditPermissions}
          onDelete={mockOnDelete}
          onClone={mockOnClone}
        />
      );
    });

    // Assert
    const snapshotActionMenu = screen.getByRole('button', { name: 'Snapshot action menu' });

    expect(snapshotActionMenu).toHaveAttribute('disabled');
    expect(snapshotActionMenu).toHaveAttribute('aria-disabled');
  });

  it('renders and enables correct menu buttons if you are the snapshot owner', async () => {
    // Arrange
    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <SnapshotActionMenu
          isSnapshotOwner
          onEditPermissions={mockOnEditPermissions}
          onDelete={mockOnDelete}
          onClone={mockOnClone}
        />
      );
    });

    // Assert
    const snapshotActionMenu = screen.getByRole('button', { name: 'Snapshot action menu' });

    expect(snapshotActionMenu).not.toHaveAttribute('disabled');
    expect(snapshotActionMenu).toHaveAttribute('aria-disabled', 'false');

    // Act
    await user.click(snapshotActionMenu);

    const editPermissionsButton = screen.getByRole('button', { name: 'Edit snapshot permissions' });

    await user.pointer({ target: editPermissionsButton });

    // Assert
    expect(editPermissionsButton).toBeInTheDocument();
    expect(editPermissionsButton).toHaveAttribute('aria-disabled', 'false');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Act
    const deleteSnapshotButton = screen.getByRole('button', { name: 'Delete snapshot' });

    await user.pointer({ target: deleteSnapshotButton });

    // Assert
    expect(deleteSnapshotButton).toBeInTheDocument();
    expect(deleteSnapshotButton).toHaveAttribute('aria-disabled', 'false');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Act
    const cloneSnapshotButton = screen.getByRole('button', { name: 'Save as' });

    // Assert
    // clone option is always enabled irrespective of snapshot ownership
    expect(cloneSnapshotButton).toBeInTheDocument();
    expect(cloneSnapshotButton).toHaveAttribute('aria-disabled', 'false');
  });

  it('renders and enables correct menu buttons if you are NOT the snapshot owner', async () => {
    // Arrange
    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <SnapshotActionMenu
          isSnapshotOwner={false}
          onEditPermissions={mockOnEditPermissions}
          onDelete={mockOnDelete}
          onClone={mockOnClone}
        />
      );
    });

    // Assert
    const snapshotActionMenu = screen.getByRole('button', { name: 'Snapshot action menu' });

    expect(snapshotActionMenu).not.toHaveAttribute('disabled');
    expect(snapshotActionMenu).toHaveAttribute('aria-disabled', 'false');

    // Act
    await user.click(snapshotActionMenu);

    const editPermissionsButton = screen.getByRole('button', { name: 'Edit snapshot permissions' });

    await user.pointer({ target: editPermissionsButton });

    // Assert
    expect(editPermissionsButton).toBeInTheDocument();
    expect(editPermissionsButton).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    // Act
    const deleteSnapshotButton = screen.getByRole('button', { name: 'Delete snapshot' });

    await user.pointer({ target: deleteSnapshotButton });

    // Assert
    expect(deleteSnapshotButton).toBeInTheDocument();
    expect(deleteSnapshotButton).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    // Act
    const cloneSnapshotButton = screen.getByRole('button', { name: 'Save as' });
    await user.pointer({ target: cloneSnapshotButton });

    // Assert
    // clone option is always enabled irrespective of snapshot ownership
    expect(cloneSnapshotButton).toBeInTheDocument();
    expect(cloneSnapshotButton).toHaveAttribute('aria-disabled', 'false');
  });
});

describe('snapshot action menu edit snapshot permissions button', () => {
  it('closes and calls the onEditPermissions callback when you press it', async () => {
    // Arrange
    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <SnapshotActionMenu
          isSnapshotOwner
          onEditPermissions={mockOnEditPermissions}
          onDelete={mockOnDelete}
          onClone={mockOnClone}
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Snapshot action menu' }));
    await user.click(screen.getByRole('button', { name: 'Edit snapshot permissions' }));

    expect(screen.queryByRole('button', { name: 'Edit snapshot permissions' })).not.toBeInTheDocument();
    expect(mockOnEditPermissions).toHaveBeenCalled();
    expect(mockOnDelete).not.toHaveBeenCalled();
  });
});

describe('snapshot action menu delete snapshot button', () => {
  it('closes and calls the onDelete callback when you press it', async () => {
    // Arrange
    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <SnapshotActionMenu
          isSnapshotOwner
          onEditPermissions={mockOnEditPermissions}
          onDelete={mockOnDelete}
          onClone={mockOnClone}
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Snapshot action menu' }));
    await user.click(screen.getByRole('button', { name: 'Delete snapshot' }));

    // Assert
    expect(screen.queryByRole('button', { name: 'Delete snapshot' })).not.toBeInTheDocument();
    expect(mockOnDelete).toHaveBeenCalled();
    expect(mockOnEditPermissions).not.toHaveBeenCalled();
  });
});

describe('snapshot action menu save as button', () => {
  it('closes and calls the onClone callback when clicked', async () => {
    // Arrange
    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <SnapshotActionMenu
          isSnapshotOwner
          onEditPermissions={mockOnEditPermissions}
          onDelete={mockOnDelete}
          onClone={mockOnClone}
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Snapshot action menu' }));
    await user.click(screen.getByRole('button', { name: 'Save as' }));

    // Assert
    expect(screen.queryByRole('button', { name: 'Save as' })).not.toBeInTheDocument();
    expect(mockOnClone).toHaveBeenCalled();
  });
});
