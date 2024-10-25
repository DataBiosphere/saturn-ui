import { jsonBody } from '@terra-ui-packages/data-client-core';
import _ from 'lodash/fp';
import * as qs from 'qs';
import { authOpts } from 'src/auth/auth-session';
import { fetchAgora, fetchOrchestration, fetchRawls } from 'src/libs/ajax/ajax-common';
import { MethodQuery, MethodResponse } from 'src/libs/ajax/methods/methods-models';
import { Snapshot } from 'src/snapshots/Snapshot';

export const Methods = (signal?: AbortSignal) => ({
  list: async (params): Promise<Snapshot[]> => {
    const res = await fetchAgora(`methods?${qs.stringify(params)}`, _.merge(authOpts(), { signal }));
    return res.json();
  },

  definitions: async () => {
    const res = await fetchAgora('methods/definitions', _.merge(authOpts(), { signal }));
    return res.json();
  },

  configInputsOutputs: async (loadedConfig) => {
    const res = await fetchRawls(
      'methodconfigs/inputsOutputs',
      _.mergeAll([authOpts(), jsonBody(loadedConfig.methodRepoMethod), { signal, method: 'POST' }])
    );
    return res.json();
  },

  template: async (modifiedConfigMethod) => {
    const res = await fetchRawls(
      'methodconfigs/template',
      _.mergeAll([authOpts(), jsonBody(modifiedConfigMethod), { signal, method: 'POST' }])
    );
    return res.json();
  },

  postMethod: async (method: MethodQuery): Promise<MethodResponse> => {
    const res = await fetchOrchestration(
      'api/methods',
      _.mergeAll([authOpts(), jsonBody(method), { signal, method: 'POST' }])
    );
    return res.json();
  },

  method: (namespace, name, snapshotId) => {
    const root = `methods/${namespace}/${name}/${snapshotId}`;

    return {
      get: async (): Promise<Snapshot> => {
        const res = await fetchAgora(root, _.merge(authOpts(), { signal }));
        return res.json();
      },

      delete: async () => {
        const res = await fetchOrchestration(`api/${root}`, _.merge(authOpts(), { signal, method: 'DELETE' }));
        return res.json();
      },

      configs: async () => {
        const res = await fetchAgora(`${root}/configurations`, _.merge(authOpts(), { signal }));
        return res.json();
      },

      permissions: async () => {
        const res = await fetchOrchestration(`api/${root}/permissions`, _.merge(authOpts(), { signal }));
        return res.json();
      },

      setPermissions: async (payload) => {
        const res = await fetchOrchestration(
          `api/${root}/permissions`,
          _.mergeAll([authOpts(), jsonBody(payload), { signal, method: 'POST' }])
        );
        return res.json();
      },

      allConfigs: async () => {
        const res = await fetchAgora(`methods/${namespace}/${name}/configurations`, _.merge(authOpts(), { signal }));
        return res.json();
      },

      toWorkspace: async (workspace, config: any = {}) => {
        const res = await fetchRawls(
          `workspaces/${workspace.namespace}/${workspace.name}/methodconfigs`,
          _.mergeAll([
            authOpts(),
            jsonBody(
              _.merge(
                {
                  methodRepoMethod: {
                    methodUri: `agora://${namespace}/${name}/${snapshotId}`,
                  },
                  name,
                  namespace,
                  rootEntityType: '',
                  prerequisites: {},
                  inputs: {},
                  outputs: {},
                  methodConfigVersion: 1,
                  deleted: false,
                },
                config.payloadObject
              )
            ),
            { signal, method: 'POST' },
          ])
        );
        return res.json();
      },
    };
  },
});

export type MethodsAjaxContract = ReturnType<typeof Methods>;
