/* eslint-disable @typescript-eslint/method-signature-style */
import { IEncodable } from '../util/types'

export interface IEncryptedMessage {
  signature: Uint8Array
  body: Uint8Array
}

export interface IRawKeys {
  privateKey: Uint8Array
  publicKey: Uint8Array
}

export enum EDecryptionError {
  invalidEncryption = 'invalid-encryption',
  invalidSignature = 'invalid-signature'
}

export interface IDecryptionError {
  error: EDecryptionError
}

export interface IDecryptionSuccess {
  body: IEncodable
}

export type IDecryption = IDecryptionSuccess | IDecryptionError

export interface ICryptoCore {
  deriveKdfKey (key: Uint8Array, index?: number): Promise<Uint8Array>
  sign (signSecretKey: Uint8Array, body: Uint8Array): Promise<Uint8Array>
  verify (signPublicKey: Uint8Array, signature: Uint8Array, body: Uint8Array): Promise<boolean>
  createSecretKey(): Promise<Uint8Array>
  createEncryptionKeys (): Promise<IRawKeys>
  createSignKeys (): Promise<IRawKeys>
  decrypt(secretKey: Uint8Array, encrypted: Uint8Array): Promise<IEncodable>
  encrypt(secretKey: Uint8Array, body: IEncodable): Promise<Uint8Array>
  decryptMessage (verifyKey: Uint8Array, writeKey: Uint8Array, readKey: Uint8Array, message: IEncryptedMessage | Uint8Array): Promise<IDecryption>
  encryptMessage (writeKey: Uint8Array, message: IEncodable): Promise<Uint8Array>
  encryptAndSignMessage (signKey: Uint8Array, writeKey: Uint8Array, message: IEncodable): Promise<{
    signature: Uint8Array
    body: Uint8Array
  }>
  initHandshake (): Promise<IRawKeys>
  computeSecret (privateKey: Uint8Array, remotePublic: Uint8Array): Promise<Uint8Array>
}
