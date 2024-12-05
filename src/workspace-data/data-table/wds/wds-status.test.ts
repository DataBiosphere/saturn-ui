import { abandonedPromise } from '@terra-ui-packages/core-utils';
import { Apps, AppsAjaxContract } from 'src/libs/ajax/leonardo/Apps';
import { ListAppItem } from 'src/libs/ajax/leonardo/models/app-models';
import { WorkspaceData, WorkspaceDataAjaxContract } from 'src/libs/ajax/WorkspaceDataService';
import { WDSCloneStatusResponse } from 'src/libs/ajax/WorkspaceDataService';
import { asMockedFn, MockedFn, partial, renderHookInAct } from 'src/testing/test-utils';

import { useWdsStatus } from './wds-status';

jest.mock('src/libs/ajax/leonardo/Apps');
jest.mock('src/libs/ajax/WorkspaceDataService');

const getWorkspaceDataMocks = () => {
  const getVersion: MockedFn<WorkspaceDataAjaxContract['getVersion']> = jest.fn((_root) => abandonedPromise());
  const getStatus: MockedFn<WorkspaceDataAjaxContract['getStatus']> = jest.fn((_root) => abandonedPromise());
  const listCollections: MockedFn<WorkspaceDataAjaxContract['listCollections']> = jest.fn((_root, _workspaceId) =>
    abandonedPromise()
  );
  const getCloneStatus: MockedFn<WorkspaceDataAjaxContract['getCloneStatus']> = jest.fn((_root) => abandonedPromise());

  return { getVersion, getStatus, listCollections, getCloneStatus };
};

describe('useWdsStatus', () => {
  const workspaceId = '6601fdbb-4b53-41da-87b2-81385f4a760e';

  it('fetches Leo apps', async () => {
    // Arrange
    const listAppsV2: MockedFn<AppsAjaxContract['listAppsV2']> = jest.fn();
    listAppsV2.mockResolvedValue([]);
    asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listAppsV2 }));

    // Act
    await renderHookInAct(() => useWdsStatus({ workspaceId }));

    // Assert
    expect(listAppsV2).toHaveBeenCalledWith(workspaceId);
  });

  describe('if fetching Leo apps fails', () => {
    it('returns unknown for all fields', async () => {
      // Arrange
      const listAppsV2: MockedFn<AppsAjaxContract['listAppsV2']> = jest.fn();
      listAppsV2.mockRejectedValue(new Error('Something went wrong'));
      asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listAppsV2 }));

      // Act
      const { result: hookReturnRef } = await renderHookInAct(() => useWdsStatus({ workspaceId }));

      // Assert
      expect(hookReturnRef.current.status).toEqual({
        numApps: 'unknown',
        appName: 'unknown',
        appStatus: 'unknown',
        appErrorMessage: null,
        proxyUrl: 'unknown',
        wdsResponsive: 'unknown',
        version: 'unknown',
        chartVersion: 'unknown',
        image: 'unknown',
        wdsStatus: 'unresponsive',
        wdsDbStatus: 'unknown',
        wdsPingStatus: 'unknown',
        wdsIamStatus: 'unknown',
        defaultInstanceExists: 'unknown',
        cloneSourceWorkspaceId: 'unknown',
        cloneStatus: 'unknown',
        cloneErrorMessage: 'unknown',
      });
    });
  });

  describe('if Leo apps are fetched successfully', () => {
    describe('if no WDS app is present', () => {
      it('returns number of apps and unknown for other fields', async () => {
        // Arrange
        const listAppsV2: MockedFn<AppsAjaxContract['listAppsV2']> = jest.fn();
        listAppsV2.mockResolvedValue([]);
        asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listAppsV2 }));

        // Act
        const { result: hookReturnRef } = await renderHookInAct(() => useWdsStatus({ workspaceId }));

        // Assert
        expect(hookReturnRef.current.status).toEqual({
          numApps: '0',
          appName: 'unknown',
          appStatus: 'unknown',
          appErrorMessage: null,
          proxyUrl: 'unknown',
          wdsResponsive: 'unknown',
          version: 'unknown',
          chartVersion: 'unknown',
          image: 'unknown',
          wdsStatus: 'unresponsive',
          wdsDbStatus: 'unknown',
          wdsPingStatus: 'unknown',
          wdsIamStatus: 'unknown',
          defaultInstanceExists: 'unknown',
          cloneSourceWorkspaceId: 'unknown',
          cloneStatus: 'unknown',
          cloneErrorMessage: 'unknown',
        });
      });
    });
  });

  describe('if WDS app is present', () => {
    const wdsApp: ListAppItem = {
      workspaceId: '6601fdbb-4b53-41da-87b2-81385f4a760e',
      cloudContext: {
        cloudProvider: 'AZURE',
        cloudResource:
          '0cb7a640-45a2-4ed6-be9f-63519f86e04b/ffd1069e-e34f-4d87-a8b8-44abfcba39af/mrg-terra-dev-previ-20230623095104',
      },
      kubernetesRuntimeConfig: {
        numNodes: 1,
        machineType: 'Standard_A2_v2',
        autoscalingEnabled: false,
      },
      errors: [],
      status: 'RUNNING',
      proxyUrls: {
        wds: 'https://lz34dd00bf3fdaa72f755eeea8f928bab7cd135043043d59d5.servicebus.windows.net/wds-6601fdbb-4b53-41da-87b2-81385f4a760e-6601fdbb-4b53-41da-87b2-81385f4a760e/',
      },
      appName: 'wds-6601fdbb-4b53-41da-87b2-81385f4a760e',
      appType: 'WDS',
      diskName: null,
      auditInfo: {
        creator: 'userWexample.com',
        createdDate: '2023-07-11T18:59:09.369822Z',
        destroyedDate: null,
        dateAccessed: '2023-07-11T18:59:09.369822Z',
      },
      accessScope: 'WORKSPACE_SHARED',
      labels: {},
      region: 'is-central1',
    };

    it('updates status with app name and status', async () => {
      // Arrange
      const listAppsV2: MockedFn<AppsAjaxContract['listAppsV2']> = jest.fn();
      listAppsV2.mockResolvedValue([wdsApp]);
      asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listAppsV2 }));

      asMockedFn(WorkspaceData).mockReturnValue(
        partial<WorkspaceDataAjaxContract>({
          ...getWorkspaceDataMocks(),
        })
      );

      // Act
      const { result: hookReturnRef } = await renderHookInAct(() => useWdsStatus({ workspaceId }));

      // Assert
      expect(hookReturnRef.current.status).toEqual({
        numApps: '1',
        appName: 'wds-6601fdbb-4b53-41da-87b2-81385f4a760e',
        appStatus: 'RUNNING',
        appErrorMessage: null,
        proxyUrl:
          'https://lz34dd00bf3fdaa72f755eeea8f928bab7cd135043043d59d5.servicebus.windows.net/wds-6601fdbb-4b53-41da-87b2-81385f4a760e-6601fdbb-4b53-41da-87b2-81385f4a760e/',
        wdsResponsive: null,
        version: null,
        chartVersion: null,
        image: null,
        wdsStatus: null,
        wdsDbStatus: null,
        wdsPingStatus: null,
        wdsIamStatus: null,
        defaultInstanceExists: null,
        cloneSourceWorkspaceId: null,
        cloneStatus: null,
        cloneErrorMessage: null,
      });
    });

    it('requests WDS app version, status, instances, and clone status if app is running', async () => {
      // Arrange
      const { getVersion, getStatus, listCollections, getCloneStatus } = getWorkspaceDataMocks();

      const listAppsV2: MockedFn<AppsAjaxContract['listAppsV2']> = jest.fn();
      listAppsV2.mockResolvedValue([wdsApp]);
      asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listAppsV2 }));

      asMockedFn(WorkspaceData).mockReturnValue(
        partial<WorkspaceDataAjaxContract>({
          getVersion,
          getStatus,
          listCollections,
          getCloneStatus,
        })
      );

      // Act
      await renderHookInAct(() => useWdsStatus({ workspaceId }));

      // Assert
      expect(getVersion).toHaveBeenCalledWith(wdsApp.proxyUrls.wds);
      expect(getStatus).toHaveBeenCalledWith(wdsApp.proxyUrls.wds);
      expect(listCollections).toHaveBeenCalledWith(wdsApp.proxyUrls.wds, workspaceId);
      expect(getCloneStatus).toHaveBeenCalledWith(wdsApp.proxyUrls.wds);
    });

    it('does not request WDS app version, status, instances, and clone status if app is not running', async () => {
      // Arrange
      const { getVersion, getStatus, listCollections, getCloneStatus } = getWorkspaceDataMocks();

      asMockedFn(Apps).mockReturnValue(
        partial<AppsAjaxContract>({
          listAppsV2: jest.fn(async () => [{ ...wdsApp, status: 'ERROR' } satisfies ListAppItem]),
        })
      );
      asMockedFn(WorkspaceData).mockReturnValue(
        partial<WorkspaceDataAjaxContract>({
          getVersion,
          getStatus,
          listCollections,
          getCloneStatus,
        })
      );

      // Act
      const { result: hookReturnRef } = await renderHookInAct(() => useWdsStatus({ workspaceId }));

      // Assert
      expect(getVersion).not.toHaveBeenCalled();
      expect(getStatus).not.toHaveBeenCalled();
      expect(listCollections).not.toHaveBeenCalled();
      expect(getCloneStatus).not.toHaveBeenCalled();

      expect(hookReturnRef.current.status).toEqual({
        appName: 'wds-6601fdbb-4b53-41da-87b2-81385f4a760e',
        appStatus: 'ERROR',
        appErrorMessage: null,
        chartVersion: 'unknown',
        defaultInstanceExists: 'unknown',
        image: 'unknown',
        numApps: '1',
        proxyUrl:
          'https://lz34dd00bf3fdaa72f755eeea8f928bab7cd135043043d59d5.servicebus.windows.net/wds-6601fdbb-4b53-41da-87b2-81385f4a760e-6601fdbb-4b53-41da-87b2-81385f4a760e/',
        version: 'unknown',
        wdsDbStatus: 'unknown',
        wdsIamStatus: 'unknown',
        wdsPingStatus: 'unknown',
        wdsResponsive: 'unknown',
        wdsStatus: 'unresponsive',
        cloneSourceWorkspaceId: null,
        cloneStatus: null,
        cloneErrorMessage: null,
      });
    });

    it('returns error message if app is in error state', async () => {
      // Arrange
      const { getVersion, getStatus, listCollections, getCloneStatus } = getWorkspaceDataMocks();

      asMockedFn(Apps).mockReturnValue(
        partial<AppsAjaxContract>({
          listAppsV2: jest.fn(async () => [
            {
              ...wdsApp,
              status: 'ERROR',
              errors: [
                {
                  errorMessage: 'Something went wrong!',
                  timestamp: '2023-07-20T18:49:17.264656',
                  action: 'action',
                  source: 'source',
                  googleErrorCode: null,
                  traceId: null,
                },
              ],
            } satisfies ListAppItem,
          ]),
        })
      );
      asMockedFn(WorkspaceData).mockReturnValue(
        partial<WorkspaceDataAjaxContract>({
          getVersion,
          getStatus,
          listCollections,
          getCloneStatus,
        })
      );

      // Act
      const { result: hookReturnRef } = await renderHookInAct(() => useWdsStatus({ workspaceId }));

      // Assert
      expect(getVersion).not.toHaveBeenCalled();
      expect(getStatus).not.toHaveBeenCalled();
      expect(listCollections).not.toHaveBeenCalled();
      expect(getCloneStatus).not.toHaveBeenCalled();

      expect(hookReturnRef.current.status).toEqual({
        appName: 'wds-6601fdbb-4b53-41da-87b2-81385f4a760e',
        appStatus: 'ERROR',
        appErrorMessage: 'Something went wrong!',
        chartVersion: 'unknown',
        defaultInstanceExists: 'unknown',
        image: 'unknown',
        numApps: '1',
        proxyUrl:
          'https://lz34dd00bf3fdaa72f755eeea8f928bab7cd135043043d59d5.servicebus.windows.net/wds-6601fdbb-4b53-41da-87b2-81385f4a760e-6601fdbb-4b53-41da-87b2-81385f4a760e/',
        version: 'unknown',
        wdsDbStatus: 'unknown',
        wdsIamStatus: 'unknown',
        wdsPingStatus: 'unknown',
        wdsResponsive: 'unknown',
        wdsStatus: 'unresponsive',
        cloneSourceWorkspaceId: null,
        cloneStatus: null,
        cloneErrorMessage: null,
      });
    });

    describe('version request', () => {
      describe('if version request fails', () => {
        it('updates status with unknown for version fields', async () => {
          asMockedFn(Apps).mockReturnValue(
            partial<AppsAjaxContract>({
              listAppsV2: jest.fn(async () => [wdsApp]),
            })
          );
          asMockedFn(WorkspaceData).mockReturnValue(
            partial<WorkspaceDataAjaxContract>({
              ...getWorkspaceDataMocks(),
              getVersion: jest.fn().mockRejectedValue(new Error('Something went wrong')),
            })
          );

          // Act
          const { result: renderHookRef } = await renderHookInAct(() => useWdsStatus({ workspaceId }));

          // Assert
          expect(renderHookRef.current.status).toEqual(
            expect.objectContaining({
              wdsResponsive: 'false',
              version: 'unknown',
              chartVersion: 'unknown',
              image: 'unknown',
            })
          );
        });
      });

      describe('if version request succeeds', () => {
        it('updates status with git revision', async () => {
          const mockVersion = {
            app: {
              'chart-version': 'wds-0.24.0',
              image: 'us.gcr.io/broad-dsp-gcr-public/terra-workspace-data-service:eaf3f31',
            },
            git: { branch: 'main', commit: { id: 'c87286c', time: '2023-06-29T17:06:07Z' } },
            build: {
              artifact: 'service',
              name: 'service',
              time: '2023-06-29T21:19:57.307Z',
              version: '0.2.92-SNAPSHOT',
              group: 'org.databiosphere',
            },
          };
          asMockedFn(Apps).mockReturnValue(
            partial<AppsAjaxContract>({
              listAppsV2: jest.fn(async () => [wdsApp]),
            })
          );
          asMockedFn(WorkspaceData).mockReturnValue(
            partial<WorkspaceDataAjaxContract>({
              ...getWorkspaceDataMocks(),
              getVersion: jest.fn(async () => mockVersion),
            })
          );

          // Act
          const { result: renderHookRef } = await renderHookInAct(() => useWdsStatus({ workspaceId }));

          // Assert
          expect(renderHookRef.current.status).toEqual(
            expect.objectContaining({
              wdsResponsive: 'true',
              version: 'c87286c',
              chartVersion: 'wds-0.24.0',
              image: 'us.gcr.io/broad-dsp-gcr-public/terra-workspace-data-service:eaf3f31',
            })
          );
        });

        it('handles version response without app', async () => {
          const mockVersion = {
            git: { branch: 'main', commit: { id: 'c87286c', time: '2023-06-29T17:06:07Z' } },
            build: {
              artifact: 'service',
              name: 'service',
              time: '2023-06-29T21:19:57.307Z',
              version: '0.2.92-SNAPSHOT',
              group: 'org.databiosphere',
            },
          };
          asMockedFn(Apps).mockReturnValue(
            partial<AppsAjaxContract>({
              listAppsV2: jest.fn().mockResolvedValue([wdsApp]),
            })
          );
          asMockedFn(WorkspaceData).mockReturnValue(
            partial<WorkspaceDataAjaxContract>({
              ...getWorkspaceDataMocks(),
              getVersion: jest.fn(async () => mockVersion),
            })
          );

          // Act
          const { result: renderHookRef } = await renderHookInAct(() => useWdsStatus({ workspaceId }));

          // Assert
          expect(renderHookRef.current.status).toEqual(
            expect.objectContaining({
              wdsResponsive: 'true',
              version: 'c87286c',
              chartVersion: 'unknown',
              image: 'unknown',
            })
          );
        });
      });
    });

    describe('status request', () => {
      describe('if status request fails', () => {
        it('updates status with unknown for status fields', async () => {
          asMockedFn(Apps).mockReturnValue(
            partial<AppsAjaxContract>({
              listAppsV2: jest.fn(async () => [wdsApp]),
            })
          );
          asMockedFn(WorkspaceData).mockReturnValue(
            partial<WorkspaceDataAjaxContract>({
              ...getWorkspaceDataMocks(),
              getStatus: jest.fn().mockRejectedValue(new Error('Something went wrong')),
            })
          );

          // Act
          const { result: renderHookRef } = await renderHookInAct(() => useWdsStatus({ workspaceId }));

          // Assert
          expect(renderHookRef.current.status).toEqual(
            expect.objectContaining({
              wdsStatus: 'unresponsive',
              wdsDbStatus: 'unknown',
              wdsPingStatus: 'unknown',
              wdsIamStatus: 'unknown',
            })
          );
        });
      });

      describe('if status request succeeds', () => {
        it('updates status with WDS status', async () => {
          const mockStatus = {
            status: 'UP',
            components: {
              Permissions: { status: 'UP', details: { samOK: true } },
              db: {
                status: 'UP',
                components: {
                  mainDb: { status: 'UP', details: { database: 'PostgreSQL', validationQuery: 'isValid()' } },
                  streamingDs: { status: 'UP', details: { database: 'PostgreSQL', validationQuery: 'isValid()' } },
                },
              },
              diskSpace: {
                status: 'UP',
                details: { total: 133003395072, free: 108678414336, threshold: 10485760, exists: true },
              },
              livenessState: { status: 'UP' },
              ping: { status: 'UP' },
              readinessState: { status: 'UP' },
            },
            groups: ['liveness', 'readiness'],
          };
          asMockedFn(Apps).mockReturnValue(
            partial<AppsAjaxContract>({
              listAppsV2: jest.fn(async () => [wdsApp]),
            })
          );
          asMockedFn(WorkspaceData).mockReturnValue(
            partial<WorkspaceDataAjaxContract>({
              ...getWorkspaceDataMocks(),
              getStatus: jest.fn(async () => mockStatus),
            })
          );

          // Act
          const { result: renderHookRef } = await renderHookInAct(() => useWdsStatus({ workspaceId }));

          // Assert
          expect(renderHookRef.current.status).toEqual(
            expect.objectContaining({
              wdsStatus: 'UP',
              wdsDbStatus: 'UP',
              wdsPingStatus: 'UP',
              wdsIamStatus: 'UP',
            })
          );
        });

        it('handles status response without permissions', async () => {
          const mockStatus = {
            status: 'UP',
            components: {
              db: {
                status: 'UP',
                components: {
                  mainDb: { status: 'UP', details: { database: 'PostgreSQL', validationQuery: 'isValid()' } },
                  streamingDs: { status: 'UP', details: { database: 'PostgreSQL', validationQuery: 'isValid()' } },
                },
              },
              diskSpace: {
                status: 'UP',
                details: { total: 133003395072, free: 108678414336, threshold: 10485760, exists: true },
              },
              livenessState: { status: 'UP' },
              ping: { status: 'UP' },
              readinessState: { status: 'UP' },
            },
            groups: ['liveness', 'readiness'],
          };
          asMockedFn(Apps).mockReturnValue(
            partial<AppsAjaxContract>({
              listAppsV2: jest.fn(async () => [wdsApp]),
            })
          );
          asMockedFn(WorkspaceData).mockReturnValue(
            partial<WorkspaceDataAjaxContract>({
              ...getWorkspaceDataMocks(),
              getStatus: jest.fn(async () => mockStatus),
            })
          );

          // Act
          const { result: renderHookRef } = await renderHookInAct(() => useWdsStatus({ workspaceId }));

          // Assert
          expect(renderHookRef.current.status).toEqual(
            expect.objectContaining({
              wdsStatus: 'UP',
              wdsDbStatus: 'UP',
              wdsPingStatus: 'UP',
              wdsIamStatus: 'disabled',
            })
          );
        });
      });
    });

    describe('instances request', () => {
      describe('if instances request fails', () => {
        it('updates status with unknown for instances', async () => {
          asMockedFn(Apps).mockReturnValue(
            partial<AppsAjaxContract>({
              listAppsV2: jest.fn().mockResolvedValue([wdsApp]),
            })
          );
          asMockedFn(WorkspaceData).mockReturnValue(
            partial<WorkspaceDataAjaxContract>({
              ...getWorkspaceDataMocks(),
              listCollections: jest.fn().mockRejectedValue(new Error('Something went wrong')),
            })
          );

          // Act
          const { result: renderHookRef } = await renderHookInAct(() => useWdsStatus({ workspaceId }));

          // Assert
          expect(renderHookRef.current.status).toEqual(
            expect.objectContaining({
              defaultInstanceExists: 'unknown',
            })
          );
        });
      });

      describe('if instances request succeeds', () => {
        it('updates status with defaultInstanceExists field', async () => {
          const mockInstances = ['6601fdbb-4b53-41da-87b2-81385f4a760e'];
          asMockedFn(Apps).mockReturnValue(
            partial<AppsAjaxContract>({
              listAppsV2: jest.fn().mockResolvedValue([wdsApp]),
            })
          );
          asMockedFn(WorkspaceData).mockReturnValue(
            partial<WorkspaceDataAjaxContract>({
              ...getWorkspaceDataMocks(),
              listCollections: jest.fn(async () => mockInstances),
            })
          );

          // Act
          const { result: renderHookRef } = await renderHookInAct(() => useWdsStatus({ workspaceId }));

          // Assert
          expect(renderHookRef.current.status).toEqual(
            expect.objectContaining({
              defaultInstanceExists: 'true',
            })
          );
        });
      });
    });

    describe('clone status request', () => {
      describe('if clone status request fails', () => {
        it('does not update status on a 404 response', async () => {
          asMockedFn(Apps).mockReturnValue(
            partial<AppsAjaxContract>({
              listAppsV2: jest.fn().mockResolvedValue([wdsApp]),
            })
          );
          asMockedFn(WorkspaceData).mockReturnValue(
            partial<WorkspaceDataAjaxContract>({
              ...getWorkspaceDataMocks(),
              getCloneStatus: jest.fn().mockRejectedValue(new Response('', { status: 404 })),
            })
          );

          // Act
          const { result: renderHookRef } = await renderHookInAct(() => useWdsStatus({ workspaceId }));

          // Assert
          expect(renderHookRef.current.status).toEqual(
            expect.objectContaining({
              cloneSourceWorkspaceId: null,
              cloneStatus: null,
            })
          );
        });

        it('updates status with unknown for clone status for other error responses', async () => {
          asMockedFn(Apps).mockReturnValue(
            partial<AppsAjaxContract>({
              listAppsV2: jest.fn().mockResolvedValue([wdsApp]),
            })
          );
          asMockedFn(WorkspaceData).mockReturnValue(
            partial<WorkspaceDataAjaxContract>({
              ...getWorkspaceDataMocks(),
              listCollections: jest.fn().mockRejectedValue(new Error('Something went wrong')),
            })
          );

          // Act
          const { result: renderHookRef } = await renderHookInAct(() => useWdsStatus({ workspaceId }));

          // Assert
          expect(renderHookRef.current.status).toEqual(
            expect.objectContaining({
              defaultInstanceExists: 'unknown',
            })
          );
        });
      });

      describe('if clone status request succeeds', () => {
        it('updates status with clone status fields', async () => {
          const mockCloneStatus: WDSCloneStatusResponse = {
            created: '2023-07-20T18:49:17.264656',
            jobId: '761fd9ae-8fa1-4805-94b2-be27997249c7',
            result: { sourceWorkspaceId: 'b3cc4ed2-678c-483f-9953-5d4789d5fa1b', status: 'RESTORESUCCEEDED' },
            status: 'SUCCEEDED',
            updated: '2023-07-20T18:50:28.264989',
          };
          asMockedFn(Apps).mockReturnValue(
            partial<AppsAjaxContract>({
              listAppsV2: jest.fn().mockResolvedValue([wdsApp]),
            })
          );
          asMockedFn(WorkspaceData).mockReturnValue(
            partial<WorkspaceDataAjaxContract>({
              ...getWorkspaceDataMocks(),
              getCloneStatus: jest.fn().mockResolvedValue(mockCloneStatus),
            })
          );

          // Act
          const { result: renderHookRef } = await renderHookInAct(() => useWdsStatus({ workspaceId }));

          // Assert
          expect(renderHookRef.current.status).toEqual(
            expect.objectContaining({
              cloneSourceWorkspaceId: 'b3cc4ed2-678c-483f-9953-5d4789d5fa1b',
              cloneStatus: 'RESTORESUCCEEDED',
              cloneErrorMessage: null,
            })
          );
        });
      });
    });
  });

  it('resets status and reloads data when re-rendered for a different workspace', async () => {
    // Arrange
    const listAppsV2 = jest.fn().mockResolvedValue([]);
    asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listAppsV2 }));

    // Arrange
    const { result: renderHookRef, rerender } = await renderHookInAct(useWdsStatus, { initialProps: { workspaceId } });
    expect(renderHookRef.current.status).toEqual({
      numApps: '0',
      appName: 'unknown',
      appErrorMessage: null,
      appStatus: 'unknown',
      proxyUrl: 'unknown',
      wdsResponsive: 'unknown',
      version: 'unknown',
      chartVersion: 'unknown',
      image: 'unknown',
      wdsStatus: 'unresponsive',
      wdsDbStatus: 'unknown',
      wdsPingStatus: 'unknown',
      wdsIamStatus: 'unknown',
      defaultInstanceExists: 'unknown',
      cloneSourceWorkspaceId: 'unknown',
      cloneStatus: 'unknown',
      cloneErrorMessage: 'unknown',
    });

    listAppsV2.mockReturnValue(abandonedPromise());

    // Act
    const otherWorkspaceId = 'other-workspace';
    rerender({ workspaceId: otherWorkspaceId });

    // Assert
    expect(renderHookRef.current.status).toEqual({
      numApps: null,
      appName: null,
      appStatus: null,
      appErrorMessage: null,
      proxyUrl: null,
      wdsResponsive: null,
      version: null,
      chartVersion: null,
      image: null,
      wdsStatus: null,
      wdsDbStatus: null,
      wdsPingStatus: null,
      wdsIamStatus: null,
      defaultInstanceExists: null,
      cloneSourceWorkspaceId: null,
      cloneStatus: null,
      cloneErrorMessage: null,
    });

    expect(listAppsV2).toHaveBeenCalledWith(otherWorkspaceId);
  });
});
