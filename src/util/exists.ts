export function exists <T> (any: T | null | undefined): any is T {
  return any !== null && any !== undefined
}
