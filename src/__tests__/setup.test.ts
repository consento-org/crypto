import { ISenderOptions, IReceiverOptions, IAnnonymousOptions } from '../types'
import { setup } from '../setup'
import { bufferToString, Buffer } from '../util/buffer'
import { cores } from '../core/cores'

for (const { name, crypto } of cores) {
  const variant = setup(crypto)
  describe(`${name}: Permission and encryption for channels`, () => {
    const { Sender, Receiver, Annonymous } = variant
    it('a new sender knows all the secrets', async () => {
      const sender = Sender.create()
      expect((await sender.id()).length).toBe(32)
      expect(await sender.idBase64()).toBeDefined() // called twice for cache test!
      expect(await sender.idBase64()).toBe(bufferToString(await sender.id(), 'base64'))
      expect(await sender.idHex()).toBeDefined() // called twice for cache test!
      expect(await sender.idHex()).toBe(bufferToString(await sender.id(), 'hex'))
      expect(await sender.receiveKey()).toBeDefined()
      expect(sender.sendKey).toBeDefined()
    })

    it('an annonymous can be restored using the id only', async () => {
      const annonymous = Sender.create().newAnnonymous()
      expect(await annonymous.id()).toBeDefined()
      expect(await annonymous.idBase64()).toBe(bufferToString(await annonymous.id(), 'base64'))
      expect(await annonymous.idHex()).toBe(bufferToString(await annonymous.id(), 'hex'))
    })

    it('restoring a partial channel from a base64 string', async () => {
      const id = await (Sender.create().id())
      const idBase64 = bufferToString(id, 'base64')
      const annonymous = new Annonymous({ id: idBase64 })
      expect(bufferToString(await annonymous.id(), 'base64')).toBe(idBase64)
    })

    it('two channels have different ids', async () => {
      const a = Sender.create()
      const b = Sender.create()
      expect(await a.idBase64()).not.toBe(await b.idBase64())
    })

    it('a sender can be restored from its smallJSON representation', async () => {
      const original = Sender.create()
      const json = await original.smallJSON()
      expect(Object.keys(json)).toEqual(['sendKey'])
      expect(typeof json.sendKey).toBe('string')
      const recovered = new Sender(json as ISenderOptions)
      expect(await recovered.idBase64()).toBe(await original.idBase64())
      expect(await recovered.compare(original)).toBe(0)
    })

    it('a sender can be restored from its quickJSON representation', async () => {
      const original = Sender.create()
      const json = await original.quickJSON()
      expect(Object.keys(json)).toEqual(['sendKey', 'receiveKey'])
      expect(typeof json.sendKey).toBe('string')
      expect(typeof json.receiveKey).toBe('string')
      const recovered = new Sender(json as ISenderOptions)
      expect(await recovered.idBase64()).toBe(await original.idBase64())
      expect(await recovered.compare(original)).toBe(0)
    })

    it('a receiver can be restored from its quickJSON representation', async () => {
      const original = Sender.create().newReceiver()
      const json = await original.quickJSON()
      expect(Object.keys(json)).toEqual(['receiveKey'])
      expect(typeof json.receiveKey).toBe('string')
      const recovered = new Receiver(json as IReceiverOptions)
      expect(await recovered.idBase64()).toBe(await original.idBase64())
      expect(await recovered.equals(original)).toBe(true)
    })

    it('a receiver can be restored from its smallJSON representation', async () => {
      const original = Sender.create().newReceiver()
      const json = await original.smallJSON()
      expect(Object.keys(json)).toEqual(['receiveKey'])
      expect(typeof json.receiveKey).toBe('string')
      const recovered = new Receiver(json as IReceiverOptions)
      expect(await recovered.idBase64()).toBe(await original.idBase64())
      expect(await recovered.equals(original)).toBe(true)
    })

    it('a annonymous can be restored from its quickJSON representation', async () => {
      const original = Sender.create().newAnnonymous()
      const json = await original.quickJSON()
      expect(Object.keys(json)).toEqual(['id'])
      expect(typeof json.id).toBe('string')
      const recovered = new Annonymous(json as IAnnonymousOptions)
      expect(await recovered.idBase64()).toBe(await original.idBase64())
      expect(await recovered.compare(original)).toBe(0)
    })

    it('signing and verifying a message', async () => {
      const sender = await Sender.create()
      const body = Buffer.from('abcd')
      const signature = await sender.sign(body)
      expect(await sender.verify(signature, body)).toBe(true)
      expect(await sender.verifyMessage({ signature, body })).toBe(true)
    })

    it('signing and verifying a wrong message', async () => {
      const sender = Sender.create()
      const otherSender = Sender.create()
      const body = Buffer.from('abcd')
      const signature = await sender.sign(body)
      expect(await otherSender.verify(signature, body)).toBe(false)
      expect(await otherSender.verifyMessage({ signature, body })).toBe(false)
    })

    it('signing and verifying with a partial channel', async () => {
      const sender = Sender.create()
      const annonymous = sender.newAnnonymous()
      const body = Buffer.from('abcd')
      const signature = await sender.sign(body)
      expect(await annonymous.verify(signature, body)).toBe(true)
    })

    it('public channel can decrypt data created from private channel', async () => {
      const sender = Sender.create()
      const original = 'Hello World'
      const message = await sender.encrypt(original)
      const receiver = sender.newReceiver()
      expect((await receiver.decrypt(message)).body).toBe(original)
    })

    it('mulitple encryptions return different encryptions', async () => {
      const sender = Sender.create()
      const message = 'Hello World'
      expect(
        bufferToString((await sender.encrypt(message)).body, 'base64')
      ).not.toBe(
        bufferToString((await sender.encrypt(message)).body, 'base64')
      )
      expect(true).toBeTruthy()
    })

    it('sender as string', async () => {
      const sender = Sender.create()
      expect(await sender.toString()).toBe(`Sender[sendKey=${bufferToString(await sender.sendKey(), 'base64')}]`)
    })

    it('receiver as string', async () => {
      const receiver = Sender.create().newReceiver()
      expect(await receiver.toString()).toBe(`Receiver[receiveKey=${bufferToString(await receiver.receiveKey(), 'base64')}]`)
    })

    it('annonymous as string', async () => {
      const annonymous = Sender.create().newAnnonymous()
      expect(await annonymous.toString()).toBe(`Annonymous[id=${await annonymous.idBase64()}]`)
    })

    it('can be compared to any other combination of channels', async () => {
      const sender = new Sender({ sendKey: Buffer.from('uZPG3e99DnfSbURVKClY3TNLkgwT6d/driyJmZmV4gi2BSkIJHjmoU10MdBJBHYHeDLoUZSCZLDDQs1jJ2Hksg==', 'base64') })
      const otherSender = new Sender({ sendKey: Buffer.from('xfM6Hn7mFcw8FyPzZkqVttyjlRB/8xx6p75+jrKurVuJvca/GSwcO4m5mXtbHH007vcNbH8WhT7acMe5fl3fEA==', 'base64') })
      const receiver = sender.newReceiver()
      const annonymous = sender.newAnnonymous()

      expect(await sender.compare(receiver)).toBe(1)
      expect(await sender.compare(annonymous)).toBe(1)
      expect(await sender.compare(otherSender)).toBe(-1)
      expect(await otherSender.compare(sender)).toBe(1)
      expect(await receiver.compare(sender)).toBe(-1)
      expect(await receiver.compare(annonymous)).toBe(1)
      expect(await annonymous.compare(sender)).toBe(-1)
      expect(await annonymous.compare(receiver)).toBe(-1)
      expect(await annonymous.compare(otherSender.newAnnonymous())).toBe(1)
      expect(await annonymous.compare(null)).toBe(1)
      expect(await annonymous.compare(undefined)).toBe(1)
    })
  })

  describe(`${name}: Handshake`, () => {
    const { HandshakeInit, HandshakeAccept } = variant
    it('examplary handshake', async () => {
      const alice = new HandshakeInit()
      const initMsg = await alice.initMessage()
      const bob = new HandshakeAccept(initMsg)
      const acceptMsg = await bob.acceptMessage()
      const acceptEncrypted = await bob.sender.encrypt(acceptMsg)
      expect(await alice.receiver.decrypt(acceptEncrypted)).toEqual({
        body: acceptMsg
      })
      const { sender: aliceToBobSender, receiver: bobToAliceReceiver, finalMessage } = await alice.confirm(acceptMsg)
      const finalMessageVerify = await bob.receiver.decrypt(await aliceToBobSender.encrypt(finalMessage))
      expect(finalMessageVerify).toEqual({
        body: finalMessage
      })

      const { sender: bobToAliceSender, receiver: aliceToBobReceiver } = await bob.finalize(finalMessage)
      expect(await bobToAliceReceiver.decrypt(await bobToAliceSender.encrypt('Hello Alice'))).toEqual({
        body: 'Hello Alice'
      })
      expect(await aliceToBobReceiver.decrypt(await aliceToBobSender.encrypt('Hello Bob'))).toEqual({
        body: 'Hello Bob'
      })
    })
  })
}
