import { Fragment, useCallback, useEffect, useState } from 'react';
import { div, h, h2 } from 'react-hyperscript-helpers';
import { getCurrentApp, getIsAppBusy } from 'src/analysis/utils/app-utils';
import { appToolLabels, appTools } from 'src/analysis/utils/tool-utils';
import { ButtonOutline, ButtonPrimary, Clickable, Link } from 'src/components/common';
import { centeredSpinner, icon } from 'src/components/icons';
import TitleBar from 'src/components/TitleBar';
import { Ajax } from 'src/libs/ajax';
import colors from 'src/libs/colors';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import { notify } from 'src/libs/notifications';
import { useCancellation, useOnMount, usePollingEffect } from 'src/libs/react-utils';
import { AppProxyUrlStatus, workflowsAppStore } from 'src/libs/state';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import FindWorkflowModal from 'src/workflows-app/components/FindWorkflowModal';
import { SavedWorkflows } from 'src/workflows-app/components/SavedWorkflows';
import { doesAppProxyUrlExist, loadAppUrls } from 'src/workflows-app/utils/app-utils';
import { CbasPollInterval } from 'src/workflows-app/utils/submission-utils';
import { wrapWorkflowsPage } from 'src/workflows-app/WorkflowsContainer';

const styles = {
  // Card's position: relative and the outer/inner styles are a little hack to fake nested links
  card: {
    ...Style.elements.card.container,
    position: 'absolute',
  },
  shortCard: {
    width: 300,
    height: 125,
    margin: '0 1rem 2rem 0',
  },
};

export const SubmitWorkflow = wrapWorkflowsPage({ name: 'SubmitWorkflow' })(
  (
    {
      name,
      namespace,
      workspace,
      workspace: {
        workspace: { workspaceId },
      },
      analysesData: { apps, refreshApps },
    },
    _ref
  ) => {
    const [methodsData, setMethodsData] = useState();
    const [loading, setLoading] = useState(false);
    const [appCreating, setAppCreating] = useState(false);
    const [viewFindWorkflowModal, setViewFindWorkflowModal] = useState(false);

    const signal = useCancellation();
    const cbasReady = doesAppProxyUrlExist(workspaceId, 'cbasProxyUrlState');

    const loadRunsData = useCallback(
      async (cbasProxyUrlDetails) => {
        try {
          if (cbasProxyUrlDetails.status !== AppProxyUrlStatus.Ready) {
            const { cbasProxyUrlState } = await loadAppUrls(workspaceId, 'cbasProxyUrlState');

            if (cbasProxyUrlState.status === AppProxyUrlStatus.Ready) {
              const runs = await Ajax(signal).Cbas.methods.getWithoutVersions(cbasProxyUrlState.state);
              setMethodsData(runs.methods);
            }
          } else {
            const runs = await Ajax(signal).Cbas.methods.getWithoutVersions(cbasProxyUrlDetails.state);
            setMethodsData(runs.methods);
          }
        } catch (error) {
          notify('error', 'Error loading saved workflows', { detail: error instanceof Response ? await error.text() : error });
        }
      },
      [signal, workspaceId]
    );

    useEffect(() => {
      const app = getCurrentApp(appToolLabels.CROMWELL, apps);
      setAppCreating(getIsAppBusy(app));
      refreshApps();
    }, [apps, refreshApps]);

    // poll if we're missing CBAS proxy url and stop polling when we have it
    usePollingEffect(() => !doesAppProxyUrlExist(workspaceId, 'cbasProxyUrlState') && loadRunsData(workflowsAppStore.get().cbasProxyUrlState), {
      ms: CbasPollInterval,
      leading: false,
    });

    useOnMount(() => {
      const load = Utils.withBusyState(setLoading, async () => {
        const { cbasProxyUrlState } = await loadAppUrls(workspaceId, 'cbasProxyUrlState');

        if (cbasProxyUrlState.status === AppProxyUrlStatus.Ready) {
          await loadRunsData(cbasProxyUrlState);
        }
      });
      load();
    });
    const pleaseWaitMessage = 'Workflows App is being created. Please wait.';
    return loading
      ? centeredSpinner()
      : div([
          !cbasReady &&
            div({ style: { ...styles.card, margin: '2rem 4rem' } }, [
              h(TitleBar, {
                id: 'workflow-app-launch-page',
                title: 'Launch the Workflows App to run workflows',
                style: { marginBottom: '0.5rem' },
              }),
              div(['The Workflows App must be launched in order to explore, view, and submit workflows.']),
              div({ style: { display: 'flex', marginTop: '2rem', justifyContent: 'flex-center' } }, [
                !appCreating && 'Would you like to get started?',
                appCreating && pleaseWaitMessage,
              ]),
              div({ style: { display: 'flex', marginTop: '1rem', justifyContent: 'flex-center' } }, [
                h(
                  ButtonPrimary,
                  {
                    disabled: appCreating,
                    tooltip: appCreating ? pleaseWaitMessage : 'Create Workflows App',
                    onClick: Utils.withBusyState(setLoading, async () => {
                      await Ajax(signal).Apps.createAppV2(Utils.generateAppName(), workspace.workspace.workspaceId, appToolLabels.CROMWELL);
                      await Ajax(signal).Metrics.captureEvent(Events.applicationCreate, {
                        app: appTools.CROMWELL.label,
                        ...extractWorkspaceDetails(workspace),
                      });
                      setAppCreating(true);
                    }),
                  },
                  ['Yes, launch the Workflows App']
                ),
              ]),
              h(
                Link,
                {
                  ...Utils.newTabLinkProps,
                  href: 'https://support.terra.bio/hc/en-us/articles/360024743371-Working-with-workspaces',
                  style: { marginTop: '2rem' },
                },
                ['Learn more about managing cloud cost']
              ),
            ]),
          cbasReady &&
            div({ style: { margin: '2rem 4rem' } }, [
              div({ style: { display: 'flex', marginTop: '1rem', justifyContent: 'space-between' } }, [
                h2(['Submit a workflow']),
                h(
                  ButtonOutline,
                  {
                    onClick: () =>
                      Nav.goToPath('workspace-workflows-app-submission-history', {
                        name,
                        namespace,
                      }),
                  },
                  ['Submission history']
                ),
              ]),
              div(['Run a workflow in Terra using Cromwell engine. Full feature workflow submission coming soon.']),
              div({ style: { marginTop: '3rem' } }, [
                h(
                  Clickable,
                  {
                    'aria-haspopup': 'dialog',
                    style: {
                      ...styles.card,
                      ...styles.shortCard,
                      color: colors.accent(),
                      fontSize: 18,
                      lineHeight: '22px',
                    },
                    onClick: () => setViewFindWorkflowModal(true),
                  },
                  ['Find a Workflow', icon('plus-circle', { size: 32 })]
                ),
                h(Fragment, [h(SavedWorkflows, { workspaceName: name, namespace, methodsData })]),
              ]),
              viewFindWorkflowModal && h(FindWorkflowModal, { name, namespace, workspace, onDismiss: () => setViewFindWorkflowModal(false) }),
            ]),
        ]);
  }
);

export const navPaths = [
  {
    name: 'workspace-workflows-app',
    path: '/workspaces/:namespace/:name/workflows-app',
    component: SubmitWorkflow,
    title: ({ name }) => `${name} - Workflows`,
  },
];
