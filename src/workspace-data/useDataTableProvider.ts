import { LoadedState } from '@terra-ui-packages/core-utils';
import _ from 'lodash';
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import { authOpts } from 'src/auth/auth-session';
import { fetchWDS } from 'src/libs/ajax/ajax-common';
import {
  RecordTypeSchema,
  resolveWdsApp,
  WdsDataTableProvider,
} from 'src/libs/ajax/data-table-providers/WdsDataTableProvider';
import { Apps } from 'src/libs/ajax/leonardo/Apps';
import { appStatuses, ListAppItem } from 'src/libs/ajax/leonardo/models/app-models';
import { WorkspaceData } from 'src/libs/ajax/WorkspaceDataService';
import { Capabilities } from 'src/libs/ajax/WorkspaceDataService';
import { getConfig } from 'src/libs/config';
import { reportError } from 'src/libs/error';
import { useCancellation } from 'src/libs/react-utils';

/**
 * Get a workspace data table provider.
 *
 * @param workspaceId - Workspace id
 * @returns WdsDataTableProvider - Workspace data table provider
 * @returns LoadedState<ListAppItem, string> - WDS app state
 * @returns LoadedState<RecordTypeSchema[], string> - WDS types state
 * @returns Dispatch<SetStateAction<LoadedState<RecordTypeSchema[], string>>> - WDS types setter
 *  @returns () => Promise<void> - Function to load WDS data
 */
export const useDataTableProvider = (
  workspaceId: string
): [
  WdsDataTableProvider,
  LoadedState<ListAppItem | null, string>,
  LoadedState<RecordTypeSchema[], string>,
  Dispatch<SetStateAction<LoadedState<RecordTypeSchema[], string>>>,
  () => Promise<void>
] => {
  // A ListAppItem containing all the data for a WDS app
  const [wdsApp, setWdsApp] = useState<LoadedState<ListAppItem | null, string>>({ status: 'None' });
  // The schema of the data types in the data table
  const [wdsTypes, setWdsTypes] = useState<LoadedState<RecordTypeSchema[], string>>({ status: 'None' });
  // Defines what capabilities the data tables app currently has
  const [wdsCapabilities, setWdsCapabilities] = useState<LoadedState<Capabilities, string>>({ status: 'None' });
  // Identifies if the workspace is using CWDS instead of an in-workspace WDS app
  const [useCwds, setUseCwds] = useState<LoadedState<boolean>>({ status: 'None' });
  // The URL to contact WDS - either the app or the central cWDS
  const [wdsUrl, setWdsUrl] = useState<LoadedState<string>>({ status: 'None' });
  const cwdsURL = getConfig().cwdsUrlRoot;

  const signal = useCancellation();
  const wdsDataTableProvider = useMemo(() => {
    const proxyUrl = wdsUrl.status === 'Ready' ? wdsUrl.state : '';
    return new WdsDataTableProvider(
      workspaceId,
      proxyUrl,
      wdsCapabilities.status === 'Ready' ? wdsCapabilities.state : {}
    );
  }, [workspaceId, wdsCapabilities, wdsUrl]);

  const loadWdsApp = useCallback(() => {
    return Apps()
      .listAppsV2(workspaceId)
      .then((apps) => {
        const foundApp = resolveWdsApp(apps);
        switch (foundApp?.status) {
          case appStatuses.provisioning.status:
          case appStatuses.updating.status:
            setWdsApp({ status: 'Loading', state: foundApp });
            break;
          case appStatuses.running.status:
            setWdsApp({ status: 'Ready', state: foundApp });
            setWdsUrl({ status: 'Ready', state: foundApp.proxyUrls?.wds });
            break;
          case appStatuses.error.status:
            setWdsApp({ status: 'Error', state: foundApp, error: 'Error in WDS app' });
            break;
          default:
            if (foundApp?.status) {
              // eslint-disable-next-line no-console
              console.log(`Unhandled state [${foundApp?.status} while polling WDS`);
            }
        }
      })
      .catch((error) => {
        setWdsApp({ status: 'Error', state: null, error: 'Error resolving WDS app' });
        reportError('Error resolving WDS app', error);
      });
  }, [setWdsApp, workspaceId]);

  const loadWdsTypes = useCallback(() => {
    if (wdsUrl.status === 'Ready') {
      return WorkspaceData(signal)
        .getSchema(wdsUrl.state, workspaceId)
        .then((typesResult) => {
          setWdsTypes({ status: 'Ready', state: typesResult });
        })
        .catch((error) => {
          setWdsTypes({ status: 'Error', state: null, error: 'Error loading WDS schema' });
          reportError('Error loading WDS schema', error);
        });
    }
  }, [signal, setWdsTypes, wdsUrl, workspaceId]);

  const loadWdsCapabilities = useCallback(async () => {
    if (wdsUrl.status === 'Ready') {
      try {
        const capabilitiesResult = await WorkspaceData(signal).getCapabilities(wdsUrl.state);
        setWdsCapabilities({ status: 'Ready', state: capabilitiesResult });
      } catch (error) {
        setWdsCapabilities({ status: 'Error', state: null, error: 'Error loading WDS capabilities' });
        reportError('Error loading WDS capabilities', error);
      }
    }
  }, [signal, setWdsCapabilities, wdsUrl]);

  const loadWdsData = useCallback(async () => {
    if (useCwds.status === 'Ready') {
      if (!useCwds.state && !['Ready', 'Error'].includes(wdsApp.status)) {
        await loadWdsApp();
      } else if (useCwds.state) {
        loadWdsTypes();
      }
    }
  }, [wdsApp, loadWdsApp, useCwds, loadWdsTypes]);

  useEffect(() => {
    if (useCwds.status === 'Ready' && !useCwds.state && wdsApp.status === 'None') {
      loadWdsApp();
    }
    if (wdsUrl.status === 'Ready') {
      loadWdsTypes();
      loadWdsCapabilities();
    }
  }, [wdsUrl, loadWdsTypes, loadWdsCapabilities, useCwds, wdsApp, loadWdsApp]);

  useEffect(() => {
    const checkCWDS = async (): Promise<void> => {
      try {
        const response = await fetchWDS(cwdsURL)(`collections/v1/${workspaceId}`, _.merge(authOpts(), { signal }));
        const data = await response.json();
        if (response.status === 200 && Object.keys(data).length !== 0) {
          setWdsUrl({ status: 'Ready', state: cwdsURL });
          setUseCwds({ status: 'Ready', state: true });
          setWdsApp({ status: 'Ready', state: null });
        } else {
          setWdsUrl({ status: 'Loading', state: null });
          setUseCwds({ status: 'Ready', state: false });
        }
      } catch (error) {
        console.error(error);
        setWdsUrl({ status: 'Loading', state: null });
        setUseCwds({ status: 'Ready', state: false });
      }
    };

    if (useCwds.status !== 'Ready') {
      checkCWDS();
    }
  }, [signal, workspaceId, useCwds, wdsTypes, cwdsURL]);

  return [wdsDataTableProvider, wdsApp, wdsTypes, setWdsTypes, loadWdsData];
};
