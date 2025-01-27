import _ from 'lodash/fp';
import React, { CSSProperties, Fragment, useState } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import { CloudProviderIcon } from 'src/components/CloudProviderIcon';
import { Link, spinnerOverlay } from 'src/components/common';
import { icon } from 'src/components/icons';
import { ColumnSelector, MiniSortable, SimpleTable } from 'src/components/table';
import { Dataset } from 'src/libs/ajax/Catalog';
import { Metrics } from 'src/libs/ajax/Metrics';
import colors from 'src/libs/colors';
import Events from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import {
  commonStyles,
  FilterSection,
  SearchAndFilterComponent,
  SearchAndFilterProps,
  Sort,
} from 'src/pages/library/SearchAndFilterComponent';
import { CloudProvider, cloudProviderLabels } from 'src/workspaces/utils';

import {
  DatasetAccess,
  datasetAccessTypes,
  formatDatasetTime,
  getAssayCategoryListFromDataset,
  getConsortiumTitlesFromDataset,
  getDataModalityListFromDataset,
  getDatasetAccessType,
  getDatasetReleasePoliciesDisplayInformation,
  makeDatasetReleasePolicyDisplayInformation,
  useDataCatalog,
} from './data-browser-utils';

const styles = {
  ...commonStyles,
  table: {
    header: {
      color: colors.accent(),
      height: '1rem',
      textTransform: 'uppercase',
      fontWeight: 600,
      fontSize: '0.75rem',
    },
    row: {
      backgroundColor: '#ffffff',
      borderRadius: 5,
      border: '1px solid rgba(0,0,0,.15)',
      margin: '0 -1rem 1rem',
      padding: '1rem',
    },
  },
};

export const getUnique = (mapper, data) => _.flow(_.flatMap(mapper), _.compact, _.uniq, _.sortBy(_.toLower))(data);

// Description of the structure of the sidebar. Case is preserved when rendering but all matching is case-insensitive.
// Renderers are not tested, because typing gives all the assertions we want to make on them (We make no promises about the contents of custom renderers, just their return types)
export const extractCatalogFilters = (dataCatalog: Dataset[]): FilterSection<Dataset>[] => {
  return [
    {
      header: 'Cloud Platform',
      matchBy: (dataset, value) => (dataset.storage || []).some((storage) => storage.cloudPlatform === value),
      renderer: (value) => {
        const cloudProvider = value.toUpperCase() as CloudProvider;
        return h(Fragment, [h(CloudProviderIcon, { cloudProvider }), ' ', cloudProviderLabels[cloudProvider]]);
      },
      values: ['azure', 'gcp'],
    },
    {
      header: 'Access type',
      matchBy: (dataset, value) => getDatasetAccessType(dataset) === value,
      renderer: (value) => {
        const lowerKey = _.toLower(value);
        const iconKey = value === datasetAccessTypes.Granted ? 'unlock' : 'lock';
        return div({ key: `access-filter-${lowerKey}`, style: { display: 'flex' } }, [
          icon(iconKey, { style: { color: styles.access[lowerKey], marginRight: 5 } }),
          value,
        ]);
      },
      values: _.values(datasetAccessTypes),
    },
    {
      header: 'Consortium',
      matchBy: (dataset, value) => _.includes(value, getConsortiumTitlesFromDataset(dataset)),
      values: getUnique((dataset) => getConsortiumTitlesFromDataset(dataset), dataCatalog),
    },
    {
      header: 'Data use policy',
      matchBy: (dataset, value) => _.isEqual(dataset['TerraDCAT_ap:hasDataUsePermission'], value),
      renderer: (value) =>
        div(
          {
            key: getDatasetReleasePoliciesDisplayInformation(value).label,
            style: { display: 'flex', flexDirection: 'column' },
          },
          [makeDatasetReleasePolicyDisplayInformation(value)]
        ),
      values: getUnique('TerraDCAT_ap:hasDataUsePermission', dataCatalog),
    },
    {
      header: 'Data modality',
      matchBy: (dataset, value) => _.includes(value, getDataModalityListFromDataset(dataset)),
      values: getUnique((dataset) => getDataModalityListFromDataset(dataset), dataCatalog),
    },
    {
      header: 'Assay category',
      matchBy: (dataset, value) => _.includes(value, getAssayCategoryListFromDataset(dataset)),
      values: getUnique((dataset) => getAssayCategoryListFromDataset(dataset), dataCatalog),
    },
    {
      header: 'File type',
      matchBy: (dataset, value) =>
        _.includes(
          value,
          _.map((files) => files['TerraCore:hasFileFormat'], dataset.fileAggregate)
        ),
      values: getUnique('TerraCore:hasFileFormat', _.flatMap('fileAggregate', dataCatalog)),
    },
    {
      header: 'Disease',
      matchBy: (dataset, value) => _.intersection([value], dataset.samples?.disease).length > 0,
      values: getUnique((dataset) => dataset.samples?.disease, dataCatalog),
    },
    {
      header: 'Species',
      matchBy: (dataset, value) => _.intersection([value], dataset.samples?.species).length > 0,
      values: getUnique((dataset) => dataset.samples?.species, dataCatalog),
    },
  ];
};

// All possible columns for the catalog's table view. The default columns shown are declared below in `Browser`.
const allColumns = {
  // A column is a key, title and a function that produces the table contents for that column, given a row.
  consortiums: { title: 'Consortiums', contents: (row) => _.join(', ', getConsortiumTitlesFromDataset(row)) },
  subjects: { title: 'No. of Subjects', contents: (row) => row?.counts?.donors },
  dataModality: { title: 'Data Modality', contents: (row) => _.join(', ', getDataModalityListFromDataset(row)) },
  lastUpdated: { title: 'Last Updated', contents: (row) => formatDatasetTime(row['dct:modified']) },
  assayCategory: { title: 'Assay Category', contents: (row) => _.join(', ', getAssayCategoryListFromDataset(row)) },
  fileType: { title: 'File type', contents: (row) => _.join(', ', getUnique('dcat:mediaType', row.files)) },
  species: { title: 'Species', contents: (row) => _.join(', ', getUnique('samples.genus', { row })) },
  cloudPlatform: {
    title: 'Cloud Platform',
    contents: (row) =>
      h(Fragment, [
        getUnique('cloudPlatform', row.storage).map((cloudPlatform) => {
          return h(CloudProviderIcon, {
            key: cloudPlatform,
            cloudProvider: cloudPlatform.toUpperCase() as CloudProvider,
          });
        }),
      ]),
  },
};

interface ColumnSetting {
  name: string;
  key: string;
  visible: boolean;
}

// Columns are stored as a list of column key names in `cols` below. The column settings that the ColumnSelector dialog uses contains
// the column title, key and a visible flag.
//
// These functions convert between the two formats.

export const convertSettingsToCols = _.flow(
  _.filter((columnSetting: ColumnSetting) => columnSetting.visible),
  _.map((columnSetting) => columnSetting.key)
);

export const convertColsToSettings = (cols: string[]): ColumnSetting[] =>
  _.flow(
    _.toPairs,
    _.map(([k, v]) => {
      return { name: v.title, key: k, visible: _.includes(k, cols) };
    })
  )(allColumns);

const DataBrowserTableComponent = ({ sort, setSort, cols, setCols, filteredList }) => {
  return div({ style: { position: 'relative', margin: '0 15px' } }, [
    h(SimpleTable, {
      'aria-label': 'dataset list',
      columns: [
        {
          header: div({ style: styles.table.header as CSSProperties }, [
            h(MiniSortable, { sort, field: 'dct:title', onSort: setSort }, ['Dataset Name']),
          ]),
          size: { grow: 2.2 },
          key: 'name',
        },
        ..._.map((columnKey) => {
          return {
            header: div({ style: styles.table.header as CSSProperties }, [
              h(MiniSortable, { sort, field: columnKey, onSort: setSort }, [allColumns[columnKey].title]),
            ]),
            size: { grow: 1 },
            key: columnKey,
          };
        }, cols),
      ],
      rowStyle: styles.table.row,
      cellStyle: { border: 'none', paddingRight: 15 },
      useHover: false,
      underRowKey: 'underRow',
      rows: _.map((datum) => {
        return {
          name: h(
            Link,
            {
              onClick: () => {
                void Metrics().captureEvent(Events.catalogViewDetails, {
                  id: datum.id,
                  title: datum['dct:title'],
                });
                Nav.goToPath('library-details', { id: datum.id });
              },
            },
            [datum['dct:title']]
          ),
          ..._.reduce(
            (reduced, columnKey) => {
              return { ...reduced, [columnKey]: allColumns[columnKey].contents(datum) };
            },
            {},
            cols
          ),
          underRow: div({ style: { display: 'flex', alignItems: 'flex-start', paddingTop: '1rem' } }, [
            div({ style: { display: 'flex', alignItems: 'center' } }, [h(DatasetAccess, { dataset: datum })]),
          ]),
        };
      }, filteredList),
    }),
    h(ColumnSelector, {
      onSave: _.flow(convertSettingsToCols, setCols),
      columnSettings: convertColsToSettings(cols),
      style: { backgroundColor: 'unset', width: 'auto', height: 'auto', border: 0 },
    }),
  ]);
};

export const Browser = () => {
  const [sort, setSort] = useState<Sort>({ field: 'created', direction: 'desc' });
  // This state contains the current set of visible columns, in the order that they appear.
  // Note that the Dataset Name column isn't customizable and is always shown first.
  const [cols, setCols] = useState(['consortiums', 'subjects', 'dataModality', 'lastUpdated', 'cloudPlatform']);
  const { dataCatalog, loading } = useDataCatalog();

  return h(Fragment, [
    h(SearchAndFilterComponent as React.FC<SearchAndFilterProps<Dataset>>, {
      getLowerName: (dataset) => _.toLower(dataset['dct:title']),
      getLowerDescription: (dataset) => _.toLower(dataset['dct:description']),
      fullList: dataCatalog,
      sidebarSections: extractCatalogFilters(dataCatalog),
      customSort: sort,
      searchType: 'Datasets',
      titleField: 'dct:title',
      descField: 'dct:description',
      listView: (filteredList) => DataBrowserTableComponent({ sort, setSort, cols, setCols, filteredList }),
    }),
    loading && spinnerOverlay,
  ]);
};
