import { IReceiver, receiverFlag } from '../types'

export function isReceiver (input: any): input is IReceiver {
  return input[receiverFlag] === true
}
