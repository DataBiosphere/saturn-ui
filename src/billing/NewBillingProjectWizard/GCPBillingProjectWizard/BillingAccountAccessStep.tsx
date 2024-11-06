import React from 'react';
import {
  LabeledRadioButton,
  LabeledRadioGroup,
} from 'src/billing/NewBillingProjectWizard/StepWizard/LabeledRadioButton';
import { Step } from 'src/billing/NewBillingProjectWizard/StepWizard/Step';
import {
  legendDetailsStyle,
  StepFieldLegend,
  StepFields,
} from 'src/billing/NewBillingProjectWizard/StepWizard/StepFields';
import { StepHeader } from 'src/billing/NewBillingProjectWizard/StepWizard/StepHeader';
import { Metrics } from 'src/libs/ajax/Metrics';
import Events from 'src/libs/events';

export interface BillingAccountAccessStepProps {
  isActive: boolean;
  accessToBillingAccount?: boolean;
  setAccessToBillingAccount: (boolean) => void;
}

export const BillingAccountAccessStep = ({ isActive, ...props }: BillingAccountAccessStepProps) => (
  <Step isActive={isActive}>
    <StepHeader title='STEP 2' />
    <StepFields>
      <StepFieldLegend style={{ width: '70%' }}>
        Select an existing billing account or create a new one.
        <p style={{ ...legendDetailsStyle, width: '75%' }}>
          If you are creating a new billing account, you may be eligible for $300 in free credits. Follow the
          instructions to activate your account in the Google Cloud Console.
        </p>
      </StepFieldLegend>
      <LabeledRadioGroup style={{ width: '30%' }}>
        <LabeledRadioButton
          text="I don't have access to a Cloud billing account"
          name='access-to-account'
          checked={props.accessToBillingAccount === false}
          onChange={() => {
            props.setAccessToBillingAccount(false);
            void Metrics().captureEvent(Events.billingGCPCreationStep2BillingAccountNoAccess);
          }}
        />
        <LabeledRadioButton
          text='I have a billing account'
          name='access-to-account'
          checked={props.accessToBillingAccount === true}
          onChange={() => {
            props.setAccessToBillingAccount(true);
            void Metrics().captureEvent(Events.billingGCPCreationStep2HaveBillingAccount);
          }}
        />
      </LabeledRadioGroup>
    </StepFields>
  </Step>
);
