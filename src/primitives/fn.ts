import { EDecryptionError, IEncryptedMessage } from '../types'
import * as sodium from 'sodium-universal'
import { bufferToAny, anyToBuffer } from '../util/buffer'
import { IEncodable } from '../util/types'

const {
  crypto_box_SEALBYTES: CRYPTO_BOX_SEALBYTES,
  crypto_sign_BYTES: CRYPTO_SIGN_BYTES,
  crypto_box_seal_open: boxSealOpen,
  crypto_box_seal: boxSeal,
  crypto_sign_verify_detached: _verify,
  crypto_sign_detached: signDetached,
  sodium_malloc: malloc
} = sodium.default

export function encryptMessage (writeKey: Uint8Array, message: IEncodable): Uint8Array {
  const msgBuffer = anyToBuffer(message)
  const body = malloc(msgBuffer.length + CRYPTO_BOX_SEALBYTES)
  boxSeal(body, msgBuffer, writeKey)
  return body
}

export function verify (verifyKey: Uint8Array, signature: Uint8Array, body: Uint8Array): boolean {
  return _verify(signature, body, verifyKey)
}

export function verifyMessage (verifyKey: Uint8Array, message: IEncryptedMessage): boolean {
  return _verify(message.signature, message.body, verifyKey)
}

export function decryptMessage (verifyKey: Uint8Array, writeKey: Uint8Array, readKey: Uint8Array, message: IEncryptedMessage | Uint8Array): IEncodable {
  let bodyIn: Uint8Array
  if (message instanceof Uint8Array) {
    bodyIn = message
  } else {
    bodyIn = message.body
    if (!verify(verifyKey, message.signature, bodyIn)) {
      throw Object.assign(new Error('Invalid signature'), { code: EDecryptionError.invalidSignature })
    }
  }
  const messageDecrypted = malloc(bodyIn.length - CRYPTO_BOX_SEALBYTES)
  const successful = boxSealOpen(messageDecrypted, bodyIn, writeKey, readKey)
  if (!successful) {
    throw Object.assign(new Error('Can not decrypt data. Is it encryted with different key?'), { code: EDecryptionError.invalidEncryption })
  }
  return bufferToAny(messageDecrypted)
}

export function sign (signKey: Uint8Array, body: Uint8Array): Uint8Array {
  const signature = malloc(CRYPTO_SIGN_BYTES)
  signDetached(signature, body, signKey)
  return signature
}
