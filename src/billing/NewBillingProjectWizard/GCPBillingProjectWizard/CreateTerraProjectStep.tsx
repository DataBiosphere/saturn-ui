import { ButtonPrimary, Icon, Link } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { useState } from 'react';
import CreateGCPBillingProject from 'src/billing/CreateGCPBillingProject';
import { Step } from 'src/billing/NewBillingProjectWizard/StepWizard/Step';
import { StepFieldLegend, StepFields } from 'src/billing/NewBillingProjectWizard/StepWizard/StepFields';
import { StepHeader } from 'src/billing/NewBillingProjectWizard/StepWizard/StepHeader';
import { GoogleBillingAccount } from 'src/billing-core/models';
import SupportRequestWrapper from 'src/components/SupportRequest';
import { Billing } from 'src/libs/ajax/billing/Billing';
import { Metrics } from 'src/libs/ajax/Metrics';
import colors from 'src/libs/colors';
import { reportErrorAndRethrow } from 'src/libs/error';
import Events from 'src/libs/events';
import { contactUsActive } from 'src/libs/state';
import * as Utils from 'src/libs/utils';

interface CreateTerraProjectStepProps {
  isActive: boolean;
  billingAccounts: Record<string, GoogleBillingAccount>;
  refreshed: boolean;
  setRefreshed: (boolean) => void;
  authorizeAndLoadAccounts: () => Promise<void>;
  onSuccess: (string) => void;
}

export const CreateTerraProjectStep = ({
  isActive,
  billingAccounts,
  onSuccess,
  ...props
}: CreateTerraProjectStepProps) => {
  const [billingProjectName, setBillingProjectName] = useState('');
  const [chosenBillingAccount, setChosenBillingAccount] = useState<any>();
  const [isBusy, setIsBusy] = useState(false);
  const [existing, setExisting] = useState<string[]>([]);

  const submit = _.flow(
    reportErrorAndRethrow('Error creating billing project'),
    Utils.withBusyState(setIsBusy)
  )(async () => {
    try {
      await Billing().createGCPProject(billingProjectName, chosenBillingAccount.accountName);
      onSuccess(billingProjectName);
    } catch (error: any) {
      if (error?.status === 409) {
        setExisting(_.concat(billingProjectName, existing));
      } else {
        throw error;
      }
    }
  });
  return (
    <Step isActive={isActive} style={{ height: '22rem' }}>
      <StepHeader title='STEP 4' />
      <StepFields disabled={!isActive} style={{ flexDirection: 'column' }}>
        <StepFieldLegend style={{ width: '65%' }}>
          Create a Terra project to connect your Google billing account to Terra. Billing projects allow you to manage
          your workspaces and are required to create one.
        </StepFieldLegend>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
          <div>
            <CreateGCPBillingProject
              billingAccounts={billingAccounts}
              chosenBillingAccount={chosenBillingAccount}
              setChosenBillingAccount={setChosenBillingAccount}
              billingProjectName={billingProjectName}
              setBillingProjectName={setBillingProjectName}
              existing={existing}
              disabled={!isActive}
            />
          </div>
          {isActive && _.isEmpty(billingAccounts) ? (
            <NoBillingAccounts
              refreshed={props.refreshed}
              setRefreshed={props.setRefreshed}
              authorizeAndLoadAccounts={props.authorizeAndLoadAccounts}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '2.5rem' }}>
              <ButtonPrimary style={{ textTransform: 'none' }} onClick={submit} disabled={!isActive}>
                Create Terra Billing Project
                {isBusy && <Icon icon='loadingSpinner' size={16} style={{ color: 'white', marginRight: '0.5rem' }} />}
              </ButtonPrimary>
              {isBusy && (
                <div role='alert' style={{ marginTop: '1rem' }}>
                  This may take a minute
                </div>
              )}
            </div>
          )}
        </div>
      </StepFields>
    </Step>
  );
};

const NoBillingAccounts = (props: {
  refreshed: boolean;
  setRefreshed: (boolean) => void;
  authorizeAndLoadAccounts: () => Promise<void>;
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      margin: '1rem 1rem 0',
      padding: '1rem',
      border: `1px solid ${colors.warning()}`,
      borderRadius: '5px',
      backgroundColor: colors.warning(0.1),
      maxWidth: '45%',
    }}
    role='alert'
  >
    <Icon
      icon='warning-standard'
      style={{
        color: colors.warning(),
        height: '1.5rem',
        width: '1.5rem',
        marginRight: '0.5rem',
        marginTop: '0.25rem',
      }}
    />
    {/* TODO: can we get away without the refreshed prop, and just rely on whether or not we've gotten to this step?
        maybe instead of 'refresh step 3', it's just refreshing the login, or something - so we aren't explicitly going back to step 3
     */}
    {!props.refreshed ? (
      <div style={{ paddingInline: '0.5rem', lineHeight: '24px', fontWeight: 500 }}>
        You do not have access to any Google Billing Accounts. Please verify that a billing account has been created in
        the Google Billing Console and terra-billing@terra.bio has been added as a Billing Account User to your billing
        account.
        <div style={{ marginTop: '0.5rem' }}>
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <Link
            style={{ textDecoration: 'underline', color: colors.accent() }}
            onClick={async () => {
              void Metrics().captureEvent(Events.billingGCPCreationRefreshStep3);
              await props.authorizeAndLoadAccounts();
              props.setRefreshed(true);
            }}
          >
            Refresh Step 3
          </Link>
        </div>
      </div>
    ) : (
      <div style={{ paddingInline: '0.5rem', lineHeight: '24px', fontWeight: 500 }}>
        Terra still does not have access to any Google Billing Accounts. Please contact Terra support for additional
        help.
        <div style={{ marginTop: '0.5rem' }}>
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <Link
            style={{ textDecoration: 'underline', color: colors.accent() }}
            onClick={() => {
              void Metrics().captureEvent(Events.billingCreationContactTerraSupport);
              contactUsActive.set(true);
            }}
          >
            Terra support
          </Link>
        </div>
      </div>
    )}
    {contactUsActive.get() && <SupportRequestWrapper />}
  </div>
);
