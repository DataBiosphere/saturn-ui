import { Select, useUniqueId } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import React from 'react';
import { FormLabel } from 'src/libs/forms';
import { normalizeLabel } from 'src/libs/utils';

interface RoleSelectProps {
  placeholder?: string;
  options: string[];
  role: string;
  setRole: (value: any) => void;
}

export const RoleSelect: React.FC<RoleSelectProps> = ({ placeholder = 'Select Role', options, role, setRole }) => {
  const roleSelectId = useUniqueId();

  return (
    <>
      <FormLabel id={roleSelectId}>&nbsp;</FormLabel>
      <Select
        id={roleSelectId}
        placeholder={placeholder}
        aria-label={placeholder}
        value={role}
        options={_.map((value: string) => ({ value, label: normalizeLabel(value) }), options)}
        onChange={(option) => setRole(option?.value)}
      />
    </>
  );
};
