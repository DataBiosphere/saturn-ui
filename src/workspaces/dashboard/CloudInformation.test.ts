import { asMockedFn, partial } from '@terra-ui-packages/test-utils';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as clipboard from 'clipboard-polyfill/text';
import { h } from 'react-hyperscript-helpers';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { WorkspaceContract, Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import {
  defaultAzureStorageOptions,
  defaultAzureWorkspace,
  defaultGoogleBucketOptions,
  defaultGoogleWorkspace,
} from 'src/testing/workspace-fixtures';
import { StorageDetails } from 'src/workspaces/common/state/useWorkspace';
import { CloudInformation } from 'src/workspaces/dashboard/CloudInformation';

jest.mock('src/libs/ajax/Metrics');
jest.mock('src/libs/ajax/workspaces/Workspaces');

type ClipboardPolyfillExports = typeof import('clipboard-polyfill/text');
jest.mock('clipboard-polyfill/text', (): ClipboardPolyfillExports => {
  const actual = jest.requireActual<ClipboardPolyfillExports>('clipboard-polyfill/text');
  return {
    ...actual,
    writeText: jest.fn().mockResolvedValue(undefined),
  };
});

describe('CloudInformation', () => {
  const storageDetails: StorageDetails = {
    googleBucketLocation: defaultGoogleBucketOptions.googleBucketLocation,
    googleBucketType: defaultGoogleBucketOptions.googleBucketType,
    fetchedGoogleBucketLocation: defaultGoogleBucketOptions.fetchedGoogleBucketLocation,
  };

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('displays links for an azure workspace', async () => {
    // Arrange
    const storageDetails: StorageDetails = {
      googleBucketLocation: '',
      googleBucketType: '',
      fetchedGoogleBucketLocation: undefined,
      azureContainerRegion: defaultAzureStorageOptions.azureContainerRegion,
      azureContainerUrl: defaultAzureStorageOptions.azureContainerUrl,
      azureContainerSasUrl: defaultAzureStorageOptions.azureContainerSasUrl,
    };
    // Act
    render(
      h(CloudInformation, { workspace: { ...defaultAzureWorkspace, workspaceInitialized: true }, storageDetails })
    );

    // Assert
    expect(screen.getByText('AzCopy')).not.toBeNull();
    expect(screen.getByText('Azure Storage Explorer')).not.toBeNull();
  });

  it('does not retrieve bucket and storage estimate when the workspace is not initialized', async () => {
    // Arrange
    const mockStorageCostEstimateV2 = jest.fn();
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            storageCostEstimateV2: mockStorageCostEstimateV2,
          }),
      })
    );

    // Act
    render(
      h(CloudInformation, { workspace: { ...defaultGoogleWorkspace, workspaceInitialized: false }, storageDetails })
    );

    // Assert
    expect(screen.getByTitle('Google Cloud Platform')).not.toBeNull;

    expect(mockStorageCostEstimateV2).not.toHaveBeenCalled();
  });

  it('retrieves bucket and storage estimate when the workspace is initialized', async () => {
    // Arrange
    const mockStorageCostEstimateV2 = jest.fn().mockResolvedValue({
      estimate: 1000000,
      usageInBytes: 100,
      lastUpdated: '2023-12-01',
    });
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            storageCostEstimateV2: mockStorageCostEstimateV2,
          }),
      })
    );

    // Act
    await act(() =>
      render(
        h(CloudInformation, { workspace: { ...defaultGoogleWorkspace, workspaceInitialized: true }, storageDetails })
      )
    );

    // Assert
    expect(screen.getByTitle('Google Cloud Platform')).not.toBeNull;
    // Cost estimate
    expect(screen.getAllByText('Updated on 12/1/2023')).not.toBeNull();
    expect(screen.getByText('$1,000,000.00')).not.toBeNull();
    // Bucket usage
    expect(screen.getByText('100 B')).not.toBeNull();

    expect(mockStorageCostEstimateV2).toHaveBeenCalled();
  });

  const copyButtonTestSetup = async () => {
    const captureEvent = jest.fn();
    const mockStorageCostEstimateV2 = jest.fn();
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            storageCostEstimateV2: mockStorageCostEstimateV2,
          }),
      })
    );
    asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent }));

    await act(() =>
      render(
        h(CloudInformation, { workspace: { ...defaultGoogleWorkspace, workspaceInitialized: false }, storageDetails })
      )
    );
    return captureEvent;
  };

  it('emits an event when the copy google project ID button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const captureEvent = await copyButtonTestSetup();

    // Act
    const copyButton = screen.getByLabelText('Copy google project ID to clipboard');
    await user.click(copyButton);

    // Assert
    expect(captureEvent).toHaveBeenCalledWith(
      Events.workspaceDashboardCopyGoogleProjectId,
      extractWorkspaceDetails(defaultGoogleWorkspace)
    );
    expect(clipboard.writeText).toHaveBeenCalledWith(defaultGoogleWorkspace.workspace.googleProject);
  });

  it('emits an event when the copy bucket name button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const captureEvent = await copyButtonTestSetup();

    // Act
    const copyButton = screen.getByLabelText('Copy bucket name to clipboard');
    await user.click(copyButton);

    // Assert
    expect(captureEvent).toHaveBeenCalledWith(
      Events.workspaceDashboardCopyBucketName,
      extractWorkspaceDetails(defaultGoogleWorkspace)
    );
    expect(clipboard.writeText).toHaveBeenCalledWith(defaultGoogleWorkspace.workspace.bucketName);
  });

  it('can use the info button to display additional information about cost', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockStorageCostEstimateV2 = jest.fn().mockResolvedValue({
      estimate: 2.0,
      usageInBytes: 15,
      lastUpdated: '2024-07-15',
    });
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            storageCostEstimateV2: mockStorageCostEstimateV2,
          }),
      })
    );

    // Act
    render(
      h(CloudInformation, { workspace: { ...defaultGoogleWorkspace, workspaceInitialized: true }, storageDetails })
    );
    await user.click(screen.getByLabelText('More info'));

    // Assert
    expect(screen.getAllByText('Based on list price. Does not include discounts.')).not.toBeNull();
  });

  it('displays bucket size for users with reader access', async () => {
    // Arrange
    const mockStorageCostEstimateV2 = jest
      .fn()
      .mockResolvedValue({ estimate: 1.23, usageInBytes: 50, lastUpdated: '2024-07-26' });
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () => partial<WorkspaceContract>({ storageCostEstimateV2: mockStorageCostEstimateV2 }),
      })
    );

    // Act
    await act(() =>
      render(
        h(CloudInformation, {
          workspace: { ...defaultGoogleWorkspace, workspaceInitialized: true, accessLevel: 'READER' },
          storageDetails,
        })
      )
    );

    // Assert
    expect(screen.getByText('Updated on 7/26/2024')).not.toBeNull();
    expect(screen.getByText('50 B')).not.toBeNull();
    expect(mockStorageCostEstimateV2).toHaveBeenCalled();
  });
});
