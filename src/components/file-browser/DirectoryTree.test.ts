import { subscribable } from '@terra-ui-packages/core-utils';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { h, ul } from 'react-hyperscript-helpers';
import { Directory } from 'src/components/file-browser/DirectoryTree';
import { useDirectoriesInDirectory } from 'src/components/file-browser/file-browser-hooks';
import FileBrowserProvider from 'src/libs/ajax/file-browser-providers/FileBrowserProvider';
import { asMockedFn, renderWithAppContexts as render } from 'src/testing/test-utils';

jest.mock('src/components/file-browser/file-browser-hooks', () => ({
  ...jest.requireActual('src/components/file-browser/file-browser-hooks'),
  useDirectoriesInDirectory: jest.fn(),
}));

type UseDirectoriesInDirectoryResult = ReturnType<typeof useDirectoriesInDirectory>;

const mockFileBrowserProvider: FileBrowserProvider = {} as FileBrowserProvider;

describe('Directory', () => {
  it('renders the directory name', () => {
    // Act
    render(
      h(Directory, {
        activeDescendant: 'node-0',
        level: 0,
        id: 'node-0',
        path: 'path/to/directory/',
        provider: mockFileBrowserProvider,
        reloadRequests: subscribable(),
        rootLabel: 'Workspace bucket',
        selectedDirectory: '',
        setActiveDescendant: () => {},
        onError: () => {},
        onSelectDirectory: jest.fn(),
      })
    );

    // Assert
    screen.getByText('directory');
  });

  it('immediately fetches and renders directory contents for root directory', () => {
    // Arrange
    const directories = [
      {
        path: 'directory1',
      },
      {
        path: 'directory2',
      },
      {
        path: 'directory3',
      },
    ];

    const useDirectoriesInDirectoryResult: UseDirectoriesInDirectoryResult = {
      state: { directories, status: 'Ready' },
      hasNextPage: undefined,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useDirectoriesInDirectory).mockReturnValue(useDirectoriesInDirectoryResult);

    // Act
    render(
      ul({ role: 'tree' }, [
        h(Directory, {
          activeDescendant: 'node-0',
          id: 'node-0',
          level: 0,
          path: '',
          provider: mockFileBrowserProvider,
          reloadRequests: subscribable(),
          rootLabel: 'Workspace bucket',
          selectedDirectory: '',
          setActiveDescendant: () => {},
          onError: () => {},
          onSelectDirectory: jest.fn(),
        }),
      ])
    );

    // Assert
    expect(useDirectoriesInDirectory).toHaveBeenCalled();

    const subdirectoryList = screen.getByRole('group');
    const renderedSubdirectories = Array.from(subdirectoryList.children).map((el) => el.children[1].textContent);
    expect(renderedSubdirectories).toEqual(['directory1', 'directory2', 'directory3']);
  });

  it('fetches and renders contents for parent directory of selected directory', () => {
    // Arrange
    const directoriesIn = (path) => {
      switch (path) {
        case 'directory1/':
          return [
            {
              path: 'directory1/test1',
            },
            {
              path: 'directory1/test2',
            },
          ];
        case 'directory1/test1/':
          return [
            {
              path: 'directory1/test1/abc/',
            },
            {
              path: 'directory1/test1/xyz/',
            },
          ];
        default:
          return [];
      }
    };

    asMockedFn(useDirectoriesInDirectory).mockImplementation((_, path) => {
      return {
        state: { directories: directoriesIn(path), status: 'Ready' },
        hasNextPage: undefined,
        loadNextPage: () => Promise.resolve(),
        loadAllRemainingItems: () => Promise.resolve(),
        reload: () => Promise.resolve(),
      };
    });

    render(
      ul({ role: 'tree' }, [
        h(Directory, {
          activeDescendant: 'node-0',
          id: 'node-0',
          level: 0,
          path: 'directory1/',
          provider: mockFileBrowserProvider,
          reloadRequests: subscribable(),
          rootLabel: 'Workspace bucket',
          selectedDirectory: 'directory1/test1/abc/',
          setActiveDescendant: () => {},
          onError: () => {},
          onSelectDirectory: jest.fn(),
        }),
      ])
    );

    // Assert
    const subdirectoryList = screen.getByLabelText('directory1 subdirectories');
    const renderedSubdirectories = Array.from(subdirectoryList.children).map((el) => el.children[1].textContent);
    expect(renderedSubdirectories).toEqual(['test1', 'test2']);
  });

  describe('when directory name is clicked', () => {
    let onSelectDirectory;

    beforeEach(async () => {
      // Arrange
      const user = userEvent.setup();

      const directories = [
        {
          path: 'path/to/directory/subdirectory1',
        },
        {
          path: 'path/to/directory/subdirectory2',
        },
        {
          path: 'path/to/directory/subdirectory3',
        },
      ];

      const useDirectoriesInDirectoryResult: UseDirectoriesInDirectoryResult = {
        state: { directories, status: 'Ready' },
        hasNextPage: undefined,
        loadNextPage: () => Promise.resolve(),
        loadAllRemainingItems: () => Promise.resolve(),
        reload: () => Promise.resolve(),
      };

      asMockedFn(useDirectoriesInDirectory).mockReturnValue(useDirectoriesInDirectoryResult);

      onSelectDirectory = jest.fn();
      render(
        h(Directory, {
          activeDescendant: 'node-0',
          id: 'node-0',
          level: 0,
          path: 'path/to/directory/',
          provider: mockFileBrowserProvider,
          reloadRequests: subscribable(),
          rootLabel: 'Workspace bucket',
          selectedDirectory: '',
          setActiveDescendant: () => {},
          onError: () => {},
          onSelectDirectory,
        })
      );

      // Act
      const link = screen.getByText('directory');
      await user.click(link);
    });

    it('it calls onSelectDirectory callback with path when directory name is clicked', () => {
      // Assert
      expect(onSelectDirectory).toHaveBeenCalledWith('path/to/directory/');
    });

    it('fetches and renders directory contents', () => {
      // Assert
      expect(useDirectoriesInDirectory).toHaveBeenCalled();

      const subdirectoryList = screen.getByRole('group');

      const renderedSubdirectories = Array.from(subdirectoryList.children).map((el) => el.children[1].textContent);
      expect(renderedSubdirectories).toEqual(['subdirectory1', 'subdirectory2', 'subdirectory3']);
    });
  });

  it('fetches and renders directory contents when expanded', async () => {
    // Arrange
    const user = userEvent.setup();

    const directories = [
      {
        path: 'path/to/directory/subdirectory1',
      },
      {
        path: 'path/to/directory/subdirectory2',
      },
      {
        path: 'path/to/directory/subdirectory3',
      },
    ];

    const useDirectoriesInDirectoryResult: UseDirectoriesInDirectoryResult = {
      state: { directories, status: 'Ready' },
      hasNextPage: undefined,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useDirectoriesInDirectory).mockReturnValue(useDirectoriesInDirectoryResult);

    const { container } = render(
      ul({ role: 'tree' }, [
        h(Directory, {
          activeDescendant: 'node-0',
          id: 'node-0',
          level: 0,
          path: 'path/to/directory/',
          provider: mockFileBrowserProvider,
          reloadRequests: subscribable(),
          rootLabel: 'Workspace bucket',
          selectedDirectory: '',
          setActiveDescendant: () => {},
          onError: () => {},
          onSelectDirectory: jest.fn(),
        }),
      ])
    );

    // Act
    const contentsFetchedBeforeExpanding = asMockedFn(useDirectoriesInDirectory).mock.calls.length > 0;
    const toggle = screen.getByTestId('toggle-expanded');
    await user.click(toggle);
    const contentsFetchedAfterExpanding = asMockedFn(useDirectoriesInDirectory).mock.calls.length > 0;

    const subdirectoryList = screen.getByRole('group');
    const renderedSubdirectories = Array.from(subdirectoryList.children).map((el) => el.children[1].textContent);

    // Assert
    expect(contentsFetchedBeforeExpanding).toBe(false);
    expect(contentsFetchedAfterExpanding).toBe(true);

    expect(renderedSubdirectories).toEqual(['subdirectory1', 'subdirectory2', 'subdirectory3']);

    expect(await axe(container)).toHaveNoViolations();
  });

  it('it renders a screen reader announcement while loading', async () => {
    // Arrange
    const user = userEvent.setup();

    const loadingState = { status: 'Loading', directories: [] } as UseDirectoriesInDirectoryResult['state'];

    const useDirectoriesInDirectoryResult: UseDirectoriesInDirectoryResult = {
      state: loadingState,
      hasNextPage: false,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useDirectoriesInDirectory).mockReturnValue(useDirectoriesInDirectoryResult);

    render(
      h(Directory, {
        activeDescendant: 'node-0',
        id: 'node-0',
        level: 0,
        path: 'path/to/directory/',
        provider: mockFileBrowserProvider,
        reloadRequests: subscribable(),
        rootLabel: 'Workspace bucket',
        selectedDirectory: '',
        setActiveDescendant: () => {},
        onError: () => {},
        onSelectDirectory: jest.fn(),
      })
    );

    // Act
    const toggle = screen.getByTestId('toggle-expanded');
    await user.click(toggle);

    // Assert
    const announcement = screen.getByText('Loading directory subdirectories');
    expect(announcement).toHaveClass('sr-only');
  });

  it('it renders a status message if there was an error loading contents', async () => {
    // Arrange
    const user = userEvent.setup();

    const errorState = {
      status: 'Error',
      error: new Error('Something went wrong'),
      directories: [],
    } as UseDirectoriesInDirectoryResult['state'];

    const useDirectoriesInDirectoryResult: UseDirectoriesInDirectoryResult = {
      state: errorState,
      hasNextPage: false,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useDirectoriesInDirectory).mockReturnValue(useDirectoriesInDirectoryResult);

    render(
      h(Directory, {
        activeDescendant: 'node-0',
        id: 'node-0',
        level: 0,
        path: 'path/to/directory/',
        provider: mockFileBrowserProvider,
        reloadRequests: subscribable(),
        rootLabel: 'Workspace bucket',
        selectedDirectory: '',
        setActiveDescendant: () => {},
        onError: () => {},
        onSelectDirectory: jest.fn(),
      })
    );

    // Act
    const toggle = screen.getByTestId('toggle-expanded');
    await user.click(toggle);

    // Assert
    screen.getByText('Error loading subdirectories');
  });

  it('calls onError callback on errors loading directories', async () => {
    // Arrange
    const user = userEvent.setup();

    const errorState = {
      status: 'Error',
      error: new Error('Something went wrong'),
      directories: [],
    } as UseDirectoriesInDirectoryResult['state'];

    const useDirectoriesInDirectoryResult: UseDirectoriesInDirectoryResult = {
      state: errorState,
      hasNextPage: false,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useDirectoriesInDirectory).mockReturnValue(useDirectoriesInDirectoryResult);

    const onError = jest.fn();

    render(
      h(Directory, {
        activeDescendant: 'node-0',
        id: 'node-0',
        level: 0,
        path: 'path/to/directory/',
        provider: mockFileBrowserProvider,
        reloadRequests: subscribable(),
        rootLabel: 'Workspace bucket',
        selectedDirectory: '',
        setActiveDescendant: () => {},
        onError,
        onSelectDirectory: jest.fn(),
      })
    );

    // Act
    const toggle = screen.getByTestId('toggle-expanded');
    await user.click(toggle);

    // Assert
    expect(onError).toHaveBeenCalledWith(new Error('Something went wrong'));
  });

  describe('when next page is available', () => {
    // Arrange
    const loadNextPage = jest.fn();
    const loadAllRemainingItems = jest.fn();

    const directories = [
      {
        path: 'path/to/directory/subdirectory1',
      },
    ];

    const useDirectoriesInDirectoryResult: UseDirectoriesInDirectoryResult = {
      state: { directories, status: 'Ready' },
      hasNextPage: true,
      loadNextPage,
      loadAllRemainingItems,
      reload: () => Promise.resolve(),
    };

    beforeEach(() => {
      asMockedFn(useDirectoriesInDirectory).mockReturnValue(useDirectoriesInDirectoryResult);
    });

    it('renders a button to load next page', async () => {
      // Arrange
      const user = userEvent.setup();

      render(
        h(Directory, {
          activeDescendant: 'node-0',
          id: 'node-0',
          level: 0,
          path: 'path/to/directory/',
          provider: mockFileBrowserProvider,
          reloadRequests: subscribable(),
          rootLabel: 'Workspace bucket',
          selectedDirectory: '',
          setActiveDescendant: () => {},
          onError: () => {},
          onSelectDirectory: jest.fn(),
        })
      );

      const toggle = screen.getByTestId('toggle-expanded');
      await user.click(toggle);

      // Assert
      const loadNextPageButton = screen.getByText('Load next page');
      await user.click(loadNextPageButton);
      expect(loadNextPage).toHaveBeenCalled();
    });
  });
});
