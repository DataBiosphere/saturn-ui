import { act, screen } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import React from 'react';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import VersionActionMenu from 'src/workflows/VersionActionMenu';

const mockOnDelete = jest.fn();
const mockOnEditPermissions = jest.fn();
const mockOnClone = jest.fn();
const mockOnEdit = jest.fn();

describe('version action menu', () => {
  it('honors the disabled prop', async () => {
    // Act
    await act(async () => {
      render(
        <VersionActionMenu
          disabled
          isSnapshotOwner
          onEditPermissions={mockOnEditPermissions}
          onDelete={mockOnDelete}
          onClone={mockOnClone}
          onEdit={mockOnEdit}
        />
      );
    });

    // Assert
    const snapshotActionMenu = screen.getByRole('button', { name: 'Version action menu' });

    expect(snapshotActionMenu).toHaveAttribute('disabled');
    expect(snapshotActionMenu).toHaveAttribute('aria-disabled');
  });

  it('renders and enables correct menu buttons if you are the snapshot owner', async () => {
    // Arrange
    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <VersionActionMenu
          isSnapshotOwner
          onEditPermissions={mockOnEditPermissions}
          onDelete={mockOnDelete}
          onClone={mockOnClone}
          onEdit={mockOnEdit}
        />
      );
    });

    // Assert
    const snapshotActionMenu = screen.getByRole('button', { name: 'Version action menu' });

    expect(snapshotActionMenu).not.toHaveAttribute('disabled');
    expect(snapshotActionMenu).toHaveAttribute('aria-disabled', 'false');

    // Act
    await user.click(snapshotActionMenu);

    const editPermissionsButton = screen.getByRole('button', { name: 'Edit version permissions' });

    await user.pointer({ target: editPermissionsButton });

    // Assert
    expect(editPermissionsButton).toBeInTheDocument();
    expect(editPermissionsButton).toHaveAttribute('aria-disabled', 'false');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Act
    const deleteSnapshotButton = screen.getByRole('button', { name: 'Delete version' });

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

    // Act
    const editMethodButton = screen.getByRole('button', { name: 'Edit' });

    await user.pointer({ target: editMethodButton });

    // Assert
    expect(editMethodButton).toBeInTheDocument();
    expect(editMethodButton).toHaveAttribute('aria-disabled', 'false');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders and enables correct menu buttons if you are NOT the snapshot owner', async () => {
    // Arrange
    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <VersionActionMenu
          isSnapshotOwner={false}
          onEditPermissions={mockOnEditPermissions}
          onDelete={mockOnDelete}
          onClone={mockOnClone}
          onEdit={mockOnEdit}
        />
      );
    });

    // Assert
    const snapshotActionMenu = screen.getByRole('button', { name: 'Version action menu' });

    expect(snapshotActionMenu).not.toHaveAttribute('disabled');
    expect(snapshotActionMenu).toHaveAttribute('aria-disabled', 'false');

    // Act
    await user.click(snapshotActionMenu);

    const editPermissionsButton = screen.getByRole('button', { name: 'Edit version permissions' });

    await user.pointer({ target: editPermissionsButton });

    // Assert
    expect(editPermissionsButton).toBeInTheDocument();
    expect(editPermissionsButton).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    // Act
    const deleteSnapshotButton = screen.getByRole('button', { name: 'Delete version' });

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

    // Act
    const editMethodButton = screen.getByRole('button', { name: 'Edit' });

    await user.pointer({ target: editMethodButton });

    // Assert
    expect(editMethodButton).toBeInTheDocument();
    expect(editMethodButton).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('tooltip')).toBeInTheDocument();
  });
});

describe('version action menu edit version permissions button', () => {
  it('closes and calls the onEditPermissions callback when you press it', async () => {
    // Arrange
    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <VersionActionMenu
          isSnapshotOwner
          onEditPermissions={mockOnEditPermissions}
          onDelete={mockOnDelete}
          onClone={mockOnClone}
          onEdit={mockOnEdit}
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Edit version permissions' }));

    expect(screen.queryByRole('button', { name: 'Edit version permissions' })).not.toBeInTheDocument();
    expect(mockOnEditPermissions).toHaveBeenCalled();
    expect(mockOnDelete).not.toHaveBeenCalled();
  });
});

describe('version action menu delete version button', () => {
  it('closes and calls the onDelete callback when you press it', async () => {
    // Arrange
    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <VersionActionMenu
          isSnapshotOwner
          onEditPermissions={mockOnEditPermissions}
          onDelete={mockOnDelete}
          onClone={mockOnClone}
          onEdit={mockOnEdit}
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Delete version' }));

    // Assert
    expect(screen.queryByRole('button', { name: 'Delete version' })).not.toBeInTheDocument();
    expect(mockOnDelete).toHaveBeenCalled();
    expect(mockOnEditPermissions).not.toHaveBeenCalled();
  });
});

describe('version action menu save as button', () => {
  it('closes and calls the onClone callback when clicked', async () => {
    // Arrange
    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <VersionActionMenu
          isSnapshotOwner
          onEditPermissions={mockOnEditPermissions}
          onDelete={mockOnDelete}
          onClone={mockOnClone}
          onEdit={mockOnEdit}
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Save as' }));

    // Assert
    expect(screen.queryByRole('button', { name: 'Save as' })).not.toBeInTheDocument();
    expect(mockOnClone).toHaveBeenCalled();
  });
});

describe('version action menu edit button', () => {
  it('closes and calls the onEdit callback when clicked', async () => {
    // Arrange
    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <VersionActionMenu
          isSnapshotOwner
          onEditPermissions={mockOnEditPermissions}
          onDelete={mockOnDelete}
          onClone={mockOnClone}
          onEdit={mockOnEdit}
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Version action menu' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    // Assert
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(mockOnEdit).toHaveBeenCalled();
  });
});
