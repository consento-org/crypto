// Small util for tests to get all
import { sodium } from './sodium'
import { friends } from './friends'
import { ICryptoCore } from './types'

export const cores: Array<{ name: string, crypto: ICryptoCore }> = [
  { name: 'sodium', crypto: sodium },
  { name: 'friends', crypto: friends }
]
