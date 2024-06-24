import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h } from 'react-hyperscript-helpers';
import { getLink } from 'src/libs/nav';
import { makeCompleteDate } from 'src/libs/utils';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import { metadata as mockRunDetailsMetadata } from 'src/workflows-app/fixtures/test-workflow';

import { WorkflowInfoBox, WorkflowInfoBoxProps } from './WorkflowInfoBox';

const mockWorkflowInfoBoxProps: WorkflowInfoBoxProps = {
  name: 'mock-workspace-name',
  namespace: 'mock-workspace-namespace',
  submissionId: 'mock-submission-uuid',
  workflowId: 'mock-workflow-uuid',
  workspaceId: 'mock-workspace-uuid',
  showLogModal: jest.fn(),
};

jest.mock('src/libs/nav', () => ({
  getCurrentUrl: jest.fn().mockReturnValue(new URL('https://app.terra.bio')),
  getLink: jest.fn(),
  goToPath: jest.fn(),
}));

jest.mock('src/workflows-app/utils/cromwell-metadata-utils', () => ({
  ...jest.requireActual('src/workflows-app/utils/cromwell-metadata-utils'),
  fetchMetadata: jest.fn().mockReturnValue(mockRunDetailsMetadata),
}));

describe('Workflow Info Box Rendering', () => {
  it('should render the workflow timing section', async () => {
    await act(() => render(h(WorkflowInfoBox, mockWorkflowInfoBoxProps)));

    expect(screen.getByText('Workflow Timing:')).toBeInTheDocument();
    const expectedStartTime = makeCompleteDate(mockRunDetailsMetadata.start);
    const expectedEndTime = makeCompleteDate(mockRunDetailsMetadata.end!);
    const startTimeContainer = screen.getByLabelText('Workflow Start Container');
    const endTimeContainer = screen.getByLabelText('Workflow End Container');
    expect(startTimeContainer.textContent).toContain(expectedStartTime);
    expect(endTimeContainer.textContent).toContain(expectedEndTime);
  });

  it('should render the workflow status section', async () => {
    await act(() => render(h(WorkflowInfoBox, mockWorkflowInfoBoxProps)));

    expect(screen.getByText('Workflow Status:')).toBeInTheDocument();
    const expectedStatus = mockRunDetailsMetadata.status;
    const statusContainer = screen.getByLabelText('Workflow Status Container');
    expect(statusContainer.textContent).toContain(expectedStatus);
  });

  it('should render the workflow script section', async () => {
    await act(() => render(h(WorkflowInfoBox, mockWorkflowInfoBoxProps)));

    expect(screen.getByText('Workflow Script:')).toBeInTheDocument();
    const expectedScriptLink = 'View Workflow Script';
    expect(screen.getByText(expectedScriptLink)).toBeInTheDocument();
  });

  it('should render the troubleshooting section', async () => {
    await act(() => render(h(WorkflowInfoBox, mockWorkflowInfoBoxProps)));
    expect(screen.getByText('Troubleshooting?')).toBeInTheDocument();
    const expectedWorkflowId = mockWorkflowInfoBoxProps.workflowId;
    const expectedSubmissionId = mockWorkflowInfoBoxProps.submissionId;
    expect(screen.getByText(expectedWorkflowId)).toBeInTheDocument();
    expect(screen.getByText(expectedSubmissionId)).toBeInTheDocument();
  });

  it('should show the WDL script when View Workflow Script is clicked', async () => {
    const user = userEvent.setup();
    await act(async () => render(h(WorkflowInfoBox, mockWorkflowInfoBoxProps)));
    const viewModalLink = screen.getByText('View Workflow Script');
    await user.click(viewModalLink);
    screen.getByText(/Retrieve reads from the/);
  });

  it('should create the correct link when the execution directory button is clicked', async () => {
    const user = userEvent.setup();
    await act(async () => render(h(WorkflowInfoBox, mockWorkflowInfoBoxProps)));

    const executionDirectoryButton = await screen.getByText('Execution Directory');
    await user.click(executionDirectoryButton);
    await waitFor(() =>
      expect(getLink).toBeCalledWith(
        'workspace-files',
        { name: mockWorkflowInfoBoxProps.name, namespace: mockWorkflowInfoBoxProps.namespace },
        { path: 'workspace-services/cbas/terra-app-other-random-value/fetch_sra_to_bam/more-random-value/' }
      )
    );
  });
});
