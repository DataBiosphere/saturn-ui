import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { div, h, span } from 'react-hyperscript-helpers';
import { absoluteSpinnerOverlay, ButtonPrimary, ButtonSecondary, Clickable, IdContainer, Link, RadioButton, Select } from 'src/components/common';
import Dropzone from 'src/components/Dropzone';
import { icon } from 'src/components/icons';
import { TextArea, TextInput } from 'src/components/input';
import { Support } from 'src/libs/ajax/Support';
import colors from 'src/libs/colors';
import { reportError, withErrorReporting } from 'src/libs/error';
import { FormLabel } from 'src/libs/forms';
import { notify } from 'src/libs/notifications';
import { useStore } from 'src/libs/react-utils';
import { contactUsActive, userStore } from 'src/libs/state';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';
import validate from 'validate.js';

const constraints = {
  name: { presence: { allowEmpty: false } },
  subject: { presence: { allowEmpty: false } },
  description: { presence: { allowEmpty: false } },
  email: { email: true, presence: { allowEmpty: false } },
  clinicalUser: { presence: { allowEmpty: false } },
};

// If you are making changes to the Support Request Modal, make sure you test the following:
// 1. Submit a ticket via Terra while signed in and signed out
// 2. Check the tickets are generated on Zendesk
// 3. Reply internally (as a Light Agent) and make sure an email is not sent
// 4. Reply externally (ask one of the Comms team with Full Agent access) and make sure you receive an email

const SupportRequest = () => {
  // State
  const {
    profile: { firstName, lastName, contactEmail, email: profileEmail },
  } = useStore(userStore);

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('question');
  const [email, setEmail] = useState(contactEmail || profileEmail || '');
  const [nameEntered, setNameEntered] = useState('');
  const [attachmentToken, setAttachmentToken] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachmentName, setAttachmentName] = useState('');
  const [clinicalUser, setClinicalUser] = useState(undefined);
  const [submitting, setSubmitting] = useState(false);

  // Helpers
  const hasName = !(firstName === 'N/A' || firstName === undefined);

  const uploadFile = _.flow(
    withErrorReporting('Error uploading attachment'),
    Utils.withBusyState(setUploadingFile)
  )(async (files) => {
    const {
      token,
      attachment: { file_name: fileName },
    } = await Support().uploadAttachment(files[0]);
    setAttachmentToken(token);
    setAttachmentName(fileName);
  });

  const requestObject = {
    name: hasName ? `${firstName} ${lastName}` : nameEntered,
    email,
    description,
    subject,
    type,
    attachmentToken,
    clinicalUser,
  };

  const submit = Utils.withBusyState(setSubmitting, async () => {
    const currUrl = window.location.href;
    try {
      await Support().createSupportRequest({ ...requestObject, currUrl });
      notify('success', 'Message sent successfully', { timeout: 3000 });
    } catch (error) {
      notify(
        'error',
        div([
          'Error submitting support request. ',
          h(
            Link,
            {
              style: { fontWeight: 800, color: 'white' },
              hover: { color: 'white', textDecoration: 'underline' },
              href:
                `mailto:terra-support@broadinstitute.zendesk.org?subject=${type}%3A%20${subject}&body=Original%20support%20request%3A%0A` +
                `------------------------------------%0AContact email%3A%20${email}%0AIs clinical user%3A%20${clinicalUser}%0A%0A${description}%0A%0A------------------------------------` +
                `%0AError%20reported%20from%20Zendesk%3A%0A%0A${JSON.stringify(error)}`,
              ...Utils.newTabLinkProps,
            },
            'Click here to email support'
          ),
          !!attachmentToken && ' and make sure to add your attachment to the email.',
        ])
      );
    } finally {
      contactUsActive.set(false);
    }
  });

  // Render
  const greetUser = hasName ? `, ${firstName}` : '';
  const errors = validate(requestObject, constraints);

  return div(
    {
      style: {
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        width: 450,
        boxShadow: Style.modalShadow,
        zIndex: 2,
      },
    },
    [
      h(
        Dropzone,
        {
          maxSize: 20 * 1024 * 1024,
          multiple: false,
          style: { flexGrow: 1 },
          activeStyle: { cursor: 'copy' },
          onDropRejected: (e) => reportError('Error uploading attachment', e),
          onDropAccepted: uploadFile,
        },
        [
          ({ dragging, openUploader }) =>
            div({ style: { padding: '1rem' } }, [
              div({ style: { fontSize: 18, fontWeight: 'bold', color: colors.dark() } }, ['Contact Us']),
              !hasName &&
                h(Fragment, [
                  h(IdContainer, [
                    (id) =>
                      h(Fragment, [
                        h(FormLabel, { required: true, htmlFor: id }, ['Name']),
                        h(TextInput, {
                          id,
                          placeholder: 'What should we call you?',
                          autoFocus: true,
                          value: nameEntered,
                          onChange: setNameEntered,
                        }),
                      ]),
                  ]),
                ]),
              h(IdContainer, [
                (id) =>
                  h(Fragment, [
                    h(FormLabel, { required: true, htmlFor: id }, ['Type']),
                    h(Select, {
                      id,
                      isMulti: false,
                      value: type,
                      onChange: ({ value }) => setType(value),
                      options: [
                        { value: 'question', label: 'Question' },
                        { value: 'bug', label: 'Bug' },
                      ],
                    }),
                  ]),
              ]),
              h(IdContainer, [
                (id) =>
                  h(Fragment, [
                    h(FormLabel, { required: true, htmlFor: id }, [`How can we help you${greetUser}?`]),
                    h(TextInput, {
                      id,
                      style: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomStyle: 'dashed' },
                      placeholder: 'Enter a subject',
                      autoFocus: hasName,
                      value: subject,
                      onChange: setSubject,
                    }),
                  ]),
              ]),
              h(TextArea, {
                style: { height: 200, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopStyle: 'dashed' },
                'aria-label': 'Enter a description',
                placeholder: 'Enter a description',
                value: description,
                onChange: setDescription,
              }),
              h(FormLabel, ['Attachment']),
              attachmentToken
                ? div({ style: { display: 'flex', alignItems: 'center' } }, [
                    h(
                      Clickable,
                      {
                        tooltip: 'Change file',
                        style: { flex: 'auto' },
                        onClick: openUploader,
                      },
                      [
                        div(
                          {
                            style: { marginLeft: '1rem', paddingTop: '0.5rem' },
                          },
                          ['Successfully uploaded: ', span({ style: { color: colors.dark() } }, [attachmentName])]
                        ),
                      ]
                    ),
                    h(
                      Link,
                      {
                        tooltip: 'Remove file',
                        style: { flex: 0, paddingTop: '0.5rem' },
                        onClick: () => {
                          setAttachmentToken('');
                          setAttachmentName('');
                        },
                      },
                      [icon('times-circle', { size: 23 })]
                    ),
                  ])
                : h(
                    Clickable,
                    {
                      style: {
                        flex: 1,
                        backgroundColor: dragging ? colors.accent(0.2) : colors.dark(0.1),
                        borderRadius: 3,
                        border: `1px dashed ${colors.dark(0.7)}`,
                      },
                      onClick: openUploader,
                    },
                    [
                      div({ style: { fontSize: 14, lineHeight: '30px', paddingLeft: '1rem', display: 'flex', alignItems: 'center' } }, [
                        'Drag or',
                        h(Link, { style: { margin: '0 0.25rem' } }, ['Click']),
                        'to attach a file',
                        icon('upload-cloud', { size: 25, style: { opacity: 0.4, marginLeft: '0.5rem' } }),
                      ]),
                    ]
                  ),
              h(IdContainer, [
                (id) =>
                  h(Fragment, [
                    h(FormLabel, { required: true, htmlFor: id }, ['Contact email']),
                    h(TextInput, {
                      id,
                      value: email,
                      placeholder: 'Enter your email address',
                      onChange: setEmail,
                    }),
                  ]),
              ]),
              h(FormLabel, { required: true }, ['Are you a clinical user?']), // neither should be checked when undefined, thus ===
              h(RadioButton, {
                text: 'Yes',
                name: 'is-clinical-user',
                checked: clinicalUser === true,
                labelStyle: { margin: '0 2rem 0 0.25rem' },
                onChange: () => setClinicalUser(true),
              }),
              h(RadioButton, {
                text: 'No',
                name: 'is-clinical-user',
                checked: clinicalUser === false,
                labelStyle: { margin: '0 2rem 0 0.25rem' },
                onChange: () => setClinicalUser(false),
              }),
              div(
                {
                  style: { marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline' },
                },
                [
                  h(
                    ButtonSecondary,
                    {
                      style: { marginRight: '1rem' },
                      onClick: () => contactUsActive.set(false),
                    },
                    ['Cancel']
                  ),
                  h(
                    ButtonPrimary,
                    {
                      disabled: !!errors,
                      tooltip: Utils.summarizeErrors(errors),
                      onClick: submit,
                    },
                    ['SEND']
                  ),
                ]
              ),
            ]),
        ]
      ),
      (uploadingFile || submitting) && absoluteSpinnerOverlay,
    ]
  );
};

function SupportRequestWrapper() {
  const isActive = useStore(contactUsActive);

  return isActive ? h(SupportRequest) : null;
}

export default SupportRequestWrapper;
