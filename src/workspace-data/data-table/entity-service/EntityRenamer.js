import { Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { h } from 'react-hyperscript-helpers';
import { ButtonPrimary, IdContainer, spinnerOverlay } from 'src/components/common';
import { ValidatedInput } from 'src/components/input';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { reportError } from 'src/libs/error';
import { FormLabel } from 'src/libs/forms';
import * as Utils from 'src/libs/utils';
import validate from 'validate.js';

export const EntityRenamer = ({ entityType, entityName, workspaceId: { namespace, name }, onDismiss, onSuccess }) => {
  const [newName, setNewName] = useState(entityName);
  const [isBusy, setIsBusy] = useState();
  const [takenName, setTakenName] = useState();

  const errors = validate.single(newName, {
    presence: { allowEmpty: false, message: "Name can't be blank" },
    exclusion: { within: [takenName], message: 'An entity with this name already exists' },
  });

  const doRename = async () => {
    try {
      setIsBusy(true);
      await Workspaces().workspace(namespace, name).renameEntity(entityType, entityName, _.trim(newName));
      onSuccess();
    } catch (e) {
      if (e.status === 409) {
        setTakenName(newName);
        setIsBusy(false);
      } else {
        onDismiss();
        reportError('Unable to rename entity', e);
      }
    }
  };

  return h(
    Modal,
    {
      onDismiss,
      title: `Rename ${entityName}`,
      okButton: h(
        ButtonPrimary,
        {
          onClick: doRename,
          disabled: entityName === newName || errors,
          tooltip: entityName === newName ? 'No change to save' : Utils.summarizeErrors(errors),
        },
        ['Rename']
      ),
    },
    [
      h(IdContainer, [
        (id) =>
          h(Fragment, [
            h(FormLabel, { htmlFor: id }, ['New entity name']),
            h(ValidatedInput, {
              inputProps: {
                id,
                autoFocus: true,
                placeholder: 'Enter a name',
                value: newName,
                onChange: setNewName,
              },
              error: Utils.summarizeErrors(errors),
            }),
          ]),
      ]),
      isBusy && spinnerOverlay,
    ]
  );
};
