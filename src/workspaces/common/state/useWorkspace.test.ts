import { asMockedFn, partial } from '@terra-ui-packages/test-utils';
import { act } from '@testing-library/react';
import _ from 'lodash/fp';
import { AzureStorage, AzureStorageContract } from 'src/libs/ajax/AzureStorage';
import * as GoogleStorage from 'src/libs/ajax/GoogleStorage';
import { WorkspaceContract, Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import * as Notifications from 'src/libs/notifications';
import { InitializedWorkspaceWrapper, workspaceStore } from 'src/libs/state';
import { renderHookInAct } from 'src/testing/test-utils';
import { defaultAzureStorageOptions, defaultGoogleBucketOptions } from 'src/testing/workspace-fixtures';
import * as recentlyViewedWorkspaces from 'src/workspaces/common/state/recentlyViewedWorkspaces';
import {
  azureBucketRecheckRate,
  googlePermissionsRecheckRate,
  useWorkspace,
} from 'src/workspaces/common/state/useWorkspace';

jest.mock('src/libs/ajax/AzureStorage');
jest.mock('src/libs/ajax/Metrics');
jest.mock('src/libs/ajax/workspaces/Workspaces');

jest.mock('src/libs/notifications');

type StateExports = typeof import('src/libs/state');
jest.mock('src/libs/state', (): StateExports => {
  return {
    ...jest.requireActual('src/libs/state'),
    getTerraUser: jest.fn(() => ({ email: 'christina@foo.com' })),
  };
});

type AuthExports = typeof import('src/auth/auth');
jest.mock('src/auth/auth', (): AuthExports => {
  return {
    ...jest.requireActual('src/auth/auth'),
    getAuthToken: jest.fn(() => 'testToken'),
    getAuthTokenFromLocalStorage: jest.fn(() => Promise.resolve('localToken')),
  };
});

jest.mock('src/libs/config', () => ({
  ...jest.requireActual('src/libs/config'),
  getConfig: jest.fn().mockReturnValue({}),
}));

describe('useWorkspace', () => {
  const initializedGoogleWorkspace: InitializedWorkspaceWrapper = {
    accessLevel: 'PROJECT_OWNER',
    owners: ['christina@foo.com'],
    workspace: {
      attributes: {
        description: '',
      },
      authorizationDomain: [],
      billingAccount: 'billingAccounts/google-billing-account',
      bucketName: 'bucket-name',
      cloudPlatform: 'Gcp',
      completedCloneWorkspaceFileTransfer: '2023-02-03T22:29:04.319Z',
      createdBy: 'christina@foo.com',
      createdDate: '2023-02-03T22:26:06.124Z',
      googleProject: 'google-project-id',
      isLocked: false,
      lastModified: '2023-02-03T22:26:06.202Z',
      name: 'testName',
      namespace: 'testNamespace',
      workspaceId: 'google-workspace-id',
      workspaceType: 'rawls',
      workspaceVersion: 'v2',
    },
    canShare: true,
    canCompute: true,
    policies: [],
    workspaceInitialized: true,
  };

  const initializedAzureWorkspace: InitializedWorkspaceWrapper = {
    accessLevel: 'PROJECT_OWNER',
    owners: ['christina@foo.com'],
    azureContext: {
      managedResourceGroupId: 'test-mrg',
      subscriptionId: 'test-sub-id',
      tenantId: 'test-tenant-id',
    },
    workspace: {
      attributes: {
        description: '',
      },
      authorizationDomain: [],
      bucketName: '',
      cloudPlatform: 'Azure',
      completedCloneWorkspaceFileTransfer: '2023-02-03T22:29:04.319Z',
      createdBy: 'christina@foo.com',
      createdDate: '2023-02-03T22:26:06.124Z',
      googleProject: '',
      isLocked: false,
      lastModified: '2023-02-03T22:26:06.202Z',
      name: 'testName',
      namespace: 'testNamespace',
      workspaceId: 'azure-workspace-id',
      workspaceType: 'rawls',
      workspaceVersion: 'v2',
    },
    canShare: true,
    canCompute: true,
    policies: [],
    workspaceInitialized: true,
  };

  const bucketLocationResponse = {
    location: 'bucket-location',
    locationType: 'location-type',
  };

  const azureStorageDetails = {
    location: 'container-location',
    sas: { url: 'container-url?sas-token' },
  };

  beforeEach(() => {
    workspaceStore.reset();
    jest.useFakeTimers();

    jest.spyOn(workspaceStore, 'set');
    jest.spyOn(recentlyViewedWorkspaces, 'updateRecentlyViewedWorkspaces');
    jest.spyOn(GoogleStorage, 'saToken');
    jest.spyOn(Notifications, 'notify');

    // Don't show expected error responses in logs
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const assertResult = (result, expectedWorkspace, expectedStorageDetails, expectedAccessError) => {
    expect(result.workspace).toEqual(expectedWorkspace);
    expect(result.storageDetails).toEqual(expectedStorageDetails);
    expect(result.accessError).toBe(expectedAccessError);
    expect(result.refreshWorkspace).toBeTruthy();
    expect(result.loadingWorkspace).toBe(false);
  };

  it('can initialize from a Google workspace in workspaceStore', async () => {
    // Arrange
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            checkBucketLocation: jest.fn().mockResolvedValue(bucketLocationResponse),
          }),
      })
    );

    workspaceStore.set(initializedGoogleWorkspace);
    const expectedStorageDetails = _.merge(
      {
        googleBucketLocation: bucketLocationResponse.location,
        googleBucketType: bucketLocationResponse.locationType,
        fetchedGoogleBucketLocation: 'SUCCESS',
      },
      defaultAzureStorageOptions
    );

    // Act
    // Wait for the bucket location call.
    const { result } = await renderHookInAct(() => useWorkspace('testNamespace', 'testName'));

    // Assert
    assertResult(result.current, initializedGoogleWorkspace, expectedStorageDetails, false);
    expect(workspaceStore.set).toHaveBeenCalledWith(initializedGoogleWorkspace);
    expect(recentlyViewedWorkspaces.updateRecentlyViewedWorkspaces).not.toHaveBeenCalled();
    expect(GoogleStorage.saToken).not.toHaveBeenCalled();
  });

  it('can initialize from a requester pays Google workspace in workspaceStore', async () => {
    // Arrange
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            checkBucketLocation: () => Promise.reject(new Response('Mock requester pays error', { status: 400 })),
          }),
      })
    );

    workspaceStore.set(initializedGoogleWorkspace);
    // Calling to get the bucket location fails, default options remain except for indication of error state.
    const expectedStorageDetails = _.mergeAll([
      defaultGoogleBucketOptions,
      { fetchedGoogleBucketLocation: 'ERROR' },
      defaultAzureStorageOptions,
    ]);

    // Act
    // Wait for the bucket location call.
    const { result } = await renderHookInAct(() => useWorkspace('testNamespace', 'testName'));

    // Assert
    assertResult(result.current, initializedGoogleWorkspace, expectedStorageDetails, false);
  });

  it('can initialize from an Azure workspace in workspaceStore', async () => {
    // Arrange
    const azureStorageMock: Partial<AzureStorageContract> = {
      details: jest.fn().mockResolvedValue(azureStorageDetails),
    };
    asMockedFn(AzureStorage).mockImplementation(() => azureStorageMock as AzureStorageContract);

    workspaceStore.set(initializedAzureWorkspace);
    const expectedStorageDetails = _.merge(
      {
        azureContainerRegion: azureStorageDetails.location,
        azureContainerUrl: 'container-url',
        azureContainerSasUrl: azureStorageDetails.sas.url,
      },
      defaultGoogleBucketOptions
    );

    // Act
    // Wait for the Azure storage call.
    const { result } = await renderHookInAct(() => useWorkspace('testNamespace', 'testName'));

    // Assert
    assertResult(result.current, initializedAzureWorkspace, expectedStorageDetails, false);
    expect(workspaceStore.set).toHaveBeenCalledWith(initializedAzureWorkspace);
    expect(recentlyViewedWorkspaces.updateRecentlyViewedWorkspaces).not.toHaveBeenCalled();
    expect(GoogleStorage.saToken).not.toHaveBeenCalled();
  });

  const verifyGooglePermissionsFailure = async (fetchedGoogleBucketLocation: string | undefined = undefined) => {
    // Arrange
    // Expected response from useWorkspace should be false to reflect that permissions are not fully synced.
    const uninitializedGoogleWorkspace = _.clone(initializedGoogleWorkspace);
    uninitializedGoogleWorkspace.workspaceInitialized = false;

    const expectedStillSyncingDetails = _.mergeAll([
      defaultGoogleBucketOptions,
      { fetchedGoogleBucketLocation },
      defaultAzureStorageOptions,
    ]);

    // Act
    const renderHookResult = await renderHookInAct(() => useWorkspace('testNamespace', 'testName'));
    const { result } = renderHookResult;

    // Assert
    assertResult(result.current, uninitializedGoogleWorkspace, expectedStillSyncingDetails, false);
    expect(workspaceStore.set).toHaveBeenCalledWith(uninitializedGoogleWorkspace);
    expect(recentlyViewedWorkspaces.updateRecentlyViewedWorkspaces).toHaveBeenCalledWith(
      uninitializedGoogleWorkspace.workspace.workspaceId
    );
    expect(GoogleStorage.saToken).toHaveBeenCalled();

    return renderHookResult;
  };

  const verifyGooglePermissionsSuccess = async (result) => {
    // Arrange
    const expectedAllSyncedDetails = _.merge(
      {
        googleBucketLocation: bucketLocationResponse.location,
        googleBucketType: bucketLocationResponse.locationType,
        fetchedGoogleBucketLocation: 'SUCCESS',
      },
      defaultAzureStorageOptions
    );

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            checkBucketLocation: jest.fn().mockResolvedValue(bucketLocationResponse),
            storageCostEstimate: jest.fn(),
            bucketUsage: jest.fn(),
          }),
      })
    );

    // Act
    await act(async () => {
      jest.advanceTimersByTime(googlePermissionsRecheckRate);
    });

    // Assert
    assertResult(result.current, initializedGoogleWorkspace, expectedAllSyncedDetails, false);
    expect(workspaceStore.set).toHaveBeenCalledWith(initializedGoogleWorkspace);
  };

  it('can read workspace details from server, and poll until permissions synced (handling storageCostEstimate failure)', async () => {
    // Arrange
    // remove workspaceInitialized because the server response does not include this information
    const { workspaceInitialized, ...serverWorkspaceResponse } = initializedGoogleWorkspace;

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            details: jest.fn().mockResolvedValue(serverWorkspaceResponse),
            checkBucketLocation: jest.fn().mockResolvedValue(bucketLocationResponse),
            storageCostEstimate: () =>
              Promise.reject(new Response('Mock storage cost estimate error', { status: 500 })),
            bucketUsage: jest.fn(),
          }),
      })
    );

    // Verify initial failure based on error mock.
    const { result } = await verifyGooglePermissionsFailure();

    // Finally, change mock to pass all checks verify success.
    await verifyGooglePermissionsSuccess(result);
  });

  it('can read workspace details from server, and poll until permissions synced (handling bucketUsage failure)', async () => {
    // Arrange
    // remove workspaceInitialized because the server response does not include this information
    const { workspaceInitialized, ...serverWorkspaceResponse } = initializedGoogleWorkspace;

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            details: jest.fn().mockResolvedValue(serverWorkspaceResponse),
            checkBucketLocation: jest.fn().mockResolvedValue(bucketLocationResponse),
            storageCostEstimate: jest.fn(),
            bucketUsage: () => Promise.reject(new Response('Mock bucket usage error', { status: 500 })),
          }),
      })
    );

    // Verify initial failure based on error mock.
    const { result } = await verifyGooglePermissionsFailure();

    // Finally, change mock to pass all checks verify success.
    await verifyGooglePermissionsSuccess(result);
  });

  it('can read workspace details from server, and poll until permissions synced (handling checkBucketLocation failure)', async () => {
    // Arrange
    // remove workspaceInitialized because the server response does not include this information
    const { workspaceInitialized, ...serverWorkspaceResponse } = initializedGoogleWorkspace;

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            details: jest.fn().mockResolvedValue(serverWorkspaceResponse),
            checkBucketLocation: () => Promise.reject(new Response('Mock check bucket location', { status: 500 })),
            storageCostEstimate: jest.fn(),
            bucketUsage: jest.fn(),
          }),
      })
    );

    // Verify initial failure based on error mock.
    const { result } = await verifyGooglePermissionsFailure('ERROR');

    // Finally, change mock to pass all checks verify success.
    await verifyGooglePermissionsSuccess(result);
  });

  it('can read workspace details from server for read-only workspace, and poll Google until permissions are synced', async () => {
    // Arrange
    const readOnlyWorkspace = _.clone(initializedGoogleWorkspace);
    readOnlyWorkspace.accessLevel = 'READER';
    // remove workspaceInitialized because the server response does not include this information
    const { workspaceInitialized, ...serverWorkspaceResponse } = readOnlyWorkspace;

    // checkBucketAccess and checkBucketLocation succeed, but calls that should only be executed if
    // user has writer permission throw errors (to verify that they aren't called).
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            details: jest.fn().mockResolvedValue(serverWorkspaceResponse),
            checkBucketLocation: jest.fn().mockResolvedValue(bucketLocationResponse),
            storageCostEstimate: () => Promise.reject(new Response('Should not call', { status: 500 })),
            bucketUsage: () => Promise.reject(new Response('Should not call', { status: 500 })),
          }),
      })
    );

    const expectedAllSyncedDetails = _.merge(
      {
        googleBucketLocation: bucketLocationResponse.location,
        googleBucketType: bucketLocationResponse.locationType,
        fetchedGoogleBucketLocation: 'SUCCESS',
      },
      defaultAzureStorageOptions
    );

    // Act
    // Wait for the call to checkBucketLocation to execute
    const { result } = await renderHookInAct(() => useWorkspace('testNamespace', 'testName'));

    // Assert
    assertResult(result.current, readOnlyWorkspace, expectedAllSyncedDetails, false);
    expect(workspaceStore.set).toHaveBeenCalledWith(readOnlyWorkspace);
  });

  it('treats requesterPays errors as Google workspace being initialized', async () => {
    // Arrange
    // remove workspaceInitialized because the server response does not include this information
    const { workspaceInitialized, ...serverWorkspaceResponse } = initializedGoogleWorkspace;

    // Throw error from checkBucketLocation
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            details: jest.fn().mockResolvedValue(serverWorkspaceResponse),
            storageCostEstimate: jest.fn(),
            bucketUsage: jest.fn(),
            checkBucketLocation: () =>
              Promise.reject(new Response('User must have access to user project', { status: 400 })),
          }),
      })
    );

    // Will not attempt to retrieve storage details due to requester pays
    const expectedStorageDetails = _.merge(
      {
        googleBucketLocation: defaultGoogleBucketOptions.googleBucketLocation,
        googleBucketType: defaultGoogleBucketOptions.googleBucketType,
        fetchedGoogleBucketLocation: 'RPERROR',
      },
      defaultAzureStorageOptions
    );

    // Act
    // Wait for the call to checkBucketLocation to execute
    const { result } = await renderHookInAct(() => useWorkspace('testNamespace', 'testName'));

    // Assert
    assertResult(result.current, initializedGoogleWorkspace, expectedStorageDetails, false);
    expect(workspaceStore.set).toHaveBeenCalledWith(initializedGoogleWorkspace);
    expect(recentlyViewedWorkspaces.updateRecentlyViewedWorkspaces).toHaveBeenCalledWith(
      initializedGoogleWorkspace.workspace.workspaceId
    );
  });

  it('can read workspace details from server, and poll WSM until the container exists', async () => {
    // Arrange
    // remove workspaceInitialized because the server response does not include this information
    const { workspaceInitialized, ...serverWorkspaceResponse } = initializedAzureWorkspace;

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            details: jest.fn().mockResolvedValue(serverWorkspaceResponse),
          }),
      })
    );

    const errorAzureStorageMock: Partial<AzureStorageContract> = {
      details: () => Promise.reject(new Response('Mock container error', { status: 500 })),
    };
    asMockedFn(AzureStorage).mockImplementation(() => errorAzureStorageMock as AzureStorageContract);

    // Expected response from first call.
    const uninitializedAzureWorkspace = _.clone(initializedAzureWorkspace);
    uninitializedAzureWorkspace.workspaceInitialized = false;

    const expectedFirstStorageDetails = _.merge(defaultGoogleBucketOptions, defaultAzureStorageOptions);
    const expectedSecondStorageDetails = _.merge(
      {
        azureContainerRegion: azureStorageDetails.location,
        azureContainerUrl: 'container-url',
        azureContainerSasUrl: azureStorageDetails.sas.url,
      },
      defaultGoogleBucketOptions
    );

    // Act
    // Wait for the call to AzureStorage.details to execute.
    const { result } = await renderHookInAct(() => useWorkspace('testNamespace', 'testName'));

    // Assert
    assertResult(result.current, uninitializedAzureWorkspace, expectedFirstStorageDetails, false);
    expect(workspaceStore.set).toHaveBeenCalledWith(uninitializedAzureWorkspace);
    expect(recentlyViewedWorkspaces.updateRecentlyViewedWorkspaces).toHaveBeenCalledWith(
      uninitializedAzureWorkspace.workspace.workspaceId
    );
    expect(GoogleStorage.saToken).not.toHaveBeenCalled();

    // Arrange
    // Now return success for the next call to AzureStorage.details
    const successAzureStorageMock: Partial<AzureStorageContract> = {
      details: jest.fn().mockResolvedValue(azureStorageDetails),
    };
    asMockedFn(AzureStorage).mockImplementation(() => successAzureStorageMock as AzureStorageContract);

    // Act
    // next call to AzureStorage.details is on a timer
    await act(async () => {
      jest.advanceTimersByTime(azureBucketRecheckRate);
    });

    // Assert
    assertResult(result.current, initializedAzureWorkspace, expectedSecondStorageDetails, false);
    // First value set will have initialized as undefined.
    expect(workspaceStore.set).toHaveBeenNthCalledWith(1, serverWorkspaceResponse);
    expect(workspaceStore.set).toHaveBeenNthCalledWith(2, uninitializedAzureWorkspace);
    expect(workspaceStore.set).toHaveBeenNthCalledWith(3, initializedAzureWorkspace);
  });

  it('can handle changing namespace and name, including Azure storage detail transient errors', async () => {
    // Arrange
    const uninitializedAzureWorkspace = _.cloneDeep(initializedAzureWorkspace);
    uninitializedAzureWorkspace.workspaceInitialized = false;
    uninitializedAzureWorkspace.workspace.namespace = 'uninitializedNamespace';
    uninitializedAzureWorkspace.workspace.name = 'uninitializedName';

    // remove workspaceInitialized because the server response does not include this information
    const { workspaceInitialized, ...serverWorkspaceResponse } = uninitializedAzureWorkspace;

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            details: jest.fn().mockResolvedValue(serverWorkspaceResponse),
          }),
      })
    );

    // Because we are mocking the "clone" workflow for an Azure workspace, we expect the first
    // call for Azure storage details after changing namespace/name to fail.
    const errorAzureStorageMock: Partial<AzureStorageContract> = {
      details: () => Promise.reject(new Response('Mock container error', { status: 500 })),
    };
    asMockedFn(AzureStorage).mockImplementation(() => errorAzureStorageMock as AzureStorageContract);

    // Expected response from first call.
    const expectedFirstStorageDetails = _.merge(defaultGoogleBucketOptions, defaultAzureStorageOptions);
    // Second response will actually contain all the storage details.
    const expectedSecondStorageDetails = _.merge(
      {
        azureContainerRegion: azureStorageDetails.location,
        azureContainerUrl: 'container-url',
        azureContainerSasUrl: azureStorageDetails.sas.url,
      },
      defaultGoogleBucketOptions
    );

    // Set the stored workspace to the initialized Azure workspace (simulates the source workspace during a clone).
    workspaceStore.set(initializedAzureWorkspace);

    // Act
    // Since the namespace/name do not match the stored workspace, new details will be fetched.
    // The first call to get Azure storage details will fail.
    const { result } = await renderHookInAct(() =>
      useWorkspace(uninitializedAzureWorkspace.workspace.namespace, uninitializedAzureWorkspace.workspace.name)
    );

    // Assert
    assertResult(result.current, uninitializedAzureWorkspace, expectedFirstStorageDetails, false);
    expect(recentlyViewedWorkspaces.updateRecentlyViewedWorkspaces).toHaveBeenCalledWith(
      uninitializedAzureWorkspace.workspace.workspaceId
    );

    // Arrange
    // Now return success for the next call to AzureStorage.details
    const successAzureStorageMock: Partial<AzureStorageContract> = {
      details: jest.fn().mockResolvedValue(azureStorageDetails),
    };
    asMockedFn(AzureStorage).mockImplementation(() => successAzureStorageMock as AzureStorageContract);

    const nowInitializedAzureWorkspace = _.cloneDeep(uninitializedAzureWorkspace);
    nowInitializedAzureWorkspace.workspaceInitialized = true;

    // Act
    // next call to AzureStorage.details is on a timer
    await act(async () => {
      jest.advanceTimersByTime(azureBucketRecheckRate);
    });

    // Assert
    assertResult(result.current, nowInitializedAzureWorkspace, expectedSecondStorageDetails, false);

    // The set call in the test to simulate source workspace
    expect(workspaceStore.set).toHaveBeenNthCalledWith(1, initializedAzureWorkspace);
    // Initial render with new namespace/name
    expect(workspaceStore.set).toHaveBeenNthCalledWith(2, uninitializedAzureWorkspace);
    // Workspace details fetched, but storage details errored.
    expect(workspaceStore.set).toHaveBeenNthCalledWith(3, uninitializedAzureWorkspace);
    // Storage details return properly.
    expect(workspaceStore.set).toHaveBeenNthCalledWith(4, nowInitializedAzureWorkspace);
  });

  it('returns an access error if workspace details throws a 404', async () => {
    // Arrange
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            details: () => Promise.reject(new Response('Mock access error', { status: 404 })),
          }),
      })
    );

    // Act
    const { result } = await renderHookInAct(() => useWorkspace('testNamespace', 'testName'));

    // Assert
    assertResult(result.current, undefined, _.merge(defaultGoogleBucketOptions, defaultAzureStorageOptions), true);
    expect(workspaceStore.set).not.toHaveBeenCalled();
    expect(recentlyViewedWorkspaces.updateRecentlyViewedWorkspaces).not.toHaveBeenCalled();
    expect(GoogleStorage.saToken).not.toHaveBeenCalled();
  });

  it('does not request SA token for Google workspace if not a writer', async () => {
    // Arrange
    // remove workspaceInitialized because the server response does not include this information
    const { workspaceInitialized, ...serverWorkspaceResponse } = initializedGoogleWorkspace;
    serverWorkspaceResponse.accessLevel = 'READER';

    const expectedWorkspaceResponse = _.merge(_.clone(serverWorkspaceResponse), { workspaceInitialized: true });

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            details: jest.fn().mockResolvedValue(serverWorkspaceResponse),
            checkBucketLocation: jest.fn().mockResolvedValue(bucketLocationResponse),
          }),
      })
    );

    const expectStorageDetails = _.merge(
      {
        googleBucketLocation: bucketLocationResponse.location,
        googleBucketType: bucketLocationResponse.locationType,
        fetchedGoogleBucketLocation: 'SUCCESS',
      },
      defaultAzureStorageOptions
    );

    // Act
    // Wait for the call to to execute
    const { result } = await renderHookInAct(() => useWorkspace('testNamespace', 'testName'));

    // Assert
    assertResult(result.current, expectedWorkspaceResponse, expectStorageDetails, false);
    expect(workspaceStore.set).toHaveBeenCalledWith(expectedWorkspaceResponse);
    expect(recentlyViewedWorkspaces.updateRecentlyViewedWorkspaces).toHaveBeenCalledWith(
      expectedWorkspaceResponse.workspace.workspaceId
    );
    expect(GoogleStorage.saToken).not.toHaveBeenCalled();
    expect(Notifications.notify).not.toHaveBeenCalled();
  });

  it('Shows a notification if workspace just created by user, but Rawls did not return that they are the owner', async () => {
    // Arrange
    // remove workspaceInitialized because the server response does not include this information
    const { workspaceInitialized, ...serverWorkspaceResponse } = initializedGoogleWorkspace;
    serverWorkspaceResponse.accessLevel = 'READER';

    const expectedWorkspaceResponse = _.merge(_.clone(serverWorkspaceResponse), { workspaceInitialized: true });

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            details: jest.fn().mockResolvedValue(serverWorkspaceResponse),
            checkBucketLocation: jest.fn().mockResolvedValue(bucketLocationResponse),
          }),
      })
    );

    const expectStorageDetails = _.merge(
      {
        googleBucketLocation: bucketLocationResponse.location,
        googleBucketType: bucketLocationResponse.locationType,
        fetchedGoogleBucketLocation: 'SUCCESS',
      },
      defaultAzureStorageOptions
    );

    // Created time is '2023-02-03T22:26:06.124Z',
    jest.setSystemTime(new Date(Date.UTC(2023, 1, 3, 22, 26, 12, 0)));

    // Act
    // Wait for the call to execute
    const { result } = await renderHookInAct(() => useWorkspace('testNamespace', 'testName'));

    // Assert
    assertResult(result.current, expectedWorkspaceResponse, expectStorageDetails, false);
    expect(workspaceStore.set).toHaveBeenCalledWith(expectedWorkspaceResponse);
    expect(recentlyViewedWorkspaces.updateRecentlyViewedWorkspaces).toHaveBeenCalledWith(
      expectedWorkspaceResponse.workspace.workspaceId
    );
    expect(GoogleStorage.saToken).not.toHaveBeenCalled();
    expect(Notifications.notify).toHaveBeenCalled();
  });
});
