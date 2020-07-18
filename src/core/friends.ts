/* eslint-disable @typescript-eslint/naming-convention */
import * as sodium from 'sodium-universal'
import { Buffer } from 'buffer'
import {
  anyToBuffer,
  IEncodable,
  bufferToAny
} from '../util/buffer'

import {
  ICryptoCore, IEncryptedMessage, IDecryption, EDecryptionError, IRawKeys
} from './types'

const {
  crypto_kdf_derive_from_key,
  randombytes_buf,
  crypto_scalarmult_base,
  crypto_scalarmult,
  crypto_scalarmult_BYTES,
  crypto_kdf_BYTES_MAX,
  crypto_kdf_CONTEXTBYTES,
  crypto_box_seal,
  crypto_box_seal_open,
  crypto_box_keypair,
  crypto_box_SEALBYTES,
  crypto_box_SECRETKEYBYTES,
  crypto_box_PUBLICKEYBYTES,
  crypto_sign_PUBLICKEYBYTES,
  crypto_sign_SECRETKEYBYTES,
  crypto_sign_BYTES,
  crypto_sign_detached,
  crypto_sign_verify_detached,
  crypto_sign_keypair,
  crypto_secretbox_easy,
  crypto_secretbox_open_easy,
  crypto_secretbox_NONCEBYTES,
  crypto_secretbox_MACBYTES,
  crypto_secretbox_KEYBYTES,
  sodium_malloc
} = sodium.default

function randomBuffer (size: number): Uint8Array {
  const buffer = sodium_malloc(size)
  randombytes_buf(buffer)
  return buffer
}

function split (buffer: Uint8Array, offset: number): Uint8Array[] {
  const sliced = [
    buffer.slice(0, offset),
    buffer.slice(offset)
  ]
  return sliced
}

const deriveContext = Buffer.from('conotify')

if (deriveContext.length !== crypto_kdf_CONTEXTBYTES) {
  throw new Error(`sodium context bytesize changed, we are in trouble! ${deriveContext.length} != ${crypto_kdf_CONTEXTBYTES}`)
}

function sign (signSecretKey: Uint8Array, body: Uint8Array): Uint8Array {
  const signature = sodium_malloc(crypto_sign_BYTES)
  crypto_sign_detached(signature, body, signSecretKey)
  return signature
}
function verify (signPublicKey: Uint8Array, signature: Uint8Array, body: Uint8Array): boolean {
  return crypto_sign_verify_detached(signature, body, signPublicKey)
}

export const friends: ICryptoCore = {
  /* eslint @typescript-eslint/require-await: "off" */
  async sign (signSecretKey: Uint8Array, body: Uint8Array) {
    return sign(signSecretKey, body)
  },
  async verify (signPublicKey: Uint8Array, signature: Uint8Array, body: Uint8Array): Promise<boolean> {
    return verify(signPublicKey, signature, body)
  },
  async createSecretKey () {
    return randomBuffer(crypto_secretbox_KEYBYTES)
  },
  async deriveKdfKey (key: Uint8Array, index: number = 1) {
    const derivedKey = sodium_malloc(crypto_kdf_BYTES_MAX)
    crypto_kdf_derive_from_key(derivedKey, index, deriveContext, key)
    return derivedKey
  },
  async encrypt (secretKey: Uint8Array, body: IEncodable): Promise<Uint8Array> {
    const nonce = randomBuffer(crypto_secretbox_NONCEBYTES)
    const message = anyToBuffer(body)
    const ciphertext = sodium_malloc(crypto_secretbox_MACBYTES + message.length)
    crypto_secretbox_easy(ciphertext, message, nonce, secretKey)
    const buffer = Buffer.concat([nonce, ciphertext])
    return buffer
  },
  async decrypt (secretKey: Uint8Array, encrypted: Uint8Array): Promise<IEncodable> {
    const [nonce, ciphertext] = split(encrypted, crypto_secretbox_NONCEBYTES)
    const decrypted = sodium_malloc(ciphertext.length - crypto_secretbox_MACBYTES)
    if (!crypto_secretbox_open_easy(decrypted, ciphertext, nonce, secretKey)) {
      throw new Error('cant-decrypt')
    }
    return bufferToAny(decrypted)
  },
  async decryptMessage (verifyKey: Uint8Array, writeKey: Uint8Array, readKey: Uint8Array, message: IEncryptedMessage): Promise<IDecryption> {
    if (!verify(verifyKey, message.signature, message.body)) {
      return {
        error: EDecryptionError.invalidSignature
      }
    }
    const messageDecrypted = sodium_malloc(message.body.length - crypto_box_SEALBYTES)
    const successful = crypto_box_seal_open(messageDecrypted, message.body, writeKey, readKey)
    if (!successful) {
      return {
        error: EDecryptionError.invalidEncryption
      }
    }
    return {
      body: bufferToAny(messageDecrypted)
    }
  },
  async encryptMessage (signKey: Uint8Array, writeKey: Uint8Array, message: IEncodable) {
    const msgBuffer = anyToBuffer(message)
    const body = sodium_malloc(msgBuffer.length + crypto_box_SEALBYTES)
    crypto_box_seal(body, msgBuffer, writeKey)
    return {
      signature: sign(signKey, body),
      body
    }
  },
  async initHandshake (): Promise<IRawKeys> {
    const privateKey = randomBuffer(crypto_scalarmult_BYTES)
    const publicKey = sodium_malloc(crypto_scalarmult_BYTES)
    crypto_scalarmult_base(publicKey, privateKey)
    return { privateKey, publicKey }
  },
  async computeSecret (privateKey: Uint8Array, remotePublic: Uint8Array): Promise<Uint8Array> {
    const secret = sodium_malloc(crypto_scalarmult_BYTES)
    crypto_scalarmult(secret, privateKey, remotePublic)
    return secret
  },
  async createEncryptionKeys (): Promise<IRawKeys> {
    const keys = {
      publicKey: sodium_malloc(crypto_box_PUBLICKEYBYTES),
      privateKey: sodium_malloc(crypto_box_SECRETKEYBYTES)
    }
    crypto_box_keypair(keys.publicKey, keys.privateKey)
    return keys
  },
  async createSignKeys (): Promise<IRawKeys> {
    const keys = {
      publicKey: sodium_malloc(crypto_sign_PUBLICKEYBYTES),
      privateKey: sodium_malloc(crypto_sign_SECRETKEYBYTES)
    }
    crypto_sign_keypair(keys.publicKey, keys.privateKey)
    return keys
  }
}
