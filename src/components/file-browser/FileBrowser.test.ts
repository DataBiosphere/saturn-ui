import { h } from 'react-hyperscript-helpers';
import { useDirectoriesInDirectory, useFilesInDirectory } from 'src/components/file-browser/file-browser-hooks';
import FileBrowser from 'src/components/file-browser/FileBrowser';
import FilesTable from 'src/components/file-browser/FilesTable';
import FileBrowserProvider, {
  FileBrowserDirectory,
  FileBrowserFile,
} from 'src/libs/ajax/file-browser-providers/FileBrowserProvider';
import { asMockedFn, renderWithAppContexts as render } from 'src/testing/test-utils';
import { RequesterPaysModal } from 'src/workspaces/common/requester-pays/RequesterPaysModal';

jest.mock('src/components/file-browser/file-browser-hooks', () => ({
  ...jest.requireActual('src/components/file-browser/file-browser-hooks'),
  useDirectoriesInDirectory: jest.fn(),
  useFilesInDirectory: jest.fn(),
}));

jest.mock('src/components/file-browser/FilesTable', () => {
  const { div } = jest.requireActual('react-hyperscript-helpers');
  return {
    ...jest.requireActual('src/components/file-browser/FilesTable'),
    __esModule: true,
    default: jest.fn().mockReturnValue(div()),
  };
});

type RequesterPaysModalExports = typeof import('src/workspaces/common/requester-pays/RequesterPaysModal');
jest.mock('src/workspaces/common/requester-pays/RequesterPaysModal', (): RequesterPaysModalExports => {
  const { div } = jest.requireActual('react-hyperscript-helpers');
  return {
    ...jest.requireActual('src/workspaces/common/requester-pays/RequesterPaysModal'),
    RequesterPaysModal: jest.fn().mockReturnValue(div()),
  };
});

type UseDirectoriesInDirectoryResult = ReturnType<typeof useDirectoriesInDirectory>;
type UseFilesInDirectoryResult = ReturnType<typeof useFilesInDirectory>;

describe('FileBrowser', () => {
  const mockFileBrowserProvider: FileBrowserProvider = {} as FileBrowserProvider;

  it('renders files', () => {
    // Arrange
    const directories: FileBrowserDirectory[] = [
      {
        path: 'path/to/folder/',
        url: 'gs://test-bucket/path/to/folder/',
      },
    ];

    const files: FileBrowserFile[] = [
      {
        path: 'file.txt',
        url: 'gs://test-bucket/file.txt',
        contentType: 'text/plain',
        size: 1024,
        createdAt: 1667408400000,
        updatedAt: 1667408400000,
      },
    ];

    const useDirectoriesInDirectoryResult: UseDirectoriesInDirectoryResult = {
      state: { directories, status: 'Ready' },
      hasNextPage: false,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
      state: { files, status: 'Ready' },
      hasNextPage: false,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useDirectoriesInDirectory).mockReturnValue(useDirectoriesInDirectoryResult);
    asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

    // Act
    render(
      h(FileBrowser, {
        provider: mockFileBrowserProvider,
        rootLabel: 'Test bucket',
        title: 'Files',
        workspace: {
          accessLevel: 'WRITER',
          workspace: { isLocked: false },
        },
      })
    );

    // Assert
    expect(FilesTable).toHaveBeenCalledWith(expect.objectContaining({ directories, files }), expect.anything());
  });

  it('prompts to select workspace on requester pays errors', () => {
    // Arrange
    const requesterPaysError = new Error('Requester pays bucket');
    (requesterPaysError as any).requesterPaysError = true;

    const useFilesInDirectoryResult: UseFilesInDirectoryResult = {
      state: { files: [], status: 'Error', error: requesterPaysError },
      hasNextPage: false,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

    // Act
    render(
      h(FileBrowser, {
        provider: mockFileBrowserProvider,
        rootLabel: 'Test bucket',
        title: 'Files',
        workspace: {
          accessLevel: 'WRITER',
          workspace: { isLocked: false },
        },
      })
    );

    // Assert
    expect(RequesterPaysModal).toHaveBeenCalled();
  });
});
