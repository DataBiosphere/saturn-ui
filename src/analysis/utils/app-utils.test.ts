import { galaxyDeleting, galaxyDisk, galaxyRunning } from 'src/analysis/_testData/testData';
import {
  doesWorkspaceSupportCromwellAppForUser,
  getCurrentApp,
  getCurrentAppIncludingDeleting,
  getDiskAppType,
  getEnvMessageBasedOnStatus,
  workspaceHasMultipleApps,
} from 'src/analysis/utils/app-utils';
import {
  getCurrentAppDataDisk,
  multipleDisksError,
  workspaceUserHasMultipleDisks,
} from 'src/analysis/utils/disk-utils';
import { appToolLabels, appTools } from 'src/analysis/utils/tool-utils';
import { App } from 'src/libs/ajax/leonardo/models/app-models';
import { PersistentDisk } from 'src/libs/ajax/leonardo/providers/LeoDiskProvider';
import { getConfig } from 'src/libs/config';
import { asMockedFn } from 'src/testing/test-utils';
import { cloudProviderTypes, WorkspaceInfo } from 'src/workspaces/utils';

jest.mock('src/libs/config', () => ({
  ...jest.requireActual('src/libs/config'),
  getConfig: jest.fn().mockReturnValue({}),
}));

type StateExports = typeof import('src/libs/state');
jest.mock('src/libs/state', (): StateExports => {
  return {
    ...jest.requireActual('src/libs/state'),
    getTerraUser: jest.fn(() => ({ email: 'workspace-creator@gmail.com' })),
  };
});

jest.mock('src/libs/feature-previews', () => ({
  ...jest.requireActual('src/libs/feature-previews'),
  isFeaturePreviewEnabled: jest.fn(),
}));

const cromwellRunning: App = {
  workspaceId: null,
  accessScope: null,
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  appName: 'terra-app-83f46705-524c-4fc8-xcyc-97fdvcfby14f',
  appType: 'CROMWELL',
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-28T20:28:01.998494Z',
    destroyedDate: null,
    dateAccessed: '2021-11-28T20:28:01.998494Z',
  },
  diskName: 'saturn-pd-693a9707-634d-4134-bb3a-xyz73cd5a8ce',
  errors: [],
  kubernetesRuntimeConfig: { numNodes: 1, machineType: 'n1-highmem-8', autoscalingEnabled: false },
  labels: {},
  proxyUrls: {
    'cromwell-service':
      'https://leonardo-fiab.dsde-dev.broadinstitute.org/fd0cfbb14f/cromwell-service/swagger/cromwell.yaml',
  },
  status: 'RUNNING',
  region: 'us-central1',
};

// Newer than cromwellRunning
const cromwellProvisioning: App = {
  workspaceId: null,
  accessScope: null,
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  appName: 'terra-app-73f46705-524c-4fc8-ac8c-07fd0cfbb14f',
  appType: 'CROMWELL',
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-29T20:28:01.998494Z',
    destroyedDate: null,
    dateAccessed: '2021-11-29T20:28:01.998494Z',
  },
  diskName: 'saturn-pd-693a9707-634d-4134-bb3a-cbb73cd5a8ce',
  errors: [],
  kubernetesRuntimeConfig: { numNodes: 1, machineType: 'n1-highmem-8', autoscalingEnabled: false },
  labels: {},
  proxyUrls: {
    'cromwell-service':
      'https://leonardo-fiab.dsde-dev.broadinstitute.org/fd0cfbb14f/cromwell-service/swagger/cromwell.yaml',
  },
  status: 'PROVISIONING',
  region: 'us-central1',
};

const mockApps = [cromwellProvisioning, cromwellRunning, galaxyRunning, galaxyDeleting];

const galaxy1Workspace1: App = {
  workspaceId: null,
  accessScope: null,
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  appName: 'terra-app-69200c2f-89c3-47db-874c-b770d8de858g',
  appType: 'GALAXY',
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-12-10T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-12-11T20:19:13.162484Z',
  },
  diskName: 'saturn-pd-026594ac-d829-423d-a8df-87fe07f6b5e8', // galaxyDisk1Workspace1
  errors: [],
  kubernetesRuntimeConfig: { numNodes: 1, machineType: 'n1-highmem-8', autoscalingEnabled: false },
  labels: { saturnWorkspaceName: 'test-workspace' },
  proxyUrls: {
    galaxy: 'https://leonardo-fiab.dsde-dev.broadinstitute.org/a-app-69200c2f-89c3-47db-874c-b770d8de737f/galaxy',
  },
  status: 'RUNNING',
  region: 'us-central1',
};

const galaxy2Workspace1: App = {
  workspaceId: null,
  accessScope: null,
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  appName: 'terra-app-69200c2f-89c3-47db-874c-b770d8de656t',
  appType: 'GALAXY',
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-12-10T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-12-11T20:19:13.162484Z',
  },
  diskName: 'saturn-pd-026594ac-d829-423d-a8df-98fe18f7b6e9', // galaxyDisk2Workspace1
  errors: [],
  kubernetesRuntimeConfig: { numNodes: 1, machineType: 'n1-highmem-8', autoscalingEnabled: false },
  labels: { saturnWorkspaceName: 'test-workspace' },
  proxyUrls: {
    galaxy: 'https://leonardo-fiab.dsde-dev.broadinstitute.org/a-app-69200c2f-89c3-47db-874c-b770d8de737f/galaxy',
  },
  status: 'RUNNING',
  region: 'us-central1',
};

const cromwell1Workspace1: App = {
  workspaceId: null,
  accessScope: null,
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  appName: 'terra-app-69200c2f-89c3-47db-874c-b770d8de656t',
  appType: 'GALAXY',
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-12-10T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-12-11T20:19:13.162484Z',
  },
  diskName: 'saturn-pd-026594ac-d829-423d-a8df-55fe36f5b4e8', // cromwellDisk1Workspace1
  errors: [],
  kubernetesRuntimeConfig: { numNodes: 1, machineType: 'n1-highmem-8', autoscalingEnabled: false },
  labels: { saturnWorkspaceName: 'test-workspace' },
  proxyUrls: {
    galaxy: 'https://leonardo-fiab.dsde-dev.broadinstitute.org/a-app-69200c2f-89c3-47db-874c-b770d8de737f/galaxy',
  },
  status: 'RUNNING',
  region: 'us-central1',
};

const mockAppsSameWorkspace = [galaxy1Workspace1, galaxy2Workspace1, cromwell1Workspace1];

const galaxyDiskUpdatedPd: PersistentDisk = {
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-29T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-11-29T20:19:14.114Z',
  },
  blockSize: 4096,
  diskType: {
    label: 'Standard',
    value: 'pd-standard',
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

// Newer than galaxyDisk, attached to galaxyDeleting app.
const galaxyDeletingDisk: PersistentDisk = {
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-30T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-11-30T20:19:14.114Z',
  },
  blockSize: 4096,
  diskType: {
    label: 'Standard',
    value: 'pd-standard',
    regionToPricesName: 'monthlyStandardDiskPrice',
  },
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  id: 10,
  labels: { saturnApplication: 'GALAXY', saturnWorkspaceName: 'test-workspace' },
  name: 'saturn-pd-1236594ac-d829-423d-a8df-76fe96f5897',
  size: 500,
  status: 'Deleting',
  zone: 'us-central1-a',
};

const galaxyDeletingDiskUpdatedPd: PersistentDisk = {
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-30T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-11-30T20:19:14.114Z',
  },
  blockSize: 4096,
  diskType: {
    label: 'Standard',
    value: 'pd-standard',
    regionToPricesName: 'monthlyStandardDiskPrice',
  },
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  id: 10,
  labels: { saturnApplication: 'GALAXY', saturnWorkspaceName: 'test-workspace' },
  name: 'saturn-pd-1236594ac-d829-423d-a8df-76fe96f5897',
  size: 500,
  status: 'Deleting',
  zone: 'us-central1-a',
};

const cromwellUnattachedDisk: PersistentDisk = {
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-30T02:21:00.705505Z',
    destroyedDate: null,
    dateAccessed: '2021-11-30T02:21:00.705505Z',
  },
  blockSize: 4096,
  diskType: {
    label: 'Standard',
    value: 'pd-standard',
    regionToPricesName: 'monthlyStandardDiskPrice',
  },
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  id: 12,
  labels: { saturnApplication: 'CROMWELL', saturnWorkspaceName: 'test-workspace' },
  name: 'saturn-pd-7fc0c398-63fe-4441-aea5-1e794c961310',
  size: 500,
  status: 'Ready',
  zone: 'us-central1-a',
};

const cromwellUnattachedDiskUpdatedPd: PersistentDisk = {
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-30T02:21:00.705505Z',
    destroyedDate: null,
    dateAccessed: '2021-11-30T02:21:00.705505Z',
  },
  blockSize: 4096,
  diskType: {
    label: 'Standard',
    value: 'pd-standard',
    regionToPricesName: 'monthlyStandardDiskPrice',
  },
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  id: 12,
  labels: { saturnApplication: 'CROMWELL', saturnWorkspaceName: 'test-workspace' },
  name: 'saturn-pd-7fc0c398-63fe-4441-aea5-1e794c961310',
  size: 500,
  status: 'Ready',
  zone: 'us-central1-a',
};

// Older than cromwellUnattachedDisk, attached to cromwellProvisioning app.
const cromwellProvisioningDisk: PersistentDisk = {
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-29T20:28:01.998494Z',
    destroyedDate: null,
    dateAccessed: '2021-11-29T20:28:03.109Z',
  },
  blockSize: 4096,
  diskType: {
    label: 'Standard',
    value: 'pd-standard',
    regionToPricesName: 'monthlyStandardDiskPrice',
  },
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  id: 11,
  labels: { saturnApplication: 'CROMWELL', saturnWorkspaceName: 'test-workspace' },
  name: 'saturn-pd-693a9707-634d-4134-bb3a-cbb73cd5a8ce',
  size: 500,
  status: 'Creating',
  zone: 'us-central1-a',
};

const cromwellProvisioningDiskUpdatedPd: PersistentDisk = {
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-29T20:28:01.998494Z',
    destroyedDate: null,
    dateAccessed: '2021-11-29T20:28:03.109Z',
  },
  blockSize: 4096,
  diskType: {
    label: 'Standard',
    value: 'pd-standard',
    regionToPricesName: 'monthlyStandardDiskPrice',
  },
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  id: 11,
  labels: { saturnApplication: 'CROMWELL', saturnWorkspaceName: 'test-workspace' },
  name: 'saturn-pd-693a9707-634d-4134-bb3a-cbb73cd5a8ce',
  size: 500,
  status: 'Creating',
  zone: 'us-central1-a',
};

const jupyterDisk: PersistentDisk = {
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-12-02T16:38:13.777424Z',
    destroyedDate: null,
    dateAccessed: '2021-12-02T16:40:23.464Z',
  },
  blockSize: 4096,
  cloudContext: { cloudProvider: 'GCP', cloudResource: 'terra-test-f828b4cd' },
  diskType: {
    label: 'Standard',
    value: 'pd-standard',
    regionToPricesName: 'monthlyStandardDiskPrice',
  },
  id: 29,
  labels: {},
  name: 'saturn-pd-bd0d0405-c048-4212-bccf-568435933081',
  size: 50,
  status: 'Ready',
  zone: 'us-central1-a',
};

const mockAppDisks = [galaxyDisk, galaxyDeletingDisk, cromwellProvisioningDisk, cromwellUnattachedDisk];

const galaxyDisk1Workspace1: PersistentDisk = {
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-30T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-12-10T20:19:14.114Z',
  },
  blockSize: 4096,
  diskType: {
    label: 'Standard',
    value: 'pd-standard',
    regionToPricesName: 'monthlyStandardDiskPrice',
  },
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  id: 13,
  labels: { saturnApplication: 'GALAXY', saturnWorkspaceName: 'test-workspace' },
  name: 'saturn-pd-026594ac-d829-423d-a8df-87fe07f6b5e8',
  size: 500,
  status: 'Ready',
  zone: 'us-central1-a',
};

const galaxyDisk2Workspace1: PersistentDisk = {
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-28T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-11-29T20:19:14.114Z',
  },
  blockSize: 4096,
  diskType: {
    label: 'Standard',
    value: 'pd-standard',
    regionToPricesName: 'monthlyStandardDiskPrice',
  },
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  id: 14,
  labels: { saturnApplication: 'GALAXY', saturnWorkspaceName: 'test-workspace' },
  name: 'saturn-pd-026594ac-d829-423d-a8df-98fe18f7b6e9',
  size: 500,
  status: 'Ready',
  zone: 'us-central1-a',
};

const galaxyDisk3Workspace2: PersistentDisk = {
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-26T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-11-29T20:19:14.114Z',
  },
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  blockSize: 4096,
  diskType: {
    label: 'Standard',
    value: 'pd-standard',
    regionToPricesName: 'monthlyStandardDiskPrice',
  },
  id: 15,
  labels: { saturnApplication: 'GALAXY', saturnWorkspaceName: 'test-workspace-2' },
  name: 'saturn-pd-026594ac-d829-423d-a8df-33fe36f5b4e4',
  size: 500,
  status: 'Ready',
  zone: 'us-central1-a',
};

const cromwellDisk1Workspace1: PersistentDisk = {
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-26T20:19:13.162484Z',
    destroyedDate: null,
    dateAccessed: '2021-11-29T20:19:14.114Z',
  },
  blockSize: 4096,
  diskType: {
    label: 'Standard',
    value: 'pd-standard',
    regionToPricesName: 'monthlyStandardDiskPrice',
  },
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  id: 16,
  labels: { saturnApplication: 'CROMWELL', saturnWorkspaceName: 'test-workspace' },
  name: 'saturn-pd-026594ac-d829-423d-a8df-55fe36f5b4e8',
  size: 500,
  status: 'Ready',
  zone: 'us-central1-a',
};

const mockAppDisksSameWorkspace = [
  galaxyDisk1Workspace1,
  galaxyDisk2Workspace1,
  galaxyDisk3Workspace2,
  cromwellDisk1Workspace1,
];

const creatorWorkspace = {
  createdDate: '2023-03-19T20:28:01.998494Z',
  createdBy: 'workspace-creator@gmail.com',
};
const nonCreatorWorkspace = {
  createdDate: '2023-03-19T20:28:01.998494Z',
  createdBy: 'non-workspace-creator@gmail.com',
};

const cromwellError: App = {
  workspaceId: null,
  accessScope: null,
  cloudContext: {
    cloudProvider: cloudProviderTypes.GCP,
    cloudResource: 'terra-test-e4000484',
  },
  appName: 'terra-app-83f46705-524c-4fc8-xcyc-97fdvcfby14f',
  appType: 'CROMWELL',
  auditInfo: {
    creator: 'cahrens@gmail.com',
    createdDate: '2021-11-28T20:28:01.998494Z',
    destroyedDate: null,
    dateAccessed: '2021-11-28T20:28:01.998494Z',
  },
  diskName: 'saturn-pd-693a9707-634d-4134-bb3a-xyz73cd5a8ce',
  errors: [],
  kubernetesRuntimeConfig: { numNodes: 1, machineType: 'n1-highmem-8', autoscalingEnabled: false },
  labels: {},
  proxyUrls: {
    'cromwell-service':
      'https://leonardo-fiab.dsde-dev.broadinstitute.org/fd0cfbb14f/cromwell-service/swagger/cromwell.yaml',
  },
  status: 'ERROR',
  region: 'us-central1',
};

describe('getCurrentApp', () => {
  it('returns undefined if no instances of the app exist', () => {
    expect(getCurrentApp(appTools.GALAXY.label, [])).toBeUndefined();
    expect(getCurrentApp(appTools.CROMWELL.label, [galaxyRunning])).toBeUndefined();
  });
  it('returns the most recent app for the given type (that is not deleting)', () => {
    expect(getCurrentApp(appTools.GALAXY.label, mockApps)).toBe(galaxyRunning);
    expect(getCurrentApp(appTools.CROMWELL.label, mockApps)).toBe(cromwellProvisioning);
  });
});

describe('getCurrentAppIncludingDeleting', () => {
  it('does not filter out deleting', () => {
    expect(getCurrentAppIncludingDeleting(appTools.GALAXY.label, mockApps)).toBe(galaxyDeleting);
    expect(getCurrentAppIncludingDeleting(appTools.CROMWELL.label, mockApps)).toBe(cromwellProvisioning);
  });
});

describe('getDiskAppType', () => {
  it('returns the appType for disks attached to apps', () => {
    expect(getDiskAppType(galaxyDeletingDisk)).toBe(appTools.GALAXY.label);
    expect(getDiskAppType(cromwellProvisioningDisk)).toBe(appTools.CROMWELL.label);
  });
  it('returns undefined for runtime disks', () => {
    expect(getDiskAppType(jupyterDisk)).toBeUndefined();
  });
});

describe('getCurrentAppDataDisk', () => {
  it('returns undefined if no disk exists for the given app type', () => {
    expect(
      getCurrentAppDataDisk(appTools.GALAXY.label, [cromwellProvisioning], [cromwellProvisioningDisk], 'test-workspace')
    ).toBeUndefined();
  });
  it('returns the newest attached disk, even if app is deleting', () => {
    expect(getCurrentAppDataDisk(appTools.GALAXY.label, mockApps, mockAppDisks, 'test-workspace')).toStrictEqual(
      galaxyDeletingDiskUpdatedPd
    );
    expect(getCurrentAppDataDisk(appTools.CROMWELL.label, mockApps, mockAppDisks, 'test-workspace')).toStrictEqual(
      cromwellProvisioningDiskUpdatedPd
    );
  });
  it('returns the newest unattached disk that is not deleting if no app instance exists', () => {
    expect(getCurrentAppDataDisk(appTools.GALAXY.label, [], mockAppDisks, 'test-workspace')).toStrictEqual(
      galaxyDiskUpdatedPd
    );
    expect(
      getCurrentAppDataDisk(appTools.CROMWELL.label, [galaxyRunning], mockAppDisks, 'test-workspace')
    ).toStrictEqual(cromwellUnattachedDiskUpdatedPd);
  });
  it('returns a galaxy disk only if it is in the same workspace as the previous app it was attached to', () => {
    expect(getCurrentAppDataDisk(appTools.GALAXY.label, [], mockAppDisks, 'test-workspace')).toStrictEqual(
      galaxyDiskUpdatedPd
    );
    expect(getCurrentAppDataDisk(appTools.GALAXY.label, [], mockAppDisks, 'incorrect-workspace')).toBeUndefined();
  });
});

describe('workspaceHasMultipleApps', () => {
  it('returns true when there are multiple galaxy apps in a project/workspace', () => {
    expect(workspaceHasMultipleApps(mockAppsSameWorkspace, appTools.GALAXY.label)).toBe(true);
  });
  it('returns false when there is not multiple cromwell apps in a project/workspace', () => {
    expect(workspaceHasMultipleApps(mockAppsSameWorkspace, appTools.CROMWELL.label)).toBe(false);
  });
});

describe('workspaceUserHasMultipleDisks', () => {
  it('returns true when there are multiple galaxy disks', () => {
    expect(workspaceUserHasMultipleDisks(mockAppDisksSameWorkspace, appTools.GALAXY.label)).toBe(true);
  });
  it('returns false when there is not multiple cromwell disks', () => {
    expect(workspaceUserHasMultipleDisks(mockAppDisksSameWorkspace, appTools.CROMWELL.label)).toBe(false);
  });
});

describe('multipleDisksError', () => {
  it('returns true when there are multiple disks in a project/workspace for a given user', () => {
    expect(multipleDisksError(mockAppDisksSameWorkspace, 'cahrens@gmail.com', appTools.GALAXY.label)).toBe(true);
  });
  it('returns false when there is not multiple disks in a project/workspace for a given user', () => {
    expect(multipleDisksError(mockAppDisksSameWorkspace, 'notcahrens@gmail.com', appTools.GALAXY.label)).toBe(false);
  });
});

describe('doesWorkspaceSupportCromwellAppForUser', () => {
  const testCases = [
    // Azure workspaces
    {
      workspaceInfo: creatorWorkspace,
      cloudProvider: cloudProviderTypes.AZURE,
      toolLabel: appToolLabels.CROMWELL,
      expectedResult: true,
    },
    {
      workspaceInfo: nonCreatorWorkspace,
      cloudProvider: cloudProviderTypes.AZURE,
      toolLabel: appToolLabels.CROMWELL,
      expectedResult: false,
    },
    // Collaborative app types
    {
      workspaceInfo: creatorWorkspace,
      cloudProvider: cloudProviderTypes.AZURE,
      toolLabel: appToolLabels.WORKFLOWS_APP,
      expectedResult: true,
    },
    {
      workspaceInfo: nonCreatorWorkspace,
      cloudProvider: cloudProviderTypes.AZURE,
      toolLabel: appToolLabels.WORKFLOWS_APP,
      expectedResult: true,
    },
    // Other app types
    {
      workspaceInfo: nonCreatorWorkspace,
      cloudProvider: cloudProviderTypes.GCP,
      toolLabel: appToolLabels.GALAXY,
      expectedResult: true,
    },
    {
      workspaceInfo: nonCreatorWorkspace,
      cloudProvider: cloudProviderTypes.GCP,
      toolLabel: appToolLabels.GALAXY,
      expectedResult: true,
    },
  ];

  beforeEach(() => {
    asMockedFn(getConfig).mockReturnValue({ isProd: false });
  });

  test.each(testCases)(
    'should return $expectedResult for $toolLabel app in $cloudProvider workspace based on workspace creator and creation date (non-Prod)',
    ({ workspaceInfo, cloudProvider, toolLabel, expectedResult }) => {
      expect(doesWorkspaceSupportCromwellAppForUser(workspaceInfo as WorkspaceInfo, cloudProvider, toolLabel)).toBe(
        expectedResult
      );
    }
  );
});

describe('getEnvMessageBasedOnStatus', () => {
  it('displays a generic message if there is no app', () => {
    expect(getEnvMessageBasedOnStatus(undefined)).toBe(
      'A cloud environment consists of application configuration, cloud compute and persistent disk(s).'
    );
  });
  it('displays a generic message for a running app', () => {
    expect(getEnvMessageBasedOnStatus(cromwellRunning)).toBe(
      'A cloud environment consists of application configuration, cloud compute and persistent disk(s).'
    );
  });
  it('displays a message for a provisioning app', () => {
    expect(getEnvMessageBasedOnStatus(cromwellProvisioning)).toBe(
      'The cloud compute is provisioning, which may take several minutes.'
    );
  });
  it('displays a message for an errored app', () => {
    expect(getEnvMessageBasedOnStatus(cromwellError)).toBe('An error has occurred on your cloud environment.');
  });
  it('displays a message for a stopped app', () => {
    const cromwellStopped: App = { ...cromwellRunning, status: 'STOPPED' };
    expect(getEnvMessageBasedOnStatus(cromwellStopped)).toBe('The cloud compute is paused.');
  });
  it('displays a message for a stopping app', () => {
    const cromwellStopping: App = { ...cromwellRunning, status: 'STOPPING' };
    expect(getEnvMessageBasedOnStatus(cromwellStopping)).toBe(
      'The cloud compute is pausing. This process will take up to a few minutes.'
    );
  });
  it('displays a message for a starting app', () => {
    const cromwellStarting: App = { ...cromwellRunning, status: 'STARTING' };
    expect(getEnvMessageBasedOnStatus(cromwellStarting)).toBe(
      'The cloud compute is resuming. This process will take up to a few minutes.'
    );
  });
});
