import { ButtonOutline, ExternalLink, Modal, SpinnerOverlay } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React from 'react';
import { ReactNode, useState } from 'react';
import { ButtonPrimary } from 'src/components/common';
import { CurrentUserGroupMembership, Groups } from 'src/libs/ajax/Groups';
import { SamResources } from 'src/libs/ajax/SamResources';
import { withErrorReporting } from 'src/libs/error';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import { getTerraUser } from 'src/libs/state';
import { cond, withBusyState } from 'src/libs/utils';
import { DeleteWorkspaceModal } from 'src/workspaces/DeleteWorkspaceModal/DeleteWorkspaceModal';
import {
  azureControlledAccessRequestMessage,
  GoogleWorkspaceInfo,
  isAzureWorkspace,
  WorkspaceWrapper as Workspace,
} from 'src/workspaces/utils';

interface RequestAccessModalProps {
  onDismiss: () => void;
  workspace: Workspace;
  refreshWorkspaces: () => void;
}

export const RequestAccessModal = (props: RequestAccessModalProps): ReactNode => {
  const [deleting, setDeleting] = useState(false);

  if (isAzureWorkspace(props.workspace)) {
    return <AzureRequestAccessModal onDismiss={props.onDismiss} />;
  }

  if (deleting) {
    return (
      <DeleteWorkspaceModal
        workspace={props.workspace}
        onDismiss={props.onDismiss}
        onSuccess={props.refreshWorkspaces}
      />
    );
  }

  return (
    <GcpRequestAccessModal
      onDismiss={props.onDismiss}
      workspaceInfo={props.workspace.workspace}
      setDeleting={setDeleting}
    />
  );
};

interface GcpRequestAccessModalProps {
  onDismiss: () => void;
  workspaceInfo: GoogleWorkspaceInfo;
  setDeleting: (boolean) => void;
}

const GcpRequestAccessModal = (props: GcpRequestAccessModalProps): ReactNode => {
  const [groups, setGroups] = useState<CurrentUserGroupMembership[]>([]);
  const [loading, setLoading] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const signal = useCancellation();
  const workspace = props.workspaceInfo;

  const fetchGroups = async () => {
    const [groups, canDelete] = await Promise.all([
      Groups(signal).list(),
      SamResources(signal).canDelete({ resourceTypeName: 'workspace', resourceId: workspace.workspaceId }),
    ]);
    setGroups(groups);
    setCanDelete(canDelete);
  };

  useOnMount(() => {
    const load = _.flow(
      withBusyState(setLoading),
      withErrorReporting('Error loading groups')
    )(async () => {
      await fetchGroups();
    });
    load();
  });

  const groupNames = _.map('groupName', groups);

  return (
    <Modal title='Request Access' width='40rem' showButtons={false} onDismiss={props.onDismiss}>
      {loading ? (
        <SpinnerOverlay />
      ) : (
        <>
          <div>
            You cannot access this workspace because it is protected by an Authorization Domain. You need to obtain
            permission from an admin of each group in the Authorization Domain in order to get access. Clicking the
            &quot;Request Access&quot; button below will send an email to the admins of that group.
          </div>
          <div style={{ marginTop: '1rem' }}>
            <ExternalLink href='https://support.terra.bio/hc/en-us/articles/360026775691'>
              Learn more about Authorization Domains
            </ExternalLink>
          </div>
          <table style={{ margin: '1rem', width: '100%' }}>
            <thead>
              <tr style={{ height: '2rem' }}>
                <th style={{ textAlign: 'left' }}>Group Name</th>
                <th style={{ textAlign: 'left', width: '15rem' }}>Access</th>
              </tr>
            </thead>
            <tbody>
              {_.map(
                ({ membersGroupName: groupName }) => (
                  <tr style={{ height: '2rem' }} key={groupName}>
                    <td>{groupName}</td>
                    <td>
                      {_.includes(groupName, groupNames) ? (
                        <span style={{ fontWeight: 600 }}>Yes</span>
                      ) : (
                        <RequestAccessButton groupName={groupName} />
                      )}
                    </td>
                  </tr>
                ),
                workspace.authorizationDomain
              )}
            </tbody>
          </table>
          {canDelete && (
            <div style={{ marginTop: '2.0rem', marginBottom: '2.0rem' }}>
              <span style={{ fontWeight: 'bold', marginRight: '.5rem' }}>Note:</span>
              <span>You are an owner of this workspace and can choose to delete it.</span>
            </div>
          )}
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end' }}>
            {canDelete && (
              <ButtonOutline style={{ marginRight: '1.0rem' }} onClick={props.setDeleting}>
                Delete Workspace
              </ButtonOutline>
            )}
            <ButtonPrimary onClick={props.onDismiss}>Return to List</ButtonPrimary>
          </div>
        </>
      )}
    </Modal>
  );
};

interface RequestAccessButtonProps {
  groupName: string;
}

const RequestAccessButton = (props: RequestAccessButtonProps): ReactNode => {
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  const signal = useCancellation();

  const requestAccess = _.flow(
    withBusyState(setRequesting),
    withErrorReporting('Error requesting group access')
  )(async () => {
    await Groups(signal).group(props.groupName).requestAccess();
    setRequested(true);
  });

  return (
    <ButtonPrimary
      disabled={requesting || requested}
      aria-label={`Request access to ${props.groupName}`}
      onClick={async () => {
        await requestAccess();
      }}
    >
      {cond([requested, () => 'Request Sent'], [requesting, () => 'Sending Request...'], () => 'Request Access')}
    </ButtonPrimary>
  );
};

interface AzureRequestAccessModalProps {
  onDismiss: () => void;
}

const AzureRequestAccessModal = (props: AzureRequestAccessModalProps): ReactNode => {
  return (
    <Modal title='No Workspace Access' width='40rem' showCancel={false} onDismiss={props.onDismiss}>
      You are currently logged in as
      <span style={{ fontWeight: 600 }}>{getTerraUser().email}</span>. You may have access with a different account, or
      your linked identity may have expired.
      <ExternalLink href='https://support.terra.bio/hc/en-us/articles/19124069598235'>
        Learn more about linking your NIH account
      </ExternalLink>
      <p>{azureControlledAccessRequestMessage}</p>
    </Modal>
  );
};
