import { jsonBody } from '@terra-ui-packages/data-client-core';
import _ from 'lodash/fp';
import { authOpts } from 'src/auth/auth-session';
import { fetchWDS } from 'src/libs/ajax/ajax-common';
import {
  RecordQueryResponse,
  RecordResponseBody,
  RecordTypeSchema,
  SearchRequest,
  TsvUploadResponse,
} from 'src/libs/ajax/data-table-providers/WdsDataTableProvider';

export type WDSVersionResponse = {
  // Older versions of WDS may not have the "app" field.
  app?: {
    'chart-version': string;
    image: string;
  };
  build: {
    artifact: string;
    name: string;
    time: string;
    version: string;
    group: string;
  };
  git: {
    branch: string;
    commit: {
      id: string;
      time: string;
    };
  };
};

export type WDSCloneStatusResponse = {
  created: string;
  errorMessage?: string;
  exception?: string;
  jobId: string;
  result: {
    sourceWorkspaceId: string;
    status: string;
  };
  status: string;
  updated: string;
};

export interface WDSJob {
  created: string;
  errorMessage: string | null;
  input: null;
  jobId: string;
  jobType: 'DATA_IMPORT' | 'UNKNOWN';
  result: null;
  status: 'CREATED' | 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'ERROR' | 'CANCELLED' | 'UNKNOWN';
  updated: string;
}

export type AttributeSchemaUpdate = { name: string } | { datatype: string };

// The source of truth of available capabilities can be found in:
// https://github.com/DataBiosphere/terra-workspace-data-service/blob/main/service/src/main/resources/capabilities.json
// This list should only contain capabilities actively required or supported by the UI.
// If a capability is no longer necessary (because all live WDS instances now support it),
// care should be taken to prune the conditional logic that relies on the capability, and
// then the capability should be removed.
type SupportedCapability = 'capabilities' | 'edit.deleteAttribute';
type UnusedCapability = string;
export type Capability = SupportedCapability | UnusedCapability;

// Capabilities is just a kvp map of capability name to boolean. The value is true if the capability is enabled, false otherwise.
export type Capabilities = {
  [key in Capability]: boolean;
};

export const WorkspaceData = (signal?: AbortSignal) => ({
  getSchema: async (root: string, instanceId: string): Promise<RecordTypeSchema[]> => {
    const res = await fetchWDS(root)(`${instanceId}/types/v0.2`, _.merge(authOpts(), { signal }));
    return res.json();
  },
  getRecords: async (
    root: string,
    instanceId: string,
    recordType: string,
    parameters: SearchRequest
  ): Promise<RecordQueryResponse> => {
    const res = await fetchWDS(root)(
      `${instanceId}/search/v0.2/${recordType}`,
      _.mergeAll([authOpts(), jsonBody(parameters), { signal, method: 'POST' }])
    );
    return res.json();
  },
  getCapabilities: async (root: string): Promise<Capabilities> => {
    return fetchWDS(root)('capabilities/v1', _.mergeAll([authOpts(), { signal, method: 'GET' }]))
      .then(async (response) => {
        const json = await response.json();
        const capabilities: Capabilities = _.mapValues((value) => value === true, json);
        return capabilities;
      })
      .catch((error) => {
        if (error instanceof Response && error.status === 404) {
          return { capabilities: false } as Capabilities;
        }
        throw error;
      });
  },
  deleteTable: async (root: string, instanceId: string, recordType: string): Promise<Response> => {
    const res = await fetchWDS(root)(
      `${instanceId}/types/v0.2/${recordType}`,
      _.mergeAll([authOpts(), { signal, method: 'DELETE' }])
    );
    return res;
  },
  deleteColumn: async (
    root: string,
    instanceId: string,
    recordType: string,
    attributeName: string
  ): Promise<Response> => {
    const res = await fetchWDS(root)(
      `${instanceId}/types/v0.2/${recordType}/${attributeName}`,
      _.mergeAll([authOpts(), { signal, method: 'DELETE' }])
    );
    return res;
  },
  downloadTsv: async (root: string, instanceId: string, recordType: string): Promise<Blob> => {
    const res = await fetchWDS(root)(`${instanceId}/tsv/v0.2/${recordType}`, _.merge(authOpts(), { signal }));
    const blob = await res.blob();
    return blob;
  },
  uploadTsv: async (root: string, instanceId: string, recordType: string, file: File): Promise<TsvUploadResponse> => {
    const formData = new FormData();
    formData.set('records', file);
    const res = await fetchWDS(root)(
      `${instanceId}/tsv/v0.2/${recordType}`,
      _.mergeAll([authOpts(), { body: formData, signal, method: 'POST' }])
    );
    return res.json();
  },
  updateRecord: async (
    root: string,
    instanceId: string,
    recordType: string,
    recordId: string,
    record: { [attribute: string]: any }
  ): Promise<RecordResponseBody> => {
    const res = await fetchWDS(root)(
      `${instanceId}/records/v0.2/${recordType}/${recordId}`,
      _.mergeAll([authOpts(), jsonBody(record), { signal, method: 'PATCH' }])
    );
    return res.json();
  },
  getVersion: async (root: string): Promise<WDSVersionResponse> => {
    const res = await fetchWDS(root)('version', _.merge(authOpts(), { signal }));
    return res.json();
  },
  getStatus: async (root: string): Promise<any> => {
    const res = await fetchWDS(root)('status', _.merge(authOpts(), { signal }));
    return res.json();
  },
  listCollections: async (root: string, workspaceId: string): Promise<any> => {
    try {
      const response = await fetchWDS(root)(`collections/v1/${workspaceId}`, _.merge(authOpts(), { signal }));
      const data = await response.json();
      return data.map((collection) => collection.id);
    } catch (error) {
      if (error instanceof Response && error.status === 404) {
        return await fetchWDS(root)('instances/v0.2', _.merge(authOpts(), { signal })).then((response) =>
          response.json()
        );
      }
      throw error;
    }
  },
  getCloneStatus: async (root: string): Promise<WDSCloneStatusResponse> => {
    const res = await fetchWDS(root)('clone/v0.2', _.merge(authOpts(), { signal }));
    return res.json();
  },
  startImportJob: async (
    root: string,
    instanceId: string,
    file: { url: string; type: 'PFB' | 'TDRMANIFEST' }
  ): Promise<WDSJob> => {
    const res = await fetchWDS(root)(
      `${instanceId}/import/v1`,
      _.mergeAll([authOpts(), { method: 'POST' }, jsonBody(file)])
    );
    return await res.json();
  },
  queryRecords: async (root: string, instanceId: string, wdsType: string, searchLimit: number): Promise<any> => {
    const searchPayload = { limit: searchLimit };
    const res = await fetchWDS(root)(
      `${instanceId}/search/v0.2/${wdsType}`,
      _.mergeAll([authOpts(), { signal, method: 'POST' }, jsonBody(searchPayload)])
    );
    const resultJson = await res.json();
    resultJson.records = _.map(_.unset('attributes.sys_name'), resultJson.records);
    return resultJson;
  },
  describeAllRecordTypes: async (root: string, instanceId: string): Promise<any> => {
    const res = await fetchWDS(root)(`${instanceId}/types/v0.2`, _.mergeAll([authOpts(), { signal, method: 'GET' }]));
    return _.map(
      (type) =>
        _.set(
          'attributes',
          _.filter((attr) => attr.name !== 'sys_name', type.attributes),
          type
        ),
      await res.json()
    );
  },
  getJobStatus: async (root: string, jobId: string): Promise<WDSJob> => {
    const res = await fetchWDS(root)(`job/v1/${jobId}`, _.merge(authOpts(), { signal }));
    return res.json();
  },
  updateAttribute: async (
    root: string,
    instanceId: string,
    recordType: string,
    oldAttribute: string,
    newAttribute: AttributeSchemaUpdate
  ): Promise<any> => {
    const res = await fetchWDS(root)(
      `${instanceId}/types/v0.2/${recordType}/${oldAttribute}`,
      _.mergeAll([authOpts(), jsonBody(newAttribute), { signal, method: 'PATCH' }])
    );
    return res.json();
  },
});

export type WorkspaceDataAjaxContract = ReturnType<typeof WorkspaceData>;
