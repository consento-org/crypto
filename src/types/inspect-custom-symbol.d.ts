declare module 'inspect-custom-symbol' {
  const inspect: symbol
  export interface InspectOptions {
    indentationLvl?: number
    stylize <T> (input: T, type?: 'special' | 'number' | 'bigint' | 'boolean' | 'undefined' | 'null' | 'string' | 'symbol' | 'date' | 'regexp' | 'module'): string
  }
  export default inspect
}
