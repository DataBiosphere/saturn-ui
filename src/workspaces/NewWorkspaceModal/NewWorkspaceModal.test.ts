import { abandonedPromise } from '@terra-ui-packages/core-utils';
import { asMockedFn, partial, withFakeTimers } from '@terra-ui-packages/test-utils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import _ from 'lodash/fp';
import { h } from 'react-hyperscript-helpers';
import { BillingProject, CloudPlatform } from 'src/billing-core/models';
import { AzureStorage, AzureStorageContract } from 'src/libs/ajax/AzureStorage';
import { Billing, BillingContract } from 'src/libs/ajax/billing/Billing';
import { FirecloudBucket, FirecloudBucketAjaxContract } from 'src/libs/ajax/firecloud/FirecloudBucket';
import { CurrentUserGroupMembership, GroupContract, Groups, GroupsContract } from 'src/libs/ajax/Groups';
import { Apps, AppsAjaxContract } from 'src/libs/ajax/leonardo/Apps';
import { ListAppItem } from 'src/libs/ajax/leonardo/models/app-models';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { WorkspaceData, WorkspaceDataAjaxContract } from 'src/libs/ajax/WorkspaceDataService';
import {
  WorkspaceContract,
  Workspaces,
  WorkspacesAjaxContract,
  WorkspaceV2Contract,
} from 'src/libs/ajax/workspaces/Workspaces';
import { getRegionLabel } from 'src/libs/azure-utils';
import Events from 'src/libs/events';
import { goToPath } from 'src/libs/nav';
import {
  azureBillingProject,
  azureProtectedDataBillingProject,
  azureProtectedEnterpriseBillingProject,
  gcpBillingProject,
} from 'src/testing/billing-project-fixtures';
import { renderWithAppContexts as render, SelectHelper } from 'src/testing/test-utils';
import {
  defaultAzureWorkspace,
  defaultGoogleWorkspace,
  makeGoogleWorkspace,
  mockBucketRequesterPaysError,
  protectedAzureWorkspace,
  protectedPhiTrackingAzureWorkspace,
} from 'src/testing/workspace-fixtures';
import {
  AzureWorkspaceInfo,
  phiTrackingLabel,
  phiTrackingPolicy,
  WorkspaceInfo,
  WorkspaceWrapper,
} from 'src/workspaces/utils';

import NewWorkspaceModal from './NewWorkspaceModal';

jest.mock('src/libs/ajax/AzureStorage');
jest.mock('src/libs/ajax/billing/Billing');
jest.mock('src/libs/ajax/firecloud/FirecloudBucket');
jest.mock('src/libs/ajax/Groups');
jest.mock('src/libs/ajax/leonardo/Apps');
jest.mock('src/libs/ajax/Metrics');
jest.mock('src/libs/ajax/WorkspaceDataService');
jest.mock('src/libs/ajax/workspaces/Workspaces');

type NavExports = typeof import('src/libs/nav');
jest.mock(
  'src/libs/nav',
  (): NavExports => ({
    ...jest.requireActual<NavExports>('src/libs/nav'),
    getLink: jest.fn(() => '/'),
    goToPath: jest.fn(),
  })
);

interface SetupOptions {
  billingProjects?: BillingProject[];
  groups?: string[];
}

interface SetupResult {
  captureEvent: jest.MockedFunction<MetricsContract['captureEvent']>;
  checkBucketLocation: jest.MockedFunction<WorkspaceContract['checkBucketLocation']>;
  containerInfo: jest.MockedFunction<AzureStorageContract['containerInfo']>;
  cloneWorkspace: jest.MockedFunction<WorkspaceV2Contract['clone']>;
  createWorkspace: jest.MockedFunction<WorkspacesAjaxContract['create']>;
  getWorkspaceDetails: jest.MockedFunction<WorkspaceContract['details']>;
  listApps: jest.MockedFunction<AppsAjaxContract['listAppsV2']>;
  listWdsCollections: jest.MockedFunction<WorkspaceDataAjaxContract['listCollections']>;
}

const setup = (opts: SetupOptions = {}): SetupResult => {
  const { billingProjects = [gcpBillingProject, azureBillingProject], groups = [] } = opts;

  const listBillingProjects: jest.MockedFunction<BillingContract['listProjects']> = jest.fn();
  listBillingProjects.mockResolvedValue(billingProjects);
  const checkBucketLocation: jest.MockedFunction<WorkspaceContract['checkBucketLocation']> = jest.fn();
  checkBucketLocation.mockResolvedValue({
    location: 'US-CENTRAL1',
    locationType: 'location-type',
  });
  const cloneWorkspace: jest.MockedFunction<WorkspaceV2Contract['clone']> = jest.fn();
  cloneWorkspace.mockReturnValue(abandonedPromise());
  const createWorkspace: jest.MockedFunction<WorkspacesAjaxContract['create']> = jest.fn();
  createWorkspace.mockReturnValue(abandonedPromise());
  const getWorkspaceDetails: jest.MockedFunction<WorkspaceContract['details']> = jest.fn();
  getWorkspaceDetails.mockResolvedValue(
    partial<WorkspaceWrapper>({
      workspace: partial<WorkspaceInfo>({
        attributes: { description: '' },
      }),
    })
  );
  const captureEvent: jest.MockedFunction<MetricsContract['captureEvent']> = jest.fn();
  const listApps: jest.MockedFunction<AppsAjaxContract['listAppsV2']> = jest.fn();
  listApps.mockResolvedValue([]);
  const listWdsCollections: jest.MockedFunction<WorkspaceDataAjaxContract['listCollections']> = jest.fn();
  listWdsCollections.mockResolvedValue([]);

  asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>({ listAppsV2: listApps }));
  asMockedFn(Billing).mockReturnValue(partial<BillingContract>({ listProjects: listBillingProjects }));
  asMockedFn(FirecloudBucket).mockReturnValue(
    partial<FirecloudBucketAjaxContract>({
      getFeaturedWorkspaces: jest.fn().mockResolvedValue([]),
    })
  );
  asMockedFn(Groups).mockReturnValue(
    partial<GroupsContract>({
      list: async () => {
        const groupsResponse = groups.map((groupName) =>
          partial<CurrentUserGroupMembership>({
            groupEmail: `${groupName}@test.firecloud.org`,
            groupName,
            role: 'member',
          })
        );
        return groupsResponse;
      },
      group: (groupName) =>
        partial<GroupContract>({
          isMember: async () => groups.includes(groupName),
        }),
    })
  );
  asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent }));
  asMockedFn(Workspaces).mockReturnValue(
    partial<WorkspacesAjaxContract>({
      create: createWorkspace,
      workspace: () =>
        partial<WorkspaceContract>({
          checkBucketLocation,
          details: getWorkspaceDetails,
        }),
      workspaceV2: () =>
        partial<WorkspaceV2Contract>({
          clone: cloneWorkspace,
        }),
    })
  );
  asMockedFn(WorkspaceData).mockReturnValue(
    partial<WorkspaceDataAjaxContract>({
      listCollections: listWdsCollections,
    })
  );

  const containerInfo: jest.MockedFunction<AzureStorageContract['containerInfo']> = jest.fn();
  asMockedFn(containerInfo).mockResolvedValue({
    storageContainerName: 'sc-e18cfbc3-7115-4a37-add7-1d95d3ecfa14',
    resourceId: '4da46849-7f06-44e2-ba62-80fa2348ff35',
    region: 'japaneast',
  });

  asMockedFn(AzureStorage).mockReturnValue(
    partial<AzureStorageContract>({
      containerInfo,
    })
  );

  return {
    checkBucketLocation,
    containerInfo,
    cloneWorkspace,
    createWorkspace,
    getWorkspaceDetails,
    captureEvent,
    listApps,
    listWdsCollections,
  };
};

const egressWarning = /may incur network egress charges/;
const nonRegionSpecificEgressWarning = /Copying data may incur network egress charges/;

const mockWorkspaceDetails: { Azure: WorkspaceInfo; Gcp: WorkspaceInfo } = {
  Azure: defaultAzureWorkspace.workspace,
  Gcp: defaultGoogleWorkspace.workspace,
};

describe('NewWorkspaceModal', () => {
  const getAvailableBillingProjects = async (user) => {
    const projectSelect = new SelectHelper(screen.getByLabelText('Billing project *'), user);
    const availableBillingProjectOptions = await projectSelect.getOptions();
    // Remove icon name from option label.
    // The icon names are only present in tests. They're the result of a configured transform.
    return availableBillingProjectOptions.map((opt) => opt.split('.svg')[1]);
  };

  const selectBillingProject = async (user, billingProjectName) => {
    await user.click(screen.getByText('Select a billing project'));
    await user.click(screen.getByText(billingProjectName));
  };

  describe('handles when no appropriate billing projects are available', () => {
    it('shows a message if there are no billing projects to use for creation', async () => {
      // Arrange
      setup({ billingProjects: [] });

      // Act
      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            onSuccess: () => {},
            onDismiss: () => {},
          })
        );
      });

      // Assert
      screen.getByText('You need a billing project to create a new workspace.');
    });

    it('shows a message if there are no protected billing projects to use for creating a workspace with additional security monitoring ', async () => {
      // Arrange
      setup({ billingProjects: [azureBillingProject] });

      // Act
      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            requireEnhancedBucketLogging: true,
            onSuccess: () => {},
            onDismiss: () => {},
          })
        );
      });

      // Assert
      screen.getByText('You do not have access to a billing project that supports additional security monitoring.');
    });

    it('shows a message if there are no billing projects to use for cloning', async () => {
      // Arrange
      setup({ billingProjects: [] });

      // Act
      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            cloneWorkspace: defaultAzureWorkspace,
            onSuccess: () => {},
            onDismiss: () => {},
          })
        );
      });

      // Assert
      screen.getByText('You do not have a billing project that is able to clone this workspace.');
    });

    it('redirects to billing if there are no suitable billing projects', async () => {
      // Arrange
      const user = userEvent.setup();
      setup({ billingProjects: [] });

      // Arrange
      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            cloneWorkspace: defaultAzureWorkspace,
            onSuccess: () => {},
            onDismiss: () => {},
          })
        );
      });
      const goToBilling = screen.getByText('Go to Billing');
      await user.click(goToBilling);

      // Assert
      await waitFor(() => expect(goToPath).toBeCalledWith('billing'));
    });
  });

  it('Shows all available billing projects by default', async () => {
    // Arrange
    const user = userEvent.setup();
    setup();

    await act(async () => {
      render(
        h(NewWorkspaceModal, {
          onSuccess: () => {},
          onDismiss: () => {},
        })
      );
    });

    const projectSelector = screen.getByText('Select a billing project');
    await user.click(projectSelector);

    // Assert
    // getByText throws an error if the element is not found:
    screen.getByText('Google Billing Project');
    screen.getByText('Azure Billing Project');
    // queryByText returns null if the element is not found:
    expect(screen.queryByText('Importing directly into new Azure workspaces is not currently supported.')).toBeNull();
  });

  describe('handles the requireEnhancedBucketLogging option', () => {
    it('hides unprotected Azure billing projects when additional security monitoring is required', async () => {
      // Arrange
      const user = userEvent.setup();
      setup({ billingProjects: [gcpBillingProject, azureBillingProject, azureProtectedDataBillingProject] });

      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            onSuccess: () => {},
            onDismiss: () => {},
            requireEnhancedBucketLogging: true,
          })
        );
      });

      // Assert
      expect(await getAvailableBillingProjects(user)).toEqual([
        'Google Billing Project',
        'Protected Azure Billing Project',
      ]);
    });

    it.each([
      {
        cloudPlatform: 'AZURE',
        expectedBillingProjects: ['Azure Billing Project', 'Protected Azure Billing Project'],
        requireEnhancedBucketLogging: false,
      },
      {
        cloudPlatform: 'AZURE',
        expectedBillingProjects: ['Protected Azure Billing Project'],
        requireEnhancedBucketLogging: true,
      },
      {
        cloudPlatform: 'GCP',
        expectedBillingProjects: ['Google Billing Project'],
        requireEnhancedBucketLogging: false,
      },
      { cloudPlatform: 'GCP', expectedBillingProjects: ['Google Billing Project'], requireEnhancedBucketLogging: true },
    ] as { cloudPlatform: CloudPlatform; expectedBillingProjects: string[]; requireEnhancedBucketLogging: boolean }[])(
      'can limit billing projects to $cloudPlatform with requireEnhancedBucketLogging=$requireEnhancedBucketLogging',
      async ({ cloudPlatform, expectedBillingProjects, requireEnhancedBucketLogging }) => {
        // Arrange
        const user = userEvent.setup();
        setup({ billingProjects: [gcpBillingProject, azureBillingProject, azureProtectedDataBillingProject] });

        // Act
        await act(async () => {
          render(
            h(NewWorkspaceModal, {
              cloudPlatform,
              requireEnhancedBucketLogging,
              onDismiss: () => {},
              onSuccess: () => {},
            })
          );
        });

        // Assert
        expect(await getAvailableBillingProjects(user)).toEqual(expectedBillingProjects);
      }
    );
  });
  describe('filters billing projects when cloning a workspace ', () => {
    it('Hides Azure billing projects when cloning a GCP workspace', async () => {
      const user = userEvent.setup();
      setup();

      // Act
      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            cloneWorkspace: defaultGoogleWorkspace,
            onDismiss: () => {},
            onSuccess: () => {},
          })
        );
      });

      // Assert
      expect(await getAvailableBillingProjects(user)).toEqual(['Google Billing Project']);
    });

    it('Hides GCP billing projects when cloning an Azure workspace', async () => {
      const user = userEvent.setup();
      setup({ billingProjects: [gcpBillingProject, azureBillingProject, azureProtectedDataBillingProject] });

      // Act
      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            cloneWorkspace: defaultAzureWorkspace,
            onDismiss: () => {},
            onSuccess: () => {},
          })
        );
      });

      // Assert
      expect(await getAvailableBillingProjects(user)).toEqual([
        'Azure Billing Project',
        'Protected Azure Billing Project',
      ]);
    });

    it('Hides billing projects that cannot be used for cloning a protected data Azure workspace', async () => {
      const user = userEvent.setup();
      setup({ billingProjects: [gcpBillingProject, azureBillingProject, azureProtectedDataBillingProject] });

      // Act
      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            cloneWorkspace: protectedAzureWorkspace,
            onDismiss: () => {},
            onSuccess: () => {},
          })
        );
      });

      // Assert
      expect(await getAvailableBillingProjects(user)).toEqual(['Protected Azure Billing Project']);
    });

    it('Hides billing projects that cannot be used for cloning a PHI tracking Azure workspace', async () => {
      const user = userEvent.setup();
      setup({
        billingProjects: [
          gcpBillingProject,
          azureBillingProject,
          azureProtectedDataBillingProject,
          azureProtectedEnterpriseBillingProject,
        ],
      });

      // Act
      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            cloneWorkspace: protectedPhiTrackingAzureWorkspace,
            onDismiss: () => {},
            onSuccess: () => {},
          })
        );
      });

      // Assert
      expect(await getAvailableBillingProjects(user)).toEqual(['Enterprise Azure Billing Project']);
    });
  });

  describe('decides when to show a policy section ', () => {
    const policyTitle = 'Security and controls on this workspace:';
    it('Shows a policy section when cloning an Azure workspace with policies', async () => {
      setup({ billingProjects: [azureProtectedDataBillingProject] });

      // Act
      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            cloneWorkspace: protectedAzureWorkspace,
            onDismiss: () => {},
            onSuccess: () => {},
          })
        );
      });

      // Assert
      screen.getByText(policyTitle);
    });

    it('Does not show a policy section when cloning an Azure workspace without polices', async () => {
      setup({ billingProjects: [azureBillingProject] });

      // Act
      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            cloneWorkspace: defaultAzureWorkspace,
            onDismiss: () => {},
            onSuccess: () => {},
          })
        );
      });

      // Assert
      expect(screen.queryByText(policyTitle)).toBeNull();
    });

    it('Does not show a policy section when cloning a protected GCP workspace', async () => {
      // Arrange
      setup({ billingProjects: [gcpBillingProject] });
      const protectedWorkspace = makeGoogleWorkspace({
        workspace: { bucketName: `fc-secure-${defaultGoogleWorkspace.workspace.bucketName}` },
      });

      // Act
      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            cloneWorkspace: protectedWorkspace,
            onDismiss: () => {},
            onSuccess: () => {},
          })
        );
      });

      // Assert
      expect(screen.queryByText(policyTitle)).toBeNull();
    });

    it('Shows a policy section when creating a new workspace from a protected data billing project', async () => {
      // Arrange
      const user = userEvent.setup();
      setup({ billingProjects: [azureProtectedDataBillingProject] });

      // Act
      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            onDismiss: () => {},
            onSuccess: () => {},
          })
        );
      });

      // No policy section until billing project is selected.
      expect(screen.queryByText(policyTitle)).toBeNull();

      await selectBillingProject(user, 'Protected Azure Billing Project');

      // Assert
      screen.getByText(policyTitle);
      // Informational link about cost.
      screen.getByRole('link', { name: 'Learn more about cost and follow changes' });
      // Billing project is protected but not enterprise.
      expect(screen.queryByText(phiTrackingLabel)).toBeNull();
    });

    it('Does not shows a policy section when creating a new workspace from an unprotected data billing project', async () => {
      // Arrange
      const user = userEvent.setup();
      setup({ billingProjects: [azureBillingProject] });

      // Act
      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            onDismiss: () => {},
            onSuccess: () => {},
          })
        );
      });

      await selectBillingProject(user, 'Azure Billing Project');

      // Assert
      expect(screen.queryByText(policyTitle)).toBeNull();
    });

    it('Allows toggling PHI tracking from an enterprise protected data billing project if cloned workspace does not have PHI tracking', async () => {
      // Arrange
      const user = userEvent.setup();
      setup({ billingProjects: [azureProtectedEnterpriseBillingProject] });

      // Act
      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            cloneWorkspace: defaultAzureWorkspace,
            onDismiss: () => {},
            onSuccess: () => {},
          })
        );
      });

      await selectBillingProject(user, 'Enterprise Azure Billing Project');

      // Assert
      screen.getByText(policyTitle);
      // Make sure we don't show both the read-only checkbox and the one that can be toggled.
      const checkboxes = screen.getAllByRole('checkbox', { name: phiTrackingLabel });
      expect(checkboxes.length).toBe(1);
      const checkbox = checkboxes[0];
      expect(checkbox).not.toHaveAttribute('disabled');
      expect(checkbox).not.toBeChecked();
    });

    it('Does not allow toggling PHI tracking from an enterprise protected data billing project if cloned workspace already has PHI tracking', async () => {
      // Arrange
      const user = userEvent.setup();
      setup({ billingProjects: [azureProtectedEnterpriseBillingProject] });

      // Act
      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            cloneWorkspace: protectedPhiTrackingAzureWorkspace,
            onDismiss: () => {},
            onSuccess: () => {},
          })
        );
      });

      await selectBillingProject(user, 'Enterprise Azure Billing Project');

      // Assert
      screen.getByText(policyTitle);
      // Make sure we don't show both the read-only checkbox and the one that can be toggled.
      const checkboxes = screen.getAllByRole('checkbox', { name: phiTrackingLabel });
      expect(checkboxes.length).toBe(1);
      const checkbox = checkboxes[0];
      expect(checkbox).toHaveAttribute('disabled');
      expect(checkbox).toBeChecked();
    });
  });

  describe('respects the workflowImport option ', () => {
    it('Hides azure billing projects if part of workflow import', async () => {
      // Arrange
      const user = userEvent.setup();
      setup();

      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            onSuccess: () => {},
            onDismiss: () => {},
            workflowImport: true,
          })
        );
      });

      const projectSelector = screen.getByText('Select a billing project');
      await user.click(projectSelector);

      // Assert
      screen.getByText('Google Billing Project');
      expect(screen.queryByText('Azure Billing Project')).toBeNull();
      screen.getByText(
        'Importing directly into new Azure workspaces is not currently supported. To create a new workspace with an Azure billing project, visit the main',
        { exact: false }
      );
    });

    it('Does not warn about no Azure support if no billing projects were hidden', async () => {
      // Arrange
      const user = userEvent.setup();
      setup({ billingProjects: [gcpBillingProject] });

      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            onSuccess: () => {},
            onDismiss: () => {},
            workflowImport: true,
          })
        );
      });

      const projectSelector = screen.getByText('Select a billing project');
      await user.click(projectSelector);

      // Assert
      screen.getByText('Google Billing Project');
      expect(screen.queryByText('Azure Billing Project')).toBeNull();
      expect(
        screen.queryByText(
          'Importing directly into new Azure workspaces is not currently supported. To create a new workspace with an Azure billing project, visit the main',
          { exact: false }
        )
      ).toBeNull();
    });
  });

  describe('passes PHI tracking option if selected for enterprise Azure billing projects', () => {
    it.each([{ selectCheckbox: true }, { selectCheckbox: false }] as { selectCheckbox: boolean }[])(
      'shows the checkbox if a enterprise billing project is selected, an passes the policy on create if checked ($selectCheckbox)',
      async ({ selectCheckbox }) => {
        // Arrange
        const user = userEvent.setup();
        const { createWorkspace } = setup({ billingProjects: [azureProtectedEnterpriseBillingProject] });

        await act(async () => {
          render(
            h(NewWorkspaceModal, {
              onSuccess: () => {},
              onDismiss: () => {},
            })
          );
        });

        const workspaceNameInput = screen.getByLabelText('Workspace name *');
        act(() => {
          fireEvent.change(workspaceNameInput, { target: { value: 'Test workspace' } });
        });

        await selectBillingProject(user, azureProtectedEnterpriseBillingProject.projectName);

        const createWorkspaceButton = screen.getByRole('button', { name: 'Create Workspace' });

        // Assert
        const checkbox = screen.getByRole('checkbox', { name: phiTrackingLabel });
        expect(checkbox).not.toBeChecked();

        // Act
        if (selectCheckbox) {
          await user.click(checkbox);
          expect(checkbox).toBeChecked();
        }
        expect(createWorkspaceButton).not.toHaveAttribute('disabled');
        await user.click(createWorkspaceButton);

        // Assert arguments sent to Ajax method for creating a workspace.
        expect(createWorkspace).toBeCalledWith({
          attributes: { description: '' },
          authorizationDomain: [],
          copyFilesWithPrefix: 'analyses/',
          enhancedBucketLogging: false,
          name: 'Test workspace',
          namespace: azureProtectedEnterpriseBillingProject.projectName,
          ...(selectCheckbox && { policies: [phiTrackingPolicy] }),
        });
      }
    );
  });

  describe('handles Additional Security Monitoring for GCP billing projects/workspaces ', () => {
    const additionalSecurityMonitoring = 'Enable additional security monitoring';
    it.each([{ selectCheckbox: true }, { selectCheckbox: false }] as { selectCheckbox: boolean }[])(
      'shows the checkbox if a Google billing project is selected, and correctly passes the value $selectCheckbox on create',
      async ({ selectCheckbox }) => {
        // Arrange
        const user = userEvent.setup();
        const { createWorkspace } = setup();

        await act(async () => {
          render(
            h(NewWorkspaceModal, {
              onSuccess: () => {},
              onDismiss: () => {},
            })
          );
        });

        const workspaceNameInput = screen.getByLabelText('Workspace name *');
        act(() => {
          fireEvent.change(workspaceNameInput, { target: { value: 'Test workspace' } });
        });

        await selectBillingProject(user, 'Google Billing Project');

        const createWorkspaceButton = screen.getByRole('button', { name: 'Create Workspace' });

        // Assert
        // getByText throws an error if the element is not found:
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toHaveAccessibleName(additionalSecurityMonitoring);
        expect(checkbox).not.toHaveAttribute('disabled');
        expect(checkbox).not.toBeChecked();

        // Act
        if (selectCheckbox) {
          await user.click(checkbox);
          expect(checkbox).toBeChecked();
        }
        expect(createWorkspaceButton).not.toHaveAttribute('disabled');
        await user.click(createWorkspaceButton);

        // Assert arguments sent to Ajax method for creating a workspace.
        expect(createWorkspace).toBeCalledWith({
          attributes: { description: '' },
          authorizationDomain: [],
          bucketLocation: 'US-CENTRAL1',
          copyFilesWithPrefix: 'notebooks/',
          enhancedBucketLogging: selectCheckbox,
          name: 'Test workspace',
          namespace: 'Google Billing Project',
        });
      }
    );

    it('does not show the checkbox if an Azure billing project is selected', async () => {
      // Arrange
      const user = userEvent.setup();
      setup();

      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            onSuccess: () => {},
            onDismiss: () => {},
          })
        );
      });

      await selectBillingProject(user, 'Azure Billing Project');

      // Assert
      expect(screen.queryByText(additionalSecurityMonitoring)).toBeNull();
    });

    it('does not let the user uncheck the option if requireEnhancedBucketLogging is passed in as true', async () => {
      // Arrange
      const user = userEvent.setup();
      setup();

      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            onSuccess: () => {},
            onDismiss: () => {},
            requireEnhancedBucketLogging: true,
          })
        );
      });

      await selectBillingProject(user, 'Google Billing Project');

      // Assert
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAccessibleName(additionalSecurityMonitoring);
      expect(checkbox).toHaveAttribute('disabled');
      expect(checkbox).toBeChecked();
    });

    it('does not let the user uncheck the option if cloning a GCP protected data workspace', async () => {
      // Arrange
      const user = userEvent.setup();
      setup({ billingProjects: [gcpBillingProject] });
      const protectedWorkspace = makeGoogleWorkspace({
        workspace: { bucketName: `fc-secure-${defaultGoogleWorkspace.workspace.bucketName}` },
      });

      // Act
      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            cloneWorkspace: protectedWorkspace,
            onDismiss: () => {},
            onSuccess: () => {},
          })
        );
      });

      await selectBillingProject(user, 'Google Billing Project');

      // Assert
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAccessibleName(additionalSecurityMonitoring);
      expect(checkbox).toHaveAttribute('disabled');
      expect(checkbox).toBeChecked();
    });

    it('checks and disables the option if an auth domain is chosen', async () => {
      // Arrange
      const user = userEvent.setup();
      setup({ groups: ['AuthDomain'] });

      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            onSuccess: () => {},
            onDismiss: () => {},
          })
        );
      });

      await selectBillingProject(user, 'Google Billing Project');

      const groupsSelector = screen.getByText('Select groups');
      await user.click(groupsSelector);

      const authDomain = screen.getByText('AuthDomain');
      await user.click(authDomain);

      // Assert
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAccessibleName(additionalSecurityMonitoring);
      expect(checkbox).toHaveAttribute('disabled');
      expect(checkbox).toBeChecked();
    });
  });

  it('allows showing a notice based on the selected billing project', async () => {
    // Arrange
    const user = userEvent.setup();
    setup({ groups: ['AuthDomain'] });

    const renderNotice = jest.fn().mockImplementation(({ selectedBillingProject }) => {
      return selectedBillingProject
        ? `Selected billing project: ${selectedBillingProject.projectName}`
        : 'No selected billing project';
    });

    // Act
    await act(async () => {
      render(
        h(NewWorkspaceModal, {
          renderNotice,
          onSuccess: () => {},
          onDismiss: () => {},
        })
      );
    });

    // Assert
    expect(renderNotice).toHaveBeenCalledWith({ selectedBillingProject: undefined });
    screen.getByText('No selected billing project');

    // Act
    const projectSelect = new SelectHelper(screen.getByLabelText('Billing project *'), user);
    await projectSelect.selectOption(/Google Billing Project/);

    // Assert
    expect(renderNotice).toHaveBeenCalledWith({ selectedBillingProject: gcpBillingProject });
    screen.getByText('Selected billing project: Google Billing Project');
  });

  describe('while creating a workspace', () => {
    const workspaceFromCreateResponse = defaultGoogleWorkspace.workspace;
    let createWorkspace: jest.MockedFunction<WorkspacesAjaxContract['create']>;
    let captureEvent: jest.MockedFunction<MetricsContract['captureEvent']>;

    beforeEach(async () => {
      // Arrange
      const user = userEvent.setup();
      const setupResult = setup();
      createWorkspace = setupResult.createWorkspace;
      createWorkspace.mockResolvedValue(workspaceFromCreateResponse);
      captureEvent = setupResult.captureEvent;

      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            onSuccess: () => {},
            onDismiss: () => {},
          })
        );
      });

      // Act
      const workspaceNameInput = screen.getByLabelText('Workspace name *');
      act(() => {
        fireEvent.change(workspaceNameInput, { target: { value: 'Test workspace' } });
      });

      const projectSelect = new SelectHelper(screen.getByLabelText('Billing project *'), user);
      await projectSelect.selectOption(/Google Billing Project/);

      const createWorkspaceButton = screen.getByRole('button', { name: 'Create Workspace' });
      await user.click(createWorkspaceButton);
    });

    it('shows message', () => {
      // Assert
      screen.getByText(/Creating and provisioning your workspace./);
      screen.getByText(/This may take a few minutes./);
    });

    it('hides buttons', () => {
      // Assert
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('emits a metrics event for a GCP workspace', async () => {
      // Assert
      expect(createWorkspace).toHaveBeenCalled();
      const expectedEvent = {
        cloudPlatform: 'GCP',
        region: 'US-CENTRAL1',
        workspaceName: workspaceFromCreateResponse.name,
        workspaceNamespace: workspaceFromCreateResponse.namespace,
        hasProtectedData: undefined,
        workspaceAccessLevel: undefined,
      };
      expect(captureEvent).toHaveBeenCalledWith(Events.workspaceCreate, expectedEvent);
    });
  });

  it('emits a metrics event when creating an Azure workspace', async () => {
    // Arrange
    const user = userEvent.setup();

    const billingProjectWithRegion = _.cloneDeep(azureBillingProject);
    billingProjectWithRegion.region = 'eastus';

    const { createWorkspace, captureEvent } = setup({ billingProjects: [billingProjectWithRegion] });
    createWorkspace.mockResolvedValue(defaultAzureWorkspace.workspace);

    await act(async () => {
      render(
        h(NewWorkspaceModal, {
          onSuccess: () => {},
          onDismiss: () => {},
        })
      );
    });

    // Act
    const workspaceNameInput = screen.getByLabelText('Workspace name *');
    act(() => {
      fireEvent.change(workspaceNameInput, { target: { value: 'Test workspace' } });
    });

    const projectSelect = new SelectHelper(screen.getByLabelText('Billing project *'), user);
    await projectSelect.selectOption(/Azure Billing Project/);

    const createWorkspaceButton = screen.getByRole('button', { name: 'Create Workspace' });
    await user.click(createWorkspaceButton);

    // Assert
    expect(createWorkspace).toHaveBeenCalled();
    const expectedEvent = {
      cloudPlatform: 'AZURE',
      region: 'eastus',
      workspaceName: defaultAzureWorkspace.workspace.name,
      workspaceNamespace: defaultAzureWorkspace.workspace.namespace,
      hasProtectedData: undefined,
      workspaceAccessLevel: undefined,
    };
    expect(captureEvent).toHaveBeenCalledWith(Events.workspaceCreate, expectedEvent);
  });

  it.each([
    { billingProjectName: azureBillingProject.projectName, cloudPlatform: 'Azure' },
    { billingProjectName: gcpBillingProject.projectName, cloudPlatform: 'Gcp' },
  ] as { billingProjectName: string; cloudPlatform: WorkspaceInfo['cloudPlatform'] }[])(
    'includes $cloudPlatform cloud platform from workspace response',
    async ({ billingProjectName, cloudPlatform }) => {
      // Arrange
      const user = userEvent.setup();

      const createdWorkspace = mockWorkspaceDetails[cloudPlatform];
      const { createWorkspace } = setup();
      createWorkspace.mockResolvedValue(createdWorkspace);

      const onSuccess = jest.fn();
      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            onSuccess,
            onDismiss: () => {},
          })
        );
      });

      // Act
      const workspaceNameInput = screen.getByLabelText('Workspace name *');
      act(() => {
        fireEvent.change(workspaceNameInput, { target: { value: createdWorkspace.name } });
      });

      const projectSelect = new SelectHelper(screen.getByLabelText('Billing project *'), user);
      await projectSelect.selectOption(new RegExp(billingProjectName));

      const createWorkspaceButton = screen.getByRole('button', { name: 'Create Workspace' });
      await user.click(createWorkspaceButton);

      // Assert
      expect(onSuccess).toHaveBeenCalledWith({
        ...createdWorkspace,
        cloudPlatform,
      });
    }
  );

  describe('handles server errors responses from creating a workspace', () => {
    it.each([
      {
        response: new Response('{"message":"Something went wrong."}', { status: 500 }),
        format: 'JSON',
        expectedMessage: 'Something went wrong.',
      },
      {
        response: new Response('Something went wrong.', { status: 500 }),
        format: 'text',
        expectedMessage: 'Unknown error.',
      },
    ] as { response: Response; format: string; expectedMessage: string }[])(
      'shows an error message if create workspace request returns a $format error response',
      async ({ response, expectedMessage }) => {
        // Arrange
        const user = userEvent.setup();
        const { createWorkspace } = setup({ billingProjects: [azureBillingProject] });
        createWorkspace.mockRejectedValue(response);

        await act(async () => {
          render(
            h(NewWorkspaceModal, {
              onSuccess: () => {},
              onDismiss: () => {},
            })
          );
        });

        // Act
        const workspaceNameInput = screen.getByLabelText('Workspace name *');
        act(() => {
          fireEvent.change(workspaceNameInput, { target: { value: 'Test workspace' } });
        });

        const projectSelect = new SelectHelper(screen.getByLabelText('Billing project *'), user);
        await projectSelect.selectOption(/Azure Billing Project/);

        const createWorkspaceButton = screen.getByRole('button', { name: 'Create Workspace' });
        await user.click(createWorkspaceButton);

        // Assert
        screen.getByText(expectedMessage);
      }
    );

    it('shows an error message if creating a workspace throws an error', async () => {
      // Arrange
      const user = userEvent.setup();
      const { createWorkspace } = setup({ billingProjects: [azureBillingProject] });
      createWorkspace.mockRejectedValue(new Error('Something went wrong.'));

      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            onSuccess: () => {},
            onDismiss: () => {},
          })
        );
      });

      // Act
      const workspaceNameInput = screen.getByLabelText('Workspace name *');
      act(() => {
        fireEvent.change(workspaceNameInput, { target: { value: 'Test workspace' } });
      });

      const projectSelect = new SelectHelper(screen.getByLabelText('Billing project *'), user);
      await projectSelect.selectOption(/Azure Billing Project/);

      const createWorkspaceButton = screen.getByRole('button', { name: 'Create Workspace' });
      await user.click(createWorkspaceButton);

      // Assert
      screen.getByText('Something went wrong.');
    });
  });

  describe('has logic for WDS starting', () => {
    it(
      'can wait for WDS to start for Azure workspaces',
      withFakeTimers(async () => {
        // Arrange
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        const newWorkspace: AzureWorkspaceInfo = {
          namespace: azureBillingProject.projectName,
          name: 'test-workspace',
          workspaceId: 'aaaabbbb-cccc-dddd-0000-111122223333',
          createdBy: 'user@example.com',
          createdDate: '2023-11-13T18:39:32.267Z',
          lastModified: '2023-11-13T18:39:32.267Z',
          authorizationDomain: [],
          cloudPlatform: 'Azure',
        };

        const { createWorkspace, listApps, listWdsCollections } = setup({ billingProjects: [azureBillingProject] });
        createWorkspace.mockResolvedValue(newWorkspace);

        const wdsApp: ListAppItem = {
          workspaceId: 'aaaabbbb-cccc-dddd-0000-111122223333',
          cloudContext: {
            cloudProvider: 'AZURE',
            cloudResource:
              '0cb7a640-45a2-4ed6-be9f-63519f86e04b/ffd1069e-e34f-4d87-a8b8-44abfcba39af/mrg-terra-dev-previ-20230623095104',
          },
          kubernetesRuntimeConfig: {
            numNodes: 1,
            machineType: 'Standard_A2_v2',
            autoscalingEnabled: false,
          },
          errors: [],
          status: 'RUNNING',
          proxyUrls: {
            wds: 'https://lz34dd00bf3fdaa72f755eeea8f928bab7cd135043043d59d5.servicebus.windows.net/wds-aaaabbbb-cccc-dddd-0000-111122223333-aaaabbbb-cccc-dddd-0000-111122223333/',
          },
          appName: 'wds-aaaabbbb-cccc-dddd-0000-111122223333',
          appType: 'WDS',
          diskName: null,
          auditInfo: {
            creator: 'user@example.com',
            createdDate: '2023-11-13T18:41:32.267Z',
            destroyedDate: null,
            dateAccessed: '2023-11-13T18:41:32.267Z',
          },
          accessScope: 'WORKSPACE_SHARED',
          labels: {},
          region: 'us-central1',
        };

        listApps
          .mockResolvedValue([wdsApp])
          .mockResolvedValueOnce([{ ...wdsApp, status: 'PROVISIONING', proxyUrls: {} }]);

        listWdsCollections.mockResolvedValue(['aaaabbbb-cccc-dddd-0000-111122223333']).mockResolvedValueOnce([]);

        const onSuccess = jest.fn();

        await act(async () => {
          render(
            h(NewWorkspaceModal, {
              waitForServices: {
                wds: true,
              },
              onSuccess,
              onDismiss: () => {},
            })
          );
        });

        // Act
        const workspaceNameInput = screen.getByLabelText('Workspace name *');
        await user.type(workspaceNameInput, newWorkspace.name);

        const projectSelect = new SelectHelper(screen.getByLabelText('Billing project *'), user);
        await projectSelect.selectOption(/Azure Billing Project/);

        const createWorkspaceButton = screen.getByRole('button', { name: 'Create Workspace' });
        await user.click(createWorkspaceButton);

        // Assert
        expect(onSuccess).not.toHaveBeenCalled();

        // Act
        await act(() => jest.advanceTimersByTime(30000));

        // Assert
        expect(listApps).toHaveBeenCalledTimes(1);
        expect(onSuccess).not.toHaveBeenCalled();

        // Act
        await act(() => jest.advanceTimersByTime(15000));

        // Assert
        expect(listApps).toHaveBeenCalledTimes(2);
        expect(listWdsCollections).toHaveBeenCalledTimes(1);
        expect(listWdsCollections).toHaveBeenCalledWith(
          'https://lz34dd00bf3fdaa72f755eeea8f928bab7cd135043043d59d5.servicebus.windows.net/wds-aaaabbbb-cccc-dddd-0000-111122223333-aaaabbbb-cccc-dddd-0000-111122223333/',
          'aaaabbbb-cccc-dddd-0000-111122223333'
        );
        expect(onSuccess).not.toHaveBeenCalled();

        // Act
        await act(() => jest.advanceTimersByTime(5000));

        // Assert
        expect(listApps).toHaveBeenCalledTimes(2);
        expect(listWdsCollections).toHaveBeenCalledTimes(2);
        expect(listWdsCollections).toHaveBeenCalledWith(
          'https://lz34dd00bf3fdaa72f755eeea8f928bab7cd135043043d59d5.servicebus.windows.net/wds-aaaabbbb-cccc-dddd-0000-111122223333-aaaabbbb-cccc-dddd-0000-111122223333/',
          'aaaabbbb-cccc-dddd-0000-111122223333'
        );

        expect(onSuccess).toHaveBeenCalled();
      })
    );

    it(
      'shows an error if WDS fails to start',
      withFakeTimers(async () => {
        // Arrange
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        const newWorkspace: AzureWorkspaceInfo = {
          namespace: azureBillingProject.projectName,
          name: 'test-workspace',
          workspaceId: 'aaaabbbb-cccc-dddd-0000-111122223333',
          createdBy: 'user@example.com',
          createdDate: '2023-11-13T18:39:32.267Z',
          lastModified: '2023-11-13T18:39:32.267Z',
          authorizationDomain: [],
          cloudPlatform: 'Azure',
        };

        const { createWorkspace, listApps } = setup({ billingProjects: [azureBillingProject] });
        createWorkspace.mockResolvedValue(newWorkspace);

        const wdsApp: ListAppItem = {
          workspaceId: 'aaaabbbb-cccc-dddd-0000-111122223333',
          cloudContext: {
            cloudProvider: 'AZURE',
            cloudResource:
              '0cb7a640-45a2-4ed6-be9f-63519f86e04b/ffd1069e-e34f-4d87-a8b8-44abfcba39af/mrg-terra-dev-previ-20230623095104',
          },
          kubernetesRuntimeConfig: {
            numNodes: 1,
            machineType: 'Standard_A2_v2',
            autoscalingEnabled: false,
          },
          errors: [],
          status: 'ERROR',
          proxyUrls: {},
          appName: 'wds-aaaabbbb-cccc-dddd-0000-111122223333',
          appType: 'WDS',
          diskName: null,
          auditInfo: {
            creator: 'user@example.com',
            createdDate: '2023-11-13T18:41:32.267Z',
            destroyedDate: null,
            dateAccessed: '2023-11-13T18:41:32.267Z',
          },
          accessScope: 'WORKSPACE_SHARED',
          labels: {},
          region: 'us-central1',
        };

        listApps
          .mockResolvedValue([wdsApp])
          .mockResolvedValueOnce([{ ...wdsApp, status: 'PROVISIONING', proxyUrls: {} }]);

        await act(async () => {
          render(
            h(NewWorkspaceModal, {
              waitForServices: {
                wds: true,
              },
              onSuccess: () => {},
              onDismiss: () => {},
            })
          );
        });

        // Act
        const workspaceNameInput = screen.getByLabelText('Workspace name *');
        await user.type(workspaceNameInput, newWorkspace.name);

        const projectSelect = new SelectHelper(screen.getByLabelText('Billing project *'), user);
        await projectSelect.selectOption(/Azure Billing Project/);

        const createWorkspaceButton = screen.getByRole('button', { name: 'Create Workspace' });
        await user.click(createWorkspaceButton);

        // Act
        await act(() => jest.advanceTimersByTime(30000));
        await act(() => jest.advanceTimersByTime(15000));

        // Assert
        expect(listApps).toHaveBeenCalledTimes(2);

        screen.getByText('Failed to provision data services for new workspace.');
      })
    );
  });

  describe('shows egress warnings for cloning GCP workspaces', () => {
    it('shows a message if the destination bucket location is in a different region', async () => {
      // Arrange
      const user = userEvent.setup();
      setup({ billingProjects: [gcpBillingProject] });

      // Act
      await act(async () => {
        render(
          h(NewWorkspaceModal, {
            cloneWorkspace: defaultGoogleWorkspace,
            onDismiss: () => {},
            onSuccess: () => {},
          })
        );
      });

      await selectBillingProject(user, 'Google Billing Project');

      const bucketLocationSelector = screen.getByLabelText('Bucket location');
      await user.click(bucketLocationSelector);

      // Verify warning doesn't show initially
      expect(screen.queryByText(egressWarning)).toBeNull();
      // Select a different bucket location from the source workspace one.
      const montrealLocation = screen.getByText('northamerica-northeast1 (Montreal)');
      await user.click(montrealLocation);

      // Assert
      // Have to use textContent to work around bolded sections of text.
      const warning = screen.getByText('Copying data from', { exact: false });
      expect(warning.textContent).toEqual(
        'Copying data from us-central1 (Iowa) to northamerica-northeast1 (Montreal) may incur network egress charges.'
      );
    });

    it.each([
      { mockRejectedValue: mockBucketRequesterPaysError },
      { mockRejectedValue: new Response('', { status: 403 }) },
      { mockRejectedValue: new Response('', { status: 500 }) },
    ] as { mockRejectedValue: any }[])(
      'shows a generic message if the source bucket location cannot be obtained ($mockRejectedValue)',
      async ({ mockRejectedValue }) => {
        // Arrange
        const user = userEvent.setup();
        const { checkBucketLocation } = setup({ billingProjects: [gcpBillingProject] });
        checkBucketLocation.mockRejectedValue(mockRejectedValue);
        // Don't show expected message about bucket location not being available
        jest.spyOn(console, 'log').mockImplementation(() => {});

        // Act
        await act(async () => {
          render(
            h(NewWorkspaceModal, {
              cloneWorkspace: defaultGoogleWorkspace,
              onDismiss: () => {},
              onSuccess: () => {},
            })
          );
        });

        // Verify warning doesn't show up until a destination billing project is selected.
        expect(screen.queryByText(egressWarning)).toBeNull();

        await selectBillingProject(user, 'Google Billing Project');

        // Assert
        screen.getByText(nonRegionSpecificEgressWarning);
      }
    );
  });

  describe('shows egress warnings for cloning Azure workspaces', () => {
    it.each([
      {
        workspaceRegion: 'eastus',
        billingProjectRegion: 'eastus',
        showWarning: false,
      },
      {
        workspaceRegion: 'eastus',
        billingProjectRegion: 'japaneast',
        showWarning: true,
      },
      {
        workspaceRegion: 'eastus',
        billingProjectRegion: '',
        showWarning: true,
      },
      {
        workspaceRegion: '',
        billingProjectRegion: '',
        showWarning: true,
      },
      {
        workspaceRegion: '',
        billingProjectRegion: 'eastus',
        showWarning: true,
      },
    ] as { workspaceRegion: string; billingProjectRegion: string; showWarning: boolean }[])(
      'decides when to show an egress warning, clone workspace region: "$workspaceRegion", billingProject region: "$billingProjectRegion", showWarning: $showWarning',
      async ({ workspaceRegion, billingProjectRegion, showWarning }) => {
        // Arrange
        const user = userEvent.setup();
        const billingProjectWithRegion = _.cloneDeep(azureBillingProject);
        billingProjectWithRegion.region = billingProjectRegion;
        const { containerInfo } = setup({ billingProjects: [billingProjectWithRegion] });
        containerInfo.mockResolvedValue({
          storageContainerName: 'sc-e18cfbc3-7115-4a37-add7-1d95d3ecfa14',
          resourceId: '4da46849-7f06-44e2-ba62-80fa2348ff35',
          region: workspaceRegion,
        });

        // Act
        await act(async () => {
          render(
            h(NewWorkspaceModal, {
              cloneWorkspace: defaultAzureWorkspace,
              onDismiss: () => {},
              onSuccess: () => {},
            })
          );
        });

        // Check that we show the region after the billing project name if we have.
        if (billingProjectRegion !== '') {
          expect(await getAvailableBillingProjects(user)).toEqual([
            `Azure Billing Project(${getRegionLabel(billingProjectRegion)})`,
          ]);
        } else {
          expect(await getAvailableBillingProjects(user)).toEqual(['Azure Billing Project']);
        }

        const projectSelect = new SelectHelper(screen.getByLabelText('Billing project *'), user);
        await projectSelect.selectOption(/Azure Billing Project/);

        if (showWarning) {
          if (workspaceRegion !== '' && billingProjectRegion !== '') {
            const warning = screen.getByText('Copying data from', { exact: false });
            expect(warning.textContent).toEqual(
              `Copying data from ${getRegionLabel(workspaceRegion)} to ${getRegionLabel(
                billingProjectRegion
              )} may incur network egress charges.`
            );
          } else {
            screen.getByText(nonRegionSpecificEgressWarning);
          }
        } else {
          expect(screen.queryByText(egressWarning)).toBeNull();
        }
      }
    );
  });

  it('shows a generic message when cloning to a different billing project if getting the Azure storage container information fails', async () => {
    // Arrange
    const user = userEvent.setup();
    // Whether the billing project has a region doesn't actually matter for this case.
    const billingProjectWithRegion = _.cloneDeep(azureBillingProject);
    billingProjectWithRegion.region = 'eastus';
    const { containerInfo } = setup({ billingProjects: [billingProjectWithRegion] });
    containerInfo.mockRejectedValue(new Response('Mock container error', { status: 500 }));

    // Don't show expected message about storage container not being available
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    await act(async () => {
      render(
        h(NewWorkspaceModal, {
          cloneWorkspace: defaultAzureWorkspace,
          onDismiss: () => {},
          onSuccess: () => {},
        })
      );
    });

    const projectSelect = new SelectHelper(screen.getByLabelText('Billing project *'), user);
    await projectSelect.selectOption(/Azure Billing Project/);

    screen.getByText(nonRegionSpecificEgressWarning);
  });

  it('does not show an egress message if the user is cloning within the same billing project', async () => {
    // Arrange
    const user = userEvent.setup();
    const cloneWorkspace = _.cloneDeep(defaultAzureWorkspace);
    cloneWorkspace.workspace.namespace = azureBillingProject.projectName;

    const { containerInfo } = setup({ billingProjects: [azureBillingProject] });

    // The container error does not matter -- we will not show an egress message
    // because the selected billing project matches the namespace of the clone workspace.
    containerInfo.mockRejectedValue(new Response('Mock container error', { status: 500 }));

    // Don't show expected message about storage container not being available
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    await act(async () => {
      render(
        h(NewWorkspaceModal, {
          cloneWorkspace,
          onDismiss: () => {},
          onSuccess: () => {},
        })
      );
    });

    const projectSelect = new SelectHelper(screen.getByLabelText('Billing project *'), user);
    await projectSelect.selectOption(/Azure Billing Project/);

    expect(screen.queryByText(egressWarning)).toBeNull();
  });

  it('emits a metrics event when cloning an Azure workspace', async () => {
    // Arrange
    const user = userEvent.setup();

    const sourceWorkspace = defaultAzureWorkspace;
    const sourceWorkspaceRegion = 'westus2';
    const workspaceFromCloneResponse = mockWorkspaceDetails.Azure;
    const selectedBillingProjectRegion = 'eastus';

    const billingProjectWithRegion = _.cloneDeep(azureBillingProject);
    billingProjectWithRegion.region = selectedBillingProjectRegion;

    const { containerInfo, cloneWorkspace, captureEvent } = setup({ billingProjects: [billingProjectWithRegion] });
    cloneWorkspace.mockResolvedValue(workspaceFromCloneResponse);

    // When cloning, we retrieve the region of the source workspace.
    containerInfo.mockResolvedValue({
      storageContainerName: 'sc-e18cfbc3-7115-4a37-add7-1d95d3ecfa14',
      resourceId: '4da46849-7f06-44e2-ba62-80fa2348ff35',
      region: sourceWorkspaceRegion,
    });

    await act(async () => {
      render(
        h(NewWorkspaceModal, {
          cloneWorkspace: sourceWorkspace,
          onDismiss: () => {},
          onSuccess: () => {},
        })
      );
    });

    const projectSelect = new SelectHelper(screen.getByLabelText('Billing project *'), user);
    await projectSelect.selectOption(/Azure Billing Project/);

    // Act
    const workspaceNameInput = screen.getByLabelText('Workspace name *');
    act(() => {
      fireEvent.change(workspaceNameInput, { target: { value: 'Test workspace' } });
    });

    const cloneWorkspaceButton = screen.getByRole('button', { name: 'Clone Workspace' });
    await user.click(cloneWorkspaceButton);

    // Assert
    expect(cloneWorkspace).toHaveBeenCalled();
    const expectedEvent = {
      featured: false,
      fromWorkspaceCloudPlatform: 'AZURE',
      fromWorkspaceName: sourceWorkspace.workspace.name,
      fromWorkspaceNamespace: sourceWorkspace.workspace.namespace,
      fromWorkspaceRegion: sourceWorkspaceRegion,
      toWorkspaceCloudPlatform: 'AZURE',
      toWorkspaceName: workspaceFromCloneResponse.name,
      toWorkspaceNamespace: workspaceFromCloneResponse.namespace,
      toWorkspaceRegion: selectedBillingProjectRegion,
    };
    expect(captureEvent).toHaveBeenCalledWith(Events.workspaceClone, expectedEvent);
  });

  it('loads full description when cloning a workspace', async () => {
    // Arrange
    const cloneWorkspace = makeGoogleWorkspace({
      workspace: { attributes: { description: 'Important: before using this workspace,' } },
    });

    const { getWorkspaceDetails } = setup();
    getWorkspaceDetails.mockResolvedValue(
      makeGoogleWorkspace({
        workspace: {
          attributes: { description: 'Important: before using this workspace, <rest of the instructions>.' },
        },
      })
    );

    // Act
    await act(async () => {
      render(
        h(NewWorkspaceModal, {
          cloneWorkspace,
          onDismiss: () => {},
          onSuccess: () => {},
        })
      );
    });

    // Assert
    const descriptionInput = screen.getByLabelText('Description');
    expect(descriptionInput).toHaveValue('Important: before using this workspace, <rest of the instructions>.');
  });
});
