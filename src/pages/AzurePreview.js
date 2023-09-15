import { Fragment, useCallback, useEffect, useState } from 'react';
import { div, fieldset, form, h, h1, input, label, p, span } from 'react-hyperscript-helpers';
import { ButtonOutline, ButtonPrimary, Checkbox, Select } from 'src/components/common';
import { icon } from 'src/components/icons';
import { TextArea, ValidatedInput } from 'src/components/input';
import planet from 'src/images/register-planet.svg';
import { ReactComponent as TerraOnAzureLogo } from 'src/images/terra-ms-logo.svg';
import { Ajax } from 'src/libs/ajax';
import { signOut, SignOutCause } from 'src/libs/auth';
import colors from 'src/libs/colors';
import { reportError } from 'src/libs/error';
import { FormLabel, FormLegend } from 'src/libs/forms';
import { getLocalPref, setLocalPref } from 'src/libs/prefs';
import { useStore } from 'src/libs/react-utils';
import { authStore, azurePreviewStore, getUser } from 'src/libs/state';

const styles = {
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 1.5,
    maxWidth: 760,
  },
  header: {
    display: 'flex',
    marginTop: '3rem',
    marginBotton: '2rem',
    color: colors.dark(0.8),
    fontSize: '1.8rem',
    fontWeight: 500,
  },
  button: {
    textTransform: 'none',
  },
};

const AzurePreviewForPreviewUser = () => {
  const dismiss = () => {
    azurePreviewStore.set(true);
  };

  return h(Fragment, [
    p({ style: styles.paragraph }, ['This is a preview version of the Terra platform on Microsoft Azure.']),

    div({ style: { marginTop: '1.5rem' } }, [
      h(ButtonPrimary, { onClick: dismiss, style: styles.button }, ['Proceed to Terra on Microsoft Azure Preview']),
    ]),
    div({ style: { marginTop: '1rem' } }, [h(ButtonOutline, { onClick: () => signOut(SignOutCause.requested), style: styles.button }, ['Sign Out'])]),
  ]);
};

export const submittedPreviewFormPrefKey = 'submitted-azure-preview-form';

const AzurePreviewUserForm = ({ value: formValue, onChange, onSubmit }) => {
  const [fieldsTouched, setFieldsTouched] = useState({});
  const [otherUseCase, setOtherUseCase] = useState('');

  const requiredTextFields = [
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
  ];

  const useCases = [
    'Manage datasets',
    'Launch workflows',
    'Collaborate with individuals within your organization',
    'Access data',
    'Complete interactive analyses',
    'Collaborate with others outside of your organization',
  ];

  const organizationDescriptions = [
    'Healthcare (Academic Research Institute)',
    'Healthcare (Hospital/Medical Center)',
    'Healthcare (Other)',
    'Healthcare/Genomic Data Generator',
    'Public Health/Infectious Disease',
    'Pharmaceutical',
    'BioPharma',
    'Biotech',
    'Biobank',
    'Prefer not to answer',
  ];

  const organizationRegions = [
    'Asia',
    'Australia and Oceania',
    'Central America and the Caribbean',
    'Europe',
    'Middle East, North Africa, and Greater Arabia',
    'North America',
    'South America',
    'Sub-Saharan Africa',
  ];

  return form(
    {
      name: 'azure-preview-interest',
      style: {
        display: 'flex',
        flexFlow: 'row wrap',
        justifyContent: 'space-between',
        width: 760,
      },
      onSubmit: (e) => {
        e.preventDefault();
        onSubmit();
      },
    },
    [
      requiredTextFields.map(({ key, label }) => {
        const inputId = `azure-preview-interest-${key}`;
        return div({ key, style: { width: 'calc(50% - 10px)' } }, [
          h(FormLabel, { htmlFor: inputId, required: true }, [label]),
          h(ValidatedInput, {
            inputProps: {
              id: inputId,
              value: formValue[key],
              onChange: (value) => {
                setFieldsTouched((v) => ({ ...v, [key]: true }));
                onChange({ ...formValue, [key]: value });
              },
            },
            error: fieldsTouched[key] && !formValue[key] ? `${label} is required` : undefined,
          }),
        ]);
      }),

      fieldset({ style: { padding: 0, border: 'none', margin: '2rem 0 0' } }, [
        h(FormLegend, { style: { marginBottom: '1rem' } }, [
          'What do you want to do in Terra? *',
          span({ style: { fontSize: '14px', fontStyle: 'italic', fontWeight: 400 } }, [' Please select all that apply']),
        ]),

        div(
          {
            style: {
              display: 'flex',
              flexFlow: 'row wrap',
              justifyContent: 'space-between',
            },
          },
          [
            useCases.map((useCase) => {
              const isChecked = formValue.useCases.includes(useCase);
              const id = `azure-preview-use-case-${useCase}`;
              return div(
                {
                  key: useCase,
                  style: {
                    display: 'flex',
                    width: 240,
                    marginBottom: '1rem',
                  },
                },
                [
                  label(
                    {
                      htmlFor: id,
                      style: { display: 'flex', alignItems: 'center' },
                      onClick: () =>
                        onChange({
                          ...formValue,
                          useCases: isChecked ? formValue.useCases.filter((uc) => uc !== useCase) : [...formValue.useCases, useCase],
                        }),
                    },
                    [
                      h(Checkbox, {
                        checked: isChecked,
                        id,
                        style: { flexShrink: 0, marginRight: '1ch' },
                        onChange: (checked) => {
                          onChange({
                            ...formValue,
                            useCases: checked ? [...formValue.useCases, useCase] : formValue.useCases.filter((uc) => uc !== useCase),
                          });
                        },
                      }),
                      span([useCase]),
                    ]
                  ),
                ]
              );
            }),

            div({ style: { width: '100%' } }, [
              label(
                {
                  htmlFor: 'azure-preview-use-case-other',
                  onClick: () =>
                    onChange({
                      ...formValue,
                      otherUseCase: formValue.otherUseCase ? '' : otherUseCase || ' ',
                    }),
                  style: { display: 'inline-flex', alignItems: 'center', marginBottom: '0.5rem' },
                },
                [
                  h(Checkbox, {
                    checked: !!formValue.otherUseCase,
                    id: 'azure-preview-use-case-other',
                    style: { flexShrink: 0, marginRight: '1ch' },
                    onChange: (checked) => {
                      onChange({
                        ...formValue,
                        otherUseCase: checked ? otherUseCase || ' ' : '',
                      });
                    },
                  }),
                  span(['Other (please specify)']),
                ]
              ),

              h(TextArea, {
                'aria-label': 'Other use case',
                rows: 3,
                value: otherUseCase,
                onChange: (value) => {
                  setOtherUseCase(value);
                  onChange({
                    ...formValue,
                    otherUseCase: value,
                  });
                },
              }),
            ]),
          ]
        ),
      ]),

      fieldset({ style: { padding: 0, border: 'none', margin: '1rem 0', width: '100%' } }, [
        h(FormLabel, { htmlFor: 'azure-preview-interest-org-description', required: true }, [
          'Which of the following best describes your organization?',
        ]),
        h(Select, {
          id: 'azure-preview-interest-org-description',
          getOptionLabel: ({ value }) => value,
          value: formValue.organizationDescription,
          onChange: (opt) => onChange({ ...formValue, organizationDescription: opt.value }),
          options: organizationDescriptions,
          menuPlacement: 'auto',
        }),

        formValue.organizationDescription.includes('Other') &&
          h(Fragment, [
            h(FormLabel, { htmlFor: 'azure-preview-interest-org-description-other', required: true }, ['Please specify']),
            h(ValidatedInput, {
              inputProps: {
                id: 'azure-preview-interest-org-description-other',
                placeholder: 'Description',
                value: formValue.organizationDescriptionOther,
                onChange: (value) => {
                  setFieldsTouched((v) => ({ ...v, organizationDescriptionOther: true }));
                  onChange({ ...formValue, organizationDescriptionOther: value });
                },
              },
              error: fieldsTouched.organizationDescriptionOther && !formValue.organizationDescriptionOther ? 'A description is required' : undefined,
            }),
          ]),
      ]),

      div({ style: { width: '100%' } }, [
        h(FormLabel, { htmlFor: 'azure-preview-interest-org-region', required: true }, ['In which region is your organization located?']),
        h(Select, {
          id: 'azure-preview-interest-org-region',
          getOptionLabel: ({ value }) => value,
          value: formValue.organizationRegion,
          onChange: (opt) => onChange({ ...formValue, organizationRegion: opt.value }),
          options: organizationRegions,
          menuPlacement: 'auto',
        }),
      ]),

      // Submit input allows submitting form by pressing the enter key.
      input({ type: 'submit', value: 'submit', style: { display: 'none' } }),
    ]
  );
};

const formId = '1FAIpQLSegf8c7LxlVOS8BLNUrpqkiB7l8L7c135ntdgaBSV2kdrqSAQ';

// To find the entry IDs for each question, select "Get pre-filled link" from the Google Form,
// answer each question with the question title / ID, and get the link. The query parameters
// in the URL will contain the entry IDs.
const formInputMap = {
  firstName: 'entry.1708226507',
  lastName: 'entry.677313431',
  title: 'entry.1500649388',
  organization: 'entry.1020670185',
  contactEmail: 'entry.1125156163',
  terraEmail: 'entry.1938956483',
  useCases: 'entry.768184594',
  otherUseCase: 'entry.1274069507',
  organizationDescription: 'entry.1230284397',
  organizationDescriptionOther: 'entry.548834294',
  organizationRegion: 'entry.2049653730',
};

const AzurePreviewForNonPreviewUser = () => {
  const [hasSubmittedForm, setHasSubmittedForm] = useState(() => getLocalPref(submittedPreviewFormPrefKey) || false);
  useEffect(() => {
    setLocalPref(submittedPreviewFormPrefKey, hasSubmittedForm);
  }, [hasSubmittedForm]);

  const [busy, setBusy] = useState(false);

  const [userInfo, setUserInfo] = useState(() => {
    const user = getUser();

    // If the user's name contains only one space, guess that it contains
    // their first and last name and auto populate those inputs.
    // Otherwise, leave them blank.
    const nameParts = (user.name || '').trim().split(/\s/);
    const [firstName, lastName] = nameParts.length === 2 ? nameParts : ['', ''];

    return {
      firstName,
      lastName,
      title: '',
      organization: '',
      contactEmail: user.email || '',
      terraEmail: user.email,
      useCases: [],
      otherUseCase: '',
      organizationDescription: '',
      organizationDescriptionOther: '',
      organizationRegion: '',
    };
  });

  const requiredFields = [
    'firstName',
    'lastName',
    'title',
    'organization',
    'contactEmail',
    'terraEmail',
    'organizationDescription',
    'organizationRegion',
  ];
  if (userInfo.organizationDescription.includes('Other')) {
    requiredFields.push('organizationDescriptionOther');
  }

  const useCasesChecked = !!userInfo.otherUseCase || userInfo.useCases.length > 0;

  const submitEnabled = requiredFields.every((field) => !!userInfo[field]) && useCasesChecked && !busy;

  const submitForm = useCallback(async () => {
    setBusy(true);
    try {
      const formInput = Object.entries(formInputMap).reduce(
        (acc, [userInfoKey, formFieldId]) => ({
          ...acc,
          [formFieldId]: userInfoKey === 'useCases' ? userInfo.useCases.join(', ') : userInfo[userInfoKey],
        }),
        {}
      );

      await Ajax().Surveys.submitForm(formId, formInput);
      setHasSubmittedForm(true);
    } catch (error) {
      reportError('Error submitting information', error);
    } finally {
      setBusy(false);
    }
  }, [userInfo]);

  if (hasSubmittedForm) {
    return h(Fragment, [
      p({ style: styles.paragraph }, [
        'Thank you for your interest in using Terra on Microsoft Azure. We will be in touch with your access information. ',
      ]),
      p({ style: styles.paragraph }, ['Please add preview@terra.bio to your contact list to not miss emails about access to the preview.']),
      div({ style: { marginTop: '1.5rem' } }, [h(ButtonPrimary, { onClick: signOut(SignOutCause.requested), style: styles.button }, ['Sign Out'])]),
    ]);
  }
  return div([
    p({ style: styles.paragraph }, [
      'Terra on Microsoft Azure is currently in preview. Please complete the following form if you are interested in accessing the platform and exploring the capabilities of Terra on Microsoft Azure.',
    ]),

    h(AzurePreviewUserForm, { value: userInfo, onChange: setUserInfo, onSubmit: submitEnabled ? submitForm : () => {} }),

    div(
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          marginTop: '1.5rem',
        },
      },
      [
        h(
          ButtonPrimary,
          {
            disabled: !submitEnabled,
            onClick: submitForm,
            style: styles.button,
            tooltip: submitEnabled ? '' : 'Please fill out all required fields',
          },
          ['Submit', busy && icon('loadingSpinner', { size: 12, style: { marginLeft: '1ch' } })]
        ),
        h(ButtonOutline, { onClick: () => signOut(SignOutCause.requested), style: styles.button }, ['Sign Out']),
      ]
    ),
  ]);
};

const AzurePreview = () => {
  const { isAzurePreviewUser } = useStore(authStore);

  return div(
    {
      role: 'main',
      style: {
        ...styles.centered,
        flexGrow: 1,
        padding: '5rem',
        backgroundImage: `url(${planet})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: '750px',
        backgroundPosition: 'right 0px bottom -600px',
      },
    },
    [
      div([
        h(TerraOnAzureLogo, { title: 'Terra on Microsoft Azure - Preview', role: 'img' }),
        h1({ style: styles.header }, ['Terra on Microsoft Azure - Preview']),

        isAzurePreviewUser ? h(AzurePreviewForPreviewUser) : h(AzurePreviewForNonPreviewUser),
      ]),
    ]
  );
};

export default AzurePreview;

export const navPaths = [
  {
    name: 'azure-preview',
    path: '/azure-preview',
    component: AzurePreview,
    public: true,
    title: 'Terra on Microsoft Azure Preview',
  },
];
