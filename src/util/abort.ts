export class AbortError extends Error {
  code = 'aborted'
  constructor () {
    super('aborted')
  }
}

export type TCheckPoint = <T extends Promise<any>> (input: T) => T

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
