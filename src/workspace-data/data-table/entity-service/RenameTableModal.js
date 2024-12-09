import { Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import { ButtonPrimary, IdContainer, RadioButton, spinnerOverlay } from 'src/components/common';
import { icon } from 'src/components/icons';
import { ValidatedInput } from 'src/components/input';
import { Metrics } from 'src/libs/ajax/Metrics';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import Events from 'src/libs/events';
import { FormLabel } from 'src/libs/forms';
import { warningBoxStyle } from 'src/libs/style';
import * as Utils from 'src/libs/utils';

import { allSavedColumnSettingsEntityTypeKey } from './SavedColumnSettings';

export const RenameTableModal = ({
  onDismiss,
  onUpdateSuccess,
  getAllSavedColumnSettings,
  updateAllSavedColumnSettings,
  setTableNames,
  namespace,
  name,
  selectedDataType,
}) => {
  // State
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameSetTables, setRenameSetTables] = useState(false);

  const handleTableRename = async ({ oldName, newName }) => {
    void Metrics().captureEvent(Events.workspaceDataRenameTable, { oldName, newName });
    await Workspaces().workspace(namespace, name).renameEntityType(oldName, newName);
  };

  const moveTableColumnSettings = async (tableNames) => {
    let allColumnSettings = await getAllSavedColumnSettings();

    const updatedSettings = _.map(({ oldName, newName }) => {
      const oldTableColumnSettingsKey = allSavedColumnSettingsEntityTypeKey({ entityType: oldName });
      const newTableColumnSettingsKey = allSavedColumnSettingsEntityTypeKey({ entityType: newName });
      const tableColumnSettings = _.get(oldTableColumnSettingsKey, allColumnSettings);

      allColumnSettings = tableColumnSettings
        ? _.flow(_.set(newTableColumnSettingsKey, tableColumnSettings), _.unset(oldTableColumnSettingsKey))(allColumnSettings)
        : allColumnSettings;
      return allColumnSettings;
    })(tableNames);

    if (updatedSettings) {
      await updateAllSavedColumnSettings(allColumnSettings);
    }
  };

  return h(
    Modal,
    {
      onDismiss,
      title: 'Rename Data Table',
      okButton: h(
        ButtonPrimary,
        {
          disabled: renaming,
          onClick: _.flow(
            withErrorReporting('Error renaming data table.'),
            Utils.withBusyState(setRenaming)
          )(async () => {
            await handleTableRename({ oldName: selectedDataType, newName });

            if (renameSetTables) {
              // The table renames need to happen in sequence. Renaming them in parallel risks running into
              // a deadlock in the Rawls DB because of row-level locking that occurs during rename.
              for (const tableName of setTableNames) {
                await handleTableRename({ oldName: tableName, newName: tableName.replace(selectedDataType, newName) });
              }
              await moveTableColumnSettings([
                { oldName: selectedDataType, newName },
                ..._.map((tableName) => ({ oldName: tableName, newName: tableName.replace(selectedDataType, newName) }), setTableNames),
              ]);
            } else {
              await moveTableColumnSettings([{ oldName: selectedDataType, newName }]);
            }

            onUpdateSuccess();
          }),
        },
        ['Rename']
      ),
    },
    [
      h(IdContainer, [
        (id) =>
          h(Fragment, [
            div('Workflow configurations that reference the current table name will need to be updated manually.'),
            h(FormLabel, { htmlFor: id, required: true }, ['New Name']),
            h(ValidatedInput, {
              inputProps: {
                id,
                value: newName,
                autoFocus: true,
                placeholder: 'Enter a name',
                onChange: (v) => {
                  setNewName(v);
                },
              },
            }),
            !_.isEmpty(setTableNames) &&
              div(
                {
                  style: { ...warningBoxStyle, margin: '1rem 0 0.5rem' },
                },
                [
                  div({ style: { display: 'flex' } }, [
                    icon('warning-standard', {
                      size: 19,
                      style: { color: colors.warning(), flex: 'none', marginRight: '0.5rem', marginLeft: '-0.5rem' },
                    }),
                    `The table that you are renaming appears to have the following set table(s): ${setTableNames.join(
                      ', '
                    )}. You may choose to also rename these set tables:`,
                  ]),
                  div(
                    {
                      role: 'radiogroup',
                      'aria-label': `the table that you are renaming appears to have the following set tables: ${setTableNames.join(
                        ', '
                      )}. you may choose to also rename these set tables.`,
                    },
                    [
                      div({ style: { paddingTop: '0.5rem' } }, [
                        h(RadioButton, {
                          text: 'Do not rename set tables (default)',
                          name: 'rename-set-tables',
                          checked: !renameSetTables,
                          onChange: () => setRenameSetTables(false),
                          labelStyle: { padding: '0.5rem', fontWeight: 'normal' },
                        }),
                      ]),
                      div({ style: { paddingTop: '0.5rem' } }, [
                        h(RadioButton, {
                          text: 'Rename set tables',
                          name: 'rename-set-tables',
                          checked: renameSetTables,
                          onChange: () => setRenameSetTables(true),
                          labelStyle: { padding: '0.5rem', fontWeight: 'normal' },
                        }),
                      ]),
                    ]
                  ),
                ]
              ),
            renaming && spinnerOverlay,
          ]),
      ]),
    ]
  );
};
