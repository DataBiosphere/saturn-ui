import { SpinnerOverlay } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import * as qs from 'qs';
import React, { useState } from 'react';
import { AutoSizer } from 'react-virtualized';
import { ButtonPrimary, Link } from 'src/components/common';
import FooterWrapper from 'src/components/FooterWrapper';
import { DelayedSearchInput } from 'src/components/input';
import { TabBar } from 'src/components/tabBars';
import { FlexTable, HeaderCell, Paginator, Sortable, TooltipCell } from 'src/components/table';
import { TopBar } from 'src/components/TopBar';
import { Ajax } from 'src/libs/ajax';
import { createMethodProvider } from 'src/libs/ajax/methods/providers/CreateMethodProvider';
import * as Nav from 'src/libs/nav';
import { notify } from 'src/libs/notifications';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import { getTerraUser } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { withBusyState } from 'src/libs/utils';
import { MethodDefinition } from 'src/pages/workflows/workflow-utils';
import { WorkflowModal } from 'src/workflows/methods-repo/modals/WorkflowModal';

// Note: The first tab key in this array will determine the default tab selected
// if the tab query parameter is not present or has an invalid value (and when
// clicking on that tab, the tab query parameter will not be used in the URL)
const tabKeys = ['mine', 'public'] as const;
type TabKey = (typeof tabKeys)[number]; // 'mine' | 'public'

// Custom type guard
const isTabKey = (val: any): val is TabKey => _.includes(val, tabKeys);

const defaultTabKey: TabKey = tabKeys[0];

/**
 * Represents a list of method definitions grouped into two
 * categories — My Methods and Public Methods — corresponding
 * to the tabs above the workflows table.
 */
type GroupedWorkflows = Record<TabKey, MethodDefinition[]>;

// This is based on the sort type from the FlexTable component
// When that component is converted to TypeScript, we should use its sort type
// instead
interface SortProperties {
  field: keyof MethodDefinition;
  direction: 'asc' | 'desc';
}

interface NewQueryParams {
  newTab?: TabKey;
  newFilter?: string;
}

interface WorkflowTableHeaderProps {
  sort: SortProperties;
  field: string;
  onSort: (newSort: SortProperties) => void;
  children: string;
}

/**
 * @param {WorkflowTableHeaderProps} props
 * @param {SortProperties} props.sort - the current sort properties of the table
 * @param {string} props.field - the field identifier of the header's column
 * (should match the sort field if this column is being sorted)
 * @param {(newSort: SortProperties) => void} props.onSort - called to update
 * the sort properties when the header's column is selected for sorting
 * @param {string} props.children - the text to display in the header cell
 */
const WorkflowTableHeader = (props: WorkflowTableHeaderProps) => {
  const { sort, field, onSort, children: text } = props;

  return (
    <Sortable sort={sort} field={field} onSort={onSort}>
      <HeaderCell>{text}</HeaderCell>
    </Sortable>
  );
};

interface WorkflowListProps {
  queryParams?: {
    tab?: string;
    filter?: string;
    [queryParam: string]: any;
  };
}

// TODO: consider wrapping query updates in useEffect
export const WorkflowList = (props: WorkflowListProps) => {
  const { queryParams = {} } = props;
  const { tab: queryTab, filter = '', ...query } = queryParams;

  const selectedTab: TabKey = isTabKey(queryTab) ? queryTab : defaultTabKey;

  const signal: AbortSignal = useCancellation();
  const [busy, setBusy] = useState<boolean>(false);

  // workflows is undefined while the method definitions are still loading;
  // it is null if there is an error while loading
  const [workflows, setWorkflows] = useState<GroupedWorkflows | null | undefined>();

  // Valid direction values are 'asc' and 'desc' (based on expected
  // function signatures from the Sortable component used in this
  // component and from Lodash/fp's orderBy function)
  const [sort, setSort] = useState<SortProperties>({ field: 'name', direction: 'asc' });

  const [createWorkflowModalOpen, setCreateWorkflowModalOpen] = useState<boolean>(false);

  const [pageNumber, setPageNumber] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const getTabQueryName = (newTab: TabKey): TabKey | undefined => (newTab === defaultTabKey ? undefined : newTab);

  const getUpdatedQuery = ({ newTab = selectedTab, newFilter = filter }: NewQueryParams): string => {
    // Note: setting undefined so that falsy values don't show up at all
    return qs.stringify(
      { ...query, tab: getTabQueryName(newTab), filter: newFilter || undefined },
      { addQueryPrefix: true }
    );
  };

  const updateQuery = (newParams: NewQueryParams): void => {
    const newSearch: string = getUpdatedQuery(newParams);

    if (newSearch !== Nav.history.location.search) {
      setPageNumber(1);
      Nav.history.replace({ search: newSearch });
    }
  };

  const onSort = (newSort: SortProperties): void => {
    setPageNumber(1);
    setSort(newSort);
  };

  const tabNames: Record<TabKey, string> = { mine: 'My Methods', public: 'Public Methods' };

  const getTabDisplayNames = (
    workflows: GroupedWorkflows | null | undefined,
    selectedTab: TabKey
  ): Record<TabKey, string> => {
    const getCountString = (tab: TabKey): string => {
      if (workflows == null) {
        return '';
      }

      // Only the currently selected tab's workflow count reflects the search
      // filter (since the filter is cleared when switching tabs)
      if (tab === selectedTab) {
        return ` (${sortedWorkflows.length})`;
      }
      return ` (${workflows[tab].length})`;
    };

    const tabDisplayNames: Record<TabKey, string> = { ...tabNames }; // (shallow) copy
    for (const tabKey of tabKeys) {
      tabDisplayNames[tabKey] += getCountString(tabKey);
    }
    return tabDisplayNames;
  };

  useOnMount(() => {
    const isMine = ({ public: isPublic, managers }: MethodDefinition): boolean =>
      !isPublic || _.includes(getTerraUser().email, managers);

    const loadWorkflows = withBusyState(setBusy, async () => {
      try {
        const allWorkflows: MethodDefinition[] = await Ajax(signal).Methods.definitions();

        setWorkflows({
          mine: _.filter(isMine, allWorkflows),
          public: _.filter('public', allWorkflows),
        });
      } catch (error) {
        setWorkflows(null);
        notify('error', 'Error loading methods', { detail: error instanceof Response ? await error.text() : error });
      }
    });

    loadWorkflows();
  });

  const navigateToWorkflow = (namespace: string, name: string, snapshotId: number) =>
    Nav.goToPath('workflow-dashboard', {
      namespace,
      name,
      snapshotId,
    });

  // Get the sort key of a method definition based on the currently
  // selected sort field such that numeric fields are sorted numerically
  // and other fields are sorted as case-insensitive strings
  const getSortKey = ({ [sort.field]: sortValue }: MethodDefinition): number | string => {
    if (typeof sortValue === 'number') {
      return sortValue;
    }
    if (sortValue == null) {
      return '';
    }
    return _.lowerCase(sortValue.toString());
  };

  const sortedWorkflows: MethodDefinition[] = _.flow<
    // filter input type: MethodDefinition[] | undefined (extra [] are because the inputs are viewed as a rest parameter)
    (MethodDefinition[] | undefined)[],
    MethodDefinition[], // filter output type / orderBy input type
    MethodDefinition[] // final result type
  >(
    _.filter(({ namespace, name }: MethodDefinition) => Utils.textMatch(filter, `${namespace}/${name}`)),
    _.orderBy([getSortKey], [sort.direction])
  )(workflows?.[selectedTab]);

  const firstPageIndex: number = (pageNumber - 1) * itemsPerPage;
  const lastPageIndex: number = firstPageIndex + itemsPerPage;
  const paginatedWorkflows: MethodDefinition[] = sortedWorkflows.slice(firstPageIndex, lastPageIndex);

  return (
    <FooterWrapper>
      <TopBar title='Broad Methods Repository' href=''>
        {null /* no additional content to display in the top bar */}
      </TopBar>
      <TabBar
        aria-label='methods list menu'
        activeTab={selectedTab}
        tabNames={tabKeys}
        displayNames={getTabDisplayNames(workflows, selectedTab)}
        getHref={(currentTab) => `${Nav.getLink('workflows')}${getUpdatedQuery({ newTab: currentTab })}`}
        getOnClick={(currentTab) => (e) => {
          e.preventDefault();
          updateQuery({ newTab: currentTab, newFilter: '' });
        }}
      >
        {null /* nothing to display at the end of the tab bar */}
      </TabBar>
      <main style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', rowGap: '1rem' }}>
        <div style={{ display: 'flex' }}>
          <DelayedSearchInput
            style={{ width: 500, display: 'flex', justifyContent: 'flex-start' }}
            placeholder='SEARCH METHODS'
            aria-label='Search methods'
            onChange={(val) => updateQuery({ newFilter: val })}
            value={filter}
          />
          <div style={{ width: 500, display: 'flex', flex: 3, justifyContent: 'flex-end' }}>
            <ButtonPrimary
              onClick={() => {
                setCreateWorkflowModalOpen(true);
              }}
            >
              Create New Method
            </ButtonPrimary>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <AutoSizer>
            {({ width, height }) => (
              <FlexTable
                aria-label={tabNames[selectedTab]}
                width={width}
                height={height}
                sort={sort as any /* necessary until FlexTable is converted to TS */}
                rowCount={paginatedWorkflows.length}
                columns={getColumns(sort, onSort, paginatedWorkflows)}
                variant={null}
                noContentMessage={workflows === undefined ? ' ' : 'Nothing to display'}
                tabIndex={-1}
              />
            )}
          </AutoSizer>
        </div>
        {!_.isEmpty(sortedWorkflows) && (
          <div style={{ marginBottom: '0.5rem' }}>
            {
              // @ts-expect-error
              <Paginator
                filteredDataLength={sortedWorkflows.length}
                unfilteredDataLength={workflows![selectedTab].length}
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
        )}
        {createWorkflowModalOpen && (
          <WorkflowModal
            title='Create New Method'
            buttonActionName='Upload'
            createMethodProvider={createMethodProvider}
            onSuccess={navigateToWorkflow}
            onDismiss={() => setCreateWorkflowModalOpen(false)}
          />
        )}
      </main>
      {busy && <SpinnerOverlay />}
    </FooterWrapper>
  );
};

const getColumns = (
  sort: SortProperties,
  onSort: (newSort: SortProperties) => void,
  paginatedWorkflows: MethodDefinition[]
) => [
  // Note: 'field' values should be MethodDefinition property names for sorting
  // to work properly
  {
    field: 'name',
    headerRenderer: () => (
      <WorkflowTableHeader sort={sort} field='name' onSort={onSort}>
        Method
      </WorkflowTableHeader>
    ),
    cellRenderer: ({ rowIndex }) => {
      const { namespace, name } = paginatedWorkflows[rowIndex];

      return (
        <TooltipCell tooltip={`${namespace}/${name}`}>
          <div style={{ fontSize: 12 }}>{namespace}</div>
          <Link style={{ fontWeight: 600 }} href={Nav.getLink('workflow-dashboard', { namespace, name })}>
            {name}
          </Link>
        </TooltipCell>
      );
    },
    size: { basis: 300 },
  },
  {
    field: 'synopsis',
    headerRenderer: () => (
      <WorkflowTableHeader sort={sort} field='synopsis' onSort={onSort}>
        Synopsis
      </WorkflowTableHeader>
    ),
    cellRenderer: ({ rowIndex }) => {
      const { synopsis } = paginatedWorkflows[rowIndex];

      return <TooltipCell tooltip={null}>{synopsis}</TooltipCell>;
    },
    size: { basis: 475 },
  },
  {
    field: 'managers',
    headerRenderer: () => (
      <WorkflowTableHeader sort={sort} field='managers' onSort={onSort}>
        Owners
      </WorkflowTableHeader>
    ),
    cellRenderer: ({ rowIndex }) => {
      const { managers } = paginatedWorkflows[rowIndex];

      return <TooltipCell tooltip={null}>{managers?.join(', ')}</TooltipCell>;
    },
    size: { basis: 225 },
  },
  {
    field: 'numSnapshots',
    headerRenderer: () => (
      <WorkflowTableHeader sort={sort} field='numSnapshots' onSort={onSort}>
        Snapshots
      </WorkflowTableHeader>
    ),
    cellRenderer: ({ rowIndex }) => {
      const { numSnapshots } = paginatedWorkflows[rowIndex];

      return <div style={{ textAlign: 'end', flex: 1 }}>{numSnapshots}</div>;
    },
    size: { basis: 115, grow: 0, shrink: 0 },
  },
];

export const navPaths = [
  {
    name: 'workflows',
    path: '/methods',
    component: WorkflowList,
    title: 'Broad Methods Repository',
  },
];
