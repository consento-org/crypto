import { IConnection, IReader, IWriter, IConnectionJSON, IConnectionOptions } from '../types'
import { Reader } from './Reader'
import { Writer } from './Writer'
import { bufferEquals, bufferToString, isStringOrBuffer, toBuffer } from '../util/buffer'
import { Buffer, Inspectable } from '../util'
import { inReaderKeyFromConnectionKey, outWriterKeyFromConnectionKey } from './key'
import { InspectOptions } from 'inspect-custom-symbol'
import prettyHash from 'pretty-hash'

export class Connection extends Inspectable implements IConnection {
  _input?: IReader
  _output?: IWriter
  _connectionKey?: Uint8Array
  _connectionKeyBase64?: string

  constructor (opts: IConnectionOptions) {
    super()
    if ('connectionKey' in opts) {
      if (typeof opts.connectionKey === 'string') {
        this._connectionKeyBase64 = opts.connectionKey
      } else {
        this._connectionKey = opts.connectionKey
      }
    } else {
      this._input = isStringOrBuffer(opts.input) ? new Reader({ readerKey: opts.input }) : 'readerKey' in opts.input ? new Reader(opts.input) : opts.input
      this._output = isStringOrBuffer(opts.output) ? new Writer({ writerKey: opts.output }) : 'writerKey' in opts.output ? new Writer(opts.output) : opts.output
      this._connectionKey = Buffer.concat([this._input.readerKey, this._output.writerKey])
    }
    if (bufferEquals(this.input.verifyKey, this.output.verifyKey)) {
      throw new Error('Can not create a connection with both the writer and the reader have the same id! Did you mean to restore a channel?')
    }
  }

  get connectionKey (): Uint8Array {
    if (this._connectionKey === undefined) {
      this._connectionKey = toBuffer(this._connectionKeyBase64 as unknown as string)
    }
    return this._connectionKey
  }

  get connectionKeyBase64 (): string {
    if (this._connectionKeyBase64 === undefined) {
      this._connectionKeyBase64 = bufferToString(this._connectionKey as unknown as Uint8Array, 'base64')
    }
    return this._connectionKeyBase64
  }

  get input (): IReader {
    if (this._input === undefined) {
      this._input = new Reader({ readerKey: inReaderKeyFromConnectionKey(this.connectionKey) })
    }
    return this._input
  }

  get output (): IWriter {
    if (this._output === undefined) {
      this._output = new Writer({ writerKey: outWriterKeyFromConnectionKey(this.connectionKey) })
    }
    return this._output
  }

  toJSON (): IConnectionJSON {
    return {
      connectionKey: this.connectionKeyBase64
    }
  }

  _inspect (_: number, { stylize }: InspectOptions): string {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `Connection(input=${stylize(prettyHash(this.input.verifyKey), 'string')}, output=${stylize(prettyHash(this.output.verifyKey), 'string')})`
  }
}
