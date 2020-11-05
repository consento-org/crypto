import { bufferToString, toBuffer } from '../util'
import { IAnnonymous, IAnnonymousJSON, IAnnonymousOptions, IEncryptedMessage } from '../types'
import * as sodium from 'sodium-universal'

const { crypto_sign_verify_detached: verify } = sodium.default

export class Annonymous implements IAnnonymous {
  _id?: Uint8Array
  _idBase64?: string
  _idHex?: string

  constructor ({ id }: IAnnonymousOptions) {
    if (typeof id === 'string') {
      this._idBase64 = id
    } else {
      this._id = id
    }
  }

  get id (): Uint8Array {
    if (this._id === undefined) {
      this._id = toBuffer(this._idBase64 as unknown as string)
    }
    return this._id
  }

  get idBase64 (): string {
    if (this._idBase64 === undefined) {
      this._idBase64 = bufferToString(this._id as unknown as Uint8Array, 'base64')
    }
    return this._idBase64
  }

  get idHex (): string {
    if (this._idHex === undefined) {
      this._idHex = bufferToString(this.id, 'hex')
    }
    return this._idHex
  }

  toJSON (): IAnnonymousJSON {
    return {
      id: this.idBase64
    }
  }

  toString (): string {
    return `Annonymous[id=${this.idBase64}]`
  }

  verify (signature: Uint8Array, body: Uint8Array): boolean {
    return verify(signature, body, this.id)
  }

  verifyMessage (message: IEncryptedMessage): boolean {
    return verify(message.signature, message.body, this.id)
  }
}
