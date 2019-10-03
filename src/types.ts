import { IEncryptedMessage, IDecryption } from './core/types'
import { IEncodable } from './util/buffer'

export interface IAnnonymousOptions {
  id?: Uint8Array | string
}

export interface IAnnonymous {
  id (): PromiseLike<Uint8Array>
  idBase64 (): PromiseLike<string>
  idHex (): PromiseLike<string>
  equals (other: IAnnonymous): PromiseLike<boolean>
  compare (other: IAnnonymous, _?: boolean): PromiseLike<number>
  smallJSON(): PromiseLike<any>
  quickJSON(): PromiseLike<any>
  toString(): PromiseLike<string>
  verify (signature: Uint8Array, body: Uint8Array): Promise<boolean>
  verifyMessage (message: IEncryptedMessage): Promise<boolean>
}

export interface IReceiver extends IAnnonymous {
  newAnnonymous(): IAnnonymous
  receiveKey (): PromiseLike<Uint8Array>
  sign (data: Uint8Array): PromiseLike<Uint8Array>
  decrypt (encrypted: IEncryptedMessage): PromiseLike<IDecryption>
}

export interface ISender extends IReceiver {
  newReceiver(): IReceiver
  sendKey(): PromiseLike<Uint8Array>
  encrypt (message: IEncodable): PromiseLike<IEncryptedMessage>
}

export interface IReceiverOptions {
  receiveKey: Uint8Array | string
}

export interface ISenderOptions {
  sendKey: Uint8Array | string
  receiveKey?: Uint8Array | string
}

export interface IHandshakeAcceptMessage {
  token: string
  secret: string
}

export interface IHandshakeDone {
  receiver: IReceiver
  sender: ISender
}

export interface IHandshakeInit {
  readonly receiver: IReceiver
  initMessage (): Promise<Uint8Array>
  confirm (accept: IHandshakeAcceptMessage): Promise<IHandshakeConfirmation>
}

export interface IHandshakeConfirmation extends IHandshakeDone {
  finalMessage: Uint8Array
}

export interface IHandshakeAccept {
  readonly sender: ISender
  readonly receiver: IReceiver
  acceptMessage (): Promise<IHandshakeAcceptMessage>
  finalize (message: Uint8Array): Promise<IHandshakeDone>
}

export interface IConsentoCrypto {
  Sender: {
    new(opts: ISenderOptions | PromiseLike<ISenderOptions>): ISender
    create(): ISender
  }
  Receiver: new(opts: IReceiverOptions | PromiseLike<IReceiverOptions>) => IReceiver
  Annonymous: new(opts: IAnnonymousOptions | PromiseLike<IAnnonymousOptions>) => IAnnonymous
  HandshakeInit: new() => IHandshakeInit
  HandshakeAccept: new(message: Uint8Array) => IHandshakeAccept
}
