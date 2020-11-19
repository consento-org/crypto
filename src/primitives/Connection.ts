import { IConnection, IReader, IWriter, IConnectionJSON, IConnectionOptions, IConnectionOptionsByKey, IConnectionOptionsByIO } from '../types'
import { Reader } from './Reader'
import { Writer } from './Writer'
import { bufferEquals, bufferToString, isStringOrBuffer, toBuffer } from '../util/buffer'
import { Buffer, Inspectable } from '../util'
import { inReaderKeyFromConnectionKey, outWriterKeyFromConnectionKey } from './key'
import { InspectOptions } from 'inspect-custom-symbol'
import prettyHash from 'pretty-hash'

function isConnectionOptionsByKey (input: IConnectionOptions): input is IConnectionOptionsByKey {
  return 'connectionKey' in input
}

function isConnectionOptionsByIO (input: IConnectionOptions): input is IConnectionOptionsByIO {
  return 'input' in input && 'output' in input
}

export class Connection extends Inspectable implements IConnection {
  input: IReader
  output: IWriter
  _connectionKey: Uint8Array
  _connectionKeyBase64?: string

  constructor (opts: IConnectionOptions) {
    super()
    let readerKey: Uint8Array
    let writerKey: Uint8Array
    let inVector = opts.inVector
    let outVector = opts.outVector
    if (isConnectionOptionsByKey(opts)) {
      if (typeof opts.connectionKey === 'string') {
        this._connectionKeyBase64 = opts.connectionKey
      }
      this._connectionKey = toBuffer(opts.connectionKey)
      readerKey = inReaderKeyFromConnectionKey(this._connectionKey)
      writerKey = outWriterKeyFromConnectionKey(this._connectionKey)
    } else if (isConnectionOptionsByIO(opts)) {
      if (isStringOrBuffer(opts.input)) {
        readerKey = toBuffer(opts.input)
      } else {
        readerKey = toBuffer(opts.input.readerKey)
        inVector = inVector ?? opts.input.inVector
      }
      if (isStringOrBuffer(opts.output)) {
        writerKey = toBuffer(opts.output)
      } else {
        writerKey = toBuffer(opts.output.writerKey)
        outVector = outVector ?? opts.output.outVector
      }
      this._connectionKey = Buffer.concat([readerKey, writerKey])
    } else {
      throw new Error('Options for connection invalid, either connectionKey or input/output must be given.')
    }
    this.input = new Reader({ readerKey, inVector })
    this.output = new Writer({ writerKey, outVector })
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

  toJSON (): IConnectionJSON {
    return {
      connectionKey: this.connectionKeyBase64,
      inVector: this.input.inVector?.toJSON(),
      outVector: this.output.outVector?.toJSON()
    }
  }

  _inspect (_: number, { stylize }: InspectOptions): string {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    let input: string = `input=${stylize(prettyHash(this.input.verifyKey), 'string')}`
    if (this.input.inVector !== undefined) {
      input += `#${this.input.inVector.index}`
    }
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    let output: string = `output=${stylize(prettyHash(this.output.verifyKey), 'string')}`
    if (this.output.outVector !== undefined) {
      output += `#${this.output.outVector.index}`
    }
    return `Connection(${input}, ${output})`
  }
}
