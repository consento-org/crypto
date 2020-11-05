import * as sodium from 'sodium-universal'

const {
  sodium_malloc: malloc,
  randombytes_buf: randomBytes
} = sodium.default

export function randomBuffer (size: number): Uint8Array {
  const buffer = malloc(size)
  randomBytes(buffer)
  return buffer
}
