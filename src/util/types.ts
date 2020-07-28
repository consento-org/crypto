import { AbortSignal } from 'abort-controller'
export { Buffer } from 'buffer'

export { AbortSignal, AbortController } from 'abort-controller'

export type IPromiseCleanup = () => void | Promise<void>

export type TCheckPoint = <T extends Promise<any>> (input: T) => T

export type IStringOrBuffer = Uint8Array | string
export type IEncodable = IStringOrBuffer | object

export type EEncoding = 'base64' | 'hex' | 'utf8'

export class AbortError extends Error {
  code = 'aborted'
  constructor () {
    super('aborted')
  }
}

export interface IAbortController {
  signal: AbortSignal
  abort: () => void
}

export interface IAbortOptions {
  signal?: AbortSignal
}

export interface ITimeoutOptions extends IAbortOptions {
  timeout?: number
}
