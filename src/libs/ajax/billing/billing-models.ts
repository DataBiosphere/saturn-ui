import { WorkspacePolicy } from 'src/libs/ajax/workspaces/workspace-models';

export interface GoogleBillingAccount {
  accountName: string;
  firecloudHasAccess?: boolean;
  displayName: string;
}

export interface AzureManagedAppCoordinates {
  tenantId: string; // UUID as string
  subscriptionId: string; // UUID as string
  managedResourceGroupId: string;
  region?: string;
  applicationDeploymentName?: string;
}

export interface Organization {
  enterprise?: boolean;

  /** Resource limits for the billing profile. */
  limits?: { [resource: string]: unknown };
}

export type CloudPlatform = 'GCP' | 'AZURE' | 'UNKNOWN';

export type BillingRole = 'Owner' | 'User';

export interface BillingProjectMember {
  email: string;
  role: BillingRole;
}

interface BaseBillingProject {
  cloudPlatform: CloudPlatform;
  projectName: string;
  invalidBillingAccount: boolean;
  roles: BillingRole[];
  status: 'Creating' | 'Ready' | 'Error' | 'Deleting' | 'DeletionFailed' | 'AddingToPerimeter' | 'CreatingLandingZone';
  message?: string;
}

export interface AzureBillingProject extends BaseBillingProject {
  cloudPlatform: 'AZURE';
  managedAppCoordinates: AzureManagedAppCoordinates;
  landingZoneId: string;
  protectedData: boolean;
  region?: string; // was backfilled for billing projects with valid MRG info
  organization?: Organization;
}

export interface GCPBillingProject extends BaseBillingProject {
  cloudPlatform: 'GCP';
  billingAccount: string;
  servicePerimeter?: string;
}

export const isAzureBillingProject = (project?: BillingProject): project is AzureBillingProject =>
  isCloudProviderBillingProject(project, 'AZURE');

export const isGoogleBillingProject = (project?: BillingProject): project is GCPBillingProject =>
  isCloudProviderBillingProject(project, 'GCP');

const isCloudProviderBillingProject = (project: BillingProject | undefined, cloudProvider: CloudPlatform): boolean =>
  project?.cloudPlatform === cloudProvider;

export interface UnknownBillingProject extends BaseBillingProject {
  cloudPlatform: 'UNKNOWN';
}

export type BillingProject = AzureBillingProject | GCPBillingProject | UnknownBillingProject;

export interface BillingProfile {
  id: string;
  biller: 'direct';
  displayName: string;
  description: string;
  cloudPlatform: CloudPlatform;
  tenantId?: string;
  subscriptionId?: string;
  managedResourceGroupId?: string;
  createdDate: string;
  lastModified: string;
  createdBy: string;
  policies: {
    inputs: WorkspacePolicy[];
  };
  organization: Organization;
}

// Interfaces for dealing with the server SpendReport JSON response
export interface CategorySpendData {
  category: 'Compute' | 'Storage' | 'WorkspaceInfrastructure' | 'Other';
  cost: string;
  credits: string;
  currency: string;
}

export interface WorkspaceSpendData {
  cost: string;
  credits: string;
  currency: string;
  googleProjectId: string;
  subAggregation: { aggregationKey: 'Category'; spendData: CategorySpendData[] };
  workspace: { name: string; namespace: string };
}

interface AggregatedSpendData {
  aggregationKey: 'Workspace' | 'Category';
}

export interface AggregatedWorkspaceSpendData extends AggregatedSpendData {
  aggregationKey: 'Workspace';
  spendData: WorkspaceSpendData[];
}

export interface AggregatedCategorySpendData extends AggregatedSpendData {
  aggregationKey: 'Category';
  spendData: CategorySpendData[];
}

export interface SpendReport {
  spendDetails: AggregatedSpendData[];
  spendSummary: {
    cost: string;
    credits: string;
    currency: string;
    endTime: string;
    startTime: string;
  };
}
// End of interfaces for dealing with the server SpendReport JSON response
