import '@testing-library/jest-dom'

import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { act } from 'react-dom/test-utils'
import { h } from 'react-hyperscript-helpers'
import { Ajax } from 'src/libs/ajax'
import * as Preferences from 'src/libs/prefs'
import CreateNewBillingProjectWizard, { styles } from 'src/pages/billing/CreateNewBillingProjectWizard'


jest.mock('src/libs/ajax')
jest.spyOn(Preferences, 'getLocalPref')

const getStep1Button = () => screen.getByText('Go to Google Cloud Console')
const getStep2DontHaveBillingAccountButton = () => screen.getByLabelText("I don't have access to a Cloud billing account")
const getStep2HaveBillingAccountButton = () => screen.getByLabelText('I have a billing account')
const getStep3DontHaveAccessButton = () => screen.queryByLabelText("I don't have access to do this")
const getStep3HaveAddedButton = () => screen.queryByLabelText('I have added terra-billing as a billing account user (requires reauthentication)')
const getStep3CheckBox = () => screen.queryByRole('checkbox', { name: 'I have verified the user has been added to my account (requires reauthentication)' })
const textMatcher = text => screen.queryByText((_, node) => {
  const hasText = node => node.textContent === text
  const nodeHasText = hasText(node)
  const childrenDontHaveText = Array.from(node.children).every(
    child => !hasText(child)
  )
  return nodeHasText && childrenDontHaveText
})
const getStep3AddTerraAsUserText = () => textMatcher('Add terra-billing@terra.bio as a Billing Account User to your billing account.')
const getStep3ContactBillingAdministrator = () => textMatcher('Contact your billing account administrator and have them add you and terra-billing@terra.bio as a ' +
  "Billing Account User to your organization's billing account.")

const getStep4CreateButton = () => screen.queryByText('Create Terra Billing Project')
const getBillingProjectInput = () => screen.getByLabelText('Terra billing project *')
const getBillingAccountInput = () => screen.getByLabelText('Select billing account *')
const getStep4RefreshText = () => screen.queryByText('You do not have access to any Google Billing Accounts. Please verify that a billing account ' +
  'has been created in the Google Billing Console and terra-billing@terra.bio has been added as a Billing Account User to your ' +
  'billing account.')
const getStep4RefreshButton = () => screen.queryByText('Refresh Step 3')

const verifyDisabled = item => expect(item).toHaveAttribute('disabled')
const verifyEnabled = item => expect(item).not.toHaveAttribute('disabled')
const verifyChecked = item => expect(item).toBeChecked()
const verifyUnchecked = item => expect(item).not.toBeChecked()

const allSteps = index => screen.getAllByRole('listitem')[index]

const testStep2ButtonsEnabled = () => {
  verifyEnabled(getStep2DontHaveBillingAccountButton())
  verifyEnabled(getStep2HaveBillingAccountButton())
}

const testStep2DontHaveAccessToBillingChecked = () => {
  verifyChecked(getStep2DontHaveBillingAccountButton())
  verifyUnchecked(getStep2HaveBillingAccountButton())
}

const testStep2HaveBillingChecked = () => {
  verifyChecked(getStep2HaveBillingAccountButton())
  verifyUnchecked(getStep2DontHaveBillingAccountButton())
}

const testStep3InitialState = () => {
  verifyDisabled(getStep3DontHaveAccessButton())
  verifyDisabled(getStep3HaveAddedButton())
  verifyUnchecked(getStep3DontHaveAccessButton())
  verifyUnchecked(getStep3HaveAddedButton())
  expect(getStep3AddTerraAsUserText()).not.toBeNull()
  expect(getStep3ContactBillingAdministrator()).toBeNull()
  expect(getStep3CheckBox()).toBeNull()
}

const testStep3RadioButtonsNoneSelected = () => {
  verifyEnabled(getStep3DontHaveAccessButton())
  verifyEnabled(getStep3HaveAddedButton())
  verifyUnchecked(getStep3DontHaveAccessButton())
  verifyUnchecked(getStep3HaveAddedButton())
  expect(getStep3DontHaveAccessButton()).not.toBeNull()
  expect(getStep3HaveAddedButton()).not.toBeNull()
  expect(getStep3CheckBox()).toBeNull()
  expect(getStep3AddTerraAsUserText()).not.toBeNull()
  expect(getStep3ContactBillingAdministrator()).toBeNull()
}

const testStep3Active = () => {
  expect(allSteps(2)).toHaveStyle({ ...styles.stepBanner(true) })
  expect(allSteps(0).getAttribute('aria-current')).toBe('false')
  expect(allSteps(1).getAttribute('aria-current')).toBe('false')
  expect(allSteps(2).getAttribute('aria-current')).toBe('step')
  expect(allSteps(3).getAttribute('aria-current')).toBe('false')
}

const testStep3DontHaveAccessToBillingCheckBox = () => {
  verifyEnabled(getStep3CheckBox())
  expect(getStep3DontHaveAccessButton()).toBeNull()
  expect(getStep3HaveAddedButton()).toBeNull()
  expect(getStep3CheckBox()).not.toBeNull()
  expect(getStep3ContactBillingAdministrator()).not.toBeNull()
  expect(getStep3AddTerraAsUserText()).toBeNull()
}

const testStep4Active = () => {
  expect(allSteps(3)).toHaveStyle({ ...styles.stepBanner(true) })
  expect(allSteps(0).getAttribute('aria-current')).toBe('false')
  expect(allSteps(1).getAttribute('aria-current')).toBe('false')
  expect(allSteps(2).getAttribute('aria-current')).toBe('false')
  expect(allSteps(3).getAttribute('aria-current')).toBe('step')
}

const testStep4Disabled = () => {
  verifyDisabled(getBillingProjectInput())
  expect(getStep4CreateButton()).not.toBeNull()
  verifyDisabled(getBillingAccountInput())
  verifyDisabled(getStep4CreateButton())
  expect(getStep4RefreshText()).toBeNull()
  expect(getStep4RefreshButton()).toBeNull()
}

const testStep4Enabled = () => {
  verifyEnabled(getStep4CreateButton())
  expect(getStep4CreateButton()).not.toBeNull()
  verifyEnabled(getBillingProjectInput())
  verifyEnabled(getBillingAccountInput())
  expect(getStep4RefreshText()).toBeNull()
  expect(getStep4RefreshButton()).toBeNull()
}

const accountName = 'Billing_Account_Name'
const displayName = 'Billing_Account_Display_Name'
const createGCPProject = jest.fn(() => Promise.resolve())

describe('CreateNewBillingProjectWizard Steps', () => {
  let wizardComponent

  beforeEach(() => {
    // Arrange
    Ajax.mockImplementation(() => {
      return {
        Billing: { createGCPProject }
      }
    })

    wizardComponent = render(h(CreateNewBillingProjectWizard, {
      onSuccess: jest.fn(), billingAccounts: [{ accountName, displayName }], authorizeAndLoadAccounts: jest.fn()
    }))
  })

  describe('Initial state', () => {
    // Assert
    it('has Step 1 as the current step', () => {
      expect(allSteps(0)).toHaveStyle({ ...styles.stepBanner(true) })
      expect(allSteps(0).getAttribute('aria-current')).toBe('step')
      expect(allSteps(1).getAttribute('aria-current')).toBe('false')
      expect(allSteps(2).getAttribute('aria-current')).toBe('false')
      expect(allSteps(3).getAttribute('aria-current')).toBe('false')
    })
    it('has Step 1 buttons enabled', () => {
      verifyEnabled(getStep1Button())
      expect(getStep1Button().getAttribute('href')).toBe('https://console.cloud.google.com')
    })
    it('has Step 2 buttons enabled and unchecked', () => {
      testStep2ButtonsEnabled()
      verifyUnchecked(getStep2DontHaveBillingAccountButton())
      verifyUnchecked(getStep2HaveBillingAccountButton())
    })
    it('has the correct initial state for Step 3', () => {
      testStep3InitialState()
    })
    it('has the correct initial state for Step 4', () => {
      testStep4Disabled()
    })
    it('passes accessibility checks in initial state', async () => {
      expect(await axe(wizardComponent.container)).toHaveNoViolations()
    })
  })

  describe('Step 1 Button Clicked', () => {
    // Act
    beforeEach(() => {
      fireEvent.click(getStep1Button())
    })
    // Assert
    it('has Step 2 as the current step', () => {
      expect(allSteps(1)).toHaveStyle({ ...styles.stepBanner(true) })
      expect(allSteps(0).getAttribute('aria-current')).toBe('false')
      expect(allSteps(1).getAttribute('aria-current')).toBe('step')
      expect(allSteps(2).getAttribute('aria-current')).toBe('false')
      expect(allSteps(3).getAttribute('aria-current')).toBe('false')
    })
    it('has Step 2 buttons enabled', () => {
      testStep2ButtonsEnabled()
      verifyUnchecked(getStep2DontHaveBillingAccountButton())
      verifyUnchecked(getStep2HaveBillingAccountButton())
    })
    it('has the correct initial state for Step 3', () => {
      testStep3InitialState()
    })
    it('has the correct initial state for Step 4', () => {
      testStep4Disabled()
    })
  })

  describe('Step 2 Button ("I dont have access to...") Selected', () => {
    // Act
    beforeEach(() => {
      fireEvent.click(getStep2DontHaveBillingAccountButton())
    })
    // Assert
    it('should not change the previous step', () => {
      verifyEnabled(getStep1Button())
    })
    it('has the correct radio button selected ', () => {
      testStep2DontHaveAccessToBillingChecked()
    })
    it('has Step 2 buttons enabled', () => {
      testStep2ButtonsEnabled()
    })
    it('has Step 3 as the current step', () => {
      testStep3Active()
    })
    it('has the correct text and checkbox enabled for Step 3', () => {
      testStep3DontHaveAccessToBillingCheckBox()
    })
    it('has the correct initial state for Step 4', () => {
      testStep4Disabled()
    })
  })


  describe('Step 2 Button ("I have a billing account") Selected', () => {
    // Act
    beforeEach(() => {
      fireEvent.click(getStep2HaveBillingAccountButton())
    })
    // Assert
    it('should not change the previous step', () => {
      verifyEnabled(getStep1Button())
    })
    it('has the correct radio button selected', () => {
      testStep2HaveBillingChecked()
    })
    it('has Step 2 buttons enabled', () => {
      testStep2ButtonsEnabled()
    })
    it('has Step 3 as the current step', () => {
      testStep3Active()
    })
    it('has the correct text and radio buttons enabled for Step 3', () => {
      testStep3RadioButtonsNoneSelected()
    })
    it('has the correct initial state for Step 4', () => {
      testStep4Disabled()
    })
  })

  describe('Step 3 "I have verified" Checkbox Checked', () => {
    beforeEach(async () => {
      // Act
      fireEvent.click(getStep2DontHaveBillingAccountButton())
      await act(async () => {
        await userEvent.click(getStep3CheckBox())
      })
    })
    // Assert
    it('should not change the state of previous steps ', () => {
      verifyEnabled(getStep1Button())
      testStep2DontHaveAccessToBillingChecked()
      testStep2ButtonsEnabled()
    })
    it('has the correct state for Step 3', () => {
      testStep3DontHaveAccessToBillingCheckBox()
      verifyChecked(getStep3CheckBox())
    })
    it('has Step 4 as the current step', () => {
      testStep4Active()
    })
    it('has all fields and button enabled for Step 4', () => {
      testStep4Enabled()
    })
  })

  describe('Step 3 Button ("I dont have access to do this") selected', () => {
    // Act
    beforeEach(async () => {
      fireEvent.click(getStep2HaveBillingAccountButton())
      await act(async () => { await userEvent.click(getStep3DontHaveAccessButton()) })
    })
    // Assert
    it('should not change the state of prior steps ', () => {
      verifyEnabled(getStep1Button())
      testStep2HaveBillingChecked()
      testStep2ButtonsEnabled()
    })
    it('should still have Step 3 as the current step', () => {
      testStep3Active()
    })
    it('should show the correct text and checkbox for Step 3', () => {
      testStep3DontHaveAccessToBillingCheckBox()
    })
    it('should have correct initial state for Step 4', () => {
      testStep4Disabled()
    })
  })

  describe('Step 3 Button ("I have added...") selected', () => {
    // Act
    beforeEach(async () => {
      fireEvent.click(getStep2HaveBillingAccountButton())
      await act(async () => { await userEvent.click(getStep3HaveAddedButton()) })
    })
    // Assert
    it('should not change the state of prior steps', () => {
      verifyEnabled(getStep1Button())
      testStep2ButtonsEnabled()
      testStep2HaveBillingChecked()
      verifyEnabled(getStep3HaveAddedButton())
      verifyEnabled(getStep3DontHaveAccessButton())
    })
    it('should show the correct text and buttons Step 3', () => {
      expect(getStep3DontHaveAccessButton()).not.toBeNull()
      expect(getStep3HaveAddedButton()).not.toBeNull()
      expect(getStep3CheckBox()).toBeNull()
      expect(getStep3AddTerraAsUserText()).not.toBeNull()
      expect(getStep3ContactBillingAdministrator()).toBeNull()
    })
    it('should have the correct button selected for Step 3', () => {
      verifyChecked(getStep3HaveAddedButton())
      verifyUnchecked(getStep3DontHaveAccessButton())
    })
    it('should move to the next step (ActiveStep: Step 4)', () => {
      testStep4Active()
    })
    it('should have all fields and button enabled for Step 4', () => {
      testStep4Enabled()
    })
  })

  describe('Step 4', () => {
    it('tests if Step 4 can create a project given valid inputs', async () => {
      // Arrange
      const projectName = 'Billing_Project_Name'
      // Complete Step 2 and 3
      fireEvent.click(getStep2DontHaveBillingAccountButton())
      await act(async () => { await userEvent.click(getStep3CheckBox()) })

      // Step 4 status
      testStep4Enabled()
      expect(getStep4CreateButton()).not.toBeNull()
      expect(getStep4RefreshText()).toBeNull()
      expect(getStep4RefreshButton()).toBeNull()

      // Insert valid project Name
      await userEvent.type(getBillingProjectInput(), projectName)
      // Select a billing account
      await userEvent.click(getBillingAccountInput())
      const selectOption = await screen.findByText(displayName)
      await userEvent.click(selectOption)

      // Verify accessibility now that all controls are enabled
      expect(await axe(wizardComponent.container)).toHaveNoViolations()

      // Act - Click Create
      await act(async () => {
        await userEvent.click(getStep4CreateButton())
      })
      // Assert
      expect(createGCPProject).toHaveBeenCalledWith(projectName, accountName)
    })
  })
})


describe('Step 4 Warning Message', () => {
  // Arrange
  beforeEach(async () => {
    Ajax.mockImplementation(() => {
      return {
        Billing: { createGCPProject }
      }
    })
    render(h(CreateNewBillingProjectWizard, {
      onSuccess: jest.fn(), billingAccounts: [], authorizeAndLoadAccounts: jest.fn()
    }))

    fireEvent.click(getStep2DontHaveBillingAccountButton())
    await act(async () => { await userEvent.click(getStep3CheckBox()) })
  })

  it('should show a warning message when there are no billing accounts', () => {
    // Assert
    expect(getStep4CreateButton()).toBeNull()
    expect(getStep4RefreshText()).not.toBeNull()
    expect(getStep4RefreshButton()).not.toBeNull()
  })

  it('should show the correct message when refresh step 3 is clicked but there are no billing accounts', async () => {
    // Act
    await act(async () => { await userEvent.click(screen.queryByText('Refresh Step 3')) })
    // Assert
    expect(screen.queryByText('Terra still does not have access to any Google Billing Accounts. ' +
      'Please contact Terra support for additional help.')).not.toBeNull()
    expect(screen.queryByText('Terra support')).not.toBeNull()
  })
})

describe('Changing prior answers', () => {
  beforeEach(() => {
    Ajax.mockImplementation(() => {})
    render(h(CreateNewBillingProjectWizard, {
      onSuccess: jest.fn(), billingAccounts: jest.fn(), authorizeAndLoadAccounts: jest.fn()
    }))
  })

  it('should reset from Step 3 if Step 2 answer is changed (option 1 to 2)', () => {
    // Arrange
    fireEvent.click(getStep2DontHaveBillingAccountButton())
    // Assert
    testStep2DontHaveAccessToBillingChecked()
    testStep3Active()
    testStep3DontHaveAccessToBillingCheckBox()
    // Act
    fireEvent.click(getStep2HaveBillingAccountButton())
    // Assert
    testStep2HaveBillingChecked()
    testStep3Active()
    testStep3RadioButtonsNoneSelected()
  })

  it('should reset from Step 3 if Step 2 answer is changed (option 2 to 1)', () => {
    // Arrange
    fireEvent.click(getStep2HaveBillingAccountButton())
    fireEvent.click(getStep3DontHaveAccessButton())
    // Assert
    testStep2HaveBillingChecked()
    testStep3Active()
    testStep3DontHaveAccessToBillingCheckBox()
    // Act
    fireEvent.click(getStep2DontHaveBillingAccountButton())
    // Assert
    testStep2DontHaveAccessToBillingChecked()
    testStep3DontHaveAccessToBillingCheckBox()
  })

  it('should reset from Step 3 if Step 3 checkbox is unchecked from Step 4', async () => {
    // Act - Check
    fireEvent.click(getStep2DontHaveBillingAccountButton())
    await act(async () => { await userEvent.click(getStep3CheckBox()) })
    // Assert
    testStep2DontHaveAccessToBillingChecked()
    verifyChecked(getStep3CheckBox())
    testStep4Enabled()
    // Act - Uncheck
    await act(async () => { await userEvent.click(getStep3CheckBox()) })
    // Assert
    testStep2DontHaveAccessToBillingChecked()
    verifyUnchecked(getStep3CheckBox())
    testStep3Active()
    testStep4Disabled()
  })

  it('should reset from Step 3 if Step 3 radio button answer is changed from Step 4', async () => {
    // Act - Check
    fireEvent.click(getStep2HaveBillingAccountButton())
    await act(async () => { await userEvent.click(getStep3HaveAddedButton()) })
    // Assert
    testStep2HaveBillingChecked()
    verifyChecked(getStep3HaveAddedButton())
    testStep4Enabled()
    // Act - Uncheck
    fireEvent.click(getStep3DontHaveAccessButton())
    // Assert
    testStep2HaveBillingChecked()
    testStep3DontHaveAccessToBillingCheckBox()
    testStep3Active()
    testStep4Disabled()
  })
})

