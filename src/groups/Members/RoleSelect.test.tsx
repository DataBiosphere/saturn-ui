import { fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

import { RoleSelect } from './RoleSelect';

describe('RoleSelect', () => {
  const options = ['Admin', 'User', 'Guest'];
  const role = '';
  const setRole = jest.fn();

  test('renders with default placeholder', () => {
    // Arrange
    render(<RoleSelect options={options} role={role} setRole={setRole} />);

    // Act
    const selectElement = screen.getByLabelText('Select Role');

    // Assert
    expect(selectElement).toBeInTheDocument();
  });

  test('renders with custom placeholder', () => {
    // Arrange
    render(<RoleSelect placeholder='Choose a role' options={options} role={role} setRole={setRole} />);

    // Act
    const selectElement = screen.getByLabelText('Choose a role');

    // Assert
    expect(selectElement).toBeInTheDocument();
  });

  test('displays options and selects a role', () => {
    // Arrange
    render(<RoleSelect options={options} role={role} setRole={setRole} />);

    // Act
    fireEvent.mouseDown(screen.getByLabelText('Select Role'));
    options.forEach((option) => {
      expect(screen.getByText(option)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('User'));

    // Assert
    expect(setRole).toHaveBeenCalledWith('User');
  });

  test('displays the selected role', () => {
    const adminRole = 'Admin';
    // Arrange
    render(<RoleSelect options={options} role={adminRole} setRole={setRole} />);

    // Act
    const selectedRole = screen.getByText('Admin');

    // Assert
    expect(selectedRole).toBeInTheDocument();
  });
});
