import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { div, h } from 'react-hyperscript-helpers';
import { Ajax } from 'src/libs/ajax';
import { BillingProjectParent } from 'src/pages/workspaces/migration/BillingProjectParent';
import { WorkspaceMigrationInfo } from 'src/pages/workspaces/migration/migration-utils';
import {
  bpWithFailed,
  bpWithInProgress,
  bpWithSucceededAndUnscheduled,
} from 'src/pages/workspaces/migration/migration-utils.test';
import { asMockedFn, renderWithAppContexts as render } from 'src/testing/test-utils';

type AjaxContract = ReturnType<typeof Ajax>;
type AjaxWorkspacesContract = AjaxContract['Workspaces'];
jest.mock('src/libs/ajax');

describe('BillingProjectParent', () => {
  const mockMigrationStartedCallback = jest.fn();

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('shows migrate all button if all workspaces are unscheduled, with a cancelable confirmation dialog', async () => {
    // Arrange
    const user = userEvent.setup();
    const twoUnscheduledMigrationInfo: WorkspaceMigrationInfo[] = [
      { migrationStep: 'Unscheduled', name: 'notmigrated1', namespace: 'CARBilling-2' },
      { migrationStep: 'Unscheduled', name: 'notmigrated2', namespace: 'CARBilling-2' },
    ];
    const mockStartBatchBucketMigration = jest.fn().mockResolvedValue({});
    const mockWorkspaces: Partial<AjaxWorkspacesContract> = {
      startBatchBucketMigration: mockStartBatchBucketMigration,
    };
    const mockAjax: Partial<AjaxContract> = {
      Workspaces: mockWorkspaces as AjaxWorkspacesContract,
    };
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract);

    // Act
    render(
      div({ role: 'list' }, [
        h(BillingProjectParent, {
          billingProjectMigrationInfo: {
            namespace: 'CARBilling-2',
            workspaces: twoUnscheduledMigrationInfo,
          },
          migrationStartedCallback: mockMigrationStartedCallback,
        }),
      ])
    );
    await user.click(screen.getByText('Migrate all workspaces'));

    // Confirmation dialog
    expect(screen.queryByText(/Are you sure you want to migrate all workspaces/i)).toBeTruthy();
    await user.click(screen.getByText('Cancel'));

    // Assert
    expect(screen.queryByText(/Are you sure you want to migrate all workspaces/i)).toBeFalsy();
    expect(mockStartBatchBucketMigration).not.toHaveBeenCalled();
    expect(mockMigrationStartedCallback).not.toHaveBeenCalled();
  });

  it('shows migrate all button if all workspaces are unscheduled, with no accessibility errors', async () => {
    // Arrange
    const user = userEvent.setup();
    const twoUnscheduledMigrationInfo: WorkspaceMigrationInfo[] = [
      { migrationStep: 'Unscheduled', name: 'notmigrated1', namespace: 'CARBilling-2' },
      { migrationStep: 'Unscheduled', name: 'notmigrated2', namespace: 'CARBilling-2' },
    ];
    const mockStartBatchBucketMigration = jest.fn().mockResolvedValue({});
    const mockWorkspaces: Partial<AjaxWorkspacesContract> = {
      startBatchBucketMigration: mockStartBatchBucketMigration,
    };
    const mockAjax: Partial<AjaxContract> = {
      Workspaces: mockWorkspaces as AjaxWorkspacesContract,
    };
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract);

    // Act
    const { container } = render(
      div({ role: 'list' }, [
        h(BillingProjectParent, {
          billingProjectMigrationInfo: {
            namespace: 'CARBilling-2',
            workspaces: twoUnscheduledMigrationInfo,
          },
          migrationStartedCallback: mockMigrationStartedCallback,
        }),
      ])
    );
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByText('Migrate all workspaces'));
    // Confirmation dialog
    await user.click(screen.getByText('Migrate All'));

    // Assert
    expect(mockStartBatchBucketMigration).toHaveBeenCalledWith([
      { name: 'notmigrated1', namespace: 'CARBilling-2' },
      { name: 'notmigrated2', namespace: 'CARBilling-2' },
    ]);
    expect(mockMigrationStartedCallback).toHaveBeenCalledWith([
      { name: 'notmigrated1', namespace: 'CARBilling-2' },
      { name: 'notmigrated2', namespace: 'CARBilling-2' },
    ]);
  });

  it('shows migrate remaining button if some workspaces are unscheduled', async () => {
    // Arrange
    const user = userEvent.setup();

    const mockStartBatchBucketMigration = jest.fn().mockResolvedValue({});
    const mockWorkspaces: Partial<AjaxWorkspacesContract> = {
      startBatchBucketMigration: mockStartBatchBucketMigration,
    };
    const mockAjax: Partial<AjaxContract> = {
      Workspaces: mockWorkspaces as AjaxWorkspacesContract,
    };
    asMockedFn(Ajax).mockImplementation(() => mockAjax as AjaxContract);

    // Act
    render(
      h(BillingProjectParent, {
        billingProjectMigrationInfo: bpWithSucceededAndUnscheduled,
        migrationStartedCallback: mockMigrationStartedCallback,
      })
    );
    await user.click(screen.getByText('Migrate remaining workspaces'));
    // Confirmation dialog
    expect(screen.queryByText(/Are you sure you want to migrate all remaining workspaces/i)).toBeTruthy();
    await user.click(screen.getByText('Migrate Remaining'));

    // Assert
    expect(screen.queryByText(/Are you sure you want to migrate all remaining workspaces/i)).toBeFalsy();
    expect(mockStartBatchBucketMigration).toHaveBeenCalledWith([{ name: 'notmigrated', namespace: 'CARBilling-2' }]);
    await screen.findByText('1 Workspace Migrated');
    expect(mockMigrationStartedCallback).toHaveBeenCalledWith([{ name: 'notmigrated', namespace: 'CARBilling-2' }]);
  });

  it('does not show a migrate button if the only workspace is in progress', async () => {
    // Act
    render(
      h(BillingProjectParent, {
        billingProjectMigrationInfo: bpWithInProgress,
        migrationStartedCallback: mockMigrationStartedCallback,
      })
    );

    // Assert
    expect(screen.queryByText('Migrate remaining workspaces')).toBeNull();
    expect(screen.queryByText('Migrate all workspaces')).toBeNull();
    await screen.findByText('1 Workspace Migrating');
  });

  it('does not show a migrate button if the only workspace is failed', async () => {
    // Act
    render(
      h(BillingProjectParent, {
        billingProjectMigrationInfo: bpWithFailed,
        migrationStartedCallback: mockMigrationStartedCallback,
      })
    );

    // Assert
    expect(screen.queryByText('Migrate remaining workspaces')).toBeNull();
    expect(screen.queryByText('Migrate all workspaces')).toBeNull();
    await screen.findByText('1 Migration Failed');
  });

  it('does not show a migrate button if all workspaces succeeded', async () => {
    // Arrange
    const dummyTransferProgress = {
      bytesTransferred: 288912,
      objectsTransferred: 561,
      totalBytesToTransfer: 288912,
      totalObjectsToTransfer: 561,
    };
    const twoSucceededMigrationInfo: WorkspaceMigrationInfo[] = [
      {
        failureReason: undefined,
        finalBucketTransferProgress: dummyTransferProgress,
        migrationStep: 'Finished',
        name: 'migrated1',
        namespace: 'CARBilling-2',
        outcome: 'success',
        tempBucketTransferProgress: dummyTransferProgress,
      },
      {
        failureReason: undefined,
        finalBucketTransferProgress: dummyTransferProgress,
        migrationStep: 'Finished',
        name: 'migrated2',
        namespace: 'CARBilling-2',
        outcome: 'success',
        tempBucketTransferProgress: dummyTransferProgress,
      },
    ];

    // Act
    render(
      h(BillingProjectParent, {
        billingProjectMigrationInfo: {
          namespace: 'CARBilling-2',
          workspaces: twoSucceededMigrationInfo,
        },
        migrationStartedCallback: mockMigrationStartedCallback,
      })
    );

    // Assert
    expect(screen.queryByText('Migrate remaining workspaces')).toBeNull();
    expect(screen.queryByText('Migrate all workspaces')).toBeNull();
    await screen.findByText('All 2 Workspaces Migrated');
  });
});
