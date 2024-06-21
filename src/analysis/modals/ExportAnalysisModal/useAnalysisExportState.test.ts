import { act, renderHook } from '@testing-library/react';
import { AnalysisFile } from 'src/analysis/useAnalysisFiles';
import { AbsolutePath, DisplayName, FileExtension, FileName } from 'src/analysis/utils/file-utils';
import { runtimeToolLabels } from 'src/analysis/utils/tool-utils';
import { AnalysisProvider } from 'src/libs/ajax/analysis-providers/AnalysisProvider';
import { useMetricsEvent } from 'src/libs/ajax/metrics/useMetrics';
import { asMockedFn } from 'src/testing/test-utils';
import { useWorkspaces } from 'src/workspaces/common/state/useWorkspaces';
import { WorkspaceInfo, WorkspaceWrapper } from 'src/workspaces/utils';

import { errors, useAnalysisExportState } from './useAnalysisExportState';

const analysis1: AnalysisFile = {
  name: 'myDir/Analysis1.ipynb' as AbsolutePath,
  ext: 'ipynb' as FileExtension,
  displayName: 'Analysis1.ipynb' as DisplayName,
  fileName: 'Analysis1.ipynb' as FileName,
  lastModified: 0,
  tool: runtimeToolLabels.Jupyter,
  cloudProvider: 'GCP',
};

const analysis2: AnalysisFile = {
  name: 'myDir/Analysis2.ipynb' as AbsolutePath,
  ext: 'ipynb' as FileExtension,
  displayName: 'Analysis2.ipynb' as DisplayName,
  fileName: 'Analysis2.ipynb' as FileName,
  lastModified: 0,
  tool: runtimeToolLabels.Jupyter,
  cloudProvider: 'GCP',
};

type UseMetricsExports = typeof import('src/libs/ajax/metrics/useMetrics');
jest.mock(
  'src/libs/ajax/metrics/useMetrics',
  (): UseMetricsExports => ({
    ...jest.requireActual('src/libs/ajax/metrics/useMetrics'),
    useMetricsEvent: jest.fn(),
  })
);

type UseWorkspacesExports = typeof import('src/workspaces/common/state/useWorkspaces');
jest.mock('src/workspaces/common/state/useWorkspaces', (): UseWorkspacesExports => {
  return {
    ...jest.requireActual<UseWorkspacesExports>('src/workspaces/common/state/useWorkspaces'),
    useWorkspaces: jest.fn(),
  };
});

type AnalysisProviderExports = typeof import('src/libs/ajax/analysis-providers/AnalysisProvider');
jest.mock(
  'src/libs/ajax/analysis-providers/AnalysisProvider',
  (): AnalysisProviderExports => ({
    ...jest.requireActual('src/libs/ajax/analysis-providers/AnalysisProvider'),
    AnalysisProvider: {
      listAnalyses: jest.fn(),
      copyAnalysis: jest.fn(),
      deleteAnalysis: jest.fn(),
      createAnalysis: jest.fn(),
    },
  })
);

const useMetricsEventWatcher = jest.fn();

beforeEach(() => {
  asMockedFn(useMetricsEvent).mockImplementation(() => ({ captureEvent: useMetricsEventWatcher }));
});

describe('useAnalysisExportState', () => {
  it('handles initial state (GCP workspace)', () => {
    // Arrange
    asMockedFn(useWorkspaces).mockReturnValue({
      workspaces: [],
      loading: false,
      refresh: jest.fn(),
      status: 'Ready',
    });

    const sourceWorkspaceInfo: Partial<WorkspaceInfo> = {
      googleProject: 'GoogleProject123',
      bucketName: 'Bucket123',
    };
    const sourceWorkspace: Partial<WorkspaceWrapper> = {
      workspace: sourceWorkspaceInfo as WorkspaceInfo,
    };

    // Act
    const renderedHook = renderHook(() =>
      useAnalysisExportState(sourceWorkspace as WorkspaceWrapper, 'PrintName123', runtimeToolLabels.Jupyter)
    );

    // Assert
    const hookResult = renderedHook.result.current;
    expect(hookResult.selectedWorkspace).toBe(null);
    expect(hookResult.workspaces).toEqual([]);
    const expectedExistingNames: typeof hookResult.existingAnalysisFiles = {
      status: 'None',
    };
    expect(hookResult.existingAnalysisFiles).toEqual(expectedExistingNames);
    const expectedPendingCopy: typeof hookResult.pendingCopy = {
      status: 'None',
    };
    expect(hookResult.pendingCopy).toEqual(expectedPendingCopy);
  });
  it('selects workspace (GCP)', async () => {
    // Arrange
    const workspace1: Partial<WorkspaceInfo> = {
      workspaceId: 'Workspace1',
    };
    const workspace2: Partial<WorkspaceInfo> = {
      workspaceId: 'Workspace2',
    };
    asMockedFn(useWorkspaces).mockReturnValue({
      workspaces: [
        { workspace: workspace1 as WorkspaceInfo } as WorkspaceWrapper,
        { workspace: workspace2 as WorkspaceInfo } as WorkspaceWrapper,
      ],
      loading: false,
      refresh: jest.fn(),
      status: 'Ready',
    });
    asMockedFn(AnalysisProvider.listAnalyses).mockResolvedValue([analysis1, analysis2]);

    const sourceWorkspaceInfo: Partial<WorkspaceInfo> = {
      googleProject: 'GoogleProject123',
      bucketName: 'Bucket123',
    };
    const sourceWorkspace: Partial<WorkspaceWrapper> = {
      workspace: sourceWorkspaceInfo as WorkspaceInfo,
    };

    // Act
    const renderedHook = renderHook(() =>
      useAnalysisExportState(sourceWorkspace as WorkspaceWrapper, 'PrintName123', runtimeToolLabels.Jupyter)
    );
    const hookResult1 = renderedHook.result.current;
    await act(async () => {
      hookResult1.selectWorkspace('Workspace2');
    });

    // Assert
    const hookResult = renderedHook.result.current;
    const expectedSelectedWorkspace: Partial<WorkspaceInfo> = {
      workspaceId: 'Workspace2',
    };
    expect(AnalysisProvider.listAnalyses).toBeCalledTimes(1);
    expect(AnalysisProvider.listAnalyses).toBeCalledWith(expectedSelectedWorkspace, expect.anything());
    expect(hookResult.selectedWorkspace).toEqual(expectedSelectedWorkspace);
    const expectedWorkspaces: WorkspaceWrapper[] = [
      { workspace: workspace1 as WorkspaceInfo } as WorkspaceWrapper,
      { workspace: workspace2 as WorkspaceInfo } as WorkspaceWrapper,
    ];
    expect(hookResult.workspaces).toEqual(expectedWorkspaces);
    const expectedExistingFiles: typeof hookResult.existingAnalysisFiles = {
      status: 'Ready',
      state: [analysis1, analysis2],
    };
    expect(hookResult.existingAnalysisFiles).toEqual(expectedExistingFiles);
    const expectedPendingCopy: typeof hookResult.pendingCopy = {
      status: 'None',
    };
    expect(hookResult.pendingCopy).toEqual(expectedPendingCopy);
  });

  it('handles invalid workspace selection (GCP)', async () => {
    // Arrange
    const workspace1: Partial<WorkspaceInfo> = {
      workspaceId: 'Workspace1',
    };
    const workspace2: Partial<WorkspaceInfo> = {
      workspaceId: 'Workspace2',
    };
    asMockedFn(useWorkspaces).mockReturnValue({
      workspaces: [
        { workspace: workspace1 as WorkspaceInfo } as WorkspaceWrapper,
        { workspace: workspace2 as WorkspaceInfo } as WorkspaceWrapper,
      ],
      loading: false,
      refresh: jest.fn(),
      status: 'Ready',
    });
    asMockedFn(AnalysisProvider.listAnalyses).mockResolvedValue([
      { name: 'files/Analysis1.ipynb' as AbsolutePath } as AnalysisFile,
      { name: 'files/Analysis2.ipynb' as AbsolutePath } as AnalysisFile,
    ]);

    const sourceWorkspaceInfo: Partial<WorkspaceInfo> = {
      googleProject: 'GoogleProject123',
      bucketName: 'Bucket123',
    };
    const sourceWorkspace: Partial<WorkspaceWrapper> = {
      workspace: sourceWorkspaceInfo as WorkspaceInfo,
    };

    // Act
    const renderedHook = renderHook(() =>
      useAnalysisExportState(sourceWorkspace as WorkspaceWrapper, 'PrintName123', runtimeToolLabels.Jupyter)
    );
    const hookResult1 = renderedHook.result.current;
    await act(async () => {
      hookResult1.selectWorkspace('Workspace3');
    });

    // Assert
    const hookResult = renderedHook.result.current;
    expect(hookResult.selectedWorkspace).toEqual(null);
    const expectedWorkspaces: WorkspaceWrapper[] = [
      { workspace: workspace1 as WorkspaceInfo } as WorkspaceWrapper,
      { workspace: workspace2 as WorkspaceInfo } as WorkspaceWrapper,
    ];
    expect(hookResult.workspaces).toEqual(expectedWorkspaces);
    const expectedExistingNames: typeof hookResult.existingAnalysisFiles = {
      status: 'Error',
      state: null,
      error: Error(errors.badWorkspace),
    };
    expect(hookResult.existingAnalysisFiles).toEqual(expectedExistingNames);
    const expectedPendingCopy: typeof hookResult.pendingCopy = {
      status: 'None',
    };
    expect(hookResult.pendingCopy).toEqual(expectedPendingCopy);
  });
  it('copies analysis (GCP)', async () => {
    // Arrange
    const workspace1: Partial<WorkspaceInfo> = {
      workspaceId: 'Workspace1',
    };
    const workspace2: Partial<WorkspaceInfo> = {
      workspaceId: 'Workspace2',
    };
    asMockedFn(useWorkspaces).mockReturnValue({
      workspaces: [
        { workspace: workspace1 as WorkspaceInfo } as WorkspaceWrapper,
        { workspace: workspace2 as WorkspaceInfo } as WorkspaceWrapper,
      ],
      loading: false,
      refresh: jest.fn(),
      status: 'Ready',
    });
    asMockedFn(AnalysisProvider.listAnalyses).mockResolvedValue([
      { name: 'files/Analysis1.ipynb' as AbsolutePath } as AnalysisFile,
      { name: 'files/Analysis2.ipynb' as AbsolutePath } as AnalysisFile,
    ]);
    // mock copy success
    asMockedFn(AnalysisProvider.copyAnalysis).mockResolvedValue(undefined);

    const sourceWorkspaceInfo: Partial<WorkspaceInfo> = {
      googleProject: 'GoogleProject123',
      bucketName: 'Bucket123',
    };
    const sourceWorkspace: Partial<WorkspaceWrapper> = {
      workspace: sourceWorkspaceInfo as WorkspaceInfo,
    };
    // get initial state to be selected
    const renderedHook = renderHook(() =>
      useAnalysisExportState(sourceWorkspace as WorkspaceWrapper, 'PrintName123', runtimeToolLabels.Jupyter)
    );
    const hookResult1 = renderedHook.result.current;
    await act(async () => {
      hookResult1.selectWorkspace('Workspace2');
    });

    // Act
    const hookResult2 = renderedHook.result.current;
    await act(async () => {
      hookResult2.copyAnalysis('NewName123');
    });

    // Assert
    const hookResult = renderedHook.result.current;
    const expectedSelectedWorkspace: Partial<WorkspaceInfo> = {
      workspaceId: 'Workspace2',
    };
    expect(AnalysisProvider.copyAnalysis).toBeCalledTimes(1);
    expect(AnalysisProvider.copyAnalysis).toBeCalledWith(
      sourceWorkspace.workspace,
      'PrintName123',
      runtimeToolLabels.Jupyter,
      expectedSelectedWorkspace,
      'NewName123',
      expect.anything()
    );
    const expectedPendingCopy: typeof hookResult.pendingCopy = {
      status: 'Ready',
      state: true,
    };
    expect(hookResult.pendingCopy).toEqual(expectedPendingCopy);
  });

  it('handles no selection error on copy analysis (GCP)', async () => {
    // Arrange
    const workspace1: Partial<WorkspaceInfo> = {
      workspaceId: 'Workspace1',
    };
    const workspace2: Partial<WorkspaceInfo> = {
      workspaceId: 'Workspace2',
    };
    asMockedFn(useWorkspaces).mockReturnValue({
      workspaces: [
        { workspace: workspace1 as WorkspaceInfo } as WorkspaceWrapper,
        { workspace: workspace2 as WorkspaceInfo } as WorkspaceWrapper,
      ],
      loading: false,
      refresh: jest.fn(),
      status: 'Ready',
    });
    asMockedFn(AnalysisProvider.listAnalyses).mockResolvedValue([
      { name: 'files/Analysis1.ipynb' as AbsolutePath } as AnalysisFile,
      { name: 'files/Analysis2.ipynb' as AbsolutePath } as AnalysisFile,
    ]);
    // mock copy success
    asMockedFn(AnalysisProvider.copyAnalysis).mockResolvedValue(undefined);

    const sourceWorkspaceInfo: Partial<WorkspaceInfo> = {
      googleProject: 'GoogleProject123',
      bucketName: 'Bucket123',
    };
    const sourceWorkspace: Partial<WorkspaceWrapper> = {
      workspace: sourceWorkspaceInfo as WorkspaceInfo,
    };
    // get initial state (no selection)
    const renderedHook = renderHook(() =>
      useAnalysisExportState(sourceWorkspace as WorkspaceWrapper, 'PrintName123', runtimeToolLabels.Jupyter)
    );

    // Act
    const hookResult2 = renderedHook.result.current;
    await act(async () => {
      hookResult2.copyAnalysis('NewName123');
    });

    // Assert
    const hookResult = renderedHook.result.current;
    expect(AnalysisProvider.copyAnalysis).toBeCalledTimes(0);
    const expectedPendingCopy: typeof hookResult.pendingCopy = {
      status: 'Error',
      state: null,
      error: Error(errors.noWorkspace),
    };
    expect(hookResult.pendingCopy).toEqual(expectedPendingCopy);
  });
});
