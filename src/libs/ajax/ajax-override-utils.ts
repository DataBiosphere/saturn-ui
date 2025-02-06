/**
 * Utilities for overriding API responses for manual testing.
 * See https://github.com/DataBiosphere/terra-ui/wiki/Mocking-API-Responses.
 */

import { ensureAuthSettled } from 'src/auth/auth';
import { ListAppItem } from 'src/libs/ajax/leonardo/models/app-models';
import { AjaxOverride, ajaxOverridesStore, getTerraUser } from 'src/libs/state';

type FetchFn = typeof fetch;
type FetchWrapper = (wrappedFetch: FetchFn) => FetchFn;

/**
 * Modify the body of a response.
 *
 * @param fn - Function that accepts actual response body and returns overriden response body.
 */
export const mapJsonBody = (fn: (body: any) => any): FetchWrapper => {
  return (wrappedFetch: FetchFn): FetchFn => {
    return async (...args) => {
      // @ts-ignore A spread argument must either have a tuple type or be passed to a rest parameter.
      const response: Response = await wrappedFetch(...args);
      const responseBody: any = await response.json();
      const newResponseBody: any = fn(responseBody);
      return new Response(JSON.stringify(newResponseBody), response);
    };
  };
};

/**
 * Replace a response with an error response.
 *
 * @param opts
 * @param opts.status - Status code for error response.
 * @param opts.frequency - Frequency with which to return errors, between 0 (never) and 1 (always).
 */
export const makeError = (opts: { status: number; frequency?: number }): FetchWrapper => {
  const { status, frequency = 1 } = opts;
  return (wrappedFetch: FetchFn): FetchFn => {
    return async (...args) => {
      if (Math.random() < frequency) {
        const response = new Response('Instrumented error', { status });
        return Promise.resolve(response);
      }
      // @ts-ignore A spread argument must either have a tuple type or be passed to a rest parameter.
      return wrappedFetch(...args);
    };
  };
};

/**
 * Replace a response with a success response with the given body.
 *
 * @param body - Response body.
 */
export const makeSuccess = (body: any): FetchWrapper => {
  return (): FetchFn => {
    return () => {
      const response = new Response(JSON.stringify(body), { status: 200 });
      return Promise.resolve(response);
    };
  };
};

/**
 * Override WDS app listings to use a local instance of WDS for a specific workspace.
 */
export const overrideAppsWithLocalWDS = async (workspaceId?: string) => {
  if (!workspaceId) {
    throw new Error('A workspace ID is required');
  }

  const wdsUrl = 'http://localhost:8080';
  const token = getTerraUser().token;

  if (!token) {
    throw new Error('Must be signed in to use local WDS');
  }

  // Override the Leo apps list for the given workspace to return the local
  // WDS' URL as the WDS proxy URL for that workspace.
  const ajaxOverrides: AjaxOverride[] = [
    {
      filter: { url: new RegExp(`/apps/v2/${workspaceId}`) },
      fn: mapJsonBody((apps: ListAppItem[]): ListAppItem[] => {
        return apps.map((app) => {
          if (app.appType === 'WDS') {
            return {
              ...app,
              proxyUrls: {
                ...app.proxyUrls,
                wds: wdsUrl,
              },
            };
          }
          return app;
        });
      }),
    },
  ];

  ajaxOverridesStore.set(ajaxOverrides);
};

/**
 * Allow automatically overriding apps for a workspace by starting the Terra UI
 * dev server with an environment variable set.
 * TERRA_UI_USE_LOCAL_WDS_FOR_WORKSPACE should contain the ID of the workspace
 * to use the local WDS instance for.
 */
if (import.meta.env.TERRA_UI_USE_LOCAL_WDS_FOR_WORKSPACE) {
  (async () => {
    // A token is needed to make requests to the local WDS.
    // Wait for the user to be loaded before attempting to do so.
    await ensureAuthSettled();
    overrideAppsWithLocalWDS(import.meta.env.TERRA_UI_USE_LOCAL_WDS_FOR_WORKSPACE);
  })();
}

/**
 * Utilities to be exposed as globals.
 */
const ajaxOverrideUtils = {
  mapJsonBody,
  makeError,
  makeSuccess,
  overrideAppsWithLocalWDS,
};

declare global {
  interface Window {
    ajaxOverrideUtils: typeof ajaxOverrideUtils;
  }
}

export const mountAjaxOverrideUtils = () => {
  window.ajaxOverrideUtils = ajaxOverrideUtils;
};
