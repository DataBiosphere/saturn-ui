import { act, fireEvent, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { h } from 'react-hyperscript-helpers';
import { signOut } from 'src/auth/signout/sign-out';
import { loadTerraUser } from 'src/auth/user-profile/user';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { TermsOfService, TermsOfServiceContract } from 'src/libs/ajax/TermsOfService';
import { SamUserResponse, User, UserContract, UserProfileContract } from 'src/libs/ajax/User';
import { TerraUserProfile } from 'src/libs/state';
import { asMockedFn, MockedFn, partial, renderWithAppContexts as render } from 'src/testing/test-utils';

import { Register } from './Register';

jest.mock('src/libs/ajax/Metrics');
jest.mock('src/libs/ajax/TermsOfService');
jest.mock('src/libs/ajax/User');

jest.mock('src/auth/signout/sign-out', () => ({
  ...jest.requireActual('src/auth/signout/sign-out'),
  signOut: jest.fn(),
  userSignedOut: jest.fn(),
}));

jest.mock('src/auth/user-profile/user', () => ({
  ...jest.requireActual('src/auth/user-profile/user'),
  loadTerraUser: jest.fn(),
}));

jest.mock('react-notifications-component', () => {
  return {
    Store: {
      addNotification: jest.fn(),
      removeNotification: jest.fn(),
    },
  };
});

const fillInPersonalInfo = (): void => {
  fireEvent.change(screen.getByLabelText(/First Name/), { target: { value: 'Test Name' } });
  fireEvent.change(screen.getByLabelText(/Last Name/), { target: { value: 'Test Last Name' } });
  fireEvent.change(screen.getByLabelText(/Contact Email for Notifications/), {
    target: { value: 'ltcommanderdata@neighborhood.horse' },
  });
};
const fillInOrgInfo = (): void => {
  fireEvent.change(screen.getByLabelText(/Organization/), { target: { value: 'Test Organization' } });
  fireEvent.change(screen.getByLabelText(/Department/), { target: { value: 'Test Department' } });
  fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Test Title' } });
};
const acceptTermsOfService = (): void => {
  const getTermsOfServiceText: MockedFn<TermsOfServiceContract['getTermsOfServiceText']> = jest.fn();
  getTermsOfServiceText.mockResolvedValue('Terra Terms of Service');
  asMockedFn(TermsOfService).mockReturnValue(partial<TermsOfServiceContract>({ getTermsOfServiceText }));

  fireEvent.click(screen.getByText('Read Terra Platform Terms of Service here'));

  fireEvent.click(screen.getByText('OK'));
  fireEvent.click(screen.getByLabelText('By checking this box, you are agreeing to the Terra Terms of Service'));
};

describe('Register', () => {
  describe('Organization, Department, and Title fields', () => {
    it('requires Organization, Department, and Title if the checkbox is unchecked', async () => {
      // Arrange
      // Act
      const { container } = render(h(Register));
      fillInPersonalInfo();
      acceptTermsOfService();

      // Assert
      const registerButton = screen.getByText('Register');
      // expect(registerButton).toBeDisabled doesn't seem to work.
      expect(registerButton).toHaveAttribute('disabled');
      expect(await axe(container)).toHaveNoViolations();
    });

    it('does not require Organization, Department, and Title if the checkbox is checked', async () => {
      // Arrange
      // Act
      render(h(Register));
      fillInPersonalInfo();
      fireEvent.click(screen.getByLabelText('I am not a part of an organization'));
      acceptTermsOfService();

      // Assert
      const registerButton = screen.getByText('Register');
      expect(registerButton).not.toHaveAttribute('disabled');
    });

    it('allows registration if Organization, Department, and Title are filled out', async () => {
      // Arrange
      // Act
      const { container } = render(h(Register));
      fillInPersonalInfo();
      fillInOrgInfo();
      acceptTermsOfService();

      // Assert
      const registerButton = screen.getByText('Register');
      expect(registerButton).not.toHaveAttribute('disabled');
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('Marketing Communications checkbox', () => {
    it('defaults the marketing communications checkbox to true', async () => {
      // Arrange
      // Act
      render(h(Register));
      // Assert
      const commsCheckbox = screen.getByLabelText(/Marketing communications.*/);
      expect(commsCheckbox.getAttribute('aria-checked')).toBe('true');
    });
  });

  describe('Terms of Service', () => {
    it('disables the terms of service checkbox if the user has not read the terms of service', async () => {
      // Arrange
      // Act
      render(h(Register));
      fillInPersonalInfo();
      fillInOrgInfo();

      // Assert
      const termsOfServiceCheckbox = screen.getByLabelText(
        'By checking this box, you are agreeing to the Terra Terms of Service'
      );
      expect(termsOfServiceCheckbox).toHaveAttribute('disabled');
      const registerButton = screen.getByText('Register');
      expect(registerButton).toHaveAttribute('disabled');
    });
    it('enables the terms of service checkbox if the user has read the terms of service', async () => {
      // Arrange
      const getTermsOfServiceText: MockedFn<TermsOfServiceContract['getTermsOfServiceText']> = jest.fn();
      getTermsOfServiceText.mockResolvedValue('Terra Terms of Service');
      // Act
      render(h(Register));
      fillInPersonalInfo();
      fillInOrgInfo();
      asMockedFn(TermsOfService).mockReturnValue(partial<TermsOfServiceContract>({ getTermsOfServiceText }));

      fireEvent.click(screen.getByText('Read Terra Platform Terms of Service here'));

      fireEvent.click(screen.getByText('OK'));

      // Assert
      expect(getTermsOfServiceText).toHaveBeenCalled();
      const termsOfServiceCheckbox = screen.getByLabelText(
        'By checking this box, you are agreeing to the Terra Terms of Service'
      );
      expect(termsOfServiceCheckbox).not.toHaveAttribute('disabled');
      const registerButton = screen.getByText('Register');
      expect(registerButton).toHaveAttribute('disabled');
    });
    it('enables the register button if the user has accepted the terms of service', async () => {
      // Arrange
      // Act
      render(h(Register));
      fillInPersonalInfo();
      fillInOrgInfo();
      asMockedFn(TermsOfService).mockReturnValue(
        partial<TermsOfServiceContract>({
          getTermsOfServiceText: jest.fn().mockResolvedValue('Terra Terms of Service'),
        })
      );

      fireEvent.click(screen.getByText('Read Terra Platform Terms of Service here'));

      fireEvent.click(screen.getByText('OK'));

      const termsOfServiceCheckbox = screen.getByLabelText(
        'By checking this box, you are agreeing to the Terra Terms of Service'
      );
      fireEvent.click(termsOfServiceCheckbox);

      // Assert
      const registerButton = screen.getByText('Register');
      expect(registerButton).not.toHaveAttribute('disabled');
    });
  });

  describe('Registration', () => {
    it('fires off a request to Orch and Sam to register a user', async () => {
      // Arrange
      const registerWithProfile: MockedFn<UserContract['registerWithProfile']> = jest.fn();
      registerWithProfile.mockResolvedValue(partial<SamUserResponse>({}));
      const setUserAttributes: MockedFn<UserContract['setUserAttributes']> = jest.fn();
      setUserAttributes.mockResolvedValue({ marketingConsent: false });
      const getUserAttributes: MockedFn<UserContract['getUserAttributes']> = jest.fn();
      getUserAttributes.mockResolvedValue({ marketingConsent: false });
      const userProfileGet: MockedFn<UserProfileContract['get']> = jest.fn();
      userProfileGet.mockResolvedValue(partial<TerraUserProfile>({}));

      // Act
      render(h(Register));

      fillInPersonalInfo();
      fillInOrgInfo();
      fireEvent.click(screen.getByLabelText(/Marketing communications.*/));
      acceptTermsOfService();

      asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent: jest.fn() }));
      asMockedFn(User).mockReturnValue(
        partial<UserContract>({
          setUserAttributes,
          getUserAttributes,
          registerWithProfile,
          profile: partial<UserProfileContract>({ get: userProfileGet }),
        })
      );

      const loadTerraUserFn = jest.fn().mockResolvedValue(undefined);
      asMockedFn(loadTerraUser).mockImplementation(loadTerraUserFn);

      const registerButton = screen.getByText('Register');
      expect(registerButton).not.toHaveAttribute('disabled');
      await act(() => fireEvent.click(registerButton));

      // Assert
      expect(registerWithProfile).toHaveBeenCalledWith(true, {
        firstName: 'Test Name',
        lastName: 'Test Last Name',
        contactEmail: 'ltcommanderdata@neighborhood.horse',
        title: 'Test Title',
        department: 'Test Department',
        institute: 'Test Organization',
        interestInTerra: '',
      });

      expect(setUserAttributes).toHaveBeenCalledWith({ marketingConsent: false });
      expect(loadTerraUserFn).toHaveBeenCalled();
    });
    it('logs the user out if they cancel registration', async () => {
      // Arrange
      const signOutFn = jest.fn().mockReturnValue(undefined);
      asMockedFn(signOut).mockImplementation(signOutFn);

      // Act
      render(h(Register));
      fireEvent.click(screen.getByText('Cancel'));

      // Assert
      expect(signOutFn).toHaveBeenCalled();
    });
  });
});
