import { ISenderOptions, IReceiverOptions, IAnnonymousOptions } from '../types'
import { setup } from '../setup'
import { bufferToString, Buffer } from '../util/buffer'
import { cores } from '../core/cores'
import { isAnnonymous } from '../util/isAnnonymous'
import { isReceiver } from '../util/isReceiver'
import { isSender } from '../util/isSender'

for (const { name, crypto } of cores) {
  const variant = setup(crypto)
  describe(`${name}: Permission and encryption for channels`, () => {
    const {
      createSender,
      Sender, Receiver, Annonymous,
      createSenderFromSendKey, createReceiverFromReceiveKey
    } = variant
    it('a new sender knows all the secrets', async () => {
      const sender = await createSender()
      expect(sender.id.length).toBe(32)
      expect(sender.idBase64).toBeDefined() // called twice for cache test!
      expect(sender.idBase64).toBe(bufferToString(sender.id, 'base64'))
      expect(sender.idHex).toBeDefined() // called twice for cache test!
      expect(sender.idHex).toBe(bufferToString(sender.id, 'hex'))
      expect(sender.receiveKey).toBeDefined()
      expect(sender.sendKey).toBeDefined()
    })

    it('an annonymous can be restored using the id only', async () => {
      const annonymous = await createSender()
      expect(annonymous.id).toBeDefined()
      expect(annonymous.idBase64).toBe(bufferToString(annonymous.id, 'base64'))
      expect(annonymous.idHex).toBe(bufferToString(annonymous.id, 'hex'))
    })

    it('restoring a partial channel from a base64 string', async () => {
      const id = (await createSender()).id
      const idBase64 = bufferToString(id, 'base64')
      const annonymous = new Annonymous({ id: idBase64 })
      expect(bufferToString(annonymous.id, 'base64')).toBe(idBase64)
    })

    it('two channels have different ids', async () => {
      const a = await createSender()
      const b = await createSender()
      expect(a.idBase64).not.toBe(b.idBase64)
    })

    it('a sender can be restored from its toJSON representation', async () => {
      const original = await createSender()
      const json = original.toJSON()
      expect(Object.keys(json)).toEqual(['id', 'sendKey', 'receiveKey'])
      expect(typeof json.sendKey).toBe('string')
      const recovered = new Sender(json as ISenderOptions)
      expect(recovered.idBase64).toBe(original.idBase64)
      expect(recovered.compare(original)).toBe(0)
      expect(isAnnonymous(recovered)).toBe(true)
      expect(isReceiver(recovered)).toBe(true)
      expect(isSender(recovered)).toBe(true)
    })

    it('a sender can be restored from its sendKey only', async () => {
      const original = await createSender()
      const recovered = await createSenderFromSendKey(original.sendKey)
      expect(recovered.idBase64).toBe(original.idBase64)
      expect(recovered.compare(original)).toBe(0)
      expect(isAnnonymous(recovered)).toBe(true)
      expect(isReceiver(recovered)).toBe(true)
      expect(isSender(recovered)).toBe(true)
    })

    it('a receiver can be restored from its toJSON representation', async () => {
      const original = (await createSender()).newReceiver()
      const json = original.toJSON()
      expect(Object.keys(json)).toEqual(['id', 'receiveKey'])
      expect(typeof json.receiveKey).toBe('string')
      const recovered = new Receiver(json as IReceiverOptions)
      expect(recovered.idBase64).toBe(original.idBase64)
      expect(recovered.equals(original)).toBe(true)
      expect(isAnnonymous(recovered)).toBe(true)
      expect(isReceiver(recovered)).toBe(true)
      expect(isSender(recovered)).toBe(false)
    })

    it('a receiver can be restored from its receiveKey only', async () => {
      const original = (await createSender()).newReceiver()
      const recovered = await createReceiverFromReceiveKey(original.receiveKey)
      expect(recovered.idBase64).toBe(original.idBase64)
      expect(recovered.equals(original)).toBe(true)
      expect(isAnnonymous(recovered)).toBe(true)
      expect(isReceiver(recovered)).toBe(true)
      expect(isSender(recovered)).toBe(false)
    })

    it('a annonymous can be restored from its toJSON representation', async () => {
      const original = (await createSender()).newAnnonymous()
      const json = original.toJSON()
      expect(Object.keys(json)).toEqual(['id'])
      expect(typeof json.id).toBe('string')
      const recovered = new Annonymous(json as IAnnonymousOptions)
      expect(recovered.idBase64).toBe(original.idBase64)
      expect(recovered.compare(original)).toBe(0)
      expect(isAnnonymous(recovered)).toBe(true)
      expect(isReceiver(recovered)).toBe(false)
      expect(isSender(recovered)).toBe(false)
    })

    it('signing and verifying a message', async () => {
      const sender = await createSender()
      const body = Buffer.from('abcd')
      const signature = await sender.sign(body)
      expect(await sender.verify(signature, body)).toBe(true)
      expect(await sender.verifyMessage({ signature, body })).toBe(true)
    })

    it('signing and verifying a wrong message', async () => {
      const sender = await createSender()
      const otherSender = await createSender()
      const body = Buffer.from('abcd')
      const signature = await sender.sign(body)
      expect(await otherSender.verify(signature, body)).toBe(false)
      expect(await otherSender.verifyMessage({ signature, body })).toBe(false)
    })

    it('signing and verifying with a partial channel', async () => {
      const sender = await createSender()
      const annonymous = sender.newAnnonymous()
      const body = Buffer.from('abcd')
      const signature = await sender.sign(body)
      expect(await annonymous.verify(signature, body)).toBe(true)
    })

    it('public channel can decrypt data created from private channel', async () => {
      const sender = await createSender()
      const original = 'Hello World'
      const message = await sender.encrypt(original)
      const receiver = sender.newReceiver()
      expect((await receiver.decrypt(message)).body).toBe(original)
    })

    it('mulitple encryptions return different encryptions', async () => {
      const sender = await createSender()
      const message = 'Hello World'
      expect(
        bufferToString((await sender.encrypt(message)).body, 'base64')
      ).not.toBe(
        bufferToString((await sender.encrypt(message)).body, 'base64')
      )
      expect(true).toBeTruthy()
    })

    it('sender as string', async () => {
      const sender = await createSender()
      expect(await sender.toString()).toBe(`Sender[sendKey=${bufferToString(sender.sendKey, 'base64')}]`)
    })

    it('receiver as string', async () => {
      const receiver = (await createSender()).newReceiver()
      expect(await receiver.toString()).toBe(`Receiver[receiveKey=${bufferToString(receiver.receiveKey, 'base64')}]`)
    })

    it('annonymous as string', async () => {
      const annonymous = (await createSender()).newAnnonymous()
      expect(await annonymous.toString()).toBe(`Annonymous[id=${annonymous.idBase64}]`)
    })

    it('can be compared to any other combination of channels', async () => {
      const sender = await createSenderFromSendKey('uZPG3e99DnfSbURVKClY3TNLkgwT6d/driyJmZmV4gi2BSkIJHjmoU10MdBJBHYHeDLoUZSCZLDDQs1jJ2Hksg==')
      const otherSender = await createSenderFromSendKey('xfM6Hn7mFcw8FyPzZkqVttyjlRB/8xx6p75+jrKurVuJvca/GSwcO4m5mXtbHH007vcNbH8WhT7acMe5fl3fEA==')
      const receiver = sender.newReceiver()
      const annonymous = sender.newAnnonymous()

      expect(sender.compare(receiver)).toBe(1)
      expect(sender.compare(annonymous)).toBe(1)
      expect(sender.compare(otherSender)).toBe(-1)
      expect(otherSender.compare(sender)).toBe(1)
      expect(receiver.compare(sender)).toBe(-1)
      expect(receiver.compare(annonymous)).toBe(1)
      expect(annonymous.compare(sender)).toBe(-1)
      expect(annonymous.compare(receiver)).toBe(-1)
      expect(annonymous.compare(otherSender.newAnnonymous())).toBe(1)
      expect(annonymous.compare(null)).toBe(1)
      expect(annonymous.compare(undefined)).toBe(1)
    })
  })

  describe(`${name}: Handshake`, () => {
    const { initHandshake, acceptHandshake, HandshakeAccept, HandshakeInit, HandshakeConfirmation } = variant
    it('examplary handshake', async () => {
      const alice = await initHandshake()
      const bob = await acceptHandshake(alice.firstMessage)
      const acceptEncrypted = await bob.sender.encrypt(bob.acceptMessage)
      expect(await alice.receiver.decrypt(acceptEncrypted)).toEqual({
        body: bob.acceptMessage
      })
      const { connection: { sender: aliceToBobSender, receiver: bobToAliceReceiver }, finalMessage } = await alice.confirm(bob.acceptMessage)
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
    it('serialization', async () => {
      const aliceOriginal = await initHandshake()
      const bobOriginal = await acceptHandshake(aliceOriginal.firstMessage)
      const alice = new HandshakeInit(aliceOriginal.toJSON())
      const bob = new HandshakeAccept(bobOriginal.toJSON())
      const confirmationOriginal = await alice.confirm(bob.acceptMessage)
      const confirmation = new HandshakeConfirmation(confirmationOriginal.toJSON())
      const { connection: { sender: aliceToBobSender, receiver: bobToAliceReceiver }, finalMessage } = confirmation
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
