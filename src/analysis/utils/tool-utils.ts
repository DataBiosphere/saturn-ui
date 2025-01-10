import _ from 'lodash/fp';
import { code } from 'react-hyperscript-helpers';
import { FileExtension, getExtension } from 'src/analysis/utils/file-utils';
import { App } from 'src/libs/ajax/leonardo/models/app-models';
import { isRuntime, Runtime } from 'src/libs/ajax/leonardo/models/runtime-models';
import { isCromwellAppVisible } from 'src/libs/config';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import * as Utils from 'src/libs/utils';
import { CloudProvider, cloudProviderTypes } from 'src/workspaces/utils';

export type RuntimeToolLabel = 'Jupyter' | 'RStudio' | 'JupyterLab';
export type AppToolLabel = 'GALAXY' | 'CROMWELL' | 'HAIL_BATCH' | 'WDS' | 'WORKFLOWS_APP' | 'CROMWELL_RUNNER_APP';
export type CromwellAppToolLabel = 'CROMWELL' | 'WORKFLOWS_APP' | 'CROMWELL_RUNNER_APP';
export type AppAccessScope = 'USER_PRIVATE' | 'WORKSPACE_SHARED';
export type LaunchableToolLabel = 'spark' | 'terminal' | 'RStudio' | 'JupyterLab';
export type ToolLabel = RuntimeToolLabel | AppToolLabel;

export const launchableToolLabel: Record<LaunchableToolLabel, LaunchableToolLabel> = {
  RStudio: 'RStudio',
  JupyterLab: 'JupyterLab',
  terminal: 'terminal',
  spark: 'spark',
};

export const runtimeToolLabels = {
  Jupyter: 'Jupyter',
  RStudio: 'RStudio',
  JupyterLab: 'JupyterLab',
} as const satisfies Record<RuntimeToolLabel, RuntimeToolLabel>;

export const toolLabelDisplays: Record<ToolLabel, string> = {
  Jupyter: 'Jupyter',
  RStudio: 'RStudio',
  JupyterLab: 'JupyterLab',
  GALAXY: 'Galaxy',
  CROMWELL: 'Cromwell',
  WORKFLOWS_APP: 'Workflows',
  CROMWELL_RUNNER_APP: 'Cromwell runner',
  HAIL_BATCH: 'Hail Batch',
  WDS: 'Workspace Data Service',
};

export const appToolLabels: Record<AppToolLabel, AppToolLabel> = {
  GALAXY: 'GALAXY',
  CROMWELL: 'CROMWELL',
  WORKFLOWS_APP: 'WORKFLOWS_APP',
  CROMWELL_RUNNER_APP: 'CROMWELL_RUNNER_APP',
  HAIL_BATCH: 'HAIL_BATCH',
  WDS: 'WDS',
};

export const cromwellAppToolLabels: Record<CromwellAppToolLabel, CromwellAppToolLabel> = {
  CROMWELL: 'CROMWELL',
  WORKFLOWS_APP: 'WORKFLOWS_APP',
  CROMWELL_RUNNER_APP: 'CROMWELL_RUNNER_APP',
};

export const appAccessScopes: Record<AppAccessScope, AppAccessScope> = {
  USER_PRIVATE: 'USER_PRIVATE',
  WORKSPACE_SHARED: 'WORKSPACE_SHARED',
};

export const isAppToolLabel = (x: ToolLabel): x is AppToolLabel => x in appToolLabels;

export const isRuntimeToolLabel = (x: ToolLabel): x is RuntimeToolLabel => x in runtimeToolLabels;

export const isToolLabel = (x: ToolLabel | string): x is ToolLabel => x in appToolLabels || x in runtimeToolLabels;

export interface BaseTool {
  isLaunchUnsupported?: boolean;
  isPauseUnsupported?: boolean;
}

export interface RuntimeTool extends BaseTool {
  label: RuntimeToolLabel;
  ext: FileExtension[];
  imageIds: string[];
  defaultImageId: string;
  defaultExt: FileExtension;
}

export interface AppTool extends BaseTool {
  label: AppToolLabel; // Alias for appType
}

export type Tool = AppTool | RuntimeTool;

export const terraSupportedRuntimeImageIds: string[] = [
  'terra-jupyter-bioconductor',
  'terra-jupyter-hail',
  'terra-jupyter-python',
  'terra-jupyter-gatk',
  'RStudio',
];

const RStudio: RuntimeTool = {
  label: runtimeToolLabels.RStudio,
  ext: ['Rmd', 'R'] as FileExtension[],
  imageIds: ['RStudio'],
  defaultImageId: 'RStudio',
  defaultExt: 'Rmd' as FileExtension,
};

const Jupyter: RuntimeTool = {
  label: runtimeToolLabels.Jupyter,
  ext: ['ipynb' as FileExtension],
  imageIds: [
    'terra-jupyter-bioconductor',
    'terra-jupyter-bioconductor_legacy',
    'terra-jupyter-hail',
    'terra-jupyter-python',
    'terra-jupyter-gatk',
    'Pegasus',
    'terra-jupyter-gatk_legacy',
  ],
  defaultImageId: 'terra-jupyter-gatk',
  isLaunchUnsupported: true,
  defaultExt: 'ipynb' as FileExtension,
};

const JupyterLab: RuntimeTool = {
  label: runtimeToolLabels.JupyterLab,
  ext: ['ipynb' as FileExtension],
  isLaunchUnsupported: false,
  defaultExt: 'ipynb' as FileExtension,
  imageIds: [],
  defaultImageId: '',
};

// TODO: Reenable pause for Galaxy once https://broadworkbench.atlassian.net/browse/PROD-905 is resolved
const Galaxy = { label: 'GALAXY', isPauseUnsupported: true } as const satisfies AppTool;

const Cromwell = { label: 'CROMWELL', isPauseUnsupported: true } as const satisfies AppTool;

const Workflows = { label: 'WORKFLOWS_APP', isPauseUnsupported: true } as const satisfies AppTool;

const CromwellRunner = { label: 'CROMWELL_RUNNER_APP', isPauseUnsupported: true } as const satisfies AppTool;

const HailBatch = { label: 'HAIL_BATCH', isPauseUnsupported: true } as const satisfies AppTool;

const Wds = { label: 'WDS', isPauseUnsupported: true } as const satisfies AppTool;

export const appTools: Record<AppToolLabel, AppTool> = {
  GALAXY: Galaxy,
  CROMWELL: Cromwell,
  WORKFLOWS_APP: Workflows,
  CROMWELL_RUNNER_APP: CromwellRunner,
  HAIL_BATCH: HailBatch,
  WDS: Wds,
};

export const runtimeTools: Record<RuntimeToolLabel, RuntimeTool> = {
  RStudio,
  Jupyter,
  // azure should be changed in backend to be a same as jupyter
  // we should use analysis file's cloud provider to determine azure/other logic for jupyter
  JupyterLab,
};

export const tools: Record<ToolLabel, AppTool | RuntimeTool> = {
  ...runtimeTools,
  ...appTools,
};

// The order of the array is important, it decides the order in AnalysisModal.
export const cloudRuntimeTools = {
  GCP: [Jupyter, RStudio],
  AZURE: [JupyterLab],
} as const satisfies Record<CloudProvider, readonly RuntimeTool[]>;

export const cloudAppTools = {
  GCP: [Galaxy, Cromwell],
  AZURE: [Cromwell, HailBatch],
} as const satisfies Record<CloudProvider, readonly AppTool[]>;

export interface ExtensionDisplay {
  label: string;
  value: FileExtension;
}

export const toolExtensionDisplay: Partial<Record<ToolLabel, ExtensionDisplay[]>> = {
  RStudio: [
    { label: 'R Markdown (.Rmd)', value: 'Rmd' as FileExtension },
    { label: 'R Script (.R)', value: 'R' as FileExtension },
  ],
  Jupyter: [{ label: 'IPython Notebook (.ipynb)', value: 'ipynb' as FileExtension }],
};
export const getPatternFromRuntimeTool = (toolLabel: RuntimeToolLabel): string => {
  const patterns: Record<RuntimeToolLabel, string> = {
    // Adding suffixes to conda, pip, and poetry environments (only conda supports R)
    [runtimeToolLabels.RStudio]: '.+(\\.R|\\.Rmd|\\.yml)$',
    [runtimeToolLabels.Jupyter]: '.+(\\.ipynb|\\.yml|\\.txt|\\.lock|\\.toml)$',
    [runtimeToolLabels.JupyterLab]: '.+(\\.ipynb|\\.yml|\\.txt|\\.lock|\\.toml)$',
  };
  return patterns[toolLabel];
};

export const getToolsToDisplayForCloudProvider = (cloudProvider: CloudProvider): readonly Tool[] =>
  _.remove((tool: Tool) => isToolHidden(tool.label, cloudProvider))(
    (cloudRuntimeTools[cloudProvider] as readonly Tool[]).concat(cloudAppTools[cloudProvider] as readonly Tool[])
  );

export const toolToExtensionMap: Record<ToolLabel, FileExtension> = _.flow(
  _.filter('ext'),
  _.map((tool: RuntimeTool) => ({ [tool.label]: tool.ext })),
  _.reduce(_.merge, {})
)(runtimeTools);

export type AnalysisFileExtension = 'Rmd' | 'R' | 'ipynb';
const extensionToToolMap: Record<AnalysisFileExtension, ToolLabel> = {
  Rmd: runtimeTools.RStudio.label,
  R: runtimeTools.RStudio.label,
  ipynb: runtimeTools.Jupyter.label,
};

export const getToolLabelForImage = (imageId: string): ToolLabel | undefined => {
  const isImageInTool = (runtimeTool) => runtimeTool.imageIds.includes(imageId);
  return _.find(isImageInTool, runtimeTools)?.label;
};

// Currently, a lot of consumers of this are not typescript, so we defensively use `getExtension` on the input
// TODO: Once all consumer are in typescript, we can remove `getExtension` from this function
export const getToolLabelFromFileExtension = (fileName: FileExtension): ToolLabel =>
  extensionToToolMap[getExtension(fileName)];

export const getToolLabelFromRuntime = (cloudEnv: Runtime): RuntimeToolLabel =>
  cloudEnv?.labels?.tool as RuntimeToolLabel;
export const getToolLabelFromApp = (cloudEnv: App): ToolLabel => cloudEnv?.appType as ToolLabel;

export const getToolLabelFromCloudEnv = (cloudEnv: Runtime | App): ToolLabel => {
  if (isRuntime(cloudEnv)) return getToolLabelFromRuntime(cloudEnv);
  return getToolLabelFromApp(cloudEnv);
};

// Returns registered appTypes.
export const allAppTypes: AppToolLabel[] = _.flow(_.map('label'), _.compact)(appTools);

export const isPauseSupported = (toolLabel: ToolLabel): boolean =>
  !_.find((tool: AppTool | RuntimeTool) => tool.label === toolLabel)(tools)?.isPauseUnsupported;

export const isToolHidden = (toolLabel: ToolLabel, cloudProvider: CloudProvider): boolean =>
  Utils.cond(
    [
      toolLabel === appToolLabels.CROMWELL,
      () =>
        Utils.cond(
          [cloudProvider === cloudProviderTypes.GCP, () => !isCromwellAppVisible()],
          [
            cloudProvider === cloudProviderTypes.AZURE,
            () => {
              return true;
            },
          ],
          [Utils.DEFAULT, () => false]
        ),
    ],
    [
      toolLabel === appToolLabels.HAIL_BATCH &&
        (cloudProvider === cloudProviderTypes.GCP || !isFeaturePreviewEnabled('hail-batch-azure')),
      () => true,
    ],
    [Utils.DEFAULT, () => false]
  );

export type MountPoint = '/home/rstudio' | '/home/jupyter' | '/home/jupyter/persistent_disk';

export const mountPoints: Record<RuntimeToolLabel, MountPoint> = {
  RStudio: '/home/rstudio',
  Jupyter: '/home/jupyter',
  JupyterLab: '/home/jupyter/persistent_disk',
};

export const getMountDir = (toolLabel: RuntimeToolLabel): MountPoint => {
  if (toolLabel === runtimeToolLabels.RStudio) return mountPoints.RStudio;
  if (toolLabel === runtimeToolLabels.Jupyter) return mountPoints.Jupyter;
  return mountPoints.JupyterLab;
};

export const getCurrentMountDirectory = (toolLabel: RuntimeToolLabel) => {
  const boldCode = function (label: RuntimeToolLabel) {
    const mydir = getMountDir(label);
    return code({ style: { fontWeight: 600 } }, [`${mydir}`]);
  };
  const defaultMsg = [
    boldCode(runtimeToolLabels.Jupyter),
    ' for Jupyter environments and ',
    boldCode(runtimeToolLabels.RStudio),
    ' for RStudio environments',
  ];
  return typeof toolLabel === 'string' ? [boldCode(toolLabel)] : defaultMsg; // TODO: remove string check IA-4091
};
