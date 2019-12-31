import { cancelable, CancelError, splitCancelable, ICancelable, abortCancelable } from '../cancelable'

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = (): void => {}

describe('regular use', () => {
  it('can be fulfilled', async () => {
    expect(await cancelable(function * () {
      return 'hello'
    })).toBe('hello')
  })
  it('will be fulfilled with delay', () => {
    let _data
    const p = cancelable(function * () {
      return 'hello'
    })
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    p.then(data => {
      _data = data
    })
    // @ts-ignore TS7053
    expect(p._done).toBe(2)
    expect(_data).toBeUndefined()
  })
  it('can be fulfilled repeatedly', async () => {
    const p = cancelable(function * () {
      return 'hello'
    })
    expect(await p).toBe('hello')
    expect(await p).toBe('hello')
  })
  it('can be fulfilled with delay', async () => {
    expect(await cancelable(function * () {
      return yield new Promise(resolve => setTimeout(resolve, 10, 'hello'))
    })).toBe('hello')
  })
  it('can be fulfilled with multiple steps', async () => {
    expect(
      await cancelable(function * () {
        // @ts-ignore TS2339
        const data = yield Promise.resolve('a')
        // @ts-ignore TS2339
        return yield Promise.resolve(`${data}b`)
      })
    ).toBe('ab')
  })
  it('can have an error', async () => {
    try {
      await cancelable(function () {
        throw new Error('hello')
      })
      fail('Error should have thrown')
    } catch (err) {
      expect(err.message).toBe('hello')
    }
  })
  it('can an error repeatedly', async () => {
    let _reject: (error: Error) => void
    const p = cancelable(function * () {
      // eslint-disable-next-line promise/param-names
      yield new Promise((_, reject) => {
        _reject = reject
      })
    })
    let count = 0
    p.catch(err => {
      count += 1
      expect(err.message).toBe('hello')
    })
    p.catch(err => {
      count += 1
      expect(err.message).toBe('hello')
    })
    _reject(new Error('hello'))
    await p.catch(noop)
    expect(count).toBe(2)
  })
  it('can have an error in the generation', async () => {
    try {
      await cancelable(() => {
        throw new Error('hello')
      })
      fail('error should have thrown')
    } catch (err) {
      expect(err.message).toBe('hello')
    }
  })
  it('can yield a regular string', async () => {
    expect(await cancelable(function * () {
      return yield 'hello'
    })).toBe('hello')
  })
  it('can yield a promise string', async () => {
    expect(await cancelable(function * () {
      // @ts-ignore TS2339
      return yield Promise.resolve('hello')
    })).toBe('hello')
  })
  it('can be cancelled', async () => {
    const neverResolve = new Promise(noop)
    const p = cancelable(function * () {
      yield neverResolve
    })
    expect(await p.cancel()).toBeUndefined()
    try {
      await p
      fail('no error')
    } catch (error) {
      expect(error).toBeInstanceOf(CancelError)
    }
  })
  it('100000 resolved promises dont break the stack', async () => {
    await cancelable(function * () {
      for (let i = 0; i < 100000; i++) {
        yield i
      }
    })
  })
  it('Return promises are resolved', async () => {
    // @ts-ignore TS2339
    const a = await Promise.resolve(Promise.resolve(1))
    const b = await cancelable(function * () {
      // @ts-ignore TS2339
      return Promise.resolve(2)
    })
    expect(a).toBe(1)
    expect(b).toBe(2)
  })
  it('cancelables can be named', () => {
    expect(cancelable(function * () {
      return yield 'hello'
    }, null, 'abcd').name).toBe('abcd')
  })
})
describe('finally', () => {
  it('is executed when resolved', async () => {
    let second
    const first = await cancelable(function * () {
      return 'hello'
    }).finally(() => {
      second = 'world'
    })
    expect(first).toBe('hello')
    expect(second).toBe('world')
  })
  it('can pass a promise that is also executed', async () => {
    let second
    const first = await cancelable(function * () {
      return 'hello'
    }).finally(async () => {
      return new Promise<void>(resolve => setTimeout(() => {
        second = 'world'
        resolve()
      }, 10))
    })
    expect(first).toBe('hello')
    expect(second).toBe('world')
  })
  it('may thrown an error', async () => {
    try {
      await cancelable(function * () {
        return 'hello'
      }).finally(() => {
        throw new Error('world')
      })
      fail('should throw an error')
    } catch (err) {
      expect(err.message).toBe('world')
    }
  })
  it('may pass an rejection on resolve', async () => {
    try {
      await cancelable(function * () {
        return 'hello'
      }).finally(async () => {
        // @ts-ignore TS2339
        return Promise.reject(new Error('world'))
      })
      fail('should throw an error')
    } catch (err) {
      expect(err.message).toBe('world')
    }
  })
  it('is executed when rejected', async () => {
    let second
    try {
      // @ts-ignore TS7025
      await cancelable(function * () {
        throw new Error('hello')
      }).finally(() => {
        second = 'world'
      })
      fail('should throw an error')
    } catch (err) {
      expect(err.message).toBe('hello')
      expect(second).toBe('world')
    }
  })
  it('may thrown an error when rejected', async () => {
    try {
      await cancelable(function () {
        throw new Error('hello')
      }).finally(() => {
        throw new Error('world')
      })
      fail('should throw an error')
    } catch (err) {
      expect(err.message).toBe('hello')
    }
  })
  it('can pass a promise that is also executed when rejected', async () => {
    let second
    try {
      // @ts-ignore TS7025
      await cancelable(function * () {
        throw new Error('hello')
      }).finally(async () => {
        return new Promise<void>(resolve => setTimeout(() => {
          second = 'world'
          resolve()
        }, 10))
      })
      fail('should throw an error')
    } catch (err) {
      expect(err.message).toBe('hello')
      expect(second).toBe('world')
    }
  })
  it('may pass an rejection on reject', async () => {
    try {
      // @ts-ignore TS7025
      await cancelable(function * () {
        throw new Error('hello')
      }).finally(async () => {
        // @ts-ignore TS2339
        return Promise.reject(new Error('world'))
      })
      fail('should throw an error')
    } catch (err) {
      expect(err.message).toBe('hello')
    }
  })
  it('will not fail with null', async () => {
    expect(await cancelable(function * () {
      return 'hello'
    }).finally(null)).toBe('hello')
  })
  it('will not fail with undefined', async () => {
    expect(await cancelable(function * () {
      return 'hello'
    }).finally(undefined)).toBe('hello')
  })
  it('will not cancel a a cancel operation', async () => {
    let p2
    const p = cancelable(function * () {
      return 'hello'
    }).finally(async () => {
      p2 = cancelable<void>(function * () {
        return new Promise(noop)
      })
      return p2
    })
    try {
      await p.cancel()
    } catch (err) {
      expect(err).toBeInstanceOf(CancelError)
      // @ts-ignore TS2532
      expect(p2.cancelled).toBe(false)
    }
  })
})
describe('unexpected responses', () => {
  it('cancel after fulfill', async () => {
    const p = cancelable(function * () {
      return 'hi'
    })
    const cancelP = p.cancel()
    expect(cancelP).not.toBe(p)
    expect(await p).toBe('hi')
    await cancelP
  })
  it('cancel after reject', async () => {
    let p: ICancelable
    try {
      p = cancelable(function () {
        throw new Error('hello')
      })
      await p
      fail('error not passed')
    } catch (err) {
      const pCancel = p.cancel()
      expect(pCancel).not.toBe(p)
      await pCancel
    }
  })
  it('fulfill after cancel', async () => {
    const p = cancelable(function * () {
      return yield new Promise(resolve => setTimeout(resolve, 100, 'hello'))
    })
    const pCancel = p.cancel()
    expect(pCancel).not.toBe(p)
    try {
      await p
      fail('not failed?')
    } catch (error) {
      expect(error).toBeInstanceOf(CancelError)
    }
    await pCancel
    expect(p.cancelled).toBe(true)
  })
  it('throwing an error in error handler', async () => {
    try {
      await cancelable(function () {
        throw new Error('a')
      }).catch(_ => {
        throw new Error('b')
      })
      fail('no error?')
    } catch (err) {
      expect(err.message).toBe('b')
    }
  })
  it('throwing an error after first yield', async () => {
    try {
      await cancelable(function * () {
        yield 'a'
        throw new Error('hi')
      })
    } catch (err) {
      expect(err.message).toBe('hi')
    }
  })
  it('throwing an error in fullfillment', async () => {
    try {
      await cancelable(function * () {
        return 'a'
      }).then(_ => {
        throw new Error('b')
      })
      fail('no error?')
    } catch (err) {
      expect(err.message).toBe('b')
    }
  })
  it('chaining without a function shouldnt throw', async () => {
    expect(await cancelable(function * () {
      return 'a'
    }).then()).toBe('a')
  })
  it('chaining on an error without a reject message should throw the original error', async () => {
    try {
      await cancelable(function () {
        throw new Error('hello')
      }).then()
      fail('no error?')
    } catch (err) {
      expect(err.message).toBe('hello')
    }
  })
  it('weird promise with multiple resolve calls', async () => {
    const data = await cancelable(function * () {
      return yield {
        then (resolve: (res: any) => void): void {
          resolve(1)
          resolve(2)
        }
      }
    })
    await new Promise(resolve => {
      setTimeout(() => {
        expect(data).toBe(1)
        resolve()
      }, 1)
    })
  })
  it('weird chain with multiple resolve calls', async () => {
    const p = cancelable(function * () {
      return 'a'
    })
    expect(await p.then((out: any) => {
      expect(out).toBe('a')
      return {
        then (resolve: (res: any) => void): void {
          resolve(1)
          resolve(2)
        }
      }
    })).toBe(1)
  })
})
describe('chaining', () => {
  it('chained result', async () => {
    expect(
      await (
        cancelable(function * () {
          return 'hello'
        })
          .then(data => {
            expect(data).toBe('hello')
            return 'hola'
          })
      )
    ).toBe('hola')
  })
  it('double chaining result', async () => {
    expect(
      await (
        cancelable(function * () {
          return 'hello'
        })
          .then(async data => {
            expect(data).toBe('hello')
            // @ts-ignore TS2339
            return Promise.resolve('hola')
          })
      )
    ).toBe('hola')
  })
  it('catching errors', async () => {
    expect(
      await (
        cancelable(function () {
          throw new Error('hello')
        })
          .catch(error => {
            expect(error.message).toBe('hello')
            return 'hola'
          })
      )
    ).toBe('hola')
  })
  it('child cancelables', async () => {
    const theChild = cancelable(function * () {
      return yield new Promise(noop) // Never resolve
    })
    const p = cancelable(function * (child) {
      return yield child(theChild)
    })
    const pCancel = p.cancel()
    expect(pCancel).not.toBe(p)
    try {
      await theChild
      fail('no error?')
    } catch (err) {
      expect(err).toBeInstanceOf(CancelError)
      expect(p.cancelled).toBe(true)
      expect(theChild.cancelled).toBe(true)
    }
    await pCancel
  })
  it('fulfill with child', async () => {
    expect(
      await cancelable(function * (child) {
        return yield child(cancelable(function * () {
          return 'hola'
        }))
      })
    ).toBe('hola')
  })
  it('fulfill after cancel', async () => {
    let _error: Error
    const p1 = cancelable(function * () {
      return yield new Promise(resolve => setTimeout(resolve, 10, 'hello'))
    })
    const p2 = p1.catch(error => {
      _error = error
    })
    expect(p2.cancel()).not.toBe(p2)
    expect(p1.cancelled).toBe(true)
    await p2
    expect(_error).not.toBeUndefined()
    expect(_error).toBeInstanceOf(CancelError)
  })
  it('fulfill after cancel with child', async () => {
    let p2: ICancelable
    let _resolve: () => void
    const p1 = cancelable(function * (child) {
      return yield new Promise(resolve => {
        p2 = cancelable(function * () {
          yield new Promise(resolve => setTimeout(resolve, 100))
        })
        _resolve = () => resolve(child(p2))
      })
    })
    const pCancel = p1.cancel()
    expect(pCancel).not.toBe(p1)
    await pCancel
    expect(p1.cancelled).toBe(true)
    _resolve()
    try {
      await p2
      fail('should be cancelled')
    } catch (error) {
      expect(error).toBeInstanceOf(CancelError)
    }
  })
  it('resolve after closing', async () => {
    let _resolve: () => void
    const p1 = cancelable(function * () {
      yield new Promise(resolve => {
        _resolve = resolve
      })
      fail('should not reach here')
    })
    const pCancel = p1.cancel()
    expect(pCancel).not.toBe(p1)
    expect(p1.cancelled).toBe(true)
    _resolve()
    await pCancel
  })
  it('multiple solved children', async () => {
    let p2: ICancelable
    let p3: ICancelable
    const p1 = cancelable(function * (child) {
      p2 = child(cancelable(function * () { return yield new Promise(noop) }))
      p3 = child(cancelable(function * () { return yield new Promise(noop) }))
      yield new Promise(noop)
    })
    const pCancel = p1.cancel()
    expect(pCancel).not.toBe(p1)
    await pCancel
    try {
      await p3
    } catch (_) {}
    expect(p3.cancelled).toBe(true)
    expect(p2.cancelled).toBe(true)
  })
  it('cancel of child to be executed before the first in chain', async () => {
    let caught: boolean = false
    let pWait: Promise<void>
    let pWait2: Promise<void>
    const p1 = cancelable(function * (child) {
      pWait = new Promise(resolve => setTimeout(resolve, 1)) // wait for a frame to not immediately add the cancel method
      yield pWait
      let _resolve: () => void
      pWait2 = new Promise(resolve => { _resolve = resolve })
      const pX = new Promise(resolve => {
        const pY = cancelable(function * () { return yield new Promise(noop) }).catch((err) => {
          expect(err).toBeInstanceOf(CancelError)
          caught = true
        })
        setTimeout((data: any) => {
          _resolve()
          resolve(data)
        }, 0, child(pY))
      })
      yield pX
    })
    const p2 = p1.catch(() => {
      expect(caught).toBe(true)
    })
    await pWait
    await pWait2
    expect(p1.cancel()).not.toBe(p1)
    await p2
  })
  it('error in a cancel call of a dangling child', async () => {
    // @ts-ignore TS7025
    const perr = cancelable(function * () {
      throw new Error('hello')
    })
    const p = cancelable(function * (child) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      child(perr)
      return 'hi'
    })
    try {
      await p
      fail('no error?')
    } catch (err) {
      expect(err.message).toBe('hello')
    }
  })
  it('error after cancelling in a cancel call of a dangling child', async () => {
    // @ts-ignore TS7025
    const perr = cancelable(function * () {
      throw new Error('hello')
    })
    const p = cancelable(function * (child) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      child(perr)
      return new Promise(noop)
    })
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    p.cancel()
    try {
      await p
      fail('no error?')
    } catch (err) {
      expect(err.message).toBe('hello')
      // As the error happend after cancel we need to remember that cancelled stays true
      expect(p.cancelled).toBe(true)
    }
  })
  it('error after failing in a cancel call of a dangling child', async () => {
    const perr = cancelable(function () {
      throw new Error('hello')
    })
    const p = cancelable(function (child) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      child(perr)
      throw new Error('hola')
    })
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    p.cancel()
    try {
      await p
      fail('no error?')
    } catch (err) {
      expect(err.message).toBe('hola')
      expect(p.cancelled).toBe(false)
    }
  })
})
describe('split support', () => {
  it('skipping cancel on resolve', async () => {
    const cancel = async (): Promise<void> => {
      await fail('Cancel called')
    }
    // @ts-ignore TS2339
    const p2 = Promise.resolve('hi')
    const p = splitCancelable({ cancel, promise: p2 })
    await p2
    expect(p.cancel()).not.toBe(p)
    expect(p.cancelled).toBe(false)
  })
  it('skipping cancel on reject', async () => {
    const cancel = async (): Promise<void> => {
      await fail('Cancel called')
    }
    // @ts-ignore TS2339
    const p2 = Promise.reject(new Error('hi'))
    const p = splitCancelable({ cancel, promise: p2 })
    try {
      await p2
    } catch (_) {}
    expect(p.cancel()).not.toBe(p)
    expect(p.cancelled).toBe(false)
  })
  it('cancelling before error', async () => {
    let called = 0
    // eslint-disable-next-line @typescript-eslint/require-await
    const cancel = async (): Promise<void> => {
      called += 1
    }
    // @ts-ignore TS2339
    const p2 = Promise.reject(new Error('hi'))
    const p = splitCancelable({ cancel, promise: p2 })
    const pCancel = p.cancel()
    expect(pCancel).not.toBe(p)
    await pCancel
    expect(p.cancelled).toBe(true)
    try {
      await p2
    } catch (_) {}
    try {
      await p
    } catch (err) {
      expect(err).toBeInstanceOf(CancelError)
    }
    expect(called).toBe(1)
  })
  it('weird split that rejects after resoving', async () => {
    const cancel = async (): Promise<void> => {
      await fail('Cancel called')
    }
    const promise: Promise<string> = {
      then (onfulfilled: (str: string) => void, onrejected: (err: Error) => void) {
        setTimeout(() => {
          onfulfilled('hi')
          onrejected(new Error('hi'))
        })
      }
    } as any
    const p = splitCancelable({
      cancel,
      promise
    })
    await p
    expect(p.cancel()).not.toBe(p)
    expect(p.cancelled).toBe(false)
  })
  it('incorrect cancel operation that throws an error', async () => {
    const cancel = async (): Promise<void> => {
      // @ts-ignore TS2339
      return Promise.reject(new Error('hello'))
    }
    const p = splitCancelable({
      cancel,
      promise: new Promise(noop)
    })
    expect(p.cancel()).not.toBe(p)
    try {
      await p
    } catch (err) {
      expect(err.message).toBe('hello')
    }
    expect(p.cancelled).toBe(false)
  })
})
describe('abort signal', () => {
  it('can be instantiated', async () => {
    const data = await abortCancelable(async (signal: AbortSignal): Promise<boolean> => {
      expect(signal).toBeInstanceOf(AbortSignal)
      // @ts-ignore TS2339
      return Promise.resolve(true)
    })
    expect(data).toBe(true)
  })
  it('cancels are passed through', () => {
    let abortTriggered = false
    const p = abortCancelable(async (signal: AbortSignal): Promise<boolean> => {
      signal.addEventListener('abort', () => {
        abortTriggered = true
      })
      return new Promise<null>(noop)
    })
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    p.cancel()
    expect(abortTriggered).toBe(true)
  })
})
