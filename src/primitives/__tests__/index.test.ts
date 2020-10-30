import { bufferToString, bufferCompare } from '../../util/buffer'
import { Buffer } from '../../util/types'
import { createChannel, Annonymous, Receiver, Sender } from '..'

describe('Permission and encryption for channels', () => {
  it('a new receiver knows all the secrets', () => {
    const { receiver, sender, annonymous } = createChannel()
    expect(receiver.id.length).toBe(32)
    expect(receiver.idBase64).toBeDefined() // called twice for cache test!
    expect(receiver.idBase64).toBe(bufferToString(annonymous.id, 'base64'))
    expect(receiver.idHex).toBeDefined() // called twice for cache test!
    expect(receiver.idHex).toBe(bufferToString(annonymous.id, 'hex'))
    expect(receiver.receiveKey).toBeDefined()
    expect(receiver.receiveKey.length).toBe(96)
    expect(sender.sendKey).toBeDefined()
    expect(sender.sendKey.length).toBe(128)
  })

  it('restoring a partial channel from a base64 string', () => {
    const { annonymous: { id } } = createChannel()
    const idBase64 = bufferToString(id, 'base64')
    const annonymous = new Annonymous({ id: idBase64 })
    expect(bufferToString(annonymous.id, 'base64')).toBe(idBase64)
    expect(annonymous.id.length).toBe(32)
  })

  it('two channels have different ids', () => {
    const { receiver: a } = createChannel()
    const { receiver: b } = createChannel()
    expect(bufferToString(a.receiveKey, 'base64')).not.toBe(bufferToString(b.receiveKey, 'base64'))
  })

  it('a sender can be restored from its toJSON representation', () => {
    const { sender: original } = createChannel()
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

  it('a sender can be restored from its sendKey only', () => {
    const { sender: original } = createChannel()
    const recovered = new Sender({ sendKey: original.sendKey })
    expect(bufferToString(recovered.sendKey)).toBe(bufferToString(original.sendKey))
    expect(recovered.idHex).toBe(original.idHex)
  })

  it('a receiver can be restored from its toJSON representation', () => {
    const { receiver: original, sender } = createChannel()
    const json = original.toJSON()
    expect(Object.keys(json)).toEqual(['receiveKey'])
    expect(typeof json.receiveKey).toBe('string')
    const recovered = new Receiver(json)
    expect(bufferToString(recovered.receiveKey)).toBe(bufferToString(original.receiveKey))
    expect(recovered.receiveKeyBase64).toBe(original.receiveKeyBase64)
    expect(recovered.idBase64).toBe(original.idBase64)
    const recoveredId = Buffer.from(recovered.idBase64, 'base64')
    expect(recoveredId.length).toBe(32)
    expect(bufferCompare(recoveredId, original.id)).toBe(0)
    const message = Buffer.from('Hello World')
    const recoveredAnnonymous = new Annonymous(recovered.annonymous.toJSON())
    expect(recoveredAnnonymous.verify(sender.sign(message), message)).toBe(true)
    expect(recovered.annonymous.verify(sender.sign(message), message)).toBe(true)
    expect(recovered.decrypt(sender.encrypt('hi!'))).toEqual({ body: 'hi!' })
    expect(original.decrypt(sender.encrypt('hi!'))).toEqual({ body: 'hi!' })
  })

  it('a receiver can be restored from its receiveKey only', () => {
    const { receiver: original, sender } = createChannel()
    const recovered = new Receiver({ receiveKey: original.receiveKey })
    expect(bufferToString(recovered.receiveKey)).toBe(bufferToString(original.receiveKey))
    expect(sender.sendKeyBase64).toBe(sender.sendKeyBase64)
  })

  it('a annonymous can be restored from its toJSON representation', () => {
    const { annonymous: original } = createChannel()
    const json = original.toJSON()
    if (!('id' in json)) {
      throw new Error('Missing id property')
    }
    expect(Object.keys(json)).toEqual(['id'])
    expect(typeof json.id).toBe('string')
    const recovered = new Annonymous(json)
    expect(recovered.idBase64).toBe(original.idBase64)
  })

  it('signing and verifying a message', () => {
    const { sender, annonymous } = createChannel()
    const body = Buffer.from('abcd')
    const signature = sender.sign(body)
    expect(annonymous.verify(signature, body)).toBe(true)
    expect(annonymous.verifyMessage({ signature, body })).toBe(true)
  })

  it('signing and verifying a wrong message', () => {
    const { sender } = createChannel()
    const { annonymous } = createChannel()
    const body = Buffer.from('abcd')
    const signature = sender.sign(body)
    expect(annonymous.verify(signature, body)).toBe(false)
    expect(annonymous.verifyMessage({ signature, body })).toBe(false)
  })

  it('signing and verifying with a partial channel', () => {
    const { sender, annonymous } = createChannel()
    const body = Buffer.from('abcd')
    const signature = sender.sign(body)
    expect(annonymous.verify(signature, body)).toBe(true)
  })

  it('receiver can decrypt data from sender', () => {
    const { receiver, sender } = createChannel()
    const original = 'Hello World'
    const message = sender.encrypt(original)
    expect(receiver.decrypt(message)).toEqual({ body: original })
  })

  it('multiple encryptions return different encryptions', () => {
    const { sender } = createChannel()
    const message = 'Hello World'
    expect(
      bufferToString((sender.encrypt(message)).body, 'base64')
    ).not.toBe(
      bufferToString((sender.encrypt(message)).body, 'base64')
    )
    expect(true).toBeTruthy()
  })

  it('sender as string', () => {
    const { sender } = createChannel()
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    expect(sender.toString()).toBe(`Sender[id=${sender.idBase64}]`)
  })

  it('receiver as string', () => {
    const { receiver } = createChannel()
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    expect(receiver.toString()).toBe(`Receiver[id=${receiver.idBase64}]`)
  })

  it('annonymous as string', () => {
    const { annonymous } = createChannel()
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    expect(annonymous.toString()).toBe(`Annonymous[id=${annonymous.idBase64}]`)
  })

  it('encrypt with out signing', () => {
    const { sender, receiver } = createChannel()
    expect(receiver.decrypt(sender.encryptOnly('hello world'))).toEqual({ body: 'hello world' })
  })
})
