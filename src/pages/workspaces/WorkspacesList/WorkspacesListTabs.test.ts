import { asMockedFn } from '@terra-ui-packages/test-utils';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { h } from 'react-hyperscript-helpers';
import { updateSearch, useRoute } from 'src/libs/nav';
import { CategorizedWorkspaces } from 'src/pages/workspaces/WorkspacesList/CategorizedWorkspaces';
import { WorkspacesListTabs } from 'src/pages/workspaces/WorkspacesList/WorkspacesListTabs';
import { defaultAzureWorkspace, defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';

// the FlexTable uses react-virtualized's AutoSizer to size the table.
// This makes the virtualized window large enough for all rows/columns to be rendered in tests.
jest.mock('react-virtualized', () => ({
  ...jest.requireActual('react-virtualized'),
  AutoSizer: ({ children }) => children({ width: 1000, height: 1000 }),
}));

type NavExports = typeof import('src/libs/nav');

jest.mock(
  'src/libs/nav',
  (): NavExports => ({
    ...jest.requireActual<NavExports>('src/libs/nav'),
    getLink: jest.fn(),
    useRoute: jest.fn().mockImplementation(() => ({ params: {}, query: {} })),
    updateSearch: jest.fn(),
  })
);

describe('The WorkspacesListTabs component', () => {
  it('should render the workspaces of the current tab', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultAzureWorkspace],
      public: [defaultGoogleWorkspace],
      newAndInteresting: [],
      featured: [],
    };
    asMockedFn(useRoute).mockImplementation(() => ({ params: {}, query: { tab: 'public' } }));

    // Act
    render(
      h(WorkspacesListTabs, {
        workspaces,
        refreshWorkspaces: jest.fn(),
        loadingWorkspaces: false,
        loadingSubmissionStats: false,
      })
    );

    // Assert
    const renderedGoogleWS = screen.queryAllByText(defaultGoogleWorkspace.workspace.name);
    expect(renderedGoogleWS).toHaveLength(1);
    const renderedAzureWS = screen.queryAllByText(defaultAzureWorkspace.workspace.name);
    expect(renderedAzureWS).toHaveLength(0);
  });

  it('should default to the myWorkspaces tab', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultAzureWorkspace],
      public: [defaultGoogleWorkspace],
      newAndInteresting: [],
      featured: [],
    };
    asMockedFn(useRoute).mockImplementation(() => ({ params: {}, query: {} }));

    // Act
    render(
      h(WorkspacesListTabs, {
        workspaces,
        refreshWorkspaces: jest.fn(),
        loadingWorkspaces: false,
        loadingSubmissionStats: false,
      })
    );

    // Assert
    const renderedGoogleWS = screen.queryAllByText(defaultGoogleWorkspace.workspace.name);
    expect(renderedGoogleWS).toHaveLength(0);
    const renderedAzureWS = screen.queryAllByText(defaultAzureWorkspace.workspace.name);
    expect(renderedAzureWS).toHaveLength(1);
  });

  it('refreshes workspaces when the current tab is clicked', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultAzureWorkspace],
      public: [defaultGoogleWorkspace],
      newAndInteresting: [],
      featured: [],
    };
    asMockedFn(useRoute).mockImplementation(() => ({ params: {}, query: {} }));
    const refreshWorkspaces = jest.fn();

    // Act
    render(
      h(WorkspacesListTabs, {
        workspaces,
        refreshWorkspaces,
        loadingWorkspaces: false,
        loadingSubmissionStats: false,
      })
    );

    // Assert
    const tabs = screen.getAllByRole('tab');
    const myWorkspacesTab = tabs[0];
    act(() => fireEvent.click(myWorkspacesTab));
    expect(refreshWorkspaces).toHaveBeenCalled();
  });

  it('switches to an intactive tab when clicked', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultAzureWorkspace],
      public: [defaultGoogleWorkspace],
      newAndInteresting: [],
      featured: [],
    };
    asMockedFn(updateSearch);

    // Act
    const refreshWorkspaces = jest.fn();
    render(
      h(WorkspacesListTabs, {
        workspaces,
        refreshWorkspaces,
        loadingWorkspaces: false,
        loadingSubmissionStats: false,
      })
    );

    // Assert
    const tabs = screen.getAllByRole('tab');
    const publicTab = tabs[3];
    act(() => fireEvent.click(publicTab));
    expect(updateSearch).toHaveBeenCalledWith({ tab: 'public' });
  });
});
