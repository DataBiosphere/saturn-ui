/**
 * Making changes to this file:
 * Prior to merging a PR that edits this file, be sure to run the analysis-context-bar.js test
 * by doing the following:
 * In analysis-context-bar.js, set: targetEnvironments: ['dev']
 * In the terminal:
 * $ cd integration-tests
 * $ yarn test-local analysis-context-bar
 */

import { Interactive } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { CSSProperties, Fragment, useState } from 'react';
import { br, div, h, img, span } from 'react-hyperscript-helpers';
import { CloudEnvironmentModal } from 'src/analysis/modals/CloudEnvironmentModal';
import { appLauncherTabName } from 'src/analysis/runtime-common-components';
import { doesWorkspaceSupportCromwellAppForUser, getCurrentApp } from 'src/analysis/utils/app-utils';
import {
  getCostDisplayForDisk,
  getCostDisplayForTool,
  getGalaxyComputeCost,
  getGalaxyDiskCost,
  getPersistentDiskCostHourly,
  getRuntimeCost,
} from 'src/analysis/utils/cost-utils';
import { getCurrentAppDataDisk, getCurrentPersistentDisk } from 'src/analysis/utils/disk-utils';
import { getCurrentRuntime } from 'src/analysis/utils/runtime-utils';
import {
  appToolLabels,
  appTools,
  isToolHidden,
  runtimeToolLabels,
  toolLabelDisplays,
} from 'src/analysis/utils/tool-utils';
import { Clickable } from 'src/components/common';
import { icon } from 'src/components/icons';
import { getRegionInfo } from 'src/components/region-common';
import TooltipTrigger from 'src/components/TooltipTrigger';
import cromwellImg from 'src/images/cromwell-logo.png'; // To be replaced by something square
import galaxyLogo from 'src/images/galaxy-project-logo-square.png';
import hailLogo from 'src/images/hail-logo.svg';
import jupyterLogo from 'src/images/jupyter-logo.svg';
import rstudioSquareLogo from 'src/images/rstudio-logo-square.png';
import { Ajax } from 'src/libs/ajax';
import { App } from 'src/libs/ajax/leonardo/models/app-models';
import { PersistentDisk } from 'src/libs/ajax/leonardo/models/disk-models';
import { Runtime } from 'src/libs/ajax/leonardo/models/runtime-models';
import colors from 'src/libs/colors';
import { withErrorReporting } from 'src/libs/error';
import Events from 'src/libs/events';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import * as Nav from 'src/libs/nav';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import {
  BaseWorkspace,
  getCloudProviderFromWorkspace,
  isAzureWorkspace,
  isGoogleWorkspace,
} from 'src/libs/workspace-utils';
import { StorageDetails } from 'src/pages/workspaces/workspace/useWorkspace';

const contextBarStyles: { [label: string]: CSSProperties } = {
  contextBarContainer: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  contextBarButton: {
    display: 'flex',
    justifyContent: 'center',
    width: 70,
    borderBottom: `1px solid ${colors.accent()}`,
    padding: '.75rem',
    height: 70,
    color: colors.accent(),
    backgroundColor: colors.accent(0.2),
  },
  hover: { backgroundColor: colors.accent(0.4) },
};

export interface ContextBarProps {
  runtimes: Runtime[];
  apps: App[];
  appDataDisks: PersistentDisk[];
  refreshRuntimes: (maybeStale?: boolean) => Promise<unknown>;
  storageDetails: StorageDetails;
  refreshApps: (maybeStale?: boolean) => Promise<unknown>;
  workspace: BaseWorkspace;
  persistentDisks: PersistentDisk[];
}

export const ContextBar = ({
  runtimes,
  apps,
  appDataDisks,
  refreshRuntimes,
  storageDetails,
  refreshApps,
  workspace,
  persistentDisks,
}: ContextBarProps) => {
  const [isCloudEnvOpen, setCloudEnvOpen] = useState(false);
  const [selectedToolIcon, setSelectedToolIcon] = useState(undefined);

  const { name, namespace } = workspace.workspace;
  const { azureContainerRegion, googleBucketLocation, googleBucketType } = storageDetails;

  const currentRuntime = getCurrentRuntime(runtimes);
  const currentRuntimeTool = currentRuntime?.labels?.tool;
  const isTerminalVisible =
    currentRuntimeTool === runtimeToolLabels.Jupyter && currentRuntime && currentRuntime.status !== 'Error';
  const terminalLaunchLink = Nav.getLink(appLauncherTabName, { namespace, name, application: 'terminal' });
  const canCompute = !!(workspace?.canCompute || runtimes?.length);
  const cloudProvider = getCloudProviderFromWorkspace(workspace);

  // Azure workspace containers' armRegionName can be used directly in cost-utils as the computeRegion
  const computeRegion = Utils.cond(
    [isGoogleWorkspace(workspace), () => getRegionInfo(googleBucketLocation, googleBucketType).computeRegion],
    [isAzureWorkspace(workspace), () => azureContainerRegion],
    () => {
      throw new Error('Unable to determine cloud provider for workspace');
    }
  )!;
  const location = Utils.cond(
    [isGoogleWorkspace(workspace), () => googleBucketLocation],
    [isAzureWorkspace(workspace), () => azureContainerRegion],
    () => {
      throw new Error('Unable to determine cloud provider for workspace');
    }
  )!;

  const getImgForTool = (toolLabel) =>
    Utils.switchCase(
      toolLabel,
      [runtimeToolLabels.Jupyter, () => img({ src: jupyterLogo, style: { height: 45, width: 45 }, alt: '' })],
      [appToolLabels.GALAXY, () => img({ src: galaxyLogo, style: { height: 40, width: 40 }, alt: '' })],
      [appToolLabels.CROMWELL, () => img({ src: cromwellImg, style: { width: 45 }, alt: '' })],
      [appToolLabels.HAIL_BATCH, () => img({ src: hailLogo, style: { height: 45, width: 45 }, alt: '' })],
      [runtimeToolLabels.RStudio, () => img({ src: rstudioSquareLogo, style: { height: 45, width: 45 }, alt: '' })],
      [runtimeToolLabels.JupyterLab, () => img({ src: jupyterLogo, style: { height: 45, width: 45 }, alt: '' })]
    );

  const getColorForStatus = (status) =>
    Utils.cond<string>(
      [_.upperCase(status) === 'RUNNING', () => colors.success()],
      [_.upperCase(status) === 'ERROR', () => colors.danger()],
      [_.includes('ING', _.upperCase(status)), () => colors.accent()],
      [Utils.DEFAULT, () => colors.warning()]
    );

  const currentApp = (toolLabel) => getCurrentApp(toolLabel, apps);

  const getIconForTool = (toolLabel, status) => {
    const app = currentApp(toolLabel);
    return h(
      Clickable,
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          ...contextBarStyles.contextBarButton,
          borderBottom: '0px',
        },
        hover: contextBarStyles.hover,
        onClick: () => {
          setSelectedToolIcon(toolLabel);
          setCloudEnvOpen(true);
        },
        tooltipSide: 'left',
        tooltip: div([
          div({ style: { fontWeight: 'bold' } }, [`${toolLabelDisplays[toolLabel]} Environment`]),
          div([getCostDisplayForTool(app, currentRuntime, currentRuntimeTool, toolLabel)]),
          div([
            getCostDisplayForDisk(
              app,
              appDataDisks,
              computeRegion,
              currentRuntimeTool,
              persistentDisks,
              runtimes,
              toolLabel
            ),
          ]),
        ]),
        tooltipDelay: 100,
        useTooltipAsLabel: true,
      },
      [
        div({ style: { display: 'flex', justifyContent: 'center', alignItems: 'center' } }, [getImgForTool(toolLabel)]),
        div({ style: { justifyContent: 'flex-end', display: 'flex', color: getColorForStatus(status) } }, [
          icon('circle', { style: { border: '1px solid white', borderRadius: '50%' }, size: 12 }),
        ]),
      ]
    );
  };

  const getEnvironmentStatusIcons = () => {
    const galaxyApp = getCurrentApp(appTools.GALAXY.label, apps);
    const cromwellAppObject = getCurrentApp(appTools.CROMWELL.label, apps);

    const cromwellApp =
      !isToolHidden(appTools.CROMWELL.label, cloudProvider) &&
      cromwellAppObject &&
      doesWorkspaceSupportCromwellAppForUser(workspace?.workspace, cloudProvider, appTools.CROMWELL.label);

    const hailBatchAppObject = getCurrentApp(appTools.HAIL_BATCH.label, apps);
    const hailBatchApp = !isToolHidden(appTools.HAIL_BATCH.label, cloudProvider) && hailBatchAppObject;
    return h(Fragment, [
      ...(currentRuntime ? [getIconForTool(currentRuntimeTool, currentRuntime.status)] : []),
      ...(galaxyApp ? [getIconForTool(appToolLabels.GALAXY, galaxyApp.status)] : []),
      ...(cromwellApp ? [getIconForTool(appToolLabels.CROMWELL, cromwellAppObject.status)] : []),
      ...(hailBatchApp ? [getIconForTool(appToolLabels.HAIL_BATCH, hailBatchApp.status)] : []),
    ]);
  };

  // This excludes cromwellapp and hailBatchApp in the calculation.
  const getTotalToolAndDiskCostDisplay = () => {
    const galaxyApp = getCurrentApp(appTools.GALAXY.label, apps);
    const galaxyDisk = getCurrentAppDataDisk(appTools.GALAXY.label, apps, appDataDisks, name);
    const galaxyRuntimeCost = galaxyApp ? getGalaxyComputeCost(galaxyApp) : 0;
    const galaxyDiskCost = galaxyDisk ? getGalaxyDiskCost(galaxyDisk) : 0;
    const runtimeCost = currentRuntime ? getRuntimeCost(currentRuntime) : 0;
    const curPd = getCurrentPersistentDisk(runtimes, persistentDisks);
    const diskCost = curPd ? getPersistentDiskCostHourly(curPd, computeRegion) : 0;
    const display = Utils.formatUSD(galaxyRuntimeCost + galaxyDiskCost + runtimeCost + diskCost);
    return display;
  };

  return h(Fragment, [
    h(CloudEnvironmentModal, {
      isOpen: isCloudEnvOpen,
      filterForTool: selectedToolIcon,
      onSuccess: async () => {
        setCloudEnvOpen(false);
        setSelectedToolIcon(undefined);
        await refreshRuntimes(true);
        await refreshApps(true);
      },
      onDismiss: async () => {
        setCloudEnvOpen(false);
        setSelectedToolIcon(undefined);
        await refreshRuntimes(true);
        await refreshApps(true);
      },
      runtimes,
      apps,
      appDataDisks,
      refreshRuntimes,
      refreshApps,
      workspace,
      canCompute,
      persistentDisks,
      location,
      computeRegion,
    }),
    div({ style: { ...Style.elements.contextBarContainer, width: 70 } }, [
      div({ style: contextBarStyles.contextBarContainer }, [
        h(Fragment, [
          h(
            TooltipTrigger,
            {
              side: 'left',
              delay: 100,
              content: [
                div({ key: 'p1' }, [
                  'Estimated hourly rate for all applications in a running or paused state, and associated persistent disks. For details, click',
                  icon('cloudBolt', {
                    'aria-label': 'Environment Configuration Icon',
                    size: 20,
                    style: { margin: '0 5px', verticalAlign: 'text-bottom' },
                  }),
                  'below.',
                ]),
                br({ key: 'br' }),
                div({ key: 'p2' }, ['Workflow and workspace storage costs\nare not included.']),
              ],
            },
            [
              h(
                Interactive,
                {
                  tagName: 'div',
                  style: {
                    flexDirection: 'column',
                    justifyContent: 'center',
                    ...contextBarStyles.contextBarButton,
                    padding: '0',
                    borderBottom: '0px',
                    cursor: 'default',
                  },
                  hover: { ...contextBarStyles.hover },
                },
                [
                  div({ style: { textAlign: 'center', color: colors.dark(), fontSize: 12 } }, ['Rate:']),
                  div(
                    {
                      style: {
                        textAlign: 'center',
                        color: colors.dark(),
                        fontWeight: 'bold',
                        fontSize: 16,
                      },
                    },
                    [getTotalToolAndDiskCostDisplay(), span({ style: { fontWeight: 'normal' } })]
                  ),
                  div({ style: { textAlign: 'center', color: colors.dark(), fontSize: 12 } }, ['per hour']),
                ]
              ),
            ]
          ),
          h(
            Clickable,
            {
              style: {
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '.75rem',
                ...contextBarStyles.contextBarButton,
                borderBottom: '0px',
              },
              hover: contextBarStyles.hover,
              tooltipSide: 'left',
              onClick: () => setCloudEnvOpen(true),
              tooltip: 'Environment Configuration',
              tooltipDelay: 100,
              useTooltipAsLabel: true,
            },
            [icon('cloudBolt', { size: 40 })]
          ),
          getEnvironmentStatusIcons(),
        ]),
        isTerminalVisible &&
          h(
            Clickable,
            {
              style: {
                borderTop: `1px solid ${colors.accent()}`,
                paddingLeft: '1rem',
                alignItems: 'center',
                ...contextBarStyles.contextBarButton,
                color: !isTerminalVisible ? colors.dark(0.7) : contextBarStyles.contextBarButton.color,
              },
              hover: contextBarStyles.hover,
              'data-testid': 'terminal-button-id',
              tooltipSide: 'left',
              href: terminalLaunchLink,
              onClick: withErrorReporting('Error starting runtime', async () => {
                await Ajax().Metrics.captureEvent(Events.analysisLaunch, {
                  origin: 'contextBar',
                  application: 'terminal',
                  workspaceName: name,
                  namespace,
                });
                if (currentRuntime?.status === 'Stopped') {
                  await Ajax().Runtimes.runtimeWrapper(currentRuntime).start();
                }
              }),
              tooltip: 'Terminal',
              tooltipDelay: 100,
              useTooltipAsLabel: false,
              ...Utils.newTabLinkProps,
            },
            [icon('terminal', { size: 40 }), span({ className: 'sr-only' }, ['Terminal button'])]
          ),
        (isAzureWorkspace(workspace) || isFeaturePreviewEnabled('workspace-files')) &&
          h(
            Clickable,
            {
              style: { paddingLeft: '1rem', alignItems: 'center', ...contextBarStyles.contextBarButton },
              hover: contextBarStyles.hover,
              tooltipSide: 'left',
              href: Nav.getLink('workspace-files', { namespace, name }),
              tooltip: 'Browse workspace files',
              tooltipDelay: 100,
              useTooltipAsLabel: false,
            },
            [icon('folderSolid', { size: 40 }), span({ className: 'sr-only' }, ['Workspace files'])]
          ),
      ]),
    ]),
  ]);
};
