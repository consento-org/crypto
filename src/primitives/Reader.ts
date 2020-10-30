import { IVerifier, IReader, IReaderJSON, IEncryptedMessage, IReaderOptions, IDecryption, EDecryptionError } from '../types'
import { Verifier } from './Verifier'
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

export class Reader implements IReader {
  _receiveKey?: Uint8Array
  _receiveKeyBase64?: string
  _decryptKey?: Uint8Array
  _encryptKey?: Uint8Array
  _annonymous?: IVerifier

  constructor ({ readerKey: receiveKey }: IReaderOptions) {
    if (typeof receiveKey === 'string') {
      this._receiveKeyBase64 = receiveKey
    } else {
      this._receiveKey = receiveKey
    }
  }

  get channelKey (): Uint8Array {
    return this.verifier.channelKey
  }

  get channelKeyHex (): string {
    return this.verifier.channelKeyHex
  }

  get channelKeyBase64 (): string {
    return this.verifier.channelKeyBase64
  }

  get encryptKey (): Uint8Array {
    if (this._encryptKey === undefined) {
      this._encryptKey = encryptKeyFromSendOrReceiveKey(this.readerKey)
    }
    return this._encryptKey
  }

  get verifier (): IVerifier {
    if (this._annonymous === undefined) {
      this._annonymous = new Verifier({ channelKey: verifyKeyFromSendOrReceiveKey(this.readerKey) })
    }
    return this._annonymous
  }

  get decryptKey (): Uint8Array {
    if (this._decryptKey === undefined) {
      this._decryptKey = decryptKeyFromReceiveKey(this.readerKey)
    }
    return this._decryptKey
  }

  get readerKey (): Uint8Array {
    if (this._receiveKey === undefined) {
      this._receiveKey = toBuffer(this._receiveKeyBase64 as unknown as string)
    }
    return this._receiveKey
  }

  get readerKeyBase64 (): string {
    if (this._receiveKeyBase64 === undefined) {
      this._receiveKeyBase64 = bufferToString(this._receiveKey as unknown as Uint8Array, 'base64')
    }
    return this._receiveKeyBase64
  }

  toJSON (): IReaderJSON {
    return { readerKey: this.readerKeyBase64 }
  }

  toString (): string {
    return `Reader[${this.channelKeyBase64}]`
  }

  decrypt (encrypted: IEncryptedMessage): IDecryption {
    return decryptMessage(
      this.verifier.channelKey,
      this.encryptKey,
      this.decryptKey,
      encrypted
    )
  }
}
