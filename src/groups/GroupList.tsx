import { SpinnerOverlay, useAutoLoadedData } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { useEffect, useState } from 'react';
import { DeleteConfirmationModal } from 'src/components/common';
import FooterWrapper from 'src/components/FooterWrapper';
import { DelayedSearchInput } from 'src/components/input';
import LeaveResourceModal from 'src/components/LeaveResourceModal';
import { PageBox, PageBoxVariants } from 'src/components/PageBox';
import { TopBar } from 'src/components/TopBar';
import { GroupCard } from 'src/groups/GroupCard';
import { GroupCardHeaders } from 'src/groups/GroupCardHeaders';
import { Sort } from 'src/groups/Members/MemberTable';
import { NewGroupCard } from 'src/groups/NewGroupCard';
import { NewGroupModal } from 'src/groups/NewGroupModal';
import { NoGroupsMessage } from 'src/groups/NoGroupsMessage';
import { Groups } from 'src/libs/ajax/Groups';
import { CurrentUserGroupMembership } from 'src/libs/ajax/Groups';
import { reportError } from 'src/libs/error';
import { useCancellation } from 'src/libs/react-utils';
import * as StateHistory from 'src/libs/state-history';
import * as Style from 'src/libs/style';
import { cond, textMatch } from 'src/libs/utils';

export const GroupList = (props: {}): React.ReactNode => {
  const signal = useCancellation();

  const fetchGroups = async (): Promise<CurrentUserGroupMembership[]> => {
    const rawGroups = await Groups(signal).list();
    const updatedGroups = _.flow(
      _.groupBy('groupName'),
      _.map((gs) => ({ ...gs[0], role: _.map('role', gs) })),
      _.sortBy('groupName')
    )(rawGroups);
    return updatedGroups;
  };

  // State
  const [filter, setFilter] = useState<string>(() => StateHistory.get()?.filter || '');
  const [creatingNewGroup, setCreatingNewGroup] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<CurrentUserGroupMembership>();
  const [leavingGroup, setLeavingGroup] = useState<CurrentUserGroupMembership>();
  const [sort, setSort] = useState<Sort>({ field: 'groupName', direction: 'asc' });
  const [groups, updateGroups] = useAutoLoadedData<CurrentUserGroupMembership[]>(fetchGroups, [signal], {
    onError: (state) => reportError('Error loading group list', state.error),
  });

  // Helpers
  const refresh = async () => {
    setCreatingNewGroup(false);
    setDeletingGroup(undefined);
    setLeavingGroup(undefined);
    updateGroups(fetchGroups);
  };

  const doDelete = (groupName: string) =>
    updateGroups(async () => {
      setDeletingGroup(undefined);
      try {
        await Groups().group(groupName).delete();
      } catch (e) {
        // this is in a separate try/catch on its own, so that a failure in deleting won't error the entire page
        reportError('Error deleting group.', e);
      }
      const updatedGroups = await fetchGroups();
      return updatedGroups;
    });

  useEffect(() => {
    StateHistory.update({ filter });
  }, [filter]);

  // Render
  const filteredGroups = _.filter(({ groupName }) => textMatch(filter, groupName), groups.state || []);
  const orderedGroups = _.orderBy([sort.field], [sort.direction], filteredGroups);
  const groupCards = _.map(
    (group) => (
      <GroupCard
        group={group}
        key={group.groupName}
        onDelete={() => setDeletingGroup(group)}
        onLeave={() => setLeavingGroup(group)}
      />
    ),
    orderedGroups
  );

  return (
    <FooterWrapper>
      <TopBar title='Groups'>
        <DelayedSearchInput
          aria-label='Search groups'
          style={{ marginLeft: '2rem', width: 500 }}
          placeholder='SEARCH GROUPS'
          onChange={setFilter}
          value={filter}
        />
      </TopBar>
      <PageBox role='main' style={{ flexGrow: 1 }} variant={PageBoxVariants.light}>
        <div style={Style.cardList.toolbarContainer}>
          <h2 style={{ ...Style.elements.sectionHeader, margin: 0, textTransform: 'uppercase' }}>Group Management</h2>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <NewGroupCard onClick={() => setCreatingNewGroup(true)} />
          {cond(
            [groups.status === 'Ready' && _.isEmpty(groups.state), () => <NoGroupsMessage />],
            [
              groups.status === 'Ready' && _.isEmpty(filteredGroups),
              () => <div style={{ fontStyle: 'italic', marginTop: '1rem' }}>No matching groups</div>,
            ],
            () => (
              <div role='table' aria-label='groups list'>
                <GroupCardHeaders sort={sort} onSort={setSort} />
                <div style={{ flexGrow: 1, marginTop: '1rem', display: 'grid', rowGap: '0.5rem' }}>{groupCards}</div>
              </div>
            )
          )}
          {groups.status === 'Loading' && <SpinnerOverlay />}
        </div>
        {creatingNewGroup && (
          <NewGroupModal
            existingGroups={_.map('groupName', groups.state || [])}
            onDismiss={() => setCreatingNewGroup(false)}
            onSuccess={refresh}
          />
        )}
        {deletingGroup && (
          <DeleteConfirmationModal
            objectType='group'
            objectName={deletingGroup.groupName}
            onConfirm={() => doDelete(deletingGroup.groupName)}
            onDismiss={() => setDeletingGroup(undefined)}
          />
        )}
        {leavingGroup && (
          <LeaveResourceModal
            samResourceId={leavingGroup.groupName}
            samResourceType='managed-group'
            displayName='group'
            onDismiss={() => setLeavingGroup(undefined)}
            onSuccess={refresh}
          />
        )}
      </PageBox>
    </FooterWrapper>
  );
};
