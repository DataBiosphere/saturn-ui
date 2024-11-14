import { SpinnerOverlay, useLoadedData, useUniqueId } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { columnEntryStyle, rowStyle } from 'src/billing/NewBillingProjectWizard/AzureBillingProjectWizard/styles';
import { ExternalLink } from 'src/billing/NewBillingProjectWizard/StepWizard/ExternalLink';
import { Step } from 'src/billing/NewBillingProjectWizard/StepWizard/Step';
import {
  LabeledField,
  legendDetailsStyle,
  StepFieldLegend,
  StepFields,
} from 'src/billing/NewBillingProjectWizard/StepWizard/StepFields';
import { StepHeader } from 'src/billing/NewBillingProjectWizard/StepWizard/StepHeader';
import { AzureManagedAppCoordinates } from 'src/billing-core/models';
import { Link, Select } from 'src/components/common';
import { ValidatedInputWithRef } from 'src/components/input';
import { Billing } from 'src/libs/ajax/billing/Billing';
import { getRegionLabel } from 'src/libs/azure-utils';
import { useCancellation } from 'src/libs/react-utils';
import * as Utils from 'src/libs/utils';
import { summarizeErrors } from 'src/libs/utils';
import { validate as validateUuid } from 'uuid';
import { validate } from 'validate.js';

type AzureSubscriptionStepProps = {
  isActive: boolean;
  subscriptionId?: string; // undefined indicates the value hasn't been changed by the user yet
  onSubscriptionIdChanged: (string) => void;
  managedApp?: AzureManagedAppCoordinates;
  onManagedAppSelected: (AzureManagedAppCoordinates) => void;
};

const managedAppsToOptions = (apps: AzureManagedAppCoordinates[]) =>
  _.map((application) => {
    return {
      value: application,
      label: application.region
        ? `${application.applicationDeploymentName} (${getRegionLabel(application.region)})`
        : application.applicationDeploymentName,
    };
  }, apps);

// @ts-ignore
validate.validators.type.types.uuid = (value) => validateUuid(value);
// @ts-ignore
validate.validators.type.messages.uuid = 'must be a UUID';

const AzureManagedAppCoordinatesSelect = Select as typeof Select<AzureManagedAppCoordinates>;

export const AzureSubscriptionStep = ({ isActive, subscriptionId, ...props }: AzureSubscriptionStepProps) => {
  const getSubscriptionIdErrors = (subscriptionId) =>
    subscriptionId !== undefined && validate({ subscriptionId }, { subscriptionId: { type: 'uuid' } });

  const [subscriptionIdError, setSubscriptionIdError] = useState<ReactNode>();
  const [managedApps, setManagedApps] = useLoadedData<AzureManagedAppCoordinates[]>({
    onError: (state) => {
      // We can't rely on the formatting of the error, so show a generic message but include the error in the console for debugging purposes.
      if (state.error instanceof Response) {
        state.error.text().then(console.error);
      } else {
        console.error(state.error);
      }
      setSubscriptionIdError(<NoManagedApps />);
    },
  });
  const subscriptionIdInput = useRef<HTMLInputElement>();
  const subscriptionInputId = useUniqueId();
  const appSelectId = useUniqueId();
  const signal = useCancellation();

  useEffect(() => {
    // setTimeout necessary because of UIE-73.
    setTimeout(() => subscriptionIdInput.current?.focus(), 0);
  }, []);

  const subscriptionIdChanged = (v) => {
    const errors = summarizeErrors(getSubscriptionIdErrors(v)?.subscriptionId);
    setSubscriptionIdError(errors);
    props.onSubscriptionIdChanged(v);

    if (!!v && !errors) {
      setManagedApps(async () => {
        setSubscriptionIdError(undefined);
        const response = await Billing(signal).listAzureManagedApplications(v, false);
        const managedApps = response.managedApps;
        if (managedApps.length === 0) {
          setSubscriptionIdError(<NoManagedApps />);
        }
        return managedApps;
      });
    }
  };

  return (
    <Step isActive={isActive} style={{ minHeight: '18rem', paddingBottom: '0.5rem' }}>
      <StepHeader title='STEP 1' />
      <StepFields style={{ flexDirection: 'column' }}>
        <StepFieldLegend>
          {
            'Link Terra to an unassigned managed application in your Azure subscription. A managed application instance can only be assigned to a single Terra billing project. '
          }
          <ExternalLink
            url='https://support.terra.bio/hc/en-us/articles/12029032057371'
            text='See documentation with detailed instructions'
            popoutSize={16}
          />
        </StepFieldLegend>
        <p style={legendDetailsStyle}>
          {'Need to access your Azure Subscription ID, or to find or create your managed application? '}
          <ExternalLink text='Go to the Azure Portal' url='https://portal.azure.com/' />
        </p>
        <div style={rowStyle}>
          <LabeledField
            style={columnEntryStyle(true)}
            label='Enter your Azure subscription ID'
            formId={subscriptionInputId}
            required
          >
            <ValidatedInputWithRef
              inputProps={{
                id: subscriptionInputId,
                placeholder: 'Azure Subscription ID',
                onChange: subscriptionIdChanged,
                value: subscriptionId ?? '',
              }}
              ref={subscriptionIdInput}
              error={subscriptionIdError}
            />
          </LabeledField>

          <LabeledField
            formId={appSelectId}
            required
            style={columnEntryStyle(false)}
            label={['Unassigned managed application']}
          >
            <AzureManagedAppCoordinatesSelect
              id={appSelectId}
              placeholder='Select a managed application'
              isMulti={false}
              isDisabled={managedApps.status !== 'Ready' || !!subscriptionIdError}
              value={props.managedApp || null}
              onChange={(option) => {
                props.onManagedAppSelected(option!.value);
              }}
              options={managedApps.status === 'Ready' ? managedAppsToOptions(managedApps.state) : []}
            />
          </LabeledField>
        </div>
      </StepFields>
      {managedApps.status === 'Loading' && <SpinnerOverlay mode='FullScreen' />}
    </Step>
  );
};

const NoManagedApps = () => (
  <div key='message'>
    {'No Terra Managed Applications exist for that subscription. '}
    <Link
      href='https://portal.azure.com/#view/Microsoft_Azure_Marketplace/MarketplaceOffersBlade/selectedMenuItemId/home'
      {...Utils.newTabLinkProps}
    >
      Go to the Azure Marketplace
    </Link>
    {' to create a Terra Managed Application.'}
  </div>
);
