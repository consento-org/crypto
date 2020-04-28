declare module 'sodium-universal' {
  import { Buffer } from 'buffer'

  export interface LibSodium {
    readonly crypto_kdf_BYTES_MAX: number
    readonly crypto_kdf_CONTEXTBYTES: number
    readonly crypto_box_SEALBYTES: number
    readonly crypto_box_SECRETKEYBYTES: number
    readonly crypto_box_PUBLICKEYBYTES: number
    readonly crypto_sign_PUBLICKEYBYTES: number
    readonly crypto_sign_SECRETKEYBYTES: number
    readonly crypto_sign_BYTES: number
    readonly crypto_secretbox_NONCEBYTES: number
    readonly crypto_secretbox_KEYBYTES: number
    readonly crypto_secretbox_MACBYTES: number
    readonly crypto_scalarmult_BYTES: number
    crypto_kdf_derive_from_key(derivedKey: Uint8Array, index: number, deriveContext: Uint8Array, key: Uint8Array): void
    crypto_scalarmult_base(pk: Uint8Array, sk: Uint8Array): void
    crypto_scalarmult(secret: Uint8Array, sk: Uint8Array, remotePk: Uint8Array): void
    crypto_sign_seed_keypair(pk: Uint8Array, sk: Uint8Array, readKey: Uint8Array): void
    crypto_sign_detached(signature: Uint8Array, body: Uint8Array, signSecretKey: Uint8Array): void
    crypto_sign_verify_detached(signature: Uint8Array, body: Uint8Array, signPublicKey: Uint8Array): boolean
    crypto_box_seal(messageEncrypted: Uint8Array, message: Uint8Array, pk: Uint8Array): void
    crypto_box_seal_open(messageDecrypted: Uint8Array, messageEncrypted: Uint8Array, pk: Uint8Array, sk: Uint8Array): boolean
    crypto_sign_keypair(pk: Uint8Array, sk: Uint8Array): void
    crypto_box_keypair(pk: Uint8Array, sk: Uint8Array): void
    randombytes_buf(buffer: Buffer): void
    crypto_secretbox_easy(ciphertext: Uint8Array, message: Uint8Array, nonce: Uint8Array, secretKey: Uint8Array): void
    crypto_secretbox_open_easy(message: Uint8Array, ciphertext: Uint8Array, nonce: Uint8Array, secretKey: Uint8Array): boolean
    sodium_malloc(size: number): Buffer
  }

  const libsodium: LibSodium
  export default libsodium
}