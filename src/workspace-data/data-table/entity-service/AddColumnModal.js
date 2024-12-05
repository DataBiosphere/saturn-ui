import { Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { div, h, label, p, span } from 'react-hyperscript-helpers';
import { ButtonPrimary, IdContainer, spinnerOverlay } from 'src/components/common';
import { icon } from 'src/components/icons';
import { TextInput } from 'src/components/input';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import colors from 'src/libs/colors';
import { reportError } from 'src/libs/error';
import * as Utils from 'src/libs/utils';

import { prepareAttributeForUpload } from './attribute-utils';
import AttributeInput from './AttributeInput';

export const AddColumnModal = ({ entityType, entityMetadata, workspaceId: { namespace, name }, onDismiss, onSuccess }) => {
  const [columnName, setColumnName] = useState('');
  const [columnNameTouched, setColumnNameTouched] = useState(false);
  const columnNameError =
    columnNameTouched &&
    Utils.cond(
      [!columnName, () => 'A column name is required.'],
      [_.includes(columnName, entityMetadata[entityType].attributeNames), () => 'This column already exists.']
    );

  const [value, setValue] = useState('');

  const [isBusy, setIsBusy] = useState();

  const addColumn = async () => {
    try {
      setIsBusy(true);

      const queryResults = await Workspaces().workspace(namespace, name).paginatedEntitiesOfType(entityType, {
        pageSize: entityMetadata[entityType].count,
        fields: '',
      });
      const allEntityNames = _.map(_.get('name'), queryResults.results);

      const entityUpdates = _.map(
        (entityName) => ({
          entityType,
          name: entityName,
          operations: [
            {
              op: 'AddUpdateAttribute',
              attributeName: columnName,
              addUpdateAttribute: prepareAttributeForUpload(value),
            },
          ],
        }),
        allEntityNames
      );

      await Workspaces().workspace(namespace, name).upsertEntities(entityUpdates);
      onSuccess();
    } catch (e) {
      onDismiss();
      reportError('Unable to add column.', e);
    }
  };

  return h(
    Modal,
    {
      title: 'Add a new column',
      onDismiss,
      okButton: h(
        ButtonPrimary,
        {
          disabled: !columnName || columnNameError,
          tooltip: columnNameError,
          onClick: addColumn,
        },
        ['Save']
      ),
    },
    [
      div({ style: { display: 'flex', flexDirection: 'column', marginBottom: '1rem' } }, [
        h(IdContainer, [
          (id) =>
            h(Fragment, [
              label({ htmlFor: id, style: { fontWeight: 'bold', marginBottom: '0.5rem' } }, 'Column name'),
              div({ style: { position: 'relative', display: 'flex', alignItems: 'center' } }, [
                h(TextInput, {
                  id,
                  value: columnName,
                  placeholder: 'Enter a name (required)',
                  style: columnNameError
                    ? {
                        paddingRight: '2.25rem',
                        border: `1px solid ${colors.danger()}`,
                      }
                    : undefined,
                  onChange: (value) => {
                    setColumnName(value);
                    setColumnNameTouched(true);
                  },
                }),
                columnNameError &&
                  icon('error-standard', {
                    size: 24,
                    style: {
                      position: 'absolute',
                      right: '0.5rem',
                      color: colors.danger(),
                    },
                  }),
              ]),
              columnNameError &&
                div(
                  {
                    'aria-live': 'assertive',
                    'aria-relevant': 'all',
                    style: {
                      marginTop: '0.5rem',
                      color: colors.danger(),
                    },
                  },
                  columnNameError
                ),
            ]),
        ]),
      ]),
      p([span({ style: { fontWeight: 'bold' } }, ['Default value']), ' (optional, will be entered for all rows)']),
      h(AttributeInput, {
        value,
        onChange: setValue,
        entityTypes: _.keys(entityMetadata),
      }),
      isBusy && spinnerOverlay,
    ]
  );
};
