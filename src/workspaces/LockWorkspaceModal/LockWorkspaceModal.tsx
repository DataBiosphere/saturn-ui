import { Modal } from '@terra-ui-packages/components';
import React, { useState } from 'react';
import { ButtonPrimary, spinnerOverlay } from 'src/components/common';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { reportError } from 'src/libs/error';
import { withBusyState } from 'src/libs/utils';
import { WorkspaceWrapper as Workspace } from 'src/workspaces/utils';

interface LockWorkspaceModalProps {
  workspace: Workspace;
  onDismiss: () => void;
  onSuccess: () => void;
}

const LockWorkspaceModal = (props: LockWorkspaceModalProps) => {
  const {
    workspace: {
      workspace: { namespace, name, isLocked },
    },
    onDismiss,
    onSuccess,
  } = props;

  const [togglingLock, setTogglingLock] = useState(false);
  const helpText = isLocked ? 'Unlock Workspace' : 'Lock Workspace';

  const toggleWorkspaceLock = withBusyState(setTogglingLock)(async () => {
    try {
      isLocked
        ? await Workspaces().workspace(namespace, name).unlock()
        : await Workspaces().workspace(namespace, name).lock();
      onDismiss();
      onSuccess();
    } catch (error) {
      reportError('Error toggling workspace lock', error);
      onDismiss();
    }
  });

  return (
    <Modal
      title={helpText}
      onDismiss={onDismiss}
      okButton={<ButtonPrimary onClick={toggleWorkspaceLock}>{helpText}</ButtonPrimary>}
    >
      {isLocked ? (
        <div>
          {[
            'Are you sure you want to unlock this workspace?',
            'Collaborators will be able to modify the workspace after it is unlocked.',
          ]}
        </div>
      ) : (
        <div>
          {[
            'Are you sure you want to lock this workspace? ',
            'Collaborators will not be able to modify the workspace while it is locked.',
          ]}
        </div>
      )}
      {togglingLock && spinnerOverlay}
    </Modal>
  );
};

export default LockWorkspaceModal;
