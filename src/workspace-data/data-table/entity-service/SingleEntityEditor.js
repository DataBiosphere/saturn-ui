import { Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { div, h, span } from 'react-hyperscript-helpers';
import { ButtonOutline, ButtonPrimary, ButtonSecondary, spinnerOverlay } from 'src/components/common';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { reportError } from 'src/libs/error';

import { getAttributeType, prepareAttributeForUpload } from './attribute-utils';
import AttributeInput from './AttributeInput';

export const SingleEntityEditor = ({
  entityType,
  entityName,
  attributeName,
  attributeValue,
  entityTypes,
  workspaceId: { namespace, name },
  onDismiss,
  onSuccess,
}) => {
  const { type: originalValueType } = getAttributeType(attributeValue);
  const [newValue, setNewValue] = useState(attributeValue);
  const isUnchanged = _.isEqual(attributeValue, newValue);

  const [isBusy, setIsBusy] = useState();
  const [consideringDelete, setConsideringDelete] = useState();

  const doEdit = async () => {
    try {
      setIsBusy(true);

      await Workspaces()
        .workspace(namespace, name)
        .upsertEntities([
          {
            entityType,
            name: entityName,
            operations: [
              {
                op: 'AddUpdateAttribute',
                attributeName,
                addUpdateAttribute: prepareAttributeForUpload(newValue),
              },
            ],
          },
        ]);
      onSuccess();
    } catch (e) {
      onDismiss();
      reportError('Unable to modify entity', e);
    }
  };

  const doDelete = async () => {
    try {
      setIsBusy(true);
      await Workspaces().workspace(namespace, name).deleteEntityAttribute(entityType, entityName, attributeName);
      onSuccess();
    } catch (e) {
      onDismiss();
      reportError('Unable to modify entity', e);
    }
  };

  const boldish = (text) => span({ style: { fontWeight: 600 } }, [text]);

  return h(
    Modal,
    {
      title: 'Edit value',
      onDismiss,
      showButtons: false,
    },
    [
      consideringDelete
        ? h(Fragment, [
            'Are you sure you want to delete the value ',
            boldish(attributeName),
            ' from the ',
            boldish(entityType),
            ' called ',
            boldish(entityName),
            '?',
            div({ style: { marginTop: '1rem' } }, [boldish('This cannot be undone.')]),
            div({ style: { marginTop: '1rem', display: 'flex', alignItems: 'baseline' } }, [
              div({ style: { flexGrow: 1 } }),
              h(ButtonSecondary, { style: { marginRight: '1rem' }, onClick: () => setConsideringDelete(false) }, ['Back to editing']),
              h(ButtonPrimary, { onClick: doDelete }, ['Delete']),
            ]),
          ])
        : h(Fragment, [
            h(AttributeInput, {
              autoFocus: true,
              value: newValue,
              onChange: setNewValue,
              initialValue: attributeValue,
              entityTypes,
              showJsonTypeOption: originalValueType === 'json',
            }),
            div({ style: { marginTop: '2rem', display: 'flex', alignItems: 'baseline' } }, [
              h(ButtonOutline, { onClick: () => setConsideringDelete(true) }, ['Delete']),
              div({ style: { flexGrow: 1 } }),
              h(ButtonSecondary, { style: { marginRight: '1rem' }, onClick: onDismiss }, ['Cancel']),
              h(
                ButtonPrimary,
                {
                  onClick: doEdit,
                  disabled: isUnchanged || newValue === undefined || newValue === '',
                  tooltip: isUnchanged && 'No changes to save',
                },
                ['Save Changes']
              ),
            ]),
          ]),
      isBusy && spinnerOverlay,
    ]
  );
};
