import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h } from 'react-hyperscript-helpers';
import { AnalysesData } from 'src/analysis/Analyses';
import { WorkflowsAppNavPanel } from 'src/workflows-app/components/WorkflowsAppNavPanel';
import { mockAzureWorkspace } from 'src/workflows-app/utils/mock-responses';

const defaultAnalysesData: AnalysesData = {
  apps: [],
  refreshApps: jest.fn().mockReturnValue(Promise.resolve()),
  runtimes: [],
  refreshRuntimes: () => Promise.resolve(),
  appDataDisks: [],
  persistentDisks: [],
};

describe('Left Navigation Panel', () => {
  it('renders headers', async () => {
    const user = userEvent.setup();

    render(
      h(WorkflowsAppNavPanel, {
        name: 'test-azure-ws-name',
        namespace: 'test-azure-ws-namespace',
        workspace: mockAzureWorkspace,
        analysesData: defaultAnalysesData,
        loading: false,
      })
    );

    // Assert
    screen.getByText('Workflows in this workspace');
    screen.getByText('Submission history');
    screen.getByText('Find & add workflows');
    screen.getByText('Featured workflows');
    screen.getByText('Import a workflow');
    screen.getByText('Dockstore');
    screen.getByText('Have questions?');

    // Act
    const findAndAddWorkflowsCollapse = screen.getByText('Find & add workflows');
    const featuredWorkflows = screen.getByText('Featured workflows');
    const importWorkflows = screen.getByText('Import a workflow');

    await user.click(findAndAddWorkflowsCollapse);

    expect(featuredWorkflows).not.toBeInTheDocument();
    expect(importWorkflows).not.toBeInTheDocument();
  });
});
