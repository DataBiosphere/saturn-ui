import * as _ from 'lodash/fp';
import { authOpts, fetchDataRepo, jsonBody } from 'src/libs/ajax/ajax-common';

/** API types represent the data of UI types in the format expected by the backend.
 * They are generally subsets or mappings of the UI types. */

export type SnapshotBuilderConcept = {
  id: number;
  name: string;
  code: string;
  count: number;
  hasChildren: boolean;
};

/** Program Data Option Types */
export type SnapshotBuilderOptionTypeNames = 'list' | 'range' | 'domain';
export interface SnapshotBuilderOption {
  kind: SnapshotBuilderOptionTypeNames;
  name: string;
  id: number;
  tableName: string;
  columnName: string;
}

export interface SnapshotBuilderProgramDataOption extends SnapshotBuilderOption {
  kind: 'range' | 'list';
}

export interface SnapshotBuilderProgramDataListItem {
  name: string;
  id: number;
}

export interface SnapshotBuilderProgramDataListOption extends SnapshotBuilderProgramDataOption {
  kind: 'list';
  values: SnapshotBuilderProgramDataListItem[];
}

export interface SnapshotBuilderProgramDataRangeOption extends SnapshotBuilderProgramDataOption {
  kind: 'range';
  min: number;
  max: number;
}
export interface SnapshotBuilderDomainOption extends SnapshotBuilderOption {
  kind: 'domain';
  root: SnapshotBuilderConcept;
  conceptCount: number;
  participantCount: number;
}

export interface DatasetBuilderType {
  name: string;
}

export interface SnapshotBuilderDatasetConceptSet extends DatasetBuilderType {
  featureValueGroupName: string;
}

export type SnapshotBuilderSettings = {
  domainOptions: SnapshotBuilderDomainOption[];
  programDataOptions: (SnapshotBuilderProgramDataListOption | SnapshotBuilderProgramDataRangeOption)[];
  featureValueGroups: SnapshotBuilderFeatureValueGroup[];
  datasetConceptSets: SnapshotBuilderDatasetConceptSet[];
};

/** Criteria */
export interface SnapshotBuilderCriteria {
  // This is the ID for either the domain or the program data option
  id: number;
  kind: SnapshotBuilderOptionTypeNames;
}

export interface SnapshotBuilderDomainCriteria extends SnapshotBuilderCriteria {
  kind: 'domain';
  // This is the id for the selected concept
  conceptId: number;
}

export interface SnapshotBuilderProgramDataRangeCriteria extends SnapshotBuilderCriteria {
  kind: 'range';
  low: number;
  high: number;
}

export interface SnapshotBuilderProgramDataListCriteria extends SnapshotBuilderCriteria {
  kind: 'list';
  values: number[];
}

export type AnySnapshotBuilderCriteria =
  | SnapshotBuilderDomainCriteria
  | SnapshotBuilderProgramDataRangeCriteria
  | SnapshotBuilderProgramDataListCriteria;
export interface SnapshotBuilderCriteriaGroup {
  name: string;
  criteria: AnySnapshotBuilderCriteria[];
  mustMeet: boolean;
  meetAll: boolean;
}

export interface SnapshotBuilderCohort extends DatasetBuilderType {
  criteriaGroups: SnapshotBuilderCriteriaGroup[];
}

export type SnapshotBuilderFeatureValueGroup = {
  name: string;
  values: string[];
};

export type SnapshotBuilderRequest = {
  cohorts: SnapshotBuilderCohort[];
  conceptSets: SnapshotBuilderDatasetConceptSet[];
  valueSets: SnapshotBuilderFeatureValueGroup[];
};

export interface SnapshotDataset {
  id: string;
  name: string;
  secureMonitoringEnabled: boolean;
}

export interface Snapshot {
  id: string;
  name: string;
  description: string;
  createdDate: string;
  source: { dataset: SnapshotDataset }[];
  properties: any;
  cloudPlatform: 'azure' | 'gcp';
}

/** Dataset Types */
// TODO - can we remove these?
export type DatasetModel = {
  id: string;
  name: string;
  description: string;
  createdDate: string;
  properties: any;
  snapshotBuilderSettings?: SnapshotBuilderSettings;
};

type DatasetInclude =
  | 'NONE'
  | 'SCHEMA'
  | 'ACCESS_INFORMATION'
  | 'PROFILE'
  | 'PROPERTIES'
  | 'DATA_PROJECT'
  | 'STORAGE'
  | 'SNAPSHOT_BUILDER_SETTINGS';

export const datasetIncludeTypes: Record<DatasetInclude, DatasetInclude> = {
  NONE: 'NONE',
  SCHEMA: 'SCHEMA',
  ACCESS_INFORMATION: 'ACCESS_INFORMATION',
  PROFILE: 'PROFILE',
  PROPERTIES: 'PROPERTIES',
  DATA_PROJECT: 'DATA_PROJECT',
  STORAGE: 'STORAGE',
  SNAPSHOT_BUILDER_SETTINGS: 'SNAPSHOT_BUILDER_SETTINGS',
};

/** Jobs */
export type JobStatus = 'running' | 'succeeded' | 'failed';

export const jobStatusTypes: Record<JobStatus, JobStatus> = {
  running: 'running',
  succeeded: 'succeeded',
  failed: 'failed',
};

export interface JobModel {
  id: string;
  description?: string;
  job_status: JobStatus;
  status_code: number;
  submitted?: string;
  completed?: string;
  class_name?: string;
}

/** Response */
export interface SnapshotBuilderGetConceptsResponse {
  result: SnapshotBuilderConcept[];
}
export interface SnapshotBuilderGetConceptHierarchyResponse {
  result: SnapshotBuilderParentConcept[];
}
export interface SnapshotBuilderParentConcept {
  parentId: number;
  children: SnapshotBuilderConcept[];
}
export interface SnapshotAccessRequestResponse {
  id: string; // uuid
  datasetId: string; // uuid
  snapshotId: string; // uuid
  snapshotName: string;
  snapshotResearchPurpose: string;
  snapshotSpecification: SnapshotAccessRequest;
  createdBy: string;
  status: JobStatus;
}

export type SnapshotBuilderCountResponse = {
  result: {
    total: number;
  };
  sql: string;
};

/** Requests */
export type SnapshotBuilderCountRequest = {
  cohorts: SnapshotBuilderCohort[];
};

export type SnapshotAccessRequest = {
  name: string;
  researchPurposeStatement: string;
  datasetRequest: SnapshotBuilderRequest;
};

export interface DataRepoContract {
  dataset: (datasetId: string) => {
    details: (include?: DatasetInclude[]) => Promise<DatasetModel>;
    roles: () => Promise<string[]>;
  };
  snapshotAccessRequest: () => {
    createSnapshotAccessRequest: (request: SnapshotAccessRequest) => Promise<SnapshotAccessRequestResponse>;
  };
  snapshot: (snapshotId: string) => {
    details: () => Promise<Snapshot>;
    roles: () => Promise<string[]>;
    exportSnapshot: () => Promise<JobModel>;
    getSnapshotBuilderSettings: () => Promise<SnapshotBuilderSettings>;
    getSnapshotBuilderCount(request: SnapshotBuilderCountRequest): Promise<SnapshotBuilderCountResponse>;
    getConceptChildren(parent: SnapshotBuilderConcept): Promise<SnapshotBuilderGetConceptsResponse>;
    getConceptHierarchy(concept: SnapshotBuilderConcept): Promise<SnapshotBuilderGetConceptHierarchyResponse>;
    enumerateConcepts(domain: SnapshotBuilderConcept, text: string): Promise<SnapshotBuilderGetConceptsResponse>;
  };
  job: (jobId: string) => {
    details: () => Promise<JobModel>;
    result: () => Promise<{}>;
  };
}

const callDataRepo = async (url: string, signal?: AbortSignal) => {
  const res = await fetchDataRepo(url, _.merge(authOpts(), { signal }));
  return await res.json();
};

const callDataRepoPost = async (url: string, signal: AbortSignal | undefined, jsonBodyArg?: object): Promise<any> => {
  const res = await fetchDataRepo(
    url,
    _.mergeAll([authOpts(), jsonBodyArg && jsonBody(jsonBodyArg), { signal, method: 'POST' }])
  );
  return await res.json();
};

export const DataRepo = (signal?: AbortSignal): DataRepoContract => ({
  dataset: (datasetId) => {
    return {
      details: async (include): Promise<DatasetModel> =>
        callDataRepo(`repository/v1/datasets/${datasetId}?include=${_.join(',', include)}`, signal),
      roles: async (): Promise<string[]> => callDataRepo(`repository/v1/datasets/${datasetId}/roles`, signal),
    };
  },
  snapshotAccessRequest: () => {
    return {
      createSnapshotAccessRequest: async (request: SnapshotAccessRequest): Promise<SnapshotAccessRequestResponse> =>
        callDataRepoPost('repository/v1/snapshotAccessRequests', signal, request),
    };
  },
  snapshot: (snapshotId) => {
    return {
      details: async () => callDataRepo(`repository/v1/snapshots/${snapshotId}`, signal),
      roles: async (): Promise<string[]> => callDataRepo(`repository/v1/snapshots/${snapshotId}/roles`, signal),
      exportSnapshot: async () =>
        callDataRepo(`repository/v1/snapshots/${snapshotId}/export?validatePrimaryKeyUniqueness=false`, signal),
      getSnapshotBuilderSettings: async (): Promise<SnapshotBuilderSettings> =>
        callDataRepo(`repository/v1/snapshots/${snapshotId}/snapshotBuilder/settings`, signal),
      getSnapshotBuilderCount: async (request: SnapshotBuilderCountRequest): Promise<SnapshotBuilderCountResponse> =>
        callDataRepoPost(`repository/v1/snapshots/${snapshotId}/snapshotBuilder/count`, signal, request),
      getConceptChildren: async (parent: SnapshotBuilderConcept): Promise<SnapshotBuilderGetConceptsResponse> =>
        callDataRepo(`repository/v1/snapshots/${snapshotId}/snapshotBuilder/concepts/${parent.id}/children`),
      enumerateConcepts: async (
        domain: SnapshotBuilderConcept,
        filterText: string
      ): Promise<SnapshotBuilderGetConceptsResponse> =>
        callDataRepo(
          `repository/v1/snapshots/${snapshotId}/snapshotBuilder/concepts?domainId=${
            domain.id
          }&filterText=${encodeURIComponent(filterText)}`
        ),
      getConceptHierarchy: async (concept: SnapshotBuilderConcept) =>
        callDataRepo(`repository/v1/snapshots/${snapshotId}/snapshotBuilder/concepts/${concept.id}/hierarchy`),
    };
  },
  job: (jobId) => ({
    details: async () => callDataRepo(`repository/v1/jobs/${jobId}`, signal),
    result: async () => callDataRepo(`repository/v1/jobs/${jobId}/result`, signal),
  }),
});
