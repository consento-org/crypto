/* eslint-disable @typescript-eslint/method-signature-style */
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
  result._resolve = _resolve as unknown as (data: T) => void
  result._reject = _reject as unknown as (error: Error) => void
  // eslint-disable-next-line @typescript-eslint/return-await
  return result
}
