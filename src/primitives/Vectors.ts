import { Inspectable } from '../util'
import { ISignVector, ISignVectorJSON, ISignVectorOptions, IVectors, IVerifyVector, IVerifyVectorJSON, IVerifyVectorOptions } from '../types'
import { SignVector } from './SignVector'
import { InspectOptions } from 'inspect-custom-symbol'
import { VerifyVector } from './VerifyVector'
import prettyHash from 'pretty-hash'

export class Vectors extends Inspectable implements IVectors {
  inVector: IVerifyVector
  outVector: ISignVector

  constructor (opts: ISignVectorOptions & IVerifyVectorOptions) {
    super()
    this.outVector = new SignVector(opts)
    this.inVector = new VerifyVector(opts)
  }

  toJSON (): ISignVectorJSON & IVerifyVectorJSON {
    return {
      ...this.inVector.toJSON(),
      ...this.outVector.toJSON()
    }
  }

  _inspect (_: number, { stylize }: InspectOptions): string {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `Vectors(in=${stylize(prettyHash(this.inVector.verifyKey), 'string')}#${stylize(this.inVector.verifyIndex, 'number')},out=${stylize(prettyHash(this.outVector.signKey), 'string')}#${stylize(this.outVector.signIndex, 'number')})`
  }
}
