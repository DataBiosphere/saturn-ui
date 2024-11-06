import { ButtonPrimary, Select, useUniqueId } from '@terra-ui-packages/components';
import { withErrorHandling } from '@terra-ui-packages/core-utils';
import _ from 'lodash/fp';
import { Fragment, PropsWithChildren, ReactNode, useState } from 'react';
import { div, h, h2, h3, label, p, span, strong } from 'react-hyperscript-helpers';
import { spinnerOverlay } from 'src/components/common';
import FooterWrapper from 'src/components/FooterWrapper';
import { TabBar } from 'src/components/tabBars';
import { TopBar } from 'src/components/TopBar';
import { Ajax } from 'src/libs/ajax';
import { postMethodProvider } from 'src/libs/ajax/methods/providers/PostMethodProvider';
import { makeExportWorkflowFromMethodsRepoProvider } from 'src/libs/ajax/workspaces/providers/ExportWorkflowToWorkspaceProvider';
import { ErrorCallback, withErrorReporting } from 'src/libs/error';
import * as Nav from 'src/libs/nav';
import { useCancellation, useOnMount, useStore, withDisplayName } from 'src/libs/react-utils';
import { getTerraUser, snapshotsListStore, snapshotStore } from 'src/libs/state';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { withBusyState } from 'src/libs/utils';
import { PermissionsModal } from 'src/pages/workflows/workflow/common/PermissionsModal';
import { WorkflowModal } from 'src/pages/workflows/workflow/common/WorkflowModal';
import { Snapshot } from 'src/snapshots/Snapshot';
import DeleteSnapshotModal from 'src/workflows/modals/DeleteSnapshotModal';
import ExportWorkflowModal from 'src/workflows/modals/ExportWorkflowModal';
import SnapshotActionMenu from 'src/workflows/SnapshotActionMenu';
import { isGoogleWorkspace, WorkspaceInfo, WorkspaceWrapper } from 'src/workspaces/utils';
import * as WorkspaceUtils from 'src/workspaces/utils';

export interface WrapWorkflowOptions {
  breadcrumbs: (props: { name: string; namespace: string }) => ReactNode[];
  activeTab?: string;
}

interface WorkflowWrapperProps extends PropsWithChildren {
  namespace: string;
  name: string;
  snapshotId: string | undefined;
}

interface WorkflowContainerProps extends PropsWithChildren {
  namespace: string;
  name: string;
  snapshotId: string | undefined;
  tabName: string | undefined;
}

interface WrappedComponentProps {
  namespace: string;
  name: string;
}

interface NotFoundMessageProps {
  subject: 'snapshot' | 'method';
}

type WrappedWorkflowComponent = (props: WrappedComponentProps) => ReactNode;

export const wrapWorkflows = (opts: WrapWorkflowOptions) => {
  const { breadcrumbs, activeTab } = opts;
  return (WrappedComponent: WrappedWorkflowComponent) => {
    const Wrapper = (props: WorkflowWrapperProps) => {
      const { namespace, name, snapshotId } = props;
      const signal = useCancellation();
      const [busy, setBusy] = useState<boolean>(false);
      const [methodNotFound, setMethodNotFound] = useState<boolean>(false);

      const cachedSnapshotsList: Snapshot[] | undefined = useStore(snapshotsListStore);
      const snapshotsList: Snapshot[] | undefined =
        cachedSnapshotsList && _.isEqual({ namespace, name }, _.pick(['namespace', 'name'], cachedSnapshotsList[0]))
          ? cachedSnapshotsList
          : undefined;

      const doSnapshotsListLoad = async () => {
        const loadedSnapshots: Snapshot[] = snapshotsList || (await Ajax(signal).Methods.list({ namespace, name }));
        snapshotsListStore.set(loadedSnapshots);
        if (_.isEmpty(loadedSnapshots)) {
          setMethodNotFound(true);
        }
      };

      const loadSnapshotsList = _.flow(
        withErrorReporting('Error loading method'),
        withBusyState(setBusy)
      )(doSnapshotsListLoad);

      useOnMount(() => {
        if (!snapshotsList) {
          loadSnapshotsList();
        }
      });

      return h(FooterWrapper, [
        h(TopBar, { title: 'Broad Methods Repository', href: Nav.getLink('workflows') }, [
          div({ style: Style.breadcrumb.breadcrumb }, [
            div(breadcrumbs(props)),
            div({ style: Style.breadcrumb.textUnderBreadcrumb }, [`${namespace}/${name}`]),
          ]),
        ]),
        busy && spinnerOverlay,
        methodNotFound && h(NotFoundMessage, { subject: 'method' }),
        snapshotsList &&
          div({ role: 'main', style: { flex: 1, display: 'flex', flexFlow: 'column nowrap' } }, [
            h(WorkflowsContainer, { namespace, name, snapshotId, tabName: activeTab }, [
              h(WrappedComponent, { ...props }),
            ]),
          ]),
      ]);
    };
    return withDisplayName('wrapWorkflows', Wrapper);
  };
};

// Exported for testing - should only be used directly by wrapWorkflows
export const WorkflowsContainer = (props: WorkflowContainerProps) => {
  const { namespace, name, snapshotId, tabName, children } = props;
  const signal = useCancellation();
  const cachedSnapshotsList: Snapshot[] | undefined = useStore(snapshotsListStore);
  const cachedSnapshot: Snapshot = useStore(snapshotStore);
  // wrapWorkflows will not render this component if cachedSnapshotsList is undefined or empty
  // @ts-ignore
  const selectedSnapshot: number = snapshotId * 1 || _.last(cachedSnapshotsList).snapshotId;
  const snapshotLabelId = useUniqueId();

  const [snapshotNotFound, setSnapshotNotFound] = useState<boolean>(false);
  const [exportingWorkflow, setExportingWorkflow] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showCloneModal, setShowCloneModal] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState<boolean>(false);

  const snapshot: Snapshot | undefined =
    cachedSnapshot &&
    _.isEqual(
      { namespace, name, snapshotId: selectedSnapshot },
      _.pick(['namespace', 'name', 'snapshotId'], cachedSnapshot)
    )
      ? cachedSnapshot
      : undefined;

  const isSnapshotOwner: boolean = _.includes(
    getTerraUser().email?.toLowerCase(),
    _.map(_.toLower, snapshot?.managers)
  );

  const doSnapshotLoad = async () => {
    snapshotStore.set(await Ajax(signal).Methods.method(namespace, name, selectedSnapshot).get());
  };

  const checkForSnapshotNotFound: ErrorCallback = (error: unknown) => {
    if (error instanceof Response && error.status === 404) {
      setSnapshotNotFound(true);
    } else {
      throw error;
    }
  };

  const loadSnapshot = _.flow(
    withErrorHandling(checkForSnapshotNotFound),
    withErrorReporting('Error loading snapshot'),
    withBusyState(setBusy)
  )(doSnapshotLoad);

  useOnMount(() => {
    if (!snapshot) {
      loadSnapshot();
    }

    if (!snapshotId) {
      window.history.replaceState(
        {},
        '',
        Nav.getLink('workflow-dashboard', { namespace, name, snapshotId: selectedSnapshot })
      );
    }
  });

  const deleteSnapshot = async () => {
    await Ajax(signal).Methods.method(namespace, name, selectedSnapshot).delete();

    // Replace the current history entry linking to the method details page of a
    // specific snapshot, like /#methods/sschu/echo-strings-test/29, with an
    // entry with the corresponding link without the snapshot ID, like
    // /#methods/sschu/echo-strings-test
    // This way, if the user presses the back button after deleting a
    // method snapshot, they will be automatically redirected to the most recent
    // snapshot that still exists of the same method
    window.history.replaceState({}, '', Nav.getLink('workflow-dashboard', { namespace, name }));

    // Clear the cache of the snapshot that was just deleted so that if the user
    // manually navigates to the URL for that snapshot, outdated information
    // will not be shown
    snapshotStore.reset();

    // Clear the cached snapshot list for this method since the list now
    // contains a deleted snapshot - this way, if the user clicks on this
    // method in the methods list (or presses the back button), they will be
    // redirected to the most recent snapshot that still exists, rather than the
    // snapshot that was just deleted
    snapshotsListStore.reset();
  };

  return h(Fragment, [
    (snapshot || snapshotNotFound) &&
      h(
        TabBar,
        {
          'aria-label': 'method details menu',
          activeTab: tabName,
          tabNames: ['dashboard', 'wdl'],
          getHref: (currentTab) =>
            Nav.getLink(`workflow-${currentTab}`, { namespace, name, snapshotId: selectedSnapshot }),
        },
        [
          label({ htmlFor: snapshotLabelId, style: { marginRight: '1rem' } }, ['Snapshot:']),
          div({ style: { width: 100 } }, [
            h(Select, {
              id: snapshotLabelId,
              value: selectedSnapshot,
              // Only used if the selected snapshot cannot be found
              placeholder: selectedSnapshot,
              isSearchable: false,
              options: _.map('snapshotId', cachedSnapshotsList),
              // Gives dropdown click precedence over elements underneath
              menuPortalTarget: document.body,
              onChange: ({ value }: any) => Nav.goToPath(`workflow-${tabName}`, { namespace, name, snapshotId: value }),
            }),
          ]),
          h(
            ButtonPrimary,
            {
              disabled: !snapshot,
              style: { marginLeft: '1rem' },
              onClick: () => {
                setExportingWorkflow(true);
              },
            },
            ['Export to Workspace']
          ),
          div({ style: { marginLeft: '1rem', marginRight: '0.5rem' } }, [
            h(SnapshotActionMenu, {
              disabled: !snapshot,
              isSnapshotOwner,
              onEditPermissions: () => setPermissionsModalOpen(true),
              onDelete: () => setShowDeleteModal(true),
              onClone: () => setShowCloneModal(true),
            }),
          ]),
        ]
      ),
    exportingWorkflow &&
      h(ExportWorkflowModal, {
        defaultWorkflowName: name,
        destinationWorkspace: (workspace: WorkspaceWrapper) => {
          return WorkspaceUtils.canWrite(workspace.accessLevel) && isGoogleWorkspace(workspace);
        },
        title: 'Export to Workspace',
        exportButtonText: 'Export',
        exportProvider: makeExportWorkflowFromMethodsRepoProvider({
          methodNamespace: namespace,
          methodName: name,
          methodVersion: selectedSnapshot,
        }),
        onGoToExportedWorkflow: (selectedWorkspace: WorkspaceInfo, workflowName: string) =>
          Nav.goToPath('workflow', {
            namespace: selectedWorkspace.namespace,
            name: selectedWorkspace.name,
            workflowNamespace: namespace,
            workflowName,
          }),
        onDismiss: () => setExportingWorkflow(false),
      }),
    showDeleteModal &&
      h(DeleteSnapshotModal, {
        namespace,
        name,
        snapshotId: `${selectedSnapshot}`,
        onConfirm: _.flow(
          Utils.withBusyState(setBusy),
          withErrorReporting('Error deleting snapshot')
        )(async () => {
          setShowDeleteModal(false);
          await deleteSnapshot();
          Nav.goToPath('workflows');
        }),
        onDismiss: () => setShowDeleteModal(false),
      }),
    permissionsModalOpen &&
      h(PermissionsModal, {
        snapshotOrNamespace: 'Snapshot',
        namespace,
        name,
        selectedSnapshot,
        setPermissionsModalOpen,
        refresh: loadSnapshot,
      }),
    showCloneModal &&
      h(WorkflowModal, {
        title: 'Clone method',
        defaultName: name.concat('_copy'),
        defaultWdl: snapshot?.payload,
        defaultDocumentation: snapshot?.documentation,
        defaultSynopsis: snapshot?.synopsis,
        defaultSnapshotComment: snapshot?.snapshotComment,
        buttonActionName: 'Clone method',
        postMethodProvider,
        onSuccess: (namespace: string, name: string, snapshotId: number) =>
          Nav.goToPath('workflow-dashboard', {
            namespace,
            name,
            snapshotId,
          }),
        onDismiss: () => setShowCloneModal(false),
      }),
    busy && spinnerOverlay,
    snapshotNotFound && h(NotFoundMessage, { subject: 'snapshot' }),
    snapshot && div({ style: { flex: 1, display: 'flex', flexDirection: 'column' } }, [children]),
  ]);
};

const NotFoundMessage = (props: NotFoundMessageProps) => {
  const { subject } = props;
  const isMethodMessage = subject === 'method';
  const fullSubject = isMethodMessage ? subject : 'method snapshot';

  const suggestedAction = isMethodMessage
    ? h(
        ButtonPrimary,
        {
          href: Nav.getLink('workflows'),
        },
        ['Return to Methods List']
      )
    : p([strong(['Please select a different snapshot from the dropdown above.'])]);

  return div({ style: { padding: '2rem', flexGrow: 1 } }, [
    h2([`Could not display ${subject}`]),
    p([`You cannot access this ${fullSubject} because either it does not exist or you do not have access to it.`]),
    h3(['Troubleshooting access:']),
    p([
      'You are currently logged in as ',
      span({ style: { fontWeight: 600 } }, [getTerraUser().email]),
      '. You may have access with a different account.',
    ]),
    p([
      `To view ${
        isMethodMessage ? 'a snapshot of an existing method' : 'an existing method snapshot'
      }, an owner of the snapshot must give you permission to view it or make it publicly readable.`,
    ]),
    p([`The ${subject} may also have been deleted by one of its owners.`]),
    suggestedAction,
  ]);
};
