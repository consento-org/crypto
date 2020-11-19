import { IVerifier, IWriter, IWriterJSON, IEncryptedMessage, IWriterOptions, ISignVector } from '../types'
import { Verifier } from './Verifier'
import { encryptKeyFromSendOrReceiveKey, signKeyFromSendKey, verifyKeyFromSendOrReceiveKey } from './key'
import { bufferToString, toBuffer, Inspectable, exists } from '../util'
import { encryptMessage, sign } from './fn'
import { InspectOptions } from 'inspect-custom-symbol'
import prettyHash from 'pretty-hash'
import { SignVector } from './SignVector'
import { encode } from '@msgpack/msgpack'

export class Writer extends Inspectable implements IWriter {
  _writerKey?: Uint8Array
  _writerKeyBase64?: string
  _annonymous?: IVerifier
  _signKey?: Uint8Array
  _encryptKey?: Uint8Array
  outVector?: ISignVector

  constructor ({ writerKey, outVector }: IWriterOptions) {
    super()
    if (typeof writerKey === 'string') {
      this._writerKeyBase64 = writerKey
    } else {
      this._writerKey = writerKey
    }
    if (exists(outVector)) {
      this.outVector = new SignVector(outVector)
    }
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

  toJSON (): IWriterJSON {
    return {
      writerKey: this.writerKeyBase64,
      outVector: this.outVector?.toJSON()
    }
  }

  _inspect (_: number, { stylize }: InspectOptions): string {
    const vector = this.outVector !== undefined ? `#${this.outVector.index}` : ''
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `Writer(${stylize(prettyHash(this.verifyKey), 'string')}${vector})`
  }

  sign (data: Uint8Array): Uint8Array {
    return sign(this.signKey, data)
  }

  encryptOnly (message: any): Uint8Array {
    return encryptMessage(this.encryptKey, message)
  }

  encrypt (message: any): IEncryptedMessage {
    const body = encryptMessage(this.encryptKey, message)
    return {
      signature: sign(this.signKey, body),
      body
    }
  }

  encryptNext (message: any): IEncryptedMessage {
    const body = this.encryptOnlyNext(message)
    return {
      signature: this.sign(body),
      body
    }
  }

  encryptOnlyNext (message: any): Uint8Array {
    if (this.outVector === undefined) {
      return this.encryptOnly(message)
    }
    const body = encode(message)
    return this.encryptOnly(encode([
      body,
      this.outVector.sign(body)
    ]))
  }
}
