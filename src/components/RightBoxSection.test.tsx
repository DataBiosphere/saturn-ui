import { act, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { asMockedFn, MockedFn, partial, renderWithAppContexts as render } from 'src/testing/test-utils';

import { RightBoxSection } from './RightBoxSection';

jest.mock('src/libs/ajax/Metrics');

describe('RightBoxSection', () => {
  const captureEvent: MockedFn<MetricsContract['captureEvent']> = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent }));
  });

  it('displays the title', async () => {
    // Arrange
    // Act
    await act(async () => {
      render(<RightBoxSection title='Test Title' persistenceId='testId' />);
    });
    // Assert
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('toggles panel open state when clicked', async () => {
    // Arrange
    // Act
    render(
      <RightBoxSection title='Test Title' persistenceId='testId'>
        Panel Content
      </RightBoxSection>
    );
    const titleElement = screen.getByText('Test Title');
    expect(screen.queryByText('Panel Content')).toBeNull(); // ensuring the panel is closed
    fireEvent.click(titleElement);

    // Assert
    expect(screen.getByText('Panel Content')).toBeInTheDocument();
  });
});
