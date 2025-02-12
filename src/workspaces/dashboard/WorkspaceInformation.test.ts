import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { h } from 'react-hyperscript-helpers';
import { azureRegions } from 'src/libs/azure-regions';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import {
  defaultAzureWorkspace,
  defaultGoogleWorkspace,
  protectedAzureWorkspace,
  protectedGoogleWorkspace,
  regionRestrictedAzureWorkspace,
} from 'src/testing/workspace-fixtures';
import { WorkspaceInformation } from 'src/workspaces/dashboard/WorkspaceInformation';
import { WorkspacePolicy } from 'src/workspaces/utils';

jest.mock('src/libs/notifications');

describe('WorkspaceInformation', () => {
  it('renders information for a non-protected workspace without region constraints and does not fail accessibility tests', async () => {
    // Act
    const { container } = render(
      h(WorkspaceInformation, { workspace: { ...defaultGoogleWorkspace, workspaceInitialized: true } })
    );

    // Assert
    // Access Level
    expect(screen.getAllByText('Owner')).not.toBeNull();
    // Created date
    expect(screen.getAllByText('2/15/2023')).not.toBeNull();
    // Last updated date
    expect(screen.getAllByText('3/15/2023')).not.toBeNull();
    // Should not have workspace protected entry
    expect(screen.queryByText('Additional Security Monitoring')).toBeNull();
    // Should not have region constraint
    expect(screen.queryByText('Region Constraint')).toBeNull();

    // Accessibility
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each([{ protectedWorkspace: protectedAzureWorkspace }, { protectedWorkspace: protectedGoogleWorkspace }])(
    'renders information for a protected workspace and does not fail accessibility tests',
    async ({ protectedWorkspace }) => {
      const user = userEvent.setup();

      // Act
      const { container } = render(
        h(WorkspaceInformation, { workspace: { ...protectedWorkspace, workspaceInitialized: true } })
      );

      // Assert
      // Access Level
      expect(screen.getAllByText('Owner')).not.toBeNull();
      // Created date
      expect(screen.getAllByText('2/15/2023')).not.toBeNull();
      // Last updated date
      expect(screen.getAllByText('3/15/2023')).not.toBeNull();
      // Should show protected workspace information.
      expect(screen.getAllByText('Additional Security Monitoring')).not.toBeNull();
      // Should not have region constraint
      expect(screen.queryByText('Region Constraint')).toBeNull();

      // Act, click on the info button to get tooltip text to render.
      await user.click(screen.getByLabelText('More info'));

      // Assert
      expect(screen.getAllByText(/controlled-access data/)).not.toBeNull();

      // Accessibility
      expect(await axe(container)).toHaveNoViolations();
    }
  );

  it('renders information for a workspace with region constraints and does not fail accessibility tests', async () => {
    const user = userEvent.setup();

    // Act
    const { container } = render(
      h(WorkspaceInformation, { workspace: { ...regionRestrictedAzureWorkspace, workspaceInitialized: true } })
    );

    // Assert
    // Access Level
    expect(screen.getAllByText('Owner')).not.toBeNull();
    // Created date
    expect(screen.getAllByText('2/15/2023')).not.toBeNull();
    // Last updated date
    expect(screen.getAllByText('3/15/2023')).not.toBeNull();
    // Should not have workspace protected entry
    expect(screen.queryByText('Additional Security Monitoring')).toBeNull();
    // Should show region constraint information.
    expect(screen.getAllByText('Region Constraint')).not.toBeNull();

    // Act, click on the info button to get tooltip text with region labels to render.
    await user.click(screen.getByLabelText('More info'));

    // Assert
    expect(screen.getAllByText(new RegExp(`${azureRegions.eastus.label}`))).not.toBeNull();
    expect(screen.getAllByText(new RegExp(`${azureRegions.westus2.label}`))).not.toBeNull();
    expect(screen.getAllByText(/unknownRegion/)).not.toBeNull();

    // Accessibility
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each([
    { policies: [] },
    {
      policies: [
        {
          namespace: 'terra',
          name: 'group-constraint',
          additionalData: [{ group: 'foo' }],
        },
        {
          namespace: 'terra',
          name: 'group-constraint',
          additionalData: [{ group: 'bar' }],
        },
      ],
    },
  ] as { policies: WorkspacePolicy[] }[])(
    'shows data access controls item based on group constraint policies',
    async ({ policies }) => {
      // Arrange
      const user = userEvent.setup();

      // Act
      render(
        h(WorkspaceInformation, { workspace: { ...defaultAzureWorkspace, policies, workspaceInitialized: true } })
      );

      // Assert
      if (policies.length === 0) {
        expect(screen.queryByText('Data Access Controls')).toBeNull();
      } else {
        screen.getByText('Data Access Controls');

        await user.click(screen.getByLabelText('More info'));
        screen.getByText(/Data Access Controls add additional permission restrictions to a workspace/);
      }
    }
  );
});
