import { CreatableSelect, useUniqueId } from '@terra-ui-packages/components';
import React from 'react';
import { FormLabel } from 'src/libs/forms';

interface EmailSelectProps {
  label?: string;
  placeholder?: string;
  isMulti?: boolean;
  isClearable?: boolean;
  isSearchable?: boolean;
  options: Array<{ value: string; label: string }>;
  values: Array<{ value: string; label: string }>;
  onChange: (data: Array<{ value: string; label: string }>) => void;
}

export const EmailSelect: React.FC<EmailSelectProps> = ({
  label = 'User emails',
  placeholder = 'Type or select user emails',
  isMulti = true,
  isClearable = false,
  isSearchable = true,
  options,
  values,
  onChange,
}) => {
  const emailInputId = useUniqueId();

  return (
    <>
      <FormLabel id={emailInputId} required>
        {label}
      </FormLabel>
      <CreatableSelect
        id={emailInputId}
        isMulti={isMulti}
        isClearable={isClearable}
        isSearchable={isSearchable}
        placeholder={placeholder}
        aria-label={placeholder}
        value={values}
        onChange={onChange}
        options={options}
      />
    </>
  );
};
