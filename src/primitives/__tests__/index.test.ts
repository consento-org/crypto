import { bufferToString, bufferCompare } from '../../util/buffer'
import { Buffer } from '../../util/types'
import { createChannel, Verifier, Reader, Writer } from '..'

describe('Permission and encryption for channels', () => {
  it('a new receiver knows all the secrets', () => {
    const { reader: receiver, writer: sender, verifier: annonymous } = createChannel()
    expect(receiver.channelKey.length).toBe(32)
    expect(receiver.channelKeyBase64).toBeDefined() // called twice for cache test!
    expect(receiver.channelKeyBase64).toBe(bufferToString(annonymous.channelKey, 'base64'))
    expect(receiver.channelKeyHex).toBeDefined() // called twice for cache test!
    expect(receiver.channelKeyHex).toBe(bufferToString(annonymous.channelKey, 'hex'))
    expect(receiver.readerKey).toBeDefined()
    expect(receiver.readerKey.length).toBe(96)
    expect(sender.writerKey).toBeDefined()
    expect(sender.writerKey.length).toBe(128)
  })

  it('restoring a partial channel from a base64 string', () => {
    const { verifier: { channelKey: id } } = createChannel()
    const idBase64 = bufferToString(id, 'base64')
    const annonymous = new Verifier({ channelKey: idBase64 })
    expect(bufferToString(annonymous.channelKey, 'base64')).toBe(idBase64)
    expect(annonymous.channelKey.length).toBe(32)
  })

  it('two channels have different ids', () => {
    const { reader: a } = createChannel()
    const { reader: b } = createChannel()
    expect(bufferToString(a.readerKey, 'base64')).not.toBe(bufferToString(b.readerKey, 'base64'))
  })

  it('a sender can be restored from its toJSON representation', () => {
    const { writer: original } = createChannel()
    const json = original.toJSON()
    if (!('writerKey' in json)) {
      throw new Error('Missing sendKey')
    }
    expect(Object.keys(json)).toEqual(['writerKey'])
    expect(typeof json.writerKey).toBe('string')
    const recovered = new Writer(json)
    expect(bufferToString(recovered.writerKey)).toBe(bufferToString(original.writerKey))
    expect(recovered.writerKeyBase64).toBe(original.writerKeyBase64)
    expect(recovered.channelKey.length).toBe(32)
    expect(recovered.writerKey.length).toBe(128)
  })

  it('a sender can be restored from its sendKey only', () => {
    const { writer: original } = createChannel()
    const recovered = new Writer({ writerKey: original.writerKey })
    expect(bufferToString(recovered.writerKey)).toBe(bufferToString(original.writerKey))
    expect(recovered.channelKeyHex).toBe(original.channelKeyHex)
  })

  it('a receiver can be restored from its toJSON representation', () => {
    const { reader: original, writer: sender } = createChannel()
    const json = original.toJSON()
    expect(Object.keys(json)).toEqual(['readerKey'])
    expect(typeof json.readerKey).toBe('string')
    const recovered = new Reader(json)
    expect(bufferToString(recovered.readerKey)).toBe(bufferToString(original.readerKey))
    expect(recovered.readerKeyBase64).toBe(original.readerKeyBase64)
    expect(recovered.channelKeyBase64).toBe(original.channelKeyBase64)
    const recoveredId = Buffer.from(recovered.channelKeyBase64, 'base64')
    expect(recoveredId.length).toBe(32)
    expect(bufferCompare(recoveredId, original.channelKey)).toBe(0)
    const message = Buffer.from('Hello World')
    const recoveredAnnonymous = new Verifier(recovered.verifier.toJSON())
    expect(recoveredAnnonymous.verify(sender.sign(message), message)).toBe(true)
    expect(recovered.verifier.verify(sender.sign(message), message)).toBe(true)
    expect(recovered.decrypt(sender.encrypt('hi!'))).toEqual({ body: 'hi!' })
    expect(original.decrypt(sender.encrypt('hi!'))).toEqual({ body: 'hi!' })
  })

  it('a receiver can be restored from its receiveKey only', () => {
    const { reader: original, writer: sender } = createChannel()
    const recovered = new Reader({ readerKey: original.readerKey })
    expect(bufferToString(recovered.readerKey)).toBe(bufferToString(original.readerKey))
    expect(sender.writerKeyBase64).toBe(sender.writerKeyBase64)
  })

  it('a annonymous can be restored from its toJSON representation', () => {
    const { verifier: original } = createChannel()
    const json = original.toJSON()
    if (!('channelKey' in json)) {
      throw new Error('Missing id property')
    }
    expect(Object.keys(json)).toEqual(['channelKey'])
    expect(typeof json.channelKey).toBe('string')
    const recovered = new Verifier(json)
    expect(recovered.channelKeyBase64).toBe(original.channelKeyBase64)
  })

  it('signing and verifying a message', () => {
    const { writer: sender, verifier: annonymous } = createChannel()
    const body = Buffer.from('abcd')
    const signature = sender.sign(body)
    expect(annonymous.verify(signature, body)).toBe(true)
    expect(annonymous.verifyMessage({ signature, body })).toBe(true)
  })

  it('signing and verifying a wrong message', () => {
    const { writer: sender } = createChannel()
    const { verifier: annonymous } = createChannel()
    const body = Buffer.from('abcd')
    const signature = sender.sign(body)
    expect(annonymous.verify(signature, body)).toBe(false)
    expect(annonymous.verifyMessage({ signature, body })).toBe(false)
  })

  it('signing and verifying with a partial channel', () => {
    const { writer: sender, verifier: annonymous } = createChannel()
    const body = Buffer.from('abcd')
    const signature = sender.sign(body)
    expect(annonymous.verify(signature, body)).toBe(true)
  })

  it('receiver can decrypt data from sender', () => {
    const { reader: receiver, writer: sender } = createChannel()
    const original = 'Hello World'
    const message = sender.encrypt(original)
    expect(receiver.decrypt(message)).toEqual({ body: original })
  })

  it('multiple encryptions return different encryptions', () => {
    const { writer: sender } = createChannel()
    const message = 'Hello World'
    expect(
      bufferToString((sender.encrypt(message)).body, 'base64')
    ).not.toBe(
      bufferToString((sender.encrypt(message)).body, 'base64')
    )
    expect(true).toBeTruthy()
  })

  it('sender as string', () => {
    const { writer: sender } = createChannel()
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    expect(sender.toString()).toBe(`Writer[${sender.channelKeyBase64}]`)
  })

  it('receiver as string', () => {
    const { reader: receiver } = createChannel()
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    expect(receiver.toString()).toBe(`Reader[${receiver.channelKeyBase64}]`)
  })

  it('annonymous as string', () => {
    const { verifier: annonymous } = createChannel()
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    expect(annonymous.toString()).toBe(`Verifier[${annonymous.channelKeyBase64}]`)
  })

  it('encrypt with out signing', () => {
    const { writer: sender, reader: receiver } = createChannel()
    expect(receiver.decrypt(sender.encryptOnly('hello world'))).toEqual({ body: 'hello world' })
  })
})
