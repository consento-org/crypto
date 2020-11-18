import { IVerifier, IReader, IReaderJSON, IEncryptedMessage, IReaderOptions } from '../types'
import { Verifier } from './Verifier'
import { encryptKeyFromSendOrReceiveKey, decryptKeyFromReceiveKey, verifyKeyFromSendOrReceiveKey } from './key'
import { bufferToString, Inspectable, toBuffer } from '../util'
import { encryptMessage, decryptMessage } from './fn'
import { InspectOptions } from 'inspect-custom-symbol'
import prettyHash from 'pretty-hash'

export class Reader extends Inspectable implements IReader {
  _receiveKey?: Uint8Array
  _receiveKeyBase64?: string
  _decryptKey?: Uint8Array
  _encryptKey?: Uint8Array
  _verifier?: IVerifier

  constructor ({ readerKey: receiveKey }: IReaderOptions) {
    super()
    if (typeof receiveKey === 'string') {
      this._receiveKeyBase64 = receiveKey
    } else {
      this._receiveKey = receiveKey
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
    return { readerKey: this.readerKeyBase64 }
  }

  _inspect (_: number, { stylize }: InspectOptions): string {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `Reader(${stylize(prettyHash(this.verifyKey), 'string')})`
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
}
