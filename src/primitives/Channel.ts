import {
  IVerifier,
  IReader,
  IWriter,
  IChannel,
  IChannelJSON,
  IChannelOptions
} from '../types'
import { bufferToString, toBuffer, Inspectable } from '../util'
import { Reader } from './Reader'
import { Writer } from './Writer'
import { readerKeyFromChannelKey, writerKeyFromChannelKey } from './key'
import { InspectOptions } from 'inspect-custom-symbol'
import prettyHash from 'pretty-hash'
import { Codec, CodecOption } from '@consento/codecs'

export class Channel <TCodec extends CodecOption = undefined> extends Inspectable implements IChannel<Codec<TCodec, 'msgpack'>> {
  reader: IReader<Codec<TCodec, 'msgpack'>>
  writer: IWriter<Codec<TCodec, 'msgpack'>>
  channelKey: Uint8Array
  _channelKeyBase64?: string

  constructor ({ channelKey, codec }: IChannelOptions<TCodec>) {
    super()
    if (typeof channelKey === 'string') {
      this._channelKeyBase64 = channelKey
      this.channelKey = toBuffer(channelKey)
    } else {
      this.channelKey = channelKey
    }
    this.reader = new Reader({ readerKey: readerKeyFromChannelKey(this.channelKey), codec })
    this.writer = new Writer({ writerKey: writerKeyFromChannelKey(this.channelKey), codec })
  }

  recodec <TCodec extends CodecOption = undefined> (codec: TCodec): IChannel<Codec<TCodec, 'msgpack'>> {
    return new Channel({
      channelKey: this.channelKey,
      codec
    })
  }

  get codec (): Codec<TCodec, 'msgpack'> {
    return this.reader.codec
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

  get channelKeyBase64 (): string {
    if (this._channelKeyBase64 === undefined) {
      this._channelKeyBase64 = bufferToString(this.channelKey as unknown as Uint8Array, 'base64')
    }
    return this._channelKeyBase64
  }

  get verifier (): IVerifier {
    return this.reader.verifier
  }

  _inspect (_: number, { stylize }: InspectOptions): string {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `Channel(${stylize(this.codec.name, 'special')}|${stylize(prettyHash(this.reader.verifyKeyHex), 'string')})`
  }

  toJSON (): IChannelJSON<Codec<TCodec, 'msgpack'>> {
    return {
      channelKey: this.channelKeyBase64,
      codec: this.reader.codec.name
    }
  }
}
