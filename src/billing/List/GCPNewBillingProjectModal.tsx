import { Icon, Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { useState } from 'react';
import CreateGCPBillingProject from 'src/billing/CreateGCPBillingProject';
import { billingProjectNameValidator } from 'src/billing/utils';
import { GoogleBillingAccount } from 'src/billing-core/models';
import { ButtonPrimary, Link, spinnerOverlay } from 'src/components/common';
import { Billing } from 'src/libs/ajax/billing/Billing';
import colors from 'src/libs/colors';
import { reportErrorAndRethrow } from 'src/libs/error';
import { getTerraUser } from 'src/libs/state';
import * as Utils from 'src/libs/utils';
import { validate } from 'validate.js';

interface GCPNewBillingProjectModalProps {
  billingAccounts: Record<string, GoogleBillingAccount>;
  onSuccess: (string) => void;
  onDismiss: () => void;
  loadAccounts: () => void;
}

export const GCPNewBillingProjectModal = (props: GCPNewBillingProjectModalProps) => {
  const [billingProjectName, setBillingProjectName] = useState('');
  const [existing, setExisting] = useState<string[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [chosenBillingAccount, setChosenBillingAccount] = useState<GoogleBillingAccount>();

  const submit = _.flow(
    reportErrorAndRethrow('Error creating billing project'),
    Utils.withBusyState(setIsBusy)
  )(async () => {
    try {
      // Submit is only enabled when choseBillingAccount is non-null.
      await Billing().createGCPProject(billingProjectName, chosenBillingAccount!.accountName);
      props.onSuccess(billingProjectName);
    } catch (error: any) {
      if (error?.status === 409) {
        setExisting(_.concat(billingProjectName, existing));
      } else {
        throw error;
      }
    }
  });

  const errors = validate({ billingProjectName }, { billingProjectName: billingProjectNameValidator(existing) });
  const billingLoadedAndEmpty = props.billingAccounts && _.isEmpty(props.billingAccounts);
  const billingPresent = !_.isEmpty(props.billingAccounts);

  return (
    <Modal
      onDismiss={props.onDismiss}
      shouldCloseOnOverlayClick={false}
      title='Create Terra Billing Project'
      showCancel={!billingLoadedAndEmpty}
      showButtons={!!props.billingAccounts}
      okButton={
        billingPresent ? (
          <ButtonPrimary
            disabled={errors || !chosenBillingAccount || !chosenBillingAccount.firecloudHasAccess}
            onClick={submit}
          >
            Create
          </ButtonPrimary>
        ) : (
          <ButtonPrimary onClick={props.onDismiss}>Ok</ButtonPrimary>
        )
      }
    >
      {billingLoadedAndEmpty && (
        <>
          {"You don't have access to any billing accounts.  "}
          <Link href='https://support.terra.bio/hc/en-us/articles/360026182251' {...Utils.newTabLinkProps}>
            Learn how to create a billing account.
            <Icon icon='pop-out' size={12} style={{ marginLeft: '0.5rem' }} />
          </Link>
        </>
      )}
      {billingPresent && (
        <>
          <CreateGCPBillingProject
            billingAccounts={props.billingAccounts}
            chosenBillingAccount={chosenBillingAccount}
            setChosenBillingAccount={setChosenBillingAccount}
            billingProjectName={billingProjectName}
            setBillingProjectName={setBillingProjectName}
            existing={existing}
          />
          {!!chosenBillingAccount && !chosenBillingAccount.firecloudHasAccess && (
            <div style={{ fontWeight: 500, fontSize: 13 }}>
              <div style={{ margin: '0.25rem 0 0.25rem 0', color: colors.danger() }}>
                Terra does not have access to this account.{' '}
              </div>
              <div style={{ marginBottom: '0.25rem' }}>
                To grant access, add <span style={{ fontWeight: 'bold' }}>terra-billing@terra.bio</span> as a{' '}
                <span style={{ fontWeight: 'bold' }}>Billing Account User</span> on the{' '}
                <Link
                  href={`https://console.cloud.google.com/billing/${
                    chosenBillingAccount.accountName.split('/')[1]
                  }?authuser=${getTerraUser().email}`}
                  {...Utils.newTabLinkProps}
                >
                  Google Cloud Console.
                  <Icon icon='pop-out' style={{ marginLeft: '0.25rem' }} size={12} />
                </Link>
              </div>
              <div style={{ marginBottom: '0.25rem' }}>
                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                Then, <Link onClick={props.loadAccounts}>click here</Link> to refresh your billing accounts.
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <Link href='https://support.terra.bio/hc/en-us/articles/360026182251' {...Utils.newTabLinkProps}>
                  Need help?
                  <Icon icon='pop-out' style={{ marginLeft: '0.25rem' }} size={12} />
                </Link>
              </div>
            </div>
          )}
        </>
      )}
      {(isBusy || !props.billingAccounts) && spinnerOverlay}
    </Modal>
  );
};
