import { Buffer, toBuffer, bufferToString } from '../util'
import { IHandshakeInit, IReader, IHandshakeInitOptions, IHandshakeAccept, IHandshakeAcceptMessage, IHandshakeAcceptOptions, IHandshakeConfirmation, IHandshakeAcceptJSON, IHandshakeConfirmationOptions, IHandshakeConfirmationJSON, IConnection, IHandshakeInitJSON } from '../types'
import { createChannel, Reader, Writer, Connection } from '../primitives'
import { randomBuffer } from '../util/randomBuffer'
import { decrypt, encrypt } from '../util/secretbox'
import * as sodium from 'sodium-universal'

const {
  crypto_scalarmult_BYTES: CRYPTO_SCALARMULT_BYTES,
  crypto_scalarmult: scalarMult,
  crypto_scalarmult_base: scalarMultBase,
  sodium_malloc: malloc
} = sodium.default

export const HANDSHAKE_MSG_VERSION = Buffer.from([1])

function computeSecret (privateKey: Uint8Array, remotePublic: Uint8Array): Uint8Array {
  const secret = malloc(CRYPTO_SCALARMULT_BYTES)
  scalarMult(secret, privateKey, remotePublic)
  return secret
}

function createHandshake (): { secretKey: Uint8Array, publicKey: Uint8Array } {
  const secretKey = randomBuffer(CRYPTO_SCALARMULT_BYTES)
  const publicKey = malloc(CRYPTO_SCALARMULT_BYTES)
  scalarMultBase(publicKey, secretKey)
  return { secretKey, publicKey }
}
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

export class HandshakeInit implements IHandshakeInit {
  receiver: IReader
  firstMessage: Uint8Array
  handshakeSecret: Uint8Array

  constructor ({ receiver, handshakeSecret, firstMessage }: IHandshakeInitOptions) {
    this.receiver = new Reader(receiver)
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

  confirm (accept: IHandshakeAcceptMessage): IHandshakeConfirmation {
    const secretKey = computeSecret(this.handshakeSecret, Buffer.from(accept.token, 'base64'))
    const backChannel = createChannel()
    const sendKey = decrypt(secretKey, Buffer.from(accept.secret, 'base64'))
    if (!(sendKey instanceof Uint8Array)) {
      throw Object.assign(new Error(`Expected buffer in decrypted message, got: ${sendKey.constructor.name}`), { code: 'invalid-message', sendKey })
    }
    const aliceSender = new Writer({ writerKey: sendKey })
    return new HandshakeConfirmation({
      connection: new Connection({
        writer: aliceSender,
        reader: backChannel.reader
      }),
      // In case you are wondering why we not just simply return "backChannel" as sender
      // but instead pass it in two messages: the reason is that without this step
      // the API is clearer.
      // TODO: rethink
      finalMessage: backChannel.writer.writerKey
    })
  }
}

export class HandshakeAccept extends Connection implements IHandshakeAccept {
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

  finalize (message: Uint8Array): IConnection {
    return new Connection({
      reader: this.reader,
      writer: new Writer({ writerKey: message })
    })
  }
}

export class HandshakeConfirmation implements IHandshakeConfirmation {
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

export function initHandshake (): HandshakeInit {
  const { reader: receiver, writer: sender } = createChannel()
  const handshake = createHandshake()
  return new HandshakeInit({
    receiver,
    handshakeSecret: handshake.secretKey,
    firstMessage: Buffer.concat([
      HANDSHAKE_MSG_VERSION,
      handshake.publicKey,
      sender.writerKey
    ])
  })
}

export function acceptHandshake (firstMessage: Uint8Array): IHandshakeAccept {
  const {
    token,
    sendKey
  } = processHandshake(firstMessage)
  const handshake = createHandshake()
  const secretKey = computeSecret(handshake.secretKey, token)
  const { reader: receiver, writer: sender } = createChannel()
  return new HandshakeAccept({
    writer: { writerKey: sendKey },
    reader: receiver,
    acceptMessage: {
      token: bufferToString(handshake.publicKey, 'base64'),
      secret: bufferToString(encrypt(secretKey, sender.writerKey), 'base64')
    }
  })
}
