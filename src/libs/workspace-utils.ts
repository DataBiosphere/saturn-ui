import _ from 'lodash/fp';

export type CloudProvider = 'AZURE' | 'GCP';
export const cloudProviderTypes: Record<CloudProvider, CloudProvider> = {
  AZURE: 'AZURE',
  GCP: 'GCP',
};

export const cloudProviderLabels: Record<CloudProvider, string> = {
  AZURE: 'Microsoft Azure',
  GCP: 'Google Cloud Platform',
};

export const isKnownCloudProvider = (x: unknown): x is CloudProvider => {
  return (x as string) in cloudProviderTypes;
};

export interface BaseWorkspaceInfo {
  namespace: string;
  name: string;
  workspaceId: string;
  cloudPlatform: string;
  authorizationDomain: string[];
  createdDate: string;
  createdBy: string;
}

export type AzureWorkspaceInfo = BaseWorkspaceInfo;

export interface GoogleWorkspaceInfo extends BaseWorkspaceInfo {
  googleProject: string;
  bucketName: string;
}

export type WorkspaceInfo = AzureWorkspaceInfo | GoogleWorkspaceInfo;

export const isGoogleWorkspaceInfo = (workspace: WorkspaceInfo): workspace is GoogleWorkspaceInfo => {
  return workspace.cloudPlatform === 'Gcp';
};

export const workspaceAccessLevels = ['NO ACCESS', 'READER', 'WRITER', 'OWNER', 'PROJECT_OWNER'] as const;

export type WorkspaceAccessLevels = typeof workspaceAccessLevels;

export type WorkspaceAccessLevel = WorkspaceAccessLevels[number];

export const hasAccessLevel = (required: WorkspaceAccessLevel, current: WorkspaceAccessLevel): boolean => {
  return workspaceAccessLevels.indexOf(current) >= workspaceAccessLevels.indexOf(required);
};

export interface BaseWorkspace {
  accessLevel: WorkspaceAccessLevel;
  canShare: boolean;
  canCompute: boolean;
  workspace: WorkspaceInfo;
}

export interface AzureContext {
  managedResourceGroupId: string;
  subscriptionId: string;
  tenantId: string;
}

export interface AzureWorkspace extends BaseWorkspace {
  azureContext: AzureContext;
  policies?: { name: string; namespace: string; additionalData: { [key: string]: string } }[];
}

export interface GoogleWorkspace extends BaseWorkspace {
  workspace: GoogleWorkspaceInfo;
}

export type WorkspaceWrapper = GoogleWorkspace | AzureWorkspace;

export const isAzureWorkspace = (workspace: BaseWorkspace): workspace is AzureWorkspace => {
  return workspace.workspace.cloudPlatform === 'Azure';
};

export const isGoogleWorkspace = (workspace: BaseWorkspace): workspace is GoogleWorkspace => {
  return isGoogleWorkspaceInfo(workspace.workspace);
};

export const getCloudProviderFromWorkspace = (workspace: BaseWorkspace): CloudProvider =>
  isAzureWorkspace(workspace) ? cloudProviderTypes.AZURE : cloudProviderTypes.GCP;

export const hasProtectedData = (workspace: AzureWorkspace): boolean =>
  _.any((policy) => policy.namespace === 'terra' && policy.name === 'protected-data', workspace.policies);
