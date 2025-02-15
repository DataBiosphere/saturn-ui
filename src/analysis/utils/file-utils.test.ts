import { ReadyState } from '@terra-ui-packages/core-utils';
import { act } from '@testing-library/react';
import { AnalysisFile, getFileFromPath, useAnalysisFiles } from 'src/analysis/useAnalysisFiles';
import { AbsolutePath, getExtension, getFileName } from 'src/analysis/utils/file-utils';
import { getToolLabelFromFileExtension, runtimeToolLabels } from 'src/analysis/utils/tool-utils';
import { AzureStorage, AzureStorageContract } from 'src/libs/ajax/AzureStorage';
import { GoogleStorage, GoogleStorageContract } from 'src/libs/ajax/GoogleStorage';
import { reportError } from 'src/libs/error';
import { workspaceStore } from 'src/libs/state';
import { asMockedFn, renderHookInAct } from 'src/testing/test-utils';
import { defaultAzureWorkspace, defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';

jest.mock('src/libs/ajax/GoogleStorage');
jest.mock('src/libs/ajax/AzureStorage');
jest.mock('src/libs/error', () => ({
  ...jest.requireActual('src/libs/error'),
  reportError: jest.fn(),
}));

jest.mock('src/libs/notifications', () => ({
  notify: jest.fn((...args) => {
    console.debug('######################### notify')/* eslint-disable-line */
    console.debug({ method: 'notify', args: [...args] })/* eslint-disable-line */
  }),
}));

describe('file-utils', () => {
  describe('useAnalysisFiles', () => {
    beforeEach(() => {
      workspaceStore.reset();
      const googleStorageMock: Partial<GoogleStorageContract> = {
        listAnalyses: jest.fn(() => Promise.resolve([])),
      };
      asMockedFn(GoogleStorage).mockImplementation(() => googleStorageMock as GoogleStorageContract);

      const azureStorageMock: Partial<AzureStorageContract> = {
        listNotebooks: jest.fn(() => Promise.resolve([])),
      };
      asMockedFn(AzureStorage).mockImplementation(() => azureStorageMock as AzureStorageContract);
    });

    it('returns the correct files', async () => {
      // Arrange
      const fileList: AnalysisFile[] = [
        getFileFromPath('test/file1.ipynb' as AbsolutePath),
        getFileFromPath('test/file2.ipynb' as AbsolutePath),
      ];

      const listAnalyses = jest.fn(() => Promise.resolve(fileList));
      const googleStorageMock: Partial<GoogleStorageContract> = {
        listAnalyses,
      };
      asMockedFn(GoogleStorage).mockImplementation(() => googleStorageMock as GoogleStorageContract);

      // Act
      workspaceStore.set({ ...defaultGoogleWorkspace, workspaceInitialized: true });
      const { result: hookReturnRef } = await renderHookInAct(() => useAnalysisFiles());
      const state = hookReturnRef.current.loadedState;

      // Assert
      const expectedState: ReadyState<AnalysisFile[]> = { status: 'Ready', state: fileList };
      expect(state).toEqual(expectedState);
    });

    it('loads files from the correct cloud provider storage with a google workspace', async () => {
      // Arrange
      const fileList: AnalysisFile[] = [
        getFileFromPath('test/file1.ipynb' as AbsolutePath),
        getFileFromPath('test/file2.ipynb' as AbsolutePath),
      ];

      const listAnalyses = jest.fn(() => Promise.resolve(fileList));
      const googleStorageMock: Partial<GoogleStorageContract> = {
        listAnalyses,
      };
      asMockedFn(GoogleStorage).mockImplementation(() => googleStorageMock as GoogleStorageContract);

      // Act
      workspaceStore.set({ ...defaultGoogleWorkspace, workspaceInitialized: true });
      await renderHookInAct(() => useAnalysisFiles());

      // Assert
      expect(listAnalyses).toHaveBeenCalledWith(
        defaultGoogleWorkspace.workspace.googleProject,
        defaultGoogleWorkspace.workspace.bucketName
      );
    });

    it('loads files from the correct cloud provider storage with an azure workspace', async () => {
      // Arrange
      const fileList = [
        getFileFromPath('test/file1.ipynb' as AbsolutePath),
        getFileFromPath('test/file2.ipynb' as AbsolutePath),
      ];

      const calledMock = jest.fn(() => Promise.resolve(fileList));
      const azureStorageMock: Partial<AzureStorageContract> = {
        listNotebooks: calledMock,
      };
      asMockedFn(AzureStorage).mockImplementation(() => azureStorageMock as AzureStorageContract);

      // Act
      workspaceStore.set({ ...defaultAzureWorkspace, workspaceInitialized: true });
      await renderHookInAct(() => useAnalysisFiles());

      // Assert
      expect(calledMock).toHaveBeenCalledWith(defaultAzureWorkspace.workspace.workspaceId);
    });

    it('creates a file with a GCP workspace', async () => {
      // Arrange
      const fileList: AnalysisFile[] = [
        getFileFromPath('test/file1.ipynb' as AbsolutePath),
        getFileFromPath('test/file2.ipynb' as AbsolutePath),
      ];

      const listAnalyses = jest.fn(() => Promise.resolve(fileList));
      const create = jest.fn(() => Promise.resolve());
      const analysisMock: Partial<GoogleStorageContract['analysis']> = jest.fn(() => ({
        create,
      }));
      const googleStorageMock: Partial<GoogleStorageContract> = {
        listAnalyses,
        analysis: analysisMock as GoogleStorageContract['analysis'],
      };
      asMockedFn(GoogleStorage).mockImplementation(() => googleStorageMock as GoogleStorageContract);

      // Act
      workspaceStore.set({ ...defaultGoogleWorkspace, workspaceInitialized: true });
      const { result: hookReturnRef } = await renderHookInAct(() => useAnalysisFiles());
      await act(() => hookReturnRef.current.createAnalysis('AnalysisFile', runtimeToolLabels.Jupyter, 'myContents'));

      // Assert
      expect(create).toHaveBeenCalledWith('myContents');
    });

    it('Fails to create a file with a GCP workspace', async () => {
      // Arrange
      const listAnalyses = jest.fn(() => Promise.resolve([]));
      const create = jest.fn(() => Promise.reject(new Error('myError')));
      const analysisMock: Partial<GoogleStorageContract['analysis']> = jest.fn(() => ({
        create,
        refresh: jest.fn(() => Promise.reject(new Error('ee'))),
      }));
      const googleStorageMock: Partial<GoogleStorageContract> = {
        listAnalyses,
        analysis: analysisMock as GoogleStorageContract['analysis'],
      };
      asMockedFn(GoogleStorage).mockImplementation(() => googleStorageMock as GoogleStorageContract);

      // Act
      workspaceStore.set({ ...defaultGoogleWorkspace, workspaceInitialized: true });
      const hookRender1 = await renderHookInAct(() => useAnalysisFiles());
      const hookResult2 = hookRender1.result.current;
      await act(() => hookResult2.createAnalysis('AnalysisFile', runtimeToolLabels.Jupyter, 'myContents'));

      // Assert
      expect(create).toHaveBeenCalledWith('myContents');
      expect(reportError).toHaveBeenCalled();
    });

    it('creates a file with an Azure workspace', async () => {
      // Arrange
      const fileList: AnalysisFile[] = [
        getFileFromPath('test/file1.ipynb' as AbsolutePath),
        getFileFromPath('test/file2.ipynb' as AbsolutePath),
      ];

      const listNotebooks = jest.fn(() => Promise.resolve(fileList));
      const create = jest.fn(() => Promise.resolve());
      const blobMock: Partial<AzureStorageContract['blob']> = jest.fn(() => ({
        create,
      }));
      const azureStorageMock: Partial<AzureStorageContract> = {
        listNotebooks,
        blob: blobMock as AzureStorageContract['blob'],
      };
      asMockedFn(AzureStorage).mockImplementation(() => azureStorageMock as AzureStorageContract);
      workspaceStore.set({ ...defaultAzureWorkspace, workspaceInitialized: true });
      const { result: hookReturnRef } = await renderHookInAct(() => useAnalysisFiles());
      // Act
      await act(() => hookReturnRef.current.createAnalysis('AnalysisFile', runtimeToolLabels.Jupyter, 'myContents'));

      // Assert
      expect(create).toHaveBeenCalledWith('myContents');
    });
  });

  it('Fails to create a file with an Azure workspace', async () => {
    // Arrange
    const listNotebooks = jest.fn(() => Promise.resolve([]));
    const create = jest.fn(() => Promise.reject(new Error('myError')));
    const blobMock: Partial<AzureStorageContract['blob']> = jest.fn(() => ({
      create,
    }));
    const googleStorageMock: Partial<AzureStorageContract> = {
      listNotebooks,
      blob: blobMock as AzureStorageContract['blob'],
    };
    asMockedFn(AzureStorage).mockImplementation(() => googleStorageMock as AzureStorageContract);

    // Act
    workspaceStore.set({ ...defaultAzureWorkspace, workspaceInitialized: true });
    const hookRender1 = await renderHookInAct(() => useAnalysisFiles());
    const hookResult2 = hookRender1.result.current;
    await act(() => hookResult2.createAnalysis('AnalysisFile', runtimeToolLabels.Jupyter, 'myContents'));

    // Assert
    expect(create).toHaveBeenCalledWith('myContents');
    expect(reportError).toHaveBeenCalled();
  });

  // file deletion tests

  it('deletes a file with a GCP workspace', async () => {
    // Arrange
    const file1Path = 'test/file1.ipynb' as AbsolutePath;
    const fileList: AnalysisFile[] = [getFileFromPath(file1Path), getFileFromPath('test/file2.ipynb' as AbsolutePath)];

    const listAnalyses = jest.fn(() => Promise.resolve(fileList));
    const doDelete = jest.fn(() => Promise.resolve());
    const analysisMock: Partial<GoogleStorageContract['analysis']> = jest.fn(() => ({
      delete: doDelete,
    }));
    const googleStorageMock: Partial<GoogleStorageContract> = {
      listAnalyses,
      analysis: analysisMock as GoogleStorageContract['analysis'],
    };
    asMockedFn(GoogleStorage).mockImplementation(() => googleStorageMock as GoogleStorageContract);

    // Act
    workspaceStore.set({ ...defaultGoogleWorkspace, workspaceInitialized: true });
    const { result: hookReturnRef } = await renderHookInAct(() => useAnalysisFiles());
    await act(() => hookReturnRef.current.deleteAnalysis(file1Path));

    // Assert
    expect(analysisMock).toHaveBeenCalledWith(
      defaultGoogleWorkspace.workspace.googleProject,
      defaultGoogleWorkspace.workspace.bucketName,
      getFileName(file1Path),
      getToolLabelFromFileExtension(getExtension(file1Path))
    );
    expect(doDelete).toHaveBeenCalled();
  });

  it('Fails to create a file with a GCP workspace', async () => {
    // Arrange
    const file1Path = 'test/file1.ipynb' as AbsolutePath;
    const listAnalyses = jest.fn(() => Promise.resolve([]));
    const doDelete = jest.fn(() => Promise.reject(new Error('myError')));
    const analysisMock: Partial<GoogleStorageContract['analysis']> = jest.fn(() => ({
      delete: doDelete,
      refresh: jest.fn(() => Promise.reject(new Error('ee'))),
    }));
    const googleStorageMock: Partial<GoogleStorageContract> = {
      listAnalyses,
      analysis: analysisMock as GoogleStorageContract['analysis'],
    };
    asMockedFn(GoogleStorage).mockImplementation(() => googleStorageMock as GoogleStorageContract);

    // Act
    workspaceStore.set({ ...defaultGoogleWorkspace, workspaceInitialized: true });
    const hookRender1 = await renderHookInAct(() => useAnalysisFiles());
    const hookResult2 = hookRender1.result.current;
    await act(() => hookResult2.deleteAnalysis(file1Path));

    // Assert
    expect(analysisMock).toHaveBeenCalledWith(
      defaultGoogleWorkspace.workspace.googleProject,
      defaultGoogleWorkspace.workspace.bucketName,
      getFileName(file1Path),
      getToolLabelFromFileExtension(getExtension(file1Path))
    );
    expect(doDelete).toHaveBeenCalled();
    expect(reportError).toHaveBeenCalled();
  });

  it('creates a file with an Azure workspace', async () => {
    // Arrange
    const file1Path = 'test/file1.ipynb' as AbsolutePath;
    const fileList: AnalysisFile[] = [getFileFromPath(file1Path), getFileFromPath('test/file2.ipynb' as AbsolutePath)];

    const listNotebooks = jest.fn(() => Promise.resolve(fileList));
    const doDelete = jest.fn(() => Promise.resolve());
    const blobMock: Partial<AzureStorageContract['blob']> = jest.fn(() => ({
      delete: doDelete,
    }));
    const azureStorageMock: Partial<AzureStorageContract> = {
      listNotebooks,
      blob: blobMock as AzureStorageContract['blob'],
    };
    asMockedFn(AzureStorage).mockImplementation(() => azureStorageMock as AzureStorageContract);
    workspaceStore.set({ ...defaultAzureWorkspace, workspaceInitialized: true });
    const { result: hookReturnRef } = await renderHookInAct(() => useAnalysisFiles());
    // Act
    await act(() => hookReturnRef.current.deleteAnalysis(file1Path));

    // Assert
    expect(blobMock).toHaveBeenCalledWith(defaultAzureWorkspace.workspace.workspaceId, getFileName(file1Path));
    expect(doDelete).toHaveBeenCalled();
  });

  it('Fails to create a file with an Azure workspace', async () => {
    // Arrange
    const file1Path = 'test/file1.ipynb' as AbsolutePath;
    const listNotebooks = jest.fn(() => Promise.resolve([]));
    const doDelete = jest.fn(() => Promise.reject(new Error('myError')));
    const blobMock: Partial<AzureStorageContract['blob']> = jest.fn(() => ({
      delete: doDelete,
    }));
    const azureStorageMock: Partial<AzureStorageContract> = {
      listNotebooks,
      blob: blobMock as AzureStorageContract['blob'],
    };
    asMockedFn(AzureStorage).mockImplementation(() => azureStorageMock as AzureStorageContract);

    // Act
    workspaceStore.set({ ...defaultAzureWorkspace, workspaceInitialized: true });
    const hookRender1 = await renderHookInAct(() => useAnalysisFiles());
    const hookResult2 = hookRender1.result.current;
    await act(() => hookResult2.deleteAnalysis(file1Path));

    // Assert
    expect(blobMock).toHaveBeenCalledWith(defaultAzureWorkspace.workspace.workspaceId, getFileName(file1Path));
    expect(doDelete).toHaveBeenCalled();
    expect(reportError).toHaveBeenCalled();
  });
});
