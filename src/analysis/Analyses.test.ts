import { LoadedState } from '@terra-ui-packages/core-utils';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h } from 'react-hyperscript-helpers';
import { AnalysesData, AnalysesProps, BaseAnalyses, getUniqueFileName } from 'src/analysis/Analyses';
import { analysisLauncherTabName } from 'src/analysis/runtime-common-text';
import { AnalysisFile, getFileFromPath, useAnalysisFiles } from 'src/analysis/useAnalysisFiles';
import { AbsolutePath, FileName, notebookLockHash } from 'src/analysis/utils/file-utils';
import { findPotentialNotebookLockers } from 'src/analysis/utils/notebook-lockers';
import { runtimeToolLabels } from 'src/analysis/utils/tool-utils';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import { ENABLE_JUPYTERLAB_ID, JUPYTERLAB_GCP_FEATURE_ID } from 'src/libs/feature-previews-config';
import { goToPath } from 'src/libs/nav';
import { getLocalPref, setLocalPref } from 'src/libs/prefs';
import { asMockedFn, renderWithAppContexts as render } from 'src/testing/test-utils';
import { defaultAzureWorkspace, defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';

type NavExports = typeof import('src/libs/nav');
jest.mock(
  'src/libs/nav',
  (): NavExports => ({
    ...jest.requireActual('src/libs/nav'),
    getLink: jest.fn(),
    goToPath: jest.fn(),
  })
);

type FileUtilsExports = typeof import('src/analysis/utils/file-utils');
jest.mock(
  'src/analysis/utils/file-utils',
  (): FileUtilsExports => ({
    ...jest.requireActual('src/analysis/utils/file-utils'),
    notebookLockHash: jest.fn(),
  })
);

type NotebookLockersExports = typeof import('src/analysis/utils/notebook-lockers');
jest.mock(
  'src/analysis/utils/notebook-lockers',
  (): NotebookLockersExports => ({
    findPotentialNotebookLockers: jest.fn(),
  })
);

type UseAnalysisFilesExport = typeof import('src/analysis/useAnalysisFiles');
jest.mock(
  'src/analysis/useAnalysisFiles',
  (): UseAnalysisFilesExport => ({
    ...jest.requireActual('src/analysis/useAnalysisFiles'),
    useAnalysisFiles: jest.fn(),
  })
);

jest.mock('src/libs/ajax/Metrics');

jest.mock('src/libs/ajax/workspaces/Workspaces');

type NotificationExports = typeof import('src/libs/notifications');
jest.mock(
  'src/libs/notifications',
  (): NotificationExports => ({
    ...jest.requireActual('src/libs/notifications'),
    notify: jest.fn(),
  })
);

type PrefsExports = typeof import('src/libs/prefs');
jest.mock(
  'src/libs/prefs',
  (): PrefsExports => ({
    ...jest.requireActual('src/libs/prefs'),
    getLocalPref: jest.fn(),
    setLocalPref: jest.fn(),
  })
);

type FeaturePrev = typeof import('src/libs/feature-previews');
jest.mock(
  'src/libs/feature-previews',
  (): FeaturePrev => ({
    ...jest.requireActual('src/libs/feature-previews'),
    isFeaturePreviewEnabled: jest.fn(),
  })
);

const defaultAnalysesData: AnalysesData = {
  apps: [],
  refreshApps: () => Promise.resolve(),
  lastRefresh: null,
  runtimes: [],
  refreshRuntimes: () => Promise.resolve(),
  isLoadingCloudEnvironments: false,
  appDataDisks: [],
  persistentDisks: [],
};

const defaultUseAnalysisStore = {
  refreshFileStore: () => Promise.resolve(),
  loadedState: { status: 'Ready', state: [] as AnalysisFile[] } as LoadedState<AnalysisFile[], unknown>,
  createAnalysis: () => Promise.resolve(),
  deleteAnalysis: () => Promise.resolve(),
  pendingCreate: { status: 'None', state: true } as LoadedState<true, unknown>,
  pendingDelete: { status: 'None', state: true } as LoadedState<true, unknown>,
};

const defaultAnalysesProps: AnalysesProps = {
  workspace: { ...defaultGoogleWorkspace, workspaceInitialized: true },
  analysesData: defaultAnalysesData,
  onRequesterPaysError: () => {},
  storageDetails: { googleBucketLocation: '', googleBucketType: '', fetchedGoogleBucketLocation: undefined },
};

const watchCaptureEvent = jest.fn();

type AjaxMetricsContract = MetricsContract;
type OuterWorkspacesContract = WorkspacesAjaxContract;
type InnerWorkspacesContract = WorkspacesAjaxContract['workspace'];

const mockInnerWorkspaces = jest.fn().mockReturnValue({
  listActiveFileTransfers: jest.fn(),
}) as InnerWorkspacesContract;
const mockOuterWorkspaces: Partial<OuterWorkspacesContract> = {
  workspace: mockInnerWorkspaces,
};

const mockMetrics: Partial<AjaxMetricsContract> = {
  captureEvent: (event, details) => watchCaptureEvent(event, details),
};

describe('Analyses', () => {
  beforeEach(() => {
    // Arrange
    asMockedFn(useAnalysisFiles).mockReturnValue(defaultUseAnalysisStore);
    asMockedFn(notebookLockHash).mockReturnValue(Promise.resolve('testhash'));
    asMockedFn(findPotentialNotebookLockers).mockReturnValue(Promise.resolve({}));
    asMockedFn(Workspaces).mockReturnValue(mockOuterWorkspaces as WorkspacesAjaxContract);
    asMockedFn(Metrics).mockReturnValue(mockMetrics as MetricsContract);
    asMockedFn(getLocalPref).mockReturnValue(undefined);
  });

  it('loads properly with no files', async () => {
    // Act
    await act(async () => {
      // eslint-disable-line require-await
      render(h(BaseAnalyses, defaultAnalysesProps));
    });

    // Assert
    screen.getByText('Start');
    // Banner text and images
    screen.getByText('A place for all your analyses');
    screen.getByAltText('Jupyter');
    screen.getByAltText('RStudio Bioconductor');
    screen.getByAltText('Galaxy');
  });

  it('loads properly with files for a google workspace', async () => {
    // Arrange
    const fileName1 = 'file1.ipynb';
    const fileName2 = 'file2.ipynb';
    const files = [
      getFileFromPath(`test/${fileName1}` as AbsolutePath),
      getFileFromPath(`test/${fileName2}` as AbsolutePath),
    ];

    asMockedFn(useAnalysisFiles).mockReturnValue({
      ...defaultUseAnalysisStore,
      loadedState: { status: 'Ready', state: files },
    });

    // Act
    await act(async () => {
      // eslint-disable-line require-await
      render(h(BaseAnalyses, defaultAnalysesProps));
    });

    // Assert
    screen.getByText('Start');
    // Table headings
    screen.getByText('Application');
    screen.getByText('Name');
    screen.getByText('Last Modified');
    screen.getByPlaceholderText('Search analyses');
    screen.getByText(fileName1);
    screen.getByText(fileName2);
  });

  it('loads properly with files for an azure workspace', async () => {
    // Arrange
    const fileName1 = 'file1.ipynb';
    const fileName2 = 'file2.ipynb';
    const files = [
      getFileFromPath(`test/${fileName1}` as AbsolutePath),
      getFileFromPath(`test/${fileName2}` as AbsolutePath),
    ];

    asMockedFn(useAnalysisFiles).mockReturnValue({
      ...defaultUseAnalysisStore,
      loadedState: { status: 'Ready', state: files },
    });

    // Act
    await act(async () => {
      // eslint-disable-line require-await
      render(
        h(BaseAnalyses, {
          ...defaultAnalysesProps,
          workspace: { ...defaultAzureWorkspace, workspaceInitialized: true },
        })
      );
    });

    // Assert
    screen.getByText('Start');
    // Table headings
    screen.getByText('Application');
    screen.getByText('Name');
    screen.getByText('Last Modified');
    screen.getByPlaceholderText('Search analyses');
    screen.getByText(fileName1);
    screen.getByText(fileName2);
  });

  it('Sorts analysis table properly', async () => {
    // Arrange
    const fileName1 = 'file1.ipynb';
    const fileName2 = 'file2.ipynb';
    const file1Date = new Date().getTime();
    const file2Date = file1Date + 10000;
    const files = [
      { ...getFileFromPath(`test/${fileName1}` as AbsolutePath), lastModified: file1Date },
      { ...getFileFromPath(`test/${fileName2}` as AbsolutePath), lastModified: file2Date },
    ];

    asMockedFn(useAnalysisFiles).mockReturnValue({
      ...defaultUseAnalysisStore,
      loadedState: { status: 'Ready', state: files },
    });

    // Act
    await act(async () => {
      // eslint-disable-line require-await
      render(h(BaseAnalyses, defaultAnalysesProps));
    });

    const analysisRowsBeforeSort: HTMLElement[] = screen.queryAllByRole('row');
    const nameTableHeader = screen.getByText('Name');

    await act(async () => {
      await userEvent.click(nameTableHeader);
    });

    // Assert visual state before sorting
    expect(analysisRowsBeforeSort.length).toBe(3);
    expect(analysisRowsBeforeSort[1].textContent).toContain(fileName2);
    expect(analysisRowsBeforeSort[2].textContent).toContain(fileName1);

    // Assert files have inverted in table after sort
    const analysisRowsAfterSort: HTMLElement[] = screen.queryAllByRole('row');
    expect(analysisRowsAfterSort.length).toBe(3); // 2 files plus 1 header row = 3
    expect(analysisRowsAfterSort[1].textContent).toContain(fileName1);
    expect(analysisRowsAfterSort[2].textContent).toContain(fileName2);
  });

  it('Properly navigates to launcher on clicking an analysis', async () => {
    // Arrange
    const navGoToPathObservable = jest.fn();
    asMockedFn(goToPath).mockImplementation(navGoToPathObservable);

    const fileName1 = 'file1.ipynb';
    const fileName2 = 'file2.ipynb';
    const files = [
      getFileFromPath(`test/${fileName1}` as AbsolutePath),
      getFileFromPath(`test/${fileName2}` as AbsolutePath),
    ];

    asMockedFn(useAnalysisFiles).mockReturnValue({
      ...defaultUseAnalysisStore,
      loadedState: { status: 'Ready', state: files },
    });

    // Act
    await act(async () => {
      // eslint-disable-line require-await
      render(h(BaseAnalyses, defaultAnalysesProps));
    });

    // Assert
    const analysisCard = screen.getByText(fileName1);
    await userEvent.click(analysisCard);
    expect(goToPath).toHaveBeenCalledWith(analysisLauncherTabName, {
      namespace: defaultAnalysesProps.workspace.workspace.namespace,
      name: defaultAnalysesProps.workspace.workspace.name,
      analysisName: fileName1,
    });
  });

  it('Displays JupyterLab enablement feature properly', async () => {
    // Arrange
    const fileName1 = 'file1.ipynb';
    const fileName2 = 'file2.ipynb';
    const files = [
      getFileFromPath(`test/${fileName1}` as AbsolutePath),
      getFileFromPath(`test/${fileName2}` as AbsolutePath),
    ];

    asMockedFn(useAnalysisFiles).mockReturnValue({
      ...defaultUseAnalysisStore,
      loadedState: { status: 'Ready', state: files },
    });

    asMockedFn(isFeaturePreviewEnabled).mockImplementation((key) => {
      return key === JUPYTERLAB_GCP_FEATURE_ID;
    });
    const setLocalPrefObservable = jest.fn();
    asMockedFn(setLocalPref).mockImplementation(setLocalPrefObservable);

    // Act
    await act(async () => {
      // eslint-disable-line require-await
      render(h(BaseAnalyses, defaultAnalysesProps));
    });

    // Assert
    const enableJupyterLabButton = screen.getByLabelText('Enable JupyterLab');

    expect(enableJupyterLabButton).not.toBeChecked();
    await userEvent.click(enableJupyterLabButton);
    expect(setLocalPrefObservable).toHaveBeenCalledWith(
      `${defaultAnalysesProps.workspace.workspace.namespace}/${defaultAnalysesProps.workspace.workspace.name}/${ENABLE_JUPYTERLAB_ID}`,
      true
    );
    expect(enableJupyterLabButton).toBeChecked();
  });

  it('Displays active file transfer message', async () => {
    const fileName1 = 'file1.ipynb';
    const fileName2 = 'file2.ipynb';
    const files = [
      getFileFromPath(`test/${fileName1}` as AbsolutePath),
      getFileFromPath(`test/${fileName2}` as AbsolutePath),
    ];

    asMockedFn(useAnalysisFiles).mockReturnValue({
      ...defaultUseAnalysisStore,
      loadedState: { status: 'Ready', state: files },
    });

    const mockInnerWorkspaces = jest.fn().mockReturnValue({
      // TODO: once this function is typed this will need to return something valid, not a number[]
      listActiveFileTransfers: () => Promise.resolve([1]),
    }) as InnerWorkspacesContract;
    const mockOuterWorkspaces: Partial<OuterWorkspacesContract> = {
      workspace: mockInnerWorkspaces,
    };

    asMockedFn(Workspaces).mockReturnValue(mockOuterWorkspaces as WorkspacesAjaxContract);

    // Act
    await act(async () => {
      // eslint-disable-line require-await
      render(h(BaseAnalyses, defaultAnalysesProps));
    });

    screen.getByText('Copying 1 or more interactive analysis files from another workspace.');
  });

  it('Should compute a new unique file name', () => {
    // Arrange
    const file1 = 'file1.ipynb' as FileName;
    const file2 = 'file2.ipynb' as FileName;
    const file3 = 'file3.ipynb' as FileName;

    // Act
    const result1 = getUniqueFileName(file1, [file2, file3]);
    const result2 = getUniqueFileName(file2, [file2, file3]);

    // Assert
    expect(result1).toBe(file1);
    expect(result2).toBe('file2_1.ipynb' as FileName);
  });

  it('Should upload files properly', async () => {
    // Arrange
    const fileName1 = 'file1.ipynb';
    const fileName2 = 'file2.ipynb';
    const files = [
      getFileFromPath(`test/${fileName1}` as AbsolutePath),
      getFileFromPath(`test/${fileName2}` as AbsolutePath),
    ];
    const droppedFileName = 'file3.ipynb';
    const droppedFileContents = 'testContent';
    const fileToDrop = new File([droppedFileContents], droppedFileName);
    const createObservable = jest.fn();
    const user = userEvent.setup();

    asMockedFn(useAnalysisFiles).mockReturnValue({
      ...defaultUseAnalysisStore,
      loadedState: { status: 'Ready', state: files },
      createAnalysis: createObservable,
    });

    // Act
    await act(async () => {
      render(h(BaseAnalyses, defaultAnalysesProps));
    });
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(fileInput, [fileToDrop]);

    expect(createObservable).toHaveBeenCalledWith(droppedFileName, runtimeToolLabels.Jupyter, fileToDrop);
  });

  it('Should open a modal when I click start', async () => {
    await act(async () => {
      // eslint-disable-line require-await
      render(h(BaseAnalyses, defaultAnalysesProps));
    });

    const startButton = screen.getByText('Start');
    await userEvent.click(startButton);

    const modalTitle = document.getElementById('analysis-modal-title');
    expect(modalTitle).toBeInTheDocument();
  });

  it('calls refreshAnalyses on mount', async () => {
    // Arrange
    const refreshAnalysesMock = jest.fn();
    asMockedFn(useAnalysisFiles).mockReturnValue({
      ...defaultUseAnalysisStore,
      refreshFileStore: refreshAnalysesMock,
    });

    // Act
    await act(async () => {
      render(h(BaseAnalyses, defaultAnalysesProps));
    });

    // Assert
    expect(refreshAnalysesMock).toHaveBeenCalled();
  });
});
