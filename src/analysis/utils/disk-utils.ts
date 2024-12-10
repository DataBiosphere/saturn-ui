import { diskStatuses } from '@terra-ui-packages/leonardo-data-client';
import _ from 'lodash/fp';
import { getCurrentAppIncludingDeleting, getDiskAppType } from 'src/analysis/utils/app-utils';
import { getCurrentRuntime } from 'src/analysis/utils/runtime-utils';
import { AppToolLabel, appTools } from 'src/analysis/utils/tool-utils';
import { App } from 'src/libs/ajax/leonardo/models/app-models';
import { Runtime } from 'src/libs/ajax/leonardo/models/runtime-models';
import { googlePdTypes, PersistentDisk } from 'src/libs/ajax/leonardo/providers/LeoDiskProvider';
import * as Utils from 'src/libs/utils';
import { v4 as uuid } from 'uuid';

// Dataproc clusters don't have persistent disks.
export const defaultDataprocMasterDiskSize = 150;
export const defaultDataprocWorkerDiskSize = 150;
// Since Leonardo started supporting persistent disks (PDs) for GCE VMs, boot disk size for a GCE VM
// with a PD has been non-user-customizable. Terra UI uses the value below for cost estimate calculations only.
export const defaultGceBootDiskSize = 250;
export const defaultGcePersistentDiskSize = 50;
export const defaultPersistentDiskType = googlePdTypes.standard;
export const getCurrentAttachedDataDisk = (
  app: App | undefined,
  appDataDisks: PersistentDisk[]
): PersistentDisk | undefined => {
  const currentDisk: PersistentDisk | undefined = !app?.diskName
    ? undefined
    : appDataDisks.find(({ name }) => app.diskName === name);
  return currentDisk;
};

export const multipleDisksError = (disks: PersistentDisk[], creator: string, appType: AppToolLabel | undefined) => {
  // appType is undefined for runtimes (ie Jupyter, RStudio) so the first part of the ternary is for processing app
  // disks. the second part is for processing runtime disks so it filters out app disks
  const disksForUser: PersistentDisk[] = _.filter((disk) => disk.auditInfo.creator === creator, disks);
  return appType
    ? workspaceUserHasMultipleDisks(disksForUser, appType)
    : _.remove((disk) => getDiskAppType(disk) !== appType || disk.status === 'Deleting', disksForUser).length > 1;
};

export const workspaceUserHasMultipleDisks = (disks: PersistentDisk[], diskAppType: AppToolLabel): boolean => {
  const appTypeDisks = _.filter((disk) => getDiskAppType(disk) === diskAppType && disk.status !== 'Deleting', disks);
  const diskWorkspaces = _.map((currentDisk) => currentDisk.labels.saturnWorkspaceName, appTypeDisks);
  return _.uniq(diskWorkspaces).length < diskWorkspaces.length;
};
/**
 * A function to get the current app data disk from the list of appDataDisks and apps
 * for the passed in appType for the passed in workspace name.
 *
 * @param {string} appType App type to retrieve app data disk for
 * @param {App[]} apps List of apps in the current workspace
 * @param {AppDataDisk[]} appDataDisks List of appDataDisks in the workspace
 * @param {string} workspaceName Name of the workspace
 * @returns The appDataDisk from appDataDisks attached to the appType
 */
export const getCurrentAppDataDisk = (
  appType: AppToolLabel,
  apps: App[],
  appDataDisks: PersistentDisk[],
  workspaceName: string
): PersistentDisk | undefined => {
  // a user's PD can either be attached to their current app, detaching from a deleting app or unattached
  const currentApp = getCurrentAppIncludingDeleting(appType, apps);
  const currentDiskName = currentApp?.diskName;
  const attachedDiskNames = _.without(
    [undefined],
    _.map((app) => app.diskName, apps)
  );
  // If the disk is attached to an app (or being detached from a deleting app), return that disk. Otherwise,
  // return the newest unattached disk that was provisioned by the desired appType.

  const filteredDisks: PersistentDisk[] = _.filter(
    (disk: PersistentDisk) =>
      getDiskAppType(disk) === appType &&
      disk.status !== 'Deleting' &&
      !_.includes(disk.name, attachedDiskNames) &&
      disk.labels.saturnWorkspaceName === workspaceName,
    appDataDisks
  );
  const sortedDisks: PersistentDisk[] = _.sortBy('auditInfo.createdDate', filteredDisks);

  const newestUnattachedDisk: PersistentDisk | undefined = _.last(sortedDisks);
  const attachedDisk: PersistentDisk | undefined = currentDiskName
    ? _.find({ name: currentDiskName }, appDataDisks)
    : undefined;

  return Utils.cond(
    [!!attachedDisk, () => attachedDisk!],
    [!!newestUnattachedDisk, () => newestUnattachedDisk!],
    [Utils.DEFAULT, () => undefined]
  );
};
/**
 * Given the list of runtimes, returns the persistent disk attached to
 * the current runtime.
 * @param {runtime[]} runtimes List of runtimes.
 * @param {persistentDisk[]} persistentDisks List of persistent disks.
 * @returns persistentDisk attached to the currentRuntime.
 */
// TODO: can this just take current runtime>runtimes?
// what is the significance of of the filter on ` !_.includes(id, attachedIds)`?
export const getCurrentPersistentDisk = (
  runtimes: Runtime[] | undefined,
  persistentDisks: PersistentDisk[] | undefined
): PersistentDisk | undefined => {
  const currentRuntime = getCurrentRuntime(runtimes);
  const id: number | undefined = _.get('persistentDiskId', currentRuntime?.runtimeConfig);
  const attachedIds: number[] = _.without(
    [undefined],
    _.map((runtime) => _.get('persistentDiskId', runtime.runtimeConfig), runtimes)
  );

  return id
    ? _.find({ id }, persistentDisks)
    : _.last(
        _.sortBy(
          'auditInfo.createdDate',
          _.filter(({ id, status }) => status !== 'Deleting' && !_.includes(id, attachedIds), persistentDisks)
        )
      );
};

export const getReadyPersistentDisk = (persistentDisks: PersistentDisk[]): PersistentDisk | undefined => {
  // returns PD if one exists and is in ready status
  return persistentDisks.find((disk) => disk.status === diskStatuses.ready.leoLabel);
};

export const isCurrentGalaxyDiskDetaching = (apps: App[]): boolean => {
  const currentGalaxyApp = getCurrentAppIncludingDeleting(appTools.GALAXY.label, apps);
  return !!currentGalaxyApp && _.includes(currentGalaxyApp.status, ['DELETING', 'PREDELETING']);
};

export const generatePersistentDiskName = () => `saturn-pd-${uuid()}`;
