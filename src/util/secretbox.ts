import { Buffer } from 'buffer'
import * as sodium from 'sodium-universal'
import { randomBuffer } from './randomBuffer'
import { encode, decode } from '@msgpack/msgpack'

const {
  crypto_secretbox_KEYBYTES: CRYPTO_SECRETBOX_KEYBYTES,
  crypto_secretbox_NONCEBYTES: CRYPTO_SECRETBOX_NONCEBYTES,
  crypto_secretbox_MACBYTES: CRYPTO_SECRETBOX_MACBYTES,
  crypto_secretbox_easy: secretBoxEasy,
  crypto_secretbox_open_easy: secretBoxOpenEasy,
  sodium_malloc: malloc
} = sodium.default

function split (buffer: Uint8Array, offset: number): Uint8Array[] {
  const sliced = [
    buffer.slice(0, offset),
    buffer.slice(offset)
  ]
  return sliced
}

export function createSecret (): Uint8Array {
  return randomBuffer(CRYPTO_SECRETBOX_KEYBYTES)
}

export function encrypt (secretKey: Uint8Array, body: any): Uint8Array {
  const nonce = randomBuffer(CRYPTO_SECRETBOX_NONCEBYTES)
  const message = encode(body)
  const ciphertext = malloc(CRYPTO_SECRETBOX_MACBYTES + message.length)
  secretBoxEasy(ciphertext, message, nonce, secretKey)
  const buffer = Buffer.concat([nonce, ciphertext])
  return buffer
}

export function decrypt (secretKey: Uint8Array, encrypted: Uint8Array): any {
  const [nonce, ciphertext] = split(encrypted, CRYPTO_SECRETBOX_NONCEBYTES)
  const decrypted = malloc(ciphertext.length - CRYPTO_SECRETBOX_MACBYTES)
  if (!secretBoxOpenEasy(decrypted, ciphertext, nonce, secretKey)) {
    throw new Error('cant-decrypt')
  }
  return decode(decrypted)
}
