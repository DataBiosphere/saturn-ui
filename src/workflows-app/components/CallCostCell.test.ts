import { isTask } from './CallCostCell';

describe('CallTable functions', () => {
  it.each([
    {
      task: {
        executionStatus: 'Done',
        subWorkflowId: 'acec1c90-0871-48fe-899f-6d2b38a07196',
        callCaching: {
          hit: false,
          result: 'Cache Miss',
        },
        taskStartTime: '2024-06-17T21:19:14.6913148',
      },
      expected: undefined,
    },
    {
      task: {
        executionStatus: 'Failed',
        subWorkflowId: 'acec1c90-0871-48fe-899f-6d2b38a07196',
        callCaching: {
          hit: false,
          result: 'Cache Miss',
        },
        taskStartTime: '2024-06-17T21:19:14.6913148',
      },
      expected: true,
    },
    {
      task: {
        executionStatus: 'Done',
        subWorkflowId: 'acec1c90-0871-48fe-899f-6d2b38a07196Z',
        callCaching: {
          hit: false,
          result: 'Cache Miss',
        },
      },
      expected: true,
    },
    {
      task: {
        executionStatus: 'Running',
        subWorkflowId: 'acec1c90-0871-48fe-899f-6d2b38a07196',
        callCaching: {
          hit: false,
          result: 'Cache Miss',
        },
        taskStartTime: '2024-06-17T21:19:14.6913148Z',
      },
      expected: undefined,
    },
  ]);

  it('correctly differentiates tasks and subworkflows', async () => {
    const mockTask = { start: '2024-06-17T21:19:14.6913148', end: '2024-06-17T21:19:14.6913148', vmCostUsd: 9001 };
    const mockSubworkflow = { subWorkflowId: 'acec1c90-0871-48fe-899f-6d2b38a07196', calls: {} };
    expect(isTask(mockTask)).toEqual(true);
    expect(isTask(mockSubworkflow)).toEqual(false);
  });

  // TODO: Add tests that assert it renders properly when the tasks are in different states
});
