import { Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import pluralize from 'pluralize';
import { Fragment, useState } from 'react';
import { div, fieldset, h, label, legend, p, span } from 'react-hyperscript-helpers';
import { ButtonOutline, ButtonPrimary, ButtonSecondary, IdContainer, RadioButton, spinnerOverlay } from 'src/components/common';
import { icon } from 'src/components/icons';
import { AutocompleteTextInput } from 'src/components/input';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import colors from 'src/libs/colors';
import { reportError } from 'src/libs/error';
import * as Utils from 'src/libs/utils';

import { convertAttributeValue, prepareAttributeForUpload } from './attribute-utils';
import AttributeInput, { AttributeTypeInput } from './AttributeInput';

export const MultipleEntityEditor = ({
  entityType,
  entities,
  attributeNames,
  entityTypes,
  workspaceId: { namespace, name },
  onDismiss,
  onSuccess,
}) => {
  const [attributeToEdit, setAttributeToEdit] = useState('');
  const [attributeToEditTouched, setAttributeToEditTouched] = useState(false);
  const attributeToEditError =
    attributeToEditTouched &&
    Utils.cond(
      [!attributeToEdit, () => 'An attribute name is required.'],
      [!_.includes(attributeToEdit, attributeNames), () => 'The selected attribute does not exist.']
    );

  const operations = {
    setValue: 'setValue',
    convertType: 'convertType',
  };
  const [operation, setOperation] = useState(operations.setValue);

  const [newValue, setNewValue] = useState('');
  const [newType, setNewType] = useState({ type: 'string' });

  const [isBusy, setIsBusy] = useState();
  const [consideringDelete, setConsideringDelete] = useState();

  const withBusyStateAndErrorHandling = (operation) => async () => {
    try {
      setIsBusy(true);
      await operation();
      onSuccess();
    } catch (e) {
      onDismiss();
      reportError('Unable to modify entities.', e);
    }
  };

  const saveAttributeEdits = withBusyStateAndErrorHandling(() => {
    const entityUpdates = _.map(
      (entity) => ({
        entityType,
        name: entity.name,
        operations: [
          {
            op: 'AddUpdateAttribute',
            attributeName: attributeToEdit,
            addUpdateAttribute: Utils.switchCase(
              operation,
              [operations.setValue, () => prepareAttributeForUpload(newValue)],
              [operations.convertType, () => convertAttributeValue(entity.attributes[attributeToEdit], newType.type, newType.entityType)]
            ),
          },
        ],
      }),
      entities
    );

    return Workspaces().workspace(namespace, name).upsertEntities(entityUpdates);
  });
  const deleteAttributes = withBusyStateAndErrorHandling(() =>
    Workspaces().workspace(namespace, name).deleteAttributeFromEntities(entityType, attributeToEdit, _.map('name', entities))
  );

  const boldish = (text) => span({ style: { fontWeight: 600 } }, [text]);

  return h(
    Modal,
    {
      title: `Edit fields in ${pluralize('row', entities.length, true)}`,
      onDismiss,
      showButtons: false,
    },
    [
      consideringDelete
        ? h(Fragment, [
            'Are you sure you want to delete the value ',
            boldish(attributeToEdit),
            ' from ',
            boldish(`${entities.length} ${entityType}s`),
            '?',
            div({ style: { marginTop: '1rem' } }, [boldish('This cannot be undone.')]),
            div({ style: { marginTop: '1rem', display: 'flex', alignItems: 'baseline' } }, [
              div({ style: { flexGrow: 1 } }),
              h(ButtonSecondary, { style: { marginRight: '1rem' }, onClick: () => setConsideringDelete(false) }, ['Back to editing']),
              h(ButtonPrimary, { onClick: deleteAttributes }, ['Delete']),
            ]),
          ])
        : h(Fragment, [
            div({ style: { display: 'flex', flexDirection: 'column', marginBottom: '1rem' } }, [
              h(IdContainer, [
                (id) =>
                  h(Fragment, [
                    label({ id, style: { marginBottom: '0.5rem', fontWeight: 'bold' } }, 'Select a column to edit'),
                    div({ style: { position: 'relative', display: 'flex', alignItems: 'center' } }, [
                      h(AutocompleteTextInput, {
                        labelId: id,
                        value: attributeToEdit,
                        suggestions: attributeNames,
                        placeholder: 'Column name',
                        style: attributeToEditError
                          ? {
                              paddingRight: '2.25rem',
                              border: `1px solid ${colors.danger()}`,
                            }
                          : undefined,
                        onChange: (value) => {
                          setAttributeToEdit(value);
                          setAttributeToEditTouched(true);
                        },
                      }),
                      attributeToEditError &&
                        icon('error-standard', {
                          size: 24,
                          style: {
                            position: 'absolute',
                            right: '0.5rem',
                            color: colors.danger(),
                          },
                        }),
                    ]),
                    attributeToEditError &&
                      div(
                        {
                          'aria-live': 'assertive',
                          'aria-relevant': 'all',
                          style: {
                            marginTop: '0.5rem',
                            color: colors.danger(),
                          },
                        },
                        attributeToEditError
                      ),
                  ]),
              ]),
            ]),
            attributeToEditTouched
              ? h(Fragment, [
                  div({ style: { marginBottom: '1rem' } }, [
                    fieldset({ style: { border: 'none', margin: 0, padding: 0 } }, [
                      legend({ style: { marginBottom: '0.5rem', fontWeight: 'bold' } }, ['Operation']),
                      div({ style: { display: 'flex', flexDirection: 'row', marginBottom: '0.5rem' } }, [
                        _.map(
                          ({ operation: operationOption, label }) =>
                            span(
                              {
                                key: operationOption,
                                style: { display: 'inline-block', marginRight: '1ch', whiteSpace: 'nowrap' },
                              },
                              [
                                h(RadioButton, {
                                  text: label,
                                  name: 'operation',
                                  checked: operation === operationOption,
                                  onChange: () => {
                                    setOperation(operationOption);
                                  },
                                  labelStyle: { paddingLeft: '0.5rem' },
                                }),
                              ]
                            ),
                          [
                            { operation: operations.setValue, label: 'Set value' },
                            { operation: operations.convertType, label: 'Convert type' },
                          ]
                        ),
                      ]),
                    ]),
                  ]),
                  Utils.cond(
                    [
                      operation === operations.setValue,
                      () =>
                        h(Fragment, [
                          p({ style: { fontWeight: 'bold' } }, ['Set selected values to:']),
                          h(AttributeInput, {
                            value: newValue,
                            onChange: setNewValue,
                            entityTypes,
                          }),
                        ]),
                    ],
                    [
                      operation === operations.convertType,
                      () =>
                        h(Fragment, [
                          p({ style: { fontWeight: 'bold' } }, ['Convert selected values to:']),
                          h(AttributeTypeInput, {
                            value: newType,
                            onChange: setNewType,
                            entityTypes,
                          }),
                        ]),
                    ]
                  ),
                  div({ style: { marginTop: '2rem', display: 'flex', alignItems: 'baseline' } }, [
                    h(
                      ButtonOutline,
                      {
                        disabled: !!attributeToEditError,
                        tooltip: attributeToEditError,
                        onClick: () => setConsideringDelete(true),
                      },
                      ['Delete']
                    ),
                    div({ style: { flexGrow: 1 } }),
                    h(ButtonSecondary, { style: { marginRight: '1rem' }, onClick: onDismiss }, ['Cancel']),
                    h(
                      ButtonPrimary,
                      {
                        disabled: attributeToEditError,
                        tooltip: attributeToEditError,
                        onClick: saveAttributeEdits,
                      },
                      ['Save edits']
                    ),
                  ]),
                ])
              : div({ style: { display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline' } }, [
                  h(ButtonSecondary, { onClick: onDismiss }, ['Cancel']),
                ]),
          ]),
      isBusy && spinnerOverlay,
    ]
  );
};
