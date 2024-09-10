import { LoadedState } from '@terra-ui-packages/core-utils';
import { Dispatch, SetStateAction, useCallback, useMemo, useState } from 'react';
import { Ajax } from 'src/libs/ajax';
import {
  RecordTypeSchema,
  resolveWdsApp,
  WdsDataTableProvider,
} from 'src/libs/ajax/data-table-providers/WdsDataTableProvider';
import { appStatuses, ListAppItem } from 'src/libs/ajax/leonardo/models/app-models';
import { Capabilities } from 'src/libs/ajax/WorkspaceDataService';
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
  LoadedState<ListAppItem, string>,
  LoadedState<RecordTypeSchema[], string>,
  Dispatch<SetStateAction<LoadedState<RecordTypeSchema[], string>>>,
  () => Promise<void>
] => {
  const [wdsApp, setWdsApp] = useState<LoadedState<ListAppItem, string>>({ status: 'None' });
  const [wdsTypes, setWdsTypes] = useState<LoadedState<RecordTypeSchema[], string>>({ status: 'None' });
  const [wdsCapabilities, setWdsCapabilities] = useState<LoadedState<Capabilities, string>>({ status: 'None' });

  const signal = useCancellation();
  const wdsDataTableProvider = useMemo(() => {
    const proxyUrl = wdsApp.status === 'Ready' ? wdsApp.state.proxyUrls?.wds : '';
    return new WdsDataTableProvider(
      workspaceId,
      proxyUrl,
      wdsCapabilities.status === 'Ready' ? wdsCapabilities.state : {}
    );
  }, [workspaceId, wdsApp, wdsCapabilities]);

  // returns the found app only if it is in a ready state,
  // otherwise returns undefined
  const loadWdsApp = useCallback(
    (workspaceId) => {
      return Ajax()
        .Apps.listAppsV2(workspaceId)
        .then((apps) => {
          const foundApp = resolveWdsApp(apps);
          switch (foundApp?.status) {
            case appStatuses.provisioning.status:
            case appStatuses.updating.status:
              setWdsApp({ status: 'Loading', state: foundApp });
              break;
            case appStatuses.running.status:
              setWdsApp({ status: 'Ready', state: foundApp });
              return foundApp;
            case appStatuses.error.status:
              setWdsApp({ status: 'Error', state: foundApp, error: 'Error in WDS app' }); // todo get real error?
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
    },
    [setWdsApp]
  );

  const loadWdsTypes = useCallback(
    (url, workspaceId) => {
      setWdsTypes({ status: 'None' });
      return Ajax(signal)
        .WorkspaceData.getSchema(url, workspaceId)
        .then((typesResult) => {
          setWdsTypes({ status: 'Ready', state: typesResult });
        })
        .catch((error) => {
          setWdsTypes({ status: 'Error', state: null, error: 'Error loading WDS schema' });
          reportError('Error loading WDS schema', error);
        });
    },
    [signal, setWdsTypes]
  );

  const loadWdsCapabilities = useCallback(
    async (url) => {
      try {
        const capabilitiesResult = await Ajax(signal).WorkspaceData.getCapabilities(url);
        setWdsCapabilities({ status: 'Ready', state: capabilitiesResult });
      } catch (error) {
        setWdsCapabilities({ status: 'Error', state: null, error: 'Error loading WDS capabilities' });
        reportError('Error loading WDS capabilities', error);
      }
    },
    [signal, setWdsCapabilities]
  );

  const loadWdsData = useCallback(async () => {
    // Try to load the proxy URL
    if (!wdsApp || !['Ready', 'Error'].includes(wdsApp.status)) {
      const foundApp = await loadWdsApp(workspaceId);
      // TODO: figure out how not to make this redundant fetch, per
      // https://github.com/DataBiosphere/terra-ui/pull/4202#discussion_r1319145491
      if (foundApp) {
        loadWdsTypes(foundApp.proxyUrls?.wds, workspaceId);
        loadWdsCapabilities(foundApp.proxyUrls?.wds);
      }
    }
    // If we have the proxy URL try to load the WDS types
    else if (wdsApp?.status === 'Ready') {
      const proxyUrl = wdsApp.state.proxyUrls?.wds;
      await loadWdsTypes(proxyUrl, workspaceId);
      await loadWdsCapabilities(proxyUrl);
    }
  }, [wdsApp, loadWdsApp, loadWdsTypes, loadWdsCapabilities, workspaceId]);

  return [wdsDataTableProvider, wdsApp, wdsTypes, setWdsTypes, loadWdsData];
};
