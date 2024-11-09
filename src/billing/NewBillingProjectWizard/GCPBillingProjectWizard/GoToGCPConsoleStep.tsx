import React from 'react';
import { Step } from 'src/billing/NewBillingProjectWizard/StepWizard/Step';
import { StepInfo } from 'src/billing/NewBillingProjectWizard/StepWizard/StepFields';
import { StepHeader } from 'src/billing/NewBillingProjectWizard/StepWizard/StepHeader';
import { ButtonOutline } from 'src/components/common';
import { Metrics } from 'src/libs/ajax/Metrics';
import Events from 'src/libs/events';
import * as Utils from 'src/libs/utils';

interface GoToGCPConsoleStepProps {
  isActive: boolean;
  stepFinished: () => void;
}

export const GoToGCPConsoleStep = ({ isActive, ...props }: GoToGCPConsoleStepProps) => {
  return (
    <Step isActive={isActive}>
      <StepHeader title='STEP 1' />
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <StepInfo style={{ maxWidth: '60%' }}>
          Go to the Google Cloud Platform Billing Console and sign-in with the same user you use to log in to Terra.
        </StepInfo>
        <ButtonOutline
          disabled={false}
          href='https://console.cloud.google.com'
          {...Utils.newTabLinkProps}
          onClick={() => {
            void Metrics().captureEvent(Events.billingGCPCreationStep1);
            // FIXME: this seems wrong
            //  I would think the button would just be inactive if we're not on step 1
            //  then we wouldn't need this check, and we'd also only capture the metric when active
            //  before this was using the raw clickable, though - so I've preserved the exact functionality for now
            if (isActive) {
              props.stepFinished();
            }
          }}
          style={{ textTransform: 'none', backgroundColor: 'none' }}
        >
          Go to Google Cloud Console
        </ButtonOutline>
      </div>
    </Step>
  );
};
