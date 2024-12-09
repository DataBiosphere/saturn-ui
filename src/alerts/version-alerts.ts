import { atom } from '@terra-ui-packages/core-utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FirecloudBucket } from 'src/libs/ajax/firecloud/FirecloudBucket';
import { getConfig } from 'src/libs/config';
import { useStore } from 'src/libs/react-utils';

import { Alert } from './Alert';

export const getLatestVersion = async (): Promise<string> => {
  const buildInfo = await fetch('/build-info.json').then((response) => response.json());
  return buildInfo.gitRevision;
};

export interface VersionState {
  currentVersion: string;
  latestVersion: string;
  updateRequiredBy?: number;
}

export const versionStore = atom<VersionState>({
  currentVersion: getConfig().gitRevision,
  latestVersion: getConfig().gitRevision,
  updateRequiredBy: undefined,
});

export const useVersionAlerts = (): Alert[] => {
  const { currentVersion, latestVersion } = useStore(versionStore);

  if (currentVersion === latestVersion) {
    return [];
  }

  return [
    {
      id: 'update-available',
      title: 'Update available',
      message: 'A new version of Terra is available. Refresh your browser to update.',
      severity: 'info',
    },
  ];
};

export const getBadVersions = async (): Promise<string[]> => {
  try {
    const versionsText = await FirecloudBucket().getBadVersions();
    return versionsText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => !!line)
      .filter((line) => !line.startsWith('#'));
  } catch (error: unknown) {
    if (error instanceof Response && error.status === 404) {
      return [];
    }
    throw error;
  }
};

export const useTimeUntilRequiredUpdate = (): number | undefined => {
  const { updateRequiredBy } = useStore(versionStore);

  const [timeRemaining, setTimeRemaining] = useState(
    updateRequiredBy ? Math.ceil((updateRequiredBy - Date.now()) / 1000) : undefined
  );
  const updateTimeRemaining = useCallback(() => {
    if (updateRequiredBy) {
      const timeRemaining = Math.ceil((updateRequiredBy - Date.now()) / 1000);
      if (timeRemaining <= 0) {
        window.location.reload();
      }

      setTimeRemaining(timeRemaining);
    } else {
      setTimeRemaining(undefined);
    }
  }, [updateRequiredBy]);

  const countdownInterval = useRef<number>();
  useEffect(() => {
    updateTimeRemaining();
    if (updateRequiredBy && !countdownInterval.current) {
      countdownInterval.current = window.setInterval(updateTimeRemaining, 1000);
    } else if (!updateRequiredBy && countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }
  }, [updateRequiredBy, updateTimeRemaining]);

  useEffect(() => {
    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, []);

  return timeRemaining;
};
