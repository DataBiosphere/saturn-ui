import { Select, useUniqueId } from '@terra-ui-packages/components';
import _ from 'lodash';
import React from 'react';
import { FormLabel } from 'src/libs/forms';

interface DateRangeFilterProps {
  label: string;
  rangeOptions: number[];
  defaultValue: number;
  style?: React.CSSProperties;
  onChange?: (selectedDays: number) => void;
}

export const DateRangeFilter = (props: DateRangeFilterProps) => {
  const selectId = useUniqueId('select');
  const { label, rangeOptions, defaultValue, style, onChange } = props;
  let selectedValue = defaultValue;

  return (
    <div>
      <FormLabel htmlFor={selectId}>{label}</FormLabel>
      <Select<number>
        id={selectId}
        value={selectedValue}
        options={_.map(rangeOptions, (days) => ({
          label: `Last ${days} days`,
          value: days,
        }))}
        onChange={(selectedOption) => {
          const selectedDays = selectedOption!.value;
          if (selectedDays !== selectedValue) {
            selectedValue = selectedDays;
            onChange?.(selectedDays);
          }
        }}
        {...style}
      />
    </div>
  );
};
