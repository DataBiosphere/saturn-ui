import { Link } from '@terra-ui-packages/components';
import { subDays } from 'date-fns/fp';
import _ from 'lodash/fp';
import React, { ReactNode, useEffect, useState } from 'react';
import { DateRangeFilter } from 'src/billing/Filter/DateRangeFilter';
import { SearchFilter } from 'src/billing/Filter/SearchFilter';
import { BillingAccountStatus, parseCurrencyIfNeeded } from 'src/billing/utils';
import { BillingProject } from 'src/billing-core/models';
import { fixedSpinnerOverlay } from 'src/components/common';
import { ariaSort, HeaderRenderer, Paginator } from 'src/components/table';
import { Billing } from 'src/libs/ajax/billing/Billing';
import {
  AggregatedWorkspaceSpendData,
  SpendReport as SpendReportServerResponse,
} from 'src/libs/ajax/billing/billing-models';
import { Metrics } from 'src/libs/ajax/Metrics';
import Events, { extractBillingDetails } from 'src/libs/events';
import * as Nav from 'src/libs/nav';
import { memoWithName, useCancellation } from 'src/libs/react-utils';
import { SpendReportStore, spendReportStore } from 'src/libs/state';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import { GoogleWorkspace, GoogleWorkspaceInfo, WorkspaceWrapper } from 'src/workspaces/utils';

// Copied and slightly altered from WorkspaceCard and WorkspaceCardHeaders in Workspaces,
// May want to instead extend them
const workspaceLastModifiedWidth = 150;

interface ConsolidatedSpendWorkspaceCardHeadersProps {
  sort: { field: string; direction: 'asc' | 'desc' };
  onSort: (sort: { field: string; direction: 'asc' | 'desc' }) => void;
}

const ConsolidatedSpendWorkspaceCardHeaders: React.FC<ConsolidatedSpendWorkspaceCardHeadersProps> = memoWithName(
  'ConsolidatedSpendWorkspaceCardHeaders',
  (props: ConsolidatedSpendWorkspaceCardHeadersProps) => {
    const { sort, onSort } = props;
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
        <div role='columnheader' aria-sort={ariaSort(sort, 'billingAccount')} style={{ flex: 1, paddingLeft: '2rem' }}>
          <HeaderRenderer sort={sort} onSort={onSort} name='billingAccount' />
        </div>
        <div role='columnheader' aria-sort={ariaSort(sort, 'workspaceName')} style={{ flex: 1 }}>
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

interface ConsolidatedSpendWorkspaceCardProps {
  workspace: GoogleWorkspaceInfo;
  billingAccountDisplayName: string | undefined;
  billingProject: BillingProject;
  billingAccountStatus: false | BillingAccountStatus;
}

const ConsolidatedSpendWorkspaceCard: React.FC<ConsolidatedSpendWorkspaceCardProps> = memoWithName(
  'ConsolidatedSpendWorkspaceCard',
  (props: ConsolidatedSpendWorkspaceCardProps) => {
    const { workspace, billingAccountDisplayName, billingProject, billingAccountStatus } = props;
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
          <div role='cell' style={workspaceCardStyles.field}>
            {billingAccountDisplayName ?? '...'}
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

interface ConsolidatedSpendReportProps {
  workspaces: WorkspaceWrapper[];
}

export const ConsolidatedSpendReport = (props: ConsolidatedSpendReportProps): ReactNode => {
  const [spendReportLengthInDays, setSpendReportLengthInDays] = useState(30);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [updating, setUpdating] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [searchValue, setSearchValue] = useState<string>('');
  const [ownedWorkspaces, setOwnedWorkspaces] = useState<GoogleWorkspaceInfo[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [workspaceSort, setWorkspaceSort] = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'totalSpend',
    direction: 'desc',
  });
  const allWorkspaces = props.workspaces;

  // BIG TODO - paginate without making too many BQ calls but also knowing how many pages there are???
  const [pageNumber, setPageNumber] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const signal = useCancellation();

  // Apply filters to ownedWorkspaces
  const searchValueLower = searchValue.toLowerCase();

  const filteredOwnedWorkspaces = _.filter(
    (workspace: GoogleWorkspaceInfo) =>
      workspace.name.toLowerCase().includes(searchValueLower) ||
      workspace.googleProject?.toLowerCase().includes(searchValueLower) ||
      workspace.bucketName?.toLowerCase().includes(searchValueLower) ||
      workspace.namespace.toLowerCase().includes(searchValueLower),
    ownedWorkspaces
  );

  useEffect(() => {
    // Define start and end dates
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = subDays(spendReportLengthInDays, new Date()).toISOString().slice(0, 10);
    const getWorkspaceSpendData = async (signal: AbortSignal): Promise<GoogleWorkspaceInfo[]> => {
      setUpdating(true);

      const spendReportStoreLocal = spendReportStore.get();
      const storedSpendReport = spendReportStoreLocal?.[spendReportLengthInDays];
      if (!storedSpendReport || storedSpendReport.startDate !== startDate || storedSpendReport.endDate !== endDate) {
        const setDefaultSpendValues = (workspace: GoogleWorkspaceInfo) => ({
          ...workspace,
          totalSpend: 'N/A',
          totalCompute: 'N/A',
          totalStorage: 'N/A',
        });

        try {
          // Fetch the spend report for the billing project
          // TODO Cache the result so it doesn't get called on every page change
          const consolidatedSpendReport: SpendReportServerResponse = await Billing(signal).getCrossBillingSpendReport({
            startDate,
            endDate,
            pageSize: itemsPerPage,
            offset: itemsPerPage * (pageNumber - 1),
          });

          const spendDataItems = (consolidatedSpendReport.spendDetails as AggregatedWorkspaceSpendData[]).map(
            (detail) => detail.spendData[0]
          );

          // Update each workspace with spend data or default values
          return spendDataItems.map((spendItem) => {
            const costFormatter = new Intl.NumberFormat(navigator.language, {
              style: 'currency',
              currency: spendItem.currency,
            });

            // TODO what if it's not found
            const workspaceDetails = allWorkspaces.find(
              (ws): ws is GoogleWorkspace =>
                ws.workspace.name === spendItem.workspace.name &&
                ws.workspace.namespace === spendItem.workspace.namespace
            );

            return {
              ...spendItem.workspace,
              workspaceId: `${spendItem.workspace.namespace}-${spendItem.workspace.name}`,
              authorizationDomain: [],
              createdDate: workspaceDetails?.workspace.createdDate,
              createdBy: workspaceDetails?.workspace.createdBy,
              lastModified: workspaceDetails?.workspace.lastModified,

              billingAccount: workspaceDetails?.workspace.billingAccount,
              googleProject: workspaceDetails?.workspace.googleProject,
              cloudPlatform: 'Gcp',
              bucketName: workspaceDetails?.workspace.bucketName,

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
            } as GoogleWorkspaceInfo;
          });
        } catch {
          // Return default values for each workspace in case of an error
          return ownedWorkspaces.map(setDefaultSpendValues);
        } finally {
          // Ensure updating state is reset regardless of success or failure
          setUpdating(false);
        }
      } else {
        setUpdating(false);
        return storedSpendReport.spendReport;
      }
    };
    getWorkspaceSpendData(signal).then((updatedWorkspaces) => {
      if (updatedWorkspaces) {
        spendReportStore.update((store) => {
          const newStore: SpendReportStore = { ...store };
          newStore[spendReportLengthInDays] = { spendReport: updatedWorkspaces, startDate, endDate };
          return newStore;
        });
        setOwnedWorkspaces(updatedWorkspaces);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal, spendReportLengthInDays]);

  return (
    <>
      <div
        style={{
          // color: colors.dark(),
          fontSize: 18,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          marginLeft: '1rem',
          marginTop: '1rem',
        }}
      >
        Consolidated Spend Report
      </div>
      <div style={{ padding: '1.5rem 0 0', flexGrow: 1, display: 'flex', flexDirection: 'column', marginLeft: '1rem' }}>
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
            defaultValue={spendReportLengthInDays}
            style={{ gridRowStart: 1, gridColumnStart: 1 }}
            onChange={(selectedOption) => {
              if (selectedOption !== spendReportLengthInDays) {
                setSpendReportLengthInDays(selectedOption);
              }
            }}
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
        {!_.isEmpty(filteredOwnedWorkspaces) && (
          <div role='table' aria-label='owned workspaces'>
            <ConsolidatedSpendWorkspaceCardHeaders
              onSort={setWorkspaceSort}
              sort={{ field: 'name', direction: 'asc' }}
            />
            <div style={{ position: 'relative' }}>
              {_.flow(
                _.orderBy(
                  [(workspace) => parseCurrencyIfNeeded(workspaceSort.field, _.get(workspaceSort.field, workspace))],
                  [workspaceSort.direction]
                ),
                _.map((workspace: GoogleWorkspaceInfo) => {
                  return (
                    <ConsolidatedSpendWorkspaceCard
                      workspace={workspace}
                      billingAccountDisplayName={workspace.namespace}
                      billingProject={{
                        cloudPlatform: 'GCP',
                        billingAccount: workspace.billingAccount,
                        projectName: workspace.googleProject,
                        invalidBillingAccount: false,
                        roles: ['Owner'],
                        status: 'Ready',
                      }}
                      billingAccountStatus={false}
                      key={workspace.workspaceId}
                    />
                  );
                })
              )(filteredOwnedWorkspaces)}
              <div style={{ marginBottom: '0.5rem' }}>
                {
                  // @ts-expect-error
                  <Paginator
                    filteredDataLength={filteredOwnedWorkspaces.length}
                    unfilteredDataLength={ownedWorkspaces.length}
                    pageNumber={pageNumber}
                    setPageNumber={setPageNumber}
                    itemsPerPage={itemsPerPage}
                    setItemsPerPage={(v) => {
                      setPageNumber(1);
                      setItemsPerPage(v);
                    }}
                  />
                }
              </div>
            </div>
          </div>
        )}
        {updating && fixedSpinnerOverlay}
      </div>
    </>
  );
};
