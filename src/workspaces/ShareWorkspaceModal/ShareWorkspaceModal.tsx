import { Modal, modalStyles, Switch, TooltipTrigger, useUniqueId } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { ButtonPrimary, ButtonSecondary, spinnerOverlay } from 'src/components/common';
import { centeredSpinner } from 'src/components/icons';
import { AutocompleteTextInput } from 'src/components/input';
import { Groups } from 'src/libs/ajax/Groups';
import { CurrentUserGroupMembership } from 'src/libs/ajax/Groups';
import { Metrics } from 'src/libs/ajax/Metrics';
import { WorkspaceAclUpdate } from 'src/libs/ajax/workspaces/workspace-models';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { reportError } from 'src/libs/error';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { FormLabel } from 'src/libs/forms';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import { append, cond, withBusyState } from 'src/libs/utils';
import {
  AccessEntry,
  aclEntryIsTerraSupport,
  terraSupportAccessLevel,
  terraSupportEmail,
  transformAcl,
  WorkspaceAcl,
} from 'src/workspaces/acl-utils';
import { CurrentCollaborators } from 'src/workspaces/ShareWorkspaceModal/CurrentCollaborators';
import { WorkspaceWrapper } from 'src/workspaces/utils';
import { WorkspacePolicies } from 'src/workspaces/WorkspacePolicies/WorkspacePolicies';
import validate from 'validate.js';

interface ShareWorkspaceModalProps {
  workspace: WorkspaceWrapper;
  onDismiss: () => void;
}

const ShareWorkspaceModal: React.FC<ShareWorkspaceModalProps> = (props: ShareWorkspaceModalProps) => {
  const { onDismiss, workspace } = props;
  const { namespace, name } = workspace.workspace;

  // State
  const [shareSuggestions, setShareSuggestions] = useState<string[]>([]);
  const [groups, setGroups] = useState<CurrentUserGroupMembership[]>([]);
  const [originalAcl, setOriginalAcl] = useState<WorkspaceAcl>([]);
  const [searchValue, setSearchValue] = useState('');
  const [acl, setAcl] = useState<WorkspaceAcl>([]);
  const [loaded, setLoaded] = useState(false);
  const [working, setWorking] = useState(false);
  const [updateError, setUpdateError] = useState(undefined);
  const [lastAddedEmail, setLastAddedEmail] = useState(undefined);
  const [searchHasFocus, setSearchHasFocus] = useState(true);
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
  const searchValueValid = !validate({ searchValue }, { searchValue: { email: true } });
  const aclEmails = _.map('email', acl);

  const suggestions: string[] = _.flow(
    _.map('groupEmail'),
    _.concat(shareSuggestions),
    (list) => _.difference(list, aclEmails),
    _.uniq
  )(groups);

  const remainingSuggestions = _.difference(suggestions, _.map('email', acl));

  const addUserReminder = `Did you mean to add ${searchValue} as a collaborator? Add them or clear the "User email" field to save changes.`;

  const addCollaborator = (collaboratorEmail) => {
    if (!validate.single(collaboratorEmail, { email: true, exclusion: aclEmails })) {
      setSearchValue('');
      setAcl(append({ email: collaboratorEmail, accessLevel: 'READER' } as AccessEntry));
      setLastAddedEmail(collaboratorEmail);
    }
  };

  const currentTerraSupportAccessLevel = terraSupportAccessLevel(originalAcl);
  const newTerraSupportAccessLevel = terraSupportAccessLevel(acl);
  const addTerraSupportToAcl = () => addCollaborator(terraSupportEmail);
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

  const newEntryId = useUniqueId('new-entry');
  const shareSupportId = useUniqueId('share-support');

  return (
    <Modal title='Share Workspace' width={550} showButtons={false} onDismiss={onDismiss}>
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <div style={{ flexGrow: 1, marginRight: '1rem' }}>
          <FormLabel id={newEntryId}>User email</FormLabel>
          <AutocompleteTextInput
            labelId={newEntryId}
            openOnFocus
            placeholderText={
              _.includes(searchValue, aclEmails)
                ? 'This email has already been added to the list'
                : 'Type an email address and press "Enter" or "Return"'
            }
            onPick={addCollaborator}
            placeholder='Add people or groups'
            value={searchValue}
            onFocus={() => setSearchHasFocus(true)}
            onBlur={() => setSearchHasFocus(false)}
            onChange={setSearchValue}
            suggestions={cond(
              [searchValueValid && !_.includes(searchValue, aclEmails), () => [searchValue]],
              [remainingSuggestions.length > 0, () => remainingSuggestions],
              () => []
            )}
            style={{ fontSize: 16 }}
          />
        </div>
        <ButtonPrimary
          disabled={!searchValueValid}
          tooltip={!searchValueValid && 'Enter an email address to add a collaborator'}
          onClick={() => addCollaborator(searchValue)}
        >
          Add
        </ButtonPrimary>
      </div>
      {searchValueValid && !searchHasFocus && <p>{addUserReminder}</p>}
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
          <ButtonPrimary disabled={searchValueValid} tooltip={searchValueValid && addUserReminder} onClick={save}>
            Save
          </ButtonPrimary>
        </span>
      </div>
      {working && spinnerOverlay}
    </Modal>
  );
};

export default ShareWorkspaceModal;
