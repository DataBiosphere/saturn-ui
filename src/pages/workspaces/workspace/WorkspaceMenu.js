import { Fragment } from 'react';
import { h } from 'react-hyperscript-helpers';
import { Clickable } from 'src/components/common';
import { icon } from 'src/components/icons';
import { MenuButton } from 'src/components/MenuButton';
import { makeMenuIcon, MenuTrigger } from 'src/components/PopupTrigger';
import { useWorkspaceDetails } from 'src/components/workspace-utils';
import * as Utils from 'src/libs/utils';
import * as WorkspaceUtils from 'src/libs/workspace-utils';

// In `workspaceInfo`, specify either `name and namespace` to fetch the Workspace details,
// or `canShare, isLocked, and isOwner` to use previously fetched details.
const WorkspaceMenu = ({
  iconSize,
  popupLocation,
  callbacks: { onClone, onShare, onLock, onDelete, onLeave },
  workspaceInfo: { name, namespace, canShare, isLocked, isOwner, workspaceLoaded },
}) => {
  const navIconProps = {
    style: { opacity: 0.65, marginRight: '1rem', height: iconSize },
    hover: { opacity: 1 },
    focus: 'hover',
  };

  const menuContent = namespace
    ? h(DynamicWorkspaceMenuContent, { namespace, name, onShare, onClone, onDelete, onLock, onLeave })
    : h(WorkspaceMenuContent, { canShare, isLocked, isOwner, onClone, onShare, onLock, onLeave, onDelete, workspaceLoaded });

  return h(
    MenuTrigger,
    {
      side: popupLocation,
      closeOnClick: true,
      content: menuContent,
    },
    [
      h(
        Clickable,
        {
          'aria-label': name ? `Action Menu for Workspace: ${name}` : 'Workspace Action Menu',
          'aria-haspopup': 'menu',
          ...navIconProps,
        },
        [icon('cardMenuIcon', { size: iconSize })]
      ),
    ]
  );
};

const DynamicWorkspaceMenuContent = ({ namespace, name, onClone, onShare, onDelete, onLock, onLeave }) => {
  const { workspace } = useWorkspaceDetails({ namespace, name }, ['accessLevel', 'policies', 'canShare', 'workspace.isLocked']);

  const canShare = workspace?.canShare;
  const isOwner = workspace && WorkspaceUtils.isOwner(workspace.accessLevel);
  const isLocked = workspace?.workspace.isLocked;

  return WorkspaceMenuContent({
    canShare,
    isLocked,
    isOwner,
    onClone,
    // the list component doesn't have workspace details, so we need to pass policies so it can add it for the ShareWorkspaceModal modal
    // the dashboard component already has the field, so it will ignore the parameter of onShare
    onShare: () => onShare(workspace?.policies),
    onLock,
    onLeave,
    onDelete,
    workspaceLoaded: !!workspace,
  });
};

export const tooltipText = {
  shareNoPermission: 'You have not been granted permission to share this workspace',
  deleteLocked: 'You cannot delete a locked workspace',
  deleteNoPermission: 'You must be an owner of this workspace or the underlying billing project',
  lockNoPermission: 'You have not been granted permission to lock this workspace',
  unlockNoPermission: 'You have not been granted permission to unlock this workspace',
};

const WorkspaceMenuContent = ({ canShare, isLocked, isOwner, onClone, onShare, onLock, onLeave, onDelete, workspaceLoaded }) => {
  const shareTooltip = Utils.cond([workspaceLoaded && !canShare, () => tooltipText.shareNoPermission], [Utils.DEFAULT, () => '']);
  const deleteTooltip = Utils.cond(
    [workspaceLoaded && isLocked, () => tooltipText.deleteLocked],
    [workspaceLoaded && !isOwner, () => tooltipText.deleteNoPermission],
    [Utils.DEFAULT, () => '']
  );

  return h(Fragment, [
    h(
      MenuButton,
      {
        disabled: !workspaceLoaded,
        tooltipSide: 'left',
        onClick: onClone,
      },
      [makeMenuIcon('copy'), 'Clone']
    ),
    h(
      MenuButton,
      {
        disabled: !workspaceLoaded || !canShare,
        tooltip: shareTooltip,
        tooltipSide: 'left',
        onClick: onShare,
      },
      [makeMenuIcon('share'), 'Share']
    ),
    h(
      MenuButton,
      {
        disabled: !workspaceLoaded || !isOwner,
        tooltip: workspaceLoaded && !isOwner && [isLocked ? tooltipText.unlockNoPermission : tooltipText.lockNoPermission],
        tooltipSide: 'left',
        onClick: onLock,
      },
      isLocked ? [makeMenuIcon('unlock'), 'Unlock'] : [makeMenuIcon('lock'), 'Lock']
    ),
    h(
      MenuButton,
      {
        disabled: !workspaceLoaded,
        onClick: onLeave,
      },
      [makeMenuIcon('arrowRight'), 'Leave']
    ),
    h(
      MenuButton,
      {
        disabled: !workspaceLoaded || !isOwner || isLocked,
        tooltip: deleteTooltip,
        tooltipSide: 'left',
        onClick: onDelete,
      },
      [makeMenuIcon('trash'), 'Delete']
    ),
  ]);
};

export default WorkspaceMenu;
