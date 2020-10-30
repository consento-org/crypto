import { IConnection, IReader, IWriter, IConnectionJSON, IConnectionOptions } from '../types'
import { Reader } from './Reader'
import { Writer } from './Writer'
import { bufferEquals } from '../util/buffer'

export class Connection implements IConnection {
  reader: IReader
  writer: IWriter
  type: 'connection' = 'connection'

  constructor (opts: IConnectionOptions) {
    this.reader = (opts.reader instanceof Reader) ? opts.reader : new Reader(opts.reader)
    this.writer = (opts.writer instanceof Writer) ? opts.writer : new Writer(opts.writer)
    if (opts.type !== undefined && opts.type as string !== 'connection') {
      throw new Error(`Can not restore a connection from a [${opts.type}]`)
    }
    if (bufferEquals(this.reader.channelKey, this.writer.channelKey)) {
      throw new Error('Can not create a connection with both the writer and the reader have the same id! Did you mean to restore a channel?')
    }
  }

  toJSON (): IConnectionJSON {
    return {
      reader: this.reader.toJSON(),
      writer: this.writer.toJSON(),
      type: 'connection'
    }
  }
}
