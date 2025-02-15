import { ButtonPrimary, Modal, SpinnerOverlay } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { useState } from 'react';
import { validateUserEmails } from 'src/billing/utils';
import { EmailSelect } from 'src/groups/Members/EmailSelect';
import { RoleSelect } from 'src/groups/Members/RoleSelect';
import { Groups } from 'src/libs/ajax/Groups';
import { User } from 'src/libs/ajax/User';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import { cond, summarizeErrors, withBusyState } from 'src/libs/utils';

interface NewMemberModalProps {
  addFunction: (role: string, emails: string[]) => Promise<unknown>;
  addUnregisteredUser?: boolean;
  adminLabel: string;
  memberLabel: string;
  title: string;
  onSuccess: () => void;
  onDismiss: () => void;
  footer?: React.ReactNode[];
}

export const NewMemberModal = (props: NewMemberModalProps) => {
  const {
    addFunction,
    addUnregisteredUser = false,
    adminLabel,
    memberLabel,
    title,
    onSuccess,
    onDismiss,
    footer,
  } = props;
  const [userEmails, setUserEmails] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [confirmAddUser, setConfirmAddUser] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [role, setRole] = useState<string>(memberLabel);
  const [submitError, setSubmitError] = useState(undefined);
  const [busy, setBusy] = useState(false);

  const signal = useCancellation();

  const enableShareLog = false; // Set "true" to enable suggestions

  useOnMount(() => {
    const loadData = withErrorReporting('Error looking up collaborators')(async () => {
      const [shareSuggestions, groups] = await Promise.all([Workspaces(signal).getShareLog(), Groups(signal).list()]);

      const suggestions = _.flow(_.map('groupEmail'), _.concat(shareSuggestions), _.uniq)(groups);

      setSuggestions(suggestions);
    });
    enableShareLog && loadData();
  });

  const submit = async () => {
    // only called by invite and add, which set busy & catch errors
    try {
      await addFunction(role, userEmails);
      onSuccess();
    } catch (error: any) {
      if ('status' in error && error.status >= 400 && error.status <= 499) {
        setSubmitError((await error.json()).message);
      } else {
        throw error;
      }
    }
  };

  const inviteUser = _.flow(
    withErrorReporting('Error adding user'),
    withBusyState(setBusy)
  )(async () => {
    await User(signal).inviteUser(inviteEmail);
    await submit();
  });

  const addUsers = _.flow(
    withErrorReporting('Error adding user'),
    withBusyState(setBusy)
  )(async () => {
    if (!addUnregisteredUser) {
      await submit();
      return;
    }

    for (const userEmail of userEmails) {
      const isRegistered = await User(signal).isUserRegistered(userEmail);
      if (!isRegistered) {
        setConfirmAddUser(true);
        setInviteEmail(userEmail);
        return;
      }
    }

    await submit();
  });

  const errors = validateUserEmails(userEmails);

  return cond(
    [
      confirmAddUser,
      () => (
        <Modal
          title='User is not registered'
          okButton={<ButtonPrimary onClick={inviteUser}>Yes</ButtonPrimary>}
          cancelText='No'
          onDismiss={() => setConfirmAddUser(false)}
        >
          Add <b>{inviteEmail}</b> to the group anyway?
          {busy && <SpinnerOverlay />}
        </Modal>
      ),
    ],
    () => (
      <Modal
        onDismiss={onDismiss}
        title={title}
        okButton={
          <ButtonPrimary tooltip={summarizeErrors(errors)} onClick={addUsers} disabled={!!errors}>
            Add Users
          </ButtonPrimary>
        }
        width={720}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem' }}>
          <div style={{ flex: 2, width: '500px', alignSelf: 'flex-start', marginTop: '0.75rem' }}>
            <EmailSelect options={suggestions} emails={userEmails} setEmails={setUserEmails} />
          </div>
          <div style={{ flex: '1', alignSelf: 'flex-start' }}>
            <RoleSelect options={[memberLabel, adminLabel]} role={role} setRole={setRole} />
          </div>
        </div>
        {footer && <div style={{ marginTop: '1rem' }}>{footer}</div>}
        {submitError && (
          <div style={{ marginTop: '0.5rem', textAlign: 'right', color: colors.danger() }}>{submitError}</div>
        )}
        {busy && <SpinnerOverlay />}
      </Modal>
    )
  );
};
