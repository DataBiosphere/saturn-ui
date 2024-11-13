import _ from 'lodash/fp';
import { Fragment, ReactNode, useCallback, useEffect, useState } from 'react';
import { h } from 'react-hyperscript-helpers';
import { ButtonSecondary } from 'src/components/common';
import { icon } from 'src/components/icons';
import { getRegionInfo } from 'src/components/region-common';
import { TooltipCell } from 'src/components/table';
import { Metrics } from 'src/libs/ajax/Metrics';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { useCancellation } from 'src/libs/react-utils';
import { requesterPaysProjectStore } from 'src/libs/state';
import { requesterPaysWrapper } from 'src/workspaces/common/requester-pays/bucket-utils';
import { RequesterPaysModal } from 'src/workspaces/common/requester-pays/RequesterPaysModal';
import { StorageDetails } from 'src/workspaces/common/state/useWorkspace';
import { GoogleWorkspace } from 'src/workspaces/utils';

interface BucketLocationProps {
  workspace: GoogleWorkspace & { workspaceInitialized: boolean };
  storageDetails: StorageDetails;
}

export const BucketLocation = requesterPaysWrapper({ onDismiss: _.noop })((props: BucketLocationProps): ReactNode => {
  const { workspace, storageDetails } = props;
  const [loading, setLoading] = useState<boolean>(true);
  const [{ location, locationType }, setBucketLocation] = useState<{ location?: string; locationType?: string }>({
    location: undefined,
    locationType: undefined,
  });
  const [needsRequesterPaysProject, setNeedsRequesterPaysProject] = useState<boolean>(false);
  const [showRequesterPaysModal, setShowRequesterPaysModal] = useState<boolean>(false);

  const signal = useCancellation();
  const loadGoogleBucketLocation = useCallback(async () => {
    setLoading(true);
    try {
      const {
        workspace: { namespace, name, googleProject },
      } = workspace;
      const project = needsRequesterPaysProject ? requesterPaysProjectStore.get() : googleProject;
      const response = await Workspaces(signal).workspace(namespace, name).checkBucketLocation(project);
      setBucketLocation(response);
    } catch (error) {
      // if (error) {
      setNeedsRequesterPaysProject(true);
      // } else {
      //  reportError('Unable to get bucket location.', error);
      // }
    } finally {
      setLoading(false);
    }
  }, [workspace, signal, needsRequesterPaysProject]);

  useEffect(() => {
    if (workspace?.workspaceInitialized) {
      if (storageDetails.fetchedGoogleBucketLocation === 'ERROR') {
        // storageDetails.fetchedGoogleBucketLocation stores if an error was encountered from the server,
        // while storageDetails.googleBucketLocation will contain the default value.
        // In the case of requester pays workspaces, we wish to show the user more information in this case and allow them to link a workspace.
        loadGoogleBucketLocation();
      } else if (storageDetails.fetchedGoogleBucketLocation === 'RPERROR') {
        setNeedsRequesterPaysProject(true);
        setLoading(false);
      } else if (storageDetails.fetchedGoogleBucketLocation === 'SUCCESS') {
        setBucketLocation({
          location: storageDetails.googleBucketLocation,
          locationType: storageDetails.googleBucketType,
        });
        setLoading(false);
      }
    }
  }, [
    loadGoogleBucketLocation,
    setBucketLocation,
    needsRequesterPaysProject,
    // Explicit dependencies to avoid extra calls to loadGoogleBucketLocation
    workspace?.workspaceInitialized,
    storageDetails.fetchedGoogleBucketLocation,
    storageDetails.googleBucketLocation,
    storageDetails.googleBucketType,
  ]);

  if (loading) {
    return 'Loading';
  }

  if (!location) {
    return h(Fragment, [
      'Unknown',
      needsRequesterPaysProject &&
        h(
          ButtonSecondary,
          {
            'aria-label': 'Load bucket location',
            tooltip:
              "This workspace's bucket is requester pays. Click to choose a workspace to bill requests to and get the bucket's location.",
            style: { height: '1rem', marginLeft: '1ch' },
            onClick: () => {
              setShowRequesterPaysModal(true);
              void Metrics().captureEvent(
                Events.workspaceDashboardBucketRequesterPays,
                extractWorkspaceDetails(workspace)
              );
            },
          },
          [icon('sync')]
        ),
      showRequesterPaysModal &&
        h(RequesterPaysModal, {
          onDismiss: () => setShowRequesterPaysModal(false),
          onSuccess: (selectedGoogleProject) => {
            requesterPaysProjectStore.set(selectedGoogleProject);
            setShowRequesterPaysModal(false);
            loadGoogleBucketLocation();
          },
        }),
    ]);
  }

  const { flag, regionDescription } = getRegionInfo(location, locationType);
  return h(TooltipCell, [flag, ' ', regionDescription]);
});
