import { AbsolutePath } from 'src/analysis/utils/file-utils';
import { runtimeToolLabels } from 'src/analysis/utils/tool-utils';
import { AnalysisProvider } from 'src/libs/ajax/analysis-providers/AnalysisProvider';
import { AzureStorage, AzureStorageContract } from 'src/libs/ajax/AzureStorage';
import { GoogleStorage, GoogleStorageContract } from 'src/libs/ajax/GoogleStorage';
import { asMockedFn, MockedFn, partial } from 'src/testing/test-utils';
import { WorkspaceInfo } from 'src/workspaces/utils';

jest.mock('src/libs/ajax/AzureStorage');
jest.mock('src/libs/ajax/GoogleStorage');

type AjaxBucketsAnalysisContract = ReturnType<GoogleStorageContract['analysis']>;
type AjaxAzureStorageBlobContract = ReturnType<AzureStorageContract['blob']>;

describe('AnalysisProvider - listAnalyses', () => {
  it('handles GCP workspace', async () => {
    // Arrange
    const listAnalyses: MockedFn<GoogleStorageContract['listAnalyses']> = jest.fn();
    listAnalyses.mockResolvedValue([]);

    asMockedFn(GoogleStorage).mockReturnValue(partial<GoogleStorageContract>({ listAnalyses }));

    const workspaceInfo = partial<WorkspaceInfo>({
      googleProject: 'GoogleProject123',
      bucketName: 'Bucket123',
      cloudPlatform: 'Gcp',
    });

    // Act
    const results = await AnalysisProvider.listAnalyses(workspaceInfo);

    // Assert
    expect(results).toEqual([]);
    expect(listAnalyses).toBeCalledTimes(1);
    expect(listAnalyses).toBeCalledWith('GoogleProject123', 'Bucket123');
  });

  it('handles Azure workspace', async () => {
    // Arrange
    const listNotebooks: MockedFn<AzureStorageContract['listNotebooks']> = jest.fn();
    listNotebooks.mockResolvedValue([]);

    asMockedFn(AzureStorage).mockReturnValue(partial<AzureStorageContract>({ listNotebooks }));

    const workspaceInfo = partial<WorkspaceInfo>({
      workspaceId: 'Workspace123',
    });

    // Act
    const results = await AnalysisProvider.listAnalyses(workspaceInfo);

    // Assert
    expect(results).toEqual([]);
    expect(listNotebooks).toBeCalledTimes(1);
    expect(listNotebooks).toBeCalledWith('Workspace123');
  });
});

describe('AnalysisProvider - copyAnalysis', () => {
  it('handles GCP workspace', async () => {
    // Arrange
    const analysis: MockedFn<GoogleStorageContract['analysis']> = jest.fn();
    const watchCopy: MockedFn<AjaxBucketsAnalysisContract['copy']> = jest.fn();
    watchCopy.mockResolvedValue(undefined);

    analysis.mockReturnValue(partial<AjaxBucketsAnalysisContract>({ copy: watchCopy }));
    asMockedFn(GoogleStorage).mockReturnValue(partial<GoogleStorageContract>({ analysis }));

    const workspaceInfo: Partial<WorkspaceInfo> = {
      googleProject: 'GoogleProject123',
      bucketName: 'Bucket123',
      cloudPlatform: 'Gcp',
    };
    const targetWorkspace: Partial<WorkspaceInfo> = {
      bucketName: 'TargetBucket456',
    };

    // Act
    const result = await AnalysisProvider.copyAnalysis(
      workspaceInfo as WorkspaceInfo,
      'PrintName123.jpt',
      runtimeToolLabels.Jupyter,
      targetWorkspace as WorkspaceInfo,
      'NewName123'
    );

    // Assert
    expect(result).toEqual(undefined);
    expect(analysis).toBeCalledTimes(1);
    expect(analysis).toBeCalledWith('GoogleProject123', 'Bucket123', 'PrintName123.jpt', runtimeToolLabels.Jupyter);
    expect(watchCopy).toBeCalledTimes(1);
    expect(watchCopy).toBeCalledWith('NewName123.jpt', 'TargetBucket456', false);
  });

  it('handles Azure workspace', async () => {
    // Arrange
    const blob: MockedFn<AzureStorageContract['blob']> = jest.fn();
    const watchCopy: MockedFn<AjaxAzureStorageBlobContract['copy']> = jest.fn();
    watchCopy.mockResolvedValue(undefined);

    blob.mockReturnValue(partial<AjaxAzureStorageBlobContract>({ copy: watchCopy }));
    asMockedFn(AzureStorage).mockReturnValue(partial<AzureStorageContract>({ blob }));

    const workspaceInfo: Partial<WorkspaceInfo> = {
      workspaceId: 'Workspace123',
      bucketName: 'Bucket123',
    };
    const targetWorkspace: Partial<WorkspaceInfo> = {
      workspaceId: 'Workspace456',
    };

    // Act
    const result = await AnalysisProvider.copyAnalysis(
      workspaceInfo as WorkspaceInfo,
      'PrintName123.jpt',
      runtimeToolLabels.Jupyter,
      targetWorkspace as WorkspaceInfo,
      'NewName123'
    );

    // Assert
    expect(result).toEqual(undefined);
    expect(blob).toBeCalledTimes(1);
    expect(blob).toBeCalledWith('Workspace123', 'PrintName123.jpt');
    expect(watchCopy).toBeCalledTimes(1);
    expect(watchCopy).toBeCalledWith('NewName123', 'Workspace456');
  });
});

describe('AnalysisProvider - createAnalysis', () => {
  it('handles GCP workspace', async () => {
    // Arrange
    const analysis: MockedFn<GoogleStorageContract['analysis']> = jest.fn();
    const watchCreate: MockedFn<AjaxBucketsAnalysisContract['create']> = jest.fn();
    watchCreate.mockResolvedValue(undefined);

    analysis.mockReturnValue(partial<AjaxBucketsAnalysisContract>({ create: watchCreate }));
    asMockedFn(GoogleStorage).mockReturnValue(partial<GoogleStorageContract>({ analysis }));

    const workspaceInfo: Partial<WorkspaceInfo> = {
      googleProject: 'GoogleProject123',
      bucketName: 'Bucket123',
      cloudPlatform: 'Gcp',
    };

    // Act
    const result = await AnalysisProvider.createAnalysis(
      workspaceInfo as WorkspaceInfo,
      'PrintName123.ipynb',
      runtimeToolLabels.Jupyter,
      'MyIpynbContents'
    );

    // createAnalysis: (workspaceInfo: WorkspaceInfo,
    // fullAnalysisName: string, toolLabel: ToolLabel,
    // contents: any, signal?: AbortSignal) => Promise<void>
    // Assert
    expect(result).toEqual(undefined);
    expect(analysis).toBeCalledTimes(1);
    expect(analysis).toBeCalledWith('GoogleProject123', 'Bucket123', 'PrintName123.ipynb', runtimeToolLabels.Jupyter);
    expect(watchCreate).toBeCalledTimes(1);
    expect(watchCreate).toBeCalledWith('MyIpynbContents');
  });

  it('handles Azure workspace', async () => {
    // Arrange
    const blob: MockedFn<AzureStorageContract['blob']> = jest.fn();
    const watchCreate: MockedFn<AjaxAzureStorageBlobContract['create']> = jest.fn();
    watchCreate.mockResolvedValue(undefined);

    blob.mockReturnValue(partial<AjaxAzureStorageBlobContract>({ create: watchCreate }));
    asMockedFn(AzureStorage).mockReturnValue(partial<AzureStorageContract>({ blob }));

    const workspaceInfo: Partial<WorkspaceInfo> = {
      workspaceId: 'Workspace123',
      bucketName: 'Bucket123',
    };

    // Act
    const result = await AnalysisProvider.createAnalysis(
      workspaceInfo as WorkspaceInfo,
      'PrintName123.ipynb',
      runtimeToolLabels.Jupyter,
      'MyIpynbContents'
    );

    // Assert
    expect(result).toEqual(undefined);
    expect(blob).toBeCalledTimes(1);
    expect(blob).toBeCalledWith('Workspace123', 'PrintName123.ipynb');
    expect(watchCreate).toBeCalledTimes(1);
    expect(watchCreate).toBeCalledWith('MyIpynbContents');
  });
});

describe('AnalysisProvider - deleteAnalysis', () => {
  it('handles GCP workspace', async () => {
    // Arrange
    const analysis: MockedFn<GoogleStorageContract['analysis']> = jest.fn();
    const watchDelete: MockedFn<AjaxBucketsAnalysisContract['delete']> = jest.fn();
    watchDelete.mockResolvedValue(undefined);

    analysis.mockReturnValue(partial<AjaxBucketsAnalysisContract>({ delete: watchDelete }));
    asMockedFn(GoogleStorage).mockReturnValue(partial<GoogleStorageContract>({ analysis }));

    const workspaceInfo: Partial<WorkspaceInfo> = {
      googleProject: 'GoogleProject123',
      bucketName: 'Bucket123',
      cloudPlatform: 'Gcp',
    };

    // Act
    const result = await AnalysisProvider.deleteAnalysis(
      workspaceInfo as WorkspaceInfo,
      'myDir/PrintName123.ipynb' as AbsolutePath
    );

    // createAnalysis: (workspaceInfo: WorkspaceInfo,
    // fullAnalysisName: string, toolLabel: ToolLabel,
    // contents: any, signal?: AbortSignal) => Promise<void>
    // Assert
    expect(result).toEqual(undefined);
    expect(analysis).toBeCalledTimes(1);
    expect(analysis).toBeCalledWith('GoogleProject123', 'Bucket123', 'PrintName123.ipynb', runtimeToolLabels.Jupyter);
    expect(watchDelete).toBeCalledTimes(1);
  });

  it('handles Azure workspace', async () => {
    // Arrange
    const blob: MockedFn<AzureStorageContract['blob']> = jest.fn();
    const watchDelete: MockedFn<AjaxAzureStorageBlobContract['delete']> = jest.fn();
    watchDelete.mockResolvedValue(undefined);

    blob.mockReturnValue(partial<AjaxAzureStorageBlobContract>({ delete: watchDelete }));
    asMockedFn(AzureStorage).mockReturnValue(partial<AzureStorageContract>({ blob }));

    const workspaceInfo: Partial<WorkspaceInfo> = {
      workspaceId: 'Workspace123',
      bucketName: 'Bucket123',
    };

    // Act
    const result = await AnalysisProvider.deleteAnalysis(
      workspaceInfo as WorkspaceInfo,
      'myDir/PrintName123.ipynb' as AbsolutePath
    );

    // Assert
    expect(result).toEqual(undefined);
    expect(blob).toBeCalledTimes(1);
    expect(blob).toBeCalledWith('Workspace123', 'PrintName123.ipynb');
    expect(watchDelete).toBeCalledTimes(1);
  });
});
