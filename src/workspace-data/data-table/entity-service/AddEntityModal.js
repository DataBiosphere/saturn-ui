import { Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { useState } from 'react';
import { div, h, label, li, p, ul } from 'react-hyperscript-helpers';
import Collapse from 'src/components/Collapse';
import { ButtonPrimary, spinnerOverlay } from 'src/components/common';
import { ValidatedInput } from 'src/components/input';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import colors from 'src/libs/colors';
import { reportError } from 'src/libs/error';
import * as Utils from 'src/libs/utils';
import validate from 'validate.js';

import { prepareAttributeForUpload } from './attribute-utils';
import AttributeInput from './AttributeInput';
import { entityAttributeText } from './entityAttributeText';

export const AddEntityModal = ({ workspaceId: { namespace, name }, entityType, attributeNames, entityTypes, onDismiss, onSuccess }) => {
  const [entityName, setEntityName] = useState('');
  const [entityNameInputTouched, setEntityNameInputTouched] = useState(false);
  const [takenNames, setTakenNames] = useState([]);
  // Default all attribute values to empty strings
  const [attributeValues, setAttributeValues] = useState(_.fromPairs(_.map((attributeName) => [attributeName, ''], attributeNames)));
  const [isBusy, setIsBusy] = useState(false);

  // The data table colum heading shows this as `${entityType}_id`, but `${entityType} ID` works better in a screen reader
  const entityNameLabel = `${entityType} ID`;

  const entityNameErrors = validate.single(entityName, {
    presence: {
      allowEmpty: false,
      message: `${entityNameLabel} is required`,
    },
    format: {
      pattern: '[a-z0-9_.-]*',
      flags: 'i',
      message: `${entityNameLabel} may only contain alphanumeric characters, underscores, dashes, and periods.`,
    },
    exclusion: {
      within: takenNames,
      message: `A ${entityType} with this name already exists`,
    },
  });

  const createEntity = async () => {
    setIsBusy(true);
    try {
      await Workspaces()
        .workspace(namespace, name)
        .createEntity({
          entityType,
          name: _.trim(entityName),
          attributes: _.mapValues(prepareAttributeForUpload, attributeValues),
        });
      setIsBusy(false);
      onDismiss();
      onSuccess();
    } catch (err) {
      setIsBusy(false);
      if (err.status === 409) {
        setTakenNames((prevTakenNames) => _.uniq(Utils.append(entityName, prevTakenNames)));
      } else {
        onDismiss();
        reportError('Unable to add row.', err);
      }
    }
  };

  return h(
    Modal,
    {
      onDismiss,
      title: 'Add a new row',
      okButton: h(
        ButtonPrimary,
        {
          disabled: !!entityNameErrors,
          tooltip: Utils.summarizeErrors(entityNameErrors),
          onClick: createEntity,
        },
        ['Add']
      ),
    },
    [
      label({ htmlFor: 'add-row-entity-name', style: { display: 'block', marginBottom: '0.5rem' } }, entityNameLabel),
      h(ValidatedInput, {
        inputProps: {
          id: 'add-row-entity-name',
          placeholder: 'Enter a value (required)',
          value: entityName,
          onChange: (value) => {
            setEntityName(value);
            setEntityNameInputTouched(true);
          },
        },
        error: entityNameInputTouched && Utils.summarizeErrors(entityNameErrors),
      }),
      p({ id: 'add-row-attributes-label' }, 'Expand each value to edit.'),
      ul({ 'aria-labelledby': 'add-row-attributes-label', style: { padding: 0, margin: 0 } }, [
        _.map(
          ([i, attributeName]) =>
            li(
              {
                key: attributeName,
                style: {
                  borderTop: i === 0 ? undefined : `1px solid ${colors.light()}`,
                  listStyleType: 'none',
                },
              },
              [
                h(
                  Collapse,
                  {
                    title: `${attributeName}: ${entityAttributeText(attributeValues[attributeName], false)}`,
                    noTitleWrap: true,
                    summaryStyle: { margin: '0.5rem 0' },
                  },
                  [
                    div({ style: { margin: '0.5rem 0' } }, [
                      h(AttributeInput, {
                        value: attributeValues[attributeName],
                        onChange: (value) => setAttributeValues(_.set(attributeName, value)),
                        entityTypes,
                      }),
                    ]),
                  ]
                ),
              ]
            ),
          Utils.toIndexPairs(attributeNames)
        ),
      ]),
      isBusy && spinnerOverlay,
    ]
  );
};
