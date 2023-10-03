import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { h } from 'react-hyperscript-helpers';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

import Register from './Register';

jest.mock('src/libs/ajax', () => ({
  ...jest.requireActual('src/libs/ajax'),
  Ajax: jest.fn(),
}));

jest.mock('src/libs/auth', () => ({
  ...jest.requireActual('src/libs/auth'),
  signOut: jest.fn(),
}));

describe('Register', () => {
  it('requires Organization, Department, and Title if the checkbox is unchecked', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    const { container } = render(h(Register));
    await user.type(screen.getByLabelText(/First Name/), 'Test Name');
    await user.type(screen.getByLabelText(/Last Name/), 'Test Last Name');
    await user.type(screen.getByLabelText(/Contact Email for Notifications/), 'testemail@noreply.com');
    // Assert
    const registerButton = screen.getByText('Register');
    // expect(registerButton).toBeDisabled doesn't seem to work.
    expect(registerButton).toHaveAttribute('disabled');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('does not require Organization, Department, and Title if the checkbox is checked', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    render(h(Register));
    await user.type(screen.getByLabelText(/First Name/), 'Test Name');
    await user.type(screen.getByLabelText(/Last Name/), 'Test Last Name');
    await user.type(screen.getByLabelText(/Contact Email for Notifications/), 'testemail@noreply.com');
    await user.click(screen.getByLabelText('I am not a part of an organization'));

    // Assert
    const registerButton = screen.getByText('Register');
    expect(registerButton).not.toHaveAttribute('disabled');
  });

  it('allows registration if Organization, Department, and Title are filled out', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    const { container } = render(h(Register));
    await user.type(screen.getByLabelText(/First Name/), 'Test Name');
    await user.type(screen.getByLabelText(/Last Name/), 'Test Last Name');
    await user.type(screen.getByLabelText(/Contact Email for Notifications/), 'testemail@noreply.com');
    await user.type(screen.getByLabelText(/Organization/), 'Test Organization');
    await user.type(screen.getByLabelText(/Department/), 'Test Department');
    await user.type(screen.getByLabelText(/Title/), 'Test Title');

    // Assert
    const registerButton = screen.getByText('Register');
    expect(registerButton).not.toHaveAttribute('disabled');
    expect(await axe(container)).toHaveNoViolations();
  });
});
