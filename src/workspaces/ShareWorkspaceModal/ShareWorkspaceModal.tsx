import { Modal, modalStyles, Switch, TooltipTrigger, useUniqueId } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { validateUserEmails } from 'src/billing/utils';
import { ButtonPrimary, ButtonSecondary, spinnerOverlay } from 'src/components/common';
import { centeredSpinner } from 'src/components/icons';
import { EmailSelect } from 'src/groups/Members/EmailSelect';
import { Groups } from 'src/libs/ajax/Groups';
import { CurrentUserGroupMembership } from 'src/libs/ajax/Groups';
import { Metrics } from 'src/libs/ajax/Metrics';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { reportError } from 'src/libs/error';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import { append, cond, summarizeErrors, withBusyState } from 'src/libs/utils';
import {
  AccessEntry,
  aclEntryIsTerraSupport,
  terraSupportAccessLevel,
  terraSupportEmail,
  transformAcl,
  WorkspaceAcl,
} from 'src/workspaces/acl-utils';
import { AclInput } from 'src/workspaces/ShareWorkspaceModal/Collaborator';
import { CurrentCollaborators } from 'src/workspaces/ShareWorkspaceModal/CurrentCollaborators';
import { isAzureWorkspace, WorkspaceWrapper } from 'src/workspaces/utils';
import { WorkspacePolicies } from 'src/workspaces/WorkspacePolicies/WorkspacePolicies';
import validate from 'validate.js';

interface ShareWorkspaceModalProps {
  workspace: WorkspaceWrapper;
  onDismiss: () => void;
}

const ShareWorkspaceModal: React.FC<ShareWorkspaceModalProps> = (props: ShareWorkspaceModalProps) => {
  const { onDismiss, workspace } = props;
  const { namespace, name } = workspace.workspace;

  const defaultAcl: AccessEntry = {
    email: '',
    accessLevel: 'READER',
    pending: false,
    canShare: false,
    canCompute: false,
  };

  // State
  const [shareSuggestions, setShareSuggestions] = useState<string[]>([]);
  const [groups, setGroups] = useState<CurrentUserGroupMembership[]>([]);
  const [originalAcl, setOriginalAcl] = useState<WorkspaceAcl>([]);
  const [searchValues, setSearchValues] = useState<string[]>([]);
  const [acl, setAcl] = useState<WorkspaceAcl>([]);
  const [newAcl, setNewAcl] = useState<AccessEntry>(defaultAcl);
  const [loaded, setLoaded] = useState(false);
  const [working, setWorking] = useState(false);
  const [updateError, setUpdateError] = useState(undefined);
  const [lastAddedEmail, setLastAddedEmail] = useState<string | undefined>(undefined);
  const list = useRef<HTMLDivElement>(null);

  const signal = useCancellation();

  // Lifecycle
  useOnMount(() => {
    const load = async () => {
      try {
        const [{ acl }, shareSuggestions, groups] = await Promise.all([
          Workspaces(signal).workspace(namespace, name).getAcl(),
          Workspaces(signal).getShareLog(),
          Groups(signal).list(),
        ]);

        const fixedAcl: WorkspaceAcl = transformAcl(acl);
        setAcl(fixedAcl);
        setOriginalAcl(fixedAcl);
        setGroups(groups);
        setShareSuggestions(shareSuggestions);
        setLoaded(true);
      } catch (error) {
        onDismiss();
        reportError('Error looking up collaborators', error);
      }
    };

    load();
  });

  useLayoutEffect(() => {
    !!lastAddedEmail && list?.current?.scrollTo({ top: list?.current?.scrollHeight, behavior: 'smooth' });
  }, [lastAddedEmail]);

  // Render
  const errors = validateUserEmails(searchValues);
  const searchValuesValid = !!errors;
  const aclEmails = _.map('email', acl);

  const suggestions: string[] = _.flow(
    _.map('groupEmail'),
    _.concat(shareSuggestions),
    (list) => _.difference(list, aclEmails),
    _.uniq
  )(groups);

  const remainingSuggestions = _.difference(suggestions, _.map('email', acl));
  const addUserReminder =
    'Did you mean to add collaborators? Add them or clear the "User email(s)" field to save changes.';

  const addCollaborators = (collaboratorEmails: string[], collaboratorAcl: AccessEntry) => {
    collaboratorEmails.forEach((collaboratorEmail: string) => {
      if (!validate.single(collaboratorEmail, { email: true, exclusion: aclEmails })) {
        setAcl(append({ ...collaboratorAcl, email: collaboratorEmail } as AccessEntry));
        setLastAddedEmail(collaboratorEmail);
      }
    });
    // Clear the search values and new acl after adding collaborators
    setSearchValues([]);
    setNewAcl(defaultAcl);
  };

  const currentTerraSupportAccessLevel = terraSupportAccessLevel(originalAcl);
  const newTerraSupportAccessLevel = terraSupportAccessLevel(acl);
  const addTerraSupportToAcl = () => addCollaborators([terraSupportEmail], defaultAcl);
  const removeTerraSupportFromAcl = () => setAcl(_.remove(aclEntryIsTerraSupport));

  const save = withBusyState(setWorking, async () => {
    const aclEmails = _.map('email', acl);
    const needsDelete = _.remove((entry) => aclEmails.includes(entry.email), originalAcl);
    const numAdditions = _.filter(({ email }) => !_.some({ email }, originalAcl), acl).length;
    const eventData = { numAdditions, ...extractWorkspaceDetails(workspace.workspace) };

    // @ts-ignore
    const aclUpdates: WorkspaceAclUpdate[] = [
      ..._.flow(
        _.remove({ accessLevel: 'PROJECT_OWNER' }),
        _.map(_.pick(['email', 'accessLevel', 'canShare', 'canCompute']))
      )(acl),
      ..._.map(({ email }) => ({ email, accessLevel: 'NO ACCESS' }), needsDelete),
    ];

    try {
      await Workspaces().workspace(namespace, name).updateAcl(aclUpdates);
      !!numAdditions && void Metrics().captureEvent(Events.workspaceShare, { ...eventData, success: true });
      if (!currentTerraSupportAccessLevel && newTerraSupportAccessLevel) {
        void Metrics().captureEvent(Events.workspaceShareWithSupport, extractWorkspaceDetails(workspace.workspace));
      }
      onDismiss();
    } catch (error: any) {
      !!numAdditions && void Metrics().captureEvent(Events.workspaceShare, { ...eventData, success: false });
      setUpdateError(await error.text());
    }
  });

  const shareSupportId = useUniqueId('share-support');

  return (
    <Modal title='Share Workspace' width={720} showButtons={false} onDismiss={onDismiss}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
        <div style={{ flexGrow: 2, width: '500px' }}>
          <EmailSelect
            placeholder='Add people or groups'
            options={cond([remainingSuggestions.length > 0, () => remainingSuggestions], () => [])}
            emails={searchValues}
            setEmails={setSearchValues}
          />
        </div>
        <div style={{ flexGrow: 1 }}>
          <AclInput
            aria-label='permissions for new collaborator'
            value={newAcl}
            onChange={setNewAcl}
            disabled={false}
            maxAccessLevel={workspace.accessLevel}
            isAzureWorkspace={isAzureWorkspace(workspace)}
            showRow={false}
          />
        </div>
        <ButtonPrimary
          disabled={!!errors}
          tooltip={summarizeErrors(errors)}
          onClick={() => addCollaborators(searchValues, newAcl)}
        >
          Add
        </ButtonPrimary>
      </div>
      {!searchValuesValid && <p>{addUserReminder}</p>}
      <CurrentCollaborators
        acl={acl}
        setAcl={setAcl}
        originalAcl={originalAcl}
        lastAddedEmail={lastAddedEmail}
        workspace={workspace}
      />
      <WorkspacePolicies workspace={workspace} noCheckboxes />
      {!loaded && centeredSpinner()}
      {updateError && (
        <div style={{ marginTop: '1rem' }}>
          <div>An error occurred:</div>
          {updateError}
        </div>
      )}
      <div style={{ ...modalStyles.buttonRow, justifyContent: 'space-between' }}>
        <TooltipTrigger
          content={cond(
            [
              !currentTerraSupportAccessLevel && !newTerraSupportAccessLevel,
              () => 'Allow Terra Support to view this workspace',
            ],
            [
              !currentTerraSupportAccessLevel && !!newTerraSupportAccessLevel,
              () =>
                `Saving will grant Terra Support ${_.toLower(newTerraSupportAccessLevel!)} access to this workspace`,
            ],
            [
              !!currentTerraSupportAccessLevel && !newTerraSupportAccessLevel,
              () => "Saving will remove Terra Support's access to this workspace",
            ],
            [
              currentTerraSupportAccessLevel !== newTerraSupportAccessLevel,
              () =>
                `Saving will change Terra Support's level of access to this workspace from ${_.toLower(
                  currentTerraSupportAccessLevel!
                )} to ${_.toLower(newTerraSupportAccessLevel!)}`,
            ],
            [
              currentTerraSupportAccessLevel === newTerraSupportAccessLevel,
              () => `Terra Support has ${_.toLower(newTerraSupportAccessLevel!)} access to this workspace`,
            ]
          )}
        >
          {/* eslint-disable jsx-a11y/label-has-associated-control */}
          <label htmlFor={shareSupportId}>
            <span style={{ marginRight: '1ch' }}>Share with Support</span>
            <Switch
              id={shareSupportId}
              checked={!!newTerraSupportAccessLevel}
              onLabel='Yes'
              offLabel='No'
              width={70}
              onChange={(checked) => {
                if (checked) {
                  addTerraSupportToAcl();
                } else {
                  removeTerraSupportFromAcl();
                }
              }}
            />
          </label>
        </TooltipTrigger>
        <span>
          <ButtonSecondary style={{ marginRight: '1rem' }} onClick={onDismiss}>
            Cancel
          </ButtonSecondary>
          <ButtonPrimary disabled={!searchValuesValid} tooltip={!searchValuesValid && addUserReminder} onClick={save}>
            Save
          </ButtonPrimary>
        </span>
      </div>
      {working && spinnerOverlay}
    </Modal>
  );
};

export default ShareWorkspaceModal;
