import { asMockedFn, partial } from '@terra-ui-packages/test-utils';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import _ from 'lodash/fp';
import { h } from 'react-hyperscript-helpers';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { WorkspaceContract, Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import {
  defaultAzureStorageOptions,
  defaultGoogleBucketOptions,
  defaultGoogleWorkspace,
  mockBucketRequesterPaysError,
} from 'src/testing/workspace-fixtures';
import { BucketLocation } from 'src/workspaces/dashboard/BucketLocation';
import { GoogleWorkspace } from 'src/workspaces/utils';

jest.mock('src/libs/ajax/Metrics');
jest.mock('src/libs/ajax/workspaces/Workspaces');

jest.mock('src/libs/notifications');

// Needed for bringing up the RequestPays modal
type WorkspaceProviderExports = typeof import('src/libs/ajax/workspaces/providers/WorkspaceProvider');
jest.mock(
  'src/libs/ajax/workspaces/providers/WorkspaceProvider',
  (): WorkspaceProviderExports => ({
    workspaceProvider: {
      list: jest.fn(),
    },
  })
);

describe('BucketLocation', () => {
  const workspace: GoogleWorkspace & { workspaceInitialized: boolean } = {
    ...defaultGoogleWorkspace,
    workspace: {
      ...defaultGoogleWorkspace.workspace,
      namespace: 'test',
      name: 'test',
      cloudPlatform: 'Gcp',
    },
    workspaceInitialized: true,
  };

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('shows Loading initially when uninitialized and should not fail any accessibility tests', async () => {
    // Arrange
    const props = {
      workspace: _.merge(workspace, { workspaceInitialized: false }),
      storageDetails: _.merge(defaultGoogleBucketOptions, defaultAzureStorageOptions),
    };

    // Act
    const { container } = render(h(BucketLocation, props));

    // Assert
    expect(screen.queryByText('Loading')).not.toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('fetches bucket location when workspace is initialized', async () => {
    // Arrange
    const props = {
      workspace: { ...workspace, workspaceInitialized: true },
      storageDetails: {
        ...defaultGoogleBucketOptions,
        fetchedGoogleBucketLocation: 'SUCCESS',
        googleBucketLocation: 'us-central1',
        googleBucketType: 'region',
      },
    };

    // Act
    await act(async () => {
      render(h(BucketLocation, props));
    });

    // Assert
    expect(screen.queryByText('Loading')).toBeNull();
    expect(screen.findByText(/us-central1/)).toBeTruthy();
  });

  it('renders the bucket location if available, and has no accessibility errors', async () => {
    // Arrange
    const props = {
      workspace,
      storageDetails: _.mergeAll([
        defaultGoogleBucketOptions,
        { fetchedGoogleBucketLocation: 'SUCCESS' },
        defaultAzureStorageOptions,
      ]),
    };

    // Act
    const { container } = render(h(BucketLocation, props));

    // Assert
    expect(screen.queryByText('Loading')).toBeNull();
    expect(screen.getAllByText(/Iowa/)).not.toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('fetches the bucket location if workspaceContainer attempt encountered an error', async () => {
    // Arrange
    const props = {
      workspace,
      storageDetails: _.mergeAll([
        defaultGoogleBucketOptions,
        { fetchedGoogleBucketLocation: 'ERROR' },
        defaultAzureStorageOptions,
      ]),
    };
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            checkBucketLocation: jest.fn().mockResolvedValue({
              location: 'bermuda',
              locationType: 'triangle',
            }),
          }),
      })
    );

    // Act
    await act(async () => { render(h(BucketLocation, props)) }) //eslint-disable-line

    // Assert
    expect(screen.queryByText('Loading')).toBeNull();
    expect(screen.getAllByText(/bermuda/)).not.toBeNull();
  });

  it('handles requester pays error', async () => {
    // Arrange
    const user = userEvent.setup();
    const props = {
      workspace,
      storageDetails: _.mergeAll([
        defaultGoogleBucketOptions,
        { fetchedGoogleBucketLocation: 'RPERROR' },
        defaultAzureStorageOptions,
      ]),
    };
    const captureEvent = jest.fn();
    asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent }));
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            checkBucketLocation: () => Promise.reject(mockBucketRequesterPaysError),
          }),
      })
    );

    // Act
    await act(async () => { render(h(BucketLocation, props)) }) //eslint-disable-line

    // Assert
    expect(screen.queryByText('Loading')).toBeNull();
    expect(screen.getAllByText(/bucket is requester pays/)).not.toBeNull();

    // Act
    const loadBucketLocation = screen.getByLabelText('Load bucket location');
    await user.click(loadBucketLocation);

    // Assert
    expect(captureEvent).toHaveBeenCalledWith(
      Events.workspaceDashboardBucketRequesterPays,
      extractWorkspaceDetails(workspace)
    );
    // In the RequesterPays modal (because the list method returns no workspaces).
    expect(screen.getAllByText('Go to Workspaces')).not.toBeNull();
  });
});
