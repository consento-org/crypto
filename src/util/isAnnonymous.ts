import { IAnnonymous, annonymousFlag } from '../types'

export function isAnnonymous (input: any): input is IAnnonymous {
  return input[annonymousFlag] === true
}
