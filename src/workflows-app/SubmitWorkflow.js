import { useState } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import { doesWorkspaceSupportCromwellAppForUser, generateAppName, getCurrentApp, getIsAppBusy } from 'src/analysis/utils/app-utils';
import { appAccessScopes, appToolLabels, appTools } from 'src/analysis/utils/tool-utils';
import { centeredSpinner } from 'src/components/icons';
import { Apps } from 'src/libs/ajax/leonardo/Apps';
import { Metrics } from 'src/libs/ajax/Metrics';
import { reportError } from 'src/libs/error';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { useCancellation, usePollingEffect } from 'src/libs/react-utils';
import { getTerraUser } from 'src/libs/state';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { WorkflowsAppNavPanel } from 'src/workflows-app/components/WorkflowsAppNavPanel';
import { doesAppProxyUrlExist, getCromwellUnsupportedMessage, loadAppUrls } from 'src/workflows-app/utils/app-utils';
import { CbasPollInterval } from 'src/workflows-app/utils/submission-utils';
import { wrapWorkflowsPage } from 'src/workflows-app/WorkflowsContainer';
import { getCloudProviderFromWorkspace, isOwner } from 'src/workspaces/utils';

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

const detectSomeoneElsesCromwell = (apps, createdBy, userEmail, accessLevel, createdDate) => {
  // Whether someone else (ie the workspace creator) has already started a CROMWELL instance:
  const someoneElsesCromwell = getCurrentApp(appToolLabels.CROMWELL, apps) && createdBy !== userEmail;
  // We can be sure nobody else is running an old style Cromwell app here if:
  // 1. There is no Cromwell app belonging to somebody else
  // 2. The user is an owner of the workspace (and can see all the apps) OR the workspace was created after 12/1/2023 (after the feature flag was made permanent)
  const guaranteedNobodyElsesCromwell =
    !someoneElsesCromwell && (isOwner(accessLevel) || Date.parse(createdDate) > Date.parse('2023-12-01T00:00:00.000Z'));
  return { someoneElsesCromwell, guaranteedNobodyElsesCromwell };
};

export const SubmitWorkflow = wrapWorkflowsPage({ name: 'SubmitWorkflow' })(
  (
    {
      name,
      namespace,
      workspace,
      workspace: {
        workspace: { createdBy, workspaceId, createdDate },
        canCompute,
        accessLevel,
      },
      analysesData,
      analysesData: { apps, refreshApps },
    },
    _ref
  ) => {
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    const signal = useCancellation();
    const cbasReady = doesAppProxyUrlExist(workspaceId, 'cbasProxyUrlState');
    const currentApp = getCurrentApp(appToolLabels.CROMWELL, apps) || getCurrentApp(appToolLabels.WORKFLOWS_APP, apps);
    const { someoneElsesCromwell, guaranteedNobodyElsesCromwell } = detectSomeoneElsesCromwell(
      apps,
      createdBy,
      getTerraUser().email,
      accessLevel,
      createdDate
    );
    const pageReady = cbasReady && currentApp && !getIsAppBusy(currentApp);
    const launching = creating || (currentApp && getIsAppBusy(currentApp)) || (currentApp && !pageReady && !someoneElsesCromwell);
    const canLaunch = guaranteedNobodyElsesCromwell && canCompute;

    // poll if we're missing CBAS proxy url and stop polling when we have it
    usePollingEffect(() => !doesAppProxyUrlExist(workspaceId, 'cbasProxyUrlState'), {
      ms: CbasPollInterval,
      leading: false,
    });

    usePollingEffect(
      () => {
        const refresh = async () => await loadAppUrls(workspaceId, 'cbasProxyUrlState');
        if (!currentApp || getIsAppBusy(currentApp)) {
          refresh();
        }
      },
      {
        ms: 10000,
        leading: true,
      }
    );

    const createWorkflowsApp = Utils.withBusyState(setCreating, async () => {
      try {
        setCreating(true);
        await Apps().createAppV2(generateAppName(), workspace.workspace.workspaceId, appToolLabels.WORKFLOWS_APP, appAccessScopes.WORKSPACE_SHARED);

        await Metrics(signal).captureEvent(Events.applicationCreate, {
          app: appTools.CROMWELL.label,
          ...extractWorkspaceDetails(workspace),
        });
        await refreshApps(true);
      } catch (error) {
        reportError('Cloud Environment Error', error);
      } finally {
        setCreating(false);
      }
    });

    const renderSubmitWorkflow = () => {
      return h(WorkflowsAppNavPanel, {
        name,
        namespace,
        workspace,
        loading,
        analysesData,
        pageReady,
        launcherDisabled: !canLaunch,
        createWorkflowsApp,
        setLoading,
        signal,
      });
    };

    return Utils.cond(
      [loading, () => centeredSpinner()],
      [pageReady, () => renderSubmitWorkflow()],
      [
        doesWorkspaceSupportCromwellAppForUser(workspace.workspace, getCloudProviderFromWorkspace(workspace), appToolLabels.WORKFLOWS_APP),
        () => {
          return h(WorkflowsAppNavPanel, {
            pageReady,
            launching,
            launcherDisabled: !canLaunch,
            loading,
            createWorkflowsApp,
            workspace,
            analysesData,
          });
        },
      ],
      [Utils.DEFAULT, () => div({ style: { ...styles.card, width: '50rem', margin: '2rem 4rem' } }, [getCromwellUnsupportedMessage()])]
    );
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
