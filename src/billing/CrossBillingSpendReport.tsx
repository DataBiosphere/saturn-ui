import { Icon, Link } from '@terra-ui-packages/components';
import { subDays } from 'date-fns/fp';
import _ from 'lodash/fp';
import { React, ReactNode, useEffect, useState } from 'react';
import { DateRangeFilter } from 'src/billing/Filter/DateRangeFilter';
import { SearchFilter } from 'src/billing/Filter/SearchFilter';
import {
  billingAccountIconSize,
  BillingAccountStatus,
  getBillingAccountIconProps,
  parseCurrencyIfNeeded,
} from 'src/billing/utils';
import { BillingProject } from 'src/billing-core/models';
import { ariaSort, HeaderRenderer } from 'src/components/table';
import { Billing } from 'src/libs/ajax/billing/Billing';
import {
  AggregatedWorkspaceSpendData,
  SpendReport as SpendReportServerResponse,
} from 'src/libs/ajax/billing/billing-models';
import { Metrics } from 'src/libs/ajax/Metrics';
import Events, { extractBillingDetails } from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import { memoWithName, useCancellation } from 'src/libs/react-utils';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { BaseWorkspaceInfo, WorkspaceInfo } from 'src/workspaces/utils';

// Copied and slightly altered from WorkspaceCard and WorkspaceCardHeaders in Workspaces,
// May want to instead extend them
const workspaceLastModifiedWidth = 150;

export interface CrossBillingWorkspaceCardHeadersProps {
  needsStatusColumn: boolean;
  sort: { field: string; direction: 'asc' | 'desc' };
  onSort: (sort: { field: string; direction: 'asc' | 'desc' }) => void;
}

export const CrossBillingWorkspaceCardHeaders: React.FC<CrossBillingWorkspaceCardHeadersProps> = memoWithName(
  'CrossBillingWorkspaceCardHeaders',
  (props: CrossBillingWorkspaceCardHeadersProps) => {
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
        <div role='columnheader' aria-sort={ariaSort(sort, 'billingAccount')} style={{ flex: 1 }}>
          <HeaderRenderer sort={sort} onSort={onSort} name='billingAccount' />
        </div>
        <div
          role='columnheader'
          aria-sort={ariaSort(sort, 'workspaceName')}
          // style={{ flex: 1, paddingLeft: needsStatusColumn ? '1rem' : '2rem' }}
        >
          <HeaderRenderer sort={sort} onSort={onSort} name='workspaceName' />
        </div>
        <div role='columnheader' aria-sort={ariaSort(sort, 'totalSpend')} style={{ flex: 1 }}>
          <HeaderRenderer sort={sort} onSort={onSort} name='totalSpend' />
        </div>
        <div role='columnheader' aria-sort={ariaSort(sort, 'totalCompute')} style={{ flex: 1 }}>
          <HeaderRenderer sort={sort} onSort={onSort} name='totalCompute' />
        </div>
        <div role='columnheader' aria-sort={ariaSort(sort, 'totalStorage')} style={{ flex: 1 }}>
          <HeaderRenderer sort={sort} onSort={onSort} name='totalStorage' />
        </div>
        {/* <div role='columnheader' aria-sort={ariaSort(sort, 'otherSpend')} style={{ flex: 1 }}>
          <HeaderRenderer sort={sort} onSort={onSort} name='otherSpend' />
        </div> */}
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

interface CrossBillingWorkspaceCardProps {
  workspace: WorkspaceInfo;
  billingAccountDisplayName: string | undefined;
  billingProject: BillingProject;
  billingAccountStatus: false | BillingAccountStatus;
}

export const CrossBillingWorkspaceCard: React.FC<CrossBillingWorkspaceCardProps> = memoWithName(
  'CrossBillingWorkspaceCard',
  (props: CrossBillingWorkspaceCardProps) => {
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
          <div role='cell' style={workspaceCardStyles.field}>
            {billingProject.projectName ?? '...'}
          </div>
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
          <div role='cell' style={workspaceCardStyles.field}>
            {totalSpend ?? '...'}
          </div>
          <div role='cell' style={workspaceCardStyles.field}>
            {totalCompute ?? '...'}
          </div>
          <div role='cell' style={workspaceCardStyles.field}>
            {totalStorage ?? '...'}
          </div>
          {/* <div role='cell' style={workspaceCardStyles.field}>
            {otherSpend ?? '...'}
          </div> */}
          <div role='cell' style={workspaceCardStyles.field}>
            {createdBy}
          </div>
          <div role='cell' style={{ height: '1rem', flex: `0 0 ${workspaceLastModifiedWidth}px` }}>
            {Utils.makeStandardDate(lastModified)}
          </div>
        </div>
      </div>
    );
  }
);
/// ///

export const CrossBillingSpendReport = (): ReactNode => {
  // const [spendReportLengthInDays, setSpendReportLengthInDays] = useState(30); // todo set this up
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [updating, setUpdating] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number>(30);
  // const [searchValue, setSearchValue] = useState<string>('');
  const [ownedWorkspaces, setOwnedWorkspaces] = useState<BaseWorkspaceInfo[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [workspaceSort, setWorkspaceSort] = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'totalSpend',
    direction: 'desc',
  });

  const signal = useCancellation();
  useEffect(() => {
    const getWorkspaceSpendData = async (
      selectedDays: number,
      signal: AbortSignal,
      workspaces: BaseWorkspaceInfo[]
    ) => {
      // Define start and end dates
      const startDate = subDays(selectedDays, new Date()).toISOString().slice(0, 10);
      const endDate = new Date().toISOString().slice(0, 10);

      const setDefaultSpendValues = (workspace: BaseWorkspaceInfo) => ({
        ...workspace,
        totalSpend: 'N/A',
        totalCompute: 'N/A',
        totalStorage: 'N/A',
      });

      setUpdating(true);

      try {
        // Fetch the spend report for the billing project
        const crossBillingSpendReport: SpendReportServerResponse = await Billing(signal).getCrossBillingSpendReport({
          startDate,
          endDate,
          pageSize: 10, // TODO pass these in
          offset: 0, // TODO pass these in
        });
        const spendDataItems = (crossBillingSpendReport.spendDetails as AggregatedWorkspaceSpendData[]).map(
          (detail) => detail.spendData[0]
        );

        // Update each workspace with spend data or default values
        return spendDataItems.map((spendItem) => {
          const costFormatter = new Intl.NumberFormat(navigator.language, {
            style: 'currency',
            currency: spendItem.currency,
          });

          return {
            ...spendItem.workspace,
            workspaceId: 'temp',
            authorizationDomain: [],
            createdDate: '2024-12-01',
            createdBy: 'temp',
            lastModified: '2024-12-01',
            totalSpend: costFormatter.format(parseFloat(spendItem.cost ?? '0.00')),
            totalCompute: costFormatter.format(
              parseFloat(_.find({ category: 'Compute' }, spendItem.subAggregation.spendData)?.cost ?? '0.00')
            ),
            totalStorage: costFormatter.format(
              parseFloat(_.find({ category: 'Storage' }, spendItem.subAggregation.spendData)?.cost ?? '0.00')
            ),
            // otherSpend: costFormatter.format(
            //   parseFloat(_.find({ category: 'Other' }, spendItem.subAggregation.spendData)?.cost ?? '0.00')
            // ),
          };
        });
      } catch {
        // Return default values for each workspace in case of an error
        return workspaces.map(setDefaultSpendValues);
      } finally {
        // Ensure updating state is reset regardless of success or failure
        setUpdating(false);
      }
    };
    getWorkspaceSpendData(selectedDays, signal, []).then((updatedWorkspaceInProject) => {
      if (updatedWorkspaceInProject) {
        setOwnedWorkspaces(updatedWorkspaceInProject);
      }
    });
  }, [selectedDays, signal]);

  return (
    <>
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
            defaultValue={7}
            style={{ gridRowStart: 1, gridColumnStart: 1 }}
            onChange={setSelectedDays}
          />
          <SearchFilter
            placeholder='Search by name, project or bucket'
            style={{ gridRowStart: 1, gridColumnStart: 2, margin: '1.35rem' }}
            onChange={setSearchValue}
          />
        </div>
        <div aria-live='polite' aria-atomic>
          <span aria-hidden>*</span>
          Total spend includes infrastructure or query costs related to the general operations of Terra.
        </div>
      </>
      {_.isEmpty(ownedWorkspaces) ? (
        <div
          style={{
            marginTop: '2rem',
          }}
        >
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
        </div>
      ) : (
        !_.isEmpty(ownedWorkspaces) && (
          <div role='table' aria-label='owned workspaces'>
            <CrossBillingWorkspaceCardHeaders
              needsStatusColumn={false}
              onSort={() => {}}
              sort={{ field: 'name', direction: 'asc' }}
            />
            <div style={{ position: 'relative' }}>
              {_.flow(
                _.orderBy(
                  [(workspace) => parseCurrencyIfNeeded(workspaceSort.field, _.get(workspaceSort.field, workspace))],
                  [workspaceSort.direction]
                ),
                _.map((workspace: WorkspaceInfo) => {
                  return (
                    <CrossBillingWorkspaceCard
                      workspace={workspace}
                      billingAccountDisplayName={workspace.namespace}
                      billingProject={{
                        cloudPlatform: 'GCP',
                        billingAccount: 'account',
                        projectName: workspace.namespace,
                        invalidBillingAccount: false,
                        roles: ['Owner'],
                        status: 'Ready',
                      }}
                      billingAccountStatus={false}
                      key={workspace.workspaceId}
                    />
                  );
                })
              )(ownedWorkspaces)}
              {/* {updating && fixedSpinnerOverlay} */}
            </div>
          </div>
        )
      )}
    </>
  );
};
