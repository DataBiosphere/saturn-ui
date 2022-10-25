import _ from 'lodash/fp'
import {
  AnyFn, AnyPromiseFn,
  createHandler,
  createHandlerAsync,
  curryLastArg,
  GenericFn, GenericPromiseFn,
  withHandlers
} from './lodash-fp-helpers'
import {SafeCurry2, SafeCurry3} from 'types/lodash-fp/lodash-fp.utils'
import {delay, waitOneTick} from "src/libs/utils";

describe('Lodash FP Helpers', () => {
  describe('withHandlers', () => {
    it('handles basic handler wrapper fns', () => {
      // Arrange
      const handlersWatcher = jest.fn();
      const handler1 = <F extends AnyFn>(
          fn: GenericFn<F>
      ): GenericFn<F> => {
        return (...args: Parameters<F>): ReturnType<F> => {
          // simulate typical pattern of calling fn, then do handling
          const result = fn(...args)
          handlersWatcher('handler1')
          return result
        }
      }
      const handler2 = <F extends AnyFn>(
          fn: GenericFn<F>
      ): GenericFn<F> => {
        return (...args: Parameters<F>): ReturnType<F> => {
          // simulate typical pattern of calling fn, then do handling
          const result = fn(...args)
          handlersWatcher('handler2')
          return result
        }
      }
      const watcher = jest.fn()
      const mainFn = (a: string, b: string): string => {
        watcher(a, b)
        return `${a} ${b}!`
      }

      // Act
      const myFn = withHandlers([handler1, handler2], mainFn)
      const myResult = myFn('hello', 'there')

      // Assert
      expect(myResult).toBe('hello there!')
      expect(watcher).toBeCalledTimes(1)
      expect(watcher).toBeCalledWith('hello', 'there')

      expect(handlersWatcher).toBeCalledTimes(2)
      expect(handlersWatcher).toHaveBeenNthCalledWith(1, 'handler1')
      expect(handlersWatcher).toHaveBeenNthCalledWith(2, 'handler2')
    })

    it('handles handler wrapper fns created with curryLastArg', () => {
      // Arrange
      const handlersWatcher = jest.fn();

      const handler1Fn = <F extends AnyFn>(
          arg: string,
          fn: GenericFn<F>
      ): GenericFn<F> => {
        return (...args: Parameters<F>): ReturnType<F> => {
          // simulate typical pattern of calling fn, then do handling
          const result = fn(...args)
          handlersWatcher('handler1', arg)
          return result
        }
      }

      const handler1 = curryLastArg(handler1Fn)

      const handler2Fn = <F extends AnyFn>(
          arg1: string,
          arg2: number,
          fn: GenericFn<F>
      ): GenericFn<F> => {
        return (...args: Parameters<F>): ReturnType<F> => {
          // simulate typical pattern of calling fn, then do handling
          const result = fn(...args)
          handlersWatcher('handler2', arg1, arg2)
          return result
        }
      }

      const handler2 = curryLastArg(handler2Fn)

      const watcher = jest.fn()
      const mainFn = (a: string, b: string): string => {
        watcher(a, b)
        return `${a} ${b}!`
      }

      // Act
      const myFn = withHandlers([handler1('hi'), handler2('sup', 7)], mainFn)

      const myResult = myFn('hello', 'there')

      // Assert
      expect(myResult).toBe('hello there!')
      expect(watcher).toBeCalledTimes(1)
      expect(watcher).toBeCalledWith('hello', 'there')

      expect(handlersWatcher).toBeCalledTimes(2)
      expect(handlersWatcher).toHaveBeenNthCalledWith(1, 'handler1', 'hi')
      expect(handlersWatcher).toHaveBeenNthCalledWith(2, 'handler2', 'sup', 7)
    })

    it('handles handler wrapper fns created with createHandler', () => {
      // Arrange
      const handlersWatcher = jest.fn();

      const handler1 = <F extends AnyFn>(
          arg: string
      ) => {
        return createHandler<F>((executeInner: () => ReturnType<F>) => {
          const result = executeInner();
          handlersWatcher('handler1', arg)
          return result
        })
      }

      const handler2 = <F extends AnyFn>(
          arg1: string,
          arg2: number
      ) => {
        return createHandler<F>((executeInner: () => ReturnType<F>) => {
          const result = executeInner();
          handlersWatcher('handler2', arg1, arg2)
          return result
        })
      }

      const watcher = jest.fn()
      const mainFn = (a: string, b: string): string => {
        watcher(a, b)
        return `${a} ${b}!`
      }

      // Act
      const myFn = withHandlers([handler1('hi'), handler2('sup', 7)], mainFn)
      //const myFn = _.flow(handler1('not'), handler2('as safe', 7))(mainFn)

      const myResult = myFn('hello', 'there')

      // Assert
      expect(myResult).toBe('hello there!')
      expect(watcher).toBeCalledTimes(1)
      expect(watcher).toBeCalledWith('hello', 'there')

      expect(handlersWatcher).toBeCalledTimes(2)
      expect(handlersWatcher).toHaveBeenNthCalledWith(1, 'handler1', 'hi')
      expect(handlersWatcher).toHaveBeenNthCalledWith(2, 'handler2', 'sup', 7)
    })

    it('handles curried handler wrapper fns', () => {
      // Arrange
      const handlersWatcher = jest.fn();
      const handler1Fn = <F extends AnyFn>(
          arg: string,
          fn: GenericFn<F>
      ): GenericFn<F>  => {
        return (...args: Parameters<F>): ReturnType<F> => {
          // simulate typical pattern of calling fn, then do handling
          const result = fn(...args)
          handlersWatcher('handler1', arg)
          return result
        }
      }
      const handler1 = _.curry(handler1Fn) as SafeCurry2<typeof handler1Fn>

      const handler2Fn = <F extends AnyFn>(
          arg1: string,
          arg2: number,
          fn: GenericFn<F>
      ): GenericFn<F>  => {
        return (...args: Parameters<F>): ReturnType<F> => {
          // simulate typical pattern of calling fn, then do handling
          const result = fn(...args)
          handlersWatcher('handler2', arg1, arg2)
          return result
        }
      }
      const handler2 = _.curry(handler2Fn) as SafeCurry3<typeof handler2Fn>

      const watcher = jest.fn()
      const mainFn = (a: string, b: string): string => {
        watcher(a, b)
        return `${a} ${b}!`
      }

      // Act
      // testing curried functions for completeness, but note that they have
      // inherently less type safety compared to using curryOnlyLastArg or createHandler helpers
      const myFn = withHandlers([handler1('not'), handler2('as safe', 7)], mainFn)
      // const myFn = _.flow(handler1('not'), handler2('as safe', 7))(mainFn)
      const myResult = myFn('hello', 'there')

      // Assert
      expect(myResult).toBe('hello there!')
      expect(watcher).toBeCalledTimes(1)
      expect(watcher).toBeCalledWith('hello', 'there')

      expect(handlersWatcher).toBeCalledTimes(2)
      expect(handlersWatcher).toHaveBeenNthCalledWith(1, 'handler1', 'not')
      expect(handlersWatcher).toHaveBeenNthCalledWith(2, 'handler2', 'as safe', 7)
    })
  })

  describe('withHandlers - async', () => {
    it('handles basic handler wrapper promise-fns', async () => {
      // Arrange
      const handlersWatcher = jest.fn()
      // jest.useFakeTimers()

      const handler1 = <F extends AnyPromiseFn, P>(
          fn: GenericPromiseFn<F, P>
      ): GenericPromiseFn<F, P> => {
        return async (...args: Parameters<F>): Promise<P> => {
          // simulate typical pattern of calling fn, then do handling
          const result = await fn(...args)
          handlersWatcher('handler1')
          return result
        }
      }
      const handler2 = <F extends AnyPromiseFn, P>(
          fn: GenericPromiseFn<F, P>
      ): GenericPromiseFn<F, P> => {
        return async (...args: Parameters<F>): Promise<P> => {
          // simulate typical pattern of calling fn, then do handling
          const result = await fn(...args)
          handlersWatcher('handler2')
          return result
        }
      }
      const watcher = jest.fn()

      const mainFn = async (a: string, b: string): Promise<string> => {
        watcher(a, b)
        await delay(100)
        return `${a} ${b}!`
      }

      // Act
      const myFn = withHandlers([handler1, handler2], mainFn)
      const myResult = await myFn('hello', 'there')

      // jest.useRealTimers()

      // Assert
      expect(myResult).toBe('hello there!')
      expect(watcher).toBeCalledTimes(1)
      expect(watcher).toBeCalledWith('hello', 'there')

      expect(handlersWatcher).toBeCalledTimes(2)
      expect(handlersWatcher).toHaveBeenNthCalledWith(1, 'handler1')
      expect(handlersWatcher).toHaveBeenNthCalledWith(2, 'handler2')
    })

    it('handles handler wrapper promise-fns created with curryLastArg', async () => {
      // Arrange
      const handlersWatcher = jest.fn();

      const handler1Fn = <F extends AnyPromiseFn, P>(
          arg: string,
          fn: GenericPromiseFn<F, P>
      ): GenericPromiseFn<F, P> => {
        return async (...args: Parameters<F>): Promise<P> => {
          // simulate typical pattern of calling fn, then do handling
          const result = await fn(...args)
          handlersWatcher('handler1', arg)
          return result
        }
      }

      const handler1 = curryLastArg(handler1Fn)

      const handler2Fn = <F extends AnyPromiseFn, P>(
          arg1: string,
          arg2: number,
          fn: GenericPromiseFn<F, P>
      ): GenericPromiseFn<F, P> => {
        return async (...args: Parameters<F>): Promise<P> => {
          // simulate typical pattern of calling fn, then do handling
          const result = await fn(...args)
          handlersWatcher('handler2', arg1, arg2)
          return result
        }
      }

      const handler2 = curryLastArg(handler2Fn)

      const watcher = jest.fn()
      const mainFn = async (a: string, b: string): Promise<string> => {
        watcher(a, b)
        await delay(100)
        return `${a} ${b}!`
      }

      // Act
      const myFn = withHandlers([
          handler1('hi'),
          handler2('sup', 7)
        ],
        mainFn)

      const myResult = await myFn('hello', 'there')

      // Assert
      expect(myResult).toBe('hello there!')
      expect(watcher).toBeCalledTimes(1)
      expect(watcher).toBeCalledWith('hello', 'there')

      expect(handlersWatcher).toBeCalledTimes(2)
      expect(handlersWatcher).toHaveBeenNthCalledWith(1, 'handler1', 'hi')
      expect(handlersWatcher).toHaveBeenNthCalledWith(2, 'handler2', 'sup', 7)
    })

    it('handles handler wrapper promise-fns created with createHandlerAsync', async () => {
      // Arrange
      const handlersWatcher = jest.fn();

      const handler1 = <F extends AnyPromiseFn, P>(
          arg: string
      ) => {
        return createHandlerAsync<P, F>(async (executeInner: () => Promise<P>) => {
          const result = await executeInner();
          handlersWatcher('handler1', arg)
          return result
        })
      }

      const handler2 = <F extends AnyPromiseFn, P>(
          arg1: string,
          arg2: number
      ) => {
        return createHandlerAsync<P, F>(async (executeInner) => {
          const result: P = await executeInner()
          handlersWatcher('handler2', arg1, arg2)
          return result
        })
      }

      const watcher = jest.fn()
      // const mainFn = async (a: string, b: string): Promise<string> => {
      //   watcher(a, b)
      //   return `${a} ${b}!`
      //}

      // Act
      const myFn = withHandlers([
            handler1('hi'),
            handler2('sup', 7)
          ],
          async (a: string, b: string): Promise<string> => {
            watcher(a, b)
            return `${a} ${b}!`
          })
      //const myFn = _.flow(handler1('not'), handler2('as safe', 7))(mainFn)

      const myResult = await myFn('hello', 'there')

      // Assert
      expect(myResult).toBe('hello there!')
      expect(watcher).toBeCalledTimes(1)
      expect(watcher).toBeCalledWith('hello', 'there')

      expect(handlersWatcher).toBeCalledTimes(2)
      expect(handlersWatcher).toHaveBeenNthCalledWith(1, 'handler1', 'hi')
      expect(handlersWatcher).toHaveBeenNthCalledWith(2, 'handler2', 'sup', 7)
    })

    it('handles curried handler wrapper promise-fns', async () => {
      // Arrange
      const handlersWatcher = jest.fn();
      const handler1Fn = <F extends AnyPromiseFn, P>(
          arg: string,
          fn: GenericPromiseFn<F, P>
      ): GenericPromiseFn<F, P>  => {
        return async (...args: Parameters<F>): Promise<P> => {
          // simulate typical pattern of calling fn, then do handling
          const result = await fn(...args)
          handlersWatcher('handler1', arg)
          return result
        }
      }
      const handler1 = _.curry(handler1Fn) as SafeCurry2<typeof handler1Fn>

      const handler2Fn = <F extends AnyPromiseFn, P>(
          arg1: string,
          arg2: number,
          fn: GenericPromiseFn<F, P>
      ): GenericPromiseFn<F, P>  => {
        return async (...args: Parameters<F>): Promise<P> => {
          // simulate typical pattern of calling fn, then do handling
          const result = await fn(...args)
          handlersWatcher('handler2', arg1, arg2)
          return result
        }
      }
      const handler2 = _.curry(handler2Fn) as SafeCurry3<typeof handler2Fn>

      const watcher = jest.fn()
      const mainFn = async (a: string, b: string): Promise<string> => {
        watcher(a, b)
        await delay(100)
        return `${a} ${b}!`
      }

      // Act
      // testing curried functions for completeness, but note that they have
      // inherently less type safety compared to using curryOnlyLastArg or createHandlerAsync helpers
      const myFn = withHandlers([
          handler1('not'),
          handler2('as safe', 7)
        ],
        mainFn)

      // const myFn = _.flow(handler1('not'), handler2('as safe', 7))(mainFn)
      const myResult = await myFn('hello', 'there')

      // Assert
      expect(myResult).toBe('hello there!')
      expect(watcher).toBeCalledTimes(1)
      expect(watcher).toBeCalledWith('hello', 'there')

      expect(handlersWatcher).toBeCalledTimes(2)
      expect(handlersWatcher).toHaveBeenNthCalledWith(1, 'handler1', 'not')
      expect(handlersWatcher).toHaveBeenNthCalledWith(2, 'handler2', 'as safe', 7)
    })
  })
})
