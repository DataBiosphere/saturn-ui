import { act, fireEvent, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { h } from 'react-hyperscript-helpers';
import { Ajax } from 'src/libs/ajax';
import {
  AzureWorkspace,
  GoogleWorkspace,
  requestAccessMessage as azureRequestAccessMessage,
} from 'src/libs/workspace-utils';
import { RequestAccessModal } from 'src/pages/workspaces/workspace/RequestAccessModal';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

jest.mock('src/libs/ajax');

const azureWorkspace: AzureWorkspace = {
  accessLevel: 'PROJECT_OWNER',
  canShare: true,
  canCompute: true,
  azureContext: {
    managedResourceGroupId: 'mrg-id',
    tenantId: 'tenant-id',
    subscriptionId: 'sub-id,',
  },
  workspace: {
    namespace: 'namespace',
    name: 'name',
    workspaceId: 'test-ws-id',
    cloudPlatform: 'Azure',
    authorizationDomain: [
      {
        membersGroupName: 'group-1',
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
    googleProject: 'test-project',
    bucketName: 'test-bucket',
    lastModified: '',
  },
};

describe('RequestAccessModal', () => {
  const authorizationDomainMessage =
    'You cannot access this workspace because it is protected by an Authorization Domain.';

  it('renders a message for Azure workspaces with no accessibility violations', async () => {
    // Arrange
    const props = { onDismiss: jest.fn(), workspace: azureWorkspace };
    // Act
    await act(async () => {
      const { container } = render(h(RequestAccessModal, props));
      expect(await axe(container)).toHaveNoViolations();
    });
    // Assert
    expect(screen.queryByText(new RegExp(authorizationDomainMessage))).toBeNull();
    expect(screen.queryByText(azureRequestAccessMessage)).not.toBeNull();
  });

  it('for an Azure workspace, it calls the onDismiss callback when closed', async () => {
    // Arrange
    const onDismiss = jest.fn();
    const props = { onDismiss, workspace: azureWorkspace };
    // Act
    await act(async () => {
      render(h(RequestAccessModal, props));
    });
    const okButton = await screen.findByText('OK');
    await act(async () => {
      fireEvent.click(okButton);
    });
    // Assert
    expect(onDismiss).toHaveBeenCalled();
  });

  it('renders a message for GCP workspaces with no accessibility violations', async () => {
    // Arrange
    Ajax.mockImplementation(() => ({
      Groups: {
        list: jest.fn().mockReturnValue(Promise.resolve([])),
      },
    }));
    const props = { onDismiss: jest.fn(), workspace: googleWorkspace };
    // Act
    await act(async () => {
      const { container } = render(h(RequestAccessModal, props));
      expect(await axe(container)).toHaveNoViolations();
    });
    // Assert
    expect(screen.queryByText(azureRequestAccessMessage)).toBeNull();
    expect(screen.queryByText(new RegExp(authorizationDomainMessage))).not.toBeNull();
  });

  it('for a GCP workspace, it calls the onDismiss callback when closed', async () => {
    // Arrange
    const onDismiss = jest.fn();
    const props = { onDismiss, workspace: googleWorkspace };
    Ajax.mockImplementation(() => ({
      Groups: {
        list: jest.fn().mockReturnValue(Promise.resolve([])),
      },
    }));

    // Act
    await act(async () => {
      render(h(RequestAccessModal, props));
    });
    const okButton = await screen.findByText('OK');
    await act(async () => {
      fireEvent.click(okButton);
    });
    // Assert
    expect(onDismiss).toHaveBeenCalled();
  });

  it('for a GCP workspace, it renders a request access button per group', async () => {
    // Arrange
    const requestAccessMock = jest.fn();
    const groupMock = jest.fn().mockReturnValue({
      requestAccess: requestAccessMock,
    });
    const props = { onDismiss: jest.fn(), workspace: googleWorkspace };
    Ajax.mockImplementation(() => ({
      Groups: {
        list: jest.fn().mockReturnValue(
          Promise.resolve([
            // User is already a member of this group
            {
              groupName: 'group-2',
              groupEmail: 'preview-group@test.firecloud.org',
              role: 'member',
            },
          ])
        ),
        group: groupMock,
      } as Partial<AjaxContract['Groups']>,
    }));

    // Act
    await act(async () => {
      render(h(RequestAccessModal, props));
    });
    const group3Button = await screen.findByLabelText('Request access to group-3');
    await act(async () => {
      fireEvent.click(group3Button);
    });
    // Assert
    expect(groupMock).toHaveBeenCalledWith('group-3');
    expect(requestAccessMock).toHaveBeenCalled();
    const group3ButtonAfterRequest = await screen.findByText('Request Sent');
    expect(group3ButtonAfterRequest.getAttribute('aria-label')).toBe('Request access to group-3');
    expect(group3ButtonAfterRequest.getAttribute('aria-disabled')).toBe('true');

    // check group-1 button is present
    expect(screen.queryByLabelText('Request access to group-1')).not.toBeNull();

    // group-2 button should not be present because the user is already in that group
    expect(screen.queryByLabelText('Request access to group-2')).toBeNull();
  });
});
