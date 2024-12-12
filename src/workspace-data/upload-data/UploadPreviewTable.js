import { TooltipTrigger } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { code, div, em, h, h3, p, span, strong } from 'react-hyperscript-helpers';
import { AutoSizer } from 'react-virtualized';
import { ButtonPrimary, ButtonSecondary, fixedSpinnerOverlay } from 'src/components/common';
import { icon } from 'src/components/icons';
import { NameModal } from 'src/components/NameModal';
import { GridTable, HeaderCell, Resizable, Sortable } from 'src/components/table';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import { getLocalPref } from 'src/libs/prefs';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import * as Utils from 'src/libs/utils';

import { renderDataCell } from '../data-table/entity-service/renderDataCell';

const UploadDataTable = (props) => {
  const {
    workspace,
    metadataTable,
    metadataTable: { entityType, rows, columns, idName },
    onConfirm,
    onCancel,
    onRename,
    refreshKey,
  } = props;
  const {
    workspace: { namespace, name },
  } = workspace;

  const persistenceId = `${namespace}/${name}/${entityType}`;
  const nonIdColumns = _.drop(1, columns);

  // State
  const [entityMetadata, setEntityMetadata] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [metadataLoading, setMetadataLoading] = useState(false);

  const [sort, setSort] = useState({ field: 'name', direction: 'asc' });
  const [renamingTable, setRenamingTable] = useState(false);

  const [columnWidths, setColumnWidths] = useState(() => getLocalPref(persistenceId)?.columnWidths || {});

  const table = useRef();
  const signal = useCancellation();

  useEffect(() => {
    const loadMetadata = _.flow(
      withErrorReporting('Error loading entity data'),
      Utils.withBusyState(setMetadataLoading)
    )(async () => {
      setEntityMetadata(await Workspaces(signal).workspace(namespace, name).entityMetadata());
    });

    loadMetadata();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Convert from a metadata table to an entity
  useEffect(() => {
    if (entityMetadata && metadataTable?.rows?.length > 0) {
      let metadata = null;
      let isUpdate = false;
      let columnsAdded = [];
      let columnsUpdated = [];

      if (!(entityType in entityMetadata)) {
        metadata = {
          attributeNames: nonIdColumns,
          idName,
          count: rows.length,
        };
      } else {
        metadata = entityMetadata[entityType];
        columnsAdded = _.difference(nonIdColumns, metadata.attributeNames);
        columnsUpdated = _.intersection(metadata.attributeNames, nonIdColumns);
        metadata.attributeNames = _.concat(metadata.attributeNames, columnsAdded);
        isUpdate = true;
      }
      setMetadata({
        ...metadata,
        entityType,
        table: metadataTable,
        isUpdate,
        columnsAdded,
        columnsUpdated,
      });
    } else {
      setMetadata(null);
    }
  }, [metadataTable, entityMetadata]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    table.current?.recomputeColumnSizes();
  }, [columnWidths]);

  // Move the focus to the header the first time this panel is rendered
  const header = useRef();
  useOnMount(() => {
    header.current?.focus();
  });

  const isColumnAdded = (columnIndex) => {
    return metadata?.isUpdate && columnIndex < columns.length && metadata.columnsAdded.indexOf(columns[columnIndex]) > -1;
  };

  const isColumnUpdated = (columnIndex) => {
    return metadata?.isUpdate && columnIndex < columns.length && metadata.columnsUpdated.indexOf(columns[columnIndex]) > -1;
  };

  const sortedRows = useMemo(() => {
    const i = columns ? columns.indexOf(sort.field) : -1;
    return i > -1 ? _.orderBy((row) => row[i], sort.direction, rows) : rows;
  }, [sort, rows, columns]);

  const renderHeader = (columnIndex, name) => {
    const [, columnNamespace, columnName] = /(.+:)?(.+)/.exec(name);
    const isUpdated = isColumnUpdated(columnIndex);
    const isAdded = isColumnAdded(columnIndex);

    return span([
      !!columnNamespace && span({ style: { fontStyle: 'italic', color: colors.dark(0.75), paddingRight: '0.2rem' } }, columnNamespace),
      isUpdated &&
        h(
          TooltipTrigger,
          {
            content: 'Values in this column will update existing rows',
            side: 'top',
          },
          [
            span(
              {
                style: { paddingRight: '1ex' },
              },
              [icon('warning-standard')]
            ),
          ]
        ),
      isAdded &&
        h(
          TooltipTrigger,
          {
            content: 'Values in this column will be added to existing rows',
            side: 'top',
          },
          [
            span(
              {
                style: { paddingRight: '1ex' },
              },
              [icon('lighter-plus-circle')]
            ),
          ]
        ),
      columnName,
      isAdded && em({ style: { paddingLeft: '1ex', fontWeight: 400 } }, '(new)'),
      isUpdated && em({ style: { paddingLeft: '1ex', fontWeight: 400 } }, '(updated)'),
    ]);
  };

  return div(
    {
      style: { display: 'flex', flexDirection: 'column', height: '100%' },
    },
    [
      div(
        {
          style: { position: 'relative', flex: '0 0 auto' },
        },
        [
          div(
            {
              style: { position: 'absolute', top: 0, right: 0, marginTop: '1em' },
            },
            [
              h(
                ButtonSecondary,
                {
                  style: { marginRight: '2em' },
                  onClick: () => {
                    onCancel && onCancel();
                  },
                },
                ['Cancel']
              ),
              h(
                ButtonPrimary,
                {
                  onClick: () => {
                    onConfirm && onConfirm({ metadata });
                  },
                },
                [metadata?.isUpdate ? 'Update Table' : 'Create Table']
              ),
            ]
          ),
          metadata &&
            div([
              metadata.isUpdate
                ? div([
                    h3([
                      'Updating Table: ',
                      strong(metadata.entityType),
                      h(
                        ButtonSecondary,
                        {
                          onClick: () => setRenamingTable(true),
                          style: { padding: '0 2em' },
                        },
                        [icon('renameIcon'), span({ style: { paddingLeft: '1ex' } }, 'Rename Table')]
                      ),
                    ]),
                    p(
                      {
                        style: { color: colors.danger() },
                      },
                      [
                        icon('warning-standard'),
                        ' This workspace already includes a table with this name. If any new rows have the same ',
                        code(metadata.idName),
                        ' as an existing row, the data in that row will be updated with the new values.',
                      ]
                    ),
                  ])
                : div([h3(['Creating a new Table: ', strong(metadata.entityType)])]),
              p(
                `If this table looks right to you, click the button on the right to ${
                  metadata.isUpdate ? 'update' : 'create'
                } the table in your workspace.`
              ),
            ]),
        ]
      ),
      metadata &&
        h(Fragment, [
          div(
            {
              style: { flex: '1 1 auto', minHeight: '30em' },
            },
            [
              h(AutoSizer, {}, [
                ({ width, height }) => {
                  return h(GridTable, {
                    ref: table,
                    'aria-label': 'metadata preview table',
                    width,
                    height,
                    rowCount: sortedRows.length,
                    noContentMessage: `No ${entityType}s to display.`,
                    sort,
                    columns: [
                      ..._.map((name) => {
                        const thisWidth = columnWidths[name] || 300;
                        return {
                          field: name,
                          width: thisWidth,
                          headerRenderer: ({ columnIndex }) =>
                            h(
                              Resizable,
                              {
                                width: thisWidth,
                                onWidthChange: (delta) => setColumnWidths(_.set(name, thisWidth + delta)),
                              },
                              [h(Sortable, { sort, field: name, onSort: setSort }, [h(HeaderCell, [renderHeader(columnIndex, name)])])]
                            ),
                          cellRenderer: ({ rowIndex, columnIndex }) => {
                            const value = sortedRows[rowIndex][columnIndex];
                            return renderDataCell(value, workspace);
                          },
                        };
                      }, columns),
                    ],
                    styleCell: ({ rowIndex }) => {
                      return rowIndex % 2 && { backgroundColor: colors.light(0.2) };
                    },
                    styleHeader: ({ columnIndex }) => {
                      // See if this column was updated
                      if (isColumnUpdated(columnIndex)) {
                        return { backgroundColor: colors.warning(0.2) };
                      }
                      if (isColumnAdded(columnIndex)) {
                        return { backgroundColor: colors.success(0.2) };
                      }
                      return {};
                    },
                  });
                },
              ]),
            ]
          ),
        ]),
      renamingTable &&
        h(NameModal, {
          thing: 'Entity Table',
          value: metadata.entityType,
          validator: /^[A-Za-z0-9_-]+$/,
          validationMessage: 'Table name may only contain alphanumeric characters, underscores, and dashes',
          onDismiss: () => setRenamingTable(false),
          onSuccess: ({ name }) => {
            onRename({ name });
            setRenamingTable(false);
          },
        }),
      metadataLoading && fixedSpinnerOverlay,
    ]
  );
};

export default UploadDataTable;
