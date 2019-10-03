import { IEncodable } from '../util/buffer'

export { IEncodable } from '../util/buffer'

export interface IEncryptedMessage {
  signature: Uint8Array
  body: Uint8Array
}

export interface IKeyPair {
  read: Uint8Array
  write?: Uint8Array
}

export interface IKeys extends IKeyPair {
  write: Uint8Array
}

export interface IAnnonymousKeys extends IKeys {
  annonymous: true
  write: Uint8Array
}

export interface IDecryption {
  body?: IEncodable
  error?: 'invalid-channel' | 'invalid-encryption' | 'invalid-owner'
}

export interface ICryptoCore {
  sign (signSecretKey: Uint8Array, body: Uint8Array): Promise<Uint8Array>
  verify (signPublicKey: Uint8Array, signature: Uint8Array, body: Uint8Array): Promise<boolean>
  deriveKdfKey (key: Uint8Array): Promise<Uint8Array>
  deriveAnnonymousKeys (readKey: Uint8Array): Promise<IAnnonymousKeys>
  deriveReadKey (writeKey: Uint8Array): Promise<Uint8Array>
  decryptMessage (signReadKey: Uint8Array, signWriteKey: Uint8Array, readKey: Uint8Array, message: IEncryptedMessage): Promise<IDecryption>
  createSecretKey(): Promise<Uint8Array>
  decrypt(secretKey: Uint8Array, encrypted: IEncodable): Promise<IEncodable>
  encrypt(secretKey: Uint8Array, body: IEncodable): Promise<Uint8Array>
  encryptMessage (annonymousReadKey: Uint8Array, annonymousWriteKey: Uint8Array, writeKey: Uint8Array, message: IEncodable): Promise<{
    signature: Uint8Array
    body: Uint8Array
  }>
  initHandshake (): Promise<IKeys>
  computeSecret (pri: Uint8Array, remotePublic: Uint8Array): Promise<Uint8Array>
  createKeys (): Promise<IKeys>
}
