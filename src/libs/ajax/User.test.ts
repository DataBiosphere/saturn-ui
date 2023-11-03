import {
  CreateTerraUserProfileRequest,
  generateAPIBodyForCreateUserProfile,
  generateAPIBodyForUpdateUserProfile,
  OrchestrationUpsertTerraUserProfileRequest,
  UpdateTerraUserProfileRequest,
} from 'src/libs/ajax/User';
import { TerraUserProfile } from 'src/libs/state';

jest.mock('src/libs/ajax/ajax-common', () => ({
  authOpts: jest.fn(() => ''),
}));

const completeUserProfile: TerraUserProfile = {
  firstName: 'testFirstName',
  lastName: 'testFirstName',
  contactEmail: 'testFirstName',
  department: 'testDepartment',
  institute: 'testInstitute',
  interestInTerra: 'testInterestInTerra',
  programLocationCity: 'testCity',
  programLocationCountry: 'testCountry',
  programLocationState: 'testState',
  starredWorkspaces: 'testStarredWorkspaces',
  title: 'testTitle',
  researchArea: 'testResearchArea',
};

const minimalCreateUserProfileRequest: CreateTerraUserProfileRequest = {
  firstName: completeUserProfile.firstName!,
  lastName: completeUserProfile.lastName!,
  contactEmail: completeUserProfile.contactEmail!,
};

const completeCreateUserProfileRequest: CreateTerraUserProfileRequest = {
  firstName: completeUserProfile.firstName!,
  lastName: completeUserProfile.lastName!,
  contactEmail: completeUserProfile.contactEmail!,
  department: completeUserProfile.department,
  institute: completeUserProfile.institute,
  interestInTerra: completeUserProfile.interestInTerra,
  title: completeUserProfile.title,
};

const minimalUpdateUserProfileRequest: UpdateTerraUserProfileRequest = {
  firstName: completeUserProfile.firstName!,
  lastName: completeUserProfile.lastName!,
  contactEmail: completeUserProfile.contactEmail!,
};

const completeUpdateUserProfileRequest: UpdateTerraUserProfileRequest = {
  firstName: completeUserProfile.firstName!,
  lastName: completeUserProfile.lastName!,
  contactEmail: completeUserProfile.contactEmail!,
  department: completeUserProfile.department,
  institute: completeUserProfile.institute,
  interestInTerra: completeUserProfile.interestInTerra,
  title: completeUserProfile.title,
  programLocationCity: completeUserProfile.programLocationCity,
  programLocationState: completeUserProfile.programLocationState,
  programLocationCountry: completeUserProfile.programLocationCountry,
  researchArea: completeUserProfile.researchArea,
};

const NA = 'N/A';

// create user profile
describe('A create user profile request', () => {
  describe('when minimally filled out by the user', () => {
    // when a user has filled out the required fields of a profile
    // and has not entered values for the optional fields
    // those optional fields should be changed to 'N/A' in the request
    it.each(['title', 'institute', 'programLocationCity', 'programLocationState', 'programLocationCountry'])(
      'sets undefined property %s to "N/A"',
      async (field) => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForCreateUserProfile(
          minimalCreateUserProfileRequest
        );

        // Assert
        expect(apiBody[field]).toBe(NA);
      }
    );
    describe('should not modify property', () => {
      // these required fields that the user filled out should not be changed
      it('interestInTerra', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForCreateUserProfile(
          minimalCreateUserProfileRequest
        );

        // Assert
        expect(apiBody.interestInTerra).toBe(minimalCreateUserProfileRequest.interestInTerra);
      });
      it('department', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForCreateUserProfile(
          minimalCreateUserProfileRequest
        );

        // Assert
        expect(apiBody.department).toBe(minimalCreateUserProfileRequest.department);
      });
    });
    describe('should have undefined properties', () => {
      // because the user is registering for the first time research area should be 'undefined'
      // these are not required to be initialized as 'N/A'
      it('researchArea', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForCreateUserProfile(
          minimalCreateUserProfileRequest
        );

        // Assert
        expect(apiBody.researchArea).toBe(undefined);
      });
    });
    describe('should not modify or have undefined property', () => {
      // these properties should not be modified and should not have a value of 'N/A'
      it('firstName', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForCreateUserProfile(
          minimalCreateUserProfileRequest
        );

        // Assert
        expect(apiBody.firstName).toBe(completeUserProfile.firstName);
        expect(apiBody.firstName).not.toBe(undefined);
        expect(apiBody.firstName).not.toBe(null);
      });

      it('lastName', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForCreateUserProfile(
          minimalCreateUserProfileRequest
        );

        // Assert
        expect(apiBody.lastName).toBe(completeUserProfile.lastName);
        expect(apiBody.lastName).not.toBe(undefined);
        expect(apiBody.lastName).not.toBe(null);
      });

      it('contactEmail', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForCreateUserProfile(
          minimalCreateUserProfileRequest
        );

        // Assert
        expect(apiBody.contactEmail).toBe(completeUserProfile.contactEmail);
        expect(apiBody.contactEmail).not.toBe(undefined);
        expect(apiBody.contactEmail).not.toBe(null);
      });
    });
  });
  describe('when completely filled out by the user', () => {
    describe('should not modify or have undefined property', () => {
      it('title', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForCreateUserProfile(
          completeCreateUserProfileRequest
        );

        // Assert
        expect(apiBody.title).toBe(completeUserProfile.title);
      });
      it('institute', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForCreateUserProfile(
          completeCreateUserProfileRequest
        );

        // Assert
        expect(apiBody.institute).toBe(completeUserProfile.institute);
      });
      it.each(['programLocationCity', 'programLocationState', 'programLocationCountry'])(
        'should set property %s to "N/A"',
        async (field) => {
          // Arrange, Act
          const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForCreateUserProfile(
            completeCreateUserProfileRequest
          );

          // Assert
          expect(apiBody[field]).toBe(NA);
        }
      );
      it('interestInTerra', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForCreateUserProfile(
          completeCreateUserProfileRequest
        );

        // Assert
        expect(apiBody.interestInTerra).toBe(completeCreateUserProfileRequest.interestInTerra);
      });
      it('department', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForCreateUserProfile(
          completeCreateUserProfileRequest
        );

        // Assert
        expect(apiBody.department).toBe(completeCreateUserProfileRequest.department);
      });
      it('researchArea', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForCreateUserProfile(
          completeCreateUserProfileRequest
        );

        // Assert
        expect(apiBody.researchArea).toBe(undefined);
      });
      it('firstName', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForCreateUserProfile(
          completeCreateUserProfileRequest
        );

        // Assert
        expect(apiBody.firstName).toBe(completeUserProfile.firstName);
        expect(apiBody.firstName).not.toBe(undefined);
        expect(apiBody.firstName).not.toBe(null);
      });
      it('lastName', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForCreateUserProfile(
          completeCreateUserProfileRequest
        );

        // Assert
        expect(apiBody.lastName).toBe(completeUserProfile.lastName);
        expect(apiBody.lastName).not.toBe(undefined);
        expect(apiBody.lastName).not.toBe(null);
      });
      it('contactEmail', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForCreateUserProfile(
          completeCreateUserProfileRequest
        );

        // Assert
        expect(apiBody.contactEmail).toBe(completeUserProfile.contactEmail);
        expect(apiBody.contactEmail).not.toBe(undefined);
        expect(apiBody.contactEmail).not.toBe(null);
      });
    });
  });
});

// update user profile
describe('An update user profile request', () => {
  describe('when minimally filled out by the user', () => {
    it.each(['title', 'institute', 'programLocationCity', 'programLocationState', 'programLocationCountry'])(
      'sets undefined property %s to "N/A"',
      async (field) => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForUpdateUserProfile(
          minimalUpdateUserProfileRequest
        );

        // Assert
        expect(apiBody[field]).toBe(NA);
      }
    );
    // these required fields that the user filled out should not be changed but may be undefined
    it.each(['interestInTerra', 'department'])(
      'should not modify property %s which may be undefined',
      async (field) => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForUpdateUserProfile(
          minimalUpdateUserProfileRequest
        );

        // Assert
        expect(apiBody[field]).toBe(undefined);
      }
    );
    describe('should have undefined properties', () => {
      it('researchArea', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForUpdateUserProfile(
          minimalUpdateUserProfileRequest
        );

        // Assert
        expect(apiBody.researchArea).toBe(undefined);
      });
    });
    describe('should not modify or have undefined property', () => {
      // these properties should not be modified and should not have a value of undefined
      it('firstName', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForUpdateUserProfile(
          minimalUpdateUserProfileRequest
        );

        // Assert
        expect(apiBody.firstName).toBe(completeUserProfile.firstName);
        expect(apiBody.firstName).not.toBe(undefined);
        expect(apiBody.firstName).not.toBe(null);
      });

      it('lastName', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForUpdateUserProfile(
          minimalUpdateUserProfileRequest
        );

        // Assert
        expect(apiBody.lastName).toBe(completeUserProfile.lastName);
        expect(apiBody.lastName).not.toBe(undefined);
        expect(apiBody.lastName).not.toBe(null);
      });

      it('contactEmail', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForUpdateUserProfile(
          minimalUpdateUserProfileRequest
        );

        // Assert
        expect(apiBody.contactEmail).toBe(completeUserProfile.contactEmail);
        expect(apiBody.contactEmail).not.toBe(undefined);
        expect(apiBody.contactEmail).not.toBe(null);
      });
    });
  });
  describe('when completely filled out by the user', () => {
    describe('should not modify or have undefined property', () => {
      it('title', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForUpdateUserProfile(
          completeUpdateUserProfileRequest
        );

        // Assert
        expect(apiBody.title).toBe(completeUserProfile.title);
      });
      it('institute', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForUpdateUserProfile(
          completeUpdateUserProfileRequest
        );

        // Assert
        expect(apiBody.institute).toBe(completeUserProfile.institute);
      });
      it('programLocationCity', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForUpdateUserProfile(
          completeUpdateUserProfileRequest
        );

        // Assert
        expect(apiBody.programLocationCity).toBe(completeUserProfile.programLocationCity);
      });
      it('programLocationState', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForUpdateUserProfile(
          completeUpdateUserProfileRequest
        );

        // Assert
        expect(apiBody.programLocationState).toBe(completeUserProfile.programLocationState);
      });
      it('programLocationCountry', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForUpdateUserProfile(
          completeUpdateUserProfileRequest
        );

        // Assert
        expect(apiBody.programLocationCountry).toBe(completeUserProfile.programLocationCountry);
      });
      it('interestInTerra', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForUpdateUserProfile(
          completeUpdateUserProfileRequest
        );

        // Assert
        expect(apiBody.interestInTerra).toBe(completeUpdateUserProfileRequest.interestInTerra);
      });
      it('department', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForUpdateUserProfile(
          completeUpdateUserProfileRequest
        );

        // Assert
        expect(apiBody.department).toBe(completeUpdateUserProfileRequest.department);
      });
      it('researchArea', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForUpdateUserProfile(
          completeUpdateUserProfileRequest
        );

        // Assert
        expect(apiBody.researchArea).toBe(completeUserProfile.researchArea);
      });
      it('firstName', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForUpdateUserProfile(
          completeUpdateUserProfileRequest
        );

        // Assert
        expect(apiBody.firstName).toBe(completeUserProfile.firstName);
        expect(apiBody.firstName).not.toBe(undefined);
        expect(apiBody.firstName).not.toBe(null);
      });
      it('lastName', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForUpdateUserProfile(
          completeUpdateUserProfileRequest
        );

        // Assert
        expect(apiBody.lastName).toBe(completeUserProfile.lastName);
        expect(apiBody.lastName).not.toBe(undefined);
        expect(apiBody.lastName).not.toBe(null);
      });
      it('contactEmail', async () => {
        // Arrange, Act
        const apiBody: OrchestrationUpsertTerraUserProfileRequest = generateAPIBodyForUpdateUserProfile(
          completeUpdateUserProfileRequest
        );

        // Assert
        expect(apiBody.contactEmail).toBe(completeUserProfile.contactEmail);
        expect(apiBody.contactEmail).not.toBe(undefined);
        expect(apiBody.contactEmail).not.toBe(null);
      });
    });
  });
});
