import { asMockedFn, MockedFn, partial } from '@terra-ui-packages/test-utils';
import { act } from '@testing-library/react';
import { h } from 'react-hyperscript-helpers';
import { WDSJob, WorkspaceData, WorkspaceDataAjaxContract } from 'src/libs/ajax/WorkspaceDataService';
import { WorkspaceContract, Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import { notify } from 'src/libs/notifications';
import { asyncImportJobStore } from 'src/libs/state';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

import ImportStatus from './ImportStatus';

jest.mock('src/libs/ajax/WorkspaceDataService');
jest.mock('src/libs/ajax/workspaces/Workspaces');

jest.mock('src/libs/notifications');

describe('ImportStatus', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });
  describe('for Google workspaces', () => {
    it('polls if import job is still pending', async () => {
      // Arrange
      asyncImportJobStore.set([
        { targetWorkspace: { namespace: 'test-workspaces', name: 'google-workspace' }, jobId: 'workspace-job-1' },
      ]);

      const getImportJobStatus: MockedFn<WorkspaceContract['getImportJobStatus']> = jest.fn();
      getImportJobStatus.mockResolvedValue({ status: 'Pending' });
      asMockedFn(Workspaces).mockReturnValue(
        partial<WorkspacesAjaxContract>({
          workspace: (_namespace, _name) => partial<WorkspaceContract>({ getImportJobStatus }),
        })
      );

      // Act
      render(h(ImportStatus, {}));
      await act(async () => {
        jest.advanceTimersByTime(60000);
      });

      expect(notify).not.toHaveBeenCalled();

      // Should poll again by calling getImportJobStatus again
      await act(async () => {
        jest.advanceTimersByTime(60000);
      });

      expect(getImportJobStatus).toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
    });
    it('notifies error if import failed', async () => {
      // Arrange
      asyncImportJobStore.set([
        { targetWorkspace: { namespace: 'test-workspaces', name: 'google-workspace' }, jobId: 'workspace-job-1' },
      ]);

      const getImportJobStatus: MockedFn<WorkspaceContract['getImportJobStatus']> = jest.fn();
      getImportJobStatus.mockResolvedValue({ status: 'Error', message: 'There has been an error.' });
      asMockedFn(Workspaces).mockReturnValue(
        partial<WorkspacesAjaxContract>({
          workspace: (_namespace, _name) => partial<WorkspaceContract>({ getImportJobStatus }),
        })
      );

      // Act
      render(h(ImportStatus, {}));
      await act(async () => {
        jest.advanceTimersByTime(60000);
      });

      // Assert
      expect(notify).toHaveBeenCalledWith('error', 'Error importing data.', {
        message: 'There has been an error.',
      });
    });
    it('notifies success when import completes', async () => {
      // Arrange
      asyncImportJobStore.set([
        { targetWorkspace: { namespace: 'test-workspaces', name: 'google-workspace' }, jobId: 'workspace-job-1' },
      ]);

      const getImportJobStatus: MockedFn<WorkspaceContract['getImportJobStatus']> = jest.fn();
      getImportJobStatus.mockResolvedValue({ status: 'Done' });
      asMockedFn(Workspaces).mockReturnValue(
        partial<WorkspacesAjaxContract>({
          workspace: (_namespace, _name) => partial<WorkspaceContract>({ getImportJobStatus }),
        })
      );

      // Act
      render(h(ImportStatus, {}));
      await act(async () => {
        jest.advanceTimersByTime(60000);
      });

      // Assert
      expect(notify).toHaveBeenCalledWith(
        'success',
        'Data imported successfully.',
        expect.objectContaining({
          message: expect.anything(),
        })
      );

      const message = (notify as jest.Mock).mock.calls[0][2].message;

      const { container: messageContainer } = render(message);
      expect(messageContainer).toHaveTextContent('test-workspaces / google-workspace');
    });
  });

  describe('for Azure workspaces', () => {
    it('polls if import job is still pending', async () => {
      // Arrange
      asyncImportJobStore.set([
        {
          targetWorkspace: { namespace: 'test-workspaces', name: 'azure-workspace' },
          jobId: 'workspace-job-1',
          wdsProxyUrl: 'http://proxy.url',
        },
      ]);

      const getJobStatus: MockedFn<WorkspaceDataAjaxContract['getJobStatus']> = jest.fn();
      getJobStatus.mockResolvedValue(partial<WDSJob>({ status: 'QUEUED' }));
      asMockedFn(WorkspaceData).mockReturnValue(partial<WorkspaceDataAjaxContract>({ getJobStatus }));

      // Act
      render(h(ImportStatus, {}));
      await act(async () => {
        jest.advanceTimersByTime(60000);
      });

      expect(notify).not.toHaveBeenCalled();

      // Should poll again by calling getImportJobStatus again
      await act(async () => {
        jest.advanceTimersByTime(60000);
      });

      expect(getJobStatus).toHaveBeenCalledWith('http://proxy.url', 'workspace-job-1');
      expect(notify).not.toHaveBeenCalled();
    });
    it('notifies error if import failed', async () => {
      // Arrange
      asyncImportJobStore.set([
        {
          targetWorkspace: { namespace: 'test-workspaces', name: 'azure-workspace' },
          jobId: 'workspace-job-1',
          wdsProxyUrl: 'http://proxy.url',
        },
      ]);

      const getJobStatus: MockedFn<WorkspaceDataAjaxContract['getJobStatus']> = jest.fn();
      getJobStatus.mockResolvedValue(
        partial<WDSJob>({ status: 'ERROR', errorMessage: 'Import failed for some reason.' })
      );
      asMockedFn(WorkspaceData).mockReturnValue(partial<WorkspaceDataAjaxContract>({ getJobStatus }));

      // Act
      render(h(ImportStatus, {}));
      await act(async () => {
        jest.advanceTimersByTime(60000);
      });

      expect(notify).toHaveBeenCalledWith('error', 'Error importing data.', {
        message: 'Import failed for some reason.',
      });
    });
    it('notifies success when import completes', async () => {
      // Arrange
      asyncImportJobStore.set([
        {
          targetWorkspace: { namespace: 'test-workspaces', name: 'azure-workspace' },
          jobId: 'workspace-job-1',
          wdsProxyUrl: 'http://proxy.url',
        },
      ]);

      const getJobStatus: MockedFn<WorkspaceDataAjaxContract['getJobStatus']> = jest.fn();
      getJobStatus.mockResolvedValue(partial<WDSJob>({ status: 'SUCCEEDED' }));
      asMockedFn(WorkspaceData).mockReturnValue(partial<WorkspaceDataAjaxContract>({ getJobStatus }));

      // Act
      render(h(ImportStatus, {}));
      await act(async () => {
        jest.advanceTimersByTime(60000);
      });

      expect(notify).toHaveBeenCalledWith(
        'success',
        'Data imported successfully.',
        expect.objectContaining({
          message: expect.anything(),
        })
      );
      const message = (notify as jest.Mock).mock.calls[0][2].message;

      const { container: messageContainer } = render(message);
      expect(messageContainer).toHaveTextContent('test-workspaces / azure-workspace');
    });
  });
});
