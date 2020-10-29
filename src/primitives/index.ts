import { ICryptoCore, IDecryption, IEncryptedMessage } from '../core/types'
import {
  IAnnonymous, IAnnonymousOptions, IAnnonymousJSON,
  IReceiver, IReceiverOptions,
  ISender, ISenderOptions,
  ICryptoPrimitives,
  IConnectionOptions,
  IConnection,
  ISenderJSON,
  IReceiverJSON,
  IChannel,
  IChannelJSON,
  IConnectionJSON,
  IChannelOptions
} from '../types'
import { Buffer, IEncodable, ITimeoutOptions } from '../util/types'
import { bufferToString, toBuffer, wrapTimeout, bubbleAbort, bufferEquals } from '../util'

// Structure of keys:
//
// RECEIVE_KEY = [ENCRYPT_KEY][VERIFY_KEY][DECRYPT_KEY]
// SEND_KEY = [ENCRYPT_KEY][VERIFY_KEY][SIGN_KEY]

const ENCRYPT_KEY_SIZE = 32
const ENCRYPT_KEY_START = 0
const ENCRYPT_KEY_END = ENCRYPT_KEY_START + ENCRYPT_KEY_SIZE

const VERIFY_KEY_SIZE = 32
const VERIFY_KEY_START = ENCRYPT_KEY_END
const VERIFY_KEY_END = VERIFY_KEY_START + VERIFY_KEY_SIZE

const DECRYPT_KEY_SIZE = 32
const DECRYPT_KEY_START = VERIFY_KEY_END
const DECRYPT_KEY_END = DECRYPT_KEY_START + DECRYPT_KEY_SIZE

const SIGN_KEY_SIZE = 64
const SIGN_KEY_START = VERIFY_KEY_END
const SIGN_KEY_END = SIGN_KEY_START + SIGN_KEY_SIZE

function encryptKeyFromSendOrReceiveKey (sendOrReceiveKey: Uint8Array): Uint8Array {
  return sendOrReceiveKey.slice(ENCRYPT_KEY_START, ENCRYPT_KEY_END)
}

function verifyKeyFromSendOrReceiveKey (sendOrReceiveKey: Uint8Array): Uint8Array {
  return sendOrReceiveKey.slice(VERIFY_KEY_START, VERIFY_KEY_END)
}

function decryptKeyFromReceiveKey (receiveKey: Uint8Array): Uint8Array {
  return receiveKey.slice(DECRYPT_KEY_START, DECRYPT_KEY_END)
}

function signKeyFromSendKey (sendKey: Uint8Array): Uint8Array {
  return sendKey.slice(SIGN_KEY_START, SIGN_KEY_END)
}

export function setupPrimitives (crypto: ICryptoCore): ICryptoPrimitives {
  class Annonymous implements IAnnonymous {
    _id?: Uint8Array
    _idBase64?: string
    _idHex?: string

    constructor ({ id }: IAnnonymousOptions) {
      if (typeof id === 'string') {
        this._idBase64 = id
      } else {
        this._id = id
      }
    }

    get id (): Uint8Array {
      if (this._id === undefined) {
        this._id = toBuffer(this._idBase64 as unknown as string)
      }
      return this._id
    }

    get idBase64 (): string {
      if (this._idBase64 === undefined) {
        this._idBase64 = bufferToString(this._id as unknown as Uint8Array, 'base64')
      }
      return this._idBase64
    }

    get idHex (): string {
      if (this._idHex === undefined) {
        this._idHex = bufferToString(this.id, 'hex')
      }
      return this._idHex
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
    _sendKey?: Uint8Array
    _sendKeyBase64?: string
    _annonymous?: IAnnonymous
    _signKey?: Uint8Array
    _encryptKey?: Uint8Array

    constructor ({ sendKey }: ISenderOptions) {
      if (typeof sendKey === 'string') {
        this._sendKeyBase64 = sendKey
      } else {
        this._sendKey = sendKey
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
        this._encryptKey = encryptKeyFromSendOrReceiveKey(this.sendKey)
      }
      return this._encryptKey
    }

    get sendKey (): Uint8Array {
      if (this._sendKey === undefined) {
        this._sendKey = toBuffer(this._sendKeyBase64 as unknown as string)
      }
      return this._sendKey
    }

    get sendKeyBase64 (): string {
      if (this._sendKeyBase64 === undefined) {
        this._sendKeyBase64 = bufferToString(this._sendKey as unknown as Uint8Array, 'base64')
      }
      return this._sendKeyBase64
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
        this._annonymous = new Annonymous({ id: verifyKeyFromSendOrReceiveKey(this.sendKey) })
      }
      return this._annonymous
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

    async encryptOnly (message: IEncodable): Promise<Uint8Array> {
      return await crypto.encryptMessage(this.encryptKey, message)
    }

    async encrypt (message: IEncodable): Promise<IEncryptedMessage> {
      return await crypto.encryptAndSignMessage(this.signKey, this.encryptKey, message)
    }
  }

  class Receiver implements IReceiver {
    _receiveKey?: Uint8Array
    _receiveKeyBase64?: string
    _decryptKey?: Uint8Array
    _encryptKey?: Uint8Array
    _annonymous?: IAnnonymous

    constructor ({ receiveKey }: IReceiverOptions) {
      if (typeof receiveKey === 'string') {
        this._receiveKeyBase64 = receiveKey
      } else {
        this._receiveKey = receiveKey
      }
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

    get encryptKey (): Uint8Array {
      if (this._encryptKey === undefined) {
        this._encryptKey = encryptKeyFromSendOrReceiveKey(this.receiveKey)
      }
      return this._encryptKey
    }

    get annonymous (): IAnnonymous {
      if (this._annonymous === undefined) {
        this._annonymous = new Annonymous({ id: verifyKeyFromSendOrReceiveKey(this.receiveKey) })
      }
      return this._annonymous
    }

    get decryptKey (): Uint8Array {
      if (this._decryptKey === undefined) {
        this._decryptKey = decryptKeyFromReceiveKey(this.receiveKey)
      }
      return this._decryptKey
    }

    get receiveKey (): Uint8Array {
      if (this._receiveKey === undefined) {
        this._receiveKey = toBuffer(this._receiveKeyBase64 as unknown as string)
      }
      return this._receiveKey
    }

    get receiveKeyBase64 (): string {
      if (this._receiveKeyBase64 === undefined) {
        this._receiveKeyBase64 = bufferToString(this._receiveKey as unknown as Uint8Array, 'base64')
      }
      return this._receiveKeyBase64
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
        this.encryptKey,
        this.decryptKey,
        encrypted
      )
    }
  }

  class Channel implements IChannel {
    receiver: IReceiver
    sender: ISender
    type: 'channel' = 'channel'

    constructor (opts: IChannelOptions) {
      this.receiver = (opts.receiver instanceof Receiver) ? opts.receiver : new Receiver(opts.receiver)
      this.sender = (opts.sender instanceof Sender) ? opts.sender : new Sender(opts.sender)
      if (opts.type !== undefined && opts.type as string !== 'channel') {
        throw new Error(`Can not restore a channel from a [${opts.type}]`)
      }
      if (!bufferEquals(this.receiver.id, this.sender.id)) {
        throw new Error('Can not create a channel with both the sender and the receiver have a different id! Did you mean to restore a connection?')
      }
    }

    get annonymous (): IAnnonymous {
      return this.receiver.annonymous
    }

    toJSON (): IChannelJSON {
      return {
        receiver: this.receiver.toJSON(),
        sender: this.sender.toJSON(),
        type: 'channel'
      }
    }
  }

  class Connection implements IConnection {
    receiver: IReceiver
    sender: ISender
    type: 'connection' = 'connection'

    constructor (opts: IConnectionOptions) {
      this.receiver = (opts.receiver instanceof Receiver) ? opts.receiver : new Receiver(opts.receiver)
      this.sender = (opts.sender instanceof Sender) ? opts.sender : new Sender(opts.sender)
      if (opts.type !== undefined && opts.type as string !== 'connection') {
        throw new Error(`Can not restore a connection from a [${opts.type}]`)
      }
      if (bufferEquals(this.receiver.id, this.sender.id)) {
        throw new Error('Can not create a connection with both the sender and the receiver have the same id! Did you mean to restore a channel?')
      }
    }

    toJSON (): IConnectionJSON {
      return {
        receiver: this.receiver.toJSON(),
        sender: this.sender.toJSON(),
        type: 'connection'
      }
    }
  }

  return {
    async createChannel (opts?: ITimeoutOptions): Promise<Channel> {
      return await wrapTimeout(async signal => {
        const [encrypt, sign] = await Promise.all([
          crypto.createEncryptionKeys(),
          crypto.createSignKeys()
        ])
        bubbleAbort(signal)
        return new Channel({
          receiver: { receiveKey: Buffer.concat([encrypt.publicKey, sign.publicKey, encrypt.privateKey]) },
          sender: { sendKey: Buffer.concat([encrypt.publicKey, sign.publicKey, sign.privateKey]) }
        })
      }, opts)
    },
    Annonymous,
    Receiver,
    Sender,
    Connection,
    Channel
  }
}
