import { IEncryptedMessage, IDecryption } from './core/types'
import { IEncodable, IStringOrBuffer } from './util/buffer'
import { ICancelable } from './util/cancelable'

export { ICancelable, ISplitCancelable, TCancelable } from './util/cancelable'

export { IEncryptedMessage, IDecryption, IEncodable }

export const receiverFlag = Symbol.for('consento/crypto/receiver')
export const senderFlag = Symbol.for('consento/crypto/sender')
export const annonymousFlag = Symbol.for('consento/crypto/annonymous')

export interface IAnnonymousJSON {
  id: string
}

export interface IAnnonymousOptions {
  id: IStringOrBuffer
}

export interface IAnnonymous {
  [annonymousFlag]: true
  id: Uint8Array
  idBase64: string
  readonly idHex: string
  equals(other: IAnnonymous): boolean
  compare(other: IAnnonymous, _?: boolean): number
  toJSON(): IAnnonymousJSON
  verify(signature: Uint8Array, body: Uint8Array): Promise<boolean>
  verifyMessage(message: IEncryptedMessage): Promise<boolean>
}

export interface IReceiverJSON extends IAnnonymousJSON {
  receiveKey: string
}

export interface IReceiverOptions extends IAnnonymousOptions {
  receiveKey: IStringOrBuffer
  signKey?: Promise<Uint8Array>
}

export interface IReceiver extends IAnnonymous {
  [receiverFlag]: true
  receiveKey: Uint8Array
  signKey: Promise<Uint8Array>
  toJSON(): IReceiverJSON
  newAnnonymous(): IAnnonymous
  sign(data: Uint8Array): Promise<Uint8Array>
  decrypt(encrypted: IEncryptedMessage): ICancelable<IDecryption>
}

export interface ISenderJSON extends IReceiverJSON {
  sendKey: string
}

export interface ISenderOptions extends IReceiverOptions {
  sendKey: IStringOrBuffer
}

export interface ISender extends IReceiver {
  [senderFlag]: true
  sendKey: Uint8Array
  toJSON(): ISenderJSON
  newReceiver(): IReceiver
  encrypt(message: IEncodable): ICancelable<IEncryptedMessage>
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
  confirmKey: string
}

export interface IHandshakeInitOptions {
  receiver: IReceiver | IReceiverOptions
  firstMessage: IStringOrBuffer
  confirmKey: IStringOrBuffer
}

export interface IHandshakeInit {
  receiver: IReceiver
  firstMessage: Uint8Array
  confirmKey: Uint8Array
  toJSON(): IHandshakeInitJSON
  confirm(acceptMessage: IHandshakeAcceptMessage): ICancelable<IHandshakeConfirmation>
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
  finalize(message: Uint8Array): Promise<IConnection>
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
  createReceiverFromReceiveKey (receiveKey: IStringOrBuffer): Promise<IReceiver>
  createSenderFromSendKey (sendKey: IStringOrBuffer): Promise<ISender>
  createSender(): Promise<ISender>
  Annonymous: new (opts: IAnnonymousOptions) => IAnnonymous
  Receiver: new (opts: IReceiverOptions) => IReceiver
  Sender: new (opts: ISenderOptions) => ISender
  Connection: new (opts: IConnectionOptions) => IConnection
}

export interface ICryptoHandshake {
  initHandshake(): Promise<IHandshakeInit>
  acceptHandshake(message: Uint8Array): Promise<IHandshakeAccept>
  HandshakeInit: new (opts: IHandshakeInitOptions) => IHandshakeInit
  HandshakeAccept: new (opts: IHandshakeAcceptOptions) => IHandshakeAccept
  HandshakeConfirmation: new (opts: IHandshakeConfirmationOptions) => IHandshakeConfirmation
}

export type IConsentoCrypto = ICryptoPrimitives & ICryptoHandshake
