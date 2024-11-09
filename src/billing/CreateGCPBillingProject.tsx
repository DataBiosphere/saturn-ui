import { useUniqueId } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { useState } from 'react';
import { billingProjectNameValidator } from 'src/billing/utils';
import { GoogleBillingAccount } from 'src/billing-core/models';
import { VirtualizedSelect } from 'src/components/common';
import { ValidatedInput } from 'src/components/input';
import { Metrics } from 'src/libs/ajax/Metrics';
import Events from 'src/libs/events';
import { formHint, FormLabel } from 'src/libs/forms';
import * as Utils from 'src/libs/utils';
import validate from 'validate.js';

interface CreateGCPBillingProjectProps {
  billingAccounts: Record<string, GoogleBillingAccount>;
  chosenBillingAccount?: GoogleBillingAccount;
  setChosenBillingAccount: (arg: GoogleBillingAccount) => void;
  billingProjectName?: string;
  setBillingProjectName: (arg: string) => void;
  existing: string[];
  disabled?: boolean;
}

const CreateGCPBillingProject = ({
  billingAccounts,
  chosenBillingAccount,
  setChosenBillingAccount,
  billingProjectName,
  setBillingProjectName,
  existing,
  disabled = false,
}: CreateGCPBillingProjectProps) => {
  const [billingProjectNameTouched, setBillingProjectNameTouched] = useState(false);

  const errors = validate({ billingProjectName }, { billingProjectName: billingProjectNameValidator(existing) });
  const billingProjectNameInputId = useUniqueId('project');
  const billingAccountSelectInputId = useUniqueId('account');

  return (
    <>
      <FormLabel htmlFor={billingProjectNameInputId} required>
        Terra billing project
      </FormLabel>
      <ValidatedInput
        inputProps={{
          id: billingProjectNameInputId,
          autoFocus: true,
          value: billingProjectName,
          placeholder: 'Enter a name',
          onChange: (v) => {
            setBillingProjectName(v);
            if (!billingProjectNameTouched) {
              void Metrics().captureEvent(Events.billingCreationGCPProjectNameEntered);
            }
            setBillingProjectNameTouched(true);
          },
          disabled,
        }}
        error={billingProjectNameTouched && Utils.summarizeErrors(errors?.billingProjectName)}
      />
      {!(billingProjectNameTouched && errors) && formHint('Name must be unique and cannot be changed.')}
      <FormLabel htmlFor={billingAccountSelectInputId} required>
        Select billing account
      </FormLabel>
      <div style={{ fontSize: 14 }}>
        <VirtualizedSelect
          id={billingAccountSelectInputId}
          isMulti={false}
          placeholder='Select a billing account'
          value={chosenBillingAccount || null}
          onChange={(opt: { value: GoogleBillingAccount; label: string }) => {
            setChosenBillingAccount(opt!.value);
            void Metrics().captureEvent(Events.billingCreationGCPBillingAccountSelected);
          }}
          options={_.map((account) => {
            return {
              value: account,
              label: account.displayName,
            };
          }, billingAccounts)}
          isDisabled={disabled}
        />
      </div>
    </>
  );
};

export default CreateGCPBillingProject;
