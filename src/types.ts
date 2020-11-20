/* eslint-disable @typescript-eslint/method-signature-style */
import codecs, { Codec, CodecOption, INamedCodec } from '@consento/codecs'
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
  invalidSignature = 'invalid-signature',
  invalidMessage = 'invalid-message',
  missingBody = 'missing-body',
  missingSignature = 'missing-signature',
  unexpectedIndex = 'unexpected-index',
  vectorIntegrity = 'vector-integrity',
  vectorPayload = 'vector-payload',
  vectorIndex = 'vector-index',
  vectorNext = 'vector-next'
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

type PropType<TObj, TProp extends keyof TObj> = TObj[TProp]

export interface IWriterJSON <TCodec extends INamedCodec> {
  writerKey: string
  outVector?: ISignVectorJSON
  codec: PropType<TCodec, 'name'>
}

export interface IWriterOptions <TCodec extends CodecOption> {
  writerKey: IStringOrBuffer
  outVector?: ISignVectorOptions
  codec?: TCodec
}

export interface IWriter <TCodec extends INamedCodec> extends IChannelActor {
  toJSON(): IWriterJSON<TCodec>
  readonly writerKey: Uint8Array
  readonly writerKeyBase64: string
  readonly encryptKey: Uint8Array
  readonly signKey: Uint8Array
  readonly verifier: IVerifier
  readonly codec: TCodec
  outVector?: ISignVector
  sign(data: Uint8Array): Uint8Array
  encrypt(message: any): IEncryptedMessage
  encryptOnly(message: any): Uint8Array
  encryptNext(message: any): IEncryptedMessage
  encryptOnlyNext(message: any): Uint8Array
}

export interface IReaderJSON <TCodec extends INamedCodec> {
  readerKey: string
  inVector?: ISignVectorJSON
  codec: PropType<TCodec, 'name'>
}

export interface IReaderOptions <TCodec extends CodecOption> {
  readerKey: IStringOrBuffer
  inVector?: ISignVectorOptions
  codec?: TCodec
}

export interface IReader <TCodec extends INamedCodec> extends IChannelActor {
  readonly readerKey: Uint8Array
  readonly readerKeyBase64: string
  readonly verifier: IVerifier
  readonly codec: TCodec
  inVector?: ISignVector
  toJSON(): IReaderJSON<TCodec>
  /**
   * Decrypts a message written by an associated Sender
   *
   * @param encrypted signed or unsigned message
   */
  decrypt(encrypted: IEncryptedMessage | Uint8Array): any
  decryptNext(encrypted: IEncryptedMessage | Uint8Array): any
  encryptOnly(message: any): Uint8Array
}

export interface ISignVector {
  next: Uint8Array
  nextBase64: string
  index: number
  increment (next: Uint8Array): Uint8Array
  sign (message: Uint8Array): Uint8Array
  verify (message: Uint8Array, signature: Uint8Array): void
  toJSON (): ISignVectorJSON
}

export interface ISignVectorOptions {
  next: IStringOrBuffer
  index?: number
}

export interface ISignVectorJSON {
  next: string
  index: number
}

export interface IConnectionJSON <TInputCodec extends INamedCodec, TOutputCodec extends INamedCodec> {
  connectionKey: string
  inCodec: PropType<TInputCodec, 'name'>
  outCodec: PropType<TOutputCodec, 'name'>
  inVector?: ISignVectorJSON
  outVector?: ISignVectorJSON
}

export interface IConnectionOptionsByKey {
  connectionKey: IStringOrBuffer
}

export interface IConnectionOptionsByIO <TInputCodec extends CodecOption = undefined, TOutputCodec extends CodecOption = undefined> {
  input: IStringOrBuffer | IReader<Codec<TInputCodec>> | IReaderOptions<TInputCodec>
  output: IStringOrBuffer | IWriter<Codec<TOutputCodec>> | IWriterOptions<TOutputCodec>
}

export type IConnectionOptions <TInputCodec extends CodecOption, TOutputCodec extends CodecOption> = (IConnectionOptionsByKey | IConnectionOptionsByIO<TInputCodec, TOutputCodec>) & {
  inCodec?: TInputCodec
  outCodec?: TOutputCodec
  inVector?: ISignVectorOptions
  outVector?: ISignVectorOptions
}

export interface IChannelJSON<TCodec extends INamedCodec> {
  channelKey: string
  codec: PropType<TCodec, 'name'>
  inVector?: ISignVectorJSON
  outVector?: ISignVectorJSON
}

export interface IChannelOptions <TCodec extends CodecOption> {
  channelKey: IStringOrBuffer
  codec?: TCodec
  inVector?: ISignVectorOptions
  outVector?: ISignVectorOptions
}

export interface IChannel <TCodec extends INamedCodec> extends IChannelActor {
  verifier: IVerifier
  codec: TCodec
  channelKey: Uint8Array
  channelKeyBase64: string
  reader: IReader<TCodec>
  writer: IWriter<TCodec>
  toJSON(): IChannelJSON<TCodec>
}

export interface IConnection <TInput extends INamedCodec, TOutput extends INamedCodec> {
  output: IWriter<TOutput>
  input: IReader<TInput>
  connectionKey: Uint8Array
  connectionKeyBase64: string
  toJSON(): IConnectionJSON<TInput, TOutput>
}

export interface IHandshakeInitJSON {
  input: Omit<IReaderJSON<any>, 'codec'>
  firstMessage: string
  handshakeSecret: string
}

export interface IHandshakeInitOptions {
  input: Omit<IReaderOptions<any>, 'codec'>
  firstMessage: IStringOrBuffer
  handshakeSecret: IStringOrBuffer
}

export interface IHandshakeInit {
  input: IReader<MsgPackCodec>
  firstMessage: Uint8Array
  handshakeSecret: Uint8Array
  toJSON(): IHandshakeInitJSON
  confirm(acceptMessage: IHandshakeAcceptMessage): IHandshakeConfirmation
}

export interface IHandshakeAcceptMessage {
  token: string
  secret: string
}

export interface IHandshakeAcceptJSON {
  connectionKey: string
  acceptMessage: IHandshakeAcceptMessage
}

export type IHandshakeAcceptOptions = ({
  connectionKey: IStringOrBuffer
} | {
  input: IStringOrBuffer
  output: IStringOrBuffer
}) & {
  acceptMessage: IHandshakeAcceptMessage
}

export type MsgPackCodec = typeof codecs.msgpack

export interface IHandshakeAccept {
  connectionKey: Uint8Array
  connectionKeyBase64: string
  input: IReader<MsgPackCodec>
  output: IWriter<MsgPackCodec>
  acceptMessage: IHandshakeAcceptMessage
  toJSON(): IHandshakeAcceptJSON
  finalize(message: Uint8Array): IConnection<MsgPackCodec, MsgPackCodec>
}

export interface IHandshakeConfirmationOptions {
  connectionKey: IStringOrBuffer
  finalMessage: IStringOrBuffer
}

export interface IHandshakeConfirmationJSON {
  connectionKey: string
  finalMessage: string
}

export interface IHandshakeConfirmation {
  connection: IConnection<MsgPackCodec, MsgPackCodec>
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
