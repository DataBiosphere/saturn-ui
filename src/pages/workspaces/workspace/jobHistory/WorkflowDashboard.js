import ReactJson from '@microlink/react-json-view';
import _ from 'lodash/fp';
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import { bucketBrowserUrl } from 'src/auth/auth';
import * as breadcrumbs from 'src/components/breadcrumbs';
import { ClipboardButton } from 'src/components/ClipboardButton';
import Collapse from 'src/components/Collapse';
import { Link } from 'src/components/common';
import { centeredSpinner, icon } from 'src/components/icons';
import {
  collapseCromwellStatus,
  collapseStatus,
  makeSection,
  makeStatusLine,
  statusType,
  workflowDetailsBreadcrumbSubtitle,
} from 'src/components/job-common';
import WDLViewer from 'src/components/WDLViewer';
import { Metrics } from 'src/libs/ajax/Metrics';
import { CromIAM } from 'src/libs/ajax/workflows-app/CromIAM';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { getConfig } from 'src/libs/config';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { forwardRefWithName, useCancellation, useOnMount } from 'src/libs/react-utils';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import CallTable from 'src/pages/workspaces/workspace/jobHistory/CallTable';
import { UriViewer } from 'src/workspace-data/data-table/uri-viewer/UriViewer';
import { wrapWorkspace } from 'src/workspaces/container/WorkspaceContainer';

const styles = {
  sectionTableLabel: { fontWeight: 600 },
};

// Note: this can take a while with large data inputs. Consider memoization if the page ever needs re-rendering.
const groupCallStatuses = _.flow(
  _.values,
  _.flattenDepth(1),
  _.countBy((a) => {
    const collapsedStatus = collapseCromwellStatus(a.executionStatus, a.backendStatus);
    return collapsedStatus !== statusType.unknown ? collapsedStatus.id : collapsedStatus.label(a.executionStatus);
  })
);

const statusCell = ({ calls }) => {
  const statusGroups = groupCallStatuses(calls);
  // Note: these variable names match the id values of statusType (except for unknownStatuses, which will be their labels).
  const { ...unknownStatuses } = statusGroups;

  const makeRow = (count, status, labelOverride) => {
    const seeMore = status.moreInfoLink
      ? h(Link, { href: status.moreInfoLink, style: { marginLeft: '0.50rem' }, ...Utils.newTabLinkProps }, [
          status.moreInfoLabel,
          icon('pop-out', { size: 12, style: { marginLeft: '0.25rem' } }),
        ])
      : '';
    return (
      !!count &&
      div({ style: { display: 'flex', alignItems: 'center', marginTop: '0.25rem' } }, [
        status.icon(),
        ` ${count} ${labelOverride || status.label()}`,
        seeMore,
      ])
    );
  };
  return h(
    Fragment,
    _.concat(
      ['submitted', 'waitingForQuota', 'running', 'succeeded', 'failed']
        .filter((s) => statusGroups[s])
        .map((s) => makeRow(statusGroups[s], statusType[s])),
      _.map(([label, count]) => makeRow(count, statusType.unknown, label), _.toPairs(unknownStatuses))
    )
  );
};

const WorkflowDashboard = _.flow(
  forwardRefWithName('WorkflowDashboard'),
  wrapWorkspace({
    breadcrumbs: (props) => breadcrumbs.commonPaths.workspaceDashboard(props),
    title: 'Submission History',
    activeTab: 'submission history',
  })
)(({ namespace, name, submissionId, workflowId, workspace }, _ref) => {
  /*
   * State setup
   */
  const [workflow, setWorkflow] = useState();
  const [fetchTime, setFetchTime] = useState();
  const [showLog, setShowLog] = useState(false);

  const signal = useCancellation();
  const stateRefreshTimer = useRef();

  /*
   * Data fetchers
   */

  useOnMount(() => {
    const loadWorkflow = async () => {
      const includeKey = [
        'end',
        'executionStatus',
        'failures',
        'start',
        'status',
        'submittedFiles:workflow',
        'workflowLog',
        'workflowRoot',
        'callCaching:result',
        'callCaching:effectiveCallCachingMode',
        'backendStatus',
      ];
      const excludeKey = [];

      const timeBefore = Date.now();
      const wf = await Workspaces(signal).workspace(namespace, name).submission(submissionId).workflow(workflowId);
      const metadata = await wf.metadata({ includeKey, excludeKey });
      setWorkflow(metadata);
      setFetchTime(Date.now() - timeBefore);

      if (_.includes(collapseStatus(metadata.status), [statusType.running, statusType.submitted])) {
        stateRefreshTimer.current = setTimeout(loadWorkflow, 60000);
      }
    };

    loadWorkflow();
    return () => {
      clearTimeout(stateRefreshTimer.current);
    };
  });

  //  Below two methods are data fetchers used in the call cache wizard. Defined
  // here so we can easily use the cloud context (we're in GCP).
  const loadCallCacheDiff = useCallback(
    async (thisWorkflow, thatWorkflow) => {
      return CromIAM(signal).callCacheDiff(thisWorkflow, thatWorkflow);
    },
    [signal]
  );

  const loadCallCacheMetadata = useCallback(
    async (wfId, includeKey, excludeKey) => {
      return CromIAM(signal).workflowMetadata(wfId, includeKey, excludeKey);
    },
    [signal]
  );

  /*
   * Page render
   */
  const { metadataArchiveStatus, end, failures, start, status, workflowLog, workflowRoot, submittedFiles: { workflow: wdl } = {} } = workflow || {};

  const callObjects = useMemo(() => workflow?.calls || {}, [workflow]);

  const restructureFailures = (failuresArray) => {
    const filtered = _.filter(({ message }) => !_.isEmpty(message) && !message.startsWith('Will not start job'), failuresArray);
    const sizeDiff = failuresArray.length - filtered.length;
    const newMessage =
      sizeDiff > 0
        ? [
            {
              message: `${sizeDiff} jobs were queued in Cromwell but never sent to the cloud backend due to failures elsewhere in the workflow`,
            },
          ]
        : [];
    const simplifiedFailures = [...filtered, ...newMessage];

    return _.map(
      ({ message, causedBy }) => ({
        message,
        ...(!_.isEmpty(causedBy) ? { causedBy: restructureFailures(causedBy) } : {}),
      }),
      simplifiedFailures
    );
  };

  return div({ style: { padding: '1rem 2rem 2rem', flex: 1, display: 'flex', flexDirection: 'column' } }, [
    workflowDetailsBreadcrumbSubtitle(namespace, name, submissionId, workflowId),
    Utils.cond(
      [
        workflow === undefined,
        () => h(Fragment, [div({ style: { fontStyle: 'italic', marginBottom: '1rem' } }, ['Fetching workflow metadata...']), centeredSpinner()]),
      ],
      [
        metadataArchiveStatus === 'ArchivedAndDeleted',
        () =>
          h(Fragment, [
            div({ style: { lineHeight: '24px', marginTop: '0.5rem', ...Style.elements.sectionHeader } }, ' Workflow Details Archived'),
            div({ style: { lineHeight: '24px', marginTop: '0.5rem' } }, [
              "This workflow's details have been archived. Please refer to the ",
              h(
                Link,
                {
                  href: 'https://support.terra.bio/hc/en-us/articles/360060601631',
                  ...Utils.newTabLinkProps,
                },
                [icon('pop-out', { size: 18 }), ' Workflow Details Archived']
              ),
              ' support article for details on how to access the archive.',
            ]),
          ]),
      ],
      () =>
        h(Fragment, [
          div({ style: { fontStyle: 'italic', marginBottom: '1rem' } }, [`Workflow metadata fetched in ${fetchTime}ms`]),
          div({ style: { display: 'flex', flexWrap: 'wrap' } }, [
            makeSection('Workflow Status', [
              div({ style: { lineHeight: '24px', marginTop: '0.5rem' } }, [makeStatusLine((style) => collapseStatus(status).icon(style), status)]),
            ]),
            makeSection('Workflow Timing', [
              div({ style: { marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem' } }, [
                div({ style: styles.sectionTableLabel }, ['Start:']),
                div([start ? Utils.makeCompleteDate(start) : 'N/A']),
                div({ style: styles.sectionTableLabel }, ['End:']),
                div([end ? Utils.makeCompleteDate(end) : 'N/A']),
              ]),
            ]),
            makeSection('Links', [
              div({ style: { display: 'flex', flexFlow: 'row wrap', marginTop: '0.5rem', lineHeight: '2rem' } }, [
                h(
                  Link,
                  {
                    ...Utils.newTabLinkProps,
                    href: `${getConfig().jobManagerUrlRoot}/${workflowId}`,
                    onClick: () =>
                      void Metrics().captureEvent(Events.jobManagerOpenExternal, {
                        workflowId,
                        from: 'workspace-workflow-dashboard',
                        ...extractWorkspaceDetails(workspace.workspace),
                      }),
                    style: { display: 'flex', alignItems: 'center' },
                    tooltip: 'Job Manager',
                  },
                  [icon('tasks', { size: 18 }), ' Job Manager']
                ),
                workflowRoot &&
                  h(
                    Link,
                    {
                      ...Utils.newTabLinkProps,
                      href: bucketBrowserUrl(workflowRoot.replace('gs://', '')),
                      style: { display: 'flex', marginLeft: '1rem', alignItems: 'center' },
                      tooltip: 'Execution directory',
                    },
                    [icon('folder-open', { size: 18 }), ' Execution Directory']
                  ),
                h(
                  Link,
                  {
                    onClick: () => setShowLog(true),
                    style: { display: 'flex', marginLeft: '1rem', alignItems: 'center' },
                  },
                  [icon('fileAlt', { size: 18 }), ' View execution log']
                ),
              ]),
            ]),
          ]),
          failures &&
            h(
              Collapse,
              {
                style: { marginBottom: '1rem' },
                initialOpenState: true,
                title: div({ style: Style.elements.sectionHeader }, [
                  'Workflow-Level Failures',
                  h(ClipboardButton, {
                    text: JSON.stringify(failures, null, 2),
                    style: { marginLeft: '0.5rem' },
                    onClick: (e) => e.stopPropagation(), // this stops the collapse when copying
                  }),
                ]),
              },
              [
                h(ReactJson, {
                  style: { whiteSpace: 'pre-wrap' },
                  name: false,
                  collapsed: 4,
                  enableClipboard: false,
                  displayDataTypes: false,
                  displayObjectSize: false,
                  src: restructureFailures(failures),
                }),
              ]
            ),
          h(
            Collapse,
            {
              title: div({ style: Style.elements.sectionHeader }, ['Calls']),
              initialOpenState: true,
            },
            [
              div({ style: { marginLeft: '1rem' } }, [
                makeSection('Total Call Status Counts', [
                  !_.isEmpty(callObjects)
                    ? statusCell(workflow)
                    : div({ style: { marginTop: '0.5rem' } }, ['No calls have been started by this workflow.']),
                ]),
                !_.isEmpty(callObjects) &&
                  makeSection(
                    'Call Lists',
                    [h(CallTable, { namespace, name, submissionId, workflowId, callObjects, loadCallCacheDiff, loadCallCacheMetadata })],
                    {
                      style: { overflow: 'visible' },
                    }
                  ),
              ]),
            ]
          ),
          wdl &&
            h(
              Collapse,
              {
                title: div({ style: Style.elements.sectionHeader }, ['Submitted workflow script']),
              },
              [h(WDLViewer, { wdl })]
            ),
          showLog && h(UriViewer, { workspace, uri: workflowLog, onDismiss: () => setShowLog(false) }),
        ])
    ),
  ]);
});

export const navPaths = [
  {
    name: 'workspace-workflow-dashboard',
    path: '/workspaces/:namespace/:name/submission_history/:submissionId/:workflowId',
    component: WorkflowDashboard,
    title: ({ name }) => `${name} - Workflow Dashboard`,
  },
];
