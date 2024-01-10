import _ from 'lodash/fp';
import { ReactNode, useEffect } from 'react';
import { Ajax } from 'src/libs/ajax';
import { useRoute } from 'src/libs/nav';
import {
  containsProtectedDataPolicy,
  WorkspaceAccessLevel,
  WorkspaceInfo,
  WorkspaceWrapper,
} from 'src/libs/workspace-utils';

/*
 * NOTE: In order to show up in reports, new events MUST be marked as expected in the Mixpanel
 * lexicon. See the Mixpanel guide in the terra-ui GitHub Wiki for more details:
 *   https://github.com/DataBiosphere/terra-ui/wiki/Mixpanel
 */
const eventsList = {
  aboutPersistentDiskView: 'about:persistentDisk:view',
  appcuesEvent: 'appcues:event',
  applicationLaunch: 'application:launch',
  applicationCreate: 'application:create',
  applicationDelete: 'application:delete',
  applicationPause: 'application:pause',
  applicationResume: 'application:resume',
  analysisEnableBeta: 'analysis:enable',
  analysisDisableBeta: 'analysis:disable',
  analysisCreate: 'analysis:create',
  analysisLaunch: 'analysis:launch',
  analysisToggleJupyterLabGCP: 'analysis:toggleJupyterLabGCP',
  analysisPreviewSuccess: 'analysis:previewSuccess',
  analysisPreviewFail: 'analysis:previewFail',
  billingProjectExpandWorkspace: 'billing:project:workspace:expand',
  billingProjectGoToWorkspace: 'billing:project:workspace:navigate',
  billingProjectOpenFromList: 'billing:project:open-from-list',
  billingProjectSelectTab: 'billing:project:tab',
  billingChangeAccount: 'billing:project:account:update',
  billingAzureCreationSubscriptionStep: 'billing:creation:step1:AzureSubscriptionStepActive',
  billingAzureCreationMRGSelected: 'billing:creation:step1:AzureMRGSelected',
  billingAzureCreationProtectedDataSelected: 'billing:creation:step2:AzureProtectedDataSelected',
  billingAzureCreationProtectedDataNotSelected: 'billing:creation:step2:AzureProtectedDataNotSelected',
  billingAzureCreationNoUsersToAdd: 'billing:creation:step3:AzureNoUsersOrOwners',
  billingAzureCreationWillAddUsers: 'billing:creation:step3:AzureWillAddUsersOrOwners',
  billingAzureCreationProjectNameStep: 'billing:creation:step4:AzureBillingProjectNameStepActive',
  billingAzureCreationProjectCreateFail: 'billing:creation:step4:AzureBillingProjectFailure',
  billingGCPCreationStep1: 'billing:creation:step1:gcpConsoleClicked',
  billingGCPCreationStep2BillingAccountNoAccess: 'billing:creation:step2:billingAccountNoAccess',
  billingGCPCreationStep2HaveBillingAccount: 'billing:creation:step2:haveBillingAccount',
  billingGCPCreationStep3VerifyUserAdded: 'billing:creation:step3:verifyUserAdded',
  billingGCPCreationStep3BillingAccountNoAccess: 'billing:creation:step3:billingAccountNoAccess',
  billingGCPCreationStep3AddedTerraBilling: 'billing:creation:step3:addedTerraBilling',
  billingGCPCreationRefreshStep3: 'billing:creation:refreshStep3',
  billingCreationContactTerraSupport: 'billing:creation:contactTerraSupport',
  billingCreationGCPProjectNameEntered: 'billing:creation:gcpProjectNameEntered',
  billingCreationGCPBillingAccountSelected: 'billing:creation:gcpBillingAccountSelected',
  billingCreationBillingProjectCreated: 'billing:creation:billingProjectCreated',
  billingRemoveAccount: 'billing:project:account:remove',
  cloudEnvironmentConfigOpen: 'cloudEnvironment:config:open',
  cloudEnvironmentLaunch: 'cloudEnvironment:launch',
  cloudEnvironmentCreate: 'cloudEnvironment:create',
  cloudEnvironmentDelete: 'cloudEnvironment:delete',
  cloudEnvironmentUpdate: 'cloudEnvironment:update',
  cloudEnvironmentDetailsLoad: 'analysis:details:load',
  catalogFilterSearch: 'catalog:filter:search',
  catalogFilterSidebar: 'catalog:filter:sidebar',
  catalogRequestAccess: 'catalog:requestAccess',
  catalogToggle: 'catalog:toggle',
  catalogLandingPageBanner: 'catalog:landingPageBanner',
  catalogViewDetails: 'catalog:view:details',
  catalogViewPreviewData: 'catalog:view:previewData',
  catalogWorkspaceLink: 'catalog:workspaceLink',
  catalogWorkspaceLinkExportFinished: 'catalog:workspaceLink:completed',
  datasetLibraryBrowseData: 'library:browseData',
  dataTableSaveColumnSettings: 'dataTable:saveColumnSettings',
  dataTableLoadColumnSettings: 'dataTable:loadColumnSettings',
  dataTableVersioningViewVersionHistory: 'dataTable:versioning:viewVersionHistory',
  dataTableVersioningSaveVersion: 'dataTable:versioning:saveVersion',
  dataTableVersioningImportVersion: 'dataTable:versioning:importVersion',
  dataTableVersioningDeleteVersion: 'dataTable:versioning:deleteVersion',
  featurePreviewToggle: 'featurePreview:toggle',
  // Note: "external" refers to the common Job Manager deployment, not a Job Manager bundled in CromwellApp
  jobManagerOpenExternal: 'job-manager:open-external',
  notebookRename: 'notebook:rename',
  notebookCopy: 'notebook:copy',
  notificationToggle: 'notification:toggle',
  pageView: 'page:view',
  permissionsSynchronizationDelay: 'permissions:propagationDelay',
  resourceLeave: 'resource:leave',
  user: {
    authToken: {
      load: {
        success: 'user:authTokenLoad:success',
        expired: 'user:authTokenLoad:expiredRefreshToken',
        error: 'user:authTokenLoad:error',
        retry: 'user:authTokenLoad:retry',
      },
      desync: 'user:authToken:desync',
    },
    login: {
      success: 'user:login:success',
      expired: 'user:login:expiredRefreshToken',
      error: 'user:login:error',
    },
    signOut: {
      requested: 'user:signOut:requested',
      disabled: 'user:signOut:disabled',
      declinedTos: 'user:signOut:declinedTos',
      expiredRefreshToken: 'user:signOut:expiredRefreshToken',
      errorRefreshingAuthToken: 'user:signOut:errorRefreshingAuthToken',
      idleStatusMonitor: 'user:signOut:idleStatusMonitor',
      unspecified: 'user:signOut:unspecified',
    },
    register: 'user:register',
    sessionTimeout: 'user:sessionTimeout',
  },
  workflowClearIO: 'workflow:clearIO',
  workflowImport: 'workflow:import',
  workflowLaunch: 'workflow:launch',
  workflowRerun: 'workflow:rerun',
  workflowUploadIO: 'workflow:uploadIO',
  workflowUseDefaultOutputs: 'workflow:useDefaultOutputs',
  workflowsAppImport: 'workflowsApp:import',
  workflowsAppLaunchWorkflow: 'workflowsApp:launchWorkflow',
  workflowsAppCloseLogViewer: 'workflowsApp:closeLogViewer',
  workflowsTabView: 'workflowsApp:tab:view',
  workspaceClone: 'workspace:clone',
  workspaceCreate: 'workspace:create',
  workspaceDashboardSectionToggle: 'workspace:dashboard:toggleSection',
  workspaceOpenedBucketInBrowser: 'workspace:openedBucketInBrowser',
  workspaceOpenedProjectInConsole: 'workspace:openedProjectInCloudConsole',
  workspaceDataAddColumn: 'workspace:data:addColumn',
  workspaceDataAddRow: 'workspace:data:addRow',
  workspaceDataClearColumn: 'workspace:data:clearColumn',
  workspaceDataCopy: 'workspace:data:copy',
  workspaceDataCopyToClipboard: 'workspace:data:copyToClipboard',
  workspaceDataCreateSet: 'workspace:data:createSet',
  workspaceDataCrossTableSearch: 'workspace:data:crossTableSearch',
  workspaceDataDelete: 'workspace:data:delete',
  workspaceDataDeleteColumn: 'workspace:data:deleteColumn',
  workspaceDataDownload: 'workspace:data:download',
  workspaceDataDownloadPartial: 'workspace:data:downloadpartial',
  workspaceDataEditMultiple: 'workspace:data:editMultiple',
  workspaceDataEditOne: 'workspace:data:editOne',
  workspaceDataColumnTableSearch: 'workspace:data:columnTableSearch',
  workspaceDataOpenWithIGV: 'workspace:data:igv',
  workspaceDataOpenWithWorkflow: 'workspace:data:workflow',
  workspaceDataOpenWithDataExplorer: 'workspace:data:dataexplorer',
  workspaceDataOpenWithNotebook: 'workspace:data:notebook',
  workspaceDataImport: 'workspace:data:import',
  workspaceDataUpload: 'workspace:data:upload',
  workspaceDataRenameColumn: 'workspace:data:renameColumn',
  workspaceDataRenameEntity: 'workspace:data:renameEntity',
  workspaceDataRenameTable: 'workspace:data:rename-table',
  workspaceDataDeleteTable: 'workspace:data:deleteTable',
  workspaceOpenFromList: 'workspace:open-from-list',
  workspaceOpenFromRecentlyViewed: 'workspace:open-from-recently-viewed',
  workspaceSampleTsvDownload: 'workspace:sample-tsv:download',
  workspaceShare: 'workspace:share',
  workspaceShareWithSupport: 'workspace:shareWithSupport',
  workspaceSnapshotDelete: 'workspace:snapshot:delete',
  workspaceSnapshotContentsView: 'workspace:snapshot:contents:view',
  workspaceStar: 'workspace:star',
} as const;

// Helper type to create BaseMetricsEventName.
type MetricsEventsMap<EventName> = { [key: string]: EventName | MetricsEventsMap<EventName> };
// Union type of all event names configured in eventsList.
type BaseMetricsEventName = typeof eventsList extends MetricsEventsMap<infer EventName> ? EventName : never;
// Each route has its own page view event, where the event name includes the name of the route.
type PageViewMetricsEventName = `${typeof eventsList.pageView}:${string}`;

/**
 * Union type of all metrics event names.
 */
export type MetricsEventName = BaseMetricsEventName | PageViewMetricsEventName;

// extractWorkspaceDetails accepts multiple types of input...
export type EventWorkspaceAttributes =
  // A WorkspaceWrapper object, from which it extracts the policies and a few fields from the inner WorkspaceInfo.
  | {
      workspace: Pick<WorkspaceInfo, 'namespace' | 'name' | 'cloudPlatform'>;
      policies?: WorkspaceWrapper['policies'];
      accessLevel?: WorkspaceWrapper['accessLevel'];
    }
  // A WorkspaceInfo object, from which it extracts a few fields.
  | Pick<WorkspaceInfo, 'namespace' | 'name' | 'cloudPlatform'>
  // A workspace namespace and name on their own.
  // cloudPlatform may also be passed, but it's mainly here to make the types easier in extractWorkspaceDetails.
  | { namespace: string; name: string; cloudPlatform?: WorkspaceInfo['cloudPlatform'] };

export interface EventWorkspaceDetails {
  workspaceNamespace: string;
  workspaceName: string;
  cloudPlatform?: string;
  hasProtectedData?: boolean;
  workspaceAccessLevel?: WorkspaceAccessLevel;
}

/**
 * Extracts name, namespace, cloudPlatform, and policies (if present) from an object.
 *
 * @param workspace - Workspace attributes. These can be provided with a WorkspaceWrapper object, a WorkspaceInfo object, or a plain { namespace, name } object.
 */
export const extractWorkspaceDetails = (workspaceObject: EventWorkspaceAttributes): EventWorkspaceDetails => {
  // If a WorkspaceWrapper is provided, get the inner WorkspaceInfo. Otherwise, use the provided object directly.
  const workspaceDetails = 'workspace' in workspaceObject ? workspaceObject.workspace : workspaceObject;
  const { name, namespace, cloudPlatform } = workspaceDetails;
  const accessLevel = 'accessLevel' in workspaceObject ? workspaceObject.accessLevel : undefined;

  // Policies are only available if a WorkspaceWrapper object is passed.
  // For other types of input, whether the workspace has protected data is unknown.
  const hasProtectedData =
    'policies' in workspaceObject ? containsProtectedDataPolicy(workspaceObject.policies) : undefined;

  return {
    workspaceNamespace: namespace,
    workspaceName: name,
    workspaceAccessLevel: accessLevel,
    cloudPlatform: cloudPlatform ? cloudPlatform.toUpperCase() : undefined,
    hasProtectedData,
  };
};

export interface CrossWorkspaceEventWorkspaceAttributes {
  workspace: Pick<WorkspaceWrapper['workspace'], 'namespace' | 'name' | 'cloudPlatform'>;
}

export interface CrossWorkspaceEventWorkspaceDetails {
  fromWorkspaceNamespace: string;
  fromWorkspaceName: string;
  fromWorkspaceCloudPlatform: string;
  toWorkspaceNamespace: string;
  toWorkspaceName: string;
  toWorkspaceCloudPlatform: string;
}

export const extractCrossWorkspaceDetails = (
  fromWorkspace: CrossWorkspaceEventWorkspaceAttributes,
  toWorkspace: CrossWorkspaceEventWorkspaceAttributes
): CrossWorkspaceEventWorkspaceDetails => {
  return {
    fromWorkspaceNamespace: fromWorkspace.workspace.namespace,
    fromWorkspaceName: fromWorkspace.workspace.name,
    fromWorkspaceCloudPlatform: _.toUpper(fromWorkspace.workspace.cloudPlatform),
    toWorkspaceNamespace: toWorkspace.workspace.namespace,
    toWorkspaceName: toWorkspace.workspace.name,
    toWorkspaceCloudPlatform: _.toUpper(toWorkspace.workspace.cloudPlatform),
  };
};

export interface EventBillingProjectAttributes {
  projectName: string;
  cloudPlatform: string;
}

export interface EventBillingDetails {
  billingProjectName: string;
  cloudPlatform: string;
}

export const extractBillingDetails = (billingProject: EventBillingProjectAttributes): EventBillingDetails => {
  return {
    billingProjectName: billingProject.projectName,
    cloudPlatform: _.toUpper(billingProject.cloudPlatform), // Should already be uppercase, but enforce for consistency.
  };
};

export const PageViewReporter = (): ReactNode => {
  const { name, params } = useRoute();

  useEffect(() => {
    const isWorkspace = /^#workspaces\/.+\/.+/.test(window.location.hash);

    Ajax().Metrics.captureEvent(
      `${eventsList.pageView}:${name}`,
      isWorkspace ? extractWorkspaceDetails(params) : undefined
    );
  }, [name, params]);

  return null;
};

export const captureAppcuesEvent = (eventName: string, event: any) => {
  // Only record "public-facing events" (and related properties) as documented by Appcues: https://docs.appcues.com/article/301-client-side-events-reference
  const publicEvents = [
    'flow_started',
    'flow_completed',
    'flow_skipped',
    'flow_aborted',
    'step_started',
    'step_completed',
    'step_skipped',
    'step_aborted',
    'step_interacted',
    'form_submitted',
    'form_field_submitted',
  ];
  if (_.includes(eventName, publicEvents)) {
    const eventProps = {
      // Building the props manually to make sure we're resilient to any changes in Appcues
      'appcues.flowId': event.flowId,
      'appcues.flowName': event.flowName,
      'appcues.flowType': event.flowType,
      'appcues.flowVersion': event.flowVersion,
      'appcues.id': event.id,
      'appcues.interaction.category': event.interaction?.category,
      'appcues.interaction.destination': event.interaction?.destination,
      'appcues.interaction.element': event.interaction?.element,
      'appcues.interaction.fields': JSON.stringify(event.interaction?.fields),
      'appcues.interaction.formId': event.interaction?.formId,
      'appcues.interaction.text': event.interaction?.text, // not documented by Appcues, but observed and useful
      'appcues.interaction.label': event.interaction?.label,
      'appcues.interaction.response': event.interaction?.response,
      'appcues.interaction.value': event.interaction?.value,
      'appcues.interactionType': event.interactionType,
      'appcues.localeId': event.localeId,
      'appcues.localeName': event.localeName,
      'appcues.name': event.name,
      'appcues.sessionId': event.sessionId,
      'appcues.stepChildId': event.stepChildId,
      'appcues.stepChildNumber': event.stepChildNumber,
      'appcues.stepId': event.stepId,
      'appcues.stepNumber': event.stepNumber,
      'appcues.stepType': event.stepType,
      'appcues.timestamp': event.timestamp,
    };
    return Ajax().Metrics.captureEvent(eventsList.appcuesEvent, eventProps);
  }
};

export default eventsList;
