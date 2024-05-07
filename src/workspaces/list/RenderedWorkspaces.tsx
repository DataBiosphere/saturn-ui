import { icon, Modal, TooltipTrigger } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { ReactNode, useContext, useState } from 'react';
import { AutoSizer } from 'react-virtualized';
import { CloudProviderIcon } from 'src/components/CloudProviderIcon';
import { Link } from 'src/components/common';
import ErrorView from 'src/components/ErrorView';
import { FirstParagraphMarkdownViewer } from 'src/components/markdown';
import { FlexTable, HeaderRenderer } from 'src/components/table';
import { Ajax } from 'src/libs/ajax';
import colors from 'src/libs/colors';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { getLink } from 'src/libs/nav';
import { useStore } from 'src/libs/react-utils';
import { TerraUserState, userStore } from 'src/libs/state';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { WorkspaceMenu } from 'src/workspaces/common/WorkspaceMenu';
import { WorkspaceStarControl } from 'src/workspaces/list/WorkspaceStarControl';
import { WorkspaceUserActionsContext } from 'src/workspaces/list/WorkspaceUserActions';
import {
  canRead,
  getCloudProviderFromWorkspace,
  isGoogleWorkspace,
  workspaceAccessLevels,
  WorkspaceInfo,
  WorkspacePolicy,
  WorkspaceWrapper as Workspace,
} from 'src/workspaces/utils';

// This is actually the sort type from the FlexTable component
// When that component is converted to typescript, we should use that instead
interface WorkspaceSort {
  field: keyof WorkspaceInfo | keyof Workspace;
  direction: 'desc' | 'asc';
}

const styles = {
  tableCellContainer: {
    height: '100%',
    padding: '0.5rem 0',
    paddingRight: '2rem',
    borderTop: `1px solid ${colors.light()}`,
  },
  tableCellContent: {
    height: '50%',
    display: 'flex',
    alignItems: 'center',
  },
};

interface RenderedWorkspacesProps {
  workspaces: Workspace[];
  label: string;
  noContent: ReactNode;
}

const getColumns = (
  sort: WorkspaceSort,
  setSort: React.Dispatch<React.SetStateAction<WorkspaceSort>>,
  sortedWorkspaces: Workspace[]
) => [
  {
    field: 'starred',
    headerRenderer: () => <div className="sr-only">Starred</div>,
    cellRenderer: ({ rowIndex }) => <StarCell workspace={sortedWorkspaces[rowIndex]} />,
    size: { basis: 40, grow: 0, shrink: 0 },
  },
  {
    field: 'name',
    headerRenderer: () => <HeaderRenderer sort={sort} name="name" onSort={setSort} />,
    cellRenderer: ({ rowIndex }) => <NameCell workspace={sortedWorkspaces[rowIndex]} />,
    size: { basis: 400, grow: 2, shrink: 0 },
  },
  {
    field: 'lastModified',
    headerRenderer: () => <HeaderRenderer sort={sort} name="lastModified" onSort={setSort} />,
    cellRenderer: ({ rowIndex }) => <LastModifiedCell workspace={sortedWorkspaces[rowIndex]} />,
    size: { basis: 100, grow: 1, shrink: 0 },
  },
  {
    field: 'createdBy',
    headerRenderer: () => <HeaderRenderer sort={sort} name="createdBy" onSort={setSort} />,
    cellRenderer: ({ rowIndex }) => <CreatedByCell workspace={sortedWorkspaces[rowIndex]} />,
    size: { basis: 200, grow: 1, shrink: 0 },
  },
  {
    field: 'accessLevel',
    headerRenderer: () => <HeaderRenderer sort={sort} name="accessLevel" onSort={setSort} />,
    cellRenderer: ({ rowIndex }) => <AccessLevelCell workspace={sortedWorkspaces[rowIndex]} />,
    size: { basis: 120, grow: 1, shrink: 0 },
  },
  {
    headerRenderer: () => <div className="sr-only">Cloud Platform</div>,
    cellRenderer: ({ rowIndex }) => <CloudPlatformCell workspace={sortedWorkspaces[rowIndex]} />,
    size: { basis: 30, grow: 0, shrink: 0 },
  },
  {
    headerRenderer: () => <div className="sr-only">Actions</div>,
    cellRenderer: ({ rowIndex }) => (
      <ActionsCell workspace={sortedWorkspaces[rowIndex]} workspaces={sortedWorkspaces} />
    ),
    size: { basis: 30, grow: 0, shrink: 0 },
  },
];

export const RenderedWorkspaces = (props: RenderedWorkspacesProps): ReactNode => {
  const { workspaces } = props;
  const {
    profile: { starredWorkspaces },
  } = useStore<TerraUserState>(userStore);
  const starredWorkspaceIds = _.isEmpty(starredWorkspaces) ? [] : _.split(',', starredWorkspaces);

  const [sort, setSort] = useState<WorkspaceSort>({ field: 'lastModified', direction: 'desc' });

  const sortedWorkspaces = _.orderBy(
    [
      (ws: Workspace) => _.includes(ws.workspace.workspaceId, starredWorkspaceIds),
      sort.field === 'accessLevel'
        ? (ws: Workspace) => -workspaceAccessLevels.indexOf(ws.accessLevel)
        : `workspace.${sort.field}`,
    ],
    ['desc', sort.direction],
    workspaces
  );

  const columns = getColumns(sort, setSort, sortedWorkspaces);

  return (
    <div style={{ flex: 1, backgroundColor: 'white', padding: '0 1rem' }}>
      <AutoSizer>
        {({ width, height }) => (
          <FlexTable
            aria-label={props.label}
            width={width}
            height={height}
            rowCount={sortedWorkspaces.length}
            noContentRenderer={() => props.noContent}
            variant="light"
            rowHeight={70}
            // @ts-expect-error
            sort={sort}
            columns={columns}
          />
        )}
      </AutoSizer>
    </div>
  );
};

interface CellProps {
  workspace: Workspace;
}

const StarCell = (props: CellProps): ReactNode => (
  <div style={{ ...styles.tableCellContainer, justifyContent: 'center', alignItems: 'center', padding: '0.5rem 0' }}>
    <WorkspaceStarControl workspace={props.workspace} />
  </div>
);

const NameCell = (props: CellProps): ReactNode => {
  const {
    accessLevel,
    workspace,
    workspace: { workspaceId, namespace, name },
  } = props.workspace;
  const { setUserActions } = useContext(WorkspaceUserActionsContext);

  const canView = canRead(accessLevel);
  const canAccessWorkspace = () =>
    !canView ? setUserActions({ requestingAccessWorkspaceId: workspaceId }) : undefined;

  return (
    <div style={styles.tableCellContainer}>
      <div style={styles.tableCellContent}>
        <Link
          aria-haspopup={canView ? undefined : 'dialog'}
          style={{
            ...(canView ? {} : { color: colors.dark(0.8), fontStyle: 'italic' }),
            fontWeight: 600,
            fontSize: 16,
            ...Style.noWrapEllipsis,
          }}
          href={canView ? getLink('workspace-dashboard', { namespace, name }) : undefined}
          onClick={() => {
            canAccessWorkspace();
            !!canView && Ajax().Metrics.captureEvent(Events.workspaceOpenFromList, extractWorkspaceDetails(workspace));
          }}
          tooltip={
            !canView && 'You do not have access to this workspace. Select the workspace to learn about gaining access.'
          }
          tooltipSide="right"
          disabled={workspace.state === 'Deleted'}
        >
          {name}
        </Link>
      </div>
      <WorkspaceStateCell {...props} />
    </div>
  );
};

const WorkspaceDescriptionCell = (props: { description: unknown | undefined }) => (
  <div style={styles.tableCellContent}>
    <FirstParagraphMarkdownViewer
      style={{
        height: '1.5rem',
        margin: 0,
        ...Style.noWrapEllipsis,
        color: props.description ? undefined : colors.dark(0.75),
        fontSize: 14,
      }}
      renderers={{}} // needed to make typechecker work, because FirstParagraphMarkdownViewer is not typed
    >
      {props.description?.toString() || 'No description added'}
    </FirstParagraphMarkdownViewer>
  </div>
);

const WorkspaceStateCell = (props: CellProps): ReactNode => {
  const {
    workspace,
    workspace: { attributes, state },
  } = props.workspace;
  const description = attributes?.description;
  const errorMessage = workspace.errorMessage;
  switch (state) {
    case 'Deleting':
      return <WorkspaceDeletingCell />;
    case 'DeleteFailed':
      return <WorkspaceFailedCell state={state} errorMessage={errorMessage} />;
    case 'Deleted':
      return <WorkspaceDeletedCell />;
    case 'Cloning':
      return <WorkspaceCloningCell />;
    case 'CloningContainer':
      return <WorkspaceCloningCell />;
    case 'CloningFailed':
      return <WorkspaceFailedCell state="CloningFailed" errorMessage={errorMessage} />;
    default:
      return <WorkspaceDescriptionCell description={description} />;
  }
};

const WorkspaceDeletingCell = (): ReactNode => {
  const deletingIcon = icon('syncAlt', {
    size: 18,
    style: {
      animation: 'rotation 2s infinite linear',
      marginRight: '0.5rem',
    },
  });
  return (
    <div style={{ color: colors.danger() }}>
      {deletingIcon}
      Workspace deletion in progress
    </div>
  );
};

const WorkspaceCloningCell = (): ReactNode => {
  const deletingIcon = icon('syncAlt', {
    size: 18,
    style: {
      animation: 'rotation 2s infinite linear',
      marginRight: '0.5rem',
    },
  });
  return (
    <div style={{ color: colors.success() }}>
      {deletingIcon}
      Workspace cloning in progress
    </div>
  );
};

interface WorkspaceFailedCellProps {
  state: 'DeleteFailed' | 'CloningFailed';
  errorMessage?: string;
}

const WorkspaceFailedCell = (props: WorkspaceFailedCellProps): ReactNode => {
  const [showDetails, setShowDetails] = useState<boolean>(false);

  const failureOperationMsg = props.state === 'DeleteFailed' ? 'Error deleting workspace' : 'Error cloning workspace';

  const errorIcon = icon('warning-standard', {
    size: 18,
    style: {
      color: colors.danger(),
      marginRight: '0.5rem',
    },
  });
  return (
    <div style={{ color: colors.danger() }}>
      {errorIcon}
      {failureOperationMsg}
      {props.errorMessage ? (
        // eslint-disable-next-line jsx-a11y/anchor-is-valid
        <Link
          onClick={() => setShowDetails(true)}
          style={{ fontSize: 14, marginRight: '0.5rem', marginLeft: '0.5rem' }}
        >
          See error details.
        </Link>
      ) : null}
      {showDetails ? (
        <Modal width={800} title={failureOperationMsg} showCancel={false} showX onDismiss={() => setShowDetails(false)}>
          <ErrorView error={props.errorMessage ?? 'No error message available'} />
        </Modal>
      ) : null}
      ,
    </div>
  );
};

const WorkspaceDeletedCell = (): ReactNode => (
  <div style={{ color: colors.danger() }}>Workspace has been deleted. Refresh to remove from list.</div>
);

const LastModifiedCell = (props: CellProps): ReactNode => {
  const {
    workspace: { lastModified },
  } = props.workspace;
  return (
    <div style={styles.tableCellContainer}>
      <div style={styles.tableCellContent}>
        <TooltipTrigger content={Utils.makeCompleteDate(lastModified)}>
          <div>{Utils.makeStandardDate(lastModified)}</div>
        </TooltipTrigger>
      </div>
    </div>
  );
};

const CreatedByCell = (props: CellProps): ReactNode => (
  <div style={styles.tableCellContainer}>
    <div style={styles.tableCellContent}>
      <span style={Style.noWrapEllipsis}>{props.workspace.workspace.createdBy}</span>
    </div>
  </div>
);

const AccessLevelCell = (props: CellProps): ReactNode => (
  <div style={styles.tableCellContainer}>
    <div style={styles.tableCellContent}>{Utils.normalizeLabel(props.workspace.accessLevel)}</div>
  </div>
);

const CloudPlatformCell = (props: CellProps): ReactNode => {
  return (
    <div style={{ ...styles.tableCellContainer, paddingRight: 0 }}>
      <div style={styles.tableCellContent}>
        <CloudProviderIcon cloudProvider={getCloudProviderFromWorkspace(props.workspace)} />
      </div>
    </div>
  );
};

interface ActionsCellProps extends CellProps {
  workspaces: Workspace[];
}

const ActionsCell = (props: ActionsCellProps): ReactNode => {
  const {
    accessLevel,
    workspace: { workspaceId, namespace, name, state },
  } = props.workspace;
  const { setUserActions } = useContext(WorkspaceUserActionsContext);

  if (!canRead(accessLevel)) {
    // No menu shown if user does not have read access.
    return <div className="sr-only">You do not have permission to perform actions on this workspace.</div>;
  }
  if (state === 'Deleted') {
    return null;
  }
  const getWorkspace = (id: string): Workspace => _.find({ workspace: { workspaceId: id } }, props.workspaces)!;
  const extendWorkspace = (
    workspaceId: string,
    policies?: WorkspacePolicy[],
    bucketName?: string,
    description?: string,
    googleProject?: string
  ): Workspace => {
    // The workspaces from the list API have fewer properties to keep the payload as small as possible.
    const listWorkspace = getWorkspace(workspaceId);
    const extendedWorkspace = policies === undefined ? listWorkspace : { ...listWorkspace, policies };
    if (bucketName !== undefined && isGoogleWorkspace(extendedWorkspace)) {
      extendedWorkspace.workspace.bucketName = bucketName;
    }

    if (googleProject !== undefined && isGoogleWorkspace(extendedWorkspace)) {
      extendedWorkspace.workspace.googleProject = googleProject;
    }

    if (description !== undefined && extendedWorkspace.workspace.attributes !== undefined) {
      extendedWorkspace.workspace.attributes.description = description;
    }
    return extendedWorkspace;
  };

  const onClone = (policies, bucketName, description, googleProject) =>
    setUserActions({
      cloningWorkspace: extendWorkspace(workspaceId, policies, bucketName, description, googleProject),
    });
  const onDelete = () => setUserActions({ deletingWorkspaceId: workspaceId });
  const onLock = () => setUserActions({ lockingWorkspaceId: workspaceId });
  const onShare = (policies, bucketName) =>
    setUserActions({ sharingWorkspace: extendWorkspace(workspaceId, policies, bucketName) });
  const onLeave = () => setUserActions({ leavingWorkspaceId: workspaceId });

  return (
    <div style={{ ...styles.tableCellContainer, paddingRight: 0 }}>
      <div style={styles.tableCellContent}>
        <WorkspaceMenu
          iconSize={20}
          popupLocation="left"
          callbacks={{ onClone, onShare, onLock, onDelete, onLeave }}
          workspaceInfo={{ namespace, name }}
        />
      </div>
    </div>
  );
};
