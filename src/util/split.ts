export function split (buffer: Uint8Array, offset: number): Uint8Array[] {
  return [
    buffer.slice(0, offset),
    buffer.slice(offset)
  ]
}
