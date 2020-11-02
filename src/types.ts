/* eslint-disable @typescript-eslint/method-signature-style */
import { IEncryptedMessage, IDecryption } from './core/types'
import { IEncodable, IStringOrBuffer, ITimeoutOptions } from './util/types'

export * from './core/types'

export { IEncryptedMessage, IDecryption }

export interface IAnnonymousJSON {
  id: string
}

export interface IAnnonymousOptions {
  id: IStringOrBuffer
}

export interface IChannelId {
  readonly id: Uint8Array
  readonly idBase64: string
  readonly idHex: string
}

export interface IAnnonymous extends IChannelId {
  toJSON(): IAnnonymousJSON
  verify(signature: Uint8Array, body: Uint8Array): Promise<boolean>
  verifyMessage(message: IEncryptedMessage): Promise<boolean>
}

export interface ISenderJSON {
  sendKey: string
}

export interface ISenderOptions {
  sendKey: IStringOrBuffer
}

export interface ISender extends IChannelId {
  toJSON(): ISenderJSON
  readonly sendKey: Uint8Array
  readonly sendKeyBase64: string
  readonly encryptKey: Uint8Array
  readonly signKey: Uint8Array
  readonly annonymous: IAnnonymous
  sign(data: Uint8Array): Promise<Uint8Array>
  encrypt(message: IEncodable): Promise<IEncryptedMessage>
  encryptOnly(message: IEncodable): Promise<Uint8Array>
}

export interface IReceiverJSON {
  receiveKey: string
}

export interface IReceiverOptions {
  receiveKey: IStringOrBuffer
}

export interface IReceiver extends IChannelId {
  readonly receiveKey: Uint8Array
  readonly receiveKeyBase64: string
  readonly annonymous: IAnnonymous
  toJSON(): IReceiverJSON
  /**
   * Decrypts a message written by an associated Sender
   *
   * @param encrypted signed or unsigned message
   */
  decrypt(encrypted: IEncryptedMessage | Uint8Array): Promise<IDecryption>
}

export type ComType = 'channel' | 'connection'

export interface IComJSON<TType = ComType> {
  receiver: IReceiverJSON
  sender: ISenderJSON
  type: TType
}

export interface IComOptions<TType = ComType> {
  sender: ISenderOptions
  receiver: IReceiverOptions
  type?: TType
}
export interface ICom<TType = ComType> {
  sender: ISender
  receiver: IReceiver
  type: TType
  toJSON(): IComJSON<TType>
}

export type IConnection = ICom<'connection'>
export type IConnectionJSON = IComJSON<'connection'>
export type IConnectionOptions = IComOptions<'connection'>
export interface IChannel extends ICom<'channel'> {
  annonymous: IAnnonymous
}
export type IChannelJSON = IComJSON<'channel'>
export type IChannelOptions = IComOptions<'channel'>

export interface IHandshakeInitJSON {
  receiver: IReceiverJSON
  firstMessage: string
  handshakeSecret: string
}

export interface IHandshakeInitOptions {
  receiver: IReceiver | IReceiverOptions
  firstMessage: IStringOrBuffer
  handshakeSecret: IStringOrBuffer
}

export interface IHandshakeInit {
  receiver: IReceiver
  firstMessage: Uint8Array
  handshakeSecret: Uint8Array
  toJSON(): IHandshakeInitJSON
  confirm(acceptMessage: IHandshakeAcceptMessage, opts?: ITimeoutOptions): Promise<IHandshakeConfirmation>
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
  finalize(message: Uint8Array, opts?: ITimeoutOptions): Promise<IConnection>
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

export interface ICryptoPrimitives {
  createChannel(opts?: ITimeoutOptions): Promise<IChannel>
  Annonymous: new (opts: IAnnonymousOptions) => IAnnonymous
  Receiver: new (opts: IReceiverOptions) => IReceiver
  Sender: new (opts: ISenderOptions) => ISender
  Connection: new (opts: IConnectionOptions) => IConnection
  Channel: new (opts: IChannelOptions) => IChannel
}

export interface ICryptoHandshake {
  initHandshake(opts?: ITimeoutOptions): Promise<IHandshakeInit>
  acceptHandshake(message: Uint8Array, opts?: ITimeoutOptions): Promise<IHandshakeAccept>
  HandshakeInit: new (opts: IHandshakeInitOptions) => IHandshakeInit
  HandshakeAccept: new (opts: IHandshakeAcceptOptions) => IHandshakeAccept
  HandshakeConfirmation: new (opts: IHandshakeConfirmationOptions) => IHandshakeConfirmation
}

export type IConsentoCrypto = ICryptoPrimitives & ICryptoHandshake

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

export interface IEncryptedBlobAPI {
  encryptBlob (encodable: IEncodable, opts?: ITimeoutOptions): Promise<{ blob: IEncryptedBlob, encrypted: Uint8Array }>
  decryptBlob (secretKey: Uint8Array, encrypted: Uint8Array, opts?: ITimeoutOptions): Promise<IEncodable>
  isEncryptedBlob (input: any): input is IEncryptedBlob
  toEncryptedBlob (secretKey: string | Uint8Array): Promise<IEncryptedBlob>
  toEncryptedBlob (blob: IEncryptedBlob | IEncryptedBlobJSON): IEncryptedBlob
}
