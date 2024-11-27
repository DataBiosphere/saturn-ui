import _ from 'lodash/fp';
import { Fragment, useEffect, useImperativeHandle, useState } from 'react';
import { a, div, h, label, span } from 'react-hyperscript-helpers';
import * as breadcrumbs from 'src/components/breadcrumbs';
import { useViewToggle, ViewToggleButtons } from 'src/components/CardsListToggle';
import { Clickable, IdContainer, Link, Select, spinnerOverlay } from 'src/components/common';
import { icon } from 'src/components/icons';
import { DelayedSearchInput } from 'src/components/input';
import { MenuButton } from 'src/components/MenuButton';
import { PageBox } from 'src/components/PageBox';
import { makeMenuIcon, MenuTrigger } from 'src/components/PopupTrigger';
import { Ajax } from 'src/libs/ajax';
import { makeExportWorkflowFromWorkspaceProvider } from 'src/libs/ajax/workspaces/providers/ExportWorkflowToWorkspaceProvider';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import * as Nav from 'src/libs/nav';
import { forwardRefWithName, memoWithName, useCancellation, useOnMount } from 'src/libs/react-utils';
import * as StateHistory from 'src/libs/state-history';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { FindWorkflowModal } from 'src/pages/workspaces/workspace/modals/FindWorkflowModal';
import DeleteWorkflowConfirmationModal from 'src/pages/workspaces/workspace/workflows/DeleteWorkflowConfirmationModal';
import { methodLink } from 'src/pages/workspaces/workspace/workflows/methodLink';
import ExportWorkflowModal from 'src/workflows/modals/ExportWorkflowModal';
import { wrapWorkspace } from 'src/workspaces/container/WorkspaceContainer';
import * as WorkspaceUtils from 'src/workspaces/utils';

export const styles = {
  cardContainer: (listView) => ({
    display: 'flex',
    flexWrap: 'wrap',
    marginRight: listView ? undefined : '-1rem',
  }),
  // Card's position: relative and the outer/inner styles are a little hack to fake nested links
  card: {
    ...Style.elements.card.container,
    position: 'relative',
  },
  outerLink: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  innerContent: {
    position: 'relative',
    pointerEvents: 'none',
  },
  innerLink: {
    pointerEvents: 'auto',
  },
  // (end link hacks)
  shortCard: {
    width: 300,
    height: 125,
    margin: '0 1rem 2rem 0',
  },
  shortTitle: {
    ...Style.elements.card.title,
    flex: 1,
    lineHeight: '20px',
    height: '40px',
    overflowWrap: 'break-word',
  },
  shortDescription: {
    flex: 'none',
    lineHeight: '18px',
    height: '90px',
    overflow: 'hidden',
  },
  longMethodVersion: {
    marginRight: '1rem',
    width: 90,
    ...Style.noWrapEllipsis,
  },
  longCard: {
    width: '100%',
    minWidth: 0,
    marginBottom: '0.5rem',
  },
  longTitle: {
    ...Style.elements.card.title,
    ...Style.noWrapEllipsis,
    flex: 1,
  },
  longDescription: {
    flex: 1,
    paddingRight: '1rem',
    ...Style.noWrapEllipsis,
  },
};

const sortTokens = {
  lowerCaseName: (config) => config.name.toLowerCase(),
};
const defaultSort = { label: 'Alphabetical', value: { field: 'lowerCaseName', direction: 'asc' } };
const sortOptions = [defaultSort, { label: 'Reverse Alphabetical', value: { field: 'lowerCaseName', direction: 'desc' } }];

const WorkflowCard = memoWithName('WorkflowCard', ({ listView, name, namespace, config, onExport, onCopy, onDelete, workspace }) => {
  const {
    namespace: workflowNamespace,
    name: workflowName,
    methodRepoMethod: { sourceRepo, methodVersion },
  } = config;
  const sourceRepoName = sourceRepo === 'agora' ? 'Terra' : Utils.normalizeLabel(sourceRepo);
  const workspaceEditControlProps = WorkspaceUtils.getWorkspaceEditControlProps(workspace);
  const workflowCardMenu = h(
    MenuTrigger,
    {
      closeOnClick: true,
      content: h(Fragment, [
        h(
          MenuButton,
          {
            onClick: onExport,
            tooltipSide: 'left',
          },
          [makeMenuIcon('export'), 'Copy to Another Workspace']
        ),
        h(
          MenuButton,
          {
            onClick: onCopy,
            ...workspaceEditControlProps,
            tooltipSide: 'left',
          },
          [makeMenuIcon('copy'), 'Duplicate']
        ),
        h(
          MenuButton,
          {
            onClick: onDelete,
            ...workspaceEditControlProps,
            tooltipSide: 'left',
          },
          [makeMenuIcon('trash'), 'Delete']
        ),
      ]),
    },
    [
      h(Link, { 'aria-label': 'Workflow menu', onClick: (e) => e.stopPropagation(), style: styles.innerLink }, [
        icon('cardMenuIcon', {
          size: listView ? 18 : 24,
        }),
      ]),
    ]
  );
  const repoLink = h(
    Link,
    {
      'aria-label': `View the ${workflowName} workflow on ${sourceRepoName}`,
      href: methodLink(config),
      style: styles.innerLink,
      ...Utils.newTabLinkProps,
    },
    sourceRepoName
  );

  const workflowLink = a({
    'aria-label': workflowName,
    href: Nav.getLink('workflow', { namespace, name, workflowNamespace, workflowName }),
    style: styles.outerLink,
  });

  return listView
    ? div({ style: { ...styles.card, ...styles.longCard } }, [
        workflowLink,
        div({ style: { ...styles.innerContent, display: 'flex', alignItems: 'center' } }, [
          div({ style: { marginRight: '1rem' } }, [workflowCardMenu]),
          div({ style: { ...styles.longTitle } }, [workflowName]),
          div({ style: { ...styles.longMethodVersion } }, [`V. ${methodVersion}`]),
          div({ style: { flex: 'none', width: 130 } }, ['Source: ', repoLink]),
        ]),
      ])
    : div({ style: { ...styles.card, ...styles.shortCard } }, [
        workflowLink,
        div({ style: { ...styles.innerContent, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' } }, [
          div({ style: { ...styles.shortTitle } }, [workflowName]),
          div({ style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' } }, [
            div({ style: { minWidth: 100, marginRight: '1ch' } }, [
              div({ style: { ...Style.noWrapEllipsis } }, `V. ${methodVersion}`),
              'Source: ',
              repoLink,
            ]),
            workflowCardMenu,
          ]),
        ]),
      ]);
});

const noWorkflowsMessage = div({ style: { fontSize: 20, margin: '1rem' } }, [
  div(['To get started, click ', span({ style: { fontWeight: 600 } }, ['Find a Workflow'])]),
  div({ style: { marginTop: '1rem', fontSize: 16 } }, [
    h(
      Link,
      {
        ...Utils.newTabLinkProps,
        href: 'https://support.terra.bio/hc/en-us/sections/360004147011',
      },
      ["What's a workflow?"]
    ),
  ]),
]);

export const Workflows = _.flow(
  forwardRefWithName('Workflows'),
  wrapWorkspace({
    breadcrumbs: (props) => breadcrumbs.commonPaths.workspaceDashboard(props),
    title: 'Workflows',
    activeTab: 'workflows',
  })
)(({ namespace, name, workspace: ws, workspace: { workspace } }, ref) => {
  // State
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState(() => StateHistory.get().sortOrder || defaultSort.value);
  const [filter, setFilter] = useState(() => StateHistory.get().filter || '');
  const [configs, setConfigs] = useState(() => StateHistory.get().configs || undefined);
  const [workflowToExport, setWorkflowToExport] = useState(undefined);
  const [workflowToCopy, setWorkflowToCopy] = useState(undefined);
  const [workflowToDelete, setWorkflowToDelete] = useState(undefined);
  const [findingWorkflow, setFindingWorkflow] = useState(false);

  const [listView, setListView] = useViewToggle('workflowsTab');
  const signal = useCancellation();

  // Helpers
  const refresh = _.flow(
    Utils.withBusyState(setLoading),
    withErrorReporting('Error loading configs')
  )(async () => {
    const configs = await Ajax(signal).Workspaces.workspace(namespace, name).listMethodConfigs();
    setConfigs(configs);
  });

  const getConfig = (conf) => _.find(conf, configs);

  // Lifecycle
  useOnMount(() => {
    refresh();
  });

  useEffect(() => {
    StateHistory.update({ configs, sortOrder, filter });
  }, [configs, sortOrder, filter]);

  useImperativeHandle(ref, () => ({ refresh }));

  // Render
  const { field, direction } = sortOrder;

  const workflows = _.flow(
    _.filter(({ name }) => Utils.textMatch(filter, name)),
    _.orderBy(sortTokens[field] || field, direction),
    _.map((config) => {
      return h(WorkflowCard, {
        onExport: () => setWorkflowToExport({ namespace: config.namespace, name: config.name }),
        onCopy: () => setWorkflowToCopy({ namespace: config.namespace, name: config.name }),
        onDelete: () => setWorkflowToDelete({ namespace: config.namespace, name: config.name }),
        key: `${config.namespace}/${config.name}`,
        namespace,
        name,
        config,
        listView,
        workspace: ws,
      });
    })
  )(configs);

  return h(PageBox, [
    div({ style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' } }, [
      div({ style: { ...Style.elements.sectionHeader, textTransform: 'uppercase' } }, ['Workflows']),
      div({ style: { flexGrow: 1 } }),
      h(DelayedSearchInput, {
        'aria-label': 'Search workflows',
        style: { marginRight: '0.75rem', width: 220 },
        placeholder: 'SEARCH WORKFLOWS',
        onChange: setFilter,
        value: filter,
      }),
      h(IdContainer, [
        (id) =>
          h(Fragment, [
            label({ htmlFor: id, style: { marginLeft: 'auto', marginRight: '0.75rem' } }, ['Sort By:']),
            h(Select, {
              id,
              value: sortOrder,
              isClearable: false,
              styles: { container: (old) => ({ ...old, width: 220, marginRight: '1.10rem' }) },
              options: sortOptions,
              onChange: (selected) => setSortOrder(selected.value),
            }),
          ]),
      ]),
      h(ViewToggleButtons, { listView, setListView }),
      workflowToExport &&
        h(ExportWorkflowModal, {
          defaultWorkflowName: getConfig(workflowToExport).name,
          destinationWorkspace: ({ workspace: { workspaceId }, accessLevel }) => {
            return workspace.workspaceId !== workspaceId && WorkspaceUtils.canWrite(accessLevel);
          },
          title: 'Copy to Workspace',
          exportButtonText: 'Copy',
          exportProvider: makeExportWorkflowFromWorkspaceProvider(workspace, getConfig(workflowToExport)),
          onGoToExportedWorkflow: (selectedWorkspace, workflowName) =>
            Nav.goToPath('workflow', {
              namespace: selectedWorkspace.namespace,
              name: selectedWorkspace.name,
              workflowNamespace: selectedWorkspace.namespace,
              workflowName,
            }),
          onDismiss: () => setWorkflowToExport(undefined),
        }),
      workflowToCopy &&
        h(ExportWorkflowModal, {
          defaultWorkflowName: `${getConfig(workflowToCopy).name}_copy`,
          destinationWorkspace: workspace,
          title: 'Duplicate Workflow',
          exportButtonText: 'Copy',
          exportProvider: makeExportWorkflowFromWorkspaceProvider(workspace, getConfig(workflowToCopy)),
          onDismiss: () => setWorkflowToCopy(undefined),
          onSuccess: () => {
            refresh();
            setWorkflowToCopy(undefined);
          },
        }),
      workflowToDelete &&
        h(DeleteWorkflowConfirmationModal, {
          workspace,
          methodConfig: getConfig(workflowToDelete),
          onDismiss: () => setWorkflowToDelete(undefined),
          onConfirm: _.flow(
            Utils.withBusyState(setLoading),
            withErrorReporting('Error deleting workflow.')
          )(async () => {
            setWorkflowToDelete(undefined);
            const { namespace, name } = getConfig(workflowToDelete);
            await Ajax().Workspaces.workspace(workspace.namespace, workspace.name).methodConfig(namespace, name).delete();
            refresh();
          }),
        }),
    ]),
    div({ style: styles.cardContainer(listView) }, [
      h(
        Clickable,
        {
          'aria-haspopup': 'dialog',
          ...WorkspaceUtils.getWorkspaceEditControlProps(ws),
          style: { ...styles.card, ...styles.shortCard, color: colors.accent(), fontSize: 18, lineHeight: '22px' },
          onClick: () => setFindingWorkflow(true),
        },
        ['Find a Workflow', icon('plus-circle', { size: 32 })]
      ),
      Utils.cond(
        [configs && _.isEmpty(configs), () => noWorkflowsMessage],
        [
          !_.isEmpty(configs) && _.isEmpty(workflows),
          () => {
            return div({ style: { fontStyle: 'italic' } }, ['No matching workflows']);
          },
        ],
        [listView, () => div({ style: { flex: 1 } }, [workflows])],
        () => workflows
      ),
      findingWorkflow &&
        h(FindWorkflowModal, {
          onDismiss: () => setFindingWorkflow(false),
        }),
      loading && spinnerOverlay,
    ]),
  ]);
});

export const navPaths = [
  {
    name: 'workspace-workflows',
    path: '/workspaces/:namespace/:name/workflows',
    component: Workflows,
    title: ({ name }) => `${name} - Workflows`,
  },
  {
    name: 'workspace-tools', // legacy
    path: '/workspaces/:namespace/:name/tools',
    component: (props) => h(Nav.Redirector, { pathname: Nav.getPath('workspace-workflows', props) }),
  },
];
