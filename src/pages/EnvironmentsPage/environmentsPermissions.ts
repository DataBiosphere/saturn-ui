import {
  DecoratedComputeResource,
  LeoResourcePermissionsProvider,
} from 'src/analysis/Environments/Environments.models';
import { getCreatorForCompute } from 'src/analysis/utils/resource-utils';
import { cromwellAppToolLabels } from 'src/analysis/utils/tool-utils';
import { App, isApp } from 'src/libs/ajax/leonardo/models/app-models';
import { PersistentDisk } from 'src/libs/ajax/leonardo/models/disk-models';
import { ListRuntimeItem } from 'src/libs/ajax/leonardo/models/runtime-models';
import { getTerraUser } from 'src/libs/state';

const makePermissionsProvider = (userEmailGetter: () => string): LeoResourcePermissionsProvider => {
  const permissionsProvider: LeoResourcePermissionsProvider = {
    canDeleteDisk: (disk: PersistentDisk) => {
      const currentUserEmail = userEmailGetter();
      const canDelete = disk.auditInfo.creator === currentUserEmail;
      return canDelete;
    },
    canPauseResource: (resource: App | ListRuntimeItem) => {
      const currentUserEmail = userEmailGetter();
      const creator = getCreatorForCompute(resource);
      return currentUserEmail === creator;
    },
    canDeleteApp: (resource: DecoratedComputeResource) => {
      if (isApp(resource)) {
        return !Object.keys(cromwellAppToolLabels).includes(resource.appType);
      }
    },
  };
  return permissionsProvider;
};

const currentUserEmailGetter = (): string => {
  return getTerraUser().email!;
};

export const leoResourcePermissions = makePermissionsProvider(currentUserEmailGetter);
