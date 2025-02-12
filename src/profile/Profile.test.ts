import { MutableRefObject } from 'react';
import { h } from 'react-hyperscript-helpers';
import { TerraUserProfile } from 'src/libs/state';
import { asMockedFn, renderWithAppContexts as render } from 'src/testing/test-utils';

import { PersonalInfo, PersonalInfoProps } from './personal-info/PersonalInfo';
import { Profile } from './Profile';
import { useUserProfile } from './useUserProfile';

// Workaround for import cycle.
jest.mock('src/auth/auth');

type SignOutExports = typeof import('src/auth/signout/sign-out');

jest.mock(
  'src/auth/signout/sign-out',
  (): SignOutExports => ({
    ...jest.requireActual('src/auth/signout/sign-out'),
    signOut: jest.fn(),
    userSignedOut: jest.fn(),
  })
);

type NavExports = typeof import('src/libs/nav');
jest.mock('src/libs/nav', (): NavExports => {
  return {
    ...jest.requireActual<NavExports>('src/libs/nav'),
    useRoute: jest.fn().mockReturnValue({ name: 'profile', query: {} }),
  };
});

type PersonalInfoExports = typeof import('./personal-info/PersonalInfo');
jest.mock('./personal-info/PersonalInfo', (): PersonalInfoExports => {
  return {
    ...jest.requireActual<PersonalInfoExports>('./personal-info/PersonalInfo'),
    PersonalInfo: jest.fn().mockReturnValue(null),
  };
});

type UseUserProfileExports = typeof import('./useUserProfile');
jest.mock('./useUserProfile', (): UseUserProfileExports => {
  return {
    ...jest.requireActual<UseUserProfileExports>('./useUserProfile'),
    useUserProfile: jest.fn(),
  };
});

describe('Profile', () => {
  const mockProfile: TerraUserProfile = {
    firstName: 'Test',
    lastName: 'User',

    contactEmail: '',

    institute: 'Broad Institute',
    title: 'Automated Test',
    department: 'Data Sciences Platform',

    programLocationCity: 'Cambridge',
    programLocationState: 'MA',
    programLocationCountry: 'USA',

    researchArea: '',
    interestInTerra: '',

    starredWorkspaces: undefined,
  };

  it('loads the user profile', () => {
    // Arrange
    asMockedFn(useUserProfile).mockReturnValue({
      profile: {
        status: 'Loading',
        state: mockProfile,
      },
      refresh: () => Promise.resolve(),
      update: () => Promise.resolve(),
    });

    // Act
    render(h(Profile));

    // Assert
    expect(useUserProfile).toHaveBeenCalled();
  });

  it('renders a spinner and no content while the profile is refreshing', () => {
    // Arrange
    asMockedFn(useUserProfile).mockReturnValue({
      profile: {
        status: 'Loading',
        state: mockProfile,
      },
      refresh: () => Promise.resolve(),
      update: () => Promise.resolve(),
    });

    // Act
    render(h(Profile));

    // Assert
    expect(document.querySelector('[data-icon="loadingSpinner"]')).not.toBeNull();
    expect(PersonalInfo).not.toHaveBeenCalled();
  });

  it('renders content after the profile is refreshed', () => {
    // Arrange
    asMockedFn(useUserProfile).mockReturnValue({
      profile: {
        status: 'Ready',
        state: mockProfile,
      },
      refresh: () => Promise.resolve(),
      update: () => Promise.resolve(),
    });

    // Act
    render(h(Profile));

    // Assert
    expect(PersonalInfo).toHaveBeenCalledWith(
      {
        initialProfile: mockProfile,
        onSave: expect.any(Function),
      } satisfies PersonalInfoProps,
      expect.anything()
    );
  });

  describe('PersonalInfo tab', () => {
    it('updates the profile when personal info is saved', () => {
      // Arrange
      const updateProfile = jest.fn().mockReturnValue(Promise.resolve());
      asMockedFn(useUserProfile).mockReturnValue({
        profile: {
          status: 'Ready',
          state: mockProfile,
        },
        refresh: () => Promise.resolve(),
        update: updateProfile,
      });

      // Get a reference to the onSave function passed to PersonalInfo.
      const personalInfoPropsRef: MutableRefObject<PersonalInfoProps | null> = { current: null };
      asMockedFn(PersonalInfo).mockImplementation((props) => {
        personalInfoPropsRef.current = props;
        return null;
      });

      render(h(Profile));

      // Act
      const updatedProfile = { ...mockProfile, firstName: 'Updated', lastName: 'Profile' };
      personalInfoPropsRef.current?.onSave(updatedProfile);

      // Assert
      expect(updateProfile).toHaveBeenCalledWith(updatedProfile);
    });
  });
});
