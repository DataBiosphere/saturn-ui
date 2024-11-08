import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { BillingProjectActions } from 'src/billing/List/BillingProjectActions';
import { Billing, BillingContract } from 'src/libs/ajax/billing/Billing';
import { reportError } from 'src/libs/error';
import * as Nav from 'src/libs/nav';
import { history } from 'src/libs/nav';
import { asMockedFn, MockedFn, partial, renderWithAppContexts as render } from 'src/testing/test-utils';
import { WorkspaceWrapper } from 'src/workspaces/utils';

jest.mock('src/libs/ajax/billing/Billing');

type UseWorkspacesExports = typeof import('src/workspaces/common/state/useWorkspaces');
jest.mock('src/workspaces/common/state/useWorkspaces', (): UseWorkspacesExports => {
  return {
    ...jest.requireActual<UseWorkspacesExports>('src/workspaces/common/state/useWorkspaces'),
    useWorkspaces: jest.fn(),
  };
});

type ErrorExports = typeof import('src/libs/error');
jest.mock(
  'src/libs/error',
  (): ErrorExports => ({
    ...jest.requireActual('src/libs/error'),
    reportError: jest.fn(),
  })
);

describe('BillingProjectActions', () => {
  const verifyDisabled = (item) => expect(item).toHaveAttribute('disabled');
  const verifyEnabled = (item) => expect(item).not.toHaveAttribute('disabled');

  const deleteProjectMock: MockedFn<BillingContract['deleteProject']> = jest.fn();
  deleteProjectMock.mockResolvedValue(new Response('', { status: 204 }));

  const projectName = 'testProject';
  const propsWithNoWorkspacesInProject = {
    projectName,
    loadProjects: jest.fn(),
    workspacesLoading: false,
    allWorkspaces: [
      {
        workspace: {
          namespace: 'aDifferentProject',
          name: 'testWorkspaces',
          workspaceId: '6771d2c8-cd58-47da-a54c-6cdafacc4175',
        },
        accessLevel: 'WRITER',
      },
    ] as WorkspaceWrapper[],
  };

  beforeEach(() => {
    asMockedFn(Billing).mockReturnValue(
      partial<BillingContract>({
        deleteProject: deleteProjectMock,
      })
    );

    Nav.history.replace({ search: 'initial' });
  });

  it('renders Delete as disabled while workspaces are loading', () => {
    // Arrange
    const props = {
      projectName,
      loadProjects: jest.fn(),
      workspacesLoading: true,
      allWorkspaces: undefined,
    };

    // Act
    render(<BillingProjectActions {...props} />);

    // Assert
    const deleteButton = screen.getByLabelText('Cannot delete billing project while workspaces are loading');
    verifyDisabled(deleteButton);
  });

  it('renders Delete as disabled if project has workspaces', () => {
    // Arrange
    const props = {
      projectName,
      loadProjects: jest.fn(),
      workspacesLoading: false,
      allWorkspaces: [
        {
          workspace: {
            namespace: projectName,
            name: 'testWorkspaces',
            workspaceId: '6771d2c8-cd58-47da-a54c-6cdafacc4175',
          },
          accessLevel: 'WRITER',
        },
      ] as WorkspaceWrapper[],
    };

    // Act
    render(<BillingProjectActions {...props} />);

    // Assert
    const deleteButton = screen.getByLabelText('Cannot delete billing project because it contains workspaces');
    verifyDisabled(deleteButton);
  });

  it('renders Delete as enabled if project has no workspaces', () => {
    // Arrange -- common setup implements mock with no workspaces for project

    // Act
    render(<BillingProjectActions {...propsWithNoWorkspacesInProject} />);

    // Assert
    const deleteButton = screen.getByLabelText(`Delete billing project ${projectName}`);
    verifyEnabled(deleteButton);
  });

  it('calls the server to delete a billing project', async () => {
    // Arrange
    const loadProjects = jest.fn();
    propsWithNoWorkspacesInProject.loadProjects = loadProjects;

    // Act
    render(<BillingProjectActions {...propsWithNoWorkspacesInProject} />);
    const deleteButton = screen.getByLabelText(`Delete billing project ${projectName}`);
    await userEvent.click(deleteButton);
    const confirmDeleteButton = screen.getByTestId('confirm-delete');
    await userEvent.click(confirmDeleteButton);

    // Assert
    expect(deleteProjectMock).toHaveBeenCalledWith(projectName);
    expect(loadProjects).toHaveBeenCalledTimes(1);
    expect(history.location.search).toBe('');
  });

  it('does not call the server to delete a billing project if the user cancels', async () => {
    // Arrange
    const loadProjects = jest.fn();
    propsWithNoWorkspacesInProject.loadProjects = loadProjects;

    // Act
    render(<BillingProjectActions {...propsWithNoWorkspacesInProject} />);
    const deleteButton = screen.getByLabelText(`Delete billing project ${projectName}`);
    await userEvent.click(deleteButton);
    const cancelButton = screen.getByText('Cancel');
    await userEvent.click(cancelButton);

    // Assert
    expect(deleteProjectMock).not.toHaveBeenCalled();
    expect(loadProjects).not.toHaveBeenCalled();
    expect(history.location.search).toBe('?initial');
  });

  it('handles errors from deleting a billing project', async () => {
    // Arrange
    const deleteProject: MockedFn<BillingContract['deleteProject']> = jest.fn();
    deleteProject.mockRejectedValue({ status: 500 });
    asMockedFn(Billing).mockReturnValue(partial<BillingContract>({ deleteProject }));

    const loadProjects = jest.fn();
    propsWithNoWorkspacesInProject.loadProjects = loadProjects;

    // Act
    render(<BillingProjectActions {...propsWithNoWorkspacesInProject} />);
    const deleteButton = screen.getByLabelText(`Delete billing project ${projectName}`);
    await userEvent.click(deleteButton);
    const confirmDeleteButton = screen.getByTestId('confirm-delete');
    await userEvent.click(confirmDeleteButton);

    // Assert
    expect(history.location.search).toBe('?initial');
    expect(loadProjects).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalled();
  });
});
