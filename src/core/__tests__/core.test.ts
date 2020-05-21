import randomBytes from '@consento/sync-randombytes'
import { Buffer } from 'buffer'
import { IEncryptedMessage, IEncodable, IRawKeys } from '../types'
import { cores } from '../cores'
import { bufferToString } from '../../util/buffer'

for (const { name, crypto } of cores) {
  const independentVerifyMessage = async (verifyKey: Uint8Array, message: IEncryptedMessage): Promise<boolean> => {
    return await crypto.verify(verifyKey, message.signature, message.body)
  }

  const senderEncryptMessage = async (annonymous: IRawKeys, encryptKeys: IRawKeys, message: any): Promise<IEncryptedMessage> => {
    return await crypto.encryptMessage(annonymous.privateKey, encryptKeys.publicKey, message)
  }

  const receiverDecryptMessage = async (annonymous: IRawKeys, encryptKeys: IRawKeys, message: IEncryptedMessage): Promise<IEncodable> => {
    return await crypto.decryptMessage(annonymous.publicKey, encryptKeys.publicKey, encryptKeys.privateKey, message)
  }

  const testMessage = async (message: any): Promise<void> => {
    const encryptKeys = await crypto.createEncryptionKeys()
    const signKeys = await crypto.createSignKeys()
    // You need the write key and annonymous keys in order to send a message
    const encrypted = await senderEncryptMessage(signKeys, encryptKeys, message)
    // You need only the channelId aka. annonymous.read key in order to verify a message
    expect(await independentVerifyMessage(signKeys.publicKey, encrypted)).toBeTruthy()// 'verified.')
    // You need the read key and annonymous keys in order to receive a message
    const result = await receiverDecryptMessage(signKeys, encryptKeys, encrypted)
    expect(result)
      .toEqual({
        body: message
      })// 'decrypted.'
  }

  describe(`${name} encrypt/decrypt`, () => {
    it('String(Hello World)', testMessage.bind(null, 'Hello World'))
    it('Math.random()', testMessage.bind(null, Math.random()))
    it('Object', testMessage.bind(null, {
      hello: 'world',
      num: Math.random()
    }))
    it('buffer', testMessage.bind(null, Buffer.from('hello world')))
    it('uint8array', testMessage.bind(null, new Uint8Array([62, 63, 64, 65])))
    it('randomBytes', testMessage.bind(null, randomBytes(new Uint8Array(19))))
    it('null', testMessage.bind(null, null))
  })

  describe(`${name} deriving keys`, () => {
    it('basic functionality', async () => {
      const key = await crypto.createSecretKey()
      const [derivedKey, derivedKey2] = await Promise.all([
        crypto.deriveKdfKey(key),
        crypto.deriveKdfKey(key)
      ])
      expect(bufferToString(derivedKey, 'base64')).toBe(bufferToString(derivedKey2, 'base64'))
    })
  })
}
