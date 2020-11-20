import { IVerifier, IWriter, IWriterJSON, IEncryptedMessage, IWriterOptions, ISignVector } from '../types'
import { Verifier } from './Verifier'
import { encryptKeyFromSendOrReceiveKey, signKeyFromSendKey, verifyKeyFromSendOrReceiveKey } from './key'
import { bufferToString, toBuffer, Inspectable, exists } from '../util'
import { encryptMessage, sign } from './fn'
import { InspectOptions } from 'inspect-custom-symbol'
import prettyHash from 'pretty-hash'
import { SignVector } from './SignVector'
import codecs, { Codec, CodecOption, InType } from '@consento/codecs'
import { signVectorCodec } from '../util/signVectorCodec'

export class Writer <TCodec extends CodecOption = undefined> extends Inspectable implements IWriter<Codec<TCodec, 'msgpack'>> {
  _writerKey?: Uint8Array
  _writerKeyBase64?: string
  _annonymous?: IVerifier
  _signKey?: Uint8Array
  _encryptKey?: Uint8Array
  outVector?: ISignVector
  codec: Codec<TCodec, 'msgpack'>

  constructor ({ writerKey, outVector, codec }: IWriterOptions<TCodec>) {
    super()
    if (typeof writerKey === 'string') {
      this._writerKeyBase64 = writerKey
    } else {
      this._writerKey = writerKey
    }
    if (exists(outVector)) {
      this.outVector = new SignVector(outVector)
    }
    this.codec = codecs(codec, 'msgpack')
  }

  recodec <TCodec extends CodecOption = undefined> (codec: TCodec): IWriter<Codec<TCodec, 'msgpack'>> {
    return new Writer({ writerKey: this.writerKey, outVector: this.outVector, codec })
  }

  get signKey (): Uint8Array {
    if (this._signKey === undefined) {
      this._signKey = signKeyFromSendKey(this.writerKey)
    }
    return this._signKey
  }

  get encryptKey (): Uint8Array {
    if (this._encryptKey === undefined) {
      this._encryptKey = encryptKeyFromSendOrReceiveKey(this.writerKey)
    }
    return this._encryptKey
  }

  get writerKey (): Uint8Array {
    if (this._writerKey === undefined) {
      this._writerKey = toBuffer(this._writerKeyBase64 as unknown as string)
    }
    return this._writerKey
  }

  get writerKeyBase64 (): string {
    if (this._writerKeyBase64 === undefined) {
      this._writerKeyBase64 = bufferToString(this._writerKey as unknown as Uint8Array, 'base64')
    }
    return this._writerKeyBase64
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

  get verifier (): IVerifier {
    if (this._annonymous === undefined) {
      this._annonymous = new Verifier({ verifyKey: verifyKeyFromSendOrReceiveKey(this.writerKey) })
    }
    return this._annonymous
  }

  toJSON (): IWriterJSON<Codec<TCodec, 'msgpack'>> {
    return {
      writerKey: this.writerKeyBase64,
      outVector: this.outVector?.toJSON(),
      codec: this.codec.name
    }
  }

  _inspect (_: number, { stylize }: InspectOptions): string {
    const vector = this.outVector !== undefined ? `#${this.outVector.index}` : ''
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `Writer(${stylize(this.codec.name, 'special')}|${stylize(prettyHash(this.verifyKeyHex), 'string')}${vector})`
  }

  sign (data: Uint8Array): Uint8Array {
    return sign(this.signKey, data)
  }

  encryptOnly (message: InType<TCodec, 'msgpack'>): Uint8Array {
    return encryptMessage(this.encryptKey, this.codec.encode(message))
  }

  encrypt (message: InType<TCodec, 'msgpack'>): IEncryptedMessage {
    const body = encryptMessage(this.encryptKey, this.codec.encode(message))
    return {
      signature: sign(this.signKey, body),
      body
    }
  }

  encryptNext (message: InType<TCodec, 'msgpack'>): IEncryptedMessage {
    const body = this.encryptOnlyNext(message)
    return {
      signature: this.sign(body),
      body
    }
  }

  encryptOnlyNext (message: InType<TCodec, 'msgpack'>): Uint8Array {
    if (this.outVector === undefined) {
      return this.encryptOnly(message)
    }
    const body = encryptMessage(this.encryptKey, this.codec.encode(message))
    return signVectorCodec.encode({
      body,
      signature: this.outVector.sign(body)
    })
  }
}
