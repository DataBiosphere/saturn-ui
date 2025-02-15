import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';
import { atom, delay } from '@terra-ui-packages/core-utils';
import { makeNotificationsProvider, NotificationsContextProvider, Notifier } from '@terra-ui-packages/notifications';
import React, { useEffect, useState } from 'react';
import {
  azureRuntime,
  generateTestDiskWithGoogleWorkspace,
  generateTestListGoogleRuntime,
} from 'src/analysis/_testData/testData';
import { Environments, EnvironmentsProps } from 'src/analysis/Environments/Environments';
import { LeoResourcePermissionsProvider } from 'src/analysis/Environments/Environments.models';
import { GetAppItem } from 'src/libs/ajax/leonardo/models/app-models';
import { ListRuntimeItem } from 'src/libs/ajax/leonardo/models/runtime-models';
import { DiskBasics, PersistentDisk } from 'src/libs/ajax/leonardo/providers/LeoDiskProvider';
import { RuntimeBasics, RuntimeErrorInfo } from 'src/libs/ajax/leonardo/providers/LeoRuntimeProvider';
import { RuntimeWrapper } from 'src/libs/ajax/leonardo/Runtimes';
import { defaultAzureWorkspace, defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';
import { UseWorkspaces } from 'src/workspaces/common/state/useWorkspaces.models';
import { WorkspaceWrapper } from 'src/workspaces/utils';

/**
 * This component is used in terra-ui, and a version of it is also used in All of Us (AoU).
 */
const meta: Meta<typeof Environments> = {
  title: 'src/Analysis/Environments',
  component: Environments,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Environments>;

const actionLogAsyncFn = (name: string) => {
  const storyAlert = async (...args: any[]) => {
    const log = [`${name} method called with:`, ...args];
    action(name)(log);
    // eslint-disable-next-line no-console
    console.log(log);
  };
  return storyAlert;
};

const actionLogFn = (name: string) => {
  const storyAlert = (...args: any[]) => {
    const log = [`${name} method called with:`, ...args];
    action(name)(log);
    // eslint-disable-next-line no-console
    console.log(log);
  };
  return storyAlert;
};

const runtimesStore = atom<ListRuntimeItem[]>([]);
const disksStore = atom<PersistentDisk[]>([]);

const getMockLeoApps = (): EnvironmentsProps['leoAppData'] => {
  return {
    listWithoutProject: async () => Promise.resolve([]),
    get: async () => Promise.resolve({} as GetAppItem),
    pause: actionLogAsyncFn('leoAppData.pause'),
    delete: actionLogAsyncFn('leoAppData.delete'),
  };
};

const getMockLeoRuntimes = (): EnvironmentsProps['leoRuntimeData'] => {
  action('useMockLeoRuntimes hook hit')();
  return {
    list: async () => {
      await actionLogAsyncFn('leoRuntimeData.list')(runtimesStore.get());
      return runtimesStore.get();
    },
    errorInfo: async () => {
      const info: RuntimeErrorInfo = {
        errorType: 'ErrorList',
        errors: [{ errorMessage: 'things went BOOM!', errorCode: 0, timestamp: 'timestamp' }],
      };
      await actionLogAsyncFn('leoRuntimeData.errorInfo')(info);
      return info;
    },
    stop: async (runtime: RuntimeWrapper) => {
      const copy: ListRuntimeItem[] = [];
      runtimesStore.get().forEach((r) =>
        copy.push({
          ...r,
          status: r.runtimeName === runtime.runtimeName ? 'Stopped' : r.status,
        })
      );
      runtimesStore.set(copy);
      await actionLogAsyncFn('leoRuntimeData.stop')(runtime);
    },
    delete: async (runtime: RuntimeBasics) => {
      const updated = runtimesStore.get().filter((item) => item.runtimeName !== runtime.runtimeName);
      runtimesStore.set(updated);
      await actionLogAsyncFn('leoRuntimeData.delete')(runtime);
    },
  };
};

const getMockLeoDisks = (): EnvironmentsProps['leoDiskData'] => {
  return {
    list: async () => Promise.resolve(disksStore.get()),
    delete: async (disk: DiskBasics) => {
      const updated = disksStore.get().filter((d: PersistentDisk) => d.name !== disk.name);
      disksStore.set(updated);
      actionLogAsyncFn('leoDiskData.delete')(disk);
    },
  };
};

const getMockUseWorkspaces = (mockResults: WorkspaceWrapper[]): EnvironmentsProps['useWorkspaces'] => {
  const useMockHook: UseWorkspaces = () => {
    const [loading, setLoading] = useState<boolean>(false);
    const [status, setStatus] = useState<'Ready' | 'Loading' | 'Error'>('Ready');
    return {
      workspaces: mockResults,
      loading,
      status,
      refresh: async () => {
        setLoading(true);
        setStatus('Loading');
        await delay(1000);
        setLoading(false);
        setStatus('Ready');
      },
    };
  };
  return useMockHook;
};

const getMockNav = (): EnvironmentsProps['nav'] => ({
  // eslint-disable-next-line no-alert
  navTo: (navKey) => alert(navKey),
  getUrl: (navKey, args) => `javascript:alert('nav to ${navKey} with: ${JSON.stringify(args)}')`,
});

const mockNotifier: Notifier = {
  notify: actionLogAsyncFn('Notifications.notify'),
};
const mockNotifications = makeNotificationsProvider({
  notifier: mockNotifier,
  shouldIgnoreError: () => false,
});

const happyPermissions: LeoResourcePermissionsProvider = {
  hasDeleteDiskPermission: () => true,
  hasPausePermission: () => true,
  isAppInDeletableState: () => true,
  isResourceInDeletableState: () => true,
};

export const HappyEnvironments: Story = {
  render: () => {
    const StoryWrapper = (): React.ReactNode => {
      action('Environments render')();
      useEffect(() => {
        runtimesStore.set([generateTestListGoogleRuntime(), azureRuntime]);
        disksStore.set([generateTestDiskWithGoogleWorkspace()]);
      }, []);
      return (
        <NotificationsContextProvider notifications={mockNotifications}>
          <Environments
            nav={getMockNav()}
            useWorkspaces={getMockUseWorkspaces([defaultGoogleWorkspace, defaultAzureWorkspace])}
            leoAppData={getMockLeoApps()}
            leoRuntimeData={getMockLeoRuntimes()}
            leoDiskData={getMockLeoDisks()}
            permissions={happyPermissions}
            onEvent={actionLogFn('onEvent')}
          />
        </NotificationsContextProvider>
      );
    };
    return <StoryWrapper />;
  },
};

export const NoEnvironments: Story = {
  render: () => {
    const StoryWrapper = (): React.ReactNode => {
      action('Environments render')();
      useEffect(() => {
        runtimesStore.set([]);
        disksStore.set([]);
      }, []);
      return (
        <NotificationsContextProvider notifications={mockNotifications}>
          <Environments
            nav={getMockNav()}
            useWorkspaces={getMockUseWorkspaces([defaultGoogleWorkspace, defaultAzureWorkspace])}
            leoAppData={getMockLeoApps()}
            leoRuntimeData={getMockLeoRuntimes()}
            leoDiskData={getMockLeoDisks()}
            permissions={happyPermissions}
            onEvent={actionLogFn('onEvent')}
          />
        </NotificationsContextProvider>
      );
    };
    return <StoryWrapper />;
  },
};

/**
 * This demonstrates the notification callback that is triggered if deleting a cloud environment fails.
 * The callback can be seen in the `Actions` tab.
 */
export const DeleteError: Story = {
  render: () => {
    const StoryWrapper = (): React.ReactNode => {
      action('Environments render')();
      useEffect(() => {
        runtimesStore.set([generateTestListGoogleRuntime(), azureRuntime]);
        disksStore.set([generateTestDiskWithGoogleWorkspace()]);
      }, []);
      return (
        <NotificationsContextProvider notifications={mockNotifications}>
          <Environments
            nav={getMockNav()}
            useWorkspaces={getMockUseWorkspaces([defaultGoogleWorkspace, defaultAzureWorkspace])}
            leoAppData={getMockLeoApps()}
            leoRuntimeData={{
              ...getMockLeoRuntimes(),
              delete: () => Promise.reject(Error('BOOM!')),
            }}
            leoDiskData={getMockLeoDisks()}
            permissions={happyPermissions}
            onEvent={actionLogFn('onEvent')}
          />
        </NotificationsContextProvider>
      );
    };
    return <StoryWrapper />;
  },
};
