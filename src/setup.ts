/* eslint no-undef: "off" */
// https://github.com/typescript-eslint/typescript-eslint/issues/131#issuecomment-483326781
import { bufferToString, bufferCompare, IEncodable, Buffer } from './util/buffer'
import { toPromise } from './util/toPromise'
import { IEncryptedMessage, ICryptoCore, IDecryption } from './core/types'
import { extPromise, IExtPromise } from './util/extPromise'
import {
  IConsentoCrypto,
  IAnnonymous,
  IAnnonymousOptions,
  ISender,
  ISenderOptions,
  IReceiver,
  IReceiverOptions,
  IHandshakeInit,
  IHandshakeAccept,
  IHandshakeDone,
  IHandshakeAcceptMessage,
  IHandshakeConfirmation
} from './types'

function processKey (any: Uint8Array | string): Uint8Array {
  if (typeof any === 'string') {
    return Buffer.from(any, 'base64')
  }
  return any
}

const HANDSHAKE_MSG_VERSION = Buffer.from([1])

function processHandshake (msg: Uint8Array): {
  token: Uint8Array
  sendKey: Uint8Array
} {
  if (msg[0] !== HANDSHAKE_MSG_VERSION[0]) {
    throw new Error('unknown-message-format')
  }
  if (msg.length !== 97) {
    throw new Error(`invalid-size[${msg.length}]`)
  }
  return {
    token: msg.slice(1, 33),
    sendKey: msg.slice(33)
  }
}

function create (crypto: ICryptoCore): IConsentoCrypto {
  class HandshakeInit implements IHandshakeInit {
    _from: IReceiver
    _initMessage: Promise<Uint8Array>
    _handshake: Promise<{
      read: Uint8Array
      write: Uint8Array
    }>

    constructor () {
      const tempChannel = Sender.create()
      this._from = tempChannel.newReceiver()
      this._handshake = crypto.initHandshake()
      this._initMessage = (async (): Promise<Uint8Array> => {
        const [sendKey, handshake] = await Promise.all([
          tempChannel.sendKey(),
          this._handshake
        ])
        return Buffer.concat([
          HANDSHAKE_MSG_VERSION,
          handshake.read,
          sendKey
        ])
      })()
    }

    get receiver (): IReceiver {
      return this._from
    }

    initMessage (): Promise<Uint8Array> {
      return this._initMessage
    }

    async confirm (accept: IHandshakeAcceptMessage): Promise<IHandshakeConfirmation> {
      const { write } = await this._handshake
      const secretKey = await crypto.computeSecret(write, Buffer.from(accept.token, 'base64'))
      const bob = Sender.create()
      const sendKey = await crypto.decrypt(secretKey, Buffer.from(accept.secret, 'base64'))
      if (!(sendKey instanceof Uint8Array)) {
        throw new Error('invalid-message')
      }
      if (!(sendKey instanceof Uint8Array)) {
        throw new Error('Expected buffer in decrypted message')
      }
      return {
        sender: new Sender({ sendKey }),
        receiver: bob.newReceiver(),
        finalMessage: await bob.sendKey()
      }
    }
  }

  class HandshakeAccept implements IHandshakeAccept {
    _to: ISender
    _from: IReceiver
    _acceptMessage: Promise<IHandshakeAcceptMessage>
    _finalReceiver: IReceiver

    constructor (message: Uint8Array) {
      const {
        token,
        sendKey
      } = processHandshake(message)
      this._to = new Sender({ sendKey })
      const sender = Sender.create()
      this._finalReceiver = sender.newReceiver()
      this._from = sender.newReceiver()
      this._acceptMessage = (async () => {
        const keys = await crypto.initHandshake()
        const secretKey = await crypto.computeSecret(keys.write, token)
        return {
          token: bufferToString(keys.read, 'base64'),
          secret: bufferToString(await crypto.encrypt(secretKey, await sender.sendKey()), 'base64')
        }
      })()
    }

    get receiver (): IReceiver {
      return this._finalReceiver
    }

    get sender (): ISender {
      return this._to
    }

    /* eslint @typescript-eslint/promise-function-async: "off" */
    acceptMessage (): Promise<IHandshakeAcceptMessage> {
      return this._acceptMessage
    }

    /* eslint @typescript-eslint/require-await: "off" */
    async finalize (message: Uint8Array): Promise<IHandshakeDone> {
      return {
        receiver: this._finalReceiver,
        sender: new Sender({ sendKey: message })
      }
    }
  }

  class Annonymous implements IAnnonymous {
    _init: Promise<void>
    _id?: Uint8Array
    _idBase64?: string
    _idHex?: string

    constructor (opts: IAnnonymousOptions | PromiseLike<IAnnonymousOptions>) {
      this._init = toPromise(opts).then(({ id }) => {
        if (typeof id === 'string') {
          this._idBase64 = id
          this._id = Buffer.from(id, 'base64')
        } else {
          this._idBase64 = bufferToString(id, 'base64')
          this._id = id
        }
        this._init = null
      }) as Promise<void>
    }

    async id (): Promise<Uint8Array> {
      if (this._init !== undefined) await this._init
      return this._id
    }

    async idBase64 (): Promise<string> {
      if (this._init !== undefined) await this._init
      return this._idBase64
    }

    async idHex (): Promise<string> {
      if (this._idHex === undefined) {
        this._idHex = bufferToString(await this.id(), 'hex')
      }
      return this._idHex
    }

    async equals (other: IAnnonymous): Promise<boolean> {
      return (await this.compare(other)) === 0
    }

    async compare (other: IAnnonymous, force: boolean = false): Promise<number> {
      if (!(other instanceof Annonymous)) {
        return 1
      }
      if (force) {
        return bufferCompare(await other.id(), await this.id())
      }
      return other.compare(this, true)
    }

    async smallJSON (): Promise<any> {
      return {
        id: await this.idBase64()
      }
    }

    quickJSON (): Promise<any> {
      return this.smallJSON()
    }

    async toString (): Promise<string> {
      return `Annonymous[id=${await this.idBase64()}]`
    }

    async verify (signature: Uint8Array, body: Uint8Array): Promise<boolean> {
      return crypto.verify(await this.id(), signature, body)
    }

    async verifyMessage (message: IEncryptedMessage): Promise<boolean> {
      return this.verify(message.signature, message.body)
    }
  }

  class Receiver extends Annonymous implements IReceiver {
    _receiveKey: IExtPromise<Uint8Array>
    _signKey: IExtPromise<Uint8Array>

    constructor (opts: IReceiverOptions | PromiseLike<IReceiverOptions>) {
      super(
        (async () => {
          const receiveKey = processKey((await toPromise(opts)).receiveKey)
          this._receiveKey._resolve(receiveKey)
          const derived = await crypto.deriveAnnonymousKeys(receiveKey)
          this._signKey._resolve(derived.write)
          return {
            id: derived.read
          }
        })()
      )
      this._receiveKey = extPromise<Uint8Array>()
      this._signKey = extPromise<Uint8Array>()
    }

    newAnnonymous (): Annonymous {
      return new Annonymous(this.id().then(id => ({ id })))
    }

    async compare (other: Annonymous, force: boolean = false): Promise<number> {
      if (!(other instanceof Receiver)) {
        return (force ? -1 : 1)
      }
      if (force) {
        return bufferCompare(await other.receiveKey(), await this._receiveKey)
      }
      return other.compare(this, true)
    }

    async smallJSON (): Promise<any> {
      return {
        receiveKey: bufferToString(await this._receiveKey, 'base64')
      }
    }

    quickJSON (): Promise<any> {
      return this.smallJSON()
    }

    async toString (): Promise<string> {
      return `Receiver[receiveKey=${bufferToString(await this._receiveKey, 'base64')}]`
    }

    receiveKey (): Promise<Uint8Array> {
      return this._receiveKey
    }

    async sign (data: Uint8Array): Promise<Uint8Array> {
      return crypto.sign(await this._signKey, data)
    }

    async decrypt (encrypted: IEncryptedMessage): Promise<IDecryption> {
      return crypto.decryptMessage(await this.id(), await this._signKey, await this._receiveKey, encrypted)
    }
  }

  class Sender extends Receiver implements ISender {
    _sendKey: IExtPromise<Uint8Array>

    static create (): ISender {
      return new Sender(
        crypto.createKeys()
          .then(keys => {
            return {
              sendKey: keys.write,
              receiveKey: keys.read
            }
          })
      )
    }

    constructor (opts: ISenderOptions | PromiseLike<ISenderOptions>) {
      super(
        (async () => {
          let { sendKey, receiveKey } = await toPromise(opts)
          sendKey = processKey(sendKey)
          this._sendKey._resolve(sendKey)
          return {
            receiveKey: receiveKey === null || receiveKey === undefined ? await crypto.deriveReadKey(processKey(sendKey)) : receiveKey
          }
        })()
      )
      this._sendKey = extPromise<Uint8Array>()
    }

    newReceiver (): IReceiver {
      return new Receiver(
        this._sendKey
          .then(async (sendKey: Uint8Array) => ({
            receiveKey: await crypto.deriveReadKey(sendKey)
          }))
      )
    }

    sendKey (): Promise<Uint8Array> {
      return this._sendKey
    }

    async compare (other: Annonymous, force: boolean = false): Promise<number> {
      if (!(other instanceof Sender)) {
        return (force ? -1 : 1)
      }
      if (force) {
        return bufferCompare(await other._sendKey, await this._sendKey)
      }
      return other.compare(this, true)
    }

    async smallJSON (): Promise<any> {
      return {
        sendKey: bufferToString(await this._sendKey, 'base64')
      }
    }

    async quickJSON (): Promise<any> {
      return {
        sendKey: bufferToString(await this._sendKey, 'base64'),
        receiveKey: bufferToString(await this._receiveKey, 'base64')
      }
    }

    async toString (): Promise<string> {
      return `Sender[sendKey=${bufferToString(await this._sendKey, 'base64')}]`
    }

    async encrypt (message: IEncodable): Promise<IEncryptedMessage> {
      return crypto.encryptMessage(await this.id(), await this._signKey, await this._sendKey, message)
    }
  }
  return {
    Sender,
    Receiver,
    Annonymous,
    HandshakeInit,
    HandshakeAccept
  }
}

const cache = new WeakMap<ICryptoCore, any>()

export function setup (crypto: ICryptoCore): IConsentoCrypto {
  if (cache.has(crypto)) {
    return cache.get(crypto)
  }
  const item = create(crypto)
  cache.set(crypto, item)
  return item
}
