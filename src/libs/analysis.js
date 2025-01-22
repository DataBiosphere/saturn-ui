import _ from 'lodash/fp';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import * as Utils from 'src/libs/utils';

export const launch = async ({
  isSnapshot,
  workspace: {
    workspace: { namespace, name, googleProject, bucketName },
    accessLevel,
  },
  config: { namespace: configNamespace, name: configName, rootEntityType },
  selectedEntityType,
  selectedEntityNames,
  newSetName,
  useCallCache = true,
  deleteIntermediateOutputFiles,
  useReferenceDisks,
  memoryRetryMultiplier,
  userComment,
  ignoreEmptyOutputs,
  monitoringScript,
  monitoringImage,
  monitoringImageScript,
  perWorkflowCostCap,
  onProgress,
}) => {
  const createSet = () => {
    onProgress('createSet');
    return Workspaces()
      .workspace(namespace, name)
      .createEntity({
        name: newSetName,
        entityType: `${selectedEntityType}_set`,
        attributes: {
          [`${selectedEntityType}s`]: {
            itemsType: 'EntityReference',
            items: _.map((entityName) => ({ entityName, entityType: selectedEntityType }), selectedEntityNames),
          },
        },
      });
  };
  onProgress('checkBucketAccess');
  try {
    await Workspaces().workspace(namespace, name).checkBucketAccess(googleProject, bucketName, accessLevel);
  } catch (error) {
    throw new Error(
      'Error confirming workspace bucket access. This may be a transient problem. Please try again in a few minutes. If the problem persists, please contact support.'
    );
  }
  const { entityName, processSet = false } = await Utils.cond(
    [isSnapshot || selectedEntityType === undefined, () => ({})],
    [
      `${selectedEntityType}_set` === rootEntityType,
      async () => {
        await createSet();
        return { entityName: newSetName };
      },
    ],
    [
      selectedEntityType === rootEntityType,
      async () => {
        if (_.size(selectedEntityNames) === 1) {
          return { entityName: selectedEntityNames[0] };
        }
        await createSet();
        return { entityName: newSetName, processSet: true };
      },
    ],
    [
      selectedEntityType === `${rootEntityType}_set`,
      () => {
        if (_.size(selectedEntityNames) > 1) {
          throw new Error('Cannot launch against multiple sets');
        }
        return { entityName: selectedEntityNames[0], processSet: true };
      },
    ]
  );
  onProgress('launch');
  return Workspaces()
    .workspace(namespace, name)
    .methodConfig(configNamespace, configName)
    .launch({
      entityType: Utils.cond([entityName === undefined, () => undefined], [processSet, () => `${rootEntityType}_set`], () => rootEntityType),
      entityName,
      expression: processSet ? `this.${rootEntityType}s` : undefined,
      useCallCache,
      deleteIntermediateOutputFiles,
      useReferenceDisks,
      memoryRetryMultiplier,
      userComment,
      ignoreEmptyOutputs,
      monitoringScript,
      monitoringImage,
      monitoringImageScript,
      perWorkflowCostCap,
    });
};
