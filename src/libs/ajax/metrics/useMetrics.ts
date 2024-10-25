import { useMemo } from 'react';
import { Metrics } from 'src/libs/ajax/Metrics';
import { MetricsEventName } from 'src/libs/events';

export type CaptureEventFn = (event: MetricsEventName, details?: Record<string, any>, refreshAppcues?: boolean) => void;

export interface MetricsProvider {
  captureEvent: CaptureEventFn;
}

export const useMetricsEvent = (): MetricsProvider => {
  const sendEvent = useMemo(() => Metrics().captureEvent, []);
  // By returning a wrapper function, we can handle the fire-and-forget promise mechanics properly here
  // instead of burdening the consumer side with silencing the Typescript/lint complaints, which can be
  // quite awkward in some nested functional uses.
  const captureEvent: CaptureEventFn = (event, details, refreshAppcues): void => {
    // fire and forget
    void sendEvent(event, details, refreshAppcues);
  };
  return { captureEvent };
};
