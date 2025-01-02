import { Icon } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { ReactNode, useState } from 'react';
import { ButtonPrimary, Link } from 'src/components/common';
import { MenuButton } from 'src/components/MenuButton';
import { makeMenuIcon, MenuTrigger } from 'src/components/PopupTrigger';
import { ariaSort, HeaderRenderer } from 'src/components/table';
import { cardList as cardListStyles } from 'src/libs/style';

export interface Member {
  email: string;
  roles: string[];
}

interface MemberTableProps {
  adminLabel: string;
  memberLabel: string;
  members: Member[];
  adminCanEdit: boolean;
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
  tableAriaLabel: string;
  isOwner: boolean;
  onAddMember: () => void;
}

export const MemberTable = (props: MemberTableProps): ReactNode => {
  const [sort, setSort] = useState<Sort>({ field: 'email', direction: 'asc' });

  return (
    <div style={{ marginTop: '1rem' }}>
      {props.isOwner && <NewMemberCard onClick={props.onAddMember} />}
      <div role='table' aria-label={props.tableAriaLabel}>
        <MemberCardHeaders sort={sort} onSort={setSort} />
        <div style={{ flexGrow: 1, marginTop: '1rem' }}>
          {_.map(
            (member: Member) => (
              <MemberCard
                key={member.email}
                adminLabel={props.adminLabel}
                memberLabel={props.memberLabel}
                member={member}
                adminCanEdit={props.adminCanEdit}
                onEdit={() => props.onEdit(member)}
                onDelete={() => props.onDelete(member)}
                isOwner={props.isOwner}
              />
            ),
            _.orderBy([sort.field], [sort.direction], props.members)
          )}
        </div>
      </div>
    </div>
  );
};

interface NewMemberCardProps {
  onClick: () => void;
}
const NewMemberCard = (props: NewMemberCardProps) => (
  <ButtonPrimary style={{ textTransform: 'none' }} onClick={props.onClick}>
    <Icon icon='plus' size={14} />
    <div style={{ marginLeft: '0.5rem' }}>Add Users</div>
  </ButtonPrimary>
);

interface MemberMenuContentProps {
  onEdit: () => void;
  onDelete: () => void;
}

const MemberMenuContent = (props: MemberMenuContentProps) => (
  <>
    <MenuButton onClick={props.onEdit}>
      {makeMenuIcon('edit')}
      Edit Role
    </MenuButton>
    <MenuButton onClick={props.onDelete}>
      {makeMenuIcon('trash')}
      Remove User
    </MenuButton>
  </>
);

const menuCardSize = 20;

export interface Sort {
  field: string;
  direction: 'asc' | 'desc';
}

interface MemberCardHeadersProps {
  sort: Sort;
  onSort: (v: Sort) => void;
}

const MemberCardHeaders = (props: MemberCardHeadersProps): ReactNode => (
  <div role='row' style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', padding: '0 1rem' }}>
    <div role='columnheader' aria-sort={ariaSort(props.sort, 'email')} style={{ flex: 1 }}>
      <HeaderRenderer sort={props.sort} onSort={props.onSort} name='email' />
    </div>
    <div role='columnheader' aria-sort={ariaSort(props.sort, 'roles')} style={{ flex: 1 }}>
      <HeaderRenderer sort={props.sort} onSort={props.onSort} name='roles' />
    </div>
    <div
      role='columnheader'
      // Width is the same as the menu icon.
      style={{ width: menuCardSize }}
    >
      <div className='sr-only'>Actions</div>
    </div>
  </div>
);

interface MemberCardProps {
  member: Member;
  adminCanEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  adminLabel: string;
  memberLabel: string;
  isOwner: boolean;
}

const MemberCard = (props: MemberCardProps): ReactNode => {
  const {
    member: { email, roles },
    adminCanEdit,
    onEdit,
    onDelete,
    adminLabel,
    memberLabel,
    isOwner,
  } = props;
  const canEdit = adminCanEdit || !_.includes(adminLabel, roles);
  const tooltip = !canEdit && `This user is the only ${adminLabel}`;

  return (
    <div role='row' style={cardListStyles.longCardShadowless}>
      <div
        role='rowheader'
        style={{ flex: '1', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', height: '1rem' }}
      >
        {email}
      </div>
      <div role='cell' style={{ flex: '1', textTransform: 'capitalize', height: '1rem' }}>
        {_.includes(adminLabel, roles) ? adminLabel : memberLabel}
      </div>
      {isOwner && (
        <div role='cell' style={{ flex: 'none' }}>
          <MenuTrigger
            side='left'
            style={{ height: menuCardSize, width: menuCardSize }}
            closeOnClick
            content={<MemberMenuContent onEdit={onEdit} onDelete={onDelete} />}
          >
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <Link aria-label={`Menu for User: ${email}`} disabled={!canEdit} tooltip={tooltip} tooltipSide='left'>
              <Icon icon='cardMenuIcon' size={menuCardSize} />
            </Link>
          </MenuTrigger>
        </div>
      )}
    </div>
  );
};
