import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h } from 'react-hyperscript-helpers';
import { useFilesInDirectory } from 'src/components/file-browser/file-browser-hooks';
import FilesInDirectory from 'src/components/file-browser/FilesInDirectory';
import FilesTable from 'src/components/file-browser/FilesTable';
import FileBrowserProvider, { FileBrowserFile } from 'src/libs/ajax/file-browser-providers/FileBrowserProvider';
import { notify } from 'src/libs/notifications';
import { asMockedFn, renderWithAppContexts as render } from 'src/testing/test-utils';

jest.mock('src/components/file-browser/file-browser-hooks', () => ({
  ...jest.requireActual('src/components/file-browser/file-browser-hooks'),
  useFilesInDirectory: jest.fn(),
}));

// FileBrowserTable uses react-virtualized's AutoSizer to size the table.
// This makes the virtualized window large enough for all rows/columns to be rendered in tests.
jest.mock('react-virtualized', () => ({
  ...jest.requireActual('react-virtualized'),
  AutoSizer: ({ children }) => children({ width: 1000, height: 1000 }),
}));

type FilesTableExports = typeof import('src/components/file-browser/FilesTable') & { __esModule: true };
jest.mock('src/components/file-browser/FilesTable', (): FilesTableExports => {
  const actual = jest.requireActual<FilesTableExports>('src/components/file-browser/FilesTable');
  return {
    ...actual,
    __esModule: true,
    default: jest.fn(actual.default),
  };
});

type NotificationsExports = typeof import('src/libs/notifications');
jest.mock('src/libs/notifications', (): NotificationsExports => {
  return {
    ...jest.requireActual<NotificationsExports>('src/libs/notifications'),
    notify: jest.fn(),
  };
});

type UseFilesInDirectoryResult = ReturnType<typeof useFilesInDirectory>;

// modals, popups, tooltips, etc. render into this element.
beforeAll(() => {
  const modalRoot = document.createElement('div');
  modalRoot.id = 'modal-root';
  document.body.append(modalRoot);
});

afterAll(() => {
  document.getElementById('modal-root')!.remove();
});

describe('FilesInDirectory', () => {
  const mockFileBrowserProvider: FileBrowserProvider = {} as FileBrowserProvider;

  it('loads files in the given path', () => {
    // Arrange
    const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
      state: { files: [], status: 'Loading' },
      hasNextPage: undefined,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

    // Act
    render(
      h(FilesInDirectory, {
        provider: mockFileBrowserProvider,
        path: 'path/to/directory/',
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickFile: jest.fn(),
        onCreateDirectory: () => {},
        onDeleteDirectory: () => {},
        onError: () => {},
      })
    );

    // Assert
    expect(asMockedFn(useFilesInDirectory)).toHaveBeenCalledWith(mockFileBrowserProvider, 'path/to/directory/');
  });

  it('renders FilesTable with loaded files', () => {
    // Arrange
    const files: FileBrowserFile[] = [
      {
        path: 'path/to/file.txt',
        url: 'gs://test-bucket/path/to/file.txt',
        contentType: 'text/plain',
        size: 1024,
        createdAt: 1667408400000,
        updatedAt: 1667408400000,
      },
    ];

    const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
      state: { files, status: 'Ready' },
      hasNextPage: undefined,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

    // Act
    render(
      h(FilesInDirectory, {
        provider: mockFileBrowserProvider,
        path: 'path/to/directory/',
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickFile: jest.fn(),
        onCreateDirectory: () => {},
        onDeleteDirectory: () => {},
        onError: () => {},
      })
    );

    // Assert
    expect(FilesTable).toHaveBeenCalledWith(expect.objectContaining({ files }), expect.anything());
  });

  it.each([
    { state: { status: 'Loading', files: [] }, expectedMessage: 'Loading files...' },
    { state: { status: 'Ready', files: [] }, expectedMessage: 'No files have been uploaded yet' },
    {
      state: { status: 'Error', error: new Error('Something went wrong'), files: [] },
      expectedMessage: 'Unable to load files',
    },
  ] as { state: UseFilesInDirectoryResult['state']; expectedMessage: string }[])(
    'renders a message based on loading state ($state.status) when no files are present',
    ({ state, expectedMessage }) => {
      // Arrange
      const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
        state,
        hasNextPage: false,
        loadNextPage: () => Promise.resolve(),
        loadAllRemainingItems: () => Promise.resolve(),
        reload: () => Promise.resolve(),
      };

      asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

      // Act
      render(
        h(FilesInDirectory, {
          provider: mockFileBrowserProvider,
          path: 'path/to/directory/',
          selectedFiles: {},
          setSelectedFiles: () => {},
          onClickFile: jest.fn(),
          onCreateDirectory: () => {},
          onDeleteDirectory: () => {},
          onError: () => {},
        })
      );

      // Assert
      screen.getByText(expectedMessage);
    }
  );

  it('calls onError callback on errors loading files', () => {
    // Arrange
    const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
      state: { status: 'Error', error: new Error('Something went wrong'), files: [] },
      hasNextPage: false,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

    const onError = jest.fn();

    // Act
    render(
      h(FilesInDirectory, {
        provider: mockFileBrowserProvider,
        path: 'path/to/directory/',
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickFile: jest.fn(),
        onCreateDirectory: () => {},
        onDeleteDirectory: () => {},
        onError,
      })
    );

    // Assert
    expect(onError).toHaveBeenCalledWith(new Error('Something went wrong'));
  });

  describe('when next page is available', () => {
    // Arrange
    const loadNextPage = jest.fn();
    const loadAllRemainingItems = jest.fn();

    const files: FileBrowserFile[] = [
      {
        path: 'path/to/file.txt',
        url: 'gs://test-bucket/path/to/file.txt',
        contentType: 'text/plain',
        size: 1024,
        createdAt: 1667408400000,
        updatedAt: 1667408400000,
      },
    ];

    const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
      state: { files, status: 'Ready' },
      hasNextPage: true,
      loadNextPage,
      loadAllRemainingItems,
      reload: () => Promise.resolve(),
    };

    beforeEach(() => {
      asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);
    });

    it('renders a button to load next page', async () => {
      // Arrange
      const user = userEvent.setup();

      // Act
      render(
        h(FilesInDirectory, {
          provider: mockFileBrowserProvider,
          path: 'path/to/directory/',
          selectedFiles: {},
          setSelectedFiles: () => {},
          onClickFile: jest.fn(),
          onCreateDirectory: () => {},
          onDeleteDirectory: () => {},
          onError: () => {},
        })
      );

      // Assert
      const loadNextPageButton = screen.getByText('Load next page');
      await user.click(loadNextPageButton);
      expect(loadNextPage).toHaveBeenCalled();
    });

    it('renders a button to load all remaining pages', async () => {
      // Arrange
      const user = userEvent.setup();

      // Act
      render(
        h(FilesInDirectory, {
          provider: mockFileBrowserProvider,
          path: 'path/to/directory/',
          selectedFiles: {},
          setSelectedFiles: () => {},
          onClickFile: jest.fn(),
          onCreateDirectory: () => {},
          onDeleteDirectory: () => {},
          onError: () => {},
        })
      );

      // Assert
      const loadAllPagesButton = screen.getByText('Load all');
      await user.click(loadAllPagesButton);
      expect(loadAllRemainingItems).toHaveBeenCalled();
    });
  });

  it('uploads files', async () => {
    // Arrange
    const user = userEvent.setup();

    const uploadFileToDirectory = jest.fn(() => Promise.resolve());
    const mockProvider = { uploadFileToDirectory } as Partial<FileBrowserProvider> as FileBrowserProvider;

    const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
      state: { status: 'Ready', files: [] },
      hasNextPage: false,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

    render(
      h(FilesInDirectory, {
        provider: mockProvider,
        path: 'path/to/directory/',
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickFile: jest.fn(),
        onCreateDirectory: () => {},
        onDeleteDirectory: () => {},
        onError: () => {},
      })
    );

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;

    const file = new File(['somecontent'], 'example.txt');

    // Act
    await user.upload(fileInput, [file]);

    // Assert
    expect(uploadFileToDirectory).toHaveBeenCalledWith('path/to/directory/', file);
  });

  it('notifies of any errors uploading files', async () => {
    // Arrange
    const user = userEvent.setup();

    const uploadFileToDirectory = jest.fn().mockRejectedValue(new Error('Something went wrong'));
    const mockProvider = { uploadFileToDirectory } as Partial<FileBrowserProvider> as FileBrowserProvider;

    const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
      state: { status: 'Ready', files: [] },
      hasNextPage: false,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

    render(
      h(FilesInDirectory, {
        provider: mockProvider,
        path: 'path/to/directory/',
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickFile: jest.fn(),
        onCreateDirectory: () => {},
        onDeleteDirectory: () => {},
        onError: () => {},
      })
    );

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;

    const file1 = new File(['somecontent'], 'file1.txt');
    const file2 = new File(['somecontent'], 'file2.txt');

    // Act
    await user.upload(fileInput, [file1, file2]);

    // Assert
    expect(notify).toHaveBeenCalledWith('error', 'Error uploading file', {
      id: 'file-browser-upload-error',
      message: 'Failed to upload file1.txt',
      detail: new Error('Something went wrong'),
    });
    expect(notify).toHaveBeenCalledWith('error', 'Error uploading file', {
      id: 'file-browser-upload-error',
      message: 'Failed to upload file2.txt',
      detail: new Error('Something went wrong'),
    });
  });

  it('allows deleting empty folders', async () => {
    // Arrange
    const user = userEvent.setup();

    const deleteEmptyDirectory = jest.fn(() => Promise.resolve());
    const mockProvider = {
      deleteEmptyDirectory,
    } as Partial<FileBrowserProvider> as FileBrowserProvider;

    const onDeleteDirectory = jest.fn();

    const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
      state: { status: 'Ready', files: [] },
      hasNextPage: false,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

    render(
      h(FilesInDirectory, {
        provider: mockProvider,
        path: 'path/to/directory/',
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickFile: jest.fn(),
        onCreateDirectory: () => {},
        onDeleteDirectory,
        onError: () => {},
      })
    );

    // Act
    const deleteButton = screen.getByText('Delete this folder');
    await user.click(deleteButton);

    // Assert
    expect(deleteEmptyDirectory).toHaveBeenCalledWith('path/to/directory/');
    expect(onDeleteDirectory).toHaveBeenCalled();
  });

  it('allows renaming files', async () => {
    // Arrange
    const user = userEvent.setup();

    const files: FileBrowserFile[] = [
      {
        path: 'path/to/directory/file.txt',
        url: 'gs://test-bucket/path/to/directory/file.txt',
        contentType: 'text/plain',
        size: 1024,
        createdAt: 1667408400000,
        updatedAt: 1667408400000,
      },
    ];

    const moveFile = jest.fn(() => Promise.resolve());
    const mockProvider = { moveFile } as Partial<FileBrowserProvider> as FileBrowserProvider;

    const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
      state: { status: 'Ready', files },
      hasNextPage: false,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

    render(
      h(FilesInDirectory, {
        provider: mockProvider,
        path: 'path/to/directory/',
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickFile: jest.fn(),
        onCreateDirectory: () => {},
        onDeleteDirectory: () => {},
        onError: () => {},
      })
    );

    // Act
    const menuButton = screen.getByLabelText('Action menu for file: file.txt');
    await user.click(menuButton);
    await user.click(screen.getByText('Rename'));

    const filenameInput = screen.getByLabelText('File name *');
    await user.clear(filenameInput);
    await user.type(filenameInput, 'newname.txt');

    await user.click(screen.getByRole('button', { name: 'Update File' }));

    // Assert
    expect(moveFile).toHaveBeenCalledWith('path/to/directory/file.txt', 'path/to/directory/newname.txt');
  });
});
