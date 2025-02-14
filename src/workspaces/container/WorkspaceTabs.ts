import _ from 'lodash/fp';
import { Dispatch, ReactNode } from 'react';
import { h } from 'react-hyperscript-helpers';
import { analysisTabName } from 'src/analysis/runtime-common-text';
import { TabBar } from 'src/components/tabBars';
import * as Nav from 'src/libs/nav';
import { WorkspaceMenu } from 'src/workspaces/common/WorkspaceMenu';
import { WorkspaceAttributeNotice } from 'src/workspaces/container/WorkspaceAttributeNotice';
import {
  getCloudProviderFromWorkspace,
  isAzureWorkspace,
  isGoogleWorkspace,
  isOwner,
  isProtectedWorkspace,
  protectedDataMessage,
  regionConstraintMessage,
  WorkspaceWrapper as Workspace,
} from 'src/workspaces/utils';

export interface WorkspaceTabsProps {
  namespace: string;
  name: string;
  workspace?: Workspace;
  activeTab?: string;
  refresh: () => void;
  setDeletingWorkspace: Dispatch<boolean>;
  setCloningWorkspace: Dispatch<boolean>;
  setSharingWorkspace: Dispatch<boolean>;
  setShowLockWorkspaceModal: Dispatch<boolean>;
  setLeavingWorkspace: Dispatch<boolean>;
  setShowSettingsModal: Dispatch<boolean>;
}

export const WorkspaceTabs = (props: WorkspaceTabsProps): ReactNode => {
  const {
    workspace,
    activeTab,
    refresh,
    setDeletingWorkspace,
    setCloningWorkspace,
    setSharingWorkspace,
    setShowLockWorkspaceModal,
    setLeavingWorkspace,
    setShowSettingsModal,
  } = props;
  const { namespace, name } = props;
  const wsOwner = !!workspace && isOwner(workspace.accessLevel);
  const canShare = workspace?.canShare;
  const isLocked = !!workspace?.workspace.isLocked;
  const workspaceLoaded = !!workspace;

  const onClone = () => setCloningWorkspace(true);
  const onDelete = () => setDeletingWorkspace(true);
  const onLock = () => setShowLockWorkspaceModal(true);
  const onShare = () => setSharingWorkspace(true);
  const onLeave = () => setLeavingWorkspace(true);
  const onShowSettings = () => setShowSettingsModal(true);

  const tabs = getTabs(workspace);

  return h(
    TabBar,
    {
      'aria-label': 'Workspace Navigation Tabs',
      activeTab,
      refresh,
      tabNames: _.map('name', tabs),
      getHref: (currentTab) => Nav.getLink(_.find({ name: currentTab }, tabs)?.link ?? '', { namespace, name }),
    },
    [
      workspace &&
        h(WorkspaceAttributeNotice, {
          accessLevel: workspace.accessLevel,
          isLocked,
          workspaceProtectedMessage: isProtectedWorkspace(workspace) ? protectedDataMessage : undefined,
          workspaceRegionConstraintMessage: regionConstraintMessage(workspace),
        }),
      h(WorkspaceMenu, {
        iconSize: 27,
        popupLocation: 'bottom',
        callbacks: { onClone, onShare, onLock, onDelete, onLeave, onShowSettings },
        workspaceInfo: {
          state: workspace?.workspace?.state,
          canShare: !!canShare,
          isLocked,
          isOwner: wsOwner,
          workspaceLoaded,
          cloudProvider: !workspace ? undefined : getCloudProviderFromWorkspace(workspace),
          namespace,
          name,
        },
      }),
    ]
  );
};

const getTabs = (workspace?: Workspace): { name: string; link: string }[] => {
  if (workspace?.workspace?.state === 'Deleting' || workspace?.workspace?.state === 'DeleteFailed') {
    return [{ name: 'dashboard', link: 'workspace-dashboard' }];
  }

  const commonTabs = [
    { name: 'dashboard', link: 'workspace-dashboard' },
    { name: 'data', link: 'workspace-data' },
    { name: 'analyses', link: analysisTabName },
  ];
  if (!!workspace && isGoogleWorkspace(workspace)) {
    return [
      ...commonTabs,
      { name: 'workflows', link: 'workspace-workflows' },
      { name: 'submission history', link: 'workspace-submission-history' },
    ];
  }
  if (!!workspace && isAzureWorkspace(workspace)) {
    return [...commonTabs, { name: 'workflows', link: 'workspace-workflows-app' }];
  }
  return commonTabs;
};
