import { TCheckPoint, AbortError, IAbortController, ITimeoutOptions, IPromiseCleanup } from './types'
import { AbortController, AbortSignal } from 'abort-controller'
import { exists } from './exists'
import { isPromiseLike } from '.'

export function bubbleAbort (signal?: AbortSignal | null): void {
  if (signal === undefined || signal === null) {
    return
  }
  if (signal.aborted) {
    throw new AbortError()
  }
}

const cache = new WeakMap<AbortSignal, TCheckPoint>()
const passthrough: TCheckPoint = <T> (input: T): T => input

export function checkpoint (signal?: AbortSignal): TCheckPoint {
  if (signal === undefined || signal === null) {
    return passthrough
  }
  let cp = cache.get(signal)
  if (cp === undefined) {
    cp = <T> (input: T): T => {
      if (isPromiseLike(input)) {
        return input.then(data => {
          if (signal.aborted) {
            throw new AbortError()
          }
          return data
        }) as unknown as T
      }
      if (signal.aborted) {
        throw new AbortError()
      }
      return input
    }
    cache.set(signal, cp)
  }
  return cp
}

export function composeAbort (signal?: AbortSignal): IAbortController {
  const controller = new AbortController()
  let aborted = false
  const abort = (): void => {
    if (aborted) return
    aborted = true
    if (exists(signal)) {
      signal.removeEventListener('abort', abort)
    }
    controller.abort()
  }
  if (exists(signal)) {
    if (signal.aborted) {
      throw new AbortError()
    }
    signal.addEventListener('abort', abort)
  }
  return {
    signal: controller.signal,
    abort
  }
}

export async function raceWithSignal <TReturn = unknown> (command: (signal: AbortSignal) => Iterable<Promise<TReturn>>, inputSignal?: AbortSignal): Promise<TReturn> {
  const { signal, abort } = composeAbort(inputSignal)
  const promises = Array.from(command(signal))
  if (exists(inputSignal)) {
    promises.push(new Promise((resolve, reject) => {
      const abortHandler = (): void => {
        clear()
        reject(new AbortError())
      }
      inputSignal.addEventListener('abort', abortHandler)
      const clear = (): void => {
        inputSignal.removeEventListener('abort', abortHandler)
        signal.removeEventListener('abort', clear)
      }
      signal.addEventListener('abort', clear)
    }))
  }
  return await Promise.race(promises).finally(abort)
}

const noop = (): void => {}

export async function cleanupPromise <T> (
  command: (
    resolve: (result?: T) => void,
    reject: (error: Error) => void,
    signal: AbortSignal | null | undefined,
    resetTimeout: () => void
  ) => (IPromiseCleanup | Promise<IPromiseCleanup>),
  opts: ITimeoutOptions = {}
): Promise<T> {
  const abortError = new AbortError()
  return await wrapTimeout <T>(
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    (signal, resetTimeout): Promise<T> => new Promise((resolve, reject) => {
      let earlyFinish: { error?: Error | null, result?: T }
      let process: (error: Error | null, result?: T) => void = (error, result) => {
        process = noop
        earlyFinish = { error, result }
      }
      let cleanupP
      try {
        cleanupP = command(
          result => process(null, result),
          error => process(error),
          signal,
          resetTimeout
        )
      } catch (error) {
        reject(error)
        return
      }
      const withCleanup = (cleanup: IPromiseCleanup): void => {
        const hasSignal = exists(signal)
        // @ts-expect-error 2532 - signal is certainly not undefined with hasSignal
        if (hasSignal && signal.aborted) {
          earlyFinish = earlyFinish ?? { error: new AbortError() }
        }
        if (earlyFinish !== undefined) {
          let finalP
          try {
            finalP = cleanup()
          } catch (cleanupError) {
            reject(earlyFinish.error ?? cleanupError)
            return
          }
          const close = (cleanupError?: Error): void => {
            const error = earlyFinish.error ?? cleanupError
            if (exists(error)) {
              return reject(error)
            }
            return resolve(earlyFinish.result)
          }
          if (isPromiseLike(finalP)) {
            finalP.then(() => close(), close)
            return
          }
          close()
          return
        }
        const abort = (): void => process(abortError)
        if (hasSignal) {
          // @ts-expect-error 2532 - signal is certainly not undefined with hasSignal
          signal.addEventListener('abort', abort)
        }
        process = (asyncError, result) => {
          process = noop
          if (hasSignal) {
            // @ts-expect-error 2532 - signal is certainly not undefined with hasSignal
            signal.removeEventListener('abort', abort)
          }

          let finalP
          try {
            finalP = cleanup()
          } catch (cleanupError) {
            reject(asyncError ?? cleanupError)
            return
          }
          const close = (cleanupError?: Error): void => {
            const error = asyncError ?? cleanupError
            if (exists(error)) {
              return reject(error)
            }
            return resolve(result)
          }
          if (isPromiseLike(finalP)) {
            finalP.then(() => close(), close)
            return
          }
          close()
        }
      }
      if (isPromiseLike(cleanupP)) {
        cleanupP.then(
          withCleanup,
          reject
        )
      } else {
        withCleanup(cleanupP)
      }
    }),
    opts
  )
}

export async function wrapTimeout <T> (command: (signal: AbortSignal | undefined, resetTimeout: () => void) => Promise<T>, { timeout, signal: inputSignal }: ITimeoutOptions = {}): Promise<T> {
  if (!exists(timeout) || timeout === 0) {
    bubbleAbort(inputSignal)
    return await command(inputSignal, noop)
  }
  return await raceWithSignal <T>(signal => {
    let reset: () => void = noop
    const p = new Promise <T>((resolve, reject) => {
      let timer: any
      const clear = (): void => {
        reset = noop
        signal.removeEventListener('abort', clear)
      }
      reset = () => {
        if (timer !== undefined) {
          clearTimeout(timer)
        }
        timer = setTimeout(() => {
          reject(Object.assign(new Error(`Timeout [t=${timeout}]`), { code: 'timeout', timeout }))
          clear()
        }, timeout)
      }
      reset()
      signal.addEventListener('abort', clear)
    })
    return [
      command(signal, reset),
      p
    ]
  }, inputSignal)
}
