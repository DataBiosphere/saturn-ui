import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import _ from 'lodash/fp';
import { h } from 'react-hyperscript-helpers';
import { AjaxContract } from 'src/libs/ajax';
import {
  AzureBlobByUriContract,
  AzureBlobResult,
  AzureStorage,
  AzureStorageContract,
  SasInfo,
  StorageDetails,
} from 'src/libs/ajax/AzureStorage';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { CromwellApp, CromwellAppAjaxContract, WorkflowsContract } from 'src/libs/ajax/workflows-app/CromwellApp';
import * as configStore from 'src/libs/config';
import Events from 'src/libs/events';
import { makeCompleteDate } from 'src/libs/utils';
import { asMockedFn, partial, renderWithAppContexts as render, SelectHelper } from 'src/testing/test-utils';
import { appendSASTokenIfNecessary, getFilenameFromAzureBlobPath } from 'src/workflows-app/components/InputOutputModal';
import { collapseCromwellStatus } from 'src/workflows-app/components/job-common';
import { failedTasks as failedTasksMetadata } from 'src/workflows-app/fixtures/failed-tasks';
import { diff as callCacheDiff } from 'src/workflows-app/fixtures/test-callcache-diff';
import { metadata as callCacheDiffMetadata } from 'src/workflows-app/fixtures/test-callcache-from-workflow';
import { metadata as childMetadata } from 'src/workflows-app/fixtures/test-child-workflow';
import { metadata as parentMetadata } from 'src/workflows-app/fixtures/test-parent-workflow';
import { metadata as runDetailsMetadata } from 'src/workflows-app/fixtures/test-workflow';
import { BaseRunDetails } from 'src/workflows-app/RunDetails';
import { mockAzureWorkspace } from 'src/workflows-app/utils/mock-responses';
import { isAzureUri } from 'src/workspace-data/data-table/uri-viewer/uri-viewer-utils';

import { parseFullFilepathToContainerDirectory } from './utils/task-log-utils';

jest.mock('src/libs/ajax/AzureStorage');
jest.mock('src/libs/ajax/Metrics');
jest.mock('src/libs/ajax/workflows-app/CromwellApp');

const wdsUrlRoot = 'https://lz-abc/wds-abc-c07807929cd1/';
const cbasUrlRoot = 'https://lz-abc/terra-app-abc/cbas';
const cromwellUrlRoot = 'https://lz-abc/terra-app-abc/cromwell';

jest.mock('src/libs/config', () => ({
  ...jest.requireActual('src/libs/config'),
  getConfig: jest.fn().mockReturnValue({ cromwellUrlRoot, cbasUrlRoot, wdsUrlRoot }),
}));

jest.mock('./utils/task-log-utils', () => ({
  ...jest.requireActual('src/workflows-app/utils/task-log-utils'),
  discoverTesLogs: jest.fn().mockReturnValue([
    {
      logUri: 'someBlobUri.com',
      logTitle: 'Backend Standard Out',
      logKey: 'tes_stdout',
      logFilename: 'tes_stdout',
      logTooltip: 'LogTooltips.backend',
    },
    {
      logUri: 'someBlobUri.com',
      logTitle: 'Backend Standard Err',
      logKey: 'tes_stderr',
      logFilename: 'tes_stderr',
      logTooltip: 'LogTooltips.backend',
    },
    {
      logUri: 'someBlobUri.com',
      logTitle: 'Download Standard Out',
      logKey: 'tes_download_stdout',
      logFilename: 'download_stdout',
      logTooltip: 'LogTooltips.download',
    },
    {
      logUri: 'someBlobUri.com',
      logTitle: 'Download Standard Err',
      logKey: 'tes_download_stderr',
      logFilename: 'download_stderr',
      logTooltip: 'LogTooltips.download',
    },
  ]),
}));

jest.mock('src/libs/nav', () => ({
  getCurrentUrl: jest.fn().mockReturnValue(new URL('https://app.terra.bio')),
  getLink: jest.fn(),
  goToPath: jest.fn(),
}));

const runDetailsProps = {
  namespace: 'example-billing-project',
  name: 'workspace',
  workspace: mockAzureWorkspace,
  submissionId: '000sdkfjsdfj-dfdsfdsf3-sdfsdjfkj3',
  workflowId: '00001111-2222-3333-aaaa-bbbbccccdddd',
  uri: 'https://coaexternalstorage.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
};

const captureEvent = jest.fn();

const mockObj: Pick<AjaxContract, 'CromwellApp' | 'AzureStorage' | 'Metrics'> = {
  CromwellApp: partial<CromwellAppAjaxContract>({
    workflows: () =>
      partial<WorkflowsContract>({
        metadata: jest.fn(async () => runDetailsMetadata),
        failedTasks: jest.fn(async () => failedTasksMetadata),
      }),
    callCacheDiff: jest.fn(async () => callCacheDiff),
  }),
  AzureStorage: partial<AzureStorageContract>({
    blobByUri: jest.fn(() =>
      partial<AzureBlobByUriContract>({
        getMetadataAndTextContent: async () => ({
          uri: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
          sasToken: '1234-this-is-a-mock-sas-token-5678',
          fileName: 'inputFile.txt',
          name: 'inputFile.txt',
          workspaceId: 'user-inputs',
          lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
          size: '324',
          contentType: 'text/plain',
          textContent: 'this is the text of a mock file',
          azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
        }),
      })
    ),
    details: jest.fn(async () =>
      partial<StorageDetails>({
        sas: partial<SasInfo>({ token: '1234-this-is-a-mock-sas-token-5678' }),
      })
    ),
  }),
  Metrics: partial<MetricsContract>({
    captureEvent,
  }),
};

type ParentMetadata = typeof parentMetadata;
const subworkflowCromwellAjaxMock = (parentOverride: Partial<ParentMetadata> = {}): CromwellAppAjaxContract => {
  const modifiedParentMetadata = { ...parentMetadata, ...parentOverride };
  return partial<CromwellAppAjaxContract>({
    workflows: (id) => ({
      metadata: jest.fn(() => {
        const workflowMap = {
          [parentMetadata.id]: modifiedParentMetadata,
          [childMetadata.id]: childMetadata,
        };
        return Promise.resolve(workflowMap[id]);
      }),
      failedTasks: jest.fn(async () => ({})),
    }),
  });
};

beforeEach(() => {
  asMockedFn(AzureStorage).mockReturnValue(mockObj.AzureStorage);
  asMockedFn(CromwellApp).mockReturnValue(mockObj.CromwellApp);
  asMockedFn(Metrics).mockReturnValue(mockObj.Metrics);
});

describe('BaseRunDetails - render smoke test', () => {
  const originalOffsetHeight: PropertyDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetHeight'
  ) || { value: undefined };
  const originalOffsetWidth: PropertyDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetWidth'
  ) || { value: undefined };

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 1000 });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });
  });

  afterAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
  });

  it('has copy buttons', async () => {
    // Act
    await act(async () => render(h(BaseRunDetails, runDetailsProps)));

    // Assert
    screen.getByLabelText('Copy workflow id');
    screen.getByLabelText('Copy submission id');
    screen.getByText(runDetailsProps.workflowId);
    screen.getByText(runDetailsProps.submissionId);
  });

  it('shows the calls in a table', async () => {
    // Arrange
    const { calls } = runDetailsMetadata;

    const calcRowCount = () => {
      const callNames = Object.keys(calls);
      return callNames.reduce((rows, callName) => {
        rows += calls[callName]?.length || 0;
        return rows;
      }, 1);
    };

    // Act
    await act(async () => render(h(BaseRunDetails, runDetailsProps)));

    // Assert
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toEqual(calcRowCount());
    const taskRows = rows.slice(1);
    const taskNames = Object.keys(calls);
    taskNames.forEach((taskName, index) => {
      const { executionStatus, backendStatus, start, end } = calls[taskName][0];
      const row = taskRows[index];
      within(row).getByText(taskName);
      within(row).getByText('Logs');
      // Checking row text content for dates since querying by formatted date doesn't seem to work
      const statusObj = collapseCromwellStatus(executionStatus, backendStatus);
      const status = within(row).getAllByText(statusObj.label());
      expect(status.length).toEqual(1);
      const targetStartText = makeCompleteDate(start);
      const targetEndText = makeCompleteDate(end);
      expect(row.textContent).toContain(targetStartText);
      expect(row.textContent).toContain(targetEndText);
    });
  });

  it('shows expected cost details', async () => {
    // Act
    await act(async () => render(h(BaseRunDetails, runDetailsProps)));

    // Assert
    const table = screen.getByRole('table');
    const tableRows = within(table).getAllByRole('row').slice(1); // omit header row

    // cost should be calculated and displayed
    const task1Row = tableRows[0];
    const cellsFromDataRow1 = within(task1Row).getAllByRole('cell');
    within(cellsFromDataRow1[7]).getByText('$12.72');

    // Cache hit should display a dash
    const task4Row = tableRows[3];
    const cellsFromDataRow4 = within(task4Row).getAllByRole('cell');
    within(cellsFromDataRow4[7]).getByText('-');
  });

  it('only shows failed tasks if a workflow has failed', async () => {
    // Arrange
    const failedTaskCalls = Object.values(failedTasksMetadata)[0].calls;
    const targetCall = Object.values(failedTaskCalls)[0][0];
    const { start, end } = targetCall;
    const workflowCopy = _.cloneDeep(runDetailsMetadata);
    workflowCopy.status = 'Failed';

    asMockedFn(CromwellApp).mockReturnValue(
      partial<CromwellAppAjaxContract>({
        workflows: () =>
          partial<WorkflowsContract>({
            metadata: async () => workflowCopy,
            failedTasks: async () => failedTasksMetadata,
          }),
      })
    );

    const user = userEvent.setup();

    // Act
    await act(async () => render(h(BaseRunDetails, runDetailsProps)));

    // Assert
    const statusFilter = screen.getByLabelText('Status');
    const select = new SelectHelper(statusFilter, user);
    expect(select.getSelectedOptions()).toEqual(['Failed']);
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toEqual(6);
    const targetRow = within(table).getAllByRole('row')[1];
    within(targetRow).getByText('sub_wf_scattering.subSubworkflowHello');
    const failedStatus = within(targetRow).getAllByText('Failed (1 Message)');
    expect(failedStatus.length).toEqual(1);
    const targetStartText = makeCompleteDate(start);
    const targetEndText = makeCompleteDate(end);
    expect(targetRow.textContent).toContain(targetStartText);
    expect(targetRow.textContent).toContain(targetEndText);
    within(targetRow).getByText('Logs');
  });

  it('only opens the failure modal when failure status is clicked', async () => {
    // Arrange
    const workflowCopy = _.cloneDeep(runDetailsMetadata);
    workflowCopy.status = 'Failed';

    asMockedFn(CromwellApp).mockReturnValue(
      partial<CromwellAppAjaxContract>({
        workflows: () =>
          partial<WorkflowsContract>({
            metadata: async () => workflowCopy,
            failedTasks: async () => failedTasksMetadata,
          }),
      })
    );

    const user = userEvent.setup();

    // Act
    await act(async () => render(h(BaseRunDetails, runDetailsProps)));

    // Assert
    const table = screen.getByRole('table');
    const targetRow = within(table).getAllByRole('row')[1];
    const failedStatus = within(targetRow).getAllByText('Failed (1 Message)');
    await user.click(failedStatus[0]);
    screen.getByText('Messages');
  });

  it('opens the log viewer modal when Workflow Execution Logs is clicked', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    await act(async () => render(h(BaseRunDetails, runDetailsProps)));
    const executionLogButton = screen.getByText('Workflow Execution Log');
    await user.click(executionLogButton);

    // Assert
    expect(screen.getByText('workflow.log')); // log content displayed
    expect(screen.getByText('this is the text of a mock file'));
    expect(screen.getByLabelText('Download log')).toHaveTextContent('Download');

    const closeButton = screen.getByLabelText('Close modal'); // close button works
    expect(captureEvent).not.toHaveBeenCalled();
    await user.click(closeButton);
    expect(captureEvent).toHaveBeenCalledWith(Events.workflowsAppCloseLogViewer, undefined, undefined);
  });

  it('opens the log viewer modal when Logs is clicked from the call table', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    await act(async () => render(h(BaseRunDetails, runDetailsProps)));
    const table = screen.getByRole('table');
    const logsLink = within(table).getAllByText('Logs');
    await user.click(logsLink[0]);

    // Assert
    expect(screen.getByText('Task Standard Out'));
    expect(screen.getByText('Task Standard Err'));
  });

  it('shows a static error message on LogViewer if log cannot be retrieved', async () => {
    // Arrange
    const mockAzureStorage = _.cloneDeep(mockObj.AzureStorage);
    mockAzureStorage.blobByUri = jest.fn(() =>
      partial<AzureBlobByUriContract>({
        getMetadataAndTextContent: () => Promise.reject('Mock error'),
      })
    );
    asMockedFn(AzureStorage).mockReturnValue(mockAzureStorage);
    const user = userEvent.setup();

    // Act
    await act(async () => render(h(BaseRunDetails, runDetailsProps)));
    const table = screen.getByRole('table');
    const logsLink = within(table).getAllByText('Logs');
    await user.click(logsLink[0]);

    // Assert
    expect(screen.queryByLabelText('Download log')).not.toBeDefined;
    screen.getByText('Task Standard Out');
    screen.getByText(
      "Log file could not be loaded. If the workflow or task is still in progress, the log file likely hasn't been generated yet. Some logs may be unavailable if the workflow or task failed before they could be generated."
    );
  });

  it('opens a log modal with functional tabs', async () => {
    // Arrange
    const mockFetchedLogData = {
      uri: 'https://someBlobFilePath.blob.core.windows.net/asdf',
      sasToken: 'asdf1234',
      lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
      size: '324',
      azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
      workspaceId: 'someWorkspaceId',
      fileName: 'inputFile.txt',
      name: 'inputFile.txt',
      textContent: 'this is the text of a mock file',
    };

    const mockAzureStorage = _.cloneDeep(mockObj.AzureStorage);
    mockAzureStorage.blobByUri = jest.fn(() =>
      partial<AzureBlobByUriContract>({
        getMetadataAndTextContent: async () => mockFetchedLogData,
      })
    );
    asMockedFn(AzureStorage).mockReturnValue(mockAzureStorage);
    const user = userEvent.setup();

    // Act
    await act(async () => render(h(BaseRunDetails, runDetailsProps)));
    const table = screen.getByRole('table');
    const logsLink = within(table).getAllByText('Logs');
    await user.click(logsLink[0]);

    // Assert
    // Presence of 'Task' logs shows we can fetch Cromwell task logs
    // Presence of 'Backend' logs shows we can fetch pre-TES 4.7 logs
    // Presence of 'Download' logs shows we can fetch post TES 4.7 logs
    const stdoutButton = screen.getByText('Task Standard Out');
    await user.click(stdoutButton);
    expect(screen.getByText('stdout.txt')).toBeVisible();
    expect(screen.queryByText('stderr.txt')).not.toBeInTheDocument();

    const stderrButton = screen.getByText('Task Standard Err');
    await user.click(stderrButton);
    expect(screen.getByText('stderr.txt')).toBeVisible(); // prove that switching tabs works
    expect(screen.queryByText('stdout.txt')).not.toBeInTheDocument();

    // the presence of the download log tab is proof that the log viewer was able to fetch the (mocked) TES logs,
    // which uses a different code path than the task logs do.
    const downloadStdOutButton = screen.getByText('Backend Standard Out');
    await user.click(downloadStdOutButton);
    expect(screen.getByText('tes_stdout')).toBeVisible();
    expect(screen.getByText('Backend Standard Out'));
    expect(screen.getByText('Backend Standard Err'));
    expect(screen.getByText('Download Standard Out'));
    expect(screen.getByText('Download Standard Err'));
  });

  it('parses blob URIs correctly', () => {
    // Arrange
    const tesLogFile =
      'https://lz813a3d637adefec2c6e88f.blob.core.windows.net/sc-bed4cf6c-8153-4f3d-852f-532cc17e6582/workspace-services/cbas/terra-app-c26307e1-4666-4a9a-aa27-dfb259be46a6/fetch_sra_to_bam/6d935b1a-e899-45da-9627-a94c23a2ca53/call-Fetch_SRA_to_BAM/tes_task/stderr.txt';

    const tesLogFolder =
      'https://lz813a3d637adefec2c6e88f.blob.core.windows.net/sc-bed4cf6c-8153-4f3d-852f-532cc17e6582/workspace-services/cbas/terra-app-c26307e1-4666-4a9a-aa27-dfb259be46a6/fetch_sra_to_bam/6d935b1a-e899-45da-9627-a94c23a2ca53/call-Fetch_SRA_to_BAM/tes_task/';

    const tesLogFolderWithoutSlash =
      'https://lz813a3d637adefec2c6e88f.blob.core.windows.net/sc-bed4cf6c-8153-4f3d-852f-532cc17e6582/workspace-services/cbas/terra-app-c26307e1-4666-4a9a-aa27-dfb259be46a6/fetch_sra_to_bam/6d935b1a-e899-45da-9627-a94c23a2ca53/call-Fetch_SRA_to_BAM/tes_task';

    const workspaceId = 'bed4cf6c-8153-4f3d-852f-532cc17e6582';

    const expected =
      'workspace-services/cbas/terra-app-c26307e1-4666-4a9a-aa27-dfb259be46a6/fetch_sra_to_bam/6d935b1a-e899-45da-9627-a94c23a2ca53/call-Fetch_SRA_to_BAM/tes_task';

    // Act & Assert
    expect(parseFullFilepathToContainerDirectory(workspaceId, tesLogFile)).toEqual(expected);
    expect(parseFullFilepathToContainerDirectory(workspaceId, tesLogFolder)).toEqual(expected);
    expect(parseFullFilepathToContainerDirectory(workspaceId, tesLogFolderWithoutSlash)).toEqual(expected);
  });

  it('correctly identifies azure URIs', () => {
    // Act & Assert
    expect(isAzureUri('https://coaexternalstorage.blob.core.windows.net/cromwell/user-inputs/inputFile.txt'))
      .toBeTruthy;
    expect(isAzureUri('gs://some-bucket/some-file.txt')).toBeFalsy;
  });

  it('shows a functional log modal when clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    await act(async () => render(h(BaseRunDetails, runDetailsProps)));
    const showLogsLink = screen.getAllByText('Logs')[0];

    // Act
    await user.click(showLogsLink); // Open the modal

    // Assert
    // Verify all the element titles are present
    screen.getByText('Task Standard Out');
    screen.getByText('Task Standard Err');
    screen.getByLabelText('Download log');
    // Verify the data loaded properly
    screen.getByText('this is the text of a mock file');
  });

  it('shows download button AND error when URI is valid but text could not be parsed', async () => {
    // Arrange
    const mockAzureStorage = _.cloneDeep(mockObj.AzureStorage);
    mockAzureStorage.blobByUri = jest.fn(() =>
      partial<AzureBlobByUriContract>({
        getMetadataAndTextContent: async () =>
          partial<AzureBlobResult>({
            textContent: undefined,
            azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
          }),
      })
    );
    asMockedFn(AzureStorage).mockReturnValue(mockAzureStorage);
    const user = userEvent.setup();
    await act(async () => render(h(BaseRunDetails, runDetailsProps)));
    const showLogsLink = screen.getAllByText('Logs')[0];

    // Act
    await user.click(showLogsLink); // Open the modal

    // Assert
    // Verify all the element titles are present
    screen.getByText('Task Standard Out');
    screen.getByText('Task Standard Err');

    // Verify the error is displayed.
    screen.getByText(
      "Log file could not be loaded. If the workflow or task is still in progress, the log file likely hasn't been generated yet. Some logs may be unavailable if the workflow or task failed before they could be generated."
    );
  });

  it('filters out task list via task name search', async () => {
    // Arrange
    const taskName = Object.keys(runDetailsMetadata.calls)[0];
    await act(async () => render(h(BaseRunDetails, runDetailsProps)));
    const searchInput = screen.getByPlaceholderText('Search by task name');

    // Act
    await userEvent.type(searchInput, 'Random');

    // Assert
    const updatedTable = screen.getByRole('table');
    const updatedRows = within(updatedTable).getAllByRole('row');
    expect(updatedRows.length).toEqual(1);
    const updatedElements = within(updatedTable).queryAllByText(taskName);
    expect(updatedElements.length).toEqual(0);
  });

  it('filters in tasks via task name search', async () => {
    // Arrange
    const taskName = Object.keys(runDetailsMetadata.calls)[0];
    await act(async () => render(h(BaseRunDetails, runDetailsProps)));
    const searchInput = screen.getByPlaceholderText('Search by task name');

    // Act
    await userEvent.type(searchInput, 'Fetch');

    // Assert
    const updatedTable = screen.getByRole('table');
    const updatedRows = within(updatedTable).getAllByRole('row');
    expect(updatedRows.length).toEqual(6);
    const updatedElement = within(updatedTable).getAllByText(taskName);
    expect(updatedElement.length).toEqual(1);
    expect(updatedElement[0].textContent).toEqual(taskName);
  });

  it('opens the input/output modal when Inputs is clicked', async () => {
    const user = userEvent.setup();
    await act(async () => render(h(BaseRunDetails, runDetailsProps)));
    const table = screen.getByRole('table');
    const inputs = within(table).getAllByLabelText('View task inputs');
    await user.click(inputs[0]);
    screen.getByText('Key');
    screen.getByText('Value');
    screen.getByText('docker');
    screen.getByText('quay.io/broadinstitute/ncbi-tools:2.10.7.10');
  });

  it('opens the input/output modal when Outputs is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    await act(async () => render(h(BaseRunDetails, runDetailsProps)));
    const table = screen.getByRole('table');
    const outputs = within(table).getAllByLabelText('View task outputs');

    // Act
    await user.click(outputs[0]);

    // Assert
    // There is no output data in this test case, but the modal still open.
    screen.getByText('Key');
    screen.getByText('Value');
  });

  it('input/output modal file functions work as expected', () => {
    // Arrange
    const mockWorkspaceId = 'd4564046-bbba-495c-afec-14f7d3a8283a';
    jest.spyOn(configStore, 'getConfig').mockReturnValue({ workspaceId: mockWorkspaceId });
    const publicURI =
      'https://lza6bdb4ac5ff7bbc4bf6359.blob.core.windows.net/sc-fa554638-fc2b-42bd-b376-99db48fefd72/ref-sarscov2-NC_045512.2.fasta';
    const privateURI =
      'https://lz43a8a3d21540dfd25f5ace.blob.core.windows.net/sc-d4564046-bbba-495c-afec-14f7d3a8283a/workspace-services/cbas/terra-app-566e92a0-e55e-4250-b4c1-d0925dd03916/assemble_refbased/43d15a0d-848b-46e3-a1da-02b37caaa761/call-align_to_ref/shard-0/execution/stdout';
    const mockSAS = 'mockSAS';

    expect(privateURI.includes(mockWorkspaceId)).toBeTruthy; // sanity check that the test is set up properly

    // Act & Assert
    // Should be the last thing after the slash
    const publicFilename = getFilenameFromAzureBlobPath(publicURI);
    const privateFilename = getFilenameFromAzureBlobPath(privateURI);
    expect(publicFilename).toEqual('ref-sarscov2-NC_045512.2.fasta');
    expect(privateFilename).toEqual('stdout');
    expect(getFilenameFromAzureBlobPath('')).toEqual('');
    expect(getFilenameFromAzureBlobPath(undefined)).toEqual('');

    // Should only append SAS if it is a private URI
    const appendedPublic = appendSASTokenIfNecessary(publicURI, mockSAS, mockWorkspaceId);
    const appendedPrivate = appendSASTokenIfNecessary(privateURI, mockSAS, mockWorkspaceId);
    expect(appendedPublic).toEqual(publicURI);
    expect(appendedPrivate).toEqual(`${privateURI}?${mockSAS}`);
  });

  it('renders the workflow path above the table for successful workflows', async () => {
    // Act
    await act(async () => render(h(BaseRunDetails, runDetailsProps)));

    // Assert
    const workflowPath = screen.getByLabelText('Workflow Breadcrumb');
    within(workflowPath).getByText(runDetailsMetadata.workflowName);
  });

  it('shows the "View sub-workflow" button for sub-workflows', async () => {
    // Arrange
    asMockedFn(CromwellApp).mockReturnValue(subworkflowCromwellAjaxMock({ status: 'Succeeded' }));

    const altBaseRunDetailsProps = { ...runDetailsProps, workflowId: parentMetadata.id };

    // Act
    await act(async () => render(h(BaseRunDetails, altBaseRunDetailsProps)));

    // Assert
    const table = screen.getByRole('table');
    within(table).getByText('View sub-workflow');
  });

  it('updates the workflow path when the "View sub-workflow" button is clicked', async () => {
    // Arrange
    asMockedFn(CromwellApp).mockReturnValue(subworkflowCromwellAjaxMock({ status: 'Succeeded' }));

    const user = userEvent.setup();
    const altBaseRunDetailsProps = { ...runDetailsProps, workflowId: parentMetadata.id };

    // Act
    await act(async () => render(h(BaseRunDetails, altBaseRunDetailsProps)));

    // Assert
    const table = screen.getByRole('table');
    const subworkflowButton = within(table).getByText('View sub-workflow');
    await user.click(subworkflowButton);
    const workflowPath = screen.getByLabelText('Workflow Breadcrumb');
    within(workflowPath).getByText(childMetadata.workflowName);
  });

  it('updates the table to show the sub-workflow calls when the "View sub-workflow" button is clicked', async () => {
    // Arrange
    asMockedFn(CromwellApp).mockReturnValue(subworkflowCromwellAjaxMock({ status: 'Succeeded' }));

    const user = userEvent.setup();
    const altBaseRunDetailsProps = { ...runDetailsProps, workflowId: parentMetadata.id };

    await act(async () => render(h(BaseRunDetails, altBaseRunDetailsProps)));
    const table = screen.getByRole('table');
    const subworkflowButton = within(table).getByText('View sub-workflow');

    // Act
    await user.click(subworkflowButton);

    // Assert
    const updatedTable = screen.getByRole('table');
    const subWorkflowTaskNames = Object.keys(childMetadata.calls);
    subWorkflowTaskNames.forEach((taskName) => {
      within(updatedTable).getAllByText(taskName);
    });
  });

  it('updates the workflow path and the table if the user clicks on a workflow id within the workflow path', async () => {
    // Arrange
    asMockedFn(CromwellApp).mockReturnValue(subworkflowCromwellAjaxMock({ status: 'Succeeded' }));

    const altBaseRunDetailsProps = { ...runDetailsProps, workflowId: parentMetadata.id };
    const user = userEvent.setup();

    await act(async () => render(h(BaseRunDetails, altBaseRunDetailsProps)));

    const table = screen.getByRole('table');
    const subworkflowButton = within(table).getByText('View sub-workflow');
    await user.click(subworkflowButton);
    const workflowPath = screen.getByLabelText('Workflow Breadcrumb');
    const targetIdPath = within(workflowPath).getByText(parentMetadata.workflowName);

    // Act
    await user.click(targetIdPath);

    // Assert
    const updatedTable = screen.getByRole('table');
    const updatedPath = screen.getByLabelText('Workflow Breadcrumb');
    within(updatedPath).getByText(parentMetadata.workflowName);
    expect(screen.queryByText(childMetadata.workflowName)).not.toBeInTheDocument;
    const parentTaskNames = Object.keys(parentMetadata.calls);
    parentTaskNames.forEach((taskName) => {
      within(updatedTable).getByText(taskName);
    });
  });

  it('loads the page even if the failed tasks endpoint returns an error', async () => {
    // Arrange
    const workflowCopy = _.cloneDeep(runDetailsMetadata);
    const failedTaskName = 'fetch_sra_to_bam.Fetch_SRA_to_BAM';
    const failedCall = workflowCopy.calls[failedTaskName][0];
    const { start, end } = failedCall;
    failedCall.backendStatus = 'Failed';
    failedCall.executionStatus = 'Failed';
    workflowCopy.status = 'Failed';

    asMockedFn(CromwellApp).mockReturnValue(
      partial<CromwellAppAjaxContract>({
        workflows: () =>
          partial<WorkflowsContract>({
            metadata: async () => workflowCopy,
            failedTasks: async () => Promise.reject(),
          }),
      })
    );

    const user = userEvent.setup();

    // Act
    await act(async () => render(h(BaseRunDetails, runDetailsProps)));

    // Assert
    const statusFilter = screen.getByLabelText('Status');
    const select = new SelectHelper(statusFilter, user);
    expect(select.getSelectedOptions()).toEqual(['Failed']);
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toEqual(2);
    const targetRow = within(table).getAllByRole('row')[1];
    within(targetRow).getByText(failedTaskName);
    const failedStatus = within(targetRow).getAllByText('Failed');
    expect(failedStatus.length).toEqual(1);
    const targetStartText = makeCompleteDate(start);
    const targetEndText = makeCompleteDate(end);
    expect(targetRow.textContent).toContain(targetStartText);
    expect(targetRow.textContent).toContain(targetEndText);
  });

  it('loads the call cache diff wizard', async () => {
    // Arrange
    const user = userEvent.setup();

    await act(async () => render(h(BaseRunDetails, runDetailsProps)));

    const showWizard = screen.getByLabelText('call cache debug wizard');
    await user.click(showWizard); // Open the modal

    // Adjust to load other workflow metadata
    asMockedFn(CromwellApp).mockReturnValue(
      partial<CromwellAppAjaxContract>({
        workflows: () =>
          partial<WorkflowsContract>({
            metadata: async () => callCacheDiffMetadata,
            failedTasks: async () => Promise.reject(),
          }),
      })
    );

    // Enter the workflow id in the text box and submit
    const wizard = screen.getByRole('dialog');
    const wfIdTextBox = within(wizard).getByLabelText('Workflow ID:');
    await user.type(wfIdTextBox, 'some-random-uuid');
    const continueButton = within(wizard).getByText('Continue');
    await user.click(continueButton);

    // Select the call from the dropdown
    const callDropdown = within(wizard).getByLabelText('Call name:');
    const select = new SelectHelper(callDropdown, user);
    await select.selectOption('fetch_sra_to_bam.Fetch_SRA_to_BAM');
    const continueAgainButton = within(wizard).getByText('Continue');

    // Act
    await user.click(continueAgainButton);

    // Assert
    // Ensure the diff is rendered
    screen.getByText('Result: View cache diff');
  });
});
