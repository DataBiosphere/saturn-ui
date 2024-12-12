import {
  ButtonPrimary,
  CreatableSelect,
  Modal,
  Select,
  SpinnerOverlay,
  useUniqueId,
} from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { useState } from 'react';
import { ErrorAlert } from 'src/alerts/ErrorAlert';
import { Groups } from 'src/libs/ajax/Groups';
import { User } from 'src/libs/ajax/User';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import { FormLabel } from 'src/libs/forms';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import { cond, withBusyState } from 'src/libs/utils';

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
  const [roles, setRoles] = useState<string[]>([memberLabel]);
  const [submitError, setSubmitError] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [isInvalidEmail, setIsInvalidEmail] = useState(false);

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
        await addFunction(roles, userEmail);
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

  const isAdmin = _.includes(adminLabel, roles);
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const emailInputId = useUniqueId();
  const roleSelectId = useUniqueId();

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
        okButton={<ButtonPrimary onClick={addUsers}>Add Users</ButtonPrimary>}
        width={720}
      >
        {isInvalidEmail && <ErrorAlert errorValue='Please add a valid email' />}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ flex: 2 }}>
            <FormLabel id={emailInputId} required>
              User emails
            </FormLabel>
            <CreatableSelect
              id={emailInputId}
              isMulti
              isClearable={false}
              isSearchable
              placeholder='Type or select user emails'
              aria-label='Type or select user emails'
              value={_.map((value) => ({ value, label: value }), userEmails)}
              onChange={(data: Array<{ value: string; label: string }>) => {
                setIsInvalidEmail(false);
                const selectedEmails = _.map('value', data);
                const newEmail = _.find((email) => !userEmails.includes(email), selectedEmails);
                // If the new email is valid or undefined (remove all), update the list of emails
                if ((newEmail && isValidEmail(newEmail)) || newEmail === undefined) {
                  setUserEmails(selectedEmails);
                } else {
                  setIsInvalidEmail(true);
                }
              }}
              options={_.map((value) => ({ value, label: value }), suggestions)}
            />
          </div>
          <div style={{ flex: '1' }}>
            <FormLabel id={roleSelectId}>&nbsp;</FormLabel>
            <Select
              id={roleSelectId}
              aria-label='Select Role'
              options={_.map(
                (value) => ({
                  label: value.name,
                  value: value.id,
                }),
                [
                  { id: memberLabel, name: _.startCase(memberLabel) },
                  { id: adminLabel, name: _.startCase(adminLabel) },
                ]
              )}
              value={isAdmin ? adminLabel : memberLabel}
              onChange={() => setRoles([isAdmin ? memberLabel : adminLabel])}
            />
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
