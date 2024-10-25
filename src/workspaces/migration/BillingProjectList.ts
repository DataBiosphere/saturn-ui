import { Spinner } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { div, h, h2, span } from 'react-hyperscript-helpers';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import colors from 'src/libs/colors';
import { reportErrorAndRethrow, withErrorIgnoring } from 'src/libs/error';
import { useCancellation, useGetter } from 'src/libs/react-utils';
import * as Utils from 'src/libs/utils';
import { BillingProjectParent } from 'src/workspaces/migration/BillingProjectParent';
import {
  BillingProjectMigrationInfo,
  mergeBillingProjectMigrationInfo,
  mergeWorkspacesWithNamespaces,
  parseServerResponse,
  WorkspaceWithNamespace,
} from 'src/workspaces/migration/migration-utils';

export const inProgressRefreshRate = 10000;

export const BillingProjectList = (): ReactNode => {
  const [loadingMigrationInformation, setLoadingMigrationInformation] = useState(true);
  const [billingProjectWorkspaces, setBillingProjectWorkspaces] = useState<BillingProjectMigrationInfo[]>([]);
  const getBillingProjectWorkspaces = useGetter(billingProjectWorkspaces);
  const [inProgressWorkspaces, setInProgressWorkspaces] = useState<{ namespace: string; name: string }[]>([]);
  const getInProgressWorkspaces = useGetter(inProgressWorkspaces);
  const signal = useCancellation();
  const fontSize = 16;
  const interval = useRef<number>();

  const updateWorkspacesSilently = withErrorIgnoring(
    async (workspacesWithNamespaces: { namespace: string; name: string }[]) => {
      if (!workspacesWithNamespaces) {
        workspacesWithNamespaces = getInProgressWorkspaces();
      } else {
        // Add to the list of in-progress workspaces for future refreshes.
        setInProgressWorkspaces(mergeWorkspacesWithNamespaces(getInProgressWorkspaces(), workspacesWithNamespaces));
      }
      if (workspacesWithNamespaces.length > 0) {
        const updatedWorkspaceInfo = parseServerResponse(
          await Workspaces(signal).bucketMigrationProgress(workspacesWithNamespaces)
        );
        const merged = mergeBillingProjectMigrationInfo(getBillingProjectWorkspaces(), updatedWorkspaceInfo);
        setBillingProjectWorkspaces(merged);
      }
    }
  );

  useEffect(
    () => {
      const loadWorkspaces = _.flow(
        reportErrorAndRethrow('Error loading workspace migration information'),
        Utils.withBusyState(setLoadingMigrationInformation)
      )(async () => {
        const migrationResponse = await Workspaces(signal).bucketMigrationInfo();
        const billingProjectsWithWorkspaces = parseServerResponse(migrationResponse);
        setBillingProjectWorkspaces(billingProjectsWithWorkspaces);

        const inProgressWorkspacesWithNamespaces: WorkspaceWithNamespace[] = [];
        billingProjectsWithWorkspaces.forEach((billingProject) => {
          billingProject.workspaces.forEach((workspace) => {
            if (workspace.migrationStep !== 'Unscheduled' && workspace.migrationStep !== 'Finished') {
              inProgressWorkspacesWithNamespaces.push({ namespace: workspace.namespace, name: workspace.name });
            }
          });
        });
        setInProgressWorkspaces(inProgressWorkspacesWithNamespaces);

        //  Start timer to auto-refresh state
        if (!interval.current) {
          interval.current = window.setInterval(updateWorkspacesSilently, inProgressRefreshRate);
        }
      });
      loadWorkspaces();

      return () => {
        clearInterval(interval.current);
        interval.current = undefined;
      };
    }, // Adding updateWorkspacesSilently to the dependency list causes unittests to hang
    [setBillingProjectWorkspaces, signal] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return div({ style: { padding: '10px', backgroundColor: colors.light(), flexGrow: 1 } }, [
    h2({ style: { fontSize, marginLeft: '1.0rem' } }, ['Billing Projects']),
    loadingMigrationInformation &&
      div({ style: { display: 'flex', alignItems: 'center', marginLeft: '1.0rem' } }, [
        h(Spinner, { size: 36 }),
        span({ style: { fontSize, marginLeft: '0.5rem', marginTop: '0.5rem', fontStyle: 'italic' } }, [
          'Fetching billing projects',
        ]),
      ]),
    div({ role: 'list' }, [
      !loadingMigrationInformation &&
        billingProjectWorkspaces.length === 0 &&
        div({ style: { fontSize, marginTop: '1.5rem', marginLeft: '1.5rem' } }, ['You have no workspaces to migrate']),
      ..._.map(
        (billingProjectMigrationInfo) =>
          h(BillingProjectParent, { billingProjectMigrationInfo, migrationStartedCallback: updateWorkspacesSilently }),
        billingProjectWorkspaces
      ),
    ]),
  ]);
};
