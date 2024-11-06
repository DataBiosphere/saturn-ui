import { Icon, Link, useUniqueId } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { CSSProperties, ReactNode, useState } from 'react';
import { DateRangeFilter } from 'src/billing/Filter/DateRangeFilter';
import { SearchFilter } from 'src/billing/Filter/SearchFilter';
import { billingAccountIconSize, BillingAccountStatus, getBillingAccountIconProps } from 'src/billing/utils';
import {
  BillingProject,
  GoogleBillingAccount,
  isAzureBillingProject,
  isGoogleBillingProject,
} from 'src/billing-core/models';
import { ariaSort, HeaderRenderer } from 'src/components/table';
import { Ajax } from 'src/libs/ajax';
import colors from 'src/libs/colors';
import Events, { extractBillingDetails } from 'src/libs/events';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import { SPEND_REPORTING } from 'src/libs/feature-previews-config';
import * as Nav from 'src/libs/nav';
import { memoWithName } from 'src/libs/react-utils';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { isGoogleWorkspaceInfo, WorkspaceInfo } from 'src/workspaces/utils';

const workspaceLastModifiedWidth = 150;
const workspaceExpandIconSize = 20;

interface WorkspaceCardHeadersProps {
  needsStatusColumn: boolean;
  sort: { field: string; direction: 'asc' | 'desc' };
  onSort: (sort: { field: string; direction: 'asc' | 'desc' }) => void;
}

const WorkspaceCardHeaders: React.FC<WorkspaceCardHeadersProps> = memoWithName(
  'WorkspaceCardHeaders',
  (props: WorkspaceCardHeadersProps) => {
    const { needsStatusColumn, sort, onSort } = props;
    return (
      <div
        role='row'
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '1.5rem',
          padding: '0 1rem',
          marginBottom: '0.5rem',
        }}
      >
        {needsStatusColumn && (
          <div role='columnheader' style={{ width: billingAccountIconSize }}>
            <div className='sr-only'>Status</div>
          </div>
        )}
        <div
          role='columnheader'
          aria-sort={ariaSort(sort, 'name')}
          style={{ flex: 1, paddingLeft: needsStatusColumn ? '1rem' : '2rem' }}
        >
          <HeaderRenderer sort={sort} onSort={onSort} name='name' />
        </div>
        {isFeaturePreviewEnabled(SPEND_REPORTING) && (
          <>
            <div role='columnheader' aria-sort={ariaSort(sort, 'totalSpend')} style={{ flex: 1 }}>
              <HeaderRenderer sort={sort} onSort={onSort} name='totalSpend' />
            </div>
            <div role='columnheader' aria-sort={ariaSort(sort, 'totalCompute')} style={{ flex: 1 }}>
              <HeaderRenderer sort={sort} onSort={onSort} name='totalCompute' />
            </div>
            <div role='columnheader' aria-sort={ariaSort(sort, 'totalStorage')} style={{ flex: 1 }}>
              <HeaderRenderer sort={sort} onSort={onSort} name='totalStorage' />
            </div>
          </>
        )}
        <div role='columnheader' aria-sort={ariaSort(sort, 'createdBy')} style={{ flex: 1 }}>
          <HeaderRenderer sort={sort} onSort={onSort} name='createdBy' />
        </div>
        <div
          role='columnheader'
          aria-sort={ariaSort(sort, 'lastModified')}
          style={{ flex: `0 0 ${workspaceLastModifiedWidth}px` }}
        >
          <HeaderRenderer sort={sort} onSort={onSort} name='lastModified' />
        </div>
        <div role='columnheader' style={{ flex: `0 0 ${workspaceExpandIconSize}px` }}>
          <div className='sr-only'>Expand</div>
        </div>
      </div>
    );
  }
);

interface ExpandedInfoRowProps {
  title: string;
  details: string | undefined;
  errorMessage?: string;
}

const ExpandedInfoRow = (props: ExpandedInfoRowProps) => {
  const { title, details, errorMessage } = props;
  const expandedInfoStyles = {
    row: { display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start' },
    title: { fontWeight: 600, padding: '0.5rem 1rem 0 2rem', height: '1rem' },
    details: { flexGrow: 1, marginTop: '0.5rem', height: '1rem', ...Style.noWrapEllipsis },
    errorMessage: {
      flexGrow: 2,
      padding: '0.5rem',
      backgroundColor: colors.light(0.3),
      border: `solid 2px ${colors.danger(0.3)}`,
      borderRadius: 5,
    },
  };

  return (
    <div style={expandedInfoStyles.row}>
      <div style={expandedInfoStyles.title}>{title}</div>
      <div style={expandedInfoStyles.details}>{details}</div>
      {errorMessage && <div style={expandedInfoStyles.errorMessage}>{errorMessage}</div>}
    </div>
  );
};

interface WorkspaceCardProps {
  workspace: WorkspaceInfo;
  billingAccountDisplayName: string | undefined;
  billingProject: BillingProject;
  billingAccountStatus: false | BillingAccountStatus;
  isExpanded: boolean;
  onExpand: () => void;
}

const WorkspaceCard: React.FC<WorkspaceCardProps> = memoWithName('WorkspaceCard', (props: WorkspaceCardProps) => {
  const { workspace, billingProject, billingAccountStatus, billingAccountDisplayName, isExpanded, onExpand } = props;
  const { namespace, name, createdBy, lastModified, googleProject, errorMessage } = workspace;
  const workspaceCardStyles = {
    field: {
      ...Style.noWrapEllipsis,
      flex: 1,
      height: '1.20rem',
      width: `calc(50% - ${(workspaceLastModifiedWidth + workspaceExpandIconSize) / 2}px)`,
      paddingRight: '1rem',
    },
    row: { display: 'flex', alignItems: 'center', width: '100%', padding: '1rem' },
    expandedInfoContainer: { display: 'flex', flexDirection: 'column', width: '100%' } satisfies CSSProperties,
  };
  const billingDetailsId = useUniqueId('details');

  return (
    <div role='row' style={{ ...Style.cardList.longCardShadowless, padding: 0, flexDirection: 'column' }}>
      <div style={workspaceCardStyles.row}>
        {billingAccountStatus && (
          <div role='cell'>
            <Icon {...getBillingAccountIconProps(billingAccountStatus)} />
          </div>
        )}
        <div
          role='rowheader'
          style={{
            ...workspaceCardStyles.field,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: billingAccountStatus ? '1rem' : '2rem',
          }}
        >
          <Link
            style={Style.noWrapEllipsis}
            href={Nav.getLink('workspace-dashboard', { namespace, name })}
            onClick={() => {
              Ajax().Metrics.captureEvent(Events.billingProjectGoToWorkspace, {
                workspaceName: name,
                ...extractBillingDetails(billingProject),
              });
            }}
          >
            {name}
          </Link>
        </div>
        {isFeaturePreviewEnabled(SPEND_REPORTING) && (
          <>
            <div role='cell' style={workspaceCardStyles.field}>
              N/A
            </div>
            <div role='cell' style={workspaceCardStyles.field}>
              N/A
            </div>
            <div role='cell' style={workspaceCardStyles.field}>
              N/A
            </div>
          </>
        )}
        <div role='cell' style={workspaceCardStyles.field}>
          {createdBy}
        </div>
        <div role='cell' style={{ height: '1rem', flex: `0 0 ${workspaceLastModifiedWidth}px` }}>
          {Utils.makeStandardDate(lastModified)}
        </div>
        <div role='cell' style={{ flex: `0 0 ${workspaceExpandIconSize}px` }}>
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <Link
            aria-label={`expand workspace ${name}`}
            aria-expanded={isExpanded}
            aria-controls={isExpanded ? billingDetailsId : undefined}
            aria-owns={isExpanded ? billingDetailsId : undefined}
            style={{ display: 'flex', alignItems: 'center' }}
            onClick={() => {
              Ajax().Metrics.captureEvent(Events.billingProjectExpandWorkspace, {
                workspaceName: name,
                ...extractBillingDetails(billingProject),
              });
              onExpand();
            }}
          >
            <Icon icon={isExpanded ? 'angle-up' : 'angle-down'} size={workspaceExpandIconSize} />
          </Link>
        </div>
      </div>
      {isExpanded && (
        <div
          id={billingDetailsId}
          style={{ ...workspaceCardStyles.row, padding: '0.5rem', border: `1px solid ${colors.light()}` }}
        >
          <div style={workspaceCardStyles.expandedInfoContainer}>
            {isGoogleBillingProject(billingProject) && (
              <ExpandedInfoRow title='Google Project' details={googleProject} />
            )}
            {isGoogleBillingProject(billingProject) && (
              <ExpandedInfoRow
                title='Billing Account'
                details={billingAccountDisplayName}
                errorMessage={errorMessage}
              />
            )}
            {isAzureBillingProject(billingProject) && (
              <ExpandedInfoRow
                title='Resource Group ID'
                details={billingProject.managedAppCoordinates.managedResourceGroupId}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
});

interface WorkspacesProps {
  billingProject: BillingProject;
  workspacesInProject: WorkspaceInfo[];
  billingAccounts: Record<string, GoogleBillingAccount>;
  billingAccountsOutOfDate: boolean;
  groups: Partial<Record<BillingAccountStatus, Set<WorkspaceInfo>>>;
}

export const Workspaces = (props: WorkspacesProps): ReactNode => {
  const { billingAccounts, billingAccountsOutOfDate, billingProject, groups, workspacesInProject } = props;
  const [workspaceSort, setWorkspaceSort] = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'name',
    direction: 'asc',
  });
  const [expandedWorkspaceName, setExpandedWorkspaceName] = useState<string>();

  const getBillingAccountStatus = (workspace: WorkspaceInfo): BillingAccountStatus =>
    // @ts-ignore
    _.findKey((g) => g.has(workspace), groups);

  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [_searchValue, setSearchValue] = useState<string>('');

  return _.isEmpty(workspacesInProject) ? (
    <div style={{ ...Style.cardList.longCardShadowless, width: 'fit-content' }}>
      <span aria-hidden='true'>Use this Terra billing project to create</span>
      <Link
        aria-label='Use this Terra billing project to create workspaces'
        style={{ marginLeft: '0.3em', textDecoration: 'underline' }}
        href={Nav.getLink('workspaces')}
      >
        Workspaces
      </Link>
    </div>
  ) : (
    !_.isEmpty(workspacesInProject) && (
      <>
        {isFeaturePreviewEnabled(SPEND_REPORTING) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(max-content, 1fr))',
              rowGap: '1.66rem',
              columnGap: '1.25rem',
            }}
          >
            <DateRangeFilter
              label='Date range'
              rangeOptions={[7, 30, 90]}
              defaultValue={selectedDays}
              style={{ gridRowStart: 1, gridColumnStart: 1 }}
              onChange={setSelectedDays}
            />
            <SearchFilter
              placeholder='Search by name, project or bucket'
              style={{ gridRowStart: 1, gridColumnStart: 2, margin: '1.35rem' }}
              onChange={setSearchValue}
            />
          </div>
        )}
        <div role='table' aria-label={`workspaces in billing project ${billingProject.projectName}`}>
          <WorkspaceCardHeaders
            needsStatusColumn={billingAccountsOutOfDate}
            sort={workspaceSort}
            onSort={setWorkspaceSort}
          />
          <div>
            {_.flow(
              _.orderBy([workspaceSort.field], [workspaceSort.direction]),
              _.map((workspace: WorkspaceInfo) => {
                const isExpanded = expandedWorkspaceName === workspace.name;
                return (
                  <WorkspaceCard
                    workspace={workspace}
                    billingAccountDisplayName={
                      isGoogleWorkspaceInfo(workspace)
                        ? billingAccounts[workspace.billingAccount]?.displayName
                        : undefined
                    }
                    billingProject={billingProject}
                    billingAccountStatus={billingAccountsOutOfDate && getBillingAccountStatus(workspace)}
                    key={workspace.workspaceId}
                    isExpanded={isExpanded}
                    onExpand={() => setExpandedWorkspaceName(isExpanded ? undefined : workspace.name)}
                  />
                );
              })
            )(workspacesInProject)}
          </div>
        </div>
      </>
    )
  );
};
