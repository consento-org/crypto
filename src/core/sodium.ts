/* eslint-disable @typescript-eslint/naming-convention */
import _libsodium from '@consento/libsodium-wrappers-sumo'
import { Buffer } from 'buffer'
import {
  anyToBuffer,
  bufferToAny,
  IEncodable
} from '../util/buffer'

import {
  ICryptoCore, IEncryptedMessage, IDecryption, EDecryptionError
} from './types'

const _global: any = global
if (_global.document === null || _global.document === undefined) {
  _global.document = {}
}

const libsodium = _libsodium.ready.then(() => _libsodium)

function split (buffer: Uint8Array, offset: number): Uint8Array[] {
  return [
    buffer.slice(0, offset),
    buffer.slice(offset)
  ]
}

function assertUint8 (input: Uint8Array): Uint8Array {
  if (input instanceof Buffer) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  }
  return input
}

async function sign (signSecretKey: Uint8Array, body: Uint8Array): Promise<Uint8Array> {
  const { crypto_sign_detached } = await libsodium
  return crypto_sign_detached(assertUint8(body), assertUint8(signSecretKey))
}

async function verify (signPublicKey: Uint8Array, signature: Uint8Array, body: Uint8Array): Promise<boolean> {
  const { crypto_sign_verify_detached } = await libsodium
  return crypto_sign_verify_detached(assertUint8(signature), assertUint8(body), assertUint8(signPublicKey))
}

const deriveContext = 'conotify'

export const sodium: ICryptoCore = {
  async deriveKdfKey (key: Uint8Array, index: number = 1) {
    const { crypto_kdf_derive_from_key, crypto_kdf_BYTES_MAX } = await libsodium
    return crypto_kdf_derive_from_key(crypto_kdf_BYTES_MAX, index, deriveContext, assertUint8(key))
  },
  sign,
  verify,
  async decryptMessage (verifyKey: Uint8Array, writeKey: Uint8Array, readKey: Uint8Array, message: IEncryptedMessage): Promise<IDecryption> {
    const bodyIn = assertUint8(message.body)
    if (!await verify(verifyKey, message.signature, bodyIn)) {
      return {
        error: EDecryptionError.invalidSignature
      }
    }
    const { crypto_box_seal_open } = await libsodium
    const messageDecrypted = crypto_box_seal_open(message.body, writeKey, readKey)
    if (messageDecrypted === null) {
      return {
        error: EDecryptionError.invalidEncryption
      }
    }
    return {
      body: bufferToAny(messageDecrypted)
    }
  },
  async createSecretKey (): Promise<Uint8Array> {
    const { randombytes_buf, crypto_secretbox_KEYBYTES } = await libsodium
    return randombytes_buf(crypto_secretbox_KEYBYTES)
  },
  async encrypt (secretKey: Uint8Array, body: IEncodable): Promise<Uint8Array> {
    const { randombytes_buf, crypto_secretbox_NONCEBYTES, crypto_secretbox_easy } = await libsodium
    const nonce = randombytes_buf(crypto_secretbox_NONCEBYTES)
    const message = anyToBuffer(body)
    const ciphertext = crypto_secretbox_easy(message, nonce, secretKey)
    const buffer = Buffer.concat([nonce, ciphertext])
    return buffer
  },
  async decrypt (secretKey: Uint8Array, encrypted: Uint8Array): Promise<IEncodable> {
    const { crypto_secretbox_NONCEBYTES, crypto_secretbox_open_easy } = await libsodium
    const [nonce, ciphertext] = split(encrypted, crypto_secretbox_NONCEBYTES)
    return bufferToAny(crypto_secretbox_open_easy(ciphertext, nonce, secretKey))
  },
  async encryptMessage (signKey: Uint8Array, writeKey: Uint8Array, message: IEncodable): Promise<IEncryptedMessage> {
    const { crypto_box_seal } = await libsodium
    const msgBuffer = anyToBuffer(message)
    const body = crypto_box_seal(msgBuffer, writeKey)
    return {
      signature: await sign(signKey, body),
      body
    }
  },
  async initHandshake () {
    const { randombytes_buf, crypto_scalarmult_BYTES, crypto_scalarmult_base } = await libsodium
    const privateKey = randombytes_buf(crypto_scalarmult_BYTES)
    return {
      privateKey,
      publicKey: crypto_scalarmult_base(privateKey)
    }
  },
  async computeSecret (pri: Uint8Array, remotePublic: Uint8Array) {
    const { crypto_scalarmult } = await libsodium
    return crypto_scalarmult(assertUint8(pri), assertUint8(remotePublic))
  },
  async createEncryptionKeys () {
    const { crypto_box_keypair } = await libsodium
    return crypto_box_keypair()
  },
  async createSignKeys () {
    const { crypto_sign_keypair } = await libsodium
    return crypto_sign_keypair()
  }
}
