import { Modal } from '@terra-ui-packages/components';
import { cond, DEFAULT } from '@terra-ui-packages/core-utils';
import _ from 'lodash/fp';
import pluralize from 'pluralize';
import { ReactNode, useState } from 'react';
import { b, div, h, span } from 'react-hyperscript-helpers';
import Collapse from 'src/components/Collapse';
import { ButtonOutline, ButtonPrimary } from 'src/components/common';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import colors from 'src/libs/colors';
import { reportErrorAndRethrow } from 'src/libs/error';
import {
  BillingProjectMigrationInfo,
  errorIcon,
  getBillingProjectMigrationStats,
  inProgressIcon,
  successIcon,
  WorkspaceWithNamespace,
} from 'src/workspaces/migration/migration-utils';
import { WorkspaceItem } from 'src/workspaces/migration/WorkspaceItem';
import { useMemo } from 'use-memo-one';

interface MigrateAllConfirmationProps {
  onDismiss: () => void;
  onSubmit: () => void;
  billingProject: string;
  remaining: boolean;
}

const MigrateAllConfirmation = (props: MigrateAllConfirmationProps) => {
  const remainingWording = props.remaining ? 'remaining ' : '';
  return h(
    Modal,
    {
      onDismiss: props.onDismiss,
      title: 'Confirm',
      okButton: h(
        ButtonPrimary,
        {
          onClick: props.onSubmit,
        },
        [props.remaining ? 'Migrate Remaining' : 'Migrate All']
      ),
    },
    [
      div([
        `Are you sure you want to migrate all ${remainingWording} workspaces in billing project `,
        b([props.billingProject]),
        '?',
        b({ style: { display: 'block', marginTop: '1rem', marginBottom: '1.5rem' } }, [
          'This cannot be stopped or undone.',
        ]),
      ]),
    ]
  );
};

interface BillingProjectParentProps {
  billingProjectMigrationInfo: BillingProjectMigrationInfo;
  migrationStartedCallback: (p: WorkspaceWithNamespace[]) => {};
}

export const BillingProjectParent = (props: BillingProjectParentProps): ReactNode => {
  const [confirmMigration, setConfirmMigration] = useState(false);

  const migrationStats = useMemo(() => {
    return getBillingProjectMigrationStats(props.billingProjectMigrationInfo);
  }, [props.billingProjectMigrationInfo]);

  const migrateWorkspace = reportErrorAndRethrow(
    // Some migrations may have started, but the page will not auto-refresh due to the error.
    'Error starting migration. Please refresh the page to get the most current status.'
  )(async () => {
    // Dismiss the confirmation dialog.
    setConfirmMigration(false);

    const workspacesToMigrate: { namespace: string; name: string }[] = [];
    props.billingProjectMigrationInfo.workspaces.forEach((workspace) => {
      if (workspace.migrationStep === 'Unscheduled') {
        workspacesToMigrate.push({ namespace: workspace.namespace, name: workspace.name });
      }
    });
    if (workspacesToMigrate.length > 0) {
      await Workspaces().startBatchBucketMigration(workspacesToMigrate);
      props.migrationStartedCallback(workspacesToMigrate);
    }
  });

  const renderErrorSummary = () => {
    return migrationStats.errored === 0
      ? ''
      : span({ style: { paddingLeft: '0.5rem', paddingRight: '0.5rem' } }, [
          errorIcon,
          span({ style: { paddingLeft: '0.5rem', color: colors.danger() } }, [
            `${pluralize('Migration', migrationStats.errored, true)} Failed`,
          ]),
        ]);
  };

  const renderMigrationSummary = () => {
    return cond(
      [
        migrationStats.workspaceCount === migrationStats.succeeded,
        () =>
          span({}, [
            successIcon,
            span({ style: { paddingLeft: '0.5rem', paddingRight: '0.5rem' } }, [
              migrationStats.workspaceCount === 1
                ? '1 Workspace Migrated'
                : `All ${migrationStats.workspaceCount} Workspaces Migrated`,
            ]),
          ]),
      ],
      [
        migrationStats.inProgress > 0,
        () =>
          span({}, [
            inProgressIcon,
            span({ style: { paddingLeft: '0.5rem', paddingRight: '0.5rem' } }, [
              `${pluralize('Workspace', migrationStats.inProgress, true)} Migrating`,
              migrationStats.errored > 0 && ', ',
              renderErrorSummary(),
            ]),
          ]),
      ],
      [
        DEFAULT,
        () =>
          span({ style: { paddingRight: '0.5rem' } }, [
            migrationStats.succeeded > 0 && `${pluralize('Workspace', migrationStats.succeeded, true)} Migrated`,
            migrationStats.succeeded > 0 && migrationStats.errored > 0 && ', ',
            renderErrorSummary(),
          ]),
      ]
    );
  };

  return div({ role: 'listitem' }, [
    h(
      Collapse,
      {
        summaryStyle: { height: 60, paddingLeft: '1.5rem', paddingRight: '1.5rem', fontWeight: 600, display: 'flex' },
        titleFirst: true,
        style: {
          fontSize: 14,
          margin: '10px 15px',
          borderBottom: `1px solid ${colors.dark(0.2)}`,
          borderRadius: 5,
          background: 'white',
        },
        title: div({ style: {} }, [props.billingProjectMigrationInfo.namespace]),
        afterTitle: div(
          { style: { display: 'flex', marginLeft: 'auto', alignItems: 'center', fontWeight: 'normal' } },
          [
            div({ style: {} }, [renderMigrationSummary()]),
            migrationStats.unscheduled > 0 &&
              h(
                ButtonOutline,
                {
                  onClick: () => setConfirmMigration(true),
                },
                [
                  migrationStats.workspaceCount === migrationStats.unscheduled
                    ? 'Migrate all workspaces'
                    : 'Migrate remaining workspaces',
                ]
              ),
          ]
        ),
        initialOpenState: true,
      },
      _.map(
        (workspaceMigrationInfo) =>
          h(WorkspaceItem, { workspaceMigrationInfo, migrationStartedCallback: props.migrationStartedCallback }),
        props.billingProjectMigrationInfo.workspaces
      )
    ),
    confirmMigration &&
      h(MigrateAllConfirmation, {
        onDismiss: () => setConfirmMigration(false),
        onSubmit: migrateWorkspace,
        billingProject: props.billingProjectMigrationInfo.namespace,
        remaining: migrationStats.workspaceCount !== migrationStats.unscheduled,
      }),
  ]);
};
