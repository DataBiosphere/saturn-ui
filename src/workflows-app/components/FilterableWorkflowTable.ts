import { Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { div, h, span } from 'react-hyperscript-helpers';
import { AutoSizer } from 'react-virtualized';
import { ClipboardButton } from 'src/components/ClipboardButton';
import { ButtonPrimary, Clickable, Link } from 'src/components/common';
import { icon } from 'src/components/icons';
import { FlexTable, Paginator, Sortable, tableHeight, TextCell } from 'src/components/table';
import { convert } from 'src/libs/ajax/azure-storage-utils';
import { AzureStorage } from 'src/libs/ajax/AzureStorage';
import colors from 'src/libs/colors';
import * as Nav from 'src/libs/nav';
import { useCancellation } from 'src/libs/react-utils';
import { AppProxyUrlStatus } from 'src/libs/state';
import { customFormatDuration, differenceFromNowInSeconds } from 'src/libs/utils';
import { statusType } from 'src/workflows-app/components/job-common';
import { fetchMetadata, WorkflowMetadata } from 'src/workflows-app/utils/cromwell-metadata-utils';
import { makeStatusLine, parseMethodString } from 'src/workflows-app/utils/submission-utils';
import { isAzureUri } from 'src/workspace-data/data-table/uri-viewer/uri-viewer-utils';

import { loadAppUrls } from '../utils/app-utils';
import { getFilteredRuns } from '../utils/method-common';
import { LogTooltips } from '../utils/task-log-utils';
import FilterSubmissionsDropdown, { FilterOptions } from './FilterSubmissionsDropdown';
import { FetchedLogData, LogInfo } from './LogViewer';

type Run = {
  duration: number;
  engine_id: string | undefined;
  last_modified_timestamp: Date;
  last_polled_timestamp: Date;
  record_id: string;
  run_id: string;
  run_set_id: string;
  state: string;
  submission_date: Date;
  workflow_outputs: string;
  workflow_params: string;
  workflow_url: string;
  error_messages: string | undefined;
};

type LogsModalProps = {
  modalTitle: string;
  logsArray: LogInfo[];
};

type TaskDataModalProps = {
  taskDataTitle: string;
  taskJson: {} | null | undefined;
};

type FilterableWorkflowTableProps = {
  runsData: Run[];
  runsFullyUpdated: boolean;
  namespace: string;
  submissionId: string;
  workspaceName: string;
  workspaceId: string;
  setLogsModal: ({ modalTitle, logsArray }: LogsModalProps) => void;
  setTaskDataModal: ({ taskDataTitle, taskJson }: TaskDataModalProps) => void;
};

/**
 * Workflow Inputs and Outputs are "fully qualified" and come in the form:
 *    WorkflowName.CallName.VariableName (for task input/outputs) or
 *    WorkflowName.VariableName (for workflow inputs/outputs)
 * Keep in mind that CallName may be multiple segments in the case of nested workflows.
 * When displaying these, there is no need to include the workflow name as it is already present elsewhere on the page.
 * Here, we strip away the first part of the key (expected to be the workflow name) to make it shorter and more readable.
 * @param keyValuePairs A map from fully qualified variable name to value.
 * @returns A map where the fully qualified variable name has been stripped of the workflow name prefix.
 */
const stripWorkflowPrefixFromKeys = <T extends Record<string, any>>(keyValuePairs: T): { [k: string]: any } => {
  const shortenKey = (key: string): string => {
    const { call, variable } = parseMethodString(key);
    return call ? `${call}.${variable}` : variable;
  };
  return Object.fromEntries(Object.entries(keyValuePairs).map(([key, value]) => [shortenKey(key), value]));
};

const FilterableWorkflowTable = ({
  runsData,
  runsFullyUpdated,
  namespace,
  submissionId,
  workspaceName,
  workspaceId,
  setLogsModal,
  setTaskDataModal,
}: FilterableWorkflowTableProps) => {
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [filterOption, setFilterOption] = useState<FilterOptions>();
  const [pageNumber, setPageNumber] = useState(1);
  const [sort, setSort] = useState({ field: 'duration', direction: 'desc' });
  const [viewErrorsId, setViewErrorsId] = useState<number>();
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowMetadata>();
  const [appId, setAppId] = useState<RegExpMatchArray | null>();
  const [taskName, setTaskName] = useState<string>();

  const errorStates = ['SYSTEM_ERROR', 'EXECUTOR_ERROR'];
  const signal = useCancellation();

  const sortRuns = (field: string, direction: string, runs: Run[]): Run[] => {
    const runsSorted: Run[] = [];

    if (runs !== undefined) {
      for (const run of runs) {
        runsSorted.push(run);
      }
    }

    runsSorted.sort((run1, run2) => {
      if (direction === 'asc') {
        if (run1[field] > run2[field]) {
          return 1;
        }
        if (run2[field] > run1[field]) {
          return -1;
        }
      } else {
        if (run1[field] < run2[field]) {
          return 1;
        }
        if (run2[field] < run1[field]) {
          return -1;
        }
      }

      return 0;
    });

    return runsSorted;
  };

  const filteredPreviousRuns: Run[] = useMemo(
    () => (filterOption ? getFilteredRuns(filterOption, runsData, errorStates) : runsData),
    // Don't re-run if errorStates changes (since it never should change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterOption, runsData]
  );
  const firstPageIndex: number = (pageNumber - 1) * itemsPerPage;
  const lastPageIndex: number = firstPageIndex + itemsPerPage;
  const sortedPreviousRuns: Run[] = useMemo(
    () => sortRuns(sort.field, sort.direction, filteredPreviousRuns),
    [filteredPreviousRuns, sort.direction, sort.field]
  );
  const paginatedPreviousRuns: Run[] = useMemo(
    () => sortedPreviousRuns.slice(firstPageIndex, lastPageIndex),
    [firstPageIndex, lastPageIndex, sortedPreviousRuns]
  );
  const rowWidth = 100;
  const rowHeight = 50;

  const state = (
    state: string,
    submissionDate: Date
  ): { id: string; label: (state: string) => string; icon: (style: any) => any } => {
    switch (state) {
      case 'SYSTEM_ERROR':
      case 'EXECUTOR_ERROR':
        return statusType.failed;
      case 'COMPLETE':
        return statusType.succeeded;
      case 'INITIALIZING':
        return statusType.initializing;
      case 'QUEUED':
        return statusType.queued;
      case 'RUNNING':
        return statusType.running;
      case 'PAUSED':
        return statusType.paused;
      case 'CANCELED':
        return statusType.canceled;
      case 'CANCELING':
        return statusType.canceling;
      default:
        // 10 seconds should be enough for Cromwell to summarize the new workflow and get a status other
        // than UNKNOWN. In the meantime, handle this as an edge case in the UI:
        return differenceFromNowInSeconds(submissionDate) < 10 ? statusType.initializing : statusType.unknown;
    }
  };

  const includeKeys = useMemo(() => [], []);
  const excludeKeys = useMemo(() => ['calls'], []);

  const loadWorkflow = useCallback(
    async (workflowId: string | undefined): Promise<WorkflowMetadata | undefined> => {
      if (workflowId === undefined) {
        return undefined;
      }

      try {
        const { cromwellProxyUrlState } = await loadAppUrls(workspaceId, 'cromwellProxyUrlState');
        if (cromwellProxyUrlState.status === AppProxyUrlStatus.Ready) {
          return await fetchMetadata({
            cromwellProxyUrl: cromwellProxyUrlState.state,
            workflowId,
            signal,
            includeKeys,
            excludeKeys,
            expandSubWorkflows: false,
          });
        }
        return undefined;
      } catch (error) {
        reportError(error);
        return undefined;
      }
    },
    [workspaceId, signal, includeKeys, excludeKeys]
  );

  const getWorkflow = useCallback(
    async (rowIndex: number): Promise<WorkflowMetadata | undefined> => {
      if (currentWorkflow && currentWorkflow.id === paginatedPreviousRuns[rowIndex].engine_id) {
        return currentWorkflow;
      }
      if (!paginatedPreviousRuns[rowIndex]) {
        return undefined;
      }
      const workflow: WorkflowMetadata | undefined = await loadWorkflow(paginatedPreviousRuns[rowIndex].engine_id);
      if (workflow !== undefined) {
        setCurrentWorkflow(workflow);
      }
      return workflow;
    },
    [currentWorkflow, loadWorkflow, paginatedPreviousRuns]
  );

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

  const getAppIdAndTaskName = useCallback(async () => {
    const workflow: WorkflowMetadata | undefined = await getWorkflow(0);
    if (workflow !== undefined && workflow?.workflowLog !== undefined) {
      setTaskName(workflow.workflowName);
      const logs = await fetchLogContent(workflow.workflowLog);
      const textContent = logs !== null ? logs.textContent : null;
      setAppId(textContent !== null && textContent ? textContent.match('terra-app-[0-9a-fA-f-]*') : null);
    }
  }, [getWorkflow, fetchLogContent]);

  useEffect(() => {
    getAppIdAndTaskName();
  }, [getAppIdAndTaskName]);

  return div(
    {
      style: {
        backgroundColor: 'rgb(235, 236, 238)',
        display: 'flex',
        flex: '1 1 auto',
        flexDirection: 'column',
        padding: '1rem 3rem',
      },
    },
    [
      div(
        {
          style: {
            marginTop: '1em',
            minHeight: '10em',
            marginBottom: '5em',
          },
        },
        [
          runsFullyUpdated
            ? div({ style: { marginBottom: '1.5em' } }, [
                icon('check', { size: 15, style: { color: colors.success() } }),
                ' Workflow statuses are all up to date.',
              ])
            : div([
                icon('warning-standard', { size: 15, style: { color: colors.warning() } }),
                ' Some workflow statuses are not up to date. Refreshing the page may update more statuses.',
              ]),
          div({ style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between' } }, [
            h(FilterSubmissionsDropdown, { filterOption, setFilterOption }),
            h(
              Link,
              {
                href: Nav.getLink(
                  'workspace-files',
                  { name: workspaceName, namespace },
                  {
                    path: `workspace-services/cbas/${appId}/${taskName}/`,
                  }
                ),
                target: '_blank',
              },
              [icon('folder-open', { size: 18 }), '\tSubmission Execution Directory']
            ),
          ]),
          div(
            {
              style: {
                marginTop: '0.5rem',
                height: tableHeight({
                  actualRows: paginatedPreviousRuns.length,
                  maxRows: 12.5,
                  heightPerRow: 50,
                }),
              },
            },
            [
              h(AutoSizer, [
                ({ width, height }) =>
                  h(FlexTable, {
                    'aria-label': 'previous runs',
                    width,
                    height,
                    sort: sort as any, // necessary until FlexTable is converted to TS
                    rowCount: paginatedPreviousRuns.length,
                    noContentMessage: 'Nothing here yet! Your previously run workflows will be displayed here.',
                    hoverHighlight: true,
                    rowHeight,
                    rowWidth,
                    variant: null,
                    tabIndex: -1,
                    columns: [
                      {
                        size: { basis: 350 },
                        field: 'record_id',
                        headerRenderer: () => h(Sortable, { sort, field: 'record_id', onSort: setSort }, ['Sample ID']),
                        cellRenderer: ({ rowIndex }) => {
                          const engineId = paginatedPreviousRuns[rowIndex].engine_id;

                          // Engine id may be undefined if CBAS failed to submit to Cromwell
                          if (engineId === undefined) return h(TextCell, [paginatedPreviousRuns[rowIndex].record_id]);

                          return div({ style: { width: '100%', textAlign: 'left' } }, [
                            h(
                              Link,
                              {
                                href: Nav.getLink('workspace-workflows-app-run-details', {
                                  namespace,
                                  name: workspaceName,
                                  submissionId,
                                  workflowId: engineId,
                                }),
                                style: { fontWeight: 'bold' },
                              },
                              [paginatedPreviousRuns[rowIndex].record_id]
                            ),
                          ]);
                        },
                      },
                      {
                        size: { basis: 400, grow: 0 },
                        field: 'state',
                        headerRenderer: () => h(Sortable, { sort, field: 'state', onSort: setSort }, ['Status']),
                        cellRenderer: ({ rowIndex }) => {
                          const status = state(
                            paginatedPreviousRuns[rowIndex].state,
                            paginatedPreviousRuns[rowIndex].submission_date
                          );
                          if (errorStates.includes(paginatedPreviousRuns[rowIndex].state)) {
                            return div({ style: { width: '100%', textAlign: 'center' } }, [
                              h(
                                Link,
                                {
                                  key: 'error link',
                                  style: { fontWeight: 'bold' },
                                  onClick: () => setViewErrorsId(rowIndex),
                                },
                                [
                                  makeStatusLine(
                                    (style) => status.icon(style),
                                    status.label(paginatedPreviousRuns[rowIndex].state),
                                    {
                                      textAlign: 'center',
                                    }
                                  ),
                                ]
                              ),
                            ]);
                          }
                          return h(TextCell, { style: { fontWeight: 'bold' } }, [
                            makeStatusLine(
                              (style) => status.icon(style),
                              status.label(paginatedPreviousRuns[rowIndex].state),
                              {
                                textAlign: 'center',
                              }
                            ),
                          ]);
                        },
                      },
                      {
                        size: { basis: 500, grow: 0 },
                        field: 'duration',
                        headerRenderer: () => h(Sortable, { sort, field: 'duration', onSort: setSort }, ['Duration']),
                        cellRenderer: ({ rowIndex }) => {
                          return h(TextCell, [customFormatDuration(paginatedPreviousRuns[rowIndex].duration)]);
                        },
                      },
                      {
                        size: { basis: 400, grow: 0 },
                        field: 'workflowId',
                        headerRenderer: () => [
                          h(Sortable, { key: 'workflow ID header', sort, field: 'workflowId', onSort: setSort }, [
                            'Workflow ID',
                          ]),
                          h(
                            Clickable,
                            {
                              key: 'tooltip icon',
                              tooltip: 'Click the workflow ID to go to the execution directory',
                              useTooltipAsLabel: true,
                            },
                            [icon('cardMenuIcon')]
                          ),
                        ],
                        cellRenderer: ({ rowIndex }) => {
                          if (paginatedPreviousRuns[rowIndex].engine_id) {
                            const engineId = paginatedPreviousRuns[rowIndex].engine_id;
                            if (engineId !== undefined) {
                              return h(TextCell, [
                                h(
                                  Link,
                                  {
                                    style: { marginRight: '0.5rem' },
                                    href: Nav.getLink(
                                      'workspace-files',
                                      { name: workspaceName, namespace },
                                      {
                                        path: `workspace-services/cbas/${appId}/${taskName}/${engineId}/`,
                                      }
                                    ),
                                    target: '_blank',
                                  },
                                  [engineId]
                                ),
                                span({}, [h(ClipboardButton, { text: engineId, 'aria-label': 'Copy workflow id' })]),
                              ]);
                            }
                          }
                          if (paginatedPreviousRuns[rowIndex].state === 'QUEUED') {
                            return div(['Waiting for workflow to be submitted']);
                          }
                          return div(['Error: Workflow ID not found']);
                        },
                      },
                      {
                        size: { basis: 325, grow: 0 },
                        field: 'taskData',
                        headerRenderer: () => 'Workflow Data',
                        cellRenderer: ({ rowIndex }) => {
                          const style = {
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr',
                            gridColumnGap: '1em',
                            gridRowGap: '0.3em',
                          };
                          if (paginatedPreviousRuns[rowIndex].engine_id) {
                            return div({ style }, [
                              h(
                                Link,
                                {
                                  onClick: async () => {
                                    setTaskDataModal({ taskDataTitle: 'Inputs', taskJson: null });
                                    const workflow: WorkflowMetadata | undefined = await getWorkflow(rowIndex);
                                    if (workflow !== undefined && workflow?.inputs !== undefined) {
                                      const shortenedInputs = stripWorkflowPrefixFromKeys(workflow.inputs);
                                      setTaskDataModal({ taskDataTitle: 'Inputs', taskJson: shortenedInputs });
                                    }
                                  },
                                },
                                ['Inputs']
                              ),
                              h(
                                Link,
                                {
                                  onClick: async () => {
                                    setTaskDataModal({ taskDataTitle: 'Outputs', taskJson: null });
                                    const workflow: WorkflowMetadata | undefined = await getWorkflow(rowIndex);
                                    if (workflow !== undefined && workflow?.outputs !== undefined) {
                                      const shortenedOutputs = stripWorkflowPrefixFromKeys(workflow.outputs);
                                      setTaskDataModal({ taskDataTitle: 'Outputs', taskJson: shortenedOutputs });
                                    }
                                  },
                                },
                                ['Outputs']
                              ),
                              h(
                                Link,
                                {
                                  onClick: async () => {
                                    const workflow: WorkflowMetadata | undefined = await getWorkflow(rowIndex);
                                    if (workflow !== undefined) {
                                      const logUri = workflow.workflowLog;
                                      setLogsModal({
                                        modalTitle: 'Workflow Execution Log',
                                        logsArray: [
                                          {
                                            logUri,
                                            logTitle: 'Workflow Execution Log',
                                            logKey: 'execution_log',
                                            logFilename: 'workflow.log',
                                            logTooltip: LogTooltips.workflowExecution,
                                          },
                                        ],
                                      });
                                    }
                                  },
                                },
                                ['Log']
                              ),
                            ]);
                          }
                          if (paginatedPreviousRuns[rowIndex].state === 'QUEUED') {
                            return div(['Waiting for workflow to be submitted']);
                          }
                          return div(['Error: Workflow ID not found']);
                        },
                      },
                    ],
                  }),
              ]),
            ]
          ),
        ]
      ),
      !_.isEmpty(sortedPreviousRuns) &&
        div({ style: { marginBottom: '1.5rem', right: '4rem' } }, [
          // @ts-expect-error
          Paginator({
            filteredDataLength: sortedPreviousRuns.length,
            unfilteredDataLength: sortedPreviousRuns.length,
            pageNumber,
            setPageNumber,
            itemsPerPage,
            setItemsPerPage: (v) => {
              setPageNumber(1);
              setItemsPerPage(v);
            },
            itemsPerPageOptions: [10, 25, 50, 100],
          }),
        ]),
      viewErrorsId !== undefined &&
        h(
          Modal,
          {
            title: 'Error Messages',
            width: 600,
            onDismiss: () => setViewErrorsId(undefined),
            showCancel: false,
            okButton: h(
              ButtonPrimary,
              {
                disabled: false,
                onClick: () => setViewErrorsId(undefined),
              },
              ['OK']
            ),
          },
          [
            h(
              TextCell,
              {
                style: {
                  textAlign: 'center',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: '3rem',
                  marginBottom: '1rem',
                },
              },
              [paginatedPreviousRuns[viewErrorsId]?.error_messages]
            ),
          ]
        ),
    ]
  );
};

export default FilterableWorkflowTable;
