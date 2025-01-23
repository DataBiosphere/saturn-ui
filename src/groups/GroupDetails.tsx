import { SpinnerOverlay, useAutoLoadedData } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { useEffect, useState } from 'react';
import FooterWrapper from 'src/components/FooterWrapper';
import { DelayedSearchInput } from 'src/components/input';
import { PageBox, PageBoxVariants } from 'src/components/PageBox';
import { TopBar } from 'src/components/TopBar';
import { AdminNotifierCheckbox } from 'src/groups/AdminNotifierCheckbox';
import { DeleteMemberModal } from 'src/groups/Members/DeleteMemberModal';
import { EditMemberModal } from 'src/groups/Members/EditMemberModal';
import { Member, MemberTable } from 'src/groups/Members/MemberTable';
import { NewMemberModal } from 'src/groups/Members/NewMemberModal';
import { Groups } from 'src/libs/ajax/Groups';
import { GroupRole } from 'src/libs/ajax/Groups';
import { reportError } from 'src/libs/error';
import { getLink } from 'src/libs/nav';
import { useCancellation } from 'src/libs/react-utils';
import * as StateHistory from 'src/libs/state-history';
import * as Style from 'src/libs/style';
import { textMatch } from 'src/libs/utils';

interface GroupDetailsProps {
  groupName: string;
}

interface GroupDetailsData {
  members: Member[];
  allowAccessRequests: boolean;
  adminCanEdit: boolean;
}

export const GroupDetails = (props: GroupDetailsProps) => {
  const { groupName } = props;
  const signal = useCancellation();

  const loadDetails = async (): Promise<GroupDetailsData> => {
    const groupAjax = Groups(signal).group(groupName);
    const [membersEmails, adminsEmails, allowAccessRequests] = await Promise.all([
      groupAjax.listMembers(),
      groupAjax.listAdmins(),
      groupAjax.getPolicy('admin-notifier'),
    ]);
    const rolesByMember: [string, GroupRole[]] = _.mergeAllWith(
      (a, b) => {
        if (_.isArray(a)) return a.concat(b);
      },
      [
        _.fromPairs(_.map((email) => [email, ['admin']], adminsEmails)),
        _.fromPairs(_.map((email) => [email, ['member']], membersEmails)),
      ]
    );
    const members: Member[] = _.flow(
      _.toPairs,
      _.map(([email, roles]) => ({ email, roles })),
      _.sortBy((member) => member.email.toUpperCase())
    )(rolesByMember);
    return {
      allowAccessRequests,
      members,
      adminCanEdit: adminsEmails.length > 1,
    };
  };

  // State
  const [filter, setFilter] = useState(() => StateHistory.get().filter || '');
  const [details, updateDetails] = useAutoLoadedData<GroupDetailsData>(loadDetails, [signal], {
    onError: (state) => reportError('Error loading group details', state.error),
  });
  const [addingNewMember, setAddingNewMember] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<Member>();
  const [deletingUser, setDeletingUser] = useState<Member>();

  const updateAllowAccessRequests = (allowAccessRequests: boolean) =>
    updateDetails(async () => {
      try {
        await Groups().group(groupName).setPolicy('admin-notifier', allowAccessRequests);
      } catch (e) {
        reportError('Error changing access request permission', e);
      }
      const updatedDetails = await loadDetails();
      return updatedDetails;
    });

  const deleteUser = (deletingUser: Member) =>
    updateDetails(async () => {
      setDeletingUser(undefined);
      try {
        await Groups().group(groupName).removeUser(getGroupRoles(deletingUser), deletingUser.email);
      } catch (e) {
        reportError('Error removing member from group', e);
      }
      const updatedDetails = await loadDetails();
      return updatedDetails;
    });

  const refresh = async () => {
    setAddingNewMember(false);
    setEditingUser(undefined);
    setDeletingUser(undefined);
    updateDetails(loadDetails);
  };

  useEffect(() => {
    StateHistory.update({ filter });
  }, [filter]);

  // Render
  return (
    <FooterWrapper>
      <TopBar title='Groups' href={getLink('groups')}>
        <DelayedSearchInput
          aria-label='Search group'
          style={{ marginLeft: '2rem', width: 500 }}
          placeholder='SEARCH GROUP'
          onChange={setFilter}
          value={filter}
        />
      </TopBar>
      <PageBox role='main' style={{ flexGrow: 1 }} variant={PageBoxVariants.light}>
        <div style={Style.cardList.toolbarContainer}>
          <h2 style={{ ...Style.elements.sectionHeader, margin: 0, textTransform: 'uppercase' }}>
            Group Management: {groupName}
          </h2>
        </div>
        <AdminNotifierCheckbox
          checked={!!details.state?.allowAccessRequests}
          onChange={details.state ? updateAllowAccessRequests : () => {}}
        />
        <div style={{ marginTop: '1rem' }}>
          <MemberTable
            adminLabel='admin'
            memberLabel='member'
            members={_.filter(({ email }) => textMatch(filter, email), details.state?.members ?? [])}
            adminCanEdit={!!details.state?.adminCanEdit}
            onEdit={setEditingUser}
            onDelete={setDeletingUser}
            onAddMember={() => setAddingNewMember(true)}
            tableAriaLabel={`users in group ${groupName}`}
            isOwner
          />
        </div>
        {addingNewMember && (
          <NewMemberModal
            adminLabel='admin'
            memberLabel='member'
            title='Add users to Terra Group'
            addUnregisteredUser
            addFunction={(role: string, emails: string[]) =>
              Groups()
                .group(groupName)
                .addUsers(role as GroupRole, emails)
            }
            onDismiss={() => setAddingNewMember(false)}
            onSuccess={refresh}
          />
        )}
        {editingUser && (
          <EditMemberModal
            adminLabel='admin'
            memberLabel='member'
            member={editingUser}
            saveFunction={(email: string, roles: string[], newRoles: string[]) =>
              Groups()
                .group(groupName)
                .changeUserRoles(email, roles as GroupRole[], newRoles as GroupRole[])
            }
            onDismiss={() => setEditingUser(undefined)}
            onSuccess={refresh}
          />
        )}
        {deletingUser && (
          <DeleteMemberModal
            memberEmail={deletingUser.email}
            onDismiss={() => setDeletingUser(undefined)}
            onSubmit={() => deleteUser(deletingUser)}
          />
        )}
        {details.status === 'Loading' && <SpinnerOverlay />}
      </PageBox>
    </FooterWrapper>
  );
};

const groupRoleGuard = (value: string): value is GroupRole => {
  return value === 'admin' || value === 'member';
};
const getGroupRoles = (user: Member): GroupRole[] => {
  return user.roles.filter(groupRoleGuard);
};
