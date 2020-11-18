/* eslint-disable @typescript-eslint/method-signature-style */
import { IStringOrBuffer } from './util/types'

export interface IEncryptedMessage {
  signature: Uint8Array
  body: Uint8Array
}

export interface IEncryptionKeys {
  encryptKey: Uint8Array
  decryptKey: Uint8Array
}

export interface ISignKeys {
  signKey: Uint8Array
  verifyKey: Uint8Array
}

export enum EDecryptionError {
  invalidEncryption = 'invalid-encryption',
  invalidSignature = 'invalid-signature'
}

export interface IVerifierJSON {
  verifyKey: string
}

export interface IVerifierOptions {
  verifyKey: IStringOrBuffer
}

export interface IChannelActor {
  readonly verifyKey: Uint8Array
  readonly verifyKeyBase64: string
  readonly verifyKeyHex: string
}

export interface IVerifier extends IChannelActor {
  toJSON(): IVerifierJSON
  verify(signature: Uint8Array, body: Uint8Array): boolean
  verifyMessage(message: IEncryptedMessage): boolean
}

export interface IWriterJSON {
  writerKey: string
}

export interface IWriterOptions {
  writerKey: IStringOrBuffer
}

export interface IWriter extends IChannelActor {
  toJSON(): IWriterJSON
  readonly writerKey: Uint8Array
  readonly writerKeyBase64: string
  readonly encryptKey: Uint8Array
  readonly signKey: Uint8Array
  readonly verifier: IVerifier
  sign(data: Uint8Array): Uint8Array
  encrypt(message: any): IEncryptedMessage
  encryptOnly(message: any): Uint8Array
}

export interface IReaderJSON {
  readerKey: string
}

export interface IReaderOptions {
  readerKey: IStringOrBuffer
}

export interface IReader extends IChannelActor {
  readonly readerKey: Uint8Array
  readonly readerKeyBase64: string
  readonly verifier: IVerifier
  toJSON(): IReaderJSON
  /**
   * Decrypts a message written by an associated Sender
   *
   * @param encrypted signed or unsigned message
   */
  decrypt(encrypted: IEncryptedMessage | Uint8Array): any
  encryptOnly(message: any): Uint8Array
}

export interface IConnectionJSON {
  connectionKey: string
}

export type IConnectionOptions = {
  connectionKey: IStringOrBuffer
} | {
  input: IStringOrBuffer | IReader | IReaderOptions
  output: IStringOrBuffer | IWriter | IWriterOptions
}

export interface IChannelJSON {
  channelKey: string
}

export interface IChannelOptions {
  channelKey: IStringOrBuffer
}

export interface IChannel extends IChannelActor {
  verifier: IVerifier
  toJSON(): IChannelJSON
}

export interface IConnection {
  output: IWriter
  input: IReader
  connectionKey: Uint8Array
  connectionKeyBase64: string
  toJSON(): IConnectionJSON
}

export interface IHandshakeInitJSON {
  input: IReaderJSON
  firstMessage: string
  handshakeSecret: string
}

export interface IHandshakeInitOptions {
  input: IReader | IReaderOptions
  firstMessage: IStringOrBuffer
  handshakeSecret: IStringOrBuffer
}

export interface IHandshakeInit {
  input: IReader
  firstMessage: Uint8Array
  handshakeSecret: Uint8Array
  toJSON(): IHandshakeInitJSON
  confirm(acceptMessage: IHandshakeAcceptMessage): IHandshakeConfirmation
}

export interface IHandshakeAcceptMessage {
  token: string
  secret: string
}

export interface IHandshakeAcceptJSON extends IConnectionJSON {
  acceptMessage: IHandshakeAcceptMessage
}

export type IHandshakeAcceptOptions = IConnectionOptions & {
  acceptMessage: IHandshakeAcceptMessage
}

export interface IHandshakeAccept extends IConnection {
  acceptMessage: IHandshakeAcceptMessage
  toJSON(): IHandshakeAcceptJSON
  finalize(message: Uint8Array): IConnection
}

export interface IHandshakeConfirmationOptions {
  connection: IConnectionOptions
  finalMessage: IStringOrBuffer
}

export interface IHandshakeConfirmationJSON {
  connection: IConnectionJSON
  finalMessage: string
}

export interface IHandshakeConfirmation {
  connection: IConnection
  finalMessage: Uint8Array
  toJSON(): IHandshakeConfirmationJSON
}

export interface IEncryptedBlob {
  secretKey: Uint8Array
  size?: number
  path: string[]
  toJSON (): IEncryptedBlobJSON
}

export interface IEncryptedBlobJSON {
  secretKey: string
  size?: number
  path: string[]
}
