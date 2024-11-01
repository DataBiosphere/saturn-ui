import { Modal } from '@terra-ui-packages/components';
import { subscribable } from '@terra-ui-packages/core-utils';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import DirectoryTree from 'src/components/file-browser/DirectoryTree';
import { basename, dirname } from 'src/components/file-browser/file-browser-utils';
import { FileDetails } from 'src/components/file-browser/FileDetails';
import FilesInDirectory from 'src/components/file-browser/FilesInDirectory';
import PathBreadcrumbs from 'src/components/file-browser/PathBreadcrumbs';
import FileBrowserProvider, {
  FileBrowserDirectory,
  FileBrowserFile,
} from 'src/libs/ajax/file-browser-providers/FileBrowserProvider';
import colors from 'src/libs/colors';
import { requesterPaysProjectStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { dataTableVersionsPathRoot } from 'src/workspace-data/data-table/versioning/data-table-versioning-utils';
import { RequesterPaysModal } from 'src/workspaces/common/requester-pays/RequesterPaysModal';
import * as WorkspaceUtils from 'src/workspaces/utils';

interface FileBrowserProps {
  initialPath?: string;
  provider: FileBrowserProvider;
  rootLabel: string;
  title: any;
  workspace: any; // TODO: Type for workspace
  onChangePath?: (newPath: string) => void;
  extraMenuItems?: any;
}

const FileBrowser = (props: FileBrowserProps) => {
  const { initialPath = '', provider, rootLabel, title, workspace, onChangePath, extraMenuItems } = props;

  const [path, _setPath] = useState(initialPath);
  const setPath = useCallback(
    (newPath: string) => {
      _setPath(newPath);
      onChangePath?.(newPath);
    },
    [onChangePath]
  );

  // refreshKey is a hack to make hooks in DirectoryTree and FilesInDirectory reload
  // after selecting a workspace to bill requester pays request to.
  const [refreshKey, setRefreshKey] = useState(0);

  const [focusedFile, setFocusedFile] = useState<FileBrowserFile | null>(null);

  const [selectedFiles, setSelectedFiles] = useState<{ [path: string]: FileBrowserFile }>({});
  useEffect(() => {
    setSelectedFiles({});
  }, [path]);

  const [showRequesterPaysModal, setShowRequesterPaysModal] = useState(false);
  const onError = useCallback((error: Error) => {
    if ((error as any).requesterPaysError) {
      setShowRequesterPaysModal(true);
    }
  }, []);

  const { editDisabled, editDisabledReason } = (({ value, message }) =>
    Utils.cond<{
      editDisabled: boolean;
      editDisabledReason: string | undefined;
    }>(
      [!value, () => ({ editDisabled: true, editDisabledReason: message })],
      [
        path.startsWith(`${dataTableVersionsPathRoot}/`),
        () => ({
          editDisabled: true,
          editDisabledReason: 'This folder is managed by data table versioning and cannot be edited here.',
        }),
      ],
      () => ({ editDisabled: false, editDisabledReason: undefined })
    ))(WorkspaceUtils.canEditWorkspace(workspace));

  const reloadRequests = subscribable();

  return h(Fragment, [
    div({ style: { display: 'flex', height: '100%' } }, [
      div(
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            width: 300,
            height: '100%',
            borderRight: `0.5px solid ${colors.dark(0.2)}`,
          },
        },
        [
          div(
            {
              style: {
                padding: '1rem 0.5rem',
                borderBottom: `0.5px solid ${colors.dark(0.2)}`,
                backgroundColor: colors.light(0.4),
              },
            },
            [title]
          ),
          div(
            {
              style: {
                flex: '1 0 0',
                overflow: 'hidden auto',
                background: '#fff',
              },
            },
            [
              h(DirectoryTree, {
                key: refreshKey,
                provider,
                reloadRequests,
                rootLabel,
                selectedDirectory: path,
                onError,
                onSelectDirectory: (selectedDirectoryPath) => {
                  setPath(selectedDirectoryPath);
                },
              }),
            ]
          ),
        ]
      ),
      div(
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            flex: '1 0 0',
          },
        },
        [
          div(
            {
              style: {
                display: 'flex',
                flexFlow: 'row wrap',
                alignItems: 'center',
                width: '100%',
                padding: '0.5rem',
                borderBottom: `0.5px solid ${colors.dark(0.2)}`,
                backgroundColor: colors.light(0.4),
              },
            },
            [
              h(PathBreadcrumbs, {
                path,
                rootLabel,
                onClickPath: setPath,
              }),
            ]
          ),
          h(FilesInDirectory, {
            key: refreshKey,
            editDisabled,
            editDisabledReason,
            provider,
            path,
            rootLabel,
            selectedFiles,
            setSelectedFiles,
            onClickFile: setFocusedFile,
            onCreateDirectory: (directory: FileBrowserDirectory) => {
              setPath(directory.path);
              const parentPath = dirname(directory.path);
              reloadRequests.next(parentPath);
            },
            onDeleteDirectory: () => {
              const parentPath = dirname(path);
              setPath(parentPath);
              reloadRequests.next(parentPath);
            },
            onError,
            extraMenuItems,
          }),
        ]
      ),
    ]),

    focusedFile &&
      h(
        Modal,
        {
          showCancel: false,
          title: basename(focusedFile.path),
          onDismiss: () => setFocusedFile(null),
        },
        [h(FileDetails, { file: focusedFile, provider })]
      ),

    showRequesterPaysModal &&
      h(RequesterPaysModal, {
        onDismiss: () => setShowRequesterPaysModal(false),
        onSuccess: (selectedGoogleProject) => {
          requesterPaysProjectStore.set(selectedGoogleProject);
          setShowRequesterPaysModal(false);
          setRefreshKey((k) => k + 1);
        },
      }),
  ]);
};

export default FileBrowser;
