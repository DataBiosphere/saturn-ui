import _ from 'lodash/fp';
import React, { ReactNode, useState } from 'react';
import { refreshTerraProfile, signOut } from 'src/auth/auth';
import { ButtonPrimary, ButtonSecondary, LabeledCheckbox } from 'src/components/common';
import { centeredSpinner } from 'src/components/icons';
import planet from 'src/images/register-planet.svg';
import { Ajax } from 'src/libs/ajax';
import { SamUserAttributes } from 'src/libs/ajax/User';
import colors from 'src/libs/colors';
import { reportError } from 'src/libs/error';
import Events from 'src/libs/events';
import { RegistrationLogo } from 'src/libs/logos';
import { authStore, getTerraUser, TerraUser } from 'src/libs/state';
import { CommunicationPreferencesCheckbox } from 'src/registration/CommunicationPreferencesCheckbox';
import { InterestInTerraCheckbox } from 'src/registration/InterestInTerraCheckbox';
import { LabelledTextInput } from 'src/registration/LabelledTextInput';
import validate from 'validate.js';

const constraints = (partOfOrg: boolean) => {
  return {
    givenName: { presence: { allowEmpty: false } },
    familyName: { presence: { allowEmpty: false } },
    email: { presence: { allowEmpty: false } },
    institute: { presence: { allowEmpty: !partOfOrg } },
    department: { presence: { allowEmpty: !partOfOrg } },
    title: { presence: { allowEmpty: !partOfOrg } },
  };
};

interface CheckboxLineProps {
  children: ReactNode[];
}
const CheckboxLine = (props: CheckboxLineProps) => <div style={{ marginRight: '1rem' }}>{props.children}</div>;

const Register = () => {
  const user: TerraUser = getTerraUser();
  const userAttributes: SamUserAttributes = authStore.get().terraUserAttributes;
  const [busy, setBusy] = useState(false);
  const [givenName, setGivenName] = useState(user.givenName || '');
  const [familyName, setFamilyName] = useState(user.familyName || '');
  const [email, setEmail] = useState(user.email || '');
  const [partOfOrganization, setPartOfOrganization] = useState(true);
  const [institute, setInstitute] = useState(''); // keep this key as 'institute' to be backwards compatible with existing Thurloe KVs
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [interestInTerra, setInterestInTerra] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(userAttributes.marketingConsent);

  const register = async () => {
    try {
      setBusy(true);
      const orgFields = partOfOrganization
        ? {
            institute,
            department,
            title,
          }
        : {};
      await Ajax().User.profile.set({
        firstName: givenName,
        lastName: familyName,
        contactEmail: email,
        interestInTerra,
        ...orgFields,
      });
      await Ajax().User.setUserAttributes({ marketingConsent });
      authStore.update((state) => ({ ...state, registrationStatus: 'registeredWithoutTos' }));
      await refreshTerraProfile();
      Ajax().Metrics.captureEvent(Events.user.register);
    } catch (error) {
      reportError('Error registering', error);
      setBusy(false);
    }
  };
  const errors = validate(
    { givenName, familyName, email, institute, title, department },
    constraints(partOfOrganization)
  );

  return (
    <div
      role="main"
      style={{
        flexGrow: 1,
        padding: '5rem',
        backgroundImage: `url(${planet})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: '750px',
        backgroundPosition: 'right 0px bottom -600px',
      }}
    >
      <RegistrationLogo />
      <div
        style={{
          marginTop: '4rem',
          color: colors.dark(0.6),
          fontSize: '1.5rem',
          fontWeight: 500,
        }}
      >
        New User Registration
      </div>
      <div style={{ marginTop: '1rem', display: 'flex' }}>
        <div style={{ lineHeight: '170%' }}>
          <LabelledTextInput
            required
            value={givenName}
            onChange={setGivenName}
            inputStyle={{ display: 'block' }}
            label="First Name"
          />
        </div>
        <div style={{ width: '1rem' }} />
        <div style={{ lineHeight: '170%' }}>
          <LabelledTextInput
            value={familyName}
            onChange={setFamilyName}
            inputStyle={{ display: 'block' }}
            label="Last Name"
          />
        </div>
      </div>
      <div style={{ lineHeight: '170%' }}>
        <LabelledTextInput
          value={email}
          required
          onChange={setEmail}
          labelStyle={{ display: 'block', marginTop: '2rem' }}
          inputStyle={{ width: '66ex' }}
          label="Contact Email for Notifications"
        />
      </div>
      <div style={{ lineHeight: '170%' }}>
        <LabelledTextInput
          value={institute}
          required={partOfOrganization}
          disabled={!partOfOrganization}
          onChange={setInstitute}
          inputStyle={{ width: '66ex' }}
          label="Organization"
        />
      </div>
      <div style={{ lineHeight: '170%', marginTop: '0.25rem' }}>
        <LabeledCheckbox
          checked={!partOfOrganization}
          onChange={() => setPartOfOrganization(!partOfOrganization)}
          disabled={false}
        >
          <span style={{ marginLeft: '0.25rem' }}>I am not a part of an organization</span>
        </LabeledCheckbox>
      </div>
      <div style={{ display: 'flex' }}>
        <div style={{ lineHeight: '170%' }}>
          <LabelledTextInput
            value={department}
            required={partOfOrganization}
            disabled={!partOfOrganization}
            onChange={setDepartment}
            labelStyle={{ display: 'block' }}
            label="Department"
          />
        </div>
        <div style={{ width: '1rem' }} />
        <div style={{ lineHeight: '170%' }}>
          <LabelledTextInput
            value={title}
            required={partOfOrganization}
            disabled={!partOfOrganization}
            onChange={setTitle}
            label="Title"
            labelStyle={{ display: 'block' }}
          />
        </div>
      </div>
      <h3 style={{ marginTop: '2rem' }}>I am most interested in using Terra to (Check all that apply):</h3>
      <CheckboxLine>
        {_.map(
          (title: string) => {
            return (
              <InterestInTerraCheckbox
                title={title}
                interestInTerra={interestInTerra}
                setFunc={setInterestInTerra}
                key={_.uniqueId('interest_')}
              />
            );
          },
          [
            'Collaborate with individuals within my organization',
            'Collaborate with individuals outside of my organization',
            'Access data',
            'Manage datasets',
            'Launch workflows',
            'Complete interactive analyses',
            'Build Tools',
          ]
        )}
      </CheckboxLine>
      <h3 style={{ marginTop: '2rem' }}>Communication Preferences</h3>
      <CommunicationPreferencesCheckbox
        title="Necessary communications related to platform operations"
        value
        setFunc={undefined}
      />
      <CommunicationPreferencesCheckbox
        title="Marketing communications including notifications for upcoming workshops and new flagship dataset additions"
        value={marketingConsent}
        setFunc={setMarketingConsent}
      />
      <div style={{ marginTop: '3rem' }}>
        <ButtonPrimary disabled={errors || busy} onClick={register}>
          Register
        </ButtonPrimary>
        <ButtonSecondary style={{ marginLeft: '1rem' }} onClick={() => signOut('requested')}>
          Cancel
        </ButtonSecondary>
        {busy &&
          centeredSpinner({ size: 34, ...{ style: { display: undefined, margin: undefined, marginLeft: '1ex' } } })}
      </div>
    </div>
  );
};
export default Register;
