import { ISignVector, ISignVectorJSON, ISignVectorOptions } from '../types'
import { InspectOptions } from 'inspect-custom-symbol'
import { bufferToString, Inspectable, toBuffer } from '../util'
import prettyHash from 'pretty-hash'
import { encode } from '@msgpack/msgpack'
import { createSignKeys, sign } from './fn'

export class SignVector extends Inspectable implements ISignVector {
  _signKey?: Uint8Array
  _signKeyBase64?: string
  signIndex: number

  constructor ({ signKey, signIndex }: ISignVectorOptions) {
    super()
    this.signIndex = signIndex ?? 0
    if (typeof signKey === 'string') {
      this._signKeyBase64 = signKey
    } else {
      this._signKey = signKey
    }
  }

  get signKey (): Uint8Array {
    if (this._signKey === undefined) {
      this._signKey = toBuffer(this._signKeyBase64 as unknown as string)
    }
    return this._signKey
  }

  get signKeyBase64 (): string {
    if (this._signKeyBase64 === undefined) {
      this._signKeyBase64 = bufferToString(this._signKey as unknown as Uint8Array, 'base64')
    }
    return this._signKeyBase64
  }

  sign (message: Uint8Array): Uint8Array {
    const keys = createSignKeys()
    const info = { index: this.signIndex, next: keys.verifyKey }
    const body = encode([keys.verifyKey, message, this.signIndex])
    const payload = sign(this.signKey, body)
    this.signIndex++
    this._signKey = keys.signKey
    this._signKeyBase64 = undefined
    return encode({ payload, ...info })
  }

  toJSON (): ISignVectorJSON {
    return {
      signIndex: this.signIndex,
      signKey: this.signKeyBase64
    }
  }

  _inspect (_: number, { stylize }: InspectOptions): string {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `SignVector(${stylize(prettyHash(this.signKey), 'string')}#${stylize(this.signIndex, 'number')})`
  }
}
