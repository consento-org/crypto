import { bufferCompare } from '../../util/buffer'
import { encryptBlob, toEncryptedBlob, isEncryptedBlob, decryptBlob } from '..'

describe('decrypt/encryption of blobs', () => {
  it('basic api', async () => {
    const {
      blob, // Information about a blob: to pass around
      encrypted // Encrypted data to be stored
    } = await encryptBlob('Hello Secret!')

    expect(blob.size).toBe(54)
    expect(blob.secretKey.length).toBe(32)
    expect(blob.path.length).toEqual(4)

    for (const segment of blob.path) {
      expect(segment).toMatch(/^[a-f0-9]{4}$/)
    }

    expect(isEncryptedBlob(blob)).toBe(true)
    const decrypted = await decryptBlob(blob.secretKey, encrypted)
    expect(decrypted).toBe('Hello Secret!')
  })
  it('serialization', async () => {
    const { blob } = await encryptBlob('Hello Secret!')
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
