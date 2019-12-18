import _libsodium from '@consento/libsodium-wrappers-sumo'
import { split } from '../util/split'

import {
  anyToBuffer,
  bufferToAny,
  concatUint8Arrays,
  IEncodable,
  Buffer
} from '../util/buffer'

import {
  ICryptoCore, IEncryptedMessage, IDecryption
} from './types'

const _global: any = global
if (_global.document === null || _global.document === undefined) {
  _global.document = {}
}

const libsodium = _libsodium.ready.then(() => _libsodium)
const deriveContext = 'conotify'

/* eslint @typescript-eslint/camelcase: "off" */
async function boxSecretFromSignSecret (signSecretKey: Uint8Array): Promise<Uint8Array> {
  const { crypto_sign_ed25519_sk_to_curve25519 } = await libsodium
  return crypto_sign_ed25519_sk_to_curve25519(assertUint8(signSecretKey))
}

async function boxPublicFromSignPublic (signPublicKey: Uint8Array): Promise<Uint8Array> {
  const { crypto_sign_ed25519_pk_to_curve25519 } = await libsodium
  return crypto_sign_ed25519_pk_to_curve25519(assertUint8(signPublicKey))
}

async function decrypt (signReadKey: Uint8Array, signWriteKey: Uint8Array, messageEncrypted: Uint8Array): Promise<Uint8Array> {
  const encryptPublicKey = await boxPublicFromSignPublic(signReadKey)
  const encryptSecretKey = await boxSecretFromSignSecret(signWriteKey)
  const { crypto_box_seal_open } = await libsodium
  return crypto_box_seal_open(assertUint8(messageEncrypted), encryptPublicKey, encryptSecretKey)
}

async function encrypt (signPublicKey: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const { crypto_box_seal: seal } = await libsodium
  const encryptPublicKey = await boxPublicFromSignPublic(assertUint8(signPublicKey))
  return seal(assertUint8(message), encryptPublicKey)
}

function assertUint8 (input: Uint8Array | Buffer): Uint8Array {
  if (!('Buffer' in global) || input instanceof Buffer) {
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

export const sodium: ICryptoCore = {
  async deriveKdfKey (key: Uint8Array) {
    const { crypto_kdf_derive_from_key, crypto_kdf_BYTES_MAX } = await libsodium
    return crypto_kdf_derive_from_key(crypto_kdf_BYTES_MAX, 1, deriveContext, assertUint8(key))
  },
  sign,
  verify,
  async deriveAnnonymousKeys (readKey: Uint8Array) {
    const { crypto_sign_seed_keypair } = await libsodium
    const pair = crypto_sign_seed_keypair(assertUint8(readKey))
    return {
      annonymous: true,
      read: pair.publicKey,
      write: pair.privateKey
    }
  },
  async deriveReadKey (writeKey: Uint8Array) {
    const { crypto_sign_ed25519_sk_to_pk } = await libsodium
    return crypto_sign_ed25519_sk_to_pk(assertUint8(writeKey))
  },
  async decryptMessage (signReadKey: Uint8Array, signWriteKey: Uint8Array, readKey: Uint8Array, message: IEncryptedMessage): Promise<IDecryption> {
    signReadKey = assertUint8(signReadKey)
    const bodyIn = assertUint8(message.body)
    if (!await verify(signReadKey, message.signature, bodyIn)) {
      return {
        error: 'invalid-channel'
      }
    }
    const decrypted = await decrypt(signReadKey, assertUint8(signWriteKey), bodyIn)
    if (decrypted === null) {
      return {
        error: 'invalid-encryption'
      }
    }
    const { crypto_sign_BYTES } = await libsodium
    const [signature, body] = split(decrypted, crypto_sign_BYTES)
    if (!await verify(assertUint8(readKey), signature, body)) {
      return {
        error: 'invalid-owner'
      }
    }
    return {
      body: bufferToAny(body)
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
  async encryptMessage (annonymousReadKey: Uint8Array, annonymousWriteKey: Uint8Array, writeKey: Uint8Array, message: IEncodable) {
    const msgBuffer = assertUint8(anyToBuffer(message))
    const signedStandardized = await sign(assertUint8(writeKey), msgBuffer)
    const secret = concatUint8Arrays([signedStandardized, msgBuffer])
    const body = await encrypt(assertUint8(annonymousReadKey), secret)
    return {
      signature: await sign(assertUint8(annonymousWriteKey), body),
      body
    }
  },
  async initHandshake () {
    const { randombytes_buf, crypto_scalarmult_BYTES, crypto_scalarmult_base } = await libsodium
    const pri = randombytes_buf(crypto_scalarmult_BYTES)
    const pub = crypto_scalarmult_base(pri)
    return { write: pri, read: pub }
  },
  async computeSecret (pri: Uint8Array, remotePublic: Uint8Array) {
    const { crypto_scalarmult } = await libsodium
    return crypto_scalarmult(assertUint8(pri), assertUint8(remotePublic))
  },
  async createKeys () {
    const { crypto_sign_keypair } = await libsodium
    const keyPair = crypto_sign_keypair()
    return {
      write: keyPair.privateKey,
      read: keyPair.publicKey
    }
  }
}
