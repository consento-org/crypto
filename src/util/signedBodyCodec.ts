import codecs, { INamedCodec } from '@consento/codecs'
import { Buffer } from 'buffer'
import inspect from 'inspect-custom-symbol'

const length = Buffer.alloc(1, 0)
const empty = Buffer.alloc(0)
const list: Buffer[] = [length, empty, empty]

export const signedBodyCodec: INamedCodec<'signed-body', { signature: Uint8Array, body: Uint8Array }> = {
  name: 'signed-body',
  [inspect]: codecs.inspect('{signature,body}', 'signed-body'),
  encode: ({ signature, body }) => {
    if (signature.byteLength > 256) {
      throw new Error('The signature is not supposed to be more than 256 bytes long')
    }
    length[0] = signature.byteLength
    list[1] = Buffer.from(signature) // See https://github.com/feross/buffer/pull/277
    list[2] = Buffer.from(body)
    const res = Buffer.concat(list)
    list[1] = empty
    list[2] = empty
    return res
  },
  decode: encoded => {
    const buf = Buffer.from(encoded)
    const len: number = buf[0]
    const sliceIndex = 1 + len
    return {
      signature: buf.slice(1, sliceIndex),
      body: buf.slice(sliceIndex)
    }
  }
}
