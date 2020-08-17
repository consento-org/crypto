import { setupPrimitives } from '../'
import { cores } from '../../core/cores'
import { bufferToString, bufferCompare } from '../../util/buffer'
import { Buffer } from '../../util/types'

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
      expect(receiver.receiveKey.length).toBe(160)
      expect(sender.sendKey).toBeDefined()
      expect(sender.sendKey.length).toBe(128)
    })

    it('restoring a partial channel from a base64 string', async () => {
      const { annonymous: { id } } = await createReceiver()
      const idBase64 = bufferToString(id, 'base64')
      const annonymous = new Annonymous({ id: idBase64 })
      expect(bufferToString(annonymous.id, 'base64')).toBe(idBase64)
      expect(annonymous.id.length).toBe(32)
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
      expect(recovered.sendKeyBase64).toBe(original.sendKeyBase64)
      expect(recovered.id.length).toBe(32)
      expect(recovered.sendKey.length).toBe(128)
    })

    it('a sender can be restored from its sendKey only', async () => {
      const original = await (await createReceiver()).sender
      const recovered = await new Sender({ sendKey: original.sendKey })
      expect(bufferToString(recovered.sendKey)).toBe(bufferToString(original.sendKey))
      expect(recovered.idHex).toBe(original.idHex)
    })

    it('a receiver can be restored from its toJSON representation', async () => {
      const original = await createReceiver()
      const json = original.toJSON()
      expect(Object.keys(json)).toEqual(['receiveKey'])
      expect(typeof json.receiveKey).toBe('string')
      const recovered = new Receiver(json)
      expect(bufferToString(recovered.receiveKey)).toBe(bufferToString(original.receiveKey))
      expect(recovered.receiveKeyBase64).toBe(original.receiveKeyBase64)
      expect(recovered.sender.idBase64).toBe(original.sender.idBase64)
      expect(recovered.idBase64).toBe(original.idBase64)
      const recoveredId = Buffer.from(recovered.idBase64, 'base64')
      expect(recoveredId.length).toBe(32)
      expect(bufferCompare(recoveredId, original.id)).toBe(0)
      const message = Buffer.from('Hello World')
      const recoveredSender = new Sender(recovered.sender.toJSON())
      const recoveredAnnonymous = new Annonymous(recoveredSender.annonymous.toJSON())
      expect(await recoveredAnnonymous.verify(await original.sender.sign(message), message)).toBe(true)
      expect(await original.sender.annonymous.verify(await recoveredSender.sign(message), message)).toBe(true)
      expect(await recovered.receiver.decrypt(await recoveredSender.encrypt('hi!'))).toEqual({ body: 'hi!' })
      expect(await original.receiver.decrypt(await original.sender.encrypt('hi!'))).toEqual({ body: 'hi!' })
    })

    it('a receiver can be restored from its receiveKey only', async () => {
      const original = await createReceiver()
      const recovered = new Receiver({ receiveKey: original.receiveKey })
      expect(bufferToString(recovered.receiveKey)).toBe(bufferToString(original.receiveKey))
      expect(recovered.sender.sendKeyBase64).toBe(original.sender.sendKeyBase64)
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
  })
}
