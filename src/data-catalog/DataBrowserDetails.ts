import { Modal, Spinner } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import qs from 'qs';
import { CSSProperties, Fragment, useState } from 'react';
import { div, h, h1, h2, h3, span, table, tbody, td, tr } from 'react-hyperscript-helpers';
import { ButtonOutline, ButtonPrimary, Link } from 'src/components/common';
import { FeaturePreviewFeedbackModal } from 'src/components/FeaturePreviewFeedbackModal';
import FooterWrapper from 'src/components/FooterWrapper';
import { centeredSpinner, icon } from 'src/components/icons';
import { libraryTopMatter } from 'src/components/library-common';
import { MarkdownViewer } from 'src/components/markdown';
import { ReactComponent as AzureLogo } from 'src/images/azure.svg';
import { ReactComponent as GcpLogo } from 'src/images/gcp.svg';
import { Dataset } from 'src/libs/ajax/Catalog';
import { DataRepo } from 'src/libs/ajax/DataRepo';
import { JobModel, JobStatus, jobStatusTypes } from 'src/libs/ajax/DataRepo';
import { Metrics } from 'src/libs/ajax/Metrics';
import colors from 'src/libs/colors';
import { getConfig } from 'src/libs/config';
import { withErrorReporting } from 'src/libs/error';
import Events from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import { useCancellation, usePollingEffect } from 'src/libs/react-utils';
import * as Utils from 'src/libs/utils';
import { commonStyles } from 'src/pages/library/SearchAndFilterComponent';
import { cloudProviderLabels } from 'src/workspaces/utils';

import {
  DatasetAccess,
  datasetAccessTypes,
  formatDatasetTime,
  getAssayCategoryListFromDataset,
  getDataModalityListFromDataset,
  getDatasetAccessType,
  isDatarepoSnapshot,
  isWorkspace,
  makeDatasetReleasePolicyDisplayInformation,
  uiMessaging,
  useDataCatalog,
} from './data-browser-utils';

const activeTab = 'datasets';
const styles = {
  ...commonStyles,
  content: { padding: 20, marginTop: 15 },
  headers: { margin: '20px 0 10px' },
  attributesColumn: { width: '22%', marginRight: 20, marginTop: 30 },
  cloudIconProps: { role: 'img', style: { maxHeight: 25, maxWidth: 150 } },
};

interface MetadataDetailsComponentProps {
  dataObj: Dataset;
}

export const MetadataDetailsComponent = ({ dataObj }: MetadataDetailsComponentProps) => {
  return h(Fragment, [
    h2({ className: 'sr-only' }, [` ${dataObj['dct:title']} Metadata`]),
    div({ style: { display: 'flex', width: '100%', flexWrap: 'wrap' } }, [
      div({ style: styles.attributesColumn }, [
        h3({ style: styles.headers }, ['Data release policy']),
        makeDatasetReleasePolicyDisplayInformation(dataObj['TerraDCAT_ap:hasDataUsePermission']),
      ]),
      div({ style: styles.attributesColumn }, [
        h3({ style: styles.headers }, ['Last Updated']),
        formatDatasetTime(dataObj['dct:modified']),
      ]),
      div({ style: styles.attributesColumn }, [h3({ style: styles.headers }, ['Version']), dataObj['dct:version']]),
      div({ style: styles.attributesColumn }, [
        h3({ style: styles.headers }, ['Cloud provider']),
        _.map(
          ({ cloudPlatform }) =>
            div({ key: cloudPlatform }, [
              Utils.switchCase(
                cloudPlatform,
                ['gcp', () => h(GcpLogo, { title: cloudProviderLabels.GCP, ...styles.cloudIconProps })],
                ['azure', () => h(AzureLogo, { title: cloudProviderLabels.AZURE, ...styles.cloudIconProps })]
              ),
            ]),
          _.uniqBy('cloudPlatform', dataObj.storage)
        ),
      ]),
      div({ style: styles.attributesColumn }, [
        h3({ style: styles.headers }, ['Owner']),
        dataObj['TerraDCAT_ap:hasOwner'],
      ]),
      div({ style: styles.attributesColumn }, [
        h3({ style: styles.headers }, ['Custodians']),
        div({ style: { whiteSpace: 'pre' } }, [_.join('\n', dataObj['TerraDCAT_ap:hasCustodian'])]),
      ]),
      div({ style: styles.attributesColumn }, [
        h3({ style: styles.headers }, ['Contributors']),
        _.map(
          ({ name, email }) =>
            email
              ? h(
                  Link,
                  {
                    key: _.uniqueId(`${name}-${email}-`),
                    href: `mailto:${email}`,
                    style: { marginTop: 5, display: 'block' },
                  },
                  [name]
                )
              : div({ key: _.uniqueId(`${name}-${email}-`), style: { marginTop: 5 } }, [name]),
          dataObj.contributors
        ),
      ]),
      div({ style: styles.attributesColumn }, [
        h3({ style: styles.headers }, ['Region']),
        div({ style: { whiteSpace: 'pre' } }, [_.flow(_.map('region'), _.uniq, _.join('\n'))(dataObj.storage)]),
      ]),
    ]),
  ]);
};

export const MainContent = ({ dataObj }) => {
  const accessURL = dataObj['dcat:accessURL'];
  const workspaceName = accessURL?.includes('/#workspaces/') && accessURL.substring(accessURL.lastIndexOf('/') + 1);
  const linkStyle: CSSProperties = {
    fontSize: 16,
    textDecoration: 'underline',
    textTransform: 'none',
    height: 'unset',
    display: 'block',
  };
  return div({ style: { ...styles.content, width: '100%', marginTop: 0 } }, [
    h1({ style: { lineHeight: '1.5em' } }, [dataObj['dct:title']]),
    !!workspaceName &&
      div({ style: { marginBottom: '1rem' } }, [
        'This data is from the Terra workspace:',
        h(
          Link,
          {
            style: linkStyle,
            href: accessURL,
          },
          [
            icon('folderSolid', { size: 18, style: { marginRight: 10, color: styles.access.controlled } }),
            workspaceName,
          ]
        ),
      ]),
    h(MarkdownViewer, [dataObj['dct:description']]),
    h(MetadataDetailsComponent, { dataObj }),
  ]);
};

interface SidebarComponentProps {
  dataObj: Dataset;
  id: string;
}

export const SidebarComponent = ({ dataObj, id }: SidebarComponentProps) => {
  const [feedbackShowing, setFeedbackShowing] = useState(false);
  const [datasetNotSupportedForExport, setDatasetNotSupportedForExport] = useState(false);
  const [snapshotExportJobId, setSnapshotExportJobId] = useState<string>();
  const [tdrSnapshotPreparePolling, setTdrSnapshotPreparePolling] = useState(false);
  const sidebarButtonWidth = 230;
  const access = getDatasetAccessType(dataObj);
  const actionTooltip = access === datasetAccessTypes.Granted ? '' : uiMessaging.controlledFeatureTooltip;

  const importDataToWorkspace = (dataset) => {
    void Metrics().captureEvent(Events.catalogWorkspaceLinkFromDetailsView, {
      id,
      title: dataObj['dct:title'],
      source: dataset['dcat:accessURL'],
    });
    Utils.cond(
      [
        isWorkspace(dataset),
        () => {
          Nav.history.push({
            pathname: Nav.getPath('import-data'),
            search: qs.stringify({
              format: 'catalog',
              snapshotName: dataset['dct:title'],
              catalogDatasetId: dataset.id,
            }),
          });
        },
      ],
      [
        isDatarepoSnapshot(dataset),
        async () => {
          setTdrSnapshotPreparePolling(true);
          const jobInfo = (await withErrorReporting('Error exporting dataset')(
            async () => await DataRepo().snapshot(dataset['dct:identifier']).exportSnapshot()
          )()) as JobModel;
          setSnapshotExportJobId(jobInfo.id);
        },
      ],
      () => setDatasetNotSupportedForExport(true)
    );
  };

  return h(Fragment, [
    div(
      {
        style: {
          ...styles.content,
          width: 300,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        },
      },
      [
        h2({ className: 'sr-only' }, [`${dataObj['dct:title']} Data Details`]),
        div(
          {
            style: {
              backgroundColor: 'white',
              padding: 20,
              paddingTop: 0,
              width: '100%',
              border: '2px solid #D6D7D7',
              borderRadius: 5,
            },
          },
          [
            div([
              h3(['Access type']),
              div({ style: { display: 'flex', alignItems: 'flex-start' } }, [h(DatasetAccess, { dataset: dataObj })]),
            ]),
            div([
              h3({ style: styles.headers }, ['Donor size']),
              div([_.getOr(0, 'counts.donors', dataObj).toLocaleString()]),
            ]),
            div([
              h3({ style: styles.headers }, ['Sample size']),
              div([_.getOr(0, 'counts.samples', dataObj).toLocaleString()]),
            ]),
            div([
              h3({ style: styles.headers }, ['Data modality']),
              div([_.join(', ', getDataModalityListFromDataset(dataObj))]),
            ]),
            div([
              h3({ style: styles.headers }, ['Assay category']),
              div([_.join(', ', getAssayCategoryListFromDataset(dataObj))]),
            ]),
            div([
              h3({ style: styles.headers }, ['File counts']),
              table([
                tbody([
                  _.map((file) => {
                    return tr({ key: `filetype_${file['TerraCore:hasFileFormat']}_${file.count}` }, [
                      td({ style: { paddingRight: 30 } }, [file['TerraCore:hasFileFormat']]),
                      td([(file.count || 0).toLocaleString()]),
                    ]);
                  }, dataObj.fileAggregate),
                  tr({ style: { fontWeight: 'bold', borderTop: '2px solid rgba(0,0,0,.3)' } }, [
                    td(['Total']),
                    td([_.sumBy('count', dataObj.fileAggregate).toLocaleString()]),
                  ]),
                ]),
              ]),
            ]),
          ]
        ),
        access === datasetAccessTypes.External
          ? h(Fragment, [
              h(
                ButtonPrimary,
                {
                  style: { fontSize: 14, textTransform: 'none', height: 'unset', width: '100%', marginTop: 20 },
                  href: dataObj['dcat:accessURL'],
                  target: '_blank',
                },
                [div(['Go to external data site']), icon('pop-out', { style: { marginLeft: 10 }, size: 18 })]
              ),
              div({ style: { width: '100%', marginTop: 10 } }, [
                'The site may allow you to export to a Terra workspace for further analysis.',
              ]),
            ])
          : h(Fragment, [
              h(
                ButtonOutline,
                {
                  disabled: access !== datasetAccessTypes.Granted,
                  tooltip: actionTooltip,
                  style: {
                    fontSize: 16,
                    textTransform: 'none',
                    height: 'unset',
                    width: sidebarButtonWidth,
                    marginTop: 20,
                  },
                  onClick: () => {
                    void Metrics().captureEvent(Events.catalogViewPreviewData, {
                      id: dataObj.id,
                      title: dataObj['dct:title'],
                    });
                    Nav.goToPath('library-catalog-preview', { id: dataObj.id });
                  },
                },
                [
                  div({ style: { display: 'flex', alignItems: 'center', justifyContent: 'center' } }, [
                    icon('eye', { size: 22, style: { marginRight: 10 } }),
                    'Preview data',
                  ]),
                ]
              ),
              h(
                ButtonPrimary,
                {
                  disabled: access !== datasetAccessTypes.Granted || tdrSnapshotPreparePolling,
                  tooltip: actionTooltip,
                  style: {
                    fontSize: 16,
                    textTransform: 'none',
                    height: 'unset',
                    width: sidebarButtonWidth,
                    marginTop: 20,
                  },
                  onClick: () => {
                    importDataToWorkspace(dataObj);
                  },
                },
                ['Prepare for analysis']
              ),
              div({ style: { display: 'flex', width: sidebarButtonWidth, marginTop: 20 } }, [
                icon('talk-bubble', { size: 60, style: { width: 60, height: 45 } }),
                div({ style: { marginLeft: 10, lineHeight: '1.3rem' } }, [
                  h(
                    Link,
                    {
                      onClick: () => setFeedbackShowing(true),
                    },
                    ['Provide feedback on this dataset view']
                  ),
                ]),
              ]),
            ]),
      ]
    ),
    feedbackShowing &&
      h(FeaturePreviewFeedbackModal, {
        onDismiss: () => setFeedbackShowing(false),
        onSuccess: () => setFeedbackShowing(false),
        featureName: 'Data Catalog',
        formId: '1FAIpQLSevEVLKiLNACAsti8k2U8EVKGHmQ4pJ8_643MfdY2lZEIusyw',
        feedbackId: 'entry.477992521',
        contactEmailId: 'entry.82175827',
        sourcePageId: 'entry.367682225',
        primaryQuestion: 'Is there anything missing or that you would like to see in this dataset view?',
        sourcePage: 'Catalog Details',
      }),
    datasetNotSupportedForExport &&
      h(
        Modal,
        {
          title: 'Cannot Export Dataset',
          showCancel: false,
          onDismiss: () => setDatasetNotSupportedForExport(false),
        },
        [
          'This dataset is not hosted in a storage system that currently has the ability to export to a research environment.',
        ]
      ),
    !!snapshotExportJobId &&
      h(SnapshotExportModal, {
        jobId: snapshotExportJobId,
        dataset: dataObj,
        onDismiss: () => {
          setSnapshotExportJobId(undefined);
          setTdrSnapshotPreparePolling(false);
        },
        onFailure: () => {
          setDatasetNotSupportedForExport(true);
          setSnapshotExportJobId(undefined);
          setTdrSnapshotPreparePolling(false);
        },
      }),
  ]);
};

interface SnapshotExportModalProps {
  jobId: string;
  dataset: Dataset;
  onDismiss: () => void;
  onFailure: () => void;
}

const SnapshotExportModal = ({ jobId, dataset, onDismiss, onFailure }: SnapshotExportModalProps) => {
  const signal = useCancellation();
  const [jobStatus, setJobStatus] = useState('running');
  const [abortWarningShowing, setAbortWarningShowing] = useState(false);

  usePollingEffect(
    withErrorReporting('Problem checking status of snapshot import')(async () => {
      jobStatus === 'running' && (await checkJobStatus());
    }),
    { ms: 1000, leading: true }
  );

  const checkJobStatus = async () => {
    const jobInfo = await DataRepo(signal).job(jobId).details();
    const newJobStatus = jobInfo.job_status;
    Utils.switchCase<JobStatus, void>(
      newJobStatus,
      [
        jobStatusTypes.succeeded,
        async () => {
          const jobResult = await withErrorReporting('Error getting export result')(
            async () => await DataRepo().job(jobId).result()
          )();
          // @ts-ignore - this has an unknown response type, but in this case it should
          // include these fields
          const jobResultManifest = jobResult?.format?.parquet?.manifest;
          void Metrics().captureEvent(Events.catalogWorkspaceLinkExportFinished);
          jobResultManifest
            ? Nav.history.push({
                pathname: Nav.getPath('import-data'),
                search: qs.stringify({
                  url: getConfig().dataRepoUrlRoot,
                  format: 'tdrexport',
                  referrer: 'data-catalog',
                  snapshotId: dataset['dct:identifier'],
                  snapshotName: dataset['dct:title'],
                  tdrmanifest: jobResultManifest,
                  tdrSyncPermissions: false,
                }),
              })
            : onFailure();
        },
      ],
      [jobStatusTypes.running, () => setJobStatus('running')],
      [Utils.DEFAULT, onFailure]
    );
  };

  const buttonStyle = { width: 88, borderRadius: 1 };

  return h(
    Modal,
    {
      title: 'Preparing Dataset for Analysis',
      onDismiss,
      showCancel: false,
      shouldCloseOnOverlayClick: false,
      shouldCloseOnEsc: false,
      okButton: abortWarningShowing
        ? div({ style: { display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' } }, [
            'Are you sure you want to abort?',
            h(ButtonOutline, { onClick: () => setAbortWarningShowing(false), style: buttonStyle }, ['No']),
            h(ButtonOutline, { onClick: onDismiss, style: buttonStyle }, ['Yes']),
          ])
        : h(ButtonOutline, { onClick: () => setAbortWarningShowing(true), style: buttonStyle }, ['Abort']),
    },
    [
      div({ style: { display: 'flex', alignItems: 'center' } }, [
        h(Spinner, { size: 100 }),
        div({ style: { marginLeft: 10 } }, [
          'Your dataset is being prepared for analysis. This may take a minute or two.',
        ]),
      ]),
    ]
  );
};

interface DataBrowserDetailsProps {
  id: string;
}

export const DataBrowserDetails = ({ id }: DataBrowserDetailsProps) => {
  const { dataCatalog } = useDataCatalog();
  const dataMap = _.keyBy('id', dataCatalog);
  const dataObj = dataMap[id];

  return h(FooterWrapper, { alwaysShow: true }, [
    libraryTopMatter(activeTab),
    !dataObj
      ? centeredSpinner()
      : h(Fragment, [
          div(
            { style: { display: 'flex', flexDirection: 'row', alignItems: 'top', width: '100%', lineHeight: '26px' } },
            [
              div({ style: styles.content }, [
                h(Link, { onClick: Nav.history.goBack, 'aria-label': 'Back' }, [
                  span({ className: 'fa-stack fa-2x' }, [
                    icon('circle', {
                      size: 40,
                      className: 'fa-stack-2x',
                      style: { color: colors.accent(), opacity: 0.2 },
                    }),
                    icon('angle-left', {
                      size: 30,
                      className: 'fa-stack-1x',
                      style: { color: colors.accent() },
                    }),
                  ]),
                ]),
              ]),
              h(MainContent, { dataObj }),
              h(SidebarComponent, { dataObj, id }),
            ]
          ),
        ]),
  ]);
};

export const navPaths = [
  {
    name: 'library-details',
    path: '/library/browser/:id',
    component: DataBrowserDetails,
    title: 'Catalog - Dataset Details',
  },
];
