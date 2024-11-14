import { asMockedFn, partial } from '@terra-ui-packages/test-utils';
import { act, fireEvent, screen } from '@testing-library/react';
import { h } from 'react-hyperscript-helpers';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import Events from 'src/libs/events';
import { updateSearch, useRoute } from 'src/libs/nav';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import {
  defaultAzureWorkspace,
  defaultGoogleWorkspace,
  defaultInitializedGoogleWorkspace,
} from 'src/testing/workspace-fixtures';
import { CategorizedWorkspaces } from 'src/workspaces/list/CategorizedWorkspaces';
import { getWorkspaceFiltersFromQuery } from 'src/workspaces/list/WorkspaceFilters';
import { filterWorkspaces, WorkspacesListTabs } from 'src/workspaces/list/WorkspacesListTabs';
import { AzureWorkspace, cloudProviderTypes } from 'src/workspaces/utils';

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

jest.mock('src/libs/ajax/Metrics');

describe('The filterWorkspaces method', () => {
  it('should filter based on name', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultAzureWorkspace, defaultGoogleWorkspace],
      public: [defaultAzureWorkspace, defaultGoogleWorkspace],
      featured: [defaultAzureWorkspace, defaultGoogleWorkspace],
    };
    const filters = getWorkspaceFiltersFromQuery({ tab: 'myWorkspaces', filter: defaultAzureWorkspace.workspace.name });

    // Act
    const filteredWorkspaces = filterWorkspaces(workspaces, filters);

    // Assert
    expect(filteredWorkspaces.myWorkspaces).toEqual([defaultAzureWorkspace]);
    // All categories should be filtered
    expect(filteredWorkspaces.public).toEqual([defaultAzureWorkspace]);
    expect(filteredWorkspaces.featured).toEqual([defaultAzureWorkspace]);
  });

  it('should filter based on namespace (case insensitive, keyword search)', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultAzureWorkspace, defaultGoogleWorkspace, defaultInitializedGoogleWorkspace],
      public: [],
      featured: [],
    };
    const filters = getWorkspaceFiltersFromQuery({
      tab: 'myWorkspaces',
      filter: defaultGoogleWorkspace.workspace.namespace.toUpperCase(),
    });

    // Act
    const filteredWorkspaces = filterWorkspaces(workspaces, filters);

    // Assert
    expect(defaultGoogleWorkspace.workspace.namespace).toEqual(defaultInitializedGoogleWorkspace.workspace.namespace);
    expect(filteredWorkspaces.myWorkspaces).toEqual([defaultGoogleWorkspace, defaultInitializedGoogleWorkspace]);
  });

  it('should filter based on google project', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultAzureWorkspace, defaultGoogleWorkspace, defaultInitializedGoogleWorkspace],
      public: [],
      featured: [],
    };
    const filters = getWorkspaceFiltersFromQuery({ filter: defaultGoogleWorkspace.workspace.googleProject });

    // Act
    const filteredWorkspaces = filterWorkspaces(workspaces, filters);

    // Assert
    expect(defaultGoogleWorkspace.workspace.googleProject).toEqual(
      defaultInitializedGoogleWorkspace.workspace.googleProject
    );
    expect(filteredWorkspaces.myWorkspaces).toEqual([defaultGoogleWorkspace, defaultInitializedGoogleWorkspace]);
  });

  it('should filter based on workspace state (partial match)', () => {
    // Arrange
    const deleteFailedWorkspace: AzureWorkspace = {
      ...defaultAzureWorkspace,
      workspace: {
        ...defaultAzureWorkspace.workspace,
        state: 'DeleteFailed',
      },
    };

    const cloningFailedWorkspace: AzureWorkspace = {
      ...defaultAzureWorkspace,
      workspace: {
        ...defaultAzureWorkspace.workspace,
        state: 'CloningFailed',
      },
    };

    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultAzureWorkspace, deleteFailedWorkspace, cloningFailedWorkspace],
      public: [],
      featured: [],
    };
    const filters = getWorkspaceFiltersFromQuery({ filter: 'fail' });

    // Act
    const filteredWorkspaces = filterWorkspaces(workspaces, filters);

    // Assert
    expect(filteredWorkspaces.myWorkspaces).toEqual([deleteFailedWorkspace, cloningFailedWorkspace]);
  });

  it('should filter based on bucket name', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultAzureWorkspace, defaultGoogleWorkspace],
      public: [defaultAzureWorkspace, defaultGoogleWorkspace],
      featured: [defaultAzureWorkspace, defaultGoogleWorkspace],
    };
    const filters = getWorkspaceFiltersFromQuery({
      tab: 'myWorkspaces',
      filter: defaultGoogleWorkspace.workspace.bucketName,
    });

    // Act
    const filteredWorkspaces = filterWorkspaces(workspaces, filters);

    // Assert
    expect(filteredWorkspaces.myWorkspaces).toEqual([defaultGoogleWorkspace]);
    // All categories should be filtered
    expect(filteredWorkspaces.public).toEqual([defaultGoogleWorkspace]);
    expect(filteredWorkspaces.featured).toEqual([defaultGoogleWorkspace]);
  });

  it('should filter based on namespace (project search)', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultAzureWorkspace, defaultGoogleWorkspace, defaultInitializedGoogleWorkspace],
      public: [],
      featured: [],
    };
    const filters = getWorkspaceFiltersFromQuery({ projectsFilter: defaultGoogleWorkspace.workspace.namespace });

    // Act
    const filteredWorkspaces = filterWorkspaces(workspaces, filters);

    // Assert
    expect(defaultGoogleWorkspace.workspace.namespace).toEqual(defaultInitializedGoogleWorkspace.workspace.namespace);
    expect(filteredWorkspaces.myWorkspaces).toEqual([defaultGoogleWorkspace, defaultInitializedGoogleWorkspace]);
  });

  it('should filter based on cloudPlatform', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultAzureWorkspace, defaultGoogleWorkspace],
      public: [],
      featured: [],
    };
    const filters = getWorkspaceFiltersFromQuery({ cloudPlatform: cloudProviderTypes.GCP });

    // Act
    const filteredWorkspaces = filterWorkspaces(workspaces, filters);

    // Assert
    expect(filteredWorkspaces.myWorkspaces).toEqual([defaultGoogleWorkspace]);
  });

  it('should filter based on access level', () => {
    // Arrange
    const readerWorkspace: AzureWorkspace = {
      ...defaultAzureWorkspace,
      accessLevel: 'READER',
    };

    const writerWorkspace: AzureWorkspace = {
      ...defaultAzureWorkspace,
      accessLevel: 'WRITER',
    };

    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultAzureWorkspace, readerWorkspace, writerWorkspace],
      public: [],
      featured: [],
    };
    const filters = getWorkspaceFiltersFromQuery({ accessLevelsFilter: ['OWNER', 'WRITER'] });

    // Act
    const filteredWorkspaces = filterWorkspaces(workspaces, filters);

    // Assert
    expect(filteredWorkspaces.myWorkspaces).toEqual([defaultAzureWorkspace, writerWorkspace]);
  });

  it('should filter based on tags (must contain all)', () => {
    // Arrange
    const fooTagWorkspace: AzureWorkspace = {
      ...defaultAzureWorkspace,
      workspace: {
        ...defaultAzureWorkspace.workspace,
        attributes: {
          'tag:tags': {
            itemsType: 'AttributeValue',
            items: ['foo'],
          },
        },
      },
    };

    const fooBarTagWorkspace: AzureWorkspace = {
      ...defaultAzureWorkspace,
      workspace: {
        ...defaultAzureWorkspace.workspace,
        attributes: {
          'tag:tags': {
            itemsType: 'AttributeValue',
            items: ['foo', 'bar'],
          },
        },
      },
    };

    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultAzureWorkspace, fooTagWorkspace, fooBarTagWorkspace],
      public: [],
      featured: [],
    };
    const filters = getWorkspaceFiltersFromQuery({ tagsFilter: ['foo', 'bar'] });

    // Act
    const filteredWorkspaces = filterWorkspaces(workspaces, filters);

    // Assert
    expect(filteredWorkspaces.myWorkspaces).toEqual([fooBarTagWorkspace]);
  });
});

describe('The WorkspacesListTabs component', () => {
  beforeAll(() => {
    asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent: jest.fn() }));
  });

  it('should render the workspaces of the current tab', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultAzureWorkspace],
      public: [defaultGoogleWorkspace],
      featured: [],
    };
    asMockedFn(useRoute).mockImplementation(() => ({ params: {}, query: { tab: 'public' } }));

    // Act
    render(
      h(WorkspacesListTabs, {
        workspaces,
        refreshWorkspaces: jest.fn(),
        loadingWorkspaces: false,
      })
    );

    // Assert
    const renderedGoogleWS = screen.queryAllByText(defaultGoogleWorkspace.workspace.name);
    expect(renderedGoogleWS).toHaveLength(1);
    const renderedAzureWS = screen.queryAllByText(defaultAzureWorkspace.workspace.name);
    expect(renderedAzureWS).toHaveLength(0);
  });

  it('should show the count of workspaces', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultAzureWorkspace, defaultGoogleWorkspace],
      public: [defaultGoogleWorkspace],
      featured: [],
    };
    asMockedFn(useRoute).mockImplementation(() => ({ params: {}, query: { tab: 'public' } }));

    // Act
    render(
      h(WorkspacesListTabs, {
        workspaces,
        refreshWorkspaces: jest.fn(),
        loadingWorkspaces: false,
      })
    );

    // Assert
    screen.getByText('MY WORKSPACES (2)');
    screen.getByText('PUBLIC (1)');
  });

  it('should update the count of workspaces after filtering', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultAzureWorkspace, defaultGoogleWorkspace],
      public: [defaultGoogleWorkspace],
      featured: [],
    };
    asMockedFn(useRoute).mockImplementation(() => ({
      params: {},
      query: { tab: 'public', filter: defaultAzureWorkspace.workspace.name },
    }));

    // Act
    render(
      h(WorkspacesListTabs, {
        workspaces,
        refreshWorkspaces: jest.fn(),
        loadingWorkspaces: false,
      })
    );

    // Assert
    screen.getByText('MY WORKSPACES (1)');
    screen.getByText('PUBLIC (0)');
  });

  it('should default to the myWorkspaces tab', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultAzureWorkspace],
      public: [defaultGoogleWorkspace],
      featured: [],
    };
    asMockedFn(useRoute).mockImplementation(() => ({ params: {}, query: {} }));

    // Act
    render(
      h(WorkspacesListTabs, {
        workspaces,
        refreshWorkspaces: jest.fn(),
        loadingWorkspaces: false,
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
      })
    );

    // Assert
    const tabs = screen.getAllByRole('tab');
    const myWorkspacesTab = tabs[0];
    act(() => fireEvent.click(myWorkspacesTab));
    expect(refreshWorkspaces).toHaveBeenCalled();
  });

  it('switches to an inactive tab when clicked and emits an event', () => {
    // Arrange
    const workspaces: CategorizedWorkspaces = {
      myWorkspaces: [defaultAzureWorkspace],
      public: [defaultGoogleWorkspace],
      featured: [],
    };
    asMockedFn(updateSearch);

    const captureEvent = jest.fn();
    asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent }));

    // Act
    const refreshWorkspaces = jest.fn();
    render(
      h(WorkspacesListTabs, {
        workspaces,
        refreshWorkspaces,
        loadingWorkspaces: false,
      })
    );

    // Assert
    const tabs = screen.getAllByRole('tab');
    const publicTab = tabs[2];
    act(() => fireEvent.click(publicTab));
    expect(updateSearch).toHaveBeenCalledWith({ tab: 'public' });
    expect(captureEvent).toHaveBeenNthCalledWith(1, `${Events.workspacesListSelectTab}:view:myWorkspaces`, {});
    expect(captureEvent).toHaveBeenNthCalledWith(2, `${Events.workspacesListSelectTab}:view:public`, {});
  });
});
