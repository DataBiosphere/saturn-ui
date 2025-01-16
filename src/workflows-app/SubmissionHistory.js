import _ from 'lodash/fp';
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { div, h, h2, span } from 'react-hyperscript-helpers';
import { AutoSizer } from 'react-virtualized';
import { Clickable, Link } from 'src/components/common';
import { centeredSpinner, icon } from 'src/components/icons';
import { MenuButton } from 'src/components/MenuButton';
import { MenuTrigger } from 'src/components/PopupTrigger';
import { FlexTable, Paginator, Sortable, tableHeight, TextCell } from 'src/components/table';
import { User } from 'src/libs/ajax/User';
import { Cbas } from 'src/libs/ajax/workflows-app/Cbas';
import colors from 'src/libs/colors';
import * as Nav from 'src/libs/nav';
import { notify } from 'src/libs/notifications';
import { useCancellation, useOnMount, usePollingEffect } from 'src/libs/react-utils';
import { AppProxyUrlStatus, workflowsAppStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { doesAppProxyUrlExist, loadAppUrls } from 'src/workflows-app/utils/app-utils';
import {
  AutoRefreshInterval,
  CbasPollInterval,
  getDuration,
  isRunSetInTerminalState,
  makeStatusLine,
  statusType,
} from 'src/workflows-app/utils/submission-utils';

import FilterSubmissionsDropdown from './components/FilterSubmissionsDropdown';
import { getFilteredRunSets, getSortableRunSets, samIdToWorkspaceNickname } from './utils/method-common';

export const BaseSubmissionHistory = ({ namespace, workspace }, _ref) => {
  // State
  const [sort, setSort] = useState({ field: 'submission_timestamp', direction: 'desc' });
  const [pageNumber, setPageNumber] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [runSetsData, setRunSetData] = useState();
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState();
  const [filterOption, setFilterOption] = useState();

  const signal = useCancellation();
  const scheduledRefresh = useRef();
  const workspaceId = workspace.workspace.workspaceId;
  const errorStates = ['ERROR'];

  const loadRunSets = useCallback(
    async (cbasUrlRoot) => {
      try {
        const runSets = await Cbas(signal).runSets.get(cbasUrlRoot);
        const durationEnhancedRunSets = _.map(
          (r) => _.merge(r, { duration: getDuration(r.state, r.submission_timestamp, r.last_modified_timestamp, isRunSetInTerminalState) }),
          runSets.run_sets
        );
        return _.merge(runSets, { run_sets: durationEnhancedRunSets });
      } catch (error) {
        notify('error', 'Error getting run set data', { detail: error instanceof Response ? await error.text() : error });
      }
    },
    [signal]
  );

  const loadAllRunSets = useCallback(
    async (cbasProxyUrlDetails) => {
      try {
        if (cbasProxyUrlDetails.status !== AppProxyUrlStatus.Ready) {
          const { cbasProxyUrlState } = await loadAppUrls(workspaceId, 'cbasProxyUrlState');

          if (cbasProxyUrlState.status === AppProxyUrlStatus.Ready) {
            const runSets = await loadRunSets(cbasProxyUrlState.state);
            if (runSets !== undefined) {
              setRunSetData(runSets.run_sets);
              return runSets;
            }
          } else {
            const cbasUrlState = cbasProxyUrlState.state;
            const errorDetails = cbasUrlState instanceof Response ? await cbasUrlState.text() : cbasUrlState;
            const additionalDetails = errorDetails ? `Error details: ${JSON.stringify(errorDetails)}` : '';
            notify('warn', 'Error loading Workflows app', {
              detail: `Workflows app not found. Will retry in 30 seconds. ${additionalDetails}`,
              timeout: CbasPollInterval - 1000,
            });
          }
        } else {
          const runSets = await loadRunSets(cbasProxyUrlDetails.state);
          if (runSets !== undefined) {
            setRunSetData(runSets.run_sets);
            return runSets;
          }
        }
      } catch (error) {
        notify('error', 'Error getting run set data', { detail: error instanceof Response ? await error.text() : error });
      }
    },
    [workspaceId, loadRunSets]
  );

  // helper for auto-refresh
  const refresh = Utils.withBusyState(setLoading, async () => {
    try {
      let updatedRunSets;
      if (workflowsAppStore.get().cbasProxyUrlState.status === AppProxyUrlStatus.Ready) {
        updatedRunSets = await loadAllRunSets(workflowsAppStore.get().cbasProxyUrlState);

        // only refresh if there are Run Sets in non-terminal state
        if (!updatedRunSets || _.some(({ state }) => !isRunSetInTerminalState(state), updatedRunSets)) {
          scheduledRefresh.current = setTimeout(refresh, AutoRefreshInterval);
        }
      }
    } catch (error) {
      notify('error', 'Error loading previous run sets', { detail: error instanceof Response ? await error.text() : error });
    }
  });

  const cancelRunSet = async (submissionId) => {
    try {
      await Cbas(signal).runSets.cancel(workflowsAppStore.get().cbasProxyUrlState.state, submissionId);
      notify('success', 'Abort submission request submitted successfully', {
        message: 'You may refresh the page to get most recent status changes.',
        timeout: 5000,
      });
    } catch (error) {
      notify('error', 'Error aborting run set', { detail: error instanceof Response ? await error.text() : error });
    }
  };

  const renderInstructionalElements = (userId) => {
    const introDiv = div(['See workflows that were submitted by all collaborators in this workspace.']);
    const nickname = samIdToWorkspaceNickname(userId);
    const nicknameDivs = userId
      ? [
          div(['Your nickname is ', span({ style: { fontWeight: 'bold' } }, [nickname]), '.']),
          div([
            'Other users in this workspace will see ',
            span({ style: { fontWeight: 'bold' } }, [nickname]),
            ' in the Submitter column of  your submissions.',
          ]),
        ]
      : [];

    return [introDiv, ...nicknameDivs];
  };

  useOnMount(() => {
    const loadWorkflowsApp = async () => {
      const { cbasProxyUrlState } = await loadAppUrls(workspaceId, 'cbasProxyUrlState');

      if (cbasProxyUrlState.status === AppProxyUrlStatus.Ready) {
        await loadAllRunSets(cbasProxyUrlState);
      }
    };
    loadWorkflowsApp();
    User()
      .getStatus()
      .then((res) => setUserId(res.userSubjectId));
    refresh();

    return () => {
      if (scheduledRefresh.current) {
        clearTimeout(scheduledRefresh.current);
      }
    };
  });

  usePollingEffect(() => !doesAppProxyUrlExist(workspaceId, 'cbasProxyUrlState') && loadAllRunSets(workflowsAppStore.get().cbasProxyUrlState), {
    ms: CbasPollInterval,
    leading: false,
  });

  const stateCell = ({ state, error_count: errorCount }) => {
    const stateContent = {
      UNKNOWN: 'Unknown',
      RUNNING: 'Running',
      COMPLETE: 'Success',
      ERROR: h(TextCell, { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, [`Failed with ${errorCount} errors`]),
      CANCELING: 'Canceling',
      CANCELED: 'Canceled',
      QUEUED: 'Queued',
    };

    const stateIconKey = {
      UNKNOWN: 'unknown',
      RUNNING: 'running',
      COMPLETE: 'succeeded',
      ERROR: 'failed',
      CANCELING: 'canceling',
      CANCELED: 'canceled',
      QUEUED: 'queued',
    };

    return div([makeStatusLine(statusType[stateIconKey[state]].icon, stateContent[state])]);
  };

  const filteredSortableRunSets = useMemo(
    () => {
      if (runSetsData) {
        const filteredRunSets = filterOption ? getFilteredRunSets(filterOption, runSetsData, userId, errorStates) : runSetsData;
        return getSortableRunSets(filteredRunSets, userId);
      }
      return [];
    },
    // Don't re-run if errorStates changes (since it never should change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterOption, runSetsData]
  );

  const sortedRunSets = useMemo(() => {
    return _.orderBy(sort.field, sort.direction, filteredSortableRunSets);
  }, [sort, filteredSortableRunSets]);
  const firstPageIndex = (pageNumber - 1) * itemsPerPage;
  const lastPageIndex = firstPageIndex + itemsPerPage;
  const paginatedRunSets = sortedRunSets.slice(firstPageIndex, lastPageIndex);

  const rowHeight = 175;

  return loading
    ? centeredSpinner()
    : div({ style: { display: 'flex', flexDirection: 'column', flex: 1 } }, [
        h(Fragment, [
          div({ style: { margin: '1rem 2rem' } }, [
            paginatedRunSets.length === 0 && runSetsData && runSetsData.length === 0
              ? h(Fragment, [
                  h2({ style: { marginTop: 0 } }, ['Submission history']),
                  div(
                    {
                      style: {
                        padding: '1rem',
                        border: `1px solid ${colors.accent(1)}`,
                        borderRadius: 5,
                        backgroundColor: colors.accent(0.08),
                        width: '75%',
                      },
                    },
                    ['No workflows have been submitted.']
                  ),
                ])
              : h(Fragment, [
                  h(Fragment, [
                    div({ style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between' } }, [
                      h2({ style: { marginTop: 0 } }, ['Submission history']),
                      h(FilterSubmissionsDropdown, { filterOption, setFilterOption }),
                    ]),
                  ]),
                  paginatedRunSets.length === 0 && runSetsData && runSetsData.length !== 0
                    ? div(
                        {
                          style: {
                            padding: '1rem',
                            border: `1px solid ${colors.accent(1)}`,
                            borderRadius: 5,
                            backgroundColor: colors.accent(0.08),
                            width: '75%',
                          },
                        },
                        ['No workflows match the given filter.']
                      )
                    : div({}, renderInstructionalElements(userId)),
                ]),
            paginatedRunSets.length > 0 &&
              h(Fragment, [
                div(
                  {
                    style: {
                      marginTop: '1em',
                      height: tableHeight({ actualRows: paginatedRunSets.length, maxRows: 12.5, heightPerRow: rowHeight }),
                      minHeight: '10em',
                    },
                  },
                  [
                    h(AutoSizer, [
                      ({ width, height }) =>
                        h(FlexTable, {
                          'aria-label': 'previous runs',
                          width,
                          height,
                          sort,
                          rowCount: paginatedRunSets.length,
                          noContentMessage: 'Nothing here yet! Your previously run workflows will be displayed here.',
                          hoverHighlight: true,
                          rowHeight,
                          styleCell: () => ({
                            display: 'inline',
                            alignItems: 'top',
                            paddingLeft: '1rem',
                            paddingRight: '1rem',
                            paddingTop: '1em',
                          }),
                          columns: [
                            {
                              size: { basis: 100, grow: 0 },
                              field: 'actions',
                              headerRenderer: () => h(TextCell, {}, ['Actions']),
                              cellRenderer: ({ rowIndex }) => {
                                const permissionToAbort = paginatedRunSets[rowIndex].user_id === userId;
                                return h(
                                  MenuTrigger,
                                  {
                                    'aria-label': 'Action selection menu',
                                    popupProps: {
                                      style: { left: '-20px' },
                                    },
                                    content: h(Fragment, [
                                      h(
                                        MenuButton,
                                        {
                                          style: { fontSize: 15 },
                                          disabled:
                                            !permissionToAbort ||
                                            isRunSetInTerminalState(paginatedRunSets[rowIndex].state) ||
                                            paginatedRunSets[rowIndex].state === 'CANCELING' ||
                                            paginatedRunSets[rowIndex].state === 'QUEUED',
                                          tooltip: Utils.cond(
                                            [isRunSetInTerminalState(paginatedRunSets[rowIndex].state), () => 'Cannot abort a terminal submission'],
                                            [paginatedRunSets[rowIndex].state === 'CANCELING', () => 'Cancel already requested on this submission.'],
                                            [
                                              paginatedRunSets[rowIndex].state === 'QUEUED',
                                              () => 'Cannot abort a submission that is in Queued state.',
                                            ],
                                            [!permissionToAbort, () => 'You must be the original submitter to abort this submission'],
                                            () => ''
                                          ),
                                          onClick: () => cancelRunSet(paginatedRunSets[rowIndex].run_set_id),
                                        },
                                        ['Abort']
                                      ),
                                    ]),
                                  },
                                  [
                                    h(
                                      Clickable,
                                      {
                                        style: { textAlign: 'center' },
                                        'aria-label': 'Action selection menu',
                                      },
                                      [icon('cardMenuIcon', { size: 35 })]
                                    ),
                                  ]
                                );
                              },
                            },
                            {
                              size: { basis: 350 },
                              field: 'runset_name',
                              headerRenderer: () => h(Sortable, { sort, field: 'runset_name', onSort: setSort }, ['Submission name']),
                              cellRenderer: ({ rowIndex }) => {
                                return div([
                                  h(
                                    Link,
                                    {
                                      href: Nav.getLink('workspace-workflows-app-submission-details', {
                                        name: workspace.workspace.name,
                                        namespace,
                                        submissionId: paginatedRunSets[rowIndex].run_set_id,
                                      }),
                                      style: { fontWeight: 'bold' },
                                    },
                                    [paginatedRunSets[rowIndex].run_set_name || 'No name']
                                  ),
                                  h(TextCell, { style: { display: 'block', marginTop: '1em', whiteSpace: 'normal' } }, [
                                    `Data used: ${paginatedRunSets[rowIndex].record_type}`,
                                  ]),
                                  h(TextCell, { style: { display: 'block', marginTop: '1em', whiteSpace: 'normal' } }, [
                                    `${paginatedRunSets[rowIndex].run_count} workflows`,
                                  ]),
                                ]);
                              },
                            },
                            {
                              size: { basis: 200, grow: 0 },
                              field: 'state',
                              headerRenderer: () => h(Sortable, { sort, field: 'state', onSort: setSort }, ['Status']),
                              cellRenderer: ({ rowIndex }) => {
                                return stateCell(paginatedRunSets[rowIndex]);
                              },
                            },
                            {
                              size: { basis: 200, grow: 0 },
                              field: 'submission_timestamp',
                              headerRenderer: () => h(Sortable, { sort, field: 'submission_timestamp', onSort: setSort }, ['Date Submitted']),
                              cellRenderer: ({ rowIndex }) => {
                                return h(TextCell, { style: { whiteSpace: 'normal' } }, [
                                  Utils.makeCompleteDate(paginatedRunSets[rowIndex].submission_timestamp),
                                ]);
                              },
                            },
                            {
                              size: { basis: 175, grow: 0 },
                              field: 'duration',
                              headerRenderer: () => h(Sortable, { sort, field: 'duration', onSort: setSort }, ['Duration']),
                              cellRenderer: ({ rowIndex }) => {
                                const row = paginatedRunSets[rowIndex];
                                return h(TextCell, [
                                  Utils.customFormatDuration(
                                    getDuration(row.state, row.submission_timestamp, row.last_modified_timestamp, isRunSetInTerminalState)
                                  ),
                                ]);
                              },
                            },
                            {
                              size: { basis: 210, grow: 0 },
                              field: 'submitter_priority',

                              headerRenderer: () =>
                                h(
                                  Sortable,
                                  {
                                    sort,
                                    field: 'submitter_priority',
                                    onSort: (nextSort) => setSort(nextSort),
                                  },
                                  ['Submitter']
                                ),

                              cellRenderer: ({ rowIndex }) => {
                                const nickname = samIdToWorkspaceNickname(paginatedRunSets[rowIndex].user_id);
                                return h(
                                  TextCell,
                                  { style: { whiteSpace: 'normal' } },
                                  paginatedRunSets[rowIndex].user_id === userId
                                    ? [
                                        span({ style: { fontWeight: 'bold' } }, 'You '),
                                        span({ style: { fontStyle: 'italic' } }, ['(', nickname, ')']),
                                      ]
                                    : [span({ style: { fontWeight: 'bold' } }, nickname)]
                                );
                              },
                            },
                            {
                              size: { basis: 600, grow: 0 },
                              field: 'comment',
                              headerRenderer: () => h(Sortable, { sort, field: 'comment', onSort: setSort }, ['Comment']),
                              cellRenderer: ({ rowIndex }) => {
                                return div({ style: { width: '100%', textAlign: 'left' } }, [
                                  h(TextCell, { style: { whiteSpace: 'normal', fontStyle: 'italic' } }, [
                                    paginatedRunSets[rowIndex].run_set_description || 'No Description',
                                  ]),
                                ]);
                              },
                            },
                          ],
                        }),
                    ]),
                  ]
                ),
              ]),
            !_.isEmpty(sortedRunSets) &&
              div({ style: { bottom: 0, position: 'absolute', marginBottom: '1.5rem', right: '4rem' } }, [
                Paginator({
                  filteredDataLength: sortedRunSets.length,
                  unfilteredDataLength: sortedRunSets.length,
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
          ]),
        ]),
      ]);
};
