import { Billing } from 'src/libs/ajax/billing/Billing';
import { DataRepo } from 'src/libs/ajax/DataRepo';
import { Groups } from 'src/libs/ajax/Groups';
import { FullyQualifiedResourceId } from 'src/libs/ajax/SamResources';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';

export type SupportSummary = object;

export interface ResourceTypeSummaryProps {
  displayName: string;
  fqResourceId: FullyQualifiedResourceId;
  loadSupportSummaryFn: ((id: FullyQualifiedResourceId) => Promise<SupportSummary>) | undefined;
}

export interface SupportResourceType {
  displayName: string;
  resourceType: string;
  loadSupportSummaryFn: ((id: FullyQualifiedResourceId) => Promise<SupportSummary>) | undefined;
}

// Define the supported resources, add your own here
export const supportResources: SupportResourceType[] = [
  {
    displayName: 'Group',
    resourceType: 'managed-group',
    loadSupportSummaryFn: (id: FullyQualifiedResourceId) => Groups().group(id.resourceId).getSupportSummary(),
  },
  {
    displayName: 'Workspace',
    resourceType: 'workspace',
    loadSupportSummaryFn: (id: FullyQualifiedResourceId) => Workspaces().adminGetById(id.resourceId),
  },
  {
    displayName: 'Billing Project',
    resourceType: 'billing-project',
    loadSupportSummaryFn: (id: FullyQualifiedResourceId) => Billing().adminGetProject(id.resourceId),
  },
  {
    displayName: 'Dataset',
    resourceType: 'dataset',
    loadSupportSummaryFn: (id: FullyQualifiedResourceId) => DataRepo().admin().adminRetrieveDataset(id.resourceId),
  },
  {
    displayName: 'Snapshot',
    resourceType: 'datasnapshot',
    loadSupportSummaryFn: (id: FullyQualifiedResourceId) => DataRepo().admin().adminRetrieveSnapshot(id.resourceId),
  },
].sort((a, b) => a.displayName.localeCompare(b.displayName));
