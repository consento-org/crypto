import {
  IVerifier,
  IReader,
  IWriter,
  IChannel,
  IChannelJSON,
  IChannelOptions
} from '../types'
import { bufferEquals, Buffer } from '../util'
import { Reader } from './Reader'
import { Writer } from './Writer'
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
    reader: { readerKey: Buffer.concat([encrypt.publicKey, sign.publicKey, encrypt.privateKey]) },
    writer: { writerKey: Buffer.concat([encrypt.publicKey, sign.publicKey, sign.privateKey]) }
  })
}

export class Channel implements IChannel {
  reader: IReader
  writer: IWriter
  type: 'channel' = 'channel'

  constructor (opts: IChannelOptions) {
    this.reader = (opts.reader instanceof Reader) ? opts.reader : new Reader(opts.reader)
    this.writer = (opts.writer instanceof Writer) ? opts.writer : new Writer(opts.writer)
    if (opts.type !== undefined && opts.type as string !== 'channel') {
      throw new Error(`Can not restore a channel from a [${opts.type}]`)
    }
    if (!bufferEquals(this.reader.channelKey, this.writer.channelKey)) {
      throw new Error('Can not create a channel with both the writer and the reader have a different id! Did you mean to restore a connection?')
    }
  }

  get verifier (): IVerifier {
    return this.reader.verifier
  }

  toJSON (): IChannelJSON {
    return {
      reader: this.reader.toJSON(),
      writer: this.writer.toJSON(),
      type: 'channel'
    }
  }
}
