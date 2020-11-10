import { bufferToString, toBuffer } from '../util'
import { IVerifier, IVerifierJSON, IVerifierOptions, IEncryptedMessage } from '../types'
import * as sodium from 'sodium-universal'

const { crypto_sign_verify_detached: verify } = sodium.default

export class Verifier implements IVerifier {
  _verifyKey?: Uint8Array
  _verifyKeyBase64?: string
  _verifyKeyHex?: string

  constructor ({ verifyKey: id }: IVerifierOptions) {
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

  toString (): string {
    return `Verifier[${this.verifyKeyBase64}]`
  }

  verify (signature: Uint8Array, body: Uint8Array): boolean {
    return verify(signature, body, this.verifyKey)
  }

  verifyMessage (message: IEncryptedMessage): boolean {
    return verify(message.signature, message.body, this.verifyKey)
  }
}
