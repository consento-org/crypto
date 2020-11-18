import { IStringOrBuffer, EEncoding, Buffer } from './types'

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

export function isStringOrBuffer (input: any): input is IStringOrBuffer {
  if (typeof input === 'string') return true
  if (input instanceof Uint8Array) return true
  return false
}
export function toBuffer (stringOrBuffer: IStringOrBuffer): Uint8Array {
  if (typeof stringOrBuffer === 'string') {
    return Buffer.from(stringOrBuffer, 'base64')
  }
  return stringOrBuffer
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

export function bufferEquals (a: Uint8Array, b: Uint8Array): boolean {
  return bufferCompare(a, b) === 0
}

export function bufferToString (buffer: Uint8Array, encoding: EEncoding = 'utf8'): string {
  return Buffer.from(buffer).toString(encoding)
}
