import { Modal } from '@terra-ui-packages/components';
import { LoadedState } from '@terra-ui-packages/core-utils';
import _ from 'lodash/fp';
import { useCallback, useEffect, useState } from 'react';
import { div, h, span } from 'react-hyperscript-helpers';
import { ButtonOutline } from 'src/components/common';
import { centeredSpinner, icon } from 'src/components/icons';
import { convert } from 'src/libs/ajax/azure-storage-utils';
import { AzureBlobContent, AzureStorage } from 'src/libs/ajax/AzureStorage';
import { useCancellation } from 'src/libs/react-utils';
import { newTabLinkProps } from 'src/libs/utils';
import { VerticalTabBar } from 'src/workflows-app/components/VerticalTabBar';
import { isAzureUri } from 'src/workspace-data/data-table/uri-viewer/uri-viewer-utils';

import { discoverTesLogs } from '../utils/task-log-utils';
/**
 * Information needed to preview a log file.
 * @member logUri - The URI of the log file. Must be a valid Azure blob URI. No Sas token should be appended: a fresh one will be obtained. Optional so we can save LogInfo at compile time but fetch the URI at runtime.
 * @member logTitle - The title of the log. Displayed to the user as a tab title.
 * @member logKey - A unique key for this particular log.
 * @member logFilename - The filename of this particular log. Does not need to be unique.
 * @member logTooltip - If provided, will be displayed as a little (i) icon next to the tab title that shows a tooltip when clicked.
 */
export type LogInfo = {
  logUri?: string;
  logTitle: string;
  logKey: string;
  logFilename: string;
  logTooltip?: string;
};

/**
 * Props for the LogViewer component.
 * @member modalTitle - Should represent the group of logs being displayed. E.g. "Task Logs"
 * @member logs - An array of LogInfo objects.
 */
export type LogViewerProps = {
  modalTitle: string;
  logs: LogInfo[]; // Known logs to show in this component
  workspaceId: string;
  templateLogDirectory?: string; // a full azure blob uri to a log file, or to a folder of log files. If provided, we will search for additional logs in the same directory as this file/folder.
  onDismiss: () => void;
};

/**
 * Represents data that has been fetched using an Azure Blob URI
 */
export type FetchedLogData = AzureBlobContent;

const logLoadingErrorMessage =
  "Log file could not be loaded. If the workflow or task is still in progress, the log file likely hasn't been generated yet. Some logs may be unavailable if the workflow or task failed before they could be generated.";
const modalMaxWidth = 1100;

export const LogViewer = (logProps: LogViewerProps) => {
  const { modalTitle, logs, workspaceId, templateLogDirectory, onDismiss } = logProps;
  const [activeLogs, setActiveLogs] = useState<LogInfo[]>(logs);

  const [currentlyActiveLog, setCurrentlyActiveLog] = useState<LogInfo | undefined>(
    _.isEmpty(activeLogs) ? undefined : activeLogs[0]
  );

  const [activeTextContent, setActiveTextContent] = useState<LoadedState<string>>({
    status: 'Loading',
    state: null,
  });
  const [activeDownloadUri, setActiveDownloadUri] = useState<string | undefined>(undefined);
  const signal = useCancellation();

  useEffect(() => {
    const discover = async () => {
      if (templateLogDirectory === undefined) return;
      const discoveredTesLogs = await discoverTesLogs(signal, workspaceId, templateLogDirectory);
      setActiveLogs((activeLogs) => [...activeLogs, ...discoveredTesLogs]);
    };
    discover();
  }, [signal, workspaceId, templateLogDirectory]);

  const fetchLogContent = useCallback(
    async (azureBlobUri: string): Promise<FetchedLogData | null> => {
      if (!isAzureUri(azureBlobUri)) {
        return null;
      }
      try {
        const response = await AzureStorage(signal).blobByUri(azureBlobUri).getMetadataAndTextContent();
        return convert.azureBlobResult.toAzureBlobContent(response);
      } catch (e) {
        return null;
      }
    },
    [signal]
  );

  useEffect(() => {
    const loadAzureLog = async (logUri: string) => {
      const res = await fetchLogContent(logUri);
      if (_.isEmpty(res?.textContent)) {
        setActiveDownloadUri(undefined);
        setActiveTextContent({
          status: 'Error',
          state: null,
          error: { name: 'Log Download Error', message: logLoadingErrorMessage },
        });
      } else {
        const content = res?.textContent;
        setActiveDownloadUri(res?.downloadUri);
        setActiveTextContent({
          status: 'Ready',
          state: _.isEmpty(content) ? '' : content,
        });
      }
    };

    // when switching tabs, switch to loading state while we fetch new content.
    setActiveTextContent({
      status: 'Loading',
      state: null,
    });
    setActiveDownloadUri(undefined);

    // tab switching set the currently active log (which triggers this effect). Fetch the content for the new log.
    const uri = currentlyActiveLog?.logUri;
    if (!_.isEmpty(uri)) {
      loadAzureLog(uri);
    }
  }, [currentlyActiveLog, fetchLogContent]);

  const renderActiveTextContent = () => {
    const content = (activeTextContent) => {
      switch (activeTextContent.status) {
        case 'Loading':
          return div([centeredSpinner()]);
        case 'Error':
          return div([activeTextContent.error.message]);
        case 'Ready':
          return div([activeTextContent.state]);
        default:
          return div(['Unknown error']);
      }
    };
    return [
      div(
        {
          'aria-label': 'Log file content',
          style: {
            fontFamily: 'Menlo, monospace',
            overflowY: 'auto',
            whiteSpace: 'pre-line',
            height: window.innerHeight * 0.6,
            padding: '0.5rem',
            paddingRight: '10px', // reserve space for scrollbar
          },
        },
        [content(activeTextContent)]
      ),
    ];
  };

  const renderTopRow = () => {
    return div(
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
        },
      },
      [
        span([
          span({ style: { paddingRight: '0.5rem', fontWeight: 'bold', fontSize: 16 } }, ['File:']),
          span({ style: { fontSize: 16 } }, [currentlyActiveLog?.logFilename]),
        ]),
        !_.isEmpty(activeDownloadUri) &&
          h(
            ButtonOutline,
            {
              'aria-label': 'Download log',
              disabled: _.isEmpty(currentlyActiveLog?.logUri),
              href: activeDownloadUri,
              download: activeDownloadUri,
              ...newTabLinkProps,
            },
            [span([icon('download', { style: { marginRight: '1ch' } }), 'Download'])]
          ),
      ]
    );
  };

  const renderLefthandTabs = () => {
    if (_.isEmpty(currentlyActiveLog)) {
      return [
        h(VerticalTabBar, {
          activeTabKey: 'missing_logs',
          tabKeys: ['missing_logs'],
          maxHeight: window.innerHeight * 0.6,
          onClick(tabKey: string): void {
            console.error(`No log found for tab key: ${tabKey}`);
          },
        }),
      ];
    }
    return [
      h(VerticalTabBar, {
        activeTabKey: currentlyActiveLog.logKey,
        tabKeys: activeLogs.map((log) => log.logKey),
        tabDisplayNames: new Map(activeLogs.map((log) => [log.logKey, log.logTitle])),
        tabTooltips: new Map(activeLogs.map((log) => [log.logKey, log.logTooltip || ''])),
        maxHeight: window.innerHeight * 0.6,
        onClick: (tabKey: string) => setCurrentlyActiveLog(activeLogs.find((log) => log.logKey === tabKey)),
      }),
    ];
  };

  return h(
    Modal,
    {
      onDismiss,
      title: modalTitle,
      showCancel: false,
      showX: true,
      showButtons: false,
      width: modalMaxWidth,
    },
    [
      div([
        div({ style: { height: '2.25rem' } }, [renderTopRow()]),
        div({ style: { display: 'flex', height: '100%' } }, [
          div({ style: { width: '25%' } }, renderLefthandTabs()),
          div({ style: { width: '75%', marginTop: '0.5rem' } }, renderActiveTextContent()),
        ]),
      ]),
    ]
  );
};
