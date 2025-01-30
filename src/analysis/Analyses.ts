import { Switch, TooltipTrigger } from '@terra-ui-packages/components';
import { formatDatetime, withHandlers } from '@terra-ui-packages/core-utils';
import * as clipboard from 'clipboard-polyfill/text';
import _ from 'lodash/fp';
import * as qs from 'qs';
import { CSSProperties, ForwardedRef, Fragment, useEffect, useState } from 'react';
import { div, h, img, label, span } from 'react-hyperscript-helpers';
import { AnalysisDuplicator } from 'src/analysis/modals/AnalysisDuplicator';
import { AnalysisModal } from 'src/analysis/modals/AnalysisModal';
import ExportAnalysisModal from 'src/analysis/modals/ExportAnalysisModal/ExportAnalysisModal';
import { analysisLauncherTabName, analysisTabName, appLauncherTabName } from 'src/analysis/runtime-common-text';
import { AnalysisFile, AnalysisFileMetadata, useAnalysisFiles } from 'src/analysis/useAnalysisFiles';
import {
  AbsolutePath,
  FileName,
  getDisplayName,
  getExtension,
  getFileName,
  notebookLockHash,
} from 'src/analysis/utils/file-utils';
import { findPotentialNotebookLockers } from 'src/analysis/utils/notebook-lockers';
import { getCurrentRuntime } from 'src/analysis/utils/runtime-utils';
import {
  getToolLabelFromCloudEnv,
  getToolLabelFromFileExtension,
  RuntimeToolLabel,
  runtimeToolLabels,
  runtimeTools,
  ToolLabel,
} from 'src/analysis/utils/tool-utils';
import * as breadcrumbs from 'src/components/breadcrumbs';
import { withViewToggle } from 'src/components/CardsListToggle';
import {
  ButtonOutline,
  Clickable,
  DeleteConfirmationModal,
  IdContainer,
  Link,
  spinnerOverlay,
} from 'src/components/common';
import Dropzone from 'src/components/Dropzone';
import { FeaturePreviewFeedbackModal } from 'src/components/FeaturePreviewFeedbackModal';
import { icon } from 'src/components/icons';
import { DelayedSearchInput } from 'src/components/input';
import { MenuButton } from 'src/components/MenuButton';
import { PageBox } from 'src/components/PageBox';
import { makeMenuIcon, MenuTrigger } from 'src/components/PopupTrigger';
import { ariaSort, HeaderRenderer } from 'src/components/table';
import galaxyLogo from 'src/images/galaxy-logo.svg';
import jupyterLogo from 'src/images/jupyter-logo.svg';
import rstudioBioLogo from 'src/images/r-bio-logo.svg';
import rstudioSquareLogo from 'src/images/rstudio-logo-square.png';
import { Runtime } from 'src/libs/ajax/leonardo/models/runtime-models';
import { Metrics } from 'src/libs/ajax/Metrics';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import colors from 'src/libs/colors';
import { reportError, withErrorReporting } from 'src/libs/error';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import { ENABLE_JUPYTERLAB_ID, JUPYTERLAB_GCP_FEATURE_ID } from 'src/libs/feature-previews-config';
import * as Nav from 'src/libs/nav';
import { notify } from 'src/libs/notifications';
import { getLocalPref, setLocalPref } from 'src/libs/prefs';
import { forwardRefWithName, useCancellation, useStore } from 'src/libs/react-utils';
import { userStore } from 'src/libs/state';
import * as StateHistory from 'src/libs/state-history';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { requesterPaysWrapper, withRequesterPaysHandler } from 'src/workspaces/common/requester-pays/bucket-utils';
import { AppDetails } from 'src/workspaces/common/state/useAppPolling';
import { CloudEnvironmentDetails } from 'src/workspaces/common/state/useCloudEnvironmentPolling';
import { InitializedWorkspaceWrapper, StorageDetails } from 'src/workspaces/common/state/useWorkspace';
import { wrapWorkspace } from 'src/workspaces/container/WorkspaceContainer';
import { canWrite, isAzureWorkspace, isGoogleWorkspace, isGoogleWorkspaceInfo } from 'src/workspaces/utils';

const tableFields = {
  application: 'application',
  name: 'name',
  lastModified: 'lastModified',
};

export const KEY_ANALYSES_SORT_ORDER = 'AnalysesSortOrder';

const noWrite = 'You do not have access to modify this workspace.';

const sortTokens = {
  name: (notebook: AnalysisFile) => notebook.name.toLowerCase(),
};

const defaultSort = { value: { field: tableFields.lastModified, direction: 'desc' } };

const analysisContextMenuSize = 16;
const centerColumnFlex: CSSProperties = { flex: 5 };
const endColumnFlex: CSSProperties = {
  flex: '0 0 150px',
  display: 'flex',
  justifyContent: 'flex-left',
  whiteSpace: 'nowrap',
};

const AnalysisCardHeaders = ({ sort, onSort }) => {
  return div(
    {
      role: 'row',
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '1.5rem',
        paddingLeft: '1.5rem',
        marginBottom: '0.5rem',
      },
    },
    [
      div({ role: 'columnheader', 'aria-sort': ariaSort(sort, tableFields.application), style: { flex: 1 } }, [
        h(HeaderRenderer, { sort, onSort, name: tableFields.application }),
      ]),
      div({ role: 'columnheader', 'aria-sort': ariaSort(sort, tableFields.name), style: centerColumnFlex }, [
        h(HeaderRenderer, { sort, onSort, name: tableFields.name }),
      ]),
      div(
        {
          role: 'columnheader',
          'aria-sort': ariaSort(sort, tableFields.lastModified),
          style: { ...endColumnFlex, paddingRight: '1rem' },
        },
        [h(HeaderRenderer, { sort, onSort, name: tableFields.lastModified })]
      ),
      div({ role: 'columnheader', style: { flex: `0 0 ${analysisContextMenuSize}px` } }, [
        div({ className: 'sr-only' }, ['Actions']),
      ]),
    ]
  );
};

export interface AnalysisCardProps {
  currentRuntime?: Runtime;
  namespace: string;
  name: AbsolutePath;
  lastModified: number;
  metadata?: AnalysisFileMetadata;
  tool: ToolLabel;
  workspaceName: string;
  onRename: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onExport: () => void;
  canWrite: boolean;
  currentUserHash?: string;
  potentialLockers: any;
}

// TODO: move to separate file
const AnalysisCard = ({
  currentRuntime,
  namespace,
  name,
  lastModified,
  metadata,
  tool,
  workspaceName,
  onRename,
  onCopy,
  onDelete,
  onExport,
  canWrite,
  currentUserHash,
  potentialLockers,
}: AnalysisCardProps) => {
  const { lockExpiresAt, lastLockedBy } = metadata || {};
  const isLockExpired: boolean = lockExpiresAt ? new Date(parseInt(lockExpiresAt)).getTime() > Date.now() : false;
  // if there is a currentUserHash & lastLockedBy, they are not equal, and the lock isn't expired
  const isLocked: boolean =
    currentUserHash && lastLockedBy ? lastLockedBy !== currentUserHash && !isLockExpired : false;
  // TODO: Remove nested ternary to align with style guide
  // eslint-disable-next-line no-nested-ternary
  const lockedBy = lastLockedBy ? (potentialLockers ? potentialLockers[lastLockedBy] : null) : null;

  const analysisName: FileName = getFileName(name);
  const analysisLink = Nav.getLink(analysisLauncherTabName, { namespace, name: workspaceName, analysisName });

  const currentRuntimeToolLabel = currentRuntime ? getToolLabelFromCloudEnv(currentRuntime) : undefined;

  const rstudioLaunchLink = Nav.getLink(appLauncherTabName, { namespace, name, application: 'RStudio' });
  const analysisEditLink = `${analysisLink}/?${qs.stringify({ mode: 'edit' })}`;
  const analysisPlaygroundLink = `${analysisLink}/?${qs.stringify({ mode: 'playground' })}`;

  const analysisMenu = h(
    MenuTrigger,
    {
      'aria-label': 'Analysis menu',
      side: 'right',
      closeOnClick: true,
      content: h(Fragment, [
        h(
          MenuButton,
          {
            'aria-label': 'Preview',
            href: analysisLink,
            tooltip: canWrite ? 'Open without cloud compute' : undefined,
            tooltipSide: 'left',
          },
          [makeMenuIcon('eye'), 'Open preview']
        ),
        ...(tool === runtimeToolLabels.Jupyter
          ? [
              h(
                MenuButton,
                {
                  'aria-label': 'Edit',
                  href: analysisEditLink,
                  disabled: isLocked || !canWrite || currentRuntimeToolLabel === runtimeToolLabels.RStudio,
                  tooltip: Utils.cond(
                    [!canWrite, () => noWrite],
                    [
                      currentRuntimeToolLabel === runtimeToolLabels.RStudio,
                      () => 'You must have a runtime with Jupyter to edit.',
                    ]
                  ),
                  tooltipSide: 'left',
                },
                isLocked ? [makeMenuIcon('lock'), 'Open (In Use)'] : [makeMenuIcon('edit'), 'Edit']
              ),
              h(
                MenuButton,
                {
                  'aria-label': 'Playground',
                  href: analysisPlaygroundLink,
                  tooltip: canWrite ? 'Open in playground mode' : undefined,
                  tooltipSide: 'left',
                },
                [makeMenuIcon('chalkboard'), 'Playground']
              ),
            ]
          : [
              h(
                MenuButton,
                {
                  'aria-label': 'Launch',
                  href: rstudioLaunchLink,
                  disabled: !canWrite || currentRuntimeToolLabel === runtimeToolLabels.Jupyter,
                  tooltip: Utils.cond(
                    [!canWrite, () => noWrite],
                    [
                      currentRuntimeToolLabel === runtimeToolLabels.RStudio,
                      () => 'You must have a runtime with RStudio to launch.',
                    ]
                  ),
                  tooltipSide: 'left',
                },
                [makeMenuIcon('rocket'), 'Open']
              ),
            ]),
        h(
          MenuButton,
          {
            'aria-label': 'Copy',
            disabled: !canWrite,
            tooltip: !canWrite ? noWrite : undefined,
            tooltipSide: 'left',
            onClick: () => onCopy(),
          },
          [makeMenuIcon('copy'), 'Make a copy']
        ),
        h(
          MenuButton,
          {
            'aria-label': 'Export',
            onClick: () => onExport(),
          },
          [makeMenuIcon('export'), 'Copy to another workspace']
        ),
        h(
          MenuButton,
          {
            'aria-label': 'Copy',
            onClick: async () => {
              try {
                await clipboard.writeText(`${window.location.host}/${analysisLink}`);
                notify('success', 'Successfully copied URL to clipboard', { timeout: 3000 });
              } catch (error) {
                reportError('Error copying to clipboard', error);
              }
            },
          },
          [makeMenuIcon('copy-to-clipboard'), 'Copy analysis URL to clipboard']
        ),
        h(
          MenuButton,
          {
            'aria-label': 'Rename',
            disabled: !canWrite,
            tooltip: !canWrite ? noWrite : undefined,
            tooltipSide: 'left',
            onClick: () => onRename(),
          },
          [makeMenuIcon('renameIcon'), 'Rename']
        ),
        h(
          MenuButton,
          {
            'aria-label': 'Delete',
            disabled: !canWrite,
            tooltip: !canWrite ? noWrite : undefined,
            tooltipSide: 'left',
            onClick: () => onDelete(),
          },
          [makeMenuIcon('trash'), 'Delete']
        ),
      ]),
    },
    [
      h(Link, { 'aria-label': 'Analyses menu', onClick: (e) => e.preventDefault() }, [
        icon('ellipsis-v', {
          size: analysisContextMenuSize,
        }),
      ]),
    ]
  );

  const launchAnalysis = () => Nav.goToPath(analysisLauncherTabName, { namespace, name: workspaceName, analysisName });
  // the flex values for columns here correspond to the flex values in the header
  const artifactName = div(
    {
      title: getFileName(name),
      role: 'cell',
      style: {
        ...Style.elements.card.title,
        whiteSpace: 'normal',
        textAlign: 'left',
        cursor: 'pointer',
        ...centerColumnFlex,
      },
    },
    [h(Clickable, { onClick: launchAnalysis }, [getFileName(name)])]
  );

  const toolLogos: Record<RuntimeToolLabel, string> = {
    [runtimeToolLabels.Jupyter]: jupyterLogo,
    [runtimeToolLabels.RStudio]: rstudioSquareLogo,
    [runtimeToolLabels.JupyterLab]: jupyterLogo,
  };
  const toolIconSrc: string | undefined = toolLogos[tool];

  const toolContainer = div(
    { role: 'cell', style: { display: 'flex', flex: 1, flexDirection: 'row', alignItems: 'center' } },
    [
      img({ src: toolIconSrc, alt: '', style: { marginRight: '1rem', height: 40, width: 40 } }),
      // this is the tool name, i.e. 'Jupyter'. It is named identical to the header row to simplify the sorting code at the cost of naming consistency.
      tool,
    ]
  );

  return div(
    {
      role: 'row',
      style: _.merge(
        {
          ...Style.cardList.longCardShadowless,
        },
        { marginBottom: '.75rem', paddingLeft: '1.5rem' }
      ),
    },
    [
      toolContainer,
      artifactName,
      div({ role: 'cell', style: { ...endColumnFlex, flexDirection: 'row' } }, [
        div({ style: { flex: 1, display: 'flex' } }, [
          isLocked &&
            h(
              Clickable,
              {
                'aria-label': `${artifactName} artifact label`,
                style: { display: 'flex', paddingRight: '1rem', color: colors.dark(0.75) },
                tooltip: `This analysis is currently being edited by ${lockedBy || 'another user'}`,
              },
              [icon('lock')]
            ),
          h(TooltipTrigger, { content: formatDatetime(lastModified) }, [
            div({ style: { fontSize: '0.8rem', display: 'flex', alignItems: 'center', textAlign: 'left' } }, [
              Utils.makePrettyDate(lastModified),
            ]),
          ]),
        ]),
      ]),
      div({ role: 'cell', style: { marginLeft: '1rem' } }, [analysisMenu]),
    ]
  );
};

const activeFileTransferMessage = div(
  {
    style: _.merge(Style.elements.card.container, {
      backgroundColor: colors.warning(0.15),
      flexDirection: 'none',
      justifyContent: 'start',
      alignItems: 'center',
    }),
  },
  [
    icon('warning-standard', { size: 19, style: { color: colors.warning(), flex: 'none', marginRight: '1rem' } }),
    'Copying 1 or more interactive analysis files from another workspace.',
    span({ style: { fontWeight: 'bold', marginLeft: '0.5ch' } }, ['This may take a few minutes.']),
  ]
);

export const getUniqueFileName = (originalName: string, existingFileNames: FileName[]): FileName => {
  const name: FileName = originalName as FileName;
  let resolvedName: FileName = name;
  let c = 0;
  while (_.includes(resolvedName, existingFileNames)) {
    resolvedName = `${getDisplayName(name)}_${++c}.${getExtension(name)}` as FileName;
  }
  return resolvedName;
};

export type AnalysesData = AppDetails & CloudEnvironmentDetails;

export interface AnalysesProps {
  workspace: InitializedWorkspaceWrapper;
  analysesData: AnalysesData;
  onRequesterPaysError: () => void;
  storageDetails: StorageDetails;
}

export interface SortOrderInfo {
  field: string;
  direction: 'asc' | 'desc';
}

export const BaseAnalyses = (
  {
    workspace,
    analysesData: {
      apps,
      refreshApps,
      runtimes,
      refreshRuntimes,
      appDataDisks,
      persistentDisks,
      isLoadingCloudEnvironments,
    },
    storageDetails: { googleBucketLocation, azureContainerRegion },
    onRequesterPaysError,
  }: AnalysesProps,
  _ref: ForwardedRef<unknown>
) => {
  const [renamingAnalysisName, setRenamingAnalysisName] = useState<AbsolutePath>();
  const [copyingAnalysisName, setCopyingAnalysisName] = useState<AbsolutePath>();
  const [deletingAnalysisName, setDeletingAnalysisName] = useState<AbsolutePath>();
  const [exportingAnalysisName, setExportingAnalysisName] = useState<AbsolutePath>();
  const [sortOrder, setSortOrder] = useState<SortOrderInfo>(
    () => getLocalPref(KEY_ANALYSES_SORT_ORDER) || defaultSort.value
  );
  const [feedbackShowing, setFeedbackShowing] = useState(false);
  const [filter, setFilter] = useState(() => StateHistory.get().filter || '');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [analyses, setAnalyses] = useState<AnalysisFile[]>(() => StateHistory.get().analyses || undefined);
  const [currentUserHash, setCurrentUserHash] = useState<string>();
  const [potentialLockers, setPotentialLockers] = useState();
  const [activeFileTransfers, setActiveFileTransfers] = useState(false);
  const enableJupyterLabPersistenceId = `${workspace.workspace.namespace}/${workspace.workspace.name}/${ENABLE_JUPYTERLAB_ID}`;
  const [enableJupyterLabGCP, setEnableJupyterLabGCP] = useState<boolean>(
    () => getLocalPref(enableJupyterLabPersistenceId) || false
  );

  const {
    terraUser: { email },
  } = useStore(userStore);
  const signal = useCancellation();
  const analysisFileStore = useAnalysisFiles();
  const { loadedState, refreshFileStore, createAnalysis, deleteAnalysis } = analysisFileStore;
  const currentRuntime = getCurrentRuntime(runtimes);
  const location = Utils.cond(
    [isGoogleWorkspace(workspace), () => googleBucketLocation],
    [isAzureWorkspace(workspace), () => azureContainerRegion],
    () => null
  );

  const { accessLevel, workspace: workspaceInfo } = workspace;

  const refreshAnalyses: () => Promise<void> = withHandlers(
    [withRequesterPaysHandler(onRequesterPaysError) as any],
    refreshFileStore
  );

  const existingFileNames: FileName[] = _.map((analysis: AnalysisFile) => analysis.fileName, analyses);
  const uploadFiles: (files: File[]) => Promise<unknown> = _.flow(
    withErrorReporting('Error uploading files. Ensure the file has the proper extension'),
    Utils.withBusyState(setBusy)
  )(async (files: File[]) => {
    await Promise.all(
      _.map((file) => {
        const uniqueFileName = getUniqueFileName(file.name, existingFileNames);
        const toolLabel: ToolLabel = getToolLabelFromFileExtension(getExtension(file.name));
        return createAnalysis(uniqueFileName, toolLabel, file);
      }, files)
    );
  });

  // Lifecycle
  useEffect(() => {
    const load = _.flow(
      withErrorReporting('Error loading analyses'),
      Utils.withBusyState(setBusy)
    )(async () => {
      const [currentUserHash, potentialLockers]: [string | undefined, any] = isGoogleWorkspace(workspace)
        ? await Promise.all([
            // non-null assertion since a user must be logged in to see this page
            notebookLockHash(workspace.workspace.bucketName, email!),
            findPotentialNotebookLockers(workspace),
          ])
        : await Promise.all([Promise.resolve(undefined), Promise.resolve([])]);

      setCurrentUserHash(currentUserHash);
      setPotentialLockers(potentialLockers);

      const fileTransfers: any[] = await Workspaces(signal)
        .workspace(workspaceInfo.namespace, workspaceInfo.name)
        .listActiveFileTransfers();
      setActiveFileTransfers(!_.isEmpty(fileTransfers));
    });
    if (workspace?.workspaceInitialized) {
      refreshAnalyses(); // Load Analyses by default
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, workspaceInfo.name, workspaceInfo.namespace]);

  // We reference the analyses from `useAnalysisStore`, and on change, we decorate them from `AnalysisFile[]` to `DisplayAnalysisFile[]` and update state history
  useEffect(() => {
    const rawAnalyses: AnalysisFile[] =
      loadedState.status !== 'None' && loadedState.state !== null ? loadedState.state : [];
    const sortedAnalyses = _.reverse(_.sortBy(tableFields.lastModified, rawAnalyses));
    setAnalyses(sortedAnalyses);
    StateHistory.update({ analyses: sortedAnalyses, sortOrder, filter });
  }, [loadedState.status, sortOrder, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const previewJupyterLabMessage = div(
    {
      style: _.merge(Style.elements.card.container, {
        backgroundColor: colors.success(0.15),
        flexDirection: 'none',
        alignItems: 'center',
      }),
    },
    [
      div({ style: { display: 'flex', flexWrap: 'wrap', whiteSpace: 'pre-wrap', alignItems: 'center' } }, [
        icon('talk-bubble', { size: 19, style: { color: colors.warning(), marginRight: '1rem' } }),
        'JupyterLab is now available in this workspace as a beta feature. Please ',
        h(
          Link,
          {
            style: { color: colors.accent(1.25) },
            onClick: () => setFeedbackShowing(true),
          },
          ['fill out our survey']
        ),
        ' to help us improve the JupyterLab experience.',
      ]),
      div({ style: { display: 'flex' } }, [
        h(IdContainer, [
          (id) =>
            h(Fragment, [
              div(
                {
                  style: { display: 'flex', alignItems: 'center' },
                },
                [
                  label({ htmlFor: id, style: { fontWeight: 'bold', margin: '0 0.5rem', whiteSpace: 'nowrap' } }, [
                    'Enable JupyterLab',
                  ]),
                  h(Switch, {
                    onLabel: '',
                    offLabel: '',
                    onChange: (value) => {
                      setEnableJupyterLabGCP(value);
                      setLocalPref(enableJupyterLabPersistenceId, value);
                      Metrics().captureEvent(Events.analysisToggleJupyterLabGCP, {
                        ...extractWorkspaceDetails(workspaceInfo),
                        enabled: value,
                      });
                    },
                    id,
                    checked: enableJupyterLabGCP,
                    width: 40,
                    height: 20,
                  }),
                ]
              ),
            ]),
        ]),
      ]),
    ]
  );

  const noAnalysisBanner = div([
    div({ style: { fontSize: 48 } }, ['A place for all your analyses ']),
    div(
      {
        style: {
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-evenly',
          alignItems: 'center',
          columnGap: '5rem',
        },
      },
      _.dropRight(isGoogleWorkspaceInfo(workspaceInfo) ? 0 : 2, [
        img({ src: jupyterLogo, style: { height: 120, width: 80 }, alt: 'Jupyter' }),
        img({ src: rstudioBioLogo, style: { width: 400 }, alt: 'RStudio Bioconductor' }),
        img({ src: galaxyLogo, style: { height: 60, width: 208 }, alt: 'Galaxy' }),
      ])
    ),
    div({ style: { marginTop: '1rem', fontSize: 20 } }, ['Click the button above to create an analysis.']),
  ]);

  // Render helpers
  const renderAnalyses = () => {
    const { field, direction } = sortOrder;

    const filteredAnalyses: AnalysisFile[] = _.filter(
      (analysisFile: AnalysisFile) => Utils.textMatch(filter, getFileName(analysisFile.name)),
      analyses
    );
    // Lodash does not have a well-typed return on this function and there are not any nice alternatives, so expect error for now
    // @ts-expect-error
    const sortedAnalyses: AnalysisFile[] = _.orderBy(sortTokens[field] || field, direction, filteredAnalyses);
    const canWriteWithCurrentAccessLevel = canWrite(accessLevel);
    const analysisCards = _.map(
      ({ name, lastModified, metadata, tool }) =>
        h(AnalysisCard, {
          key: name,
          role: 'rowgroup',
          currentRuntime,
          name,
          lastModified,
          metadata,
          tool,
          namespace: workspaceInfo.namespace,
          workspaceName: workspaceInfo.name,
          canWrite: canWriteWithCurrentAccessLevel,
          currentUserHash,
          potentialLockers,
          onRename: () => setRenamingAnalysisName(name),
          onCopy: () => setCopyingAnalysisName(name),
          onExport: () => setExportingAnalysisName(name),
          onDelete: () => setDeletingAnalysisName(name),
        }),
      sortedAnalyses
    );

    const basePageStyles: CSSProperties = _.isEmpty(analyses)
      ? { alignItems: 'center', height: '80%' }
      : { flexDirection: 'column' };
    return div(
      {
        style: {
          ..._.merge(
            { textAlign: 'center', display: 'flex', justifyContent: 'center', padding: '0 1rem 0 1rem' },
            basePageStyles
          ),
        },
      },
      [
        activeFileTransfers && activeFileTransferMessage,
        feedbackShowing &&
          h(FeaturePreviewFeedbackModal, {
            onDismiss: () => setFeedbackShowing(false),
            onSuccess: () => {
              setFeedbackShowing(false);
            },
            featureName: 'JupyterLab',
            formId: '1FAIpQLScgSqTwp6e2AaVcwkd8mcgseijUjBmRqT7DIyQNjdwz8IT-EA',
            feedbackId: 'entry.760196566',
            contactEmailId: 'entry.11317098',
            sourcePageId: 'entry.1141779347',
            primaryQuestion: 'Please tell us about your experience using JupyterLab',
            sourcePage: 'Analyses List',
          }),
        // Show the JupyterLab preview message only for GCP workspaces, because it's already the default for Azure workspaces
        // It's currently hidden behind a feature preview flag until the supporting documentation/blog post are ready
        isFeaturePreviewEnabled(JUPYTERLAB_GCP_FEATURE_ID) &&
          !_.isEmpty(analyses) &&
          isGoogleWorkspace(workspace) &&
          previewJupyterLabMessage,
        Utils.cond(
          [_.isEmpty(analyses), () => noAnalysisBanner],
          [
            !_.isEmpty(analyses) && _.isEmpty(analysisCards),
            () => {
              return div({ style: { fontStyle: 'italic' } }, ['No matching analyses']);
            },
          ],
          [
            Utils.DEFAULT,
            () =>
              div({ role: 'table', 'aria-label': 'analyses' }, [
                h(AnalysisCardHeaders, {
                  sort: sortOrder,
                  onSort: (newSortOrder) => {
                    setLocalPref(KEY_ANALYSES_SORT_ORDER, newSortOrder);
                    setSortOrder(newSortOrder);
                  },
                }),
                analysisCards,
              ]),
          ]
        ),
      ]
    );
  };

  // Render
  return h(
    Dropzone,
    {
      accept: `.${runtimeTools.Jupyter.ext.join(', .')}, .${runtimeTools.RStudio.ext.join(', .')}`,
      disabled: !canWrite(accessLevel),
      style: { flexGrow: 1, backgroundColor: colors.light(), height: '100%' },
      activeStyle: { backgroundColor: colors.accent(0.2), cursor: 'copy' },
      onDropRejected: () =>
        reportError(
          'Not a valid analysis file',
          `The selected file is not one of the supported types: .${runtimeTools.Jupyter.ext.join(
            ', .'
          )}, .${runtimeTools.RStudio.ext.join(', .')}. Ensure your file has the proper extension.`
        ),
      onDropAccepted: uploadFiles,
    },
    [
      ({ openUploader }) =>
        h(Fragment, [
          analyses &&
            h(PageBox, { style: { height: '100%', margin: '0px', padding: '3rem' } }, [
              div({ style: { display: 'flex', marginBottom: '1rem' } }, [
                div({ style: { color: colors.dark(), fontSize: 24, fontWeight: 600 } }, ['Your Analyses']),
                h(
                  ButtonOutline,
                  {
                    style: { marginLeft: '1.5rem' },
                    onClick: () => setCreating(true),
                    disabled: !canWrite(accessLevel),
                    tooltip: !canWrite(accessLevel) ? noWrite : undefined,
                  },
                  [
                    icon('plus', { size: 14, style: { color: colors.accent() } }),
                    div({ style: { marginLeft: '0.5rem' } }, ['Start']),
                  ]
                ),
                div({ style: { flex: 1 } }),
                !_.isEmpty(analyses) &&
                  h(DelayedSearchInput, {
                    'aria-label': 'Search analyses',
                    style: { marginRight: '0.75rem', width: 220 },
                    placeholder: 'Search analyses',
                    onChange: setFilter,
                    value: filter,
                  }),
                h(AnalysisModal, {
                  isOpen: creating,
                  workspace,
                  runtimes,
                  persistentDisks,
                  refreshRuntimes,
                  isLoadingCloudEnvironments,
                  appDataDisks,
                  refreshAnalyses,
                  analyses,
                  apps,
                  refreshApps,
                  uploadFiles,
                  openUploader,
                  location,
                  onDismiss: () => {
                    setCreating(false);
                  },
                  onError: () => {
                    setCreating(false);
                    refreshRuntimes();
                    refreshApps();
                  },
                  onSuccess: () => {
                    setCreating(false);
                    refreshRuntimes();
                    refreshApps();
                  },
                  analysisFileStore,
                }),
                renamingAnalysisName &&
                  h(AnalysisDuplicator, {
                    printName: getFileName(renamingAnalysisName),
                    toolLabel: getToolLabelFromFileExtension(getExtension(renamingAnalysisName)),
                    workspaceInfo,
                    destroyOld: true,
                    fromLauncher: false,
                    onDismiss: () => {
                      setRenamingAnalysisName(undefined);
                      refreshAnalyses();
                    },
                    onSuccess: () => setRenamingAnalysisName(undefined),
                  }),
                copyingAnalysisName &&
                  h(AnalysisDuplicator, {
                    printName: getFileName(copyingAnalysisName),
                    toolLabel: getToolLabelFromFileExtension(getExtension(copyingAnalysisName)),
                    workspaceInfo,
                    destroyOld: false,
                    fromLauncher: false,
                    onDismiss: () => setCopyingAnalysisName(undefined),
                    onSuccess: () => {
                      setCopyingAnalysisName(undefined);
                      refreshAnalyses();
                    },
                  }),
                exportingAnalysisName &&
                  h(ExportAnalysisModal, {
                    fromLauncher: false,
                    printName: getFileName(exportingAnalysisName),
                    toolLabel: getToolLabelFromFileExtension(getExtension(exportingAnalysisName)),
                    workspace,
                    onDismiss: () => setExportingAnalysisName(undefined),
                  }),
                deletingAnalysisName &&
                  h(DeleteConfirmationModal, {
                    objectType: getToolLabelFromFileExtension(getExtension(deletingAnalysisName))
                      ? `${getToolLabelFromFileExtension(getExtension(deletingAnalysisName))} analysis`
                      : 'analysis',
                    objectName: getFileName(deletingAnalysisName),
                    buttonText: 'Delete analysis',
                    onConfirm: _.flow(
                      Utils.withBusyState(setBusy),
                      withErrorReporting('Error deleting analysis.')
                    )(async () => {
                      setDeletingAnalysisName(undefined);
                      await deleteAnalysis(deletingAnalysisName);
                    }),
                    onDismiss: () => setDeletingAnalysisName(undefined),
                  }),
              ]),
              isAzureWorkspace(workspace) &&
                div({ style: { marginBottom: '1rem' } }, [
                  h(
                    Link,
                    {
                      ...Utils.newTabLinkProps,
                      href: 'https://support.terra.bio/hc/en-us/articles/22950635210395-Add-Python-3-10-to-access-DRS-URIs-in-JupyterLab',
                    },
                    [
                      'See instructions for accessing DRS URIs in JupyterLab',
                      icon('pop-out', { style: { marginLeft: '1ch' } }),
                    ]
                  ),
                ]),
              renderAnalyses(),
            ]),
          (loadedState.status === 'Loading' || busy) && spinnerOverlay,
        ]),
    ]
  );
};

const Analyses = _.flow(
  forwardRefWithName('Analyses'),
  requesterPaysWrapper({
    onDismiss: () => Nav.history.goBack(),
  }),
  wrapWorkspace({
    breadcrumbs: (props) => breadcrumbs.commonPaths.workspaceDashboard(props),
    title: 'Analyses',
    activeTab: 'analyses',
  }),
  withViewToggle('analysesTab')
)(BaseAnalyses);

export const navPaths = [
  {
    name: analysisTabName,
    path: '/workspaces/:namespace/:name/analyses',
    component: Analyses,
    title: ({ name }) => `${name} - Analysis`,
  },
];
