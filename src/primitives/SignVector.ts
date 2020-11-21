import { EDecryptionError, ISignVector, ISignVectorJSON, ISignVectorOptions } from '../types'
import { InspectOptions } from 'inspect-custom-symbol'
import { bufferToString, Inspectable, toBuffer } from '../util'
import prettyHash from 'pretty-hash'
import { decode, encode } from '@msgpack/msgpack'
import { createSignKeys, sign, verify } from './fn'

function assertSignatureParts (input: any): asserts input is { payload: Uint8Array, index: number, next: Uint8Array } {
  if (typeof input !== 'object' || input === null) {
    throw Object.assign(new Error('Message needs to have body and signature.'), { code: EDecryptionError.invalidMessage })
  }
  if (!('payload' in input)) {
    throw Object.assign(new Error('Payload of vectored message missing.'), { code: EDecryptionError.vectorPayload })
  }
  if (!('index' in input) || (typeof input.index !== 'number')) {
    throw Object.assign(new Error('Index of vectored message missing.'), { code: EDecryptionError.vectorIndex })
  }
  if (!('next' in input)) {
    throw Object.assign(new Error('Next verification key of vectored message missing.'), { code: EDecryptionError.vectorNext })
  }
}

export class SignVector extends Inspectable implements ISignVector {
  _next?: Uint8Array
  _nextBase64?: string
  index: number

  constructor ({ index, next }: ISignVectorOptions) {
    super()
    this.index = index ?? 0
    if (typeof next === 'string') {
      this._nextBase64 = next
    } else {
      this._next = next
    }
  }

  get next (): Uint8Array {
    if (this._next === undefined) {
      this._next = toBuffer(this._nextBase64 as unknown as string)
    }
    return this._next
  }

  get nextBase64 (): string {
    if (this._nextBase64 === undefined) {
      this._nextBase64 = bufferToString(this._next as unknown as Uint8Array, 'base64')
    }
    return this._nextBase64
  }

  increment (next: Uint8Array): Uint8Array {
    this.index++
    const current = this.next
    this._next = next
    this._nextBase64 = undefined
    return current
  }

  sign (message: Uint8Array): Uint8Array {
    const keys = createSignKeys()
    const info = { index: this.index, next: keys.verifyKey }
    const body = encode([keys.verifyKey, message, this.index])
    const payload = sign(this.next, body)
    this.increment(keys.signKey)
    return encode({ payload, ...info })
  }

  verify (message: Uint8Array, signature: Uint8Array): void {
    const parts = decode(signature)
    assertSignatureParts(parts)
    const { index } = parts
    if (index !== this.index) {
      throw Object.assign(new Error(`Unexpected next index (expected=${this.index}, found=${index})`), { code: EDecryptionError.unexpectedIndex, expected: this.index, found: index })
    }
    const body = encode([parts.next, message, index])
    if (!verify(this.next, parts.payload, body)) {
      throw Object.assign(new Error(`Message could not be verified to be part of vector (index=${index})`), { code: EDecryptionError.vectorIntegrity, index })
    }
    this.increment(parts.next)
  }

  toJSON (): ISignVectorJSON {
    return {
      index: this.index,
      next: this.nextBase64
    }
  }

  _inspect (_: number, { stylize }: InspectOptions): string {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `SignVector(${stylize(prettyHash(this.next), 'string')}#${this.index})`
  }
}
