import { IAnnonymous, IReceiver, IReceiverJSON, IEncryptedMessage, IReceiverOptions, IDecryption, EDecryptionError } from '../types'
import { Annonymous } from './Annonymous'
import { encryptKeyFromSendOrReceiveKey, decryptKeyFromReceiveKey, verifyKeyFromSendOrReceiveKey } from './key'
import { bufferToAny, bufferToString, toBuffer } from '../util'
import * as sodium from 'sodium-universal'

const {
  crypto_box_SEALBYTES: CRYPTO_BOX_SEALBYTES,
  crypto_box_seal_open: boxSealOpen,
  crypto_sign_verify_detached: verify,
  sodium_malloc: malloc
} = sodium.default

function decryptMessage (verifyKey: Uint8Array, writeKey: Uint8Array, readKey: Uint8Array, message: IEncryptedMessage | Uint8Array): IDecryption {
  let bodyIn: Uint8Array
  if (message instanceof Uint8Array) {
    bodyIn = message
  } else {
    bodyIn = message.body
    if (!verify(message.signature, bodyIn, verifyKey)) {
      return {
        error: EDecryptionError.invalidSignature
      }
    }
  }
  const messageDecrypted = malloc(bodyIn.length - CRYPTO_BOX_SEALBYTES)
  const successful = boxSealOpen(messageDecrypted, bodyIn, writeKey, readKey)
  if (!successful) {
    return {
      error: EDecryptionError.invalidEncryption
    }
  }
  return {
    body: bufferToAny(messageDecrypted)
  }
}

export class Receiver implements IReceiver {
  _receiveKey?: Uint8Array
  _receiveKeyBase64?: string
  _decryptKey?: Uint8Array
  _encryptKey?: Uint8Array
  _annonymous?: IAnnonymous

  constructor ({ receiveKey }: IReceiverOptions) {
    if (typeof receiveKey === 'string') {
      this._receiveKeyBase64 = receiveKey
    } else {
      this._receiveKey = receiveKey
    }
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

  get encryptKey (): Uint8Array {
    if (this._encryptKey === undefined) {
      this._encryptKey = encryptKeyFromSendOrReceiveKey(this.receiveKey)
    }
    return this._encryptKey
  }

  get annonymous (): IAnnonymous {
    if (this._annonymous === undefined) {
      this._annonymous = new Annonymous({ id: verifyKeyFromSendOrReceiveKey(this.receiveKey) })
    }
    return this._annonymous
  }

  get decryptKey (): Uint8Array {
    if (this._decryptKey === undefined) {
      this._decryptKey = decryptKeyFromReceiveKey(this.receiveKey)
    }
    return this._decryptKey
  }

  get receiveKey (): Uint8Array {
    if (this._receiveKey === undefined) {
      this._receiveKey = toBuffer(this._receiveKeyBase64 as unknown as string)
    }
    return this._receiveKey
  }

  get receiveKeyBase64 (): string {
    if (this._receiveKeyBase64 === undefined) {
      this._receiveKeyBase64 = bufferToString(this._receiveKey as unknown as Uint8Array, 'base64')
    }
    return this._receiveKeyBase64
  }

  toJSON (): IReceiverJSON {
    return { receiveKey: this.receiveKeyBase64 }
  }

  toString (): string {
    return `Receiver[id=${this.idBase64}]`
  }

  decrypt (encrypted: IEncryptedMessage): IDecryption {
    return decryptMessage(
      this.annonymous.id,
      this.encryptKey,
      this.decryptKey,
      encrypted
    )
  }
}
