import { act, renderHook } from '@testing-library/react';
import { WorkspaceContract, Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import { notify } from 'src/libs/notifications';
import { asyncImportJobStore } from 'src/libs/state';
import { asMockedFn, MockedFn, partial } from 'src/testing/test-utils';
import { AzureWorkspace, GoogleWorkspace } from 'src/workspaces/utils';

import { useImportJobs } from './import-jobs';

jest.mock('src/libs/ajax/workspaces/Workspaces');
jest.mock('src/libs/notifications');

describe('useImportJobs', () => {
  describe('for Google workspaces', () => {
    // Arrange
    const workspace: GoogleWorkspace = {
      workspace: {
        authorizationDomain: [],
        cloudPlatform: 'Gcp',
        billingAccount: 'billingAccounts/123456-ABCDEF-ABCDEF',
        bucketName: 'test-bucket',
        googleProject: 'test-project',
        name: 'google-workspace',
        namespace: 'test-workspaces',
        workspaceId: 'testGoogleWorkspaceId',
        createdDate: '2023-02-15T19:17:15.711Z',
        createdBy: 'user@example.com',
        lastModified: '2023-03-15T19:17:15.711Z',
      },
      accessLevel: 'OWNER',
      canShare: true,
      canCompute: true,
      policies: [],
    };

    it('returns list of running jobs in workspace', () => {
      // Arrange
      asyncImportJobStore.set([
        { targetWorkspace: { namespace: 'test-workspaces', name: 'other-workspace' }, jobId: 'other-workspace-job' },
        { targetWorkspace: { namespace: 'test-workspaces', name: 'google-workspace' }, jobId: 'workspace-job-1' },
        { targetWorkspace: { namespace: 'test-workspaces', name: 'google-workspace' }, jobId: 'workspace-job-2' },
      ]);

      // Act
      const { result: hookReturnRef } = renderHook(() => useImportJobs(workspace));

      // Assert
      expect(hookReturnRef.current.runningJobs).toEqual(['workspace-job-1', 'workspace-job-2']);
    });

    it('returns a function that refreshes running jobs', async () => {
      // Arrange
      asyncImportJobStore.set([
        { targetWorkspace: { namespace: 'test-workspaces', name: 'google-workspace' }, jobId: 'job-1' },
        { targetWorkspace: { namespace: 'test-workspaces', name: 'google-workspace' }, jobId: 'job-2' },
      ]);

      const listImportJobs: MockedFn<WorkspaceContract['listImportJobs']> = jest.fn();
      listImportJobs.mockResolvedValue([{ jobId: 'job-2' }, { jobId: 'job-3' }]);
      const getImportJobStatus: MockedFn<WorkspaceContract['getImportJobStatus']> = jest.fn();
      getImportJobStatus.mockResolvedValue({ jobId: 'workspace-job-2', status: 'Running' });

      asMockedFn(Workspaces).mockReturnValue(
        partial<WorkspacesAjaxContract>({
          workspace: () => partial<WorkspaceContract>({ listImportJobs, getImportJobStatus }),
        })
      );

      const { result: hookReturnRef } = renderHook(() => useImportJobs(workspace));

      // Act
      await act(() => hookReturnRef.current.refresh());

      // Assert
      expect(listImportJobs).toHaveBeenCalledWith(true);
      expect(hookReturnRef.current.runningJobs).toEqual(['job-2', 'job-3']);
    });

    it('notifies if a failed job is in import store', async () => {
      // Arrange
      asyncImportJobStore.set([
        { targetWorkspace: { namespace: 'test-workspaces', name: 'google-workspace2' }, jobId: 'job-4' },
        { targetWorkspace: { namespace: 'test-workspaces', name: 'google-workspace' }, jobId: 'job-2' },
      ]);

      const listImportJobs: MockedFn<WorkspaceContract['listImportJobs']> = jest.fn();
      listImportJobs.mockResolvedValue([{ jobId: 'job-1' }, { jobId: 'job-3' }]);
      const getImportJobStatus: MockedFn<WorkspaceContract['getImportJobStatus']> = jest.fn();
      getImportJobStatus.mockResolvedValue({ jobId: 'job-2', status: 'Error', message: 'This job failed.' });

      asMockedFn(Workspaces).mockReturnValue(
        partial<WorkspacesAjaxContract>({
          workspace: () => partial<WorkspaceContract>({ listImportJobs, getImportJobStatus }),
        })
      );

      const { result: hookReturnRef } = renderHook(() => useImportJobs(workspace));

      // Act
      await act(() => hookReturnRef.current.refresh());

      // Assert
      expect(getImportJobStatus).toHaveBeenCalledWith('job-2');
      expect(getImportJobStatus).not.toHaveBeenCalledWith('job-4');
      expect(notify).toHaveBeenCalledWith('error', 'Error importing data.', {
        message: 'This job failed.',
      });
    });
  });

  describe('for Azure workspaces', () => {
    // Arrange
    const workspace: AzureWorkspace = {
      workspace: {
        authorizationDomain: [],
        cloudPlatform: 'Azure',
        name: 'azure-workspace',
        namespace: 'test-workspaces',
        workspaceId: 'fafbb550-62eb-4135-8b82-3ce4d53446af',
        createdDate: '2023-02-15T19:17:15.711Z',
        createdBy: 'user@example.com',
        lastModified: '2023-03-15T19:17:15.711Z',
      },
      azureContext: {
        managedResourceGroupId: 'test-mrg',
        subscriptionId: 'test-sub-id',
        tenantId: 'test-tenant-id',
      },
      accessLevel: 'OWNER',
      canShare: true,
      canCompute: true,
      policies: [],
    };

    it('returns list of jobs in workspace', () => {
      // Arrange
      asyncImportJobStore.set([
        { targetWorkspace: { namespace: 'test-workspaces', name: 'azure-workspace2' }, jobId: 'workspace-job' },
        { targetWorkspace: { namespace: 'test-workspaces', name: 'azure-workspace' }, jobId: 'workspace-job-2' },
      ]);

      // Act
      const { result: hookReturnRef } = renderHook(() => useImportJobs(workspace));

      // Assert
      expect(hookReturnRef.current.runningJobs).toEqual(['workspace-job-2']);
    });

    it('returns a no-op for refreshing jobs', async () => {
      // Arrange
      asyncImportJobStore.set([
        { targetWorkspace: { namespace: 'test-workspaces', name: 'azure-workspace' }, jobId: 'workspace-job' },
        { targetWorkspace: { namespace: 'test-workspaces', name: 'azure-workspace' }, jobId: 'workspace-job-2' },
      ]);

      const listImportJobs: MockedFn<WorkspaceContract['listImportJobs']> = jest.fn();
      listImportJobs.mockResolvedValue([{ jobId: 'workspace-job' }, { jobId: 'workspace-job-2' }]);
      asMockedFn(Workspaces).mockReturnValue(
        partial<WorkspacesAjaxContract>({
          workspace: () => partial<WorkspaceContract>({ listImportJobs }),
        })
      );

      const { result: hookReturnRef } = renderHook(() => useImportJobs(workspace));

      // Act
      await act(() => hookReturnRef.current.refresh());

      // Assert
      expect(listImportJobs).not.toHaveBeenCalled();
      expect(hookReturnRef.current.runningJobs).toEqual(['workspace-job', 'workspace-job-2']);
    });
  });
});
