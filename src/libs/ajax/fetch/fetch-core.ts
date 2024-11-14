import { abandonedPromise, delay } from '@terra-ui-packages/core-utils';
import { FetchFn, FetchWrapper } from '@terra-ui-packages/data-client-core';
import _ from 'lodash/fp';
import { ajaxOverridesStore } from 'src/libs/state';

// Allows use of ajaxOverrideStore to stub responses for end2end testing
export const withInstrumentation =
  (wrappedFetch) =>
  (...args) => {
    return _.flow(
      ..._.map(
        'fn',
        _.filter(({ filter }) => {
          const [url, { method = 'GET' } = {}] = args;
          return _.isFunction(filter)
            ? filter(...args)
            : url.match(filter.url) && (!filter.method || filter.method === method);
        }, ajaxOverridesStore.get())
      )
    )(wrappedFetch)(...args);
  };

// Ignores cancellation error when request is cancelled
export const withCancellation =
  (wrappedFetch) =>
  async (...args) => {
    try {
      return await wrappedFetch(...args);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return abandonedPromise();
      }
      throw error;
    }
  };

// Converts non-200 responses to exceptions
export const withErrorRejection =
  (wrappedFetch) =>
  async (...args) => {
    const res = await wrappedFetch(...args);
    if (res.ok) {
      return res;
    }
    throw res;
  };

export const fetchOk = _.flow(withInstrumentation, withCancellation, withErrorRejection)(fetch);

export const withUrlPrefix = _.curry((prefix, wrappedFetch) => (path, ...args) => {
  return wrappedFetch(prefix + path, ...args);
});

export interface MakeWithMaybeRetryArgs {
  /** i.e. 5000 - the maximum elapsed timeout (in milliseconds) for sum of all request attempts */
  maxTimeout: number;

  /** i.e. 1500 - the maximum attempt random delay (in milliseconds) that can occur before a request retry */
  maxAttemptDelay: number;

  /** i.e. 500 - the minimum attempt random delay (in milliseconds) that can occur before a request retry */
  minAttemptDelay: number;
}

/**
 * Factory method for withMaybeRetry.  Most consumers will likely use pre-made withMaybeRetry function
 * @param makeArgs
 */
export const makeWithMaybeRetry = (makeArgs: MakeWithMaybeRetryArgs) => {
  const withMaybeRetryAugmenter =
    (shouldNotRetryFn: (error: unknown) => boolean) =>
    (wrappedFetch: FetchFn) =>
    async (...args: Parameters<FetchFn>) => {
      const timeout = makeArgs.maxTimeout;
      const somePointInTheFuture = Date.now() + timeout;
      const maxDelayIncrement = makeArgs.maxAttemptDelay;
      const minDelay = makeArgs.minAttemptDelay;

      while (Date.now() < somePointInTheFuture) {
        try {
          await delay(minDelay + maxDelayIncrement * Math.random());
          return await wrappedFetch(...args);
        } catch (error) {
          if (shouldNotRetryFn(error)) {
            throw error;
          }
          // else: ignore error, will retry
        }
      }
      return wrappedFetch(...args);
    };
  return withMaybeRetryAugmenter;
};

/**
 * Creates a fetch function augmenter that retries a failed request based on the return value of shouldNotRetryFn.
 * A request will be retried additional times until a maxTimeout is reached.  The attempt delay will be randomized
 * between a min and max.
 *
 * @param shouldNotRetryFn - function that returns true/false if an error response should result in retries stopping.
 *
 * @return - FetchWrapper function augmenter
 */
export const withMaybeRetry = makeWithMaybeRetry({
  maxTimeout: 5000,
  maxAttemptDelay: 1500,
  minAttemptDelay: 500,
});

export const DEFAULT_TIMEOUT_DURATION = 10000;
export const DEFAULT_RETRY_COUNT = 5;

/**
 * Creates a fetch function augmenter that adds retry logic.  Each attempt will honor the max timeoutInMs arg.
 * A timeout or an error will trigger a retry until retryCount is exhausted.
 * @param retryCount - the maximum times to retry the request
 * @param timeoutInMs - the timeout for each request attempt
 */
export const withRetry =
  (retryCount: number = DEFAULT_RETRY_COUNT, timeoutInMs: number = DEFAULT_TIMEOUT_DURATION): FetchWrapper =>
  (request: FetchFn): FetchFn => {
    const fetchFn: FetchFn = async (...args: Parameters<FetchFn>): ReturnType<FetchFn> => {
      let retriesLeft = retryCount;
      while (retriesLeft >= 0) {
        try {
          const raceResponse = await Promise.race([
            async () => await request(...args),
            // If the request takes longer than allowed, reject it, so we try again.
            async () => {
              await delay(timeoutInMs);
              throw new Error('Request timed out');
            },
          ]);
          const response = await raceResponse();

          if (response.ok) {
            return response;
          }
        } catch (error) {
          if (retriesLeft === 0) {
            throw error;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, timeoutInMs));
        retriesLeft--;
      }
      throw Error('Request timed out');
    };
    return fetchFn;
  };

export const appIdentifier = { headers: { 'X-App-ID': 'Saturn' } };

export const withAppIdentifier =
  (wrappedFetch: FetchFn): FetchFn =>
  (url, options) => {
    return wrappedFetch(url, _.merge(options, appIdentifier));
  };
