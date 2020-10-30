import { IConnection, IReceiver, ISender, IConnectionJSON, IConnectionOptions } from '../types'
import { Receiver } from './Receiver'
import { Sender } from './Sender'
import { bufferEquals } from '../util/buffer'

export class Connection implements IConnection {
  receiver: IReceiver
  sender: ISender
  type: 'connection' = 'connection'

  constructor (opts: IConnectionOptions) {
    this.receiver = (opts.receiver instanceof Receiver) ? opts.receiver : new Receiver(opts.receiver)
    this.sender = (opts.sender instanceof Sender) ? opts.sender : new Sender(opts.sender)
    if (opts.type !== undefined && opts.type as string !== 'connection') {
      throw new Error(`Can not restore a connection from a [${opts.type}]`)
    }
    if (bufferEquals(this.receiver.id, this.sender.id)) {
      throw new Error('Can not create a connection with both the sender and the receiver have the same id! Did you mean to restore a channel?')
    }
  }

  toJSON (): IConnectionJSON {
    return {
      receiver: this.receiver.toJSON(),
      sender: this.sender.toJSON(),
      type: 'connection'
    }
  }
}
