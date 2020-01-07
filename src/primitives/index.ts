import { ICryptoCore, IDecryption, IEncryptedMessage } from '../core/types'
import {
  IAnnonymous, IAnnonymousOptions, IAnnonymousJSON, annonymousFlag,
  IReceiver, IReceiverOptions, IReceiverJSON, receiverFlag,
  ISender, ISenderOptions, ISenderJSON, senderFlag,
  ICryptoPrimitives,
  IConnectionOptions,
  IConnectionJSON
} from '../types'

import { ICancelable, cancelable } from '../util/cancelable'
import { Buffer, bufferToString, bufferCompare, toBuffer, IStringOrBuffer, IEncodable } from '../util/buffer'

export function setupPrimitives (crypto: ICryptoCore): ICryptoPrimitives {
  class Annonymous implements IAnnonymous {
    [annonymousFlag]: true
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
      this[annonymousFlag] = true
    }

    get idHex (): string {
      if (this._idHex === undefined) {
        this._idHex = bufferToString(this.id, 'hex')
      }
      return this._idHex
    }

    equals (other: IAnnonymous): boolean {
      return this.compare(other) === 0
    }

    compare (other: IAnnonymous, force: boolean = false): number {
      if (!(other instanceof Annonymous)) {
        return 1
      }
      if (force) {
        return bufferCompare(other.id, this.id)
      }
      return other.compare(this, true)
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
      return crypto.verify(this.id, signature, body)
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async verifyMessage (message: IEncryptedMessage): Promise<boolean> {
      return this.verify(message.signature, message.body)
    }
  }

  class Receiver extends Annonymous implements IReceiver {
    [receiverFlag]: true
    receiveKey: Uint8Array
    signKey: Promise<Uint8Array>
    _receiveKeyBase64: string

    constructor (opts: IReceiverOptions) {
      super({ id: opts.id })
      this[receiverFlag] = true
      this.receiveKey = toBuffer(opts.receiveKey)
      this.signKey = crypto.deriveAnnonymousKeys(this.receiveKey).then(keys => keys.write)
    }

    get receiveKeyBase64 (): string {
      if (this._receiveKeyBase64 === undefined) {
        this._receiveKeyBase64 = bufferToString(this.receiveKey, 'base64')
      }
      return this._receiveKeyBase64
    }

    compare (other: IAnnonymous, force: boolean = false): number {
      if (!(other instanceof Receiver)) {
        return (force ? -1 : 1)
      }
      if (force) {
        return bufferCompare(other.receiveKey, this.receiveKey)
      }
      return other.compare(this, true)
    }

    toJSON (): IReceiverJSON {
      return {
        id: this.idBase64,
        receiveKey: this.receiveKeyBase64
      }
    }

    toString (): string {
      return `Receiver[receiveKey=${this.receiveKeyBase64}]`
    }

    async sign (data: Uint8Array): Promise<Uint8Array> {
      return crypto.sign(await this.signKey, data)
    }

    // eslint-disable-next-line @typescript-eslint/promise-function-async
    decrypt (encrypted: IEncryptedMessage): ICancelable<IDecryption> {
      return cancelable<IDecryption, Receiver>(function * () {
        return yield crypto.decryptMessage(
          this.id,
          yield this.signKey,
          this.receiveKey,
          encrypted
        )
      }, this)
    }
  }

  class Sender extends Receiver implements ISender {
    [senderFlag]: true
    sendKey: Uint8Array
    _sendKeyBase64: string
    receiveKeyBase64: any

    constructor ({ id, sendKey, receiveKey }: ISenderOptions) {
      super({ id, receiveKey })
      this[senderFlag] = true
      this.sendKey = toBuffer(sendKey)
    }

    get sendKeyBase64 (): string {
      if (this._sendKeyBase64 === undefined) {
        this._sendKeyBase64 = bufferToString(this.sendKey, 'base64')
      }
      return this._sendKeyBase64
    }

    compare (other: any, force: boolean = false): number {
      if (!(other instanceof Sender)) {
        return (force ? -1 : 1)
      }
      if (force) {
        return bufferCompare(other.sendKey, this.sendKey)
      }
      return other.compare(this, true)
    }

    toJSON (): ISenderJSON {
      return {
        id: this.idBase64,
        sendKey: this.sendKeyBase64,
        receiveKey: this.receiveKeyBase64
      }
    }

    toString (): string {
      return `Sender[sendKey=${this.sendKeyBase64}]`
    }

    // eslint-disable-next-line @typescript-eslint/promise-function-async
    encrypt (message: IEncodable): ICancelable<IEncryptedMessage> {
      return cancelable<IEncryptedMessage, Sender>(function * () {
        return yield crypto.encryptMessage(
          this.id,
          yield this.signKey,
          this.sendKey,
          message
        )
      }, this)
    }
  }

  class Connection {
    receiver: IReceiver
    sender: ISender

    constructor (opts: IConnectionOptions) {
      this.receiver = new Receiver(opts.receiver)
      this.sender = new Sender(opts.sender)
    }

    toJSON (): IConnectionJSON {
      return {
        receiver: this.receiver.toJSON(),
        sender: this.sender.toJSON()
      }
    }
  }
  return {
    async createReceiverFromReceiveKey (receiveKey: IStringOrBuffer): Promise<IReceiver> {
      const syncReceiveKey = toBuffer(receiveKey)
      const { read: id } = await crypto.deriveAnnonymousKeys(syncReceiveKey)
      return new Receiver({ receiveKey: syncReceiveKey, id })
    },
    async createSenderFromSendKey (sendKey: IStringOrBuffer): Promise<ISender> {
      const sendKeySync = toBuffer(sendKey)
      const receiveKey = await crypto.deriveReadKey(sendKeySync)
      const { read: id, write: signKey } = await crypto.deriveAnnonymousKeys(receiveKey)
      return new Sender({ id, signKey: Promise.resolve(signKey), receiveKey, sendKey: sendKeySync })
    },
    async createSender (): Promise<ISender> {
      const { read: receiveKey, write: sendKey } = await crypto.createKeys()
      const { read: id, write: signKey } = await crypto.deriveAnnonymousKeys(receiveKey)
      return new Sender({ id, signKey: Promise.resolve(signKey), receiveKey, sendKey })
    },
    toReceiver (input: ISender): IReceiver {
      return new Receiver(input)
    },
    toAnnonymous (input: ISender | IReceiver): IAnnonymous {
      return new Annonymous(input)
    },
    Annonymous,
    Receiver,
    Sender,
    Connection
  }
}
