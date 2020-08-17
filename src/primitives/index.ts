import { ICryptoCore, IDecryption, IEncryptedMessage } from '../core/types'
import {
  IAnnonymous, IAnnonymousOptions, IAnnonymousJSON,
  IReceiver, IReceiverOptions,
  ISender, ISenderOptions,
  ICryptoPrimitives,
  IConnectionOptions,
  IConnectionJSON,
  ISenderJSON,
  IReceiverJSON
} from '../types'
import { Buffer, IEncodable, ITimeoutOptions } from '../util/types'
import { bufferToString, bufferCompare, toBuffer, wrapTimeout, bubbleAbort } from '../util'

const VERIFY_KEY_SIZE = 32
const VERIFY_KEY_START = 0
const VERIFY_KEY_END = VERIFY_KEY_SIZE
const SIGN_KEY_SIZE = 64
const SIGN_KEY_START = VERIFY_KEY_END
const SIGN_KEY_END = SIGN_KEY_START + SIGN_KEY_SIZE
const ENCRYPT_KEY_SIZE = 32
const ENCRYPT_KEY_START = SIGN_KEY_END
const ENCRYPT_KEY_END = ENCRYPT_KEY_START + ENCRYPT_KEY_SIZE
const DECRYPT_KEY_START = ENCRYPT_KEY_END

function signKeyFromSendKey (receiveKey: Uint8Array): Uint8Array {
  return receiveKey.slice(SIGN_KEY_START, SIGN_KEY_END)
}

function encryptKeyFromSendKey (sendKey: Uint8Array): Uint8Array {
  return sendKey.slice(ENCRYPT_KEY_START, ENCRYPT_KEY_END)
}

function decryptKeyFromReceiveKey (receiveKey: Uint8Array): Uint8Array {
  return receiveKey.slice(DECRYPT_KEY_START)
}

function verifyKeyFromSendKey (sendKey: Uint8Array): Uint8Array {
  return sendKey.slice(VERIFY_KEY_START, VERIFY_KEY_END)
}

function sendKeyFromReceiveKey (receiveKey: Uint8Array): Uint8Array {
  return receiveKey.slice(VERIFY_KEY_START, ENCRYPT_KEY_END)
}

export function setupPrimitives (crypto: ICryptoCore): ICryptoPrimitives {
  class Annonymous implements IAnnonymous {
    id: Uint8Array
    idBase64: string
    _idHex?: string

    constructor ({ id }: IAnnonymousOptions) {
      if (typeof id === 'string') {
        this.idBase64 = id
        this.id = Buffer.from(id, 'base64')
      } else {
        this.idBase64 = bufferToString(id, 'base64')
        this.id = id
      }
    }

    get idHex (): string {
      if (this._idHex === undefined) {
        this._idHex = bufferToString(this.id, 'hex')
      }
      return this._idHex
    }

    equals (other: IAnnonymous | ISender | IReceiver): boolean {
      return this.compare(other) === 0
    }

    compare (other: IAnnonymous | ISender | IReceiver): number {
      if (isSender(other) || isReceiver(other)) {
        return 1
      }
      return bufferCompare(other.id, this.id)
    }

    toJSON (): IAnnonymousJSON {
      return {
        id: this.idBase64
      }
    }

    toString (): string {
      return `Annonymous[id=${this.idBase64}]`
    }

    async verify (signature: Uint8Array, body: Uint8Array): Promise<boolean> {
      return await crypto.verify(this.id, signature, body)
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async verifyMessage (message: IEncryptedMessage): Promise<boolean> {
      return await this.verify(message.signature, message.body)
    }
  }

  class Sender implements ISender {
    sendKey: Uint8Array
    _sendKeyBase64: string
    receiveKeyBase64: any
    _annonymous: IAnnonymous
    _signKey: Uint8Array
    _encryptKey: Uint8Array

    constructor ({ id, sendKey }: ISenderOptions) {
      this.sendKey = toBuffer(sendKey)
      if (id !== undefined) {
        this._annonymous = new Annonymous({ id })
      }
    }

    get signKey (): Uint8Array {
      if (this._signKey === undefined) {
        this._signKey = signKeyFromSendKey(this.sendKey)
      }
      return this._signKey
    }

    get encryptKey (): Uint8Array {
      if (this._encryptKey === undefined) {
        this._encryptKey = encryptKeyFromSendKey(this.sendKey)
      }
      return this._encryptKey
    }

    get sendKeyBase64 (): string {
      if (this._sendKeyBase64 === undefined) {
        this._sendKeyBase64 = bufferToString(this.sendKey, 'base64')
      }
      return this._sendKeyBase64
    }

    get sender (): this {
      return this
    }

    get id (): Uint8Array {
      return this.annonymous.id
    }

    get idHex (): string {
      return this.annonymous.idHex
    }

    get idBase64 (): string {
      return this.annonymous.idBase64
    }

    get annonymous (): IAnnonymous {
      if (this._annonymous === undefined) {
        this._annonymous = new Annonymous({ id: verifyKeyFromSendKey(this.sendKey) })
      }
      return this._annonymous
    }

    equals (other: IAnnonymous | ISender | IReceiver): boolean {
      return this.compare(other) === 0
    }

    compare (other: IAnnonymous | ISender | IReceiver): number {
      if (isReceiver(other)) {
        return 1
      }
      if (!isSender(other)) {
        return -1
      }
      return bufferCompare(other.sendKey, this.sendKey)
    }

    toJSON (): ISenderJSON {
      return { sendKey: this.sendKeyBase64 }
    }

    toString (): string {
      return `Sender[sendKey=${this.sendKeyBase64}]`
    }

    async sign (data: Uint8Array): Promise<Uint8Array> {
      return await crypto.sign(this.signKey, data)
    }

    async encrypt (message: IEncodable): Promise<IEncryptedMessage> {
      return await crypto.encryptMessage(this.signKey, this.encryptKey, message)
    }
  }

  class Receiver implements IReceiver {
    receiveKey: Uint8Array
    _receiveKeyBase64: string
    _sender: ISender
    _annonymous: IAnnonymous

    constructor ({ id, sendKey, receiveKey }: IReceiverOptions) {
      this.receiveKey = toBuffer(receiveKey)
      if (sendKey !== undefined) {
        this._sender = new Sender({ id, sendKey })
      }
    }

    get sender (): ISender {
      if (this._sender === undefined) {
        this._sender = new Sender({ sendKey: sendKeyFromReceiveKey(this.receiveKey) })
      }
      return this._sender
    }

    get id (): Uint8Array {
      return this.sender.id
    }

    get idHex (): string {
      return this.sender.idHex
    }

    get idBase64 (): string {
      return this.sender.idBase64
    }

    get receiver (): this {
      return this
    }

    get annonymous (): IAnnonymous {
      return this.sender.annonymous
    }

    get decryptKey (): Uint8Array {
      return decryptKeyFromReceiveKey(this.receiveKey)
    }

    get receiveKeyBase64 (): string {
      if (this._receiveKeyBase64 === undefined) {
        this._receiveKeyBase64 = bufferToString(this.receiveKey, 'base64')
      }
      return this._receiveKeyBase64
    }

    equals (other: IReceiver | ISender | IAnnonymous): boolean {
      return this.compare(other) === 0
    }

    compare (other: IReceiver | ISender | IAnnonymous): number {
      if (!isReceiver(other)) {
        return -1
      }
      return bufferCompare(other.receiveKey, this.receiveKey)
    }

    toJSON (): IReceiverJSON {
      return { receiveKey: this.receiveKeyBase64 }
    }

    toString (): string {
      return `Receiver[receiveKey=${this.receiveKeyBase64}]`
    }

    async decrypt (encrypted: IEncryptedMessage): Promise<IDecryption> {
      return await crypto.decryptMessage(
        this.annonymous.id,
        this.sender.encryptKey,
        this.decryptKey,
        encrypted
      )
    }
  }

  class Connection {
    receiver: IReceiver
    sender: ISender

    constructor (opts: IConnectionOptions) {
      this.receiver = (opts.receiver instanceof Receiver) ? opts.receiver : new Receiver(opts.receiver)
      this.sender = (opts.sender instanceof Sender) ? opts.sender : new Sender(opts.sender)
    }

    toJSON (): IConnectionJSON {
      return {
        receiver: this.receiver.toJSON(),
        sender: this.sender.toJSON()
      }
    }
  }
  return {
    async createReceiver (opts?: ITimeoutOptions): Promise<IReceiver> {
      return await wrapTimeout(async signal => {
        const [encrypt, sign] = await Promise.all([
          crypto.createEncryptionKeys(),
          crypto.createSignKeys()
        ])
        bubbleAbort(signal)
        const sendKey = Buffer.concat([sign.publicKey, sign.privateKey, encrypt.publicKey])
        const receiver = new Receiver({
          id: sign.publicKey,
          sendKey,
          receiveKey: Buffer.concat([sendKey, encrypt.privateKey])
        })
        return receiver
      }, opts)
    },
    Annonymous,
    Receiver,
    Sender,
    Connection
  }
}
