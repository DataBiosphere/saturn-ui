import { act } from '@testing-library/react';
import { generateTestApp } from 'src/analysis/_testData/testData';
import { Apps, AppsAjaxContract } from 'src/libs/ajax/leonardo/Apps';
import { Runtimes, RuntimesAjaxContract } from 'src/libs/ajax/leonardo/Runtimes';
import { BucketUsageResponse, RawAccessEntry } from 'src/libs/ajax/workspaces/workspace-models';
import {
  WorkspaceContract,
  Workspaces,
  WorkspacesAjaxContract,
  WorkspaceV2Contract,
} from 'src/libs/ajax/workspaces/Workspaces';
import { reportError } from 'src/libs/error';
import { asMockedFn, partial, renderHookInAct } from 'src/testing/test-utils';
import { useDeleteWorkspaceState } from 'src/workspaces/DeleteWorkspaceModal/state/useDeleteWorkspaceState';
import { AzureWorkspaceInfo, BaseWorkspace, GoogleWorkspaceInfo } from 'src/workspaces/utils';

type AjaxExports = typeof import('src/libs/ajax');
jest.mock('src/libs/ajax', (): AjaxExports => {
  return {
    ...jest.requireActual('src/libs/ajax'),
    Ajax: jest.fn(),
  };
});
jest.mock('src/libs/ajax/leonardo/Apps');
jest.mock('src/libs/ajax/leonardo/Runtimes');
jest.mock('src/libs/ajax/workspaces/Workspaces');

type ErrorExports = typeof import('src/libs/error');
jest.mock(
  'src/libs/error',
  (): ErrorExports => ({
    ...jest.requireActual('src/libs/error'),
    reportError: jest.fn(),
  })
);

describe('useDeleteWorkspaceState', () => {
  const googleWorkspace = {
    accessLevel: 'WRITER',
    canShare: true,
    canCompute: true,
    workspace: {
      name: 'example',
      namespace: 'example',
      cloudPlatform: 'Gcp',
      workspaceId: 'googleWorkspaceId',
    } as GoogleWorkspaceInfo,
  } as BaseWorkspace;
  const azureWorkspace = {
    accessLevel: 'WRITER',
    canShare: true,
    canCompute: true,
    workspace: {
      name: 'example',
      namespace: 'example',
      cloudPlatform: 'Azure',
      workspaceId: 'azureWorkspaceId',
    } as AzureWorkspaceInfo,
  } as BaseWorkspace;
  const mockOnDismiss = jest.fn(() => {});
  const mockOnSuccess = jest.fn(() => {});

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  it('can initialize state for a google workspace with running apps', async () => {
    // Arrange
    const listWithoutProject: AppsAjaxContract['listWithoutProject'] = jest.fn();
    asMockedFn(listWithoutProject).mockResolvedValue([
      generateTestApp({
        appName: 'app1',
        status: 'RUNNING',
      }),
    ]);

    const getAcl: WorkspaceContract['getAcl'] = jest.fn();
    asMockedFn(getAcl).mockResolvedValue({ acl: { 'example1@example.com': partial<RawAccessEntry>({}) } });
    const bucketUsage: WorkspaceContract['bucketUsage'] = jest.fn();
    asMockedFn(bucketUsage).mockResolvedValue({ usageInBytes: 1234 });

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () => partial<WorkspaceContract>({ getAcl, bucketUsage }),
      })
    );
    asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listWithoutProject }));

    // Act
    const { result } = await renderHookInAct(() =>
      useDeleteWorkspaceState({ workspace: googleWorkspace, onDismiss: mockOnDismiss, onSuccess: mockOnSuccess })
    );

    // Assert
    expect(result.current.hasApps()).toBe(true);
    expect(result.current.isDeleteDisabledFromResources).toBe(false);
    expect(result.current.collaboratorEmails).toEqual(['example1@example.com']);
    expect(result.current.workspaceBucketUsageInBytes).toBe(1234);
    expect(listWithoutProject).toHaveBeenCalledTimes(1);
    expect(listWithoutProject).toHaveBeenCalledWith({
      role: 'creator',
      saturnWorkspaceName: googleWorkspace.workspace.name,
    });
    expect(getAcl).toHaveBeenCalledTimes(1);
    expect(bucketUsage).toHaveBeenCalledTimes(1);
  });

  it('can initialize state for an azure workspace', async () => {
    // Arrange
    const listAppsV2: AppsAjaxContract['listAppsV2'] = jest.fn();
    asMockedFn(listAppsV2).mockResolvedValue([
      generateTestApp({
        appName: 'example',
        status: 'PROVISIONING',
      }),
    ]);
    asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listAppsV2 }));

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            getAcl: async () => ({ acl: {} }),
          }),
      })
    );
    asMockedFn(Runtimes).mockReturnValue(
      partial<RuntimesAjaxContract>({
        listV2WithWorkspace: async () => [],
      })
    );

    // Act
    const { result } = await renderHookInAct(() =>
      useDeleteWorkspaceState({ workspace: azureWorkspace, onDismiss: mockOnDismiss, onSuccess: mockOnSuccess })
    );

    // Assert
    expect(result.current.hasApps()).toBe(true);
    expect(result.current.hasRuntimes()).toBe(false);
    expect(result.current.isDeleteDisabledFromResources).toBe(true);
    expect(listAppsV2).toHaveBeenCalledTimes(1);
    expect(listAppsV2).toHaveBeenCalledWith(azureWorkspace.workspace.workspaceId);
  });

  it('can delete an azure workspace', async () => {
    // Arrange
    const mockDelete: WorkspaceV2Contract['delete'] = jest.fn();
    asMockedFn(mockDelete).mockResolvedValue(partial<Response>({}));

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            getAcl: async () => ({ acl: { 'example1@example.com': partial<RawAccessEntry>({}) } }),
          }),
        workspaceV2: () => partial<WorkspaceV2Contract>({ delete: mockDelete }),
      })
    );

    asMockedFn(Apps).mockReturnValue(
      partial<AppsAjaxContract>({
        listAppsV2: async () => [],
      })
    );

    const listV2WithWorkspace: RuntimesAjaxContract['listV2WithWorkspace'] = jest.fn();
    asMockedFn(listV2WithWorkspace).mockResolvedValue([]);

    asMockedFn(Runtimes).mockReturnValue(partial<RuntimesAjaxContract>({ listV2WithWorkspace }));

    // Act
    const { result } = await renderHookInAct(() =>
      useDeleteWorkspaceState({ workspace: azureWorkspace, onDismiss: mockOnDismiss, onSuccess: mockOnSuccess })
    );
    await act(() => result.current.deleteWorkspace());

    // Assert
    expect(result.current.deleting).toBe(true);
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('can delete a google workspace', async () => {
    // Arrange
    const mockDelete: WorkspaceV2Contract['delete'] = jest.fn();
    asMockedFn(mockDelete).mockResolvedValue(partial<Response>({}));

    asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listWithoutProject: async () => [] }));

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            getAcl: async () => ({ acl: {} }),
            bucketUsage: async () => partial<BucketUsageResponse>({}),
          }),
        workspaceV2: () =>
          partial<WorkspaceV2Contract>({
            delete: mockDelete,
          }),
      })
    );

    // Act
    const { result } = await renderHookInAct(() =>
      useDeleteWorkspaceState({ workspace: googleWorkspace, onDismiss: mockOnDismiss, onSuccess: mockOnSuccess })
    );
    await act(() => result.current.deleteWorkspace());

    // Assert
    expect(result.current.deleting).toBe(true);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('can handle errors when deletion fails', async () => {
    // Arrange
    asMockedFn(Apps).mockReturnValue(
      partial<AppsAjaxContract>({
        listWithoutProject: async () => [],
      })
    );

    const mockDelete: WorkspaceV2Contract['delete'] = jest.fn();
    asMockedFn(mockDelete).mockRejectedValue(new Error('testing'));

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            getAcl: async () => ({ acl: {} }),
            bucketUsage: async () => partial<BucketUsageResponse>({}),
          }),
        workspaceV2: () =>
          partial<WorkspaceV2Contract>({
            delete: mockDelete,
          }),
      })
    );

    // Act
    const { result } = await renderHookInAct(() =>
      useDeleteWorkspaceState({ workspace: googleWorkspace, onDismiss: mockOnDismiss, onSuccess: mockOnSuccess })
    );

    await act(() => result.current.deleteWorkspace());

    // Assert
    expect(result.current.deleting).toBe(false);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it('can delete a google workspace with no google project', async () => {
    // Arrange
    asMockedFn(Apps).mockReturnValue(
      partial<AppsAjaxContract>({
        listWithoutProject: async () => [],
      })
    );

    const mockDelete = jest.fn().mockResolvedValue([]);
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            getAcl: async () => ({ acl: {} }),
            bucketUsage: async () => {
              throw new Error('no project!');
            },
          }),
        workspaceV2: () =>
          partial<WorkspaceV2Contract>({
            delete: mockDelete,
          }),
      })
    );

    // Act
    const { result } = await renderHookInAct(() =>
      useDeleteWorkspaceState({ workspace: googleWorkspace, onDismiss: mockOnDismiss, onSuccess: mockOnSuccess })
    );

    await act(() => result.current.deleteWorkspace());

    // Assert
    expect(result.current.deleting).toBe(true);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});
