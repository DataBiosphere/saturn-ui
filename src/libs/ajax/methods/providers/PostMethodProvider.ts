import { AbortOption } from '@terra-ui-packages/data-client-core';
import { Methods } from 'src/libs/ajax/methods/Methods';
import { MethodResponse } from 'src/libs/ajax/methods/methods-models';

export interface PostMethodProvider {
  postMethod: (
    namespace: string,
    name: string,
    wdl: string,
    documentation: string,
    synopsis: string,
    snapshotComment: string,
    options?: AbortOption
  ) => Promise<MethodResponse>;
}

export const postMethodProvider: PostMethodProvider = {
  postMethod: async (
    namespace: string,
    name: string,
    wdl: string,
    documentation: string,
    synopsis: string,
    snapshotComment: string,
    options: AbortOption = {}
  ): Promise<MethodResponse> => {
    const { signal } = options;

    const workflowPayload = {
      namespace,
      name,
      synopsis,
      snapshotComment,
      documentation,
      payload: wdl,
      entityType: 'Workflow',
    };

    return await Methods(signal).postMethod(workflowPayload);
  },
};
