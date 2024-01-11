import { act, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { Ajax } from 'src/libs/ajax';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { asMockedFn, renderWithAppContexts as render } from 'src/testing/test-utils';
import { defaultAzureWorkspace } from 'src/testing/workspace-fixtures';

import { RightBoxSection } from './RightBoxSection';

type AjaxContract = ReturnType<typeof Ajax>;
jest.mock('src/libs/ajax');

describe('RightBoxSection', () => {
  const workspace = defaultAzureWorkspace;
  const captureEvent = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    asMockedFn(Ajax).mockImplementation(
      () =>
        ({
          Metrics: { captureEvent } as Partial<AjaxContract['Metrics']>,
        } as Partial<AjaxContract> as AjaxContract)
    );
  });

  it('displays the title', async () => {
    // Arrange
    // Act
    await act(async () => {
      render(<RightBoxSection title="Test Title" persistenceId="testId" workspace={workspace} />);
    });
    // Assert
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('toggles panel open state when clicked', async () => {
    // Arrange
    // Act
    render(
      <RightBoxSection title="Test Title" persistenceId="testId" workspace={workspace}>
        Panel Content
      </RightBoxSection>
    );
    const titleElement = screen.getByText('Test Title');
    expect(screen.queryByText('Panel Content')).toBeNull(); // ensuring the panel is closed
    fireEvent.click(titleElement);

    // Assert
    expect(screen.getByText('Panel Content')).toBeInTheDocument();
  });

  it('fires a metrics event when the panel is toggled', async () => {
    // Arrange
    // Act
    render(
      <RightBoxSection title="Test Title" persistenceId="metricsId" workspace={workspace}>
        Panel Content
      </RightBoxSection>
    );
    const titleElement = screen.getByText('Test Title');
    fireEvent.click(titleElement);
    fireEvent.click(titleElement);

    // Assert
    expect(captureEvent).toHaveBeenNthCalledWith(1, Events.workspaceDashboardSectionToggle, {
      opened: true,
      title: 'Test Title',
      ...extractWorkspaceDetails(defaultAzureWorkspace),
    });
    expect(captureEvent).toHaveBeenNthCalledWith(2, Events.workspaceDashboardSectionToggle, {
      opened: false,
      title: 'Test Title',
      ...extractWorkspaceDetails(defaultAzureWorkspace),
    });
  });
});
