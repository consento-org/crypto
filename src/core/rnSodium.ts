import sodium from 'react-native-sodium'
import { bufferToString, Buffer, IEncodable, anyToBuffer, bufferToAny } from '../util/buffer'
import { IAnnonymousKeys, ICryptoCore, IEncryptedMessage, IDecryption, IKeys } from './types'
import { split } from '../util/split'

async function boxSecretFromSignSecret (signSecretKey: string): Promise<string> {
  return sodium.crypto_sign_ed25519_sk_to_curve25519(signSecretKey)
}

async function boxPublicFromSignPublic (signPublicKey: string): Promise<string> {
  return sodium.crypto_sign_ed25519_pk_to_curve25519(signPublicKey)
}

async function decrypt (signReadKey: string, signWriteKey: string, messageEncrypted: Uint8Array): Promise<string> {
  const [ encryptPublicKey, encryptSecretKey ] = await Promise.all([
    boxPublicFromSignPublic(signReadKey),
    boxSecretFromSignSecret(signWriteKey)
  ])
  return sodium.crypto_box_seal_open(bufferToString(messageEncrypted, 'base64'), encryptPublicKey, encryptSecretKey)
}

async function encrypt (signPublicKey: string, message: Uint8Array): Promise<Uint8Array> {
  const encryptPublicKey = await boxPublicFromSignPublic(signPublicKey)
  return Buffer.from(
    await sodium.crypto_box_seal(bufferToString(message, 'base64'), encryptPublicKey),
    'base64'
  )
}

async function sign (signSecretKey: Uint8Array, body: Uint8Array): Promise<Uint8Array> {
  return Buffer.from(
    await sodium.crypto_sign_detached(
      bufferToString(body, 'base64'),
      bufferToString(signSecretKey, 'base64')
    ),
    'base64'
  )
}

async function verify (signPublicKey: Uint8Array, signature: Uint8Array, body: Uint8Array): Promise<boolean> {
  return await sodium.crypto_sign_verify_detached(
    bufferToString(signature, 'base64'),
    bufferToString(body, 'base64'),
    bufferToString(signPublicKey, 'base64')
  ).catch(_ => false)
}

const deriveContext = 'conotify'

export const rnSodium: ICryptoCore = {
  async deriveKdfKey (key: Uint8Array) {
    return Buffer.from(
      await sodium.crypto_kdf_derive_from_key(1, deriveContext, key),
      'base64'
    )
  },
  sign,
  verify,
  async deriveAnnonymousKeys (readKey: Uint8Array): Promise<IAnnonymousKeys> {
    const { pk, sk } = await sodium.crypto_sign_seed_keypair(bufferToString(readKey, 'base64'))
    return {
      annonymous: true,
      read: Buffer.from(pk, 'base64'),
      write: Buffer.from(sk, 'base64')
    }
  },
  async deriveReadKey (writeKey: Uint8Array) {
    return Buffer.from(
      await sodium.crypto_sign_ed25519_sk_to_pk(bufferToString(writeKey, 'base64')),
      'base64'
    )
  },
  async createSecretKey () {
    return Buffer.from(
      await sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES),
      'base64'
    )
  },
  async encrypt (secretKey: Uint8Array, body: IEncodable): Promise<Uint8Array> {
    const message = anyToBuffer(body)
    const nonce = await sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
    const ciphertext = Buffer.from(await sodium.crypto_secretbox_easy(
      bufferToString(message, 'base64'),
      nonce,
      bufferToString(secretKey, 'base64')
    ), 'base64')
    const buffer = Buffer.concat([Buffer.from(nonce, 'base64'), ciphertext])
    return buffer
  },
  async decrypt (secretKey: Uint8Array, encrypted: Uint8Array): Promise<IEncodable> {
    const [nonce, ciphertext] = split(encrypted, sodium.crypto_secretbox_NONCEBYTES)
    return Buffer.from(
      await sodium.crypto_secretbox_open_easy(
        bufferToString(ciphertext, 'base64'),
        bufferToString(nonce, 'base64'),
        bufferToString(secretKey, 'base64')
      ),
      'base64'
    )
  },
  async decryptMessage (signReadKey: Uint8Array, signWriteKey: Uint8Array, readKey: Uint8Array, message: IEncryptedMessage): Promise<IDecryption> {
    if (!(await verify(signReadKey, message.signature, message.body))) {
      return {
        error: 'invalid-channel'
      }
    }
    const encryptPublicKey = await boxPublicFromSignPublic(bufferToString(signReadKey, 'base64'))
    const encryptSecretKey = await boxSecretFromSignSecret(bufferToString(signWriteKey, 'base64'))
    const decrypted = Buffer.from(await decrypt(encryptPublicKey, encryptSecretKey, message.body), 'base64')
    if (decrypted === null) {
      return {
        error: 'invalid-encryption'
      }
    }
    const [signature, body] = split(decrypted, sodium.crypto_sign_BYTES)
    if (!(await verify(readKey, signature, body))) {
      return {
        error: 'invalid-owner'
      }
    }
    return {
      body: bufferToAny(body)
    }
  },
  async encryptMessage (annonymousReadKey: Uint8Array, annonymousWriteKey: Uint8Array, writeKey: Uint8Array, message: IEncodable) {
    const msgBuffer = anyToBuffer(message)
    const signedStandardized = await sign(writeKey, msgBuffer)
    const secret = Buffer.concat([signedStandardized, msgBuffer])
    const encryptPublicKey = await boxPublicFromSignPublic(bufferToString(annonymousReadKey, 'base64'))
    const body = await encrypt(encryptPublicKey, secret)
    return {
      signature: await sign(annonymousWriteKey, body),
      body
    }
  },
  async initHandshake (): Promise<IKeys> {
    const { pk, sk } = await sodium.crypto_scalarmult_base()
    return {
      write: Buffer.from(sk, 'base64'),
      read: Buffer.from(pk, 'base64')
    }
  },
  async computeSecret (pri: Uint8Array, remotePublic: Uint8Array): Promise<Uint8Array> {
    return Buffer.from(
      await sodium.crypto_scalarmult(
        bufferToString(pri, 'base64'),
        bufferToString(remotePublic, 'base64')
      ),
      'base64'
    )
  },
  async createKeys (): Promise<IKeys> {
    const { pk, sk } = await sodium.crypto_sign_keypair()
    return {
      read: Buffer.from(pk, 'base64'),
      write: Buffer.from(sk, 'base64')
    }
  }
}
