import { anyToBuffer } from './buffer'
import { IEncodable } from './types'
import * as sodium from 'sodium-universal'

const {
  crypto_box_SEALBYTES: CRYPTO_BOX_SEALBYTES,
  crypto_box_seal: boxSeal,
  sodium_malloc: malloc
} = sodium.default

export function encryptMessage (writeKey: Uint8Array, message: IEncodable): Uint8Array {
  const msgBuffer = anyToBuffer(message)
  const body = malloc(msgBuffer.length + CRYPTO_BOX_SEALBYTES)
  boxSeal(body, msgBuffer, writeKey)
  return body
}
