import { useLoadedData } from '@terra-ui-packages/components';
import { LoadedState, withHandlers } from '@terra-ui-packages/core-utils';
import { useEffect, useState } from 'react';
import {
  AbsolutePath,
  DisplayName,
  FileExtension,
  FileName,
  getDisplayName,
  getExtension,
  getFileName,
} from 'src/analysis/utils/file-utils';
import { getToolLabelFromFileExtension, ToolLabel } from 'src/analysis/utils/tool-utils';
import { AnalysisProvider } from 'src/libs/ajax/analysis-providers/AnalysisProvider';
import { reportError } from 'src/libs/error';
import { useCancellation, useStore } from 'src/libs/react-utils';
import { workspaceStore } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { CloudProvider, cloudProviderTypes } from 'src/workspaces/utils';

export interface AnalysisFileMetadata {
  lockExpiresAt: string;
  lastLockedBy: string;
  hashedOwnerEmail?: string;
}

export interface AnalysisFile {
  name: AbsolutePath;
  ext: FileExtension;
  displayName: DisplayName;
  fileName: FileName;
  lastModified: number;
  tool: ToolLabel;
  cloudProvider: CloudProvider;
  // We only populate this for google files to handle file syncing
  // If there is a differentiation for Azure, we should add sub-types
  metadata?: AnalysisFileMetadata;
}

export type CreateAnalysisFn = (fullAnalysisName: string, toolLabel: ToolLabel, contents: any) => Promise<void>;

export interface AnalysisFileStore {
  refreshFileStore: () => Promise<void>;
  loadedState: LoadedState<AnalysisFile[], unknown>;
  createAnalysis: CreateAnalysisFn;
  deleteAnalysis: (path: AbsolutePath) => Promise<void>;
  pendingCreate: LoadedState<true, unknown>;
  pendingDelete: LoadedState<true, unknown>;
}

export const useAnalysisFiles = (): AnalysisFileStore => {
  const signal = useCancellation();
  const [loading, setLoading] = useState(false);
  const workspace = useStore(workspaceStore);
  const [analyses, setAnalyses] = useState<AnalysisFile[]>([]);
  const [pendingCreate, setPendingCreate] = useLoadedData<true>();
  const [pendingDelete, setPendingDelete] = useLoadedData<true>();

  const refresh = withHandlers([Utils.withBusyState(setLoading)], async (): Promise<void> => {
    try {
      const analysis = await AnalysisProvider.listAnalyses(workspace!.workspace, signal);
      setAnalyses(analysis);
    } catch (error) {
      console.error('Error loading analysis files:', error);
      throw error;
    }
  });

  const createAnalysis = async (fullAnalysisName: string, toolLabel: ToolLabel, contents: any): Promise<void> => {
    await setPendingCreate(async () => {
      await AnalysisProvider.createAnalysis(workspace!.workspace, fullAnalysisName, toolLabel, contents, signal);
      await refresh();
      return true;
    });
  };

  const deleteAnalysis = async (path: AbsolutePath): Promise<void> => {
    await setPendingDelete(async () => {
      await AnalysisProvider.deleteAnalysis(workspace!.workspace, path, signal);
      await refresh();
      return true;
    });
  };

  useEffect(() => {
    if (pendingCreate.status === 'Error') {
      reportError('Error creating Analysis file.', pendingCreate.error);
    }
  }, [pendingCreate]);

  useEffect(() => {
    if (pendingDelete.status === 'Error') {
      reportError('Error deleting Analysis file.', pendingDelete.error);
    }
  }, [pendingDelete]);
  return {
    refreshFileStore: refresh,
    createAnalysis,
    deleteAnalysis,
    loadedState: { status: loading ? 'Loading' : 'Ready', state: analyses },
    pendingCreate,
    pendingDelete,
  };
};

// This is mainly a test utility in its current form
// AnalysisFile objects should not usually be constructed with this in app code, as the lastModified date is set to the current time
export const getFileFromPath = (
  abs: AbsolutePath,
  cloudProvider: CloudProvider = cloudProviderTypes.GCP
): AnalysisFile => ({
  name: abs,
  ext: getExtension(abs),
  displayName: getDisplayName(abs),
  fileName: getFileName(abs),
  tool: getToolLabelFromFileExtension(getExtension(abs)) as ToolLabel,
  lastModified: new Date().getTime(),
  cloudProvider,
});
