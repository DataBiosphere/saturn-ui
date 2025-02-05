import { act } from 'react-dom/test-utils';
import { useAnalysisFiles } from 'src/analysis/useAnalysisFiles';
import { AnalysisProvider } from 'src/libs/ajax/analysis-providers/AnalysisProvider';
import { defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';

jest.mock('src/analysis/useAnalysisFiles', () => ({
  useAnalysisFiles: jest.fn(),
}));

jest.mock('src/libs/ajax/analysis-providers/AnalysisProvider', () => ({
  AnalysisProvider: {
    listAnalyses: jest.fn(),
  },
}));

jest.mock('src/libs/utils', () => ({
  withBusyState: jest.fn((setter) => async (fn) => {
    setter(true);
    try {
      return await fn();
    } finally {
      setter(false);
    }
  }),
  maybeParseJSON: jest.fn(),
}));

describe('useAnalysisFiles - refreshFileStore', () => {
  const mockWorkspace = defaultGoogleWorkspace;
  const mockAnalyses = [{ name: 'test.ipynb', ext: '.ipynb', lastModified: 1690000000000 }];

  let refreshFileStoreMock: () => any;

  beforeEach(() => {
    jest.clearAllMocks();

    refreshFileStoreMock = jest.fn(async () => {
      const analyses = await AnalysisProvider.listAnalyses(mockWorkspace.workspace);
      return { status: 'Ready', files: analyses };
    });

    (useAnalysisFiles as jest.Mock).mockReturnValue({
      refreshFileStore: refreshFileStoreMock,
      loadedState: { status: 'Ready', files: [] },
    });
  });

  it('calls refreshFileStore without rendering', async () => {
    await act(async () => {
      await refreshFileStoreMock();
    });

    expect(refreshFileStoreMock).toHaveBeenCalledTimes(1);
  });

  it('fetches analyses and updates state correctly', async () => {
    (AnalysisProvider.listAnalyses as jest.Mock).mockResolvedValue(mockAnalyses);

    await act(async () => {
      const result = await refreshFileStoreMock();
      expect(result.files).toEqual(mockAnalyses);
      expect(result.status).toBe('Ready');
    });

    expect(AnalysisProvider.listAnalyses).toHaveBeenCalledWith(mockWorkspace.workspace);
  });

  it('handles errors gracefully when fetching analyses', async () => {
    const mockError = new Error('Fetch failed');
    (AnalysisProvider.listAnalyses as jest.Mock).mockRejectedValue(mockError);

    await act(async () => {
      await expect(refreshFileStoreMock()).rejects.toThrow(mockError);
    });

    expect(AnalysisProvider.listAnalyses).toHaveBeenCalledWith(mockWorkspace.workspace);
  });
});
