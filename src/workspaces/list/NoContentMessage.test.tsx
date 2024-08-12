import { screen } from '@testing-library/react';
import React from 'react';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import { defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';
import { CategorizedWorkspaces } from 'src/workspaces/list/CategorizedWorkspaces';
import { NoContentMessage } from 'src/workspaces/list/NoContentMessage';
import { WorkspaceFilterValues } from 'src/workspaces/list/WorkspaceFilters';

describe('NoContentMessage', () => {
  const defaultWorkspace: CategorizedWorkspaces = {
    myWorkspaces: [defaultGoogleWorkspace],
    newAndInteresting: [],
    featured: [],
    public: [],
  };

  const noWorkspaces: CategorizedWorkspaces = {
    myWorkspaces: [],
    newAndInteresting: [],
    featured: [],
    public: [],
  };

  const keywordFilters: WorkspaceFilterValues = {
    keywordFilter: 'nothingMatchesThis',
    accessLevels: [],
    tab: 'myWorkspaces',
    tags: [],
  };

  const featuredFilters: WorkspaceFilterValues = {
    keywordFilter: '',
    accessLevels: [],
    tab: 'featured',
    tags: [],
  };

  it('displays loading message if workspaces are loading', () => {
    // Arrange
    const props = { loadingWorkspaces: true, workspaces: defaultWorkspace, filters: keywordFilters };

    // Act
    render(<NoContentMessage {...props} />);

    // Assert
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays no workspaces message if there are no workspaces and filters tab is myWorkspaces', () => {
    // Arrange
    const props = { loadingWorkspaces: false, workspaces: noWorkspaces, filters: keywordFilters };

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
    const props = { loadingWorkspaces: false, workspaces: noWorkspaces, filters: featuredFilters };

    // Act
    render(<NoContentMessage {...props} />);

    // Assert
    expect(screen.getByText('No matching workspaces')).toBeInTheDocument();
  });

  it('displays no matching workspaces message if myWorkspaces is not empty', () => {
    // Arrange
    const props = { loadingWorkspaces: false, workspaces: defaultWorkspace, filters: keywordFilters };

    // Act
    render(<NoContentMessage {...props} />);

    // Assert
    expect(screen.getByText('No matching workspaces')).toBeInTheDocument();
  });
});
