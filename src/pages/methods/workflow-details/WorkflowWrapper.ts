import { ButtonPrimary, Select, useUniqueId } from '@terra-ui-packages/components';
import { withErrorHandling } from '@terra-ui-packages/core-utils';
import _ from 'lodash/fp';
import { Fragment, PropsWithChildren, ReactNode, useState } from 'react';
import { div, h, h2, h3, label, p, span, strong } from 'react-hyperscript-helpers';
import { spinnerOverlay } from 'src/components/common';
import FooterWrapper from 'src/components/FooterWrapper';
import { TabBar } from 'src/components/tabBars';
import { TopBar } from 'src/components/TopBar';
import { Methods } from 'src/libs/ajax/methods/Methods';
import { Snapshot } from 'src/libs/ajax/methods/methods-models';
import { editMethodProvider } from 'src/libs/ajax/methods/providers/EditMethodProvider';
import { postMethodProvider } from 'src/libs/ajax/methods/providers/PostMethodProvider';
import { makeExportWorkflowFromMethodsRepoProvider } from 'src/libs/ajax/workspaces/providers/ExportWorkflowToWorkspaceProvider';
import { ErrorCallback, withErrorReporting } from 'src/libs/error';
import * as Nav from 'src/libs/nav';
import { useCancellation, useOnMount, useStore, withDisplayName } from 'src/libs/react-utils';
import { getTerraUser, snapshotsListStore, snapshotStore } from 'src/libs/state';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { withBusyState } from 'src/libs/utils';
import { CreateWorkflowModal } from 'src/workflows/methods/modals/CreateWorkflowModal';
import DeleteSnapshotModal from 'src/workflows/methods/modals/DeleteSnapshotModal';
import { EditWorkflowModal } from 'src/workflows/methods/modals/EditWorkflowModal';
import { PermissionsModal } from 'src/workflows/methods/modals/PermissionsModal';
import SnapshotActionMenu from 'src/workflows/methods/SnapshotActionMenu';
import ExportWorkflowModal from 'src/workflows/modals/ExportWorkflowModal';
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
  subject: 'version' | 'workflow';
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
        const loadedSnapshots: Snapshot[] = snapshotsList || (await Methods(signal).list({ namespace, name }));
        snapshotsListStore.set(loadedSnapshots);
        if (_.isEmpty(loadedSnapshots)) {
          setMethodNotFound(true);
        }
      };

      const loadSnapshotsList = _.flow(
        withErrorReporting('Error loading workflow'),
        withBusyState(setBusy)
      )(doSnapshotsListLoad);

      useOnMount(() => {
        if (!snapshotsList) {
          loadSnapshotsList();
        }
      });

      return h(FooterWrapper, [
        h(TopBar, { title: 'Terra Workflow Repository', href: Nav.getLink('workflows') }, [
          div({ style: Style.breadcrumb.breadcrumb }, [
            div(breadcrumbs(props)),
            div({ style: Style.breadcrumb.textUnderBreadcrumb }, [`${namespace}/${name}`]),
          ]),
        ]),
        busy && spinnerOverlay,
        methodNotFound && h(NotFoundMessage, { subject: 'workflow' }),
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
  const [showEditWorkflowModal, setShowEditWorkflowModal] = useState<boolean>(false);
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
    snapshotStore.set(await Methods(signal).method(namespace, name, selectedSnapshot).get());
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
    withErrorReporting('Error loading version'),
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
    await Methods(signal).method(namespace, name, selectedSnapshot).delete();

    // Replace the current history entry linking to the method details page of a
    // specific snapshot, like /#workflows/sschu/echo-strings-test/29, with an
    // entry with the corresponding link without the snapshot ID, like
    // /#workflows/sschu/echo-strings-test
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
          'aria-label': 'workflow details menu',
          activeTab: tabName,
          tabNames: ['dashboard', 'wdl'],
          getHref: (currentTab) =>
            Nav.getLink(`workflow-${currentTab}`, { namespace, name, snapshotId: selectedSnapshot }),
        },
        [
          label({ htmlFor: snapshotLabelId, style: { marginRight: '1rem' } }, ['Version:']),
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
              onEdit: () => setShowEditWorkflowModal(true),
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
          withErrorReporting('Error deleting version')
        )(async () => {
          setShowDeleteModal(false);
          await deleteSnapshot();
          Nav.goToPath('workflows');
        }),
        onDismiss: () => setShowDeleteModal(false),
      }),
    permissionsModalOpen &&
      h(PermissionsModal, {
        versionOrNamespace: 'Version',
        namespace,
        name,
        selectedSnapshot,
        setPermissionsModalOpen,
        refresh: loadSnapshot,
      }),
    showCloneModal &&
      h(CreateWorkflowModal, {
        title: 'Create new workflow',
        defaultName: name.concat('_copy'),
        defaultWdl: snapshot!.payload,
        defaultDocumentation: snapshot!.documentation,
        defaultSynopsis: snapshot!.synopsis,
        buttonActionName: 'Create new workflow',
        postMethodProvider,
        onSuccess: (namespace: string, name: string, snapshotId: number) => {
          // when the user has owner permissions on the original method, there is an interesting situation where
          // if the user types in the same namespace and name for the cloned method as the original method,
          // instead of creating a new method Agora will create a new snapshot of the original method.
          // Hence, to ensure the data is correct in the UI we reset the cached snapshot list store and then load the page.
          // (Note: this behaviour is same as in Firecloud UI)
          snapshotsListStore.reset();
          Nav.goToPath('workflow-dashboard', {
            namespace,
            name,
            snapshotId,
          });
        },
        onDismiss: () => setShowCloneModal(false),
      }),
    showEditWorkflowModal &&
      h(EditWorkflowModal, {
        title: 'Edit',
        namespace,
        name,
        snapshotId: snapshot!.snapshotId,
        defaultWdl: snapshot!.payload,
        defaultDocumentation: snapshot!.documentation,
        defaultSynopsis: snapshot!.synopsis,
        editMethodProvider,
        onSuccess: (namespace: string, name: string, snapshotId: number) => {
          snapshotsListStore.reset();
          Nav.goToPath('workflow-dashboard', {
            namespace,
            name,
            snapshotId,
          });
        },
        onDismiss: () => setShowEditWorkflowModal(false),
      }),
    busy && spinnerOverlay,
    snapshotNotFound && h(NotFoundMessage, { subject: 'version' }),
    snapshot && div({ style: { flex: 1, display: 'flex', flexDirection: 'column' } }, [children]),
  ]);
};

const NotFoundMessage = (props: NotFoundMessageProps) => {
  const { subject } = props;
  const isMethodMessage = subject === 'workflow';
  const fullSubject = isMethodMessage ? subject : 'workflow version';

  const suggestedAction = isMethodMessage
    ? h(
        ButtonPrimary,
        {
          href: Nav.getLink('workflows'),
        },
        ['Return to Workflows List']
      )
    : p([strong(['Please select a different version from the dropdown above.'])]);

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
        isMethodMessage ? 'a version of an existing workflow' : 'an existing workflow version'
      }, an owner of the version must give you permission to view it or make it publicly readable.`,
    ]),
    p([`The ${subject} may also have been deleted by one of its owners.`]),
    suggestedAction,
  ]);
};
