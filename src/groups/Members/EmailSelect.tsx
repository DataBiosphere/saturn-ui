import { CreatableSelect, useUniqueId } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React from 'react';
import { FormLabel } from 'src/libs/forms';

interface EmailSelectProps {
  label?: string;
  placeholder?: string;
  isMulti?: boolean;
  isClearable?: boolean;
  isSearchable?: boolean;
  options: string[];
  emails: string[];
  setEmails: (values: string[]) => void;
}

export const EmailSelect: React.FC<EmailSelectProps> = ({
  label = 'User emails',
  placeholder = 'Type or select user emails',
  isMulti = true,
  isClearable = false,
  isSearchable = true,
  options,
  emails,
  setEmails,
}) => {
  const emailInputId = useUniqueId();

  return (
    <>
      <FormLabel id={emailInputId} required style={{ marginTop: '0.25rem' }}>
        {label}
      </FormLabel>
      <CreatableSelect
        id={emailInputId}
        isMulti={isMulti}
        isClearable={isClearable}
        isSearchable={isSearchable}
        placeholder={placeholder}
        aria-label={placeholder}
        value={_.map((value: string) => ({ value, label: value }), emails)}
        options={_.map((value: string) => ({ value, label: value }), options)}
        onChange={(option: Array<{ value: string; label: string }>) => {
          const selectedOption: string[] = _.map('value', option);
          const newEmail: string | undefined = _.find((email: string) => !emails.includes(email), selectedOption);
          if (newEmail || newEmail === undefined) {
            setEmails(selectedOption);
          }
        }}
      />
    </>
  );
};
