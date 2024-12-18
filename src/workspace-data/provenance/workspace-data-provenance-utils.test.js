import _ from 'lodash/fp';
import { Metrics } from 'src/libs/ajax/Metrics';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';

import { fileProvenanceTypes, getFileProtocol, getFileProvenance } from './workspace-data-provenance-utils';

jest.mock('src/libs/ajax/Metrics');
jest.mock('src/libs/ajax/workspaces/Workspaces');

describe('getFileProvenance', () => {
  const workspace = { workspace: { namespace: 'test', name: 'test', bucketName: 'workspace-bucket' } };

  beforeEach(() => {
    Workspaces.mockReturnValue({
      workspace: () => ({
        submission: () => ({
          workflow: () => ({
            outputs: jest.fn().mockReturnValue(
              Promise.resolve({
                tasks: {
                  workflow: {
                    outputs: {
                      'workflow.output1': 'Hello world',
                      'workflow.output2':
                        'gs://workspace-bucket/submissions/8d79470f-7042-4e79-bf67-971adf4e5a4a/workflow/78f61618-30e6-4405-baf3-2ef2e576a3a3/task1/file.txt',
                    },
                  },
                  'workflow.task1': {
                    logs: [
                      {
                        backendLogs: {
                          log: 'gs://workspace-bucket/submissions/8d79470f-7042-4e79-bf67-971adf4e5a4a/workflow/78f61618-30e6-4405-baf3-2ef2e576a3a3/task1/task1.log',
                        },
                        stderr:
                          'gs://workspace-bucket/submissions/8d79470f-7042-4e79-bf67-971adf4e5a4a/workflow/78f61618-30e6-4405-baf3-2ef2e576a3a3/task1/stderr',
                        stdout:
                          'gs://workspace-bucket/submissions/8d79470f-7042-4e79-bf67-971adf4e5a4a/workflow/78f61618-30e6-4405-baf3-2ef2e576a3a3/task1/stdout',
                      },
                    ],
                  },
                  'workflow.task2': {
                    logs: [
                      {
                        backendLogs: {
                          log: 'gs://workspace-bucket/submissions/8d79470f-7042-4e79-bf67-971adf4e5a4a/workflow/78f61618-30e6-4405-baf3-2ef2e576a3a3/task2/task2.log',
                        },
                        stderr:
                          'gs://workspace-bucket/submissions/8d79470f-7042-4e79-bf67-971adf4e5a4a/workflow/78f61618-30e6-4405-baf3-2ef2e576a3a3/task2/stderr',
                        stdout:
                          'gs://workspace-bucket/submissions/8d79470f-7042-4e79-bf67-971adf4e5a4a/workflow/78f61618-30e6-4405-baf3-2ef2e576a3a3/task2/stdout',
                      },
                    ],
                  },
                },
                workflowId: '78f61618-30e6-4405-baf3-2ef2e576a3a3',
              })
            ),
          }),
        }),
      }),
    });
    Metrics.mockReturnValue({ captureEvent: jest.fn() });
  });

  it('returns external for files outside the workspace bucket', async () => {
    expect(await getFileProvenance(workspace, 'gs://other-bucket/file.txt')).toEqual({ type: fileProvenanceTypes.externalFile });
  });

  it('returns unknown for files outside a submission directory', async () => {
    expect(await getFileProvenance(workspace, 'gs://workspace-bucket/folder/file.txt')).toEqual({ type: fileProvenanceTypes.unknown });
  });

  it('returns maybeSubmission for files in a submission directory that are not workflow outputs', async () => {
    expect(await getFileProvenance(workspace, 'gs://workspace-bucket/submissions/8d79470f-7042-4e79-bf67-971adf4e5a4a/file.txt')).toEqual({
      type: fileProvenanceTypes.maybeSubmission,
      submissionId: '8d79470f-7042-4e79-bf67-971adf4e5a4a',
    });

    expect(
      await getFileProvenance(
        workspace,
        'gs://workspace-bucket/submissions/8d79470f-7042-4e79-bf67-971adf4e5a4a/workflow/e8e3447c-10c7-4265-b812-e6a5183e99a5/task/file.txt'
      )
    ).toEqual({ type: fileProvenanceTypes.maybeSubmission, submissionId: '8d79470f-7042-4e79-bf67-971adf4e5a4a' });
  });

  it('returns workflowLog for workflow logs', async () => {
    expect(
      await getFileProvenance(
        workspace,
        'gs://workspace-bucket/submissions/8d79470f-7042-4e79-bf67-971adf4e5a4a/workflow/78f61618-30e6-4405-baf3-2ef2e576a3a3/task1/task1.log'
      )
    ).toEqual({
      type: fileProvenanceTypes.workflowLog,
      submissionId: '8d79470f-7042-4e79-bf67-971adf4e5a4a',
      workflowId: '78f61618-30e6-4405-baf3-2ef2e576a3a3',
    });

    expect(
      await getFileProvenance(
        workspace,
        'gs://workspace-bucket/submissions/8d79470f-7042-4e79-bf67-971adf4e5a4a/workflow/78f61618-30e6-4405-baf3-2ef2e576a3a3/task2/stdout'
      )
    ).toEqual({
      type: fileProvenanceTypes.workflowLog,
      submissionId: '8d79470f-7042-4e79-bf67-971adf4e5a4a',
      workflowId: '78f61618-30e6-4405-baf3-2ef2e576a3a3',
    });
  });

  it('returns workflowOutput for workflow outputs', async () => {
    expect(
      await getFileProvenance(
        workspace,
        'gs://workspace-bucket/submissions/8d79470f-7042-4e79-bf67-971adf4e5a4a/workflow/78f61618-30e6-4405-baf3-2ef2e576a3a3/task1/file.txt'
      )
    ).toEqual({
      type: fileProvenanceTypes.workflowOutput,
      submissionId: '8d79470f-7042-4e79-bf67-971adf4e5a4a',
      workflowId: '78f61618-30e6-4405-baf3-2ef2e576a3a3',
    });
  });
});

describe('getFileProtocol', () => {
  const testCases = [
    { input: 'gs://dir1/dir2/my-file.ext', expected: 'gs' },
    { input: 'drs://example.data.service.org/6cbffaae-fc48-4829-9419-1a2ef0ca98ce', expected: 'drs' },
    { input: 'dos://example.data.service.org/6cbffaae-fc48-4829-9419-1a2ef0ca98ce', expected: 'dos' },
    { input: 'https://foo.blob.core.windows.net/testContainer/file1.txt', expected: 'https' },
    { input: 'http://foo.blob.core.windows.net/testContainer/file1.txt', expected: 'http' },
    { input: 'ftp://why/would/you/use/ftp', expected: 'ftp' },
    { input: 'relative/file', expected: 'unknown' },
    { input: '', expected: 'unknown' },
  ];

  _.forEach(({ input, expected }) => {
    it(`calculates protocol ${expected} for input ${input}`, () => {
      expect(getFileProtocol(input)).toEqual(expected);
    });
  }, testCases);
});
