import { setupPrimitives } from '../'
import { cores } from '../../core/cores'
import { bufferToString, Buffer } from '../../util/buffer'
import { isAnnonymous } from '../../util/isAnnonymous'
import { isReceiver } from '../../util/isReceiver'
import { isSender } from '../../util/isSender'

for (const { name, crypto } of cores) {
  const variant = setupPrimitives(crypto)
  describe(`${name}: Permission and encryption for channels`, () => {
    const {
      createReceiver,
      Sender, Receiver, Annonymous
    } = variant

    it('a new receiver knows all the secrets', async () => {
      const receiver = await createReceiver()
      const { sender, annonymous } = receiver
      expect(receiver.id.length).toBe(32)
      expect(receiver.idBase64).toBeDefined() // called twice for cache test!
      expect(receiver.idBase64).toBe(bufferToString(annonymous.id, 'base64'))
      expect(receiver.idHex).toBeDefined() // called twice for cache test!
      expect(receiver.idHex).toBe(bufferToString(annonymous.id, 'hex'))
      expect(receiver.receiveKey).toBeDefined()
      expect(sender.sendKey).toBeDefined()
      expect(isAnnonymous(annonymous)).toBe(true)
      expect(isSender(annonymous)).toBe(false)
      expect(isReceiver(annonymous)).toBe(false)
    })

    it('restoring a partial channel from a base64 string', async () => {
      const { annonymous: { id } } = await createReceiver()
      const idBase64 = bufferToString(id, 'base64')
      const annonymous = new Annonymous({ id: idBase64 })
      expect(bufferToString(annonymous.id, 'base64')).toBe(idBase64)
    })

    it('two channels have different ids', async () => {
      const a = await createReceiver()
      const b = await createReceiver()
      expect(bufferToString(a.receiveKey, 'base64')).not.toBe(bufferToString(b.receiveKey, 'base64'))
    })

    it('a sender can be restored from its toJSON representation', async () => {
      const { sender: original } = await createReceiver()
      const json = original.toJSON()
      if (!('sendKey' in json)) {
        throw new Error('Missing sendKey')
      }
      expect(Object.keys(json)).toEqual(['sendKey'])
      expect(typeof json.sendKey).toBe('string')
      const recovered = new Sender(json)
      expect(bufferToString(recovered.sendKey)).toBe(bufferToString(original.sendKey))
      expect(recovered.compare(original)).toBe(0)
      expect(isSender(recovered)).toBe(true)
      expect(isReceiver(recovered)).toBe(false)
    })

    it('a sender can be restored from its sendKey only', async () => {
      const original = await (await createReceiver()).sender
      const recovered = await new Sender({ sendKey: original.sendKey })
      expect(bufferToString(recovered.sendKey)).toBe(bufferToString(original.sendKey))
      expect(recovered.compare(original)).toBe(0)
      expect(isSender(recovered)).toBe(true)
      expect(isReceiver(recovered)).toBe(false)
    })

    it('a receiver can be restored from its toJSON representation', async () => {
      const original = await createReceiver()
      const json = original.toJSON()
      expect(Object.keys(json)).toEqual(['receiveKey'])
      expect(typeof json.receiveKey).toBe('string')
      const recovered = new Receiver(json)
      expect(bufferToString(recovered.receiveKey)).toBe(bufferToString(original.receiveKey))
      expect(recovered.compare(original)).toBe(0)
      expect(recovered.equals(original)).toBe(true)
      expect(isReceiver(recovered)).toBe(true)
      expect(isSender(recovered)).toBe(false)
    })

    it('a receiver can be restored from its receiveKey only', async () => {
      const original = await createReceiver()
      const recovered = new Receiver({ receiveKey: original.receiveKey })
      expect(bufferToString(recovered.receiveKey)).toBe(bufferToString(original.receiveKey))
      expect(recovered.equals(original)).toBe(true)
      expect(isAnnonymous(recovered)).toBe(false)
      expect(isReceiver(recovered)).toBe(true)
      expect(isSender(recovered)).toBe(false)
    })

    it('a annonymous can be restored from its toJSON representation', async () => {
      const { annonymous: original } = await createReceiver()
      const json = original.toJSON()
      if (!('id' in json)) {
        throw new Error('Missing id property')
      }
      expect(Object.keys(json)).toEqual(['id'])
      expect(typeof json.id).toBe('string')
      const recovered = new Annonymous(json)
      expect(recovered.idBase64).toBe(original.idBase64)
      expect(recovered.compare(original)).toBe(0)
      expect(isAnnonymous(recovered)).toBe(true)
      expect(isReceiver(recovered)).toBe(false)
      expect(isSender(recovered)).toBe(false)
    })

    it('signing and verifying a message', async () => {
      const { sender, annonymous } = await createReceiver()
      const body = Buffer.from('abcd')
      const signature = await sender.sign(body)
      expect(await annonymous.verify(signature, body)).toBe(true)
      expect(await annonymous.verifyMessage({ signature, body })).toBe(true)
    })

    it('signing and verifying a wrong message', async () => {
      const { sender } = await createReceiver()
      const { annonymous } = await createReceiver()
      const body = Buffer.from('abcd')
      const signature = await sender.sign(body)
      expect(await annonymous.verify(signature, body)).toBe(false)
      expect(await annonymous.verifyMessage({ signature, body })).toBe(false)
    })

    it('signing and verifying with a partial channel', async () => {
      const { sender, annonymous } = await createReceiver()
      const body = Buffer.from('abcd')
      const signature = await sender.sign(body)
      expect(await annonymous.verify(signature, body)).toBe(true)
    })

    it('receiver can decrypt data from sender', async () => {
      const receiver = await createReceiver()
      const original = 'Hello World'
      const message = await receiver.sender.encrypt(original)
      expect(await receiver.decrypt(message)).toEqual({ body: original })
    })

    it('multiple encryptions return different encryptions', async () => {
      const { sender } = await createReceiver()
      const message = 'Hello World'
      expect(
        bufferToString((await sender.encrypt(message)).body, 'base64')
      ).not.toBe(
        bufferToString((await sender.encrypt(message)).body, 'base64')
      )
      expect(true).toBeTruthy()
    })

    it('sender as string', async () => {
      const { sender } = await createReceiver()
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      expect(sender.toString()).toBe(`Sender[sendKey=${bufferToString(sender.sendKey, 'base64')}]`)
    })

    it('receiver as string', async () => {
      const receiver = await createReceiver()
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      expect(receiver.toString()).toBe(`Receiver[receiveKey=${bufferToString(receiver.receiveKey, 'base64')}]`)
    })

    it('annonymous as string', async () => {
      const { annonymous } = await createReceiver()
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      expect(annonymous.toString()).toBe(`Annonymous[id=${annonymous.idBase64}]`)
    })

    /*
    it('can be compared to any other combination of channels', async () => {
      const sender = await new Sender({ sendKey: 'uZPG3e99DnfSbURVKClY3TNLkgwT6d/driyJmZmV4gi2BSkIJHjmoU10MdBJBHYHeDLoUZSCZLDDQs1jJ2Hksg==' })
      const otherSender = await new Sender({ sendKey: 'xfM6Hn7mFcw8FyPzZkqVttyjlRB/8xx6p75+jrKurVuJvca/GSwcO4m5mXtbHH007vcNbH8WhT7acMe5fl3fEA==' })
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
    */
  })
}
