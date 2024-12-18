import { Dispatch, Fragment, ReactNode, SetStateAction, useEffect, useRef, useState } from 'react';
import { div, h, span } from 'react-hyperscript-helpers';
import { ButtonOutline, Link, topSpinnerOverlay } from 'src/components/common';
import Dropzone from 'src/components/Dropzone';
import { useDirectoriesInDirectory, useFilesInDirectory } from 'src/components/file-browser/file-browser-hooks';
import { basename, dirname } from 'src/components/file-browser/file-browser-utils';
import { FilesMenu } from 'src/components/file-browser/FilesMenu';
import FilesTable from 'src/components/file-browser/FilesTable';
import { NoticeForPath } from 'src/components/file-browser/NoticeForPath';
import { icon } from 'src/components/icons';
import { NameModal } from 'src/components/NameModal';
import { UploadProgressModal } from 'src/components/ProgressBar';
import FileBrowserProvider, {
  FileBrowserDirectory,
  FileBrowserFile,
} from 'src/libs/ajax/file-browser-providers/FileBrowserProvider';
import colors from 'src/libs/colors';
import { reportError } from 'src/libs/error';
import { notify } from 'src/libs/notifications';
import { useOnUploadFinished, useUploader } from 'src/libs/uploads';
import * as Utils from 'src/libs/utils';
import { dataTableVersionsPathRoot } from 'src/workspace-data/data-table/versioning/data-table-versioning-utils';

interface FilesInDirectoryProps {
  editDisabled?: boolean;
  editDisabledReason?: string;
  provider: FileBrowserProvider;
  path: string;
  rootLabel?: string;
  selectedFiles: { [path: string]: FileBrowserFile };
  setSelectedFiles: Dispatch<SetStateAction<{ [path: string]: FileBrowserFile }>>;
  onClickDirectory: (directory: FileBrowserDirectory) => void;
  onClickFile: (file: FileBrowserFile) => void;
  onCreateDirectory: (directory: FileBrowserDirectory) => void;
  onDeleteDirectory: () => void;
  onError: (error: Error) => void;
  extraMenuItems?: any;
}

type FileObjectStatus = 'Loading' | 'Ready' | 'Error';

const FilesInDirectory = (props: FilesInDirectoryProps) => {
  const {
    editDisabled = false,
    editDisabledReason,
    path,
    provider,
    rootLabel = 'Files',
    selectedFiles,
    setSelectedFiles,
    onClickDirectory,
    onClickFile,
    onCreateDirectory,
    onDeleteDirectory,
    onError,
    extraMenuItems,
  } = props;

  const directoryLabel = path === '' ? rootLabel : basename(path);

  const loadedAlertElementRef = useRef<HTMLSpanElement | null>(null);

  const directoriesResults = useDirectoriesInDirectory(provider, path);
  const filesResults = useFilesInDirectory(provider, path);
  const loadNextPage =
    directoriesResults.hasNextPage !== false ? directoriesResults.loadNextPage : filesResults.loadNextPage;

  useEffect(() => {
    if (filesResults.state.status === 'Error') {
      onError(filesResults.state.error);
    }
    if (directoriesResults.state.status === 'Error') {
      onError(directoriesResults.state.error);
    }
  }, [filesResults.state, directoriesResults.state, onError]);

  const { uploadState, uploadFiles, cancelUpload } = useUploader((file) => {
    return provider.uploadFileToDirectory(path, file);
  });
  useOnUploadFinished(uploadState, (finishedUploadState) => {
    finishedUploadState.errors.forEach(({ file, error }) => {
      notify('error', 'Error uploading file', {
        id: 'file-browser-upload-error',
        message: `Failed to upload ${file.name}`,
        detail: error,
      });
    });
  });

  const statusFrom = (fs: FileObjectStatus, ds: FileObjectStatus): FileObjectStatus => {
    if (fs === ds) {
      return fs;
    }
    if (fs === 'Error' || ds === 'Error') {
      return 'Error';
    }
    return 'Loading';
  };

  const { status: directoriesStatus, directories } = directoriesResults.state;
  const { status: filesStatus, files } = filesResults.state;
  const status = statusFrom(filesStatus, directoriesStatus);
  const filesToShow =
    directoriesResults.hasNextPage !== false
      ? 0
      : Math.max(0, files.length - (directories.length % provider.getPageSize()));

  const isLoading = status === 'Loading';

  useEffect(() => {
    loadedAlertElementRef.current!.innerHTML = {
      Loading: '',
      Ready: `Loaded ${directories.length} directories and ${filesToShow} files in ${directoryLabel}`,
      Error: `Error loading files or directories in ${directoryLabel}`,
    }[status];
  }, [directories, directoryLabel, filesToShow, status]);

  const [renamingFile, setRenamingFile] = useState<FileBrowserFile>();

  const [busy, setBusy] = useState(false);

  return div(
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 0 0',
      },
    },
    [
      h(
        Dropzone,
        {
          disabled: editDisabled || uploadState.active,
          style: { display: 'flex', flexFlow: 'column nowrap', height: '100%' },
          activeStyle: { backgroundColor: colors.accent(0.2), cursor: 'copy' },
          multiple: true,
          maxFiles: 0, // no limit on number of files
          onDropAccepted: async (files) => {
            await uploadFiles(files);
            filesResults.reload();
          },
        },
        [
          ({ openUploader }) =>
            h(Fragment, [
              h(FilesMenu, {
                disabled: editDisabled,
                disabledReason: editDisabledReason,
                path,
                provider,
                selectedFiles,
                onClickUpload: openUploader,
                onCreateDirectory,
                onDeleteFiles: () => {
                  setSelectedFiles({});
                  filesResults.reload();
                },
                onRefresh: filesResults.reload,
                extraMenuItems,
              }),

              h(NoticeForPath, {
                notices: {
                  [`${dataTableVersionsPathRoot}/`]: 'Files in this folder are managed via data table versioning.',
                },
                path,
              }),

              span({
                ref: loadedAlertElementRef,
                'aria-live': 'polite',
                className: 'sr-only',
                role: 'alert',
              }),
              status === 'Loading' &&
                span(
                  {
                    'aria-live': 'assertive',
                    className: 'sr-only',
                    role: 'alert',
                  },
                  [`Loading files and directories in ${directoryLabel}`]
                ),

              directories.length + filesToShow > 0 &&
                h(Fragment, [
                  h(FilesTable, {
                    'aria-label': `Files in ${directoryLabel}`,
                    editDisabled,
                    editDisabledReason,
                    files: files.slice(0, filesToShow),
                    directories,
                    selectedFiles,
                    setSelectedFiles,
                    onClickDirectory,
                    onClickFile,
                    onRenameFile: setRenamingFile,
                  }),
                  div(
                    {
                      style: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        borderTop: `1px solid ${colors.dark(0.2)}`,
                        background: '#fff',
                      },
                    },
                    [
                      div([
                        `${directories.length} directories and ${filesToShow} files `,
                        isLoading && h(Fragment, ['Loading more... ', icon('loadingSpinner', { size: 12 })]),
                      ]),
                      (directoriesResults.hasNextPage !== false || filesResults.hasNextPage !== false) &&
                        div([
                          h(
                            Link,
                            {
                              disabled: isLoading,
                              style: { marginLeft: '1ch' },
                              onClick: () => loadNextPage(),
                            },
                            ['Load next page']
                          ),
                          h(
                            Link,
                            {
                              disabled: isLoading,
                              style: { marginLeft: '1ch' },
                              tooltip: 'This may take a long time for folders containing several thousand objects.',
                              onClick: () => {
                                directoriesResults.loadAllRemainingItems();
                                filesResults.loadAllRemainingItems();
                              },
                            },
                            ['Load all']
                          ),
                        ]),
                    ]
                  ),
                ]),

              directories.length + filesToShow === 0 &&
                div(
                  {
                    style: {
                      marginTop: '1rem',
                      fontStyle: 'italic',
                      textAlign: 'center',
                    },
                  },
                  [
                    Utils.cond<ReactNode>(
                      [status === 'Loading', () => 'Loading...'],
                      [status === 'Error', () => 'Unable to load'],
                      () =>
                        h(Fragment, [
                          div(['No files have been uploaded yet']),
                          path !== '' &&
                            h(
                              ButtonOutline,
                              {
                                style: { marginTop: '1rem', textTransform: 'none' },
                                onClick: async () => {
                                  // Attempt to delete folder placeholder object.
                                  // A placeholder object may not exist for the prefix being viewed, so do not an report error for 404 responses.
                                  // See https://cloud.google.com/storage/docs/folders for more information on placeholder objects.
                                  setBusy(true);
                                  try {
                                    await provider.deleteEmptyDirectory(path);
                                    setBusy(false);
                                    onDeleteDirectory();
                                  } catch (error) {
                                    setBusy(false);
                                    reportError('Error deleting folder', error);
                                  }
                                },
                              },
                              ['Delete this folder']
                            ),
                        ])
                    ),
                  ]
                ),
            ]),
        ]
      ),

      renamingFile &&
        h(NameModal, {
          thing: 'File',
          value: basename(renamingFile.path),
          // @ts-expect-error
          validator: /^[^\s/#*?\[\]]+$/, // eslint-disable-line no-useless-escape
          validationMessage:
            'File name may not contain spaces, forward slashes, or any of the following characters: # * ? [ ]',
          onDismiss: () => setRenamingFile(undefined),
          onSuccess: async ({ name }) => {
            setRenamingFile(undefined);
            setBusy(true);

            const destinationPath = `${dirname(renamingFile.path)}${name}`;
            try {
              await provider.moveFile(renamingFile.path, destinationPath);
              filesResults.reload();
            } catch (error) {
              reportError('Error renaming file', error);
            } finally {
              setBusy(false);
            }
          },
        }),

      uploadState.active &&
        h(UploadProgressModal, {
          status: uploadState,
          abort: cancelUpload,
        }),

      busy && topSpinnerOverlay,
    ]
  );
};

export default FilesInDirectory;
