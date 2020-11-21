import { Buffer, toBuffer, bufferToString, isStringOrBuffer } from '../util'
import { IHandshakeInit, IReader, IHandshakeInitOptions, IHandshakeAccept, IHandshakeAcceptMessage, IHandshakeAcceptOptions, IHandshakeConfirmation, IHandshakeAcceptJSON, IHandshakeConfirmationOptions, IHandshakeConfirmationJSON, IConnection, IHandshakeInitJSON, MsgPackCodec, IWriter } from '../types'
import { createChannel, Reader, Writer, Connection, getIOFromConnectionOptions } from '../primitives'
import { randomBuffer } from '../util/randomBuffer'
import { decrypt, encrypt } from '../util/secretbox'
import * as sodium from 'sodium-universal'
import { INamedCodec } from '@consento/codecs'

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

const handshakeCodec: INamedCodec<'handshake', { token: Uint8Array, writerKey: Uint8Array }> = {
  name: 'handshake',
  encode: ({ token, writerKey }) => Buffer.concat([HANDSHAKE_MSG_VERSION, Buffer.from(token), Buffer.from(writerKey)]),
  decode: msg => {
    if (msg[0] !== HANDSHAKE_MSG_VERSION[0]) {
      throw Object.assign(new Error(`Error while processing handshake: Unknown handshake format: ${msg[0]}`), { code: 'unknown-message-format', messageFormat: msg[0] })
    }
    if (msg.length !== 161) {
      throw Object.assign(new Error(`Error while processing handshake: Invalid handshake size: ${msg.length}`), { code: 'invalid-size', size: msg.length })
    }
    return {
      token: msg.slice(1, 33),
      writerKey: msg.slice(33)
    }
  }
}

function remove <T, TProp extends keyof T> (input: T, prop: TProp): Omit<T, TProp> {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete input[prop]
  return input
}

export class HandshakeInit implements IHandshakeInit {
  input: IReader<MsgPackCodec>
  firstMessage: Uint8Array
  handshakeSecret: Uint8Array

  constructor ({ input, handshakeSecret, firstMessage }: IHandshakeInitOptions) {
    this.input = isStringOrBuffer(input) ? new Reader({ readerKey: input }) : 'readerKey' in input ? new Reader({ readerKey: input.readerKey }) : input
    this.handshakeSecret = toBuffer(handshakeSecret)
    this.firstMessage = toBuffer(firstMessage)
  }

  toJSON (): IHandshakeInitJSON {
    return {
      input: remove(this.input.toJSON(), 'codec'),
      firstMessage: bufferToString(this.firstMessage, 'base64'),
      handshakeSecret: bufferToString(this.handshakeSecret, 'base64')
    }
  }

  confirm (accept: IHandshakeAcceptMessage): IHandshakeConfirmation {
    const secretKey = computeSecret(this.handshakeSecret, Buffer.from(accept.token, 'base64'))
    const backChannel = createChannel()
    const writerKey = decrypt(secretKey, Buffer.from(accept.secret, 'base64'))
    return new HandshakeConfirmation({
      connectionKey: new Connection({
        output: new Writer({ writerKey: writerKey }),
        input: backChannel.reader
      }).connectionKey,
      // In case you are wondering why we not just simply return "backChannel" as sender
      // but instead pass it in two messages: the reason is that without this step
      // the API is clearer.
      // TODO: rethink
      finalMessage: backChannel.writer.writerKey
    })
  }
}

export class HandshakeAccept implements IHandshakeAccept {
  acceptMessage: IHandshakeAcceptMessage

  input: IReader<MsgPackCodec>
  output: IWriter<MsgPackCodec>
  connectionKey: Uint8Array
  _connectionKeyBase64?: string

  constructor (opts: IHandshakeAcceptOptions) {
    const parts = getIOFromConnectionOptions(opts)
    this.input = parts.input
    this.output = parts.output
    this.connectionKey = parts.connectionKey
    this._connectionKeyBase64 = parts.connectionKeyBase64
    this.acceptMessage = opts.acceptMessage
  }

  get connectionKeyBase64 (): string {
    if (this._connectionKeyBase64 === undefined) {
      this._connectionKeyBase64 = bufferToString(this.connectionKey, 'base64')
    }
    return this._connectionKeyBase64
  }

  toJSON (): IHandshakeAcceptJSON {
    return {
      connectionKey: this.connectionKeyBase64,
      acceptMessage: this.acceptMessage
    }
  }

  finalize (message: Uint8Array): IConnection<MsgPackCodec, MsgPackCodec> {
    return new Connection({
      input: this.input,
      output: { writerKey: message }
    })
  }
}

export class HandshakeConfirmation implements IHandshakeConfirmation {
  finalMessage: Uint8Array
  connection: IConnection<MsgPackCodec, MsgPackCodec>

  constructor (opts: IHandshakeConfirmationOptions) {
    this.connection = new Connection({ connectionKey: opts.connectionKey })
    this.finalMessage = toBuffer(opts.finalMessage)
  }

  toJSON (): IHandshakeConfirmationJSON {
    return {
      connectionKey: this.connection.connectionKeyBase64,
      finalMessage: bufferToString(this.finalMessage, 'base64')
    }
  }
}

export function initHandshake (): HandshakeInit {
  const channel = createChannel()
  const handshake = createHandshake()
  return new HandshakeInit({
    input: channel.reader,
    handshakeSecret: handshake.secretKey,
    firstMessage: handshakeCodec.encode({ token: handshake.publicKey, writerKey: channel.writer.writerKey })
  })
}

export function acceptHandshake (firstMessage: Uint8Array): IHandshakeAccept {
  const {
    token,
    writerKey
  } = handshakeCodec.decode(firstMessage)
  const handshake = createHandshake()
  const secretKey = computeSecret(handshake.secretKey, token)
  const { reader: receiver, writer: sender } = createChannel()
  return new HandshakeAccept({
    output: writerKey,
    input: receiver.readerKey,
    acceptMessage: {
      token: bufferToString(handshake.publicKey, 'base64'),
      secret: bufferToString(encrypt(secretKey, sender.writerKey), 'base64')
    }
  })
}
