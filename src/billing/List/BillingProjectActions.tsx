import { Icon, Link } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { useState } from 'react';
import DeleteBillingProjectModal from 'src/billing/DeleteBillingProjectModal';
import { Billing } from 'src/libs/ajax/billing/Billing';
import { reportError } from 'src/libs/error';
import * as Nav from 'src/libs/nav';
import * as Utils from 'src/libs/utils';
import { WorkspaceWrapper } from 'src/workspaces/utils';

export interface BillingProjectActionsProps {
  projectName: string;
  loadProjects: () => void;
  workspacesLoading: boolean;
  allWorkspaces: WorkspaceWrapper[] | undefined;
}

export const BillingProjectActions = (props: BillingProjectActionsProps) => {
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasWorkspaces = _.find({ namespace: props.projectName }, _.map('workspace', props.allWorkspaces)) !== undefined;

  return (
    <div style={{ marginLeft: 'auto' }}>
      {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
      <Link
        disabled={props.workspacesLoading || hasWorkspaces}
        tooltip={Utils.cond(
          [props.workspacesLoading, () => 'Cannot delete billing project while workspaces are loading'],
          [hasWorkspaces, () => 'Cannot delete billing project because it contains workspaces'],
          () => `Delete billing project ${props.projectName}`
        )}
        style={{ padding: '0.5rem' }}
        onClick={() => setShowDeleteProjectModal(true)}
      >
        <Icon icon='trash' />
      </Link>

      {showDeleteProjectModal && (
        <DeleteBillingProjectModal
          projectName={props.projectName}
          deleting={deleting}
          onDismiss={() => setShowDeleteProjectModal(false)}
          onConfirm={async () => {
            setDeleting(true);
            try {
              await Billing().deleteProject(props.projectName);
              setShowDeleteProjectModal(false);
              props.loadProjects();
              Nav.history.replace({ search: '' });
            } catch (err) {
              reportError('Error deleting billing project.', err);
              setShowDeleteProjectModal(false);
            }
            setDeleting(false);
          }}
        />
      )}
    </div>
  );
};
