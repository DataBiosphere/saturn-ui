import { AbortOption } from '@terra-ui-packages/data-client-core';
import { Methods } from 'src/libs/ajax/methods/Methods';
import { MethodResponse } from 'src/libs/ajax/methods/methods-models';

export interface EditMethodProvider {
  createNewSnapshot: (
    namespace: string,
    name: string,
    snapshotId: number,
    redactPreviousSnapshot: boolean,
    synopsis: string,
    documentation: string,
    wdl: string,
    snapshotComment: string,
    options?: AbortOption
  ) => Promise<MethodResponse>;
}

export const editMethodProvider: EditMethodProvider = {
  createNewSnapshot: async (
    namespace: string,
    name: string,
    snapshotId: number,
    redactPreviousSnapshot: boolean,
    synopsis: string,
    documentation: string,
    wdl: string,
    snapshotComment: string,
    options: AbortOption = {}
  ): Promise<MethodResponse> => {
    const { signal } = options;

    const payload = {
      synopsis,
      snapshotComment,
      documentation,
      payload: wdl,
    };

    return await Methods(signal).method(namespace, name, snapshotId).createSnapshot(payload, redactPreviousSnapshot);
  },
};
