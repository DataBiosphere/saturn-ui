import { cloudServices } from 'src/analysis/utils/gce-machines';
import {
  defaultDataprocMachineType,
  getDefaultMachineType,
  getImageUrlFromRuntime,
} from 'src/analysis/utils/runtime-utils';
import { getToolLabelFromCloudEnv } from 'src/analysis/utils/tool-utils';
import { GooglePdType, PersistentDisk, SharedPdType } from 'src/libs/ajax/leonardo/models/disk-models';

export interface IComputeConfig {
  diskSize: number;
  diskType: GooglePdType;
  persistentDiskSize: number;
  persistentDiskType: SharedPdType; // TODO: Switch to DiskType
  masterMachineType: string;
  masterDiskSize: number;
  numberOfWorkers: number;
  numberOfPreemptibleWorkers: number;
  workerMachineType: string;
  workerDiskSize: number;
  componentGatewayEnabled: boolean;
  gpuEnabled: boolean;
  hasGpu: boolean;
  gpuType: string;
  numGpus: number;
  autopauseThreshold: number;
  computeRegion: string;
  computeZone: string;
}

export const buildExistingEnvironmentConfig = (
  computeConfig: IComputeConfig,
  currentRuntimeDetails: any,
  currentPersistentDiskDetails: PersistentDisk,
  isDataproc: boolean
) => {
  const runtimeConfig = currentRuntimeDetails?.runtimeConfig;
  const cloudService = runtimeConfig?.cloudService;
  const numberOfWorkers = runtimeConfig?.numberOfWorkers || 0;
  const gpuConfig = runtimeConfig?.gpuConfig;
  const toolLabel = getToolLabelFromCloudEnv(currentRuntimeDetails);
  return {
    hasGpu: computeConfig.hasGpu,
    autopauseThreshold: computeConfig.autopauseThreshold,
    runtime: currentRuntimeDetails
      ? {
          cloudService,
          toolDockerImage: getImageUrlFromRuntime(currentRuntimeDetails),
          tool: toolLabel,
          ...(currentRuntimeDetails?.jupyterUserScriptUri && {
            jupyterUserScriptUri: currentRuntimeDetails?.jupyterUserScriptUri,
          }),
          ...(cloudService === cloudServices.GCE
            ? {
                zone: computeConfig.computeZone,
                machineType: runtimeConfig.machineType || getDefaultMachineType(false, toolLabel),
                ...(computeConfig.hasGpu && gpuConfig ? { gpuConfig } : {}),
                bootDiskSize: runtimeConfig.bootDiskSize,
                ...(runtimeConfig.persistentDiskId
                  ? {
                      persistentDiskAttached: true,
                    }
                  : {
                      diskSize: runtimeConfig.diskSize,
                    }),
              }
            : {
                region: computeConfig.computeRegion,
                masterMachineType: runtimeConfig.masterMachineType || defaultDataprocMachineType,
                masterDiskSize: runtimeConfig.masterDiskSize || 100,
                numberOfWorkers,
                componentGatewayEnabled: runtimeConfig.componentGatewayEnabled || isDataproc,
                ...(numberOfWorkers && {
                  numberOfPreemptibleWorkers: runtimeConfig.numberOfPreemptibleWorkers || 0,
                  workerMachineType: runtimeConfig.workerMachineType || defaultDataprocMachineType,
                  workerDiskSize: runtimeConfig.workerDiskSize || 100,
                }),
              }),
        }
      : undefined,
    persistentDisk: currentPersistentDiskDetails
      ? { size: currentPersistentDiskDetails.size, diskType: currentPersistentDiskDetails.diskType }
      : undefined,
  };
};
