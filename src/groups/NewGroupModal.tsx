import { ButtonPrimary, Modal, SpinnerOverlay, useUniqueId } from '@terra-ui-packages/components';
import React, { ReactNode, useState } from 'react';
import { ValidatedInput } from 'src/components/input';
import { AdminNotifierCheckbox } from 'src/groups/AdminNotifierCheckbox';
import { Groups } from 'src/libs/ajax/Groups';
import { reportError } from 'src/libs/error';
import { formHint, FormLabel } from 'src/libs/forms';
import { summarizeErrors } from 'src/libs/utils';
import { validate } from 'validate.js';

const groupNameValidator = (existing) => ({
  presence: { allowEmpty: false },
  length: { maximum: 60 },
  format: {
    pattern: /[A-Za-z0-9_-]*$/,
    message: 'can only contain letters, numbers, underscores, and dashes',
  },
  exclusion: {
    within: existing,
    message: 'already exists',
  },
});

interface NewGroupModalProps {
  onSuccess: () => void;
  onDismiss: () => void;
  existingGroups: string[];
}

export const NewGroupModal = (props: NewGroupModalProps): ReactNode => {
  const [groupName, setGroupName] = useState<string>();
  const [allowAccessRequests, setAllowAccessRequests] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const groupAjax = Groups().group(groupName ?? '');
      await groupAjax.create();
      await groupAjax.setPolicy('admin-notifier', allowAccessRequests);
      props.onSuccess();
    } catch (error) {
      reportError('Error creating group', error);
    } finally {
      setSubmitting(false);
    }
  };

  const errors = validate({ groupName }, { groupName: groupNameValidator(props.existingGroups) });

  const nameInputId = useUniqueId();
  return (
    <Modal
      onDismiss={props.onDismiss}
      title='Create New Group'
      okButton={
        <ButtonPrimary disabled={!!errors} onClick={submit}>
          Create Group
        </ButtonPrimary>
      }
    >
      <FormLabel required htmlFor={nameInputId}>
        Enter a unique name
      </FormLabel>
      <ValidatedInput
        inputProps={{
          id: nameInputId,
          autoFocus: true,
          value: groupName ?? '',
          onChange: (v) => {
            setGroupName(v);
          },
        }}
        error={groupName !== undefined && summarizeErrors(errors?.groupName)}
      />
      {!(groupName !== undefined && errors) && formHint('Only letters, numbers, underscores, and dashes allowed')}
      <AdminNotifierCheckbox checked={allowAccessRequests} onChange={setAllowAccessRequests} />
      {submitting && <SpinnerOverlay />}
    </Modal>
  );
};
