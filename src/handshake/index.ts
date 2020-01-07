import { ICryptoCore } from '../core/types'
import { Buffer, toBuffer, bufferToString, IEncodable } from '../util/buffer'
import { ICryptoHandshake, IHandshakeInit, IReceiver, ICryptoPrimitives, IHandshakeInitOptions, IHandshakeAccept, ISender, IHandshakeAcceptMessage, IHandshakeAcceptOptions, IHandshakeConfirmation, IHandshakeAcceptJSON, IHandshakeConfirmationOptions, IHandshakeConfirmationJSON, IConnection } from '../types'
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
  if (msg.length !== 97) {
    throw Object.assign(new Error(`Error while processing handshake: Invalid handshake size: ${msg.length}`), { code: 'invalid-size', size: msg.length })
  }
  return {
    token: msg.slice(1, 33),
    sendKey: msg.slice(33)
  }
}

export function setupHandshake (crypto: ICryptoCore, { createSender, createSenderFromSendKey, toReceiver, Receiver, Sender, Connection }: ICryptoPrimitives): ICryptoHandshake {
  class HandshakeInit implements IHandshakeInit {
    receiver: IReceiver
    firstMessage: Uint8Array
    confirmKey: Uint8Array

    constructor ({ receiver, confirmKey, firstMessage }: IHandshakeInitOptions) {
      this.receiver = isReceiver(receiver) ? receiver : new Receiver(receiver)
      this.confirmKey = toBuffer(confirmKey)
      this.firstMessage = toBuffer(firstMessage)
    }

    toJSON (): any {
      return {
        receiver: this.receiver.toJSON(),
        firstMessage: bufferToString(this.firstMessage, 'base64'),
        confirmKey: bufferToString(this.confirmKey, 'base64')
      }
    }

    // eslint-disable-next-line @typescript-eslint/promise-function-async
    confirm (accept: IHandshakeAcceptMessage): ICancelable<IHandshakeConfirmation> {
      return cancelable<IHandshakeConfirmation, HandshakeInit>(function * () {
        const secretKey = (yield crypto.computeSecret(this.confirmKey, Buffer.from(accept.token, 'base64'))) as Uint8Array
        const bob = (yield createSender()) as ISender
        const sendKey = (yield crypto.decrypt(secretKey, Buffer.from(accept.secret, 'base64'))) as IEncodable
        if (!(sendKey instanceof Uint8Array)) {
          throw Object.assign(new Error('Expected buffer in decrypted message'), { code: 'invalid-message' })
        }
        const sender = (yield createSenderFromSendKey(sendKey)) as ISender
        return yield new HandshakeConfirmation({
          connection: new Connection({
            sender,
            receiver: toReceiver(bob)
          }),
          // In case you are wondering why we not just simply return "bob" as sender
          // but instead pass it in two messages: the reason is that without this step
          finalMessage: bob.sendKey
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
        sender: await createSenderFromSendKey(message)
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
      const tempChannel = await createSender()
      const receiver = toReceiver(tempChannel)
      const { write: confirmKey, read: receiveKey } = await crypto.initHandshake()
      return new HandshakeInit({
        receiver,
        confirmKey,
        firstMessage: Buffer.concat([
          HANDSHAKE_MSG_VERSION,
          receiveKey,
          tempChannel.sendKey
        ])
      })
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    async acceptHandshake (firstMessage: Uint8Array): Promise<IHandshakeAccept> {
      const {
        token,
        sendKey
      } = processHandshake(firstMessage)
      const keys = await crypto.initHandshake()
      const secretKey = await crypto.computeSecret(keys.write, token)
      const sender = await createSender()
      return new HandshakeAccept({
        sender: await createSenderFromSendKey(sendKey),
        receiver: toReceiver(sender),
        acceptMessage: {
          token: bufferToString(keys.read, 'base64'),
          secret: bufferToString(await crypto.encrypt(secretKey, sender.sendKey), 'base64')
        }
      })
    },
    HandshakeInit,
    HandshakeAccept,
    HandshakeConfirmation
  }
}
