import { SpinnerOverlay } from '@terra-ui-packages/components';
import { subDays } from 'date-fns/fp';
import _ from 'lodash/fp';
import { Suspense, useEffect, useState } from 'react';
import React from 'react';
import lazy from 'react-lazy-named';
import { ErrorAlert } from 'src/alerts/ErrorAlert';
import { DateRangeFilter } from 'src/billing/Filter/DateRangeFilter';
import { ExternalLink } from 'src/billing/NewBillingProjectWizard/StepWizard/ExternalLink';
import { CostCard } from 'src/billing/SpendReport/CostCard';
import { CloudPlatform } from 'src/billing-core/models';
import { Billing } from 'src/libs/ajax/billing/Billing';
import {
  AggregatedCategorySpendData,
  AggregatedWorkspaceSpendData,
  CategorySpendData,
  SpendReport as SpendReportServerResponse,
  WorkspaceSpendData,
} from 'src/libs/ajax/billing/billing-models';
import colors from 'src/libs/colors';
import * as Nav from 'src/libs/nav';
import { useCancellation } from 'src/libs/react-utils';

const LazyChart = lazy(() => import('src/components/Chart'), 'Chart');
const maxWorkspacesInChart = 10;

const OtherMessaging = ({ cost, cloudPlatform }) => {
  const msg =
    cost !== null
      ? `Total spend includes ${cost} in other infrastructure or query costs related to the general operations of Terra.`
      : 'Total spend includes infrastructure or query costs related to the general operations of Terra.';
  return (
    <div aria-live={cost !== null ? 'polite' : 'off'} aria-atomic>
      <span aria-hidden>*</span>
      {msg}
      {cloudPlatform !== 'AZURE' ? null : (
        <ExternalLink
          url='https://support.terra.bio/hc/en-us/articles/12029087819291-Overview-Costs-and-billing-in-Terra-on-Azure'
          text=' See our documentation to learn more about Azure costs.'
          style={{ color: colors.accent(1.1) }} // needed to pass color contrast accessibility requirement
        />
      )}
    </div>
  );
};

// Interfaces for internal storage of data
interface WorkspaceCosts {
  workspaceNames: string[];
  computeCosts: number[];
  storageCosts: number[];
  otherCosts: number[];
  numWorkspaces: number;
  costFormatter: any;
}

interface ProjectCost {
  spend: string;
  compute: string;
  storage: string;
  workspaceInfrastructure: string;
  other: string;
}
// End of interfaces for internal storage of data

interface SpendReportProps {
  billingProjectName: string;
  cloudPlatform: CloudPlatform;
  viewSelected: boolean;
}

export const SpendReport = (props: SpendReportProps) => {
  const [projectCost, setProjectCost] = useState<ProjectCost | null>(null);
  const [costPerWorkspace, setCostPerWorkspace] = useState<WorkspaceCosts>({
    workspaceNames: [],
    computeCosts: [],
    otherCosts: [],
    storageCosts: [],
    numWorkspaces: 0,
    costFormatter: null,
  });
  const [updatingProjectCost, setUpdatingProjectCost] = useState(false);
  const [spendReportLengthInDays, setSpendReportLengthInDays] = useState(30);
  const [errorMessage, setErrorMessage] = useState();
  const includePerWorkspaceCosts = props.cloudPlatform === 'GCP';

  const signal = useCancellation();

  const spendChartOptions = {
    chart: { marginTop: 50, spacingLeft: 20, style: { fontFamily: 'inherit' }, type: 'bar' },
    credits: { enabled: false },
    legend: { reversed: true },
    plotOptions: { series: { stacking: 'normal' } },
    series: [
      { name: 'Compute', data: costPerWorkspace.computeCosts },
      { name: 'Storage', data: costPerWorkspace.storageCosts },
    ],
    title: {
      align: 'left',
      style: { fontSize: '16px' },
      y: 25,
      text:
        costPerWorkspace.numWorkspaces > maxWorkspacesInChart
          ? `Top ${maxWorkspacesInChart} Spending Workspaces`
          : 'Spend By Workspace',
    },
    tooltip: {
      followPointer: true,
      shared: true,
      headerFormat: '{point.key}',
    },
    xAxis: {
      categories: costPerWorkspace.workspaceNames,
      crosshair: true,
      labels: {
        formatter() {
          // @ts-ignore
          // eslint-disable-next-line react/no-this-in-sfc
          return WorkspaceLink(props.billingProjectName, this.value);
        },
        style: { xfontSize: '12px' },
      },
    },
    yAxis: {
      crosshair: true,
      min: 0,
      labels: {
        formatter() {
          // @ts-ignore
          // eslint-disable-next-line react/no-this-in-sfc
          return costPerWorkspace.costFormatter.format(this.value);
        },
        style: { fontSize: '12px' },
      },
      title: { enabled: false },
      width: '96%',
    },
    accessibility: {
      point: {
        descriptionFormatter: (point) => {
          // @ts-ignore
          return `${point.index + 1}. Workspace ${point.category}, ${
            point.series.name
          }: ${costPerWorkspace.costFormatter.format(point.y)}.`;
        },
      },
    },
    exporting: { buttons: { contextButton: { x: -15 } } },
  };

  const isProjectCostReady = projectCost !== null;

  const TOTAL_SPEND_CATEGORY = 'spend';
  const WORKSPACEINFRASTRUCTURE_CATEGORY = 'workspaceInfrastructure';
  const COMPUTE_CATEGORY = 'compute';
  const STORAGE_CATEGORY = 'storage';

  const getReportCategoryCardCaption = (name, cloudPlatformName) => {
    const azureCategoryCardCaptionMap = new Map([
      [TOTAL_SPEND_CATEGORY, 'spend'],
      [WORKSPACEINFRASTRUCTURE_CATEGORY, 'workspace infrastructure'],
      [COMPUTE_CATEGORY, 'analysis compute'],
      [STORAGE_CATEGORY, 'workspace storage'],
    ]);

    return cloudPlatformName === 'GCP' ? name : azureCategoryCardCaptionMap.get(name);
  };

  // the order of the arrays below is important. it defines the order of elements on UI.
  const reportCategories =
    props.cloudPlatform === 'GCP'
      ? [TOTAL_SPEND_CATEGORY, COMPUTE_CATEGORY, STORAGE_CATEGORY]
      : [TOTAL_SPEND_CATEGORY, WORKSPACEINFRASTRUCTURE_CATEGORY, COMPUTE_CATEGORY, STORAGE_CATEGORY];

  useEffect(() => {
    const maybeLoadProjectCost = async () => {
      if (!updatingProjectCost && !errorMessage && projectCost === null && props.viewSelected) {
        setUpdatingProjectCost(true);
        const endDate = new Date().toISOString().slice(0, 10);
        const startDate = subDays(spendReportLengthInDays, new Date()).toISOString().slice(0, 10);
        const aggregationKeys = includePerWorkspaceCosts ? ['Workspace~Category', 'Category'] : ['Category'];
        const spend: SpendReportServerResponse = await Billing(signal).getSpendReport({
          billingProjectName: props.billingProjectName,
          startDate,
          endDate,
          aggregationKeys,
        });
        const costFormatter = new Intl.NumberFormat(navigator.language, {
          style: 'currency',
          currency: spend.spendSummary.currency,
        });
        const categoryDetails = _.find(
          (details) => details.aggregationKey === 'Category',
          spend.spendDetails
        ) as AggregatedCategorySpendData;
        console.assert(categoryDetails !== undefined, 'Spend report details do not include aggregation by Category');
        const getCategoryCosts = (
          categorySpendData: CategorySpendData[]
        ): { compute: number; storage: number; workspaceInfrastructure: number; other: number } => {
          return {
            compute: parseFloat(_.find(['category', 'Compute'], categorySpendData)?.cost ?? '0'),
            storage: parseFloat(_.find(['category', 'Storage'], categorySpendData)?.cost ?? '0'),
            workspaceInfrastructure: parseFloat(
              _.find(['category', 'WorkspaceInfrastructure'], categorySpendData)?.cost ?? '0'
            ),
            other: parseFloat(_.find(['category', 'Other'], categorySpendData)?.cost ?? '0'),
          };
        };
        const costDict = getCategoryCosts(categoryDetails.spendData);

        setProjectCost({
          spend: costFormatter.format(parseFloat(spend.spendSummary.cost)),
          compute: costFormatter.format(costDict.compute),
          storage: costFormatter.format(costDict.storage),
          workspaceInfrastructure: costFormatter.format(costDict.workspaceInfrastructure),
          other: costFormatter.format(costDict.other),
        });

        if (includePerWorkspaceCosts) {
          const workspaceDetails = _.find(
            (details) => details.aggregationKey === 'Workspace',
            spend.spendDetails
          ) as AggregatedWorkspaceSpendData;
          console.assert(
            workspaceDetails !== undefined,
            'Spend report details do not include aggregation by Workspace'
          );
          // Get the most expensive workspaces, sorted from most to least expensive.
          const mostExpensiveWorkspaces = _.flow(
            _.sortBy(({ cost }) => {
              return parseFloat(cost);
            }),
            _.reverse,
            _.slice(0, maxWorkspacesInChart)
          )(workspaceDetails?.spendData) as WorkspaceSpendData[];
          // Pull out names and costs.
          const costPerWorkspace: WorkspaceCosts = {
            workspaceNames: [],
            computeCosts: [],
            storageCosts: [],
            otherCosts: [],
            costFormatter,
            numWorkspaces: workspaceDetails?.spendData.length,
          };
          _.forEach((workspaceCostData) => {
            costPerWorkspace.workspaceNames.push(workspaceCostData.workspace.name);
            const categoryDetails = workspaceCostData.subAggregation;
            console.assert(
              categoryDetails.aggregationKey === 'Category',
              'Workspace spend report details do not include sub-aggregation by Category'
            );
            const costDict = getCategoryCosts(categoryDetails.spendData);
            costPerWorkspace.computeCosts.push(costDict.compute);
            costPerWorkspace.storageCosts.push(costDict.storage);
            costPerWorkspace.otherCosts.push(costDict.other);
          }, mostExpensiveWorkspaces);
          setCostPerWorkspace(costPerWorkspace);
        }
        setUpdatingProjectCost(false);
      }
    };
    maybeLoadProjectCost().catch(async (error) => {
      setErrorMessage(await (error instanceof Response ? error.text() : error));
      setUpdatingProjectCost(false);
    });
  }, [
    spendReportLengthInDays,
    props,
    signal,
    projectCost,
    updatingProjectCost,
    errorMessage,
    includePerWorkspaceCosts,
  ]);

  return (
    <>
      <div style={{ display: 'grid', rowGap: '0.5rem' }}>
        {!!errorMessage && <ErrorAlert errorValue={errorMessage} />}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${reportCategories.length}, minmax(max-content, 1fr))`,
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
                setProjectCost(null);
                setErrorMessage(undefined);
              }
            }}
          />
          {_.map(
            (name) => (
              <CostCard
                key={name}
                type={name}
                title={`Total ${getReportCategoryCardCaption(name, props.cloudPlatform)}`}
                amount={!isProjectCostReady ? '...' : projectCost[name]}
                isProjectCostReady={isProjectCostReady}
                showAsterisk={name === 'spend'}
              />
            ),
            reportCategories
          )}
        </div>
        <OtherMessaging cost={isProjectCostReady ? projectCost.other : null} cloudPlatform={props.cloudPlatform} />
        {includePerWorkspaceCosts && costPerWorkspace.numWorkspaces > 0 && (
          // Set minWidth so chart will shrink on resize
          <div style={{ minWidth: 500, marginTop: '1rem' }}>
            <Suspense fallback={null}>
              <LazyChart options={spendChartOptions} />
            </Suspense>
          </div>
        )}
      </div>
      {updatingProjectCost && <SpinnerOverlay mode='FullScreen' />}
    </>
  );
};

export const WorkspaceLink = (billingProject, workspace) => {
  return `<a style="color:${colors.accent()}" href=${Nav.getLink('workspace-dashboard', {
    namespace: billingProject,
    name: workspace,
  })}>${workspace}</a>`;
};
