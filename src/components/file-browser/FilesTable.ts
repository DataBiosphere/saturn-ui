import { icon } from '@terra-ui-packages/components';
import filesize from 'filesize';
import React, { Dispatch, Fragment, SetStateAction } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import { AutoSizer } from 'react-virtualized';
import { ClipboardButton } from 'src/components/ClipboardButton';
import { Checkbox, Link } from 'src/components/common';
import { basename } from 'src/components/file-browser/file-browser-utils';
import { FileMenu } from 'src/components/file-browser/FileMenu';
import { FlexTable, HeaderCell, TextCell } from 'src/components/table';
import { FileBrowserDirectory, FileBrowserFile } from 'src/libs/ajax/file-browser-providers/FileBrowserProvider';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';

export interface FilesTableProps {
  'aria-label'?: string;
  editDisabled?: boolean;
  editDisabledReason?: string;
  directories: FileBrowserDirectory[];
  files: FileBrowserFile[];
  selectedFiles: { [path: string]: FileBrowserFile };
  setSelectedFiles: Dispatch<SetStateAction<{ [path: string]: FileBrowserFile }>>;
  onClickDirectory: (directory: FileBrowserDirectory) => void;
  onClickFile: (file: FileBrowserFile) => void;
  onRenameFile: (file: FileBrowserFile) => void;
}

const FilesTable = (props: FilesTableProps) => {
  const {
    'aria-label': ariaLabel = 'Files',
    editDisabled = false,
    editDisabledReason,
    directories,
    files,
    selectedFiles,
    setSelectedFiles,
    onClickDirectory,
    onClickFile,
    onRenameFile,
  } = props;

  const allFilesSelected = files.length > 0 && files.every((file) => file.path in selectedFiles);

  return div({ style: { display: 'flex', flex: '1 1 auto' } }, [
    h(AutoSizer, {}, [
      ({ width, height }) =>
        // @ts-expect-error
        h(FlexTable, {
          'aria-label': ariaLabel,
          width,
          height,
          rowCount: files.length + directories.length,
          noContentMessage: ' ',
          styleCell: () => ({ padding: '0.5em', borderRight: 'none', borderLeft: 'none' }),
          styleHeader: () => ({ padding: '0.5em', borderRight: 'none', borderLeft: 'none' }),
          hoverHighlight: true,
          border: false,
          tabIndex: -1,
          columns: [
            {
              size: { min: 40, grow: 0 },
              headerRenderer: () => {
                return div({ style: { flex: 1, textAlign: 'center' } }, [
                  h(Checkbox, {
                    checked: allFilesSelected,
                    disabled: files.length === 0,
                    onChange: allFilesSelected
                      ? () => setSelectedFiles({})
                      : () => setSelectedFiles(Object.fromEntries(files.map((file) => [file.path, file]))),
                    'aria-label': 'Select all files',
                  }),
                ]);
              },
              cellRenderer: ({ rowIndex }) => {
                if (rowIndex < directories.length) {
                  const directory = directories[rowIndex];
                  return h(
                    Link,
                    {
                      style: { flex: 1, textAlign: 'center' },
                      onClick: () => onClickDirectory(directory),
                    },
                    [icon('folderSolid')]
                  );
                }
                const file = files[rowIndex - directories.length];
                const isSelected = file.path in selectedFiles;
                return div({ style: { flex: 1, textAlign: 'center' } }, [
                  h(Checkbox, {
                    'aria-label': `Select ${basename(file.path)}`,
                    checked: isSelected,
                    onChange: () =>
                      isSelected
                        ? setSelectedFiles((previousSelectedFiles) => {
                            const { [file.path]: _file, ...otherFiles } = previousSelectedFiles;
                            return otherFiles;
                          })
                        : setSelectedFiles((previousSelectedFiles) => ({
                            ...previousSelectedFiles,
                            [file.path]: file,
                          })),
                  }),
                ]);
              },
            },
            {
              size: { min: 100, grow: 1 },
              headerRenderer: () => h(HeaderCell, ['Name']),
              cellRenderer: ({ rowIndex }) => {
                if (rowIndex < directories.length) {
                  const directory = directories[rowIndex];
                  return h(
                    Link,
                    {
                      style: {
                        ...(Style.noWrapEllipsis as React.CSSProperties),
                        textDecoration: 'underline',
                      },
                      onClick: (e) => {
                        e.preventDefault();
                        onClickDirectory(directory);
                      },
                    },
                    [basename(directory.path)]
                  );
                }
                const file = files[rowIndex - directories.length];
                return h(Fragment, [
                  h(
                    Link,
                    {
                      href: file.url,
                      style: {
                        ...(Style.noWrapEllipsis as React.CSSProperties),
                        textDecoration: 'underline',
                      },
                      onClick: (e) => {
                        e.preventDefault();
                        onClickFile(file);
                      },
                    },
                    [basename(file.path)]
                  ),
                  h(ClipboardButton, {
                    'aria-label': 'Copy file URL to clipboard',
                    className: 'cell-hover-only',
                    iconSize: 14,
                    text: file.url,
                    tooltip: 'Copy file URL to clipboard',
                    style: { marginLeft: '1ch' },
                  }),
                ]);
              },
            },
            {
              size: { min: 150, grow: 0 },
              headerRenderer: () => h(HeaderCell, ['Size']),
              cellRenderer: ({ rowIndex }) => {
                if (rowIndex < directories.length) {
                  return h(TextCell, ['--']);
                }
                const file = files[rowIndex - directories.length];
                return h(TextCell, [filesize(file.size, { round: 0 })]);
              },
            },
            {
              size: { min: 200, grow: 0 },
              headerRenderer: () => h(HeaderCell, ['Last modified']),
              cellRenderer: ({ rowIndex }) => {
                if (rowIndex < directories.length) {
                  return h(TextCell, ['--']);
                }
                const file = files[rowIndex - directories.length];
                return h(TextCell, [Utils.makePrettyDate(file.updatedAt)]);
              },
            },
            {
              size: { basis: 40, grow: 0, shrink: 0 },
              headerRenderer: () => h(HeaderCell, { className: 'sr-only' }, ['Actions']),
              cellRenderer: ({ rowIndex }) => {
                if (rowIndex < directories.length) {
                  return h(TextCell);
                }
                const file = files[rowIndex - directories.length];
                return h(TextCell, [
                  h(FileMenu, {
                    editDisabled,
                    editDisabledReason,
                    file,
                    onRename: onRenameFile,
                  }),
                ]);
              },
            },
          ],
        }),
    ]),
  ]);
};

export default FilesTable;
