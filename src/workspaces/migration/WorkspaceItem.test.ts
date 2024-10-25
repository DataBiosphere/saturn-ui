import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { h } from 'react-hyperscript-helpers';
import {
  WorkspaceContract,
  Workspaces,
  WorkspacesAjaxContract,
  WorkspaceV2Contract,
} from 'src/libs/ajax/workspaces/Workspaces';
import { asMockedFn, partial, renderWithAppContexts as render } from 'src/testing/test-utils';
import { MigrationStep, WorkspaceMigrationInfo } from 'src/workspaces/migration/migration-utils';
import { WorkspaceItem } from 'src/workspaces/migration/WorkspaceItem';

jest.mock('src/libs/ajax/workspaces/Workspaces');

describe('WorkspaceItem', () => {
  const unscheduledWorkspace: WorkspaceMigrationInfo = {
    namespace: 'billing project',
    name: 'workspace name',
    migrationStep: 'Unscheduled',
  };
  const migrateButtonText = `Migrate ${unscheduledWorkspace.name}`;
  const migrationScheduledTooltipText = 'Migration has been scheduled';
  const mockGetBucketUsage: WorkspaceContract['bucketUsage'] = jest.fn();
  const mockMigrationStartedCallback = jest.fn();

  beforeEach(() => {
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            bucketUsage: mockGetBucketUsage,
          }),
      })
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('shows the workspace name and bucket size for an unscheduled workspace', async () => {
    // Arrange
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            bucketUsage: async () => ({ usageInBytes: 1234 }),
          }),
      })
    );

    // Act
    render(
      h(WorkspaceItem, {
        workspaceMigrationInfo: unscheduledWorkspace,
        migrationStartedCallback: mockMigrationStartedCallback,
      })
    );

    // Assert
    await screen.findByText('workspace name');
    await screen.findByText('Bucket Size: 1.21 KiB');
  });

  it('can shows a cancelable confirmation dialog when migrate is selected', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockMigrateWorkspace: WorkspaceV2Contract['migrateWorkspace'] = jest.fn();
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            bucketUsage: async () => ({ usageInBytes: 1234 }),
          }),
        workspaceV2: () =>
          partial<WorkspaceV2Contract>({
            migrateWorkspace: mockMigrateWorkspace,
          }),
      })
    );

    // Act
    render(
      h(WorkspaceItem, {
        workspaceMigrationInfo: unscheduledWorkspace,
        migrationStartedCallback: mockMigrationStartedCallback,
      })
    );
    expect(screen.queryByText(migrationScheduledTooltipText)).toBeNull();
    await user.click(screen.getByLabelText(migrateButtonText));

    // Confirmation dialog
    expect(screen.queryByText(/Are you sure you want to migrate workspace/i)).toBeTruthy();
    const confirmDialog = screen.getByRole('dialog');
    await user.click(within(confirmDialog).getByText('Cancel'));

    // Assert
    expect(screen.queryByText(/Are you sure you want to migrate workspace/i)).toBeFalsy();
    expect(mockMigrateWorkspace).not.toHaveBeenCalled();
    expect(screen.getByLabelText(migrateButtonText).getAttribute('aria-disabled')).toBe('false');
    expect(screen.queryByText(migrationScheduledTooltipText)).toBeNull();
    expect(mockMigrationStartedCallback).not.toHaveBeenCalled();
  });

  it('can start a migration for an unscheduled workspace', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockMigrateWorkspace = jest.fn();
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            bucketUsage: async () => ({ usageInBytes: 1234 }),
          }),
        workspaceV2: () =>
          partial<WorkspaceV2Contract>({
            migrateWorkspace: mockMigrateWorkspace,
          }),
      })
    );

    // Act
    render(
      h(WorkspaceItem, {
        workspaceMigrationInfo: unscheduledWorkspace,
        migrationStartedCallback: mockMigrationStartedCallback,
      })
    );
    expect(screen.queryByText(migrationScheduledTooltipText)).toBeNull();
    await user.click(screen.getByLabelText(migrateButtonText));

    // Confirmation dialog
    expect(screen.queryByText(/Are you sure you want to migrate workspace/i)).toBeTruthy();
    const confirmDialog = screen.getByRole('dialog');
    await user.click(within(confirmDialog).getByText('Migrate'));

    // Assert
    expect(screen.queryByText(/Are you sure you want to migrate workspace/i)).toBeFalsy();
    expect(mockMigrateWorkspace).toHaveBeenCalled();
    expect(screen.getByLabelText(migrateButtonText).getAttribute('aria-disabled')).toBe('true');
    await screen.findByText(migrationScheduledTooltipText);
    expect(mockMigrationStartedCallback).toHaveBeenCalledWith([
      { name: unscheduledWorkspace.name, namespace: unscheduledWorkspace.namespace },
    ]);
  });

  it('shows if the bucket size cannot be fetched for an unscheduled workspace, and shows migrate button', async () => {
    // Arrange
    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        workspace: () =>
          partial<WorkspaceContract>({
            bucketUsage: async () => {
              throw new Error('testing');
            },
          }),
      })
    );

    // Act
    render(
      h(WorkspaceItem, {
        workspaceMigrationInfo: unscheduledWorkspace,
        migrationStartedCallback: mockMigrationStartedCallback,
      })
    );

    // Assert
    await screen.findByText('workspace name');
    await screen.findByText('Unable to fetch Bucket Size');
    await screen.findByLabelText(migrateButtonText);
  });

  it('shows completed workspace status and does not fetch bucket size, with no migrate button', async () => {
    // Arrange
    const completedWorkspace: WorkspaceMigrationInfo = {
      failureReason: undefined,
      finalBucketTransferProgress: {
        bytesTransferred: 288912,
        objectsTransferred: 561,
        totalBytesToTransfer: 288912,
        totalObjectsToTransfer: 561,
      },
      migrationStep: 'Finished',
      name: 'april29',
      namespace: 'CARBilling-2',
      outcome: 'success',
      tempBucketTransferProgress: {
        bytesTransferred: 288912,
        objectsTransferred: 561,
        totalBytesToTransfer: 288912,
        totalObjectsToTransfer: 561,
      },
    };

    // Act
    render(
      h(WorkspaceItem, {
        workspaceMigrationInfo: completedWorkspace,
        migrationStartedCallback: mockMigrationStartedCallback,
      })
    );

    // Assert
    await screen.findByText('april29');
    await screen.findByText('Migration Complete');
    expect(mockGetBucketUsage).not.toHaveBeenCalled();
    expect(screen.queryByText(migrateButtonText)).toBeNull();
  });

  it('shows failed workspace status with no accessibility errors and no migrate button', async () => {
    // Arrange
    const user = userEvent.setup();
    const failedWorkspace: WorkspaceMigrationInfo = {
      failureReason: 'Bucket migration failure reason',
      finalBucketTransferProgress: undefined,
      migrationStep: 'Finished',
      name: 'testdata',
      namespace: 'CARBillingTest',
      outcome: 'failure',
      tempBucketTransferProgress: undefined,
    };

    // Act
    const { container } = render(
      h(WorkspaceItem, {
        workspaceMigrationInfo: failedWorkspace,
        migrationStartedCallback: mockMigrationStartedCallback,
      })
    );
    const infoButton = screen.getByLabelText('More info');
    await user.click(infoButton);

    // Assert
    await screen.findByText('testdata');
    await screen.findByText('Migration Failed');
    await screen.findByText('Bucket migration failure reason');
    expect(screen.queryByText(migrateButtonText)).toBeNull();
    expect(mockGetBucketUsage).not.toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each([
    { migrationStep: 'ScheduledForMigration' as MigrationStep, expectedStatus: 'Starting Migration' },
    { migrationStep: 'PreparingTransferToTempBucket' as MigrationStep, expectedStatus: 'Preparing Original Bucket' },
    { migrationStep: 'PreparingTransferToFinalBucket' as MigrationStep, expectedStatus: 'Creating Destination Bucket' },
    { migrationStep: 'FinishingUp' as MigrationStep, expectedStatus: 'Finishing Migration' },
    { migrationStep: 'Finished' as MigrationStep, expectedStatus: 'Finishing Migration' },
  ])(
    'renders status for state "$migrationStep" with no accessibility errors and no migrate button',
    async ({ migrationStep, expectedStatus }) => {
      // Arrange
      const workspace: WorkspaceMigrationInfo = {
        namespace: 'billing project',
        name: 'workspace name',
        migrationStep,
      };

      // Act
      const { container } = render(
        h(WorkspaceItem, { workspaceMigrationInfo: workspace, migrationStartedCallback: mockMigrationStartedCallback })
      );

      // Assert
      await screen.findByText(expectedStatus);
      expect(screen.queryByText(migrateButtonText)).toBeNull();
      expect(mockGetBucketUsage).not.toHaveBeenCalled();
      expect(await axe(container)).toHaveNoViolations();
    }
  );

  it('shows transfer to temp bucket state with bytes', async () => {
    // Arrange
    const transferringWorkspace: WorkspaceMigrationInfo = {
      failureReason: undefined,
      finalBucketTransferProgress: {
        bytesTransferred: 0,
        objectsTransferred: 0,
        totalBytesToTransfer: 0,
        totalObjectsToTransfer: 0,
      },
      migrationStep: 'TransferringToTempBucket',
      name: 'Christina test',
      namespace: 'general-dev-billing-account',
      outcome: undefined,
      tempBucketTransferProgress: {
        bytesTransferred: 1000,
        objectsTransferred: 2,
        totalBytesToTransfer: 2000,
        totalObjectsToTransfer: 4,
      },
    };

    // Act
    render(
      h(WorkspaceItem, {
        workspaceMigrationInfo: transferringWorkspace,
        migrationStartedCallback: mockMigrationStartedCallback,
      })
    );

    // Assert
    await screen.findByText('Christina test');
    await screen.findByText('Initial Transfer in Progress (1000 B/1.95 KiB)');
    expect(mockGetBucketUsage).not.toHaveBeenCalled();
  });

  it('shows transfer to temp bucket state with no files', async () => {
    // Arrange
    const transferringWorkspace: WorkspaceMigrationInfo = {
      failureReason: undefined,
      finalBucketTransferProgress: {
        bytesTransferred: 0,
        objectsTransferred: 0,
        totalBytesToTransfer: 0,
        totalObjectsToTransfer: 0,
      },
      migrationStep: 'TransferringToTempBucket',
      name: 'Christina test',
      namespace: 'general-dev-billing-account',
      outcome: undefined,
      tempBucketTransferProgress: {
        bytesTransferred: 0,
        objectsTransferred: 0,
        totalBytesToTransfer: 0,
        totalObjectsToTransfer: 0,
      },
    };

    // Act
    render(
      h(WorkspaceItem, {
        workspaceMigrationInfo: transferringWorkspace,
        migrationStartedCallback: mockMigrationStartedCallback,
      })
    );

    // Assert
    await screen.findByText('Christina test');
    await screen.findByText('Initial Bucket Transfer');
    expect(mockGetBucketUsage).not.toHaveBeenCalled();
  });

  it('shows transfer to temp bucket state with bytes', async () => {
    // Arrange
    const transferringWorkspace: WorkspaceMigrationInfo = {
      failureReason: undefined,
      finalBucketTransferProgress: {
        bytesTransferred: 1000,
        objectsTransferred: 2,
        totalBytesToTransfer: 2000,
        totalObjectsToTransfer: 4,
      },
      migrationStep: 'TransferringToFinalBucket',
      name: 'Christina test',
      namespace: 'general-dev-billing-account',
      outcome: undefined,
      tempBucketTransferProgress: {
        bytesTransferred: 2000,
        objectsTransferred: 4,
        totalBytesToTransfer: 2000,
        totalObjectsToTransfer: 4,
      },
    };

    // Act
    render(
      h(WorkspaceItem, {
        workspaceMigrationInfo: transferringWorkspace,
        migrationStartedCallback: mockMigrationStartedCallback,
      })
    );

    // Assert
    await screen.findByText('Christina test');
    await screen.findByText('Final Transfer in Progress (1000 B/1.95 KiB)');
    expect(mockGetBucketUsage).not.toHaveBeenCalled();
  });

  it('shows transfer to temp bucket state with no files', async () => {
    // Arrange
    const transferringWorkspace: WorkspaceMigrationInfo = {
      failureReason: undefined,
      finalBucketTransferProgress: undefined,
      migrationStep: 'TransferringToFinalBucket',
      name: 'Christina test',
      namespace: 'general-dev-billing-account',
      outcome: undefined,
      tempBucketTransferProgress: undefined,
    };

    // Act
    render(
      h(WorkspaceItem, {
        workspaceMigrationInfo: transferringWorkspace,
        migrationStartedCallback: mockMigrationStartedCallback,
      })
    );

    // Assert
    await screen.findByText('Christina test');
    await screen.findByText('Final Bucket Transfer');
    expect(mockGetBucketUsage).not.toHaveBeenCalled();
  });
});
