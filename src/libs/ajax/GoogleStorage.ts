import { jsonBody } from '@terra-ui-packages/data-client-core';
import _ from 'lodash/fp';
import * as qs from 'qs';
import { AnalysisFile, AnalysisFileMetadata } from 'src/analysis/useAnalysisFiles';
import { AbsolutePath, getDisplayName, getExtension, getFileName } from 'src/analysis/utils/file-utils';
import {
  getToolLabelFromFileExtension,
  runtimeToolLabels,
  runtimeTools,
  ToolLabel,
} from 'src/analysis/utils/tool-utils';
import { getAuthToken } from 'src/auth/auth';
import { authOpts } from 'src/auth/auth-session';
import { fetchSam } from 'src/libs/ajax/ajax-common';
import { canUseWorkspaceProject } from 'src/libs/ajax/billing/Billing';
import { fetchOk, withMaybeRetry, withUrlPrefix } from 'src/libs/ajax/fetch/fetch-core';
import { getConfig } from 'src/libs/config';
import { knownBucketRequesterPaysStatuses, requesterPaysProjectStore, workspaceStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { canWrite, cloudProviderTypes, GoogleWorkspace } from 'src/workspaces/utils';

import { RequesterPaysErrorInfo } from './google-storage-models';

/*
 * Detects errors due to requester pays buckets, and adds the current workspace's billing
 * project if the user has access, retrying the request once if necessary.
 */
const withRequesterPays =
  (wrappedFetch) =>
  (url, ...args) => {
    const bucket = /\/b\/([^/?]+)[/?]/.exec(url)![1];
    const workspace = workspaceStore.get();

    const getUserProject = async () => {
      if (!requesterPaysProjectStore.get() && workspace && (await canUseWorkspaceProject(workspace))) {
        requesterPaysProjectStore.set((workspace as GoogleWorkspace).workspace.googleProject);
      }
      return requesterPaysProjectStore.get();
    };

    const tryRequest = async () => {
      const knownRequesterPays = knownBucketRequesterPaysStatuses.get()[bucket];
      try {
        const userProject = (knownRequesterPays && (await getUserProject())) || undefined;
        const res = await wrappedFetch(Utils.mergeQueryParams({ userProject }, url), ...args);
        !knownRequesterPays && knownBucketRequesterPaysStatuses.update(_.set(bucket, false));
        return res;
      } catch (error) {
        if (knownRequesterPays === false) {
          throw error;
        } else {
          const newResponse = await checkRequesterPaysError(error);
          if (newResponse.requesterPaysError && !knownRequesterPays) {
            knownBucketRequesterPaysStatuses.update(_.set(bucket, true));
            if (await getUserProject()) {
              return tryRequest();
            }
          }
          throw newResponse;
        }
      }
    };
    return tryRequest();
  };

const checkRequesterPaysError = async (response): Promise<RequesterPaysErrorInfo> => {
  if (response.status === 400) {
    const data = await response.text();
    const requesterPaysErrorInfo: RequesterPaysErrorInfo = {
      requesterPaysError: responseContainsRequesterPaysError(data),
    };
    return Object.assign(new Response(new Blob([data]), response), requesterPaysErrorInfo);
  }
  const unrecognizedErrorInfo: RequesterPaysErrorInfo = { requesterPaysError: false };
  return Object.assign(response, unrecognizedErrorInfo);
};

export const responseContainsRequesterPaysError = (responseText) => {
  return _.includes('requester pays', responseText);
};

// requesterPaysError may be set on responses from requests to the GCS API that are wrapped in withRequesterPays.
// requesterPaysError is true if the request requires a user project for billing the request to. Such errors
// are not transient and the request should not be retried.
const fetchBuckets = _.flow(
  withRequesterPays,
  // TODO: implement RequesterPaysError Error type/class so we can check this more reliably
  withMaybeRetry((error) => Boolean((error as any).requesterPaysError)),
  withUrlPrefix('https://storage.googleapis.com/')
)(fetchOk);

const getServiceAccountToken: (token: string) => Promise<string> = Utils.memoizeAsync(
  async (token) => {
    const scopes = ['https://www.googleapis.com/auth/devstorage.full_control'];
    const res = await fetchSam(
      'api/google/v1/user/petServiceAccount/token',
      _.mergeAll([authOpts(token), jsonBody(scopes), { method: 'POST' }])
    );
    return res.json();
  },
  {
    expires: 1000 * 60 * 30,
    keyFn: (...args) => JSON.stringify(args),
  }
);

// the parameter used to be the google project but now it is not used
export const saToken = (_: string): Promise<string> => getServiceAccountToken(getAuthToken()!);

export type GCSMetadata = { [key: string]: string };

// https://cloud.google.com/storage/docs/json_api/v1/objects/list
export type GCSItem = {
  bucket: string;
  contentType?: string;
  crc32c: string;
  etag: string;
  generation: string;
  id: string;
  kind: string;
  md5Hash: string;
  mediaLink: string;
  metageneration: string;
  name: string;
  selfLink: string;
  size: string;
  storageClass: string;
  timeCreated: string;
  timeStorageClassUpdated: string;
  updated: string;
  // Rather than have this be typed as a rather unhelpful set of (key: value) pairs, add your type to `GCSMetadata` and then use a predicate at the usage site
  metadata?: GCSMetadata;
};

export type GCSListObjectsOptions = {
  delimiter?: string;
  endOffset?: string;
  includeTrailingDelimiter?: string;
  maxResults?: number;
  pageToken?: string;
  projection?: 'full' | 'noAcl';
  startOffset?: string;
  versions?: boolean;
};

export type GCSListObjectsResponse = {
  kind: 'storage#objects';
  nextPageToken?: string;
  prefixes?: string[];
  items?: GCSItem[];
};

const encodeAnalysisName = (name) => encodeURIComponent(`notebooks/${name}`);

export const GoogleStorage = (signal?: AbortSignal) => ({
  checkBucketAccess: async (googleProject, bucket, accessLevel) => {
    // Protect against asking for a project-specific pet service account token if user cannot write to the workspace
    if (!canWrite(accessLevel)) {
      return false;
    }

    const res = await fetchBuckets(
      `storage/v1/b/${bucket}?fields=billing`,
      _.merge(authOpts(await saToken(googleProject)), { signal })
    );
    return res.json();
  },

  checkBucketLocation: async (googleProject, bucket) => {
    const res = await fetchBuckets(
      `storage/v1/b/${bucket}?fields=location%2ClocationType`,
      _.merge(authOpts(await saToken(googleProject)), { signal })
    );

    return res.json();
  },

  getObject: async (googleProject, bucket, object, params = {}) => {
    return fetchBuckets(
      `storage/v1/b/${bucket}/o/${encodeURIComponent(object)}${qs.stringify(params, { addQueryPrefix: true })}`,
      _.merge(authOpts(await saToken(googleProject)), { signal })
    ).then((res) => res.json());
  },

  getObjectPreview: async (googleProject, bucket, object, previewFull = false) => {
    return fetchBuckets(
      `storage/v1/b/${bucket}/o/${encodeURIComponent(object)}?alt=media`,
      _.mergeAll([
        authOpts(await saToken(googleProject)),
        { signal },
        previewFull ? {} : { headers: { Range: 'bytes=0-20000' } },
      ])
    );
  },

  listNotebooks: async (googleProject, name) => {
    const res = await fetchBuckets(
      `storage/v1/b/${name}/o?prefix=notebooks/`,
      _.merge(authOpts(await saToken(googleProject)), { signal })
    );
    const { items } = await res.json();
    return _.filter(({ name }) => _.includes(getExtension(name), runtimeTools.Jupyter.ext), items);
  },

  listAnalyses: async (googleProject: string, name: string): Promise<AnalysisFile[]> => {
    const res = await fetchBuckets(
      `storage/v1/b/${name}/o?prefix=notebooks/`,
      _.merge(authOpts(await saToken(googleProject)), { signal })
    );

    const { items } = (await res.json()) as GCSListObjectsResponse;
    const internalFiles = _.flow(
      _.map(({ name, updated, metadata }) => {
        const path = name as AbsolutePath;
        return {
          name: path,
          ext: getExtension(name),
          displayName: getDisplayName(name),
          fileName: getFileName(name),
          tool: getToolLabelFromFileExtension(getExtension(name)) as ToolLabel,
          lastModified: new Date(updated).getTime(),
          cloudProvider: cloudProviderTypes.GCP,
          metadata,
        };
      }),
      _.filter(({ ext }) => _.includes(ext, runtimeTools.Jupyter.ext) || _.includes(ext, runtimeTools.RStudio.ext))
    )(items);
    return internalFiles;
  },

  list: async (
    googleProject: string,
    bucket: string,
    prefix: string,
    options: GCSListObjectsOptions = {}
  ): Promise<GCSListObjectsResponse> => {
    const res = await fetchBuckets(
      `storage/v1/b/${bucket}/o?${qs.stringify({ delimiter: '/', ...options, prefix })}`,
      _.merge(authOpts(await saToken(googleProject)), { signal })
    );
    return res.json();
  },

  /**
   * Recursively returns all objects in the specified bucket, iterating through all pages until
   * results have been exhausted and all objects have been collected.
   *
   * @param googleProject
   * @param bucket Name of the bucket in which to look for objects.
   * @param {Object} options to pass into the GCS API. Accepted options are:
   *    prefix: Filter results to include only objects whose names begin with this prefix.
   *    pageToken: A previously-returned page token representing part of the larger set of results to view.
   *    delimiter: Returns results in a directory-like mode, with / being a common value for the delimiter.
   * @returns {Promise<*>}
   * See https://cloud.google.com/storage/docs/json_api/v1/objects/list for additional documentation for underlying GCS API
   */
  listAll: async (googleProject, bucket, { prefix = null, pageToken = null, delimiter = null } = {}) => {
    const res = await fetchBuckets(
      `storage/v1/b/${bucket}/o?${qs.stringify({ prefix, delimiter, pageToken })}`,
      _.merge(authOpts(await saToken(googleProject)), { signal })
    );
    const body = await res.json();
    const items = body.items || [];
    const prefixes = body.prefixes || [];

    // Get the next page recursively if there is one
    if (body.nextPageToken) {
      const next = await GoogleStorage(signal).listAll(googleProject, bucket, {
        prefix,
        pageToken: body.nextPageToken,
        delimiter,
      });
      return { items: _.concat(items, next.items), prefixes: _.concat(prefixes, next.prefixes) };
    }
    return { items, prefixes };
  },

  delete: async (googleProject: string, bucket: string, name: string): Promise<void> => {
    await fetchBuckets(
      `storage/v1/b/${bucket}/o/${encodeURIComponent(name)}`,
      _.merge(authOpts(await saToken(googleProject)), { signal, method: 'DELETE' })
    );
  },

  upload: async (googleProject: string, bucket: string, prefix: string, file: File): Promise<void> => {
    await fetchBuckets(
      `upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(prefix + file.name)}`,
      _.merge(authOpts(await saToken(googleProject)), {
        signal,
        method: 'POST',
        body: file,
        headers: { 'Content-Type': file.type, 'Content-Length': file.size },
      })
    );
  },

  patch: async (googleProject, bucket, name, metadata) => {
    return fetchBuckets(
      `storage/v1/b/${bucket}/o/${encodeURIComponent(name)}`,
      _.mergeAll([authOpts(await saToken(googleProject)), jsonBody(metadata), { signal, method: 'PATCH' }])
    );
  },

  copyWithinBucket: async (
    googleProject: string,
    bucket: string,
    sourceName: string,
    destinationName: string
  ): Promise<void> => {
    await fetchBuckets(
      `storage/v1/b/${bucket}/o/${encodeURIComponent(sourceName)}/copyTo/b/${bucket}/o/${encodeURIComponent(
        destinationName
      )}`,
      _.mergeAll([authOpts(await saToken(googleProject)), { signal, method: 'POST' }])
    );
  },

  // TODO: this should be deprecated in favor of the smarter `analysis` set of functions
  notebook: (googleProject, bucket, name) => {
    const bucketUrl = `storage/v1/b/${bucket}/o`;

    const copy = async (newName, newBucket, clearMetadata) => {
      const body = clearMetadata ? { metadata: { lastLockedBy: '' } } : {};
      return fetchBuckets(
        `${bucketUrl}/${encodeAnalysisName(name)}/copyTo/b/${newBucket}/o/${encodeAnalysisName(newName)}`,
        _.mergeAll([authOpts(await saToken(googleProject)), jsonBody(body), { signal, method: 'POST' }])
      );
    };
    const doDelete = async () => {
      return fetchBuckets(
        `${bucketUrl}/${encodeAnalysisName(name)}`,
        _.merge(authOpts(await saToken(googleProject)), { signal, method: 'DELETE' })
      );
    };

    const getObject = async () => {
      const res = await fetchBuckets(
        `${bucketUrl}/${encodeAnalysisName(name)}`,
        _.merge(authOpts(await saToken(googleProject)), { signal, method: 'GET' })
      );
      return await res.json();
    };

    return {
      preview: async () => {
        const nb = await fetchBuckets(
          `${bucketUrl}/${encodeURIComponent(`notebooks/${name}`)}?alt=media`,
          _.merge(authOpts(await saToken(googleProject)), { signal })
        ).then((res) => res.text());
        return fetchOk(
          `${getConfig().calhounUrlRoot}/api/convert`,
          _.mergeAll([authOpts(), { signal, method: 'POST', body: nb }])
        ).then((res) => res);
      },

      copy,

      create: async (contents) => {
        return fetchBuckets(
          `upload/${bucketUrl}?uploadType=media&name=${encodeAnalysisName(name)}`,
          _.merge(authOpts(await saToken(googleProject)), {
            signal,
            method: 'POST',
            body: JSON.stringify(contents),
            headers: { 'Content-Type': 'application/x-ipynb+json' },
          })
        );
      },

      delete: doDelete,

      getObject,

      rename: async (newName) => {
        await copy(newName, bucket, false);
        return doDelete();
      },
    };
  },

  // TODO: this should take a type `file`, instead of (name, toolLabel), and then we can remove `toolLabel` param
  analysis: (googleProject: string, bucket: string, name: string, toolLabel: ToolLabel) => {
    const bucketUrl = `storage/v1/b/${bucket}/o`;

    const calhounPath = Utils.switchCase(
      toolLabel,
      [runtimeToolLabels.Jupyter, () => 'api/convert'],
      [runtimeToolLabels.RStudio, () => 'api/convert/rmd']
    );

    const mimeType = Utils.switchCase(
      toolLabel,
      [runtimeToolLabels.Jupyter, () => 'application/x-ipynb+json'],
      [runtimeToolLabels.RStudio, () => 'application/octet-stream']
    );

    const encodeFileName = (name) => encodeAnalysisName(getFileName(name));

    const doCopy = async (newName, newBucket, body) => {
      return fetchBuckets(
        `${bucketUrl}/${encodeFileName(name)}/copyTo/b/${newBucket}/o/${encodeFileName(newName)}`,
        _.mergeAll([authOpts(await saToken(googleProject)), jsonBody(body), { signal, method: 'POST' }])
      );
    };

    const copy = (newName: string, newBucket: string, clearMetadata: boolean): Promise<void> => {
      const body = clearMetadata ? { metadata: { lastLockedBy: '' } } : {};
      return doCopy(newName, newBucket, body);
    };

    const copyWithMetadata = (
      newName: string,
      newBucket: string,
      copyMetadata: AnalysisFileMetadata
    ): Promise<void> => {
      const body = { metadata: copyMetadata };
      return doCopy(newName, newBucket, body);
    };

    const updateMetadata = async (fileName: string, newMetadata: AnalysisFileMetadata): Promise<void> => {
      const body = { metadata: newMetadata };
      return fetchBuckets(
        `${bucketUrl}/${encodeFileName(fileName)}`,
        _.mergeAll([authOpts(await saToken(googleProject)), jsonBody(body), { signal, method: 'PATCH' }])
      );
    };

    const doDelete = async () => {
      return fetchBuckets(
        `${bucketUrl}/${encodeFileName(name)}`,
        _.merge(authOpts(await saToken(googleProject)), { signal, method: 'DELETE' })
      );
    };

    const getObject = async (): Promise<any> => {
      const res = await fetchBuckets(
        `${bucketUrl}/${encodeFileName(name)}`,
        _.merge(authOpts(await saToken(googleProject)), { signal, method: 'GET' })
      );
      return await res.json();
    };

    return {
      preview: async (): Promise<string> => {
        const nb = await fetchBuckets(
          `${bucketUrl}/${encodeFileName(name)}?alt=media`,
          _.merge(authOpts(await saToken(googleProject)), { signal })
        ).then((res) => res.text());
        return fetchOk(
          `${getConfig().calhounUrlRoot}/${calhounPath}`,
          _.mergeAll([authOpts(), { signal, method: 'POST', body: nb }])
        ).then((res) => res);
      },

      copy,

      copyWithMetadata,

      create: async (contents) => {
        return fetchBuckets(
          `upload/${bucketUrl}?uploadType=media&name=${encodeFileName(name)}`,
          _.merge(authOpts(await saToken(googleProject)), {
            signal,
            method: 'POST',
            body: contents,
            headers: { 'Content-Type': mimeType },
          })
        );
      },

      delete: doDelete,

      getObject,

      rename: async (newName: string): Promise<void> => {
        await copy(`${newName}.${getExtension(name)}`, bucket, false);
        return doDelete();
      },

      updateMetadata,
    };
  },
});

export type GoogleStorageContract = ReturnType<typeof GoogleStorage>;
