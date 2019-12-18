import * as sodium from 'sodium-universal'
import {
  anyToBuffer,
  bufferToAny,
  IEncodable,
  Buffer
} from '../util/buffer'

import {
  ICryptoCore, IAnnonymousKeys, IEncryptedMessage, IDecryption, IKeys
} from './types'
import { split } from '../util/split'

/* eslint @typescript-eslint/camelcase: "off" */
const {
  crypto_kdf_derive_from_key,
  randombytes_buf,
  crypto_scalarmult_base,
  crypto_scalarmult,
  crypto_scalarmult_ed25519_BYTES,
  crypto_kdf_BYTES_MAX,
  crypto_kdf_CONTEXTBYTES,
  crypto_box_SEALBYTES,
  crypto_box_SECRETKEYBYTES,
  crypto_box_PUBLICKEYBYTES,
  crypto_sign_PUBLICKEYBYTES,
  crypto_sign_SECRETKEYBYTES,
  crypto_sign_BYTES,
  crypto_sign_ed25519_sk_to_curve25519,
  crypto_sign_ed25519_pk_to_curve25519,
  crypto_sign_seed_keypair,
  crypto_sign_detached,
  crypto_sign_verify_detached,
  crypto_sign_ed25519_sk_to_pk,
  crypto_box_seal,
  crypto_box_seal_open,
  crypto_sign_keypair,
  crypto_secretbox_easy,
  crypto_secretbox_open_easy,
  crypto_secretbox_NONCEBYTES,
  crypto_secretbox_MACBYTES,
  crypto_secretbox_KEYBYTES,
  sodium_malloc
} = sodium.default

function randomBuffer (size: number): Buffer {
  const buffer = sodium_malloc(size)
  randombytes_buf(buffer)
  return buffer
}

const deriveContext = Buffer.from('conotify')

if (deriveContext.length !== crypto_kdf_CONTEXTBYTES) {
  throw new Error(`sodium context bytesize changed, we are in trouble! ${deriveContext.length} != ${crypto_kdf_CONTEXTBYTES}`)
}

function boxSecretFromSignSecret (signSecretKey: Uint8Array): Uint8Array {
  const encryptSecretKey = sodium_malloc(crypto_box_SECRETKEYBYTES)
  crypto_sign_ed25519_sk_to_curve25519(encryptSecretKey, signSecretKey)
  return encryptSecretKey
}

function boxPublicFromSignPublic (signPublicKey: Uint8Array): Uint8Array {
  const encryptPublicKey = sodium_malloc(crypto_box_PUBLICKEYBYTES)
  crypto_sign_ed25519_pk_to_curve25519(encryptPublicKey, signPublicKey)
  return encryptPublicKey
}

function decrypt (encryptPublicKey: Uint8Array, encryptSecretKey: Uint8Array, messageEncrypted: Uint8Array): Uint8Array {
  const messageDecrypted = sodium_malloc(messageEncrypted.length - crypto_box_SEALBYTES)
  const successful = crypto_box_seal_open(messageDecrypted, messageEncrypted, encryptPublicKey, encryptSecretKey)
  if (!successful) {
    return null
  }
  return messageDecrypted
}

function encrypt (encryptPublicKey: Uint8Array, message: Uint8Array): Uint8Array {
  const messageEncrypted = sodium_malloc(message.length + crypto_box_SEALBYTES)
  crypto_box_seal(messageEncrypted, message, encryptPublicKey)
  return messageEncrypted
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
  async deriveKdfKey (key: Uint8Array) {
    const derivedKey = sodium_malloc(crypto_kdf_BYTES_MAX)
    crypto_kdf_derive_from_key(derivedKey, 1, deriveContext, key)
    return derivedKey
  },
  async sign (signSecretKey: Uint8Array, body: Uint8Array) {
    return sign(signSecretKey, body)
  },
  async verify (signPublicKey: Uint8Array, signature: Uint8Array, body: Uint8Array): Promise<boolean> {
    return verify(signPublicKey, signature, body)
  },
  async deriveAnnonymousKeys (readKey: Uint8Array) {
    const sign: IAnnonymousKeys = {
      annonymous: true,
      read: sodium_malloc(crypto_sign_PUBLICKEYBYTES),
      write: sodium_malloc(crypto_sign_SECRETKEYBYTES)
    }
    crypto_sign_seed_keypair(sign.read, sign.write, readKey)
    return sign
  },
  async deriveReadKey (writeKey: Uint8Array) {
    const readKey = sodium_malloc(crypto_sign_PUBLICKEYBYTES)
    crypto_sign_ed25519_sk_to_pk(readKey, writeKey)
    return readKey
  },
  async createSecretKey () {
    return randomBuffer(crypto_secretbox_KEYBYTES)
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
  async decryptMessage (signReadKey: Uint8Array, signWriteKey: Uint8Array, readKey: Uint8Array, message: IEncryptedMessage): Promise<IDecryption> {
    if (!verify(signReadKey, message.signature, message.body)) {
      return {
        error: 'invalid-channel'
      }
    }
    const encryptPublicKey = boxPublicFromSignPublic(signReadKey)
    const encryptSecretKey = boxSecretFromSignSecret(signWriteKey)
    const decrypted = decrypt(encryptPublicKey, encryptSecretKey, message.body)
    if (decrypted === null) {
      return {
        error: 'invalid-encryption'
      }
    }
    const [signature, body] = split(decrypted, crypto_sign_BYTES)
    if (!verify(readKey, signature, body)) {
      return {
        error: 'invalid-owner'
      }
    }
    return {
      body: bufferToAny(body)
    }
  },
  async encryptMessage (annonymousReadKey: Uint8Array, annonymousWriteKey: Uint8Array, writeKey: Uint8Array, message: IEncodable) {
    const msgBuffer = anyToBuffer(message)
    const signedStandardized = sign(writeKey, msgBuffer)
    const secret = Buffer.concat([signedStandardized, msgBuffer])
    const encryptPublicKey = boxPublicFromSignPublic(annonymousReadKey)
    const body = encrypt(encryptPublicKey, secret)
    return {
      signature: sign(annonymousWriteKey, body),
      body
    }
  },
  async initHandshake (): Promise<IKeys> {
    const pri = randomBuffer(crypto_scalarmult_ed25519_BYTES)
    const pub = sodium_malloc(crypto_scalarmult_ed25519_BYTES)
    crypto_scalarmult_base(pub, pri)
    return { write: pri, read: pub }
  },
  async computeSecret (pri: Uint8Array, remotePublic: Uint8Array): Promise<Uint8Array> {
    const secret = sodium_malloc(crypto_scalarmult_ed25519_BYTES)
    crypto_scalarmult(secret, pri, remotePublic)
    return secret
  },
  async createKeys (): Promise<IKeys> {
    const keys = {
      read: sodium_malloc(crypto_sign_PUBLICKEYBYTES),
      write: sodium_malloc(crypto_sign_SECRETKEYBYTES)
    }
    crypto_sign_keypair(keys.read, keys.write)
    return keys
  }
}
