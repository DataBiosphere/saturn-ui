import {
  PopupTrigger,
  SpinnerOverlay,
  TooltipTrigger,
  useBusyState,
  useModalHandler,
  useThemeFromContext,
} from '@terra-ui-packages/components';
import {
  formatDatetime,
  KeyedEventHandler,
  Mutate,
  NavLinkProvider,
  withErrorIgnoring,
} from '@terra-ui-packages/core-utils';
import { useNotificationsFromContext } from '@terra-ui-packages/notifications';
import _ from 'lodash/fp';
import { Fragment, ReactNode, useEffect, useState } from 'react';
import { div, h, h2, span, strong } from 'react-hyperscript-helpers';
import { AppErrorModal } from 'src/analysis/modals/AppErrorModal';
import { RuntimeErrorModal } from 'src/analysis/modals/RuntimeErrorModal';
import { getAppStatusForDisplay, getDiskAppType } from 'src/analysis/utils/app-utils';
import {
  getAppCost,
  getGalaxyComputeCost,
  getPersistentDiskCostMonthly,
  getRuntimeCost,
} from 'src/analysis/utils/cost-utils';
import { multipleDisksError } from 'src/analysis/utils/disk-utils';
import { getCreatorForCompute } from 'src/analysis/utils/resource-utils';
import { getDisplayRuntimeStatus, isGcpContext } from 'src/analysis/utils/runtime-utils';
import { AppToolLabel } from 'src/analysis/utils/tool-utils';
import { Clickable, LabeledCheckbox, Link } from 'src/components/common';
import { icon } from 'src/components/icons';
import { makeMenuIcon } from 'src/components/PopupTrigger';
import { SimpleFlexTable, Sortable } from 'src/components/table';
import { App, isApp } from 'src/libs/ajax/leonardo/models/app-models';
import { AzureConfig, GceWithPdConfig, getRegionFromZone } from 'src/libs/ajax/leonardo/models/runtime-config-models';
import { isRuntime, ListRuntimeItem } from 'src/libs/ajax/leonardo/models/runtime-models';
import { LeoAppProvider } from 'src/libs/ajax/leonardo/providers/LeoAppProvider';
import { LeoDiskProvider, PersistentDisk } from 'src/libs/ajax/leonardo/providers/LeoDiskProvider';
import { LeoRuntimeProvider } from 'src/libs/ajax/leonardo/providers/LeoRuntimeProvider';
import { useCancellation, useGetter } from 'src/libs/react-utils';
import { elements as styleElements } from 'src/libs/style';
import { cond, DEFAULT as COND_DEFAULT, formatUSD } from 'src/libs/utils';
import { UseWorkspaces, UseWorkspacesResult } from 'src/workspaces/common/state/useWorkspaces.models';
import { GoogleWorkspaceInfo, isGoogleWorkspaceInfo, WorkspaceWrapper } from 'src/workspaces/utils';

import { DeleteAppModal } from './DeleteAppModal';
import { DeleteButton } from './DeleteButton';
import { DeleteDiskModal } from './DeleteDiskModal';
import { DeleteRuntimeModal } from './DeleteRuntimeModal';
import {
  AppWithWorkspace,
  DecoratedComputeResource,
  DecoratedResourceAttributes,
  DiskWithWorkspace,
  LeoResourcePermissionsProvider,
  RuntimeWithWorkspace,
} from './Environments.models';
import { PauseButton, PauseButtonProps } from './PauseButton';
import {
  unsupportedCloudEnvironmentMessage,
  unsupportedDiskMessage,
  UnsupportedWorkspaceCell,
} from './UnsupportedWorkspaceCell';

export type EnvironmentNavActions = {
  'workspace-view': { namespace: string; name: string };
};

type LeoAppProviderNeeds = Pick<LeoAppProvider, 'listWithoutProject' | 'get' | 'pause' | 'delete'>;
type LeoRuntimeProviderNeeds = Pick<LeoRuntimeProvider, 'list' | 'errorInfo' | 'stop' | 'delete'>;
type LeoDiskProviderNeeds = Pick<LeoDiskProvider, 'list' | 'delete'>;

export interface DataRefreshInfo {
  leoCallTimeMs: number;
  totalCallTimeMs: number;
  runtimes: number;
  disks: number;
  apps: number;
}

export interface EnvironmentsEvents {
  dataRefresh: DataRefreshInfo;
}

export interface EnvironmentsProps {
  nav: NavLinkProvider<EnvironmentNavActions>;
  useWorkspaces: UseWorkspaces;
  leoAppData: LeoAppProviderNeeds;
  leoRuntimeData: LeoRuntimeProviderNeeds;
  leoDiskData: LeoDiskProviderNeeds;
  permissions: LeoResourcePermissionsProvider;
  onEvent?: KeyedEventHandler<EnvironmentsEvents>;
}

export const Environments = (props: EnvironmentsProps): ReactNode => {
  const { nav, useWorkspaces, leoAppData, leoDiskData, leoRuntimeData, permissions, onEvent } = props;
  const { colors } = useThemeFromContext();
  const { withErrorReporting } = useNotificationsFromContext();
  const signal = useCancellation();

  type WorkspaceWrapperLookup = { [namespace: string]: { [name: string]: WorkspaceWrapper } };
  const { workspaces, refresh: refreshWorkspaces } = _.flow(
    useWorkspaces,
    _.update('workspaces', _.flow(_.groupBy('workspace.namespace'), _.mapValues(_.keyBy('workspace.name'))))
  )() as Mutate<UseWorkspacesResult, 'workspaces', WorkspaceWrapperLookup>;
  const getWorkspaces = useGetter(workspaces);
  const [workspacesLoaded, setWorkspacesLoaded] = useState(false);

  const [runtimes, setRuntimes] = useState<RuntimeWithWorkspace[]>();
  const [apps, setApps] = useState<AppWithWorkspace[]>();
  const [disks, setDisks] = useState<DiskWithWorkspace[]>();
  const [loading, withLoading] = useBusyState();
  const [errorRuntimeId, setErrorRuntimeId] = useState<number>();
  const getErrorRuntimeId = useGetter(errorRuntimeId);
  const [deleteRuntimeId, setDeleteRuntimeId] = useState<number>();
  const getDeleteRuntimeId = useGetter(deleteRuntimeId);
  const [deleteDiskId, setDeleteDiskId] = useState<number>();
  const getDeleteDiskId = useGetter(deleteDiskId);
  const [errorAppId, setErrorAppId] = useState<string>();
  const deleteAppModal = useModalHandler<AppWithWorkspace>((app, close) =>
    h(DeleteAppModal, {
      app,
      onDismiss: close,
      onSuccess: () => {
        close();
        loadData();
      },
      deleteProvider: leoAppData,
    })
  );
  const [sort, setSort] = useState({ field: 'project', direction: 'asc' });
  const [diskSort, setDiskSort] = useState({ field: 'project', direction: 'asc' });

  const [shouldFilterByCreator, setShouldFilterByCreator] = useState(true);

  // TODO: this function is a great candidate for breaking out into a separate hook.
  const refreshData = withLoading(async () => {
    // Only refresh workspaces if we have pre-existing runtime/disk/app state.
    // This prevents a double-call to Rawls upon component load, but still triggers
    // a refresh upon subsequent effects (like the user changing filtering).
    if (runtimes || disks || apps) {
      await refreshWorkspaces();
    }

    const workspaces = getWorkspaces();

    // Short circuit if the workspaces haven't loaded yet.
    if (!workspacesLoaded) {
      return;
    }

    const startTimeForLeoCallsEpochMs = Date.now();

    const listArgs: Record<string, string> = shouldFilterByCreator
      ? { role: 'creator', includeLabels: 'saturnWorkspaceNamespace,saturnWorkspaceName' }
      : { includeLabels: 'saturnWorkspaceNamespace,saturnWorkspaceName' };
    const diskArgs: Record<string, string> = {
      ...listArgs,
      includeLabels: 'saturnApplication,saturnWorkspaceNamespace,saturnWorkspaceName',
    };

    const [newRuntimes, newDisks, newApps] = await Promise.all([
      leoRuntimeData.list(listArgs, { signal }),
      leoDiskData.list(diskArgs, { signal }),
      leoAppData.listWithoutProject(listArgs, { signal }),
    ]);
    const endTimeForLeoCallsEpochMs = Date.now();

    const leoCallTimeTotalMs = endTimeForLeoCallsEpochMs - startTimeForLeoCallsEpochMs;
    if (onEvent) {
      onEvent('dataRefresh', {
        leoCallTimeMs: leoCallTimeTotalMs,
        totalCallTimeMs: leoCallTimeTotalMs,
        runtimes: newRuntimes.length,
        disks: newDisks.length,
        apps: newApps.length,
      });
    }

    const decorateLabeledResourceWithWorkspace = <T extends ListRuntimeItem | PersistentDisk | App>(
      cloudObject: T
    ): DecoratedResourceAttributes & T => {
      const {
        labels: { saturnWorkspaceNamespace, saturnWorkspaceName },
      } = cloudObject;
      const { workspace } = workspaces[saturnWorkspaceNamespace]?.[saturnWorkspaceName] || {};
      // Attempting to catch resources related to GCP v1 workspaces (Rawls no longer returns them).
      const unsupportedWorkspace =
        isGcpContext(cloudObject.cloudContext) &&
        (!workspace || cloudObject.cloudContext.cloudResource !== (workspace as GoogleWorkspaceInfo).googleProject);

      return { ...cloudObject, workspace, unsupportedWorkspace };
    };

    const decoratedRuntimes = newRuntimes.map(decorateLabeledResourceWithWorkspace);
    const decoratedDisks = newDisks.map(decorateLabeledResourceWithWorkspace);
    const decoratedApps = newApps.map(decorateLabeledResourceWithWorkspace);

    setRuntimes(decoratedRuntimes);
    setDisks(decoratedDisks);
    setApps(decoratedApps);

    if (!_.some({ id: getErrorRuntimeId() }, newRuntimes)) {
      setErrorRuntimeId(undefined);
    }
    if (!_.some({ id: getDeleteRuntimeId() }, newRuntimes)) {
      setDeleteRuntimeId(undefined);
    }
    if (!_.some({ id: getDeleteDiskId() }, newDisks)) {
      setDeleteDiskId(undefined);
    }
    if (!_.some({ appName: errorAppId }, newApps)) {
      setErrorAppId(undefined);
    }
    if (deleteAppModal.isOpen && !_.some({ appName: deleteAppModal.args?.appName }, newApps)) {
      deleteAppModal.close();
    }
  });
  const loadData = withErrorIgnoring(refreshData);

  const doPauseComputeAndRefresh = withLoading(async (compute: DecoratedComputeResource) => {
    const wrappedPauseCompute = withErrorReporting('Error pausing compute')(async () => {
      if (isRuntime(compute)) {
        return leoRuntimeData.stop(compute);
      }
      if (isApp(compute)) {
        const computeWorkspace = (compute as AppWithWorkspace).workspace;
        if (isGoogleWorkspaceInfo(computeWorkspace)) {
          return leoAppData.pause(compute as AppWithWorkspace);
        }
      }
      // default:
      console.error('Pause is not currently implemented for azure apps');
    });
    await wrappedPauseCompute();
    await loadData();
  });

  const pauseComputeAndRefresh: PauseButtonProps['pauseComputeAndRefresh'] = (compute: App | ListRuntimeItem) => {
    void doPauseComputeAndRefresh(compute as DecoratedComputeResource);
  };

  useEffect(() => {
    loadData();
  }, [shouldFilterByCreator, workspacesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set the workspacesLoaded state to true when workspaces are loaded to trigger a fetch of Leo data.
  useEffect(() => {
    const isLoaded = Object.keys(workspaces).length > 0;
    setWorkspacesLoaded(isLoaded);
  }, [workspaces]);

  const getCloudProvider = (cloudEnvironment) =>
    cond<string | undefined>(
      // TODO: AKS vs GKE apps
      [isApp(cloudEnvironment), () => 'Kubernetes'],
      [cloudEnvironment?.runtimeConfig?.cloudService === 'DATAPROC', () => 'Dataproc'],
      [COND_DEFAULT, () => cloudEnvironment?.runtimeConfig?.cloudService]
    );

  const getCloudEnvTool = (cloudEnvironment) =>
    isApp(cloudEnvironment) ? _.capitalize(cloudEnvironment.appType) : _.capitalize(cloudEnvironment.labels.tool);

  const filteredRuntimes = _.orderBy(
    [
      {
        project: 'labels.saturnWorkspaceNamespace',
        workspace: 'labels.saturnWorkspaceName',
        type: getCloudProvider,
        tool: getCloudEnvTool,
        status: 'status',
        created: 'auditInfo.createdDate',
        accessed: 'auditInfo.dateAccessed',
        cost: getRuntimeCost,
      }[sort.field],
    ],
    // @ts-expect-error
    [sort.direction],
    runtimes
  ) as unknown as typeof runtimes;

  const filteredDisks = _.orderBy(
    [
      {
        project: 'googleProject',
        workspace: 'labels.saturnWorkspaceName',
        status: 'status',
        created: 'auditInfo.createdDate',
        accessed: 'auditInfo.dateAccessed',
        cost: getPersistentDiskCostMonthly,
        size: 'size',
      }[diskSort.field],
    ],
    // @ts-expect-error
    [diskSort.direction],
    disks
  ) as unknown as typeof disks;

  const filteredApps = _.orderBy(
    [
      {
        project: 'googleProject',
        workspace: 'labels.saturnWorkspaceName',
        status: 'status',
        created: 'auditInfo.createdDate',
        accessed: 'auditInfo.dateAccessed',
        cost: getAppCost,
      }[sort.field],
    ],
    // @ts-expect-error
    [sort.direction],
    apps
  ) as unknown as typeof apps;

  const filteredCloudEnvironments: DecoratedComputeResource[] = _.concat(
    filteredRuntimes as DecoratedComputeResource[],
    filteredApps || []
  );

  const totalRuntimeCost = _.sum(_.map(getRuntimeCost, runtimes));
  const totalAppCost = _.sum(_.map(getGalaxyComputeCost, apps));
  const totalCost = totalRuntimeCost + totalAppCost;
  const totalDiskCost = disks
    ? _.sum(_.map((disk) => getPersistentDiskCostMonthly(disk, getRegionFromZone(disk.zone)), disks))
    : 0;

  const runtimesByProject = _.groupBy('googleProject', runtimes);
  const disksByProject = _.groupBy('googleProject', disks);

  // We start the first output string with an empty space because empty space would
  // not apply to the case where appType is not defined (e.g. Jupyter, RStudio).
  const forAppText = (appType) => (appType ? ` for ${_.capitalize(appType)}` : '');

  const getWorkspaceCell = (
    namespace: string,
    name: string | undefined,
    appType: AppToolLabel | null,
    shouldWarn: boolean,
    unsupportedWorkspace
  ): React.ReactElement | string => {
    if (unsupportedWorkspace) {
      // Don't want to include a link because there is no workspace to link to.
      return `${name} (unavailable)`;
    }
    return name
      ? h(Fragment, [
          h(Link, { href: nav.getUrl('workspace-view', { namespace, name }), style: { wordBreak: 'break-word' } }, [
            name,
          ]),
          shouldWarn &&
            h(
              TooltipTrigger,
              {
                content: `This workspace has multiple active cloud environments${forAppText(
                  appType
                )}. Only the latest one will be used.`,
              },
              [icon('warning-standard', { style: { marginLeft: '0.25rem', color: colors.warning() } })]
            ),
        ])
      : 'information unavailable';
  };

  // Old apps, runtimes and disks may not have 'saturnWorkspaceNamespace' label defined. When they were
  // created, workspace namespace (a.k.a billing project) value used to equal the google project.
  // Therefore we use google project if the namespace label is not defined.
  const renderWorkspaceForApps = (app: AppWithWorkspace) => {
    const {
      appType,
      cloudContext: { cloudResource },
      labels: { saturnWorkspaceNamespace, saturnWorkspaceName },
    } = app;
    // Here, we use the saturnWorkspaceNamespace label if its defined, otherwise use cloudResource for older runtimes
    const resolvedSaturnWorkspaceNamespace = saturnWorkspaceNamespace || cloudResource;
    return getWorkspaceCell(
      resolvedSaturnWorkspaceNamespace,
      saturnWorkspaceName,
      appType,
      false,
      app.unsupportedWorkspace
    );
  };

  const renderWorkspaceForRuntimes = (runtime: RuntimeWithWorkspace) => {
    const {
      status,
      googleProject,
      labels: { saturnWorkspaceNamespace = googleProject, saturnWorkspaceName = undefined },
    } = runtime;
    // TODO: Azure runtimes are not covered in this logic
    const shouldWarn =
      doesUserHaveDuplicateRuntimes(getCreatorForCompute(runtime), runtimesByProject[googleProject]) &&
      !_.includes(status, ['Deleting', 'Error']);
    return getWorkspaceCell(
      saturnWorkspaceNamespace,
      saturnWorkspaceName,
      null,
      shouldWarn,
      runtime.unsupportedWorkspace
    );
  };

  const doesUserHaveDuplicateRuntimes = (user, runtimes) => {
    const runtimesForUser = _.flow(_.map(getCreatorForCompute), _.filter(!_.eq(user)))(runtimes);
    return runtimesForUser.length > 1;
  };

  const getDetailsPopup = (cloudEnvName, billingId, disk, creator, workspaceId) => {
    return h(
      PopupTrigger,
      {
        content: div({ style: { padding: '0.5rem', overflowWrap: 'break-word', width: '30em' } }, [
          div([strong(['Name: ']), cloudEnvName]),
          div([strong(['Billing ID: ']), billingId]),
          workspaceId && div([strong(['Workspace ID: ']), workspaceId]),
          !shouldFilterByCreator && div([strong(['Creator: ']), creator]),
          !!disk && div([strong(['Persistent Disk: ']), disk.name]),
        ]),
      },
      [h(Link, ['view'])]
    );
  };

  const renderDetailsApp = (app: AppWithWorkspace, disks: PersistentDisk[]) => {
    const {
      appName,
      cloudContext,
      diskName,
      auditInfo: { creator },
      workspace: { workspaceId = undefined } = {},
    } = app;
    const disk = _.find({ name: diskName }, disks);
    return getDetailsPopup(appName, cloudContext?.cloudResource, disk, creator, workspaceId);
  };

  const renderDetailsRuntime = (runtime: RuntimeWithWorkspace, disks: PersistentDisk[]) => {
    const {
      runtimeName,
      cloudContext,
      auditInfo: { creator },
      workspace,
    } = runtime;
    const diskId: number | undefined = (runtime.runtimeConfig as AzureConfig | GceWithPdConfig).persistentDiskId;
    const disk = _.find({ id: diskId }, disks);
    return getDetailsPopup(runtimeName, cloudContext?.cloudResource, disk, creator, workspace?.workspaceId);
  };

  const renderErrorApps = (app: AppWithWorkspace) => {
    const convertedAppStatus = getAppStatusForDisplay(app.status);
    if (convertedAppStatus !== 'Error' && app.unsupportedWorkspace) {
      return h(UnsupportedWorkspaceCell, { status: convertedAppStatus, message: unsupportedCloudEnvironmentMessage });
    }
    return h(Fragment, [
      convertedAppStatus,
      convertedAppStatus === 'Error' &&
        h(
          Clickable,
          {
            tooltip: 'View error',
            onClick: () => setErrorAppId(app.appName),
          },
          [icon('warning-standard', { style: { marginLeft: '0.25rem', color: colors.danger() } })]
        ),
    ]);
  };

  const renderErrorRuntimes = (runtime: RuntimeWithWorkspace) => {
    const convertedRuntimeStatus = getDisplayRuntimeStatus(runtime.status);
    if (convertedRuntimeStatus !== 'Error' && runtime.unsupportedWorkspace) {
      return h(UnsupportedWorkspaceCell, {
        status: convertedRuntimeStatus,
        message: unsupportedCloudEnvironmentMessage,
      });
    }
    return h(Fragment, [
      convertedRuntimeStatus,
      convertedRuntimeStatus === 'Error' &&
        h(
          Clickable,
          {
            tooltip: 'View error',
            onClick: () => setErrorRuntimeId(runtime.id),
          },
          [icon('warning-standard', { style: { marginLeft: '0.25rem', color: colors.danger() } })]
        ),
    ]);
  };

  const renderDeleteDiskModal = (disk: DiskWithWorkspace) => {
    return h(DeleteDiskModal, {
      disk,
      deleteProvider: leoDiskData,
      onDismiss: () => setDeleteDiskId(undefined),
      onSuccess: () => {
        setDeleteDiskId(undefined);
        loadData();
      },
    });
  };

  const runtimeToDelete: RuntimeWithWorkspace | undefined = _.find({ id: deleteRuntimeId }, runtimes);
  const appWithErrors: AppWithWorkspace | undefined = _.find({ appName: errorAppId }, apps);

  return h(Fragment, [
    div({ role: 'main', style: { padding: '1rem', flexGrow: 1 } }, [
      h2({ style: { ...styleElements.sectionHeader, textTransform: 'uppercase', margin: '0 0 1rem 0', padding: 0 } }, [
        'Your cloud environments',
      ]),
      div({ style: { marginBottom: '.5rem' } }, [
        h(LabeledCheckbox, { checked: shouldFilterByCreator, onChange: setShouldFilterByCreator }, [
          span({ style: { fontWeight: 600 } }, [' Hide resources you did not create']),
        ]),
      ]),
      runtimes &&
        disks &&
        div({ style: { overflow: 'scroll', overflowWrap: 'break-word', wordBreak: 'break-all' } }, [
          h(SimpleFlexTable, {
            'aria-label': 'cloud environments',
            // @ts-expect-error
            sort,
            rowCount: filteredCloudEnvironments.length,
            columns: [
              {
                size: { min: '12em' },
                field: 'project',
                headerRenderer: () => h(Sortable, { sort, field: 'project', onSort: setSort }, ['Billing project']),
                cellRenderer: ({ rowIndex }) => {
                  const cloudEnv: DecoratedComputeResource = filteredCloudEnvironments[rowIndex];
                  const workspaceNamespace = cloudEnv.workspace?.namespace;
                  const {
                    labels: { saturnWorkspaceNamespace = workspaceNamespace },
                  } = cloudEnv;
                  return saturnWorkspaceNamespace;
                },
              },
              {
                size: { min: '10em' },
                field: 'workspace',
                headerRenderer: () => h(Sortable, { sort, field: 'workspace', onSort: setSort }, ['Workspace']),
                cellRenderer: ({ rowIndex }) => {
                  const cloudEnvironment = filteredCloudEnvironments[rowIndex];
                  return isApp(cloudEnvironment)
                    ? renderWorkspaceForApps(cloudEnvironment)
                    : renderWorkspaceForRuntimes(cloudEnvironment);
                },
              },
              {
                size: { min: '10em', grow: 0 },
                headerRenderer: () => h(Sortable, { sort, field: 'type', onSort: setSort }, ['Type']),
                cellRenderer: ({ rowIndex }) => getCloudProvider(filteredCloudEnvironments[rowIndex]),
              },
              {
                size: { min: '8em', grow: 0 },
                headerRenderer: () => h(Sortable, { sort, field: 'tool', onSort: setSort }, ['Tool']),
                cellRenderer: ({ rowIndex }) => getCloudEnvTool(filteredCloudEnvironments[rowIndex]),
              },
              {
                size: { min: '7em', grow: 0 },
                headerRenderer: () => 'Details',
                cellRenderer: ({ rowIndex }) => {
                  const cloudEnvironment = filteredCloudEnvironments[rowIndex];
                  return isApp(cloudEnvironment)
                    ? renderDetailsApp(cloudEnvironment, disks)
                    : renderDetailsRuntime(cloudEnvironment, disks);
                },
              },
              {
                size: { min: '9em', grow: 0 },
                field: 'status',
                headerRenderer: () => h(Sortable, { sort, field: 'status', onSort: setSort }, ['Status']),
                cellRenderer: ({ rowIndex }) => {
                  const cloudEnvironment = filteredCloudEnvironments[rowIndex];
                  return isApp(cloudEnvironment)
                    ? renderErrorApps(cloudEnvironment)
                    : renderErrorRuntimes(cloudEnvironment);
                },
              },
              {
                size: { min: '10em', grow: 0.2 },
                headerRenderer: () => 'Location',
                cellRenderer: ({ rowIndex }) => {
                  const cloudEnvironment = filteredCloudEnvironments[rowIndex]; //
                  if (isApp(cloudEnvironment)) {
                    return cloudEnvironment.region;
                  }
                  if (isRuntime(cloudEnvironment)) {
                    return _.toLower(cloudEnvironment.runtimeConfig.normalizedRegion);
                  }
                  return '';
                },
              },
              {
                size: { min: '10em', grow: 0 },
                field: 'created',
                headerRenderer: () => h(Sortable, { sort, field: 'created', onSort: setSort }, ['Created']),
                cellRenderer: ({ rowIndex }) => {
                  return formatDatetime(filteredCloudEnvironments[rowIndex].auditInfo.createdDate);
                },
              },
              {
                size: { min: '11em', grow: 0 },
                field: 'accessed',
                headerRenderer: () => h(Sortable, { sort, field: 'accessed', onSort: setSort }, ['Last accessed']),
                cellRenderer: ({ rowIndex }) => {
                  return formatDatetime(filteredCloudEnvironments[rowIndex].auditInfo.dateAccessed);
                },
              },
              {
                size: { min: '14em', grow: 0 },
                field: 'cost',
                headerRenderer: () =>
                  h(Sortable, { sort, field: 'cost', onSort: setSort }, [`Cost / hr (${formatUSD(totalCost)} total)`]),
                cellRenderer: ({ rowIndex }) => {
                  const cloudEnvironment = filteredCloudEnvironments[rowIndex];
                  return isApp(cloudEnvironment)
                    ? formatUSD(getGalaxyComputeCost(cloudEnvironment))
                    : formatUSD(getRuntimeCost(cloudEnvironment));
                },
              },
              {
                size: { min: '13em', grow: 0 },
                headerRenderer: () => 'Actions',
                cellRenderer: ({ rowIndex }) => {
                  const cloudEnvironment = filteredCloudEnvironments[rowIndex];
                  return h(Fragment, [
                    h(PauseButton, { cloudEnvironment, permissions, pauseComputeAndRefresh }),
                    h(DeleteButton, {
                      resource: cloudEnvironment,
                      permissions,
                      onClick: (resource) => {
                        isApp(resource) ? deleteAppModal.open(resource) : setDeleteRuntimeId(resource.id);
                      },
                    }),
                  ]);
                },
              },
            ],
          }),
        ]),
      h2({ style: { ...styleElements.sectionHeader, textTransform: 'uppercase', margin: '1rem 0', padding: 0 } }, [
        'Your persistent disks',
      ]),
      disks &&
        filteredDisks &&
        div({ style: { overflow: 'scroll', overflowWrap: 'break-word', wordBreak: 'break-all' } }, [
          h(SimpleFlexTable, {
            'aria-label': 'persistent disks',
            // @ts-expect-error
            sort: diskSort,
            rowCount: filteredDisks.length,
            columns: [
              {
                size: { min: '12em' },
                field: 'project',
                headerRenderer: () =>
                  h(Sortable, { sort: diskSort, field: 'project', onSort: setDiskSort }, ['Billing project']),
                cellRenderer: ({ rowIndex }) => {
                  const {
                    cloudContext,
                    labels: { saturnWorkspaceNamespace = cloudContext.cloudResource },
                  } = filteredDisks[rowIndex];
                  return saturnWorkspaceNamespace;
                },
              },
              {
                size: { min: '10em' },
                field: 'workspace',
                headerRenderer: () =>
                  h(Sortable, { sort: diskSort, field: 'workspace', onSort: setDiskSort }, ['Workspace']),
                cellRenderer: ({ rowIndex }) => {
                  const rowDisk = filteredDisks[rowIndex];
                  const { status: diskStatus, cloudContext, workspace } = rowDisk;
                  const namespace = workspace?.namespace;
                  const name = workspace?.name;
                  const appType: AppToolLabel | undefined = getDiskAppType(filteredDisks[rowIndex]);
                  const multipleDisks = multipleDisksError(
                    disksByProject[cloudContext.cloudResource],
                    rowDisk.auditInfo.creator,
                    appType
                  );
                  return !!namespace && !!name
                    ? h(Fragment, [
                        h(
                          Link,
                          {
                            href: nav.getUrl('workspace-view', { namespace, name }),
                            style: { wordBreak: 'break-word' },
                          },
                          [name]
                        ),
                        permissions.hasDeleteDiskPermission(rowDisk) &&
                          diskStatus !== 'Deleting' &&
                          multipleDisks &&
                          h(
                            TooltipTrigger,
                            {
                              content: `This workspace has multiple active persistent disks${forAppText(
                                appType
                              )}. Only the latest one will be used.`,
                            },
                            [icon('warning-standard', { style: { marginLeft: '0.25rem', color: colors.warning() } })]
                          ),
                      ])
                    : 'information unavailable';
                },
              },
              {
                size: { min: '6em', grow: 0 },
                headerRenderer: () => 'Details',
                cellRenderer: ({ rowIndex }) => {
                  const {
                    name,
                    id,
                    cloudContext,
                    workspace,
                    auditInfo: { creator },
                  } = filteredDisks[rowIndex];
                  const runtime = _.find({ runtimeConfig: { persistentDiskId: id } }, runtimes);
                  const app = _.find({ diskName: name }, apps);
                  return h(
                    PopupTrigger,
                    {
                      content: div({ style: { padding: '0.5rem', overflowWrap: 'break-word', width: '30em' } }, [
                        div([strong(['Name: ']), name]),
                        div([strong(['Billing ID: ']), cloudContext.cloudResource]),
                        workspace && div([strong(['Workspace ID: ']), workspace.workspaceId]),
                        !shouldFilterByCreator && div([strong(['Creator: ']), creator]),
                        runtime && div([strong(['Runtime: ']), runtime.runtimeName]),
                        app && div([strong([`${_.capitalize(app.appType)}: `]), app.appName]),
                      ]),
                    },
                    [h(Link, ['view'])]
                  );
                },
              },
              {
                size: { min: '5em', grow: 0 },
                field: 'size',
                headerRenderer: () =>
                  h(Sortable, { sort: diskSort, field: 'size', onSort: setDiskSort }, ['Size (GB)']),
                cellRenderer: ({ rowIndex }) => {
                  const disk = filteredDisks[rowIndex];
                  return disk.size;
                },
              },
              {
                size: { min: '8em', grow: 0 },
                field: 'status',
                headerRenderer: () => h(Sortable, { sort: diskSort, field: 'status', onSort: setDiskSort }, ['Status']),
                cellRenderer: ({ rowIndex }) => {
                  const disk = filteredDisks[rowIndex];
                  return disk.unsupportedWorkspace
                    ? h(UnsupportedWorkspaceCell, { status: disk.status, message: unsupportedDiskMessage })
                    : disk.status;
                },
              },
              {
                size: { min: '10em', grow: 0.2 },
                headerRenderer: () => 'Location',
                cellRenderer: ({ rowIndex }) => {
                  const disk = filteredDisks[rowIndex];
                  return disk.zone;
                },
              },
              {
                size: { min: '10em', grow: 0 },
                field: 'created',
                headerRenderer: () =>
                  h(Sortable, { sort: diskSort, field: 'created', onSort: setDiskSort }, ['Created']),
                cellRenderer: ({ rowIndex }) => {
                  return formatDatetime(filteredDisks[rowIndex].auditInfo.createdDate);
                },
              },
              {
                size: { min: '11em', grow: 0 },
                field: 'accessed',
                headerRenderer: () =>
                  h(Sortable, { sort: diskSort, field: 'accessed', onSort: setDiskSort }, ['Last accessed']),
                cellRenderer: ({ rowIndex }) => {
                  return formatDatetime(filteredDisks[rowIndex].auditInfo.dateAccessed);
                },
              },
              {
                size: { min: '10em', grow: 0 },
                field: 'cost',
                headerRenderer: () => {
                  return h(Sortable, { sort: diskSort, field: 'cost', onSort: setDiskSort }, [
                    `Cost / month (${formatUSD(totalDiskCost)} total)`,
                  ]);
                },
                cellRenderer: ({ rowIndex }) => {
                  const disk = filteredDisks[rowIndex];
                  const diskRegion = getRegionFromZone(disk.zone);
                  return formatUSD(getPersistentDiskCostMonthly(disk, diskRegion));
                },
              },
              {
                size: { min: '10em', grow: 0 },
                headerRenderer: () => 'Action',
                cellRenderer: ({ rowIndex }) => {
                  const { id, status, name } = filteredDisks[rowIndex];
                  const error = cond(
                    [status === 'Creating', () => 'Cannot delete this disk because it is still being created.'],
                    [status === 'Deleting', () => 'The disk is being deleted.'],
                    [
                      _.some({ runtimeConfig: { persistentDiskId: id } }, runtimes) || _.some({ diskName: name }, apps),
                      () =>
                        'Cannot delete this disk because it is attached. You must delete the cloud environment first.',
                    ]
                  );
                  return h(
                    Link,
                    {
                      disabled: !!error,
                      tooltip: error || 'Delete persistent disk',
                      onClick: () => setDeleteDiskId(id),
                    },
                    [makeMenuIcon('trash'), 'Delete']
                  );
                },
              },
            ],
          }),
        ]),
      errorRuntimeId &&
        h(RuntimeErrorModal, {
          runtime: _.find({ id: errorRuntimeId }, runtimes)!,
          onDismiss: () => setErrorRuntimeId(undefined),
          errorProvider: leoRuntimeData,
        }),
      deleteRuntimeId &&
        runtimeToDelete &&
        h(DeleteRuntimeModal, {
          runtime: runtimeToDelete,
          deleteProvider: leoRuntimeData,
          onDismiss: () => setDeleteRuntimeId(undefined),
          onSuccess: () => {
            setDeleteRuntimeId(undefined);
            loadData();
          },
        }),
      deleteDiskId && renderDeleteDiskModal(_.find({ id: deleteDiskId }, disks) as DiskWithWorkspace),
      deleteAppModal.maybeRender(),
      appWithErrors &&
        h(AppErrorModal, {
          app: appWithErrors,
          onDismiss: () => setErrorAppId(undefined),
          appProvider: leoAppData,
        }),
    ]),
    (!workspacesLoaded || loading) && h(SpinnerOverlay),
  ]);
};
