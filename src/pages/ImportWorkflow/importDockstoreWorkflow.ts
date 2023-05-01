import _ from 'lodash/fp';
import { Ajax } from 'src/libs/ajax';

type ImportDockstoreWorkflowArgs = {
  workspace: {
    namespace: string;
    name: string;
  };
  workflow: {
    path: string;
    version: string;
    source: string;
  };
  workflowName: string;
};

type ImportDockstoreWorkflowOptions = {
  overwrite?: boolean;
};

export const importDockstoreWorkflow = async (
  { workspace, workflow, workflowName }: ImportDockstoreWorkflowArgs,
  { overwrite = false }: ImportDockstoreWorkflowOptions = {}
) => {
  const { name, namespace } = workspace;
  const { path, version, source } = workflow;

  const workspaceApi = Ajax().Workspaces.workspace(namespace, name);

  const [entityMetadata, { outputs: workflowOutputs }] = await Promise.all([
    workspaceApi.entityMetadata(),
    Ajax().Methods.configInputsOutputs({
      methodRepoMethod: {
        methodPath: path,
        methodVersion: version,
        sourceRepo: source,
      },
    }),
    // If overwrite is true, attempt to delete any existing workflow with the given name.
    // Do not error if no such workflow exists.
    overwrite
      ? workspaceApi
          .methodConfig(namespace, workflowName)
          .delete()
          .catch((err) => {
            if ((err as Response).status === 404) {
            } else {
              throw err;
            }
          })
      : Promise.resolve(),
  ]);

  const defaultOutputConfiguration = _.flow(
    _.map((output: { name: string }) => {
      const outputExpression = `this.${_.last(_.split('.', output.name))}`;
      return [output.name, outputExpression];
    }),
    _.fromPairs
  )(workflowOutputs);

  await workspaceApi.importMethodConfigFromDocker({
    namespace,
    name: workflowName,
    rootEntityType: _.head(_.keys(entityMetadata)),
    inputs: {},
    outputs: defaultOutputConfiguration,
    prerequisites: {},
    methodConfigVersion: 1,
    deleted: false,
    methodRepoMethod: {
      sourceRepo: source,
      methodPath: path,
      methodVersion: version,
    },
  });
};
