import { ButtonSecondary, Clickable, Icon } from '@terra-ui-packages/components';
import FileSaver from 'file-saver';
import _ from 'lodash/fp';
import { Fragment, useEffect, useRef, useState } from 'react';
import { div, h, p } from 'react-hyperscript-helpers';
import { AutoSizer } from 'react-virtualized';
import { Checkbox, DeleteConfirmationModal, Link, Select, spinnerOverlay } from 'src/components/common';
import Dropzone from 'src/components/Dropzone';
import { icon } from 'src/components/icons';
import { DelayedSearchInput, TextInput } from 'src/components/input';
import { MenuButton } from 'src/components/MenuButton';
import { MenuDivider, MenuTrigger } from 'src/components/PopupTrigger';
import { FlexTable, HeaderCell } from 'src/components/table';
import { Ajax } from 'src/libs/ajax';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { renderDataCell } from 'src/workspace-data/data-table/entity-service/renderDataCell';
import * as WorkspaceUtils from 'src/workspaces/utils';

import { useWorkspaceDataAttributes } from './useWorkspaceDataAttributes';

const DESCRIPTION_PREFIX = '__DESCRIPTION__';
const isDescriptionKey = _.startsWith(DESCRIPTION_PREFIX);

export const WorkspaceAttributes = ({
  workspace,
  workspace: {
    workspace: { namespace, name },
  },
  refreshKey,
}) => {
  const [selection, setSelection] = useState({});
  const numSelected = Object.entries(selection).filter(([_, selected]) => selected).length;

  const [editIndex, setEditIndex] = useState();
  const [deleting, setDeleting] = useState(false);
  const [editKey, setEditKey] = useState();
  const [editValue, setEditValue] = useState();
  const [editDescription, setEditDescription] = useState();
  const [editType, setEditType] = useState();
  const [textFilter, setTextFilter] = useState('');

  const [busy, setBusy] = useState();
  const [attributes, refreshAttributes] = useWorkspaceDataAttributes(namespace, name);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (!isFirstRender.current) {
      refreshAttributes();
    }
    isFirstRender.current = false;
  }, [refreshAttributes, refreshKey]);

  const stopEditing = () => {
    setEditIndex();
    setEditKey();
    setEditValue();
    setEditDescription();
    setEditType();
  };

  const toDescriptionKey = (k) => DESCRIPTION_PREFIX + k;

  const initialAttributes = attributes.state || [];
  const creatingNewVariable = editIndex === initialAttributes.length;
  const filteredAttributes = initialAttributes.filter(([key, value, description]) => {
    return [key, value, description].some((v) => `${v ?? ''}`.toLowerCase().includes(textFilter.toLowerCase()));
  });
  const amendedAttributes = _.flow(creatingNewVariable ? Utils.append(['', '', '']) : _.identity)(filteredAttributes);

  const allVisibleAttributesSelected = filteredAttributes.every(([id]) => selection[id]);

  const DESCRIPTION_MAX_LENGTH = 200;
  const inputErrors = editIndex !== undefined && [
    ...(_.map(
      (innerArray) => _.first(innerArray),
      attributes.state.filter((_, index) => index !== editIndex)
    ).includes(editKey)
      ? ['Key must be unique']
      : []),
    ...(!/^[\w-]*$/.test(editKey) ? ['Key can only contain letters, numbers, underscores, and dashes'] : []),
    ...(editKey === 'description' ? ["Key cannot be 'description'"] : []),
    ...(isDescriptionKey(editKey) ? [`Key cannot start with '${DESCRIPTION_PREFIX}'`] : []),
    ...(editDescription?.length > DESCRIPTION_MAX_LENGTH ? [`Description cannot be longer than ${DESCRIPTION_MAX_LENGTH} characters`] : []),
    ...(editKey.startsWith('referenceData_') ? ["Key cannot start with 'referenceData_'"] : []),
    ...(!editKey ? ['Key is required'] : []),
    ...(!editValue ? ['Value is required'] : []),
    ...(editValue && editType === 'number' && Utils.cantBeNumber(editValue) ? ['Value is not a number'] : []),
    ...(editValue && editType === 'number list' && _.some(Utils.cantBeNumber, editValue.split(','))
      ? ['Value is not a comma-separated list of numbers']
      : []),
  ];

  const saveAttribute = _.flow(
    withErrorReporting('Error saving change to workspace variables'),
    Utils.withBusyState(setBusy)
  )(async (originalKey) => {
    const isList = editType.includes('list');
    const newBaseType = isList ? editType.slice(0, -5) : editType;
    const parsedValue = isList ? _.map(Utils.convertValue(newBaseType), editValue.split(/,\s*/)) : Utils.convertValue(newBaseType, editValue);

    const editDescriptionKey = toDescriptionKey(editKey);

    const attributesToMerge = {
      [editKey]: parsedValue,
      ...(!!editDescription && { [editDescriptionKey]: editDescription }),
    };

    const attributesToDelete = [
      ...(editKey !== originalKey ? [originalKey, toDescriptionKey(originalKey)] : []),
      ...(!editDescription ? [editDescriptionKey] : []),
    ];

    await Ajax().Workspaces.workspace(namespace, name).shallowMergeNewAttributes(attributesToMerge);
    await Ajax().Workspaces.workspace(namespace, name).deleteAttributes(attributesToDelete);

    await refreshAttributes();

    stopEditing();
    setTextFilter('');
  });

  const upload = _.flow(
    withErrorReporting('Error uploading file'),
    Utils.withBusyState(setBusy)
  )(async ([file]) => {
    await Ajax().Workspaces.workspace(namespace, name).importAttributes(file);
    await refreshAttributes();
  });

  const download = _.flow(
    withErrorReporting('Error downloading attributes'),
    Utils.withBusyState(setBusy)
  )(async () => {
    const blob = await Ajax().Workspaces.workspace(namespace, name).exportAttributes();
    FileSaver.saveAs(blob, `${name}-workspace-attributes.tsv`);
  });

  return h(
    Dropzone,
    {
      disabled: !WorkspaceUtils.canEditWorkspace(workspace).value,
      style: { flex: 1, display: 'flex', flexDirection: 'column' },
      activeStyle: { backgroundColor: colors.accent(0.2), cursor: 'copy' },
      onDropAccepted: upload,
    },
    [
      ({ openUploader }) =>
        h(Fragment, [
          div(
            {
              style: {
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                padding: '1rem',
                background: colors.light(0.5),
                borderBottom: `1px solid ${colors.grey(0.4)}`,
              },
            },
            [
              h(
                MenuTrigger,
                {
                  side: 'bottom',
                  closeOnClick: true,
                  content: h(Fragment, [
                    h(
                      MenuButton,
                      {
                        disabled: editIndex !== undefined,
                        onClick: () => {
                          setEditIndex(amendedAttributes.length);
                          setEditValue('');
                          setEditKey('');
                          setEditType('string');
                          setEditDescription('');
                        },
                      },
                      ['Add variable']
                    ),
                    h(
                      MenuButton,
                      {
                        onClick: openUploader,
                      },
                      ['Upload TSV']
                    ),
                    h(MenuDivider),
                    h(
                      MenuButton,
                      {
                        disabled: numSelected === 0,
                        tooltip: numSelected === 0 ? 'Select variables to delete in the table' : undefined,
                        onClick: () => setDeleting(true),
                      },
                      'Delete selected variables'
                    ),
                  ]),
                },
                [
                  h(
                    ButtonSecondary,
                    {
                      disabled: editIndex !== undefined,
                      tooltip: 'Edit data',
                      ...WorkspaceUtils.getWorkspaceEditControlProps(workspace),
                      style: { marginRight: '1.5rem' },
                    },
                    [h(Icon, { icon: 'edit', style: { marginRight: '0.5rem' } }), 'Edit']
                  ),
                ]
              ),
              h(
                ButtonSecondary,
                {
                  onClick: download,
                },
                [h(Icon, { icon: 'download', style: { marginRight: '0.5rem' } }), 'Download TSV']
              ),
              div({ style: { margin: '0 1.5rem', height: '100%', borderLeft: Style.standardLine } }),
              div(
                {
                  role: 'status',
                  'aria-atomic': true,
                  style: { marginRight: '0.5rem' },
                },
                [`${numSelected} row${numSelected === 1 ? '' : 's'} selected`]
              ),
              h(DelayedSearchInput, {
                'aria-label': 'Search',
                style: { width: 300, marginLeft: 'auto' },
                placeholder: 'Search',
                onChange: setTextFilter,
                value: textFilter,
              }),
            ]
          ),
          div({ style: { flex: 1, margin: '0 0 1rem' } }, [
            h(AutoSizer, [
              ({ width, height }) =>
                h(FlexTable, {
                  'aria-label': 'workspace data local variables table',
                  width,
                  height,
                  rowCount: amendedAttributes.length,
                  hoverHighlight: true,
                  noContentMessage: _.isEmpty(initialAttributes) ? 'No Workspace Data defined' : 'No matching data',
                  border: false,
                  columns: [
                    {
                      size: { basis: 70, grow: 0 },
                      headerRenderer: () => {
                        return h(Fragment, [
                          h(Checkbox, {
                            checked: allVisibleAttributesSelected,
                            disabled: initialAttributes.length === 0 || editIndex !== undefined,
                            onChange: () => {
                              if (allVisibleAttributesSelected) {
                                setSelection({});
                              } else {
                                setSelection((previous) => ({ ...previous, ...Object.fromEntries(filteredAttributes.map(([id]) => [id, true])) }));
                              }
                            },
                            'aria-label': 'Select all',
                          }),
                          h(
                            MenuTrigger,
                            {
                              closeOnClick: true,
                              content: h(Fragment, [
                                h(
                                  MenuButton,
                                  {
                                    onClick: () => setSelection(Object.fromEntries(initialAttributes.map(([id]) => [id, true]))),
                                  },
                                  [`All (${initialAttributes.length})`]
                                ),
                                filteredAttributes.length < initialAttributes.length &&
                                  h(
                                    MenuButton,
                                    {
                                      onClick: () =>
                                        setSelection((previous) => ({
                                          ...previous,
                                          ...Object.fromEntries(filteredAttributes.map(([id]) => [id, true])),
                                        })),
                                    },
                                    [`Filtered (${filteredAttributes.length})`]
                                  ),
                                h(
                                  MenuButton,
                                  {
                                    onClick: () => setSelection({}),
                                  },
                                  ['None']
                                ),
                              ]),
                              side: 'bottom',
                            },
                            [h(Clickable, { 'aria-label': '"Select All" options' }, [h(Icon, { icon: 'caretDown' })])]
                          ),
                        ]);
                      },
                      cellRenderer: ({ rowIndex }) => {
                        if (rowIndex === editIndex) {
                          return null;
                        }

                        const [id] = filteredAttributes[rowIndex];
                        return h(Checkbox, {
                          'aria-label': id,
                          checked: !!selection[id],
                          disabled: editIndex !== undefined,
                          onChange: () => setSelection((previous) => ({ ...previous, [id]: !previous[id] })),
                        });
                      },
                    },
                    {
                      size: { basis: 400, grow: 0 },
                      headerRenderer: () => h(HeaderCell, ['Key']),
                      cellRenderer: ({ rowIndex }) =>
                        editIndex === rowIndex
                          ? h(TextInput, {
                              'aria-label': 'Workspace data key',
                              autoFocus: true,
                              value: editKey,
                              onChange: setEditKey,
                            })
                          : renderDataCell(amendedAttributes[rowIndex][0], workspace),
                    },
                    {
                      size: { grow: 1 },
                      headerRenderer: () => h(HeaderCell, ['Value']),
                      cellRenderer: ({ rowIndex }) => {
                        const originalValue = amendedAttributes[rowIndex][1];

                        return h(Fragment, [
                          div({ style: { flex: 1, minWidth: 0, display: 'flex' } }, [
                            editIndex === rowIndex
                              ? h(TextInput, {
                                  'aria-label': 'Workspace data value',
                                  value: editValue,
                                  onChange: setEditValue,
                                })
                              : renderDataCell(originalValue, workspace),
                          ]),
                          editIndex === rowIndex &&
                            h(Fragment, [
                              h(Select, {
                                'aria-label': 'data type',
                                styles: {
                                  container: (base) => ({ ...base, marginLeft: '1rem', display: 'inline-block', width: 150 }),
                                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                },
                                isSearchable: false,
                                isClearable: false,
                                getOptionLabel: ({ value }) => _.startCase(value),
                                value: editType,
                                onChange: ({ value }) => setEditType(value),
                                options: ['string', 'number', 'boolean', 'string list', 'number list', 'boolean list'],
                                menuPortalTarget: document.body,
                                menuPosition: 'fixed',
                                menuPlacement: 'top',
                              }),
                            ]),
                        ]);
                      },
                    },
                    {
                      size: { grow: 1 },
                      headerRenderer: () => h(HeaderCell, ['Description']),
                      cellRenderer: ({ rowIndex }) => {
                        const [originalKey, originalValue, originalDescription] = amendedAttributes[rowIndex];

                        return h(Fragment, [
                          div({ style: { flex: 1, minWidth: 0, display: 'flex' } }, [
                            editIndex === rowIndex
                              ? h(TextInput, {
                                  'aria-label': 'Workspace data description',
                                  value: editDescription,
                                  onChange: setEditDescription,
                                })
                              : renderDataCell(originalDescription, workspace),
                          ]),
                          editIndex === rowIndex
                            ? h(Fragment, [
                                h(
                                  Link,
                                  {
                                    tooltip: Utils.summarizeErrors(inputErrors) || 'Save changes',
                                    disabled: !!inputErrors.length,
                                    style: { marginLeft: '1rem' },
                                    onClick: () => saveAttribute(originalKey),
                                  },
                                  [icon('success-standard', { size: 23 })]
                                ),
                                h(
                                  Link,
                                  {
                                    tooltip: 'Cancel editing',
                                    style: { marginLeft: '1rem' },
                                    onClick: stopEditing,
                                  },
                                  [icon('times-circle', { size: 23 })]
                                ),
                              ])
                            : div({ className: 'hover-only' }, [
                                h(
                                  Link,
                                  {
                                    tooltip: 'Edit variable',
                                    ...WorkspaceUtils.getWorkspaceEditControlProps(workspace),
                                    style: { marginLeft: '1rem' },
                                    onClick: () => {
                                      setEditIndex(rowIndex);
                                      setEditValue(_.isObject(originalValue) ? originalValue.items.join(', ') : originalValue);
                                      setEditKey(originalKey);
                                      setEditType(_.isObject(originalValue) ? `${typeof originalValue.items[0]} list` : typeof originalValue);
                                      setEditDescription(originalDescription);
                                    },
                                  },
                                  [icon('edit', { size: 19 })]
                                ),
                              ]),
                        ]);
                      },
                    },
                  ],
                }),
            ]),
          ]),
          deleting &&
            h(
              DeleteConfirmationModal,
              {
                objectType: numSelected > 1 ? 'variables' : 'variable',
                title: `Delete ${numSelected} ${numSelected > 1 ? 'variables' : 'variable'}`,
                onConfirm: _.flow(
                  Utils.withBusyState(setBusy),
                  withErrorReporting('Error deleting workspace variables')
                )(async () => {
                  setDeleting(false);
                  await Ajax()
                    .Workspaces.workspace(namespace, name)
                    .deleteAttributes(
                      Object.entries(selection)
                        .filter(([_, selected]) => selected)
                        .flatMap(([id]) => [id, toDescriptionKey(id)])
                    );
                  setSelection({});
                  refreshAttributes();
                }),
                onDismiss: () => setDeleting(false),
              },
              [p([`Are you sure you want to delete the selected variable${numSelected > 1 ? 's' : ''}?`])]
            ),
          (attributes.status === 'Loading' || busy) && spinnerOverlay,
        ]),
    ]
  );
};
