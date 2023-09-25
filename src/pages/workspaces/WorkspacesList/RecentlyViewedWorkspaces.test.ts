import { render, screen } from '@testing-library/react';
import { h } from 'react-hyperscript-helpers';
import { recentlyViewedPersistenceId } from 'src/components/workspace-utils';
import { getLocalPref } from 'src/libs/prefs';
import { RecentlyViewedWorkspaces } from 'src/pages/workspaces/WorkspacesList/RecentlyViewedWorkspaces';
import { persistenceId } from 'src/pages/workspaces/WorkspacesList/WorkspacesList';
import { asMockedFn } from 'src/testing/test-utils';
import { defaultAzureWorkspace, defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';

type NavExports = typeof import('src/libs/nav');

jest.mock(
  'src/libs/nav',
  (): NavExports => ({
    ...jest.requireActual<NavExports>('src/libs/nav'),
    getLink: jest.fn(),
  })
);

type PrefExports = typeof import('src/libs/prefs');

describe('The recently viewed workspaces component', () => {
  it('starts open when the user preference is set to true', () => {
    // Assert
    jest.mock(
      'src/libs/prefs',
      (): PrefExports => ({
        ...jest.requireActual('src/libs/prefs'),
        getLocalPref: jest.fn(),
        setLocalPref: jest.fn(),
      })
    );

    const recentlyViewed = [{ workspaceId: defaultAzureWorkspace.workspace.workspaceId, timestamp: Date.now() }];
    asMockedFn(getLocalPref).mockImplementation((key) => {
      if (key === persistenceId) return { recentlyViewedOpen: true };
      if (key === recentlyViewedPersistenceId) return { recentlyViewed };
      return {};
    });

    // Act
    const workspaces = [defaultAzureWorkspace];
    render(h(RecentlyViewedWorkspaces, { workspaces, loadingSubmissionStats: false }));

    // Assert
    const renderedAzureWS = screen.getAllByText(defaultAzureWorkspace.workspace.name);
    expect(renderedAzureWS).toHaveLength(1);
  });

  it('starts collapsed when the user preference is set to false', () => {
    // Arange
    jest.mock(
      'src/libs/prefs',
      (): PrefExports => ({
        ...jest.requireActual('src/libs/prefs'),
        getLocalPref: jest.fn(),
        setLocalPref: jest.fn(),
      })
    );

    const recentlyViewed = [{ workspaceId: defaultAzureWorkspace.workspace.workspaceId, timestamp: Date.now() }];
    asMockedFn(getLocalPref).mockImplementation((key) => {
      if (key === persistenceId) return { recentlyViewedOpen: false };
      if (key === recentlyViewedPersistenceId) return { recentlyViewed };
      return {};
    });

    // Act
    const workspaces = [defaultAzureWorkspace];
    render(h(RecentlyViewedWorkspaces, { workspaces, loadingSubmissionStats: false }));

    // Assert
    const renderedAzureWS = screen.queryAllByText(defaultAzureWorkspace.workspace.name);
    expect(renderedAzureWS).toHaveLength(0);
  });

  it('defaults to open when the user preference is not set', () => {
    jest.mock(
      'src/libs/prefs',
      (): PrefExports => ({
        ...jest.requireActual('src/libs/prefs'),
        getLocalPref: jest.fn(),
        setLocalPref: jest.fn(),
      })
    );

    const recentlyViewed = [{ workspaceId: defaultAzureWorkspace.workspace.workspaceId, timestamp: Date.now() }];
    asMockedFn(getLocalPref).mockImplementation((key) => {
      if (key === persistenceId) return {};
      if (key === recentlyViewedPersistenceId) return { recentlyViewed };
      return {};
    });
    const workspaces = [defaultAzureWorkspace];

    render(h(RecentlyViewedWorkspaces, { workspaces, loadingSubmissionStats: false }));
    const renderedAzureWS = screen.queryAllByText(defaultAzureWorkspace.workspace.name);
    expect(renderedAzureWS).toHaveLength(0);
  });

  it('only renders recently viewed workspaces when open', () => {
    // Arrange
    jest.mock(
      'src/libs/prefs',
      (): PrefExports => ({
        ...jest.requireActual('src/libs/prefs'),
        getLocalPref: jest.fn(),
        setLocalPref: jest.fn(),
      })
    );

    const recentlyViewed = [{ workspaceId: defaultAzureWorkspace.workspace.workspaceId, timestamp: Date.now() }];
    asMockedFn(getLocalPref).mockImplementation((key) => {
      if (key === persistenceId) return { recentlyViewedOpen: true };
      if (key === recentlyViewedPersistenceId) return { recentlyViewed };
      return {};
    });

    // Act
    const workspaces = [defaultAzureWorkspace, defaultGoogleWorkspace];
    render(h(RecentlyViewedWorkspaces, { workspaces, loadingSubmissionStats: false }));

    // Assert
    const renderedAzureWS = screen.getAllByText(defaultAzureWorkspace.workspace.name);
    expect(renderedAzureWS).toHaveLength(1);
    const renderedGoogleWS = screen.queryAllByText(defaultGoogleWorkspace.workspace.name);
    expect(renderedGoogleWS).toHaveLength(0);
  });
});
