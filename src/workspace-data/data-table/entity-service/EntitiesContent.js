import { Modal, Spinner } from '@terra-ui-packages/components';
import * as clipboard from 'clipboard-polyfill/text';
import FileSaver from 'file-saver';
import JSZip from 'jszip';
import _ from 'lodash/fp';
import * as qs from 'qs';
import { Fragment, useState } from 'react';
import { div, h, p } from 'react-hyperscript-helpers';
import { cohortNotebook, cohortRNotebook, NotebookCreator } from 'src/analysis/utils/notebook-utils';
import { tools } from 'src/analysis/utils/tool-utils';
import { ButtonSecondary } from 'src/components/common';
import { icon } from 'src/components/icons';
import IGVBrowser from 'src/components/IGVBrowser';
import IGVFileSelector, { getIgvMetricDetails } from 'src/components/IGVFileSelector';
import { MenuButton } from 'src/components/MenuButton';
import { withModalDrawer } from 'src/components/ModalDrawer';
import { ModalToolButton } from 'src/components/ModalToolButton';
import { MenuDivider, MenuTrigger } from 'src/components/PopupTrigger';
import TitleBar from 'src/components/TitleBar';
import WorkflowSelector from 'src/components/WorkflowSelector';
import datasets from 'src/constants/datasets';
import dataExplorerLogo from 'src/images/data-explorer-logo.svg';
import igvLogo from 'src/images/igv-logo.png';
import jupyterLogo from 'src/images/jupyter-logo.svg';
import wdlLogo from 'src/images/wdl-logo.png';
import { EntityServiceDataTableProvider } from 'src/libs/ajax/data-table-providers/EntityServiceDataTableProvider';
import { GoogleStorage } from 'src/libs/ajax/GoogleStorage';
import { Metrics } from 'src/libs/ajax/Metrics';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import { notify } from 'src/libs/notifications';
import { useCancellation, useOnMount, withDisplayName } from 'src/libs/react-utils';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { requesterPaysWrapper, withRequesterPaysHandler } from 'src/workspaces/common/requester-pays/bucket-utils';
import * as WorkspaceUtils from 'src/workspaces/utils';

import { DataTableColumnProvenance } from '../../provenance/DataTableColumnProvenance';
import { useColumnProvenance } from '../../provenance/workspace-data-provenance-utils';
import DataTable from '../shared/DataTable';
import { AddColumnModal } from './AddColumnModal';
import { AddEntityModal } from './AddEntityModal';
import { CreateEntitySetModal } from './CreateEntitySetModal';
import { entityAttributeText } from './entityAttributeText';
import { EntityDeleter } from './EntityDeleter';
import { ExportDataModal } from './ExportDataModal';
import { MultipleEntityEditor } from './MultipleEntityEditor';

const getDataset = (dataExplorerUrl) => {
  // Either cohort was imported from standalone Data Explorer, eg
  // https://test-data-explorer.appspot.com/
  const dataset = _.find({ origin: new URL(dataExplorerUrl).origin }, datasets);
  if (!dataset) {
    // Or cohort was imported from embedded Data Explorer, eg
    // https://app.terra.bio/#library/datasets/public/1000%20Genomes/data-explorer
    const datasetName = unescape(dataExplorerUrl.split(/datasets\/(?:public\/)?([^/]+)\/data-explorer/)[1]);
    return _.find({ name: datasetName }, datasets);
  }
  return dataset;
};

const toolDrawerId = 'tool-drawer-title';

const ToolDrawer = _.flow(
  withDisplayName('ToolDrawer'),
  requesterPaysWrapper({
    onDismiss: ({ onDismiss }) => onDismiss(),
  }),
  withModalDrawer({ 'aria-labelledby': toolDrawerId })
)(
  ({
    workspace,
    workspace: {
      workspace: { bucketName, name: wsName, namespace, googleProject, workspaceId },
    },
    onDismiss,
    onIgvSuccess,
    onRequesterPaysError,
    entityMetadata,
    entityKey,
    selectedEntities,
  }) => {
    const [toolMode, setToolMode] = useState();
    const [notebookNames, setNotebookNames] = useState();
    const signal = useCancellation();

    const Buckets = GoogleStorage(signal);

    useOnMount(() => {
      const loadNotebookNames = _.flow(
        withRequesterPaysHandler(onRequesterPaysError),
        withErrorReporting('Error loading notebooks')
      )(async () => {
        const notebooks = await Buckets.listNotebooks(googleProject, bucketName);
        // slice removes 'notebooks/' and the .ipynb suffix
        setNotebookNames(notebooks.map((notebook) => notebook.name.slice(10, -6)));
      });

      loadNotebookNames();
    });

    const entitiesCount = _.size(selectedEntities);
    const isCohort = entityKey === 'cohort';

    const dataExplorerButtonEnabled = isCohort && entitiesCount === 1 && _.values(selectedEntities)[0].attributes.data_explorer_url !== undefined;
    const origDataExplorerUrl = dataExplorerButtonEnabled ? _.values(selectedEntities)[0].attributes.data_explorer_url : undefined;
    const [baseURL, urlSearch] = origDataExplorerUrl ? origDataExplorerUrl.split('?') : [];
    const dataExplorerUrl = origDataExplorerUrl && `${baseURL}?${qs.stringify({ ...qs.parse(urlSearch), wid: workspaceId })}`;
    const openDataExplorerInSameTab =
      dataExplorerUrl && (dataExplorerUrl.includes('terra.bio') || _.some({ origin: new URL(dataExplorerUrl).origin }, datasets));
    const dataset = openDataExplorerInSameTab && getDataset(dataExplorerUrl);
    const linkBase =
      openDataExplorerInSameTab && Nav.getLink(dataset.authDomain ? 'data-explorer-private' : 'data-explorer-public', { dataset: dataset.name });
    const dataExplorerPath = openDataExplorerInSameTab && `${linkBase}?${dataExplorerUrl.split('?')[1]}`;

    const notebookButtonEnabled = isCohort && entitiesCount === 1;

    const { title, drawerContent } = Utils.switchCase(
      toolMode,
      [
        'IGV',
        () => ({
          title: 'IGV',
          drawerContent: h(IGVFileSelector, {
            onSuccess: onIgvSuccess,
            selectedEntities,
          }),
        }),
      ],
      [
        'Workflow',
        () => ({
          title: 'YOUR WORKFLOWS',
          drawerContent: h(WorkflowSelector, { workspace, selectedEntities }),
        }),
      ],
      [
        // TODO: Does this need to change with analysis tab migration? Need PO input
        'Notebook',
        () => ({
          drawerContent: h(NotebookCreator, {
            bucketName,
            googleProject,
            existingNames: notebookNames,
            onSuccess: async (notebookName, notebookKernel) => {
              const cohortName = _.values(selectedEntities)[0].name;
              const contents = notebookKernel === 'r' ? cohortRNotebook(cohortName) : cohortNotebook(cohortName);
              await Buckets.notebook(googleProject, bucketName, `${notebookName}.${tools.Jupyter.defaultExt}`).create(JSON.parse(contents));
              void Metrics().captureEvent(Events.workspaceDataOpenWithNotebook, extractWorkspaceDetails(workspace.workspace));
              Nav.goToPath('workspace-notebook-launch', { namespace, name: wsName, notebookName: `${notebookName}.ipynb` });
            },
            onDismiss: () => setToolMode(undefined),
            reloadList: _.noop,
          }),
        }),
      ],
      [
        Utils.DEFAULT,
        () => ({
          title: 'OPEN WITH...',
          drawerContent: h(Fragment, [
            div({ style: Style.modalDrawer.content }, [
              div([
                h(ModalToolButton, {
                  onClick: () => setToolMode('IGV'),
                  disabled: isCohort,
                  tooltip: isCohort ? 'IGV cannot be opened with cohorts' : 'Open with Integrative Genomics Viewer',
                  icon: igvLogo,
                  text: 'IGV',
                }),
                h(ModalToolButton, {
                  onClick: () => setToolMode('Workflow'),
                  disabled: isCohort,
                  tooltip: isCohort ? 'Workflow cannot be opened with cohorts' : 'Open with Workflow',
                  icon: wdlLogo,
                  text: 'Workflow',
                }),
                h(ModalToolButton, {
                  onClick: () => {
                    void Metrics().captureEvent(Events.workspaceDataOpenWithDataExplorer, extractWorkspaceDetails(workspace.workspace));
                    !openDataExplorerInSameTab && onDismiss();
                  },
                  href: openDataExplorerInSameTab ? dataExplorerPath : dataExplorerUrl,
                  ...(!openDataExplorerInSameTab ? Utils.newTabLinkProps : {}),
                  disabled: !dataExplorerButtonEnabled,
                  tooltip: Utils.cond(
                    [
                      !entityMetadata.cohort,
                      () =>
                        'Talk to your dataset owner about setting up a Data Explorer. See the "Making custom cohorts with Data Explorer" help article.',
                    ],
                    [isCohort && entitiesCount > 1, () => 'Select exactly one cohort to open in Data Explorer'],
                    [isCohort && !dataExplorerUrl, () => 'Cohort is too old, please recreate in Data Explorer and save to Terra again'],
                    [!isCohort, () => 'Only cohorts can be opened with Data Explorer']
                  ),
                  icon: dataExplorerLogo,
                  text: 'Data Explorer',
                }),
                h(ModalToolButton, {
                  onClick: () => setToolMode('Notebook'),
                  disabled: !notebookButtonEnabled,
                  tooltip: Utils.cond(
                    [
                      !entityMetadata.cohort,
                      () => 'Unable to open with notebooks. See the "Making custom cohorts with Data Explorer" help article for more details.',
                    ],
                    [isCohort && entitiesCount > 1, () => 'Select exactly one cohort to open in notebook'],
                    [!isCohort, () => 'Only cohorts can be opened with notebooks'],
                    [notebookButtonEnabled, () => 'Create a Python 2 or 3 notebook with this cohort']
                  ),
                  icon: jupyterLogo,
                  text: 'Notebook',
                }),
              ]),
            ]),
          ]),
        }),
      ]
    );

    return div({ style: { padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 } }, [
      h(TitleBar, {
        id: toolDrawerId,
        title,
        onPrevious: toolMode
          ? () => {
              setToolMode(undefined);
            }
          : undefined,
        onDismiss,
      }),
      div(
        {
          style: {
            borderRadius: '1rem',
            border: `1px solid ${colors.dark(0.5)}`,
            padding: '0.25rem 0.875rem',
            margin: '0.5rem 0 2rem',
            alignSelf: 'flex-start',
            fontSize: 12,
          },
        },
        [`${entitiesCount} ${entityKey + (entitiesCount > 1 ? 's' : '')} selected`]
      ),
      drawerContent,
    ]);
  }
);

const EntitiesContent = ({
  workspace,
  workspace: {
    workspace: { namespace, name, googleProject },
    workspaceSubmissionStats: { runningSubmissionsCount },
  },
  entityKey,
  activeCrossTableTextFilter,
  entityMetadata,
  setEntityMetadata,
  loadMetadata,
  snapshotName,
  editable,
}) => {
  // State
  const [selectedEntities, setSelectedEntities] = useState({});
  const [editingEntities, setEditingEntities] = useState(false);
  const [deletingEntities, setDeletingEntities] = useState(false);
  const [copyingEntities, setCopyingEntities] = useState(false);
  const [addingEntity, setAddingEntity] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);
  const [creatingSet, setCreatingSet] = useState(false);
  const [nowCopying, setNowCopying] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showToolSelector, setShowToolSelector] = useState(false);
  const [igvFiles, setIgvFiles] = useState(undefined);
  const [igvRefGenome, setIgvRefGenome] = useState('');
  const {
    columnProvenance,
    loading: loadingColumnProvenance,
    error: columnProvenanceError,
    loadColumnProvenance,
  } = useColumnProvenance(workspace, entityKey);
  const [showColumnProvenance, setShowColumnProvenance] = useState(undefined);

  const buildTSV = (columnSettings, entities, forDownload) => {
    const sortedEntities = _.sortBy('name', entities);
    const setRoot = entityKey.slice(0, -4);
    const isSet = _.endsWith('_set', entityKey);

    const attributeNames = _.flow(_.filter('visible'), _.map('name'), isSet ? _.without([`${setRoot}s`]) : _.identity)(columnSettings);

    const entityTsv = Utils.makeTSV([
      [`entity:${entityKey}_id`, ...attributeNames],
      ..._.map(({ name, attributes }) => {
        return [name, ..._.map((attribute) => entityAttributeText(attributes[attribute], true), attributeNames)];
      }, sortedEntities),
    ]);

    if (isSet && forDownload) {
      const membershipTsv = Utils.makeTSV([
        [`membership:${entityKey}_id`, setRoot],
        ..._.flatMap(({ attributes, name }) => {
          return _.map(({ entityName }) => [name, entityName], attributes[`${setRoot}s`].items);
        }, sortedEntities),
      ]);

      const zipFile = new JSZip().file(`${entityKey}_entity.tsv`, entityTsv).file(`${entityKey}_membership.tsv`, membershipTsv);

      return zipFile.generateAsync({ type: 'blob' });
    }
    return entityTsv;
  };

  const downloadSelectedRows = async (columnSettings) => {
    const tsv = buildTSV(columnSettings, selectedEntities, true);
    const isSet = _.endsWith('_set', entityKey);
    isSet
      ? FileSaver.saveAs(await tsv, `${entityKey}.zip`)
      : FileSaver.saveAs(new Blob([tsv], { type: 'text/tab-separated-values' }), `${entityKey}.tsv`);
    void Metrics().captureEvent(Events.workspaceDataDownloadPartial, {
      ...extractWorkspaceDetails(workspace.workspace),
      downloadFrom: 'table data',
      fileType: '.tsv',
    });
  };

  const entitiesSelected = !_.isEmpty(selectedEntities);

  const renderEditMenu = () => {
    return (
      !snapshotName &&
      h(
        MenuTrigger,
        {
          side: 'bottom',
          closeOnClick: true,
          content: h(Fragment, [
            h(
              MenuButton,
              {
                onClick: () => setAddingEntity(true),
              },
              'Add row'
            ),
            h(
              MenuButton,
              {
                onClick: () => setAddingColumn(true),
              },
              ['Add column']
            ),
            h(MenuDivider),
            h(
              MenuButton,
              {
                disabled: !entitiesSelected,
                tooltip: !entitiesSelected && 'Select rows to edit in the table',
                onClick: () => setEditingEntities(true),
              },
              ['Edit selected rows']
            ),
            h(
              MenuButton,
              {
                disabled: !entitiesSelected,
                tooltip: !entitiesSelected && 'Select rows to delete in the table',
                onClick: () => setDeletingEntities(true),
              },
              'Delete selected rows'
            ),
            h(MenuDivider),
            h(
              MenuButton,
              {
                disabled: !entitiesSelected,
                tooltip: !entitiesSelected && 'Select rows to save as set',
                onClick: () => setCreatingSet(true),
              },
              ['Save selection as set']
            ),
          ]),
        },
        [
          h(
            ButtonSecondary,
            {
              tooltip: 'Edit data',
              ...WorkspaceUtils.getWorkspaceEditControlProps(workspace),
              style: { marginRight: '1.5rem' },
            },
            [icon('edit', { style: { marginRight: '0.5rem' } }), 'Edit']
          ),
        ]
      )
    );
  };

  const renderExportMenu = ({ columnSettings }) => {
    const isSetOfSets = entityKey.endsWith('_set_set');

    return h(
      MenuTrigger,
      {
        side: 'bottom',
        closeOnClick: true,
        content: h(Fragment, [
          h(
            MenuButton,
            {
              disabled: isSetOfSets,
              tooltip: isSetOfSets && 'Downloading sets of sets as TSV is not supported at this time.',
              onClick: () => downloadSelectedRows(columnSettings),
            },
            'Download as TSV'
          ),
          !snapshotName &&
            h(
              MenuButton,
              {
                onClick: () => setCopyingEntities(true),
              },
              'Export to workspace'
            ),
          h(
            MenuButton,
            {
              disabled: isSetOfSets,
              tooltip: isSetOfSets && 'Copying sets of sets is not supported at this time.',
              onClick: _.flow(
                withErrorReporting('Error copying to clipboard.'),
                Utils.withBusyState(setNowCopying)
              )(async () => {
                const str = buildTSV(columnSettings, _.values(selectedEntities), false);
                await clipboard.writeText(str);
                notify('success', 'Successfully copied to clipboard.', { timeout: 3000 });
                void Metrics().captureEvent(Events.workspaceDataCopyToClipboard, extractWorkspaceDetails(workspace.workspace));
              }),
            },
            'Copy to clipboard'
          ),
        ]),
      },
      [
        h(
          ButtonSecondary,
          {
            disabled: !entitiesSelected,
            tooltip: entitiesSelected ? 'Export selected data' : 'Select rows to export in the table',
            style: { marginRight: '1.5rem' },
          },
          [icon(nowCopying ? 'loadingSpinner' : 'export', { style: { marginRight: '0.5rem' } }), 'Export']
        ),
      ]
    );
  };

  const renderOpenWithMenu = () => {
    return (
      !snapshotName &&
      h(
        ButtonSecondary,
        {
          disabled: !entitiesSelected,
          tooltip: entitiesSelected ? 'Open selected data' : 'Select rows to open in the table',
          style: { marginRight: '1.5rem' },
          onClick: () => setShowToolSelector(true),
        },
        [icon('expand-arrows-alt', { style: { marginRight: '0.5rem' } }), 'Open with...']
      )
    );
  };

  // Render
  const selectedKeys = _.keys(selectedEntities);
  const selectedLength = selectedKeys.length;

  const dataProvider = new EntityServiceDataTableProvider(namespace, name);

  return igvFiles
    ? h(IGVBrowser, { selectedFiles: igvFiles, refGenome: igvRefGenome, workspace, onDismiss: () => setIgvFiles(undefined) })
    : h(Fragment, [
        h(DataTable, {
          dataProvider,
          persist: true,
          refreshKey,
          editable,
          entityType: entityKey,
          activeCrossTableTextFilter,
          entityMetadata,
          setEntityMetadata,
          googleProject,
          workspaceId: { namespace, name },
          workspace,
          loadMetadata,
          snapshotName,
          selectionModel: {
            selected: selectedEntities,
            setSelected: setSelectedEntities,
          },
          childrenBefore: ({ columnSettings, showColumnSettingsModal }) =>
            div({ style: { display: 'flex', alignItems: 'center', flex: 'none' } }, [
              renderEditMenu(),
              renderOpenWithMenu(),
              renderExportMenu({ columnSettings }),
              !snapshotName &&
                h(
                  ButtonSecondary,
                  {
                    onClick: showColumnSettingsModal,
                    tooltip: 'Change the order and visibility of columns in the table',
                  },
                  [icon('cog', { style: { marginRight: '0.5rem' } }), 'Settings']
                ),
              div({ style: { margin: '0 1.5rem', height: '100%', borderLeft: Style.standardLine } }),
              div(
                {
                  role: 'status',
                  'aria-atomic': true,
                  style: { marginRight: '0.5rem' },
                },
                [`${selectedLength} row${selectedLength === 1 ? '' : 's'} selected`]
              ),
            ]),
          controlPanelStyle: {
            background: colors.light(0.5),
            borderBottom: `1px solid ${colors.grey(0.4)}`,
          },
          border: false,
          extraColumnActions: (columnName) => [
            {
              label: 'Show Provenance',
              onClick: () => {
                if (!(loadingColumnProvenance || columnProvenance)) {
                  loadColumnProvenance();
                }
                setShowColumnProvenance(columnName);
              },
            },
          ],
        }),
        addingEntity &&
          h(AddEntityModal, {
            entityType: entityKey,
            attributeNames: entityMetadata[entityKey].attributeNames,
            entityTypes: _.keys(entityMetadata),
            workspaceId: { namespace, name },
            onDismiss: () => setAddingEntity(false),
            onSuccess: () => {
              void Metrics().captureEvent(Events.workspaceDataAddRow, extractWorkspaceDetails(workspace.workspace));
              setRefreshKey(_.add(1));
              setEntityMetadata(_.update(`${entityKey}.count`, _.add(1)));
            },
          }),
        addingColumn &&
          h(AddColumnModal, {
            entityType: entityKey,
            entityMetadata,
            workspaceId: { namespace, name },
            onDismiss: () => setAddingColumn(false),
            onSuccess: () => {
              setAddingColumn(false);
              void Metrics().captureEvent(Events.workspaceDataAddColumn, extractWorkspaceDetails(workspace.workspace));
              setRefreshKey(_.add(1));
            },
          }),
        editingEntities &&
          h(MultipleEntityEditor, {
            entityType: entityKey,
            entities: _.values(selectedEntities),
            attributeNames: entityMetadata[entityKey].attributeNames,
            entityTypes: _.keys(entityMetadata),
            workspaceId: { namespace, name },
            onDismiss: () => setEditingEntities(false),
            onSuccess: () => {
              setEditingEntities(false);
              void Metrics().captureEvent(Events.workspaceDataEditMultiple, extractWorkspaceDetails(workspace.workspace));
              setRefreshKey(_.add(1));
            },
          }),
        creatingSet &&
          h(CreateEntitySetModal, {
            entityType: entityKey,
            entityNames: _.keys(selectedEntities),
            workspaceId: { namespace, name },
            onDismiss: () => setCreatingSet(false),
            onSuccess: () => {
              setCreatingSet(false);
              void Metrics().captureEvent(Events.workspaceDataCreateSet, extractWorkspaceDetails(workspace.workspace));
              loadMetadata();
            },
          }),
        deletingEntities &&
          h(EntityDeleter, {
            onDismiss: () => setDeletingEntities(false),
            onSuccess: () => {
              setDeletingEntities(false);
              setSelectedEntities({});
              setRefreshKey(_.add(1));
              void Metrics().captureEvent(Events.workspaceDataDelete, extractWorkspaceDetails(workspace.workspace));
              loadMetadata();
            },
            namespace,
            name,
            selectedEntities,
            selectedDataType: entityKey,
            runningSubmissionsCount,
          }),
        copyingEntities &&
          h(ExportDataModal, {
            onDismiss: () => setCopyingEntities(false),
            workspace,
            selectedEntities: selectedKeys,
            selectedDataType: entityKey,
          }),
        showColumnProvenance &&
          h(
            Modal,
            {
              title: 'Column Provenance',
              showCancel: false,
              onDismiss: () => setShowColumnProvenance(undefined),
            },
            [
              Utils.cond(
                [loadingColumnProvenance, () => p([h(Spinner, { size: 12, style: { marginRight: '1ch' } }), 'Loading provenance...'])],
                [
                  columnProvenanceError,
                  () => {
                    void Metrics().captureEvent(Events.provenanceColumn, {
                      workspaceNamespace: workspace?.workspace?.namespace,
                      workspaceName: workspace?.workspace?.name,
                      entityType: entityKey,
                      column: showColumnProvenance,
                      success: false,
                    });
                    return p(['Error loading column provenance']);
                  },
                ],
                () => {
                  void Metrics().captureEvent(Events.provenanceColumn, {
                    workspaceNamespace: workspace?.workspace?.namespace,
                    workspaceName: workspace?.workspace?.name,
                    entityType: entityKey,
                    column: showColumnProvenance,
                    numSubmissions: columnProvenance[showColumnProvenance] ? columnProvenance[showColumnProvenance].length : 0,
                    success: true,
                  });
                  return h(DataTableColumnProvenance, {
                    workspace,
                    column: showColumnProvenance,
                    provenance: columnProvenance[showColumnProvenance],
                  });
                }
              ),
            ]
          ),
        h(ToolDrawer, {
          workspace,
          isOpen: showToolSelector,
          onDismiss: () => setShowToolSelector(false),
          onIgvSuccess: ({ selectedFiles, refGenome }) => {
            setShowToolSelector(false);
            setIgvFiles(selectedFiles);
            setIgvRefGenome(refGenome);

            const workspaceDetails = extractWorkspaceDetails(workspace.workspace);
            const igvDetails = getIgvMetricDetails(selectedFiles, refGenome);
            const details = Object.assign(igvDetails, workspaceDetails);
            void Metrics().captureEvent(Events.workspaceDataOpenWithIGV, details);
          },
          entityMetadata,
          entityKey,
          selectedEntities,
        }),
      ]);
};

export default EntitiesContent;
