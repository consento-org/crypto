declare module 'buffer' {
  interface HasToPrimitive {
    [Symbol.toPrimitive](): any
  }
  interface HasValueOf {
    valueOf(): any
  }
  type BufferLike = Uint8Array | Buffer

  export class Buffer extends Uint8Array {
    static from (string: string, encoding?: string): Buffer
    static from (array: number[]): Buffer
    static from (arrayBuffer: ArrayBuffer, byteOffset?:number, length?:number): Buffer
    static from (buffer: Buffer): Buffer
    static from (object: HasToPrimitive | HasValueOf, offsetOrEncoding?: number | string, length?: number): Buffer
    static alloc (size: number, fill: string | Buffer | Uint8Array | integer): Buffer
    static allocUnsafe (size: number): Buffer
    static allocUnsafeSlow (size: number): Buffer
    static concat(buffers: BufferLike[], totalLength?: number): Buffer
    static compare(buf1: Buffer, buf2: Buffer): number
    static isBuffer(arg: any): arg is Buffer
    static isEncoding(any: string): boolean
    static poolSize: number
    toString(encoding?: string): string
    get byteOffset(): number
    get byteLength(): number
    get buffer(): ArrayBuffer
  }
}
