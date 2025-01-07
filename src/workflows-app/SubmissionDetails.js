import _ from 'lodash/fp';
import { useCallback, useMemo, useRef, useState } from 'react';
import { div, h, h2, h3 } from 'react-hyperscript-helpers';
import { Link } from 'src/components/common';
import { centeredSpinner, icon } from 'src/components/icons';
import { SimpleTabBar } from 'src/components/tabBars';
import { AzureStorage } from 'src/libs/ajax/AzureStorage';
import { useMetricsEvent } from 'src/libs/ajax/metrics/useMetrics';
import { Cbas } from 'src/libs/ajax/workflows-app/Cbas';
import Events from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import { notify } from 'src/libs/notifications';
import { useCancellation, useOnMount, usePollingEffect } from 'src/libs/react-utils';
import { AppProxyUrlStatus, workflowsAppStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { customFormatDuration, makeCompleteDate, maybeParseJSON } from 'src/libs/utils';
import InputOutputModal from 'src/workflows-app/components/InputOutputModal';
import { HeaderSection, SubmitNewWorkflowButton } from 'src/workflows-app/components/job-common';
import { LogViewer } from 'src/workflows-app/components/LogViewer';
import { doesAppProxyUrlExist, loadAppUrls } from 'src/workflows-app/utils/app-utils';
import {
  AutoRefreshInterval,
  CbasPollInterval,
  getDuration,
  isRunInTerminalState,
  isRunSetInTerminalState,
} from 'src/workflows-app/utils/submission-utils';
import { wrapWorkflowsPage } from 'src/workflows-app/WorkflowsContainer';

import FilterableWorkflowTable from './components/FilterableWorkflowTable';
import SubmissionDetailsInputsTable from './components/SubmissionDetailsInputsTable';
import SubmissionDetailsOutputsTable from './components/SubmissionDetailsOutputsTable';

export const BaseSubmissionDetails = ({ name, namespace, workspace, submissionId }, _ref) => {
  // State
  const [runsData, setRunsData] = useState();
  const [runsFullyUpdated, setRunsFullyUpdated] = useState();
  const [loading, setLoading] = useState(false);
  const [runSetData, setRunSetData] = useState();
  const [methodsData, setMethodsData] = useState();
  const [activeTab, setActiveTab] = useState({ key: 'workflows' });
  const [configuredInputDefinition, setConfiguredInputDefinition] = useState([]);
  const [configuredOutputDefinition, setConfiguredOutputDefinition] = useState([]);

  const [logsModal, setLogsModal] = useState(undefined);
  const [taskDataModal, setTaskDataModal] = useState(undefined);
  const [sasToken, setSasToken] = useState('');

  const signal = useCancellation();
  const scheduledRefresh = useRef();
  const workspaceId = workspace.workspace.workspaceId;
  const { captureEvent } = useMetricsEvent();

  const loadMethodsData = useCallback(
    async (cbasUrlRoot, methodId, methodVersion) => {
      try {
        const methodsResponse = await Cbas(signal).methods.getById(cbasUrlRoot, methodId, methodVersion);
        const allMethods = methodsResponse.methods;
        if (allMethods) {
          setMethodsData(allMethods);
        } else {
          notify('error', 'Error loading methods data', { detail: 'Method not found.' });
        }
      } catch (error) {
        notify('error', 'Error loading methods data', { detail: error instanceof Response ? await error.text() : error });
      }
    },
    [signal]
  );

  const loadRuns = useCallback(
    async (cbasUrlRoot) => {
      try {
        return await Cbas(signal).runs.get(cbasUrlRoot, submissionId);
      } catch (error) {
        notify('error', 'Error loading saved workflows', { detail: error instanceof Response ? await error.text() : error });
      }
    },
    [signal, submissionId]
  );

  const setRuns = (runsResponse) => {
    const runsAnnotatedWithDurations = _.map(
      (r) => _.merge(r, { duration: getDuration(r.state, r.submission_date, r.last_modified_timestamp, isRunInTerminalState) }),
      runsResponse.runs
    );
    setRunsData(runsAnnotatedWithDurations);
    setRunsFullyUpdated(runsResponse.fully_updated);
  };

  const loadRunSets = useCallback(
    async (cbasUrlRoot) => {
      try {
        const runSets = await Cbas(signal).runSets.get(cbasUrlRoot);
        const newRunSetData = runSets.run_sets.find((runSet) => runSet.run_set_id === submissionId);
        setRunSetData(runSets.run_sets);
        setConfiguredInputDefinition(maybeParseJSON(newRunSetData.input_definition));
        setConfiguredOutputDefinition(maybeParseJSON(newRunSetData.output_definition));
        return runSets.run_sets;
      } catch (error) {
        notify('error', 'Error getting run set data', { detail: error instanceof Response ? await error.text() : error });
      }
    },
    [signal, submissionId]
  );

  // helper for auto-refresh
  const refresh = Utils.withBusyState(setLoading, async () => {
    try {
      let updatedRunSets;
      if (workflowsAppStore.get().cbasProxyUrlState.status === AppProxyUrlStatus.Ready) {
        updatedRunSets = await loadAllRunSets(workflowsAppStore.get().cbasProxyUrlState);
      }
      // only refresh if _this_ run set is in non-terminal state
      if (
        !updatedRunSets ||
        _.some(({ run_set_id: runSetId, state }) => runSetId === submissionId && !isRunSetInTerminalState(state), updatedRunSets)
      ) {
        scheduledRefresh.current = setTimeout(refresh, AutoRefreshInterval);
      }
    } catch (error) {
      notify('error', 'Error loading previous runs', { detail: error instanceof Response ? await error.text() : error });
    }
  });

  const loadAllRunSets = useCallback(
    async (cbasProxyUrlDetails) => {
      try {
        if (cbasProxyUrlDetails.status !== AppProxyUrlStatus.Ready) {
          const { cbasProxyUrlState } = await loadAppUrls(workspaceId, 'cbasProxyUrlState');

          if (cbasProxyUrlState.status === AppProxyUrlStatus.Ready) {
            const runsResponse = await loadRuns(cbasProxyUrlState.state);
            setRuns(runsResponse);
            const runSets = await loadRunSets(cbasProxyUrlState.state);
            if (runSets !== undefined) {
              setRunSetData(runSets);
              await loadMethodsData(cbasProxyUrlDetails.state, runSets.method_id, runSets.method_version_id);
              return runSets;
            }
            // });
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
          const runsResponse = await loadRuns(cbasProxyUrlDetails.state);
          setRuns(runsResponse);

          const runSets = await loadRunSets(cbasProxyUrlDetails.state);
          if (runSets !== undefined) {
            setRunSetData(runSets);
            await loadMethodsData(cbasProxyUrlDetails.state, runSets.method_id, runSets.method_version_id);
            return runSets;
          }
        }
      } catch (error) {
        notify('error', 'Error getting run set data', { detail: error instanceof Response ? await error.text() : error });
      }
    },
    [workspaceId, loadRuns, loadRunSets, loadMethodsData]
  );

  // poll if we're missing CBAS proxy url and stop polling when we have it
  usePollingEffect(() => !doesAppProxyUrlExist(workspaceId, 'cbasProxyUrlState') && loadAllRunSets(workflowsAppStore.get().cbasProxyUrlState), {
    ms: CbasPollInterval,
    leading: false,
  });

  useOnMount(() => {
    const fetchSasToken = async () => {
      const { sas } = await AzureStorage(signal).details(workspaceId);
      setSasToken(sas.token);
    };

    fetchSasToken();

    const loadWorkflowsApp = async () => {
      const { cbasProxyUrlState } = await loadAppUrls(workspaceId, 'cbasProxyUrlState');

      if (cbasProxyUrlState.status === AppProxyUrlStatus.Ready) {
        await refresh();
      }
    };
    loadWorkflowsApp();

    return () => {
      if (scheduledRefresh.current) {
        clearTimeout(scheduledRefresh.current);
      }
    };
  });

  const filteredRunSets = _.filter((r) => r.run_set_id === submissionId, runSetData);
  const methodId = filteredRunSets[0]?.method_id;
  const getSpecificMethod = _.filter((m) => m.method_id === methodId, methodsData);

  const header = useMemo(() => {
    const breadcrumbPathObjects = [
      {
        label: 'Submission History',
        path: 'workspace-workflows-app',
        pathParams: { name, namespace },
        queryParams: { tab: 'submission-history' },
      },
      {
        label: `Submission ${submissionId}`,
      },
    ];
    return h(HeaderSection, { breadcrumbPathObjects, button: h(SubmitNewWorkflowButton, { name, namespace }), title: 'Submission Details' });
  }, [name, namespace, submissionId]);

  return loading
    ? centeredSpinner()
    : div({ id: 'submission-details-page' }, [
        div(
          {
            style: {
              borderBottom: '2px solid rgb(116, 174, 67)',
              boxShadow: 'rgb(0 0 0 / 26%) 0px 2px 5px 0px, rgb(0 0 0 / 16%) 0px 2px 10px 0px',
              position: 'relative',
            },
          },
          [
            div({ style: { marginLeft: '4em', lineHeight: 1.25 } }, [
              h(
                Link,
                {
                  href: Nav.getLink(
                    'workspace-workflows-app',
                    {
                      name,
                      namespace,
                      workspace: {
                        workspace: { workspaceId },
                      },
                    },
                    {
                      tab: 'submission-history',
                    }
                  ),
                  style: { display: 'inline-flex', alignItems: 'center', padding: '1rem 0 0', fontSize: '115%' },
                },
                [icon('arrowLeft', { style: { marginRight: '0.5rem' } }), 'Back to submission history']
              ),
              header,
              h2(['Submission name: ', filteredRunSets[0]?.run_set_name]),
              h3(['Workflow name: ', getSpecificMethod[0]?.name]),
              h3(['Submission date: ', filteredRunSets[0] && makeCompleteDate(filteredRunSets[0].submission_timestamp)]),
              h3([
                'Duration: ',
                filteredRunSets[0] &&
                  customFormatDuration(
                    getDuration(
                      filteredRunSets[0].state,
                      filteredRunSets[0].submission_timestamp,
                      filteredRunSets[0].last_modified_timestamp,
                      isRunSetInTerminalState
                    )
                  ),
              ]),
              h(SimpleTabBar, {
                'aria-label': 'view workflows results, inputs, or outputs',
                value: activeTab.key || 'workflows',
                onChange: (v) => setActiveTab({ key: v }),
                tabs: [
                  { key: 'workflows', title: 'Workflows' },
                  { key: 'inputs', title: 'Inputs' },
                  { key: 'outputs', title: 'Outputs' },
                ],
              }),
            ]),
          ]
        ),
        logsModal &&
          h(LogViewer, {
            modalTitle: logsModal.modalTitle,
            logs: logsModal.logsArray,
            onDismiss: () => {
              setLogsModal(undefined);
              captureEvent(Events.workflowsAppCloseLogViewer);
            },
          }),
        taskDataModal &&
          h(InputOutputModal, {
            title: taskDataModal.taskDataTitle,
            jsonData: taskDataModal.taskJson,
            onDismiss: () => setTaskDataModal(undefined),
            sasToken,
            workspaceId,
          }),
        div(
          {
            style: {
              display: 'flex',
              flex: '1 0 auto',
              backgroundColor: 'rgb(235, 236, 238)',
            },
          },
          [
            Utils.switchCase(
              activeTab.key || 'workflows',
              [
                'workflows',
                () =>
                  runsData &&
                  h(FilterableWorkflowTable, {
                    runsData,
                    runsFullyUpdated,
                    namespace,
                    submissionId,
                    workspaceName: name,
                    workspaceId,
                    setLogsModal,
                    setTaskDataModal,
                  }),
              ],
              ['inputs', () => h(SubmissionDetailsInputsTable, { configuredInputDefinition })],
              ['outputs', () => h(SubmissionDetailsOutputsTable, { configuredOutputDefinition })]
            ),
          ]
        ),
      ]);
};

export const SubmissionDetails = wrapWorkflowsPage({ name: 'SubmissionDetails' })(BaseSubmissionDetails);

export const navPaths = [
  {
    name: 'workspace-workflows-app-submission-details',
    path: '/workspaces/:namespace/:name/workflows-app/submission-history/:submissionId',
    component: SubmissionDetails,
    title: ({ name }) => `${name} - Submission Details`,
  },
];
