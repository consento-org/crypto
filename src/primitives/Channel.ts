import {
  IVerifier,
  IReader,
  IWriter,
  IChannel,
  IChannelJSON,
  IChannelOptions
} from '../types'
import { Buffer, bufferToString, toBuffer } from '../util'
import { Reader } from './Reader'
import { Writer } from './Writer'
import * as sodium from 'sodium-universal'
import { readerKeyFromChannelKey, writerKeyFromChannelKey } from './key'

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
  return new Channel({ channelKey: Buffer.concat([encrypt.publicKey, sign.publicKey, encrypt.privateKey, sign.privateKey]) })
}

export class Channel implements IChannel {
  _reader?: IReader
  _writer?: IWriter
  _channelKey?: Uint8Array
  _channelKeyBase64?: string

  constructor ({ channelKey }: IChannelOptions) {
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

  toString (): string {
    return `Channel[${this.verifyKeyBase64}]`
  }

  toJSON (): IChannelJSON {
    return {
      channelKey: this.channelKeyBase64
    }
  }
}
