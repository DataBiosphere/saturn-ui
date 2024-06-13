import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import _ from 'lodash/fp';
import { h } from 'react-hyperscript-helpers';
import { useFilesInDirectory } from 'src/components/file-browser/file-browser-hooks';
import FileBrowser from 'src/components/file-browser/FileBrowser';
import FilesTable from 'src/components/file-browser/FilesTable';
import { Ajax } from 'src/libs/ajax';
import { getLink } from 'src/libs/nav';
import { asMockedFn, renderWithAppContexts as render, SelectHelper } from 'src/testing/test-utils';
import { metadata as runDetailsMetadata } from 'src/workflows-app/fixtures/test-workflow';
import { BaseSubmissionDetails } from 'src/workflows-app/SubmissionDetails';
import {
  methodData,
  mockQueuedRunsData,
  mockRunsData,
  queuedRunSetData,
  runSetData,
  runSetDataWithLiteral,
  simpleRunsData,
} from 'src/workflows-app/utils/mock-data';
import {
  mockAzureApps,
  mockAzureWorkspace,
  mockCollaborativeAzureApps,
  runSetOutputDef,
  runSetResponse,
} from 'src/workflows-app/utils/mock-responses';

const submissionId = 'e8347247-4738-4ad1-a591-56c119f93f58';
const cbasUrlRoot = 'https://lz-abc/terra-app-abc/cbas';
const cromwellUrlRoot = 'https://lz-abc/terra-app-abc/cromwell';
const wdsUrlRoot = 'https://lz-abc/wds-abc-c07807929cd1/';

// Necessary to mock the AJAX module.
jest.mock('src/libs/ajax');
jest.mock('src/libs/notifications');
jest.mock('src/libs/ajax/leonardo/Apps');
jest.mock('src/libs/nav', () => ({
  getCurrentUrl: jest.fn().mockReturnValue(new URL('https://app.terra.bio')),
  getLink: jest.fn(),
  goToPath: jest.fn(),
}));
jest.mock('src/libs/state', () => ({
  ...jest.requireActual('src/libs/state'),
  getTerraUser: jest.fn(),
}));
// Mocking feature preview setup
jest.mock('src/libs/feature-previews', () => ({
  ...jest.requireActual('src/libs/feature-previews'),
  isFeaturePreviewEnabled: jest.fn(),
}));

jest.mock('src/libs/config', () => ({
  ...jest.requireActual('src/libs/config'),
  getConfig: jest.fn().mockReturnValue({ cbasUrlRoot, cromwellUrlRoot, wdsUrlRoot }),
}));

jest.mock('src/components/file-browser/file-browser-hooks', () => ({
  ...jest.requireActual('src/components/file-browser/file-browser-hooks'),
  useFilesInDirectory: jest.fn(),
}));

jest.mock('src/components/file-browser/FilesTable', () => {
  const { div } = jest.requireActual('react-hyperscript-helpers');
  return {
    ...jest.requireActual('src/components/file-browser/FilesTable'),
    __esModule: true,
    default: jest.fn().mockReturnValue(div()),
  };
});

// The test does not allot space for the table on the input/output modal, so this mock
// creates space for the table thereby allowing it to render and preventing test failures.
jest.mock('react-virtualized', () => {
  const actual = jest.requireActual('react-virtualized');

  const { AutoSizer } = actual;
  class MockAutoSizer extends AutoSizer {
    state = {
      height: 1000,
      width: 1000,
    };

    setState = () => {};
  }

  return {
    ...actual,
    AutoSizer: MockAutoSizer,
  };
});

const captureEvent = jest.fn();

describe('Submission Details page', () => {
  beforeEach(() => {
    // SubmissionDetails component uses AutoSizer to determine the right size for table to be displayed. As a result we need to
    // mock out the height and width so that when AutoSizer asks for the width and height of 'browser' it can use the mocked
    // values and render the component properly. Without this the tests will be break.
    // (see https://github.com/bvaughn/react-virtualized/issues/493 and https://stackoverflow.com/a/62214834)
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 1000 });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });
  });

  it('should correctly display previous 2 runs', async () => {
    const getRuns = jest.fn(() => Promise.resolve(mockRunsData));
    const getRunsSets = jest.fn(() => Promise.resolve(runSetData));
    const getMethods = jest.fn(() => Promise.resolve(methodData));
    const mockLeoResponse = jest.fn(() => Promise.resolve(mockAzureApps));
    Ajax.mockImplementation(() => {
      return {
        Cbas: {
          runs: {
            get: getRuns,
          },
          runSets: {
            get: getRunsSets,
          },
          methods: {
            getById: getMethods,
          },
        },
        Apps: {
          listAppsV2: mockLeoResponse,
        },
        Metrics: {
          captureEvent,
        },
        CromwellApp: {
          workflows: () => {
            return {
              metadata: jest.fn(() => {
                return Promise.resolve(runDetailsMetadata);
              }),
            };
          },
        },
        AzureStorage: {
          blobByUri: jest.fn(() => ({
            getMetadataAndTextContent: () =>
              Promise.resolve({
                uri: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
                sasToken: '1234-this-is-a-mock-sas-token-5678',
                fileName: 'inputFile.txt',
                name: 'inputFile.txt',
                lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
                size: '324',
                contentType: 'text/plain',
                textContent: 'this is the text of a mock file',
                azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
              }),
          })),
          details: jest.fn().mockResolvedValue({ sas: { token: '1234-this-is-a-mock-sas-token-5678' } }),
        },
      };
    });

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionDetails, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          submissionId,
        })
      );
    });

    expect(getRuns).toHaveBeenCalled();
    expect(getRunsSets).toHaveBeenCalled();
    expect(getMethods).toHaveBeenCalled();

    const table = await screen.findByRole('table');

    // Assert
    expect(table).toHaveAttribute('aria-colcount', '5');
    expect(table).toHaveAttribute('aria-rowcount', '3');

    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(3);

    const headers = within(rows[0]).getAllByRole('columnheader');
    expect(headers.length).toBe(5);
    within(headers[0]).getByText('Sample ID');
    within(headers[1]).getByText('Status');
    within(headers[2]).getByText('Duration');
    within(headers[3]).getByText('Workflow ID');

    // check data rows are rendered as expected (default sorting is by duration in desc order)
    const cellsFromDataRow1 = within(rows[1]).getAllByRole('cell');
    expect(cellsFromDataRow1.length).toBe(5);
    within(cellsFromDataRow1[0]).getByText('FOO2');
    within(cellsFromDataRow1[1]).getByText('Failed');
    within(cellsFromDataRow1[2]).getByText('52 minutes 10 seconds');
    within(cellsFromDataRow1[3]).getByText('b29e84b1-ad1b-4462-a9a0-7ec849bf30a8');

    const cellsFromDataRow2 = within(rows[2]).getAllByRole('cell');
    expect(cellsFromDataRow2.length).toBe(5);
    within(cellsFromDataRow2[0]).getByText('FOO1');
    within(cellsFromDataRow2[1]).getByText('Succeeded');
    within(cellsFromDataRow2[2]).getByText('37 seconds');
    within(cellsFromDataRow2[3]).getByText('d16721eb-8745-4aa2-b71e-9ade2d6575aa');
  });

  it('should correctly display Queued runs', async () => {
    const getRuns = jest.fn(() => Promise.resolve(mockQueuedRunsData));
    const getRunsSets = jest.fn(() => Promise.resolve(queuedRunSetData));
    const getMethods = jest.fn(() => Promise.resolve(methodData));
    const mockLeoResponse = jest.fn(() => Promise.resolve(mockCollaborativeAzureApps));
    Ajax.mockImplementation(() => {
      return {
        Cbas: {
          runs: {
            get: getRuns,
          },
          runSets: {
            get: getRunsSets,
          },
          methods: {
            getById: getMethods,
          },
        },
        Apps: {
          listAppsV2: mockLeoResponse,
        },
        Metrics: {
          captureEvent,
        },
        AzureStorage: {
          blobByUri: jest.fn(() => ({
            getMetadataAndTextContent: () =>
              Promise.resolve({
                uri: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
                sasToken: '1234-this-is-a-mock-sas-token-5678',
                fileName: 'inputFile.txt',
                name: 'inputFile.txt',
                lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
                size: '324',
                contentType: 'text/plain',
                textContent: 'this is the text of a mock file',
                azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
              }),
          })),
          details: jest.fn().mockResolvedValue({ sas: { token: '1234-this-is-a-mock-sas-token-5678' } }),
        },
      };
    });

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionDetails, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          submissionId,
        })
      );
    });

    expect(getRuns).toHaveBeenCalled();
    expect(getRunsSets).toHaveBeenCalled();
    expect(getMethods).toHaveBeenCalled();

    const table = await screen.findByRole('table');

    // Assert
    expect(table).toHaveAttribute('aria-colcount', '5');
    expect(table).toHaveAttribute('aria-rowcount', '3');

    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(3);

    const headers = within(rows[0]).getAllByRole('columnheader');
    expect(headers.length).toBe(5);
    within(headers[0]).getByText('Sample ID');
    within(headers[1]).getByText('Status');
    within(headers[2]).getByText('Duration');
    within(headers[3]).getByText('Workflow ID');
    within(headers[4]).getByText('Workflow Data');

    const cellsFromDataRow1 = within(rows[1]).getAllByRole('cell');
    expect(cellsFromDataRow1.length).toBe(5);
    within(cellsFromDataRow1[0]).getByText('FOO1');
    within(cellsFromDataRow1[1]).getByText('Queued');
    within(cellsFromDataRow1[2]).getByText('');
    within(cellsFromDataRow1[3]).getByText('Waiting for workflow to be submitted');
    within(cellsFromDataRow1[4]).getByText('Waiting for workflow to be submitted');

    const cellsFromDataRow2 = within(rows[2]).getAllByRole('cell');
    expect(cellsFromDataRow2.length).toBe(5);
    within(cellsFromDataRow2[0]).getByText('FOO2');
    within(cellsFromDataRow2[1]).getByText('Queued');
    within(cellsFromDataRow2[2]).getByText('');
    within(cellsFromDataRow2[3]).getByText('Waiting for workflow to be submitted');
    within(cellsFromDataRow2[4]).getByText('Waiting for workflow to be submitted');
  });

  it('should display standard message when there are no saved workflows', async () => {
    const getRuns = jest.fn(() => Promise.resolve([]));
    const getRunsSets = jest.fn(() => Promise.resolve(runSetData));
    const getMethods = jest.fn(() => Promise.resolve(methodData));
    const mockLeoResponse = jest.fn(() => Promise.resolve(mockAzureApps));
    Ajax.mockImplementation(() => {
      return {
        Cbas: {
          runs: {
            get: getRuns,
          },
          runSets: {
            get: getRunsSets,
          },
          methods: {
            getById: getMethods,
          },
        },
        Apps: {
          listAppsV2: mockLeoResponse,
        },
        Metrics: {
          captureEvent,
        },
        CromwellApp: {
          workflows: () => {
            return {
              metadata: jest.fn(() => {
                return Promise.resolve(runDetailsMetadata);
              }),
            };
          },
        },
        AzureStorage: {
          blobByUri: jest.fn(() => ({
            getMetadataAndTextContent: () =>
              Promise.resolve({
                uri: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
                sasToken: '1234-this-is-a-mock-sas-token-5678',
                fileName: 'inputFile.txt',
                name: 'inputFile.txt',
                lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
                size: '324',
                contentType: 'text/plain',
                textContent: 'this is the text of a mock file',
                azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
              }),
          })),
          details: jest.fn().mockResolvedValue({ sas: { token: '1234-this-is-a-mock-sas-token-5678' } }),
        },
      };
    });

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionDetails, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          submissionId,
        })
      );
    });

    expect(getRuns).toHaveBeenCalled();
    expect(getRunsSets).toHaveBeenCalled();
    expect(getMethods).toHaveBeenCalled();

    const table = await screen.findByRole('table');

    // Assert
    expect(table).toHaveAttribute('aria-colcount', '5');
    expect(table).toHaveAttribute('aria-rowcount', '1');

    // check that noContentMessage shows up as expected
    screen.getByText('Nothing here yet! Your previously run workflows will be displayed here.');
  });

  it('should sort by duration column properly', async () => {
    const user = userEvent.setup();
    const getRuns = jest.fn(() => Promise.resolve(mockRunsData));
    const mockLeoResponse = jest.fn(() => Promise.resolve(mockAzureApps));
    Ajax.mockImplementation(() => {
      return {
        Cbas: {
          runs: {
            get: getRuns,
          },
        },
        Apps: {
          listAppsV2: mockLeoResponse,
        },
        Metrics: {
          captureEvent,
        },
        CromwellApp: {
          workflows: () => {
            return {
              metadata: jest.fn(() => {
                return Promise.resolve(runDetailsMetadata);
              }),
            };
          },
        },
        AzureStorage: {
          blobByUri: jest.fn(() => ({
            getMetadataAndTextContent: () =>
              Promise.resolve({
                uri: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
                sasToken: '1234-this-is-a-mock-sas-token-5678',
                fileName: 'inputFile.txt',
                name: 'inputFile.txt',
                lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
                size: '324',
                contentType: 'text/plain',
                textContent: 'this is the text of a mock file',
                azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
              }),
          })),
          details: jest.fn().mockResolvedValue({ sas: { token: '1234-this-is-a-mock-sas-token-5678' } }),
        },
      };
    });

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionDetails, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          submissionId,
        })
      );
    });

    // Assert
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(3);

    const headers = within(rows[0]).getAllByRole('columnheader');
    expect(headers.length).toBe(5);

    // Act - click on sort button on Duration column to sort by ascending order
    await user.click(await within(headers[2]).findByRole('button'));

    // Assert
    // check that rows are now sorted by duration in ascending order
    const cellsFromDataRow1 = within(rows[1]).getAllByRole('cell');
    expect(cellsFromDataRow1.length).toBe(5);
    within(cellsFromDataRow1[0]).getByText('FOO1');
    within(cellsFromDataRow1[1]).getByText('Succeeded');
    within(cellsFromDataRow1[2]).getByText('37 seconds');
    within(cellsFromDataRow1[3]).getByText('d16721eb-8745-4aa2-b71e-9ade2d6575aa');

    const cellsFromDataRow2 = within(rows[2]).getAllByRole('cell');
    expect(cellsFromDataRow2.length).toBe(5);
    within(cellsFromDataRow2[0]).getByText('FOO2');
    within(cellsFromDataRow2[1]).getByText('Failed');
    within(cellsFromDataRow2[2]).getByText('52 minutes 10 seconds');
    within(cellsFromDataRow2[3]).getByText('b29e84b1-ad1b-4462-a9a0-7ec849bf30a8');

    // Act - click on sort button on Duration column to sort by descending order
    await user.click(await within(headers[2]).findByRole('button'));

    // Assert
    // check that rows are now sorted by duration in descending order
    const cellsFromUpdatedDataRow1 = within(rows[1]).getAllByRole('cell');
    expect(cellsFromUpdatedDataRow1.length).toBe(5);
    within(cellsFromUpdatedDataRow1[0]).getByText('FOO2');
    within(cellsFromUpdatedDataRow1[1]).getByText('Failed');
    within(cellsFromUpdatedDataRow1[2]).getByText('52 minutes 10 seconds');
    within(cellsFromUpdatedDataRow1[3]).getByText('b29e84b1-ad1b-4462-a9a0-7ec849bf30a8');

    const cellsFromUpdatedDataRow2 = within(rows[2]).getAllByRole('cell');
    expect(cellsFromUpdatedDataRow2.length).toBe(5);
    within(cellsFromUpdatedDataRow2[0]).getByText('FOO1');
    within(cellsFromUpdatedDataRow2[1]).getByText('Succeeded');
    within(cellsFromUpdatedDataRow2[2]).getByText('37 seconds');
    within(cellsFromUpdatedDataRow2[3]).getByText('d16721eb-8745-4aa2-b71e-9ade2d6575aa');
  });

  it('display run set details', async () => {
    const getRuns = jest.fn(() => Promise.resolve(mockRunsData));
    const getRunsSets = jest.fn(() => Promise.resolve(runSetData));
    const getMethods = jest.fn(() => Promise.resolve(methodData));
    Ajax.mockImplementation(() => {
      return {
        Cbas: {
          runs: {
            get: getRuns,
          },
          runSets: {
            get: getRunsSets,
          },
          methods: {
            getById: getMethods,
          },
        },
        Metrics: {
          captureEvent,
        },
        CromwellApp: {
          workflows: () => {
            return {
              metadata: jest.fn(() => {
                return Promise.resolve(runDetailsMetadata);
              }),
            };
          },
        },
        AzureStorage: {
          blobByUri: jest.fn(() => ({
            getMetadataAndTextContent: () =>
              Promise.resolve({
                uri: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
                sasToken: '1234-this-is-a-mock-sas-token-5678',
                fileName: 'inputFile.txt',
                name: 'inputFile.txt',
                lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
                size: '324',
                contentType: 'text/plain',
                textContent: 'this is the text of a mock file',
                azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
              }),
          })),
          details: jest.fn().mockResolvedValue({ sas: { token: '1234-this-is-a-mock-sas-token-5678' } }),
        },
      };
    });
    // Act
    await act(async () => {
      render(
        h(BaseSubmissionDetails, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          submissionId,
        })
      );
    });
    expect(getRunsSets).toHaveBeenCalled();
    expect(getMethods).toHaveBeenCalled();

    screen.getByText(/Submission e8347247-4738-4ad1-a591-56c119f93f58/);
    screen.getByText(/Submission name: hello world/);
    screen.getByText(/Workflow name: Hello world/);
    screen.getByText(/Submission date: Dec 8, 2022/);
    screen.getByText(/Duration: 17 hours 2 minutes/);
  });

  it('should correctly set default option', async () => {
    // Act
    await act(async () => {
      render(
        h(BaseSubmissionDetails, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          submissionId,
        })
      );
    });

    screen.getByText(/None selected/);
  });

  it('should correctly select and change results', async () => {
    const user = userEvent.setup();
    const getRuns = jest.fn(() => Promise.resolve(mockRunsData));
    const getRunsSets = jest.fn(() => Promise.resolve(runSetData));
    const getMethods = jest.fn(() => Promise.resolve(methodData));
    Ajax.mockImplementation(() => {
      return {
        Cbas: {
          runs: {
            get: getRuns,
          },
          runSets: {
            get: getRunsSets,
          },
          methods: {
            getById: getMethods,
          },
        },
        Metrics: {
          captureEvent,
        },
        CromwellApp: {
          workflows: () => {
            return {
              metadata: jest.fn(() => {
                return Promise.resolve(runDetailsMetadata);
              }),
            };
          },
        },
        AzureStorage: {
          blobByUri: jest.fn(() => ({
            getMetadataAndTextContent: () =>
              Promise.resolve({
                uri: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
                sasToken: '1234-this-is-a-mock-sas-token-5678',
                fileName: 'inputFile.txt',
                name: 'inputFile.txt',
                lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
                size: '324',
                contentType: 'text/plain',
                textContent: 'this is the text of a mock file',
                azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
              }),
          })),
          details: jest.fn().mockResolvedValue({ sas: { token: '1234-this-is-a-mock-sas-token-5678' } }),
        },
      };
    });

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionDetails, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          submissionId,
        })
      );
    });

    expect(getRuns).toHaveBeenCalled();
    expect(getRunsSets).toHaveBeenCalled();
    expect(getMethods).toHaveBeenCalled();

    const dropdown = await screen.findByLabelText('Filter selection');
    const filterDropdown = new SelectHelper(dropdown, user);
    await filterDropdown.selectOption('Failed');

    const table = await screen.findByRole('table');

    // Assert
    expect(table).toHaveAttribute('aria-colcount', '5');
    expect(table).toHaveAttribute('aria-rowcount', '2');

    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(2);

    const headers = within(rows[0]).getAllByRole('columnheader');
    expect(headers.length).toBe(5);
    within(headers[0]).getByText('Sample ID');
    within(headers[1]).getByText('Status');
    within(headers[2]).getByText('Duration');
    within(headers[3]).getByText('Workflow ID');

    // check data rows are rendered as expected
    const cellsFromDataRow1 = within(rows[1]).getAllByRole('cell');
    expect(cellsFromDataRow1.length).toBe(5);
    within(cellsFromDataRow1[0]).getByText('FOO2');
    within(cellsFromDataRow1[1]).getByText('Failed');
    within(cellsFromDataRow1[2]).getByText('52 minutes 10 seconds');
    within(cellsFromDataRow1[3]).getByText('b29e84b1-ad1b-4462-a9a0-7ec849bf30a8');
  });

  it('should correctly display a very recently started run', async () => {
    const recentRunsData = {
      runs: [
        {
          run_id: 'b7234aae-6f43-405e-bb3a-71f924e09825',
          engine_id: 'b29e84b1-ad1b-4462-a9a0-7ec849bf30a8',
          run_set_id: '0cd15673-7342-4cfa-883d-819660184a16',
          record_id: 'FOO2',
          workflow_url: 'https://xyz.wdl',
          state: 'UNKNOWN',
          workflow_params:
            "[{'input_name':'wf_hello.hello.addressee','input_type':{'type':'primitive','primitive_type':'String'},'source':{'type':'record_lookup','record_attribute':'foo_name'}}]",
          workflow_outputs: '[]',
          submission_date: new Date().toISOString(),
          last_modified_timestamp: new Date().toISOString(),
          error_messages: [],
        },
      ],
    };

    const getRecentRunsMethod = jest.fn(() => Promise.resolve(recentRunsData));
    Ajax.mockImplementation(() => {
      return {
        Cbas: {
          runs: {
            get: getRecentRunsMethod,
          },
        },
        Metrics: {
          captureEvent,
        },
        CromwellApp: {
          workflows: () => {
            return {
              metadata: jest.fn(() => {
                return Promise.resolve(runDetailsMetadata);
              }),
            };
          },
        },
        AzureStorage: {
          blobByUri: jest.fn(() => ({
            getMetadataAndTextContent: () =>
              Promise.resolve({
                uri: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
                sasToken: '1234-this-is-a-mock-sas-token-5678',
                fileName: 'inputFile.txt',
                name: 'inputFile.txt',
                lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
                size: '324',
                contentType: 'text/plain',
                textContent: 'this is the text of a mock file',
                azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
              }),
          })),
          details: jest.fn().mockResolvedValue({ sas: { token: '1234-this-is-a-mock-sas-token-5678' } }),
        },
      };
    });

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionDetails, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          submissionId,
        })
      );
    });

    const table = await screen.findByRole('table');

    // Assert
    expect(table).toHaveAttribute('aria-colcount', '5');
    expect(table).toHaveAttribute('aria-rowcount', '2');

    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(2);

    const headers = within(rows[0]).getAllByRole('columnheader');
    expect(headers.length).toBe(5);
    within(headers[0]).getByText('Sample ID');
    within(headers[1]).getByText('Status');
    within(headers[2]).getByText('Duration');

    // check data rows are rendered as expected
    const cellsFromDataRow1 = within(rows[1]).getAllByRole('cell');
    expect(cellsFromDataRow1.length).toBe(5);
    within(cellsFromDataRow1[0]).getByText('FOO2');
    within(cellsFromDataRow1[1]).getByText('Initializing'); // Note: not UNKNOWN!
    // << Don't validate duration here since it depends on the test rendering time and is not particularly relevant >>
    within(cellsFromDataRow1[3]).getByText('b29e84b1-ad1b-4462-a9a0-7ec849bf30a8');
  });

  it('should correctly display a run with undefined engine id', async () => {
    const recentRunsData = {
      runs: [
        {
          run_id: 'b7234aae-6f43-405e-bb3a-71f924e09825',
          // engine_id is undefined
          run_set_id: '0cd15673-7342-4cfa-883d-819660184a16',
          record_id: 'FOO2',
          workflow_url: 'https://xyz.wdl',
          state: 'UNKNOWN',
          workflow_params:
            "[{'input_name':'wf_hello.hello.addressee','input_type':{'type':'primitive','primitive_type':'String'},'source':{'type':'record_lookup','record_attribute':'foo_name'}}]",
          workflow_outputs: '[]',
          submission_date: new Date().toISOString(),
          last_modified_timestamp: new Date().toISOString(),
          error_messages: [],
        },
      ],
    };

    const getRecentRunsMethod = jest.fn(() => Promise.resolve(recentRunsData));
    Ajax.mockImplementation(() => {
      return {
        Cbas: {
          runs: {
            get: getRecentRunsMethod,
          },
        },
        Metrics: {
          captureEvent,
        },
        AzureStorage: {
          blobByUri: jest.fn(() => ({
            getMetadataAndTextContent: () =>
              Promise.resolve({
                uri: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
                sasToken: '1234-this-is-a-mock-sas-token-5678',
                fileName: 'inputFile.txt',
                name: 'inputFile.txt',
                lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
                size: '324',
                contentType: 'text/plain',
                textContent: 'this is the text of a mock file',
                azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
              }),
          })),
          details: jest.fn().mockResolvedValue({ sas: { token: '1234-this-is-a-mock-sas-token-5678' } }),
        },
      };
    });

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionDetails, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          submissionId,
        })
      );
    });

    const table = await screen.findByRole('table');

    // Assert
    expect(table).toHaveAttribute('aria-colcount', '5');
    expect(table).toHaveAttribute('aria-rowcount', '2');

    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(2);

    const headers = within(rows[0]).getAllByRole('columnheader');
    expect(headers.length).toBe(5);
    within(headers[0]).getByText('Sample ID');
    within(headers[1]).getByText('Status');
    within(headers[2]).getByText('Duration');

    // check data rows are rendered as expected
    const cellsFromDataRow1 = within(rows[1]).getAllByRole('cell');
    expect(cellsFromDataRow1.length).toBe(5);
    within(cellsFromDataRow1[0]).getByText('FOO2');
    within(cellsFromDataRow1[1]).getByText('Initializing'); // Note: not UNKNOWN!
    // << Don't validate duration here since it depends on the test rendering time and is not particularly relevant >>
    within(cellsFromDataRow1[3]).getByText('');
  });

  it('should indicate fully updated polls', async () => {
    const getRecentRunsMethod = jest.fn(() => Promise.resolve(simpleRunsData));
    Ajax.mockImplementation(() => {
      return {
        Cbas: {
          runs: {
            get: getRecentRunsMethod,
          },
        },
        Metrics: {
          captureEvent,
        },
        CromwellApp: {
          workflows: () => {
            return {
              metadata: jest.fn(() => {
                return Promise.resolve(runDetailsMetadata);
              }),
            };
          },
        },
        AzureStorage: {
          blobByUri: jest.fn(() => ({
            getMetadataAndTextContent: () =>
              Promise.resolve({
                uri: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
                sasToken: '1234-this-is-a-mock-sas-token-5678',
                fileName: 'inputFile.txt',
                name: 'inputFile.txt',
                lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
                size: '324',
                contentType: 'text/plain',
                textContent: 'this is the text of a mock file',
                azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
              }),
          })),
          details: jest.fn().mockResolvedValue({ sas: { token: '1234-this-is-a-mock-sas-token-5678' } }),
        },
      };
    });

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionDetails, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          submissionId,
        })
      );
    });

    expect(screen.getByText('Workflow statuses are all up to date.')).toBeInTheDocument();
  });

  it('should indicate incompletely updated polls', async () => {
    const getRecentRunsMethod = jest.fn(() => Promise.resolve(_.merge(simpleRunsData, { fully_updated: false })));
    Ajax.mockImplementation(() => {
      return {
        Cbas: {
          runs: {
            get: getRecentRunsMethod,
          },
        },
        Metrics: {
          captureEvent,
        },
        CromwellApp: {
          workflows: () => {
            return {
              metadata: jest.fn(() => {
                return Promise.resolve(runDetailsMetadata);
              }),
            };
          },
        },
        AzureStorage: {
          blobByUri: jest.fn(() => ({
            getMetadataAndTextContent: () =>
              Promise.resolve({
                uri: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
                sasToken: '1234-this-is-a-mock-sas-token-5678',
                fileName: 'inputFile.txt',
                name: 'inputFile.txt',
                lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
                size: '324',
                contentType: 'text/plain',
                textContent: 'this is the text of a mock file',
                azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
              }),
          })),
          details: jest.fn().mockResolvedValue({ sas: { token: '1234-this-is-a-mock-sas-token-5678' } }),
        },
      };
    });

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionDetails, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          submissionId,
        })
      );
    });

    expect(screen.getByText('Some workflow statuses are not up to date. Refreshing the page may update more statuses.')).toBeInTheDocument();
  });

  it('should display inputs on the Inputs tab', async () => {
    // Arrange
    const user = userEvent.setup();
    const getRuns = jest.fn(() => Promise.resolve(mockRunsData));
    const getRunsSets = jest.fn(() => Promise.resolve(runSetData));
    const getMethods = jest.fn(() => Promise.resolve(methodData));
    const mockLeoResponse = jest.fn(() => Promise.resolve(mockAzureApps));
    Ajax.mockImplementation(() => {
      return {
        Cbas: {
          runs: {
            get: getRuns,
          },
          runSets: {
            get: getRunsSets,
          },
          methods: {
            getById: getMethods,
          },
        },
        Apps: {
          listAppsV2: mockLeoResponse,
        },
        Metrics: {
          captureEvent,
        },
        CromwellApp: {
          workflows: () => {
            return {
              metadata: jest.fn(() => {
                return Promise.resolve(runDetailsMetadata);
              }),
            };
          },
        },
        AzureStorage: {
          blobByUri: jest.fn(() => ({
            getMetadataAndTextContent: () =>
              Promise.resolve({
                uri: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
                sasToken: '1234-this-is-a-mock-sas-token-5678',
                fileName: 'inputFile.txt',
                name: 'inputFile.txt',
                lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
                size: '324',
                contentType: 'text/plain',
                textContent: 'this is the text of a mock file',
                azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
              }),
          })),
          details: jest.fn().mockResolvedValue({ sas: { token: '1234-this-is-a-mock-sas-token-5678' } }),
        },
      };
    });

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionDetails, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          submissionId,
        })
      );
    });

    const workflowsTabButton = screen.getByRole('tab', { name: 'Workflows' });
    expect(workflowsTabButton !== undefined);

    const inputsTabButton = screen.getByRole('tab', { name: 'Inputs' });
    expect(inputsTabButton !== undefined);

    // ** ACT **
    // user clicks on inputs tab button
    await user.click(inputsTabButton);

    // Assert
    const inputTable = screen.getByRole('table');
    const rows = within(inputTable).getAllByRole('row');
    expect(rows.length).toBe(JSON.parse(runSetData.run_sets[0].input_definition).length + 1); // one row for each input definition variable, plus headers

    const headers = within(rows[0]).getAllByRole('columnheader');
    expect(headers.length).toBe(5);

    const row1cells = within(rows[1]).getAllByRole('cell');
    expect(row1cells.length).toBe(5);
    expect(row1cells[0]).toHaveTextContent('hello');
    expect(row1cells[1]).toHaveTextContent('addressee');
    expect(row1cells[2]).toHaveTextContent('String');
    expect(row1cells[3]).toHaveTextContent('record_lookup');
    expect(row1cells[4]).toHaveTextContent('foo_name');
  });

  it('Inputs tab handles literal values', async () => {
    // Arrange
    const user = userEvent.setup();
    const getRuns = jest.fn(() => Promise.resolve(mockRunsData));
    const getRunsSets = jest.fn(() => Promise.resolve(runSetDataWithLiteral));
    const getMethods = jest.fn(() => Promise.resolve(methodData));
    const mockLeoResponse = jest.fn(() => Promise.resolve(mockAzureApps));
    Ajax.mockImplementation(() => {
      return {
        Cbas: {
          runs: {
            get: getRuns,
          },
          runSets: {
            get: getRunsSets,
          },
          methods: {
            getById: getMethods,
          },
        },
        Apps: {
          listAppsV2: mockLeoResponse,
        },
        Metrics: {
          captureEvent,
        },
        CromwellApp: {
          workflows: () => {
            return {
              metadata: jest.fn(() => {
                return Promise.resolve(runDetailsMetadata);
              }),
            };
          },
        },
        AzureStorage: {
          blobByUri: jest.fn(() => ({
            getMetadataAndTextContent: () =>
              Promise.resolve({
                uri: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
                sasToken: '1234-this-is-a-mock-sas-token-5678',
                fileName: 'inputFile.txt',
                name: 'inputFile.txt',
                lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
                size: '324',
                contentType: 'text/plain',
                textContent: 'this is the text of a mock file',
                azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
              }),
          })),
          details: jest.fn().mockResolvedValue({ sas: { token: '1234-this-is-a-mock-sas-token-5678' } }),
        },
      };
    });

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionDetails, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          submissionId,
        })
      );
    });

    const workflowsTabButton = screen.getByRole('tab', { name: 'Workflows' });
    expect(workflowsTabButton !== undefined);

    const inputsTabButton = screen.getByRole('tab', { name: 'Inputs' });
    expect(inputsTabButton !== undefined);

    // ** ACT **
    // user clicks on inputs tab button
    await user.click(inputsTabButton);

    // Assert
    const inputTable = screen.getByRole('table');
    const rows = within(inputTable).getAllByRole('row');

    const row1cells = within(rows[1]).getAllByRole('cell');
    expect(row1cells[3]).toHaveTextContent('literal');
    expect(row1cells[4]).toHaveTextContent('foo bar');
  });

  it('should display outputs on the Outputs tab', async () => {
    // Add output definition to temporary runset data variable
    const tempRunSetData = runSetData;
    tempRunSetData.run_sets[0].output_definition = runSetResponse.run_sets[0].output_definition;

    // Arrange
    const user = userEvent.setup();
    const getRuns = jest.fn(() => Promise.resolve(mockRunsData));
    const getRunsSets = jest.fn(() => Promise.resolve(tempRunSetData));
    const getMethods = jest.fn(() => Promise.resolve(methodData));
    const mockLeoResponse = jest.fn(() => Promise.resolve(mockAzureApps));
    Ajax.mockImplementation(() => {
      return {
        Cbas: {
          runs: {
            get: getRuns,
          },
          runSets: {
            get: getRunsSets,
          },
          methods: {
            getById: getMethods,
          },
        },
        Apps: {
          listAppsV2: mockLeoResponse,
        },
        Metrics: {
          captureEvent,
        },
        CromwellApp: {
          workflows: () => {
            return {
              metadata: jest.fn(() => {
                return Promise.resolve(runDetailsMetadata);
              }),
            };
          },
        },
        AzureStorage: {
          blobByUri: jest.fn(() => ({
            getMetadataAndTextContent: () =>
              Promise.resolve({
                uri: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
                sasToken: '1234-this-is-a-mock-sas-token-5678',
                fileName: 'inputFile.txt',
                name: 'inputFile.txt',
                lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
                size: '324',
                contentType: 'text/plain',
                textContent: 'this is the text of a mock file',
                azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
              }),
          })),
          details: jest.fn().mockResolvedValue({ sas: { token: '1234-this-is-a-mock-sas-token-5678' } }),
        },
      };
    });

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionDetails, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          submissionId,
        })
      );
    });

    const outputsTabButton = screen.getByRole('tab', { name: 'Outputs' });
    expect(outputsTabButton !== undefined);

    // ** ACT **
    // user clicks on outputs tab button
    await user.click(outputsTabButton);

    // Assert
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(runSetOutputDef.length + 1); // one row for each output definition variable, plus headers

    const headers = within(rows[0]).getAllByRole('columnheader');
    expect(headers.length).toBe(4);

    const row1cells = within(rows[1]).getAllByRole('cell');
    expect(row1cells.length).toBe(4);
    expect(row1cells[0]).toHaveTextContent('target_workflow_1');
    expect(row1cells[1]).toHaveTextContent('file_output');
    expect(row1cells[2]).toHaveTextContent('File');
    expect(row1cells[3]).toHaveTextContent('target_workflow_1_file_output'); // from previous run/template

    const row2cells = within(rows[2]).getAllByRole('cell');
    expect(row2cells.length).toBe(4);
    expect(row2cells[0]).toHaveTextContent('target_workflow_1');
    expect(row2cells[1]).toHaveTextContent('unused_output');
    expect(row2cells[2]).toHaveTextContent('String');
    expect(row2cells[3]).toHaveTextContent('');
  });

  it('should open the log viewer modal when Execution Logs button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const getRuns = jest.fn(() => Promise.resolve(mockRunsData));
    const getRunsSets = jest.fn(() => Promise.resolve(runSetData));
    const getMethods = jest.fn(() => Promise.resolve(methodData));
    const mockLeoResponse = jest.fn(() => Promise.resolve(mockAzureApps));
    Ajax.mockImplementation(() => {
      return {
        Cbas: {
          runs: {
            get: getRuns,
          },
          runSets: {
            get: getRunsSets,
          },
          methods: {
            getById: getMethods,
          },
        },
        Apps: {
          listAppsV2: mockLeoResponse,
        },
        CromwellApp: {
          workflows: () => {
            return {
              metadata: jest.fn(() => {
                return Promise.resolve(runDetailsMetadata);
              }),
            };
          },
        },
        AzureStorage: {
          blobByUri: jest.fn(() => ({
            getMetadataAndTextContent: () =>
              Promise.resolve({
                uri: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
                sasToken: '1234-this-is-a-mock-sas-token-5678',
                fileName: 'inputFile.txt',
                name: 'inputFile.txt',
                lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
                size: '324',
                contentType: 'text/plain',
                textContent: 'this is the text of a mock file',
                azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
              }),
          })),
          details: jest.fn().mockResolvedValue({ sas: { token: '1234-this-is-a-mock-sas-token-5678' } }),
        },
        Metrics: {
          captureEvent,
        },
      };
    });

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionDetails, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          submissionId,
          workflowId: '00001111-2222-3333-aaaa-bbbbccccdddd',
          uri: 'https://coaexternalstorage.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
        })
      );
    });

    const executionLogButtons = screen.getAllByRole('button', { name: 'Log' });

    for (const executionLogButton of executionLogButtons) {
      // Act
      await user.click(executionLogButton);

      // Assert
      screen.getByRole('dialog', { name: 'Workflow Execution Log' });
      screen.getByText('File:');
      screen.getByText('workflow.log');
      await screen.findByRole('link', { name: 'Download log' });
      screen.getByRole('button', { name: 'Workflow Execution Log' });
      screen.getByText('this is the text of a mock file');
    }
  });

  it('should open the task data modal when Inputs button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const getRuns = jest.fn(() => Promise.resolve(mockRunsData));
    const getRunsSets = jest.fn(() => Promise.resolve(runSetData));
    const getMethods = jest.fn(() => Promise.resolve(methodData));
    const mockLeoResponse = jest.fn(() => Promise.resolve(mockAzureApps));
    Ajax.mockImplementation(() => {
      return {
        Cbas: {
          runs: {
            get: getRuns,
          },
          runSets: {
            get: getRunsSets,
          },
          methods: {
            getById: getMethods,
          },
        },
        Apps: {
          listAppsV2: mockLeoResponse,
        },
        CromwellApp: {
          workflows: () => {
            return {
              metadata: jest.fn(() => {
                return Promise.resolve(runDetailsMetadata);
              }),
            };
          },
        },
        AzureStorage: {
          blobByUri: jest.fn(() => ({
            getMetadataAndTextContent: () =>
              Promise.resolve({
                uri: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
                sasToken: '1234-this-is-a-mock-sas-token-5678',
                fileName: 'inputFile.txt',
                name: 'inputFile.txt',
                lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
                size: '324',
                contentType: 'text/plain',
                textContent: 'this is the text of a mock file',
                azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
              }),
          })),
          details: jest.fn().mockResolvedValue({ sas: { token: '1234-this-is-a-mock-sas-token-5678' } }),
        },
        Metrics: {
          captureEvent,
        },
      };
    });

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionDetails, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          submissionId,
          workflowId: '00001111-2222-3333-aaaa-bbbbccccdddd',
        })
      );
    });

    const inputsButtons = screen.getAllByRole('button', { name: 'Inputs' });

    for (const inputsButton of inputsButtons) {
      // Act
      await user.click(inputsButton);

      screen.getByRole('dialog', { name: 'Inputs' });
      const table = screen.getByRole('table', { name: 'inputs outputs table' });
      const rows = within(table).getAllByRole('row');
      expect(rows.length).toBe(4); // one row for each input definition variable, plus headers

      const headers = within(rows[0]).getAllByRole('columnheader');
      expect(headers).toHaveLength(2);

      const getRowContent = (rowIndex) =>
        within(rows[rowIndex])
          .getAllByRole('cell')
          .map((el) => el.textContent);

      expect(getRowContent(1)).toEqual(['Fetch_SRA_to_BAM.SRA_ID', 'SRR13379731']);
      expect(getRowContent(2)).toEqual(['Fetch_SRA_to_BAM.machine_mem_gb', '']);
      expect(getRowContent(3)).toEqual(['Fetch_SRA_to_BAM.docker', 'quay.io/broadinstitute/ncbi-tools:2.10.7.10']);
    }
  });

  it('should open the task data modal when Outputs button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const getRuns = jest.fn(() => Promise.resolve(mockRunsData));
    const getRunsSets = jest.fn(() => Promise.resolve(runSetData));
    const getMethods = jest.fn(() => Promise.resolve(methodData));
    const mockLeoResponse = jest.fn(() => Promise.resolve(mockAzureApps));
    Ajax.mockImplementation(() => {
      return {
        Cbas: {
          runs: {
            get: getRuns,
          },
          runSets: {
            get: getRunsSets,
          },
          methods: {
            getById: getMethods,
          },
        },
        Apps: {
          listAppsV2: mockLeoResponse,
        },
        CromwellApp: {
          workflows: () => {
            return {
              metadata: jest.fn(() => {
                return Promise.resolve(runDetailsMetadata);
              }),
            };
          },
        },
        AzureStorage: {
          blobByUri: jest.fn(() => ({
            getMetadataAndTextContent: () =>
              Promise.resolve({
                uri: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
                sasToken: '1234-this-is-a-mock-sas-token-5678',
                fileName: 'inputFile.txt',
                name: 'inputFile.txt',
                lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
                size: '324',
                contentType: 'text/plain',
                textContent: 'this is the text of a mock file',
                azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
              }),
          })),
          details: jest.fn().mockResolvedValue({ sas: { token: '1234-this-is-a-mock-sas-token-5678' } }),
        },
        Metrics: {
          captureEvent,
        },
      };
    });

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionDetails, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          submissionId,
          workflowId: '00001111-2222-3333-aaaa-bbbbccccdddd',
        })
      );
    });

    const outputsButtons = screen.getAllByRole('button', { name: 'Outputs' });

    for (const outputsButton of outputsButtons) {
      // Act
      await user.click(outputsButton);

      screen.getByRole('dialog', { name: 'Outputs' });
      const table = screen.getByRole('table', { name: 'inputs outputs table' });
      const rows = within(table).getAllByRole('row');
      expect(rows).toHaveLength(13); // one row for each output definition variable, plus headers

      const getRowContent = (rowIndex) =>
        within(rows[rowIndex])
          .getAllByRole('cell')
          .map((el) => el.textContent);

      const headers = within(rows[0]).getAllByRole('columnheader');
      expect(headers).toHaveLength(2);

      expect(getRowContent(1)).toEqual(['sra_metadata', 'SRR13379731.json']);
      expect(getRowContent(2)).toEqual(['reads_ubam', 'SRR13379731.bam']);
      expect(getRowContent(3)).toEqual(['biosample_accession', 'kljkl2kj']);
      expect(getRowContent(4)).toEqual(['sample_geo_loc', 'USA']);
      expect(getRowContent(5)).toEqual(['sample_collection_date', '2020-11-30']);
      expect(getRowContent(6)).toEqual(['sequencing_center', 'SEQ_CENTER']);
      expect(getRowContent(7)).toEqual(['sequencing_platform', 'PLATFORM COMPANY']);
      expect(getRowContent(8)).toEqual(['library_id', 'ST-VALUE-2012556126']);
      expect(getRowContent(9)).toEqual(['run_date', '2022-06-22']);
      expect(getRowContent(10)).toEqual(['sample_collected_by', 'Random lab']);
      expect(getRowContent(11)).toEqual(['sample_strain', 'SARS-CoV-2/USA/44165/2020']);
      expect(getRowContent(12)).toEqual(['sequencing_platform_model', 'NextSeq 550']);
    }
  });

  it('should generate the correect link when clicking on a workflow ID', async () => {
    const user = userEvent.setup();
    const getRuns = jest.fn(() => Promise.resolve(mockRunsData));
    const getRunsSets = jest.fn(() => Promise.resolve(runSetData));
    const getMethods = jest.fn(() => Promise.resolve(methodData));
    const mockLeoResponse = jest.fn(() => Promise.resolve(mockAzureApps));
    Ajax.mockImplementation(() => {
      return {
        Cbas: {
          runs: {
            get: getRuns,
          },
          runSets: {
            get: getRunsSets,
          },
          methods: {
            getById: getMethods,
          },
        },
        Apps: {
          listAppsV2: mockLeoResponse,
        },
        CromwellApp: {
          workflows: () => {
            return {
              metadata: jest.fn(() => {
                return Promise.resolve(runDetailsMetadata);
              }),
            };
          },
        },
        Metrics: {
          captureEvent,
        },
        AzureStorage: {
          blobByUri: jest.fn(() => ({
            getMetadataAndTextContent: () =>
              Promise.resolve({
                uri: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
                sasToken: '1234-this-is-a-mock-sas-token-5678',
                fileName: 'inputFile.txt',
                name: 'inputFile.txt',
                lastModified: 'Mon, 22 May 2023 17:12:58 GMT',
                size: '324',
                contentType: 'text/plain',
                textContent: 'this is the text of a mock file terra-app-123456',
                azureSasStorageUrl: 'https://someBlobFilePath.blob.core.windows.net/cromwell/user-inputs/inputFile.txt',
              }),
          })),
          details: jest.fn().mockResolvedValue({ sas: { token: '1234-this-is-a-mock-sas-token-5678' } }),
        },
      };
    });

    // Act
    await act(async () => {
      render(
        h(BaseSubmissionDetails, {
          name: 'test-azure-ws-name',
          namespace: 'test-azure-ws-namespace',
          workspace: mockAzureWorkspace,
          submissionId,
        })
      );
    });

    expect(getRuns).toHaveBeenCalled();
    expect(getRunsSets).toHaveBeenCalled();
    expect(getMethods).toHaveBeenCalled();

    const idButton = await screen.getByText('d16721eb-8745-4aa2-b71e-9ade2d6575aa');
    await user.click(idButton);
    await waitFor(() =>
      expect(getLink).toBeCalledWith(
        'workspace-files',
        { name: 'test-azure-ws-name', namespace: 'test-azure-ws-namespace' },
        { path: 'workspace-services/cbas/terra-app-123456/fetch_sra_to_bam/d16721eb-8745-4aa2-b71e-9ade2d6575aa/' }
      )
    );
  });

  it('navigates to a sub-directory of the root', () => {
    // Arrange
    const mockFileBrowserProvider = {};
    const files = [
      {
        path: 'workspace-services/cbas/terra-app-/fetch_sra_to_bam/d16721eb-8745-4aa2-b71e-9ade2d6575aa/',
        url: 'gs://test-bucket/file.txt',
        contentType: 'text/plain',
        size: 1024,
        createdAt: 1667408400000,
        updatedAt: 1667408400000,
      },
    ];

    const useFilesInDirectoryResult = {
      state: { files, status: 'Ready' },
      hasNextPage: false,
      loadNextPage: () => Promise.resolve(),
      loadAllRemainingItems: () => Promise.resolve(),
      reload: () => Promise.resolve(),
    };

    asMockedFn(useFilesInDirectory).mockReturnValue(useFilesInDirectoryResult);

    // Act
    render(
      h(FileBrowser, {
        initialPath: 'workspace-services/cbas/terra-app-/fetch_sra_to_bam/d16721eb-8745-4aa2-b71e-9ade2d6575aa/',
        provider: mockFileBrowserProvider,
        rootLabel: 'Workspace cloud storage',
        title: 'Files',
        workspace: {
          accessLevel: 'WRITER',
          workspace: { isLocked: false },
        },
      })
    );

    // Assert
    expect(FilesTable).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [
          {
            path: 'workspace-services/cbas/terra-app-/fetch_sra_to_bam/d16721eb-8745-4aa2-b71e-9ade2d6575aa/',
            url: 'gs://test-bucket/file.txt',
            contentType: 'text/plain',
            size: 1024,
            createdAt: 1667408400000,
            updatedAt: 1667408400000,
          },
        ],
      }),
      expect.anything()
    );
    screen.getByText('Loaded 1 files in d16721eb-8745-4aa2-b71e-9ade2d6575aa');
    screen.getByText('d16721eb-8745-4aa2-b71e-9ade2d6575aa');
  });
});
