import { AbortOption } from '@terra-ui-packages/data-client-core';
import { Ajax } from 'src/libs/ajax';
import { Metrics } from 'src/libs/ajax/Metrics';
import { MethodConfiguration, MethodRepoMethod } from 'src/libs/ajax/workspaces/workspace-models';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { WorkspaceInfo } from 'src/workspaces/utils';

export interface ExportWorkflowToWorkspaceProvider {
  export: (destWorkspace: WorkspaceInfo, destWorkflowName: string, options?: AbortOption) => Promise<any>;
}

/**
 * Create a provider to export a workflow (with its configuration) from one
 * workspace to another.
 *
 * The current and destination workspaces can be the same or different.
 *
 * @param {WorkspaceInfo} currentWorkspace - the workspace the workflow to be
 * exported is currently in.
 * @param {MethodConfiguration} methodConfig - the method configuration to be
 * exported.
 */
export const makeExportWorkflowFromWorkspaceProvider = (
  currentWorkspace: WorkspaceInfo,
  methodConfig: MethodConfiguration
): ExportWorkflowToWorkspaceProvider => {
  return {
    export: (destWorkspace: WorkspaceInfo, destWorkflowName: string, options: AbortOption = {}) => {
      const { signal } = options;

      return Ajax(signal)
        .Workspaces.workspace(currentWorkspace.namespace, currentWorkspace.name)
        .methodConfig(methodConfig.namespace, methodConfig.name)
        .copyTo({
          destConfigNamespace: destWorkspace.namespace,
          destConfigName: destWorkflowName,
          workspaceName: {
            namespace: destWorkspace.namespace,
            name: destWorkspace.name,
          },
        });
    },
  };
};

/**
 * Create a provider to export a workflow from the Broad Methods Repository to a
 * workspace, with a blank configuration.
 *
 * @param {MethodRepoMethod} sourceMethod - the method to be exported from the
 * Methods Repository. The methodNamespace, methodName, and methodVersion
 * properties should be present, and methodVersion should be a number.
 */
export const makeExportWorkflowFromMethodsRepoProvider = (
  sourceMethod: MethodRepoMethod
): ExportWorkflowToWorkspaceProvider => {
  return {
    export: async (destWorkspace: WorkspaceInfo, destWorkflowName: string, options: AbortOption = {}) => {
      const { signal } = options;

      // Remove placeholder root entity type from template before importing -
      // the user can select their own on the workflow configuration page
      const { rootEntityType, ...template } = await Ajax(signal).Methods.template(sourceMethod);

      await Ajax(signal)
        .Workspaces.workspace(destWorkspace.namespace, destWorkspace.name)
        .importMethodConfig({
          ...template,
          name: destWorkflowName,
          namespace: sourceMethod.methodNamespace,
        });

      void Metrics().captureEvent(Events.workflowRepoExportWorkflow, {
        ...extractWorkspaceDetails(destWorkspace),
        sourceWorkflowName: sourceMethod.methodName,
        sourceCollectionName: sourceMethod.methodNamespace,
      });
    },
  };
};
