export interface IExtPromise<T> extends Promise<T> {
  _resolve (data: T): void
  _reject (error: Error): void
}

/* eslint @typescript-eslint/promise-function-async: "off" */
export function extPromise <T> (): IExtPromise<T> {
  let _resolve
  let _reject
  const result = new Promise<T>((resolve, reject) => {
    _resolve = resolve
    _reject = reject
  }) as IExtPromise<T>
  result._resolve = _resolve
  result._reject = _reject
  return result
}
