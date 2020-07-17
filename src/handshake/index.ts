/* eslint-disable @typescript-eslint/no-throw-literal */
// ↑ https://github.com/typescript-eslint/typescript-eslint/issues/1841
import { ICryptoCore } from '../core/types'
import { Buffer, toBuffer, bufferToString } from '../util/buffer'
import { ICryptoHandshake, IHandshakeInit, IReceiver, ICryptoPrimitives, IHandshakeInitOptions, IHandshakeAccept, IHandshakeAcceptMessage, IHandshakeAcceptOptions, IHandshakeConfirmation, IHandshakeAcceptJSON, IHandshakeConfirmationOptions, IHandshakeConfirmationJSON, IConnection, IHandshakeInitJSON } from '../types'
import { isReceiver } from '../util/isReceiver'
import { checkpoint } from '../util/abort'

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

    async confirm (accept: IHandshakeAcceptMessage, { signal }: { signal?: AbortSignal } = {}): Promise<IHandshakeConfirmation> {
      const cp = checkpoint(signal)
      const secretKey = await cp(crypto.computeSecret(this.handshakeSecret, Buffer.from(accept.token, 'base64')))
      const bob = await cp(createReceiver())
      const sendKey = await cp(crypto.decrypt(secretKey, Buffer.from(accept.secret, 'base64')))
      if (!(sendKey instanceof Uint8Array)) {
        throw Object.assign(new Error('Expected buffer in decrypted message'), { code: 'invalid-message' })
      }
      const aliceSender = new Sender({ sendKey })
      return new HandshakeConfirmation({
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
    async initHandshake ({ signal }: { signal?: AbortSignal } = {}): Promise<HandshakeInit> {
      const cp = checkpoint(signal)
      const { receiver, sender } = await cp(createReceiver())
      const { privateKey: handshakeSecret, publicKey: handshakePublic } = await cp(crypto.initHandshake())
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
    async acceptHandshake (firstMessage: Uint8Array, { signal }: { signal?: AbortSignal } = {}): Promise<IHandshakeAccept> {
      const {
        token,
        sendKey
      } = processHandshake(firstMessage)
      const cp = checkpoint(signal)
      const { privateKey: handshakeSecret, publicKey: handshakePublic } = await cp(crypto.initHandshake())
      const secretKey = await cp(crypto.computeSecret(handshakeSecret, token))
      const { receiver, sender } = await cp(createReceiver())
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
