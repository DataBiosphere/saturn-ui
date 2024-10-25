import { asMockedFn, partial } from '@terra-ui-packages/test-utils';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { WorkspaceContract, Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import { defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';
import LockWorkspaceModal from 'src/workspaces/LockWorkspaceModal/LockWorkspaceModal';
import { WorkspaceWrapper as Workspace } from 'src/workspaces/utils';

jest.mock('src/libs/ajax/workspaces/Workspaces');

const mockReportError = jest.fn();
type ErrorExports = typeof import('src/libs/error');
jest.mock('src/libs/error', (): ErrorExports => {
  return {
    ...jest.requireActual('src/libs/error'),
    reportError: (...args) => mockReportError(...args),
  };
});

describe('LockWorkspaceModal', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('contains lock button and message if the workspace is unlocked', () => {
    // Arrange
    const workspace: Workspace = {
      ...defaultGoogleWorkspace,
      workspace: { ...defaultGoogleWorkspace.workspace, isLocked: false },
    };
    const props = { workspace, onDismiss: () => {}, onSuccess: () => {} };

    // Act
    render(<LockWorkspaceModal {...props} />);

    // Assert
    const lockButton = screen.getByRole('button', { name: 'Lock Workspace' });
    expect(lockButton).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to lock this workspace/)).toBeInTheDocument;
  });

  it('contains unlock button and message if the workspace is locked', () => {
    // Arrange
    const workspace: Workspace = {
      ...defaultGoogleWorkspace,
      workspace: { ...defaultGoogleWorkspace.workspace, isLocked: true },
    };
    const props = { workspace, onDismiss: () => {}, onSuccess: () => {} };

    // Act
    render(<LockWorkspaceModal {...props} />);

    // Assert
    const unlockButton = screen.getByRole('button', { name: 'Unlock Workspace' });
    expect(unlockButton).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to unlock this workspace/)).toBeInTheDocument;
  });

  it('calls onDismiss, onSuccess, and locks unlocked workspace if the lock is toggled', async () => {
    // Arrange
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    const onSuccess = jest.fn();
    const lock = jest.fn();
    const workspace: Workspace = {
      ...defaultGoogleWorkspace,
      workspace: { ...defaultGoogleWorkspace.workspace, isLocked: false },
    };
    const props = { workspace, onDismiss, onSuccess };
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () => partial<WorkspaceContract>({ lock }),
      })
    );

    // Act
    render(<LockWorkspaceModal {...props} />);
    const lockButton = screen.getByRole('button', { name: 'Lock Workspace' });
    await user.click(lockButton);

    // Assert
    expect(onDismiss).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
    expect(lock).toHaveBeenCalled();
  });

  it('calls onDismiss, onSuccess, and unlocks locked workspace if the lock is toggled', async () => {
    // Arrange
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    const onSuccess = jest.fn();
    const unlock = jest.fn();
    const workspace: Workspace = {
      ...defaultGoogleWorkspace,
      workspace: { ...defaultGoogleWorkspace.workspace, isLocked: true },
    };
    const props = { workspace, onDismiss, onSuccess };
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () => partial<WorkspaceContract>({ unlock }),
      })
    );

    // Act
    render(<LockWorkspaceModal {...props} />);
    const unlockButton = screen.getByRole('button', { name: 'Unlock Workspace' });
    await user.click(unlockButton);

    // Assert
    expect(onDismiss).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
    expect(unlock).toHaveBeenCalled();
  });

  it('calls only onDismiss if the lock toggle is canceled', async () => {
    // Arrange
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    const onSuccess = jest.fn();
    const lock = jest.fn();
    const workspace: Workspace = {
      ...defaultGoogleWorkspace,
      workspace: { ...defaultGoogleWorkspace.workspace, isLocked: false },
    };
    const props = { workspace, onDismiss, onSuccess };
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () => partial<WorkspaceContract>({ lock }),
      })
    );

    // Act
    render(<LockWorkspaceModal {...props} />);
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    // Assert
    expect(onDismiss).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(lock).not.toHaveBeenCalled();
  });

  it('calls only onDismiss if the lock toggle causes an error', async () => {
    // Arrange
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    const onSuccess = jest.fn();
    const workspace: Workspace = {
      ...defaultGoogleWorkspace,
      workspace: { ...defaultGoogleWorkspace.workspace, isLocked: true },
    };
    const props = { workspace, onDismiss, onSuccess };
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () => {
          throw new Error();
        },
      })
    );

    // Act
    render(<LockWorkspaceModal {...props} />);
    const unlockButton = screen.getByRole('button', { name: 'Unlock Workspace' });
    await user.click(unlockButton);

    // Assert
    expect(onDismiss).toHaveBeenCalled();
    expect(mockReportError).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
