/* eslint-disable @typescript-eslint/return-await */
import { isPromiseLike } from './isPromiseLike'
import { isObject } from './isObject'

const cache = new WeakMap<any, Promise<any>>()

// eslint-disable-next-line @typescript-eslint/promise-function-async
export function toPromise<T> (input: T | PromiseLike<T>): Promise<T> {
  if (input instanceof Promise) {
    return input
  }
  if (isPromiseLike(input)) {
    let promise = cache.get(input)
    if (promise === undefined) {
      promise = new Promise((resolve, reject) => { input.then(resolve, reject) })
      cache.set(input, promise)
    }
    return promise
  }
  if (isObject(input)) {
    let promise = cache.get(input)
    if (promise === undefined) {
      promise = Promise.resolve(input)
      cache.set(input, promise)
    }
    return promise
  }
  return Promise.resolve(input)
}
