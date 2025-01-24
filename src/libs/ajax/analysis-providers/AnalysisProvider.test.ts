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
    const mockBuckets: Partial<AjaxBucketsContract> = {
      analysis: jest.fn(),
    };
    const watchCopy = jest.fn();
    asMockedFn((mockBuckets as AjaxBucketsContract).analysis).mockImplementation(() => {
      const mockAnalysisContract: Partial<AjaxBucketsAnalysisContract> = {
        copy: watchCopy,
      };
      const analysisContract = mockAnalysisContract as AjaxBucketsAnalysisContract;
      asMockedFn(analysisContract.copy).mockResolvedValue(undefined);
      return analysisContract;
    });

    const mockAjax: Partial<AjaxContract> = {
      Buckets: mockBuckets as AjaxBucketsContract,
    };
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract);

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
    expect(mockBuckets.analysis).toBeCalledTimes(1);
    expect(mockBuckets.analysis).toBeCalledWith(
      'GoogleProject123',
      'Bucket123',
      'PrintName123.jpt',
      runtimeToolLabels.Jupyter
    );
    expect(watchCopy).toBeCalledTimes(1);
    expect(watchCopy).toBeCalledWith('NewName123.jpt', 'TargetBucket456', false);
  });

  it('handles Azure workspace', async () => {
    // Arrange
    const mockAzureStorage: Partial<AjaxAzureStorageContract> = {
      blob: jest.fn(),
    };
    const watchCopy = jest.fn();
    asMockedFn((mockAzureStorage as AjaxAzureStorageContract).blob).mockImplementation(() => {
      const mockBlobContract: Partial<AjaxAzureStorageBlobContract> = {
        copy: watchCopy,
      };
      const blobContract = mockBlobContract as AjaxAzureStorageBlobContract;
      asMockedFn(blobContract.copy).mockResolvedValue(undefined);
      return blobContract;
    });

    const mockAjax: Partial<AjaxContract> = {
      AzureStorage: mockAzureStorage as AjaxAzureStorageContract,
    };
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract);

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
    expect(mockAzureStorage.blob).toBeCalledTimes(1);
    expect(mockAzureStorage.blob).toBeCalledWith('Workspace123', 'PrintName123.jpt');
    expect(watchCopy).toBeCalledTimes(1);
    expect(watchCopy).toBeCalledWith('NewName123', 'Workspace456');
  });
});

describe('AnalysisProvider - createAnalysis', () => {
  it('handles GCP workspace', async () => {
    // Arrange
    const mockBuckets: Partial<AjaxBucketsContract> = {
      analysis: jest.fn(),
    };
    const watchCreate = jest.fn();
    asMockedFn((mockBuckets as AjaxBucketsContract).analysis).mockImplementation(() => {
      const mockAnalysisContract: Partial<AjaxBucketsAnalysisContract> = {
        create: watchCreate,
      };
      const analysisContract = mockAnalysisContract as AjaxBucketsAnalysisContract;
      asMockedFn(analysisContract.create).mockResolvedValue(undefined);
      return analysisContract;
    });

    const mockAjax: Partial<AjaxContract> = {
      Buckets: mockBuckets as AjaxBucketsContract,
    };
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract);

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
    expect(mockBuckets.analysis).toBeCalledTimes(1);
    expect(mockBuckets.analysis).toBeCalledWith(
      'GoogleProject123',
      'Bucket123',
      'PrintName123.ipynb',
      runtimeToolLabels.Jupyter
    );
    expect(watchCreate).toBeCalledTimes(1);
    expect(watchCreate).toBeCalledWith('MyIpynbContents');
  });

  it('handles Azure workspace', async () => {
    // Arrange
    const mockAzureStorage: Partial<AjaxAzureStorageContract> = {
      blob: jest.fn(),
    };
    const watchCreate = jest.fn();
    asMockedFn((mockAzureStorage as AjaxAzureStorageContract).blob).mockImplementation(() => {
      const mockBlobContract: Partial<AjaxAzureStorageBlobContract> = {
        create: watchCreate,
      };
      const blobContract = mockBlobContract as AjaxAzureStorageBlobContract;
      asMockedFn(blobContract.create).mockResolvedValue(undefined);
      return blobContract;
    });

    const mockAjax: Partial<AjaxContract> = {
      AzureStorage: mockAzureStorage as AjaxAzureStorageContract,
    };
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract);

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
    expect(mockAzureStorage.blob).toBeCalledTimes(1);
    expect(mockAzureStorage.blob).toBeCalledWith('Workspace123', 'PrintName123.ipynb');
    expect(watchCreate).toBeCalledTimes(1);
    expect(watchCreate).toBeCalledWith('MyIpynbContents');
  });
});

describe('AnalysisProvider - deleteAnalysis', () => {
  it('handles GCP workspace', async () => {
    // Arrange
    const mockBuckets: Partial<AjaxBucketsContract> = {
      analysis: jest.fn(),
    };
    const watchDelete = jest.fn();
    asMockedFn((mockBuckets as AjaxBucketsContract).analysis).mockImplementation(() => {
      const mockAnalysisContract: Partial<AjaxBucketsAnalysisContract> = {
        delete: watchDelete,
      };
      const analysisContract = mockAnalysisContract as AjaxBucketsAnalysisContract;
      asMockedFn(analysisContract.delete).mockResolvedValue(undefined);
      return analysisContract;
    });

    const mockAjax: Partial<AjaxContract> = {
      Buckets: mockBuckets as AjaxBucketsContract,
    };
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract);

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
    expect(mockBuckets.analysis).toBeCalledTimes(1);
    expect(mockBuckets.analysis).toBeCalledWith(
      'GoogleProject123',
      'Bucket123',
      'PrintName123.ipynb',
      runtimeToolLabels.Jupyter
    );
    expect(watchDelete).toBeCalledTimes(1);
  });

  it('handles Azure workspace', async () => {
    // Arrange
    const mockAzureStorage: Partial<AjaxAzureStorageContract> = {
      blob: jest.fn(),
    };
    const watchDelete = jest.fn();
    asMockedFn((mockAzureStorage as AjaxAzureStorageContract).blob).mockImplementation(() => {
      const mockBlobContract: Partial<AjaxAzureStorageBlobContract> = {
        delete: watchDelete,
      };
      const blobContract = mockBlobContract as AjaxAzureStorageBlobContract;
      asMockedFn(blobContract.delete).mockResolvedValue(undefined);
      return blobContract;
    });

    const mockAjax: Partial<AjaxContract> = {
      AzureStorage: mockAzureStorage as AjaxAzureStorageContract,
    };
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract);

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
    expect(mockAzureStorage.blob).toBeCalledTimes(1);
    expect(mockAzureStorage.blob).toBeCalledWith('Workspace123', 'PrintName123.ipynb');
    expect(watchDelete).toBeCalledTimes(1);
  });
});
