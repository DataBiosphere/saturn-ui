import { DeepPartial } from '@terra-ui-packages/core-utils';
import { act, fireEvent, screen } from '@testing-library/react';
import _ from 'lodash/fp';
import { h } from 'react-hyperscript-helpers';
import { Ajax } from 'src/libs/ajax';
import { getTerraUser } from 'src/libs/state';
import { GoogleWorkspace } from 'src/libs/workspace-utils';
import { AccessEntry, RawWorkspaceAcl } from 'src/pages/workspaces/workspace/WorkspaceAcl';
import { asMockedFn, renderWithAppContexts as render } from 'src/testing/test-utils';
import { defaultAzureWorkspace, protectedAzureWorkspace } from 'src/testing/workspace-fixtures';
import ShareWorkspaceModal from 'src/workspaces/ShareWorkspaceModal/ShareWorkspaceModal';

jest.mock('src/libs/state', () => ({
  ...jest.requireActual('src/libs/state'),
  getTerraUser: jest.fn(),
}));

jest.mock('src/libs/ajax');

type AjaxExports = typeof import('src/libs/ajax');
type AjaxContract = ReturnType<AjaxExports['Ajax']>;

describe('the share workspace modal', () => {
  beforeEach(() => {
    asMockedFn(getTerraUser).mockReturnValue({
      email: 'owner@test.com',
    });
  });

  const workspace: GoogleWorkspace = {
    accessLevel: 'PROJECT_OWNER',
    canShare: true,
    canCompute: true,
    workspace: {
      namespace: 'namespace',
      name: 'name',
      workspaceId: 'test-ws-id',
      cloudPlatform: 'Gcp',
      authorizationDomain: [],
      createdDate: '',
      createdBy: '',
      googleProject: 'test-project',
      bucketName: 'test-bucket',
      lastModified: '',
    },
  };

  const mockAjax = (
    acl: RawWorkspaceAcl,
    shareLog: string[],
    groups: string[],
    updateAcl?: (aclUpdates: Partial<AccessEntry>[]) => Promise<any>
  ) => {
    const updateFn: (aclUpdates: Partial<AccessEntry>[]) => Promise<any> =
      updateAcl ?? jest.fn(() => Promise.resolve({ success: true }));
    const mockWorkspaceAjax: DeepPartial<ReturnType<AjaxContract['Workspaces']['workspace']>> = {
      getAcl: jest.fn(() => Promise.resolve({ acl })),
      updateAcl: updateFn,
    };

    const workspaceAjax = jest.fn().mockReturnValue(mockWorkspaceAjax);
    const mockAjax: DeepPartial<AjaxContract> = {
      Workspaces: {
        workspace: workspaceAjax,
        getShareLog: jest.fn(() => Promise.resolve(shareLog)),
      },
      Groups: { list: jest.fn(() => Promise.resolve(groups)) },
      Metrics: { captureEvent: jest.fn(() => Promise.resolve({ success: true })) },
    };
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract);
  };

  it('shows a list of all users with access', async () => {
    const acl: RawWorkspaceAcl = {
      'user1@test.com': {
        pending: false,
        canShare: true,
        canCompute: true,
        accessLevel: 'OWNER',
      },
      'user2@test.com': {
        pending: false,
        canShare: true,
        canCompute: true,
        accessLevel: 'READER',
      },
    };
    mockAjax(acl, [], []);
    render(
      h(ShareWorkspaceModal, {
        onDismiss: jest.fn(),
        workspace,
      })
    );
    const email1 = await screen.findByText('user1@test.com');
    expect(email1).not.toBeNull();
    const email2 = await screen.findByText('user2@test.com');
    expect(email2).not.toBeNull();
  });

  it('saving updates only updates changed items ', async () => {
    const acl: RawWorkspaceAcl = {
      'user1@test.com': {
        pending: false,
        canShare: true,
        canCompute: true,
        accessLevel: 'OWNER',
      },
      'user2@test.com': {
        pending: false,
        canShare: true,
        canCompute: true,
        accessLevel: 'READER',
      },
    };

    const updateAcl = jest.fn((aclUpdates: Partial<AccessEntry>[]) => {
      expect(aclUpdates).toHaveLength(2);

      const user1 = _.find({ email: 'user1@test.com' }, aclUpdates);
      expect(user1?.accessLevel).toEqual('OWNER');

      const user2 = _.find({ email: 'user2@test.com' }, aclUpdates);
      expect(user2?.accessLevel).toEqual('WRITER');
      return Promise.resolve({ success: true });
    });
    mockAjax(acl, [], [], updateAcl);

    render(
      h(ShareWorkspaceModal, {
        onDismiss: () => {},
        workspace,
      })
    );
    const permissionSelect = await screen.findByLabelText(`permissions for ${'user2@test.com'}`);
    expect(permissionSelect).not.toBeNull();
    act(() => {
      fireEvent.click(permissionSelect);
      fireEvent.keyDown(permissionSelect, { key: 'ArrowDown', code: 'ArrowDown' });
    });

    const permissionSelection = await screen.findByText('Writer');
    expect(permissionSelection).not.toBeNull();
    act(() => {
      fireEvent.click(permissionSelection);
    });
    const saveButton = await screen.findByText('Save');
    expect(saveButton).not.toBeNull();
    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(updateAcl).toHaveBeenCalledTimes(1);
  });

  it('displays the error if saving updates fails', async () => {
    const acl: RawWorkspaceAcl = {
      'user1@test.com': {
        pending: false,
        canShare: true,
        canCompute: true,
        accessLevel: 'OWNER',
      },
      'user2@test.com': {
        pending: false,
        canShare: true,
        canCompute: true,
        accessLevel: 'READER',
      },
    };

    const expectedErrorText = 'This is the expected error';
    const updateAcl = jest.fn(() => {
      const err = { text: () => Promise.resolve(expectedErrorText), message: expectedErrorText };
      throw err;
    });
    mockAjax(acl, [], [], updateAcl);
    render(
      h(ShareWorkspaceModal, {
        onDismiss: () => {},
        workspace,
      })
    );

    const permissionSelect = await screen.findByLabelText(`permissions for ${'user2@test.com'}`);
    expect(permissionSelect).not.toBeNull();
    act(() => {
      fireEvent.click(permissionSelect);
      fireEvent.keyDown(permissionSelect, { key: 'ArrowDown', code: 'ArrowDown' });
    });

    const permissionSelection = await screen.findByText('Writer');
    expect(permissionSelection).not.toBeNull();
    act(() => {
      fireEvent.click(permissionSelection);
    });
    const saveButton = await screen.findByText('Save');
    expect(saveButton).not.toBeNull();
    await act(async () => {
      fireEvent.click(saveButton);
    });

    const errorMessage = await screen.findByText(expectedErrorText);
    expect(errorMessage).not.toBeNull();
  });

  describe('the warning and policy section for sharing protected azure data', () => {
    it('shows a warning when sharing a workspace with protected data', async () => {
      mockAjax({}, [], [], jest.fn());
      await act(async () => {
        render(
          h(ShareWorkspaceModal, {
            onDismiss: jest.fn(),
            workspace: protectedAzureWorkspace,
          })
        );
      });
      expect(screen.queryByText(/Do not share Unclassified Confidential Information/i)).toBeInTheDocument();
    });

    it('does not show a warning for azure workspaces without a protected data policy', async () => {
      mockAjax({}, [], [], jest.fn());
      await act(async () => {
        render(
          h(ShareWorkspaceModal, {
            onDismiss: jest.fn(),
            workspace: {
              ...defaultAzureWorkspace,
              policies: [
                {
                  additionalData: [],
                  name: 'not-protected-data',
                  namespace: 'terra',
                },
                {
                  additionalData: [],
                  name: 'protected-data',
                  namespace: 'something-besides-terra',
                },
              ],
            },
          })
        );
      });
      expect(screen.queryByText(/Do not share Unclassified Confidential Information/i)).not.toBeInTheDocument();
    });

    it('does not get workspace detail or display a warning for a gcp workspace', async () => {
      mockAjax({}, [], [], jest.fn());
      await act(async () => {
        render(
          h(ShareWorkspaceModal, {
            onDismiss: jest.fn(),
            workspace,
          })
        );
      });
      expect(screen.queryByText(/Do not share Unclassified Confidential Information/i)).not.toBeInTheDocument();
    });

    it('shows a policy section for workspaces that have them', async () => {
      mockAjax({}, [], [], jest.fn());
      await act(async () => {
        render(
          h(ShareWorkspaceModal, {
            onDismiss: jest.fn(),
            workspace: protectedAzureWorkspace,
          })
        );
      });
      screen.getByText('Policies');
    });

    it('does not show a policy section for workspaces without them', async () => {
      mockAjax({}, [], [], jest.fn());
      await act(async () => {
        render(
          h(ShareWorkspaceModal, {
            onDismiss: jest.fn(),
            workspace: defaultAzureWorkspace,
          })
        );
      });
      expect(defaultAzureWorkspace.policies).toEqual([]);
      expect(screen.queryByText('Policies')).toBeNull();
    });
  });
});
