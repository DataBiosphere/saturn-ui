import { fireEvent, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import React from 'react';
import {
  addUserAndOwner,
  getAddUsersRadio,
  getNoUsersRadio,
} from 'src/billing/NewBillingProjectWizard/AzureBillingProjectWizard/AddUsersStep.test';
import {
  AzureBillingProjectWizard,
  userInfoListToProjectAccessObjects,
} from 'src/billing/NewBillingProjectWizard/AzureBillingProjectWizard/AzureBillingProjectWizard';
import { selectManagedApp } from 'src/billing/NewBillingProjectWizard/AzureBillingProjectWizard/AzureSubscriptionStep.test';
import {
  clickCreateBillingProject,
  nameBillingProject,
  verifyCreateBillingProjectDisabled,
} from 'src/billing/NewBillingProjectWizard/AzureBillingProjectWizard/CreateNamedProjectStep.test';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { isAnvil } from 'src/libs/brand-utils';
import Events from 'src/libs/events';
import { asMockedFn, partial, renderWithAppContexts as render } from 'src/testing/test-utils';

// Note that mocking is done by selectManagedApp (as well as default mocking in setUp).
jest.mock('src/libs/ajax/billing/Billing');
jest.mock('src/libs/ajax/Metrics');

type BrandUtilsExports = typeof import('src/libs/brand-utils');
jest.mock('src/libs/brand-utils', (): BrandUtilsExports => {
  return {
    ...jest.requireActual<BrandUtilsExports>('src/libs/brand-utils'),
    isAnvil: jest.fn().mockReturnValue(false),
  };
});

type ReactUtilsExports = typeof import('src/libs/react-utils');
jest.mock('src/libs/react-utils', (): ReactUtilsExports => {
  const actual = jest.requireActual<ReactUtilsExports>('src/libs/react-utils');
  return {
    ...actual,
    useDebouncedValue: (value) => value,
  };
});

describe('transforming user info to the request object', () => {
  it('splits lists of emails and maps them to roles', () => {
    const emailList = 'a@b.com, b@c.com';
    const result = userInfoListToProjectAccessObjects(emailList, 'User');

    expect(result).toHaveLength(2);
    expect(result[0].role).toEqual('User');
    expect(result[0].email).toEqual('a@b.com');
    expect(result[1].role).toEqual('User');
    expect(result[1].email).toEqual('b@c.com');

    // Empty emails returns an empty array
    expect(userInfoListToProjectAccessObjects('', 'User')).toHaveLength(0);
  });
});

const testStepActive = (stepNumber) => {
  screen.queryAllByRole('listitem').forEach((step, index) => {
    if (index === stepNumber - 1) {
      expect(step.getAttribute('aria-current')).toBe('step');
    } else {
      expect(step.getAttribute('aria-current')).toBe('false');
    }
  });
};

describe('AzureBillingProjectWizard', () => {
  let renderResult;
  const onSuccess = jest.fn();
  const captureEvent = jest.fn();

  const getProtectedDataRadio = () =>
    screen.getByLabelText('Yes, set up my environment with additional security monitoring');
  const getNoProtectedDataRadio = () => screen.getByLabelText('No');

  const setup = () => {
    asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent }));

    renderResult = render(<AzureBillingProjectWizard onSuccess={onSuccess} />);
  };

  it('should not fail any accessibility tests in initial state', async () => {
    setup();

    expect(await axe(renderResult.container)).toHaveNoViolations();
  });

  it('should support happy path of submitting with no users/owners and without protected data', async () => {
    // Integration test of steps (act/arrange/assert not really possible)
    setup();

    const createAzureProject = jest.fn().mockResolvedValue({});
    const billingProjectName = 'LotsOfCash';

    testStepActive(1);
    const managedApp = await selectManagedApp(captureEvent, createAzureProject);

    testStepActive(2);
    fireEvent.click(getNoProtectedDataRadio());

    testStepActive(3);
    fireEvent.click(getNoUsersRadio());

    testStepActive(4);
    verifyCreateBillingProjectDisabled();
    await nameBillingProject(billingProjectName);

    await clickCreateBillingProject();
    expect(createAzureProject).toBeCalledWith(
      billingProjectName,
      managedApp.tenantId,
      managedApp.subscriptionId,
      managedApp.managedResourceGroupId,
      [],
      false
    );

    expect(captureEvent).toHaveBeenNthCalledWith(1, Events.billingAzureCreationSubscriptionStep);
    expect(captureEvent).toHaveBeenNthCalledWith(2, Events.billingAzureCreationMRGSelected);
    expect(captureEvent).toHaveBeenNthCalledWith(3, Events.billingAzureCreationProtectedDataNotSelected);
    expect(captureEvent).toHaveBeenNthCalledWith(4, Events.billingAzureCreationNoUsersToAdd);
    expect(captureEvent).toHaveBeenNthCalledWith(5, Events.billingAzureCreationProjectNameStep);
    expect(captureEvent).toHaveBeenCalledTimes(5);
    expect(onSuccess).toBeCalledWith(billingProjectName, false);
  });

  it('should support happy path of submitting with owners and users and protected data', async () => {
    // Integration test of steps (act/arrange/assert not really possible)
    setup();

    const createAzureProject = jest.fn().mockResolvedValue({ ok: true });
    const billingProjectName = 'LotsOfCashForAll';

    testStepActive(1);
    const managedApp = await selectManagedApp(captureEvent, createAzureProject);

    testStepActive(2);
    fireEvent.click(getProtectedDataRadio());

    testStepActive(3);
    fireEvent.click(getAddUsersRadio());
    addUserAndOwner('onlyuser@example.com', 'owner@example.com');
    testStepActive(3); // Have to click in billing project input to become the active step

    verifyCreateBillingProjectDisabled();
    await nameBillingProject(billingProjectName);
    testStepActive(4);

    expect(await axe(renderResult.container)).toHaveNoViolations();
    await clickCreateBillingProject();
    expect(createAzureProject).toBeCalledWith(
      billingProjectName,
      managedApp.tenantId,
      managedApp.subscriptionId,
      managedApp.managedResourceGroupId,
      [
        { email: 'onlyuser@example.com', role: 'User' },
        { email: 'owner@example.com', role: 'Owner' },
      ],
      true
    );

    expect(captureEvent).toHaveBeenNthCalledWith(1, Events.billingAzureCreationSubscriptionStep);
    expect(captureEvent).toHaveBeenNthCalledWith(2, Events.billingAzureCreationMRGSelected);
    expect(captureEvent).toHaveBeenNthCalledWith(3, Events.billingAzureCreationProtectedDataSelected);
    expect(captureEvent).toHaveBeenNthCalledWith(4, Events.billingAzureCreationWillAddUsers);
    expect(captureEvent).toHaveBeenNthCalledWith(5, Events.billingAzureCreationProjectNameStep);
    expect(captureEvent).toHaveBeenCalledTimes(5);
    expect(onSuccess).toBeCalledWith(billingProjectName, true);
  });

  it('shows error if billing project already exists with the name', async () => {
    // Integration test of steps (act/arrange/assert not really possible)
    setup();

    const createAzureProject = jest.fn().mockRejectedValue({ status: 409 });
    const billingProjectName = 'ProjectNameInUse';

    const managedApp = await selectManagedApp(captureEvent, createAzureProject);
    fireEvent.click(getNoProtectedDataRadio());
    fireEvent.click(getNoUsersRadio());
    verifyCreateBillingProjectDisabled();
    await nameBillingProject(billingProjectName);
    await clickCreateBillingProject();
    expect(createAzureProject).toBeCalledWith(
      billingProjectName,
      managedApp.tenantId,
      managedApp.subscriptionId,
      managedApp.managedResourceGroupId,
      [],
      false
    );
    await screen.findByText('Billing project name already exists');
    verifyCreateBillingProjectDisabled();
    expect(onSuccess).not.toBeCalled();
    expect(captureEvent).toHaveBeenCalledWith(Events.billingAzureCreationProjectCreateFail, { existingName: true });
    expect(await axe(renderResult.container)).toHaveNoViolations();
  });

  it('shows error if there is no billing project name or name is badly formatted', async () => {
    setup();

    const nameRequiredText = 'A name is required to create a billing project.';
    const tooShortText = 'Billing project name is too short (minimum is 6 characters)';

    // Blank name allowed initially
    expect(screen.queryByText(nameRequiredText)).toBeNull();
    expect(screen.queryByText(tooShortText)).toBeNull();

    await nameBillingProject('b a d');
    await screen.findByText(tooShortText);
    await screen.findByText('Billing project name can only contain letters, numbers, underscores and hyphens.');

    await nameBillingProject('');
    await screen.findByText(nameRequiredText);
    expect(screen.queryByText(tooShortText)).toBeNull();
  });

  it.each([true, false])('shows a notice about region on AnVIL branded site', (isAnvilBrandedSite) => {
    // Arrange/Act
    asMockedFn(isAnvil).mockReturnValue(isAnvilBrandedSite);
    setup();

    // Assert
    const isNoticeShown = !!screen.queryByText(
      'Working with NHGRI data on Azure? Set up your Terra Managed Application in the South Central US region to reduce egress costs.'
    );
    expect(isNoticeShown).toBe(isAnvilBrandedSite);
  });
});
