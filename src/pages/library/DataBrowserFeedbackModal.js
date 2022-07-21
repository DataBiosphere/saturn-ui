import _ from 'lodash/fp'
import { Fragment, useState } from 'react'
import { div, h } from 'react-hyperscript-helpers'
import { ButtonPrimary, IdContainer, spinnerOverlay } from 'src/components/common'
import { TextArea, TextInput } from 'src/components/input'
import Modal from 'src/components/Modal'
import { Ajax } from 'src/libs/ajax'
import { FormLabel } from 'src/libs/forms'
import * as Utils from 'src/libs/utils'
import validate from 'validate.js'


export const DataBrowserFeedbackModal = ({ onSuccess, onDismiss, primaryQuestion, sourcePage }) => {
  const [contactEmail, setContactEmail] = useState('')
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [thanksShowing, setThanksShowing] = useState(false)

  const submit = Utils.withBusyState(setSubmitting, async () => {
    await Ajax().Surveys.submitForm('1FAIpQLSevEVLKiLNACAsti8k2U8EVKGHmQ4pJ8_643MfdY2lZEIusyw',
      { 'entry.477992521': feedback, 'entry.82175827': contactEmail, 'entry.367682225': sourcePage })
    setThanksShowing(true)
  })

  const errors = validate({ feedback, contactEmail },
    { feedback: { length: { minimum: 1, maximum: 2000 } }, contactEmail: contactEmail ? { email: true } : {} })

  return thanksShowing ?
    h(Modal, {
      onDismiss: () => {
        setThanksShowing(false)
        onSuccess()
      },
      showCancel: false,
      okButton: h(ButtonPrimary, {
        onClick: () => {
          setThanksShowing(false)
          onSuccess()
        }
      },
      ['OK'])
    }, [
      div({ style: { fontWeight: 600, fontSize: 18 } }, [
        'Thank you for helping us improve the Data Catalog experience!'
      ])
    ]) :
    h(Modal, {
      onDismiss,
      shouldCloseOnEsc: false,
      width: 500,
      title: 'Give feedback',
      okButton: h(ButtonPrimary, {
        tooltip: !!errors && _.map(error => div({ key: error }, [error]), errors),
        disabled: errors,
        onClick: submit
      }, ['Submit'])
    }, [
      h(IdContainer, [id => h(Fragment, [
        h(FormLabel, { required: true, htmlFor: id, style: { fontSize: 14 } },
          [primaryQuestion]),
        h(TextArea, {
          id,
          autoFocus: true,
          value: feedback,
          onChange: setFeedback,
          placeholder: 'Enter feedback',
          style: { height: '8rem', marginTop: '0.25rem' }
        }
        )
      ])]),
      div({ style: { display: 'flex', justifyContent: 'flex-end', fontSize: 12 } }, ['2000 Character limit']),
      h(IdContainer, [id => h(Fragment, [
        h(FormLabel, { htmlFor: id, style: { fontSize: 14 } },
          ['Can we contact you with further questions?']),
        h(TextInput, {
          id,
          value: contactEmail,
          onChange: setContactEmail,
          placeholder: 'Enter email address',
          style: { marginTop: '0.25rem' }
        }
        )
      ])]),
      submitting && spinnerOverlay
    ])
}
