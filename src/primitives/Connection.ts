import { IConnection, IReader, IWriter, IConnectionJSON, IConnectionOptions, IConnectionOptionsByKey, IConnectionOptionsByIO } from '../types'
import { Reader } from './Reader'
import { Writer } from './Writer'
import { bufferEquals, bufferToString, isStringOrBuffer, toBuffer } from '../util/buffer'
import { Buffer, Inspectable } from '../util'
import { inReaderKeyFromConnectionKey, outWriterKeyFromConnectionKey } from './key'
import { InspectOptions } from 'inspect-custom-symbol'
import prettyHash from 'pretty-hash'
import { Codec, CodecOption } from '@consento/codecs'

function isConnectionOptionsByKey (input: IConnectionOptions<any, any>): input is IConnectionOptionsByKey {
  return 'connectionKey' in input
}

function isConnectionOptionsByIO (input: IConnectionOptions<any, any>): input is IConnectionOptionsByIO {
  return 'input' in input && 'output' in input
}

export function getIOFromConnectionOptions <TInputCodec extends CodecOption = undefined, TOutputCodec extends CodecOption = undefined> (opts: IConnectionOptions<TInputCodec, TOutputCodec>): {
  connectionKey: Uint8Array
  connectionKeyBase64?: string
  input: IReader<Codec<TInputCodec, 'msgpack'>>
  output: IWriter<Codec<TOutputCodec, 'msgpack'>>
} {
  let readerKey: Uint8Array
  let writerKey: Uint8Array
  let inCodec = opts.inCodec
  let outCodec = opts.outCodec
  let connectionKey: Uint8Array
  let connectionKeyBase64: string | undefined
  if (isConnectionOptionsByKey(opts)) {
    if (typeof opts.connectionKey === 'string') {
      connectionKeyBase64 = opts.connectionKey
    }
    connectionKey = toBuffer(opts.connectionKey)
    readerKey = inReaderKeyFromConnectionKey(connectionKey)
    writerKey = outWriterKeyFromConnectionKey(connectionKey)
  } else if (isConnectionOptionsByIO(opts)) {
    if (isStringOrBuffer(opts.input)) {
      readerKey = toBuffer(opts.input)
    } else {
      readerKey = toBuffer(opts.input.readerKey)
      inCodec = inCodec ?? opts.input.codec as any
    }
    if (isStringOrBuffer(opts.output)) {
      writerKey = toBuffer(opts.output)
    } else {
      writerKey = toBuffer(opts.output.writerKey)
      outCodec = outCodec ?? opts.output.codec as any
    }
    connectionKey = Buffer.concat([Buffer.from(readerKey), Buffer.from(writerKey)])
  } else {
    throw new Error('Options for connection invalid, either connectionKey or input/output must be given.')
  }
  return {
    connectionKey,
    connectionKeyBase64,
    input: new Reader({ readerKey, codec: inCodec }),
    output: new Writer({ writerKey, codec: outCodec })
  }
}

export class Connection <TInputCodec extends CodecOption = undefined, TOutputCodec extends CodecOption = undefined> extends Inspectable implements IConnection<Codec<TInputCodec, 'msgpack'>, Codec<TOutputCodec, 'msgpack'>> {
  input: IReader<Codec<TInputCodec, 'msgpack'>>
  output: IWriter<Codec<TOutputCodec, 'msgpack'>>
  connectionKey: Uint8Array
  _connectionKeyBase64?: string

  constructor (opts: IConnectionOptions<TInputCodec, TOutputCodec>) {
    super()
    const parts = getIOFromConnectionOptions(opts)
    this.input = parts.input
    this.output = parts.output
    this.connectionKey = parts.connectionKey
    this._connectionKeyBase64 = parts.connectionKeyBase64
    if (bufferEquals(this.input.verifyKey, this.output.verifyKey)) {
      throw new Error('Can not create a connection with both the writer and the reader have the same id! Did you mean to restore a channel?')
    }
  }

  get connectionKeyBase64 (): string {
    if (this._connectionKeyBase64 === undefined) {
      this._connectionKeyBase64 = bufferToString(this.connectionKey as unknown as Uint8Array, 'base64')
    }
    return this._connectionKeyBase64
  }

  toJSON (): IConnectionJSON<Codec<TInputCodec, 'msgpack'>, Codec<TOutputCodec, 'msgpack'>> {
    return {
      connectionKey: this.connectionKeyBase64,
      inCodec: this.input.codec.name,
      outCodec: this.output.codec.name
    }
  }

  _inspect (_: number, { stylize }: InspectOptions): string {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    const input: string = `input=${stylize(this.input.codec.name, 'special')}|${stylize(prettyHash(this.input.verifyKey), 'string')}`
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    const output: string = `output=${stylize(this.output.codec.name, 'special')}|${stylize(prettyHash(this.output.verifyKey), 'string')}`
    return `Connection(${input}, ${output})`
  }
}
