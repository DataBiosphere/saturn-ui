import { jsonBody } from '@terra-ui-packages/data-client-core';
import _ from 'lodash/fp';
import * as qs from 'qs';
import { authOpts } from 'src/auth/auth-session';
import { fetchOrchestration, fetchRawls } from 'src/libs/ajax/ajax-common';
import { Entity, EntityQueryResponse } from 'src/libs/ajax/data-table-providers/DataTableProvider';
import { fetchOk } from 'src/libs/ajax/fetch/fetch-core';
import { GoogleStorage } from 'src/libs/ajax/GoogleStorage';
import { FieldsArg } from 'src/libs/ajax/workspaces/providers/WorkspaceProvider';
import {
  AttributeEntityReference,
  BucketUsageResponse,
  EntityUpdateDefinition,
  MethodConfiguration,
  RawWorkspaceAcl,
  StorageCostEstimate,
  WorkspaceAclUpdate,
  WorkspaceInfo,
  WorkspaceRequest,
  WorkspaceRequestClone,
  WorkspaceSetting,
  WorkspaceTag,
  WorkspaceWrapper,
} from 'src/libs/ajax/workspaces/workspace-models';
import { getTerraUser } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { SupportSummary } from 'src/support/SupportResourceType';

const getSnapshotEntityMetadata = Utils.memoizeAsync(
  async (
    token: string | undefined,
    workspaceNamespace: string,
    workspaceName: string,
    googleProject: string,
    dataReference: string
  ) => {
    const res = await fetchRawls(
      `workspaces/${workspaceNamespace}/${workspaceName}/entities?billingProject=${googleProject}&dataReference=${dataReference}`,
      authOpts(token)
    );
    return res.json();
  },
  { keyFn: (...args) => JSON.stringify(args) }
);

const attributesUpdateOps = _.flow(
  _.toPairs,
  _.flatMap(([k, v]) => {
    return _.isArray(v)
      ? [
          { op: 'RemoveAttribute', attributeName: k },
          ...(_.isObject(v[0])
            ? [{ op: 'CreateAttributeEntityReferenceList', attributeListName: k }]
            : [{ op: 'CreateAttributeValueList', attributeName: k }]),
          ..._.map((x) => ({ op: 'AddListMember', attributeListName: k, newMember: x }), v),
        ]
      : [{ op: 'AddUpdateAttribute', attributeName: k, addUpdateAttribute: v }];
  })
);
export const Workspaces = (signal?: AbortSignal) => ({
  list: async (fields: FieldsArg, stringAttributeMaxLength: number | undefined): Promise<WorkspaceWrapper[]> => {
    // isNil checks null and undefined
    const lenParam = _.isNil(stringAttributeMaxLength) ? '' : `stringAttributeMaxLength=${stringAttributeMaxLength}&`;
    const res = await fetchRawls(
      `workspaces?${lenParam}${qs.stringify({ fields }, { arrayFormat: 'comma' })}`,
      _.merge(authOpts(), { signal })
    );
    return res.json();
  },

  create: async (body: WorkspaceRequest): Promise<WorkspaceInfo> => {
    const res = await fetchRawls('workspaces', _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'POST' }]));
    return res.json();
  },

  getShareLog: async (): Promise<string[]> => {
    const res = await fetchOrchestration('api/sharelog/sharees?shareType=workspace', _.merge(authOpts(), { signal }));
    return res.json();
  },

  getTags: async (tag: string, limit: number): Promise<WorkspaceTag[]> => {
    const params: any = { q: tag };
    if (limit) {
      params.limit = limit;
    }
    const res = await fetchRawls(`workspaces/tags?${qs.stringify(params)}`, _.merge(authOpts(), { signal }));
    return res.json();
  },

  getById: async (workspaceId: string, fields: FieldsArg | undefined = undefined): Promise<WorkspaceWrapper> => {
    let url = `workspaces/id/${workspaceId}`;
    if (fields) {
      url += `?${qs.stringify({ fields }, { arrayFormat: 'comma' })}`;
    }
    const response = await fetchRawls(url, _.mergeAll([authOpts(), { signal }]));
    return response.json();
  },

  adminGetById: async (workspaceId: string): Promise<SupportSummary> => {
    const res = await fetchRawls(`admin/workspaces/${workspaceId}`, _.merge(authOpts(), { signal }));
    return res.json();
  },

  workspaceV2: (namespace: string, name: string) => {
    const root = `workspaces/v2/${namespace}/${name}`;

    return {
      clone: async (body: WorkspaceRequestClone): Promise<WorkspaceInfo> => {
        const res = await fetchRawls(
          `${root}/clone`,
          _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'POST' }])
        );
        return res.json();
      },

      delete: (): Promise<Response> => {
        return fetchRawls(root, _.merge(authOpts(), { signal, method: 'DELETE' }));
      },

      // Bucket migration page no longer displayed (though the code was retained in the event of
      // any future migrations).
      migrateWorkspace: async () => {
        const response = await fetchRawls(`${root}/bucketMigration`, _.merge(authOpts(), { signal, method: 'POST' }));
        return response.json();
      },

      getSettings: async (): Promise<WorkspaceSetting[]> => {
        const response = await fetchRawls(`${root}/settings`, _.merge(authOpts(), { signal }));
        return response.json();
      },

      updateSettings: async (body: WorkspaceSetting[]) => {
        const response = await fetchRawls(
          `${root}/settings`,
          _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'PUT' }])
        );
        return response.json();
      },
    };
  },

  // Bucket migration page no longer displayed (though the code was retained in the event of
  // any future migrations).
  bucketMigrationInfo: async () => {
    const response = await fetchRawls('workspaces/v2/bucketMigration', _.merge(authOpts(), { signal }));
    return response.json();
  },

  bucketMigrationProgress: async (body) => {
    const response = await fetchRawls(
      'workspaces/v2/bucketMigration/getProgress',
      _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'POST' }])
    );
    return response.json();
  },

  startBatchBucketMigration: async (body) => {
    const response = await fetchRawls(
      'workspaces/v2/bucketMigration',
      _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'POST' }])
    );
    return response.json();
  },

  workspace: (namespace: string, name: string) => {
    const root = `workspaces/${namespace}/${name}`;
    const mcPath = `${root}/methodconfigs`;

    return {
      checkBucketReadAccess: () => {
        return fetchRawls(`${root}/checkBucketReadAccess`, _.merge(authOpts(), { signal }));
      },

      checkBucketAccess: GoogleStorage(signal).checkBucketAccess,

      checkBucketLocation: GoogleStorage(signal).checkBucketLocation,

      details: async (fields: FieldsArg): Promise<WorkspaceWrapper> => {
        const res = await fetchRawls(
          `${root}?${qs.stringify({ fields }, { arrayFormat: 'comma' })}`,
          _.merge(authOpts(), { signal })
        );
        return res.json();
      },

      getAcl: async (): Promise<Record<'acl', RawWorkspaceAcl>> => {
        const res = await fetchRawls(`${root}/acl`, _.merge(authOpts(), { signal }));
        return res.json();
      },

      updateAcl: async (aclUpdates: WorkspaceAclUpdate[], inviteNew = true) => {
        const res = await fetchOrchestration(
          `api/${root}/acl?inviteUsersNotFound=${inviteNew}`,
          _.mergeAll([authOpts(), jsonBody(aclUpdates), { signal, method: 'PATCH' }])
        );
        return res.json();
      },

      lock: async () => {
        return await fetchRawls(`${root}/lock`, _.merge(authOpts(), { signal, method: 'PUT' }));
      },

      unlock: async () => {
        return await fetchRawls(`${root}/unlock`, _.merge(authOpts(), { signal, method: 'PUT' }));
      },

      listMethodConfigs: async (allRepos = true) => {
        const res = await fetchRawls(`${mcPath}?allRepos=${allRepos}`, _.merge(authOpts(), { signal }));
        return res.json();
      },

      importMethodConfig: (config: MethodConfiguration): Promise<Response> => {
        return fetchRawls(mcPath, _.mergeAll([authOpts(), jsonBody(config), { signal, method: 'POST' }]));
      },

      methodConfig: (configNamespace, configName) => {
        const path = `${mcPath}/${configNamespace}/${configName}`;

        return {
          get: async () => {
            const res = await fetchRawls(path, _.merge(authOpts(), { signal }));
            return res.json();
          },

          save: async (payload) => {
            const res = await fetchRawls(path, _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'POST' }]));
            return res.json();
          },

          copyTo: async ({ destConfigNamespace, destConfigName, workspaceName }) => {
            const payload = {
              source: { namespace: configNamespace, name: configName, workspaceName: { namespace, name } },
              destination: { namespace: destConfigNamespace, name: destConfigName, workspaceName },
            };
            const res = await fetchRawls(
              'methodconfigs/copy',
              _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'POST' }])
            );
            return res.json();
          },

          validate: async () => {
            const res = await fetchRawls(`${path}/validate`, _.merge(authOpts(), { signal }));
            return res.json();
          },

          launch: async (payload) => {
            const res = await fetchRawls(
              `${root}/submissions`,
              _.mergeAll([
                authOpts(),
                jsonBody({
                  ...payload,
                  methodConfigurationNamespace: configNamespace,
                  methodConfigurationName: configName,
                }),
                { signal, method: 'POST' },
              ])
            );
            return res.json();
          },

          delete: (): Promise<Response> => {
            return fetchRawls(path, _.merge(authOpts(), { signal, method: 'DELETE' }));
          },
        };
      },

      listSubmissions: async () => {
        const res = await fetchRawls(`${root}/submissions`, _.merge(authOpts(), { signal }));
        return res.json();
      },

      listSnapshots: async (limit: number, offset: number) => {
        const res = await fetchRawls(
          `${root}/snapshots/v2?offset=${offset}&limit=${limit}`,
          _.merge(authOpts(), { signal })
        );
        // The list snapshots endpoint returns a "snapshot" field that should really be named "snapshotId". Ideally, this should be fixed in the
        // backend, but we've sequestered it here for now.
        return _.update(
          'gcpDataRepoSnapshots',
          _.map(_.update('attributes', (a) => ({ ...a, snapshotId: a.snapshot }))),
          await res.json()
        );
      },

      snapshot: (snapshotId: string) => {
        const snapshotPath = `${root}/snapshots/v2/${snapshotId}`;

        return {
          details: async () => {
            const res = await fetchRawls(snapshotPath, _.merge(authOpts(), { signal }));
            return res.json();
          },

          update: (updateInfo) => {
            return fetchRawls(
              snapshotPath,
              _.mergeAll([authOpts(), jsonBody(updateInfo), { signal, method: 'PATCH' }])
            );
          },

          delete: (): Promise<Response> => {
            return fetchRawls(snapshotPath, _.merge(authOpts(), { signal, method: 'DELETE' }));
          },
        };
      },

      submission: (submissionId: string) => {
        const submissionPath = `${root}/submissions/${submissionId}`;

        return {
          get: async () => {
            const res = await fetchRawls(submissionPath, _.merge(authOpts(), { signal }));
            return res.json();
          },

          getConfiguration: async () => {
            const res = await fetchRawls(`${submissionPath}/configuration`, _.merge(authOpts(), { signal }));
            return res.json();
          },

          abort: (): Promise<Response> => {
            return fetchRawls(submissionPath, _.merge(authOpts(), { signal, method: 'DELETE' }));
          },

          updateUserComment: (userComment: string) => {
            const payload = { userComment };
            return fetchRawls(submissionPath, _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'PATCH' }]));
          },

          // NB: This could one day perhaps redirect to CromIAM's 'workflow' like:
          // workflow: workflowId => Ajax(signal).CromIAM.workflow(workflowId)
          // But: Because of the slowness of asking via CromIAM, that's probably a non-starter for right now.
          workflow: (workflowId: string) => {
            return {
              metadata: async ({ includeKey, excludeKey }) => {
                const res = await fetchRawls(
                  `${submissionPath}/workflows/${workflowId}?${qs.stringify(
                    {
                      includeKey,
                      excludeKey,
                    },
                    { arrayFormat: 'repeat' }
                  )}`,
                  _.merge(authOpts(), { signal })
                );
                return res.json();
              },

              outputs: () =>
                fetchRawls(`${submissionPath}/workflows/${workflowId}/outputs`, _.merge(authOpts(), { signal })).then(
                  (r) => r.json()
                ),
            };
          },
        };
      },

      delete: (): Promise<Response> => {
        return fetchRawls(root, _.merge(authOpts(), { signal, method: 'DELETE' }));
      },

      shallowMergeNewAttributes: (attributesObject: Record<string, unknown>) => {
        const payload = attributesUpdateOps(attributesObject);
        return fetchRawls(root, _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'PATCH' }]));
      },

      deleteAttributes: (attributeNames: string[]) => {
        const payload = _.map((attributeName) => ({ op: 'RemoveAttribute', attributeName }), attributeNames);
        return fetchRawls(root, _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'PATCH' }]));
      },

      entityMetadata: async (): Promise<Record<string, unknown>> => {
        const res = await fetchRawls(`${root}/entities`, _.merge(authOpts(), { signal }));
        return res.json();
      },

      snapshotEntityMetadata: (googleProject: string, dataReference: string) => {
        return getSnapshotEntityMetadata(getTerraUser().token, namespace, name, googleProject, dataReference);
      },

      createEntity: async (payload: Entity) => {
        const res = await fetchRawls(
          `${root}/entities`,
          _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'POST' }])
        );
        return res.json();
      },

      renameEntity: (type: string, name: string, newName: string) => {
        return fetchRawls(
          `${root}/entities/${type}/${name}/rename`,
          _.mergeAll([authOpts(), jsonBody({ name: newName }), { signal, method: 'POST' }])
        );
      },

      renameEntityType: (oldName: string, newName: string) => {
        const payload = { newName };

        return fetchRawls(
          `${root}/entityTypes/${oldName}`,
          _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'PATCH' }])
        );
      },

      deleteEntitiesOfType: (entityType: string): Promise<Response> => {
        return fetchRawls(`${root}/entityTypes/${entityType}`, _.merge(authOpts(), { signal, method: 'DELETE' }));
      },

      deleteEntityAttribute: (type: string, name: string, attributeName: string) => {
        return fetchRawls(
          `${root}/entities/${type}/${name}`,
          _.mergeAll([authOpts(), jsonBody([{ op: 'RemoveAttribute', attributeName }]), { signal, method: 'PATCH' }])
        );
      },

      deleteAttributeFromEntities: (entityType: string, attributeName: string, entityNames: string[]) => {
        const body = _.map(
          (name) => ({
            entityType,
            name,
            operations: [{ op: 'RemoveAttribute', attributeName }],
          }),
          entityNames
        );

        return fetchRawls(
          `${root}/entities/batchUpsert`,
          _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'POST' }])
        );
      },

      deleteEntityColumn: (type: string, attributeName: string): Promise<Response> => {
        return fetchRawls(
          `${root}/entities/${type}?attributeNames=${attributeName}`,
          _.mergeAll([authOpts(), { signal, method: 'DELETE' }])
        );
      },

      renameEntityColumn: (type: string, attributeName: string, newAttributeName: string) => {
        const payload = { newAttributeName };
        return fetchRawls(
          `${root}/entityTypes/${type}/attributes/${attributeName}`,
          _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'PATCH' }])
        );
      },

      upsertEntities: (entityUpdates: EntityUpdateDefinition[]) => {
        return fetchRawls(
          `${root}/entities/batchUpsert`,
          _.mergeAll([authOpts(), jsonBody(entityUpdates), { signal, method: 'POST' }])
        );
      },

      paginatedEntitiesOfType: async (type: string, parameters: Record<string, any>): Promise<EntityQueryResponse> => {
        const res = await fetchRawls(
          `${root}/entityQuery/${type}?${qs.stringify(parameters)}`,
          _.merge(authOpts(), { signal })
        );
        return res.json();
      },

      deleteEntities: (entities: AttributeEntityReference[]): Promise<Response> => {
        return fetchRawls(
          `${root}/entities/delete`,
          _.mergeAll([authOpts(), jsonBody(entities), { signal, method: 'POST' }])
        );
      },

      getEntities: (entityType: string): Promise<EntityQueryResponse> =>
        fetchRawls(`${root}/entities/${entityType}`, _.merge(authOpts(), { signal })).then((r) => r.json()),

      getEntitiesTsv: (entityType: string): Promise<Blob> =>
        fetchOrchestration(
          `api/workspaces/${namespace}/${name}/entities/${entityType}/tsv?model=flexible`,
          _.mergeAll([authOpts(), { signal }])
        ).then((r) => r.blob()),

      copyEntities: async (
        destNamespace: string,
        destName: string,
        entityType: string,
        entities: string[],
        link: boolean
      ) => {
        const payload = {
          sourceWorkspace: { namespace, name },
          destinationWorkspace: { namespace: destNamespace, name: destName },
          entityType,
          entityNames: entities,
        };
        const res = await fetchRawls(
          `workspaces/entities/copy?linkExistingEntities=${link}`,
          _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'POST' }])
        );
        return res.json();
      },

      importBagit: (bagitURL: string) => {
        return fetchOrchestration(
          `api/workspaces/${namespace}/${name}/importBagit`,
          _.mergeAll([authOpts(), jsonBody({ bagitURL, format: 'TSV' }), { signal, method: 'POST' }])
        );
      },

      importJSON: async (url: string) => {
        const res = await fetchOk(url);
        const payload = await res.json();

        const body = _.map(({ name, entityType, attributes }) => {
          return { name, entityType, operations: attributesUpdateOps(attributes) };
        }, payload);

        return fetchRawls(
          `${root}/entities/batchUpsert`,
          _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'POST' }])
        );
      },

      importEntitiesFile: (file: File, { deleteEmptyValues = false } = {}): Promise<Response> => {
        const formData = new FormData();
        formData.set('entities', file);
        return fetchOrchestration(
          `api/${root}/importEntities?${qs.stringify({ deleteEmptyValues })}`,
          _.merge(authOpts(), { body: formData, signal, method: 'POST' })
        );
      },

      importFlexibleEntitiesFileSynchronous: async (
        file: File,
        { deleteEmptyValues = false } = {}
      ): Promise<Response> => {
        const formData = new FormData();
        formData.set('entities', file);
        const res = await fetchOrchestration(
          `api/${root}/flexibleImportEntities?${qs.stringify({ deleteEmptyValues, async: false })}`,
          _.merge(authOpts(), { body: formData, signal, method: 'POST' })
        );
        return res;
      },

      importFlexibleEntitiesFileAsync: async (file: File, { deleteEmptyValues = false } = {}) => {
        const formData = new FormData();
        formData.set('entities', file);
        const res = await fetchOrchestration(
          `api/${root}/flexibleImportEntities?${qs.stringify({ deleteEmptyValues, async: true })}`,
          _.merge(authOpts(), { body: formData, signal, method: 'POST' })
        );
        return res.json();
      },

      importJob: async (url: string, filetype: string, options: Record<string, any> | null) => {
        const res = await fetchOrchestration(
          `api/${root}/importJob`,
          _.mergeAll([authOpts(), jsonBody({ url, filetype, options }), { signal, method: 'POST' }])
        );
        return res.json();
      },

      getImportJobStatus: async (jobId: string) => {
        const res = await fetchOrchestration(`api/${root}/importJob/${jobId}`, _.merge(authOpts(), { signal }));
        return res.json();
      },

      listImportJobs: async (isRunning: boolean): Promise<{ jobId: string }[]> => {
        const res = await fetchOrchestration(
          `api/${root}/importJob?running_only=${isRunning}`,
          _.merge(authOpts(), { signal })
        );
        return res.json();
      },

      importSnapshot: async (snapshotId: string, name: string, description?: string) => {
        const res = await fetchRawls(
          `${root}/snapshots/v2`,
          _.mergeAll([authOpts(), jsonBody({ snapshotId, name, description }), { signal, method: 'POST' }])
        );
        return res.json();
      },

      importAttributes: (file: File) => {
        const formData = new FormData();
        formData.set('attributes', file);
        return fetchOrchestration(
          `api/${root}/importAttributesTSV`,
          _.merge(authOpts(), { body: formData, signal, method: 'POST' })
        );
      },

      exportAttributes: async (): Promise<Blob> => {
        const res = await fetchOrchestration(`api/${root}/exportAttributesTSV`, _.merge(authOpts(), { signal }));
        return res.blob();
      },

      storageCostEstimate: async (): Promise<StorageCostEstimate> => {
        const res = await fetchOrchestration(
          `api/workspaces/${namespace}/${name}/storageCostEstimate`,
          _.merge(authOpts(), { signal })
        );
        return res.json();
      },

      getTags: async (): Promise<WorkspaceTag[]> => {
        const res = await fetchOrchestration(
          `api/workspaces/${namespace}/${name}/tags`,
          _.merge(authOpts(), { signal, method: 'GET' })
        );
        return res.json();
      },

      addTag: async (tag: string) => {
        const res = await fetchOrchestration(
          `api/workspaces/${namespace}/${name}/tags`,
          _.mergeAll([authOpts(), jsonBody([tag]), { signal, method: 'PATCH' }])
        );
        return res.json();
      },

      deleteTag: async (tag: string): Promise<string[]> => {
        const res = await fetchOrchestration(
          `api/workspaces/${namespace}/${name}/tags`,
          _.mergeAll([authOpts(), jsonBody([tag]), { signal, method: 'DELETE' }])
        );
        return res.json();
      },

      bucketUsage: async (): Promise<BucketUsageResponse> => {
        const res = await fetchRawls(`${root}/bucketUsage`, _.merge(authOpts(), { signal }));
        return res.json();
      },

      listActiveFileTransfers: async (): Promise<any[]> => {
        const res = await fetchRawls(`${root}/fileTransfers`, _.merge(authOpts(), { signal }));
        return res.json();
      },
    };
  },
});

export type WorkspacesAjaxContract = ReturnType<typeof Workspaces>;
export type WorkspaceContract = ReturnType<WorkspacesAjaxContract['workspace']>;
export type WorkspaceV2Contract = ReturnType<WorkspacesAjaxContract['workspaceV2']>;
