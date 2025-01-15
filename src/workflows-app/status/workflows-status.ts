import { useEffect, useRef, useState } from 'react';
import { getCurrentApp } from 'src/analysis/utils/app-utils';
import { Apps } from 'src/libs/ajax/leonardo/Apps';
import { GetAppItem, ListAppItem } from 'src/libs/ajax/leonardo/models/app-models';
import { Cbas } from 'src/libs/ajax/workflows-app/Cbas';
import { CromwellApp } from 'src/libs/ajax/workflows-app/CromwellApp';
import { useCallback } from 'use-memo-one';

type UseWorkflowsStatusArgs = {
  workspaceId: string;
};

export type WorkflowsStatus = {
  totalVisibleApps: string | null;

  workflowsAppName: string | null;
  cromwellRunnerAppName: string | null;
  workflowsAppStatus: string | null;
  cromwellRunnerAppStatus: string | null;

  cbasProxyUrl: string | null;
  cromwellReaderProxyUrl: string | null;
  cromwellRunnerProxyUrl: string | null;

  cbasResponsive: string | null;
  cbasCromwellConnection: string | null;
  cbasEcmConnection: string | null;
  cbasSamConnection: string | null;
  cbasLeonardoConnection: string | null;
  cromwellReaderResponsive: string | null;
  cromwellReaderDatabaseConnection: string | null;
  cromwellRunnerResponsive: string | null;
  cromwellRunnerDatabaseConnection: string | null;
};

export type UseWorkflowsStatusResult = {
  status: WorkflowsStatus;
  refreshStatus: () => Promise<void>;
};

const initialStatus: WorkflowsStatus = {
  totalVisibleApps: null,

  workflowsAppName: null,
  workflowsAppStatus: null,
  cromwellRunnerAppName: null,
  cromwellRunnerAppStatus: null,

  cbasProxyUrl: null,
  cromwellReaderProxyUrl: null,
  cromwellRunnerProxyUrl: null,

  cbasResponsive: null,
  cbasCromwellConnection: null,
  cbasEcmConnection: null,
  cbasSamConnection: null,
  cbasLeonardoConnection: null,
  cromwellReaderResponsive: null,
  cromwellReaderDatabaseConnection: null,
  cromwellRunnerResponsive: null,
  cromwellRunnerDatabaseConnection: null,
};

export const useWorkflowsStatus = ({ workspaceId }: UseWorkflowsStatusArgs) => {
  const [status, setStatus] = useState<WorkflowsStatus>(() => ({ ...initialStatus }));

  const controllerRef = useRef<AbortController>();

  async function analyzeWorkflowsApp(workflowsApp: GetAppItem | ListAppItem | undefined, signal: AbortSignal) {
    if (!workflowsApp) {
      setStatus((previousStatus) => ({
        ...previousStatus,
        workflowsAppName: 'unknown',
        workflowsAppStatus: 'unknown',

        cbasProxyUrl: 'unknown',
        cromwellReaderProxyUrl: 'unknown',

        cbasResponsive: 'unknown',
        cbasCromwellConnection: 'unknown',
        cbasEcmConnection: 'unknown',
        cbasSamConnection: 'unknown',
        cbasLeonardoConnection: 'unknown',
        cromwellReaderResponsive: 'unknown',
        cromwellReaderDatabaseConnection: 'unknown',
      }));
      return;
    }

    const cbasProxyUrl = workflowsApp.proxyUrls.cbas;
    const cromwellReaderProxyUrl = workflowsApp.proxyUrls['cromwell-reader'];
    setStatus((previousStatus) => ({
      ...previousStatus,
      workflowsAppName: workflowsApp.appName,
      workflowsAppStatus: workflowsApp.status,

      cbasProxyUrl,
      cromwellReaderProxyUrl,
    }));

    if (workflowsApp.status !== 'RUNNING') {
      setStatus((previousStatus) => ({
        ...previousStatus,
        cbasResponsive: 'unknown',
        cbasCromwellConnection: 'unknown',
        cbasEcmConnection: 'unknown',
        cbasSamConnection: 'unknown',
        cbasLeonardoConnection: 'unknown',
        cromwellReaderResponsive: 'unknown',
        cromwellReaderDatabaseConnection: 'unknown',
      }));
      return;
    }

    await Promise.allSettled([
      Cbas(signal)
        .status(cbasProxyUrl)
        .then((statusResponse) => {
          setStatus((previouStatus) => ({
            ...previouStatus,
            cbasResponsive: statusResponse.ok.toString(),
            cbasCromwellConnection: statusResponse.systems.cromwell.ok.toString(),
            cbasEcmConnection: statusResponse.systems.ecm.ok.toString(),
            cbasSamConnection: statusResponse.systems.sam.ok.toString(),
            cbasLeonardoConnection: statusResponse.systems.leonardo.ok.toString(),
          }));
        })
        .catch(() => {
          setStatus((previousStatus) => ({
            ...previousStatus,
            cbasResponsive: 'false',
            cbasCromwellConnection: 'unknown',
            cbasEcmConnection: 'unknown',
            cbasSamConnection: 'unknown',
            cbasLeonardoConnection: 'unknown',
          }));
        }),

      CromwellApp(signal)
        .engineStatus(cromwellReaderProxyUrl)
        .then((statusResponse) => {
          setStatus((previousStatus) => ({
            ...previousStatus,
            cromwellReaderResponsive: 'true',
            cromwellReaderDatabaseConnection: statusResponse['Engine Database']?.ok.toString(),
          }));
        })
        .catch(() => {
          setStatus((previousStatus) => ({
            ...previousStatus,
            cromwellReaderResponsive: 'false',
            cromwellReaderDatabaseConnection: 'unknown',
          }));
        }),
    ]);
  }

  async function analyzeCromwellRunnerApp(
    cromwellRunnerApp: GetAppItem | ListAppItem | undefined,
    signal: AbortSignal
  ) {
    if (!cromwellRunnerApp) {
      setStatus((previousStatus) => ({
        ...previousStatus,
        cromwellRunnerAppName: 'unknown',
        cromwellRunnerAppStatus: 'unknown',
        cromwellRunnerProxyUrl: 'unknown',
        cromwellRunnerResponsive: 'unknown',
        cromwellRunnerDatabaseConnection: 'unknown',
      }));
      return;
    }

    const cromwellRunnerProxyUrl = cromwellRunnerApp.proxyUrls['cromwell-runner'];
    setStatus((previousStatus) => ({
      ...previousStatus,
      cromwellRunnerAppName: cromwellRunnerApp.appName,
      cromwellRunnerAppStatus: cromwellRunnerApp.status,
      cromwellRunnerProxyUrl,
    }));

    if (cromwellRunnerApp.status !== 'RUNNING') {
      setStatus((previousStatus) => ({
        ...previousStatus,
        cromwellRunnerResponsive: 'unknown',
        cromwellRunnerDatabaseConnection: 'unknown',
      }));
      return;
    }

    await Promise.allSettled([
      CromwellApp(signal)
        .engineStatus(cromwellRunnerProxyUrl)
        .then((statusResponse) => {
          setStatus((previousStatus) => ({
            ...previousStatus,
            cromwellRunnerResponsive: 'true',
            cromwellRunnerDatabaseConnection: statusResponse['Engine Database']?.ok.toString(),
          }));
        })
        .catch(() => {
          setStatus((previousStatus) => ({
            ...previousStatus,
            cromwellRunnerResponsive: 'false',
            cromwellRunnerDatabaseConnection: 'unknown',
          }));
        }),
    ]);
  }

  const refreshStatus = useCallback(async (workspaceId: string) => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const signal = controllerRef.current.signal;

    setStatus(() => ({ ...initialStatus }));

    let listAppsResponse: ListAppItem[];
    try {
      listAppsResponse = await Apps(signal).listAppsV2(workspaceId);
    } catch (err) {
      setStatus({
        totalVisibleApps: 'unknown',

        workflowsAppName: 'unknown',
        workflowsAppStatus: 'unknown',
        cromwellRunnerAppName: 'unknown',
        cromwellRunnerAppStatus: 'unknown',

        cbasProxyUrl: 'unknown',
        cromwellReaderProxyUrl: 'unknown',
        cromwellRunnerProxyUrl: 'unknown',

        cbasResponsive: 'unknown',
        cbasCromwellConnection: 'unknown',
        cbasEcmConnection: 'unknown',
        cbasSamConnection: 'unknown',
        cbasLeonardoConnection: 'unknown',
        cromwellReaderResponsive: 'unknown',
        cromwellReaderDatabaseConnection: 'unknown',
        cromwellRunnerResponsive: 'unknown',
        cromwellRunnerDatabaseConnection: 'unknown',
      });
      return;
    }

    setStatus((previousStatus) => ({ ...previousStatus, totalVisibleApps: listAppsResponse.length.toString() }));

    await Promise.allSettled([
      analyzeWorkflowsApp(getCurrentApp('WORKFLOWS_APP', listAppsResponse), signal),
      analyzeCromwellRunnerApp(getCurrentApp('CROMWELL_RUNNER_APP', listAppsResponse), signal),
    ]);
  }, []);

  useEffect(() => {
    refreshStatus(workspaceId);
    return () => {
      controllerRef.current?.abort();
    };
  }, [refreshStatus, workspaceId]);

  return { status, refreshStatus };
};
