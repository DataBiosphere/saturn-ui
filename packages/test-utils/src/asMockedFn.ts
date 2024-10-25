export type AnyFn = (...args: any[]) => any;

export type MockedFn<F extends AnyFn> = jest.MockedFunction<F>;

/**
 * Use when working with a function mocked with jest.mock to tell TypeScript that
 * the function has been mocked and allow accessing mock methods/properties.
 *
 * @example
 * import { someFunction } from 'path/to/module';
 *
 * jest.mock('path/to/module', () => {
 *   return {
 *     ...jest.requireActual('path/to/module'),
 *     someFunction: jest.fn(),
 *   }
 * })
 *
 * asMockedFn(someFunction).mockImplementation(...)
 */
export const asMockedFn = <T extends AnyFn>(fn: T): jest.MockedFunction<T> => {
  return fn as jest.MockedFunction<T>;
};

/**
 * partial - will cast a partial type to the full type.
 * Useful in test mock return values, etc. where specifying all properties is not necessary for the
 * code under test to work, and/or do assertions on the results.
 * @param x
 * @example const mockAbc = partial<Abc>({a: 'apple'});
 */
export const partial = <T>(x: Partial<T>): T => {
  return x satisfies Partial<T> as T;
};
