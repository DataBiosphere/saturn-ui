import { act, screen } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import React from 'react';
import { FindWorkflowModal } from 'src/pages/workspaces/workspace/modals/FindWorkflowModal';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

jest.mock('src/libs/ajax');
jest.mock('src/libs/nav', () => ({
  ...jest.requireActual('src/libs/nav'),
  getLink: jest.fn(() => '#workflows'),
}));

describe('FindWorkflowModal', () => {
  it('renders elements in the modal', async () => {
    // Act
    await act(async () => {
      render(<FindWorkflowModal onDismiss={jest.fn()} />);
    });

    // Assert
    expect(screen.getByText('Find a workflow')).toBeInTheDocument();
    // 'x' close button
    expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
    // Dockstore and Terra Workflow Repo card
    expect(screen.getByText('Dockstore.org')).toBeInTheDocument();
    expect(screen.getByText('Terra Workflow Repository')).toBeInTheDocument();
    // curated workflows section
    expect(screen.getByText('GATK Best Practices')).toBeInTheDocument();
    expect(screen.getByText('Long Read Pipelines')).toBeInTheDocument();
    expect(screen.getByText('WDL Analysis Research Pipelines')).toBeInTheDocument();
    expect(screen.getByText('Viral Genomics')).toBeInTheDocument();
    // cancel button
    expect(screen.getByRole('button', { name: 'Cancel' }));
    // help section
    expect(screen.getByText(/how to import and configure your workflow/i)).toBeInTheDocument();
  });

  it("clicking on 'x' icon dismisses the modal", async () => {
    // Arrange
    const mockOnDismiss = jest.fn();
    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<FindWorkflowModal onDismiss={mockOnDismiss} />);
    });

    // Assert
    expect(screen.getByText('Find a workflow')).toBeInTheDocument();

    // Act
    // dismiss the modal
    await user.click(screen.getByLabelText('Close modal'));

    // Assert
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('clicking on cancel button dismisses the modal', async () => {
    // Arrange
    const mockOnDismiss = jest.fn();
    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(<FindWorkflowModal onDismiss={mockOnDismiss} />);
    });

    // Assert
    expect(screen.getByText('Find a workflow')).toBeInTheDocument();

    // Act
    // dismiss the modal using Cancel button
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });
});
