// Adapted from https://github.com/typestack/routing-controllers/blob/4a56d176db77bc081dfcd3d8550e8433b5bc476e/src/util/isPromiseLike.ts#L1-L6
export function isPromiseLike <T> (arg: any): arg is PromiseLike<T> {
  return arg !== null && arg !== undefined && typeof arg === 'object' && typeof arg.then === 'function'
}
