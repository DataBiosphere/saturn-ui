import _ from 'lodash/fp';
import { Fragment, useEffect, useState } from 'react';
import { div, h, label, p, span } from 'react-hyperscript-helpers';
import { AboutPersistentDiskView } from 'src/analysis/modals/ComputeModal/AboutPersistentDiskView';
import { AutopauseConfiguration } from 'src/analysis/modals/ComputeModal/AutopauseConfiguration';
import { AzureComputeProfileSelect } from 'src/analysis/modals/ComputeModal/AzureComputeModal/AzureComputeProfileSelect';
import { AzurePersistentDiskSection } from 'src/analysis/modals/ComputeModal/AzureComputeModal/AzurePersistentDiskSection';
import { DeleteEnvironment } from 'src/analysis/modals/DeleteEnvironment';
import { computeStyles } from 'src/analysis/modals/modalStyles';
import { getAzureComputeCostEstimate, getAzureDiskCostEstimate } from 'src/analysis/utils/cost-utils';
import { generatePersistentDiskName } from 'src/analysis/utils/disk-utils';
import { autopauseDisabledValue, defaultAutopauseThreshold, generateRuntimeName, getIsRuntimeBusy } from 'src/analysis/utils/runtime-utils';
import { runtimeToolLabels } from 'src/analysis/utils/tool-utils';
import { ButtonOutline, ButtonPrimary, IdContainer, Link, spinnerOverlay } from 'src/components/common';
import { icon } from 'src/components/icons';
import { InfoBox } from 'src/components/InfoBox';
import { withModalDrawer } from 'src/components/ModalDrawer';
import TitleBar from 'src/components/TitleBar';
import { Ajax } from 'src/libs/ajax';
import {
  defaultAzureComputeConfig,
  defaultAzureDiskSize,
  defaultAzureMachineType,
  defaultAzurePersistentDiskType,
  defaultAzureRegion,
  machineTypeHasGpu,
} from 'src/libs/azure-utils';
import colors from 'src/libs/colors';
import { withErrorReportingInModal } from 'src/libs/error';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import * as Utils from 'src/libs/utils';
import { cloudProviderTypes } from 'src/workspaces/utils';

const titleId = 'azure-compute-modal-title';

export const AzureComputeModalBase = ({
  onDismiss,
  onSuccess,
  onError = onDismiss,
  workspace,
  currentRuntime,
  currentDisk,
  isLoadingCloudEnvironments,
  location,
  tool,
  hideCloseButton = false,
}) => {
  const [_loading, setLoading] = useState(false);
  const loading = _loading || isLoadingCloudEnvironments;
  const [viewMode, setViewMode] = useState(undefined);
  const [currentRuntimeDetails, setCurrentRuntimeDetails] = useState(currentRuntime);
  const [currentPersistentDiskDetails] = useState(currentDisk);
  const [computeConfig, setComputeConfig] = useState(defaultAzureComputeConfig);
  const updateComputeConfig = (key, value) => setComputeConfig({ ...computeConfig, [key]: value });
  const { namespace, name: workspaceName, workspaceId } = workspace.workspace;
  const persistentDiskExists = !!currentPersistentDiskDetails;
  const [deleteDiskSelected, setDeleteDiskSelected] = useState(false);

  // Lifecycle
  useEffect(() => {
    Ajax().Metrics.captureEvent(Events.cloudEnvironmentConfigOpen, {
      existingConfig: !!currentRuntime,
      ...extractWorkspaceDetails(workspace.workspace),
    });
  });

  useEffect(() => {
    const refreshRuntime = _.flow(
      withErrorReportingInModal('Error loading cloud environment', onError),
      Utils.withBusyState(setLoading)
    )(async () => {
      const runtimeDetails = currentRuntime ? await Ajax().Runtimes.runtimeV2(workspaceId, currentRuntime.runtimeName).details() : null;
      setCurrentRuntimeDetails(runtimeDetails);
      setComputeConfig({
        machineType: runtimeDetails?.runtimeConfig?.machineType || defaultAzureMachineType,
        persistentDiskSize: runtimeDetails?.diskConfig?.size || defaultAzureDiskSize,
        persistentDiskType: runtimeDetails?.diskConfig?.type || defaultAzurePersistentDiskType,
        // Azure workspace containers will pass the 'location' param as an Azure armRegionName, which can be used directly as the computeRegion
        region: runtimeDetails?.runtimeConfig?.region || location || defaultAzureRegion,
        autopauseThreshold: runtimeDetails ? runtimeDetails.autopauseThreshold || autopauseDisabledValue : defaultAutopauseThreshold,
      });
    });
    refreshRuntime();
  }, [currentRuntime, location, onError, workspaceId]);

  const renderTitleAndTagline = () => {
    return h(Fragment, [
      h(TitleBar, {
        id: titleId,
        hideCloseButton,
        style: { marginBottom: '0.5rem' },
        title: 'Azure Cloud Environment',
        onDismiss,
      }),
      div(['A cloud environment consists of application configuration, cloud compute and persistent disk(s).']),
    ]);
  };

  const renderBottomButtons = () => {
    return div({ style: { display: 'flex', marginTop: '2rem' } }, [
      (doesRuntimeExist() || !!persistentDiskExists) &&
        h(
          ButtonOutline,
          {
            onClick: () => setViewMode('deleteEnvironment'),
            disabled: loading,
          },
          [
            Utils.cond(
              [doesRuntimeExist(), () => 'Delete Environment'],
              [persistentDiskExists, () => 'Delete Persistent Disk'],
              () => 'Delete Environment'
            ),
          ]
        ),
      div({ style: { flex: 1 } }),

      renderActionButton(),
    ]);
  };

  const renderApplicationConfigurationSection = () => {
    return div({ style: computeStyles.whiteBoxContainer }, [
      h(IdContainer, [
        (id) =>
          h(Fragment, [
            div({ style: { marginBottom: '1rem' } }, [
              label({ htmlFor: id, style: computeStyles.label }, ['Application configuration']),
              h(InfoBox, { style: { marginLeft: '0.5rem' } }, ['Currently, the Azure VM is pre-configured. ']),
            ]),
            p({}, ['Azure Data Science Virtual Machine']),
            div([
              h(
                Link,
                {
                  href: 'https://azure.microsoft.com/en-us/services/virtual-machines/data-science-virtual-machines/#product-overview',
                  ...Utils.newTabLinkProps,
                },
                ['Learn more about Azure Data Science VMs.', icon('pop-out', { size: 12, style: { marginLeft: '0.25rem' } })]
              ),
            ]),
          ]),
      ]),
    ]);
  };

  // Will be used once we support update
  // const hasChanges = () => {
  //   const existingConfig = adaptRuntimeDetailsToFormConfig()
  //
  //   return !_.isEqual(existingConfig, computeConfig)
  // }
  //
  // const adaptRuntimeDetailsToFormConfig = () => {
  //   return currentRuntimeDetails ? {
  //     machineType: currentRuntimeDetails.runtimeConfig?.machineType || defaultAzureMachineType,
  //     persistentDiskSize: currentRuntimeDetails.diskConfig?.size || defaultAzureDiskSize,
  //     region: currentRuntimeDetails.runtimeConfig?.region || defaultAzureRegion
  //   } : {}
  // }

  const doesRuntimeExist = () => !!currentRuntimeDetails;

  const renderActionButton = () => {
    const commonButtonProps = {
      tooltipSide: 'left',
      disabled: Utils.cond([loading, true], [viewMode === 'deleteEnvironment', () => getIsRuntimeBusy(currentRuntimeDetails)], () =>
        doesRuntimeExist()
      ),
      tooltip: Utils.cond(
        [loading, 'Loading cloud environments'],
        [viewMode === 'deleteEnvironment', () => (getIsRuntimeBusy(currentRuntimeDetails) ? 'Cannot delete a runtime while it is busy' : undefined)],
        [doesRuntimeExist(), () => 'Update not supported for azure runtimes'],
        () => undefined
      ),
    };

    return h(
      ButtonPrimary,
      {
        ...commonButtonProps,
        tooltip: persistentDiskExists && viewMode !== 'deleteEnvironment' ? 'Mount existing Persistent disk to a new Virtual Machine.' : undefined,
        onClick: () => applyChanges(),
      },
      [Utils.cond([viewMode === 'deleteEnvironment', () => 'Delete'], [doesRuntimeExist(), () => 'Update'], () => 'Create')]
    );
  };

  const sendCloudEnvironmentMetrics = () => {
    const metricsEvent = Utils.cond(
      [viewMode === 'deleteEnvironment', () => 'cloudEnvironmentDelete'],
      // TODO: IA-4163 -When update is available, include in metrics
      // [(!!existingRuntime), () => 'cloudEnvironmentUpdate'],
      () => 'cloudEnvironmentCreate'
    );

    // TODO: IA-4163 When update is available include existingRuntime in metrics.
    Ajax().Metrics.captureEvent(Events[metricsEvent], {
      ...extractWorkspaceDetails(workspace),
      ..._.mapKeys((key) => `desiredRuntime_${key}`, computeConfig),
      desiredRuntime_region: computeConfig.region,
      desiredRuntime_machineType: computeConfig.machineType,
      desiredPersistentDisk_size: computeConfig.persistentDiskSize,
      desiredPersistentDisk_type: 'Standard', // IA-4164 - Azure disks are currently only Standard (HDD), when we add types update this.
      desiredPersistentDisk_costPerMonth: getAzureDiskCostEstimate(computeConfig),
      desiredRuntime_gpuEnabled: machineTypeHasGpu(computeConfig.machineType),
      tool: runtimeToolLabels.JupyterLab,
      application: runtimeToolLabels.JupyterLab,
    });
  };

  // Helper functions -- begin
  const applyChanges = _.flow(
    Utils.withBusyState(setLoading),
    withErrorReportingInModal('Error modifying cloud environment', onError)
  )(async () => {
    sendCloudEnvironmentMetrics();

    // each branch of the cond should return a promise
    await Utils.cond(
      [
        viewMode === 'deleteEnvironment',
        () =>
          Utils.cond(
            [doesRuntimeExist(), () => Ajax().Runtimes.runtimeV2(workspaceId, currentRuntime.runtimeName).delete(deleteDiskSelected)], // delete runtime
            [!!persistentDiskExists, () => Ajax().Disks.disksV2().delete(currentPersistentDiskDetails.id)] // delete disk
          ),
      ],
      [
        Utils.DEFAULT,
        () => {
          const disk = {
            size: computeConfig.persistentDiskSize,
            name: generatePersistentDiskName(),
            labels: { saturnWorkspaceNamespace: namespace, saturnWorkspaceName: workspaceName },
          };

          return Ajax()
            .Runtimes.runtimeV2(workspaceId, generateRuntimeName())
            .create(
              {
                autopauseThreshold: computeConfig.autopauseThreshold,
                machineSize: computeConfig.machineType,
                labels: {
                  saturnWorkspaceNamespace: namespace,
                  saturnWorkspaceName: workspaceName,
                },
                disk,
              },
              persistentDiskExists
            );
        },
      ]
    );

    onSuccess();
  });

  const renderMainForm = () => {
    return h(Fragment, [
      div({ style: { padding: '1.5rem', borderBottom: `1px solid ${colors.dark(0.4)}` } }, [renderTitleAndTagline(), renderCostBreakdown()]),
      div({ style: { padding: '1.5rem', overflowY: 'auto', flex: 'auto' } }, [
        renderApplicationConfigurationSection(),
        div({ style: { ...computeStyles.whiteBoxContainer, marginTop: '1.5rem' } }, [
          h(AzureComputeProfileSelect, {
            machineType: computeConfig.machineType,
            style: { marginBottom: '1.5rem' },
            onChangeMachineType: (v) => updateComputeConfig('machineType', v),
          }),
          h(AutopauseConfiguration, {
            autopauseThreshold: computeConfig.autopauseThreshold,
            disabled: doesRuntimeExist(),
            style: { gridColumnEnd: 'span 6' },
            onChangeAutopauseThreshold: (v) => updateComputeConfig('autopauseThreshold', v),
          }),
        ]),
        h(AzurePersistentDiskSection, {
          persistentDiskExists,
          onClickAbout: () => {
            setViewMode('aboutPersistentDisk');
            Ajax().Metrics.captureEvent(Events.aboutPersistentDiskView, { cloudPlatform: cloudProviderTypes.AZURE });
          },
          persistentDiskSize: computeConfig.persistentDiskSize,
          persistentDiskType: computeConfig.persistentDiskType,
          onChangePersistentDiskSize: (v) => updateComputeConfig('persistentDiskSize', v),
          onChangePersistentDiskType: (v) => updateComputeConfig('persistentDiskType', v),
        }),
        renderBottomButtons(),
      ]),
    ]);
  };

  // TODO [IA-3348] parameterize and make it a shared function between the equivalent in GcpComputeModal
  const renderCostBreakdown = () => {
    return div(
      {
        style: {
          backgroundColor: colors.accent(0.2),
          display: 'flex',
          borderRadius: 5,
          padding: '0.5rem 1rem',
          marginTop: '1rem',
        },
      },
      [
        _.map(
          ({ cost, label, unitLabel }) => {
            return div({ key: label, style: { flex: 1, ...computeStyles.label } }, [
              div({ style: { fontSize: 10 } }, [label]),
              div({ style: { color: colors.accent(1.1), marginTop: '0.25rem' } }, [
                span({ style: { fontSize: 20 } }, [cost]),
                span([' ', unitLabel]),
              ]),
            ]);
          },
          [
            { label: 'Running cloud compute cost', cost: Utils.formatUSD(getAzureComputeCostEstimate(computeConfig)), unitLabel: 'per hr' },
            { label: 'Paused cloud compute cost', cost: Utils.formatUSD(0), unitLabel: 'per hr' }, // TODO: [IA-4105] update cost
            {
              label: 'Persistent disk cost',
              cost: Utils.formatUSD(getAzureDiskCostEstimate(computeConfig)),
              unitLabel: 'per month',
            },
          ]
        ),
      ]
    );
  };

  return h(Fragment, [
    Utils.switchCase(
      viewMode,
      ['aboutPersistentDisk', () => AboutPersistentDiskView({ titleId, setViewMode, onDismiss, tool })],
      [
        'deleteEnvironment',
        () =>
          DeleteEnvironment({
            id: titleId,
            runtimeConfig: currentRuntimeDetails && currentRuntimeDetails.runtimeConfig,
            persistentDiskId: currentPersistentDiskDetails?.id,
            persistentDiskCostDisplay: Utils.formatUSD(getAzureDiskCostEstimate(computeConfig)),
            deleteDiskSelected,
            setDeleteDiskSelected,
            setViewMode,
            renderActionButton,
            hideCloseButton: false,
            onDismiss,
            toolLabel: currentRuntimeDetails && currentRuntimeDetails.labels.tool,
          }),
      ],
      [Utils.DEFAULT, renderMainForm]
    ),
    loading && spinnerOverlay,
  ]);
};

export const AzureComputeModal = withModalDrawer({ width: 675, 'aria-labelledby': titleId })(AzureComputeModalBase);
