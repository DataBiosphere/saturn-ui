import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import React from 'react';
import { GroupContract, Groups, GroupsContract } from 'src/libs/ajax/Groups';
import { SamResources, SamResourcesContract } from 'src/libs/ajax/SamResources';
import { asMockedFn, MockedFn, partial, renderWithAppContexts as render } from 'src/testing/test-utils';
import { DeleteWorkspaceModal } from 'src/workspaces/DeleteWorkspaceModal/DeleteWorkspaceModal';
import { RequestAccessModal } from 'src/workspaces/RequestAccessModal/RequestAccessModal';
import { azureControlledAccessRequestMessage, AzureWorkspace, GoogleWorkspace } from 'src/workspaces/utils';

type DeleteWorkspaceModalExports = typeof import('src/workspaces/DeleteWorkspaceModal/DeleteWorkspaceModal');
jest.mock(
  'src/workspaces/DeleteWorkspaceModal/DeleteWorkspaceModal',
  () =>
    ({
      ...jest.requireActual('src/workspaces/DeleteWorkspaceModal/DeleteWorkspaceModal'),
      DeleteWorkspaceModal: jest.fn(),
    } as DeleteWorkspaceModalExports)
);
jest.mock('src/libs/ajax/Groups');
jest.mock('src/libs/ajax/SamResources');

const azureWorkspace: AzureWorkspace = {
  accessLevel: 'PROJECT_OWNER',
  canShare: true,
  canCompute: true,
  azureContext: {
    managedResourceGroupId: 'mrg-id',
    tenantId: 'tenant-id',
    subscriptionId: 'sub-id,',
  },
  policies: [
    {
      namespace: 'terra',
      name: 'group-constraint',
      additionalData: [{ group: 'foo' }],
    },
  ],
  workspace: {
    namespace: 'namespace',
    name: 'name',
    workspaceId: 'test-ws-id',
    cloudPlatform: 'Azure',
    authorizationDomain: [
      {
        membersGroupName: 'foo',
      },
    ],
    createdDate: '',
    createdBy: '',
    lastModified: '',
  },
};

const googleWorkspace: GoogleWorkspace = {
  accessLevel: 'PROJECT_OWNER',
  canShare: true,
  canCompute: true,
  workspace: {
    namespace: 'namespace',
    name: 'name',
    workspaceId: 'test-ws-id',
    cloudPlatform: 'Gcp',
    authorizationDomain: [
      { membersGroupName: 'group-1' },
      { membersGroupName: 'group-2' },
      { membersGroupName: 'group-3' },
    ],
    createdDate: '',
    createdBy: '',
    billingAccount: 'billingAccounts/123456-ABCDEF-ABCDEF',
    googleProject: 'test-project',
    bucketName: 'test-bucket',
    lastModified: '',
  },
  policies: [],
};

describe('RequestAccessModal', () => {
  const authorizationDomainMessage =
    'You cannot access this workspace because it is protected by an Authorization Domain.';

  it('renders a message for Azure workspaces with no accessibility violations', async () => {
    // Arrange
    const props = { onDismiss: jest.fn(), workspace: azureWorkspace, refreshWorkspaces: jest.fn() };
    // Act
    await act(async () => {
      const { container } = render(<RequestAccessModal {...props} />);
      expect(await axe(container)).toHaveNoViolations();
    });
    // Assert
    expect(screen.queryByText(new RegExp(authorizationDomainMessage))).toBeNull();
    expect(screen.queryByText(azureControlledAccessRequestMessage)).not.toBeNull();
  });

  it('for an Azure workspace, it calls the onDismiss callback when closed', async () => {
    // Arrange
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    const props = { onDismiss, workspace: azureWorkspace, refreshWorkspaces: jest.fn() };
    // Act
    await act(async () => {
      render(<RequestAccessModal {...props} />);
    });
    const okButton = await screen.findByText('OK');
    await user.click(okButton);

    // Assert
    expect(onDismiss).toHaveBeenCalled();
  });

  it('renders a message for GCP workspaces with no accessibility violations', async () => {
    // Arrange
    const canDelete: MockedFn<SamResourcesContract['canDelete']> = jest.fn();
    const list: MockedFn<GroupsContract['list']> = jest.fn();

    asMockedFn(Groups).mockReturnValue(
      partial<GroupsContract>({
        list: list.mockResolvedValue([]),
      })
    );
    asMockedFn(SamResources).mockReturnValue(
      partial<SamResourcesContract>({
        canDelete: canDelete.mockResolvedValue(false),
      })
    );

    const props = { onDismiss: jest.fn(), workspace: googleWorkspace, refreshWorkspaces: jest.fn() };
    // Act
    await act(async () => {
      const { container } = render(<RequestAccessModal {...props} />);
      expect(await axe(container)).toHaveNoViolations();
    });
    // Assert
    expect(screen.queryByText(azureControlledAccessRequestMessage)).toBeNull();
    expect(screen.queryByText(new RegExp(authorizationDomainMessage))).not.toBeNull();
    // Not an owner, should not be able to delete the workspace.
    expect(screen.queryByText('Delete Workspace')).toBeNull();
  });

  it('for a GCP workspace, it calls the onDismiss callback when closed', async () => {
    // Arrange
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    const props = { onDismiss, workspace: googleWorkspace, refreshWorkspaces: jest.fn() };

    const canDelete: MockedFn<SamResourcesContract['canDelete']> = jest.fn();
    const list: MockedFn<GroupsContract['list']> = jest.fn();

    asMockedFn(Groups).mockReturnValue(
      partial<GroupsContract>({
        list: list.mockResolvedValue([]),
      })
    );
    asMockedFn(SamResources).mockReturnValue(
      partial<SamResourcesContract>({
        canDelete: canDelete.mockResolvedValue(false),
      })
    );

    // Act
    await act(async () => {
      render(<RequestAccessModal {...props} />);
    });
    const okButton = await screen.findByText('Return to List');
    await user.click(okButton);

    // Assert
    expect(onDismiss).toHaveBeenCalled();
  });

  it('for a GCP workspace, it renders a request access button per group', async () => {
    // Arrange
    const user = userEvent.setup();

    const canDelete: MockedFn<SamResourcesContract['canDelete']> = jest.fn();
    const list: MockedFn<GroupsContract['list']> = jest.fn();
    const group: MockedFn<GroupsContract['group']> = jest.fn();
    const requestAccess: MockedFn<GroupContract['requestAccess']> = jest.fn();

    asMockedFn(Groups).mockReturnValue(
      partial<GroupsContract>({
        list: list.mockResolvedValue([
          // User is already a member of this group
          {
            groupName: 'group-2',
            groupEmail: 'preview-group@test.firecloud.org',
            role: 'member',
          },
        ]),
        group: group.mockReturnValue(partial<GroupContract>({ requestAccess })),
      })
    );
    asMockedFn(SamResources).mockReturnValue(
      partial<SamResourcesContract>({
        // Return true (workspace owner) for canDelete.
        canDelete: canDelete.mockResolvedValue(false),
      })
    );

    const props = { onDismiss: jest.fn(), workspace: googleWorkspace, refreshWorkspaces: jest.fn() };

    // Act
    await act(async () => {
      render(<RequestAccessModal {...props} />);
    });
    const group3Button = await screen.findByLabelText('Request access to group-3');
    await user.click(group3Button);

    // Assert
    expect(group).toHaveBeenCalledWith('group-3');
    expect(requestAccess).toHaveBeenCalled();
    const group3ButtonAfterRequest = await screen.findByText('Request Sent');
    expect(group3ButtonAfterRequest.getAttribute('aria-label')).toBe('Request access to group-3');
    expect(group3ButtonAfterRequest.getAttribute('aria-disabled')).toBe('true');

    // check group-1 button is present
    expect(screen.queryByLabelText('Request access to group-1')).not.toBeNull();

    // group-2 button should not be present because the user is already in that group
    expect(screen.queryByLabelText('Request access to group-2')).toBeNull();
  });

  it('for a GCP workspace, allows owners to delete the workspace', async () => {
    // Arrange
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    const onRefresh = jest.fn();
    const props = { onDismiss, workspace: googleWorkspace, refreshWorkspaces: onRefresh };

    const canDelete: MockedFn<SamResourcesContract['canDelete']> = jest.fn();
    const list: MockedFn<GroupsContract['list']> = jest.fn();

    asMockedFn(Groups).mockReturnValue(
      partial<GroupsContract>({
        list: list.mockResolvedValue([]),
      })
    );
    asMockedFn(SamResources).mockReturnValue(
      partial<SamResourcesContract>({
        // Return true (workspace owner) for canDelete.
        canDelete: canDelete.mockResolvedValue(true),
      })
    );

    const mockModal = asMockedFn(DeleteWorkspaceModal);

    // Act
    await act(async () => {
      render(<RequestAccessModal {...props} />);
    });
    const deleteWorkspaceButton = await screen.findByText('Delete Workspace');
    await user.click(deleteWorkspaceButton);

    // Assert
    expect(mockModal).toHaveBeenCalledWith({ onDismiss, workspace: googleWorkspace, onSuccess: onRefresh }, {});
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
