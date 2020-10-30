import {
  IAnnonymous,
  IReceiver,
  ISender,
  IChannel,
  IChannelJSON,
  IChannelOptions
} from '../types'
import { bufferEquals, Buffer } from '../util'
import { Receiver } from './Receiver'
import { Sender } from './Sender'
import * as sodium from 'sodium-universal'

const {
  sodium_malloc: malloc,
  crypto_box_PUBLICKEYBYTES: CRYPTO_BOX_PUBLICKEYBYTES,
  crypto_box_SECRETKEYBYTES: CRYPTO_BOX_SECRETKEYBYTES,
  crypto_box_keypair: boxKeyPair,
  crypto_sign_PUBLICKEYBYTES: CRYPTO_SIGN_PUBLICKEYBYTES,
  crypto_sign_SECRETKEYBYTES: CRYPTO_SIGN_SECRETKEYBYTES,
  crypto_sign_keypair: signKeyPair
} = sodium.default

interface IRawKeys {
  publicKey: Uint8Array
  privateKey: Uint8Array
}

function createEncryptionKeys (): IRawKeys {
  const keys = {
    publicKey: malloc(CRYPTO_BOX_PUBLICKEYBYTES),
    privateKey: malloc(CRYPTO_BOX_SECRETKEYBYTES)
  }
  boxKeyPair(keys.publicKey, keys.privateKey)
  return keys
}

function createSignKeys (): IRawKeys {
  const keys = {
    publicKey: malloc(CRYPTO_SIGN_PUBLICKEYBYTES),
    privateKey: malloc(CRYPTO_SIGN_SECRETKEYBYTES)
  }
  signKeyPair(keys.publicKey, keys.privateKey)
  return keys
}

export function createChannel (): Channel {
  const encrypt = createEncryptionKeys()
  const sign = createSignKeys()
  return new Channel({
    receiver: { receiveKey: Buffer.concat([encrypt.publicKey, sign.publicKey, encrypt.privateKey]) },
    sender: { sendKey: Buffer.concat([encrypt.publicKey, sign.publicKey, sign.privateKey]) }
  })
}

export class Channel implements IChannel {
  receiver: IReceiver
  sender: ISender
  type: 'channel' = 'channel'

  constructor (opts: IChannelOptions) {
    this.receiver = (opts.receiver instanceof Receiver) ? opts.receiver : new Receiver(opts.receiver)
    this.sender = (opts.sender instanceof Sender) ? opts.sender : new Sender(opts.sender)
    if (opts.type !== undefined && opts.type as string !== 'channel') {
      throw new Error(`Can not restore a channel from a [${opts.type}]`)
    }
    if (!bufferEquals(this.receiver.id, this.sender.id)) {
      throw new Error('Can not create a channel with both the sender and the receiver have a different id! Did you mean to restore a connection?')
    }
  }

  get annonymous (): IAnnonymous {
    return this.receiver.annonymous
  }

  toJSON (): IChannelJSON {
    return {
      receiver: this.receiver.toJSON(),
      sender: this.sender.toJSON(),
      type: 'channel'
    }
  }
}
