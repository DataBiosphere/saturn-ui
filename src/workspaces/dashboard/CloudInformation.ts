import { InfoBox, Link } from '@terra-ui-packages/components';
import { cond } from '@terra-ui-packages/core-utils';
import { Fragment, ReactNode, useEffect, useState } from 'react';
import { div, dl, h } from 'react-hyperscript-helpers';
import { bucketBrowserUrl } from 'src/auth/auth';
import { ClipboardButton } from 'src/components/ClipboardButton';
import { icon } from 'src/components/icons';
import { TooltipCell } from 'src/components/table';
import { ReactComponent as GcpLogo } from 'src/images/gcp.svg';
import { Metrics } from 'src/libs/ajax/Metrics';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { withErrorReporting } from 'src/libs/error';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { useCancellation } from 'src/libs/react-utils';
import { formatBytes, newTabLinkProps } from 'src/libs/utils';
import { InitializedWorkspaceWrapper as Workspace, StorageDetails } from 'src/workspaces/common/state/useWorkspace';
import { AzureStorageDetails } from 'src/workspaces/dashboard/AzureStorageDetails';
import { BucketLocation } from 'src/workspaces/dashboard/BucketLocation';
import { InfoRow } from 'src/workspaces/dashboard/InfoRow';
import {
  AzureWorkspace,
  canRead,
  canWrite,
  GoogleWorkspace,
  isAzureWorkspace,
  isGoogleWorkspace,
} from 'src/workspaces/utils';

interface CloudInformationProps {
  storageDetails: StorageDetails;
  workspace: Workspace;
}

interface AzureCloudInformationProps extends CloudInformationProps {
  workspace: AzureWorkspace & { workspaceInitialized: boolean };
}

interface GoogleCloudInformationProps extends CloudInformationProps {
  workspace: GoogleWorkspace & { workspaceInitialized: boolean };
}

const AzureCloudInformation = (props: AzureCloudInformationProps): ReactNode => {
  const { workspace, storageDetails } = props;
  const azureContext = workspace.azureContext;
  return h(Fragment, [
    dl([
      h(AzureStorageDetails, {
        azureContext,
        storageDetails,
        eventWorkspaceDetails: extractWorkspaceDetails(workspace),
      }),
    ]),
    div({ style: { margin: '0.5rem', fontSize: 12 } }, [
      div([
        'Use SAS URL in conjunction with ',
        h(
          Link,
          {
            ...newTabLinkProps,
            href: 'https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azcopy-v10',
            style: { textDecoration: 'underline' },
          },
          ['AzCopy']
        ),
        ' or ',
        h(
          Link,
          {
            ...newTabLinkProps,
            href: 'https://azure.microsoft.com/en-us/products/storage/storage-explorer',
            style: { textDecoration: 'underline' },
          },
          ['Azure Storage Explorer']
        ),
        ' to access storage associated with this workspace.',
      ]),
      div({ style: { paddingTop: '0.5rem', fontWeight: 'bold' } }, [
        'The SAS URL expires after 8 hours. To generate a new SAS URL, refresh this page.',
      ]),
    ]),
  ]);
};

const GoogleCloudInformation = (props: GoogleCloudInformationProps): ReactNode => {
  const { workspace, storageDetails } = props;
  const { accessLevel } = workspace;
  const { bucketName, googleProject } = workspace.workspace;

  const signal = useCancellation();

  const [storageCost, setStorageCost] = useState<{ isSuccess: boolean; estimate: string; lastUpdated?: string }>();
  const [bucketSize, setBucketSize] = useState<{ isSuccess: boolean; usage: string; lastUpdated?: string }>();

  useEffect(() => {
    const { namespace, name } = workspace.workspace;

    const loadStorageCost = withErrorReporting('Error loading storage cost data')(async () => {
      try {
        const { estimate, usageInBytes, lastUpdated } = await Workspaces(signal)
          .workspace(namespace, name)
          .storageCostEstimateV2();
        setStorageCost({ isSuccess: true, estimate, lastUpdated });
        setBucketSize({ isSuccess: true, usage: formatBytes(usageInBytes), lastUpdated });
      } catch (error) {
        if (error instanceof Response && error.status === 404) {
          setStorageCost({ isSuccess: false, estimate: 'Not available' });
          setBucketSize({ isSuccess: false, usage: 'Not available' });
        } else {
          throw error;
        }
      }
    });

    if (workspace.workspaceInitialized) {
      if (canRead(accessLevel)) {
        loadStorageCost();
      }
    }
  }, [workspace, accessLevel, signal]);

  return h(Fragment, [
    dl([
      h(InfoRow, { title: 'Cloud Name' }, [
        h(GcpLogo, { title: 'Google Cloud Platform', role: 'img', style: { height: 16 } }),
      ]),
      h(InfoRow, { title: 'Location' }, [h(BucketLocation, { workspace, storageDetails })]),
      h(InfoRow, { title: 'Google Project ID' }, [
        h(TooltipCell, [googleProject]),
        h(ClipboardButton, {
          'aria-label': 'Copy google project ID to clipboard',
          text: googleProject,
          style: { marginLeft: '0.25rem' },
          onClick: (_) => {
            void Metrics().captureEvent(Events.workspaceDashboardCopyGoogleProjectId, {
              ...extractWorkspaceDetails(workspace),
            });
          },
        }),
      ]),
      h(InfoRow, { title: 'Bucket Name' }, [
        h(TooltipCell, [bucketName]),
        h(ClipboardButton, {
          'aria-label': 'Copy bucket name to clipboard',
          text: bucketName,
          style: { marginLeft: '0.25rem' },
          onClick: (_) => {
            void Metrics().captureEvent(Events.workspaceDashboardCopyBucketName, {
              ...extractWorkspaceDetails(workspace),
            });
          },
        }),
      ]),
      canWrite(accessLevel) &&
        h(
          InfoRow,
          {
            title: 'Estimated Storage Cost',
            subtitle: cond(
              [!storageCost, () => 'Loading last updated...'],
              [
                !!storageCost?.isSuccess,
                () => {
                  if (storageCost?.lastUpdated) {
                    return `Updated on ${new Date(storageCost?.lastUpdated).toLocaleDateString()}`;
                  }
                  return 'Unable to determine last date updated';
                },
              ]
            ),
          },
          [
            storageCost?.estimate || '$ ...',
            h(InfoBox, { style: { marginLeft: '1ch' }, side: 'top' }, [
              'Based on list price. Does not include discounts.',
            ]),
          ]
        ),
      canRead(accessLevel) &&
        h(
          InfoRow,
          {
            title: 'Bucket Size',
            subtitle: cond(
              [!bucketSize, () => 'Loading last updated...'],
              [
                !!bucketSize?.isSuccess,
                () => {
                  if (bucketSize?.lastUpdated) {
                    return `Updated on ${new Date(bucketSize?.lastUpdated).toLocaleDateString()}`;
                  }
                  return 'Unable to determine last date updated';
                },
              ]
            ),
          },
          [bucketSize?.usage]
        ),
    ]),
    div({ style: { paddingBottom: '0.5rem' } }, [
      h(
        Link,
        {
          style: { margin: '1rem 0.5rem' },
          ...newTabLinkProps,
          onClick: () => {
            void Metrics().captureEvent(Events.workspaceOpenedBucketInBrowser, {
              ...extractWorkspaceDetails(workspace),
            });
          },
          href: bucketBrowserUrl(bucketName),
        },
        ['Open bucket in browser', icon('pop-out', { size: 12, style: { marginLeft: '0.25rem' } })]
      ),
    ]),
    div({ style: { paddingBottom: '0.5rem' } }, [
      h(
        Link,
        {
          style: { margin: '1rem 0.5rem' },
          ...newTabLinkProps,
          onClick: () => {
            void Metrics().captureEvent(Events.workspaceOpenedProjectInConsole, {
              ...extractWorkspaceDetails(workspace),
            });
          },
          href: `https://console.cloud.google.com/welcome?project=${googleProject}`,
        },
        ['Open project in Google Cloud Console', icon('pop-out', { size: 12, style: { marginLeft: '0.25rem' } })]
      ),
    ]),
  ]);
};

export const CloudInformation = (props: CloudInformationProps): ReactNode => {
  const { workspace, ...rest } = props;
  if (isAzureWorkspace(workspace)) {
    return h(AzureCloudInformation, { workspace, ...rest });
  }
  if (isGoogleWorkspace(workspace)) {
    return h(GoogleCloudInformation, { workspace, ...rest });
  }
  return null;
};
