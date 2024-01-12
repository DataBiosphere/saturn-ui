import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { div, h, span } from 'react-hyperscript-helpers';
import { ButtonOutline, ButtonPrimary, ButtonSecondary, spinnerOverlay } from 'src/components/common';
import Modal from 'src/components/Modal';
import { Ajax } from 'src/libs/ajax';
import { wdsProviderName } from 'src/libs/ajax/data-table-providers/WdsDataTableProvider';
import { reportError } from 'src/libs/error';

import { getAttributeType, prepareAttributeForUpload } from '../entity-service/attribute-utils';
import AttributeInput from '../entity-service/AttributeInput';

export const SingleEntityEditor = ({
  entityType,
  entityName,
  attributeName,
  attributeValue,
  entityTypes,
  workspaceId: { namespace, name, id },
  onDismiss,
  onSuccess,
  dataProvider,
}) => {
  const { type: originalValueType } = getAttributeType(attributeValue);
  const [newValue, setNewValue] = useState(attributeValue);
  const isUnchanged = _.isEqual(attributeValue, newValue);

  const [isBusy, setIsBusy] = useState();
  const [consideringDelete, setConsideringDelete] = useState();

  const doEdit = async () => {
    try {
      if (dataProvider.providerName === wdsProviderName) {
        const record = {};
        record[attributeName] = newValue;
        const listOfRecords = { attributes: record };
        await dataProvider.updateRecord(id, entityType, entityName, listOfRecords);
      } else {
        setIsBusy(true);

        await Ajax()
          .Workspaces.workspace(namespace, name)
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
      }

      onSuccess();
    } catch (e) {
      onDismiss();
      reportError('Unable to modify entity', e);
    }
  };

  const doDelete = async () => {
    try {
      setIsBusy(true);
      await Ajax().Workspaces.workspace(namespace, name).deleteEntityAttribute(entityType, entityName, attributeName);
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
