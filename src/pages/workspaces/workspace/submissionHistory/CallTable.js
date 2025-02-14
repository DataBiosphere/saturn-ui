import { TooltipTrigger } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { div, h, input, label, span } from 'react-hyperscript-helpers';
import { AutoSizer } from 'react-virtualized';
import { Link, Select } from 'src/components/common';
import { icon } from 'src/components/icons';
import { makeCromwellStatusLine, makeStatusLine, statusType } from 'src/components/job-common';
import { FlexTable, HeaderCell, Sortable, tableHeight, TooltipCell } from 'src/components/table';
import colors from 'src/libs/colors';
import * as Utils from 'src/libs/utils';
import CallCacheWizard from 'src/pages/workspaces/workspace/submissionHistory/CallCacheWizard';
import { FailuresModal } from 'src/pages/workspaces/workspace/submissionHistory/FailuresViewer';
import { CallCostCell } from 'src/workflows-app/components/CallCostCell';
import { collapseCromwellStatus } from 'src/workflows-app/components/job-common';
import { LogTooltips } from 'src/workflows-app/utils/task-log-utils';

/* FILTER UTILITY FUNCTIONS */
export const taskNameFilter = (searchText) => {
  const searchTerms = searchText.toLowerCase().split(/[\s_/]/);
  return _.filter((callObject) => {
    return searchTerms.every((term) => (callObject?.taskName || '').toLowerCase().includes(term));
  });
};

export const statusFilter = (statuses) => {
  return _.filter(({ statusObj }) => {
    const { id } = statusObj;
    return _.isEmpty(statuses) ? true : statuses.includes(_.startCase(id));
  });
};

export const filterCallObjectsFn = (searchText, sort, statuses) =>
  _.flow(taskNameFilter(searchText), statusFilter(statuses), _.sortBy(sort.field), sort.direction === 'asc' ? _.identity : _.reverse);

// Helper method to generate data for the call table
const generateCallTableData = (calls) => {
  if (_.isEmpty(calls)) return [];
  const taskNames = Object.keys(calls);
  return _.flatMap((taskName) => {
    const targetData = calls[taskName];
    return _.map((taskCall) => _.merge({ taskName, statusObj: collapseCromwellStatus(taskCall.executionStatus, taskCall.backendStatus) }, taskCall))(
      targetData
    );
  })(taskNames);
};

// helper method to combine metadata tasks and failed tasks into a single array
// if the failed task data is not empty, combine only successful tasks from the metadata with the failed tasks data
// otherwise just return the metadata
const organizeCallTableData = (metadataCalls = {}, failedTaskCalls = {}) => {
  const metadataTableData = generateCallTableData(metadataCalls);
  const failedTaskTableData = generateCallTableData(failedTaskCalls);
  if (!_.isEmpty(failedTaskTableData)) {
    const successfulMetadata = _.filter(({ statusObj }) => {
      const { id } = statusObj;
      return id?.toLocaleLowerCase() !== 'failed';
    }, metadataTableData);
    return successfulMetadata.concat(failedTaskTableData);
  }
  return metadataTableData;
};

/* STATUS COUNT SUB-COMPONENT */
const StatusCounts = ({ statusListObjects }) => {
  const statuses = Object.keys(statusListObjects);
  const statusCountRender = statuses.map((status) => {
    const { count, icon } = statusListObjects[status];
    return span({ key: `${status}-status-count`, style: { marginRight: '20px' } }, [
      icon(),
      span({ style: { fontWeight: 800, marginLeft: '3px' } }, [`${count} `]),
      span(`${status}`),
    ]);
  });
  return div({}, [statusCountRender]);
};

/* TABLE SEARCH BAR */
const SearchBar = ({ searchText, setSearchText }) => {
  return div(
    {
      id: 'task-name-search',
      style: {
        flexBasis: '400px',
      },
    },
    [
      input({
        type: 'text',
        placeholder: 'Search by task name',
        style: { width: '100%', padding: '9px', borderRadius: '15px', border: '1px solid #8F95A0' },
        value: searchText,
        onChange: (e) => setSearchText(e.target.value),
      }),
    ]
  );
};

/* WORKFLOW BREADCRUMB SUB-COMPONENT */
const WorkflowBreadcrumb = ({ workflowPath, loadWorkflow, updateWorkflowPath }) => {
  const workflowPathRender = workflowPath.map((workflow, index) => {
    const { id, workflowName } = workflow;
    const isLast = index === workflowPath.length - 1;
    return span({ key: `${id}-breadcrumb`, style: { marginRight: '5px' } }, [
      isLast ? span([workflowName]) : h(Link, { style: { cursor: 'pointer' }, onClick: () => loadWorkflow(id, updateWorkflowPath) }, [workflowName]),
      !isLast && span(' > '),
    ]);
  });
  return div({ 'aria-label': 'Workflow Breadcrumb', style: { marginBottom: '10px' } }, [workflowPathRender]);
};

/* EXTRA STYLING FOR TEXT HEAVY CELLS */
const basicCellTextStyle = {
  wordBreak: 'break-word',
};

/* CALL TABLE */
const CallTable = ({
  name,
  namespace,
  submissionId,
  callObjects,
  defaultFailedFilter = false,
  showLogModal,
  showTaskDataModal,
  loadWorkflow,
  loadCallCacheDiff,
  loadCallCacheMetadata,
  enableExplorer = false,
  workflowName,
  workflowId,
  failedTasks,
  isAzure,
  getCostOfCallFn,
  isCostMetadataLoading,
}) => {
  const [failuresModalParams, setFailuresModalParams] = useState();
  const [wizardSelection, setWizardSelection] = useState();
  const tableData = useMemo(() => organizeCallTableData(callObjects, failedTasks), [callObjects, failedTasks]);
  const [sort, setSort] = useState({ field: 'index', direction: 'asc' });
  const [statusFilter, setStatusFilter] = useState([]);
  // NOTE: workflowPath is used to load the workflow in the explorer, implement after the table update is confirmed to be working
  const [workflowPath, setWorkflowPath] = useState([{ id: workflowId, workflowName }]);
  const [searchText, setSearchText] = useState('');
  const filteredCallObjects = useMemo(() => {
    return filterCallObjectsFn(searchText, sort, statusFilter)(tableData);
  }, [searchText, sort, statusFilter, tableData]);

  useEffect(() => {
    if (defaultFailedFilter) {
      setStatusFilter(['Failed']);
    }
  }, [defaultFailedFilter]);

  const statusListObjects = useMemo(() => {
    const statusSet = {};
    tableData.forEach(({ statusObj }) => {
      if (!_.isEmpty(statusObj)) {
        const { icon, id } = statusObj;
        const startCasedId = _.startCase(id);
        if (!statusSet[startCasedId]) {
          statusSet[startCasedId] = { count: 0 };
        }
        statusSet[startCasedId].count += 1;
        statusSet[startCasedId].icon = icon;
      } else {
        return {};
      }
    });
    return statusSet;
  }, [tableData]);

  const updateWorkflowPath = useCallback(
    (id, workflowName) => {
      const currentIndex = workflowPath.findIndex((workflow) => workflow.id === id);
      if (currentIndex !== -1) {
        setWorkflowPath(workflowPath.slice(0, currentIndex + 1));
      } else {
        setWorkflowPath([...workflowPath, { id, workflowName }]);
      }
    },
    [workflowPath]
  );

  return div([
    label(
      {
        isRendered: !enableExplorer,
        style: {
          fontWeight: 700,
        },
      },
      ['Filter by:']
    ),
    div({ style: { margin: '1rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, [
      div(
        {
          id: 'filter-section-left',
          style: {
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            flexBasis: 400,
            flexGrow: 2,
          },
        },
        [
          div({ style: { flexBasis: 250, marginRight: '20px' }, isRendered: !enableExplorer }, [
            h(Select, {
              isClearable: true,
              isMulti: true,
              isSearchable: false,
              placeholder: 'Status',
              'aria-label': 'Status',
              value: statusFilter,
              onChange: (data) => setStatusFilter(_.map('value', data)),
              options: Object.keys(statusListObjects),
            }),
          ]),
          h(StatusCounts, { statusListObjects }),
        ]
      ),
      div(
        {
          id: 'filter-section-right',
          style: {
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            flexBasis: 400,
            flexGrow: 1,
          },
        },
        [h(SearchBar, { searchText, setSearchText })]
      ),
    ]),
    h(WorkflowBreadcrumb, { isRendered: enableExplorer, workflowPath, loadWorkflow, updateWorkflowPath }),
    h(AutoSizer, { disableHeight: true }, [
      ({ width }) =>
        h(FlexTable, {
          'aria-label': 'call table',
          height: tableHeight({ actualRows: filteredCallObjects.length, maxRows: 10.5 }), // The half-row here hints at there being extra rows if scrolled
          width,
          sort,
          rowCount: filteredCallObjects.length,
          noContentMessage: 'No matching calls',
          columns: [
            {
              size: { basis: 300, grow: 2 },
              field: 'taskName',
              headerRenderer: () => h(Sortable, { sort, field: 'taskName', onSort: setSort }, ['Name']),
              cellRenderer: ({ rowIndex }) => {
                const { taskName } = filteredCallObjects[rowIndex];
                return div({ style: basicCellTextStyle }, [taskName]);
              },
            },
            {
              size: { basis: 100, grow: 1 },
              field: 'type',
              headerRenderer: () => h(Sortable, { sort, field: 'type', onSort: setSort }, ['Type']),
              cellRenderer: ({ rowIndex }) => {
                const { subWorkflowId } = filteredCallObjects[rowIndex];
                return div({ style: basicCellTextStyle }, [_.isEmpty(subWorkflowId) ? 'Task' : 'Sub-workflow']);
              },
            },
            {
              size: { basis: 100, grow: 1 },
              field: 'attempt',
              headerRenderer: () => h(Sortable, { sort, field: 'attempt', onSort: setSort }, ['Attempt']),
              cellRenderer: ({ rowIndex }) => {
                const { attempt } = filteredCallObjects[rowIndex];
                return div({ style: basicCellTextStyle }, [attempt]);
              },
            },
            {
              size: { basis: 150, grow: 2 },
              field: 'status',
              headerRenderer: () => h(Sortable, { sort, field: 'status', onSort: setSort }, ['Status']),
              cellRenderer: ({ rowIndex }) => {
                const { taskName, index, attempt, executionStatus, backendStatus, failures } = filteredCallObjects[rowIndex];
                const failureCount = _.size(failures);
                const collapsedStatus = collapseCromwellStatus(executionStatus);
                if (collapsedStatus.id === statusType.failed.id && failureCount > 0) {
                  return h(
                    Link,
                    {
                      onClick: () => setFailuresModalParams({ callFqn: taskName, index, attempt, failures }),
                    },
                    [
                      div({ style: { display: 'flex', alignItems: 'center' } }, [
                        makeStatusLine(
                          (style) => collapsedStatus.icon(style),
                          `${collapsedStatus.label(executionStatus)} (${failureCount} Message${failureCount > 1 ? 's' : ''})`,
                          { marginLeft: '0.5rem' }
                        ),
                      ]),
                    ]
                  );
                }
                return div({ style: basicCellTextStyle }, [makeCromwellStatusLine(executionStatus, backendStatus, failures)]);
              },
            },
            {
              size: { basis: 200, grow: 1 },
              field: 'start',
              headerRenderer: () => h(Sortable, { sort, field: 'start', onSort: setSort }, ['Start']),
              cellRenderer: ({ rowIndex }) => {
                const { start } = filteredCallObjects[rowIndex];
                return h(TooltipCell, [start ? Utils.makeCompleteDate(start) : 'N/A']);
              },
            },
            {
              size: { basis: 200, grow: 1 },
              field: 'end',
              headerRenderer: () => h(Sortable, { sort, field: 'end', onSort: setSort }, ['End']),
              cellRenderer: ({ rowIndex }) => {
                const { end } = filteredCallObjects[rowIndex];
                return h(TooltipCell, [end ? Utils.makeCompleteDate(end) : 'N/A']);
              },
            },
            {
              size: { basis: 200, grow: 1 },
              field: 'callCachingResult',
              headerRenderer: () => h(Sortable, { sort, field: 'callCachingResult', onSort: setSort }, ['Call Caching Result']),
              cellRenderer: ({ rowIndex }) => {
                const { taskName, shardIndex: index, callCaching: { effectiveCallCachingMode, result } = {} } = filteredCallObjects[rowIndex];
                if (effectiveCallCachingMode === 'ReadAndWriteCache' || effectiveCallCachingMode === 'ReadCache') {
                  return result
                    ? h(Fragment, [
                        h(TooltipCell, [result]),
                        result === 'Cache Miss' &&
                          h(
                            Link,
                            {
                              key: 'cc',
                              style: { marginLeft: '0.5rem' },
                              tooltip: 'Call Cache Debug Wizard',
                              onClick: () => setWizardSelection({ callFqn: taskName, index }),
                            },
                            [icon('search', { size: 18, 'aria-label': 'call cache debug wizard' })]
                          ),
                      ])
                    : div({ style: { color: colors.dark(0.7) } }, ['No Information']);
                }
                if (effectiveCallCachingMode === 'WriteCache') {
                  return div({ style: { color: colors.dark(0.7) } }, ['Lookup disabled; write enabled']);
                }
                return div({ style: { color: colors.dark(0.7) } }, [effectiveCallCachingMode]);
              },
            },
            ...(isAzure // GCP workspaces do not have inputs/outputs/logs (only log file is at top level, linked in workflow dashboard)
              ? [
                  {
                    size: { basis: 200, grow: 1 },
                    field: 'cost',
                    headerRenderer: () =>
                      h(Sortable, { sort, field: 'cost', onSort: setSort }, [
                        'Approximate Cost',
                        h(
                          TooltipTrigger,
                          {
                            content:
                              "Approximate cost is calculated based on the list price of the VM, and does not include disk cost or any cloud account discounts. Tasks that call cache don't incur cost.",
                          },
                          [icon('info-circle', { style: { marginLeft: '0.4rem', color: colors.accent(1) } })]
                        ),
                      ]),
                    cellRenderer: ({ rowIndex }) => {
                      return h(CallCostCell, {
                        call: filteredCallObjects[rowIndex],
                        getCostOfCallFn,
                        isCostMetadataLoading,
                      });
                    },
                  },
                  {
                    size: { basis: 200, grow: 1 },
                    field: 'logs',
                    headerRenderer: () => h(HeaderCell, { fontWeight: 500 }, ['Task Data']),
                    cellRenderer: ({ rowIndex }) => {
                      const {
                        stdout,
                        stderr,
                        inputs,
                        outputs,
                        subWorkflowId,
                        // disable linting to match the backend keys
                        // eslint-disable-next-line camelcase, @typescript-eslint/no-unused-vars
                        tes_stderr,
                        // eslint-disable-next-line camelcase
                        tes_stdout,
                      } = filteredCallObjects[rowIndex];
                      const style =
                        enableExplorer && !_.isEmpty(subWorkflowId)
                          ? {
                              display: 'flex',
                              justifyContent: 'flex-start',
                            }
                          : {
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr 1fr',
                              gridColumnGap: '0.6em',
                              gridRowGap: '0.3em',
                            };
                      const linkTemplate =
                        enableExplorer && !_.isEmpty(subWorkflowId)
                          ? [
                              h(
                                Link,
                                {
                                  onClick: () => {
                                    loadWorkflow(subWorkflowId, updateWorkflowPath);
                                  },
                                },
                                ['View sub-workflow']
                              ),
                            ]
                          : _.isEmpty(subWorkflowId) && [
                              h(
                                Link,
                                {
                                  'aria-label': 'View task inputs',
                                  onClick: () => showTaskDataModal('Inputs', inputs),
                                },
                                ['Inputs']
                              ),
                              h(
                                Link,
                                {
                                  'aria-label': 'View task outputs',
                                  onClick: () => showTaskDataModal('Outputs', outputs),
                                },
                                ['Outputs']
                              ),
                              h(
                                Link,
                                {
                                  onClick: () =>
                                    showLogModal(
                                      'Task Logs',
                                      [
                                        {
                                          logUri: stdout,
                                          logTitle: 'Task Standard Out',
                                          logKey: 'stdout',
                                          logFilename: 'stdout.txt',
                                          logTooltip: LogTooltips.task,
                                        },
                                        {
                                          logUri: stderr,
                                          logTitle: 'Task Standard Err',
                                          logKey: 'stderr',
                                          logFilename: 'stderr.txt',
                                          logTooltip: LogTooltips.task,
                                        },
                                      ],
                                      tes_stdout
                                    ),
                                },
                                ['Logs']
                              ),
                            ];
                      return div({ style }, linkTemplate);
                    },
                  },
                ]
              : []),
          ],
        }),
    ]),
    failuresModalParams && h(FailuresModal, { ...failuresModalParams, onDismiss: () => setFailuresModalParams(undefined) }),
    wizardSelection &&
      h(CallCacheWizard, {
        onDismiss: () => setWizardSelection(undefined),
        namespace,
        name,
        submissionId,
        workflowId,
        ...wizardSelection,
        loadCallCacheDiff,
        loadCallCacheMetadata,
      }),
  ]);
};

export default CallTable;
