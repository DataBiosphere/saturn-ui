import { act, renderHook } from '@testing-library/react';
import { fetchWDS } from 'src/libs/ajax/ajax-common';
import { Apps, AppsAjaxContract } from 'src/libs/ajax/leonardo/Apps';
import { ListAppItem } from 'src/libs/ajax/leonardo/models/app-models';
import { WorkspaceData, WorkspaceDataAjaxContract } from 'src/libs/ajax/WorkspaceDataService';
import { asMockedFn, MockedFn, partial } from 'src/testing/test-utils';

import { useDataTableProvider } from './useDataTableProvider';

const CWDS_WORKSPACE_ID = 'cwdsWorkspaceId';
const WDS_APP_WORKSPACE_ID = 'wdsAppWorkspaceId';

type AjaxCommonExports = typeof import('src/libs/ajax/ajax-common');

jest.mock('src/libs/ajax/leonardo/Apps');
jest.mock('src/libs/ajax/WorkspaceDataService');

jest.mock('src/libs/ajax/ajax-common', (): AjaxCommonExports => {
  return {
    ...jest.requireActual<AjaxCommonExports>('src/libs/ajax/ajax-common'),
    fetchWDS: jest.fn().mockImplementation(() => {
      return jest.fn((path: string) => {
        // collections/v1/{workspaceId}
        if (path.includes(CWDS_WORKSPACE_ID)) {
          return Promise.resolve({
            status: 200,
            json: jest.fn().mockResolvedValue([
              {
                id: CWDS_WORKSPACE_ID,
                name: 'default',
                description: 'default',
              },
            ]),
          });
        }
        return Promise.resolve({
          json: jest.fn().mockResolvedValue([]),
        });
      });
    }),
  };
});

const cwdsUrlRoot = 'https://cwds.test.url';

jest.mock('src/libs/config', () => ({
  ...jest.requireActual('src/libs/config'),
  getConfig: jest.fn().mockReturnValue({ cwdsUrlRoot }),
}));

describe('useDataTableProvider', () => {
  const listAppResponse = partial<ListAppItem>({
    proxyUrls: {
      wds: cwdsUrlRoot,
    },
    appType: 'WDS',
    status: 'RUNNING',
  });

  const mockGetCapabilities: MockedFn<WorkspaceDataAjaxContract['getCapabilities']> = jest.fn(async (_root) => ({}));
  const mockGetSchema: MockedFn<WorkspaceDataAjaxContract['getSchema']> = jest.fn(async (_root, _schema) => []);
  const mockListAppsV2: MockedFn<AppsAjaxContract['listAppsV2']> = jest.fn();
  mockListAppsV2.mockResolvedValue([listAppResponse]);

  asMockedFn(WorkspaceData).mockReturnValue(
    partial<WorkspaceDataAjaxContract>({
      getCapabilities: mockGetCapabilities,
      getSchema: mockGetSchema,
    })
  );
  asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listAppsV2: mockListAppsV2 }));

  it('should only check CWDS once', async () => {
    // Arrange
    // Act
    await act(() => {
      renderHook(() => useDataTableProvider(WDS_APP_WORKSPACE_ID)); // It doesn't matter which workspaceId is used in this test
    });

    // Assert
    // Fetch wds might be called for other purpose, we only care about the call to check for collections
    const mockFetchWDS = fetchWDS as jest.Mock;
    const mockInnerFunction = mockFetchWDS.mock.results[0].value;

    // Now verify that we only called CWDS once
    expect(mockInnerFunction).toHaveBeenCalledTimes(1);
    expect(mockInnerFunction).toHaveBeenCalledWith(`collections/v1/${WDS_APP_WORKSPACE_ID}`, expect.anything());
  });

  it('should not call list apps if cwds is in use', async () => {
    // Arrange
    // Act
    await act(() => {
      renderHook(() => useDataTableProvider(CWDS_WORKSPACE_ID));
    });

    // Assert
    expect(mockListAppsV2).not.toHaveBeenCalled();
  });

  it('should call list apps if cwds is not in use', async () => {
    // Arrange
    // Act
    await act(() => {
      renderHook(() => useDataTableProvider(WDS_APP_WORKSPACE_ID));
    });

    // Assert
    expect(mockListAppsV2).toHaveBeenCalled();
  });
});
