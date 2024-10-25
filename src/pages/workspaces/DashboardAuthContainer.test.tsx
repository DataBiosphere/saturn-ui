import { screen } from '@testing-library/react';
import React from 'react';
import { act } from 'react-dom/test-utils';
import { FirecloudBucket, FirecloudBucketAjaxContract } from 'src/libs/ajax/firecloud/FirecloudBucket';
import { AuthState, authStore } from 'src/libs/state';
import { DashboardAuthContainer } from 'src/pages/workspaces/DashboardAuthContainer';
import { asMockedFn, MockedFn, partial, renderWithAppContexts as render } from 'src/testing/test-utils';
import { WorkspaceDashboardPage, WorkspaceDashboardPageProps } from 'src/workspaces/dashboard/WorkspaceDashboardPage';

jest.mock('src/libs/ajax/firecloud/FirecloudBucket');

jest.mock('src/libs/notifications', (): typeof import('src/libs/notifications') => {
  return {
    ...jest.requireActual('src/libs/notifications'),
    notify: jest.fn(),
  };
});

jest.mock('src/libs/nav', (): typeof import('src/libs/nav') => ({
  ...jest.requireActual('src/libs/nav'),
  getCurrentUrl: jest.fn().mockReturnValue(new URL('https://app.terra.bio')),
  goToPath: jest.fn(),
  getLink: jest.fn(),
}));

type DashboardPageExports = typeof import('src/workspaces/dashboard/WorkspaceDashboardPage');
jest.mock(
  'src/workspaces/dashboard/WorkspaceDashboardPage',
  () =>
    ({
      WorkspaceDashboardPage: jest.fn(),
    } as DashboardPageExports)
);

describe('DashboardAuthContainer', () => {
  beforeEach(() => {
    authStore.reset();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders spinner when auth is uninitialized', async () => {
    // Arrange
    authStore.update((state: AuthState) => ({ ...state, signInStatus: 'uninitialized' }));

    const getFeaturedWorkspaces: MockedFn<FirecloudBucketAjaxContract['getFeaturedWorkspaces']> = jest.fn();
    getFeaturedWorkspaces.mockResolvedValue([{ name: 'test-name', namespace: 'test-namespace' }]);

    asMockedFn(FirecloudBucket).mockReturnValue(partial<FirecloudBucketAjaxContract>({ getFeaturedWorkspaces }));

    // Act
    render(<DashboardAuthContainer namespace='test-namespace' name='test-name' />);

    // Assert
    expect(document.getElementById('loading-spinner')).not.toBeNull();
  });

  it('renders DashboardPublic when signed out and is a featured workspace', async () => {
    // Arrange
    authStore.update((state: AuthState) => ({ ...state, signInStatus: 'signedOut' }));
    const description = 'test workspace description';

    const getFeaturedWorkspaces: MockedFn<FirecloudBucketAjaxContract['getFeaturedWorkspaces']> = jest.fn();
    getFeaturedWorkspaces.mockResolvedValue([{ name: 'test-name', namespace: 'test-namespace' }]);
    const getShowcaseWorkspaces: MockedFn<FirecloudBucketAjaxContract['getShowcaseWorkspaces']> = jest.fn();
    getShowcaseWorkspaces.mockResolvedValue([{ name: 'test-name', namespace: 'test-namespace', description }]);

    asMockedFn(FirecloudBucket).mockReturnValue(
      partial<FirecloudBucketAjaxContract>({ getFeaturedWorkspaces, getShowcaseWorkspaces })
    );

    // Act
    await act(async () => {
      render(<DashboardAuthContainer namespace='test-namespace' name='test-name' />);
    });

    // Assert
    expect(screen.getByText(description)).toBeInTheDocument();
  });

  it('renders SignIn when signed out and is not a featured workspace', async () => {
    // Arrange
    authStore.update((state: AuthState) => ({ ...state, signInStatus: 'signedOut' }));

    const getFeaturedWorkspaces: MockedFn<FirecloudBucketAjaxContract['getFeaturedWorkspaces']> = jest.fn();
    getFeaturedWorkspaces.mockResolvedValue([]);

    asMockedFn(FirecloudBucket).mockReturnValue(partial<FirecloudBucketAjaxContract>({ getFeaturedWorkspaces }));

    // Act
    await act(async () => {
      render(<DashboardAuthContainer namespace='test-namespace' name='test-name' />);
    });

    // Assert
    expect(screen.getByText('If you are a new user or returning user, click sign in to continue.')).toBeInTheDocument();
  });

  it('renders WorkspaceDashboardPage when signed in', async () => {
    // Arrange
    authStore.update((state: AuthState) => ({ ...state, signInStatus: 'userLoaded' }));

    const mockDashboard = asMockedFn(WorkspaceDashboardPage);

    mockDashboard.mockImplementation((props: WorkspaceDashboardPageProps) => (
      <div>{`${props.namespace} ${props.name}`}</div>
    ));

    const getFeaturedWorkspaces: MockedFn<FirecloudBucketAjaxContract['getFeaturedWorkspaces']> = jest.fn();
    getFeaturedWorkspaces.mockResolvedValue([]);
    const getShowcaseWorkspaces: MockedFn<FirecloudBucketAjaxContract['getShowcaseWorkspaces']> = jest.fn();
    getShowcaseWorkspaces.mockResolvedValue([]);

    asMockedFn(FirecloudBucket).mockReturnValue(
      partial<FirecloudBucketAjaxContract>({ getFeaturedWorkspaces, getShowcaseWorkspaces })
    );

    // Act
    await act(async () => {
      render(<DashboardAuthContainer namespace='test-namespace' name='test-name' />);
    });

    // Assert
    expect(mockDashboard).toHaveBeenCalled();
    expect(screen.getByText('test-namespace test-name')).toBeInTheDocument();
  });
});
