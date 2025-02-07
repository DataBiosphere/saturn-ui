import { act, screen } from '@testing-library/react';
import React from 'react';
import { WorkflowsLibrary } from 'src/pages/library/WorkflowsLibrary';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

jest.mock('src/libs/nav', () => ({
  ...jest.requireActual('src/libs/nav'),
  getLink: jest.fn().mockImplementation((_) => _),
}));

describe('Workflows Library', () => {
  it('renders page', async () => {
    // Act
    await act(async () => {
      render(<WorkflowsLibrary />);
    });

    // Assert
    const workflowsLink = await screen.getByRole('link', { name: 'workflows' });
    expect(workflowsLink).toHaveAttribute('href', 'library-workflows');

    // discover workflows section
    expect(screen.getByText('Discover Workflows')).toBeInTheDocument();
    // Dockstore and Terra Workflow Repo card
    expect(screen.getByText('Dockstore.org')).toBeInTheDocument();
    expect(screen.getByText('Terra Workflow Repository')).toBeInTheDocument();

    // curated workflows section
    expect(screen.getByText('Curated collections from our community:')).toBeInTheDocument();
    expect(screen.getByText('GATK Best Practices')).toBeInTheDocument();
    expect(screen.getByText('Long Read Pipelines')).toBeInTheDocument();
    expect(screen.getByText('WDL Analysis Research Pipelines')).toBeInTheDocument();
    expect(screen.getByText('Viral Genomics')).toBeInTheDocument();

    // right-side support links panel
    expect(screen.getByText('Helpful Workflow support links')).toBeInTheDocument();
    expect(screen.getByText(/Learn how to configure your workflow analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/For more documentation on Workflows, visit/i)).toBeInTheDocument();
  });
});
