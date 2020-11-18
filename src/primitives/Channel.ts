import {
  IVerifier,
  IReader,
  IWriter,
  IChannel,
  IChannelJSON,
  IChannelOptions
} from '../types'
import { Buffer, bufferToString, toBuffer, Inspectable } from '../util'
import { Reader } from './Reader'
import { Writer } from './Writer'
import { readerKeyFromChannelKey, writerKeyFromChannelKey } from './key'
import { InspectOptions } from 'inspect-custom-symbol'
import prettyHash from 'pretty-hash'
import { createEncryptionKeys, createSignKeys } from './fn'

export function createChannel (): Channel {
  const encrypt = createEncryptionKeys()
  const sign = createSignKeys()
  return new Channel({ channelKey: Buffer.concat([encrypt.encryptKey, sign.verifyKey, encrypt.decryptKey, sign.signKey]) })
}

export class Channel extends Inspectable implements IChannel {
  _reader?: IReader
  _writer?: IWriter
  _channelKey?: Uint8Array
  _channelKeyBase64?: string

  constructor ({ channelKey }: IChannelOptions) {
    super()
    if (typeof channelKey === 'string') {
      this._channelKeyBase64 = channelKey
    } else {
      this._channelKey = channelKey
    }
  }

  get verifyKey (): Uint8Array {
    return this.reader.verifyKey
  }

  get verifyKeyBase64 (): string {
    return this.reader.verifyKeyBase64
  }

  get verifyKeyHex (): string {
    return this.reader.verifyKeyHex
  }

  get channelKey (): Uint8Array {
    if (this._channelKey === undefined) {
      this._channelKey = toBuffer(this._channelKeyBase64 as unknown as string)
    }
    return this._channelKey
  }

  get channelKeyBase64 (): string {
    if (this._channelKeyBase64 === undefined) {
      this._channelKeyBase64 = bufferToString(this._channelKey as unknown as Uint8Array, 'base64')
    }
    return this._channelKeyBase64
  }

  get reader (): IReader {
    if (this._reader === undefined) {
      this._reader = new Reader({ readerKey: readerKeyFromChannelKey(this.channelKey) })
    }
    return this._reader
  }

  get writer (): IWriter {
    if (this._writer === undefined) {
      this._writer = new Writer({ writerKey: writerKeyFromChannelKey(this.channelKey) })
    }
    return this._writer
  }

  get verifier (): IVerifier {
    return this.reader.verifier
  }

  _inspect (_: number, { stylize }: InspectOptions): string {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `Channel(${stylize(prettyHash(this.reader.verifyKey), 'string')})`
  }

  toJSON (): IChannelJSON {
    return {
      channelKey: this.channelKeyBase64
    }
  }
}
