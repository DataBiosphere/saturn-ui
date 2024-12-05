import { ButtonOutline, icon, Modal, Spinner } from '@terra-ui-packages/components';
import filesize from 'filesize';
import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { div, h, p, pre, span } from 'react-hyperscript-helpers';
import { bucketBrowserUrl } from 'src/auth/auth';
import { LabeledRadioButton, LabeledRadioGroup } from 'src/billing/NewBillingProjectWizard/StepWizard/LabeledRadioButton';
import { ClipboardButton } from 'src/components/ClipboardButton';
import Collapse from 'src/components/Collapse';
import { Link } from 'src/components/common';
import { parseGsUri } from 'src/components/data/data-utils';
import { AzureStorage } from 'src/libs/ajax/AzureStorage';
import { DrsUriResolver } from 'src/libs/ajax/drs/DrsUriResolver';
import { GoogleStorage } from 'src/libs/ajax/GoogleStorage';
import colors from 'src/libs/colors';
import { useCancellation, useOnMount, withDisplayName } from 'src/libs/react-utils';
import * as Utils from 'src/libs/utils';
import { requesterPaysWrapper, withRequesterPaysHandler } from 'src/workspaces/common/requester-pays/bucket-utils';

import { FileProvenance } from '../../provenance/FileProvenance';
import els from './uri-viewer-styles';
import { getDownloadCommand, isAzureUri, isGsUri } from './uri-viewer-utils';
import { UriDownloadButton } from './UriDownloadButton';
import { UriPreview } from './UriPreview';

export const UriViewer = _.flow(
  withDisplayName('UriViewer'),
  requesterPaysWrapper({ onDismiss: ({ onDismiss }) => onDismiss() })
)(({ workspace, uri, onDismiss, onRequesterPaysError, isStdLog }) => {
  const {
    workspace: { googleProject },
  } = workspace;

  const signal = useCancellation();
  const [metadata, setMetadata] = useState();
  const [loadingError, setLoadingError] = useState(false);
  const [useFileName, setUseFileName] = useState(true);
  const toggleUseFileName = () => {
    setUseFileName((prevUseFileName) => !prevUseFileName);
  };
  const [isMaximized, setIsMaximized] = useState(false);

  const loadMetadata = async () => {
    try {
      if (isGsUri(uri)) {
        const [bucket, name] = parseGsUri(uri);
        const loadObject = withRequesterPaysHandler(onRequesterPaysError, () => {
          return GoogleStorage(signal).getObject(googleProject, bucket, name);
        });
        const metadata = await loadObject(googleProject, bucket, name);
        setMetadata(metadata);
      } else if (isAzureUri(uri)) {
        const azureMetadata = await AzureStorage(signal).blobByUri(uri).getMetadata();
        setMetadata(azureMetadata);
        setLoadingError(false);
      } else {
        // Fields are mapped from the drshub_v4 fields to those used by google
        // https://github.com/DataBiosphere/terra-drs-hub
        // https://cloud.google.com/storage/docs/json_api/v1/objects#resource-representations
        // The time formats returned are in ISO 8601 vs. RFC 3339 but should be ok for parsing by `new Date()`
        const {
          bucket,
          name,
          size,
          timeCreated,
          timeUpdated: updated,
          fileName,
          accessUrl,
        } = await DrsUriResolver(signal).getDataObjectMetadata(uri, [
          'bucket',
          'name',
          'size',
          'timeCreated',
          'timeUpdated',
          'fileName',
          'accessUrl',
        ]);
        const metadata = { bucket, name, fileName, size, timeCreated, updated, accessUrl };
        setMetadata(metadata);
      }
    } catch (e) {
      // azure blob metadata storage api returns a response and it throws an error when tried to be parsed to json
      // for now just including the statusText as it appears to represent the error that the user should see
      if (isAzureUri(uri)) {
        setLoadingError(`${e.status} : ${e.statusText}`);
      } else {
        setLoadingError(await e.json());
      }
    }
  };

  useOnMount(() => {
    loadMetadata();
  });

  const getAzureStorageUrl = (metadata) => {
    // for public accessible azure storage links the sas token will be undefined
    return metadata.sasToken ? `${uri}?${metadata.sasToken}` : uri;
  };

  const renderTerminalCommand = (metadata) => {
    const { bucket, name } = metadata;
    const gsUri = `gs://${bucket}/${name}`;
    const downloadCommand = isAzureUri(uri)
      ? getDownloadCommand(metadata.name, getAzureStorageUrl(metadata), useFileName, metadata.accessUrl)
      : getDownloadCommand(metadata.name, gsUri, useFileName, metadata.accessUrl);

    return h(Fragment, [
      p({ style: { marginBottom: '0.5rem', fontWeight: 'bold' } }, ['Terminal download command']),
      p({ style: { marginBottom: '0.5rem', fontWeight: 500 } }, ['Download to:']),
      div({ marginBottom: '0.5rem' }, [
        h(LabeledRadioGroup, { style: { marginTop: 0, marginBottom: 0 } }, [
          LabeledRadioButton({
            text: 'Current Directory',
            name: 'current-directory',
            checked: !useFileName,
            onChange: toggleUseFileName,
            labelStyle: { color: 'black', fontWeight: 250 },
          }),
          LabeledRadioButton({
            text: 'New Subdirectory',
            name: 'new-subdirectory',
            checked: useFileName,
            onChange: toggleUseFileName,
            labelStyle: { color: 'black', fontWeight: 250 },
          }),
        ]),
      ]),
      pre(
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            margin: 0,
            padding: '0 0.5rem',
            background: colors.light(0.4),
          },
        },

        [
          span(
            {
              style: {
                overflowX: 'auto',
                flex: '1 1 0',
                padding: '1rem 0',
              },
              tabIndex: 0,
            },
            [downloadCommand || ' ']
          ),
          h(ClipboardButton, {
            'aria-label': 'Copy download URL to clipboard',
            disabled: !downloadCommand,
            style: { marginLeft: '1ch' },
            text: downloadCommand,
          }),
        ]
      ),
    ]);
  };

  const renderFailureMessage = (loadingError) => {
    const errorMsg = isStdLog
      ? 'Log file not found. This may be the result of a task failing to start. Please check relevant docker images and file paths to ensure valid references.'
      : 'Error loading data. This file does not exist or you do not have permission to view it.';
    return loadingError
      ? h(Collapse, { title: 'Details' }, [
          div({ style: { marginTop: '0.5rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', overflowWrap: 'break-word' } }, [
            JSON.stringify(loadingError, null, 2),
          ]),
        ])
      : h(Fragment, [div({ style: { paddingBottom: '1rem' } }, [errorMsg])]);
  };

  const renderMoreInfo = (metadata) => {
    const { timeCreated, updated } = metadata;
    return (
      (timeCreated || updated) &&
      h(
        Collapse,
        {
          title: 'More Information',
          style: { marginTop: '2rem' },
          summaryStyle: { marginBottom: '0.5rem' },
        },
        [
          timeCreated && els.cell([els.label('Created'), els.data(new Date(timeCreated).toLocaleString())]),
          updated && els.cell([els.label('Updated'), els.data(new Date(updated).toLocaleString())]),
          els.cell([els.label('Where did this file come from?'), els.data([h(FileProvenance, { workspace, fileUrl: uri })])]),
        ]
      )
    );
  };

  const renderLoadingSymbol = (uri) =>
    h(Fragment, [isGsUri(uri) || isAzureUri(uri) ? 'Loading metadata...' : 'Resolving DRS file...', h(Spinner, { style: { marginLeft: 4 } })]);

  if (isAzureUri(uri)) {
    const { fileName, size } = metadata || {};
    return h(
      Modal,
      {
        onDismiss,
        title: 'File Details',
        showCancel: false,
        showX: true,
        showButtons: false,
      },
      [
        Utils.cond(
          [loadingError, () => renderFailureMessage()],
          [
            !loadingError && !_.isEmpty(metadata),
            () =>
              h(Fragment, [
                els.cell([
                  els.label('Filename'),
                  els.data((fileName || _.last(name.split('/'))).split('.').join('.\u200B')), // allow line break on periods
                ]),
                h(UriPreview, { metadata, googleProject }),
                div({ style: { display: 'flex', justifyContent: 'space-around' } }, [
                  h(UriDownloadButton, { uri: getAzureStorageUrl(metadata), metadata }),
                ]),
                els.cell([els.label('File size'), els.data(filesize(size))]),
                renderTerminalCommand(metadata),
                renderMoreInfo(metadata),
                !isAzureUri(uri) && div({ style: { fontSize: 10 } }, ['* Estimated. Download cost may be higher in China or Australia.']),
              ]),
          ],
          () => renderLoadingSymbol(uri)
        ),
      ]
    );
  }

  const { size, bucket, name, fileName, accessUrl } = metadata || {};
  const gsUri = `gs://${bucket}/${name}`;
  return h(
    Modal,
    {
      onDismiss,
      title: 'File Details',
      showCancel: false,
      showX: true,
      okButton: 'Done',
      width: '70%',
    },
    [
      Utils.cond(
        [loadingError, () => renderFailureMessage(loadingError)],
        [
          metadata,
          () =>
            h(Fragment, [
              div({ style: { display: 'flex', justifyContent: 'space-between' } }, [
                div({ style: { width: isMaximized ? '25%' : '45%' } }, [
                  // left div with file details
                  els.cell([
                    els.label('Filename'),
                    els.data((fileName || _.last(name.split('/'))).split('.').join('.\u200B')), // allow line break on periods
                  ]),
                  els.cell([els.label('File size'), els.data(filesize(size))]),
                  !accessUrl &&
                    !!gsUri &&
                    els.cell([
                      h(
                        Link,
                        {
                          ...Utils.newTabLinkProps,
                          href: bucketBrowserUrl(gsUri.match(/gs:\/\/(.+)\//)[1]),
                        },
                        ['View this file in the Google Cloud Storage Browser']
                      ),
                    ]),
                  h(UriDownloadButton, { uri, metadata, accessUrl, workspace }),
                  renderTerminalCommand(metadata),
                  renderMoreInfo(metadata),
                  div({ style: { fontSize: 10 } }, ['* Estimated. Download cost may be higher in China or Australia.']),
                ]),
                div({ style: { width: isMaximized ? '70%' : '50%' } }, [
                  // right div with preview
                  h(
                    Link,
                    {
                      onClick: () => {
                        setIsMaximized(!isMaximized);
                      },
                    },
                    [
                      // maximize/minimize toggle button
                      h(ButtonOutline, { style: { float: 'right', margin: '0.5rem' } }, [
                        isMaximized ? icon('compress-arrows-alt') : icon('expand-arrows-alt'),
                      ]),
                    ]
                  ),
                  h(UriPreview, { metadata, googleProject }),
                ]),
              ]),
            ]),
        ],
        () => renderLoadingSymbol(uri)
      ),
    ]
  );
});
