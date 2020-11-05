import { polyfill } from 'get-random-values-polypony'
import { Buffer } from 'buffer'

const { window } = global
if (window !== undefined && typeof window.close !== 'function') {
  window.close = () => {}
}
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer
}

export default async function setup (): Promise<void> {
  polyfill()
}
