import { icon } from '@terra-ui-packages/components';
import { div } from 'react-hyperscript-helpers';
import { appToolLabels } from 'src/analysis/utils/tool-utils';
import { resolveWdsUrl } from 'src/libs/ajax/data-table-providers/WdsDataTableProvider';
import { Apps } from 'src/libs/ajax/leonardo/Apps';
import { getConfig } from 'src/libs/config';
import * as Nav from 'src/libs/nav';
import { AppProxyUrlStatus, getTerraUser, workflowsAppStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { cloudProviderTypes } from 'src/workspaces/utils';

export const getCromwellUnsupportedMessage = () =>
  'Cromwell app is either not supported in this workspace or you need to be a workspace creator to access the app. Please create a new workspace to use Cromwell app.';

export const doesAppProxyUrlExist = (workspaceId, proxyUrlStateField) => {
  const workflowsAppStoreLocal = workflowsAppStore.get();
  return workflowsAppStoreLocal.workspaceId === workspaceId && workflowsAppStoreLocal[proxyUrlStateField].status === AppProxyUrlStatus.Ready;
};

export const resolveRunningCromwellAppUrl = (apps, currentUser) => {
  // it looks for Kubernetes deployment status RUNNING expressed by Leo
  // See here for specific enumerations -- https://github.com/DataBiosphere/leonardo/blob/develop/core/src/main/scala/org/broadinstitute/dsde/workbench/leonardo/kubernetesModels.scala
  // We explicitly look for a RUNNING app because if the CBAS app is not Running, we won't be able to send import method request.

  // note: the requirement for checking if the app was created by user will not be needed when we move to multi-user Workflows app where users with
  // OWNER and WRITER roles will be able to import methods to app created by another user
  const filteredApps = apps.filter(
    (app) =>
      ((app.appType === appToolLabels.CROMWELL && app.auditInfo.creator === currentUser) || app.appType === appToolLabels.WORKFLOWS_APP) &&
      app.status === 'RUNNING'
  );
  if (filteredApps.length === 1) {
    return {
      cbasUrl: filteredApps[0].proxyUrls.cbas,
      cromwellUrl: filteredApps[0].proxyUrls.cromwell ? filteredApps[0].proxyUrls.cromwell : filteredApps[0].proxyUrls['cromwell-reader'],
    };
  }
  // if there are no Running Cromwell apps or if there are more than one then it's an error state and return null
  return null;
};

const resolveProxyUrl = (configRoot, appsList, resolver) => {
  if (configRoot) {
    return { status: AppProxyUrlStatus.Ready, state: configRoot };
  }

  try {
    const proxyUrl = resolver(appsList);
    if (proxyUrl) {
      return { status: AppProxyUrlStatus.Ready, state: proxyUrl };
    }
    return { status: AppProxyUrlStatus.None, state: '' };
  } catch (error) {
    return { status: AppProxyUrlStatus.None, state: '' };
  }
};

const setAllAppUrlsFromConfig = (workspaceId, wdsUrlRoot, cbasUrlRoot, cromwellUrlRoot) => {
  const wdsProxyUrlState = { status: AppProxyUrlStatus.Ready, state: wdsUrlRoot };
  const cbasProxyUrlState = { status: AppProxyUrlStatus.Ready, state: cbasUrlRoot };
  const cromwellProxyUrlState = { status: AppProxyUrlStatus.Ready, state: cromwellUrlRoot };

  workflowsAppStore.set({
    workspaceId,
    wdsProxyUrlState,
    cbasProxyUrlState,
    cromwellProxyUrlState,
  });

  return {
    wdsProxyUrlState,
    cbasProxyUrlState,
    cromwellProxyUrlState,
  };
};

const fetchAppUrlsFromLeo = async (workspaceId, wdsUrlRoot, cbasUrlRoot, cromwellUrlRoot) => {
  let wdsProxyUrlState;
  let cbasProxyUrlState;
  let cromwellProxyUrlState;

  try {
    const appsList = await Apps().listAppsV2(workspaceId);
    wdsProxyUrlState = resolveProxyUrl(wdsUrlRoot, appsList, (appsList) => resolveWdsUrl(appsList));
    cbasProxyUrlState = resolveProxyUrl(cbasUrlRoot, appsList, (appsList) => resolveRunningCromwellAppUrl(appsList, getTerraUser()?.email).cbasUrl);
    cromwellProxyUrlState = resolveProxyUrl(
      cromwellUrlRoot,
      appsList,
      (appsList) => resolveRunningCromwellAppUrl(appsList, getTerraUser()?.email).cromwellUrl
    );
  } catch (error) {
    wdsProxyUrlState = { status: AppProxyUrlStatus.Error, state: error };
    cbasProxyUrlState = { status: AppProxyUrlStatus.Error, state: error };
    cromwellProxyUrlState = { status: AppProxyUrlStatus.Error, state: error };
  }

  workflowsAppStore.set({
    workspaceId,
    wdsProxyUrlState,
    cbasProxyUrlState,
    cromwellProxyUrlState,
  });

  return {
    wdsProxyUrlState,
    cbasProxyUrlState,
    cromwellProxyUrlState,
  };
};

export const loadAppUrls = async (workspaceId, proxyUrlStateField) => {
  if (!doesAppProxyUrlExist(workspaceId, proxyUrlStateField)) {
    // we can set these configs in dev.json if we want local Terra UI to connect to local WDS or Workflows related services
    const wdsUrlRoot = getConfig().wdsUrlRoot;
    const cbasUrlRoot = getConfig().cbasUrlRoot;
    const cromwellUrlRoot = getConfig().cromwellUrlRoot;

    // don't call Leonardo if Terra UI needs to connect to all 3 services locally
    if (wdsUrlRoot && cbasUrlRoot && cromwellUrlRoot) {
      return setAllAppUrlsFromConfig(workspaceId, wdsUrlRoot, cbasUrlRoot, cromwellUrlRoot);
    }
    return await fetchAppUrlsFromLeo(workspaceId, wdsUrlRoot, cbasUrlRoot, cromwellUrlRoot);
  }
  const workflowsAppStoreLocal = workflowsAppStore.get();
  return {
    wdsProxyUrlState: workflowsAppStoreLocal.wdsProxyUrlState,
    cbasProxyUrlState: workflowsAppStoreLocal.cbasProxyUrlState,
    cromwellProxyUrlState: workflowsAppStoreLocal.cromwellProxyUrlState,
  };
};

export const cromwellLinkProps = ({ cloudProvider, namespace, name, app }) => {
  return {
    href: Utils.cond(
      [cloudProvider === cloudProviderTypes.AZURE, () => Nav.getLink('workspace-workflows-app', { namespace, name })],
      () => app?.proxyUrls['cromwell-service']
    ),
    ...Utils.cond(
      [cloudProvider === cloudProviderTypes.AZURE, () => {}],
      () => Utils.newTabLinkPropsWithReferrer // if present, opens link in new tab
    ),
  };
};

export const analysesDataInitialized = (analysesData) => {
  return analysesData?.lastRefresh !== undefined && analysesData?.lastRefresh !== null && analysesData?.lastRefresh !== 0;
};

export const loadingYourWorkflowsApp = () =>
  div({ style: { marginTop: '2rem' } }, [icon('loadingSpinner'), ' Loading your Workflows app, this may take a few minutes.']);
