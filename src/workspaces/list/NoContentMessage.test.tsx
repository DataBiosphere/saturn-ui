import { screen } from '@testing-library/react';
import React from 'react';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import { defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';
import { CategorizedWorkspaces } from 'src/workspaces/list/CategorizedWorkspaces';
import { NoContentMessage } from 'src/workspaces/list/NoContentMessage';
import { WorkspaceFilterValues } from 'src/workspaces/list/WorkspaceFilters';

describe('NoContentMessage', () => {
  it('displays loading message if workspaces are loading', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [],
      featured: [],
      public: [],
    };
    const filters: WorkspaceFilterValues = {
      keywordFilter: '',
      accessLevels: [],
      tab: 'myWorkspaces',
      tags: [],
    };
    const props = { loadingWorkspaces: true, workspaces, filters };

    // Act
    render(<NoContentMessage {...props} />);

    // Assert
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays no workspaces message if there are no workspaces and filters tab is myWorkspaces', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [],
      featured: [],
      public: [],
    };
    const filters: WorkspaceFilterValues = {
      keywordFilter: '',
      accessLevels: [],
      tab: 'myWorkspaces',
      tags: [],
    };
    const props = { loadingWorkspaces: false, workspaces, filters };

    // Act
    render(<NoContentMessage {...props} />);

    // Assert
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Create a New Workspace');
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('displays no matching workspaces message if filters tab is not myWorkspaces', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [],
      featured: [],
      public: [],
    };
    const filters: WorkspaceFilterValues = {
      keywordFilter: '',
      accessLevels: [],
      tab: 'featured',
      tags: [],
    };
    const props = { loadingWorkspaces: false, workspaces, filters };

    // Act
    render(<NoContentMessage {...props} />);

    // Assert
    expect(screen.getByText('No matching workspaces')).toBeInTheDocument();
  });

  it('displays no matching workspaces message if myWorkspaces is not empty', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultGoogleWorkspace],
      featured: [],
      public: [],
    };
    const filters: WorkspaceFilterValues = {
      keywordFilter: 'nothingMatchesThis',
      accessLevels: [],
      tab: 'myWorkspaces',
      tags: [],
    };
    const props = { loadingWorkspaces: false, workspaces, filters };

    // Act
    render(<NoContentMessage {...props} />);

    // Assert
    expect(screen.getByText('No matching workspaces')).toBeInTheDocument();
  });
});
