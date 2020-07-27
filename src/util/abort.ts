import { TCheckPoint, AbortError, IAbortController, ITimeoutOptions } from './types'
import { AbortController, AbortSignal } from 'abort-controller'
import { exists } from './exists'

export function bubbleAbort (signal?: AbortSignal): void {
  if (signal === undefined || signal === null) {
    return
  }
  if (signal.aborted) {
    throw new AbortError()
  }
}

const cache = new WeakMap<AbortSignal, TCheckPoint>()
const passthrough: TCheckPoint = (input) => input

export function checkpoint (signal?: AbortSignal): TCheckPoint {
  if (signal === undefined || signal === null) {
    return passthrough
  }
  let cp = cache.get(signal)
  if (cp === undefined) {
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    cp = (<T> (input: Promise<T>): Promise<T> => {
      if (input === null || input === undefined) {
        if (signal.aborted) {
          throw new AbortError()
        }
        return
      }
      return input
        .then(data => {
          if (signal.aborted) {
            throw new AbortError()
          }
          return data
        })
    }) as TCheckPoint
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

export async function cleanupPromise <T> (command: (resolve: (result?: T) => void, reject: (error: Error) => void, signal: AbortSignal | null | undefined, resetTimeout: () => void) => (() => void) | Promise<() => void>, opts: ITimeoutOptions = {}): Promise<T> {
  return await wrapTimeout <T>(
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    (signal, resetTimeout): Promise<T> => new Promise((resolve, reject) => {
      const hasSignal = exists(signal)
      let earlyFinish: () => void
      let process: (error: Error | null, result?: T) => void = (error, result) => {
        process = noop
        earlyFinish = () => (error !== null) ? reject(error) : resolve(result)
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
      const withCleanup = (cleanup: () => void): void => {
        if (hasSignal && signal.aborted) {
          earlyFinish = earlyFinish ?? (() => reject(new AbortError()))
        }
        if (earlyFinish !== undefined) {
          try {
            cleanup()
          } catch (err) {
            reject(err)
            return
          }
          earlyFinish()
        } else {
          const abort = (): void => process(new AbortError())
          if (hasSignal) {
            signal.addEventListener('abort', abort)
          }
          process = (error, result) => {
            process = noop
            if (hasSignal) {
              signal.removeEventListener('abort', abort)
            }
            try {
              cleanup()
            } catch (cleanupError) {
              reject(error !== null ? error : cleanupError)
              return
            }
            if (error !== null) {
              reject(error)
            } else {
              resolve(result)
            }
          }
        }
      }
      if (cleanupP instanceof Promise) {
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

export async function wrapTimeout <T> (command: (signal: AbortSignal, resetTimeout: () => void) => Promise<T>, { timeout, signal: inputSignal }: ITimeoutOptions = {}): Promise<T> {
  if (!exists(timeout) || timeout === 0) {
    bubbleAbort(inputSignal)
    return await command(inputSignal, noop)
  }
  return await raceWithSignal <T>(signal => {
    let reset: () => void
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
