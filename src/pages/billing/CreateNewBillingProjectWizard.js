import _ from 'lodash/fp'
import { useEffect, useState } from 'react'
import { div, fieldset, h, h2, h3, legend, li, p, span, ul } from 'react-hyperscript-helpers'
import { ButtonPrimary, Clickable, LabeledCheckbox, Link, RadioButton } from 'src/components/common'
import { icon } from 'src/components/icons'
import SupportRequestWrapper from 'src/components/SupportRequest'
import { Ajax } from 'src/libs/ajax'
import colors from 'src/libs/colors'
import { reportErrorAndRethrow } from 'src/libs/error'
import { getLocalPref, setLocalPref } from 'src/libs/prefs'
import { contactUsActive } from 'src/libs/state'
import * as Utils from 'src/libs/utils'
import CreateGCPBillingProject from 'src/pages/billing/CreateGCPBillingProject'


export const styles = {
  stepBanner: active => {
    return {
      borderRadius: '8px', boxSizing: 'border-box',
      padding: '1.5rem 2rem',
      marginTop: '1rem',
      display: 'flex',
      border: active ? `1px solid ${colors.accent()}` : `1px solid ${colors.accent(0.2)}`,
      backgroundColor: active ? colors.light(0.5) : colors.light(0.3),
      boxShadow: active ? '0 0 5px 0 rgba(77,114,170,0.5)' : 'none'
    }
  },
  radioButtonLabel: {
    marginLeft: '1rem', color: colors.accent(), fontWeight: 500, lineHeight: '22px'
  },
  accentColor: colors.accent()
}

const CreateNewBillingProjectWizard = ({ onSuccess, billingAccounts, authorizeAndLoadAccounts }) => {
  const persistenceId = 'billing'
  const [accessToBillingAccount, setAccessToBillingAccount] = useState(() => getLocalPref(persistenceId)?.accessToBillingAccount)
  const [accessToAddBillingAccountUser, setAccessToAddBillingAccountUser] = useState(() => getLocalPref(persistenceId)?.accessToAddBillingAccountUser)
  const [verified, setVerified] = useState(() => getLocalPref(persistenceId)?.verified || false)
  const [billingProjectName, setBillingProjectName] = useState('')
  const [chosenBillingAccount, setChosenBillingAccount] = useState('')
  const [refreshed, setRefreshed] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [existing, setExisting] = useState([])
  const [activeStep, setActiveStep] = useState(() => getLocalPref(persistenceId)?.activeStep || 1)

  useEffect(() => {
    setLocalPref(persistenceId, { activeStep, accessToBillingAccount, verified, accessToAddBillingAccountUser })
  }, [persistenceId, activeStep, accessToBillingAccount, verified, accessToAddBillingAccountUser])

  const next = () => {
    setActiveStep(activeStep + 1)
  }

  const resetStep3 = () => {
    setActiveStep(3)
    setAccessToAddBillingAccountUser(undefined)
    setVerified(false)
    setRefreshed(false)
  }

  const submit = _.flow(
    reportErrorAndRethrow('Error creating billing project'),
    Utils.withBusyState(setIsBusy)
  )(async () => {
    try {
      await Ajax().Billing.createGCPProject(billingProjectName, chosenBillingAccount.accountName)
      onSuccess(billingProjectName)
    } catch (error) {
      if (error.status === 409) {
        setExisting(_.concat(billingProjectName, existing))
      } else {
        throw error
      }
    }
  })

  const step1 = () => {
    const isActive = activeStep === 1
    const isDone = activeStep > 1

    return li({
      'aria-current': isActive ? 'step' : false,
      style: { ...styles.stepBanner(isActive), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }
    }, [
      div({ style: { maxWidth: '60%' } }, [
        h3({ style: { fontSize: 18, marginTop: 0 } }, ['STEP 1']),
        span({ style: { fontSize: 14, lineHeight: '22px', whiteSpace: 'pre-wrap' } },
          ['Go to the Google Cloud Platform Billing Console and sign-in with the same user you use to login to Terra.'])
      ]),
      h(Clickable, {
        style: {
          color: styles.accentColor, backgroundColor: 'none', border: `1px solid ${styles.accentColor}`,
          paddingInline: '1.5rem', display: 'inline-flex', justifyContent: 'space-around', alignItems: 'center',
          height: '2.5rem', fontWeight: 500, fontSize: 14, borderRadius: 2, whiteSpace: 'nowrap',
          marginLeft: '2rem', textTransform: 'none'
        },
        href: 'https://console.cloud.google.com',
        ...Utils.newTabLinkProps,
        onClick: () => {
          if (!isDone) {
            next()
          }
        }
      }, ['Go to Google Cloud Console'])
    ])
  }

  const step2 = () => {
    const isActive = activeStep === 2
    const isDone = activeStep > 2

    const setNextStep = accessToBilling => {
      setAccessToBillingAccount(accessToBilling)
      if (activeStep === 1) {
        setActiveStep(3)
      } else if (isDone) {
        resetStep3()
      } else {
        next()
      }
    }

    return li({ 'aria-current': isActive ? 'step' : false, style: { ...styles.stepBanner(isActive), flexDirection: 'column' } }, [
      h3({ style: { fontSize: 18, marginTop: 0 } }, ['STEP 2']),
      fieldset({ style: { border: 'none', margin: 0, padding: 0, display: 'block' } }, [
        legend({ style: { maxWidth: '55%', fontSize: 14, lineHeight: '22px', whiteSpace: 'pre-wrap', marginTop: '0.25rem', float: 'left' } },
          ['Select an existing billing account or create a new one.\n\nIf you are creating a new billing account, you may be eligible for $300 in free credits. ' +
          'Follow the instructions to activate your account in the Google Cloud Console.']),
        div({ style: { width: '25%', float: 'right' } }, [
          div({ style: { display: 'flex', displayDirection: 'row' } }, [
            h(RadioButton, {
              text: "I don't have access to a Cloud billing account", name: 'access-to-account',
              checked: accessToBillingAccount === false,
              labelStyle: { ...styles.radioButtonLabel },
              onChange: () => {
                setNextStep(false)
              }
            })
          ]),
          div({ style: { marginTop: '2rem', display: 'flex', displayDirection: 'row' } }, [
            h(RadioButton, {
              text: 'I have a billing account', name: 'access-to-account',
              checked: accessToBillingAccount === true,
              labelStyle: { ...styles.radioButtonLabel },
              onChange: () => {
                setNextStep(true)
              }
            })
          ])
        ])
      ])
    ])
  }

  const step3 = () => {
    const isActive = activeStep === 3
    const isDone = activeStep > 3

    const linkToSupport =
        h(Link, {
          ...Utils.newTabLinkProps, style: { textDecoration: 'underline', color: styles.accentColor },
          href: 'https://support.terra.bio/hc/en-us/articles/360026182251'
        }, [
          'Learn how to set up a Google Cloud Billing account'
        ])

    const checkbox =
      div({ style: { width: '25%', float: 'right' } }, [
        h(LabeledCheckbox, {
          checked: verified === true,
          onChange: async () => {
            if (isDone) {
              resetStep3()
            } else {
              await authorizeAndLoadAccounts()
              setVerified(true)
              next()
            }
          }
        }, [
          p({ style: { ...styles.radioButtonLabel, marginLeft: '2rem', marginTop: '-1.3rem' } }, [
            'I have verified the user has been added to my account (requires reauthentication)'
          ])
        ])
      ])

    const addTerraAsBillingAccountUser =
      fieldset({ style: { border: 'none', margin: 0, padding: 0, display: 'block' } }, [
        legend({ style: { maxWidth: '60%', fontSize: 14, lineHeight: '22px', whiteSpace: 'pre-wrap', marginTop: '0.25rem', float: 'left' } },
          [span({ style: { fontSize: 14, lineHeight: '22px', whiteSpace: 'pre-wrap' } },
            ['Add ', span({ style: { fontWeight: 'bold' } }, 'terra-billing@terra.bio'), ' as a Billing Account User',
              span({ style: { fontWeight: 'bold' } }, ' to your billing account.')]),
          div({ style: { marginTop: '3rem' } }, [linkToSupport])]),
        div({ style: { width: '25%', float: 'right' } }, [
          div({ style: { display: 'flex', displayDirection: 'row' } }, [
            h(RadioButton, {
              text: "I don't have access to do this", name: 'permission',
              checked: accessToAddBillingAccountUser === false,
              disabled: !isDone && !isActive,
              labelStyle: { ...styles.radioButtonLabel },
              onChange: () => {
                setAccessToAddBillingAccountUser(false)
                if (isDone) {
                  setActiveStep(3)
                  setRefreshed(false)
                }
              }
            })
          ]),
          div({ style: { marginTop: '2rem', display: 'flex', displayDirection: 'row' } }, [
            h(RadioButton, {
              text: 'I have added terra-billing as a billing account user (requires reauthentication)', name: 'permission',
              checked: accessToAddBillingAccountUser === true,
              disabled: !isDone && !isActive,
              labelStyle: { ...styles.radioButtonLabel },
              onChange: async () => {
                setAccessToAddBillingAccountUser(true)
                await authorizeAndLoadAccounts()
                next()
              }
            })
          ])
        ])
      ])

    const contactBillingAccountAdministrator =
      fieldset({ style: { border: 'none', margin: 0, padding: 0, display: 'block' } }, [
        legend({ style: { maxWidth: '55%', fontSize: 14, lineHeight: '22px', whiteSpace: 'pre-wrap', marginTop: '0.25rem', float: 'left' } },
          [
            span(['Contact your billing account administrator and have them add you and ',
              span({ style: { fontWeight: 'bold' } }, ['terra-billing@terra.bio']), ' as a Billing Account User',
              span({ style: { fontWeight: 'bold' } }, [' to your organization\'s billing account.'])]),
            div({ style: { marginTop: '2rem' } }, [linkToSupport])
          ]),
        checkbox
      ])

    return li({ 'aria-current': isActive ? 'step' : false, style: { ...styles.stepBanner(isActive), display: 'flex', flexDirection: 'column' } }, [
      h3({ style: { fontSize: 18, marginTop: 0 } }, ['STEP 3']),
      (isActive || isDone) &&
      (!accessToBillingAccount || (accessToAddBillingAccountUser !== undefined && !accessToAddBillingAccountUser)) ?
        contactBillingAccountAdministrator : addTerraAsBillingAccountUser
    ])
  }

  const step4 = () => {
    const isActive = activeStep === 4

    return li({
      'aria-current': isActive ? 'step' : false, style: { ...styles.stepBanner(isActive), flexDirection: 'column' }
    }, [
      h3({ style: { fontSize: 18, marginTop: 0 } }, ['STEP 4']),
      span({ style: { fontSize: 14, lineHeight: '22px', whiteSpace: 'pre-wrap', width: '75%' } },
        ['Create a Terra project to connect your Google billing account to Terra. ' +
        'Billing projects allow you to manage your workspaces and are required to create one.']),
      div({ style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', height: 'auto' } }, [
        div({ style: { maxWidth: '35%', paddingBottom: '4rem' } }, [
          CreateGCPBillingProject({
            billingAccounts, chosenBillingAccount, setChosenBillingAccount,
            billingProjectName, setBillingProjectName, existing, disabled: !isActive
          })
        ]),
        isActive && _.isEmpty(billingAccounts) ?
          div({
            style: {
              display: 'flex', alignItems: 'flex-start',
              margin: '1rem 1rem 0', padding: '1rem',
              border: `1px solid ${colors.warning()}`, borderRadius: '5px',
              backgroundColor: colors.warning(0.15), maxWidth: '45%'
            },
            role: 'alert'
          }, [
            icon('warning-standard', { style: { color: colors.warning(), height: '1.5rem', width: '1.5rem', marginRight: '0.5rem', marginTop: '0.25rem' } }),
            !refreshed ? div({ style: { paddingInline: '0.5rem', lineHeight: '24px', fontWeight: 500 } }, [
              'You do not have access to any Google Billing Accounts. Please verify that a billing account has been created in the ' +
              'Google Billing Console and terra-billing@terra.bio has been added as a Billing Account User to your billing account.',
              div({ style: { marginTop: '0.5rem' } }, [
                h(Link, {
                  style: { textDecoration: 'underline', color: styles.accentColor },
                  onClick: async () => {
                    await authorizeAndLoadAccounts()
                    setRefreshed(true)
                  }
                }, ['Refresh Step 3'])
              ])
            ]) :
              div({ style: { paddingInline: '0.5rem', lineHeight: '24px', fontWeight: 500 } }, [
                'Terra still does not have access to any Google Billing Accounts. Please contact Terra support for additional help.',
                div({ style: { marginTop: '0.5rem' } }, [
                  h(Link, {
                    style: { textDecoration: 'underline', color: styles.accentColor },
                    onClick: () => { contactUsActive.set(true) }
                  }, ['Terra support'])
                ])
              ]),
            contactUsActive.get() && h(SupportRequestWrapper)
          ]) :
          div({ style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } }, [
            h(ButtonPrimary, {
              style: { marginTop: '2rem', height: '2.5rem', borderRadius: 2, textTransform: 'none', paddingInline: isBusy ? '1rem' : '2rem' },
              onClick: submit,
              disabled: !isActive
            }, [
              isBusy && icon('loadingSpinner', { size: 16, style: { color: 'white', marginRight: '0.5rem' } }),
              'Create Terra Billing Project'
            ]),
            isBusy && div({ role: 'alert', style: { marginTop: '1rem' } }, ['This may take a minute'])
          ])
      ])
    ])
  }

  return div({ style: { padding: '1.5rem 3rem' } }, [
    h2({ style: { fontWeight: 'bold', fontSize: 18 } }, ['Link a Google Cloud billing account to Terra']),
    div({ style: { marginTop: '0.5rem', fontSize: 14, lineHeight: '22px', width: 'calc(100% - 150px)' } }, [
      `The linked billing account is required to cover all Google Cloud data storage, compute and egress costs incurred in a Terra workspace.
        Cloud costs are billed directly from Google and passed through Terra billing projects with no markup.`
    ]),
    ul({ style: { margin: 0, padding: 0, listStyleType: 'none' } }, [
      step1(),
      step2(),
      step3(),
      step4()
    ])
  ])
}

export default CreateNewBillingProjectWizard
