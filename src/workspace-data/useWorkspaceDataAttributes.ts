import { AutoLoadedState, useAutoLoadedData } from '@terra-ui-packages/components';
import { useNotificationsFromContext } from '@terra-ui-packages/notifications';
import { useCallback } from 'react';
import { Ajax } from 'src/libs/ajax';
import { useCancellation } from 'src/libs/react-utils';

const DESCRIPTION_PREFIX = '__DESCRIPTION__';

/**
 * Filter workspace attributes to attributes containing workspace data.
 *
 * This filters out the workspace description, any attributes with a namespace,
 * reference data, and descriptions of workspace data attributes.
 *
 * @param key - Attribute name
 */
const isWorkspaceDataAttribute = (name: string): boolean => {
  return !/^description$|:|^referenceData_|__DESCRIPTION__/.test(name);
};

/**
 * Extract workspace data attributes from all workspace attributes.
 *
 * @param workspaceAttributes - Workspace attributes.
 * @returns List of [attribute name, attribute value, attribute description] tuples.
 */
export const getWorkspaceDataAttributes = (workspaceAttributes: { [key: string]: unknown }) => {
  return Object.entries(workspaceAttributes)
    .filter(([name]) => isWorkspaceDataAttribute(name))
    .map(([name, value]): [string, unknown, string | undefined] => {
      const description = workspaceAttributes[`${DESCRIPTION_PREFIX}${name}`];
      return [name, value, description === undefined ? undefined : `${description}`];
    })
    .sort((a, b) => a[0].localeCompare(b[0]));
};

/**
 * Get a workspace's workspace data attributes.
 *
 * @param namespace - Workspace namespace
 * @param name - Workspace name
 * @returns List of [attribute name, attribute value, attribute description] tuples.
 */
export const useWorkspaceDataAttributes = (
  namespace: string,
  name: string
): [AutoLoadedState<[string, unknown, unknown]>, () => Promise<void>] => {
  const { reportError } = useNotificationsFromContext();

  const signal = useCancellation();
  const loadAttributes = useCallback(async () => {
    const {
      workspace: { attributes },
    } = await Ajax(signal).Workspaces.workspace(namespace, name).details(['workspace.attributes']);
    return getWorkspaceDataAttributes(attributes) as any;
  }, [namespace, name, signal]);

  const [state, load] = useAutoLoadedData<[string, unknown, unknown]>(loadAttributes, [namespace, name], {
    onError: ({ error }) => reportError('Error loading workspace data', error),
  });

  const refresh = useCallback(async () => {
    await load(loadAttributes);
  }, [load, loadAttributes]);

  return [state, refresh];
};
