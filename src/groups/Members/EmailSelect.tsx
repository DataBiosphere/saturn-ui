import { CreatableSelect, useUniqueId } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React, { useState } from 'react';
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
  isClearable = true,
  isSearchable = true,
  options,
  emails,
  setEmails,
}) => {
  const [searchValue, setSearchValue] = useState<string>('');

  const emailInputId = useUniqueId();
  const emptySearchValue = (searchValue: string) => searchValue === '';
  const addSelectedOptions = (options: string[]) => {
    const selectedOptions: string[] = _.flatMap(
      (option) =>
        option
          .split(',')
          .map((email) => email.trim())
          .filter((email) => email !== ''),
      options
    );
    const newEmail: string | undefined = _.find((email: string) => !emails.includes(email), selectedOptions);
    if (newEmail || newEmail === undefined) {
      setEmails(selectedOptions);
    }
    setSearchValue('');
  };

  const handleOnInputChange = (inputValue: any) => {
    !emptySearchValue(inputValue) && setSearchValue(inputValue);
  };

  const handleOnBlur = () => {
    !emptySearchValue(searchValue) && addSelectedOptions([...emails, searchValue]);
  };

  const handleOnChange = (options: Array<{ value: string; label: string }>) => {
    addSelectedOptions(_.map((option) => option.value, options));
  };

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
        onInputChange={handleOnInputChange}
        onBlur={handleOnBlur}
        onChange={handleOnChange}
        height={200}
      />
    </>
  );
};
