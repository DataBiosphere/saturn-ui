import { AbortOption } from '@terra-ui-packages/data-client-core';
import { isGcpContext } from 'src/analysis/utils/runtime-utils';
import { GoogleStorage } from 'src/libs/ajax/GoogleStorage';
import { ListRuntimeItem, Runtime, RuntimeError } from 'src/libs/ajax/leonardo/models/runtime-models';
import { AzureRuntimeWrapper, GoogleRuntimeWrapper, Runtimes, RuntimeWrapper } from 'src/libs/ajax/leonardo/Runtimes';

export type RuntimeBasics = RuntimeWrapper & Pick<Runtime, 'cloudContext'>;

/**
 * Drives the union type RuntimeErrorInfo. Most runtime errors are of type ErrorList, but there are special cases like UserScriptError
 */
export type RuntimeErrorType = 'ErrorList' | 'UserScriptError';

interface RuntimeErrorBase {
  errorType: RuntimeErrorType;
}

export interface RuntimeListError extends RuntimeErrorBase {
  errorType: 'ErrorList';
  errors: RuntimeError[];
}

export interface RuntimeUserScriptError extends RuntimeErrorBase {
  errorType: 'UserScriptError';
  detail: string;
}

export type RuntimeErrorInfo = RuntimeListError | RuntimeUserScriptError;

export type DeleteRuntimeOptions = AbortOption & {
  deleteDisk?: boolean;
};

export interface LeoRuntimeProvider {
  list: (listArgs: Record<string, string>, options?: AbortOption) => Promise<ListRuntimeItem[]>;
  errorInfo: (runtime: RuntimeBasics, options?: AbortOption) => Promise<RuntimeErrorInfo>;
  stop: (runtime: RuntimeWrapper, options?: AbortOption) => Promise<void>;
  delete: (runtime: RuntimeBasics, options?: DeleteRuntimeOptions) => Promise<void>;
}

export const leoRuntimeProvider: LeoRuntimeProvider = {
  list: (listArgs: Record<string, string>, options: AbortOption = {}): Promise<ListRuntimeItem[]> => {
    const { signal } = options;

    return Runtimes(signal).listV2(listArgs);
  },
  errorInfo: async (runtime: RuntimeBasics, options?: AbortOption): Promise<RuntimeErrorInfo> => {
    const runtimes = Runtimes(options?.signal);
    const isGcp = isGcpContext(runtime.cloudContext);
    const { errors: runtimeErrors, asyncRuntimeFields } = isGcp
      ? await runtimes.runtime((runtime as GoogleRuntimeWrapper).googleProject, runtime.runtimeName).details()
      : await runtimes.runtimeV2((runtime as AzureRuntimeWrapper).workspaceId, runtime.runtimeName).details();
    if (isGcp && runtimeErrors.some(({ errorMessage }) => errorMessage.includes('Userscript failed'))) {
      const scriptErrorDetail = await GoogleStorage(options?.signal)
        .getObjectPreview(
          (runtime as GoogleRuntimeWrapper).googleProject,
          asyncRuntimeFields?.stagingBucket,
          'userscript_output.txt',
          true
        )
        .then((res) => res.text());
      return { errorType: 'UserScriptError', detail: scriptErrorDetail };
    } // else
    return { errorType: 'ErrorList', errors: runtimeErrors };
  },
  stop: (runtime: RuntimeWrapper, options: AbortOption = {}): Promise<void> => {
    const { signal } = options;

    // TODO: refactor runtimeWrapper and related v1/v2 mechanics into this provider.
    // This provider largely does the same abstraction pattern that runtimeWrapper is going for.
    // We should follow-up and see about removing runtimeWrapper from ajax Runtimes and point all current
    // consumers to this leoRuntimeProvider instead.  Any v1/v2 (GCP/Azure) conditional logic should happen
    // here, and the Ajax layer should just be mirrors of backend endpoints.
    return Runtimes(signal).runtimeWrapper(runtime).stop();
  },
  delete: (runtime: RuntimeBasics, options: DeleteRuntimeOptions = {}): Promise<void> => {
    const { cloudContext, runtimeName } = runtime;
    const { deleteDisk, signal } = options;

    if (isGcpContext(cloudContext)) {
      const googleProject = (runtime as GoogleRuntimeWrapper).googleProject;
      return Runtimes(signal).runtime(googleProject, runtimeName).delete(!!deleteDisk);
    }
    const workspaceId = (runtime as AzureRuntimeWrapper).workspaceId;
    return Runtimes(signal).runtimeV2(workspaceId, runtimeName).delete(!!deleteDisk);
  },
};
