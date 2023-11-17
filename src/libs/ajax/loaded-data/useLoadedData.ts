import { ErrorState, LoadedState, ReadyState } from '@terra-ui-packages/core-utils';
import { useCallback, useEffect, useState } from 'react';
import { usePrevious } from 'src/libs/react-utils';

export interface UseLoadedDataArgs<S, E = unknown> {
  /**
   * An optional handler that will be called if there is an error.
   * Note that LoadedData object typing already allows expression of error status, convenient for consumption by
   * visual components.  This handler is to accommodate additional side effects within the hook consuming
   * useLoadedData hook
   * @param state - the error state as of when the error happened
   * @example
   * const [pendingCreate, setPendingCreate] = useLoadedData<true>({
   *   onError: (errState) => ReportError(errState.error)
   * })
   */
  onError?: (state: ErrorState<S, E>) => void;

  /**
   * An optional handler that will be called on successful data load.
   * Note that LoadedData object typing already allows expression of error status, convenient for consumption by
   * visual components.  This handler is to accommodate additional side effects within the hook consuming
   * useLoadedData hook
   * @param state - the ready state as of when the error happened
   * @example
   * const [pendingCreate, setPendingCreate] = useLoadedData<true>({
   *   onError: (readyState) => doSomething(readyState.state)
   * })
   */
  onSuccess?: (state: ReadyState<S>) => void;
}

/**
 * The Tuple returned by useLoadedData custom helper hook
 */
export type UseLoadedDataResult<T, E = unknown> = [LoadedState<T, E>, (dataCall: () => Promise<T>) => Promise<void>];

export type LoadedDataEvents<S, E = unknown> = Pick<UseLoadedDataArgs<S, E>, 'onSuccess' | 'onError'>;

export const useLoadedDataEvents = <S, E = unknown>(loadedData: LoadedState<S, E>, events: LoadedDataEvents<S, E>) => {
  const { onSuccess, onError } = events;
  const previousStatus = usePrevious(loadedData.status);

  useEffect(() => {
    if (loadedData.status === 'Error' && previousStatus !== 'Error') {
      onError?.(loadedData);
    }
  }, [loadedData, previousStatus, onError]);
  useEffect(() => {
    if (loadedData.status === 'Ready' && previousStatus === 'Loading') {
      onSuccess?.(loadedData);
    }
  }, [loadedData, previousStatus, onSuccess]);
};

/**
 * A custom helper hook that will handle typical async data call mechanics and translate the possible outcomes to
 * the appropriate LoadedState<T> result.  Initial ('None'), 'Loading', 'Error' and 'Ready' states are handled.  The
 * Error case also handles error object as Fetch Response and extract the error message from response.text().
 *
 * @example
 * const [myData, updateMyData] = useLoadedData<MyDataType>()
 * //...
 * updateMyData(async () => {
 *   // any errors thrown by data call or additional checks here
 *   // will be translated to status: 'Error' LoadedState<T>
 *   cost coolData: MyDataType = await someDataMethod(args)
 *   return coolData
 * }
 * // ...
 * if (myData.status === 'Ready') {
 *   const goodData = myData.state
 *   // ...
 * }
 * @returns a tuple with [currentLoadedState, updateDataMethod]
 */
export const useLoadedData = <T>(hookArgs?: UseLoadedDataArgs<T>): UseLoadedDataResult<T> => {
  const args: UseLoadedDataArgs<T> = hookArgs || {};
  const [loadedData, setLoadedData] = useState<LoadedState<T, unknown>>({ status: 'None' });
  useLoadedDataEvents(loadedData, args);
  const updateDataFn = useCallback(async (dataCall: () => Promise<T>) => {
    setLoadedData((previousLoadedData) => {
      const previousState = previousLoadedData.status !== 'None' ? previousLoadedData.state : null;
      return {
        status: 'Loading',
        state: previousState,
      };
    });
    try {
      const result = await dataCall();
      const readyState: ReadyState<T> = {
        status: 'Ready',
        state: result,
      };
      setLoadedData(readyState);
    } catch (err: unknown) {
      const error = err instanceof Response ? Error(await err.text()) : err;
      setLoadedData((previousLoadedData) => {
        const previousState = previousLoadedData.status !== 'None' ? previousLoadedData.state : null;
        const errorResult: ErrorState<T, unknown> = {
          status: 'Error',
          state: previousState,
          error,
        };
        return errorResult;
      });
    }
  }, []);
  return [loadedData, updateDataFn];
};
