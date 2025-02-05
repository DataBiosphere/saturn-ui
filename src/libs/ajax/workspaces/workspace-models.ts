/**
 * Type for Rawls's MethodRepoMethod schema.
 *
 * Note: Some properties that are optional here are marked as required in the
 * schema, but the Rawls API does not always include them in its responses.
 */
export interface MethodRepoMethod {
  methodNamespace?: string;
  methodName?: string;
  methodVersion: number | string;
  methodPath?: string;
  sourceRepo?: string;
  methodUri?: string;
}

/**
 * Type for Rawls's MethodConfiguration schema.
 *
 * Note: Some properties that are optional here are marked as required in the
 * schema, but the Rawls API does not always include them in its responses.
 */
export interface MethodConfiguration {
  namespace: string;
  name: string;
  rootEntityType?: string;
  inputs?: any;
  outputs?: any;
  methodRepoMethod: MethodRepoMethod;
  methodConfigVersion?: number;
  deleted?: boolean;
  dataReferenceName?: string;
}

// TYPES RELATED TO WORKSPACE SETTINGS
export type WorkspaceSetting =
  | BucketLifecycleSetting
  | SoftDeleteSetting
  | RequesterPaysSetting
  | BatchSetting
  | SeparateSubmissionFinalOutputsSetting;

export interface BucketLifecycleSetting {
  settingType: 'GcpBucketLifecycle';
  config: { rules: BucketLifecycleRule[] };
}

export interface SoftDeleteSetting {
  settingType: 'GcpBucketSoftDelete';
  config: { retentionDurationInSeconds: number };
}

export interface RequesterPaysSetting {
  settingType: 'GcpBucketRequesterPays';
  config: { enabled: boolean };
}

export interface BatchSetting {
  settingType: 'UseCromwellGcpBatchBackend';
  config: { enabled: boolean };
}

export interface SeparateSubmissionFinalOutputsSetting {
  settingType: 'SeparateSubmissionFinalOutputs';
  config: { enabled: boolean };
}

export interface BucketLifecycleRule {
  action: {
    actionType: string;
  };
  conditions?: any;
}

export interface DeleteBucketLifecycleRule extends BucketLifecycleRule {
  action: {
    actionType: 'Delete';
  };
  conditions: {
    age: number;
    matchesPrefix: string[];
  };
}

// TYPES RELATED TO WORKSPACE INFO
export interface WorkspacePolicy {
  name: string;
  namespace: string;
  additionalData: { [key: string]: string }[];
}

export type AuthorizationDomain = {
  membersGroupName: string;
};

export type WorkspaceState =
  | 'Creating'
  | 'CreateFailed'
  | 'Cloning'
  | 'CloningContainer'
  | 'CloningFailed'
  | 'Ready'
  | 'Updating'
  | 'UpdateFailed'
  | 'Deleting'
  | 'DeleteFailed'
  | 'Deleted'; // For UI only - not a state in rawls

// TODO: Clean up all the optional types when we fix return types of all the places we retrieve workspaces
export interface BaseWorkspaceInfo {
  namespace: string;
  name: string;
  workspaceId: string;
  authorizationDomain: AuthorizationDomain[];
  createdDate: string;
  createdBy: string;
  lastModified: string;
  attributes?: Record<string, unknown>;
  isLocked?: boolean;
  state?: WorkspaceState;
  errorMessage?: string;
  completedCloneWorkspaceFileTransfer?: string;
  workspaceType?: 'mc' | 'rawls';
  workspaceVersion?: string;
  totalSpend?: string;
  totalCompute?: string;
  totalStorage?: string;
}

export interface AzureWorkspaceInfo extends BaseWorkspaceInfo {
  cloudPlatform: 'Azure';
  bucketName?: '';
  googleProject?: '';
}

export interface GoogleWorkspaceInfo extends BaseWorkspaceInfo {
  cloudPlatform: 'Gcp';
  googleProject: string;
  billingAccount: string;
  bucketName: string;
}

export type WorkspaceInfo = AzureWorkspaceInfo | GoogleWorkspaceInfo;

export interface WorkspaceSubmissionStats {
  lastSuccessDate?: string;
  lastFailureDate?: string;
  runningSubmissionsCount: number;
}

export const workspaceAccessLevels = ['NO ACCESS', 'READER', 'WRITER', 'OWNER', 'PROJECT_OWNER'] as const;

export type WorkspaceAccessLevels = typeof workspaceAccessLevels;

export type WorkspaceAccessLevel = WorkspaceAccessLevels[number];

export interface BaseWorkspace {
  owners?: string[];
  accessLevel: WorkspaceAccessLevel;
  canShare: boolean;
  canCompute: boolean;
  workspace: WorkspaceInfo;
  policies: WorkspacePolicy[];
  public?: boolean;
  workspaceSubmissionStats?: WorkspaceSubmissionStats;
}

export interface AzureContext {
  managedResourceGroupId: string;
  subscriptionId: string;
  tenantId: string;
}

export interface AzureWorkspace extends BaseWorkspace {
  azureContext: AzureContext;
}

export interface GoogleWorkspace extends BaseWorkspace {
  workspace: GoogleWorkspaceInfo;
}

export type WorkspaceWrapper = GoogleWorkspace | AzureWorkspace;

// BODY FOR WORKSPACE CREATE AND CLONE REQUEST
export interface WorkspaceRequest {
  namespace: string;
  name: string;
  authorizationDomain: AuthorizationDomain[];
  attributes: Record<string, unknown>;
  bucketLocation?: string;
  enhancedBucketLogging?: boolean;
  policies?: WorkspacePolicy[];
}

export interface WorkspaceRequestClone extends Omit<WorkspaceRequest, 'policies'> {
  copyFilesWithPrefix?: string;
}

// TAGS
export interface WorkspaceTag {
  tag: string;
  count: number;
}

// Workspace ACL
// a map of email -> RawAccessEntry
export type RawWorkspaceAcl = { [key: string]: RawAccessEntry };

export interface RawAccessEntry {
  pending: boolean;
  canShare: boolean;
  canCompute: boolean;
  accessLevel: WorkspaceAccessLevel;
}

export interface WorkspaceAclUpdate {
  email: string;
  accessLevel: WorkspaceAccessLevel;
  canShare?: boolean;
  canCompute?: boolean;
}

// Entities, see also EntityServiceDataTableProvider.ts
export interface EntityUpdateDefinition {
  name: string;
  entityType: string;
  operations: any[];
}

export interface AttributeEntityReference {
  entityType: string;
  entityName: string;
}

export interface StorageCostEstimate {
  estimate: string;
  lastUpdated?: string;
}

export interface BucketUsageResponse {
  usageInBytes: number;
  lastUpdated?: string;
}

export interface Workflow {
  cost: bigint;
  inputResolutions: {
    value: any;
    error: string;
    inputName: string;
  }[];
  messages: string[];
  status: string;
  statusLastChangedDate: string;
  workflowEntity: {
    entityType: string;
    entityName: string;
  };
  workflowId: string;
}
