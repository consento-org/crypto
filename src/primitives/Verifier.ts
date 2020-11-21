import { bufferToString, Inspectable, toBuffer } from '../util'
import { IVerifier, IVerifierJSON, IVerifierOptions, IEncryptedMessage, IVerifyVector } from '../types'
import { verifyBody } from './fn'
import { InspectOptions } from 'inspect-custom-symbol'
import prettyHash from 'pretty-hash'

export class Verifier extends Inspectable implements IVerifier {
  _verifyKey?: Uint8Array
  _verifyKeyBase64?: string
  _verifyKeyHex?: string

  constructor ({ verifyKey: id }: IVerifierOptions) {
    super()
    if (typeof id === 'string') {
      this._verifyKeyBase64 = id
    } else {
      this._verifyKey = id
    }
  }

  get verifyKey (): Uint8Array {
    if (this._verifyKey === undefined) {
      this._verifyKey = toBuffer(this._verifyKeyBase64 as unknown as string)
    }
    return this._verifyKey
  }

  get verifyKeyBase64 (): string {
    if (this._verifyKeyBase64 === undefined) {
      this._verifyKeyBase64 = bufferToString(this._verifyKey as unknown as Uint8Array, 'base64')
    }
    return this._verifyKeyBase64
  }

  get verifyKeyHex (): string {
    if (this._verifyKeyHex === undefined) {
      this._verifyKeyHex = bufferToString(this.verifyKey, 'hex')
    }
    return this._verifyKeyHex
  }

  toJSON (): IVerifierJSON {
    return {
      verifyKey: this.verifyKeyBase64
    }
  }

  _inspect (_: number, { stylize }: InspectOptions): string {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `Verifier(${stylize(prettyHash(this.verifyKey), 'string')})`
  }

  verify (signature: Uint8Array, body: Uint8Array, verifyVector?: IVerifyVector): void {
    verifyBody(this.verifyKey, { body, signature }, verifyVector)
  }

  verifyMessage (message: IEncryptedMessage | Uint8Array, verifyVector?: IVerifyVector): void {
    verifyBody(this.verifyKey, message, verifyVector)
  }
}
