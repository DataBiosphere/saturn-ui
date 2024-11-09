import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import React from 'react';
import GCPBillingProjectWizard from 'src/billing/NewBillingProjectWizard/GCPBillingProjectWizard/GCPBillingProjectWizard';
import { Billing, BillingContract } from 'src/libs/ajax/billing/Billing';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import Events from 'src/libs/events';
import * as Preferences from 'src/libs/prefs';
import { asMockedFn, MockedFn, partial, renderWithAppContexts as render } from 'src/testing/test-utils';

jest.mock('src/libs/ajax/billing/Billing');
jest.mock('src/libs/ajax/Metrics');

jest.spyOn(Preferences, 'getLocalPref');

function expectNotNull<T>(value: T | null): T {
  expect(value).not.toBeNull();
  return value as T;
}

const getStep1Button = () => screen.getByText('Go to Google Cloud Console');
const getStep2BillingAccountNoAccessButton = () =>
  screen.getByLabelText("I don't have access to a Cloud billing account");
const getStep2HaveBillingAccountButton = () => screen.getByLabelText('I have a billing account');
const getStep3BillingAccountNoAccessButton = () => screen.queryByLabelText("I don't have access to do this");
const getStep3AddedTerraBillingButton = () =>
  screen.queryByLabelText('I have added terra-billing as a billing account user (requires reauthentication)');
const getStep3VerifyUserAdded = () =>
  screen.queryByRole('checkbox', {
    name: 'I have verified the user has been added to my account (requires reauthentication)',
  });
const textMatcher = (text) =>
  screen.queryByText((_, node) => {
    const hasText = (node) => node.textContent === text;
    const nodeHasText = hasText(node);
    const childrenDontHaveText = Array.from(node?.children || []).every((child) => !hasText(child));
    return nodeHasText && childrenDontHaveText;
  });
const getStep3AddTerraAsUserText = () =>
  textMatcher('Add terra-billing@terra.bio as a Billing Account User to your billing account.');
const getStep3ContactBillingAdministrator = () =>
  textMatcher(
    'Contact your billing account administrator and have them add you and terra-billing@terra.bio as a ' +
      "Billing Account User to your organization's billing account."
  );

const getStep4CreateButton = () => screen.queryByRole('button', { name: 'Create Terra Billing Project' });
const getBillingProjectInput = () => screen.getByLabelText('Terra billing project *');
const getBillingAccountInput = () => screen.getByLabelText('Select billing account *');
const getStep4RefreshText = () =>
  screen.queryByText(
    'You do not have access to any Google Billing Accounts. Please verify that a billing account ' +
      'has been created in the Google Billing Console and terra-billing@terra.bio has been added as a Billing Account User to your ' +
      'billing account.'
  );
const getStep4RefreshButton = () => screen.queryByText('Refresh Step 3');

const verifyDisabled = (item) => expect(item).toHaveAttribute('disabled');
const verifyEnabled = (item) => expect(item).not.toHaveAttribute('disabled');
const verifyChecked = (item) => expect(item).toBeChecked();
const verifyUnchecked = (item) => expect(item).not.toBeChecked();

const testStepActive = (stepNumber) => {
  screen.queryAllByRole('listitem').forEach((step, index) => {
    if (index === stepNumber - 1) {
      expect(step.getAttribute('aria-current')).toBe('step');
    } else {
      expect(step.getAttribute('aria-current')).toBe('false');
    }
  });
};

const testStep2ButtonsEnabled = () => {
  verifyEnabled(getStep2BillingAccountNoAccessButton());
  verifyEnabled(getStep2HaveBillingAccountButton());
};

const testStep2DontHaveAccessToBillingChecked = () => {
  verifyChecked(getStep2BillingAccountNoAccessButton());
  verifyUnchecked(getStep2HaveBillingAccountButton());
};

const testStep2HaveBillingChecked = () => {
  verifyChecked(getStep2HaveBillingAccountButton());
  verifyUnchecked(getStep2BillingAccountNoAccessButton());
};

// check that the default happy path is rendered
const testAddTerraUserRenderedForStep3 = () => {
  // checking that the alternate component is not rendered
  expect(getStep3VerifyUserAdded()).toBeNull();
  expect(getStep3ContactBillingAdministrator()).toBeNull();
  // checking that the correct component is rendered
  expect(getStep3BillingAccountNoAccessButton()).not.toBeNull();
  expect(getStep3AddedTerraBillingButton()).not.toBeNull();
  expect(getStep3AddTerraAsUserText()).not.toBeNull();
};

const testAddTerraUserStep3UninitializedState = () => {
  verifyDisabled(getStep3BillingAccountNoAccessButton());
  verifyUnchecked(getStep3BillingAccountNoAccessButton());
  verifyDisabled(getStep3AddedTerraBillingButton());
  verifyUnchecked(getStep3AddedTerraBillingButton());
};

const testStep3RadioButtonsNoneSelected = () => {
  verifyEnabled(getStep3BillingAccountNoAccessButton());
  verifyEnabled(getStep3AddedTerraBillingButton());
  verifyUnchecked(getStep3BillingAccountNoAccessButton());
  verifyUnchecked(getStep3AddedTerraBillingButton());
  expect(getStep3BillingAccountNoAccessButton()).not.toBeNull();
  expect(getStep3AddedTerraBillingButton()).not.toBeNull();
  expect(getStep3AddTerraAsUserText()).not.toBeNull();
  // the next two asserts don't necessarily belong logically,
  // but the components that are checked will never be rendered when the ones above are present
  // so it makes sense to leave them here
  expect(getStep3VerifyUserAdded()).toBeNull();
  expect(getStep3ContactBillingAdministrator()).toBeNull();
};

const testStep3DontHaveAccessToBillingCheckBox = () => {
  verifyEnabled(getStep3VerifyUserAdded());
  expect(getStep3BillingAccountNoAccessButton()).toBeNull();
  expect(getStep3AddedTerraBillingButton()).toBeNull();
  expect(getStep3VerifyUserAdded()).not.toBeNull();
  expect(getStep3ContactBillingAdministrator()).not.toBeNull();
  expect(getStep3AddTerraAsUserText()).toBeNull();
};

const testStep4Disabled = () => {
  verifyDisabled(getBillingProjectInput());
  expect(getStep4CreateButton()).not.toBeNull();
  verifyDisabled(getBillingAccountInput());
  verifyDisabled(getStep4CreateButton());
  expect(getStep4RefreshText()).toBeNull();
  expect(getStep4RefreshButton()).toBeNull();
};

const testStep4Enabled = () => {
  verifyEnabled(getStep4CreateButton());
  expect(getStep4CreateButton()).not.toBeNull();
  verifyEnabled(getBillingProjectInput());
  verifyEnabled(getBillingAccountInput());
  expect(getStep4RefreshText()).toBeNull();
  expect(getStep4RefreshButton()).toBeNull();
};

const accountName = 'Billing_Account_Name';
const displayName = 'Billing_Account_Display_Name';

const createGCPProject: MockedFn<BillingContract['createGCPProject']> = jest.fn();
createGCPProject.mockResolvedValue(new Response('', { status: 201 }));

const captureEvent: MockedFn<MetricsContract['captureEvent']> = jest.fn();

describe('GCPBillingProjectWizard Steps', () => {
  let wizardComponent;

  beforeEach(() => {
    jest.resetAllMocks();

    // Arrange
    asMockedFn(Billing).mockReturnValue(partial<BillingContract>({ createGCPProject }));
    asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent }));

    wizardComponent = render(
      <GCPBillingProjectWizard
        onSuccess={jest.fn()}
        billingAccounts={{ accountName: { accountName, displayName } }}
        authorizeAndLoadAccounts={jest.fn()}
      />
    );
  });

  describe('Initial state', () => {
    // Assert
    it('has Step 1 as the current step', () => {
      testStepActive(1);
    });
    it('has Step 1 buttons enabled', () => {
      verifyEnabled(getStep1Button());
      expect(getStep1Button().getAttribute('href')).toBe('https://console.cloud.google.com');
    });
    it('has Step 2 buttons enabled and unchecked', () => {
      testStep2ButtonsEnabled();
      verifyUnchecked(getStep2BillingAccountNoAccessButton());
      verifyUnchecked(getStep2HaveBillingAccountButton());
    });
    it('has the correct initial state for Step 3', () => {
      testAddTerraUserRenderedForStep3();
      testAddTerraUserStep3UninitializedState();
    });
    it('has the correct initial state for Step 4', () => {
      testStep4Disabled();
    });
    it('passes accessibility checks in initial state', async () => {
      expect(await axe(wizardComponent.container)).toHaveNoViolations();
    });
  });

  describe('Step 1 Button Clicked', () => {
    // Act
    beforeEach(() => {
      fireEvent.click(getStep1Button());
      expect(captureEvent).toHaveBeenCalledWith(Events.billingGCPCreationStep1);
    });
    // Assert
    it('has Step 2 as the current step', () => {
      testStepActive(2);
    });
    it('has Step 2 buttons enabled', () => {
      testStep2ButtonsEnabled();
      verifyUnchecked(getStep2BillingAccountNoAccessButton());
      verifyUnchecked(getStep2HaveBillingAccountButton());
    });
    it('has the correct initial state for Step 3', () => {
      testAddTerraUserRenderedForStep3();
      testAddTerraUserStep3UninitializedState();
    });
    it('has the correct initial state for Step 4', () => {
      testStep4Disabled();
    });
  });

  describe('Step 2 Button ("I dont have access to...") Selected', () => {
    // Act
    beforeEach(() => {
      fireEvent.click(getStep2BillingAccountNoAccessButton());
      expect(captureEvent).toHaveBeenCalledWith(Events.billingGCPCreationStep2BillingAccountNoAccess);
    });
    // Assert
    it('should not change the previous step', () => {
      verifyEnabled(getStep1Button());
    });
    it('has the correct radio button selected ', () => {
      testStep2DontHaveAccessToBillingChecked();
    });
    it('has Step 2 buttons enabled', () => {
      testStep2ButtonsEnabled();
    });
    it('has Step 3 as the current step', () => {
      testStepActive(3);
    });
    it('has the correct text and checkbox enabled for Step 3', () => {
      testStep3DontHaveAccessToBillingCheckBox();
    });
    it('has the correct initial state for Step 4', () => {
      testStep4Disabled();
    });
  });

  describe('Step 2 Button ("I have a billing account") Selected', () => {
    // Act
    beforeEach(() => {
      fireEvent.click(getStep2HaveBillingAccountButton());
      expect(captureEvent).toHaveBeenCalledWith(Events.billingGCPCreationStep2HaveBillingAccount);
    });
    // Assert
    it('should not change the previous step', () => {
      verifyEnabled(getStep1Button());
    });
    it('has the correct radio button selected', () => {
      testStep2HaveBillingChecked();
    });
    it('has Step 2 buttons enabled', () => {
      testStep2ButtonsEnabled();
    });
    it('has Step 3 as the current step', () => {
      testStepActive(3);
    });
    it('has the correct text and radio buttons enabled for Step 3', () => {
      testStep3RadioButtonsNoneSelected();
    });
    it('has the correct initial state for Step 4', () => {
      testStep4Disabled();
    });
  });

  describe('Step 3 "I have verified" Checkbox Checked', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      // Act
      await user.click(getStep2BillingAccountNoAccessButton());
      await user.click(expectNotNull(getStep3VerifyUserAdded()));
      expect(captureEvent).toHaveBeenCalledWith(Events.billingGCPCreationStep3VerifyUserAdded);
    });
    // Assert
    it('should not change the state of previous steps ', () => {
      verifyEnabled(getStep1Button());
      testStep2DontHaveAccessToBillingChecked();
      testStep2ButtonsEnabled();
    });
    it('has the correct state for Step 3', () => {
      testStep3DontHaveAccessToBillingCheckBox();
      verifyChecked(getStep3VerifyUserAdded());
    });
    it('has Step 4 as the current step', () => {
      testStepActive(4);
    });
    it('has all fields and button enabled for Step 4', () => {
      testStep4Enabled();
    });
  });

  describe('Step 3 Button ("I dont have access to do this") selected', () => {
    // Act
    beforeEach(async () => {
      const user = userEvent.setup();
      await user.click(getStep2HaveBillingAccountButton());
      await user.click(expectNotNull(getStep3BillingAccountNoAccessButton()));
      expect(captureEvent).toHaveBeenCalledWith(Events.billingGCPCreationStep3BillingAccountNoAccess);
    });
    // Assert
    it('should not change the state of prior steps ', () => {
      verifyEnabled(getStep1Button());
      testStep2HaveBillingChecked();
      testStep2ButtonsEnabled();
    });
    it('should still have Step 3 as the current step', () => {
      testStepActive(3);
    });
    it('should show the correct text and checkbox for Step 3', () => {
      testStep3DontHaveAccessToBillingCheckBox();
    });
    it('should have correct initial state for Step 4', () => {
      testStep4Disabled();
    });
  });

  describe('Step 3 Button ("I have added...") selected', () => {
    // Act
    beforeEach(async () => {
      const user = userEvent.setup();
      await user.click(getStep2HaveBillingAccountButton());
      await user.click(expectNotNull(getStep3AddedTerraBillingButton()));
      expect(captureEvent).toHaveBeenCalledWith(Events.billingGCPCreationStep3AddedTerraBilling);
    });
    // Assert
    it('should not change the state of prior steps', () => {
      verifyEnabled(getStep1Button());
      testStep2ButtonsEnabled();
      testStep2HaveBillingChecked();
      verifyEnabled(getStep3AddedTerraBillingButton());
      verifyEnabled(getStep3BillingAccountNoAccessButton());
    });
    it('should show the correct text and buttons Step 3', () => {
      expect(getStep3BillingAccountNoAccessButton()).not.toBeNull();
      expect(getStep3AddedTerraBillingButton()).not.toBeNull();
      expect(getStep3VerifyUserAdded()).toBeNull();
      expect(getStep3AddTerraAsUserText()).not.toBeNull();
      expect(getStep3ContactBillingAdministrator()).toBeNull();
    });
    it('should have the correct button selected for Step 3', () => {
      verifyChecked(getStep3AddedTerraBillingButton());
      verifyUnchecked(getStep3BillingAccountNoAccessButton());
    });
    it('should move to the next step (ActiveStep: Step 4)', () => {
      testStepActive(4);
    });
    it('should have all fields and button enabled for Step 4', () => {
      testStep4Enabled();
    });
  });

  describe('Step 4', () => {
    it('tests if Step 4 can create a project given valid inputs', async () => {
      // Arrange
      const user = userEvent.setup();
      const projectName = 'Billing_Project_Name';
      // Complete Step 2 and 3
      await user.click(getStep2BillingAccountNoAccessButton());
      await user.click(expectNotNull(getStep3VerifyUserAdded()));

      // Step 4 status
      testStep4Enabled();
      expect(getStep4CreateButton()).not.toBeNull();
      expect(getStep4RefreshText()).toBeNull();
      expect(getStep4RefreshButton()).toBeNull();

      // Insert valid project Name
      await user.type(getBillingProjectInput(), projectName);
      expect(captureEvent).toHaveBeenCalledWith(Events.billingCreationGCPProjectNameEntered);
      // Select a billing account
      await user.click(getBillingAccountInput());
      const selectOption = await screen.findByText(displayName);
      await user.click(selectOption);
      expect(captureEvent).toHaveBeenCalledWith(Events.billingCreationGCPBillingAccountSelected);

      // Verify accessibility now that all controls are enabled
      expect(await axe(wizardComponent.container)).toHaveNoViolations();

      // Act - Click Create
      await user.click(expectNotNull(getStep4CreateButton()));
      // Assert
      expect(createGCPProject).toHaveBeenCalledWith(projectName, accountName);
    });
  });
});

describe('Step 4 Warning Message', () => {
  // Arrange
  beforeEach(async () => {
    asMockedFn(Billing).mockReturnValue(partial<BillingContract>({ createGCPProject }));
    asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent }));

    render(<GCPBillingProjectWizard onSuccess={jest.fn()} billingAccounts={{}} authorizeAndLoadAccounts={jest.fn()} />);

    const user = userEvent.setup();
    await user.click(getStep2BillingAccountNoAccessButton());
    await user.click(expectNotNull(getStep3VerifyUserAdded()));
  });

  it('should show a warning message when there are no billing accounts', () => {
    // Assert
    expect(getStep4CreateButton()).toBeNull();
    expect(getStep4RefreshText()).not.toBeNull();
    expect(getStep4RefreshButton()).not.toBeNull();
  });

  it('should show the correct message when refresh step 3 is clicked but there are no billing accounts', async () => {
    // Act
    const user = userEvent.setup();
    await user.click(expectNotNull(screen.queryByText('Refresh Step 3')));
    expect(captureEvent).toHaveBeenCalledWith(Events.billingGCPCreationRefreshStep3);
    // Assert
    expect(
      screen.queryByText(
        'Terra still does not have access to any Google Billing Accounts. ' +
          'Please contact Terra support for additional help.'
      )
    ).not.toBeNull();
    expect(screen.queryByText('Terra support')).not.toBeNull();
    fireEvent.click(expectNotNull(screen.queryByText('Terra support')));
    expect(captureEvent).toHaveBeenCalledWith(Events.billingCreationContactTerraSupport);
  });
});

describe('Changing prior answers', () => {
  beforeEach(() => {
    asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent }));

    render(
      <GCPBillingProjectWizard
        onSuccess={jest.fn()}
        billingAccounts={{ accountName: { accountName, displayName } }}
        authorizeAndLoadAccounts={jest.fn()}
      />
    );
  });

  it('should reset from Step 3 if Step 2 answer is changed (option 1 to 2)', () => {
    // Arrange
    fireEvent.click(getStep2BillingAccountNoAccessButton());
    // Assert
    testStep2DontHaveAccessToBillingChecked();
    testStepActive(3);
    testStep3DontHaveAccessToBillingCheckBox();
    // Act
    fireEvent.click(getStep2HaveBillingAccountButton());
    // Assert
    testStep2HaveBillingChecked();
    testStepActive(3);
    testStep3RadioButtonsNoneSelected();
  });

  it('should reset from Step 3 if Step 2 answer is changed (option 2 to 1)', () => {
    // Arrange
    fireEvent.click(getStep2HaveBillingAccountButton());
    fireEvent.click(expectNotNull(getStep3BillingAccountNoAccessButton()));
    // Assert
    testStep2HaveBillingChecked();
    testStepActive(3);
    testStep3DontHaveAccessToBillingCheckBox();
    // Act
    fireEvent.click(getStep2BillingAccountNoAccessButton());
    // Assert
    testStep2DontHaveAccessToBillingChecked();
    testStep3DontHaveAccessToBillingCheckBox();
  });

  it('should reset from Step 3 if Step 3 checkbox is unchecked from Step 4', async () => {
    const user = userEvent.setup();
    // Act - Check
    await user.click(getStep2BillingAccountNoAccessButton());
    await user.click(expectNotNull(getStep3VerifyUserAdded()));
    // Assert
    testStep2DontHaveAccessToBillingChecked();
    verifyChecked(getStep3VerifyUserAdded());
    testStep4Enabled();
    // Act - Uncheck
    await user.click(expectNotNull(getStep3VerifyUserAdded()));
    // Assert
    testStep2DontHaveAccessToBillingChecked();
    verifyUnchecked(getStep3VerifyUserAdded());
    testStepActive(3);
    testStep4Disabled();
  });

  it('should reset from Step 3 if Step 3 radio button answer is changed from Step 4', async () => {
    const user = userEvent.setup();
    // Act - Check
    await user.click(getStep2HaveBillingAccountButton());
    await user.click(expectNotNull(getStep3AddedTerraBillingButton()));
    // Assert
    testStep2HaveBillingChecked();
    verifyChecked(getStep3AddedTerraBillingButton());

    testStep4Enabled();
    // Act - Uncheck
    fireEvent.click(expectNotNull(getStep3BillingAccountNoAccessButton()));
    // Assert
    testStep2HaveBillingChecked();

    testStep3DontHaveAccessToBillingCheckBox();
    testStepActive(3);
    testStep4Disabled();
  });
});
