import { AnalysisFile } from 'src/analysis/useAnalysisFiles';
import { AbsolutePath, getExtension, getFileName, stripExtension } from 'src/analysis/utils/file-utils';
import { getToolLabelFromFileExtension, ToolLabel } from 'src/analysis/utils/tool-utils';
import { AzureStorage } from 'src/libs/ajax/AzureStorage';
import { GoogleStorage } from 'src/libs/ajax/GoogleStorage';
import { GoogleWorkspaceInfo, isGoogleWorkspaceInfo, WorkspaceInfo } from 'src/workspaces/utils';

export interface AnalysisProviderContract {
  listAnalyses: (workspaceInfo: WorkspaceInfo, signal?: AbortSignal) => Promise<AnalysisFile[]>;
  copyAnalysis: (
    sourceWorkspace: WorkspaceInfo,
    printName: string,
    toolLabel: ToolLabel,
    targetWorkspace: WorkspaceInfo,
    newName: string,
    signal?: AbortSignal
  ) => Promise<void>;
  createAnalysis: (
    workspaceInfo: WorkspaceInfo,
    fullAnalysisName: string,
    toolLabel: ToolLabel,
    contents: any,
    signal?: AbortSignal
  ) => Promise<void>;
  deleteAnalysis: (workspaceInfo: WorkspaceInfo, path: AbsolutePath, signal?: AbortSignal) => Promise<void>;
}

export const AnalysisProvider: AnalysisProviderContract = {
  listAnalyses: async (workspaceInfo: WorkspaceInfo, signal?: AbortSignal): Promise<AnalysisFile[]> => {
    const selectedAnalyses: AnalysisFile[] = isGoogleWorkspaceInfo(workspaceInfo)
      ? await GoogleStorage(signal).listAnalyses(workspaceInfo.googleProject, workspaceInfo.bucketName)
      : // TODO: cleanup once TS is merged in for AzureStorage module
        ((await AzureStorage(signal).listNotebooks(workspaceInfo.workspaceId)) as any);
    return selectedAnalyses;
  },
  copyAnalysis: async (
    sourceWorkspace: WorkspaceInfo,
    printName: string,
    toolLabel: ToolLabel,
    targetWorkspace: WorkspaceInfo,
    newName: string,
    signal?: AbortSignal
  ): Promise<void> => {
    if (isGoogleWorkspaceInfo(sourceWorkspace)) {
      await GoogleStorage(signal)
        .analysis(sourceWorkspace.googleProject, sourceWorkspace.bucketName, printName, toolLabel)
        // assumes GCP to GCP copy
        .copy(`${newName}.${getExtension(printName)}`, (targetWorkspace as GoogleWorkspaceInfo).bucketName, false);
    } else {
      await AzureStorage(signal)
        .blob(sourceWorkspace.workspaceId, printName)
        .copy(stripExtension(newName), targetWorkspace.workspaceId);
    }
  },
  createAnalysis: async (
    workspaceInfo: WorkspaceInfo,
    fullAnalysisName: string,
    toolLabel: ToolLabel,
    contents: any,
    signal?: AbortSignal
  ): Promise<void> => {
    isGoogleWorkspaceInfo(workspaceInfo)
      ? await GoogleStorage(signal)
          .analysis(workspaceInfo.googleProject, workspaceInfo.bucketName, fullAnalysisName, toolLabel)
          .create(contents)
      : await AzureStorage(signal).blob(workspaceInfo.workspaceId, fullAnalysisName).create(contents);
  },
  deleteAnalysis: async (workspaceInfo: WorkspaceInfo, path: AbsolutePath, signal?: AbortSignal): Promise<void> => {
    isGoogleWorkspaceInfo(workspaceInfo)
      ? await GoogleStorage(signal)
          .analysis(
            workspaceInfo.googleProject,
            workspaceInfo.bucketName,
            getFileName(path),
            getToolLabelFromFileExtension(getExtension(path))
          )
          .delete()
      : await AzureStorage(signal).blob(workspaceInfo.workspaceId, getFileName(path)).delete();
  },
};
