import { ICryptoCore } from './core/types'
import { IConsentoCrypto } from './types'
import { setupPrimitives } from './primitives'
import { setupHandshake } from './handshake'
import { setupBlob } from './blob'

export function create (crypto: ICryptoCore): IConsentoCrypto {
  const primitives = setupPrimitives(crypto)
  const handshake = setupHandshake(crypto, primitives)
  const blob = setupBlob(crypto)
  return {
    ...primitives,
    ...handshake,
    ...blob
  }
}

const cache = new WeakMap<ICryptoCore, any>([])

export function setup (crypto: ICryptoCore): IConsentoCrypto {
  if (crypto === null || crypto === undefined) {
    throw new Error('No crypto library specified.')
  }
  if (cache.has(crypto)) {
    return cache.get(crypto)
  }
  const item = create(crypto)
  cache.set(crypto, item)
  return item
}
