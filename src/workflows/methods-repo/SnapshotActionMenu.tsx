import { Clickable, Icon } from '@terra-ui-packages/components';
import React, { ReactNode } from 'react';
import { MenuButton } from 'src/components/MenuButton';
import { makeMenuIcon, MenuTrigger } from 'src/components/PopupTrigger';

export interface SnapshotActionMenuProps {
  /**
   * Whether opening the action menu should be disabled.
   */
  disabled?: boolean;

  /**
   * Whether the user is an owner of the workflow snapshot the actions in the
   * menu are for. Controls whether the following actions are enabled: edit
   * permissions, delete snapshot
   */
  isSnapshotOwner: boolean;

  /**
   * The action to be performed if the "Edit snapshot permissions" button is
   * pressed.
   */
  onEditPermissions: () => void;

  /** The action to be performed if the "Delete snapshot" button is pressed. */
  onDelete: () => void;
}

/**
 * A kebab (vertical three-dot) menu that displays buttons to perform actions on
 * a workflow snapshot.
 *
 * Currently supported actions: edit permissions, delete snapshot
 */
const SnapshotActionMenu = (props: SnapshotActionMenuProps): ReactNode => {
  const { disabled, isSnapshotOwner, onEditPermissions, onDelete } = props;

  const notSnapshotOwnerTooltip = 'You must be an owner of this snapshot';

  const menuContent = (
    <>
      <MenuButton
        disabled={!isSnapshotOwner}
        tooltip={!isSnapshotOwner && notSnapshotOwnerTooltip}
        tooltipSide='left'
        onClick={onEditPermissions}
      >
        {makeMenuIcon('cog')}
        Edit snapshot permissions
      </MenuButton>
      <MenuButton
        disabled={!isSnapshotOwner}
        tooltip={!isSnapshotOwner && notSnapshotOwnerTooltip}
        tooltipSide='left'
        onClick={onDelete}
      >
        {makeMenuIcon('trash')}
        Delete snapshot
      </MenuButton>
    </>
  );

  return (
    <MenuTrigger side='bottom' closeOnClick content={menuContent}>
      <Clickable
        aria-label='Snapshot action menu'
        aria-haspopup='menu'
        style={{ opacity: 0.65, height: 27 }}
        hover={!disabled ? { opacity: 1 } : undefined}
        disabled={disabled}
      >
        <Icon icon='cardMenuIcon' size={27} />
      </Clickable>
    </MenuTrigger>
  );
};

export default SnapshotActionMenu;
