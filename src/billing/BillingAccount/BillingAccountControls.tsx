import { ButtonPrimary, Icon, Link, Modal, useUniqueId } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { useState } from 'react';
import * as Auth from 'src/auth/auth';
import { ExternalLink } from 'src/billing/NewBillingProjectWizard/StepWizard/ExternalLink';
import { accountLinkStyle } from 'src/billing/utils';
import { GCPBillingProject, GoogleBillingAccount } from 'src/billing-core/models';
import { VirtualizedSelect } from 'src/components/common';
import { TextInput } from 'src/components/input';
import { MenuButton } from 'src/components/MenuButton';
import { MenuTrigger } from 'src/components/PopupTrigger';
import { Billing } from 'src/libs/ajax/billing/Billing';
import { Metrics } from 'src/libs/ajax/Metrics';
import { reportErrorAndRethrow } from 'src/libs/error';
import Events, { extractBillingDetails } from 'src/libs/events';
import { FormLabel } from 'src/libs/forms';
import { useCancellation } from 'src/libs/react-utils';
import * as Utils from 'src/libs/utils';

interface BillingAccountControlsProps {
  authorizeAndLoadAccounts: () => Promise<void>;
  billingAccounts: Record<string, GoogleBillingAccount>;
  billingProject: GCPBillingProject;
  isOwner: boolean;
  getShowBillingModal: () => boolean;
  setShowBillingModal: (v: boolean) => void;
  reloadBillingProject: () => Promise<unknown>;
  setUpdating: (v: boolean) => void;
}
export const BillingAccountControls = (props: BillingAccountControlsProps) => {
  const {
    authorizeAndLoadAccounts,
    billingAccounts,
    billingProject,
    isOwner,
    getShowBillingModal,
    setShowBillingModal,
    reloadBillingProject,
    setUpdating,
  } = props;
  const [showBillingRemovalModal, setShowBillingRemovalModal] = useState(false);
  const [showSpendReportConfigurationModal, setShowSpendReportConfigurationModal] = useState(false);
  const [selectedBilling, setSelectedBilling] = useState();
  const [selectedDatasetProjectName, setSelectedDatasetProjectName] = useState(null);
  const [selectedDatasetName, setSelectedDatasetName] = useState(null);

  const signal = useCancellation();

  // Helpers
  const setBillingAccount = _.flow(
    reportErrorAndRethrow('Error updating billing account'),
    Utils.withBusyState(setUpdating)
  )((newAccountName) => {
    void Metrics().captureEvent(Events.billingChangeAccount, {
      oldName: billingProject.billingAccount,
      newName: newAccountName,
      ...extractBillingDetails(billingProject),
    });
    return Billing(signal).changeBillingAccount({
      billingProjectName: billingProject.projectName,
      newBillingAccountName: newAccountName,
    });
  });

  const removeBillingAccount = _.flow(
    reportErrorAndRethrow('Error removing billing account'),
    Utils.withBusyState(setUpdating)
  )(() => {
    void Metrics().captureEvent(Events.billingRemoveAccount, extractBillingDetails(billingProject));
    return Billing(signal).removeBillingAccount({
      billingProjectName: billingProject.projectName,
    });
  });

  const updateSpendConfiguration = _.flow(
    reportErrorAndRethrow('Error updating spend report configuration'),
    Utils.withBusyState(setUpdating)
  )(() => {
    void Metrics().captureEvent(Events.billingSpendConfigurationUpdated, {
      datasetGoogleProject: selectedDatasetProjectName,
      datasetName: selectedDatasetName,
      ...extractBillingDetails(billingProject),
    });
    // The option to update spend configuration is disabled if "!selectedDatasetProjectName || !selectedDatasetName".
    return Billing(signal).updateSpendConfiguration({
      billingProjectName: billingProject.projectName,
      datasetGoogleProject: selectedDatasetProjectName!,
      datasetName: selectedDatasetName!,
    });
  });

  // (CA-1586) For some reason the api sometimes returns string null, and sometimes returns no field, and sometimes returns null. This is just to be complete.
  const billingProjectHasBillingAccount = !(
    billingProject.billingAccount === 'null' || _.isNil(billingProject.billingAccount)
  );
  const billingAccount = billingProjectHasBillingAccount
    ? _.find({ accountName: billingProject.billingAccount }, billingAccounts)
    : undefined;

  const billingAccountDisplayText = Utils.cond(
    [!billingProjectHasBillingAccount, () => 'No linked billing account'],
    [!billingAccount, () => 'No access to linked billing account'],
    () => billingAccount!.displayName || billingAccount!.accountName
  );

  const billingAccountSelectId = useUniqueId('account-select-');
  const datasetProjectId = useUniqueId('dataset-project-');
  const datasetNameId = useUniqueId('dataset-name-');
  return (
    <>
      {Auth.hasBillingScope() && (
        <div style={accountLinkStyle}>
          <span style={{ flexShrink: 0, fontWeight: 600, fontSize: 14, margin: '0 0.75rem 0 0' }}>
            Billing Account:
          </span>
          <span style={{ flexShrink: 0, marginRight: '0.5rem' }}>{billingAccountDisplayText}</span>
          {isOwner && (
            <MenuTrigger
              closeOnClick
              side='bottom'
              style={{ marginLeft: '0.5rem' }}
              content={
                <>
                  <MenuButton
                    onClick={async () => {
                      if (Auth.hasBillingScope()) {
                        setShowBillingModal(true);
                      } else {
                        await authorizeAndLoadAccounts();
                        setShowBillingModal(Auth.hasBillingScope());
                      }
                    }}
                  >
                    Change Billing Account
                  </MenuButton>
                  <MenuButton
                    onClick={async () => {
                      if (Auth.hasBillingScope()) {
                        setShowBillingRemovalModal(true);
                      } else {
                        await authorizeAndLoadAccounts();
                        setShowBillingRemovalModal(Auth.hasBillingScope());
                      }
                    }}
                    disabled={!billingProjectHasBillingAccount}
                  >
                    Remove Billing Account
                  </MenuButton>
                </>
              }
            >
              {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
              <Link aria-label='Billing account menu' style={{ display: 'flex', alignItems: 'center' }}>
                <Icon icon='cardMenuIcon' size={16} aria-haspopup='menu' />
              </Link>
            </MenuTrigger>
          )}
          {getShowBillingModal() && (
            <Modal
              title='Change Billing Account'
              onDismiss={() => setShowBillingModal(false)}
              okButton={
                <ButtonPrimary
                  disabled={!selectedBilling || billingProject.billingAccount === selectedBilling}
                  onClick={() => {
                    setShowBillingModal(false);
                    setBillingAccount(selectedBilling).then(reloadBillingProject);
                  }}
                >
                  Ok
                </ButtonPrimary>
              }
            >
              <>
                <FormLabel htmlFor={billingAccountSelectId} required>
                  Select billing account
                </FormLabel>
                <VirtualizedSelect
                  id={billingAccountSelectId}
                  value={selectedBilling || billingProject.billingAccount}
                  isClearable={false}
                  options={_.map(
                    ({ displayName, accountName }) => ({ label: displayName, value: accountName }),
                    billingAccounts
                  )}
                  onChange={({ value: newAccountName }) => setSelectedBilling(newAccountName)}
                />
                <div style={{ marginTop: '1rem' }}>
                  Note: Changing the billing account for this billing project will clear the spend report configuration.
                </div>
              </>
            </Modal>
          )}
          {showBillingRemovalModal && (
            <Modal
              title='Remove Billing Account'
              onDismiss={() => setShowBillingRemovalModal(false)}
              okButton={
                <ButtonPrimary
                  onClick={() => {
                    setShowBillingRemovalModal(false);
                    removeBillingAccount().then(reloadBillingProject);
                  }}
                >
                  Ok
                </ButtonPrimary>
              }
            >
              <div style={{ marginTop: '1rem' }}>
                Are you sure you want to remove this billing project&apos;s billing account?
              </div>
            </Modal>
          )}
        </div>
      )}
      {Auth.hasBillingScope() && isOwner && (
        <div style={accountLinkStyle}>
          <span style={{ flexShrink: 0, fontWeight: 600, fontSize: 14, marginRight: '0.75rem' }}>
            Spend Report Configuration:
          </span>
          <span style={{ flexShrink: 0 }}>Edit</span>
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <Link
            tooltip='Configure Spend Reporting'
            style={{ marginLeft: '0.5rem' }}
            onClick={async () => {
              if (Auth.hasBillingScope()) {
                setShowSpendReportConfigurationModal(true);
              } else {
                await authorizeAndLoadAccounts();
                setShowSpendReportConfigurationModal(Auth.hasBillingScope());
              }
            }}
          >
            <Icon icon='edit' size={12} />
          </Link>
          {showSpendReportConfigurationModal && (
            <Modal
              title='Configure Spend Reporting'
              onDismiss={() => setShowSpendReportConfigurationModal(false)}
              okButton={
                <ButtonPrimary
                  disabled={!selectedDatasetProjectName || !selectedDatasetName}
                  onClick={async () => {
                    setShowSpendReportConfigurationModal(false);
                    await updateSpendConfiguration();
                  }}
                >
                  Ok
                </ButtonPrimary>
              }
            >
              <>
                <FormLabel htmlFor={datasetProjectId} required>
                  Dataset Project ID
                </FormLabel>
                <TextInput id={datasetProjectId} onChange={setSelectedDatasetProjectName} />
                <FormLabel htmlFor={datasetNameId} required>
                  Dataset Name
                </FormLabel>
                <TextInput id={datasetNameId} onChange={setSelectedDatasetName} />
                <div style={{ marginTop: '1rem' }}>
                  {'See '}
                  <Link href='https://support.terra.bio/hc/en-us/articles/360037862771' {...Utils.newTabLinkProps}>
                    our documentation
                  </Link>
                  {' for details on configuring spend reporting for billing projects'}
                </div>
              </>
            </Modal>
          )}
        </div>
      )}
      {!Auth.hasBillingScope() && (
        <>
          <div style={accountLinkStyle}>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <Link onClick={authorizeAndLoadAccounts}>View billing account</Link>
          </div>
          <div
            style={{
              marginLeft: '1rem',
              marginTop: '0.5rem',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <ExternalLink
              url='https://support.terra.bio/hc/en-us/articles/360057589931-How-to-set-up-and-use-Google-Cloud-budget-alerts'
              text='Learn how to set up budget alerts to monitor cloud spend'
              popoutSize={14}
            />
          </div>
        </>
      )}
    </>
  );
};
