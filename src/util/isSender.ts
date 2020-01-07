import { ISender, senderFlag } from '../types'

export function isSender (input: any): input is ISender {
  return input[senderFlag] === true
}
