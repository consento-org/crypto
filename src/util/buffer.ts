import { Buffer } from 'buffer'
export { Buffer } from 'buffer'

function enumBuffer (num: number): Uint8Array {
  const buf = new Uint8Array(1)
  buf[0] = num
  return buf
}

const MESSAGE_BINARY_UINT8 = enumBuffer(1)
const MESSAGE_BINARY_BUFFER = enumBuffer(2)
const MESSAGE_STRING = enumBuffer(3)
const MESSAGE_JSON = enumBuffer(4)

export function concatUint8Arrays (arrays: Uint8Array[]): Uint8Array {
  const byteLength = arrays.reduce((len, array) => len + array.byteLength, 0)
  const combined = new Uint8Array(byteLength)
  let offset = 0
  for (const array of arrays) {
    combined.set(array, offset)
    offset += array.byteLength
  }
  return combined
}

export type IEncodable = Uint8Array | string | object

export function anyToBuffer (message: IEncodable): Uint8Array {
  if (typeof message === 'function') {
    throw new Error('Function not supported')
  }
  if (message instanceof Buffer) {
    return Buffer.concat([MESSAGE_BINARY_BUFFER, message] as Uint8Array[])
  }
  if (message instanceof Uint8Array) {
    return concatUint8Arrays([MESSAGE_BINARY_UINT8, message])
  }
  if (typeof message === 'string') {
    return concatUint8Arrays([MESSAGE_STRING, Buffer.from(message)])
  }
  return concatUint8Arrays([MESSAGE_JSON, Buffer.from(JSON.stringify(message))])
}

export function bufferCompare (a: Uint8Array, b: Uint8Array): number {
  const aLen = a.length
  const bLen = b.length
  if (aLen > bLen) return 1
  if (bLen > aLen) return -1
  for (let i = 0; i < aLen; i++) {
    if (a[i] > b[i]) return 1
    if (a[i] < b[i]) return -1
  }
  return 0
}

export type EEncoding = 'base64' | 'hex' | 'utf8'

export function bufferToString (buffer: Uint8Array, encoding: EEncoding = 'utf8'): string {
  return Buffer.from(buffer).toString(encoding)
}

export function bufferToAny (buffer: Uint8Array): IEncodable {
  switch (buffer[0]) {
    case MESSAGE_BINARY_UINT8[0]:
      if (buffer instanceof Buffer) {
        return new Uint8Array(buffer.buffer, buffer.byteOffset + 1, buffer.byteLength - 1)
      }
      return buffer.slice(1)
    case MESSAGE_BINARY_BUFFER[0]:
      if (buffer instanceof Buffer) {
        return buffer.slice(1)
      }
      return Buffer.from(buffer.slice(1))
    case MESSAGE_STRING[0]:
      return bufferToString(buffer.slice(1))
    case MESSAGE_JSON[0]:
      return JSON.parse(bufferToString(buffer.slice(1)))
    default:
      throw new Error('Couldnt decrypt: Unknown object type.')
  }
}
