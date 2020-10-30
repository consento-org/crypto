import { IEncryptedBlob, IEncryptedBlobJSON } from '../types'
import { bufferToString } from '../util/buffer'
import { Buffer, IEncodable } from '../util/types'
import { encrypt, decrypt, createSecret } from '../util/secretbox'
import * as sodium from 'sodium-universal'

const {
  crypto_kdf_CONTEXTBYTES: CRYPTO_KDF_CONTEXTBYTES,
  crypto_kdf_BYTES_MAX: CRYPTO_KDF_BYTES_MAX,
  crypto_kdf_derive_from_key: kdfDeriveFromKey,
  sodium_malloc: malloc
} = sodium.default

const deriveContext = Buffer.from('conotify')
if (deriveContext.length !== CRYPTO_KDF_CONTEXTBYTES) {
  throw new Error(`sodium context bytesize changed, we are in trouble! ${deriveContext.length} != ${CRYPTO_KDF_CONTEXTBYTES}`)
}

function deriveKdfKey (key: Uint8Array, index: number = 1): Uint8Array {
  const derivedKey = malloc(CRYPTO_KDF_BYTES_MAX)
  kdfDeriveFromKey(derivedKey, index, deriveContext, key)
  return derivedKey
}

function pathForSecretKey (secretKey: Uint8Array): string[] {
  const locationKey = deriveKdfKey(secretKey)
  return bufferToString(locationKey, 'hex').substr(0, 16).split(/(.{4})/).filter(Boolean)
}

export function isEncryptedBlob (input: any): input is IEncryptedBlob {
  if (typeof input !== 'object' || input === null) {
    return false
  }
  if (!(input.secretKey instanceof Uint8Array)) {
    return false
  }
  const { path } = input
  if (!Array.isArray(path)) {
    return false
  }
  for (const element of path) {
    if (typeof element !== 'string') {
      return false
    }
  }
  return input.size === null || input.size === undefined || typeof input.size === 'number'
}

function isEncryptedBlobJSON (input: IEncryptedBlobJSON | IEncryptedBlob): input is IEncryptedBlobJSON {
  return typeof input.secretKey === 'string'
}

function newBlob (secretKey: Uint8Array, path: string[], size?: number): IEncryptedBlob {
  return {
    path,
    secretKey,
    size,
    toJSON () {
      return {
        secretKey: bufferToString(secretKey, 'base64'),
        path,
        size
      }
    },
    // @ts-expect-error
    toString () {
      return `[EncryptedBlob#${bufferToString(secretKey, 'hex')}@${path.join('/')}]`
    }
  }
}

function _toBlob (input: Uint8Array): IEncryptedBlob {
  return newBlob(input, pathForSecretKey(input))
}

export function toEncryptedBlob (input: string | Uint8Array | IEncryptedBlob | IEncryptedBlobJSON): IEncryptedBlob {
  if (typeof input === 'string') {
    return _toBlob(Buffer.from(input, 'hex'))
  }
  if (input instanceof Uint8Array) {
    return _toBlob(input)
  }
  if (isEncryptedBlobJSON(input)) {
    return newBlob(Buffer.from(input.secretKey, 'base64'), input.path.concat(), input.size)
  }
  return input
}

export function encryptBlob (encodable: IEncodable): { blob: IEncryptedBlob, encrypted: Uint8Array } {
  const secretKey = createSecret()
  const path = pathForSecretKey(secretKey)
  const encrypted = encrypt(secretKey, encodable)
  return {
    blob: newBlob(secretKey, path, encrypted.length),
    encrypted
  }
}

export function decryptBlob (secretKey: Uint8Array, encrypted: Uint8Array): IEncodable {
  return decrypt(secretKey, encrypted)
}
