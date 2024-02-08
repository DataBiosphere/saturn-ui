import { getAllByRole, getByRole, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as clipboard from 'clipboard-polyfill/text';
import { useState } from 'react';
import { h } from 'react-hyperscript-helpers';
import { basename } from 'src/components/file-browser/file-browser-utils';
import FilesTable, { FilesTableProps } from 'src/components/file-browser/FilesTable';
import { FileBrowserFile } from 'src/libs/ajax/file-browser-providers/FileBrowserProvider';
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

  it.each([
    { field: 'size', columnIndex: 2, expected: ['1 KB', '1 MB', '1 GB'] },
    // { field: 'last modified', columnIndex: 2, expected: [] }
  ])('renders a column with file $field', ({ columnIndex, expected }) => {
    // Act
    render(
      h(FilesTable, {
        files,
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickFile: jest.fn(),
        onRenameFile: () => {},
      })
    );

    const tableRows = screen.getAllByRole('row').slice(1); // skip header row
    const cellsInColumn = tableRows.map((row) => getAllByRole(row, 'cell')[columnIndex]);
    const valuesInColumn = cellsInColumn.map((cell) => cell.textContent);

    // Assert
    expect(valuesInColumn).toEqual(expected);
  });

  it('renders file names as links', () => {
    // Act
    render(
      h(FilesTable, {
        files,
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickFile: jest.fn(),
        onRenameFile: () => {},
      })
    );

    const tableRows = screen.getAllByRole('row').slice(1); // skip header row
    const fileNameCells = tableRows.map((row) => getAllByRole(row, 'cell')[1]);
    const fileLinks = fileNameCells.map((cell) => getByRole(cell, 'link'));

    // Assert
    expect(fileLinks.map((link) => link.textContent)).toEqual(['file1.txt', 'file2.bam', 'file3.vcf']);
    expect(fileLinks.map((link) => link.getAttribute('href'))).toEqual([
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
        files,
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickFile: jest.fn(),
        onRenameFile: () => {},
      })
    );

    // Act
    const firstRow = screen.getAllByRole('row')[1]; // skip header row
    const copyUrlButton = within(firstRow).getByLabelText('Copy file URL to clipboard');
    await user.click(copyUrlButton);

    // Assert
    expect(clipboard.writeText).toHaveBeenCalledWith('gs://test-bucket/path/to/file1.txt');
  });

  it('calls onClickFile callback when a file link is clicked', async () => {
    // Arrange
    const user = userEvent.setup();

    const onClickFile = jest.fn();
    render(
      h(FilesTable, {
        files,
        selectedFiles: {},
        setSelectedFiles: () => {},
        onClickFile,
        onRenameFile: () => {},
      })
    );

    const tableRows = screen.getAllByRole('row').slice(1); // skip header row
    const fileNameCells = tableRows.map((row) => getAllByRole(row, 'cell')[1]);
    const fileLinks = fileNameCells.map((cell) => getByRole(cell, 'link'));

    // Act
    await user.click(fileLinks[0]);
    await user.click(fileLinks[1]);

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
          files,
          selectedFiles: {},
          setSelectedFiles: () => {},
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
          files,
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
