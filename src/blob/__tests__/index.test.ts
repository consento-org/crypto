import { bufferCompare } from '../../util/buffer'
import { encryptBlob, toEncryptedBlob, isEncryptedBlob } from '..'
import { Buffer } from 'buffer'

describe('decrypt/encryption of blobs', () => {
  it('basic api', async () => {
    const {
      blob, // Information about a blob: to pass around
      encrypted // Encrypted data to be stored
    } = await encryptBlob(Buffer.from('Hello Secret!'))

    expect(blob.size).toBe(53)
    expect(blob.secretKey.length).toBe(32)
    expect(blob.path.length).toEqual(4)

    for (const segment of blob.path) {
      expect(segment).toMatch(/^[0123456789ABCDEFGHJKMNPQRSTVWXYZIL]{4}$/i)
    }

    expect(isEncryptedBlob(blob)).toBe(true)
    const decrypted = await blob.decrypt(encrypted)
    expect(decrypted).toEqual(Buffer.from('Hello Secret!'))
  })
  it('custom encoding', async () => {
    const {
      blob, // Information about a blob: to pass around
      encrypted // Encrypted data to be stored
    } = await encryptBlob({ foo: new Uint8Array([1, 2, 3]) }, 'msgpack')

    const decrypted = await blob.decrypt(encrypted)
    expect(decrypted).toEqual({ foo: Buffer.from(new Uint8Array([1, 2, 3])) })
  })
  it('serialization', async () => {
    const { blob } = await encryptBlob('Hello Secret!', 'msgpack')
    const blobJSON = blob.toJSON()
    const restored = toEncryptedBlob(blobJSON)
    expect(blob.path).toEqual(restored.path)
    expect(bufferCompare(blob.secretKey, restored.secretKey)).toBe(0)
    expect(blob.size).toEqual(restored.size)
  })
  it('serialization from secretKey', async () => {
    const { blob } = await encryptBlob('Hello Secret!')
    const restored = await toEncryptedBlob(blob.secretKey)
    expect(blob.path).toEqual(restored.path)
    expect(bufferCompare(blob.secretKey, restored.secretKey)).toBe(0)
    expect(restored.size).toEqual(undefined)
  })
})
