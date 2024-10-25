import { Modal } from '@terra-ui-packages/components';
import { ReactNode, useEffect, useState } from 'react';
import { b, div, h, span } from 'react-hyperscript-helpers';
import { ButtonOutline, ButtonPrimary } from 'src/components/common';
import { icon } from 'src/components/icons';
import { InfoBox } from 'src/components/InfoBox';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import colors from 'src/libs/colors';
import { reportErrorAndRethrow } from 'src/libs/error';
import { useCancellation } from 'src/libs/react-utils';
import * as Utils from 'src/libs/utils';
import {
  errorIcon,
  inProgressIcon,
  successIcon,
  WorkspaceMigrationInfo,
  WorkspaceWithNamespace,
} from 'src/workspaces/migration/migration-utils';

interface MigrateConfirmationProps {
  onDismiss: () => void;
  onSubmit: () => void;
  name: string;
  billingProject: string;
}

const MigrateConfirmation = (props: MigrateConfirmationProps) => {
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
        ['Migrate']
      ),
    },
    [
      div([
        'Are you sure you want to migrate workspace ',
        b([props.name]),
        ' in billing project ',
        b([props.billingProject]),
        '?',
        b({ style: { display: 'block', marginTop: '1rem', marginBottom: '1.5rem' } }, [
          'This cannot be stopped or undone.',
        ]),
      ]),
    ]
  );
};

interface WorkspaceItemProps {
  workspaceMigrationInfo: WorkspaceMigrationInfo;
  migrationStartedCallback: (p: WorkspaceWithNamespace[]) => {};
}

export const WorkspaceItem = (props: WorkspaceItemProps): ReactNode => {
  const workspaceInfo = props.workspaceMigrationInfo;
  const [unmigratedBucketSize, setUnmigratedBucketSize] = useState<string>();
  const [migrateStarted, setMigrateStarted] = useState<boolean>(false);
  const [confirmMigration, setConfirmMigration] = useState<boolean>(false);
  const bucketSizeFailed = 'Unable to fetch Bucket Size';
  const signal = useCancellation();

  const migrateWorkspace = reportErrorAndRethrow('Error starting migration')(async () => {
    // Dismiss confirmation
    setConfirmMigration(false);

    await Workspaces().workspaceV2(workspaceInfo.namespace, workspaceInfo.name).migrateWorkspace();
    props.migrationStartedCallback([{ name: workspaceInfo.name, namespace: workspaceInfo.namespace }]);
    setMigrateStarted(true);
  });

  useEffect(() => {
    const fetchBucketSize = async () => {
      // Set to an empty string as a flag that we have sent an Ajax request.
      setUnmigratedBucketSize('');
      try {
        const { usageInBytes } = await Workspaces(signal)
          .workspace(workspaceInfo.namespace, workspaceInfo.name)
          .bucketUsage();
        setUnmigratedBucketSize(`Bucket Size: ${Utils.formatBytes(usageInBytes)}`);
      } catch (error) {
        // This is typically a 404 with no message to display
        setUnmigratedBucketSize(bucketSizeFailed);
      }
    };

    if (unmigratedBucketSize === undefined && workspaceInfo.migrationStep === 'Unscheduled') {
      fetchBucketSize();
    }
    // If the workspace has started migration, clear the bucket size.
    if (unmigratedBucketSize !== undefined && workspaceInfo.migrationStep !== 'Unscheduled') {
      setUnmigratedBucketSize(undefined);
    }
  }, [setUnmigratedBucketSize, signal, unmigratedBucketSize, workspaceInfo]);

  const renderMigrationIcon = () => {
    return Utils.cond(
      [workspaceInfo.outcome === 'failure', () => errorIcon],
      [workspaceInfo.outcome === 'success', () => successIcon],
      [workspaceInfo.migrationStep !== 'Unscheduled', () => inProgressIcon],
      [
        workspaceInfo.migrationStep === 'Unscheduled' && unmigratedBucketSize === bucketSizeFailed,
        () =>
          icon('warning-info', {
            size: 22,
            style: { color: colors.warning() },
          }),
      ]
    );
  };

  const renderMigrationText = () => {
    const getTransferProgress = (transferType, processed, total) => {
      if (!total) {
        // handle both 0 and undefined
        return `${transferType} Bucket Transfer`;
      }
      return `${transferType} Transfer in Progress (${Utils.formatBytes(processed)}/${Utils.formatBytes(total)})`;
    };

    return Utils.cond(
      [
        workspaceInfo.outcome === 'failure',
        () =>
          span({ style: { color: colors.danger() } }, [
            'Migration Failed',
            h(
              InfoBox,
              {
                style: { marginLeft: '0.5rem' },
                side: 'bottom',
                tooltip: 'Failure information',
                size: 18,
              },
              [workspaceInfo.failureReason]
            ),
          ]),
      ],
      [workspaceInfo.outcome === 'success', () => span(['Migration Complete'])],
      [workspaceInfo.migrationStep === 'ScheduledForMigration', () => span(['Starting Migration'])],
      [workspaceInfo.migrationStep === 'PreparingTransferToTempBucket', () => span(['Preparing Original Bucket'])],
      [
        workspaceInfo.migrationStep === 'TransferringToTempBucket',
        () =>
          span([
            getTransferProgress(
              'Initial',
              workspaceInfo.tempBucketTransferProgress?.bytesTransferred,
              workspaceInfo.tempBucketTransferProgress?.totalBytesToTransfer
            ),
          ]),
      ],
      [workspaceInfo.migrationStep === 'PreparingTransferToFinalBucket', () => span(['Creating Destination Bucket'])],
      [
        workspaceInfo.migrationStep === 'TransferringToFinalBucket',
        () =>
          span([
            getTransferProgress(
              'Final',
              workspaceInfo.finalBucketTransferProgress?.bytesTransferred,
              workspaceInfo.finalBucketTransferProgress?.totalBytesToTransfer
            ),
          ]),
      ],
      // If workspace.outcome === 'success', we end earlier with a "Migration Complete" message.
      // Therefor we shouldn't encounter 'Finished' here, but handling it in case `outcome` updates later.
      [
        workspaceInfo.migrationStep === 'FinishingUp' || workspaceInfo.migrationStep === 'Finished',
        () => span(['Finishing Migration']),
      ],
      [workspaceInfo.migrationStep === 'Unscheduled' && !!unmigratedBucketSize, () => span([unmigratedBucketSize])]
    );
  };

  return div(
    {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0.5rem 2.5rem',
        alignItems: 'center',
        height: '3.5rem',
        borderTop: `1px solid ${colors.dark(0.2)}`,
      },
    },
    [
      span([workspaceInfo.name]),
      div({ style: { display: 'flex', alignItems: 'center' } }, [
        renderMigrationIcon(),
        div({ style: { paddingLeft: '0.5rem' } }, [renderMigrationText()]),
        workspaceInfo.migrationStep === 'Unscheduled' &&
          span({ style: { marginLeft: '10px' } }, [
            h(
              ButtonOutline,
              {
                disabled: migrateStarted,
                tooltip: migrateStarted ? 'Migration has been scheduled' : '',
                onClick: () => setConfirmMigration(true),
                'aria-label': `Migrate ${workspaceInfo.name}`,
              },
              ['Migrate']
            ),
          ]),
      ]),
      confirmMigration &&
        h(MigrateConfirmation, {
          onDismiss: () => setConfirmMigration(false),
          onSubmit: migrateWorkspace,
          name: workspaceInfo.name,
          billingProject: workspaceInfo.namespace,
        }),
    ]
  );
};
