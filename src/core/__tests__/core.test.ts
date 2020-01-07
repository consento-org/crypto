import randomBytes from '@consento/sync-randombytes'
import { Buffer } from 'buffer'
import { IEncryptedMessage, IAnnonymousKeys, IEncodable } from '../types'
import { cores } from '../cores'

cores.forEach(({ name, crypto }) => {
  /* eslint @typescript-eslint/promise-function-async: "off" */
  const independentVerifyMessage = (channelId: Uint8Array, message: IEncryptedMessage): Promise<boolean> => {
    return crypto.verify(channelId, message.signature, message.body)
  }

  const senderEncryptMessage = async (annonymous: IAnnonymousKeys, channelWriteKey: Uint8Array, message: any): Promise<IEncryptedMessage> => {
    return crypto.encryptMessage(annonymous.read, annonymous.write, channelWriteKey, message)
  }

  const receiverDecryptMessage = async (annonymous: IAnnonymousKeys, channelReadKey: Uint8Array, message: IEncryptedMessage): Promise<IEncodable> => {
    return crypto.decryptMessage(annonymous.read, annonymous.write, channelReadKey, message)
  }

  const testMessage = async (message: any): Promise<void> => {
    const channelKeys = await crypto.createKeys()
    const annonymous = await crypto.deriveAnnonymousKeys(channelKeys.read)
    // You need the write key and annonymous keys in order to send a message
    const encrypted = await senderEncryptMessage(annonymous, channelKeys.write, message)
    // You need only the channelId aka. annonymous.read key in order to verify a message
    expect(await independentVerifyMessage(annonymous.read, encrypted)).toBeTruthy()// 'verified.')
    // You need the read key and annonymous keys in order to receive a message
    const result = await receiverDecryptMessage(annonymous, channelKeys.read, encrypted)
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
})
