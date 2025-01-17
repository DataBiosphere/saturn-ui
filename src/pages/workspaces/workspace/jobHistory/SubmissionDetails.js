import { TooltipTrigger } from '@terra-ui-packages/components';
import { delay } from '@terra-ui-packages/core-utils';
import { differenceInDays, parseISO } from 'date-fns/fp';
import _ from 'lodash/fp';
import { Fragment, useEffect, useState } from 'react';
import { div, h, h4 } from 'react-hyperscript-helpers';
import { AutoSizer } from 'react-virtualized';
import { bucketBrowserUrl } from 'src/auth/auth';
import * as breadcrumbs from 'src/components/breadcrumbs';
import { ClipboardButton } from 'src/components/ClipboardButton';
import { ButtonSecondary, Link, Select } from 'src/components/common';
import { centeredSpinner, icon } from 'src/components/icons';
import { InfoBox } from 'src/components/InfoBox';
import { DelayedSearchInput } from 'src/components/input';
import {
  addCountSuffix,
  collapseStatus,
  makeSection,
  makeStatusLine,
  statusType,
  submissionDetailsBreadcrumbSubtitle,
} from 'src/components/job-common';
import { SimpleTabBar } from 'src/components/tabBars';
import { FlexTable, flexTableDefaultRowHeight, Sortable, TextCell, TooltipCell } from 'src/components/table';
import { Metrics } from 'src/libs/ajax/Metrics';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import colors from 'src/libs/colors';
import { getConfig } from 'src/libs/config';
import { withErrorReporting } from 'src/libs/error';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import { forwardRefWithName, useCancellation } from 'src/libs/react-utils';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { downloadIO, downloadWorkflows, ioTask, ioVariable, WorkflowTableColumnNames } from 'src/libs/workflow-utils';
import UpdateUserCommentModal from 'src/pages/workspaces/workspace/jobHistory/UpdateUserCommentModal';
import { wrapWorkspace } from 'src/workspaces/container/WorkspaceContainer';

const workflowStatuses = ['Queued', 'Launching', 'Submitted', 'Running', 'Aborting', 'Succeeded', 'Failed', 'Aborted'];

// Note: This 'deletionDelayYears' value should reflect the current 'deletion-delay' value configured for PROD in firecloud-develop's
// 'cromwell.conf.ctmpl' file:
const deletionDelayYears = 1;
const deletionDelayString = `${deletionDelayYears} year${deletionDelayYears > 1 ? 's' : ''}`;
const isDeleted = (statusLastChangedDate) => differenceInDays(parseISO(statusLastChangedDate), Date.now()) > deletionDelayYears * 365;

const deletedInfoIcon = ({ name, icon: iconName }) => {
  return h(
    InfoBox,
    {
      style: { color: colors.secondary(), margin: '0.5rem' },
      tooltip: `${name} unavailable. Click to learn more.`,
      icon: iconName,
    },
    [
      div({ style: Style.elements.sectionHeader }, 'Workflow Details Archived'),
      div({ style: { padding: '0.5rem 0' } }, [`This workflow's details have been archived (> ${deletionDelayString} old).`]),
      div([
        'Please refer to the ',
        h(
          Link,
          {
            href: 'https://support.terra.bio/hc/en-us/articles/360060601631',
            ...Utils.newTabLinkProps,
          },
          ['Workflow Details Archived support article ', icon('pop-out', { size: 18 })]
        ),
        ' for more details.',
      ]),
    ]
  );
};

const tableRowHeight = flexTableDefaultRowHeight;

const SubmissionWorkflowsTable = ({ workspace, submission }) => {
  const {
    workspace: { namespace, name },
  } = workspace;
  const { submissionId, submissionRoot, workflows = [] } = submission;

  const [statusFilter, setStatusFilter] = useState([]);
  const [textFilter, setTextFilter] = useState('');
  const [sort, setSort] = useState({ field: 'workflowEntity', direction: 'asc' });

  const filteredWorkflows = _.flow(
    _.filter(({ status, asText }) => {
      if (_.isEmpty(statusFilter) || statusFilter.includes(status)) {
        return _.every((term) => asText.includes(term.toLowerCase()), textFilter.split(/\s+/));
      }
      return false;
    }),
    _.sortBy(sort.field),
    sort.direction === 'asc' ? _.identity : _.reverse
  )(workflows);

  return h(Fragment, [
    div({ style: { margin: '1rem 0', display: 'flex', alignItems: 'center' } }, [
      h(DelayedSearchInput, {
        style: { marginRight: '2rem', flexBasis: 300, borderColor: colors.dark(0.55) },
        placeholder: 'Search workflows',
        'aria-label': 'Search workflows',
        onChange: setTextFilter,
        value: textFilter,
      }),
      div({ style: { marginRight: '2rem', flexBasis: 350 } }, [
        h(Select, {
          isClearable: true,
          isMulti: true,
          isSearchable: false,
          placeholder: 'Completion status',
          'aria-label': 'Completion status',
          value: statusFilter,
          onChange: (data) => setStatusFilter(_.map('value', data)),
          options: workflowStatuses,
        }),
      ]),
      h(Link, { onClick: () => downloadWorkflows(filteredWorkflows, submissionId) }, ['Download TSV']),
    ]),
    // 48px is based on the default row height of FlexTable
    div({ style: { flex: `1 0 ${(1 + _.min([filteredWorkflows.length, 5.5])) * tableRowHeight}px` } }, [
      h(AutoSizer, [
        ({ width, height }) =>
          h(FlexTable, {
            'aria-label': 'submission details',
            width,
            height,
            sort,
            headerHeight: tableRowHeight,
            rowHeight: tableRowHeight,
            rowCount: filteredWorkflows.length,
            noContentMessage: 'No matching workflows',
            columns: [
              {
                size: { basis: 225 },
                field: 'workflowEntity',
                headerRenderer: () => h(Sortable, { sort, field: 'workflowEntity', onSort: setSort }, ['Data Entity']),
                cellRenderer: ({ rowIndex }) => {
                  const { workflowEntity: { entityName, entityType } = {} } = filteredWorkflows[rowIndex];
                  return entityName ? h(TooltipCell, [`${entityName} (${entityType})`]) : div({ style: { color: colors.dark(0.7) } }, ['--']);
                },
              },
              {
                size: { basis: 225, grow: 0 },
                field: 'statusLastChangedDate',
                headerRenderer: () => h(Sortable, { sort, field: 'statusLastChangedDate', onSort: setSort }, ['Last Changed']),
                cellRenderer: ({ rowIndex }) => {
                  return h(TextCell, [Utils.makeCompleteDate(filteredWorkflows[rowIndex].statusLastChangedDate)]);
                },
              },
              {
                size: { basis: 150, grow: 0 },
                field: 'status',
                headerRenderer: () => h(Sortable, { sort, field: 'status', onSort: setSort }, ['Status']),
                cellRenderer: ({ rowIndex }) => {
                  const { status } = filteredWorkflows[rowIndex];
                  return div({ style: { display: 'flex' } }, [collapseStatus(status).icon({ marginRight: '0.5rem' }), status]);
                },
              },
              {
                size: { basis: 125, grow: 0 },
                field: 'cost',
                headerRenderer: () => h(Sortable, { sort, field: 'cost', onSort: setSort }, ['Run Cost']),
                cellRenderer: ({ rowIndex }) => {
                  const cost = filteredWorkflows[rowIndex].cost;
                  return cost instanceof String ? h(TextCell, [Utils.formatUSD(cost || 0)]) : cost;
                },
              },
              {
                size: _.some(({ messages }) => !_.isEmpty(messages), filteredWorkflows) ? { basis: 200 } : { basis: 100, grow: 0 },
                field: 'messages',
                headerRenderer: () => h(Sortable, { sort, field: 'messages', onSort: setSort }, ['Messages']),
                cellRenderer: ({ rowIndex }) => {
                  const messages = _.join('\n', filteredWorkflows[rowIndex].messages);
                  return h(
                    TooltipCell,
                    {
                      tooltip: div({ style: { whiteSpace: 'pre-wrap', overflowWrap: 'break-word' } }, [messages]),
                    },
                    [messages]
                  );
                },
              },
              {
                size: { basis: 150 },
                field: 'workflowId',
                headerRenderer: () => h(Sortable, { sort, field: 'workflowId', onSort: setSort }, ['Workflow ID']),
                cellRenderer: ({ rowIndex }) => {
                  const { workflowId } = filteredWorkflows[rowIndex];
                  return (
                    workflowId &&
                    h(Fragment, [
                      h(TooltipCell, { tooltip: workflowId }, [workflowId]),
                      h(ClipboardButton, { text: workflowId, style: { marginLeft: '0.5rem' } }),
                    ])
                  );
                },
              },
              {
                size: { basis: 150, grow: 0 },
                headerRenderer: () => 'Links',
                cellRenderer: ({ rowIndex }) => {
                  const {
                    workflowId,
                    inputResolutions: [{ inputName } = {}],
                  } = filteredWorkflows[rowIndex];
                  return (
                    workflowId &&
                    h(Fragment, [
                      isDeleted(filteredWorkflows[rowIndex].statusLastChangedDate)
                        ? [
                            deletedInfoIcon({ name: 'Job Manager', icon: 'tasks' }),
                            deletedInfoIcon({ name: 'Workflow Dashboard', icon: 'tachometer' }),
                          ]
                        : [
                            h(
                              Link,
                              {
                                key: 'manager',
                                ...Utils.newTabLinkProps,
                                href: `${getConfig().jobManagerUrlRoot}/${workflowId}`,
                                onClick: () =>
                                  void Metrics().captureEvent(Events.jobManagerOpenExternal, {
                                    workflowId,
                                    from: 'workspace-submission-details',
                                    ...extractWorkspaceDetails(workspace.workspace),
                                  }),
                                style: { margin: '0.5rem', display: 'flex' },
                                tooltip: 'Job Manager',
                                'aria-label': `Job Manager (for workflow ID ${workflowId})`,
                              },
                              [icon('tasks', { size: 18 })]
                            ),
                            h(
                              Link,
                              {
                                key: 'dashboard',
                                href: Nav.getLink('workspace-workflow-dashboard', { namespace, name, submissionId, workflowId }),
                                style: { margin: '0.5rem', display: 'flex' },
                                tooltip: 'Workflow Dashboard [alpha]',
                                'aria-label': `Workflow Dashboard (for workflow ID ${workflowId}}`,
                              },
                              [icon('tachometer', { size: 18 })]
                            ),
                          ],
                      inputName &&
                        h(
                          Link,
                          {
                            key: 'directory',
                            ...Utils.newTabLinkProps,
                            href: bucketBrowserUrl(`${submissionRoot.replace('gs://', '')}/${inputName.split('.')[0]}/${workflowId}`),
                            style: { margin: '0.5rem', display: 'flex' },
                            tooltip: 'Execution directory',
                            'aria-label': `Execution directory (for workflow ID ${workflowId})`,
                          },
                          [icon('folder-open', { size: 18 })]
                        ),
                    ])
                  );
                },
              },
            ],
          }),
      ]),
    ]),
  ]);
};

const SubmissionWorkflowIOTable = ({ type, inputOutputs }) => {
  const [textFilter, setTextFilter] = useState('');
  const [sort, setSort] = useState({ field: 'task', direction: 'asc' });
  const valueColumnName = type === 'inputs' ? WorkflowTableColumnNames.INPUT_VALUE : WorkflowTableColumnNames.OUTPUT_NAME;
  const filteredInputOutputs = _.flow(
    _.toPairs,
    _.map(([name, value]) => ({
      task: ioTask(name),
      variable: ioVariable(name),
      value,
    })),
    _.filter(({ task, variable }) => {
      return _.some(_.includes(textFilter), [task, variable]);
    }),
    sort.field === 'task' ? _.orderBy(['task', 'variable'], [sort.direction, sort.direction]) : _.orderBy(sort.field, sort.direction)
  )(inputOutputs);

  return h(Fragment, [
    div({ style: { margin: '1rem 0', display: 'flex', alignItems: 'center' } }, [
      h(DelayedSearchInput, {
        style: { marginRight: '2rem', flexBasis: 300, borderColor: colors.dark(0.55) },
        placeholder: `Search ${type}`,
        'aria-label': `Search ${type}`,
        onChange: setTextFilter,
        value: textFilter,
      }),
      h(Link, { onClick: () => downloadIO(inputOutputs, type) }, ['Download JSON']),
    ]),
    div({ style: { flex: `1 0 ${(1 + _.min([inputOutputs.length, 5.5])) * tableRowHeight}px` } }, [
      h(AutoSizer, [
        ({ width, height }) =>
          h(FlexTable, {
            'aria-label': `Submission ${type}`,
            width,
            height,
            sort,
            headerHeight: tableRowHeight,
            rowHeight: tableRowHeight,
            rowCount: filteredInputOutputs.length,
            noContentMessage: `No matching ${type}`,
            columns: [
              {
                size: { basis: 350, grow: 0 },
                field: 'task',
                headerRenderer: () => h(Sortable, { sort, field: 'task', onSort: setSort }, ['Task name']),
                cellRenderer: ({ rowIndex }) => h(TextCell, [filteredInputOutputs[rowIndex].task]),
              },
              {
                size: { basis: 360, grow: 0 },
                field: 'variable',
                headerRenderer: () => h(Sortable, { sort, field: 'variable', onSort: setSort }, ['Variable']),
                cellRenderer: ({ rowIndex }) => h(TextCell, [filteredInputOutputs[rowIndex].variable]),
              },
              {
                field: 'value',
                headerRenderer: () => h(Sortable, { sort, field: 'value', onSort: setSort }, [valueColumnName]),
                cellRenderer: ({ rowIndex }) => h(TextCell, [filteredInputOutputs[rowIndex].value]),
              },
            ],
          }),
      ]),
    ]),
  ]);
};

const SubmissionDetails = _.flow(
  forwardRefWithName('SubmissionDetails'),
  wrapWorkspace({
    breadcrumbs: (props) => breadcrumbs.commonPaths.workspaceDashboard(props),
    title: 'Job History',
    activeTab: 'job history',
  })
)((props, _ref) => {
  const { namespace, name, submissionId, workspace } = props;

  /*
   * State setup
   */
  const [submission, setSubmission] = useState({});
  const [configuration, setConfiguration] = useState(undefined);
  const [methodAccessible, setMethodAccessible] = useState();
  const [updatingComment, setUpdatingComment] = useState(false);
  const [userComment, setUserComment] = useState();
  const [tab, setTab] = useState('workflows');

  const signal = useCancellation();

  /*
   * Data fetchers
   */

  useEffect(() => {
    const initialize = withErrorReporting('Unable to fetch submission details')(async () => {
      if (
        _.isEmpty(submission) ||
        _.some(({ status }) => _.includes(collapseStatus(status), [statusType.running, statusType.submitted]), submission.workflows)
      ) {
        if (!_.isEmpty(submission)) {
          await delay(60000);
        }

        const sub = _.update(
          ['workflows'],
          _.map((wf) => {
            // when the cost isn't reported for the workflow, set it to N/A
            wf.cost ??= 'N/A';
            const {
              cost,
              inputResolutions,
              messages,
              status,
              statusLastChangedDate,
              workflowEntity: { entityType, entityName } = {},
              workflowId,
            } = wf;

            const wfAsText = _.join(' ', [
              cost,
              ...messages,
              status,
              statusLastChangedDate,
              entityType,
              entityName,
              workflowId,
              ..._.flatMap(({ inputName, value }) => [inputName, JSON.stringify(value)], inputResolutions),
            ]).toLowerCase();

            return _.set('asText', wfAsText, wf);
          }),
          await Workspaces(signal).workspace(namespace, name).submission(submissionId).get()
        );

        setSubmission(sub);
        setUserComment(sub.userComment);

        setConfiguration(await Workspaces(signal).workspace(namespace, name).submission(submissionId).getConfiguration());

        if (_.isEmpty(submission)) {
          try {
            const { methodConfigurationName: configName, methodConfigurationNamespace: configNamespace } = sub;
            await Workspaces(signal).workspace(namespace, name).methodConfig(configNamespace, configName).get();
            setMethodAccessible(true);
          } catch {
            setMethodAccessible(false);
          }
        }
      }
    });

    initialize();
  }, [submission]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
   * Data prep
   */
  const {
    cost,
    methodConfigurationName: workflowName,
    methodConfigurationNamespace: workflowNamespace,
    submissionDate,
    submissionEntity: { entityType, entityName } = {},
    submitter,
    useCallCache,
    deleteIntermediateOutputFiles,
    submissionRoot,
    useReferenceDisks,
    memoryRetryMultiplier,
    workflows = [],
  } = submission;

  const statusGroups = _.groupBy((wf) => collapseStatus(wf.status).id, workflows);

  /**
   * If the text has multiple lines, return just the first line of text with ellipses to indicate truncation.
   */
  const firstLine = _.flow(_.split('\n'), (lines) => (lines.length > 1 ? `${lines[0]} ...` : lines[0]));

  /*
   * Page render
   */
  return div({ style: { padding: '1rem 2rem 2rem', flex: 1, display: 'flex', flexDirection: 'column' } }, [
    submissionDetailsBreadcrumbSubtitle(namespace, name, submissionId),
    _.isEmpty(submission)
      ? centeredSpinner()
      : h(Fragment, [
          div({ style: { display: 'grid', gridTemplateColumns: '1fr 4fr' } }, [
            div({ style: { display: 'grid', gridTemplateRows: '1fr auto' } }, [
              makeSection(
                'Workflow Statuses',
                ['succeeded', 'failed', 'running', 'submitted']
                  .filter((s) => statusGroups[s])
                  .map((s) =>
                    makeStatusLine(statusType[s].icon, addCountSuffix(statusType[s].label(), statusGroups[s].length), { marginTop: '0.5rem' })
                  )
              ),
              div(
                {
                  style: { padding: '0 0.5rem 0.5rem', marginTop: '1.0rem', whiteSpace: 'pre', overflow: 'hidden' },
                },
                [
                  h4({ style: Style.elements.sectionHeader }, [
                    'Comment',
                    h(
                      ButtonSecondary,
                      {
                        style: { marginLeft: '0.50rem', height: '1.0rem' },
                        tooltip: 'Edit Comment',
                        onClick: () => setUpdatingComment(true),
                      },
                      [icon('edit')]
                    ),
                  ]),
                  div({ style: { height: '1.0rem', textOverflow: 'ellipsis', overflow: 'hidden' } }, [firstLine(userComment)]),
                ]
              ),
              updatingComment &&
                h(UpdateUserCommentModal, {
                  workspace: { name, namespace },
                  submissionId,
                  userComment,
                  onDismiss: () => setUpdatingComment(false),
                  onSuccess: (updatedComment) => setUserComment(updatedComment),
                }),
            ]),
            div({ style: { display: 'flex', flexWrap: 'wrap' } }, [
              makeSection('Workflow Configuration', [
                Utils.cond(
                  [
                    methodAccessible,
                    () => {
                      return h(
                        Link,
                        {
                          href: Nav.getLink('workflow', { namespace, name, workflowNamespace, workflowName }),
                          style: Style.noWrapEllipsis,
                        },
                        [`${workflowNamespace}/${workflowName}`]
                      );
                    },
                  ],
                  [
                    methodAccessible === false,
                    () => {
                      return div({ style: { display: 'flex', alignItems: 'center' } }, [
                        h(TooltipCell, [`${workflowNamespace}/${workflowName}`]), // TODO fix this width or wrap better
                        h(
                          TooltipTrigger,
                          {
                            content: 'This configuration was updated or deleted since this submission ran.',
                          },
                          [icon('ban', { size: 16, style: { color: colors.warning(), marginLeft: '0.3rem' } })]
                        ),
                      ]);
                    },
                  ],
                  () => div({ style: Style.noWrapEllipsis }, [`${workflowNamespace}/${workflowName}`])
                ),
              ]),
              makeSection('Submitted by', [div([submitter]), Utils.makeCompleteDate(submissionDate)]),
              makeSection('Total Run Cost', [cost ? Utils.format(cost) : 'N/A']),
              makeSection('Data Entity', [div([entityName]), div([entityType])]),
              makeSection('Submission ID', [
                h(Link, { href: bucketBrowserUrl(submissionRoot.replace('gs://', '')), ...Utils.newTabLinkProps }, submissionId),
                h(ClipboardButton, {
                  'aria-label': 'Copy submission ID to clipboard',
                  className: 'cell-hover-only',
                  style: { marginLeft: '0.5rem', display: 'inline' },
                  text: submissionRoot.split('/').pop(),
                }),
              ]),
              makeSection('Call Caching', [useCallCache ? 'Enabled' : 'Disabled']),
              makeSection('Delete Intermediate Outputs', [deleteIntermediateOutputFiles ? 'Enabled' : 'Disabled']),
              makeSection('Use Reference Disks', [useReferenceDisks ? 'Enabled' : 'Disabled']),
              makeSection('Retry with More Memory', [memoryRetryMultiplier !== 1 ? `Enabled with factor ${memoryRetryMultiplier}` : 'Disabled']),
            ]),
          ]),

          h(
            SimpleTabBar,
            {
              'aria-label': 'Submission details tabs',
              value: tab,
              onChange: setTab,
              tabs: [
                { key: 'workflows', title: 'Workflows' },
                { key: 'inputs', title: 'Inputs' },
                { key: 'outputs', title: 'Outputs' },
              ],
              style: { marginTop: '2rem' },
            },
            [
              Utils.switchCase(
                tab,
                ['workflows', () => h(SubmissionWorkflowsTable, { workspace, submission })],
                ['inputs', () => h(SubmissionWorkflowIOTable, { type: 'inputs', inputOutputs: configuration.inputs })],
                ['outputs', () => h(SubmissionWorkflowIOTable, { type: 'outputs', inputOutputs: configuration.outputs })],
                [Utils.DEFAULT, () => null]
              ),
            ]
          ),
        ]),
  ]);
});

export const navPaths = [
  {
    name: 'workspace-submission-details',
    path: '/workspaces/:namespace/:name/job_history/:submissionId',
    component: SubmissionDetails,
    title: ({ name }) => `${name} - Submission Details`,
  },
];
