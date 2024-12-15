import { ButtonPrimary, Modal, SpinnerOverlay } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { useState } from 'react';
import { EmailSelect } from 'src/groups/Members/EmailSelect';
import { RoleSelect } from 'src/groups/Members/RoleSelect';
import { Groups } from 'src/libs/ajax/Groups';
import { User } from 'src/libs/ajax/User';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import { cond, summarizeErrors, withBusyState } from 'src/libs/utils';
import validate from 'validate.js';

interface NewMemberModalProps {
  addFunction: (roles: string[], email: string) => Promise<unknown>;
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

  useOnMount(() => {
    const loadData = withErrorReporting('Error looking up collaborators')(async () => {
      const [shareSuggestions, groups] = await Promise.all([Workspaces(signal).getShareLog(), Groups(signal).list()]);

      const suggestions = _.flow(_.map('groupEmail'), _.concat(shareSuggestions), _.uniq)(groups);

      setSuggestions(suggestions);
    });
    loadData();
  });

  const submit = async () => {
    // only called by invite and add, which set busy & catch errors
    try {
      for (const userEmail of userEmails) {
        await addFunction([role], userEmail);
      }
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
    for (const userEmail of userEmails) {
      const isRegistered = await User(signal).isUserRegistered(userEmail);
      if (addUnregisteredUser && !isRegistered) {
        setConfirmAddUser(true);
        setInviteEmail(userEmail);
        return;
      }
    }
    await submit();
    addUnregisteredUser && !(await User(signal).isUserRegistered(inviteEmail))
      ? setConfirmAddUser(true)
      : await submit();
  });

  // Validator for a single email
  const isValidEmail = (userEmail: string): boolean => {
    return !validate.single(userEmail, { email: true, presence: true });
  };

  // Custom validator for an array of emails
  validate.validators.emailArray = (value: string[], options: { message: string; emptyMessage: string }, key: any) => {
    if (!Array.isArray(value)) {
      return options.message || `^${key} must be an array.`;
    }

    if (value.length === 0) {
      return options.emptyMessage || `^${key} cannot be empty.`;
    }

    const errors = _.flow(
      _.map((email: string) => (!isValidEmail(email) ? email : null)),
      _.filter(Boolean)
    )(value);

    return errors.length ? `^Invalid email(s): ${errors.join(', ')}` : null;
  };

  const errors = validate(
    { userEmails },
    {
      userEmails: {
        emailArray: {
          message: '^All inputs must be valid email addresses.',
          emptyMessage: '^User emails cannot be empty.',
        },
      },
    }
  );

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
          <div style={{ flex: 2, width: '500px' }}>
            <EmailSelect options={suggestions} emails={userEmails} setEmails={setUserEmails} />
          </div>
          <div style={{ flex: '1' }}>
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
