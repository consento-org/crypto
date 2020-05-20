import { ICryptoCore } from '../core/types'
import { IEncryptedBlobAPI, IEncryptedBlob, IEncryptedBlobJSON } from '../types'
import { bufferToString, IEncodable } from '../util/buffer'
import { Buffer } from 'buffer'

async function pathForSecretKey (cryptoCore: ICryptoCore, secretKey: Uint8Array): Promise<string[]> {
  const locationKey = await cryptoCore.deriveKdfKey(secretKey)
  return bufferToString(locationKey, 'hex').substr(0, 16).split(/(.{4})/).filter(Boolean)
}

function isEncryptedBlob (input: any): input is IEncryptedBlob {
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
    // @ts-ignore
    toString () {
      return `[EncryptedBlob#${bufferToString(secretKey, 'hex')}@${path.join('/')}]`
    }
  }
}

async function _toBlob (crypto: ICryptoCore, input: Uint8Array): Promise<IEncryptedBlob> {
  const path = await pathForSecretKey(crypto, input)
  return newBlob(input, path)
}

export function setupBlob (crypto: ICryptoCore): IEncryptedBlobAPI {
  function toEncryptedBlob (input: string | Uint8Array): Promise<IEncryptedBlob>
  function toEncryptedBlob (input: IEncryptedBlobJSON | IEncryptedBlob): IEncryptedBlob
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  function toEncryptedBlob (input: string | Uint8Array | IEncryptedBlob | IEncryptedBlobJSON): Promise<IEncryptedBlob> | IEncryptedBlob {
    if (typeof input === 'string') {
      return _toBlob(crypto, Buffer.from(input, 'hex'))
    }
    if (input instanceof Uint8Array) {
      return _toBlob(crypto, input)
    }
    if (isEncryptedBlobJSON(input)) {
      return newBlob(Buffer.from(input.secretKey, 'base64'), input.path.concat(), input.size)
    }
    return input
  }
  return {
    async encryptBlob (encodable: IEncodable): Promise<{ blob: IEncryptedBlob, encrypted: Uint8Array }> {
      const secretKey = await crypto.createSecretKey()
      const path = await pathForSecretKey(crypto, secretKey)
      const encrypted = await crypto.encrypt(secretKey, encodable)
      return {
        blob: newBlob(secretKey, path, encrypted.length),
        encrypted
      }
    },
    async decryptBlob (secretKey: Uint8Array, encrypted: Uint8Array): Promise<IEncodable> {
      return await crypto.decrypt(secretKey, encrypted)
    },
    isEncryptedBlob,
    toEncryptedBlob
  }
}
