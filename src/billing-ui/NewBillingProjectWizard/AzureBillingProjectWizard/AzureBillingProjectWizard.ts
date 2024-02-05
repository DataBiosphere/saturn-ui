import _ from 'lodash/fp';
import { Fragment, ReactNode, useEffect, useState } from 'react';
import { h } from 'react-hyperscript-helpers';
import { AzureManagedAppCoordinates } from 'src/billing-logic/AzureManagedAppCoordinates';
import { BillingRole } from 'src/billing-logic/BillingProject';
import { billingProjectNameValidator } from 'src/billing-logic/utils';
import { AddUsersStep } from 'src/billing-ui/NewBillingProjectWizard/AzureBillingProjectWizard/AddUsersStep';
import { AzureSubscriptionStep } from 'src/billing-ui/NewBillingProjectWizard/AzureBillingProjectWizard/AzureSubscriptionStep';
import { CreateNamedProjectStep } from 'src/billing-ui/NewBillingProjectWizard/AzureBillingProjectWizard/CreateNamedProjectStep';
import { ProtectedDataStep } from 'src/billing-ui/NewBillingProjectWizard/AzureBillingProjectWizard/ProtectedDataStep';
import { StepWizard } from 'src/billing-ui/NewBillingProjectWizard/StepWizard/StepWizard';
import { customSpinnerOverlay } from 'src/components/common';
import { Ajax } from 'src/libs/ajax';
import { reportErrorAndRethrow } from 'src/libs/error';
import Events from 'src/libs/events';
import { useOnMount } from 'src/libs/react-utils';
import * as Utils from 'src/libs/utils';
import { summarizeErrors, withBusyState } from 'src/libs/utils';
import { validate } from 'validate.js';

interface AzureBillingProjectWizardProps {
  onSuccess: (string, boolean) => void;
}

export const userInfoListToProjectAccessObjects = (
  emails: string,
  role: BillingRole
): Array<{ email: string; role: BillingRole }> => {
  if (emails.trim() === '') {
    return [];
  }
  return _.flatten(emails.split(',').map((email) => ({ email: email.trim(), role })));
};

export const AzureBillingProjectWizard = ({ onSuccess }: AzureBillingProjectWizardProps) => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [subscriptionId, setSubscriptionId] = useState<string>();
  // undefined used to indicate that the user has not yet typed in the input (don't want to show error)
  const [billingProjectName, setBillingProjectName] = useState<string | undefined>(undefined);
  const [userEmails, setUserEmails] = useState({ emails: '', hasError: false });
  const [ownerEmails, setOwnerEmails] = useState({ emails: '', hasError: false });
  // undefined used to indicate that the user has not yet made a selection
  const [addUsersOrOwners, setAddUsersOrOwners] = useState<boolean | undefined>(undefined);
  const [managedApp, setManagedApp] = useState<AzureManagedAppCoordinates>();
  const [protectedData, setProtectedData] = useState<boolean | undefined>(undefined);

  const [existingProjectNames, setExistingProjectNames] = useState<string[]>([]);
  const [projectNameErrors, setProjectNameErrors] = useState<ReactNode>();

  const [isBusy, setIsBusy] = useState(false);

  const createBillingProject = _.flow(
    withBusyState(setIsBusy),
    reportErrorAndRethrow('Error creating billing project')
  )(async () => {
    if (!billingProjectName) return;
    try {
      const users = userInfoListToProjectAccessObjects(userEmails.emails, 'User');
      const owners = userInfoListToProjectAccessObjects(ownerEmails.emails, 'Owner');
      const members = _.concat(users, owners);
      await Ajax().Billing.createAzureProject(
        billingProjectName,
        // managedApp and subscriptionId are set in previous steps before this function is called.
        managedApp!.tenantId,
        subscriptionId!,
        managedApp!.managedResourceGroupId,
        members,
        !!protectedData
      );
      onSuccess(billingProjectName, protectedData);
      // No need to event success, as that is done in the onSuccess callback
    } catch (error: any) {
      if (error?.status === 409) {
        setExistingProjectNames(_.concat(billingProjectName, existingProjectNames));
        Ajax().Metrics.captureEvent(Events.billingAzureCreationProjectCreateFail, { existingName: true });
      } else {
        Ajax().Metrics.captureEvent(Events.billingAzureCreationProjectCreateFail, { existingName: false });
        throw error;
      }
    }
  });

  useEffect(() => {
    let isMounted = true; // Necessary to avoid React warning about updates in unmounted component after project created.
    if (isMounted) {
      const errors = Utils.cond<ReactNode>(
        [
          !!billingProjectName,
          () =>
            summarizeErrors(
              validate(
                { billingProjectName },
                { billingProjectName: billingProjectNameValidator(existingProjectNames) }
              )?.billingProjectName
            ),
        ],
        [billingProjectName !== undefined, () => 'A name is required to create a billing project.'],
        [Utils.DEFAULT, () => undefined]
      );
      setProjectNameErrors(errors);
    }
    return () => {
      isMounted = true;
    };
  }, [billingProjectName, existingProjectNames]);

  useOnMount(() => {
    Ajax().Metrics.captureEvent(Events.billingAzureCreationSubscriptionStep);
  });

  const stepFinished = (step: number, finished: boolean) => {
    if (finished && activeStep === step) {
      // the user completed the active step
      setActiveStep(step + 1);
    } else if (!finished && activeStep > step) {
      // the user went back
      setActiveStep(step);
    } // the user is entering fields for later steps - don't change active step
  };

  const onManagedAppSelected = (managedApp) => {
    stepFinished(1, !!managedApp);
    setManagedApp(managedApp);
    if (managedApp) {
      Ajax().Metrics.captureEvent(Events.billingAzureCreationMRGSelected);
    }
  };

  const step1HasNoErrors = !!subscriptionId && !!managedApp;
  const step2HasNoErrors = protectedData !== undefined;
  const step3HasNoErrors =
    addUsersOrOwners === false ||
    (addUsersOrOwners === true &&
      !ownerEmails.hasError &&
      !userEmails.hasError &&
      (ownerEmails.emails.trim().length > 0 || userEmails.emails.trim().length > 0));

  return h(Fragment, [
    h(
      StepWizard,
      {
        title: 'Link an Azure Subscription to Terra',
        intro: `The linked subscription is required to cover all Azure data storage, compute and egress costs incurred in a Terra workspace.
        Cloud costs are billed directly from Azure and passed through Terra billing projects with no markup.`,
      },
      [
        h(AzureSubscriptionStep, {
          isActive: activeStep === 1,
          subscriptionId,
          onSubscriptionIdChanged: (subscriptionId) => {
            stepFinished(1, false);
            setSubscriptionId(subscriptionId);
            onManagedAppSelected(undefined);
          },
          managedApp,
          onManagedAppSelected,
        }),
        h(ProtectedDataStep, {
          isActive: activeStep === 2,
          protectedData,
          onSetProtectedData: (protectedData) => {
            stepFinished(2, true);
            setProtectedData(protectedData);
            Ajax().Metrics.captureEvent(
              protectedData
                ? Events.billingAzureCreationProtectedDataSelected
                : Events.billingAzureCreationProtectedDataNotSelected
            );
          },
        }),
        h(AddUsersStep, {
          userEmails: userEmails.emails,
          ownerEmails: ownerEmails.emails,
          addUsersOrOwners,
          onAddUsersOrOwners: (addUsersOrOwners) => {
            stepFinished(3, !addUsersOrOwners);
            setAddUsersOrOwners(addUsersOrOwners);
            Ajax().Metrics.captureEvent(
              addUsersOrOwners ? Events.billingAzureCreationWillAddUsers : Events.billingAzureCreationNoUsersToAdd
            );
          },
          onSetUserEmails: (emails, hasError) => {
            stepFinished(3, false);
            setUserEmails({ emails, hasError });
          },
          onSetOwnerEmails: (emails, hasError) => {
            stepFinished(3, false);
            setOwnerEmails({ emails, hasError });
          },
          onOwnersOrUsersInputFocused: () => {
            stepFinished(3, false);
          },
          isActive: activeStep === 3,
        }),
        h(CreateNamedProjectStep, {
          billingProjectName: billingProjectName ?? '',
          onBillingProjectNameChanged: (billingProjectName) => {
            setBillingProjectName(billingProjectName);
          },
          onBillingProjectInputFocused: () => {
            if (step1HasNoErrors && step2HasNoErrors && step3HasNoErrors) {
              stepFinished(3, true);
              Ajax().Metrics.captureEvent(Events.billingAzureCreationProjectNameStep);
            }
          },
          createBillingProject,
          projectNameErrors,
          isActive: activeStep === 4,
          createReady:
            step1HasNoErrors &&
            step2HasNoErrors &&
            step3HasNoErrors &&
            !!billingProjectName &&
            !projectNameErrors &&
            !isBusy,
        }),
      ]
    ),
    isBusy && customSpinnerOverlay({ height: '100vh', width: '100vw', position: 'fixed' }),
  ]);
};
