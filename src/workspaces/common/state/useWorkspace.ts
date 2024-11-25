import _ from 'lodash/fp';
import { Fragment, useEffect, useRef, useState } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import { defaultLocation } from 'src/analysis/utils/runtime-utils';
import { Link } from 'src/components/common';
import { locationTypes } from 'src/components/region-common';
import { AzureStorage } from 'src/libs/ajax/AzureStorage';
import { responseContainsRequesterPaysError, saToken } from 'src/libs/ajax/GoogleStorage';
import { Metrics } from 'src/libs/ajax/Metrics';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { ErrorCallback, withErrorHandling, withErrorIgnoring, withErrorReporting } from 'src/libs/error';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { clearNotification, notify } from 'src/libs/notifications';
import { useStore } from 'src/libs/react-utils';
import { getTerraUser, InitializedWorkspaceWrapper, workspaceStore } from 'src/libs/state';
import { differenceFromNowInSeconds, withBusyState } from 'src/libs/utils';
import { updateRecentlyViewedWorkspaces } from 'src/workspaces/common/state/recentlyViewedWorkspaces';
import { canWrite, isAzureWorkspace, isGoogleWorkspace, isOwner } from 'src/workspaces/utils';

export type { InitializedWorkspaceWrapper } from 'src/libs/state';

export interface StorageDetails {
  googleBucketLocation: string; // historically returns defaultLocation if bucket location cannot be retrieved or Azure
  googleBucketType: string; // historically returns locationTypes.default if bucket type cannot be retrieved or Azure
  fetchedGoogleBucketLocation: 'SUCCESS' | 'ERROR' | 'RPERROR' | undefined; // undefined: still fetching
  azureContainerRegion?: string;
  azureContainerUrl?: string;
  azureContainerSasUrl?: string;
}

export interface WorkspaceDetails {
  workspace: InitializedWorkspaceWrapper | undefined;
  accessError: boolean;
  loadingWorkspace: boolean;
  storageDetails: StorageDetails;
  refreshWorkspace: () => Promise<void>;
}

export const googlePermissionsRecheckRate = 15000;
export const azureBucketRecheckRate = 5000;

export const useWorkspace = (namespace, name): WorkspaceDetails => {
  const [accessError, setAccessError] = useState(false);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const accessNotificationId = useRef<string | undefined>();
  const workspace = useStore(workspaceStore);

  const [{ location, locationType, fetchedLocation }, setGoogleStorage] = useState<{
    fetchedLocation: 'SUCCESS' | 'ERROR' | 'RPERROR' | undefined;
    location: string;
    locationType: string;
  }>({
    // Changes to these defaults should be reflected by the `defaultGoogleBucketOptions` defined in
    // workspace-fixtures.ts, which are intended to follow this implementation.
    fetchedLocation: undefined,
    location: defaultLocation,
    locationType: locationTypes.default, // These default types are historical
  });
  const [azureStorage, setAzureStorage] = useState<{
    location: string;
    storageContainerUrl: string | undefined;
    sasUrl: string;
  }>();

  // If the namespace/name have changed (for example, during a clone), make
  // sure not to use the stored value of workspaceInitialized.
  const workspaceInitialized =
    workspace?.workspaceInitialized && workspace.workspace.namespace === namespace && workspace.workspace.name === name;

  const [controller, setController] = useState(new window.AbortController());
  const abort = () => {
    controller.abort();
    setController(new window.AbortController());
  };
  const signal = controller.signal;
  const checkInitializationTimeout = useRef<number>();

  const updateWorkspaceInStore = (workspace, initialized) => {
    // clone the workspace to force React to re-render components that depend on workspace
    const update = _.clone(workspace);
    update.workspaceInitialized = initialized;
    workspaceStore.set(update);
  };

  const checkWorkspaceInitialization = (workspace, times = 0) => {
    console.assert(!!workspace, 'initialization should not be called before workspace details are fetched');

    if (isGoogleWorkspace(workspace)) {
      !workspaceInitialized ? checkGooglePermissions(workspace, times) : loadGoogleBucketLocationIgnoringError();
    } else if (isAzureWorkspace(workspace)) {
      !workspaceInitialized ? checkAzureStorageExists(workspace) : loadAzureStorageDetails(workspace);
    }
  };

  const checkGooglePermissions = async (workspace, times) => {
    try {
      // Because checkBucketReadAccess can succeed and subsequent calls to get the bucket location or storage
      // cost estimate may fail (due to caching of previous failure results), do not consider permissions
      // to be done syncing until all the methods that we know will be called quickly in succession succeed.
      // This is not guaranteed to eliminate the issue, but it improves the odds.
      await Workspaces(signal).workspace(namespace, name).checkBucketReadAccess();
      if (canWrite(workspace.accessLevel)) {
        // Calls done on the Workspace Dashboard. We could store the results and pass them
        // through, but then we would have to do it checkWorkspaceInitialization as well,
        // and nobody else actually needs these values.
        await Workspaces(signal).workspace(namespace, name).storageCostEstimate();
        await Workspaces(signal).workspace(namespace, name).bucketUsage();
      }
      await loadGoogleBucketLocation();
      updateWorkspaceInStore(workspace, true);
    } catch (error: any) {
      const errorText = await error.text();
      if (responseContainsRequesterPaysError(errorText)) {
        // loadGoogleBucketLocation will not get called in this case because checkBucketReadAccess fails first,
        // but it would also fail with the requester pays error.
        setGoogleStorage({ fetchedLocation: 'RPERROR', location, locationType });
        updateWorkspaceInStore(workspace, true);
      } else {
        updateWorkspaceInStore(workspace, false);
        console.log('Google permissions are still syncing'); // eslint-disable-line no-console
        if (times === 1) {
          void Metrics().captureEvent(Events.permissionsSynchronizationDelay, {
            accessLevel: workspace.accessLevel,
            createdDate: workspace.workspace.createdDate,
            isWorkspaceCreator: workspace.workspace.createdBy === getTerraUser().email,
            ...extractWorkspaceDetails(workspace),
          });
        }
        checkInitializationTimeout.current = window.setTimeout(
          () => checkWorkspaceInitialization(workspace, times + 1),
          googlePermissionsRecheckRate
        );
      }
    }
  };

  // Note that withErrorIgnoring is used because checkBucketLocation will error for requester pays workspaces.
  const loadGoogleBucketLocationIgnoringError = withErrorIgnoring(async () => {
    await loadGoogleBucketLocation();
  });

  const loadGoogleBucketLocation = async () => {
    try {
      const storageDetails = await Workspaces(signal).workspace(namespace, name).checkBucketLocation();
      storageDetails.fetchedLocation = 'SUCCESS';
      setGoogleStorage(storageDetails);
    } catch (error) {
      const errorText = error instanceof Response ? Error(await error.text()) : `${error}`;
      if (responseContainsRequesterPaysError(errorText)) {
        setGoogleStorage({ fetchedLocation: 'RPERROR', location, locationType });
      } else {
        setGoogleStorage({ fetchedLocation: 'ERROR', location, locationType });
      }
      throw error;
    }
  };

  const storeAzureStorageDetails = (azureStorageDetails) => {
    const { location, sas } = azureStorageDetails;
    const sasUrl = sas.url;
    setAzureStorage({ storageContainerUrl: _.head(_.split('?', sasUrl)), location, sasUrl });
  };

  const checkAzureStorageExists = async (workspace) => {
    try {
      storeAzureStorageDetails(await AzureStorage(signal).details(workspace.workspace.workspaceId));
      updateWorkspaceInStore(workspace, true);
    } catch (error) {
      updateWorkspaceInStore(workspace, false);
      // We expect to get a transient error while the workspace is cloning. We will improve
      // the handling of this with WOR-534 so that we correctly differentiate between the
      // expected transient error and a workspace that is truly missing a storage container.
      console.log(`Error thrown by AzureStorage.details: ${error}`); // eslint-disable-line no-console
      checkInitializationTimeout.current = window.setTimeout(
        () => checkWorkspaceInitialization(workspace),
        azureBucketRecheckRate
      );
    }
  };

  const loadAzureStorageDetails = withErrorReporting('Error loading storage information')(async (workspace) => {
    storeAzureStorageDetails(await AzureStorage(signal).details(workspace.workspace.workspaceId));
  });

  const doWorkspaceRefresh = async (): Promise<void> => {
    const workspace = await Workspaces(signal)
      .workspace(namespace, name)
      .details([
        'accessLevel',
        'azureContext',
        'canCompute',
        'canShare',
        'owners',
        'policies',
        'workspace',
        'workspace.state',
        'workspace.attributes',
        'workspace.authorizationDomain',
        'workspace.cloudPlatform',
        'workspace.errorMessage',
        'workspace.isLocked',
        'workspace.workspaceId',
        'workspaceSubmissionStats',
      ]);
    updateWorkspaceInStore(workspace, workspaceInitialized);
    updateRecentlyViewedWorkspaces(workspace.workspace.workspaceId);

    const {
      accessLevel,
      workspace: { createdBy, createdDate, googleProject },
    } = workspace;

    checkWorkspaceInitialization(workspace);

    // Request a service account token. If this is the first time, it could take some time before everything is in sync.
    // Doing this now, even though we don't explicitly need it now, increases the likelihood that it will be ready when it is needed.
    if (canWrite(accessLevel) && isGoogleWorkspace(workspace)) {
      saToken(googleProject!);
    }

    // This is old code-- it is unclear if this case can actually happen anymore.
    if (!isOwner(accessLevel) && createdBy === getTerraUser().email && differenceFromNowInSeconds(createdDate) < 60) {
      accessNotificationId.current = notify('info', 'Workspace access synchronizing', {
        message: h(Fragment, [
          'It looks like you just created this workspace. It may take up to a minute before you have access to modify it. Refresh at any time to re-check.',
          div({ style: { marginTop: '1rem' } }, [
            h(
              Link,
              {
                onClick: () => {
                  refreshWorkspace();
                  clearNotification(accessNotificationId.current!);
                },
              },
              ['Click to refresh now']
            ),
          ]),
        ]),
      });
    }
  };

  const checkForAccessError: ErrorCallback = (error: unknown) => {
    if (error instanceof Response && error.status === 404) {
      setAccessError(true);
    } else {
      throw error;
    }
  };

  const refreshWorkspace: () => Promise<void> = _.flow(
    withErrorHandling(checkForAccessError),
    withErrorReporting('Error loading workspace'),
    withBusyState(setLoadingWorkspace)
  )(doWorkspaceRefresh) as () => Promise<void>;

  useEffect(() => {
    if (!workspace) {
      refreshWorkspace();
    } else if (workspace.workspace.namespace !== namespace || workspace.workspace.name !== name) {
      // if the workspace is missmatched, clear store before fetching workspace
      workspaceStore.reset();
      refreshWorkspace();
    } else {
      checkWorkspaceInitialization(workspace);
    }
    return () => {
      abort();
      clearTimeout(checkInitializationTimeout.current);
    };
    //  eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, namespace]);

  const storageDetails = {
    googleBucketLocation: location,
    googleBucketType: locationType,
    fetchedGoogleBucketLocation: fetchedLocation,
    azureContainerRegion: azureStorage?.location,
    azureContainerUrl: azureStorage?.storageContainerUrl,
    azureContainerSasUrl: azureStorage?.sasUrl,
  };

  return { workspace, accessError, loadingWorkspace, storageDetails, refreshWorkspace };
};
