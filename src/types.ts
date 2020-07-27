/* eslint-disable @typescript-eslint/method-signature-style */
import { IEncryptedMessage, IDecryption } from './core/types'
import { IEncodable, IStringOrBuffer, ITimeoutOptions } from './util/types'

export * from './core/types'

export { IEncryptedMessage, IDecryption }

export const receiverFlag = Symbol.for('consento/crypto/receiver')
export const senderFlag = Symbol.for('consento/crypto/sender')
export const annonymousFlag = Symbol.for('consento/crypto/annonymous')

export interface IAnnonymousJSON {
  id: string
}

export interface IAnnonymousOptions {
  id: IStringOrBuffer
}

export interface IComparable<Base> {
  equals(other: Base): boolean
  compare(other: Base): number
}

export interface IChannelId {
  readonly id: Uint8Array
  readonly idBase64: string
  readonly idHex: string
}

export interface IAnnonymous extends IComparable<IAnnonymous>, IChannelId {
  [annonymousFlag]: true
  toJSON(): IAnnonymousJSON
  verify(signature: Uint8Array, body: Uint8Array): Promise<boolean>
  verifyMessage(message: IEncryptedMessage): Promise<boolean>
}

export interface ISenderJSON {
  sendKey: string
}

export interface ISenderOptions {
  id?: IStringOrBuffer
  sendKey: IStringOrBuffer
}

export interface ISender extends IComparable<ISender>, IChannelId {
  [senderFlag]: true
  toJSON(): ISenderJSON
  readonly sendKey: Uint8Array
  readonly encryptKey: Uint8Array
  readonly signKey: Uint8Array
  readonly sender: this
  readonly annonymous: IAnnonymous
  sign(data: Uint8Array): Promise<Uint8Array>
  encrypt(message: IEncodable): Promise<IEncryptedMessage>
}

export interface IReceiverJSON {
  receiveKey: string
}

export interface IReceiverOptions {
  id?: IStringOrBuffer
  sendKey?: IStringOrBuffer
  receiveKey: IStringOrBuffer
}

export interface IReceiver extends IComparable<IReceiver>, IChannelId {
  [receiverFlag]: true
  readonly receiveKey: Uint8Array
  readonly receiver: this
  readonly sender: ISender
  readonly annonymous: IAnnonymous
  toJSON(): IReceiverJSON
  decrypt(encrypted: IEncryptedMessage): Promise<IDecryption>
}

export interface IConnectionJSON {
  receiver: IReceiverJSON
  sender: ISenderJSON
}

export interface IConnectionOptions {
  sender: ISenderOptions
  receiver: IReceiverOptions
}

export interface IConnection {
  sender: ISender
  receiver: IReceiver
  toJSON(): IConnectionJSON
}

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
  createReceiver(opts?: ITimeoutOptions): Promise<IReceiver>
  Annonymous: new (opts: IAnnonymousOptions) => IAnnonymous
  Receiver: new (opts: IReceiverOptions) => IReceiver
  Sender: new (opts: ISenderOptions) => ISender
  Connection: new (opts: IConnectionOptions) => IConnection
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
