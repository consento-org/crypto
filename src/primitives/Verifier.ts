import { bufferToString, toBuffer } from '../util'
import { IVerifier, IVerifierJSON, IVerifierOptions, IEncryptedMessage } from '../types'
import * as sodium from 'sodium-universal'

const { crypto_sign_verify_detached: verify } = sodium.default

export class Verifier implements IVerifier {
  _id?: Uint8Array
  _idBase64?: string
  _idHex?: string

  constructor ({ channelKey: id }: IVerifierOptions) {
    if (typeof id === 'string') {
      this._idBase64 = id
    } else {
      this._id = id
    }
  }

  get channelKey (): Uint8Array {
    if (this._id === undefined) {
      this._id = toBuffer(this._idBase64 as unknown as string)
    }
    return this._id
  }

  get channelKeyBase64 (): string {
    if (this._idBase64 === undefined) {
      this._idBase64 = bufferToString(this._id as unknown as Uint8Array, 'base64')
    }
    return this._idBase64
  }

  get channelKeyHex (): string {
    if (this._idHex === undefined) {
      this._idHex = bufferToString(this.channelKey, 'hex')
    }
    return this._idHex
  }

  toJSON (): IVerifierJSON {
    return {
      channelKey: this.channelKeyBase64
    }
  }

  toString (): string {
    return `Verifier[${this.channelKeyBase64}]`
  }

  verify (signature: Uint8Array, body: Uint8Array): boolean {
    return verify(signature, body, this.channelKey)
  }

  verifyMessage (message: IEncryptedMessage): boolean {
    return verify(message.signature, message.body, this.channelKey)
  }
}
