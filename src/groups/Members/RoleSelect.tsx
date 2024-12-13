import { Select, useUniqueId } from '@terra-ui-packages/components';
import React from 'react';
import { FormLabel } from 'src/libs/forms';

interface RoleSelectProps {
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: () => void;
}

export const RoleSelect: React.FC<RoleSelectProps> = ({ placeholder = 'Select Role', options, value, onChange }) => {
  const roleSelectId = useUniqueId();

  return (
    <>
      <FormLabel id={roleSelectId}>&nbsp;</FormLabel>
      <Select id={roleSelectId} aria-label={placeholder} options={options} value={value} onChange={onChange} />
    </>
  );
};
