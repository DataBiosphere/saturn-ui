import _ from 'lodash/fp';
import React, { ReactNode, useState } from 'react';
import { billingRoles } from 'src/billing/utils';
import { BillingRole } from 'src/billing-core/models';
import { DeleteMemberModal } from 'src/groups/Members/DeleteMemberModal';
import { EditMemberModal } from 'src/groups/Members/EditMemberModal';
import { Member, MemberTable } from 'src/groups/Members/MemberTable';
import { NewMemberModal } from 'src/groups/Members/NewMemberModal';
import { Billing } from 'src/libs/ajax/billing/Billing';

interface MembersProps {
  billingProjectName: string;
  isOwner: boolean;
  projectMembers: Member[];
  memberAdded: () => void;
  memberEdited: () => void;
  deleteMember: (arg: Member) => void;
}

export const Members = (props: MembersProps): ReactNode => {
  const { billingProjectName, isOwner, projectMembers, memberEdited, deleteMember, memberAdded } = props;
  const [addingMember, setAddingMember] = useState(false);
  const [editingMember, setEditingMember] = useState<Member>();
  const [deletingMember, setDeletingMember] = useState<Member>();

  const projectHasMultipleOwners =
    _.filter(({ roles }) => _.includes(billingRoles.owner, roles), projectMembers).length > 1;

  return (
    <>
      <MemberTable
        adminLabel={billingRoles.owner}
        memberLabel={billingRoles.user}
        members={projectMembers}
        adminCanEdit={projectHasMultipleOwners && isOwner}
        onEdit={setEditingMember}
        onDelete={setDeletingMember}
        onAddMember={() => setAddingMember(true)}
        tableAriaLabel={`users in billing project ${billingProjectName}`}
        isOwner={isOwner}
      />
      {addingMember && (
        <NewMemberModal
          adminLabel={billingRoles.owner}
          memberLabel={billingRoles.user}
          title='Add user to Billing Project'
          footer={[
            'Warning: Adding any user to this project will mean they can incur costs to the billing associated with this project.',
          ]}
          addFunction={(roles: string[], email: string) =>
            Billing().addProjectUser(billingProjectName, roles as BillingRole[], email)
          }
          onDismiss={() => setAddingMember(false)}
          onSuccess={() => {
            setAddingMember(false);
            memberAdded();
          }}
        />
      )}
      {!!editingMember && (
        <EditMemberModal
          adminLabel={billingRoles.owner}
          memberLabel={billingRoles.user}
          member={editingMember}
          saveFunction={(email: string, roles: string[], newRoles: string[]) =>
            Billing().changeUserRoles(billingProjectName, email, roles as BillingRole[], newRoles as BillingRole[])
          }
          onDismiss={() => setEditingMember(undefined)}
          onSuccess={() => {
            setEditingMember(undefined);
            memberEdited();
          }}
        />
      )}
      {!!deletingMember && (
        <DeleteMemberModal
          memberEmail={deletingMember.email}
          onDismiss={() => setDeletingMember(undefined)}
          onSubmit={() => {
            deleteMember(deletingMember);
            setDeletingMember(undefined);
          }}
        />
      )}
    </>
  );
};
