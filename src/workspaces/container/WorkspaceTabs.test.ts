import { screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { ReactNode } from 'react';
import { h } from 'react-hyperscript-helpers';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import { defaultAzureWorkspace, defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';
import { WorkspaceTabs } from 'src/workspaces/container/WorkspaceTabs';
import { cloudProviderTypes, WorkspaceWrapper as Workspace } from 'src/workspaces/utils';
// Mocking for Nav.getLink
jest.mock('src/libs/nav', () => ({
  ...jest.requireActual('src/libs/nav'),
  getLink: jest.fn(() => '/'),
}));
// Mocking feature preview setup
jest.mock('src/libs/feature-previews', () => ({
  ...jest.requireActual('src/libs/feature-previews'),
  isFeaturePreviewEnabled: jest.fn(),
}));

type WorkspaceMenuExports = typeof import('src/workspaces/common/WorkspaceMenu');

const mockWorkspaceMenu = jest.fn();
jest.mock(
  'src/workspaces/common/WorkspaceMenu',
  () =>
    function (props) {
      mockWorkspaceMenu(props);
      return null;
    }
);

jest.mock<WorkspaceMenuExports>('src/workspaces/common/WorkspaceMenu', () => ({
  ...jest.requireActual('src/workspaces/common/WorkspaceMenu'),
  WorkspaceMenu: (props) => {
    mockWorkspaceMenu(props);
    return null as ReactNode;
  },
}));

describe('WorkspaceTabs', () => {
  it('renders subset of tabs if workspace is unknown, with no accessibility issues', async () => {
    // Arrange
    const props = {
      name: 'test',
      namespace: 'test',
      workspace: undefined,
      setDeletingWorkspace: () => {},
      setCloningWorkspace: () => {},
      setSharingWorkspace: () => {},
      setShowLockWorkspaceModal: () => {},
      setLeavingWorkspace: () => {},
      refresh: () => {},
      setShowSettingsModal: () => {},
    };

    // Act
    const { container } = render(h(WorkspaceTabs, props));

    // Assert
    const tabs = screen.getAllByRole('menuitem');
    expect(tabs.length).toBe(3);
    expect(within(tabs[0]).getByText('dashboard')).not.toBeNull();
    expect(within(tabs[1]).getByText('data')).not.toBeNull();
    expect(within(tabs[2]).getByText('analyses')).not.toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders subset of tabs for Azure workspace, with no accessibility issues', async () => {
    // Arrange
    const props = {
      name: defaultAzureWorkspace.workspace.name,
      namespace: defaultAzureWorkspace.workspace.namespace,
      workspace: defaultAzureWorkspace,
      setDeletingWorkspace: () => {},
      setCloningWorkspace: () => {},
      setSharingWorkspace: () => {},
      setShowLockWorkspaceModal: () => {},
      setLeavingWorkspace: () => {},
      refresh: () => {},
      setShowSettingsModal: () => {},
    };
    // Act
    const { container } = render(h(WorkspaceTabs, props));
    // Assert
    const tabs = screen.getAllByRole('menuitem');
    expect(tabs.length).toBe(4);
    expect(within(tabs[0]).getByText('dashboard')).not.toBeNull();
    expect(within(tabs[1]).getByText('data')).not.toBeNull();
    expect(within(tabs[2]).getByText('analyses')).not.toBeNull();
    expect(within(tabs[3]).getByText('workflows')).not.toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders subset of tabs for Gcp workspace, with no accessibility issues', async () => {
    // Arrange
    const props = {
      name: defaultGoogleWorkspace.workspace.name,
      namespace: defaultGoogleWorkspace.workspace.namespace,
      workspace: defaultGoogleWorkspace,
      setDeletingWorkspace: () => {},
      setCloningWorkspace: () => {},
      setSharingWorkspace: () => {},
      setShowLockWorkspaceModal: () => {},
      setLeavingWorkspace: () => {},
      refresh: () => {},
      setShowSettingsModal: () => {},
    };
    // Act
    const { container } = render(h(WorkspaceTabs, props));
    // Assert
    const tabs = screen.getAllByRole('menuitem');
    expect(tabs.length).toBe(5);
    expect(within(tabs[0]).getByText('dashboard')).not.toBeNull();
    expect(within(tabs[1]).getByText('data')).not.toBeNull();
    expect(within(tabs[2]).getByText('analyses')).not.toBeNull();
    expect(within(tabs[3]).getByText('workflows')).not.toBeNull();
    expect(within(tabs[4]).getByText('submission history')).not.toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes workspaceInfo to the workspaceMenu (OWNER, canShare)', () => {
    // Arrange
    const props = {
      name: defaultGoogleWorkspace.workspace.name,
      namespace: defaultGoogleWorkspace.workspace.namespace,
      workspace: defaultGoogleWorkspace,
      setDeletingWorkspace: () => {},
      setCloningWorkspace: () => {},
      setSharingWorkspace: () => {},
      setShowLockWorkspaceModal: () => {},
      setLeavingWorkspace: () => {},
      refresh: () => {},
      setShowSettingsModal: () => {},
    };

    // Act
    render(h(WorkspaceTabs, props));

    // Assert
    expect(mockWorkspaceMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceInfo: {
          canShare: true,
          isLocked: false,
          isOwner: true,
          workspaceLoaded: true,
          cloudProvider: cloudProviderTypes.GCP,
          namespace: props.namespace,
          name: props.name,
        },
      })
    );
  });

  it('passes default workspaceInfo to the workspaceMenu if workspace is not loaded', () => {
    // Arrange
    const props = {
      name: 'test',
      namespace: 'test',
      workspace: undefined,
      setDeletingWorkspace: () => {},
      setCloningWorkspace: () => {},
      setSharingWorkspace: () => {},
      setShowLockWorkspaceModal: () => {},
      setLeavingWorkspace: () => {},
      refresh: () => {},
      setShowSettingsModal: () => {},
    };

    // Act
    render(h(WorkspaceTabs, props));
    // Assert
    expect(mockWorkspaceMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceInfo: {
          canShare: false,
          isLocked: false,
          isOwner: false,
          workspaceLoaded: false,
          cloudProvider: undefined,
          namespace: props.namespace,
          name: props.name,
        },
      })
    );
  });

  it('hides all tabs except Dashboard if the workspace is in a state of Deleting', () => {
    const workspace: Workspace = {
      ...defaultGoogleWorkspace,
      workspace: { ...defaultGoogleWorkspace.workspace, state: 'Deleting' },
    };
    // Arrange
    const props = {
      name: workspace.workspace.name,
      namespace: workspace.workspace.namespace,
      workspace,
      setDeletingWorkspace: () => {},
      setCloningWorkspace: () => {},
      setSharingWorkspace: () => {},
      setShowLockWorkspaceModal: () => {},
      setLeavingWorkspace: () => {},
      refresh: () => {},
      setShowSettingsModal: () => {},
    };
    // Act
    render(h(WorkspaceTabs, props));
    // Assert
    const tabs = screen.getAllByRole('menuitem');
    expect(tabs.length).toBe(1);
    expect(within(tabs[0]).getByText('dashboard')).not.toBeNull();
  });

  it('hides all tabs except Dashboard if the workspace is in a state of Delete Failed', () => {
    const workspace: Workspace = {
      ...defaultGoogleWorkspace,
      workspace: { ...defaultGoogleWorkspace.workspace, state: 'DeleteFailed' },
    };

    // Arrange
    const props = {
      name: workspace.workspace.name,
      namespace: workspace.workspace.namespace,
      workspace,
      setDeletingWorkspace: () => {},
      setCloningWorkspace: () => {},
      setSharingWorkspace: () => {},
      setShowLockWorkspaceModal: () => {},
      setLeavingWorkspace: () => {},
      refresh: () => {},
      setShowSettingsModal: () => {},
    };
    // Act
    render(h(WorkspaceTabs, props));
    // Assert
    const tabs = screen.getAllByRole('menuitem');
    expect(tabs.length).toBe(1);
    expect(within(tabs[0]).getByText('dashboard')).not.toBeNull();
  });
});
