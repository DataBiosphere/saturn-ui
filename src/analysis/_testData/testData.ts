import _ from 'lodash/fp';
import {
  defaultGceBootDiskSize,
  defaultGcePersistentDiskSize,
  defaultPersistentDiskType,
} from 'src/analysis/utils/disk-utils';
import { defaultGceMachineType, defaultLocation, generateRuntimeName } from 'src/analysis/utils/runtime-utils';
import { runtimeToolLabels, tools } from 'src/analysis/utils/tool-utils';
import {App, AppError, GetAppResponse, ListAppResponse} from 'src/libs/ajax/leonardo/models/app-models';
import { PersistentDisk } from 'src/libs/ajax/leonardo/models/disk-models';
import {
  AzureConfig,
  cloudServiceTypes,
  GceWithPdConfig,
  RuntimeConfig,
} from 'src/libs/ajax/leonardo/models/runtime-config-models';
import { GetRuntimeItem, ListRuntimeItem, runtimeStatuses } from 'src/libs/ajax/leonardo/models/runtime-models';
import { defaultAzureRegion } from 'src/libs/azure-utils';
import * as Utils from 'src/libs/utils';
import { AzureWorkspace, cloudProviderTypes, GoogleWorkspace } from 'src/libs/workspace-utils';
import { defaultAzureWorkspace, defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';
import { v4 as uuid } from 'uuid';

// this is important, so the test impl can diverge
export const testDefaultLocation = defaultLocation;

export const testAzureDefaultRegion = defaultAzureRegion;

export const defaultImage = {
  id: 'terra-jupyter-gatk',
  image: 'us.gcr.io/broad-dsp-gcr-public/terra-jupyter-gatk:2.2.8',
  label: 'Default: (GATK 4.2.4.0, Python 3.7.12, R 4.2.1)',
  packages: 'https://storage.googleapis.com/terra-docker-image-documentation/terra-jupyter-gatk-2.2.8-versions.json',
  requiresSpark: false,
  updated: '2022-08-09',
  version: '2.2.8',
};

export const defaultRImage = {
  id: 'RStudio',
  image: 'us.gcr.io/broad-dsp-gcr-public/anvil-rstudio-bioconductor:3.15.2',
  isRStudio: true,
  label: 'RStudio (R 4.2.0, Bioconductor 3.15, Python 3.8.10)',
  packages: 'https://storage.googleapis.com/terra-docker-image-documentation/placeholder.json',
  requiresSpark: false,
  updated: '2022-05-09',
  version: '3.15.2',
};

export const hailImage = {
  id: 'terra-jupyter-hail',
  image: 'us.gcr.io/broad-dsp-gcr-public/terra-jupyter-hail:1.0.20',
  label: 'Hail: (Python 3.7.12, Spark 2.4.5, hail 0.2.98)',
  packages: 'https://storage.googleapis.com/terra-docker-image-documentation/terra-jupyter-hail-1.0.20-versions.json',
  requiresSpark: true,
  updated: '2022-08-25',
  version: '1.0.20',
};

export const pegasusImage = {
  id: 'Pegasus',
  image: 'cumulusprod/pegasus-terra:1.6.0',
  isCommunity: true,
  label: 'Pegasus (Pegasuspy 1.6.0, Python 3.7.12, harmony-pytorch 0.1.7, nmf-torch 0.1.1, scVI-tools 0.16.0)',
  packages:
    'https://raw.githubusercontent.com/lilab-bcb/cumulus/master/docker/pegasus-terra/1.6.0/pegasus-terra-1_6_0-versions.json',
  requiresSpark: false,
  updated: '2022-04-16',
  version: '1.6.0',
};

export const imageDocs = [
  defaultImage,
  {
    id: 'terra-jupyter-bioconductor',
    image: 'us.gcr.io/broad-dsp-gcr-public/terra-jupyter-bioconductor:2.1.7',
    label: 'R / Bioconductor: (Python 3.7.12, R 4.2.1, Bioconductor 3.15, tidyverse 1.3.2)',
    packages:
      'https://storage.googleapis.com/terra-docker-image-documentation/terra-jupyter-bioconductor-2.1.7-versions.json',
    requiresSpark: false,
    updated: '2022-08-08',
    version: '2.1.7',
  },
  hailImage,
  {
    id: 'terra-jupyter-python',
    image: 'us.gcr.io/broad-dsp-gcr-public/terra-jupyter-python:1.0.13',
    label: 'Python: (Python 3.7.12, pandas 1.3.5, scikit-learn 1.0.2)',
    packages:
      'https://storage.googleapis.com/terra-docker-image-documentation/terra-jupyter-python-1.0.13-versions.json',
    requiresSpark: false,
    updated: '2022-08-18',
    version: '1.0.13',
  },
  pegasusImage,
  defaultRImage,
  {
    id: 'OpenVINO integration with Tensorflow',
    image: 'us.gcr.io/broad-dsp-gcr-public/terra-jupyter-gatk-ovtf:0.1.7',
    isCommunity: true,
    label: 'OpenVINO integration with Tensorflow (openvino-tensorflow 1.1.0, Python 3.7.12, GATK 4.2.4.1)',
    packages:
      'https://storage.googleapis.com/terra-docker-image-documentation/terra-jupyter-gatk-ovtf-0.1.7-versions.json',
    requiresSpark: false,
    updated: '2022-01-31',
    version: '0.2.0',
  },
  {
    id: 'terra-jupyter-gatk_legacy',
    image: 'us.gcr.io/broad-dsp-gcr-public/terra-jupyter-gatk:2.0.9',
    label: 'Legacy GATK: (GATK 4.2.4.0, Python 3.7.12, R 4.1.3)',
    packages: 'https://storage.googleapis.com/terra-docker-image-documentation/terra-jupyter-gatk-2.0.9-versions.json',
    requiresSpark: false,
    updated: '2022-04-25',
    version: '2.0.9',
  },
  {
    id: 'terra-jupyter-bioconductor_legacy',
    image: 'us.gcr.io/broad-dsp-gcr-public/terra-jupyter-bioconductor:2.1.3',
    label: 'Legacy R / Bioconductor: (Python 3.7.12, R 4.1.3, Bioconductor 3.14, tidyverse 1.3.1)',
    packages:
      'https://storage.googleapis.com/terra-docker-image-documentation/terra-jupyter-bioconductor-2.1.3-versions.json',
    requiresSpark: false,
    updated: '2022-05-31',
    version: '2.1.3',
  },
];

export const generateGoogleWorkspace = (prefix: string = uuid().substring(0, 8)): GoogleWorkspace => ({
  workspace: {
    authorizationDomain: [],
    cloudPlatform: 'Gcp',
    bucketName: 'test-bucket',
    googleProject: `${prefix}-project`,
    name: `${prefix}_ws`,
    namespace: prefix,
    workspaceId: uuid().substring(0, 8),
    createdDate: '2023-02-15T19:17:15.711Z',
    createdBy: 'justin@gmail.com',
    lastModified: '2023-03-15T19:17:15.711Z',
  },
  accessLevel: 'OWNER',
  canShare: true,
  canCompute: true,
});

export const generateAzureWorkspace = (prefix: string = uuid().substring(0, 8)): AzureWorkspace => ({
  workspace: {
    authorizationDomain: [],
    cloudPlatform: 'Azure',
    name: `${prefix}-azure-ws-name`,
    namespace: `${prefix}-azure-ws-namespace`,
    workspaceId: uuid().substring(0, 8),
    createdDate: '2023-02-15T19:17:15.711Z',
    createdBy: 'groot@gmail.com',
    lastModified: '2023-03-15T19:17:15.711Z',
  },
  azureContext: {
    managedResourceGroupId: 'test-mrg',
    subscriptionId: 'test-sub-id',
    tenantId: 'test-tenant-id',
  },
  accessLevel: 'OWNER',
  canShare: true,
  canCompute: true,
});

export const defaultTestDisk = {
  id: 15778,
  googleProject: defaultGoogleWorkspace.workspace.googleProject,
  cloudContext: {
    cloudProvider: 'GCP',
    cloudResource: defaultGoogleWorkspace.workspace.googleProject,
  },
  zone: 'us-central1-a',
  name: 'saturn-pd-c4aea6ef-5618-47d3-b674-5d456c9dcf4f',
  status: 'Ready',
  auditInfo: {
    creator: 'testuser123@broad.com',
    createdDate: '2022-07-18T18:35:32.012698Z',
    destroyedDate: null,
    dateAccessed: '2022-07-18T20:34:56.092Z',
  },
  size: defaultGcePersistentDiskSize,
  diskType: defaultPersistentDiskType,
  blockSize: 4096,
};

export const getDisk = ({ size = defaultGcePersistentDiskSize } = {}) => ({
  ...defaultTestDisk,
  id: getRandomInt(10000),
  size,
});

export const getAzureDisk = ({ size = defaultGcePersistentDiskSize } = {}) => ({
  ...azureDisk,
  id: getRandomInt(10000),
  size,
});

export const defaultWorkspaceLabels = {
  saturnWorkspaceNamespace: defaultGoogleWorkspace.workspace.namespace,
  saturnWorkspaceName: defaultGoogleWorkspace.workspace.name,
};

const randomMaxInt = 10000;
export const getJupyterRuntimeConfig = ({
  diskId = getRandomInt(randomMaxInt),
  machineType = defaultGceMachineType,
} = {}) => ({
  machineType,
  persistentDiskId: diskId,
  cloudService: cloudServiceTypes.GCE,
  bootDiskSize: defaultGceBootDiskSize,
  zone: 'us-central1-a',
  gpuConfig: undefined,
});

export const getRandomInt = (max) => Math.floor(Math.random() * max);

export const defaultAuditInfo = {
  creator: 'testuser123@broad.com',
  createdDate: '2022-07-18T18:35:32.012698Z',
  destroyedDate: null,
  dateAccessed: '2022-07-18T21:44:17.565Z',
};

export const generateGoogleProject = () => `terra-test-${uuid().substring(0, 8)}`;

export const getRuntimeConfig = (overrides: Partial<RuntimeConfig> = {}): RuntimeConfig =>
  ({
    machineType: defaultGceMachineType,
    persistentDiskId: getRandomInt(randomMaxInt),
    cloudService: cloudServiceTypes.GCE,
    bootDiskSize: defaultGceBootDiskSize,
    zone: 'us-central1-a',
    gpuConfig: undefined,
    ...overrides,
  } satisfies GceWithPdConfig);

export const appError: AppError = {
  action: '',
  source: '',
  errorMessage: 'test error message',
  timestamp: '2022-09-19T15:37:11.035465Z',
  googleErrorCode: null,
  traceId: null,
};

// Use this if you only need to override top-level fields, otherwise use `getGoogleRuntime`
export const generateTestGetGoogleRuntime = (overrides: Partial<GetRuntimeItem> = {}): GetRuntimeItem => {
  const runtime: GetRuntimeItem = {
    id: getRandomInt(randomMaxInt),
    runtimeName: 'test-runtime',
    cloudContext: {
      cloudProvider: cloudProviderTypes.GCP,
      cloudResource: defaultGoogleWorkspace.workspace.googleProject,
    },
    googleProject: 'terra-test-e4000484',
    serviceAccount: 'testuser123@broad.com',
    auditInfo: defaultAuditInfo,
    runtimeConfig: getRuntimeConfig(),
    proxyUrl: 'https://leonardo.dsde-dev.broadinstitute.org/proxy/terra-test-e4000484/test-runtime/jupyter',
    status: runtimeStatuses.running.leoLabel,
    labels: {
      ...defaultWorkspaceLabels,
      'saturn-iframe-extension': 'https://bvdp-saturn-dev.appspot.com/jupyter-iframe-extension.js',
      creator: 'testuser123@broad.com',
      clusterServiceAccount: 'pet-26534176105071279add1@terra-dev-cf677740.iam.gserviceaccount.com',
      saturnAutoCreated: 'true',
      clusterName: 'test-runtime',
      saturnVersion: '6',
      tool: runtimeToolLabels.Jupyter,
      runtimeName: 'test-runtime',
      cloudContext: 'Gcp/terra-test-e4000484',
      googleProject: 'terra-test-e4000484',
    },
    errors: [],
    autopauseThreshold: 30,
    runtimeImages: [
      {
        imageType: 'Proxy',
        imageUrl: 'broadinstitute/openidc-proxy:2.3.1_2',
        timestamp: '2022-09-19T15:37:11.035465Z',
      },
      {
        imageType: tools.Jupyter.label,
        imageUrl: 'us.gcr.io/broad-dsp-gcr-public/jupyter-server:ef956b2', // fake uri
        timestamp: '2022-09-19T15:37:11.035465Z',
      },
      {
        imageType: 'Welder',
        imageUrl: 'us.gcr.io/broad-dsp-gcr-public/welder-server:ef956b2',
        timestamp: '2022-09-19T15:37:11.035465Z',
      },
      {
        imageType: 'BootSource',
        imageUrl: 'projects/broad-dsp-gcr-public/global/images/nl-825-2-gce-cos-image-e06f7d9',
        timestamp: '2022-09-19T15:37:12.119Z',
      },
      {
        imageType: 'CryptoDetector',
        imageUrl: 'us.gcr.io/broad-dsp-gcr-public/cryptomining-detector:0.0.2',
        timestamp: '2022-09-19T15:37:11.035465Z',
      },
    ],
    scopes: [],
    customEnvironmentVariables: {},
    patchInProgress: false,
    asyncRuntimeFields: null,
    userScriptUri: null,
    startUserScriptUri: null,
    jupyterUserScriptUri: null,
    jupyterStartUserScriptUri: null,
    userJupyterExtensionConfig: null,
    defaultClientId: null,
    diskConfig: null,
    ...overrides,
  };

  return runtime;
};

// Use this if you only need to override top-level fields, otherwise use `listGoogleRuntime`
export const generateTestListGoogleRuntime = (overrides: Partial<ListRuntimeItem> = {}): ListRuntimeItem => {
  const runtime: ListRuntimeItem = {
    id: getRandomInt(randomMaxInt),
    workspaceId: null,
    runtimeName: 'test-runtime',
    cloudContext: {
      cloudProvider: cloudProviderTypes.GCP,
      cloudResource: defaultGoogleWorkspace.workspace.googleProject,
    },
    googleProject: 'terra-test-e4000484',
    auditInfo: defaultAuditInfo,
    runtimeConfig: getRuntimeConfig(),
    proxyUrl: 'https://leonardo.dsde-dev.broadinstitute.org/proxy/terra-test-e4000484/test-runtime/jupyter',
    status: runtimeStatuses.running.leoLabel,
    labels: {
      ...defaultWorkspaceLabels,
      'saturn-iframe-extension': 'https://bvdp-saturn-dev.appspot.com/jupyter-iframe-extension.js',
      creator: 'testuser123@broad.com',
      clusterServiceAccount: 'pet-26534176105071279add1@terra-dev-cf677740.iam.gserviceaccount.com',
      saturnAutoCreated: 'true',
      clusterName: 'test-runtime',
      saturnVersion: '6',
      tool: runtimeToolLabels.Jupyter,
      runtimeName: 'test-runtime',
      cloudContext: 'Gcp/terra-test-e4000484',
      googleProject: 'terra-test-e4000484',
    },
    patchInProgress: false,
    ...overrides,
  };

  return runtime;
};

export const getGoogleDataProcRuntime = ({
  workspace = defaultGoogleWorkspace,
  runtimeName = generateRuntimeName(),
  status = runtimeStatuses.running.leoLabel,
  tool = tools.HAIL_BATCH.label,
  runtimeConfig = getRuntimeConfig(),
} = {}): ListRuntimeItem => {
  return {
    id: getRandomInt(randomMaxInt),
    workspaceId: null,
    runtimeName,
    googleProject: workspace.workspace.googleProject,
    cloudContext: {
      cloudProvider: 'GCP',
      cloudResource: workspace.workspace.googleProject,
    },
    auditInfo: {
      creator: 'broadterraui@gmail.com',
      createdDate: '2023-05-24T20:38:27.993689Z',
      destroyedDate: null,
      dateAccessed: '2023-05-24T20:38:28.651Z',
    },
    runtimeConfig,
    proxyUrl: `https://leonardo.dsde-dev.broadinstitute.org/proxy/terra-dev-21d47fdd/${runtimeName}/jupyter`,
    status,
    labels: {
      saturnWorkspaceNamespace: 'general-dev-billing-account',
      'saturn-iframe-extension': 'https://bvdp-saturn-dev.appspot.com/jupyter-iframe-extension.js',
      creator: 'broadterraui@gmail.com',
      clusterServiceAccount: 'pet-26745071641841ae8f81e@terra-dev-21d47fdd.iam.gserviceaccount.com',
      saturnAutoCreated: 'true',
      clusterName: runtimeName,
      saturnWorkspaceName: 'trock-google',
      saturnVersion: '6',
      tool,
      runtimeName,
      cloudContext: 'Gcp/terra-dev-21d47fdd',
      googleProject: workspace.workspace.googleProject,
    },
    patchInProgress: false,
  };
};

// Use this if you want a shortcut to override nested fields. Otherwise use `generateTestGoogleGetRuntime`
export const getGoogleRuntime = ({
  workspace = defaultGoogleWorkspace,
  runtimeName = generateRuntimeName(),
  status = runtimeStatuses.running.leoLabel,
  tool = tools.Jupyter,
  runtimeConfig = getJupyterRuntimeConfig(),
  image = undefined,
} = {}): GetRuntimeItem => {
  const googleProject = workspace.workspace.googleProject;
  const imageUri =
    image ||
    Utils.switchCase(
      tool.label,
      [runtimeToolLabels.RStudio, () => defaultRImage.image],
      [Utils.DEFAULT, () => defaultImage.image]
    );

  return {
    id: getRandomInt(randomMaxInt),
    runtimeName,
    googleProject,
    cloudContext: {
      cloudProvider: cloudProviderTypes.GCP,
      cloudResource: googleProject,
    },
    serviceAccount: 'testuser123@broad.com',
    auditInfo: defaultAuditInfo,
    runtimeConfig,
    proxyUrl: `https://leonardo.dsde-dev.broadinstitute.org/proxy/${googleProject}/${runtimeName}/${_.toLower(
      tool.label
    )}`,
    status,
    labels: {
      ...defaultWorkspaceLabels,
      'saturn-iframe-extension': 'https://bvdp-saturn-dev.appspot.com/jupyter-iframe-extension.js',
      creator: 'testuser123@broad.com',
      clusterServiceAccount: 'pet-26534176105071279add1@terra-dev-cf677740.iam.gserviceaccount.com',
      saturnAutoCreated: 'true',
      clusterName: runtimeName,
      saturnVersion: '6',
      tool: tool.label,
      runtimeName,
      cloudContext: `Gcp/${googleProject}`,
      googleProject,
    },
    errors: [],
    autopauseThreshold: 30,
    runtimeImages: [
      {
        imageType: 'Proxy',
        imageUrl: 'broadinstitute/openidc-proxy:2.3.1_2',
        timestamp: '2022-09-19T15:37:11.035465Z',
      },
      {
        imageType: tool.label,
        imageUrl: imageUri,
        // "homeDirectory": "/home/jupyter", //TODO: is this needed anywhere in UI?
        timestamp: '2022-09-19T15:37:11.035465Z',
      },
      {
        imageType: 'Welder',
        imageUrl: 'us.gcr.io/broad-dsp-gcr-public/welder-server:ef956b2',
        timestamp: '2022-09-19T15:37:11.035465Z',
      },
      {
        imageType: 'BootSource',
        imageUrl: 'projects/broad-dsp-gcr-public/global/images/nl-825-2-gce-cos-image-e06f7d9',
        timestamp: '2022-09-19T15:37:12.119Z',
      },
      {
        imageType: 'CryptoDetector',
        imageUrl: 'us.gcr.io/broad-dsp-gcr-public/cryptomining-detector:0.0.2',
        timestamp: '2022-09-19T15:37:11.035465Z',
      },
    ],
    scopes: [],
    customEnvironmentVariables: {},
    asyncRuntimeFields: null,
    userScriptUri: null,
    startUserScriptUri: null,
    jupyterUserScriptUri: null,
    jupyterStartUserScriptUri: null,
    userJupyterExtensionConfig: null,
    defaultClientId: null,
    diskConfig: null,
    patchInProgress: false,
  };
};

// Use this if you want a shortcut to override nested fields. Otherwise use `generateTestListGoogleRuntime`
export const listGoogleRuntime = ({
  workspace = defaultGoogleWorkspace,
  runtimeName = generateRuntimeName(),
  status = runtimeStatuses.running.leoLabel,
  tool = tools.Jupyter,
  runtimeConfig = getJupyterRuntimeConfig(),
} = {}): ListRuntimeItem => {
  const googleProject = workspace.workspace.googleProject;
  const workspaceId = workspace.workspace.workspaceId;

  return {
    id: getRandomInt(randomMaxInt),
    workspaceId,
    runtimeName,
    googleProject,
    cloudContext: {
      cloudProvider: cloudProviderTypes.GCP,
      cloudResource: googleProject,
    },
    auditInfo: defaultAuditInfo,
    runtimeConfig,
    proxyUrl: `https://leonardo.dsde-dev.broadinstitute.org/proxy/${googleProject}/${runtimeName}/${_.toLower(
      tool.label
    )}`,
    status,
    labels: {
      ...defaultWorkspaceLabels,
      'saturn-iframe-extension': 'https://bvdp-saturn-dev.appspot.com/jupyter-iframe-extension.js',
      creator: 'testuser123@broad.com',
      clusterServiceAccount: 'pet-26534176105071279add1@terra-dev-cf677740.iam.gserviceaccount.com',
      saturnAutoCreated: 'true',
      clusterName: runtimeName,
      saturnVersion: '6',
      tool: tool.label,
      runtimeName,
      cloudContext: `Gcp/${googleProject}`,
      googleProject,
    },
    patchInProgress: false,
  };
};

export const galaxyRunning: App = {
  workspaceId: null,
  accessScope: null,
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  appName: 'terra-app-69200c2f-89c3-47db-874c-b770d8de737f',
  appType: 'GALAXY',
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-29T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-11-29T20:19:13.162484Z',
  },
  diskName: 'saturn-pd-026594ac-d829-423d-a8df-76fe96f5b4e7',
  errors: [],
  kubernetesRuntimeConfig: { numNodes: 1, machineType: 'n1-highmem-8', autoscalingEnabled: false },
  labels: {},
  proxyUrls: {
    galaxy: 'https://leonardo-fiab.dsde-dev.broadinstitute.org/a-app-69200c2f-89c3-47db-874c-b770d8de737f/galaxy',
  },
  status: 'RUNNING',
  region: 'us-central1',
};

export const galaxyDeleting: App = {
  workspaceId: null,
  accessScope: null,
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  appName: 'terra-app-71200c2f-89c3-47db-874c-b770d8de22g',
  appType: 'GALAXY',
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-30T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-11-30T20:19:13.162484Z',
  },
  diskName: 'saturn-pd-1236594ac-d829-423d-a8df-76fe96f5897',
  errors: [],
  kubernetesRuntimeConfig: { numNodes: 1, machineType: 'n1-highmem-8', autoscalingEnabled: false },
  labels: {},
  proxyUrls: {
    galaxy: 'https://leonardo-fiab.dsde-dev.broadinstitute.org/a-app-69200c2f-89c3-47db-874c-b770d8de737f/galaxy',
  },
  status: 'DELETING',
  region: 'us-central1',
};

export const generateTestApp = (overrides: Partial<ListAppResponse>): ListAppResponse => ({
  workspaceId: null,
  accessScope: null,
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  appName: 'terra-app-69200c2f-89c3-47db-874c-b770d8de737f',
  appType: 'GALAXY',
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-29T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-11-29T20:19:13.162484Z',
  },
  diskName: 'saturn-pd-026594ac-d829-423d-a8df-76fe96f5b4e7',
  errors: [],
  kubernetesRuntimeConfig: { numNodes: 1, machineType: 'n1-highmem-8', autoscalingEnabled: false },
  labels: {},
  proxyUrls: {
    galaxy: 'https://leonardo-fiab.dsde-dev.broadinstitute.org/a-app-69200c2f-89c3-47db-874c-b770d8de737f/galaxy',
  },
  status: 'RUNNING',
  region: 'us-central1',
  ...overrides,
});

export const generateTestAppWithGoogleWorkspace = (
  overrides: Partial<ListAppResponse> = {},
  workspace: GoogleWorkspace = defaultGoogleWorkspace
): ListAppResponse => ({
  workspaceId: null,
  accessScope: null,
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: workspace.workspace.googleProject,
  },
  appName: 'terra-app-69200c2f-89c3-47db-874c-b770d8de737f',
  appType: 'GALAXY',
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-29T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-11-29T20:19:13.162484Z',
  },
  diskName: 'saturn-pd-026594ac-d829-423d-a8df-76fe96f5b4e7',
  errors: [],
  kubernetesRuntimeConfig: { numNodes: 1, machineType: 'n1-highmem-8', autoscalingEnabled: false },
  labels: {
    saturnWorkspaceName: workspace.workspace.name,
    saturnWorkspaceNamespace: workspace.workspace.namespace,
  },
  proxyUrls: {
    galaxy: 'https://leonardo-fiab.dsde-dev.broadinstitute.org/a-app-69200c2f-89c3-47db-874c-b770d8de737f/galaxy',
  },
  status: 'RUNNING',
  region: 'us-central1',
  ...overrides,
});

export const listAppToGetApp = (listApp: ListAppResponse): GetAppResponse => ({
  ...listApp,
  customEnvironmentVariables: {},
});

export const generateTestAppWithAzureWorkspace = (
  overrides: Partial<ListAppResponse> = {},
  workspace: AzureWorkspace = defaultAzureWorkspace
): ListAppResponse => ({
  workspaceId: null,
  accessScope: null,
  cloudContext: {
    cloudProvider: 'AZURE',
    cloudResource: `${workspace.azureContext.tenantId}/${workspace.azureContext.subscriptionId}/${workspace.azureContext.managedResourceGroupId}`,
  },
  appName: 'terra-app-69200c2f-89c3-47db-874c-b770d8de737f',
  appType: 'CROMWELL',
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-29T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-11-29T20:19:13.162484Z',
  },
  diskName: 'saturn-pd-026594ac-d829-423d-a8df-76fe96f5b4e7',
  errors: [],
  kubernetesRuntimeConfig: { numNodes: 1, machineType: 'n1-highmem-8', autoscalingEnabled: false },
  labels: {
    saturnWorkspaceName: workspace.workspace.name,
    saturnWorkspaceNamespace: workspace.workspace.namespace,
  },
  proxyUrls: {
    galaxy: 'https://leonardo-fiab.dsde-dev.broadinstitute.org/a-app-69200c2f-89c3-47db-874c-b770d8de737f/galaxy',
  },
  status: 'RUNNING',
  region: 'us-central1',
  ...overrides,
});

export const generateTestDiskWithGoogleWorkspace = (
  overrides: Partial<PersistentDisk> = {},
  workspace: GoogleWorkspace = defaultGoogleWorkspace
): PersistentDisk => ({
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-29T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-11-29T20:19:14.114Z',
  },
  blockSize: 4096,
  diskType: {
    value: 'pd-standard',
    label: 'Standard',
    regionToPricesName: 'monthlyStandardDiskPrice',
  },
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: workspace.workspace.googleProject,
  },
  id: getRandomInt(randomMaxInt),
  labels: {
    saturnApplication: 'galaxy',
    saturnWorkspaceName: workspace.workspace.name,
    saturnWorkspaceNamespace: workspace.workspace.namespace,
  }, // Note 'galaxy' vs. 'GALAXY', to represent our older naming scheme
  name: 'saturn-pd-026594ac-d829-423d-a8df-76fe96f5b4e7',
  size: 500,
  status: 'Ready',
  zone: 'us-central1-a',
  ...overrides,
});

export const generateTestDiskWithAzureWorkspace = (
  overrides: Partial<PersistentDisk> = {},
  workspace: AzureWorkspace = defaultAzureWorkspace
): PersistentDisk => ({
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-29T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-11-29T20:19:14.114Z',
  },
  blockSize: 4096,
  diskType: {
    value: 'pd-standard',
    label: 'Standard',
    regionToPricesName: 'monthlyStandardDiskPrice',
  },
  cloudContext: {
    cloudProvider: cloudProviderTypes.AZURE,
    cloudResource: `${workspace.azureContext.tenantId}/${workspace.azureContext.subscriptionId}/${workspace.azureContext.managedResourceGroupId}`,
  },
  id: getRandomInt(randomMaxInt),
  labels: {
    saturnApplication: 'galaxy',
    saturnWorkspaceName: workspace.workspace.name,
    saturnWorkspaceNamespace: workspace.workspace.namespace,
  }, // Note 'galaxy' vs. 'GALAXY', to represent our older naming scheme
  name: 'saturn-pd-026594ac-d829-423d-a8df-76fe96f5b4e7',
  size: 500,
  status: 'Ready',
  zone: 'us-central1-a',
  ...overrides,
});

export const generateTestDisk = (overrides: Partial<PersistentDisk> = {}): PersistentDisk => ({
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-29T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-11-29T20:19:14.114Z',
  },
  blockSize: 4096,
  diskType: {
    value: 'pd-standard',
    label: 'Standard',
    regionToPricesName: 'monthlyStandardDiskPrice',
  },
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  id: getRandomInt(randomMaxInt),
  labels: { saturnApplication: 'galaxy', saturnWorkspaceName: 'test-workspace' }, // Note 'galaxy' vs. 'GALAXY', to represent our older naming scheme
  name: 'saturn-pd-026594ac-d829-423d-a8df-76fe96f5b4e7',
  size: 500,
  status: 'Ready',
  zone: 'us-central1-a',
  ...overrides,
});

export const galaxyDisk: PersistentDisk = {
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-29T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-11-29T20:19:14.114Z',
  },
  blockSize: 4096,
  diskType: {
    value: 'pd-standard',
    label: 'Standard',
    regionToPricesName: 'monthlyStandardDiskPrice',
  },
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  id: 10,
  labels: { saturnApplication: 'galaxy', saturnWorkspaceName: 'test-workspace' }, // Note 'galaxy' vs. 'GALAXY', to represent our older naming scheme
  name: 'saturn-pd-026594ac-d829-423d-a8df-76fe96f5b4e7',
  size: 500,
  status: 'Ready',
  zone: 'us-central1-a',
};

export const azureDisk: PersistentDisk = {
  id: 16902,
  cloudContext: {
    cloudProvider: 'AZURE',
    cloudResource: 'testCloudResource',
  },
  zone: 'eastus',
  name: 'testAzurePD',
  status: 'Ready',
  auditInfo: {
    creator: 'test.user@gmail.com',
    createdDate: '2023-02-01T20:40:50.428281Z',
    destroyedDate: null,
    dateAccessed: '2023-02-01T20:41:00.357Z',
  },
  size: 50,
  diskType: {
    value: 'pd-standard',
    label: 'Standard',
    regionToPricesName: 'monthlyStandardDiskPrice',
  }, // TODO: This should be stored in backend as Standard_LRS
  blockSize: 4096,
  labels: {
    saturnWorkspaceNamespace: defaultAzureWorkspace.workspace.namespace,
    saturnWorkspaceName: defaultAzureWorkspace.workspace.name,
  },
};

export const azureRuntime: ListRuntimeItem = {
  id: 79771,
  workspaceId: defaultAzureWorkspace.workspace.workspaceId,
  runtimeName: 'saturn-42a4398b-10f8-4626-9025-7abda26aedab',
  googleProject:
    '0cb7a640-45a2-4ed6-be9f-63519f86e04b/3efc5bdf-be0e-44e7-b1d7-c08931e3c16c/mrg-terra-dev-jan23-20230123125907',
  cloudContext: {
    cloudProvider: 'AZURE',
    cloudResource:
      '0cb7a640-45a2-4ed6-be9f-63519f86e04b/3efc5bdf-be0e-44e7-b1d7-c08931e3c16c/mrg-terra-dev-jan23-20230123125907',
  },
  auditInfo: {
    creator: 'testuser123@broad.com',
    createdDate: '2023-02-01T20:40:50.428281Z',
    destroyedDate: null,
    dateAccessed: '2023-02-01T20:41:00.357Z',
  },
  runtimeConfig: {
    cloudService: cloudServiceTypes.AZURE_VM,
    machineType: 'Standard_DS2_v2',
    persistentDiskId: 16902,
    region: 'eastus',
  } satisfies AzureConfig,
  proxyUrl:
    'https://lzf07312d05014dcfc2a6d8244c0f9b166a3801f44ec2b003d.servicebus.windows.net/saturn-42a4398b-10f8-4626-9025-7abda26aedab',
  status: 'Running',
  labels: {
    saturnWorkspaceNamespace: defaultAzureWorkspace.workspace.namespace,
    creator: 'testuser123@broad.com',
    clusterServiceAccount: 'testuser123@broad.com',
    saturnAutoCreated: 'true',
    clusterName: 'saturn-42a4398b-10f8-4626-9025-7abda26aedab',
    saturnWorkspaceName: defaultAzureWorkspace.workspace.name,
    saturnVersion: '6',
    tool: 'JupyterLab',
    runtimeName: 'saturn-42a4398b-10f8-4626-9025-7abda26aedab',
    cloudContext:
      'Azure/0cb7a640-45a2-4ed6-be9f-63519f86e04b/3efc5bdf-be0e-44e7-b1d7-c08931e3c16c/mrg-terra-dev-jan23-20230123125907',
  },
  patchInProgress: false,
};

export const dataprocRuntime: ListRuntimeItem = {
  id: 81666,
  runtimeName: 'saturn-a5eec7f3-857d-4fab-b26c-6f1291082641',
  googleProject: defaultGoogleWorkspace.workspace.googleProject,
  workspaceId: null,
  cloudContext: { cloudProvider: 'GCP', cloudResource: defaultGoogleWorkspace.workspace.googleProject },
  auditInfo: {
    creator: 'jcanas@broadinstitute.org',
    createdDate: '2023-05-03T19:53:22.510154Z',
    destroyedDate: null,
    dateAccessed: '2023-05-03T19:53:23.559367Z',
  },
  runtimeConfig: {
    numberOfWorkers: 2,
    masterMachineType: 'n1-standard-4',
    masterDiskSize: 150,
    workerMachineType: 'n1-standard-4',
    workerDiskSize: 150,
    numberOfWorkerLocalSSDs: 0,
    numberOfPreemptibleWorkers: 1,
    cloudService: 'DATAPROC',
    region: 'us-central1',
    componentGatewayEnabled: true,
    workerPrivateAccess: false,
  },
  proxyUrl:
    'https://leonardo.dsde-dev.broadinstitute.org/proxy/terra-dev-941380db/saturn-a5eec7f3-857d-4fab-b26c-6f1291082641/jupyter',
  status: 'Creating',
  labels: {
    saturnWorkspaceNamespace: defaultGoogleWorkspace.workspace.namespace,
    'saturn-iframe-extension': 'https://bvdp-saturn-dev.appspot.com/jupyter-iframe-extension.js',
    creator: 'jcanas@broadinstitute.org',
    clusterServiceAccount: 'pet-116683946280099005020@terra-dev-941380db.iam.gserviceaccount.com',
    saturnAutoCreated: 'true',
    clusterName: 'saturn-a5eec7f3-857d-4fab-b26c-6f1291082641',
    saturnWorkspaceName: defaultGoogleWorkspace.workspace.name,
    saturnVersion: '6',
    tool: 'Jupyter',
    runtimeName: 'saturn-a5eec7f3-857d-4fab-b26c-6f1291082641',
    cloudContext: 'Gcp/terra-dev-941380db',
    googleProject: 'terra-dev-941380db',
  },
  patchInProgress: false,
};
