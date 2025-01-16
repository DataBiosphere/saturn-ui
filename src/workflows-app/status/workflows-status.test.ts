import { abandonedPromise } from '@terra-ui-packages/core-utils';
import { Apps, AppsAjaxContract } from 'src/libs/ajax/leonardo/Apps';
import { ListAppItem } from 'src/libs/ajax/leonardo/models/app-models';
import { Cbas, CbasAjaxContract } from 'src/libs/ajax/workflows-app/Cbas';
import { CromwellApp, CromwellAppAjaxContract } from 'src/libs/ajax/workflows-app/CromwellApp';
import { asMockedFn, MockedFn, partial, renderHookInAct } from 'src/testing/test-utils';
import { useWorkflowsStatus } from 'src/workflows-app/status/workflows-status';

jest.mock('src/libs/ajax/leonardo/Apps');
jest.mock('src/libs/ajax/workflows-app/Cbas');
jest.mock('src/libs/ajax/workflows-app/CromwellApp');

const workspaceId = 'test-workspace-id';

const workflowsAppObject: ListAppItem = {
  workspaceId,
  cloudContext: {
    cloudProvider: 'AZURE',
    cloudResource: '(unused)',
  },
  kubernetesRuntimeConfig: {
    numNodes: 1,
    machineType: 'Standard_A2_v2',
    autoscalingEnabled: false,
  },
  errors: [],
  status: 'RUNNING',
  proxyUrls: {
    cbas: 'https://test-url/cbas-blah/',
    'cromwell-reader': 'https://test-url/cromwell-reader-blah/',
    listener: 'https://test-url/listener-blah/',
  },
  appName: 'wfa-blah',
  appType: 'WORKFLOWS_APP',
  diskName: null,
  auditInfo: {
    creator: 'user@example.com',
    createdDate: '2023-07-11T18:59:09.369822Z',
    destroyedDate: null,
    dateAccessed: '2023-07-11T18:59:09.369822Z',
  },
  accessScope: 'WORKSPACE_SHARED',
  labels: {},
  region: 'is-central1',
};

const cromwellRunnerAppObject: ListAppItem = {
  workspaceId,
  cloudContext: {
    cloudProvider: 'AZURE',
    cloudResource: '(unused)',
  },
  kubernetesRuntimeConfig: {
    numNodes: 1,
    machineType: 'Standard_A2_v2',
    autoscalingEnabled: false,
  },
  errors: [],
  status: 'RUNNING',
  proxyUrls: {
    'cromwell-runner': 'https://test-url/cromwell-runner-blah/',
    listener: 'https://test-url/listener-blah/',
  },
  appName: 'cra-blah',
  appType: 'CROMWELL_RUNNER_APP',
  diskName: null,
  auditInfo: {
    creator: 'user@example.com',
    createdDate: '2023-07-11T18:59:09.369822Z',
    destroyedDate: null,
    dateAccessed: '2023-07-11T18:59:09.369822Z',
  },
  accessScope: 'USER_PRIVATE',
  labels: {},
  region: 'is-central1',
};

const cbasStatusResponse = {
  ok: true,
  systems: {
    cromwell: {
      ok: true,
      messages: ['(unused)'],
    },
    ecm: {
      ok: true,
      messages: ['(unused)'],
    },
    sam: {
      ok: true,
      messages: ['(unused)'],
    },
    leonardo: {
      ok: true,
      messages: ['(unused)'],
    },
  },
};

const cromwellStatusResponse = { 'Engine Database': { ok: true } };

describe('useWorkflowsStatus', () => {
  it('fetches Leo apps', async () => {
    // Arrange
    const listAppsV2: MockedFn<AppsAjaxContract['listAppsV2']> = jest.fn(async (_id) => []);

    asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listAppsV2 }));

    // Act
    await renderHookInAct(() => useWorkflowsStatus({ workspaceId }));

    // Assert
    expect(listAppsV2).toHaveBeenCalledWith(workspaceId);
  });

  describe('if fetching Leo apps fails', () => {
    it('returns unknown for all fields', async () => {
      // Arrange
      const listAppsV2: MockedFn<AppsAjaxContract['listAppsV2']> = jest.fn(async (_id) => {
        throw new Error('Something went wrong');
      });

      asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listAppsV2 }));

      // Act
      const { result: hookReturnRef } = await renderHookInAct(() => useWorkflowsStatus({ workspaceId }));

      // Assert
      expect(hookReturnRef.current.status).toEqual({
        totalVisibleApps: 'unknown',
        workflowsAppName: 'unknown',
        workflowsAppStatus: 'unknown',
        cromwellRunnerAppName: 'unknown',
        cromwellRunnerAppStatus: 'unknown',
        cbasProxyUrl: 'unknown',
        cromwellReaderProxyUrl: 'unknown',
        cromwellRunnerProxyUrl: 'unknown',
        cbasResponsive: 'unknown',
        cbasCromwellConnection: 'unknown',
        cbasEcmConnection: 'unknown',
        cbasSamConnection: 'unknown',
        cbasLeonardoConnection: 'unknown',
        cromwellReaderResponsive: 'unknown',
        cromwellReaderDatabaseConnection: 'unknown',
        cromwellRunnerResponsive: 'unknown',
        cromwellRunnerDatabaseConnection: 'unknown',
      });
    });
  });

  describe('if Leo apps are fetched successfully', () => {
    describe('if no apps are present', () => {
      it('returns number of apps and unknown for other fields', async () => {
        // Arrange
        const listAppsV2: MockedFn<AppsAjaxContract['listAppsV2']> = jest.fn(async (_id) => []);

        asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listAppsV2 }));

        // Act
        const { result: hookReturnRef } = await renderHookInAct(() => useWorkflowsStatus({ workspaceId }));

        // Assert
        expect(hookReturnRef.current.status).toEqual({
          totalVisibleApps: '0',
          workflowsAppName: 'unknown',
          workflowsAppStatus: 'unknown',
          cromwellRunnerAppName: 'unknown',
          cromwellRunnerAppStatus: 'unknown',
          cbasProxyUrl: 'unknown',
          cromwellReaderProxyUrl: 'unknown',
          cromwellRunnerProxyUrl: 'unknown',
          cbasResponsive: 'unknown',
          cbasCromwellConnection: 'unknown',
          cbasEcmConnection: 'unknown',
          cbasSamConnection: 'unknown',
          cbasLeonardoConnection: 'unknown',
          cromwellReaderResponsive: 'unknown',
          cromwellReaderDatabaseConnection: 'unknown',
          cromwellRunnerResponsive: 'unknown',
          cromwellRunnerDatabaseConnection: 'unknown',
        });
      });
    });
  });

  describe('if workflows app is present', () => {
    it('uses Leo app response to fill in fields while waiting for service status', async () => {
      // Arrange
      const listAppsV2: MockedFn<AppsAjaxContract['listAppsV2']> = jest.fn(async (_id) => [workflowsAppObject]);
      const cbasStatus: MockedFn<CbasAjaxContract['status']> = jest.fn((_root) => abandonedPromise());
      const engineStatus: MockedFn<CromwellAppAjaxContract['engineStatus']> = jest.fn((_root) => abandonedPromise());

      asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listAppsV2 }));
      asMockedFn(Cbas).mockReturnValue(partial<CbasAjaxContract>({ status: cbasStatus }));
      asMockedFn(CromwellApp).mockReturnValue(partial<CromwellAppAjaxContract>({ engineStatus }));

      // Act
      const { result: hookReturnRef } = await renderHookInAct(() => useWorkflowsStatus({ workspaceId }));

      // Assert
      // Note: remember 'null' means pending and 'unknown' means failed.
      expect(hookReturnRef.current.status).toEqual({
        totalVisibleApps: '1',
        workflowsAppName: 'wfa-blah',
        workflowsAppStatus: 'RUNNING',
        cromwellRunnerAppName: 'unknown',
        cromwellRunnerAppStatus: 'unknown',
        cbasProxyUrl: 'https://test-url/cbas-blah/',
        cromwellReaderProxyUrl: 'https://test-url/cromwell-reader-blah/',
        cromwellRunnerProxyUrl: 'unknown',
        cbasResponsive: null,
        cbasCromwellConnection: null,
        cbasEcmConnection: null,
        cbasSamConnection: null,
        cbasLeonardoConnection: null,
        cromwellReaderResponsive: null,
        cromwellReaderDatabaseConnection: null,
        cromwellRunnerResponsive: 'unknown',
        cromwellRunnerDatabaseConnection: 'unknown',
      });
      expect(cbasStatus).toHaveBeenCalledWith(workflowsAppObject.proxyUrls.cbas);
      expect(engineStatus).toHaveBeenCalledWith(workflowsAppObject.proxyUrls['cromwell-reader']);
    });

    it('uses CBAS and Cromwell status endpoints', async () => {
      // Arrange
      const listAppsV2: MockedFn<AppsAjaxContract['listAppsV2']> = jest.fn(async (_id) => [workflowsAppObject]);
      const cbasStatus: MockedFn<CbasAjaxContract['status']> = jest.fn(async (_root) => cbasStatusResponse);
      const engineStatus: MockedFn<CromwellAppAjaxContract['engineStatus']> = jest.fn(
        async (_root) => cromwellStatusResponse
      );

      asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listAppsV2 }));
      asMockedFn(Cbas).mockReturnValue(partial<CbasAjaxContract>({ status: cbasStatus }));
      asMockedFn(CromwellApp).mockReturnValue(partial<CromwellAppAjaxContract>({ engineStatus }));

      // Act
      const { result: hookReturnRef } = await renderHookInAct(() => useWorkflowsStatus({ workspaceId }));

      // Assert
      // Note: remember 'null' means pending and 'unknown' means failed.
      expect(hookReturnRef.current.status).toEqual({
        totalVisibleApps: '1',
        workflowsAppName: 'wfa-blah',
        workflowsAppStatus: 'RUNNING',
        cromwellRunnerAppName: 'unknown',
        cromwellRunnerAppStatus: 'unknown',
        cbasProxyUrl: 'https://test-url/cbas-blah/',
        cromwellReaderProxyUrl: 'https://test-url/cromwell-reader-blah/',
        cromwellRunnerProxyUrl: 'unknown',
        cbasResponsive: 'true',
        cbasCromwellConnection: 'true',
        cbasEcmConnection: 'true',
        cbasSamConnection: 'true',
        cbasLeonardoConnection: 'true',
        cromwellReaderResponsive: 'true',
        cromwellReaderDatabaseConnection: 'true',
        cromwellRunnerResponsive: 'unknown',
        cromwellRunnerDatabaseConnection: 'unknown',
      });
    });
  });

  describe('if CROMWELL_RUNNER_APP is present', () => {
    it('uses Leo app response to fill in fields while waiting for service status', async () => {
      // Arrange
      const listAppsV2: MockedFn<AppsAjaxContract['listAppsV2']> = jest.fn(async (_id) => [cromwellRunnerAppObject]);
      const engineStatus: MockedFn<CromwellAppAjaxContract['engineStatus']> = jest.fn((_root) => abandonedPromise());

      asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listAppsV2 }));
      asMockedFn(CromwellApp).mockReturnValue(partial<CromwellAppAjaxContract>({ engineStatus }));

      // Act
      const { result: hookReturnRef } = await renderHookInAct(() => useWorkflowsStatus({ workspaceId }));

      // Assert
      // Note: remember 'null' means pending and 'unknown' means failed.
      expect(hookReturnRef.current.status).toEqual({
        totalVisibleApps: '1',
        workflowsAppName: 'unknown',
        workflowsAppStatus: 'unknown',
        cromwellRunnerAppName: 'cra-blah',
        cromwellRunnerAppStatus: 'RUNNING',
        cbasProxyUrl: 'unknown',
        cromwellReaderProxyUrl: 'unknown',
        cromwellRunnerProxyUrl: 'https://test-url/cromwell-runner-blah/',
        cbasResponsive: 'unknown',
        cbasCromwellConnection: 'unknown',
        cbasEcmConnection: 'unknown',
        cbasSamConnection: 'unknown',
        cbasLeonardoConnection: 'unknown',
        cromwellReaderResponsive: 'unknown',
        cromwellReaderDatabaseConnection: 'unknown',
        cromwellRunnerResponsive: null,
        cromwellRunnerDatabaseConnection: null,
      });
      expect(engineStatus).toHaveBeenCalledWith(cromwellRunnerAppObject.proxyUrls['cromwell-runner']);
    });

    it('fetches values from Cromwell status endpoint', async () => {
      // Arrange
      const listAppsV2: MockedFn<AppsAjaxContract['listAppsV2']> = jest.fn(async (_id) => [cromwellRunnerAppObject]);
      const engineStatus: MockedFn<CromwellAppAjaxContract['engineStatus']> = jest.fn(
        async (_root) => cromwellStatusResponse
      );

      asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listAppsV2 }));
      asMockedFn(CromwellApp).mockReturnValue(partial<CromwellAppAjaxContract>({ engineStatus }));

      // Act
      const { result: hookReturnRef } = await renderHookInAct(() => useWorkflowsStatus({ workspaceId }));

      // Assert
      // Note: remember 'null' means pending and 'unknown' means failed.
      expect(hookReturnRef.current.status).toEqual({
        totalVisibleApps: '1',
        workflowsAppName: 'unknown',
        workflowsAppStatus: 'unknown',
        cromwellRunnerAppName: 'cra-blah',
        cromwellRunnerAppStatus: 'RUNNING',
        cbasProxyUrl: 'unknown',
        cromwellReaderProxyUrl: 'unknown',
        cromwellRunnerProxyUrl: 'https://test-url/cromwell-runner-blah/',
        cbasResponsive: 'unknown',
        cbasCromwellConnection: 'unknown',
        cbasEcmConnection: 'unknown',
        cbasSamConnection: 'unknown',
        cbasLeonardoConnection: 'unknown',
        cromwellReaderResponsive: 'unknown',
        cromwellReaderDatabaseConnection: 'unknown',
        cromwellRunnerResponsive: 'true',
        cromwellRunnerDatabaseConnection: 'true',
      });
    });
  });

  describe('if both apps are present', () => {
    it('fetches values from CBAS and both Cromwell status endpoints', async () => {
      // Arrange
      const listAppsV2: MockedFn<AppsAjaxContract['listAppsV2']> = jest.fn(async (_id) => [
        workflowsAppObject,
        cromwellRunnerAppObject,
      ]);
      const cbasStatus: MockedFn<CbasAjaxContract['status']> = jest.fn(async (_root) => cbasStatusResponse);
      const engineStatus: MockedFn<CromwellAppAjaxContract['engineStatus']> = jest.fn(
        async (_root) => cromwellStatusResponse
      );

      asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listAppsV2 }));
      asMockedFn(Cbas).mockReturnValue(partial<CbasAjaxContract>({ status: cbasStatus }));
      asMockedFn(CromwellApp).mockReturnValue(partial<CromwellAppAjaxContract>({ engineStatus }));

      // Act
      const { result: hookReturnRef } = await renderHookInAct(() => useWorkflowsStatus({ workspaceId }));

      // Assert
      // Note: remember 'null' means pending and 'unknown' means failed.
      expect(hookReturnRef.current.status).toEqual({
        totalVisibleApps: '2',
        workflowsAppName: 'wfa-blah',
        workflowsAppStatus: 'RUNNING',
        cromwellRunnerAppName: 'cra-blah',
        cromwellRunnerAppStatus: 'RUNNING',
        cbasProxyUrl: 'https://test-url/cbas-blah/',
        cromwellReaderProxyUrl: 'https://test-url/cromwell-reader-blah/',
        cromwellRunnerProxyUrl: 'https://test-url/cromwell-runner-blah/',
        cbasResponsive: 'true',
        cbasCromwellConnection: 'true',
        cbasEcmConnection: 'true',
        cbasSamConnection: 'true',
        cbasLeonardoConnection: 'true',
        cromwellReaderResponsive: 'true',
        cromwellReaderDatabaseConnection: 'true',
        cromwellRunnerResponsive: 'true',
        cromwellRunnerDatabaseConnection: 'true',
      });
    });
  });
});
