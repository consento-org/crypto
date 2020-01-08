export interface ICancelable <T = any> extends Promise<T> {
  name?: string
  cancel (): Promise<void>
  readonly cancelled: boolean
  then <TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): ICancelable<TResult1 | TResult2>
  catch <TResult> (onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): ICancelable<T | TResult>
  finally (onfinally?: (() => void | PromiseLike<void>) | undefined | null): ICancelable<T>
}

export interface ISplitCancelable <T = any> {
  name?: string
  cancel (): Promise<void>
  promise: Promise<T>
}

export class CancelError extends Error {
  constructor () {
    super('cancelled')
  }
}

enum TDone {
  not = 1,
  ok = 2,
  err = 3
}

function isPromiseLike (p: any): p is PromiseLike<any> {
  return typeof p === 'object' && typeof p.then === 'function'
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = (): void => {}

let _frameNo = 0
let _next = false

function incrementFrame (): void {
  _next = false
  _frameNo += 1
}

function frame (): number {
  if (!_next) {
    _next = true
    setTimeout(incrementFrame, 0)
  }
  return _frameNo
}

class AbstractCancelable <TReturn> extends Promise<TReturn> {
  _rejected: Array<(error: Error) => void>
  _resolved: Array<(data: TReturn) => void>
  _reject: (error: Error) => void
  _resolve: (data: TReturn) => void
  _done: TDone = TDone.not
  _finished: boolean = false
  _error: Error
  _data: TReturn
  cancelled: boolean = false
  _children: Set<ICancelable>
  name: string
  constructor (name?: string) {
    super(noop)
    this.name = name
    const start = frame()
    const doReject = (): void => {
      this._resolved = undefined
      if (this._rejected === undefined) return
      for (const _reject of this._rejected) {
        _reject(this._error)
      }
      this._rejected = undefined
    }
    const doResolve = (): void => {
      this._rejected = undefined
      if (this._resolved === undefined) return
      for (const _resolve of this._resolved) {
        _resolve(this._data)
      }
      this._resolved = undefined
    }
    const final = (next: () => void): void => {
      if (this._children !== undefined) {
        const child = this._children.values().next()
        if (!child.done) {
          this._children.delete(child.value)
          child.value.cancel()
          child.value.then(
            final.bind(this, next),
            (error: Error) => {
              if (!(error instanceof CancelError) && (this._done !== TDone.err || this.cancelled)) {
                this._done = TDone.not
                this._data = undefined
                this._reject(error)
                return
              }
              final(next)
            }
          )
          return
        }
      }
      if (start === frame()) {
        setTimeout(final, 0, next)
        return
      }
      this._finished = true
      next()
    }
    this._reject = (error: Error): void => {
      if (this._done !== TDone.not) return
      this._done = TDone.err
      this._error = error
      if (error instanceof CancelError) {
        this.cancelled = true
      }
      final(doReject)
    }
    this._resolve = (data: TReturn): void => {
      if (this._done !== TDone.not) return
      this._done = TDone.ok
      this._data = data
      final(doResolve)
    }
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  then <TResult3 = TReturn, TResult4 = never> (onfulfilled?: ((value: TReturn) => TResult3 | PromiseLike<TResult3>) | undefined | null, onrejected?: ((reason: any) => TResult4 | PromiseLike<TResult4>) | undefined | null): ICancelable<TResult3 | TResult4> {
    const next = new CancelableWrap(onfulfilled, onrejected)
    if (!this._finished) {
      if (this._rejected === undefined) {
        this._rejected = [next._receiveError]
      } else {
        this._rejected.push(next._receiveError)
      }
      if (this._resolved === undefined) {
        this._resolved = [next._receiveData]
      } else {
        this._resolved.push(next._receiveData)
      }
      next.cancel = async (): Promise<void> => this.cancel()
    } else if (this._done === TDone.ok) {
      next._receiveData(this._data)
    } else {
      next._receiveError(this._error)
    }
    return next
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  catch <TResult3> (onrejected?: ((reason: any) => TResult3 | PromiseLike<TResult3>) | undefined | null): ICancelable<TResult3> {
    // @ts-ignore TS2322
    return this.then(null, onrejected)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  finally (onfinally?: (() => void | PromiseLike<void>) | undefined | null): ICancelable<TReturn> {
    if (typeof onfinally !== 'function') {
      return this
    }
    return this.then(
      data => {
        const res = onfinally()
        if (isPromiseLike(res)) {
          return res.then(() => data)
        }
        return data
      },
      error => {
        let res
        try {
          res = onfinally()
        } catch (_) {
          throw error
        }
        if (isPromiseLike(res)) {
          return res.then(
            // @ts-ignore
            async () => Promise.reject(error),
            // @ts-ignore
            async () => Promise.reject(error)
          )
        }
        throw error
      }
    ) as ICancelable<TReturn>
  }

  async cancel (): Promise<void> {
    if (this._done === TDone.not) {
      this._reject(new CancelError())
    }
    return this.then(noop, noop) as Promise<void>
  }
}

class CancelableWrap <T, TResult1, TResult2 = never> extends AbstractCancelable<TResult1 | TResult2> implements ICancelable<TResult1 | TResult2> {
  _receiveData: (data: T) => void
  _receiveError: (error: Error) => void
  constructor (onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null) {
    super()
    const start = frame()
    const process = (res: TResult1 | TResult2 | PromiseLike<TResult1 | TResult2>): void => {
      if (isPromiseLike(res)) {
        res.then(
          this._resolve,
          this._reject
        )
      } else {
        this._resolve(res)
      }
    }
    this._receiveError = (error: Error): void => {
      if (start === frame()) {
        setTimeout(this._receiveError, 0, error)
        return
      }
      // TODO: Test this case
      if (typeof onrejected !== 'function') {
        this._reject(error)
        return
      }
      let res: TResult2 | PromiseLike<TResult2>
      try {
        res = onrejected(error)
      } catch (err) {
        this._reject(err)
        return
      }
      process(res)
    }
    this._receiveData = (data: T): void => {
      if (start === frame()) {
        setTimeout(this._receiveData, 0, data)
        return
      }
      if (typeof onfulfilled !== 'function') {
        this._resolve(data as any)
        return
      }
      let res: TResult1 | PromiseLike<TResult1> | TResult2 | PromiseLike<TResult2>
      try {
        res = onfulfilled(data)
      } catch (error1) {
        if (typeof onrejected !== 'function') {
          this._reject(error1)
          return
        }
        try {
          res = onrejected(error1)
        } catch (error2) {
          this._reject(error2)
          return
        }
      }
      process(res)
    }
  }
}

export type TCancelable<TReturn = any, TScope = undefined, T = any> = (this: TScope, child: <TChild> (cancelable: ICancelable<TChild>) => ICancelable<TChild>) => IterableIterator<T | TReturn>

// eslint-disable-next-line @typescript-eslint/promise-function-async
export function cancelable <TReturn = any, TScope = undefined, T = any> (generator: TCancelable<TReturn, TScope, T>, scope?: TScope, name?: string): ICancelable<TReturn> {
  return new Cancelable(generator, scope, name)
}

class Cancelable <TReturn = any, TScope = undefined, T = any> extends AbstractCancelable<TReturn> implements ICancelable<TReturn> {
  constructor (generator: TCancelable<TReturn, TScope, T>, scope?: TScope, name?: string) {
    super(name)
    let iter: IterableIterator<any>
    try {
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      iter = generator.call(scope, (child: ICancelable): ICancelable => {
        if (this._done !== TDone.not) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          child.cancel()
          return
        }
        if (this._children === undefined) {
          this._children = new Set()
        }
        this._children.add(child)
        return child
      })
    } catch (error) {
      this._reject(error)
      return
    }
    const process = (next: any): void => {
      while (true) {
        if (this._done !== TDone.not) return
        // @ts-ignore TS2314
        let data: IteratorResult<T, TReturn>
        try {
          data = iter.next(next)
        } catch (error) {
          this._reject(error)
          return
        }
        if (data.done) {
          if (isPromiseLike(data.value)) {
            data.value.then(this._resolve, this._reject)
            return
          }
          this._resolve(data.value)
          return
        }
        if (isPromiseLike(data.value)) {
          data.value.then(process, this._reject)
          return
        }
        next = data.value
      }
    }
    process(undefined)
  }
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
export function abortCancelable <T> (template: (signal: AbortSignal) => Promise<T>, name?: string): ICancelable<T> {
  const controller = new AbortController()
  return new SplitCancelable({
    // eslint-disable-next-line @typescript-eslint/require-await
    cancel: async (): Promise<void> => controller.abort(),
    promise: template(controller.signal),
    name
  })
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
export function splitCancelable <T> (split: ISplitCancelable<T>): ICancelable<T> {
  return new SplitCancelable(split)
}

class SplitCancelable <T> extends AbstractCancelable<T> implements ICancelable<T> {
  constructor (split: ISplitCancelable<T>) {
    super(split.name)
    const reject = this._reject
    this._reject = (error: Error) => {
      // This will only be called by .cancel() - the error will always be a CancelError
      // and it should always be checked for ._done !== TDone.not in .cancel
      this._done = TDone.err // Prevent eventual future rejections
      split.cancel().then(
        () => {
          this._done = TDone.not
          reject(error)
        },
        (error: Error) => {
          this._done = TDone.not
          reject(error)
        }
      )
    }
    split.promise.then(this._resolve, reject)
  }
}