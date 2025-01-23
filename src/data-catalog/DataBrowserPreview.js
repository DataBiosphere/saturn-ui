import ReactJson from '@microlink/react-json-view';
import _ from 'lodash/fp';
import { useEffect, useState } from 'react';
import { div, h, h1, h2 } from 'react-hyperscript-helpers';
import { ButtonPrimary, GroupedSelect, Link } from 'src/components/common';
import FooterWrapper from 'src/components/FooterWrapper';
import { centeredSpinner, icon } from 'src/components/icons';
import { libraryTopMatter } from 'src/components/library-common';
import ModalDrawer from 'src/components/ModalDrawer';
import { ColumnSelector, SimpleTable } from 'src/components/table';
import { Catalog } from 'src/libs/ajax/Catalog';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import * as Nav from 'src/libs/nav';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import * as Utils from 'src/libs/utils';

import { datasetAccessTypes, getDatasetAccessType, useDataCatalog } from './data-browser-utils';

const styles = {
  table: {
    header: {
      color: colors.accent(),
      height: '2rem',
      lineHeight: '2rem',
      textTransform: 'uppercase',
      fontWeight: 600,
      fontSize: '0.75rem',
    },
    headerRowStyle: {
      borderTop: `1px solid ${colors.dark(0.35)}`,
      borderBottom: `1px solid ${colors.dark(0.35)}`,
    },
    rowStyle: {
      borderBottom: `1px solid ${colors.dark(0.2)}`,
    },
    evenRowStyle: {
      backgroundColor: 'white',
    },
    oddRowStyle: {
      backgroundColor: colors.light(0.5),
    },
  },
};

const activeTab = 'datasets';

const DatasetPreviewSelector = ({ access, selectedTable, setSelectedTable, selectOptions }) =>
  Utils.switchCase(
    access,
    [datasetAccessTypes.Controlled, () => Nav.goToPath('library-details', { id: Nav.getCurrentRoute().params.id })],
    [
      datasetAccessTypes.Granted,
      () =>
        h(GroupedSelect, {
          'aria-label': 'data type',
          styles: { container: (base) => ({ ...base, marginLeft: '1rem', width: 350, marginBottom: 30 }) },
          isSearchable: true,
          isClearable: false,
          value: selectedTable,
          getOptionLabel: ({ value }) => div({ style: { color: colors.dark(1) } }, [_.startCase(value)]),
          formatGroupLabel: ({ label }) => {
            return (
              !!label &&
              div(
                {
                  style: { marginTop: 5, paddingTop: 15, borderTop: `1px solid ${colors.dark(0.5)}`, color: colors.dark(0.8) },
                },
                [label]
              )
            );
          },
          onChange: ({ value }) => setSelectedTable(value),
          options: selectOptions,
        }),
    ],
    [Utils.DEFAULT, undefined]
  );

export const formatTableCell = ({ cellKey, cellContent, rowIndex, table, setViewJSON }) => {
  const parsableCellContent = _.isObject(cellContent) ? JSON.stringify(cellContent) : cellContent;
  const maybeJSON = Utils.maybeParseJSON(parsableCellContent);
  return Utils.cond(
    [!Utils.cantBeNumber(cellContent), () => cellContent],
    [
      !!maybeJSON,
      () =>
        h(
          ButtonPrimary,
          {
            style: { fontSize: 16, textTransform: 'none' },
            onClick: () => setViewJSON({ title: `${table}, Row ${rowIndex} - ${cellKey}`, cellData: maybeJSON }),
          },
          ['View JSON']
        ),
    ],
    [Utils.DEFAULT, () => cellContent?.toString()]
  );
};

const DataBrowserPreview = ({ id }) => {
  const signal = useCancellation();
  const [loading, setLoading] = useState(false);
  const { dataCatalog, loading: catalogLoading } = useDataCatalog();
  const [tables, setTables] = useState(undefined);
  const [selectedTable, setSelectedTable] = useState();
  const [previewRows, setPreviewRows] = useState();
  const [columns, setColumns] = useState();
  const [viewJSON, setViewJSON] = useState();
  const [selectOptions, setSelectOptions] = useState();

  useOnMount(() => {
    const loadData = async () => {
      // TODO (DC-283): move to catalog service
      const { tables: newTables } = await Catalog(signal).getDatasetTables(id);

      const hasData = _.flow(
        _.sortBy('name'),
        _.map(({ name, hasData }) => ({ value: name, hasData })),
        _.filter(({ hasData }) => hasData)
      )(newTables);

      const newSelectOptions = [{ label: '', options: hasData }];

      setTables(newTables);
      setSelectOptions(newSelectOptions);
      setSelectedTable(hasData[0]?.value);
    };

    loadData();
  });

  useEffect(() => {
    const loadTable = _.flow(
      Utils.withBusyState(setLoading),
      withErrorReporting('Error loading table')
    )(async () => {
      const previewTableData = await Catalog(signal).getDatasetPreviewTable({ id, tableName: selectedTable });

      const newDisplayColumns = _.flow(
        Utils.toIndexPairs,
        _.map(([index, { name }]) => ({
          // name field is used in the column selector
          // key field is used in the Simple Table
          name,
          key: name,
          visible: index < 6,
          header: div({ style: styles.table.header }, [name]),
        }))
      )(previewTableData.columns);

      setColumns(newDisplayColumns);

      const newPreviewRows = _.flow(
        _.getOr([], 'rows'),
        Utils.toIndexPairs,
        _.map(([rowIndex, row]) => {
          return _.reduce(
            (acc, { name }) => {
              const formattedCell = formatTableCell({ cellKey: name, cellContent: row[name], rowIndex, table: selectedTable, setViewJSON });
              return _.set([name], formattedCell, acc);
            },
            {},
            previewTableData.columns
          );
        })
      )(previewTableData);

      setPreviewRows(newPreviewRows);
    });

    if (!!tables && !!selectedTable && access === datasetAccessTypes.Granted) {
      loadTable();
    }
  }, [selectedTable]); // eslint-disable-line react-hooks/exhaustive-deps

  const dataset = _.find({ id }, dataCatalog);
  const access = getDatasetAccessType(dataset);

  return h(FooterWrapper, { alwaysShow: true }, [
    libraryTopMatter(activeTab),
    catalogLoading || !tables
      ? centeredSpinner()
      : div({ style: { padding: 20 } }, [
          div(
            {
              style: { display: 'flex', flexDirection: 'row', alignItems: 'top', justifyContent: 'space-between', width: '100%', lineHeight: '26px' },
            },
            [
              h1([dataset['dct:title']]),
              h(
                Link,
                {
                  onClick: Nav.history.goBack,
                  'aria-label': 'Close',
                  style: { marginTop: '1rem' },
                },
                [icon('times', { size: 30 })]
              ),
            ]
          ),
          h(DatasetPreviewSelector, { access, dataset, selectedTable, setSelectedTable, selectOptions }),
          loading
            ? centeredSpinner()
            : div({ style: { position: 'relative', padding: '0 15px' } }, [
                div({ role: 'status', 'aria-label': `${selectedTable} Preview Data Table loaded` }, []),
                h(SimpleTable, {
                  'aria-label': `${_.startCase(selectedTable)} Preview Data`,
                  columns: _.filter('visible', columns),
                  cellStyle: { border: 'none', paddingRight: 15, wordBreak: 'break-all', display: 'flex', alignItems: 'center' },
                  ...styles.table,
                  useHover: false,
                  rows: previewRows,
                }),
                !_.isEmpty(columns) &&
                  h(ColumnSelector, {
                    onSave: setColumns,
                    columnSettings: columns,
                    style: { backgroundColor: 'unset', height: '2.5rem', width: '2.5rem', border: 0, right: 15 },
                  }),
              ]),
        ]),
    !!viewJSON &&
      h(
        ModalDrawer,
        {
          'aria-label': 'View Json',
          isOpen: true,
          width: 675,
          onDismiss: () => {
            setViewJSON();
          },
        },
        [
          div({ style: { padding: '0 25px 25px' } }, [
            h2([viewJSON.title]),
            h(ReactJson, {
              style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', backgroundColor: 'white' },
              name: false,
              collapsed: 4,
              enableClipboard: true,
              displayDataTypes: false,
              displayObjectSize: false,
              src: viewJSON.cellData,
            }),
          ]),
        ]
      ),
  ]);
};

export const navPaths = [
  {
    name: 'library-catalog-preview',
    path: '/library/browser/:id/preview',
    component: DataBrowserPreview,
    title: 'Catalog - Dataset Preview',
  },
];
