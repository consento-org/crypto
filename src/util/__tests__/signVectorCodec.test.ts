import { Buffer } from 'buffer'
import { signVectorCodec } from '../signVectorCodec'

const { decode, encode } = signVectorCodec

describe('signvector', () => {
  it('can encode and decode', () => {
    const signature = Buffer.from('hello')
    const body = Buffer.from('world')
    const decoded = decode(encode({ signature, body }))
    expect(decoded.body).toEqual(body)
    expect(decoded.signature).toEqual(signature)
  })
})
