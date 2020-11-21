import { EDecryptionError, IChannelOptions, IEncryptedMessage, IEncryptionKeys, ISignKeys, ISignVector } from '../types'
import * as sodium from 'sodium-universal'
import { Channel } from './Channel'
import { Buffer } from 'buffer'
import { SignVector } from './SignVector'
import { CodecOption } from '@consento/codecs'
import { exists } from '../util'
import { signedBodyCodec } from '../util/signedBodyCodec'

const {
  crypto_box_PUBLICKEYBYTES: CRYPTO_BOX_PUBLICKEYBYTES,
  crypto_box_SECRETKEYBYTES: CRYPTO_BOX_SECRETKEYBYTES,
  crypto_box_SEALBYTES: CRYPTO_BOX_SEALBYTES,
  crypto_box_seal: boxSeal,
  crypto_box_seal_open: boxSealOpen,
  crypto_box_keypair: boxKeyPair,
  crypto_sign_BYTES: CRYPTO_SIGN_BYTES,
  crypto_sign_PUBLICKEYBYTES: CRYPTO_SIGN_PUBLICKEYBYTES,
  crypto_sign_SECRETKEYBYTES: CRYPTO_SIGN_SECRETKEYBYTES,
  crypto_sign_keypair: signKeyPair,
  crypto_sign_detached: signDetached,
  crypto_sign_verify_detached: _verify,
  sodium_malloc: malloc
} = sodium.default

export function createEncryptionKeys (): IEncryptionKeys {
  const keys = {
    encryptKey: malloc(CRYPTO_BOX_PUBLICKEYBYTES),
    decryptKey: malloc(CRYPTO_BOX_SECRETKEYBYTES)
  }
  boxKeyPair(keys.encryptKey, keys.decryptKey)
  return keys
}

export function createSignKeys (): ISignKeys {
  const keys = {
    verifyKey: malloc(CRYPTO_SIGN_PUBLICKEYBYTES),
    signKey: malloc(CRYPTO_SIGN_SECRETKEYBYTES)
  }
  signKeyPair(keys.verifyKey, keys.signKey)
  return keys
}

export function encryptMessage (writeKey: Uint8Array, msgBuffer: Uint8Array): Uint8Array {
  const body = malloc(msgBuffer.length + CRYPTO_BOX_SEALBYTES)
  boxSeal(body, msgBuffer, writeKey)
  return body
}

export function verify (verifyKey: Uint8Array, signature: Uint8Array, body: Uint8Array): boolean {
  return _verify(signature, body, verifyKey)
}

export function verifyMessage (verifyKey: Uint8Array, message: IEncryptedMessage): boolean {
  return _verify(message.signature, message.body, verifyKey)
}

export function verifyBody (verifyKey: Uint8Array, message: IEncryptedMessage | Uint8Array, signVector?: ISignVector): Uint8Array {
  let encrypted: Uint8Array
  if (message instanceof Uint8Array) {
    encrypted = message
  } else {
    if (!verify(verifyKey, message.signature, message.body)) {
      throw Object.assign(new Error('Invalid signature'), { code: EDecryptionError.invalidSignature })
    }
    encrypted = message.body
  }
  if (!exists(signVector)) {
    return encrypted
  }
  const { body, signature } = signedBodyCodec.decode(encrypted)
  signVector.verify(body, signature)
  return body
}

export function decryptBody (writeKey: Uint8Array, readKey: Uint8Array, body: Uint8Array): Uint8Array {
  const messageDecrypted = malloc(body.length - CRYPTO_BOX_SEALBYTES)
  const successful = boxSealOpen(messageDecrypted, body, writeKey, readKey)
  if (!successful) {
    throw Object.assign(new Error('Can not decrypt data. Is it encryted with different key?'), { code: EDecryptionError.invalidEncryption })
  }
  return messageDecrypted
}

export function sign (signKey: Uint8Array, body: Uint8Array): Uint8Array {
  const signature = malloc(CRYPTO_SIGN_BYTES)
  signDetached(signature, body, signKey)
  return signature
}

export function createSignVectors (): { inVector: ISignVector, outVector: ISignVector } {
  const keys = createSignKeys()
  return {
    inVector: new SignVector({ next: keys.verifyKey }),
    outVector: new SignVector({ next: keys.signKey })
  }
}

export function createChannel <TCodec extends CodecOption = undefined> (opts?: Omit<IChannelOptions<TCodec>, 'channelKey'>): Channel<TCodec> {
  const encrypt = createEncryptionKeys()
  const sign = createSignKeys()
  return new Channel<TCodec>({
    channelKey: Buffer.concat([encrypt.encryptKey, sign.verifyKey, encrypt.decryptKey, sign.signKey]),
    ...opts
  })
}
