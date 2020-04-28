/* eslint-disable @typescript-eslint/no-throw-literal */
// ↑ https://github.com/typescript-eslint/typescript-eslint/issues/1841
import { ICryptoCore } from '../core/types'
import { Buffer, toBuffer, bufferToString, IEncodable } from '../util/buffer'
import { ICryptoHandshake, IHandshakeInit, IReceiver, ICryptoPrimitives, IHandshakeInitOptions, IHandshakeAccept, ISender, IHandshakeAcceptMessage, IHandshakeAcceptOptions, IHandshakeConfirmation, IHandshakeAcceptJSON, IHandshakeConfirmationOptions, IHandshakeConfirmationJSON, IConnection, IHandshakeInitJSON } from '../types'
import { isReceiver } from '../util/isReceiver'
import { cancelable, ICancelable } from '../util/cancelable'

export const HANDSHAKE_MSG_VERSION = Buffer.from([1])

function processHandshake (msg: Uint8Array): {
  token: Uint8Array
  sendKey: Uint8Array
} {
  if (msg[0] !== HANDSHAKE_MSG_VERSION[0]) {
    throw Object.assign(new Error(`Error while processing handshake: Unknown handshake format: ${msg[0]}`), { code: 'unknown-message-format', messageFormat: msg[0] })
  }
  if (msg.length !== 161) {
    throw Object.assign(new Error(`Error while processing handshake: Invalid handshake size: ${msg.length}`), { code: 'invalid-size', size: msg.length })
  }
  return {
    token: msg.slice(1, 33),
    sendKey: msg.slice(33)
  }
}

export function setupHandshake (crypto: ICryptoCore, { createReceiver, Sender, Receiver, Connection }: ICryptoPrimitives): ICryptoHandshake {
  class HandshakeInit implements IHandshakeInit {
    receiver: IReceiver
    firstMessage: Uint8Array
    handshakeSecret: Uint8Array

    constructor ({ receiver, handshakeSecret, firstMessage }: IHandshakeInitOptions) {
      this.receiver = isReceiver(receiver) ? receiver : new Receiver(receiver)
      this.handshakeSecret = toBuffer(handshakeSecret)
      this.firstMessage = toBuffer(firstMessage)
    }

    toJSON (): IHandshakeInitJSON {
      return {
        receiver: this.receiver.toJSON(),
        firstMessage: bufferToString(this.firstMessage, 'base64'),
        handshakeSecret: bufferToString(this.handshakeSecret, 'base64')
      }
    }

    // eslint-disable-next-line @typescript-eslint/promise-function-async
    confirm (accept: IHandshakeAcceptMessage): ICancelable<IHandshakeConfirmation> {
      // eslint-disable-next-line @typescript-eslint/return-await
      return cancelable<IHandshakeConfirmation, HandshakeInit>(function * () {
        const secretKey = (yield crypto.computeSecret(this.handshakeSecret, Buffer.from(accept.token, 'base64'))) as Uint8Array
        const bob = (yield createReceiver()) as IReceiver
        const sendKey = (yield crypto.decrypt(secretKey, Buffer.from(accept.secret, 'base64'))) as IEncodable
        if (!(sendKey instanceof Uint8Array)) {
          throw Object.assign(new Error('Expected buffer in decrypted message'), { code: 'invalid-message' })
        }
        const aliceSender = (yield new Sender({ sendKey })) as ISender
        return yield new HandshakeConfirmation({
          connection: new Connection({
            sender: aliceSender,
            receiver: bob.receiver
          }),
          // In case you are wondering why we not just simply return "bob" as sender
          // but instead pass it in two messages: the reason is that without this step
          // the API is clearer.
          // TODO: rethink
          finalMessage: bob.sender.sendKey
        })
      }, this)
    }
  }

  class HandshakeAccept extends Connection implements IHandshakeAccept {
    acceptMessage: IHandshakeAcceptMessage

    constructor (ops: IHandshakeAcceptOptions) {
      super(ops)
      this.acceptMessage = ops.acceptMessage
    }

    toJSON (): IHandshakeAcceptJSON {
      return {
        ...super.toJSON(),
        acceptMessage: this.acceptMessage
      }
    }

    async finalize (message: Uint8Array): Promise<IConnection> {
      return new Connection({
        receiver: this.receiver,
        sender: new Sender({ sendKey: message })
      })
    }
  }

  class HandshakeConfirmation implements IHandshakeConfirmation {
    finalMessage: Uint8Array
    connection: IConnection

    constructor (opts: IHandshakeConfirmationOptions) {
      this.connection = new Connection(opts.connection)
      this.finalMessage = toBuffer(opts.finalMessage)
    }

    toJSON (): IHandshakeConfirmationJSON {
      return {
        connection: this.connection.toJSON(),
        finalMessage: bufferToString(this.finalMessage, 'base64')
      }
    }
  }

  return {
    async initHandshake (): Promise<HandshakeInit> {
      const { receiver, sender } = await createReceiver()
      const { privateKey: handshakeSecret, publicKey: handshakePublic } = await crypto.initHandshake()
      return new HandshakeInit({
        receiver,
        handshakeSecret,
        firstMessage: Buffer.concat([
          HANDSHAKE_MSG_VERSION,
          handshakePublic,
          sender.sendKey
        ])
      })
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    async acceptHandshake (firstMessage: Uint8Array): Promise<IHandshakeAccept> {
      const {
        token,
        sendKey
      } = processHandshake(firstMessage)
      const { privateKey: handshakeSecret, publicKey: handshakePublic } = await crypto.initHandshake()
      const secretKey = await crypto.computeSecret(handshakeSecret, token)
      const { receiver, sender } = await createReceiver()
      return new HandshakeAccept({
        sender: new Sender({ sendKey }),
        receiver,
        acceptMessage: {
          token: bufferToString(handshakePublic, 'base64'),
          secret: bufferToString(await crypto.encrypt(secretKey, sender.sendKey), 'base64')
        }
      })
    },
    HandshakeInit,
    HandshakeAccept,
    HandshakeConfirmation
  }
}
