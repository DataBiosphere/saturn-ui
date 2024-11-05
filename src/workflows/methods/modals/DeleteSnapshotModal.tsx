import React, { ReactNode } from 'react';
import { DeleteConfirmationModal } from 'src/components/common';

interface DeleteSnapshotModalProps {
  /** The namespace of the workflow snapshot to be deleted (for display). */
  namespace: string;

  /** The name of the workflow snapshot to be deleted (for display). */
  name: string;

  /** The snapshot ID of the workflow snapshot to be deleted (for display). */
  snapshotId: string;

  /**
   * The action to be performed if the deletion is confirmed (should include the
   * API call to delete the snapshot).
   */
  onConfirm: () => void;

  /** The action to be performed if the modal is dismissed. */
  onDismiss: () => void;
}

/**
 * A modal to confirm the deletion of a workflow snapshot from the Broad Methods
 * Repository.
 *
 * The onConfirm prop is passed directly to the underlying modal; this component
 * does not already include the API call to perform the snapshot deletion.
 */
const DeleteSnapshotModal = (props: DeleteSnapshotModalProps): ReactNode => {
  const { namespace, name, snapshotId, onConfirm, onDismiss } = props;

  return (
    <DeleteConfirmationModal
      objectType='snapshot'
      objectName={`${namespace}/${name}/${snapshotId}`}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    >
      <p>
        Are you sure you want to delete snapshot <b>{snapshotId}</b> of the method{' '}
        <b>
          {namespace}/{name}
        </b>
        {/*
         */}
        ?
      </p>
      <p>Exports of this snapshot in workspaces will no longer run.</p>
      <p>
        <strong>This cannot be undone.</strong>
      </p>
    </DeleteConfirmationModal>
  );
};

export default DeleteSnapshotModal;
