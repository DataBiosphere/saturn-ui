import { useCallback } from 'react';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { reportError } from 'src/libs/error';
import { clearNotification, notify } from 'src/libs/notifications';
import { useCancellation, useStore } from 'src/libs/react-utils';
import { AsyncImportJob, asyncImportJobStore } from 'src/libs/state';
import { isAzureWorkspace, WorkspaceWrapper } from 'src/workspaces/utils';

export type UseImportJobsResult = {
  runningJobs: string[];
  refresh: () => Promise<void>;
};

const isJobInWorkspace = (job: AsyncImportJob, workspace: WorkspaceWrapper): boolean => {
  return (
    job.targetWorkspace.namespace === workspace.workspace.namespace &&
    job.targetWorkspace.name === workspace.workspace.name
  );
};

export const useImportJobs = (workspace: WorkspaceWrapper): UseImportJobsResult => {
  const allRunningJobs = useStore(asyncImportJobStore);

  const signal = useCancellation();
  const refresh = useCallback(async () => {
    const {
      workspace: { namespace, name },
    } = workspace;
    try {
      // Imports into Azure workspaces do not show up in this call to orch
      // Azure workspaces must rely solely on the asyncImportJobStore to know what imports are currently running,
      // Therefore they do not need a callback function here
      if (!isAzureWorkspace(workspace)) {
        const runningJobsInWorkspace: { jobId: string }[] = await Workspaces(signal)
          .workspace(namespace, name)
          .listImportJobs(true);

        // In cases where jobs failed before this query completes, users won't be notified of failure
        // But they are momentarily in the job store, so check for them and notify here
        const jobsToNotify = allRunningJobs.filter(
          (job) => !runningJobsInWorkspace.some(({ jobId }) => job.jobId === jobId)
        );

        jobsToNotify.forEach((job) => {
          Workspaces(signal)
            .workspace(namespace, name)
            .getImportJobStatus(job.jobId)
            .then((fetchedJob) => {
              if (fetchedJob.status === 'Error') {
                notify('error', 'Error importing data.', { message: fetchedJob.message });
                clearNotification(job.jobId);
              }
            });
        });

        asyncImportJobStore.update((previousState) => {
          return [
            ...previousState.filter((job) => !isJobInWorkspace(job, workspace)),
            ...runningJobsInWorkspace.map(({ jobId }) => ({ jobId, targetWorkspace: { namespace, name } })),
          ];
        });
      }
    } catch (error) {
      reportError('Error loading running import jobs in this workspace', error);
    }
  }, [workspace, signal]); // eslint-disable-line react-hooks/exhaustive-deps

  const runningJobsInWorkspace = allRunningJobs.filter((job) => isJobInWorkspace(job, workspace));
  return {
    runningJobs: runningJobsInWorkspace.map((job) => job.jobId),
    refresh,
  };
};

export const notifyDataImportProgress = (jobId: string, message?: string): void => {
  notify('info', 'Data import in progress.', {
    id: jobId,
    message,
  });
};
