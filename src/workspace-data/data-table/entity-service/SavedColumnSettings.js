import { TooltipTrigger } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { Fragment, useEffect, useRef, useState } from 'react';
import { div, h, hr, li, p, span, ul } from 'react-hyperscript-helpers';
import { ButtonOutline, Clickable, IdContainer, spinnerOverlay } from 'src/components/common';
import { icon } from 'src/components/icons';
import { AutocompleteTextInput } from 'src/components/input';
import { MenuButton } from 'src/components/MenuButton';
import { MenuTrigger } from 'src/components/PopupTrigger';
import { ColumnSettings } from 'src/components/table';
import { Ajax } from 'src/libs/ajax';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import Events from 'src/libs/events';
import { FormLabel } from 'src/libs/forms';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import { noWrapEllipsis } from 'src/libs/style';
import { cond, withBusyState } from 'src/libs/utils';
import { canEditWorkspace } from 'src/workspaces/utils';

const savedColumnSettingsWorkspaceAttributeName = 'system:columnSettings';

// Compress settings to avoid storing 'name' and 'visible' keys many times
const encodeColumnSettings = _.flatMap(({ name, visible }) => [name, visible]);
export const decodeColumnSettings = _.flow(
  _.chunk(2),
  _.map(([name, visible]) => ({ name, visible }))
);

// Column settings are now stored as JSON in the rawls database (max size 4gb)
// In an earlier version of this feature, they were stored as Strings in rawls (max size 64kb)
// For backwards-compatibility purposes, we need to support both cases. So we will try to parse
// the column settings as a String and if that fails then we will parse it as regular JSON
const parseAsStringOrJson = (attr) => {
  try {
    return JSON.parse(attr);
  } catch (e) {
    return attr;
  }
};

export const allSavedColumnSettingsInWorkspace = (workspace) => {
  return _.flow(_.get('workspace.attributes'), _.getOr('{}', savedColumnSettingsWorkspaceAttributeName), parseAsStringOrJson)(workspace);
};

export const allSavedColumnSettingsEntityTypeKey = ({ snapshotName, entityType }) => {
  const baseKey = snapshotName ? `snapshots.${snapshotName}` : 'tables';
  const entityTypeKey = `${baseKey}.${entityType}`;
  return entityTypeKey;
};

export const useSavedColumnSettings = ({ workspaceId, snapshotName, entityMetadata, entityType }) => {
  // Saved column settings for all tables are stored in the same attribute in the format:
  // {
  //   snapshots: {
  //      snapshot_name: {
  //        table_name: {
  //          settings_name: settings,
  //          ...
  //        },
  //        ...
  //      },
  //      ...
  //    },
  //    tables: {
  //      table_name: {
  //        settings_name: settings,
  //        ...
  //      },
  //      ...
  //    }
  // }
  const baseKey = snapshotName ? `snapshots.${snapshotName}` : 'tables';
  const entityTypeKey = allSavedColumnSettingsEntityTypeKey({ snapshotName, entityType });

  const signal = useCancellation();

  const getAllSavedColumnSettings = async () => {
    const { namespace, name } = workspaceId;
    const workspace = await Ajax(signal).Workspaces.workspace(namespace, name).details(['workspace.attributes']);
    return _.flow(
      allSavedColumnSettingsInWorkspace,
      // Drop any column settings for entity types that no longer exist
      _.update(baseKey, _.pick(_.keys(entityMetadata)))
    )(workspace);
  };

  const updateAllSavedColumnSettings = async (allColumnSettings) => {
    const { namespace, name } = workspaceId;
    await Ajax()
      .Workspaces.workspace(namespace, name)
      .shallowMergeNewAttributes({
        [savedColumnSettingsWorkspaceAttributeName]: allColumnSettings,
      });
  };

  const getSavedColumnSettings = async () => {
    const allSavedColumnSettings = await getAllSavedColumnSettings();
    const columnSettingsForEntityType = _.getOr({}, entityTypeKey, allSavedColumnSettings);
    const entityTypeAttributes = entityMetadata[entityType].attributeNames;

    return _.flow(
      _.mapValues(decodeColumnSettings),
      // Reconcile saved settings with any changes to entity type attributes
      _.mapValues((columnSettings) => {
        return _.concat(
          // Remove columns that no longer exist on the entity type from settings
          _.filter(({ name }) => _.includes(name, entityTypeAttributes), columnSettings),
          // Add columns that were not in the saved settings
          _.flow(
            _.without(_.map(_.get('name'), columnSettings)),
            _.map((name) => ({ name, visible: false }))
          )(entityTypeAttributes)
        );
      }),
      // Remove any settings that do not contain any existing columns
      _.pickBy((columnSettings) => _.size(columnSettings) > 0)
    )(columnSettingsForEntityType);
  };

  const saveColumnSettings = async (columnSettingsName, columnSettings) => {
    // Re-fetch column settings to reduce the chances of overwriting changes made by other users since we first loaded settings.
    const allColumnSettings = await getAllSavedColumnSettings();
    const newColumnSettings = _.set(`${entityTypeKey}.${columnSettingsName}`, encodeColumnSettings(columnSettings), allColumnSettings);
    await updateAllSavedColumnSettings(newColumnSettings);
  };

  const deleteSavedColumnSettings = async (columnSettingsName) => {
    // Re-fetch column settings to reduce the chances of overwriting changes made by other users since we first loaded settings.
    const allColumnSettings = await getAllSavedColumnSettings();
    const newColumnSettings = _.omit(`${entityTypeKey}.${columnSettingsName}`, allColumnSettings);
    await updateAllSavedColumnSettings(newColumnSettings);
  };

  return {
    getAllSavedColumnSettings,
    updateAllSavedColumnSettings,
    getSavedColumnSettings,
    saveColumnSettings,
    deleteSavedColumnSettings,
  };
};

const SavedColumnSettings = ({ workspace, snapshotName, entityType, entityMetadata, columnSettings, onLoad }) => {
  const {
    workspace: { namespace, name },
  } = workspace;
  const [loading, setLoading] = useState(true);
  const [savedColumnSettings, setSavedColumnSettings] = useState([]);

  const { getSavedColumnSettings, saveColumnSettings, deleteSavedColumnSettings } = useSavedColumnSettings({
    workspaceId: { namespace, name },
    snapshotName,
    entityType,
    entityMetadata,
  });

  useOnMount(() => {
    const loadSavedColumnSettings = _.flow(
      withErrorReporting('Error loading saved column settings'),
      withBusyState(setLoading)
    )(async () => {
      const savedColumnSettings = await getSavedColumnSettings();
      setSavedColumnSettings(savedColumnSettings);
    });
    loadSavedColumnSettings();
  });

  const [showSaveForm, setShowSaveForm] = useState(false);
  const settingsNameInput = useRef();
  useEffect(() => {
    if (showSaveForm) {
      settingsNameInput.current.focus();
    }
  }, [showSaveForm]);
  const [selectedSettingsName, setSelectedSettingsName] = useState('');

  const save = _.flow(
    withErrorReporting('Error saving column settings'),
    withBusyState(setLoading)
  )(async (settingsName) => {
    await saveColumnSettings(settingsName, columnSettings);
    setSavedColumnSettings(_.set(settingsName, columnSettings));
    Ajax().Metrics.captureEvent(Events.dataTableSaveColumnSettings);
  });

  const load = (settingsName) => {
    onLoad(savedColumnSettings[settingsName]);
    setSelectedSettingsName(settingsName);
    Ajax().Metrics.captureEvent(Events.dataTableLoadColumnSettings);
  };

  const del = _.flow(
    withErrorReporting('Error deleting column settings'),
    withBusyState(setLoading)
  )(async (settingsName) => {
    await deleteSavedColumnSettings(settingsName);
    setSavedColumnSettings(_.omit(settingsName));
    setSelectedSettingsName('');
  });

  const selectedSettingsNameExists = _.has(selectedSettingsName, savedColumnSettings);
  const { value: canEdit, message: editErrorMessage } = workspace ? canEditWorkspace(workspace) : {};
  const canSaveSettings = workspace && canEdit;

  return div({ style: { display: 'flex', flexDirection: 'column', height: '100%' } }, [
    div(
      showSaveForm
        ? [
            p({ style: { marginTop: 0 } }, 'Save this column selection'),
            h(IdContainer, [
              (id) =>
                h(Fragment, [
                  h(FormLabel, { id }, 'Column selection name'),
                  h(AutocompleteTextInput, {
                    ref: settingsNameInput,
                    labelId: id,
                    openOnFocus: true,
                    placeholderText: 'Enter a name for selection',
                    onPick: setSelectedSettingsName,
                    placeholder: 'Enter a name for selection',
                    value: selectedSettingsName,
                    onChange: setSelectedSettingsName,
                    suggestions: _.flow(
                      _.keys,
                      selectedSettingsName ? _.concat(selectedSettingsName) : _.identity,
                      _.sortBy(_.identity),
                      _.sortedUniq
                    )(savedColumnSettings),
                    style: { fontSize: 16, marginBottom: '1rem' },
                  }),
                ]),
            ]),
            p({ style: { marginTop: 0 } }, 'This column selection will be shared with all users of this workspace.'),
            h(
              ButtonOutline,
              {
                disabled: !selectedSettingsName,
                tooltip: cond(
                  [!selectedSettingsName, () => 'Enter a name to save column selection'],
                  [selectedSettingsNameExists, () => 'Update this column selection'],
                  () => 'Save this column selection'
                ),
                onClick: () => {
                  save(selectedSettingsName);
                },
              },
              selectedSettingsNameExists ? 'Update' : 'Save'
            ),
          ]
        : [
            h(
              ButtonOutline,
              {
                disabled: !canSaveSettings,
                tooltip: editErrorMessage,
                onClick: () => {
                  setShowSaveForm(true);
                },
              },
              'Save this column selection'
            ),
          ]
    ),

    _.size(savedColumnSettings) > 0 &&
      h(Fragment, [
        hr({ style: { margin: '1rem 0' } }),
        p({ style: { marginTop: 0 } }, 'Your saved column selections:'),
        div({ style: { flex: '1 1 0', overflow: 'auto', paddingRight: '1rem' } }, [
          ul({ style: { padding: 0, margin: 0 } }, [
            _.flow(
              _.keys,
              _.sortBy(_.identity),
              _.map((settingsName) => {
                return li(
                  {
                    key: settingsName,
                    style: { listStyleType: 'none', marginBottom: '0.5rem' },
                  },
                  [
                    span({ style: { display: 'inline-flex', width: '100%' } }, [
                      h(TooltipTrigger, { content: settingsName }, [span({ style: { ...noWrapEllipsis } }, settingsName)]),
                      h(
                        MenuTrigger,
                        {
                          closeOnClick: true,
                          'aria-label': 'Column selection menu',
                          content: h(Fragment, [
                            h(
                              MenuButton,
                              {
                                onClick: () => {
                                  load(settingsName);
                                },
                              },
                              'Load'
                            ),
                            h(
                              MenuButton,
                              {
                                onClick: () => {
                                  del(settingsName);
                                },
                              },
                              'Delete'
                            ),
                          ]),
                          side: 'bottom',
                        },
                        [
                          h(
                            Clickable,
                            {
                              'aria-label': 'Column selection menu',
                              style: { color: colors.accent(), marginLeft: '1ch' },
                            },
                            [icon('cardMenuIcon')]
                          ),
                        ]
                      ),
                    ]),
                  ]
                );
              })
            )(savedColumnSettings),
          ]),
        ]),
      ]),

    loading && spinnerOverlay,
  ]);
};

export const ColumnSettingsWithSavedColumnSettings = ({ columnSettings, onChange, ...otherProps }) => {
  const columnSettingsRef = useRef();

  // This will update the state of the ColumnSettings component currently in use
  const updateColumnSettings = (newColumnSettings) => {
    if (columnSettingsRef.current) {
      columnSettingsRef.current.updateItems(newColumnSettings);
    }
  };

  return div({ style: { display: 'flex', justifyContent: 'space-between' } }, [
    div({ style: { flex: '1 1 0' } }, [
      h(ColumnSettings, {
        ref: columnSettingsRef,
        columnSettings,
        onChange,
      }),
    ]),
    div(
      {
        style: {
          width: '275px',
          paddingLeft: '1rem',
          borderLeft: `1px solid ${colors.light()}`,
          marginLeft: '1rem',
          marginTop: '2rem',
        },
      },
      [
        h(SavedColumnSettings, {
          ...otherProps,
          columnSettings,
          onLoad: (updatedColumnSettings) => {
            onChange(updatedColumnSettings);
            updateColumnSettings(updatedColumnSettings);
          },
        }),
      ]
    ),
  ]);
};
