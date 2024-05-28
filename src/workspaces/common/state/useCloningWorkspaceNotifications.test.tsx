import { DeepPartial } from '@terra-ui-packages/core-utils';
import { NotificationType } from '@terra-ui-packages/notifications';
import { waitFor } from '@testing-library/react';
import React from 'react';
import { Ajax } from 'src/libs/ajax';
import { clearNotification, notify } from 'src/libs/notifications';
import { cloningWorkspacesStore } from 'src/libs/state';
import { asMockedFn, renderWithAppContexts as render } from 'src/testing/test-utils';
import { defaultAzureWorkspace } from 'src/testing/workspace-fixtures';
import {
  notifyNewWorkspaceClone,
  useCloningWorkspaceNotifications,
} from 'src/workspaces/common/state/useCloningWorkspaceNotifications';
import { WorkspaceInfo, WorkspaceState } from 'src/workspaces/utils';

type AjaxContract = ReturnType<typeof Ajax>;
type AjaxWorkspacesContract = AjaxContract['Workspaces'];

jest.mock('src/libs/ajax', (): typeof import('src/libs/ajax') => {
  return {
    ...jest.requireActual('src/libs/ajax'),
    Ajax: jest.fn(),
  };
});

type NotificationExports = typeof import('src/libs/notifications');
jest.mock<NotificationExports>(
  'src/libs/notifications',
  (): NotificationExports => ({
    ...jest.requireActual('src/libs/notifications'),
    notify: jest.fn(),
    clearNotification: jest.fn(),
  })
);
// notify
const CloningTestComponent = (): React.ReactNode => {
  useCloningWorkspaceNotifications();
  return null;
};

describe('useCloningWorkspaceNotifications', () => {
  beforeEach(() => {
    cloningWorkspacesStore.set([]);
  });

  describe('notifyNewWorkspaceClone', () => {
    it('adds the workspace to the cloning store', () => {
      // Arrange
      const clone: WorkspaceInfo = {
        ...defaultAzureWorkspace.workspace,
        state: 'Cloning',
      };
      // Act
      notifyNewWorkspaceClone(clone);

      // Assert
      expect(cloningWorkspacesStore.get()).toEqual([clone]);
    });

    it('creates a notification that the clone has started', () => {
      // Arrange
      const clone: WorkspaceInfo = {
        ...defaultAzureWorkspace.workspace,
        state: 'Cloning',
      };
      // Act
      notifyNewWorkspaceClone(clone);

      // Assert
      expect(asMockedFn(notify)).toHaveBeenCalledWith('info', expect.any(Object), {
        id: expect.any(String),
        message: expect.any(Object),
      });
    });
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  it.each<{
    updatedState: WorkspaceState;
    notificationType?: NotificationType;
  }>([
    { updatedState: 'CloningFailed', notificationType: 'error' },
    { updatedState: 'Ready', notificationType: 'success' },
  ])(
    'removes the workspace in the store and sends a $notificationType notification when the workspace is updated to $updatedState',
    async ({ updatedState, notificationType }) => {
      // Arrange
      const clone: WorkspaceInfo = { ...defaultAzureWorkspace.workspace, state: 'Cloning' };
      cloningWorkspacesStore.set([clone]);
      const mockDetailsFn = jest.fn().mockResolvedValue({ workspace: { state: updatedState } });
      const mockAjax: DeepPartial<AjaxContract> = {
        Workspaces: {
          workspace: () =>
            ({
              details: mockDetailsFn,
            } as Partial<AjaxWorkspacesContract['workspace']>),
        },
      };
      asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract);

      // Act
      render(<CloningTestComponent />);
      jest.advanceTimersByTime(30000);
      await waitFor(() => expect(mockDetailsFn).toBeCalledTimes(1));

      // Assert
      expect(cloningWorkspacesStore.get()).toHaveLength(0);
      expect(asMockedFn(clearNotification)).toHaveBeenCalledWith(
        expect.stringContaining(`${clone.namespace}/${clone.name}`)
      );
      expect(asMockedFn(notify)).toHaveBeenCalledWith(notificationType, expect.any(Object), { id: expect.any(String) });
    }
  );

  it('updates the workspace when the state is updated to to CloningContainer', async () => {
    // Arrange
    const clone: WorkspaceInfo = { ...defaultAzureWorkspace.workspace, state: 'Cloning' };
    cloningWorkspacesStore.set([clone]);
    const mockDetailsFn = jest.fn().mockResolvedValue({ workspace: { state: 'CloningContainer' } });
    const mockAjax: DeepPartial<AjaxContract> = {
      Workspaces: {
        workspace: () =>
          ({
            details: mockDetailsFn,
          } as Partial<AjaxWorkspacesContract['workspace']>),
      },
    };
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract);
    jest.useFakeTimers();

    // Act
    render(<CloningTestComponent />);
    jest.advanceTimersByTime(30000);
    await waitFor(() => expect(mockDetailsFn).toBeCalledTimes(1));

    // Assert
    expect(cloningWorkspacesStore.get()).toHaveLength(1);
    expect(cloningWorkspacesStore.get()[0].state).toBe('CloningContainer');
  });
});
