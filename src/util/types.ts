export { Buffer } from 'buffer'

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
