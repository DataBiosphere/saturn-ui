import { fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

import { EmailSelect } from './EmailSelect';

describe('EmailSelect', () => {
  const defaultProps = {
    label: 'User emails',
    placeholder: 'Type or select user emails',
    isMulti: true,
    isClearable: true,
    isSearchable: true,
    options: ['test1@example.com', 'test2@example.com'],
    emails: ['test1@example.com'],
    setEmails: jest.fn(),
  };

  it('renders the component with default props', () => {
    // Arrange
    render(<EmailSelect {...defaultProps} />);

    // Act
    const input = screen.getByLabelText(defaultProps.placeholder);
    const label = screen.getByText('User emails *');

    // Assert
    expect(input).toBeInTheDocument();
    expect(label).toBeInTheDocument();
  });

  it('calls setEmails when an email is selected', () => {
    // Arrange
    render(<EmailSelect {...defaultProps} />);
    const input = screen.getByLabelText(defaultProps.placeholder);

    // Act
    fireEvent.change(input, { target: { value: 'test2@example.com' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Assert
    expect(defaultProps.setEmails).toHaveBeenCalledWith(['test1@example.com', 'test2@example.com']);
  });

  it('calls setEmails when an email is removed', () => {
    // Arrange
    render(<EmailSelect {...defaultProps} />);
    const input = screen.getByLabelText(defaultProps.placeholder);

    // Act
    fireEvent.keyDown(input, { key: 'Backspace', code: 'Backspace' });

    // Assert
    expect(defaultProps.setEmails).toHaveBeenCalledWith([]);
  });

  it('renders the correct number of selected options', () => {
    // Arrange
    render(<EmailSelect {...defaultProps} />);
    const input = screen.getByLabelText(defaultProps.placeholder);

    // Act
    fireEvent.focus(input);
    const options = screen.getAllByRole('button'); // Each selected option has a remove button

    // Assert
    expect(options).toHaveLength(defaultProps.emails.length);
  });
});
