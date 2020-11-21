import { IEncryptedBlob, IEncryptedBlobJSON, IEncryptedBlobOptions } from '../types'
import { bufferToString, isStringOrBuffer } from '../util/buffer'
import { Buffer } from '../util/types'
import { encrypt, decrypt, createSecret } from '../util/secretbox'
import * as sodium from 'sodium-universal'
import codecs, { Codec, CodecName, CodecOption, InType, OutType, SupportedCodec } from '@consento/codecs'
import { exists, Inspectable } from '../util'
import { InspectOptions } from 'inspect-custom-symbol'
import prettyHash from 'pretty-hash'

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

export function isEncryptedBlob (input: any): input is IEncryptedBlob<any> {
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

export function isEncryptedBlobOfCodec <TCodec extends CodecOption> (input: any, codec: TCodec): input is IEncryptedBlob<Codec<TCodec>> {
  if (!isEncryptedBlob(input)) {
    return false
  }
  return codecs(codec).name === input.codec
}

export function isEncryptedBlobJSON (input: IEncryptedBlobJSON<string> | IEncryptedBlob<any>): input is IEncryptedBlobJSON<string> {
  return typeof input.secretKey === 'string'
}

export function isEncryptedBlobJSONOfCodec <TCodec extends CodecOption> (input: IEncryptedBlobJSON<string> | IEncryptedBlob<Codec<CodecOption>>, codec: TCodec): input is IEncryptedBlobJSON<CodecName<TCodec>> {
  return typeof input.secretKey === 'string' && codecs(codec).name === input.codec
}

export class EncryptedBlob <TCodec extends CodecOption = undefined> extends Inspectable implements IEncryptedBlob<Codec<TCodec, 'binary'>> {
  _secretKey?: Uint8Array
  _secretKeyHex?: string
  _locationKey?: Uint8Array
  _locationKeyBase32?: string
  codec: Codec<TCodec, 'binary'>
  size?: number | undefined
  _path?: string[]

  constructor ({ secretKey, codec, size }: IEncryptedBlobOptions<TCodec>) {
    super()
    if (typeof secretKey === 'string') {
      this._secretKeyHex = secretKey
    } else {
      this._secretKey = secretKey
    }
    this.codec = codecs(codec, 'binary')
    this.size = size
  }

  get secretKey (): Uint8Array {
    if (this._secretKey === undefined) {
      this._secretKey = Buffer.from(this._secretKeyHex as unknown as string, 'hex')
    }
    return this._secretKey
  }

  get secretKeyHex (): string {
    if (this._secretKeyHex === undefined) {
      this._secretKeyHex = bufferToString(this._secretKey as unknown as Uint8Array, 'hex')
    }
    return this._secretKeyHex
  }

  get locationKey (): Uint8Array {
    if (this._locationKey === undefined) {
      this._locationKey = deriveKdfKey(this.secretKey).slice(0, 10)
    }
    return this._locationKey
  }

  get locationKeyBase32 (): string {
    if (this._locationKeyBase32 === undefined) {
      this._locationKeyBase32 = codecs['base32-c'].decode(this.locationKey).toLowerCase()
    }
    return this._locationKeyBase32
  }

  get path (): string[] {
    if (this._path === undefined) {
      this._path = this.locationKeyBase32.split(/(.{4})/).filter(Boolean)
    }
    return this._path
  }

  decrypt (encrypted: Uint8Array): OutType<CodecOption, 'binary'> {
    return this.codec.decode(decrypt(this.secretKey, encrypted))
  }

  toJSON (): IEncryptedBlobJSON<CodecName<TCodec>> {
    const result: IEncryptedBlobJSON<CodecName<TCodec>> = {
      secretKey: this.secretKeyHex
    }
    if (exists(this.size)) {
      result.size = this.size
    }
    if (this.codec !== codecs.binary) {
      result.codec = this.codec.name
    }
    return result
  }

  _inspect (_: number, { stylize }: InspectOptions): string {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    const size = typeof this.size === 'number' ? `,${stylize(this.size, 'number')}` : ''
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `EncryptedBlob(${stylize(this.codec.name)}|${stylize(prettyHash(this.locationKeyBase32), 'string')}${size})`
  }
}

export function toEncryptedBlob (input: string | Uint8Array): IEncryptedBlob<typeof codecs.msgpack>
export function toEncryptedBlob <TCodec extends CodecOption> (input: string | Uint8Array, codec: TCodec): IEncryptedBlob<Codec<TCodec>>
export function toEncryptedBlob <TBlob extends IEncryptedBlob<any>> (input: TBlob): TBlob
export function toEncryptedBlob <TCodec extends SupportedCodec> (input: IEncryptedBlobJSON<TCodec>): IEncryptedBlob<typeof codecs[TCodec]>
export function toEncryptedBlob (input: string | Uint8Array | IEncryptedBlob<any> | IEncryptedBlobJSON<SupportedCodec>, codec?: CodecOption): IEncryptedBlob<any> {
  if (isStringOrBuffer(input)) {
    return new EncryptedBlob({ secretKey: input, codec })
  }
  if (isEncryptedBlobJSON(input)) {
    return new EncryptedBlob(input as IEncryptedBlobJSON<any>)
  }
  return input
}

export function encryptBlob <TCodec extends CodecOption=undefined> (encodable: InType<CodecOption, 'binary'>, codec?: TCodec): {
  blob: IEncryptedBlob<Codec<TCodec, 'binary'>>
  encrypted: Uint8Array
} {
  const secretKey = createSecret()
  const codecObj = codecs(codec, 'binary')
  const encrypted = encrypt(secretKey, codecObj.encode(encodable))
  return {
    blob: new EncryptedBlob<TCodec>({ secretKey, codec: codec as TCodec, size: encrypted.byteLength }),
    encrypted
  }
}
