import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ReactNode, useState } from 'react';
import { hasBillingScope } from 'src/auth/auth';
import { BillingAccountControls } from 'src/billing/BillingAccount/BillingAccountControls';
import { GCPBillingProject, GoogleBillingAccount } from 'src/billing-core/models';
import { Billing, BillingContract } from 'src/libs/ajax/billing/Billing';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import Events, { extractBillingDetails } from 'src/libs/events';
import { gcpBillingProject } from 'src/testing/billing-project-fixtures';
import { asMockedFn, MockedFn, partial, renderWithAppContexts, SelectHelper } from 'src/testing/test-utils';

type AuthExports = typeof import('src/auth/auth');

jest.mock('src/libs/ajax/billing/Billing');
jest.mock('src/libs/ajax/Metrics');

jest.mock('src/auth/auth', (): AuthExports => {
  const originalModule = jest.requireActual<AuthExports>('src/auth/auth');
  return {
    ...originalModule,
    hasBillingScope: jest.fn(),
  };
});

describe('BillingAccountControls', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    asMockedFn(hasBillingScope).mockReturnValue(true);
  });

  it('displays a link to view billing account info if user does not have billing scope', async () => {
    // Arrange
    const user = userEvent.setup();
    asMockedFn(hasBillingScope).mockReturnValue(false);
    const mockAuthorizeAndLoadAccounts = jest.fn();

    // Act
    renderWithAppContexts(
      <BillingAccountControls
        authorizeAndLoadAccounts={mockAuthorizeAndLoadAccounts}
        billingAccounts={{}}
        billingProject={gcpBillingProject}
        isOwner
        getShowBillingModal={jest.fn()}
        setShowBillingModal={jest.fn()}
        reloadBillingProject={jest.fn()}
        setUpdating={jest.fn()}
      />
    );

    // Assert
    // No options to edit things because user does not have billing scope.
    expect(screen.queryByLabelText('Billing account menu')).toBeNull();
    expect(screen.queryByLabelText('Configure Spend Reporting')).toBeNull();
    // Click option to view billing account information, which will require account elevation.
    const viewBillingAccountButton = screen.getByText('View billing account');
    await user.click(viewBillingAccountButton);
    expect(mockAuthorizeAndLoadAccounts).toHaveBeenCalled();
  });

  it('displays a link to set up budget alerts if user does not have billing scope', async () => {
    // Arrange
    asMockedFn(hasBillingScope).mockReturnValue(false);
    const mockAuthorizeAndLoadAccounts = jest.fn();

    // Act
    renderWithAppContexts(
      <BillingAccountControls
        authorizeAndLoadAccounts={mockAuthorizeAndLoadAccounts}
        billingAccounts={{}}
        billingProject={gcpBillingProject}
        isOwner
        getShowBillingModal={jest.fn()}
        setShowBillingModal={jest.fn()}
        reloadBillingProject={jest.fn()}
        setUpdating={jest.fn()}
      />
    );

    // Assert
    // No options to edit things because user does not have billing scope.
    expect(screen.queryByLabelText('Billing account menu')).toBeNull();
    expect(screen.queryByLabelText('Configure Spend Reporting')).toBeNull();

    expect(screen.getByText('Learn how to set up budget alerts to monitor cloud spend')).not.toBeNull();
  });

  it('displays a link to set up budget alerts if user does have billing scope', async () => {
    // Arrange
    asMockedFn(hasBillingScope).mockReturnValue(true);
    const mockAuthorizeAndLoadAccounts = jest.fn();

    // Act
    renderWithAppContexts(
      <BillingAccountControls
        authorizeAndLoadAccounts={mockAuthorizeAndLoadAccounts}
        billingAccounts={{}}
        billingProject={gcpBillingProject}
        isOwner
        getShowBillingModal={jest.fn()}
        setShowBillingModal={jest.fn()}
        reloadBillingProject={jest.fn()}
        setUpdating={jest.fn()}
      />
    );

    // Assert
    expect(screen.getByText('Learn how to set up budget alerts to monitor cloud spend')).not.toBeNull();
  });

  it('shows "no billing account" message if user has billing scope but billing project does not have an account', async () => {
    // Arrange
    // Historical case noted with comment in code, not sure if it actually exists anymore.
    const billingProjectWithNoAccount: GCPBillingProject = {
      // @ts-ignore
      billingAccount: null,
      cloudPlatform: 'GCP',
      invalidBillingAccount: false,
      projectName: 'Google Billing Project',
      roles: ['User'],
      status: 'Ready',
    };
    // Act
    renderWithAppContexts(
      <BillingAccountControls
        authorizeAndLoadAccounts={jest.fn()}
        billingAccounts={{}}
        billingProject={billingProjectWithNoAccount}
        isOwner={false}
        getShowBillingModal={jest.fn()}
        setShowBillingModal={jest.fn()}
        reloadBillingProject={jest.fn()}
        setUpdating={jest.fn()}
      />
    );

    // Assert
    expect(screen.queryByText('View billing account')).toBeNull();
    screen.getByText('No linked billing account');
  });

  it('shows "no access" message if user has billing scope but no billing accounts', async () => {
    // Act
    renderWithAppContexts(
      <BillingAccountControls
        authorizeAndLoadAccounts={jest.fn()}
        billingAccounts={{}}
        billingProject={gcpBillingProject}
        isOwner={false}
        getShowBillingModal={jest.fn()}
        setShowBillingModal={jest.fn()}
        reloadBillingProject={jest.fn()}
        setUpdating={jest.fn()}
      />
    );

    // Assert
    screen.getByText('No access to linked billing account');
  });

  it('shows billing account name if user has billing scope and access', async () => {
    // Arrange
    const testBillingAccount: GoogleBillingAccount = {
      accountName: gcpBillingProject.billingAccount,
      displayName: 'Test Billing Account',
    };
    const billingAccounts: Record<string, GoogleBillingAccount> = {};
    billingAccounts[`${gcpBillingProject.billingAccount}`] = testBillingAccount;

    // Act
    renderWithAppContexts(
      <BillingAccountControls
        authorizeAndLoadAccounts={jest.fn()}
        billingAccounts={billingAccounts}
        billingProject={gcpBillingProject}
        isOwner={false}
        getShowBillingModal={jest.fn()}
        setShowBillingModal={jest.fn()}
        reloadBillingProject={jest.fn()}
        setUpdating={jest.fn()}
      />
    );

    // Assert
    screen.getByText('Test Billing Account');
    // No menu because owner is false
    expect(screen.queryByLabelText('Billing account menu')).toBeNull();
    // No edit spend reporting because owner is false
    expect(screen.queryByLabelText('Configure Spend Reporting')).toBeNull();
  });

  it('shows a modal to change billing account if user has billing scope, access, and isOwner', async () => {
    // Arrange
    const user = userEvent.setup();
    const billingAccounts: Record<string, GoogleBillingAccount> = {};
    const testBillingAccount: GoogleBillingAccount = {
      accountName: gcpBillingProject.billingAccount,
      displayName: 'Test Billing Account',
    };
    billingAccounts[`${gcpBillingProject.billingAccount}`] = testBillingAccount;
    const secondBillingAccount: GoogleBillingAccount = {
      accountName: 'billing-account-two',
      displayName: 'Second Billing Account',
    };
    billingAccounts['billing-account-two'] = secondBillingAccount;
    // The parent class maintains the `showBillingModal` state because it is involved in periodically polling
    // to update the state of billing accounts. For the test to be able to react to the state changes, we have
    // to create a test component that can store the state.
    const BillingAccountControlsWithState = ({
      billingAccounts,
      billingProject,
      reloadBillingProject,
    }: {
      billingAccounts: Record<string, GoogleBillingAccount>;
      billingProject: GCPBillingProject;
      reloadBillingProject: () => Promise<unknown>;
    }): ReactNode => {
      const [showBillingModal, setShowBillingModal] = useState<boolean>(false);

      return (
        <BillingAccountControls
          authorizeAndLoadAccounts={jest.fn()}
          billingAccounts={billingAccounts}
          billingProject={billingProject}
          isOwner
          getShowBillingModal={() => showBillingModal}
          setShowBillingModal={setShowBillingModal}
          reloadBillingProject={reloadBillingProject}
          setUpdating={jest.fn()}
        />
      );
    };
    const captureEvent: MockedFn<MetricsContract['captureEvent']> = jest.fn();
    const changeBillingAccount: MockedFn<BillingContract['changeBillingAccount']> = jest.fn();
    asMockedFn(Billing).mockReturnValue(partial<BillingContract>({ changeBillingAccount }));
    asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent }));

    const reloadBillingProject = jest.fn();

    // Act
    renderWithAppContexts(
      <BillingAccountControlsWithState
        billingAccounts={billingAccounts}
        billingProject={gcpBillingProject}
        reloadBillingProject={reloadBillingProject}
      />
    );

    // Show menu
    const menu = screen.getByLabelText('Billing account menu');
    await user.click(menu);
    // Click change billing account
    const changeAccount = screen.getByText('Change Billing Account');
    await user.click(changeAccount);
    // Select new billing account and save
    const billingAccountSelect = new SelectHelper(screen.getByLabelText('Select billing account *'), user);
    await billingAccountSelect.selectOption('Second Billing Account');
    const saveButton = screen.getByText('Ok');
    await user.click(saveButton);

    // Assert
    expect(changeBillingAccount).toHaveBeenCalledWith({
      billingProjectName: gcpBillingProject.projectName,
      newBillingAccountName: 'billing-account-two',
    });
    expect(captureEvent).toHaveBeenCalledWith(Events.billingChangeAccount, {
      oldName: gcpBillingProject.billingAccount,
      newName: 'billing-account-two',
      ...extractBillingDetails(gcpBillingProject),
    });
    expect(reloadBillingProject).toHaveBeenCalled();
  });

  it('shows a modal to remove billing account if user has billing scope, access, and isOwner', async () => {
    // Arrange
    const user = userEvent.setup();
    const billingAccounts: Record<string, GoogleBillingAccount> = {};
    const testBillingAccount: GoogleBillingAccount = {
      accountName: gcpBillingProject.billingAccount,
      displayName: 'Test Billing Account',
    };
    billingAccounts[`${gcpBillingProject.billingAccount}`] = testBillingAccount;

    const captureEvent: MockedFn<MetricsContract['captureEvent']> = jest.fn();
    const removeBillingAccount: MockedFn<BillingContract['removeBillingAccount']> = jest.fn();
    asMockedFn(Billing).mockReturnValue(partial<BillingContract>({ removeBillingAccount }));
    asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent }));

    const reloadBillingProject = jest.fn();
    const setUpdating = jest.fn();

    // Act
    renderWithAppContexts(
      <BillingAccountControls
        authorizeAndLoadAccounts={jest.fn()}
        billingAccounts={billingAccounts}
        billingProject={gcpBillingProject}
        isOwner
        getShowBillingModal={jest.fn()}
        setShowBillingModal={jest.fn()}
        reloadBillingProject={reloadBillingProject}
        setUpdating={setUpdating}
      />
    );

    // Show menu
    const menu = screen.getByLabelText('Billing account menu');
    await user.click(menu);
    // Click remove billing account option
    const removeAccount = screen.getByText('Remove Billing Account');
    await user.click(removeAccount);
    // Save
    const saveButton = screen.getByText('Ok');
    await user.click(saveButton);

    // Assert
    expect(removeBillingAccount).toHaveBeenCalledWith({ billingProjectName: gcpBillingProject.projectName });
    expect(captureEvent).toHaveBeenCalledWith(Events.billingRemoveAccount, extractBillingDetails(gcpBillingProject));
    expect(reloadBillingProject).toHaveBeenCalled();
    expect(setUpdating).toHaveBeenNthCalledWith(1, true);
    expect(setUpdating).toHaveBeenNthCalledWith(2, false);
  });

  it('shows a modal to update spend reporting if user has billing scope, access, and isOwner', async () => {
    // Arrange
    const user = userEvent.setup();
    const billingAccounts: Record<string, GoogleBillingAccount> = {};
    const testBillingAccount: GoogleBillingAccount = {
      accountName: gcpBillingProject.billingAccount,
      displayName: 'Test Billing Account',
    };
    billingAccounts[`${gcpBillingProject.billingAccount}`] = testBillingAccount;

    const captureEvent: MockedFn<MetricsContract['captureEvent']> = jest.fn();
    const updateSpendConfiguration: MockedFn<BillingContract['updateSpendConfiguration']> = jest.fn();
    asMockedFn(Billing).mockReturnValue(partial<BillingContract>({ updateSpendConfiguration }));
    asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent }));
    const setUpdating = jest.fn();

    // Act
    renderWithAppContexts(
      <BillingAccountControls
        authorizeAndLoadAccounts={jest.fn()}
        billingAccounts={billingAccounts}
        billingProject={gcpBillingProject}
        isOwner
        getShowBillingModal={jest.fn()}
        setShowBillingModal={jest.fn()}
        reloadBillingProject={jest.fn()}
        setUpdating={setUpdating}
      />
    );

    // Show menu
    const editSpendReport = screen.getByLabelText('Configure Spend Reporting');
    await user.click(editSpendReport);
    // Enter values in modal
    const datasetIdInput = screen.getByLabelText('Dataset Project ID *');
    await user.type(datasetIdInput, 'test-dataset-id');
    const datasetName = screen.getByLabelText('Dataset Name *');
    await user.type(datasetName, 'test-dataset-name');
    // Save
    const saveButton = screen.getByText('Ok');
    await user.click(saveButton);

    // Assert
    expect(updateSpendConfiguration).toHaveBeenCalledWith({
      billingProjectName: gcpBillingProject.projectName,
      datasetGoogleProject: 'test-dataset-id',
      datasetName: 'test-dataset-name',
    });
    expect(captureEvent).toHaveBeenCalledWith(Events.billingSpendConfigurationUpdated, {
      datasetGoogleProject: 'test-dataset-id',
      datasetName: 'test-dataset-name',
      ...extractBillingDetails(gcpBillingProject),
    });
    expect(setUpdating).toHaveBeenNthCalledWith(1, true);
    expect(setUpdating).toHaveBeenNthCalledWith(2, false);
  });
});
