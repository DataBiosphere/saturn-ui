import { Icon, Link } from '@terra-ui-packages/components';
import { subDays } from 'date-fns/fp';
import _ from 'lodash/fp';
import React, { ReactNode, useEffect, useState } from 'react';
import { DateRangeFilter } from 'src/billing/Filter/DateRangeFilter';
import { SearchFilter } from 'src/billing/Filter/SearchFilter';
import { billingAccountIconSize, BillingAccountStatus, getBillingAccountIconProps } from 'src/billing/utils';
import { BillingProject, GoogleBillingAccount } from 'src/billing-core/models';
import { ariaSort, HeaderRenderer } from 'src/components/table';
import { Billing } from 'src/libs/ajax/billing/Billing';
import {
  AggregatedWorkspaceSpendData,
  SpendReport as SpendReportServerResponse,
  WorkspaceSpendData,
} from 'src/libs/ajax/billing/billing-models';
import { Metrics } from 'src/libs/ajax/Metrics';
import Events, { extractBillingDetails } from 'src/libs/events';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import { SPEND_REPORTING } from 'src/libs/feature-previews-config';
import * as Nav from 'src/libs/nav';
import { memoWithName, useCancellation } from 'src/libs/react-utils';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { isGoogleWorkspaceInfo, WorkspaceInfo } from 'src/workspaces/utils';

const workspaceLastModifiedWidth = 150;

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
      </div>
    );
  }
);

interface WorkspaceCardProps {
  workspace: WorkspaceInfo;
  billingAccountDisplayName: string | undefined;
  billingProject: BillingProject;
  billingAccountStatus: false | BillingAccountStatus;
}

const WorkspaceCard: React.FC<WorkspaceCardProps> = memoWithName('WorkspaceCard', (props: WorkspaceCardProps) => {
  const { workspace, billingProject, billingAccountStatus } = props;
  const { namespace, name, createdBy, lastModified, totalSpend, totalCompute, totalStorage } = workspace;
  const workspaceCardStyles = {
    field: {
      ...Style.noWrapEllipsis,
      flex: 1,
      height: '1.20rem',
      width: `calc(50% - ${workspaceLastModifiedWidth / 2}px)`,
      paddingRight: '1rem',
    },
    row: { display: 'flex', alignItems: 'center', width: '100%', padding: '1rem' },
  };

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
              void Metrics().captureEvent(Events.billingProjectGoToWorkspace, {
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
              {totalSpend ?? '...'}
            </div>
            <div role='cell' style={workspaceCardStyles.field}>
              {totalCompute ?? '...'}
            </div>
            <div role='cell' style={workspaceCardStyles.field}>
              {totalStorage ?? '...'}
            </div>
          </>
        )}
        <div role='cell' style={workspaceCardStyles.field}>
          {createdBy}
        </div>
        <div role='cell' style={{ height: '1rem', flex: `0 0 ${workspaceLastModifiedWidth}px` }}>
          {Utils.makeStandardDate(lastModified)}
        </div>
      </div>
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
  const [workspaceSort, setWorkspaceSort] = useState<{ field: string; direction: 'asc' | 'desc' }>(
    isFeaturePreviewEnabled(SPEND_REPORTING)
      ? {
          field: 'totalSpend',
          direction: 'desc',
        }
      : {
          field: 'name',
          direction: 'asc',
        }
  );

  const getBillingAccountStatus = (workspace: WorkspaceInfo): BillingAccountStatus =>
    // @ts-ignore
    _.findKey((g) => g.has(workspace), groups);

  const signal = useCancellation();

  const [updating, setUpdating] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [searchValue, setSearchValue] = useState<string>('');
  const [allWorkspacesInProject, setAllWorkspacesInProject] = useState<WorkspaceInfo[]>(workspacesInProject);

  useEffect(() => {
    const getWorkspaceSpendDataByBillingProject = async (
      billingProjectName: string,
      selectedDays: number,
      signal: AbortSignal,
      workspacesInProject: WorkspaceInfo[]
    ) => {
      // Define start and end dates
      const startDate = subDays(selectedDays, new Date()).toISOString().slice(0, 10);
      const endDate = new Date().toISOString().slice(0, 10);
      const aggregationKeys = ['Workspace~Category'];

      // If there are no workspaces in the project, exit early
      if (_.isEmpty(workspacesInProject)) {
        return;
      }

      const setDefaultSpendValues = (workspace: WorkspaceInfo) => ({
        ...workspace,
        totalSpend: 'N/A',
        totalCompute: 'N/A',
        totalStorage: 'N/A',
      });

      setUpdating(true);

      try {
        // Fetch the spend report for the billing project
        const billingProjectSpentReport: SpendReportServerResponse = await Billing(signal).getSpendReport({
          billingProjectName,
          startDate,
          endDate,
          aggregationKeys,
        });

        // Create a map of spend data by workspace identifier
        const spendDataMap = _.keyBy(
          (spendItem: WorkspaceSpendData) => `${spendItem.workspace.namespace}-${spendItem.workspace.name}`,
          (billingProjectSpentReport.spendDetails[0] as AggregatedWorkspaceSpendData).spendData
        );

        // Update each workspace with spend data or default values
        return workspacesInProject.map((workspace) => {
          const key = `${workspace.namespace}-${workspace.name}`;
          const spendItem = spendDataMap[key];

          if (!spendItem) {
            return setDefaultSpendValues(workspace);
          }

          const costFormatter = new Intl.NumberFormat(navigator.language, {
            style: 'currency',
            currency: spendItem.currency,
          });

          return {
            ...workspace,
            totalSpend: costFormatter.format(parseFloat(spendItem.cost ?? '0.00')),
            totalCompute: costFormatter.format(
              parseFloat(_.find({ category: 'Compute' }, spendItem.subAggregation.spendData)?.cost ?? '0.00')
            ),
            totalStorage: costFormatter.format(
              parseFloat(_.find({ category: 'Storage' }, spendItem.subAggregation.spendData)?.cost ?? '0.00')
            ),
          };
        });
      } catch {
        // Return default values for each workspace in case of an error
        return workspacesInProject.map(setDefaultSpendValues);
      } finally {
        // Ensure updating state is reset regardless of success or failure
        setUpdating(false);
      }
    };

    getWorkspaceSpendDataByBillingProject(billingProject.projectName, selectedDays, signal, workspacesInProject).then(
      (updatedWorkspaceInProject) => {
        if (updatedWorkspaceInProject) {
          setAllWorkspacesInProject(updatedWorkspaceInProject);
        }
      }
    );
  }, [billingProject.projectName, selectedDays, signal, workspacesInProject]);

  // Apply filters to WorkspacesInProject
  const searchValueLower = searchValue.toLowerCase();
  const filteredWorkspacesInProject = _.filter(
    (workspace: WorkspaceInfo) =>
      workspace.name.toLowerCase().includes(searchValueLower) ||
      workspace.googleProject?.toLowerCase().includes(searchValueLower) ||
      workspace.bucketName?.toLowerCase().includes(searchValueLower),
    allWorkspacesInProject
  );

  return (
    <>
      {isFeaturePreviewEnabled(SPEND_REPORTING) && (
        <>
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
            {updating && <div style={{ gridRowStart: 1, gridColumnStart: 3, margin: '2.75rem' }}>Loading...</div>}
          </div>
          <div aria-live='polite' aria-atomic>
            <span aria-hidden>*</span>
            Total spend includes infrastructure or query costs related to the general operations of Terra.
          </div>
        </>
      )}
      {_.isEmpty(workspacesInProject) ? (
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
        !_.isEmpty(filteredWorkspacesInProject) && (
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
                    />
                  );
                })
              )(filteredWorkspacesInProject)}
            </div>
          </div>
        )
      )}
    </>
  );
};
