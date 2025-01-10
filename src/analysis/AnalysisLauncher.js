import { Modal } from '@terra-ui-packages/components';
import { atom } from '@terra-ui-packages/core-utils';
import * as clipboard from 'clipboard-polyfill/text';
import _ from 'lodash/fp';
import * as qs from 'qs';
import { Fragment, useRef, useState } from 'react';
import { b, div, h, iframe, p, span } from 'react-hyperscript-helpers';
import { AnalysisDuplicator } from 'src/analysis/modals/AnalysisDuplicator';
import { GcpComputeModal } from 'src/analysis/modals/ComputeModal/GcpComputeModal/GcpComputeModal';
import ExportAnalysisModal from 'src/analysis/modals/ExportAnalysisModal/ExportAnalysisModal';
import { ApplicationHeader, PlaygroundHeader, RuntimeKicker, RuntimeStatusMonitor, StatusMessage } from 'src/analysis/runtime-common-components';
import { analysisLauncherTabName, analysisTabName, appLauncherTabName, appLauncherWithAnalysisTabName } from 'src/analysis/runtime-common-text';
import { getCurrentPersistentDisk } from 'src/analysis/utils/disk-utils';
import { getExtension, getFileName, notebookLockHash } from 'src/analysis/utils/file-utils';
import { dataSyncingDocUrl } from 'src/analysis/utils/gce-machines';
import { findPotentialNotebookLockers } from 'src/analysis/utils/notebook-lockers';
import { getConvertedRuntimeStatus, getCurrentRuntime, usableStatuses } from 'src/analysis/utils/runtime-utils';
import { getPatternFromRuntimeTool, getToolLabelFromCloudEnv, getToolLabelFromFileExtension, runtimeToolLabels } from 'src/analysis/utils/tool-utils';
import * as breadcrumbs from 'src/components/breadcrumbs';
import { ButtonPrimary, ButtonSecondary, Clickable, LabeledCheckbox, Link, spinnerOverlay } from 'src/components/common';
import { icon } from 'src/components/icons';
import { MenuButton } from 'src/components/MenuButton';
import { makeMenuIcon, MenuTrigger } from 'src/components/PopupTrigger';
import { AzureStorage } from 'src/libs/ajax/AzureStorage';
import { GoogleStorage } from 'src/libs/ajax/GoogleStorage';
import { Runtimes } from 'src/libs/ajax/leonardo/Runtimes';
import { Metrics } from 'src/libs/ajax/Metrics';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import Events from 'src/libs/events';
import { ENABLE_JUPYTERLAB_ID } from 'src/libs/feature-previews-config';
import * as Nav from 'src/libs/nav';
import { notify } from 'src/libs/notifications';
import { getLocalPref, setLocalPref } from 'src/libs/prefs';
import { forwardRefWithName, useCancellation, useOnMount, useStore } from 'src/libs/react-utils';
import { cookieReadyStore, userStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { requesterPaysWrapper, withRequesterPaysHandler } from 'src/workspaces/common/requester-pays/bucket-utils';
import { wrapWorkspace } from 'src/workspaces/container/WorkspaceContainer';
import { canWrite, cloudProviderTypes, getCloudProviderFromWorkspace } from 'src/workspaces/utils';

import { AzureComputeModal } from './modals/ComputeModal/AzureComputeModal/AzureComputeModal';

const chooseMode = (mode) => {
  Nav.history.replace({ search: qs.stringify({ mode }) });
};

// The analysis launcher is the place the user arrives when they click a file, and is in charge of preview and redirecting to the app itself
// The analysis launcher links to the application launcher when the open button is clicked

const AnalysisLauncher = _.flow(
  forwardRefWithName('AnalysisLauncher'),
  requesterPaysWrapper({
    onDismiss: ({ namespace, name }) => Nav.goToPath('workspace-dashboard', { namespace, name }),
  }),
  wrapWorkspace({
    breadcrumbs: (props) => breadcrumbs.commonPaths.workspaceTab(props, 'analyses'),
    title: _.get('analysisName'),
    activeTab: analysisLauncherTabName,
  })
)(
  (
    {
      queryParams,
      analysisName,
      workspace,
      workspace: { accessLevel, canCompute },
      analysesData: { runtimes, refreshRuntimes, persistentDisks, isLoadingCloudEnvironments },
      storageDetails: { googleBucketLocation, azureContainerRegion },
    },
    _ref
  ) => {
    const [createOpen, setCreateOpen] = useState(false);
    const currentRuntime = getCurrentRuntime(runtimes);
    const currentDisk = getCurrentPersistentDisk(runtimes, persistentDisks);
    const { runtimeName, labels } = currentRuntime || {};
    const status = getConvertedRuntimeStatus(currentRuntime);
    const [busy, setBusy] = useState();
    const { mode } = queryParams;
    // note that here, the file tool is either Jupyter or RStudio, and cannot be azure (as .ipynb extensions are used for azure as well)
    // hence, currentRuntimeToolLabel is not always currentFileToolLabel
    const currentFileToolLabel = getToolLabelFromFileExtension(analysisName);
    const currentRuntimeToolLabel = getToolLabelFromCloudEnv(currentRuntime);
    const iframeStyles = { height: '100%', width: '100%' };
    const isAzureWorkspace = !!workspace.azureContext;

    useOnMount(() => {
      refreshRuntimes();
    });

    return h(Fragment, [
      div({ style: { flex: 1, display: 'flex' } }, [
        div({ style: { flex: 1 } }, [
          canWrite(accessLevel) && canCompute && !!mode && _.includes(status, usableStatuses) && currentRuntimeToolLabel === runtimeToolLabels.Jupyter
            ? h(labels?.welderInstallFailed ? WelderDisabledNotebookEditorFrame : AnalysisEditorFrame, {
                key: runtimeName,
                workspace,
                runtime: currentRuntime,
                analysisName,
                mode,
                toolLabel: currentFileToolLabel,
                styles: iframeStyles,
              })
            : h(Fragment, [
                h(PreviewHeader, {
                  styles: iframeStyles,
                  queryParams,
                  runtime: currentRuntime,
                  analysisName,
                  currentFileToolLabel,
                  workspace,
                  setCreateOpen,
                  refreshRuntimes,
                  isLoadingCloudEnvironments,
                  readOnlyAccess: !(canWrite(accessLevel) && canCompute),
                }),
                h(AnalysisPreviewFrame, { styles: iframeStyles, analysisName, toolLabel: currentFileToolLabel, workspace }),
              ]),
        ]),
        mode && h(RuntimeKicker, { runtime: currentRuntime, refreshRuntimes }),
        mode && h(RuntimeStatusMonitor, { runtime: currentRuntime }),
        h(GcpComputeModal, {
          isOpen: createOpen && !isAzureWorkspace,
          tool: currentFileToolLabel,
          shouldHideCloseButton: false,
          workspace,
          currentRuntime,
          currentDisk,
          location: googleBucketLocation,
          onDismiss: () => {
            chooseMode(undefined);
            setCreateOpen(false);
          },
          onSuccess: _.flow(
            withErrorReporting('Error creating cloud compute'),
            Utils.withBusyState(setBusy)
          )(async () => {
            setCreateOpen(false);
            await refreshRuntimes(true);
          }),
        }),
        h(AzureComputeModal, {
          isOpen: createOpen && isAzureWorkspace,
          hideCloseButton: true,
          workspace,
          runtimes,
          location: azureContainerRegion,
          onDismiss: () => {
            chooseMode(undefined);
            setCreateOpen(false);
          },
          onSuccess: _.flow(
            withErrorReporting('Error creating cloud compute'),
            Utils.withBusyState(setBusy)
          )(async () => {
            setCreateOpen(false);
            await refreshRuntimes(true);
          }),
          onError: () => {
            chooseMode(undefined);
            setCreateOpen(false);
          },
        }),
        (busy || isLoadingCloudEnvironments) && spinnerOverlay,
      ]),
    ]);
  }
);

const FileInUseModal = ({ onDismiss, onCopy, onPlayground, namespace, name, bucketName, lockedBy, canShare }) => {
  const [lockedByEmail, setLockedByEmail] = useState();

  useOnMount(() => {
    const findLockedByEmail = withErrorReporting('Error loading locker information')(async () => {
      const potentialLockers = await findPotentialNotebookLockers({ canShare, namespace, workspaceName: name, bucketName });
      const currentLocker = potentialLockers[lockedBy];
      setLockedByEmail(currentLocker);
    });
    findLockedByEmail();
  });

  return h(
    Modal,
    {
      width: 530,
      title: 'Notebook Is In Use',
      onDismiss,
      showButtons: false,
    },
    [
      p(
        lockedByEmail
          ? `This notebook is currently being edited by ${lockedByEmail}.`
          : 'This notebook is currently locked because another user is editing it.'
      ),
      p('You can make a copy, or run it in Playground Mode to explore and execute its contents without saving any changes.'),
      div({ style: { marginTop: '2rem' } }, [
        h(
          ButtonSecondary,
          {
            style: { padding: '0 1rem' },
            onClick: () => onDismiss(),
          },
          ['Cancel']
        ),
        h(
          ButtonSecondary,
          {
            style: { padding: '0 1rem' },
            onClick: () => onCopy(),
          },
          ['Make a copy']
        ),
        h(
          ButtonPrimary,
          {
            onClick: () => onPlayground(),
          },
          ['Run in playground mode']
        ),
      ]),
    ]
  );
};

const EditModeDisabledModal = ({ onDismiss, onRecreateRuntime, onPlayground }) => {
  return h(
    Modal,
    {
      width: 700,
      title: 'Cannot Edit Notebook',
      onDismiss,
      showButtons: false,
    },
    [
      p(
        'We’ve released important updates that are not compatible with the older cloud environment associated with this workspace. To enable Edit Mode, please delete your existing cloud environment and create a new cloud environment.'
      ),
      p(
        'If you have any files on your old cloud environment that you want to keep, you can access your old cloud environment using the Playground Mode option.'
      ),
      h(
        Link,
        {
          'aria-label': 'Data syncing doc',
          href: dataSyncingDocUrl,
          ...Utils.newTabLinkProps,
        },
        ['Read here for more details.']
      ),
      div({ style: { marginTop: '2rem' } }, [
        h(
          ButtonSecondary,
          {
            'aria-label': 'Launcher dismiss',
            style: { padding: '0 1rem' },
            onClick: () => onDismiss(),
          },
          ['Cancel']
        ),
        h(
          ButtonSecondary,
          {
            'aria-label': 'Launcher playground',
            style: { padding: '0 1rem', marginLeft: '1rem' },
            onClick: () => onPlayground(),
          },
          ['Run in playground mode']
        ),
        h(
          ButtonPrimary,
          {
            'aria-label': 'Launcher create',
            style: { padding: '0 1rem', marginLeft: '2rem' },
            onClick: () => onRecreateRuntime(),
          },
          ['Recreate cloud environment']
        ),
      ]),
    ]
  );
};

const PlaygroundModal = ({ onDismiss, onPlayground }) => {
  const [hidePlaygroundMessage, setHidePlaygroundMessage] = useState(false);
  return h(
    Modal,
    {
      width: 530,
      title: 'Playground Mode',
      onDismiss,
      okButton: h(
        ButtonPrimary,
        {
          onClick: () => {
            setLocalPref('hidePlaygroundMessage', hidePlaygroundMessage);
            onPlayground();
          },
        },
        'Continue'
      ),
    },
    [
      p(['Playground mode allows you to explore, change, and run the code, but your edits will not be saved.']),
      p([
        'To save your work, choose ',
        span({ style: { fontWeight: 600 } }, ['Download ']),
        'from the ',
        span({ style: { fontWeight: 600 } }, ['File ']),
        'menu.',
      ]),
      h(
        LabeledCheckbox,
        {
          checked: hidePlaygroundMessage,
          onChange: setHidePlaygroundMessage,
        },
        [span({ style: { marginLeft: '0.5rem' } }, ['Do not show again '])]
      ),
    ]
  );
};

const HeaderButton = ({ children, ...props }) =>
  h(
    ButtonSecondary,
    {
      'aria-label': 'analysis header button',
      style: { padding: '1rem', backgroundColor: colors.dark(0.1), height: '100%', marginRight: 2 },
      ...props,
    },
    [children]
  );

// This component is responsible for generating the preview/open header bar above the iframe content
const PreviewHeader = ({
  queryParams,
  runtime,
  readOnlyAccess,
  onCreateRuntime,
  analysisName,
  currentFileToolLabel,
  workspace,
  setCreateOpen,
  refreshRuntimes,
  workspace: {
    canShare,
    workspace: { cloudPlatform, namespace, name, bucketName, googleProject, workspaceId },
  },
}) => {
  const signal = useCancellation();
  const {
    terraUser: { email },
  } = useStore(userStore);
  const [fileInUseOpen, setFileInUseOpen] = useState(false);
  const [editModeDisabledOpen, setEditModeDisabledOpen] = useState(false);
  const [playgroundModalOpen, setPlaygroundModalOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState(null);
  const [exportingAnalysis, setExportingAnalysis] = useState(false);
  const [copyingAnalysis, setCopyingAnalysis] = useState(false);
  const runtimeStatus = getConvertedRuntimeStatus(runtime);
  const welderEnabled = runtime && !runtime.labels?.welderInstallFailed;
  const { mode } = queryParams;
  const analysisLink = Nav.getLink(analysisLauncherTabName, { namespace, name, analysisName });
  const isAzureWorkspace = !!workspace.azureContext;
  const isGcpWorkspace = !!workspace.workspace.googleProject;
  const currentRuntimeToolLabel = getToolLabelFromCloudEnv(runtime);
  const enableJupyterLabPersistenceId = `${namespace}/${name}/${ENABLE_JUPYTERLAB_ID}`;
  const [enableJupyterLabGCP] = useState(() => getLocalPref(enableJupyterLabPersistenceId) || false);

  const checkIfLocked = withErrorReporting('Error checking analysis lock status')(async () => {
    const { metadata: { lastLockedBy, lockExpiresAt } = {} } = await GoogleStorage(signal)
      .analysis(googleProject, bucketName, getFileName(analysisName), currentFileToolLabel)
      .getObject();
    const hashedUser = await notebookLockHash(bucketName, email);
    const lockExpirationDate = new Date(parseInt(lockExpiresAt));

    if (lastLockedBy && lastLockedBy !== hashedUser && lockExpirationDate > Date.now()) {
      setLocked(true);
      setLockedBy(lastLockedBy);
    }
  });

  const startAndRefresh = withErrorReporting('Error starting compute')(async (refreshRuntimes, runtime) => {
    await Runtimes().runtimeWrapper(runtime).start();
    await refreshRuntimes(true);
  });

  useOnMount(() => {
    if (googleProject) {
      checkIfLocked();
    }
  });

  const openMenuIcon = [makeMenuIcon('rocket'), 'Open'];

  const createNewRuntimeOpenButton = h(
    HeaderButton,
    {
      onClick: () => setCreateOpen(true),
    },
    openMenuIcon
  );

  const editModeButton = h(HeaderButton, { onClick: () => chooseMode('edit') }, openMenuIcon);

  const isJupyterLabGCP = currentFileToolLabel === runtimeToolLabels.Jupyter && enableJupyterLabGCP;

  return h(
    ApplicationHeader,
    {
      label: 'PREVIEW (READ-ONLY)',
      labelBgColor: colors.dark(0.2),
    },
    [
      // App-specific controls
      Utils.cond(
        [readOnlyAccess, () => h(HeaderButton, { onClick: () => setExportingAnalysis(true) }, [makeMenuIcon('export'), 'Copy to another workspace'])],
        [!runtime, () => createNewRuntimeOpenButton],
        [
          runtimeStatus === 'Stopped',
          () =>
            h(
              HeaderButton,
              {
                onClick: () => startAndRefresh(refreshRuntimes, runtime),
              },
              openMenuIcon
            ),
        ],
        // This is a special case for JupyterLab on GCP. Under the hood, the app running on the runtime is Jupyter, but
        // we instead proxy to JupyterLab. For JupyterLab GCP, it's important to disable playground mode and not lock
        // any notebooks. We also need to keep the edit mode directory in line with what Jupyter uses, because users
        // can easily switch back and forth. This prevents users from having notebooks scattered across multiple directories.
        [
          isJupyterLabGCP && _.includes(runtimeStatus, usableStatuses) && currentFileToolLabel === runtimeToolLabels.Jupyter,
          () =>
            h(
              HeaderButton,
              {
                onClick: () => {
                  Nav.goToPath(appLauncherWithAnalysisTabName, {
                    namespace,
                    name,
                    application: runtimeToolLabels.JupyterLab,
                    cloudPlatform,
                    analysisName,
                  });
                },
              },
              openMenuIcon
            ),
        ],
        [
          isAzureWorkspace && _.includes(runtimeStatus, usableStatuses) && currentFileToolLabel === runtimeToolLabels.Jupyter,
          () =>
            h(
              HeaderButton,
              {
                onClick: () => {
                  Nav.goToPath(appLauncherWithAnalysisTabName, {
                    namespace,
                    name,
                    application: runtimeToolLabels.JupyterLab,
                    cloudPlatform,
                    analysisName,
                  });
                },
              },
              openMenuIcon
            ),
        ],
        [isAzureWorkspace && runtimeStatus !== 'Running', () => {}],
        // Azure logic must come before this branch, as currentRuntimeToolLabel !== currentFileToolLabel for azure.

        [currentRuntimeToolLabel !== currentFileToolLabel, () => createNewRuntimeOpenButton],
        // If the tool is RStudio and we are in this branch, we need to either start an existing runtime or launch the app
        // Worth mentioning that the Stopped branch will launch RStudio, and then we depend on the AnalysisNotificationManager to prompt user the app is ready to launch
        // Then open can be clicked again
        [
          currentFileToolLabel === runtimeToolLabels.RStudio && _.includes(runtimeStatus, ['Running', null]),
          () =>
            h(
              HeaderButton,
              {
                onClick: () => {
                  if (runtimeStatus === 'Running') {
                    Nav.goToPath(appLauncherTabName, { namespace, name, application: 'RStudio', cloudPlatform });
                    Metrics().captureEvent(Events.analysisLaunch, {
                      origin: 'analysisLauncher',
                      tool: runtimeToolLabels.RStudio,
                      workspaceName: name,
                      namespace,
                      cloudPlatform,
                    });
                  }
                },
              },
              openMenuIcon
            ),
        ],
        // Jupyter is slightly different since it interacts with editMode and playground mode flags as well. This is not applicable to JupyterLab in either cloud
        [
          (currentRuntimeToolLabel === runtimeToolLabels.Jupyter && !mode) || [null, 'Stopped'].includes(runtimeStatus),
          () =>
            h(Fragment, [
              Utils.cond(
                [
                  runtime && !welderEnabled,
                  () => h(HeaderButton, { onClick: () => setEditModeDisabledOpen(true) }, [makeMenuIcon('warning-standard'), 'Open (Disabled)']),
                ],
                [locked, () => h(HeaderButton, { onClick: () => setFileInUseOpen(true) }, [makeMenuIcon('lock'), 'Open (In use)'])],
                () => editModeButton
              ),
              h(
                HeaderButton,
                {
                  onClick: () => (getLocalPref('hidePlaygroundMessage') ? chooseMode('playground') : setPlaygroundModalOpen(true)),
                },
                [makeMenuIcon('chalkboard'), 'Playground mode']
              ),
            ]),
        ]
      ),
      // Workspace-level options
      h(
        MenuTrigger,
        {
          closeOnClick: true,
          content: h(Fragment, [
            h(MenuButton, { 'aria-label': 'Copy analysis', onClick: () => setCopyingAnalysis(true) }, ['Make a Copy']),
            h(MenuButton, { onClick: () => setExportingAnalysis(true) }, ['Copy to another workspace']),
            h(
              MenuButton,
              {
                onClick: withErrorReporting('Error copying to clipboard')(async () => {
                  await clipboard.writeText(`${window.location.host}/${analysisLink}`);
                  notify('success', 'Successfully copied URL to clipboard', { timeout: 3000 });
                }),
              },
              ['Copy URL to clipboard']
            ),
          ]),
          side: 'bottom',
        },
        [h(HeaderButton, {}, [icon('ellipsis-v')])]
      ),
      // Status specific messaging which is not specific to an app
      Utils.cond(
        [_.includes(runtimeStatus, usableStatuses), () => h(StatusMessage, { hideSpinner: true }, ['Cloud environment is ready.'])],
        [
          runtimeStatus === 'Creating' && isAzureWorkspace,
          () => h(StatusMessage, ['Creating cloud environment. You can navigate away, this may take up to 10 minutes.']),
        ],
        [
          runtimeStatus === 'Creating' && isGcpWorkspace,
          () => h(StatusMessage, ['Creating cloud environment. You can navigate away and return in 3-5 minutes.']),
        ],
        [runtimeStatus === 'Starting', () => h(StatusMessage, ['Starting cloud environment, this may take up to 2 minutes.'])],
        [
          runtimeStatus === 'Stopping',
          () => h(StatusMessage, ['Cloud environment is stopping, which takes ~4 minutes. It will restart after this finishes.']),
        ],
        [runtimeStatus === 'LeoReconfiguring', () => h(StatusMessage, ['Cloud environment is updating, please wait.'])],
        [runtimeStatus === 'Error', () => h(StatusMessage, { hideSpinner: true }, ['Cloud environment error.'])]
      ),
      div({ style: { flexGrow: 1 } }),
      div({ style: { position: 'relative' } }, [
        h(
          Clickable,
          {
            'aria-label': 'Exit preview mode',
            style: { opacity: 0.65, marginRight: '1.5rem' },
            hover: { opacity: 1 },
            focus: 'hover',
            onClick: () => Nav.goToPath(analysisTabName, { namespace, name }),
          },
          [icon('times-circle', { size: 30 })]
        ),
      ]),
      editModeDisabledOpen &&
        h(EditModeDisabledModal, {
          onDismiss: () => setEditModeDisabledOpen(false),
          onRecreateRuntime: () => {
            setEditModeDisabledOpen(false);
            onCreateRuntime();
          },
          onPlayground: () => {
            setEditModeDisabledOpen(false);
            chooseMode('playground');
          },
        }),
      fileInUseOpen &&
        h(FileInUseModal, {
          namespace,
          name,
          lockedBy,
          canShare,
          bucketName,
          onDismiss: () => setFileInUseOpen(false),
          onCopy: () => {
            setFileInUseOpen(false);
            setCopyingAnalysis(true);
          },
          onPlayground: () => {
            setFileInUseOpen(false);
            chooseMode('playground');
          },
        }),
      copyingAnalysis &&
        h(AnalysisDuplicator, {
          printName: getFileName(analysisName),
          toolLabel: getToolLabelFromFileExtension(analysisName),
          fromLauncher: true,
          workspaceInfo: { cloudPlatform, name, googleProject, workspaceId, namespace, bucketName },
          destroyOld: false,
          onDismiss: () => setCopyingAnalysis(false),
          onSuccess: () => setCopyingAnalysis(false),
        }),
      exportingAnalysis &&
        h(ExportAnalysisModal, {
          printName: getFileName(analysisName),
          toolLabel: getToolLabelFromFileExtension(analysisName),
          workspace,
          fromLauncher: true,
          onDismiss: () => setExportingAnalysis(false),
        }),
      playgroundModalOpen &&
        h(PlaygroundModal, {
          onDismiss: () => setPlaygroundModalOpen(false),
          onPlayground: () => {
            setPlaygroundModalOpen(false);
            chooseMode('playground');
          },
        }),
    ]
  );
};

// This component is responsible for rendering the html preview of the analysis file
const AnalysisPreviewFrame = ({ analysisName, toolLabel, workspace, onRequesterPaysError, styles }) => {
  const signal = useCancellation();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState();
  const frame = useRef();
  const cloudPlatform = getCloudProviderFromWorkspace(workspace);
  const {
    workspace: { workspaceId, googleProject, bucketName },
  } = workspace;

  const loadPreview = _.flow(
    Utils.withBusyState(setBusy),
    withRequesterPaysHandler(onRequesterPaysError),
    withErrorReporting('Error previewing analysis')
  )(async () => {
    // TODO: Tracked in IA-4015. This implementation is not ideal. Introduce Error typing to better resolve the response.
    const response =
      cloudPlatform === cloudProviderTypes.GCP
        ? await GoogleStorage(signal).analysis(googleProject, bucketName, analysisName, toolLabel).preview()
        : await AzureStorage(signal).blob(workspaceId, analysisName).preview();

    if (response.status === 200) {
      Metrics().captureEvent(Events.analysisPreviewSuccess, { fileName: analysisName, fileType: getExtension(analysisName), cloudPlatform });
    } else {
      Metrics().captureEvent(Events.analysisPreviewFail, { fileName: analysisName, fileType: getExtension(analysisName), cloudPlatform });
    }
    const previewHtml = await response.text();
    setPreview(previewHtml);
  });
  useOnMount(() => {
    loadPreview();
  });

  return h(Fragment, [
    preview &&
      h(Fragment, [
        iframe({
          ref: frame,
          onLoad: () => {
            const doc = frame.current.contentWindow.document;
            doc.head.appendChild(Utils.createHtmlElement(doc, 'base', Utils.newTabLinkProps));
            doc.addEventListener('mousedown', () => window.document.dispatchEvent(new MouseEvent('mousedown')));
          },
          style: { border: 'none', flex: 1, ...styles },
          srcDoc: preview,
          title: 'Preview for analysis',
        }),
      ]),
    busy && div({ style: { margin: '0.5rem 2rem' } }, ['Generating preview...']),
  ]);
};

// This is the purely functional component
// It is in charge of ensuring that navigating away from the Jupyter iframe results in a save via a custom extension located in `jupyter-iframe-extension`
// See this ticket for RStudio impl discussion: https://broadworkbench.atlassian.net/browse/IA-2947
function JupyterFrameManager({ onClose, frameRef, details = {} }) {
  useOnMount(() => {
    Metrics().captureEvent(Events.cloudEnvironmentLaunch, {
      tool: runtimeToolLabels.Jupyter,
      application: runtimeToolLabels.Jupyter,
      workspaceName: details.name,
      namespace: details.namespace,
      cloudPlatform: details.cloudPlatform,
    });

    const isSaved = atom(true);
    const onMessage = (e) => {
      switch (e.data) {
        case 'close':
          return onClose();
        case 'saved':
          return isSaved.set(true);
        case 'dirty':
          return isSaved.set(false);
        default:
      }
    };
    const saveNotebook = () => {
      frameRef.current.contentWindow.postMessage('save', '*');
    };
    const onBeforeUnload = (e) => {
      if (!isSaved.get()) {
        saveNotebook();
        e.preventDefault();
      }
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('beforeunload', onBeforeUnload);
    Nav.blockNav.set(
      () =>
        new Promise((resolve) => {
          if (isSaved.get()) {
            resolve();
          } else {
            saveNotebook();
            isSaved.subscribe(resolve);
          }
        })
    );
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('beforeunload', onBeforeUnload);
      Nav.blockNav.reset();
    };
  });
  return null;
}

const copyingAnalysisMessage = div({ style: { paddingTop: '2rem' } }, [h(StatusMessage, ['Copying analysis to cloud environment, almost ready...'])]);

const AnalysisEditorFrame = ({ styles, mode, analysisName, toolLabel, workspace, runtime: { runtimeName, proxyUrl, status, labels } }) => {
  console.assert(_.includes(status, usableStatuses), `Expected cloud environment to be one of: [${usableStatuses}]`);
  console.assert(!labels.welderInstallFailed, 'Expected cloud environment to have Welder');
  const frameRef = useRef();
  const [busy, setBusy] = useState(false);
  const [analysisSetupComplete, setAnalysisSetupComplete] = useState(false);
  const cookieReady = useStore(cookieReadyStore);
  const cloudPlatform = getCloudProviderFromWorkspace(workspace);
  const {
    workspace: { googleProject, namespace, name, bucketName },
  } = workspace;

  const localBaseDirectory = Utils.switchCase(
    toolLabel,
    [runtimeToolLabels.Jupyter, () => `${name}/edit`],
    [runtimeToolLabels.JupyterLab, () => `${name}/edit`],
    [runtimeToolLabels.RStudio, () => '']
  );

  const localSafeModeBaseDirectory = Utils.switchCase(
    toolLabel,
    [runtimeToolLabels.Jupyter, () => `${name}/safe`],
    [runtimeToolLabels.JupyterLab, () => `${name}/safe`],
    [runtimeToolLabels.RStudio, () => '']
  );

  useOnMount(() => {
    const cloudStorageDirectory = `gs://${bucketName}/notebooks`;
    const setUpAnalysis = _.flow(
      Utils.withBusyState(setBusy),
      withErrorReporting('Error setting up analysis')
    )(async () => {
      await Runtimes()
        .fileSyncing(googleProject, runtimeName)
        .setStorageLinks(localBaseDirectory, localSafeModeBaseDirectory, cloudStorageDirectory, getPatternFromRuntimeTool(toolLabel));

      if (mode === 'edit' && !(await Runtimes().fileSyncing(googleProject, runtimeName).lock(`${localBaseDirectory}/${analysisName}`))) {
        notify('error', 'Unable to Edit Analysis', {
          message: 'Another user is currently editing this analysis. You can run it in Playground Mode or make a copy.',
        });
        chooseMode(undefined);
      } else {
        await Runtimes()
          .fileSyncing(googleProject, runtimeName)
          .localize([
            {
              sourceUri: `${cloudStorageDirectory}/${analysisName}`,
              localDestinationPath: mode === 'edit' ? `${localBaseDirectory}/${analysisName}` : `${localSafeModeBaseDirectory}/${analysisName}`,
            },
          ]);
        setAnalysisSetupComplete(true);
      }
    });

    setUpAnalysis();
  });

  return h(Fragment, [
    analysisSetupComplete &&
      cookieReady &&
      h(Fragment, [
        iframe({
          id: 'analysis-iframe',
          src: `${proxyUrl}/notebooks/${mode === 'edit' ? localBaseDirectory : localSafeModeBaseDirectory}/${analysisName}`,
          style: { border: 'none', flex: 1, ...styles },
          ref: frameRef,
        }),
        h(JupyterFrameManager, {
          frameRef,
          onClose: () => Nav.goToPath(analysisTabName, { namespace, name }),
          details: { analysisName, name, namespace, cloudPlatform },
        }),
      ]),
    busy && copyingAnalysisMessage,
  ]);
};

// TODO: this originally was designed to handle VMs that didn't have welder deployed on them
// do we need this anymore? (can be queried in prod DB to see if there are any VMs with welderEnabled=false with a `recent` dateAccessed
// do we need to support this for rstudio? I don't think so because welder predates RStudio support, but not 100%
const WelderDisabledNotebookEditorFrame = ({ styles, mode, notebookName, workspace, runtime: { runtimeName, proxyUrl, status, labels } }) => {
  console.assert(status === 'Running', 'Expected cloud environment to be running');
  console.assert(!!labels.welderInstallFailed, 'Expected cloud environment to not have Welder');
  const frameRef = useRef();
  const signal = useCancellation();
  const [busy, setBusy] = useState(false);
  const [localized, setLocalized] = useState(false);
  const cookieReady = useStore(cookieReadyStore);
  const cloudPlatform = getCloudProviderFromWorkspace(workspace);
  const {
    workspace: { googleProject, namespace, name, bucketName },
  } = workspace;

  const localizeNotebook = _.flow(
    Utils.withBusyState(setBusy),
    withErrorReporting('Error copying notebook')
  )(async () => {
    if (mode === 'edit') {
      notify('error', 'Cannot Edit Notebook', {
        message: h(Fragment, [
          p([
            'Recent updates to Terra are not compatible with the older cloud environment in this workspace. Please recreate your cloud environment in order to access Edit Mode for this notebook.',
          ]),
          h(Link, { href: dataSyncingDocUrl, ...Utils.newTabLinkProps }, ['Read here for more details.']),
        ]),
      });
      chooseMode(undefined);
    } else {
      await Runtimes(signal)
        .fileSyncing(googleProject, runtimeName)
        .oldLocalize({
          [`~/${name}/${notebookName}`]: `gs://${bucketName}/notebooks/${notebookName}`,
        });
      setLocalized(true);
    }
  });

  useOnMount(() => {
    localizeNotebook();
  });

  return h(Fragment, [
    h(PlaygroundHeader, [
      'Edits to this notebook are ',
      b(['NOT ']),
      'being saved to the workspace. To save your changes, download the notebook using the file menu.',
      h(
        Link,
        {
          style: { marginLeft: '0.5rem' },
          href: dataSyncingDocUrl,
          ...Utils.newTabLinkProps,
        },
        ['Read here for more details.']
      ),
    ]),
    localized &&
      cookieReady &&
      h(Fragment, [
        iframe({
          src: `${proxyUrl}/notebooks/${name}/${notebookName}`,
          style: { border: 'none', flex: 1, ...styles },
          ref: frameRef,
        }),
        h(JupyterFrameManager, {
          frameRef,
          onClose: () => Nav.goToPath(analysisTabName, { namespace, name }),
          details: { notebookName, name, namespace, cloudPlatform },
        }),
      ]),
    busy && copyingAnalysisMessage,
  ]);
};

export const navPaths = [
  {
    name: analysisLauncherTabName,
    path: '/workspaces/:namespace/:name/analysis/launch/:analysisName',
    component: AnalysisLauncher,
    title: ({ name, analysisName }) => `${analysisName} - ${name}`,
  },
];
