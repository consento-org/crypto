import { IVerifier, IReader, IReaderJSON, IEncryptedMessage, IReaderOptions, ISignVector, EDecryptionError } from '../types'
import { Verifier } from './Verifier'
import { encryptKeyFromSendOrReceiveKey, decryptKeyFromReceiveKey, verifyKeyFromSendOrReceiveKey } from './key'
import { bufferToString, exists, Inspectable, toBuffer } from '../util'
import { encryptMessage, decryptMessage } from './fn'
import { InspectOptions } from 'inspect-custom-symbol'
import prettyHash from 'pretty-hash'
import { decode } from '@msgpack/msgpack'
import { SignVector } from './SignVector'

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

export class Reader extends Inspectable implements IReader {
  _receiveKey?: Uint8Array
  _receiveKeyBase64?: string
  _decryptKey?: Uint8Array
  _encryptKey?: Uint8Array
  _verifier?: IVerifier
  inVector?: ISignVector

  constructor ({ readerKey, inVector }: IReaderOptions) {
    super()
    if (typeof readerKey === 'string') {
      this._receiveKeyBase64 = readerKey
    } else {
      this._receiveKey = readerKey
    }
    if (exists(inVector)) {
      this.inVector = new SignVector(inVector)
    }
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

  toJSON (): IReaderJSON {
    return {
      readerKey: this.readerKeyBase64,
      inVector: this.inVector?.toJSON()
    }
  }

  _inspect (_: number, { stylize }: InspectOptions): string {
    const vector = this.inVector !== undefined ? `#${this.inVector.index}` : ''
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `Reader(${stylize(prettyHash(this.verifyKey), 'string')}${vector})`
  }

  encryptOnly (message: any): Uint8Array {
    return encryptMessage(this.encryptKey, message)
  }

  decrypt (encrypted: IEncryptedMessage): any {
    return decryptMessage(
      this.verifier.verifyKey,
      this.encryptKey,
      this.decryptKey,
      encrypted
    )
  }

  decryptNext (encrypted: IEncryptedMessage): any {
    if (this.inVector === undefined) {
      return this.decrypt(encrypted)
    }
    const raw = decode(this.decrypt(encrypted))
    assertVectoredMessage(raw)
    const [body, signature] = raw
    this.inVector.verify(body, signature)
    return decode(body)
  }
}
