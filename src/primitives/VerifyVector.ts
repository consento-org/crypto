import { EDecryptionError, IVerifyVectorOptions, IVerifyVector, IVerifyVectorJSON } from '../types'
import { InspectOptions } from 'inspect-custom-symbol'
import { bufferToString, Inspectable, toBuffer } from '../util'
import prettyHash from 'pretty-hash'
import { decode, encode } from '@msgpack/msgpack'
import { verify } from './fn'

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

export class VerifyVector extends Inspectable implements IVerifyVector {
  _verifyKey?: Uint8Array
  _verifyKeyBase64?: string
  verifyIndex: number

  constructor ({ verifyKey, verifyIndex }: IVerifyVectorOptions) {
    super()
    this.verifyIndex = verifyIndex ?? 0
    if (typeof verifyKey === 'string') {
      this._verifyKeyBase64 = verifyKey
    } else {
      this._verifyKey = verifyKey
    }
  }

  get verifyKey (): Uint8Array {
    if (this._verifyKey === undefined) {
      this._verifyKey = toBuffer(this._verifyKeyBase64 as unknown as string)
    }
    return this._verifyKey
  }

  get verifyKeyBase64 (): string {
    if (this._verifyKeyBase64 === undefined) {
      this._verifyKeyBase64 = bufferToString(this._verifyKey as unknown as Uint8Array, 'base64')
    }
    return this._verifyKeyBase64
  }

  verify (message: Uint8Array, signature: Uint8Array): void {
    const parts = decode(signature)
    assertSignatureParts(parts)
    const { index } = parts
    if (index !== this.verifyIndex) {
      throw Object.assign(new Error(`Unexpected next index (expected=${this.verifyIndex}, found=${index})`), { code: EDecryptionError.unexpectedIndex, expected: this.verifyIndex, found: index })
    }
    const body = encode([parts.next, message, index])
    if (!verify(this.verifyKey, parts.payload, body)) {
      throw Object.assign(new Error(`Message could not be verified to be part of vector (index=${index})`), { code: EDecryptionError.vectorIntegrity, index })
    }
    this.verifyIndex++
    this._verifyKey = parts.next
    this._verifyKeyBase64 = undefined
  }

  toJSON (): IVerifyVectorJSON {
    return {
      verifyIndex: this.verifyIndex,
      verifyKey: this.verifyKeyBase64
    }
  }

  _inspect (_: number, { stylize }: InspectOptions): string {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `VerifyVector(${stylize(prettyHash(this.verifyKey), 'string')}#${stylize(this.verifyIndex, 'number')})`
  }
}
