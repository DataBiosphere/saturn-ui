import _ from 'lodash/fp';
import { Fragment, ReactNode, useCallback, useEffect, useState } from 'react';
import { h } from 'react-hyperscript-helpers';
import { ButtonSecondary } from 'src/components/common';
import { icon } from 'src/components/icons';
import { getRegionInfo } from 'src/components/region-common';
import { TooltipCell } from 'src/components/table';
import { Metrics } from 'src/libs/ajax/Metrics';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { reportErrorAndRethrow } from 'src/libs/error';
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
        workspace: { namespace, name },
      } = workspace;
      const project = needsRequesterPaysProject ? requesterPaysProjectStore.get() : undefined;
      const response = await Workspaces(signal).workspace(namespace, name).checkBucketLocation(project);
      setBucketLocation(response);
    } catch (error) {
      if (storageDetails.fetchedGoogleBucketLocation === 'RPERROR') {
        setNeedsRequesterPaysProject(true);
      } else {
        reportErrorAndRethrow('Error loading bucket location');
      }
    } finally {
      setLoading(false);
    }
  }, [workspace, needsRequesterPaysProject, signal, storageDetails.fetchedGoogleBucketLocation]);

  useEffect(() => {
    // Check if the workspace is initialized
    if (!workspace?.workspaceInitialized) {
      return;
    }

    // Handle the fetched Google Bucket location status
    if (storageDetails.fetchedGoogleBucketLocation === 'SUCCESS') {
      // If the location fetch was successful, set the bucket location and type
      setBucketLocation({
        location: storageDetails.googleBucketLocation,
        locationType: storageDetails.googleBucketType,
      });
      // Set loading to false as the operation is complete
      setLoading(false);
      return;
    }

    // If the location fetch was not successful, load the Google Bucket location
    loadGoogleBucketLocation();
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
