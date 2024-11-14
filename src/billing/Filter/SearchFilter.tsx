import { useUniqueId } from '@terra-ui-packages/components';
import React, { ChangeEvent } from 'react';
import { FormLabel } from 'src/libs/forms';

interface SearchFilterProps {
  label?: string;
  placeholder?: string;
  style?: React.CSSProperties;
  onChange?: (value: string) => void;
}

export const SearchFilter = (props: SearchFilterProps) => {
  const inputId = useUniqueId('input');
  const { label, placeholder, style, onChange } = props;

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(event.target.value);
    }
  };

  return (
    <div style={style}>
      <FormLabel htmlFor={inputId}>{label}</FormLabel>
      <input
        id={inputId}
        placeholder={placeholder}
        style={{ padding: '0.6rem', width: '100%' }}
        onChange={handleInputChange}
      />
    </div>
  );
};
