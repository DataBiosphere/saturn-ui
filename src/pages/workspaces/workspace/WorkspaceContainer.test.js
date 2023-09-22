import { render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { h } from 'react-hyperscript-helpers';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import { WorkspaceContainer, WorkspaceTabs } from 'src/pages/workspaces/workspace/WorkspaceContainer';

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
// Mocking events

const mockWorkspaceMenu = jest.fn();
jest.mock(
  'src/pages/workspaces/workspace/WorkspaceMenu',
  () =>
    function (props) {
      mockWorkspaceMenu(props);
      return null;
    }
);

describe('WorkspaceTabs', () => {
  it('renders subset of tabs if workspace is unknown, with no accessibility issues', async () => {
    // Arrange
    const props = { workspace: undefined };
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
    const props = { workspace: { workspace: { cloudPlatform: 'Azure' } } };
    // Act
    const { container } = render(h(WorkspaceTabs, props));
    // Assert
    const tabs = screen.getAllByRole('menuitem');
    expect(tabs.length).toBe(4);
    expect(within(tabs[0]).getByText('dashboard')).not.toBeNull();
    expect(within(tabs[1]).getByText('data')).not.toBeNull();
    expect(within(tabs[2]).getByText('analyses')).not.toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders subset of tabs for Azure workspace with flag enabled, with no accessibility issues', async () => {
    // Enable config
    isFeaturePreviewEnabled.mockReturnValue(true);
    // Arrange
    const props = { workspace: { workspace: { cloudPlatform: 'Azure' } } };
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
    const props = { workspace: { workspace: { cloudPlatform: 'Gcp' } } };
    // Act
    const { container } = render(h(WorkspaceTabs, props));
    // Assert
    const tabs = screen.getAllByRole('menuitem');
    expect(tabs.length).toBe(5);
    expect(within(tabs[0]).getByText('dashboard')).not.toBeNull();
    expect(within(tabs[1]).getByText('data')).not.toBeNull();
    expect(within(tabs[2]).getByText('analyses')).not.toBeNull();
    expect(within(tabs[3]).getByText('workflows')).not.toBeNull();
    expect(within(tabs[4]).getByText('job history')).not.toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes workspaceInfo to the workspaceMenu (OWNER, canShare)', () => {
    // Arrange
    const props = {
      workspace: { canShare: true, accessLevel: 'OWNER', workspace: { cloudPlatform: 'Gcp', isLocked: false } },
    };
    // Act
    render(h(WorkspaceTabs, props));
    // Assert
    expect(mockWorkspaceMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceInfo: { canShare: true, isLocked: false, isOwner: true, workspaceLoaded: true },
      })
    );
  });

  it('passes default workspaceInfo to the workspaceMenu if workspace is not loaded', () => {
    // Arrange
    const props = {
      workspace: undefined,
    };
    // Act
    render(h(WorkspaceTabs, props));
    // Assert
    expect(mockWorkspaceMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceInfo: { canShare: undefined, isLocked: undefined, isOwner: undefined, workspaceLoaded: false },
      })
    );
  });
});

describe('WorkspaceContainer', () => {
  it('shows a warning for Azure workspaces', async () => {
    // Arrange
    const props = {
      namespace: 'mock-namespace',
      name: 'mock-name',
      workspace: { workspace: { cloudPlatform: 'Azure' } },
      analysesData: {},
      storageDetails: {},
    };
    // Act
    render(h(WorkspaceContainer, props));
    // Assert
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(/Do not store Unclassified Confidential Information in this platform/)).not.toBeNull();
  });

  it('shows a permissions loading spinner Gcp workspaces that have IAM propagation delays', async () => {
    // Arrange
    const props = {
      namespace: 'mock-namespace',
      name: 'mock-name',
      workspace: { workspaceInitialized: false, workspace: { cloudPlatform: 'Gcp' } },
      analysesData: {},
      storageDetails: {},
    };
    // Act
    render(h(WorkspaceContainer, props));
    // Assert
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(/Terra synchronizing permissions with Google/)).not.toBeNull();
  });

  it('shows no alerts for initialized Gcp workspaces', async () => {
    // Arrange
    const props = {
      namespace: 'mock-namespace',
      name: 'mock-name',
      workspace: { workspaceInitialized: true, workspace: { cloudPlatform: 'Gcp' } },
      analysesData: {},
      storageDetails: {},
    };
    // Act
    render(h(WorkspaceContainer, props));
    // Assert
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
