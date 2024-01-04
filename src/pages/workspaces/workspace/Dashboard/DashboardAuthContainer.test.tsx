import { DeepPartial } from '@terra-ui-packages/core-utils';
import { screen } from '@testing-library/react';
import React from 'react';
import { act } from 'react-dom/test-utils';
import { Ajax } from 'src/libs/ajax';
import { AuthState, authStore } from 'src/libs/state';
import { DashboardAuthContainer } from 'src/pages/workspaces/workspace/Dashboard/DashboardAuthContainer';
import {
  WorkspaceDashboardPage,
  WorkspaceDashboardPageProps,
} from 'src/pages/workspaces/workspace/Dashboard/WorkspaceDashboardPage';
import { asMockedFn, renderWithAppContexts as render } from 'src/testing/test-utils';

type AjaxContract = ReturnType<typeof Ajax>;

jest.mock('src/libs/ajax', () => ({
  Ajax: jest.fn(),
}));

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

type DashboardPageExports = typeof import('src/pages/workspaces/workspace/Dashboard/WorkspaceDashboardPage');
jest.mock(
  'src/pages/workspaces/workspace/Dashboard/WorkspaceDashboardPage',
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

    asMockedFn(Ajax).mockReturnValue({
      FirecloudBucket: {
        getFeaturedWorkspaces: jest.fn().mockResolvedValue([{ name: 'test-name', namespace: 'test-namespace' }]),
      },
    } as DeepPartial<AjaxContract> as AjaxContract);

    // Act
    render(<DashboardAuthContainer namespace="test-namespace" name="test-name" />);

    // Assert
    expect(document.getElementById('loading-spinner')).not.toBeNull();
  });

  it('renders DashboardPublic when signed out and is a featured workspace', async () => {
    // Arrange
    authStore.update((state: AuthState) => ({ ...state, signInStatus: 'signedOut' }));
    const description = 'test workspace description';
    asMockedFn(Ajax).mockReturnValue({
      FirecloudBucket: {
        getFeaturedWorkspaces: jest.fn().mockResolvedValue([{ name: 'test-name', namespace: 'test-namespace' }]),
        getShowcaseWorkspaces: jest
          .fn()
          .mockResolvedValue([{ name: 'test-name', namespace: 'test-namespace', description }]),
      },
    } as DeepPartial<AjaxContract> as AjaxContract);

    // Act
    await act(async () => {
      render(<DashboardAuthContainer namespace="test-namespace" name="test-name" />);
    });

    // Assert
    expect(screen.getByText(description)).toBeInTheDocument();
  });

  it('renders SignIn when signed out and is not a featured workspace', async () => {
    // Arrange
    authStore.update((state: AuthState) => ({ ...state, signInStatus: 'signedOut' }));
    asMockedFn(Ajax).mockReturnValue({
      FirecloudBucket: {
        getFeaturedWorkspaces: jest.fn().mockResolvedValue([]),
      },
    } as DeepPartial<AjaxContract> as AjaxContract);

    // Act
    await act(async () => {
      render(<DashboardAuthContainer namespace="test-namespace" name="test-name" />);
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

    asMockedFn(Ajax).mockReturnValue({
      FirecloudBucket: {
        getFeaturedWorkspaces: jest.fn().mockResolvedValue([]),
        getShowcaseWorkspaces: jest.fn().mockResolvedValue([]),
      },
    } as DeepPartial<AjaxContract> as AjaxContract);
    // Act
    await act(async () => {
      render(<DashboardAuthContainer namespace="test-namespace" name="test-name" />);
    });

    // Assert
    expect(mockDashboard).toHaveBeenCalled();
    expect(screen.getByText('test-namespace test-name')).toBeInTheDocument();
  });
});
