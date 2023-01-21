import { Fragment, useCallback, useEffect, useState } from 'react'
import { div, form, h, h1, p } from 'react-hyperscript-helpers'
import { ButtonOutline, ButtonPrimary } from 'src/components/common'
import { TextInput } from 'src/components/input'
import planet from 'src/images/register-planet.svg'
import { ReactComponent as TerraOnAzureLogo } from 'src/images/terra-ms-logo.svg'
import { signOut } from 'src/libs/auth'
import colors from 'src/libs/colors'
import { FormLabel } from 'src/libs/forms'
import { getLocalPref, setLocalPref } from 'src/libs/prefs'
import { useStore } from 'src/libs/react-utils'
import { authStore, azurePreviewStore } from 'src/libs/state'


const styles = {
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  paragraph: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 1.5,
    maxWidth: 570,
  },
  header: {
    display: 'flex',
    marginTop: '3rem',
    marginBotton: '2rem',
    justifyContent: 'center',
    alignItems: 'center',
    color: colors.dark(0.8),
    fontSize: '1.8rem',
    fontWeight: 500,
  },
  button: {
    textTransform: 'none',
  },
}

const AzurePreviewDescription = () => p({ style: styles.paragraph }, [
  'This is a preview version of the Terra platform on Microsoft Azure. The public offering of Terra on Microsoft Azure is expected in early 2023.'
])

const AzurePreviewForPreviewUser = () => {
  const dismiss = () => {
    azurePreviewStore.set(true)
  }

  return h(Fragment, [
    h(AzurePreviewDescription),

    div({ style: { ...styles.centered, marginTop: '1.5rem' } }, [
      h(ButtonPrimary, { onClick: dismiss, style: { ...styles.button, marginBottom: '1rem' } }, ['Proceed to Terra on Microsoft Azure Preview']),
      h(ButtonOutline, { onClick: signOut, style: styles.button }, ['Sign Out']),
    ])
  ])
}

export const submittedPreviewFormPrefKey = 'submitted-azure-preview-form'

const AzurePreviewUserForm = ({ value: formValue, onChange, onSubmit }) => {
  const fields = [
    {
      key: 'firstName',
      label: 'First name',
    },
    {
      key: 'lastName',
      label: 'Last name',
    },
    {
      key: 'title',
      label: 'Title/Role',
    },
    {
      key: 'organization',
      label: 'Organization name',
    },
    {
      key: 'contactEmail',
      label: 'Contact email address',
    },
  ]

  return form({
    name: 'azure-preview-interest',
    style: {
      display: 'flex',
      flexFlow: 'row wrap',
      justifyContent: 'space-between',
      width: 570,
    },
    onSubmit: e => {
      e.preventDefault()
      onSubmit()
    }
  }, [
    fields.map(({ key, label }) => {
      const inputId = `azure-preview-interest-${key}`
      return div({ key, style: { width: 250 } }, [
        h(FormLabel, { htmlFor: inputId, required: true }, [label]),
        h(TextInput, {
          id: inputId,
          value: formValue[key],
          onChange: value => { onChange({ ...formValue, [key]: value }) },
        }),
      ])
    }),
  ])
}

const AzurePreviewForNonPreviewUser = () => {
  const [hasSubmittedForm, setHasSubmittedForm] = useState(() => getLocalPref(submittedPreviewFormPrefKey) || false)
  useEffect(() => {
    setLocalPref(submittedPreviewFormPrefKey, hasSubmittedForm)
  }, [hasSubmittedForm])

  const [userInfo, setUserInfo] = useState({
    firstName: '',
    lastName: '',
    title: '',
    organization: '',
    contactEmail: '',
  })

  const submitEnabled = Object.values(userInfo).every(Boolean)

  const submitForm = useCallback(() => {
    setHasSubmittedForm(true)
  }, [])

  return h(Fragment, [
    h(AzurePreviewDescription),

    hasSubmittedForm ? h(Fragment, [
      p({ style: styles.paragraph }, [
        'Thank you for your interest in using Terra on Microsoft Azure. We will be in touch with you shortly with your access information.'
      ]),
      div({
        style: {
          display: 'flex',
          justifyContent: 'center',
          marginTop: '1.5rem',
        }
      }, [
        h(ButtonPrimary, { onClick: signOut, style: styles.button }, ['Sign Out']),
      ])
    ]) : div([
      p({ style: styles.paragraph }, [
        'You are not currently part of the Terra on Microsoft Azure Preview Program. If you are interested in joining the program, please complete the form below.'
      ]),

      h(AzurePreviewUserForm, { value: userInfo, onChange: setUserInfo, onSubmit: submitForm }),

      div({
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          marginTop: '1.5rem',
        }
      }, [
        h(ButtonPrimary, { disabled: !submitEnabled, onClick: submitForm, style: styles.button }, ['Submit']),
        h(ButtonOutline, { onClick: signOut, style: styles.button }, ['Sign Out']),
      ])
    ]),
  ])
}

const AzurePreview = () => {
  const { isAzurePreviewUser } = useStore(authStore)

  return div({
    role: 'main',
    style: {
      ...styles.centered,
      flexGrow: 1,
      padding: '5rem',
      backgroundImage: `url(${planet})`,
      backgroundRepeat: 'no-repeat', backgroundSize: '750px', backgroundPosition: 'right 0px bottom -600px'
    }
  }, [
    h(TerraOnAzureLogo, { title: 'Terra on Microsoft Azure - Preview', role: 'img' }),
    h1({ style: styles.header }, ['Terra on Microsoft Azure - Preview']),

    !!isAzurePreviewUser ? h(AzurePreviewForPreviewUser) : h(AzurePreviewForNonPreviewUser),
  ])
}

export default AzurePreview

export const navPaths = [
  {
    name: 'azure-preview',
    path: '/azure-preview',
    component: AzurePreview,
    public: true,
    title: 'Terra on Microsoft Azure Preview'
  }
]
