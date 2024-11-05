import React from 'react';
import { styles } from 'src/billing/NewBillingProjectWizard/GCPBillingProjectWizard/GCPBillingProjectWizard';
import { ExternalLink } from 'src/billing/NewBillingProjectWizard/StepWizard/ExternalLink';
import { Step } from 'src/billing/NewBillingProjectWizard/StepWizard/Step';
import { StepFieldLegend, StepFields } from 'src/billing/NewBillingProjectWizard/StepWizard/StepFields';
import { StepHeader } from 'src/billing/NewBillingProjectWizard/StepWizard/StepHeader';
import { LabeledCheckbox } from 'src/components/common';
import { Metrics } from 'src/libs/ajax/Metrics';
import Events from 'src/libs/events';

interface ContactAccountAdminToAddUserStepProps {
  isActive: boolean;
  isFinished: boolean;
  verifiedUsersAdded: boolean | undefined;
  setVerifiedUsersAdded: (boolean) => void;
}

export const ContactAccountAdminToAddUserStep = ({ isActive, ...props }: ContactAccountAdminToAddUserStepProps) => (
  <Step isActive={isActive}>
    <StepHeader title='STEP 3' />
    <StepFields>
      <StepFieldLegend style={{ width: '50%' }}>
        {'Contact your billing account administrator and have them add you and '}
        <span style={{ fontWeight: 'bold' }}>terra-billing@terra.bio</span>
        {' as a Billing Account User '}
        <span style={{ fontWeight: 'bold' }}>to your organization&apos;s billing account.</span>
      </StepFieldLegend>
      <div style={{ width: '30%' }}>
        <LabeledCheckbox
          checked={props.verifiedUsersAdded === true}
          disabled={!isActive && !props.isFinished}
          onChange={() => {
            void Metrics().captureEvent(Events.billingGCPCreationStep3VerifyUserAdded);
            props.setVerifiedUsersAdded(!props.verifiedUsersAdded);
          }}
        >
          {/*
          this negative margin here is hideous but necessary:
          giving the div that contains the checkbox {display: flex, flexDirection: row} gives the label the correct layout
          but it also breaks the checkbox, because it's implemented as layered svg icons, making it very sensitive to layout changes
          if the component is changed to use an input element with checkbox, we should be able to just use flexbox and be done with all the tweaks
          */}
          <span style={{ float: 'right', ...styles.radioButtonLabel, marginLeft: '2rem', marginTop: '-1.3rem' }}>
            I have verified the user has been added to my account (requires reauthentication)
          </span>
        </LabeledCheckbox>
      </div>
    </StepFields>
    <ExternalLink
      style={{ marginTop: '2rem' }}
      text='Learn how to set up a Google Cloud Billing account'
      url='https://support.terra.bio/hc/en-us/articles/360026182251'
    />
  </Step>
);
