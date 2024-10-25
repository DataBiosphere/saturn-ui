import { renderHook } from '@testing-library/react';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import Events from 'src/libs/events';
import { asMockedFn, partial } from 'src/testing/test-utils';

import { useMetricsEvent } from './useMetrics';

jest.mock('src/libs/ajax/Metrics');

describe('useMetricsEvent', () => {
  it('calls event logger', () => {
    // Arrange
    const watchCaptureEvent = jest.fn();

    asMockedFn(Metrics).mockReturnValue(
      partial<MetricsContract>({
        captureEvent: (event, details) => watchCaptureEvent(event, details),
      })
    );

    // Act
    const renderedHook = renderHook(() => useMetricsEvent());
    const { captureEvent } = renderedHook.result.current;
    captureEvent(Events.workspaceCreate, { something: 'interesting' });

    // Assert
    expect(watchCaptureEvent).toBeCalledTimes(1);
    expect(watchCaptureEvent).toBeCalledWith(Events.workspaceCreate, { something: 'interesting' });
  });
});
