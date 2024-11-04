import React from 'react';
import { styles } from 'src/billing/NewBillingProjectWizard/GCPBillingProjectWizard/GCPBillingProjectWizard';
import { ExternalLink } from 'src/billing/NewBillingProjectWizard/StepWizard/ExternalLink';
import {
  LabeledRadioButton,
  LabeledRadioGroup,
} from 'src/billing/NewBillingProjectWizard/StepWizard/LabeledRadioButton';
import { Step } from 'src/billing/NewBillingProjectWizard/StepWizard/Step';
import { StepFieldLegend, StepFields } from 'src/billing/NewBillingProjectWizard/StepWizard/StepFields';
import { StepHeader } from 'src/billing/NewBillingProjectWizard/StepWizard/StepHeader';
import { Metrics } from 'src/libs/ajax/Metrics';
import Events from 'src/libs/events';

export interface AddTerraAsBillingAccountUserStepProps {
  isActive: boolean;
  accessToAddBillingAccountUser?: boolean;
  setAccessToAddBillingAccountUser: (boolean) => void;
  isFinished: boolean;
}

export const AddTerraAsBillingAccountUserStep = ({ isActive, ...props }: AddTerraAsBillingAccountUserStepProps) => {
  // disable buttons if we haven't gotten to this step yet, but allow user to go back
  const disabled = !isActive && !props.isFinished;

  return (
    <Step isActive={isActive}>
      <StepHeader title='STEP 3' />
      <StepFields>
        <StepFieldLegend style={{ width: '70%' }}>
          Add <span style={{ fontWeight: 'bold' }}>terra-billing@terra.bio</span> as a Billing Account User
          <span style={{ fontWeight: 'bold' }}> to your billing account.</span>
        </StepFieldLegend>
        <LabeledRadioGroup style={{ width: '30%' }}>
          <LabeledRadioButton
            disabled={disabled}
            text="I don't have access to do this"
            name='permission'
            checked={props.accessToAddBillingAccountUser === false}
            labelStyle={{ ...styles.radioButtonLabel }}
            onChange={() => {
              void Metrics().captureEvent(Events.billingGCPCreationStep3BillingAccountNoAccess);
              props.setAccessToAddBillingAccountUser(false);
            }}
          />
          <LabeledRadioButton
            disabled={disabled}
            text='I have added terra-billing as a billing account user (requires reauthentication)'
            name='permission'
            checked={props.accessToAddBillingAccountUser === true}
            onChange={() => {
              void Metrics().captureEvent(Events.billingGCPCreationStep3AddedTerraBilling);
              props.setAccessToAddBillingAccountUser(true);
            }}
          />
        </LabeledRadioGroup>
      </StepFields>
      <ExternalLink
        text='Learn how to set up a Google Cloud Billing account'
        url='https://support.terra.bio/hc/en-us/articles/360026182251'
      />
    </Step>
  );
};
