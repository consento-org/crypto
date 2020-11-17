import { IVerifier, IWriter, IWriterJSON, IEncryptedMessage, IWriterOptions } from '../types'
import { Verifier } from './Verifier'
import { encryptKeyFromSendOrReceiveKey, signKeyFromSendKey, verifyKeyFromSendOrReceiveKey } from './key'
import { bufferToString, toBuffer, IEncodable } from '../util'
import { encryptMessage, sign } from './fn'

export class Writer implements IWriter {
  _sendKey?: Uint8Array
  _sendKeyBase64?: string
  _annonymous?: IVerifier
  _signKey?: Uint8Array
  _encryptKey?: Uint8Array

  constructor ({ writerKey: sendKey }: IWriterOptions) {
    if (typeof sendKey === 'string') {
      this._sendKeyBase64 = sendKey
    } else {
      this._sendKey = sendKey
    }
  }

  get signKey (): Uint8Array {
    if (this._signKey === undefined) {
      this._signKey = signKeyFromSendKey(this.writerKey)
    }
    return this._signKey
  }

  get encryptKey (): Uint8Array {
    if (this._encryptKey === undefined) {
      this._encryptKey = encryptKeyFromSendOrReceiveKey(this.writerKey)
    }
    return this._encryptKey
  }

  get writerKey (): Uint8Array {
    if (this._sendKey === undefined) {
      this._sendKey = toBuffer(this._sendKeyBase64 as unknown as string)
    }
    return this._sendKey
  }

  get writerKeyBase64 (): string {
    if (this._sendKeyBase64 === undefined) {
      this._sendKeyBase64 = bufferToString(this._sendKey as unknown as Uint8Array, 'base64')
    }
    return this._sendKeyBase64
  }

  get verifyKey (): Uint8Array {
    return this.verifier.verifyKey
  }

  get verifyKeyHex (): string {
    return this.verifier.verifyKeyHex
  }

  get verifyKeyBase64 (): string {
    return this.verifier.verifyKeyBase64
  }

  get verifier (): IVerifier {
    if (this._annonymous === undefined) {
      this._annonymous = new Verifier({ verifyKey: verifyKeyFromSendOrReceiveKey(this.writerKey) })
    }
    return this._annonymous
  }

  toJSON (): IWriterJSON {
    return { writerKey: this.writerKeyBase64 }
  }

  toString (): string {
    return `Writer[${this.verifyKeyBase64}]`
  }

  sign (data: Uint8Array): Uint8Array {
    return sign(this.signKey, data)
  }

  encryptOnly (message: IEncodable): Uint8Array {
    return encryptMessage(this.encryptKey, message)
  }

  encrypt (message: IEncodable): IEncryptedMessage {
    const body = encryptMessage(this.encryptKey, message)
    return {
      signature: sign(this.signKey, body),
      body
    }
  }
}
