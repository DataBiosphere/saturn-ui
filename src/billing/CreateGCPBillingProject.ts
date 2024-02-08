import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import { billingProjectNameValidator } from 'src/billing/utils';
import { GoogleBillingAccount } from 'src/billing-core/models';
import { IdContainer, VirtualizedSelect } from 'src/components/common';
import { ValidatedInput } from 'src/components/input';
import { Ajax } from 'src/libs/ajax';
import Events from 'src/libs/events';
import { formHint, FormLabel } from 'src/libs/forms';
import * as Utils from 'src/libs/utils';
import validate from 'validate.js';

interface CreateGCPBillingProjectProps {
  billingAccounts: Record<string, GoogleBillingAccount>;
  chosenBillingAccount?: GoogleBillingAccount;
  setChosenBillingAccount: (BillingAccount) => void;
  billingProjectName?: string;
  setBillingProjectName: (string) => void;
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

  return h(Fragment, [
    h(IdContainer, [
      (id) =>
        h(Fragment, [
          h(FormLabel, { htmlFor: id, required: true }, ['Terra billing project']),
          h(ValidatedInput, {
            inputProps: {
              id,
              autoFocus: true,
              value: billingProjectName,
              placeholder: 'Enter a name',
              onChange: (v) => {
                setBillingProjectName(v);
                if (!billingProjectNameTouched) {
                  Ajax().Metrics.captureEvent(Events.billingCreationGCPProjectNameEntered);
                }
                setBillingProjectNameTouched(true);
              },
              disabled,
            },
            error: billingProjectNameTouched && Utils.summarizeErrors(errors?.billingProjectName),
          }),
        ]),
    ]),
    !(billingProjectNameTouched && errors) && formHint('Name must be unique and cannot be changed.'),
    h(IdContainer, [
      (id) =>
        h(Fragment, [
          h(FormLabel, { htmlFor: id, required: true }, ['Select billing account']),
          div({ style: { fontSize: 14 } }, [
            h(VirtualizedSelect, {
              id,
              isMulti: false,
              placeholder: 'Select a billing account',
              value: chosenBillingAccount || null,
              onChange: (opt) => {
                setChosenBillingAccount(opt!.value);
                Ajax().Metrics.captureEvent(Events.billingCreationGCPBillingAccountSelected);
              },
              options: _.map((account) => {
                return {
                  value: account,
                  label: account.displayName,
                };
              }, billingAccounts),
              isDisabled: disabled,
            }),
          ]),
        ]),
    ]),
  ]);
};

export default CreateGCPBillingProject;
