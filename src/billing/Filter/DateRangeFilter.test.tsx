import { fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { DateRangeFilter } from 'src/billing/Filter/DateRangeFilter';
import { renderWithAppContexts } from 'src/testing/test-utils';

describe('DateRangeFilter', () => {
  const label = 'Date Range';
  const rangeOptions = [7, 30, 90];
  const defaultValue = 30;
  const onChange = jest.fn();

  it('renders correctly with given props', () => {
    renderWithAppContexts(
      <DateRangeFilter label={label} rangeOptions={rangeOptions} defaultValue={defaultValue} onChange={onChange} />
    );

    expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
  });

  it('calls onChange when a different option is selected', async () => {
    renderWithAppContexts(
      <DateRangeFilter label={label} rangeOptions={rangeOptions} defaultValue={defaultValue} onChange={onChange} />
    );

    fireEvent.change(screen.getByLabelText(label), { target: { value: 7 } });
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
  });
});
