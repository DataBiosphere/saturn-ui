import { CloudContext } from '@terra-ui-packages/leonardo-data-client';
import _ from 'lodash/fp';
import { gpuTypes, machineTypes, zonesToGpus } from 'src/analysis/utils/gce-machines';
import {
  cloudRuntimeTools,
  isRuntimeToolLabel,
  isToolLabel,
  RuntimeToolLabel,
  runtimeToolLabels,
  ToolLabel,
} from 'src/analysis/utils/tool-utils';
import {
  DisplayRuntimeStatus,
  GetRuntimeItem,
  LeoRuntimeImage,
  LeoRuntimeStatus,
  Runtime,
} from 'src/libs/ajax/leonardo/models/runtime-models';
import * as Utils from 'src/libs/utils';
import { CloudProvider } from 'src/workspaces/utils';
import { v4 as uuid } from 'uuid';

export const defaultGceMachineType = 'n1-standard-1';
export const defaultDataprocMachineType = 'n1-standard-4';
export const defaultRStudioMachineType = 'n1-standard-4';
export const defaultNumDataprocWorkers = 2;
export const defaultNumDataprocPreemptibleWorkers = 0;

export const defaultGpuType = 'nvidia-tesla-t4';
export const defaultNumGpus = 1;

export const defaultLocation = 'US-CENTRAL1';

export const defaultComputeZone = 'US-CENTRAL1-A';
export const defaultComputeRegion = 'US-CENTRAL1';

export const defaultAutopauseThreshold = 30;
// Leonardo considers autopause disabled when the threshold is set to 0
export const autopauseDisabledValue = 0;

export const isAutopauseEnabled = (threshold: number): boolean => threshold > autopauseDisabledValue;

export const getAutopauseThreshold = (isEnabled: boolean): number =>
  isEnabled ? defaultAutopauseThreshold : autopauseDisabledValue;

export const usableStatuses: LeoRuntimeStatus[] = ['Updating', 'Running'];

export const getDefaultMachineType = (isDataproc: boolean, tool: ToolLabel): string =>
  Utils.cond(
    [isDataproc, () => defaultDataprocMachineType],
    [tool === runtimeToolLabels.RStudio, () => defaultRStudioMachineType],
    [Utils.DEFAULT, () => defaultGceMachineType]
  );

export const findMachineType = (name: string) => {
  return _.find({ name }, machineTypes) || { name, cpu: 0, memory: 0, price: 0, preemptiblePrice: 0 };
};

export const getValidGpuTypesForZone = (zone: string) => {
  return _.flow(_.find({ name: zone }), _.get(['validTypes']))(zonesToGpus);
};

export const getValidGpuOptions = (numCpus: number, mem: number, zone: string) => {
  const validGpuOptionsForZone = getValidGpuTypesForZone(zone);
  const validGpuOptions = _.filter(
    ({ maxNumCpus, maxMem, type }) => numCpus <= maxNumCpus && mem <= maxMem && validGpuOptionsForZone.includes(type),
    gpuTypes
  );
  return (
    validGpuOptions || {
      name: '?',
      type: '?',
      numGpus: '?',
      maxNumCpus: '?',
      maxMem: '?',
      price: NaN,
      preemptiblePrice: NaN,
    }
  );
};

export const trimRuntimesOldestFirst = (runtimes: Runtime[]): Runtime[] => {
  const runtimesWithoutDeleting: Runtime[] = _.remove({ status: 'Deleting' }, runtimes);
  const sortedRuntimes: Runtime[] = _.sortBy('auditInfo.createdDate', runtimesWithoutDeleting);
  return sortedRuntimes;
};

/**
 * Get the first GCP-supported image URL on the runtime.
 */
export const getImageUrlFromRuntime = (
  runtimeDetails: Pick<GetRuntimeItem, 'runtimeImages'> | undefined
): string | undefined => {
  const images: LeoRuntimeImage[] = runtimeDetails?.runtimeImages ?? [];
  const gcpToolLabels: RuntimeToolLabel[] = cloudRuntimeTools.GCP.map(({ label }) => label);
  const isGcpRuntimeImage = ({ imageType }) => {
    if (isToolLabel(imageType) && isRuntimeToolLabel(imageType)) {
      const imageToolLabel: RuntimeToolLabel = imageType;
      return gcpToolLabels.includes(imageToolLabel);
    }
    return undefined;
  };
  return images.find(isGcpRuntimeImage)?.imageUrl;
};

// Status note: undefined means still loading and no runtime
export const getCurrentRuntime = (runtimes: Runtime[] | undefined): Runtime | undefined =>
  !runtimes ? undefined : _.flow(trimRuntimesOldestFirst, _.last)(runtimes) || undefined;

// TODO: This function needs to be removed once we have testing in place in all places its used
// DO NOT USE THIS
export const getRuntimeForTool = (
  toolLabel: ToolLabel,
  currentRuntime: Runtime,
  currentRuntimeTool: RuntimeToolLabel
): Runtime | undefined =>
  Utils.cond([toolLabel === currentRuntimeTool, () => currentRuntime], [Utils.DEFAULT, () => undefined]);

export const getAnalysesDisplayList = _.flow(
  _.map(_.flow(_.get('name'), _.split('/'), _.nth(1))),
  _.without([undefined]),
  _.join(', ')
);

export const getConvertedRuntimeStatus = (runtime: Runtime | undefined): LeoRuntimeStatus | undefined => {
  return runtime && (runtime.patchInProgress ? ('Updating' as const) : runtime.status); // NOTE: preserves null vs undefined
};

export const getDisplayRuntimeStatus = (status: LeoRuntimeStatus): DisplayRuntimeStatus =>
  Utils.switchCase<string, DisplayRuntimeStatus>(
    _.lowerCase(status),
    ['leoreconfiguring', () => 'Updating'],
    ['starting', () => 'Resuming'],
    ['stopping', () => 'Pausing'],
    ['stopped', () => 'Paused'],
    ['prestarting', () => 'Resuming'],
    ['prestopping', () => 'Pausing'],
    // TODO: Type safety could be improved here and the cast removed by mapping between the two types
    // using an object typed Record<LeoAppStatus, DisplayAppStatus> instead of switchCase.
    [Utils.DEFAULT, () => _.capitalize(status) as DisplayRuntimeStatus]
  );

export const displayNameForGpuType = (type: string): string => {
  return Utils.switchCase(
    type,
    ['nvidia-tesla-p4', () => 'NVIDIA Tesla P4'],
    ['nvidia-tesla-v100', () => 'NVIDIA Tesla V100'],
    ['nvidia-tesla-p100', () => 'NVIDIA Tesla P100'],
    [Utils.DEFAULT, () => 'NVIDIA Tesla T4']
  );
};

export const getIsRuntimeBusy = (runtime: Runtime): boolean => {
  const {
    Creating: creating,
    Updating: updating,
    LeoReconfiguring: reconfiguring,
    Stopping: stopping,
    Starting: starting,
  } = _.countBy(getConvertedRuntimeStatus, [runtime]);
  return _.sum([creating, updating, reconfiguring, stopping, starting]) > 0;
};

// NOTE: the label property is being compared to Ajax response values, so the label cannot be changed without
// impacting code.
export const cloudProviders: { [label: string]: { label: CloudProvider } } = {
  azure: { label: 'AZURE' },
  gcp: { label: 'GCP' },
};

export const isGcpContext = (cloudContext: CloudContext): boolean =>
  cloudContext.cloudProvider === cloudProviders.gcp.label;
export const isAzureContext = (cloudContext: CloudContext): boolean =>
  cloudContext.cloudProvider === cloudProviders.azure.label;

export const generateRuntimeName = () => `saturn-${uuid()}`;
