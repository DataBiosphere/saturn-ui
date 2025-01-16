import { CromwellApp } from 'src/libs/ajax/workflows-app/CromwellApp';

export interface WorkflowMetadata {
  actualWorkflowLanguage?: string;
  actualWorkflowLanguageVersion?: string;
  calls?: any[];
  end?: string;
  id?: string;
  inputs?: {}[];
  labels?: {};
  outputs?: {}[];
  start?: string;
  status?: string;
  submission?: string;
  submittedFiles?: {
    workflow: string;
    root?: string;
    options?: string;
    inputs: string;
    workflowUrl?: string;
    labels?: string;
  };
  workflowCallback?: {};
  workflowLog?: string;
  workflowName?: string;
  workflowProcessingEvents?: {}[];
  workflowRoot?: string;
  metadataArchiveStatus?: string;
}

// Used to make a web request to cromwell to get certain pieces of metadata for a specific workflow
export type MetadataOptions = {
  cromwellProxyUrl: string;
  excludeKeys: string[];
  includeKeys: string[];
  signal: AbortSignal;
  workflowId: string;
  expandSubWorkflows: boolean;
};

export const fetchMetadata = async (options: MetadataOptions): Promise<WorkflowMetadata> =>
  CromwellApp(options.signal).workflows(options.workflowId).metadata(options.cromwellProxyUrl, {
    includeKey: options.includeKeys,
    excludeKey: options.excludeKeys,
    expandSubWorkflows: options.expandSubWorkflows,
  });

export interface FetchMetadataOptions {
  cromwellProxyUrl: string;
  signal: AbortSignal;
  workflowId: string;
}

// Big web request that fetches the data necessary for the call table
export const fetchWorkflowAndCallsMetadata = async (fetchOptions: FetchMetadataOptions): Promise<WorkflowMetadata> => {
  const options: MetadataOptions = {
    cromwellProxyUrl: fetchOptions.cromwellProxyUrl,
    excludeKeys: [],
    includeKeys: [
      'backendStatus',
      'executionStatus',
      'shardIndex',
      'outputs',
      'inputs',
      'jobId',
      'start',
      'end',
      'stderr',
      'stdout',
      'tes_stdout',
      'tes_stderr',
      'attempt',
      'subWorkflowId', // needed for task type column
      'status',
      'submittedFiles',
      'callCaching',
      'workflowLog',
      'failures',
      'workflowName',
    ],
    signal: fetchOptions.signal,
    workflowId: fetchOptions.workflowId,
    expandSubWorkflows: false,
  };
  return fetchMetadata(options);
};

// Web request to get the entire workflow metadata graph, with only the keys needed for cost calculations.
export const fetchCostMetadata = async (fetchOptions: FetchMetadataOptions): Promise<WorkflowMetadata> => {
  const options: MetadataOptions = {
    cromwellProxyUrl: fetchOptions.cromwellProxyUrl,
    excludeKeys: [],
    includeKeys: ['calls', 'subWorkflowId', 'vmStartTime', 'vmEndTime', 'vmCostPerHour'],
    signal: fetchOptions.signal,
    workflowId: fetchOptions.workflowId,
    expandSubWorkflows: true,
  };
  return fetchMetadata(options);
};

// Returns the cost in USD of a given task.
// Tasks are the leaf nodes of the metadata graph, and are the only things that actually cost money. The cost of a (sub)workflow is the sum of the costs of its tasks.
export const calculateTaskCost = (vmStartTime: string, vmCostPerHour: string, vmEndTime?: string): number => {
  const endTime = vmEndTime ? Date.parse(vmEndTime) : Date.now(); // Tasks with no end time are still running, so use now as the end time
  const vmCostDouble = parseFloat(vmCostPerHour);
  const startTime = Date.parse(vmStartTime);
  const elapsedTime = endTime - startTime;
  return parseFloat(((elapsedTime / 3600000) * vmCostDouble).toFixed(2)); // 1 hour = 3600000 ms
};

// Returns the cost in USD of a single call attempt.
// A 'call' is either a task or a subworkflow. Subworkflows contain their own 'calls' array, which can be recursively searched.
export const calculateCostOfCallAttempt = (taskOrSubworkflow: any): number => {
  let totalCost = 0;
  if (taskOrSubworkflow.vmStartTime && taskOrSubworkflow.vmCostPerHour) {
    totalCost += calculateTaskCost(
      taskOrSubworkflow.vmStartTime,
      taskOrSubworkflow.vmCostPerHour,
      taskOrSubworkflow.vmEndTime
    );
  } else if (taskOrSubworkflow.subWorkflowMetadata) {
    totalCost += calculateCostOfCallsArray(taskOrSubworkflow.subWorkflowMetadata.calls);
  } else {
    // This is an error for new workspaces, but old tests and code won't have cost data, so we don't throw or complain here
  }
  return totalCost;
};

// Helper function to sum up the costs of everything in a 'calls' array, which is owned by a (sub)workflow.
// N.B. Don't confuse the 'calls' array with the array of attmepts for a single call.
export const calculateCostOfCallsArray = (callsArray: any): number => {
  if (!callsArray) {
    return 0;
  }
  let totalCost = 0;
  // Each workflow has a calls array, which is a list of all its child tasks and subworkflows ("calls").
  // Each call itself is an array of attempts, where each attempt is an actual task or subworkflow.
  for (const callAttemptsArray of Object.values(callsArray) as any[]) {
    totalCost += sumCostsOfCallAttempts(callAttemptsArray);
  }
  return totalCost;
};

// Helper function to sum up the costs of all the attempts for a single call.
// N.B. Don't confuse the attempts array of a single call with the 'calls' array of a (sub)workflow.
export const sumCostsOfCallAttempts = (callAttempts: any[]): number => {
  let totalCost = 0;
  for (const taskOrSubworkflowAttempt of callAttempts) {
    totalCost += calculateCostOfCallAttempt(taskOrSubworkflowAttempt);
  }
  return totalCost;
};

// Recursively searches the metadata for a call with the given name.
// Returns the array of attempts for that call if found, otherwise returns undefined.
export const findCallAttemptsByCallNameInCostGraph = (callName: string, costMetadata: any) => {
  // For every call in the workflow
  for (const callKey of Object.keys(costMetadata.calls)) {
    // If the call is the one we're looking for, return it
    if (callKey === callName) {
      return costMetadata.calls[callKey];
    }
    // If the call is a subworkflow, search its calls
    const callAttemptArray = costMetadata.calls[callKey];
    if (callAttemptArray && Array.isArray(callAttemptArray) && callAttemptArray.length > 0) {
      const lastAttempt = callAttemptArray[callAttemptArray.length - 1];
      if (lastAttempt.subWorkflowMetadata) {
        const foundCall = findCallAttemptsByCallNameInCostGraph(callName, lastAttempt.subWorkflowMetadata);
        if (foundCall) {
          return foundCall;
        }
      }
    }
  }
  // Failed to find the call in the cost graph
  return undefined;
};
