import {
  ButtonPrimary,
  ButtonSecondary,
  Clickable,
  Icon,
  Modal,
  modalStyles,
  Select,
  SpinnerOverlay,
} from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { CSSProperties, Dispatch, SetStateAction, useRef, useState } from 'react';
import { IdContainer, LabeledCheckbox } from 'src/components/common';
import { ValidatedInput } from 'src/components/input';
import { getPopupRoot } from 'src/components/popup-utils';
import { Ajax } from 'src/libs/ajax';
import colors from 'src/libs/colors';
import { reportError } from 'src/libs/error';
import { FormLabel } from 'src/libs/forms';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import { getTerraUser } from 'src/libs/state';
import * as Style from 'src/libs/style';
import { append, withBusyState } from 'src/libs/utils';
import * as Utils from 'src/libs/utils';
import {
  publicUser,
  WorkflowAccessLevel,
  WorkflowsPermissions,
  WorkflowUserPermissions,
} from 'src/workflows/methods-repo/workflows-acl-utils';
import validate from 'validate.js';

type WorkflowPermissionsModalProps = {
  snapshotOrNamespace: 'Snapshot' | 'Namespace';
  namespace: string;
  name: string;
  selectedSnapshot: number;
  setPermissionsModalOpen: (b: boolean) => void;
  refresh: () => void;
};

type UserProps = {
  userPermissions: WorkflowUserPermissions;
  setAllPermissions: Dispatch<SetStateAction<WorkflowsPermissions>>;
  allPermissions: WorkflowsPermissions;
};

type UserSelectProps = {
  disabled: boolean | undefined;
  value: WorkflowUserPermissions;
  onChange: (newPerms: WorkflowUserPermissions) => void;
};

type CurrentUsersProps = {
  allPermissions: WorkflowsPermissions;
  setAllPermissions: Dispatch<SetStateAction<WorkflowsPermissions>>;
};

const constraints = (existingUserEmails: string[]) => {
  return {
    searchValue: {
      email: true,
      exclusion: {
        within: existingUserEmails,
        message: 'has already been added',
      },
    },
  };
};

const styles: CSSProperties = {
  margin: '0.5rem -1.25rem 0',
  padding: '1rem 1.25rem',
  maxHeight: 550,
  overflowY: 'auto',
  borderBottom: Style.standardLine,
  borderTop: Style.standardLine,
};

const UserSelectInput = (props: UserSelectProps) => {
  const { value, disabled, onChange, ...rest } = props;
  const { role } = value;

  return (
    <div style={{ display: 'flex', marginTop: '0.25rem' }}>
      <div style={{ width: 200 }}>
        <Select<WorkflowAccessLevel>
          aria-label={`selected role ${role}`}
          value={role}
          options={['READER', 'OWNER']}
          isDisabled={disabled}
          getOptionLabel={(r) => Utils.normalizeLabel(r.value)}
          onChange={(r) =>
            onChange({
              ...value,
              role: r!.value,
            })
          }
          menuPortalTarget={getPopupRoot()}
          {...rest}
        />
      </div>
    </div>
  );
};

const User = (props: UserProps) => {
  const { userPermissions, setAllPermissions, allPermissions } = props;
  const { user } = userPermissions;

  const disabled = user === getTerraUser().email;

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        borderRadius: 5,
        padding: '0.5rem 0.75rem',
        marginBottom: 10,
        border: `1px solid ${colors.dark(0.25)}`,
        backgroundColor: colors.light(0.2),
      }}
    >
      <div style={{ flex: 1 }}>
        {user}
        <UserSelectInput
          aria-label={`permissions for ${user}`}
          disabled={disabled}
          value={userPermissions}
          onChange={(v) => {
            setAllPermissions(_.map((entry) => (entry.user === user ? v : entry), allPermissions));
          }}
        />
      </div>
      {user === getTerraUser().email ? undefined : (
        <Clickable
          tooltip='Remove'
          onClick={() => {
            const newPermissions = _.remove({ user }, allPermissions);
            setAllPermissions(newPermissions);
          }}
        >
          <Icon icon='times' size={20} style={{ marginRight: '0.5rem' }} />
        </Clickable>
      )}
    </li>
  );
};

const CurrentUsers = (props: CurrentUsersProps) => {
  const list = useRef<HTMLUListElement>(null);
  const { allPermissions } = props;
  return (
    <>
      <div style={{ ...Style.elements.sectionHeader, margin: '1rem 0 0.5rem 0' }}>Current Users</div>
      <ul ref={list} style={styles}>
        {_.flow(
          _.remove(publicUser),
          _.map((userPermissions) => (
            <User key={`user ${userPermissions?.user}`} userPermissions={userPermissions} {...props} />
          ))
        )(allPermissions)}
      </ul>
    </>
  );
};

export const PermissionsModal = (props: WorkflowPermissionsModalProps) => {
  const { snapshotOrNamespace, namespace, name, selectedSnapshot, setPermissionsModalOpen, refresh } = props;
  const signal: AbortSignal = useCancellation();
  const [searchValue, setSearchValue] = useState<string>('');
  const [permissions, setPermissions] = useState<WorkflowsPermissions>([]);
  const [working, setWorking] = useState(false);
  const [originalPermissions, setOriginalPermissions] = useState<WorkflowsPermissions>([]);
  const userEmails = _.map('user', permissions);
  const [userValueModified, setUserValueModified] = useState<boolean>(false);
  const publicAccessLevel: WorkflowAccessLevel = _.find(publicUser, permissions)?.role ?? 'NO ACCESS';
  const errors = validate({ searchValue }, constraints(userEmails), {
    prettify: (v) => ({ searchValue: 'User' }[v] || validate.prettify(v)),
  });

  useOnMount(() => {
    const loadWorkflowPermissions = withBusyState(setWorking, async () => {
      try {
        const workflowPermissions: WorkflowsPermissions = await Ajax(signal)
          .Methods.method(namespace, name, selectedSnapshot)
          .permissions();
        setPermissions(workflowPermissions);
        setOriginalPermissions(workflowPermissions);
      } catch (error) {
        await reportError('Error loading permissions.', error);
        setPermissionsModalOpen(false);
      }
    });

    loadWorkflowPermissions();
  });

  const addUser = (userEmail) => {
    setSearchValue('');
    setUserValueModified(false);
    setPermissions(append({ user: userEmail, role: 'READER' } as WorkflowUserPermissions));
  };

  const updatePublicUser = (publiclyReadable: boolean) => {
    const publicUserPermissions: WorkflowUserPermissions = {
      role: publiclyReadable ? 'READER' : 'NO ACCESS',
      user: 'public',
    };

    // overwrites the old public user permissions if necessary
    setPermissions(_.uniqBy('user', [publicUserPermissions, ...permissions]));
  };

  const save = withBusyState(setWorking, async () => {
    const toBeDeleted = _.remove((entry) => userEmails.includes(entry.user), originalPermissions);

    const permissionUpdates = [...permissions, ..._.map(({ user }) => ({ user, role: 'NO ACCESS' }), toBeDeleted)];

    try {
      await Ajax(signal).Methods.method(namespace, name, selectedSnapshot).setPermissions(permissionUpdates);
      refresh();
      setPermissionsModalOpen(false);
    } catch (error) {
      await reportError('Error saving permissions.', error);
      setPermissionsModalOpen(false);
    }
  });

  return (
    <Modal
      title={`Edit ${snapshotOrNamespace} Permissions`}
      onDismiss={() => setPermissionsModalOpen(false)}
      width='30rem'
      showButtons={false}
    >
      <div>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <Icon size={19} color={colors.warning()} icon='warning-standard' />
          <span style={{ marginLeft: '1ch' }}>Note: Sharing with user groups is not supported.</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <IdContainer>
            {(id) => (
              <div style={{ flexGrow: 1, marginRight: '1rem' }}>
                <FormLabel htmlFor={id} style={{ ...Style.elements.sectionHeader, margin: '1rem 0 0.5rem 0' }}>
                  User
                </FormLabel>
                <ValidatedInput
                  inputProps={{
                    id,
                    autoFocus: true,
                    placeholder: 'Add a user',
                    value: searchValue,
                    onChange: (v) => {
                      setSearchValue(v);
                      setUserValueModified(true);
                    },
                  }}
                  error={Utils.summarizeErrors(userValueModified && errors?.searchValue)}
                />
              </div>
            )}
          </IdContainer>
          <ButtonPrimary disabled={errors} onClick={() => addUser(searchValue)}>
            Add
          </ButtonPrimary>
        </div>
      </div>
      <CurrentUsers allPermissions={permissions} setAllPermissions={setPermissions} />
      <div style={{ ...modalStyles.buttonRow, justifyContent: 'space-between' }}>
        <div>
          <LabeledCheckbox
            checked={publicAccessLevel !== 'NO ACCESS'}
            onChange={(v: boolean) => {
              updatePublicUser(v);
            }}
          >
            <span style={{ marginLeft: '0.3rem' }}>Make Publicly Readable?</span>
          </LabeledCheckbox>
        </div>
        <span>
          <ButtonSecondary style={{ marginRight: '1rem' }} onClick={() => setPermissionsModalOpen(false)}>
            Cancel
          </ButtonSecondary>
          <ButtonPrimary onClick={save}>Save</ButtonPrimary>
        </span>
      </div>
      {working && <SpinnerOverlay />}
    </Modal>
  );
};
