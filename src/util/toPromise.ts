import { isPromiseLike } from './isPromiseLike'
import { isObject } from './isObject'

const cache = new WeakMap<any, Promise<any>>()

export function toPromise<T> (input: T | PromiseLike<T>): PromiseLike<T> {
  if (isPromiseLike(input)) {
    return input
  }
  if (isObject(input)) {
    let promise = cache.get(input)
    if (promise !== undefined) return promise
    promise = Promise.resolve(input)
    cache.set(input, promise)
    return promise
  }
  return Promise.resolve(input)
}
