import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { SearchFilter } from './SearchFilter';

describe('SearchFilter', () => {
  test('renders the label and input', () => {
    render(<SearchFilter label='Search' placeholder='Type here...' />);

    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type here...')).toBeInTheDocument();
  });

  test('calls onChange when input value changes', () => {
    const handleChange = jest.fn();
    render(<SearchFilter onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test' } });

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith('test');
  });

  test('applies custom styles', () => {
    const style = { backgroundColor: 'red' };
    render(<SearchFilter style={style} />);

    const inputContainer = screen.getByRole('textbox').parentElement;
    expect(inputContainer).toHaveStyle('background-color: red');
  });
});
