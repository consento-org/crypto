import inspect, { InspectOptions } from 'inspect-custom-symbol'

const toStringOpts: InspectOptions = {
  stylize (input: any): string {
    return String(input)
  }
}

export abstract class Inspectable {
  abstract _inspect (depth: number, options: InspectOptions): string

  [inspect] (depth: number, options: InspectOptions): string {
    return this._inspect(depth, options)
  }

  toString (): string {
    return this._inspect(-1, toStringOpts)
  }
}
