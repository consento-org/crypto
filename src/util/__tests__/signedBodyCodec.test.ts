import { Buffer } from 'buffer'
import { signedBodyCodec } from '../signedBodyCodec'

const { decode, encode } = signedBodyCodec

describe('signvector', () => {
  it('can encode and decode', () => {
    const signature = Buffer.from('hello')
    const body = Buffer.from('world')
    const decoded = decode(encode({ signature, body }))
    expect(decoded.body).toEqual(body)
    expect(decoded.signature).toEqual(signature)
  })
})
