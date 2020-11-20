import { IVerifier, IReader, IReaderJSON, IEncryptedMessage, IReaderOptions, ISignVector, EDecryptionError } from '../types'
import { Verifier } from './Verifier'
import { encryptKeyFromSendOrReceiveKey, decryptKeyFromReceiveKey, verifyKeyFromSendOrReceiveKey } from './key'
import { bufferToString, exists, Inspectable, toBuffer } from '../util'
import { encryptMessage, decryptMessage } from './fn'
import { InspectOptions } from 'inspect-custom-symbol'
import prettyHash from 'pretty-hash'
import { decode } from '@msgpack/msgpack'
import { SignVector } from './SignVector'
import codecs, { Codec, CodecOption, InType, OutType } from '@consento/codecs'

function assertVectoredMessage (input: any): asserts input is [ body: Uint8Array, signature: Uint8Array ] {
  if (!Array.isArray(input)) {
    throw Object.assign(new Error('Message needs to be an array'), { code: EDecryptionError.invalidMessage })
  }
  if (input.length === 0) {
    throw Object.assign(new Error('The next structure needs to have a body.'), { code: EDecryptionError.missingBody })
  }
  if (input.length === 1) {
    throw Object.assign(new Error('The next structure needs to have a signature.'), { code: EDecryptionError.missingSignature })
  }
}

export class Reader <TCodec extends CodecOption = undefined> extends Inspectable implements IReader <Codec<TCodec, 'msgpack'>> {
  _receiveKey?: Uint8Array
  _receiveKeyBase64?: string
  _decryptKey?: Uint8Array
  _encryptKey?: Uint8Array
  _verifier?: IVerifier
  inVector?: ISignVector
  codec: Codec<TCodec, 'msgpack'>

  constructor ({ readerKey, inVector, codec }: IReaderOptions<TCodec>) {
    super()
    if (typeof readerKey === 'string') {
      this._receiveKeyBase64 = readerKey
    } else {
      this._receiveKey = readerKey
    }
    if (exists(inVector)) {
      this.inVector = new SignVector(inVector)
    }
    this.codec = codecs(codec, 'msgpack')
  }

  recodec <TCodec extends CodecOption = undefined> (codec: TCodec): IReader<Codec<TCodec, 'msgpack'>> {
    return new Reader({ readerKey: this.readerKey, inVector: this.inVector, codec })
  }

  get verifyKey (): Uint8Array {
    return this.verifier.verifyKey
  }

  get verifyKeyHex (): string {
    return this.verifier.verifyKeyHex
  }

  get verifyKeyBase64 (): string {
    return this.verifier.verifyKeyBase64
  }

  get encryptKey (): Uint8Array {
    if (this._encryptKey === undefined) {
      this._encryptKey = encryptKeyFromSendOrReceiveKey(this.readerKey)
    }
    return this._encryptKey
  }

  get verifier (): IVerifier {
    if (this._verifier === undefined) {
      this._verifier = new Verifier({ verifyKey: verifyKeyFromSendOrReceiveKey(this.readerKey) })
    }
    return this._verifier
  }

  get decryptKey (): Uint8Array {
    if (this._decryptKey === undefined) {
      this._decryptKey = decryptKeyFromReceiveKey(this.readerKey)
    }
    return this._decryptKey
  }

  get readerKey (): Uint8Array {
    if (this._receiveKey === undefined) {
      this._receiveKey = toBuffer(this._receiveKeyBase64 as unknown as string)
    }
    return this._receiveKey
  }

  get readerKeyBase64 (): string {
    if (this._receiveKeyBase64 === undefined) {
      this._receiveKeyBase64 = bufferToString(this._receiveKey as unknown as Uint8Array, 'base64')
    }
    return this._receiveKeyBase64
  }

  toJSON (): IReaderJSON<Codec<TCodec, 'msgpack'>> {
    return {
      readerKey: this.readerKeyBase64,
      inVector: this.inVector?.toJSON(),
      codec: this.codec.name
    }
  }

  _inspect (_: number, { stylize }: InspectOptions): string {
    const vector = this.inVector !== undefined ? `#${this.inVector.index}` : ''
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `Reader(${stylize(this.codec.name, 'special')}|${stylize(prettyHash(this.verifyKeyHex), 'string')}${vector})`
  }

  encryptOnly (message: InType<TCodec, 'msgpack'>): Uint8Array {
    return encryptMessage(this.encryptKey, this.codec.encode(message))
  }

  decrypt (encrypted: IEncryptedMessage | Uint8Array): any {
    return this.codec.decode(decryptMessage(
      this.verifier.verifyKey,
      this.encryptKey,
      this.decryptKey,
      encrypted
    ))
  }

  decryptNext (encrypted: IEncryptedMessage): OutType<TCodec, 'msgpack'> {
    if (this.inVector === undefined) {
      return this.decrypt(encrypted)
    }
    const decrypted = decryptMessage(
      this.verifier.verifyKey,
      this.encryptKey,
      this.decryptKey,
      encrypted
    )
    const raw = decode(decrypted)
    assertVectoredMessage(raw)
    const [body, signature] = raw
    this.inVector.verify(body, signature)
    return this.codec.decode(body)
  }
}
