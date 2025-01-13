import { Interactive, Spinner } from '@terra-ui-packages/components';
import FileSaver from 'file-saver';
import _ from 'lodash/fp';
import * as qs from 'qs';
import { Fragment, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { DraggableCore } from 'react-draggable';
import { div, form, h, h3, input, span } from 'react-hyperscript-helpers';
import { cloudProviders } from 'src/analysis/utils/runtime-utils';
import * as breadcrumbs from 'src/components/breadcrumbs';
import Collapse from 'src/components/Collapse';
import { ButtonOutline, Clickable, DeleteConfirmationModal, Link, spinnerOverlay } from 'src/components/common';
import FileBrowser from 'src/components/data/FileBrowser';
import { icon } from 'src/components/icons';
import { ConfirmedSearchInput } from 'src/components/input';
import { MenuButton } from 'src/components/MenuButton';
import { MenuDivider, MenuTrigger } from 'src/components/PopupTrigger';
import { EntityServiceDataTableProvider } from 'src/libs/ajax/data-table-providers/EntityServiceDataTableProvider';
import { wdsProviderName } from 'src/libs/ajax/data-table-providers/WdsDataTableProvider';
import { appStatuses } from 'src/libs/ajax/leonardo/models/app-models';
import { Metrics } from 'src/libs/ajax/Metrics';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import colors from 'src/libs/colors';
import { getConfig } from 'src/libs/config';
import { reportError, reportErrorAndRethrow, withErrorReporting } from 'src/libs/error';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import { notify } from 'src/libs/notifications';
import { forwardRefWithName, useCancellation, useOnMount } from 'src/libs/react-utils';
import { getTerraUser } from 'src/libs/state';
import * as StateHistory from 'src/libs/state-history';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { wrapWorkspace } from 'src/workspaces/container/WorkspaceContainer';
import * as WorkspaceUtils from 'src/workspaces/utils';

import EntitiesContent from './data-table/entity-service/EntitiesContent';
import { ExportDataModal } from './data-table/entity-service/ExportDataModal';
import { RenameTableModal } from './data-table/entity-service/RenameTableModal';
import { useSavedColumnSettings } from './data-table/entity-service/SavedColumnSettings';
import { SnapshotContent } from './data-table/entity-service/SnapshotContent';
import { getRootTypeForSetTable } from './data-table/entity-service/table-utils';
import { EntityUploader } from './data-table/shared/EntityUploader';
import { dataTableVersionsPathRoot, useDataTableVersions } from './data-table/versioning/data-table-versioning-utils';
import { DataTableSaveVersionModal } from './data-table/versioning/DataTableSaveVersionModal';
import { DataTableVersion } from './data-table/versioning/DataTableVersion';
import { DataTableVersions } from './data-table/versioning/DataTableVersions';
import WDSContent from './data-table/wds/WDSContent';
import { useImportJobs } from './import-jobs';
import { getReferenceData, getReferenceLabel } from './reference-data/reference-data-utils';
import { ReferenceDataContent } from './reference-data/ReferenceDataContent';
import { ReferenceDataDeleter } from './reference-data/ReferenceDataDeleter';
import { ReferenceDataImporter } from './reference-data/ReferenceDataImporter';
import { useDataTableProvider } from './useDataTableProvider';
import { WorkspaceAttributes } from './WorkspaceAttributes';

const styles = {
  tableContainer: {
    display: 'flex',
    flex: 1,
    flexBasis: '15rem',
    maxHeight: '100%',
    overflow: 'hidden',
  },
  sidebarContainer: {
    overflow: 'auto',
    transition: 'width 100ms',
  },
  dataTypeSelectionPanel: {
    flex: 'none',
    backgroundColor: 'white',
  },
  sidebarSeparator: {
    width: '2px',
    height: '100%',
    cursor: 'ew-resize',
  },
  tableViewPanel: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
};

// Truncates an integer to the thousands, i.e. 10363 -> 10k
const formatSearchResultsCount = (integer) => {
  if (integer < 10000) {
    return `${integer}`;
  }

  return `${Math.floor(integer / 1000)}k`;
};

const SearchResultsPill = ({ filteredCount, searching }) => {
  return div(
    {
      style: {
        width: '5ch',
        textAlign: 'center',
        padding: '0.25rem 0rem',
        fontWeight: 600,
        borderRadius: '1rem',
        marginRight: '0.5rem',
        backgroundColor: colors.primary(1.2),
        color: 'white',
      },
    },
    searching ? [icon('loadingSpinner', { size: 13, color: 'white' })] : `${formatSearchResultsCount(filteredCount)}`
  );
};

const DataTypeButton = ({
  selected,
  entityName,
  children,
  entityCount,
  iconName = 'listAlt',
  iconSize = 14,
  buttonStyle,
  filteredCount,
  crossTableSearchInProgress,
  activeCrossTableTextFilter,
  after,
  wrapperProps,
  ...props
}) => {
  const isEntity = entityName !== undefined;

  return h(
    Interactive,
    {
      ...wrapperProps,
      style: { ...Style.navList.itemContainer(selected), backgroundColor: selected ? colors.dark(0.1) : 'white' },
      hover: Style.navList.itemHover(selected),
      tagName: 'div',
    },
    [
      h(
        Clickable,
        {
          style: { ...Style.navList.item(selected), flex: '1 1 auto', minWidth: 0, color: colors.accent(1.2), ...buttonStyle },
          ...(isEntity
            ? {
                tooltip: entityName
                  ? `${entityName} (${entityCount} row${entityCount === 1 ? '' : 's'}${
                      activeCrossTableTextFilter ? `, ${filteredCount} visible` : ''
                    })`
                  : undefined,
                tooltipDelay: 250,
                useTooltipAsLabel: true,
              }
            : {}),
          'aria-current': selected,
          ...props,
        },
        [
          activeCrossTableTextFilter && isEntity
            ? SearchResultsPill({ filteredCount, searching: crossTableSearchInProgress })
            : div({ style: { flex: 'none', width: '1.5rem' } }, [icon(iconName, { size: iconSize })]),
          div({ style: { ...Style.noWrapEllipsis } }, [entityName || children]),
          isEntity && div({ style: { marginLeft: '1ch' } }, `(${entityCount})`),
        ]
      ),
      after && div({ style: { marginLeft: '1ch' } }, [after]),
    ]
  );
};

const DataImportPlaceholder = () => {
  return div({ style: { ...Style.navList.item(false), color: colors.dark(0.7), marginLeft: '0.5rem' } }, [
    div({ style: { flex: 'none', display: 'flex', width: '1.5rem' } }, [icon('downloadRegular', { size: 14 })]),
    div({ style: { flex: 1 } }, ['Data import in progress']),
  ]);
};

const DataTypeSection = ({ title, error, retryFunction, children }) => {
  return h(
    Collapse,
    {
      role: 'listitem',
      title: h3(
        {
          style: {
            margin: 0,
            fontSize: 16,
            color: colors.dark(),
            textTransform: 'uppercase',
          },
        },
        title
      ),
      titleFirst: true,
      initialOpenState: true,
      summaryStyle: {
        padding: '1.125rem 1.5rem',
        borderBottom: `0.5px solid ${colors.dark(0.2)}`,
        backgroundColor: colors.light(0.4),
        fontSize: 16,
      },
      hover: {
        color: colors.dark(0.9),
      },
      afterTitle:
        error &&
        h(
          Link,
          {
            onClick: retryFunction,
            tooltip: 'Error loading, click to retry.',
          },
          [icon('sync', { size: 18 })]
        ),
    },
    [
      !!children?.length &&
        div(
          {
            style: { display: 'flex', flexDirection: 'column', width: '100%' },
            role: 'list',
          },
          [children]
        ),
    ]
  );
};

const NoDataPlaceholder = ({ message, buttonText, onAdd }) =>
  div(
    {
      role: 'listitem', // for screen readers and enabling child elements to be focusable
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: '0.5rem 1.5rem',
        borderBottom: `1px solid ${colors.dark(0.2)}`,
        backgroundColor: 'white',
      },
    },
    [message, h(Link, { 'aria-label': message, style: { marginTop: '0.5rem' }, onClick: onAdd }, [buttonText])]
  );

const SidebarSeparator = ({ sidebarWidth, setSidebarWidth }) => {
  const minWidth = 280;
  const getMaxWidth = useCallback(() => _.clamp(minWidth, 1200, window.innerWidth - 200), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onDrag = useCallback(
    _.throttle(100, (e) => {
      setSidebarWidth(_.clamp(minWidth, getMaxWidth(), e.pageX));
    }),
    [setSidebarWidth]
  );

  useOnMount(() => {
    const onResize = _.throttle(100, () => {
      setSidebarWidth(_.clamp(minWidth, getMaxWidth()));
    });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  return h(DraggableCore, { onDrag }, [
    h(Interactive, {
      tagName: 'div',
      role: 'separator',
      'aria-label': 'Resize sidebar',
      'aria-valuenow': sidebarWidth,
      'aria-valuemin': minWidth,
      'aria-valuemax': getMaxWidth(),
      tabIndex: 0,
      className: 'custom-focus-style',
      style: {
        ...styles.sidebarSeparator,
        background: colors.grey(0.4),
      },
      hover: {
        background: colors.accent(1.2),
      },
      onKeyDown: (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          setSidebarWidth((w) => _.min([w + 10, getMaxWidth()]));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          setSidebarWidth((w) => _.max([w - 10, minWidth]));
        }
      },
    }),
  ]);
};

const DataTableActions = ({
  workspace,
  tableName,
  rowCount,
  entityMetadata,
  onRenameTable,
  onDeleteTable,
  isShowingVersionHistory,
  onSaveVersion,
  onToggleVersionHistory,
  dataProvider,
}) => {
  const {
    workspace: { namespace, name },
  } = workspace;

  const isSet = tableName.endsWith('_set');
  const isSetOfSets = tableName.endsWith('_set_set');
  const setTableNames = _.filter((v) => v.match(`${tableName}(_set)+$`), _.keys(entityMetadata));

  const buttonProps = WorkspaceUtils.getWorkspaceEditControlProps(workspace);

  const downloadForm = useRef();
  const signal = useCancellation();

  const [loading, setLoading] = useState(false);
  const [entities, setEntities] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { getAllSavedColumnSettings, updateAllSavedColumnSettings } = useSavedColumnSettings({
    workspaceId: { namespace, name },
    entityType: tableName,
    entityMetadata,
  });

  return h(Fragment, [
    h(
      MenuTrigger,
      {
        side: 'bottom',
        closeOnClick: true,
        content: h(Fragment, [
          form(
            {
              ref: downloadForm,
              action: `${getConfig().orchestrationUrlRoot}/cookie-authed/workspaces/${namespace}/${name}/entities/${tableName}/tsv`,
              method: 'POST',
            },
            [input({ type: 'hidden', name: 'FCtoken', value: getTerraUser().token }), input({ type: 'hidden', name: 'model', value: 'flexible' })]
          ),
          (dataProvider?.features.supportsTsvDownload || dataProvider?.features.supportsTsvAjaxDownload) &&
            h(
              MenuButton,
              {
                disabled: isSetOfSets,
                tooltip: isSetOfSets
                  ? 'Downloading sets of sets as TSV is not supported at this time.'
                  : 'Download a TSV file containing all rows in this table.',
                onClick: () => {
                  if (dataProvider.features.supportsTsvDownload) {
                    downloadForm.current.submit();
                  } else if (dataProvider.features.supportsTsvAjaxDownload) {
                    // TODO: this overrides the filename specified by the WDS API. Is that ok?
                    Utils.withBusyState(setLoading, dataProvider.downloadTsv)(signal, tableName).then((blob) =>
                      FileSaver.saveAs(blob, `${tableName}.tsv`)
                    );
                  }
                  void Metrics().captureEvent(Events.workspaceDataDownload, {
                    ...extractWorkspaceDetails(workspace.workspace),
                    providerName: dataProvider.providerName,
                    cloudPlatform: dataProvider.providerName === wdsProviderName ? cloudProviders.azure.label : cloudProviders.gcp.label,
                    downloadFrom: 'all rows',
                    fileType: '.tsv',
                  });
                },
              },
              'Download TSV'
            ),
          dataProvider?.features.supportsExport &&
            h(
              MenuButton,
              {
                onClick: _.flow(
                  Utils.withBusyState(setLoading),
                  withErrorReporting('Error loading entities.')
                )(async () => {
                  const queryResults = await Workspaces(signal).workspace(namespace, name).paginatedEntitiesOfType(tableName, { pageSize: rowCount });
                  setEntities(_.map(_.get('name'), queryResults.results));
                  setExporting(true);
                }),
              },
              'Export to workspace'
            ),
          dataProvider?.features.supportsTypeRenaming &&
            h(
              MenuButton,
              {
                onClick: () => {
                  setRenaming(true);
                },
                ...buttonProps,
              },
              'Rename table'
            ),
          dataProvider?.features.supportsTypeDeletion &&
            h(
              MenuButton,
              {
                onClick: () => setDeleting(true),
                ...buttonProps,
              },
              'Delete table'
            ),
          h(Fragment, [
            h(MenuDivider),
            h(MenuButton, { onClick: () => setSavingVersion(true) }, ['Save version']),
            h(
              MenuButton,
              {
                onClick: () => {
                  onToggleVersionHistory(!isShowingVersionHistory);
                  if (!isShowingVersionHistory) {
                    void Metrics().captureEvent(Events.dataTableVersioningViewVersionHistory, {
                      ...extractWorkspaceDetails(workspace.workspace),
                      tableName,
                    });
                  }
                },
              },
              [`${isShowingVersionHistory ? 'Hide' : 'Show'} version history`]
            ),
          ]),
        ]),
      },
      [
        h(
          Clickable,
          {
            disabled: loading,
            tooltip: 'Table menu',
            useTooltipAsLabel: true,
          },
          [icon(loading ? 'loadingSpinner' : 'cardMenuIcon')]
        ),
      ]
    ),
    exporting &&
      h(ExportDataModal, {
        onDismiss: () => {
          setExporting(false);
          setEntities([]);
        },
        workspace,
        selectedDataType: tableName,
        selectedEntities: entities,
      }),
    savingVersion &&
      h(DataTableSaveVersionModal, {
        workspace,
        entityType: isSet ? getRootTypeForSetTable(tableName) : tableName,
        allEntityTypes: _.keys(entityMetadata),
        includeSetsByDefault: isSet,
        onDismiss: () => setSavingVersion(false),
        onSubmit: (versionOpts) => {
          setSavingVersion(false);
          onSaveVersion(versionOpts);
        },
      }),
    renaming &&
      h(RenameTableModal, {
        onDismiss: () => setRenaming(false),
        onUpdateSuccess: onRenameTable,
        getAllSavedColumnSettings,
        updateAllSavedColumnSettings,
        setTableNames,
        namespace,
        name,
        selectedDataType: tableName,
        entityMetadata,
      }),
    deleting &&
      h(DeleteConfirmationModal, {
        objectType: 'table',
        objectName: tableName,
        onDismiss: () => setDeleting(false),
        onConfirm: Utils.withBusyState(setLoading)(async () => {
          try {
            await dataProvider.deleteTable(tableName);
            void Metrics().captureEvent(Events.workspaceDataDeleteTable, {
              ...extractWorkspaceDetails(workspace.workspace),
              providerName: dataProvider.providerName,
              cloudPlatform: dataProvider.providerName === wdsProviderName ? cloudProviders.azure.label : cloudProviders.gcp.label,
            });
            setDeleting(false);
            onDeleteTable(tableName);
          } catch (error) {
            setDeleting(false);
            if (error.status === 409) {
              notify('warn', 'Unable to delete table', {
                message: 'In order to delete this table, any entries in other tables that reference it must also be deleted.',
              });
            } else {
              reportError('Error deleting table', error);
            }
          }
        }),
      }),
  ]);
};

const workspaceDataTypes = Utils.enumify(['entities', 'entitiesVersion', 'snapshot', 'referenceData', 'localVariables', 'bucketObjects', 'wds']);

export const WorkspaceData = _.flow(
  forwardRefWithName('WorkspaceData'),
  wrapWorkspace({
    breadcrumbs: (props) => breadcrumbs.commonPaths.workspaceDashboard(props),
    title: 'Data',
    activeTab: 'data',
  })
)(
  (
    {
      namespace,
      name,
      workspace,
      workspace: {
        workspace: { googleProject, attributes, workspaceId },
      },
      refreshWorkspace,
      storageDetails,
    },
    ref
  ) => {
    // State
    const [refreshKey, setRefreshKey] = useState(0);
    const forceRefresh = () => setRefreshKey(_.add(1));
    const [selectedData, setSelectedData] = useState(() => StateHistory.get().selectedData);
    const [entityMetadata, setEntityMetadata] = useState(() => StateHistory.get().entityMetadata);
    const [snapshotDetails, setSnapshotDetails] = useState(() => StateHistory.get().snapshotDetails);
    const [importingReference, setImportingReference] = useState(false);
    const [deletingReference, setDeletingReference] = useState(undefined);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadingWDSFile, setUploadingWDSFile] = useState(false);
    const [entityMetadataError, setEntityMetadataError] = useState();
    const [snapshotMetadataError, setSnapshotMetadataError] = useState();
    const [sidebarWidth, setSidebarWidth] = useState(280);
    const [activeCrossTableTextFilter, setActiveCrossTableTextFilter] = useState('');
    const [crossTableResultCounts, setCrossTableResultCounts] = useState({});
    const [crossTableSearchInProgress, setCrossTableSearchInProgress] = useState(false);
    const [showDataTableVersionHistory, setShowDataTableVersionHistory] = useState({}); // { [entityType: string]: boolean }
    const pollWdsInterval = useRef();

    const { dataTableVersions, loadDataTableVersions, saveDataTableVersion, deleteDataTableVersion, importDataTableVersion } =
      useDataTableVersions(workspace);

    const isGoogleWorkspace = !!googleProject;
    const isAzureWorkspace = !isGoogleWorkspace;

    const { runningJobs: runningImportJobs, refresh: refreshRunningImportJobs } = useImportJobs(workspace);
    const signal = useCancellation();

    const entityServiceDataTableProvider = new EntityServiceDataTableProvider(namespace, name);
    const region = isAzureWorkspace ? storageDetails.azureContainerRegion : storageDetails.googleBucketLocation;
    const [wdsDataTableProvider, wdsApp, wdsTypes, setWdsTypes, loadWdsData] = useDataTableProvider(workspaceId);

    const loadEntityMetadata = async () => {
      try {
        setEntityMetadata(undefined);
        setEntityMetadataError(false);
        const entityMetadata = await Workspaces(signal).workspace(namespace, name).entityMetadata();

        if (selectedData?.type === workspaceDataTypes.entities && !entityMetadata[selectedData.entityType]) {
          setSelectedData(undefined);
        }
        setEntityMetadata(entityMetadata);
      } catch (error) {
        reportError('Error loading workspace entity data', error);
        setEntityMetadataError(true);
        setSelectedData(undefined);
        setEntityMetadata({});
      }
    };

    const loadSnapshotMetadata = async () => {
      try {
        setSnapshotMetadataError(false);
        const { gcpDataRepoSnapshots: snapshotBody } = await Workspaces(signal).workspace(namespace, name).listSnapshots(1000, 0);

        const snapshots = _.reduce(
          (acc, { metadata: { name, ...metadata }, attributes }) => {
            return _.set([name, 'resource'], _.merge(metadata, attributes), acc);
          },
          _.pick(_.map('name', _.map('metadata', snapshotBody)), snapshotDetails) || {}, // retain entities if loaded from state history, but only for snapshots that exist
          _.filter((snapshot) => {
            // Do not display snapshot references that are only created for linking policies.
            const isForPolicy = snapshot.metadata.properties.some((p) => p.key === 'purpose' && p.value === 'policy');
            return !isForPolicy;
          }, snapshotBody)
        );

        setSnapshotDetails(snapshots);
      } catch (error) {
        reportError('Error loading workspace snapshot data', error);
        setSnapshotMetadataError(true);
        setSelectedData(undefined);
        setSnapshotDetails({});
      }
    };

    const loadMetadata = () =>
      isAzureWorkspace
        ? Promise.all([refreshRunningImportJobs(), loadWdsData()])
        : Promise.all([loadEntityMetadata(), loadSnapshotMetadata(), refreshRunningImportJobs()]);

    const loadSnapshotEntities = async (snapshotName) => {
      try {
        setSnapshotDetails(_.set([snapshotName, 'error'], false));
        const entities = await Workspaces(signal).workspace(namespace, name).snapshotEntityMetadata(googleProject, snapshotName);
        // Prevent duplicate id columns
        const entitiesWithoutIds = _.mapValues((entity) => _.update(['attributeNames'], _.without([entity.idName]), entity), entities);
        setSnapshotDetails(_.set([snapshotName, 'entityMetadata'], entitiesWithoutIds));
      } catch (error) {
        reportError(`Error loading entities in snapshot ${snapshotName}`, error);
        setSnapshotDetails(_.set([snapshotName, 'error'], true));
      }
    };

    const toSortedPairs = _.flow(_.toPairs, _.sortBy(_.first));

    const searchAcrossTables = async (typeNames, activeCrossTableTextFilter) => {
      setCrossTableSearchInProgress(true);
      try {
        const results = await Promise.all(
          _.map(async (typeName) => {
            const {
              resultMetadata: { filteredCount },
            } = await Workspaces(signal)
              .workspace(namespace, name)
              .paginatedEntitiesOfType(typeName, { pageSize: 1, filterTerms: activeCrossTableTextFilter });
            return { typeName, filteredCount };
          }, typeNames)
        );
        setCrossTableResultCounts(results);
        void Metrics().captureEvent(Events.workspaceDataCrossTableSearch, {
          ...extractWorkspaceDetails(workspace.workspace),
          numTables: _.size(typeNames),
        });
      } catch (error) {
        reportError('Error searching across tables', error);
      }
      setCrossTableSearchInProgress(false);
    };

    // Lifecycle
    useOnMount(() => {
      loadMetadata();
    });

    useEffect(() => {
      StateHistory.update({ entityMetadata, selectedData, snapshotDetails });
    }, [entityMetadata, selectedData, snapshotDetails]);

    useImperativeHandle(ref, () => ({
      refresh: () => {
        forceRefresh();
        loadMetadata();
      },
    }));

    // Render
    const referenceData = getReferenceData(attributes);
    const sortedEntityPairs = toSortedPairs(entityMetadata);
    const sortedSnapshotPairs = toSortedPairs(snapshotDetails);

    const { value: canEditWorkspace, message: editWorkspaceErrorMessage } = WorkspaceUtils.canEditWorkspace(workspace);

    // convenience vars for WDS
    const wdsReady = wdsApp.status === 'Ready' && wdsTypes.status === 'Ready';
    const wdsError = wdsApp.status === 'Error' || wdsTypes.status === 'Error';
    const wdsAppState = wdsApp.state?.status;
    const wdsLoading = !wdsReady && !wdsError && (wdsApp.status === 'Loading' || wdsTypes.status === 'Loading');

    useEffect(() => {
      if (isAzureWorkspace) {
        // These aren't needed for Azure workspaces; just set them to empty objects
        setSnapshotMetadataError(false);
        setEntityMetadata({});

        if (!wdsReady && !wdsError && !pollWdsInterval.current) {
          // Start polling if we're missing WDS Types, and stop polling when we have them.
          pollWdsInterval.current = setInterval(loadWdsData, 30 * 1000);
        } else if (wdsReady && pollWdsInterval.current) {
          clearInterval(pollWdsInterval.current);
          pollWdsInterval.current = undefined;
        }
        return () => {
          clearInterval(pollWdsInterval.current);
          pollWdsInterval.current = undefined;
        };
      }
    }, [loadWdsData, workspaceId, wdsApp, wdsTypes, isAzureWorkspace, signal, wdsError, wdsReady]);

    const canUploadTsv = isGoogleWorkspace || (isAzureWorkspace && wdsReady);
    return div({ style: styles.tableContainer }, [
      !entityMetadata
        ? spinnerOverlay
        : h(Fragment, [
            div({ style: { ...styles.sidebarContainer, width: sidebarWidth } }, [
              canUploadTsv &&
                div(
                  {
                    style: {
                      display: 'flex',
                      padding: '1rem 1.5rem',
                      backgroundColor: colors.light(),
                      borderBottom: `1px solid ${colors.grey(0.4)}`,
                    },
                  },
                  [
                    h(
                      MenuTrigger,
                      {
                        side: 'bottom',
                        closeOnClick: true,
                        // Make the width of the dropdown menu match the width of the button.
                        popupProps: { style: { width: `calc(${sidebarWidth}px - 3rem` } },
                        content: h(Fragment, [
                          h(
                            MenuButton,
                            {
                              'aria-haspopup': 'dialog',
                              onClick: () => (isGoogleWorkspace ? setUploadingFile(true) : setUploadingWDSFile(true)),
                            },
                            'Upload TSV'
                          ),
                          isGoogleWorkspace &&
                            h(
                              MenuButton,
                              {
                                href: `${Nav.getLink('upload')}?${qs.stringify({ workspace: workspaceId })}`,
                                onClick: () =>
                                  void Metrics().captureEvent(Events.dataTableOpenUploader, {
                                    workspaceNamespace: namespace,
                                    workspaceName: name,
                                  }),
                              },
                              ['Open data uploader']
                            ),
                          isGoogleWorkspace &&
                            h(
                              MenuButton,
                              {
                                'aria-haspopup': 'dialog',
                                onClick: () => setImportingReference(true),
                              },
                              'Add reference data'
                            ),
                        ]),
                      },
                      [
                        h(
                          ButtonOutline,
                          {
                            disabled: !canEditWorkspace || uploadingWDSFile,
                            tooltip: Utils.cond([uploadingWDSFile, () => 'Upload in progress'], () =>
                              canEditWorkspace ? 'Add data to this workspace' : editWorkspaceErrorMessage
                            ),
                            style: { flex: 1 },
                          },
                          [span([icon('plus-circle', { style: { marginRight: '1ch' } }), 'Import data'])]
                        ),
                      ]
                    ),
                  ]
                ),
              div({ style: styles.dataTypeSelectionPanel, role: 'navigation', 'aria-label': 'data in this workspace' }, [
                div({ role: 'list' }, [
                  isGoogleWorkspace &&
                    h(
                      DataTypeSection,
                      {
                        title: 'Tables',
                        error: entityMetadataError,
                        retryFunction: loadEntityMetadata,
                      },
                      [
                        runningImportJobs.length > 0 && h(DataImportPlaceholder),
                        runningImportJobs.length === 0 &&
                          _.isEmpty(sortedEntityPairs) &&
                          h(NoDataPlaceholder, {
                            message: 'No tables have been uploaded.',
                            buttonText: 'Upload TSV',
                            onAdd: () => setUploadingFile(true),
                          }),
                        !_.isEmpty(sortedEntityPairs) &&
                          div({ role: 'listitem', style: { margin: '1rem' } }, [
                            h(ConfirmedSearchInput, {
                              'aria-label': 'Search all tables',
                              placeholder: 'Search all tables',
                              onChange: (activeCrossTableTextFilter) => {
                                setActiveCrossTableTextFilter(activeCrossTableTextFilter);
                                searchAcrossTables(_.keys(entityMetadata), activeCrossTableTextFilter);
                              },
                              defaultValue: activeCrossTableTextFilter,
                            }),
                          ]),
                        activeCrossTableTextFilter !== '' &&
                          div(
                            { style: { margin: '0rem 1rem 1rem 1rem' } },
                            crossTableSearchInProgress
                              ? ['Loading...', icon('loadingSpinner', { size: 13, color: colors.primary() })]
                              : [`${_.sum(_.map((c) => c.filteredCount, crossTableResultCounts))} results`]
                          ),
                        _.map(([type, typeDetails]) => {
                          const isShowingVersionHistory = !!showDataTableVersionHistory[type];
                          return div({ key: type, role: 'listitem' }, [
                            h(DataTypeButton, {
                              key: type,
                              selected: selectedData?.type === workspaceDataTypes.entities && selectedData.entityType === type,
                              entityName: type,
                              entityCount: typeDetails.count,
                              filteredCount: _.find({ typeName: type }, crossTableResultCounts)?.filteredCount,
                              activeCrossTableTextFilter,
                              crossTableSearchInProgress,
                              onClick: () => {
                                setSelectedData({ type: workspaceDataTypes.entities, entityType: type });
                                forceRefresh();
                              },
                              after: h(DataTableActions, {
                                dataProvider: entityServiceDataTableProvider,
                                tableName: type,
                                rowCount: typeDetails.count,
                                entityMetadata,
                                workspace,
                                onRenameTable: () => loadMetadata(),
                                onDeleteTable: (tableName) => {
                                  setSelectedData(undefined);
                                  setEntityMetadata(_.unset(tableName));
                                },
                                isShowingVersionHistory,
                                onSaveVersion: withErrorReporting('Error saving version')((versionOpts) => {
                                  setShowDataTableVersionHistory(_.set(type, true));
                                  return saveDataTableVersion(type, versionOpts);
                                }),
                                onToggleVersionHistory: withErrorReporting('Error loading version history')((showVersionHistory) => {
                                  setShowDataTableVersionHistory(_.set(type, showVersionHistory));
                                  if (showVersionHistory) {
                                    loadDataTableVersions(type.endsWith('_set') ? getRootTypeForSetTable(type) : type);
                                  }
                                }),
                              }),
                            }),
                            isShowingVersionHistory &&
                              h(DataTableVersions, {
                                ...Utils.cond(
                                  [
                                    type.endsWith('_set'),
                                    () => {
                                      const referencedType = getRootTypeForSetTable(type);
                                      return _.update(
                                        'versions',
                                        _.filter((version) => _.includes(type, version.includedSetEntityTypes)),
                                        dataTableVersions[referencedType]
                                      );
                                    },
                                  ],
                                  () => dataTableVersions[type]
                                ),
                                onClickVersion: (version) => setSelectedData({ type: workspaceDataTypes.entitiesVersion, version }),
                              }),
                          ]);
                        }, sortedEntityPairs),
                      ]
                    ),
                  isAzureWorkspace && (uploadingWDSFile || runningImportJobs.length > 0) && h(DataImportPlaceholder),
                  isAzureWorkspace &&
                    h(
                      DataTypeSection,
                      {
                        title: 'Tables',
                      },
                      [
                        (wdsLoading || wdsError) &&
                          h(NoDataPlaceholder, {
                            message: wdsLoading ? icon('loadingSpinner') : 'Data tables are unavailable',
                          }),
                        wdsReady &&
                          _.isEmpty(wdsTypes.state) &&
                          h(NoDataPlaceholder, {
                            message: 'No tables have been uploaded.',
                          }),
                        wdsReady &&
                          !_.isEmpty(wdsTypes.state) &&
                          _.map((typeDef) => {
                            return div({ key: typeDef.name, role: 'listitem' }, [
                              h(DataTypeButton, {
                                key: typeDef.name,
                                selected: selectedData?.type === workspaceDataTypes.wds && selectedData.entityType === typeDef.name,
                                entityName: typeDef.name,
                                entityCount: typeDef.count,
                                filteredCount: typeDef.count,
                                activeCrossTableTextFilter: false,
                                crossTableSearchInProgress: false,
                                onClick: () => {
                                  setSelectedData({ type: workspaceDataTypes.wds, entityType: typeDef.name });
                                  forceRefresh();
                                },
                                after: h(DataTableActions, {
                                  dataProvider: wdsDataTableProvider,
                                  tableName: typeDef.name,
                                  rowCount: typeDef.count,
                                  entityMetadata,
                                  workspace,
                                  onRenameTable: undefined,
                                  onDeleteTable: (tableName) => {
                                    setSelectedData(undefined);
                                    setWdsTypes({ status: 'Ready', state: _.remove((typeDef) => typeDef.name === tableName, wdsTypes.state) });
                                    forceRefresh();
                                  },
                                  isShowingVersionHistory: false,
                                  onSaveVersion: undefined,
                                  onToggleVersionHistory: undefined,
                                }),
                              }),
                            ]);
                          }, wdsTypes.state),
                      ]
                    ),
                  (!_.isEmpty(sortedSnapshotPairs) || snapshotMetadataError) &&
                    isGoogleWorkspace &&
                    h(
                      DataTypeSection,
                      {
                        title: 'Snapshots',
                        error: snapshotMetadataError,
                        retryFunction: loadSnapshotMetadata,
                      },
                      [
                        _.map(
                          ([
                            snapshotName,
                            {
                              resource: { resourceId, snapshotId },
                              entityMetadata: snapshotTables,
                              error: snapshotTablesError,
                            },
                          ]) => {
                            const snapshotTablePairs = toSortedPairs(snapshotTables);
                            return h(
                              Collapse,
                              {
                                key: snapshotName,
                                titleFirst: true,
                                noTitleWrap: true,
                                summaryStyle: { height: 50, paddingRight: '0.5rem', fontWeight: 600 },
                                tooltip: snapshotName,
                                tooltipDelay: 250,
                                style: { fontSize: 14, paddingLeft: '1.5rem', borderBottom: `1px solid ${colors.dark(0.2)}` },
                                title: snapshotName,
                                role: 'listitem',
                                afterTitle: h(
                                  Link,
                                  {
                                    style: { marginLeft: 'auto' },
                                    tooltip: 'Snapshot Info',
                                    onClick: () => {
                                      setSelectedData({ type: workspaceDataTypes.snapshot, snapshotName });
                                      forceRefresh();
                                    },
                                  },
                                  [
                                    icon(
                                      `info-circle${
                                        selectedData?.type === workspaceDataTypes.snapshot && selectedData.snapshotName === snapshotName
                                          ? ''
                                          : '-regular'
                                      }`,
                                      { size: 20 }
                                    ),
                                  ]
                                ),
                                initialOpenState: selectedData?.type === workspaceDataTypes.snapshot && selectedData.snapshotName === snapshotName,
                                onFirstOpen: () => loadSnapshotEntities(snapshotName),
                              },
                              [
                                Utils.cond(
                                  [
                                    snapshotTablesError,
                                    () =>
                                      div(
                                        {
                                          style: { display: 'flex', alignItems: 'center', marginBottom: '0.5rem' },
                                        },
                                        [
                                          'Failed to load tables',
                                          h(
                                            Link,
                                            {
                                              onClick: () => loadSnapshotEntities(snapshotName),
                                              tooltip: 'Error loading, click to retry.',
                                            },
                                            [icon('sync', { size: 24, style: { marginLeft: '1rem' } })]
                                          ),
                                        ]
                                      ),
                                  ],
                                  [
                                    snapshotTables === undefined,
                                    () =>
                                      div(
                                        {
                                          style: { display: 'flex', alignItems: 'center', marginBottom: '0.5rem' },
                                        },
                                        ['Loading snapshot contents...', h(Spinner, { style: { marginLeft: '1rem' } })]
                                      ),
                                  ],
                                  () =>
                                    div({ role: 'list', style: { fontSize: 14, lineHeight: '1.5' } }, [
                                      _.map(([tableName, { count }]) => {
                                        const canCompute = !!workspace?.canCompute;
                                        return h(
                                          DataTypeButton,
                                          {
                                            wrapperProps: { role: 'listitem' },
                                            buttonStyle: { borderBottom: 0, height: 40, ...(canCompute ? {} : { color: colors.dark(0.25) }) },
                                            // TODO: Remove nested ternary to align with style guide
                                            // eslint-disable-next-line no-nested-ternary
                                            tooltip: canCompute
                                              ? tableName
                                                ? `${tableName} (${count} row${count === 1 ? '' : 's'})`
                                                : undefined
                                              : [
                                                  div(
                                                    { key: `${tableName}-tooltip`, style: { whiteSpace: 'pre-wrap' } },
                                                    'You must be an owner, or a writer with compute permission, to view this snapshot.\n\n' +
                                                      'Contact the owner of this workspace to change your permissions.'
                                                  ),
                                                ],
                                            tooltipSide: canCompute ? 'bottom' : 'left',
                                            key: `${snapshotName}_${tableName}`,
                                            selected:
                                              selectedData?.type === workspaceDataTypes.snapshot &&
                                              selectedData.snapshotName === snapshotName &&
                                              selectedData.tableName === tableName,
                                            entityName: tableName,
                                            entityCount: count,
                                            onClick: () => {
                                              if (canCompute) {
                                                setSelectedData({ type: workspaceDataTypes.snapshot, snapshotName, tableName });
                                                void Metrics().captureEvent(Events.workspaceSnapshotContentsView, {
                                                  ...extractWorkspaceDetails(workspace.workspace),
                                                  resourceId,
                                                  snapshotId,
                                                  entityType: tableName,
                                                });
                                                forceRefresh();
                                              }
                                            },
                                          },
                                          [`${tableName} (${count})`]
                                        );
                                      }, snapshotTablePairs),
                                    ])
                                ),
                              ]
                            );
                          },
                          sortedSnapshotPairs
                        ),
                      ]
                    ),
                  isGoogleWorkspace &&
                    h(
                      DataTypeSection,
                      {
                        title: 'Reference Data',
                      },
                      [
                        _.isEmpty(referenceData) &&
                          h(NoDataPlaceholder, {
                            message: 'No references have been added.',
                            buttonText: 'Add reference data',
                            onAdd: () => setImportingReference(true),
                          }),
                        _.map(
                          (type) =>
                            h(
                              DataTypeButton,
                              {
                                key: type,
                                wrapperProps: { role: 'listitem' },
                                selected: selectedData?.type === workspaceDataTypes.referenceData && selectedData.reference === type,
                                onClick: () => {
                                  setSelectedData({ type: workspaceDataTypes.referenceData, reference: type });
                                  refreshWorkspace();
                                },
                                after: h(
                                  Link,
                                  {
                                    style: { flex: 0 },
                                    tooltip: `Delete ${getReferenceLabel(type)} reference`,
                                    ...WorkspaceUtils.getWorkspaceEditControlProps(workspace),
                                    onClick: (e) => {
                                      e.stopPropagation();
                                      setDeletingReference(type);
                                    },
                                  },
                                  [icon('minus-circle', { size: 16 })]
                                ),
                              },
                              [getReferenceLabel(type)]
                            ),
                          _.keys(referenceData)
                        ),
                      ]
                    ),
                  importingReference &&
                    h(ReferenceDataImporter, {
                      onDismiss: () => setImportingReference(false),
                      onSuccess: (reference) => {
                        setImportingReference(false);
                        refreshWorkspace();
                        void Metrics().captureEvent(Events.workspaceDataAddReferenceData, {
                          ...extractWorkspaceDetails(workspace.workspace),
                          reference,
                        });
                      },
                      namespace,
                      name,
                    }),
                  deletingReference &&
                    h(ReferenceDataDeleter, {
                      onDismiss: () => setDeletingReference(false),
                      onSuccess: (reference) => {
                        setDeletingReference(false);
                        if (selectedData?.type === workspaceDataTypes.referenceData && selectedData.reference === deletingReference) {
                          setSelectedData(undefined);
                        }
                        refreshWorkspace();
                        void Metrics().captureEvent(Events.workspaceDataRemoveReference, {
                          ...extractWorkspaceDetails(workspace.workspace),
                          reference,
                        });
                      },
                      namespace,
                      name,
                      referenceDataType: deletingReference,
                    }),
                  uploadingFile &&
                    h(EntityUploader, {
                      onDismiss: () => setUploadingFile(false),
                      onSuccess: () => {
                        setUploadingFile(false);
                        forceRefresh();
                        loadMetadata();
                      },
                      namespace,
                      name,
                      entityTypes: _.keys(entityMetadata),
                      dataProvider: entityServiceDataTableProvider,
                      isGoogleWorkspace,
                      region,
                    }),
                  uploadingWDSFile &&
                    h(EntityUploader, {
                      onDismiss: () => setUploadingWDSFile(false),
                      onSuccess: (recordType) => {
                        setUploadingWDSFile(false);
                        forceRefresh();
                        loadMetadata();
                        notify('success', `Data imported successfully to table ${recordType}.`, {
                          id: `${recordType}_success`,
                        });
                      },
                      namespace,
                      name,
                      workspaceId,
                      entityTypes: wdsTypes.state.map((item) => item.name),
                      dataProvider: wdsDataTableProvider,
                      isGoogleWorkspace,
                      region,
                    }),
                  isGoogleWorkspace &&
                    h(
                      DataTypeSection,
                      {
                        title: 'Other Data',
                      },
                      [
                        h(
                          DataTypeButton,
                          {
                            wrapperProps: { role: 'listitem' },
                            selected: selectedData?.type === workspaceDataTypes.localVariables,
                            onClick: () => {
                              setSelectedData({ type: workspaceDataTypes.localVariables });
                              forceRefresh();
                            },
                          },
                          ['Workspace Data']
                        ),
                        div(
                          // File Browser Banner
                          { style: { padding: '1rem', margin: '0.75rem', backgroundColor: colors.dark(0.1), borderRadius: '0.5rem' } },
                          [
                            span({ style: { fontWeight: 'bold' } }, ['Looking for the Files folder?']),
                            div(['Use the folder icon in the right side-bar to access the workspace Bucket directory.']),
                          ]
                        ),
                      ]
                    ),
                ]),
              ]),
            ]),
            h(SidebarSeparator, { sidebarWidth, setSidebarWidth }),
            div({ style: styles.tableViewPanel }, [
              Utils.switchCase(
                selectedData?.type,
                [
                  undefined,
                  () =>
                    Utils.cond(
                      [
                        isAzureWorkspace && wdsError,
                        () =>
                          div(
                            {
                              style: { textAlign: 'center', lineHeight: '1.4rem', marginTop: '1rem', marginLeft: '5rem', marginRight: '5rem' },
                            },
                            [
                              'An error occurred while preparing your data tables.',
                              div([
                                'Please contact ',
                                h(Link, { href: 'mailto:support@terra.bio' }, ['support@terra.bio']),
                                ' to troubleshoot the problem.',
                              ]),
                            ]
                          ),
                      ],
                      [
                        isAzureWorkspace && wdsLoading,
                        () =>
                          div(
                            {
                              style: { textAlign: 'center', lineHeight: '1.4rem', marginTop: '1rem', marginLeft: '5rem', marginRight: '5rem' },
                            },
                            [
                              icon('loadingSpinner'),
                              ` ${
                                wdsAppState === appStatuses.updating.status ? 'Updating' : 'Preparing'
                              } your data tables, this may take a few minutes. `,
                            ]
                          ),
                      ],
                      () => div({ style: { textAlign: 'center' } }, ['Select a data type from the navigation panel on the left'])
                    ),
                ],
                [
                  workspaceDataTypes.localVariables,
                  () =>
                    h(WorkspaceAttributes, {
                      workspace,
                      refreshKey,
                    }),
                ],
                [
                  workspaceDataTypes.referenceData,
                  () =>
                    h(ReferenceDataContent, {
                      key: selectedData.reference,
                      workspace,
                      referenceKey: selectedData.reference,
                    }),
                ],
                [
                  workspaceDataTypes.bucketObjects,
                  () =>
                    h(FileBrowser, {
                      style: { flex: '1 1 auto' },
                      controlPanelStyle: {
                        padding: '1rem',
                        background: colors.light(0.5),
                      },
                      workspace,
                      extraMenuItems: h(
                        Link,
                        {
                          href: `https://seqr.broadinstitute.org/workspace/${namespace}/${name}`,
                          style: { padding: '0.5rem' },
                        },
                        [icon('pop-out'), ' Analyze in Seqr']
                      ),
                      noticeForPrefix: (prefix) =>
                        prefix.startsWith(`${dataTableVersionsPathRoot}/`) ? 'Files in this folder are managed via data table versioning.' : null,
                      shouldDisableEditForPrefix: (prefix) => prefix.startsWith(`${dataTableVersionsPathRoot}/`),
                    }),
                ],
                [
                  workspaceDataTypes.snapshot,
                  () =>
                    h(SnapshotContent, {
                      key: refreshKey,
                      workspace,
                      snapshotDetails,
                      snapshotName: selectedData.snapshotName,
                      tableName: selectedData.tableName,
                      loadMetadata: () => loadSnapshotEntities(selectedData.snapshotName),
                      onUpdate: async (newSnapshotName) => {
                        await loadSnapshotMetadata();
                        setSelectedData({ type: workspaceDataTypes.snapshot, snapshotName: newSnapshotName });
                        forceRefresh();
                      },
                      onDelete: async () => {
                        await loadSnapshotMetadata();
                        setSelectedData(undefined);
                        forceRefresh();
                      },
                    }),
                ],
                [
                  workspaceDataTypes.entities,
                  () =>
                    h(EntitiesContent, {
                      key: refreshKey,
                      workspace,
                      entityMetadata,
                      setEntityMetadata,
                      entityKey: selectedData.entityType,
                      activeCrossTableTextFilter,
                      loadMetadata,
                      forceRefresh,
                      editable: canEditWorkspace,
                    }),
                ],
                [
                  workspaceDataTypes.entitiesVersion,
                  () =>
                    h(DataTableVersion, {
                      workspace,
                      version: selectedData.version,
                      onDelete: reportErrorAndRethrow('Error deleting version')(async () => {
                        await deleteDataTableVersion(selectedData.version);
                        setSelectedData(undefined);
                      }),
                      onImport: reportErrorAndRethrow('Error importing version')(async () => {
                        const { tableName } = await importDataTableVersion(selectedData.version);
                        await loadMetadata();
                        setSelectedData({ type: workspaceDataTypes.entities, entityType: tableName });
                      }),
                    }),
                ],
                [
                  workspaceDataTypes.wds,
                  () =>
                    wdsDataTableProvider &&
                    wdsReady &&
                    !_.isEmpty(wdsTypes.state) &&
                    h(WDSContent, {
                      key: refreshKey,
                      workspaceUUID: workspaceId,
                      workspace,
                      dataProvider: wdsDataTableProvider,
                      recordType: selectedData.entityType,
                      wdsSchema: wdsTypes.state,
                      editable: canEditWorkspace,
                      loadMetadata,
                    }),
                ]
              ),
              // ]
            ]),
          ]),
    ]);
  }
);

export const navPaths = [
  {
    name: 'workspace-data',
    path: '/workspaces/:namespace/:name/data',
    component: WorkspaceData,
    title: ({ name }) => `${name} - Data`,
  },
];
