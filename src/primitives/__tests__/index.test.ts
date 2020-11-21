import { bufferToString, bufferCompare } from '../../util/buffer'
import { Buffer } from '../../util/types'
import { createChannel, Verifier, Reader, Writer, Channel, createSignVectors } from '..'
import prettyHash from 'pretty-hash'
import { decode, encode } from '@msgpack/msgpack'
import { SignVector } from '../SignVector'

describe('Permission and encryption for channels', () => {
  it('a channel is serializable', () => {
    const channel = createChannel({ codec: 'json' })
    const json = channel.toJSON()
    if (!('channelKey' in json)) {
      throw new Error('Missing channelKey')
    }
    expect(json.channelKey).toBe(channel.channelKeyBase64)
    const restored = new Channel(json)
    expect(restored.reader.decrypt(channel.writer.encrypt('hello'))).toEqual('hello')
    expect(channel.reader.decrypt(restored.writer.encrypt('world'))).toEqual('world')
  })

  it('a new receiver knows all the secrets', () => {
    const { reader: receiver, writer: sender, verifier: annonymous } = createChannel()
    expect(receiver.verifyKey.length).toBe(32)
    expect(receiver.verifyKeyBase64).toBeDefined() // called twice for cache test!
    expect(receiver.verifyKeyBase64).toBe(bufferToString(annonymous.verifyKey, 'base64'))
    expect(receiver.verifyKeyHex).toBeDefined() // called twice for cache test!
    expect(receiver.verifyKeyHex).toBe(bufferToString(annonymous.verifyKey, 'hex'))
    expect(receiver.readerKey).toBeDefined()
    expect(receiver.readerKey.length).toBe(96)
    expect(sender.writerKey).toBeDefined()
    expect(sender.writerKey.length).toBe(128)
  })

  it('restoring a partial channel from a base64 string', () => {
    const { verifier: { verifyKey: id } } = createChannel()
    const idBase64 = bufferToString(id, 'base64')
    const annonymous = new Verifier({ verifyKey: idBase64 })
    expect(bufferToString(annonymous.verifyKey, 'base64')).toBe(idBase64)
    expect(annonymous.verifyKey.length).toBe(32)
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
      throw new Error('Missing writerKey')
    }
    expect(Object.keys(json)).toEqual(['writerKey', 'codec'])
    expect(typeof json.writerKey).toBe('string')
    const recovered = new Writer(json)
    expect(bufferToString(recovered.writerKey)).toBe(bufferToString(original.writerKey))
    expect(recovered.writerKeyBase64).toBe(original.writerKeyBase64)
    expect(recovered.verifyKey.length).toBe(32)
    expect(recovered.writerKey.length).toBe(128)
  })

  it('a sender can be restored from its writerKey only', () => {
    const { writer: original } = createChannel()
    const recovered = new Writer({ writerKey: original.writerKey })
    expect(bufferToString(recovered.writerKey)).toBe(bufferToString(original.writerKey))
    expect(recovered.verifyKeyHex).toBe(original.verifyKeyHex)
  })

  it('a receiver can be restored from its toJSON representation', () => {
    const { reader: original, writer: sender } = createChannel()
    const json = original.toJSON()
    expect(Object.keys(json)).toEqual(['readerKey', 'codec'])
    expect(typeof json.readerKey).toBe('string')
    const recovered = new Reader(json)
    expect(bufferToString(recovered.readerKey)).toBe(bufferToString(original.readerKey))
    expect(recovered.readerKeyBase64).toBe(original.readerKeyBase64)
    expect(recovered.verifyKeyBase64).toBe(original.verifyKeyBase64)
    const recoveredId = Buffer.from(recovered.verifyKeyBase64, 'base64')
    expect(recoveredId.length).toBe(32)
    expect(bufferCompare(recoveredId, original.verifyKey)).toBe(0)
    const message = Buffer.from('Hello World')
    const recoveredAnnonymous = new Verifier(recovered.verifier.toJSON())
    recoveredAnnonymous.verify(sender.sign(message), message)
    recovered.verifier.verify(sender.sign(message), message)
    expect(recovered.decrypt(sender.encrypt('hi!'))).toEqual('hi!')
    expect(original.decrypt(sender.encrypt('hi!'))).toEqual('hi!')
  })

  it('a receiver can be restored from its receiveKey only', () => {
    const { reader: original, writer: sender } = createChannel()
    const recovered = new Reader({ readerKey: original.readerKey })
    expect(bufferToString(recovered.readerKey)).toBe(bufferToString(original.readerKey))
    expect(sender.writerKeyBase64).toBe(sender.writerKeyBase64)
  })

  it('a verifier can be restored from its toJSON representation', () => {
    const { verifier: original } = createChannel()
    const json = original.toJSON()
    if (!('verifyKey' in json)) {
      throw new Error('Missing id property')
    }
    expect(Object.keys(json)).toEqual(['verifyKey'])
    expect(typeof json.verifyKey).toBe('string')
    const recovered = new Verifier(json)
    expect(recovered.verifyKeyBase64).toBe(original.verifyKeyBase64)
  })

  it('signing and verifying a message', () => {
    const { writer: sender, verifier: annonymous } = createChannel()
    const body = Buffer.from('abcd')
    const signature = sender.sign(body)
    annonymous.verify(signature, body)
    annonymous.verifyMessage({ signature, body })
  })

  it('signing and verifying a wrong message', () => {
    const { writer: sender } = createChannel()
    const { verifier: annonymous } = createChannel()
    const body = Buffer.from('abcd')
    const signature = sender.sign(body)
    expect(() => annonymous.verify(signature, body)).toThrowError('Invalid signature')
    expect(() => annonymous.verifyMessage({ signature, body })).toThrowError('Invalid signature')
  })

  it('signing and verifying with a partial channel', () => {
    const { writer: sender, verifier: annonymous } = createChannel()
    const body = Buffer.from('abcd')
    const signature = sender.sign(body)
    annonymous.verify(signature, body)
  })

  it('receiver can decrypt data from sender', () => {
    const { reader: receiver, writer: sender } = createChannel()
    const original = 'Hello World'
    const message = sender.encrypt(original)
    expect(receiver.decrypt(message)).toEqual(original)
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
    expect(sender.toString()).toBe(`Writer(msgpack|${prettyHash(sender.verifyKeyHex)})`)
  })

  it('receiver as string', () => {
    const { reader: receiver } = createChannel()
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    expect(receiver.toString()).toBe(`Reader(msgpack|${prettyHash(receiver.verifyKeyHex)})`)
  })

  it('verifier as string', () => {
    const { verifier: annonymous } = createChannel()
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    expect(annonymous.toString()).toBe(`Verifier(${prettyHash(annonymous.verifyKeyHex)})`)
  })

  it('encrypt without signing', () => {
    const { writer: sender, reader: receiver } = createChannel()
    expect(receiver.decrypt(sender.encryptOnly('hello world'))).toEqual('hello world')
  })

  it('non-default codec support', () => {
    const channel = createChannel({ codec: 'binary' })
    const encrypted = channel.writer.encrypt(Buffer.from('hello', 'utf8'))
    const decrypted = channel.reader.decrypt(encrypted)
    expect(channel.writer.codec.name).toBe(channel.reader.codec.name)
    expect(decrypted.toString('utf8')).toBe('hello')
  })

  it('custom codec support', () => {
    const channel = createChannel({ codec: { name: 'test', encode: (_: number): Buffer => Buffer.from('abcd'), decode: (input: Uint8Array) => input[0] } })
    expect(channel.writer.codec.name).toBe('test')
    expect(channel.writer.codec).toBe(channel.reader.codec)
  })
})

describe('Signing vectors', () => {
  it('simply sign and verify a few messages', () => {
    const { inVector, outVector } = createSignVectors()
    const message = encode('hello world ')
    const sigA = outVector.sign(message)
    const sigB = outVector.sign(message)
    inVector.verify(message, sigA)
    inVector.verify(message, sigB)
    expect(sigA).not.toEqual(sigB)
  })

  it('sign and verify in the wrong order', () => {
    const { inVector, outVector } = createSignVectors()
    const message = encode('hello world ')
    outVector.sign(message)
    const sigB = outVector.sign(message)
    expect(() => {
      inVector.verify(message, sigB)
    }).toThrowError(new Error('Unexpected next index (expected=0, found=1)'))
  })

  it('sign and verify trying to trick the order', () => {
    const { inVector, outVector } = createSignVectors()
    const message = encode('hello world ')
    const sigA = outVector.sign(message)
    const sigB = outVector.sign(message)
    const fakeSigB = encode({
      ...(decode(sigB) as any),
      index: 0
    })
    expect(() => {
      inVector.verify(message, fakeSigB)
    }).toThrowError(new Error('Message could not be verified to be part of vector (index=0)'))
    inVector.verify(message, sigA)
    inVector.verify(message, sigB)
  })

  it('de-/serialization of sign vectors', () => {
    const { inVector, outVector } = createSignVectors()
    const message = encode('hello world ')
    const sigA = outVector.sign(message)
    inVector.verify(message, sigA)
    const resInVector = new SignVector(inVector.toJSON())
    const resOutVector = new SignVector(outVector.toJSON())
    const sigB = outVector.sign(message)
    const resSigB = resOutVector.sign(message)
    resInVector.verify(message, sigB)
    inVector.verify(message, resSigB)
    expect(sigB).not.toEqual(resSigB)
    expect(resInVector.next).not.toEqual(inVector.next)
  })

  it('use with writer/reader/verifier', () => {
    const { inVector, outVector } = createSignVectors()
    const { writer, reader } = createChannel()
    const encryptedA = writer.encrypt('hello', outVector)
    const encryptedB = writer.encrypt('world', outVector)
    const inVectorCopy = new SignVector(inVector)
    expect(reader.decrypt(encryptedA, inVector)).toBe('hello')
    expect(reader.decrypt(encryptedB, inVector)).toBe('world')
    reader.verifier.verifyMessage(encryptedA, inVectorCopy)
    reader.verifier.verifyMessage(encryptedB, inVectorCopy)
  })

  it('wrong order with writer/reader', () => {
    const { inVector, outVector } = createSignVectors()
    const { writer, reader } = createChannel()
    writer.encrypt('hello', outVector)
    const encryptedB = writer.encrypt('world', outVector)
    expect(() => {
      reader.decrypt(encryptedB, inVector)
    }).toThrow(new Error('Unexpected next index (expected=0, found=1)'))
  })
})
