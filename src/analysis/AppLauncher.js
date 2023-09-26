import _ from 'lodash/fp';
import { Fragment, useEffect, useRef, useState } from 'react';
import { div, h, iframe, p, strong } from 'react-hyperscript-helpers';
import {
  analysisTabName,
  appLauncherTabName,
  appLauncherWithAnalysisTabName,
  PeriodicAzureCookieSetter,
  RuntimeKicker,
  RuntimeStatusMonitor,
  StatusMessage,
} from 'src/analysis/runtime-common-components';
import { getExtension, notebookLockHash, stripExtension } from 'src/analysis/utils/file-utils';
import { getAnalysesDisplayList, getConvertedRuntimeStatus, getCurrentRuntime, usableStatuses } from 'src/analysis/utils/runtime-utils';
import {
  getPatternFromRuntimeTool,
  getToolLabelFromCloudEnv,
  launchableToolLabel,
  runtimeToolLabels,
  runtimeTools,
} from 'src/analysis/utils/tool-utils';
import * as breadcrumbs from 'src/components/breadcrumbs';
import { ButtonPrimary, ButtonSecondary, spinnerOverlay } from 'src/components/common';
import Modal from 'src/components/Modal';
import { Ajax } from 'src/libs/ajax';
import { Metrics } from 'src/libs/ajax/Metrics';
import { withErrorReporting, withErrorReportingInModal } from 'src/libs/error';
import Events from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import { notify } from 'src/libs/notifications';
import { forwardRefWithName, useCancellation, useOnMount, useStore } from 'src/libs/react-utils';
import { authStore, azureCookieReadyStore, cookieReadyStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { wrapWorkspace } from 'src/pages/workspaces/workspace/WorkspaceContainer';

// The App launcher is where the iframe for the application lives
// There are several different URL schemes that can be used to access the app launcher, which affect its functionality

const ApplicationLauncher = _.flow(
  forwardRefWithName('ApplicationLauncher'),
  wrapWorkspace({
    breadcrumbs: (props) => breadcrumbs.commonPaths.workspaceDashboard(props),
    title: _.get('application'),
    activeTab: appLauncherTabName,
  })
)(
  (
    {
      name: workspaceName,
      sparkInterface,
      analysesData: { runtimes, refreshRuntimes },
      application,
      workspace: { azureContext, workspace },
      analysisName,
    },
    _ref
  ) => {
    const { namespace, name, workspaceId, googleProject, bucketName } = workspace;
    const [busy, setBusy] = useState(true);
    const [outdatedAnalyses, setOutdatedAnalyses] = useState();
    const [fileOutdatedOpen, setFileOutdatedOpen] = useState(false);
    const [hashedOwnerEmail, setHashedOwnerEmail] = useState();
    const [iframeSrc, setIframeSrc] = useState();

    const leoCookieReady = useStore(cookieReadyStore);
    const azureCookieReady = useStore(azureCookieReadyStore);
    const cookieReady = googleProject ? leoCookieReady : azureCookieReady.readyForRuntime;
    const signal = useCancellation();
    const interval = useRef();
    const {
      terraUser: { email },
    } = useStore(authStore);

    // We've already init Welder if app is Jupyter in google
    // This sets up welder for RStudio and Jupyter Lab Apps
    // Jupyter is always launched with a specific file, which is localized
    // RStudio/Jupyter Lab in Azure are launched in a general sense, and all files are localized.
    const [shouldSetupWelder, setShouldSetupWelder] = useState(
      application === runtimeToolLabels.RStudio || application === runtimeToolLabels.JupyterLab
    );

    const runtime = getCurrentRuntime(runtimes);
    const runtimeStatus = getConvertedRuntimeStatus(runtime); // preserve null vs undefined

    const FileOutdatedModal = ({ onDismiss, bucketName }) => {
      const handleChoice = _.flow(
        withErrorReportingInModal('Error setting up analysis file syncing')(onDismiss),
        Utils.withBusyState(setBusy)
      )(async (shouldCopy) => {
        // this modal only opens when the state variable outdatedAnalyses is non empty (keeps track of a user's outdated RStudio files). it gives users two options when their files are in use by another user
        // 1) make copies of those files and continue working on the copies or 2) do nothing.
        // in either case, their original version of the analysis is outdated and we will no longer sync that file to the workspace bucket for the current user
        await Promise.all(
          _.flatMap(async ({ name, metadata: currentMetadata }) => {
            const file = getFileName(name);
            const newMetadata = currentMetadata;
            if (shouldCopy) {
              // clear 'outdated' metadata (which gets populated by welder) so that new copy file does not get marked as outdated
              newMetadata[hashedOwnerEmail] = '';
              await Ajax()
                .Buckets.analysis(googleProject, bucketName, file, runtimeToolLabels.RStudio)
                .copyWithMetadata(getCopyName(file), bucketName, newMetadata);
            }
            // update bucket metadata for the outdated file to be marked as doNotSync so that welder ignores the outdated file for the current user
            newMetadata[hashedOwnerEmail] = 'doNotSync';
            await Ajax().Buckets.analysis(googleProject, bucketName, file, runtimeToolLabels.RStudio).updateMetadata(file, newMetadata);
          }, outdatedAnalyses)
        );
        onDismiss();
      });

      const getCopyName = (file) => {
        const ext = getExtension(file);
        return `${stripExtension(file)}_copy${Date.now()}.${ext}`;
      };

      const getFileName = _.flow(_.split('/'), _.nth(1));

      const getAnalysisNameFromList = _.flow(_.head, _.get('name'), getFileName);

      return h(
        Modal,
        {
          onDismiss,
          width: 530,
          title: _.size(outdatedAnalyses) > 1 ? 'R files in use' : 'R file is in use',
          showButtons: false,
        },
        [
          Utils.cond(
            // if user has more than one outdated rstudio analysis, display plural phrasing
            [
              _.size(outdatedAnalyses) > 1,
              () => [
                p([
                  'These R files are being edited by another user and your versions are now outdated. Your files will no longer sync with the workspace bucket.',
                ]),
                p([getAnalysesDisplayList(outdatedAnalyses)]),
                p(['You can']),
                p(['1) ', strong(['save your changes as new copies']), ' of your files which will enable file syncing on the copies']),
                p([strong(['or'])]),
                p([
                  '2) ',
                  strong(['continue working on your versions']),
                  ` of ${getAnalysesDisplayList(outdatedAnalyses)} with file syncing disabled.`,
                ]),
              ],
            ],
            // if user has one outdated rstudio analysis, display singular phrasing
            [
              _.size(outdatedAnalyses) === 1,
              () => [
                p([
                  `${getAnalysisNameFromList(
                    outdatedAnalyses
                  )} is being edited by another user and your version is now outdated. Your file will no longer sync with the workspace bucket.`,
                ]),
                p(['You can']),
                p([
                  '1) ',
                  strong(['save your changes as a new copy']),
                  ` of ${getAnalysisNameFromList(outdatedAnalyses)} which will enable file syncing on the copy`,
                ]),
                p([strong(['or'])]),
                p([
                  '2) ',
                  strong(['continue working on your outdated version']),
                  ` of ${getAnalysisNameFromList(outdatedAnalyses)} with file syncing disabled.`,
                ]),
              ],
            ]
          ),
          div({ style: { marginTop: '2rem' } }, [
            h(
              ButtonSecondary,
              {
                style: { padding: '0 1rem' },
                onClick: () => handleChoice(false),
              },
              ['Keep outdated version']
            ),
            h(
              ButtonPrimary,
              {
                style: { padding: '0 1rem' },
                onClick: () => handleChoice(true),
              },
              ['Make a copy']
            ),
          ]),
        ]
      );
    };

    const checkForOutdatedAnalyses = async ({ googleProject, bucketName }) => {
      const analyses = await Ajax(signal).Buckets.listAnalyses(googleProject, bucketName);
      return _.filter(
        (analysis) =>
          _.includes(getExtension(analysis?.name), runtimeTools.RStudio.ext) &&
          analysis?.metadata &&
          analysis?.metadata[hashedOwnerEmail] === 'outdated',
        analyses
      );
    };

    useOnMount(() => {
      const loadUserEmail = async () => {
        const findHashedEmail = withErrorReporting('Error loading user email information', async () => {
          const hashedEmail = await notebookLockHash(bucketName, email);
          setHashedOwnerEmail(hashedEmail);
        });

        await refreshRuntimes();
        setBusy(false);
        findHashedEmail();
      };
      loadUserEmail();
    });

    useEffect(() => {
      const runtime = getCurrentRuntime(runtimes);
      const runtimeStatus = getConvertedRuntimeStatus(runtime);

      const computeIframeSrc = withErrorReporting('Error loading application iframe', async () => {
        const getSparkInterfaceSource = (proxyUrl) => {
          console.assert(_.endsWith('/jupyter', proxyUrl), 'Unexpected ending for proxy URL');
          const proxyUrlWithlastSegmentDropped = _.flow(_.split('/'), _.dropRight(1), _.join('/'))(proxyUrl);
          return `${proxyUrlWithlastSegmentDropped}/${sparkInterface}`;
        };

        const proxyUrl = runtime?.proxyUrl;
        const url = await Utils.switchCase(
          application,
          [launchableToolLabel.terminal, () => `${proxyUrl}/terminals/1`],
          [launchableToolLabel.spark, () => getSparkInterfaceSource(proxyUrl)],
          [runtimeToolLabels.RStudio, () => proxyUrl],
          // Jupyter lab can open to a specific file. See the docs for more details https://jupyterlab.readthedocs.io/en/stable/user/urls.html
          [runtimeToolLabels.JupyterLab, () => (analysisName ? `${proxyUrl}/lab/tree/${analysisName}` : `${proxyUrl}/lab`)],
          [
            Utils.DEFAULT,
            () =>
              console.error(
                `Expected ${application} to be one of terminal, spark, ${runtimeToolLabels.RStudio}, or ${runtimeToolLabels.JupyterLab}.`
              ),
          ]
        );

        setIframeSrc(url);
      });

      const setupWelder = _.flow(
        Utils.withBusyState(setBusy),
        withErrorReporting('Error setting up analysis file syncing')
      )(async () => {
        // The special case here is because for GCP, Jupyter and JupyterLab can both be run on the same runtime and a
        // user may toggle back and forth between them. In order to keep notebooks tidy and in a predictable location on
        // disk, we mirror the localBaseDirectory used by edit mode for Jupyter.
        // Once Jupyter is phased out in favor of JupyterLab for GCP, the localBaseDirectory can be '' for all cases
        const localBaseDirectory = !!googleProject && application === runtimeToolLabels.JupyterLab ? `${workspaceName}/edit` : '';

        const { storageContainerName: azureStorageContainer } = azureContext ? await Ajax(signal).AzureStorage.details(workspaceId) : {};
        const cloudStorageDirectory = azureContext ? `${azureStorageContainer}/analyses` : `gs://${bucketName}/notebooks`;

        googleProject
          ? await Ajax()
              .Runtimes.fileSyncing(googleProject, runtime.runtimeName)
              .setStorageLinks(localBaseDirectory, '', cloudStorageDirectory, getPatternFromRuntimeTool(getToolLabelFromCloudEnv(runtime)))
          : await Ajax()
              .Runtimes.azureProxy(runtime.proxyUrl)
              .setStorageLinks(localBaseDirectory, cloudStorageDirectory, getPatternFromRuntimeTool(getToolLabelFromCloudEnv(runtime)));
      });

      if (shouldSetupWelder && runtimeStatus === 'Running') {
        setupWelder();
        setShouldSetupWelder(false);
      }

      const findOutdatedAnalyses = async () => {
        try {
          const outdatedRAnalyses = await checkForOutdatedAnalyses({ googleProject, bucketName });
          setOutdatedAnalyses(outdatedRAnalyses);
          !_.isEmpty(outdatedRAnalyses) && setFileOutdatedOpen(true);
        } catch (error) {
          notify('error', 'Error loading outdated analyses', {
            id: 'error-loading-outdated-analyses',
            detail: error instanceof Response ? await error.text() : error,
          });
        }
      };

      computeIframeSrc();
      if (runtimeStatus === 'Running') {
        !!googleProject && findOutdatedAnalyses();

        // periodically check for outdated R analyses
        interval.current = !!googleProject && setInterval(findOutdatedAnalyses, 10000);
      }

      return () => {
        clearInterval(interval.current);
        interval.current = undefined;
      };

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [googleProject, workspaceName, runtimes, bucketName]);

    useEffect(() => {
      _.includes(runtimeStatus, usableStatuses) &&
        cookieReady &&
        Metrics().captureEvent(Events.cloudEnvironmentLaunch, {
          application,
          tool: application,
          workspaceName: workspace.name,
          namespace: workspace.namespace,
          cloudPlatform: workspace.cloudPlatform,
        });
    }, [application, cookieReady, runtimeStatus, workspace]);

    if (!busy && runtime === undefined) Nav.goToPath(analysisTabName, { namespace, name });

    return h(Fragment, [
      h(RuntimeStatusMonitor, {
        runtime,
      }),
      h(RuntimeKicker, { runtime, refreshRuntimes }),
      // We cannot attach the periodic cookie setter until we have a running runtime for azure, because the relay is not guaranteed to be ready until then
      !!azureContext && getConvertedRuntimeStatus(runtime) === 'Running' ? h(PeriodicAzureCookieSetter, { proxyUrl: runtime.proxyUrl }) : null,
      fileOutdatedOpen && h(FileOutdatedModal, { onDismiss: () => setFileOutdatedOpen(false), bucketName }),
      _.includes(runtimeStatus, usableStatuses) && cookieReady
        ? h(Fragment, [
            application === runtimeToolLabels.JupyterLab &&
              div({ style: { padding: '2rem', position: 'absolute', top: 0, left: 0, zIndex: 0 } }, [
                h(StatusMessage, {}, ['Your Virtual Machine (VM) is ready. JupyterLab will launch momentarily...']),
              ]),
            iframe({
              src: iframeSrc,
              style: {
                border: 'none',
                flex: 1,
                zIndex: 1,
                ...(application === launchableToolLabel.terminal ? { marginTop: -45, clipPath: 'inset(45px 0 0)' } : {}), // cuts off the useless Jupyter top bar
              },
              title: `Interactive ${application} iframe`,
            }),
          ])
        : div({ style: { padding: '2rem' } }, [
            !busy &&
              h(StatusMessage, { hideSpinner: ['Error', 'Stopped', null].includes(runtimeStatus) }, [
                Utils.cond(
                  [
                    runtimeStatus === 'Creating' && azureContext,
                    () => 'Creating cloud environment. You can navigate away, this may take up to 10 minutes.',
                  ],
                  [
                    runtimeStatus === 'Creating' && !!googleProject,
                    () => 'Creating cloud environment. You can navigate away and return in 3-5 minutes.',
                  ],
                  [runtimeStatus === 'Starting', () => 'Starting cloud environment, this may take up to 2 minutes.'],
                  [_.includes(runtimeStatus, usableStatuses), () => 'Almost ready...'],
                  [
                    runtimeStatus === 'Stopping',
                    () => 'Cloud environment is stopping, which takes ~4 minutes. You can restart it after it finishes.',
                  ],
                  [runtimeStatus === 'Stopped', () => 'Cloud environment is stopped. Start it to edit your notebook or use the terminal.'],
                  [runtimeStatus === 'LeoReconfiguring', () => 'Cloud environment is updating, please wait.'],
                  [runtimeStatus === 'Error', () => 'Error with the cloud environment, please try again.'],
                  [runtimeStatus === null, () => 'Create a cloud environment to continue.'],
                  [runtimeStatus === undefined, () => 'Loading...'],
                  () => 'Unknown cloud environment status. Please create a new cloud environment or contact support.'
                ),
              ]),
            busy && spinnerOverlay,
          ]),
    ]);
  }
);

export const navPaths = [
  {
    name: 'workspace-terminal', // legacy
    path: '/workspaces/:namespace/:name/notebooks/terminal',
    component: (props) => h(Nav.Redirector, { pathname: Nav.getPath('workspace-application-launch', { ...props, application: 'terminal' }) }),
  },
  {
    name: appLauncherTabName,
    path: '/workspaces/:namespace/:name/applications/:application',
    component: ApplicationLauncher,
    title: ({ name, application }) => `${name} - ${application}`,
  },
  {
    name: appLauncherWithAnalysisTabName,
    path: '/workspaces/:namespace/:name/applications/:application/:analysisName',
    component: ApplicationLauncher,
    title: ({ name, application }) => `${name} - ${application}`,
  },
  {
    name: 'workspace-spark-interface-launch',
    path: '/workspaces/:namespace/:name/applications/:application/:sparkInterface',
    component: ApplicationLauncher,
    title: ({ name, application, sparkInterface }) => `${name} - ${application} - ${sparkInterface}`,
  },
];
