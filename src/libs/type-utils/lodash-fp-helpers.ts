import _ from 'lodash/fp'
import { AnyFn, AnyPromiseFn, GenericFn, WrapFn } from 'src/libs/type-utils/general-types'

/**
 * (async Promise overload) Provides better type flow and ergonomics for the common case of wrapping a
 * main function (typically a data call that returns a promise) with
 * additional pass-thru wrapper functions (handlers) to handle things like
 * errors or retry.  These handlers are expected to be HoF's
 * (higher order functions) that return a wrapped function with the desired
 * handling logic which still honors the same function signature of the fn
 * it is given as it's single argument
 * @param handlers
 * @param mainFn
 */
export function withHandlers<P, A extends any[], F extends (...args: A) => Promise<P>>(
  handlers: WrapFn<(...args: A) => Promise<P | unknown>>[],
  mainFn: F
): F
/**
 * (non-async overload) Provides better type flow and ergonomics for the
 * common case of wrapping a main function with additional pass-thru wrapper
 * functions (handlers).  These handlers are expected to be HoF's
 * (higher order functions) that return a wrapped function with the desired
 * handling logic which still honors the same function signature of the fn
 * it is given as it's single argument
 * @param handlers
 * @param mainFn
 */
export function withHandlers<F extends AnyFn, F2 extends F>(
  handlers: WrapFn<GenericFn<F2>>[],
  mainFn: F
): GenericFn<F>
export function withHandlers<F extends AnyFn>(
  handlers: ((fn: F) => F)[],
  mainFn: F
): F {
  const resultFn = _.flow(...handlers)(mainFn)
  return resultFn
}

/**
 * produces a curried function that expect the last argument to be given
 * before executing the original function.
 * Provides better type flow then the more general _.curry(fn)
 * @param fn function with 2 arguments
 */
export function curryLastArg<A, LAST, R>(
  fn: (a: A, last: LAST) => R
) : (a: A) => (last: LAST) => R;
/**
 * produces a curried function that expect the last argument to be given
 * before executing the original function.
 * Provides better type flow then the more general _.curry(fn)
 * @param fn function with 3 arguments
 */
export function curryLastArg<A, B, LAST, R>(
  fn: (a: A, b: B, last: LAST) => R
) : (a: A, b: B) => (last: LAST) => R;
/**
 * produces a curried function that expect the last argument to be given
 * before executing the original function.
 * Provides better type flow then the more general _.curry(fn)
 * @param fn function with 4 arguments
 */
export function curryLastArg<A, B, C, LAST, R>(
  fn: (a: A, b: B, c: C, last: LAST) => R
) : (a: A, b: B, c: C) => (last: LAST) => R;
/**
 * produces a curried function that expect the last argument to be given
 * before executing the original function.
 * Provides better type flow then the more general _.curry(fn)
 * @param fn function with 5 arguments
 */
export function curryLastArg<A, B, C, D, LAST, R>(
  fn: (a: A, b: B, c: C, d:D, last: LAST) => R
) : (a: A, b: B, c: C, d: D) => (last: LAST) => R;
export function curryLastArg(fn: (
    ...args: unknown[]) => unknown) {
  return (...args2: unknown[]) => {
    return (last: unknown) => {
      return fn(...args2, last)
    }
  }
}

/**
 * (non-async) a convenience helper for creating handler-wrapper functions
 * that add logic and/or side effects but produce a wrapped function that
 * preserves the function signature of the original function.  This helper
 * removes the concern of original function arguments by providing a
 * zero-argument executor argument that the given handler function can call.
 * When used with recommended patterns (see unit tests) the need for
 * currying is removed.
 * @param handler
 */
export const createHandler = <F extends AnyFn>(
  handler: (executor: () => ReturnType<F>) => ReturnType<F>
) => {
  const wrappedFn = (fn: (...args: Parameters<F>) => ReturnType<F>) => {
    const innerFn = (...fnArgs: Parameters<F>): ReturnType<F> => {
      const executor = (): ReturnType<F> => {
        const result: ReturnType<F> = fn(...fnArgs)
        return result
      }
      const handlerResult = handler(executor)
      return handlerResult
    }
    return innerFn
  }
  return wrappedFn
}

/**
 * (async) a convenience helper for creating handler-wrapper functions
 * that add logic and/or side effects but produce a wrapped function that
 * preserves the function signature of the original function.  This helper
 * removes the concern of original function arguments by providing a
 * zero-argument executor argument that the given handler function can call.
 * When used with recommended patterns (see unit tests) the need for
 * currying is removed.
 * @param handler
 */
export const createHandlerAsync = <P, F extends AnyPromiseFn<P>>(
  handler: (executor: () => Promise<P>) => Promise<P>
) => {
  const wrappedFn = (fn: (...args: Parameters<F>) => Promise<P>) => {
    const innerFn = async (...fnArgs: Parameters<F>): Promise<P> => {
      const executor = async (): Promise<P> => {
        const result: P = await fn(...fnArgs)
        return result
      }
      const handlerResult = await handler(executor)
      return handlerResult
    }
    return innerFn
  }
  return wrappedFn
}
