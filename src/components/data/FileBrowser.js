import filesize from 'filesize';
import _ from 'lodash/fp';
import pluralize from 'pluralize';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { div, h, span } from 'react-hyperscript-helpers';
import { AutoSizer } from 'react-virtualized';
import { ClipboardButton } from 'src/components/ClipboardButton';
import { ButtonOutline, ButtonPrimary, Checkbox, DeleteConfirmationModal, Link, topSpinnerOverlay } from 'src/components/common';
import Dropzone from 'src/components/Dropzone';
import { icon } from 'src/components/icons';
import { NameModal } from 'src/components/NameModal';
import { UploadProgressModal } from 'src/components/ProgressBar';
import { FlexTable, HeaderCell, TextCell } from 'src/components/table';
import { GoogleStorage } from 'src/libs/ajax/GoogleStorage';
import colors from 'src/libs/colors';
import { reportError, withErrorReporting } from 'src/libs/error';
import { useCancelable } from 'src/libs/react-utils';
import { requesterPaysProjectStore } from 'src/libs/state';
import { useUploader } from 'src/libs/uploads';
import * as Utils from 'src/libs/utils';
import { UriViewer } from 'src/workspace-data/data-table/uri-viewer/UriViewer';
import { RequesterPaysModal } from 'src/workspaces/common/requester-pays/RequesterPaysModal';
import * as WorkspaceUtils from 'src/workspaces/utils';

const useBucketContents = ({ googleProject, bucketName, prefix, pageSize = 1000 }) => {
  const [allObjects, setAllObjects] = useState([]);
  const [allPrefixes, setAllPrefixes] = useState([]);
  const nextPageToken = useRef(null);
  const [moreToLoad, setMoreToLoad] = useState(false);

  const requestInProgress = useRef(null);
  const { signal, abort } = useCancelable();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadNextPage = useCallback(async () => {
    if (requestInProgress.current) {
      return requestInProgress.current;
    }

    setLoading(true);
    setError(null);
    try {
      const requestOptions = { maxResults: pageSize };
      if (nextPageToken.current) {
        requestOptions.pageToken = nextPageToken.current;
      }

      const {
        items: pageObjects,
        prefixes: pagePrefixes,
        nextPageToken: pageNextPageToken,
      } = await GoogleStorage(signal).list(googleProject, bucketName, prefix, requestOptions);

      // _.remove({ name: prefix }) filters out folder placeholder objects.
      // See https://cloud.google.com/storage/docs/folders for more information.
      setAllObjects((prevObjects) => _.flow(_.defaultTo([]), _.remove({ name: prefix }), _.concat(prevObjects))(pageObjects));
      setAllPrefixes((prevPrefixes) => _.concat(prevPrefixes, _.defaultTo([], pagePrefixes)));
      nextPageToken.current = pageNextPageToken;
      setMoreToLoad(Boolean(nextPageToken.current));
    } catch (err) {
      if (!err.requesterPaysError) {
        reportError('Error loading bucket contents', err);
      }
      setError(err);
    } finally {
      setLoading(false);
      requestInProgress.current = null;
    }
  }, [googleProject, bucketName, prefix, pageSize, signal]);

  const loadAllRemaining = useCallback(async () => {
    while (nextPageToken.current) {
      await loadNextPage();
    }
  }, [loadNextPage]);

  const reload = useCallback(() => {
    if (requestInProgress.current) {
      abort();
      requestInProgress.current = null;
    }

    setAllObjects([]);
    setAllPrefixes([]);
    nextPageToken.current = null;
    setMoreToLoad(false);

    loadNextPage();
  }, [abort, loadNextPage]);

  // We want to reload if the Google project, bucket, prefix, or page size changes.
  // The effect function does not use the reload function directly because the effect function closes
  // over the current value of reload and reload may be recreated (useCallback memoizes the function
  // but does not guarantee that it won't change). Using a ref lets us get the current reload function
  // without having to recreate the effect function.
  const reloadRef = useRef();
  reloadRef.current = reload;
  useEffect(() => {
    reloadRef.current();
  }, [googleProject, bucketName, prefix, pageSize]);

  return {
    loading,
    error,
    objects: allObjects,
    prefixes: allPrefixes,
    moreToLoad,
    loadNextPage,
    loadAllRemaining,
    reload,
  };
};

const getLabelForObject = (object) => {
  return _.last(_.split('/', object.name));
};

const getLabelForPrefix = (prefix) => {
  // prefixes have a trailing slash, so display the next to last item of the split array.
  return `${_.flow(_.split('/'), _.slice(-2, -1), _.first)(prefix)}/`;
};

const DeleteObjectsConfirmationModal = ({ objects, ...props }) => {
  const numObjects = _.size(objects);
  return h(
    DeleteConfirmationModal,
    {
      ...props,
      title: `Delete ${pluralize('object', numObjects, true)}`,
      buttonText: `Delete ${numObjects === 1 ? 'object' : 'objects'}`,
    },
    [
      // Size the scroll container to cut off the last row to hint that there's more content to be scrolled into view
      // Row height calculation is font size * line height + padding + border
      div(
        { style: { maxHeight: 'calc((1em * 1.15 + 1rem + 1px) * 10.5)', overflowY: 'auto', margin: '0 -1.25rem' } },
        _.map(
          ([i, object]) =>
            div(
              {
                style: {
                  borderTop: i === 0 ? undefined : `1px solid ${colors.light()}`,
                  padding: '0.5rem 1.25rem',
                },
              },
              getLabelForObject(object)
            ),
          Utils.toIndexPairs(objects)
        )
      ),
    ]
  );
};

const BucketBrowserTable = ({
  bucketName,
  objects = [],
  prefixes = [],
  selectedObjects,
  setSelectedObjects,
  noObjectsMessage,
  onClickPrefix,
  onClickObject,
}) => {
  const allItems = _.sortBy(
    'label',
    _.concat(
      _.map((object) => ({ object, label: getLabelForObject(object) }), objects),
      _.map((prefix) => ({ prefix, label: getLabelForPrefix(prefix) }), prefixes)
    )
  );

  const allObjectsSelected = _.size(objects) > 0 && _.every((object) => _.has(object.name, selectedObjects), objects);

  return div({ style: { display: 'flex', flex: '1 1 auto' } }, [
    h(AutoSizer, {}, [
      ({ width, height }) =>
        h(FlexTable, {
          'aria-label': 'File browser',
          width,
          height,
          rowCount: _.size(allItems),
          noContentMessage: noObjectsMessage,
          styleCell: () => ({ padding: '0.5em', borderRight: 'none', borderLeft: 'none' }),
          styleHeader: () => ({ padding: '0.5em', borderRight: 'none', borderLeft: 'none' }),
          hoverHighlight: true,
          border: false,
          columns: [
            {
              size: { min: 40, grow: 0 },
              headerRenderer: () => {
                return div({ style: { flex: 1, textAlign: 'center' } }, [
                  h(Checkbox, {
                    checked: allObjectsSelected,
                    disabled: _.isEmpty(allItems),
                    onChange: allObjectsSelected
                      ? () => setSelectedObjects({})
                      : () => setSelectedObjects(_.fromPairs(_.map((object) => [object.name, object], objects))),
                    'aria-label': 'Select all',
                  }),
                ]);
              },
              cellRenderer: ({ rowIndex }) => {
                const { object, prefix, label } = allItems[rowIndex];
                return div({ style: { flex: 1, textAlign: 'center' } }, [
                  Utils.cond(
                    [
                      object,
                      () => {
                        const checked = _.has([object.name], selectedObjects);
                        return h(Checkbox, {
                          'aria-label': label,
                          checked,
                          onChange: () => setSelectedObjects(checked ? _.unset([object.name]) : _.set([object.name], object)),
                        });
                      },
                    ],
                    [
                      prefix,
                      () => {
                        return icon('folder-open', { size: 16, 'aria-label': 'folder' });
                      },
                    ]
                  ),
                ]);
              },
            },
            {
              size: { min: 100, grow: 1 },
              headerRenderer: () => h(HeaderCell, ['Name']),
              cellRenderer: ({ rowIndex }) => {
                const { object, prefix, label } = allItems[rowIndex];
                return h(TextCell, [
                  Utils.cond(
                    [
                      object,
                      () => {
                        return h(Fragment, [
                          h(
                            Link,
                            {
                              style: { textDecoration: 'underline' },
                              href: `gs://${bucketName}/${object.name}`,
                              onClick: (e) => {
                                e.preventDefault();
                                onClickObject(object);
                              },
                            },
                            [label]
                          ),
                          h(ClipboardButton, {
                            tooltip: 'Copy file URL to clipboard',
                            className: 'cell-hover-only',
                            style: { marginLeft: '1rem', display: 'inline' },
                            text: `gs://${bucketName}/${object.name}`,
                            iconSize: 14, // See this PR for reason: https://github.com/DataBiosphere/terra-ui/pull/4288
                          }),
                        ]);
                      },
                    ],
                    [
                      prefix,
                      () => {
                        return h(
                          Link,
                          {
                            style: { textDecoration: 'underline' },
                            href: `gs://${bucketName}/${prefix}`,
                            onClick: (e) => {
                              e.preventDefault();
                              onClickPrefix(prefix);
                            },
                          },
                          [label]
                        );
                      },
                    ]
                  ),
                ]);
              },
            },
            {
              size: { min: 150, grow: 0 },
              headerRenderer: () => h(HeaderCell, ['Size']),
              cellRenderer: ({ rowIndex }) => {
                const { object } = allItems[rowIndex];
                return object && filesize(object.size, { round: 0 });
              },
            },
            {
              size: { min: 200, grow: 0 },
              headerRenderer: () => h(HeaderCell, ['Last modified']),
              cellRenderer: ({ rowIndex }) => {
                const { object } = allItems[rowIndex];
                return object && Utils.makePrettyDate(object.updated);
              },
            },
          ],
        }),
    ]),
  ]);
};

const BucketBrowser = ({
  workspace,
  basePrefix: inputBasePrefix = '',
  pageSize = 1000,
  noObjectsMessage = 'No files have been uploaded yet',
  allowEditingFolders = true,
  extraMenuItems,
  style,
  controlPanelStyle,
  noticeForPrefix = _.constant(null),
  shouldDisableEditForPrefix = _.constant(false),
  onUploadFiles = _.noop,
  onDeleteFiles = _.noop,
}) => {
  // Normalize base prefix to have a trailing slash.
  const basePrefix = Utils.cond([!inputBasePrefix, () => ''], [inputBasePrefix.endsWith('/'), () => inputBasePrefix], () => `${inputBasePrefix}/`);

  const {
    workspace: { googleProject, bucketName },
  } = workspace;

  const [prefix, setPrefix] = useState(basePrefix);

  const { loading, error, objects, prefixes, moreToLoad, loadNextPage, loadAllRemaining, reload } = useBucketContents({
    googleProject,
    bucketName,
    prefix,
    pageSize,
  });

  const [selectedObjects, setSelectedObjects] = useState({});
  useEffect(() => {
    setSelectedObjects({});
  }, [googleProject, bucketName, prefix]);

  const [showRequesterPaysModal, setShowRequesterPaysModal] = useState(false);
  useEffect(() => {
    if (error && error.requesterPaysError) {
      setShowRequesterPaysModal(true);
    }
  }, [error]);

  const [viewingObject, setViewingObject] = useState(null);

  const { uploadState, uploadFiles, cancelUpload } = useUploader((file, { signal }) => {
    return GoogleStorage(signal).upload(googleProject, bucketName, prefix, file);
  });
  const [creatingNewFolder, setCreatingNewFolder] = useState(false);
  const [deletingSelectedObjects, setDeletingSelectedObjects] = useState(false);
  const [busy, setBusy] = useState(false);

  const { value: canEditWorkspace, message: editWorkspaceError } = WorkspaceUtils.canEditWorkspace(workspace);

  const editDisabledForPrefix = shouldDisableEditForPrefix(prefix);
  const notice = noticeForPrefix(prefix);

  const numPrefixes = _.size(prefixes);
  const numObjects = _.size(objects);

  const breadcrumbPath = prefix.startsWith(basePrefix) ? prefix.slice(basePrefix.length) : prefix;
  // Since prefixes have a trailing slash, the last item in the split array will be an empty string.
  const breadcrumbs = _.flow(_.split('/'), _.dropRight(1))(breadcrumbPath);

  return div({ style: { minHeight: '10rem', ...style } }, [
    h(
      Dropzone,
      {
        disabled: !canEditWorkspace || uploadState.active,
        style: { display: 'flex', flexFlow: 'column nowrap', height: '100%' },
        activeStyle: { backgroundColor: colors.accent(0.2), cursor: 'copy' },
        multiple: true,
        maxFiles: 0, // no limit on number of files
        onDropAccepted: async (files) => {
          await uploadFiles(files);
          reload();
          onUploadFiles();
        },
      },
      [
        ({ openUploader }) =>
          h(Fragment, [
            div(
              {
                style: {
                  display: 'flex',
                  flexFlow: 'row wrap',
                  alignItems: 'center',
                  width: '100%',
                  padding: '0.5rem',
                  borderBottom: `1px solid ${colors.grey(0.4)}`,
                  ...controlPanelStyle,
                },
              },
              [
                h(
                  Link,
                  {
                    style: { padding: '0.5rem', textDecoration: 'underline' },
                    href: `gs://${bucketName}/${basePrefix}`,
                    onClick: (e) => {
                      e.preventDefault();
                      setPrefix(basePrefix);
                    },
                  },
                  [basePrefix ? getLabelForPrefix(basePrefix) : 'Files']
                ),
                _.map(([index, breadcrumb]) => {
                  const breadcrumbPrefix = `${basePrefix}${_.join('/', _.slice(0, index + 1, breadcrumbs))}/`;
                  return h(Fragment, { key: breadcrumbPrefix }, [
                    span({ style: { padding: '0.5rem 0' } }, [' / ']),
                    h(
                      Link,
                      {
                        style: { padding: '0.5rem', textDecoration: 'underline' },
                        href: `gs://${bucketName}/${breadcrumbPrefix}`,
                        onClick: (e) => {
                          e.preventDefault();
                          setPrefix(breadcrumbPrefix);
                        },
                      },
                      [breadcrumb]
                    ),
                  ]);
                }, Utils.toIndexPairs(breadcrumbs)),

                div({ style: { flex: '1 1 auto' } }),

                h(
                  ButtonPrimary,
                  {
                    disabled: !canEditWorkspace || editDisabledForPrefix,
                    tooltip: Utils.cond(
                      [!canEditWorkspace, () => editWorkspaceError],
                      [editDisabledForPrefix, () => 'Files cannot be uploaded to this folder']
                    ),
                    style: { padding: '0.5rem', marginRight: '0.5rem' },
                    onClick: openUploader,
                  },
                  [icon('upload-cloud', { style: { marginRight: '1ch' } }), ' Upload']
                ),

                allowEditingFolders &&
                  h(
                    Link,
                    {
                      disabled: !canEditWorkspace || editDisabledForPrefix,
                      tooltip: Utils.cond(
                        [!canEditWorkspace, () => editWorkspaceError],
                        [editDisabledForPrefix, () => 'Folders cannot be added to this folder']
                      ),
                      style: { padding: '0.5rem' },
                      onClick: () => setCreatingNewFolder(true),
                    },
                    [icon('folder'), ' New folder']
                  ),

                h(
                  Link,
                  {
                    disabled: !canEditWorkspace || editDisabledForPrefix || _.isEmpty(selectedObjects),
                    tooltip: Utils.cond(
                      [!canEditWorkspace, () => editWorkspaceError],
                      [editDisabledForPrefix, () => 'Files in this folder cannot be deleted'],
                      [_.isEmpty(selectedObjects), () => 'Select files to delete'],
                      () => 'Delete selected files'
                    ),
                    style: { padding: '0.5rem' },
                    onClick: () => setDeletingSelectedObjects(true),
                  },
                  [icon('trash'), ' Delete']
                ),

                extraMenuItems,
              ]
            ),

            notice && div({ style: { padding: '1rem', background: colors.accent(0.2) } }, [notice]),

            h(BucketBrowserTable, {
              bucketName,
              objects,
              prefixes,
              noObjectsMessage: Utils.cond(
                [loading, () => 'Loading bucket contents...'],
                [error, () => 'Unable to load bucket contents'],
                [
                  !!prefix && prefix !== basePrefix && allowEditingFolders,
                  () =>
                    div(
                      {
                        style: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
                      },
                      [
                        noObjectsMessage,
                        h(
                          ButtonOutline,
                          {
                            style: { marginTop: '1rem', textTransform: 'none' },
                            onClick: Utils.withBusyState(setBusy, async () => {
                              // Attempt to delete folder placeholder object.
                              // A placeholder object may not exist for the prefix being viewed, so do not an report error for 404 responses.
                              // See https://cloud.google.com/storage/docs/folders for more information on placeholder objects.
                              try {
                                await GoogleStorage().delete(googleProject, bucketName, prefix);
                              } catch (error) {
                                if (error.status !== 404) {
                                  reportError('Error deleting folder', error);
                                }
                              }

                              // Since prefixes have a trailing slash, the last item in the split array will be an empty string.
                              // Dropping the last two items returns the parent "folder".
                              const parentPrefix = _.flow(_.split('/'), _.dropRight(2), _.join('/'))(prefix);
                              setPrefix(parentPrefix === '' ? '' : `${parentPrefix}/`);
                            }),
                          },
                          ['Delete this folder']
                        ),
                      ]
                    ),
                ],
                () => noObjectsMessage
              ),
              selectedObjects,
              setSelectedObjects,
              onClickPrefix: setPrefix,
              onClickObject: setViewingObject,
            }),

            moreToLoad &&
              div({ style: { padding: '1rem', borderTop: `1px solid ${colors.light()}` } }, [
                `Showing ${numPrefixes + numObjects} results.`,
                h(
                  Link,
                  {
                    style: { marginLeft: '1ch' },
                    onClick: () => loadNextPage(),
                  },
                  [`Load next ${pageSize}`]
                ),
                h(
                  Link,
                  {
                    style: { marginLeft: '1ch' },
                    tooltip: 'This may take a long time for folders containing several thousand objects.',
                    onClick: () => loadAllRemaining(),
                  },
                  ['Load all']
                ),
              ]),

            viewingObject &&
              h(UriViewer, {
                workspace,
                uri: `gs://${bucketName}/${viewingObject.name}`,
                onDismiss: () => setViewingObject(null),
              }),

            uploadState.active &&
              h(UploadProgressModal, {
                status: uploadState,
                abort: cancelUpload,
              }),

            creatingNewFolder &&
              h(NameModal, {
                thing: 'Folder',
                onDismiss: () => setCreatingNewFolder(false),
                onSuccess: _.flow(
                  Utils.withBusyState(setBusy),
                  withErrorReporting('Error creating folder')
                )(async ({ name }) => {
                  setCreatingNewFolder(false);

                  // Create a placeholder object for the new folder.
                  // See https://cloud.google.com/storage/docs/folders for more information.
                  const placeholderObject = new File([''], `${name}/`, { type: 'text/plain' });
                  await GoogleStorage().upload(googleProject, bucketName, prefix, placeholderObject);

                  setPrefix(`${prefix}${name}/`);
                }),
              }),

            deletingSelectedObjects &&
              h(DeleteObjectsConfirmationModal, {
                objects: _.values(selectedObjects),
                onConfirm: async () => {
                  setDeletingSelectedObjects(false);
                  setBusy(true);
                  try {
                    await Promise.all(_.map((object) => GoogleStorage().delete(googleProject, bucketName, object.name), _.values(selectedObjects)));
                  } catch (error) {
                    reportError('Error deleting objects', error);
                  } finally {
                    setBusy(false);
                    setSelectedObjects({});
                    reload();
                    onDeleteFiles();
                  }
                },
                onDismiss: () => setDeletingSelectedObjects(false),
              }),

            showRequesterPaysModal &&
              h(RequesterPaysModal, {
                onDismiss: () => setShowRequesterPaysModal(false),
                onSuccess: (selectedGoogleProject) => {
                  requesterPaysProjectStore.set(selectedGoogleProject);
                  setShowRequesterPaysModal(false);
                  reload();
                },
              }),

            (loading || busy) && topSpinnerOverlay,
          ]),
      ]
    ),
  ]);
};

export default BucketBrowser;
