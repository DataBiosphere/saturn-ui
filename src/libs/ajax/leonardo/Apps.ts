import _ from 'lodash/fp';
import * as qs from 'qs';
import { AppToolLabel } from 'src/analysis/utils/tool-utils';
import { AppAccessScope } from 'src/analysis/utils/tool-utils';
import { appIdentifier, authOpts, fetchLeo, jsonBody } from 'src/libs/ajax/ajax-common';
import { CreateAppV1Request, GetAppResponse, ListAppResponse } from 'src/libs/ajax/leonardo/models/app-models';
import { LeoResourceLabels } from 'src/libs/ajax/leonardo/models/core-models';

export const Apps = (signal: AbortSignal) => ({
  list: async (project: string, labels: LeoResourceLabels = {}): Promise<ListAppResponse[]> => {
    const res = await fetchLeo(
      `api/google/v1/apps/${project}?${qs.stringify({ saturnAutoCreated: true, ...labels })}`,
      _.mergeAll([authOpts(), appIdentifier, { signal }])
    );
    return res.json();
  },
  listWithoutProject: async (labels: LeoResourceLabels = {}): Promise<ListAppResponse[]> => {
    const res = await fetchLeo(
      `api/google/v1/apps?${qs.stringify({ saturnAutoCreated: true, ...labels })}`,
      _.mergeAll([authOpts(), appIdentifier, { signal }])
    );
    return res.json();
  },
  app: (project: string, name: string) => {
    const root = `api/google/v1/apps/${project}/${name}`;
    return {
      delete: (deleteDisk = false): Promise<void> => {
        return fetchLeo(
          `${root}${qs.stringify({ deleteDisk }, { addQueryPrefix: true })}`,
          _.mergeAll([authOpts(), { signal, method: 'DELETE' }, appIdentifier])
        );
      },
      create: ({
        kubernetesRuntimeConfig,
        diskName,
        diskSize,
        diskType,
        appType,
        namespace,
        bucketName,
        workspaceName,
      }: CreateAppV1Request): Promise<void> => {
        const body = {
          labels: {
            saturnWorkspaceNamespace: namespace,
            saturnWorkspaceName: workspaceName,
            saturnAutoCreated: 'true',
          },
          kubernetesRuntimeConfig,
          diskConfig: {
            name: diskName,
            size: diskSize,
            diskType,
            labels: {
              saturnApplication: appType,
              saturnWorkspaceNamespace: namespace,
              saturnWorkspaceName: workspaceName,
            },
          },
          customEnvironmentVariables: {
            WORKSPACE_NAME: workspaceName,
            WORKSPACE_NAMESPACE: namespace,
            WORKSPACE_BUCKET: `gs://${bucketName}`,
            GOOGLE_PROJECT: project,
          },
          appType,
        };
        return fetchLeo(root, _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'POST' }, appIdentifier]));
      },
      pause: (): Promise<void> => {
        return fetchLeo(`${root}/stop`, _.mergeAll([authOpts(), { signal, method: 'POST' }, appIdentifier]));
      },
      resume: (): Promise<void> => {
        return fetchLeo(`${root}/start`, _.mergeAll([authOpts(), { signal, method: 'POST' }, appIdentifier]));
      },
      details: async (): Promise<GetAppResponse> => {
        const res = await fetchLeo(root, _.mergeAll([authOpts(), { signal }, appIdentifier]));
        return res.json();
      },
    };
  },
  listAppsV2: async (workspaceId: string, labels: LeoResourceLabels = {}): Promise<ListAppResponse[]> => {
    const res = await fetchLeo(
      `api/apps/v2/${workspaceId}?${qs.stringify(labels)}`,
      _.mergeAll([authOpts(), appIdentifier, { signal }])
    );
    return res.json();
  },
  createAppV2: (
    appName: string,
    workspaceId: string,
    appType: AppToolLabel,
    accessScope: AppAccessScope
  ): Promise<void> => {
    const body = {
      appType,
      accessScope,
      labels: {
        saturnAutoCreated: 'true',
      },
    };
    const res = fetchLeo(
      `api/apps/v2/${workspaceId}/${appName}`,
      _.mergeAll([authOpts(), jsonBody(body), { signal, method: 'POST' }])
    );
    return res;
  },
  deleteAppV2: (appName: string, workspaceId: string): Promise<void> => {
    return fetchLeo(
      `api/apps/v2/${workspaceId}/${appName}`,
      _.mergeAll([authOpts(), appIdentifier, { signal, method: 'DELETE' }])
    );
  },
  getAppV2: (appName: string, workspaceId: string): Promise<GetAppResponse> => {
    const res = fetchLeo(
      `api/apps/v2/${workspaceId}/${appName}`,
      _.mergeAll([authOpts(), appIdentifier, { signal, method: 'GET' }])
    );
    return res.json();
  },
});

export type AppsAjaxContract = ReturnType<typeof Apps>;
export type AppAjaxContract = ReturnType<AppsAjaxContract['app']>;
