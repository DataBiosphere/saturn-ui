import { withHandlers } from '@terra-ui-packages/core-utils';
import _ from 'lodash/fp';
import { CSSProperties, Fragment, ReactElement, useState } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import { ButtonOutline } from 'src/components/common';
import { icon } from 'src/components/icons';
import { Catalog } from 'src/libs/ajax/Catalog';
import { DataCollection, Dataset } from 'src/libs/ajax/Catalog';
import { getEnabledBrand } from 'src/libs/brand-utils';
import { withErrorReporting } from 'src/libs/error';
import { useCancellation, useOnMount, useStore } from 'src/libs/react-utils';
import { dataCatalogStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { commonStyles } from 'src/pages/library/SearchAndFilterComponent';

export type DatasetAccessType = 'Controlled' | 'Granted' | 'Pending' | 'External';

export const datasetAccessTypes: Record<DatasetAccessType, DatasetAccessType> = {
  Controlled: 'Controlled',
  Granted: 'Granted',
  Pending: 'Pending',
  External: 'External',
};

export const uiMessaging = {
  controlledFeatureTooltip: 'You do not have access to this dataset. Please request access to unlock this feature.',
  unsupportedDatasetTypeTooltip: (action) => `The Data Catalog currently does not support ${action} for this dataset.`,
};

// This list is generated from the schema enum
export const getDatasetReleasePoliciesDisplayInformation = (
  dataUsePermission?: string
): { label: string; description?: string } =>
  Utils.switchCase(
    dataUsePermission,
    ['DUO:0000007', () => ({ label: 'DS', description: 'Disease specific research' })],
    ['DUO:0000042', () => ({ label: 'GRU', description: 'General research use' })],
    ['DUO:0000006', () => ({ label: 'HMB', description: 'Health or medical or biomedical research' })],
    ['DUO:0000011', () => ({ label: 'POA', description: 'Population origins or ancestry research only' })],
    ['DUO:0000004', () => ({ label: 'NRES', description: 'No restriction' })],
    [undefined, () => ({ label: 'Unspecified', description: 'No specified dataset release policy' })],
    // Safe to use non-null assertion here because this case is only reached if dataUsePermission is defined.
    [Utils.DEFAULT, () => ({ label: dataUsePermission! })]
  );

export const makeDatasetReleasePolicyDisplayInformation = (dataUsePermission?: string): ReactElement => {
  const { label, description } = getDatasetReleasePoliciesDisplayInformation(dataUsePermission);
  return h(div, [
    label,
    description && div({ style: { fontSize: '0.625rem', lineHeight: '0.625rem' } }, [description]),
  ]);
};

export const isExternal = (dataset: Dataset): boolean =>
  Utils.cond([isWorkspace(dataset), () => false], [isDatarepoSnapshot(dataset), () => false], () => true);

export const workspaceUrlFragment = '/#workspaces/';

export const isWorkspace = (dataset: Dataset): boolean =>
  _.toLower(dataset['dcat:accessURL']).includes(workspaceUrlFragment);

export const datarepoSnapshotUrlFragment = '/snapshots/';

export const isDatarepoSnapshot = (dataset: Dataset): boolean =>
  _.toLower(dataset['dcat:accessURL']).includes(datarepoSnapshotUrlFragment);

export const getConsortiumTitlesFromDataset = (dataset: Dataset): string[] =>
  _.flow(
    _.map((hasDataCollection: DataCollection) => hasDataCollection['dct:title']),
    _.compact
  )(dataset['TerraDCAT_ap:hasDataCollection']);

export const getDataModalityListFromDataset = (dataset: Dataset): string[] =>
  _.flow(
    _.flatMap('TerraCore:hasDataModality'),
    _.sortBy(_.toLower),
    _.compact,
    _.map(_.replace('TerraCoreValueSets:', '')),
    _.uniqBy(_.toLower)
  )(dataset['prov:wasGeneratedBy']);

export const getAssayCategoryListFromDataset = (dataset: Dataset) =>
  _.flow(
    _.flatMap('TerraCore:hasAssayCategory'),
    _.sortBy(_.toLower),
    _.compact,
    _.uniqBy(_.toLower)
  )(dataset['prov:wasGeneratedBy']) as string[];

export const formatDatasetTime = (time?: string) => (time ? Utils.makeStandardDate(new Date(time)) : undefined);

// Return type should be decided by above
export const getDatasetAccessType = (dataset: Dataset): DatasetAccessType =>
  Utils.cond(
    [isExternal(dataset), () => datasetAccessTypes.External],
    [dataset.accessLevel === 'reader' || dataset.accessLevel === 'owner', () => datasetAccessTypes.Granted],
    () => datasetAccessTypes.Controlled
  );

interface DatasetAccessProps {
  dataset: Dataset;
}
export const DatasetAccess = ({ dataset }: DatasetAccessProps) => {
  const access = getDatasetAccessType(dataset);
  const { requestAccessURL } = dataset;
  const buttonStyle: CSSProperties = { height: 34, textTransform: 'none', padding: '.5rem' };
  const textStyle = { paddingLeft: 10, paddingTop: 4, fontSize: 12 };

  return h(Fragment, [
    Utils.cond(
      [
        !!requestAccessURL && access === datasetAccessTypes.Controlled,
        () => {
          return h(
            ButtonOutline,
            {
              style: buttonStyle,
              href: requestAccessURL,
              target: '_blank',
            },
            [icon('lock'), div({ style: { paddingLeft: 10, fontSize: 12 } }, ['Request Access'])]
          );
        },
      ],
      [
        access === datasetAccessTypes.Controlled,
        () =>
          h(
            ButtonOutline,
            {
              tooltip: 'Informal access request not yet supported through Terra, please contact the dataset owner',
              style: buttonStyle,
              disabled: true,
            },
            [icon('lock'), div({ style: { paddingLeft: 10, fontSize: 12 } }, ['Request Access'])]
          ),
      ],
      [
        access === datasetAccessTypes.Pending,
        () =>
          div({ style: { color: commonStyles.access.pending, display: 'flex', alignItems: 'center' } }, [
            icon('lock'),
            div({ style: textStyle }, ['Pending Access']),
          ]),
      ],
      [
        access === datasetAccessTypes.External,
        () =>
          h(
            ButtonOutline,
            {
              style: buttonStyle,
              href: dataset['dcat:accessURL'],
              target: '_blank',
            },
            [
              div({ style: { fontSize: 12 } }, ['Externally managed']),
              icon('pop-out', { style: { marginLeft: 10 }, size: 16 }),
            ]
          ),
      ],
      [
        Utils.DEFAULT,
        () =>
          div({ style: { color: commonStyles.access.granted, display: 'flex', alignItems: 'center' } }, [
            icon('unlock'),
            div({ style: textStyle }, ['Granted Access']),
          ]),
      ]
    ),
  ]);
};

export const prepareDatasetsForDisplay = (
  datasets: Dataset[],
  dataCollectionsToInclude: string[] | undefined
): Dataset[] =>
  _.filter(
    dataCollectionsToInclude
      ? (dataset) =>
          _.intersection(dataCollectionsToInclude, _.map('dct:title', dataset['TerraDCAT_ap:hasDataCollection']))
            .length > 0
      : _.constant(true),
    datasets
  );

export const fetchDataCatalog = async (opts: { signal?: AbortSignal } = {}): Promise<Dataset[]> => {
  const { result: datasets } = await Catalog(opts.signal).getDatasets();
  const dataCollectionsToInclude = getEnabledBrand().catalogDataCollectionsToInclude;
  return prepareDatasetsForDisplay(datasets, dataCollectionsToInclude);
};

interface DataCatalog {
  dataCatalog: Dataset[];
  refresh: () => void;
  loading: boolean;
}

export const useDataCatalog = (): DataCatalog => {
  const signal = useCancellation();
  const [loading, setLoading] = useState(false);
  const dataCatalog = useStore(dataCatalogStore);

  const refresh = withHandlers(
    [withErrorReporting('Error loading data catalog'), Utils.withBusyState(setLoading)],
    async (): Promise<void> => {
      const datasets = await fetchDataCatalog({ signal });
      dataCatalogStore.set(datasets);
    }
  );
  useOnMount(() => {
    _.isEmpty(dataCatalog) && refresh();
  });
  return { dataCatalog, refresh, loading };
};
