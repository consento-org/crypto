import { IAnnonymous, ISender, ISenderJSON, IEncryptedMessage, ISenderOptions } from '../types'
import { Annonymous } from './Annonymous'
import { encryptKeyFromSendOrReceiveKey, signKeyFromSendKey, verifyKeyFromSendOrReceiveKey } from './key'
import { anyToBuffer, bufferToString, toBuffer, IEncodable } from '../util'
import * as sodium from 'sodium-universal'

const {
  crypto_box_SEALBYTES: CRYPTO_BOX_SEALBYTES,
  crypto_box_seal: boxSeal,
  crypto_sign_BYTES: CRYPTO_SIGN_BYTES,
  crypto_sign_detached: signDetached,
  sodium_malloc: malloc
} = sodium.default

function sign (signSecretKey: Uint8Array, body: Uint8Array): Uint8Array {
  const signature = malloc(CRYPTO_SIGN_BYTES)
  signDetached(signature, body, signSecretKey)
  return signature
}

function encryptMessage (writeKey: Uint8Array, message: IEncodable): Uint8Array {
  const msgBuffer = anyToBuffer(message)
  const body = malloc(msgBuffer.length + CRYPTO_BOX_SEALBYTES)
  boxSeal(body, msgBuffer, writeKey)
  return body
}

export class Sender implements ISender {
  _sendKey?: Uint8Array
  _sendKeyBase64?: string
  _annonymous?: IAnnonymous
  _signKey?: Uint8Array
  _encryptKey?: Uint8Array

  constructor ({ sendKey }: ISenderOptions) {
    if (typeof sendKey === 'string') {
      this._sendKeyBase64 = sendKey
    } else {
      this._sendKey = sendKey
    }
  }

  get signKey (): Uint8Array {
    if (this._signKey === undefined) {
      this._signKey = signKeyFromSendKey(this.sendKey)
    }
    return this._signKey
  }

  get encryptKey (): Uint8Array {
    if (this._encryptKey === undefined) {
      this._encryptKey = encryptKeyFromSendOrReceiveKey(this.sendKey)
    }
    return this._encryptKey
  }

  get sendKey (): Uint8Array {
    if (this._sendKey === undefined) {
      this._sendKey = toBuffer(this._sendKeyBase64 as unknown as string)
    }
    return this._sendKey
  }

  get sendKeyBase64 (): string {
    if (this._sendKeyBase64 === undefined) {
      this._sendKeyBase64 = bufferToString(this._sendKey as unknown as Uint8Array, 'base64')
    }
    return this._sendKeyBase64
  }

  get id (): Uint8Array {
    return this.annonymous.id
  }

  get idHex (): string {
    return this.annonymous.idHex
  }

  get idBase64 (): string {
    return this.annonymous.idBase64
  }

  get annonymous (): IAnnonymous {
    if (this._annonymous === undefined) {
      this._annonymous = new Annonymous({ id: verifyKeyFromSendOrReceiveKey(this.sendKey) })
    }
    return this._annonymous
  }

  toJSON (): ISenderJSON {
    return { sendKey: this.sendKeyBase64 }
  }

  toString (): string {
    return `Sender[id=${this.idBase64}]`
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
