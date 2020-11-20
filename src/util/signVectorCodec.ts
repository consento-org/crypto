import codecs, { INamedCodec } from '@consento/codecs'
import { Buffer } from 'buffer'
import { fromBytes, toBytes, toNumber, fromNumber } from 'longfn'
import inspect from 'inspect-custom-symbol'

const _length = new Uint8Array(8)
const _long = fromNumber(0)
const _empty = new Uint8Array(0)
const _set: Uint8Array[] = [_length, _empty, _empty]

export const signVectorCodec: INamedCodec<'sign-vector', { signature: Uint8Array, body: Uint8Array }> = {
  name: 'sign-vector',
  [inspect]: codecs.inspect('{signature,body}', 'sign-vector'),
  encode: ({ signature, body }) => {
    toBytes(fromNumber(signature.length, true, _long), _length)
    _set[1] = signature
    _set[2] = body
    const res = Buffer.concat(_set)
    _set[1] = _empty
    _set[2] = _empty
    return res
  },
  decode: encoded => {
    const size = toNumber(fromBytes(encoded, true, _long))
    const buf = Buffer.from(encoded)
    const slicer = size + 8
    return {
      signature: buf.slice(8, slicer),
      body: buf.slice(slicer)
    }
  }
}
