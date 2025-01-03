import { getAllByRole, getByRole, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as clipboard from 'clipboard-polyfill/text';
import { useState } from 'react';
import { h } from 'react-hyperscript-helpers';
import { basename } from 'src/components/file-browser/file-browser-utils';
import FilesTable, { FilesTableProps } from 'src/components/file-browser/FilesTable';
import { FileBrowserDirectory, FileBrowserFile } from 'src/libs/ajax/file-browser-providers/FileBrowserProvider';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

type ClipboardPolyfillExports = typeof import('clipboard-polyfill/text');
jest.mock('clipboard-polyfill/text', (): ClipboardPolyfillExports => {
  const actual = jest.requireActual<ClipboardPolyfillExports>('clipboard-polyfill/text');
  return {
    ...actual,
    writeText: jest.fn().mockResolvedValue(undefined),
  };
});

// FileBrowserTable uses react-virtualized's AutoSizer to size the table.
// This makes the virtualized window large enough for all rows/columns to be rendered in tests.
jest.mock('react-virtualized', () => ({
  ...jest.requireActual('react-virtualized'),
  AutoSizer: ({ children }) => children({ width: 1000, height: 1000 }),
}));

describe('FilesTable', () => {
  const directories: FileBrowserDirectory[] = [
    {
      path: 'path/to/folder1/',
    },
    {
      path: 'path/to/folder2/',
    },
  ];

  const files: FileBrowserFile[] = [
    {
      path: 'path/to/file1.txt',
      url: 'gs://test-bucket/path/to/file1.txt',
      contentType: 'text/plain',
      size: 1024,
      createdAt: 1667408400000,
      updatedAt: 1667408400000,
    },
    {
      path: 'path/to/file2.bam',
      url: 'gs://test-bucket/path/to/file2.bam',
      contentType: 'application/octet-stream',
      size: 1024 ** 2,
      createdAt: 1667410200000,
      updatedAt: 1667410200000,
    },
    {
      path: 'path/to/file3.vcf',
      url: 'gs://test-bucket/path/to/file3.vcf',
      contentType: 'application/octet-stream',
      size: 1024 ** 3,
      createdAt: 1667412000000,
      updatedAt: 1667412000000,
    },
  ];

  it('renders a column with size information', () => {
    // Act
    render(
      h(FilesTable, {
        directories,
        files,
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickDirectory: jest.fn(),
        onClickFile: jest.fn(),
        onRenameFile: () => {},
      })
    );

    const tableRows = screen.getAllByRole('row').slice(1); // skip header row
    const cellsInColumn = tableRows.map((row) => getAllByRole(row, 'cell')[2]);
    const valuesInColumn = cellsInColumn.map((cell) => cell.textContent);

    // Assert
    expect(valuesInColumn).toEqual(['--', '--', '1 KB', '1 MB', '1 GB']);
  });

  it('renders file names as links', () => {
    // Act
    render(
      h(FilesTable, {
        directories,
        files,
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickDirectory: jest.fn(),
        onClickFile: jest.fn(),
        onRenameFile: () => {},
      })
    );

    const tableRows = screen.getAllByRole('row').slice(3); // skip header row and directories
    const nameCells = tableRows.map((row) => getAllByRole(row, 'cell')[1]);
    const links = nameCells.map((cell) => getByRole(cell, 'link'));

    // Assert
    expect(links.map((link) => link.textContent)).toEqual(['file1.txt', 'file2.bam', 'file3.vcf']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'gs://test-bucket/path/to/file1.txt',
      'gs://test-bucket/path/to/file2.bam',
      'gs://test-bucket/path/to/file3.vcf',
    ]);
  });

  it('renders a button to copy file URL to clipboard', async () => {
    // Arrange
    const user = userEvent.setup();

    render(
      h(FilesTable, {
        directories,
        files,
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickDirectory: jest.fn(),
        onClickFile: jest.fn(),
        onRenameFile: () => {},
      })
    );

    // Act
    const thirdRow = screen.getAllByRole('row')[3]; // skip header row and directories
    const copyUrlButton = within(thirdRow).getByLabelText('Copy file URL to clipboard');
    await user.click(copyUrlButton);

    // Assert
    expect(clipboard.writeText).toHaveBeenCalledWith('gs://test-bucket/path/to/file1.txt');
  });

  it('calls onClickDirectory callback when a directory link is clicked', async () => {
    // Arrange
    const user = userEvent.setup();

    const onClickDirectory = jest.fn();
    render(
      h(FilesTable, {
        directories,
        files,
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickDirectory,
        onClickFile: jest.fn(),
        onRenameFile: () => {},
      })
    );

    const tableRows = screen.getAllByRole('row').slice(1, 3); // skip header row and files
    const nameCells = tableRows.map((row) => getAllByRole(row, 'cell')[1]);
    const links = nameCells.map((cell) => getByRole(cell, 'button'));

    // Act
    await user.click(links[0]);
    await user.click(links[1]);

    // Assert
    expect(onClickDirectory).toHaveBeenCalledTimes(2);
    expect(onClickDirectory.mock.calls.map((call) => call[0])).toEqual([
      {
        path: 'path/to/folder1/',
      },
      {
        path: 'path/to/folder2/',
      },
    ]);
  });

  it('calls onClickFile callback when a file link is clicked', async () => {
    // Arrange
    const user = userEvent.setup();

    const onClickFile = jest.fn();
    render(
      h(FilesTable, {
        directories,
        files,
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickDirectory: jest.fn(),
        onClickFile,
        onRenameFile: () => {},
      })
    );

    const tableRows = screen.getAllByRole('row').slice(3); // skip header row and directories
    const nameCells = tableRows.map((row) => getAllByRole(row, 'cell')[1]);
    const links = nameCells.map((cell) => getByRole(cell, 'link'));

    // Act
    await user.click(links[0]);
    await user.click(links[1]);

    // Assert
    expect(onClickFile).toHaveBeenCalledTimes(2);
    expect(onClickFile.mock.calls.map((call) => call[0])).toEqual([
      {
        path: 'path/to/file1.txt',
        url: 'gs://test-bucket/path/to/file1.txt',
        contentType: 'text/plain',
        size: 1024,
        createdAt: 1667408400000,
        updatedAt: 1667408400000,
      },
      {
        path: 'path/to/file2.bam',
        url: 'gs://test-bucket/path/to/file2.bam',
        contentType: 'application/octet-stream',
        size: 1024 ** 2,
        createdAt: 1667410200000,
        updatedAt: 1667410200000,
      },
    ]);
  });

  describe('file action menu', () => {
    it('calls onRenameFile when rename is clicked', async () => {
      // Arrange
      const user = userEvent.setup();

      const onRenameFile = jest.fn();
      render(
        h(FilesTable, {
          directories,
          files,
          selectedFiles: {},
          setSelectedFiles: () => {},
          onClickDirectory: jest.fn(),
          onClickFile: () => {},
          onRenameFile,
        })
      );

      // Act
      const menuButton = screen.getByLabelText('Action menu for file: file1.txt');
      await user.click(menuButton);
      await user.click(screen.getByText('Rename'));

      // Assert
      expect(onRenameFile).toHaveBeenCalledWith(files[0]);
    });
  });

  describe('selected files', () => {
    // Arrange
    const user = userEvent.setup();

    type TestComponentProps = Omit<FilesTableProps, 'selectedFiles' | 'setSelectedFiles'> & {
      initialSelectedFiles: FilesTableProps['selectedFiles'];
    };

    const TestComponent = ({ initialSelectedFiles, ...otherProps }: TestComponentProps) => {
      const [selectedFiles, setSelectedFiles] = useState<{ [path: string]: FileBrowserFile }>(initialSelectedFiles);

      return h(FilesTable, {
        ...otherProps,
        selectedFiles,
        setSelectedFiles,
      });
    };

    beforeEach(() => {
      render(
        h(TestComponent, {
          initialSelectedFiles: { [files[0].path]: files[0] },
          directories,
          files,
          onClickDirectory: jest.fn(),
          onClickFile: () => {},
          onRenameFile: () => {},
        })
      );
    });

    it('renders a checkbox for selected files', () => {
      // Assert
      const fileCheckboxes = files.map((file) => screen.getByLabelText(`Select ${basename(file.path)}`));
      expect(fileCheckboxes.map((checkbox) => checkbox.getAttribute('aria-checked'))).toEqual([
        'true',
        'false',
        'false',
      ]);
    });

    it('selects/unselects file when checkbox is checked/unchecked', async () => {
      // Act
      const file1Checkbox = screen.getByLabelText(`Select ${basename(files[0].path)}`);
      const file2Checkbox = screen.getByLabelText(`Select ${basename(files[1].path)}`);

      await user.click(file1Checkbox);
      await user.click(file2Checkbox);

      // Assert
      expect(file1Checkbox.getAttribute('aria-checked')).toBe('false');
      expect(file2Checkbox.getAttribute('aria-checked')).toBe('true');
    });

    it('renders a checkbox for selecting all files', async () => {
      // Act
      const selectAllCheckbox = screen.getByLabelText('Select all files');
      await user.click(selectAllCheckbox);

      // Assert
      const fileCheckboxes = files.map((file) => screen.getByLabelText(`Select ${basename(file.path)}`));
      expect(fileCheckboxes.map((checkbox) => checkbox.getAttribute('aria-checked'))).toEqual(['true', 'true', 'true']);
    });
  });
});
