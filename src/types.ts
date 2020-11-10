/* eslint-disable @typescript-eslint/method-signature-style */
import { IEncodable, IStringOrBuffer } from './util/types'

export interface IEncryptedMessage {
  signature: Uint8Array
  body: Uint8Array
}

export enum EDecryptionError {
  invalidEncryption = 'invalid-encryption',
  invalidSignature = 'invalid-signature'
}

export interface IDecryptionError {
  error: EDecryptionError
}

export interface IDecryptionSuccess {
  body: IEncodable
}

export type IDecryption = IDecryptionSuccess | IDecryptionError

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
  encrypt(message: IEncodable): IEncryptedMessage
  encryptOnly(message: IEncodable): Uint8Array
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
  decrypt(encrypted: IEncryptedMessage | Uint8Array): IDecryption
  encryptOnly(message: IEncodable): Uint8Array
}

export type ComType = 'channel' | 'connection'

export interface IComJSON<TType = ComType> {
  reader: IReaderJSON
  writer: IWriterJSON
  type: TType
}

export interface IComOptions<TType = ComType> {
  writer: IWriterOptions
  reader: IReaderOptions
  type?: TType
}
export interface ICom<TType = ComType> {
  writer: IWriter
  reader: IReader
  type: TType
  toJSON(): IComJSON<TType>
}

export type IConnection = ICom<'connection'>
export type IConnectionJSON = IComJSON<'connection'>
export type IConnectionOptions = IComOptions<'connection'>
export interface IChannel extends ICom<'channel'> {
  verifier: IVerifier
}
export type IChannelJSON = IComJSON<'channel'>
export type IChannelOptions = IComOptions<'channel'>

export interface IHandshakeInitJSON {
  receiver: IReaderJSON
  firstMessage: string
  handshakeSecret: string
}

export interface IHandshakeInitOptions {
  receiver: IReader | IReaderOptions
  firstMessage: IStringOrBuffer
  handshakeSecret: IStringOrBuffer
}

export interface IHandshakeInit {
  receiver: IReader
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

export interface IHandshakeAcceptOptions extends IConnectionOptions {
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
