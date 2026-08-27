/**
 * Prospective TSEI producer for the owner-neutral encode-json-utf8-lf.v0
 * byte contract.
 *
 * This implementation does not relabel or rewrite historical TSEI artifacts.
 * A later immutable binding record may make the adoption commit effective for
 * a named producer boundary; this module only supplies and tests the encoder.
 */

import { isProxy } from "node:util/types"

export const ENCODE_JSON_UTF8_LF_V0_CONTRACT_ID = "encode-json-utf8-lf.v0"
export const ENCODE_JSON_UTF8_LF_V0_SPEC_SHA256 =
  "22207f8c4047044414da98b5497a2c9683aea14a7a498fc1819a9094c920a1f9"
export const ENCODE_JSON_UTF8_LF_V0_VECTORS_SHA256 =
  "8d53ab1d3dfb2de1ba9db23ed06d6864b08b516451938a4b1f6db6bcdcf1950f"

export type EncodeJsonUtf8LfV0ErrorCategory =
  | "INTEGER_OUT_OF_RANGE"
  | "NEGATIVE_ZERO"
  | "NON_FINITE_NUMBER"
  | "NON_SCALAR_KEY"
  | "NON_SCALAR_STRING"
  | "NUMBER_NOT_EXACTLY_BINARY64"
  | "UNSUPPORTED_HOST_VALUE"
  | "CYCLIC_HOST_VALUE"

export class EncodeJsonUtf8LfV0Error extends Error {
  readonly category: EncodeJsonUtf8LfV0ErrorCategory

  constructor(category: EncodeJsonUtf8LfV0ErrorCategory) {
    super(category)
    this.name = "EncodeJsonUtf8LfV0Error"
    this.category = category
  }
}

type F64Value = { kind: "f64"; value: number }
type IntegerValue = { kind: "integer"; value: bigint }
type ObjectValue = { kind: "object"; entries: Array<[string, AbstractValue]> }
type AbstractValue = null | boolean | string | F64Value | IntegerValue | ObjectValue | AbstractValue[]

export type EncodeJsonUtf8LfV0Transport = {
  type: string
  value?: unknown
  decimal?: string
  hex?: string
  items?: EncodeJsonUtf8LfV0Transport[]
  entries?: Array<{ key: string; value: EncodeJsonUtf8LfV0Transport }>
}

const SAFE_INTEGER = 9007199254740991

function scalarError(value: string, key: boolean): EncodeJsonUtf8LfV0ErrorCategory | null {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index)
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (index + 1 >= value.length) return key ? "NON_SCALAR_KEY" : "NON_SCALAR_STRING"
      const low = value.charCodeAt(index + 1)
      if (low < 0xdc00 || low > 0xdfff) return key ? "NON_SCALAR_KEY" : "NON_SCALAR_STRING"
      index += 1
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return key ? "NON_SCALAR_KEY" : "NON_SCALAR_STRING"
    }
  }
  return null
}

/** Raw UTF-16 code-unit order, as required by encode-json-utf8-lf.v0. */
function compareUtf16(left: string, right: string): number {
  const shared = Math.min(left.length, right.length)
  for (let index = 0; index < shared; index += 1) {
    const a = left.charCodeAt(index)
    const b = right.charCodeAt(index)
    if (a !== b) return a < b ? -1 : 1
  }
  return left.length - right.length
}

function escapeString(value: string, key = false): string {
  const invalid = scalarError(value, key)
  if (invalid) throw new EncodeJsonUtf8LfV0Error(invalid)
  let out = '"'
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index)
    if (unit >= 0xd800 && unit <= 0xdbff) {
      out += value[index] + value[index + 1]
      index += 1
      continue
    }
    if (unit === 0x22) out += '\\"'
    else if (unit === 0x5c) out += "\\\\"
    else if (unit === 0x08) out += "\\b"
    else if (unit === 0x0c) out += "\\f"
    else if (unit === 0x0a) out += "\\n"
    else if (unit === 0x0d) out += "\\r"
    else if (unit === 0x09) out += "\\t"
    else if (unit <= 0x1f) out += `\\u${unit.toString(16).padStart(4, "0")}`
    else out += value[index]
  }
  return out + '"'
}

function renderNumber(value: F64Value | IntegerValue): string {
  let number: number
  if (value.kind === "integer") {
    const bound = 9007199254740991n
    if (value.value < -bound || value.value > bound) {
      throw new EncodeJsonUtf8LfV0Error("INTEGER_OUT_OF_RANGE")
    }
    number = Number(value.value)
    if (BigInt(number) !== value.value) {
      throw new EncodeJsonUtf8LfV0Error("NUMBER_NOT_EXACTLY_BINARY64")
    }
  } else {
    number = value.value
    if (!Number.isFinite(number)) throw new EncodeJsonUtf8LfV0Error("NON_FINITE_NUMBER")
    if (Object.is(number, -0)) throw new EncodeJsonUtf8LfV0Error("NEGATIVE_ZERO")
    if (Number.isInteger(number) && Math.abs(number) > SAFE_INTEGER) {
      throw new EncodeJsonUtf8LfV0Error("INTEGER_OUT_OF_RANGE")
    }
  }
  return JSON.stringify(number)
}

function serializeAbstract(value: AbstractValue): string {
  if (value === null) return "null"
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "string") return escapeString(value)
  if (Array.isArray(value)) return `[${value.map(serializeAbstract).join(",")}]`
  if (value.kind === "f64" || value.kind === "integer") return renderNumber(value)

  const seen = new Set<string>()
  for (const [key] of value.entries) {
    const invalid = scalarError(key, true)
    if (invalid) throw new EncodeJsonUtf8LfV0Error(invalid)
    if (seen.has(key)) throw new EncodeJsonUtf8LfV0Error("UNSUPPORTED_HOST_VALUE")
    seen.add(key)
  }
  const entries = [...value.entries].sort((a, b) => compareUtf16(a[0], b[0]))
  return `{${entries.map(([key, item]) => `${escapeString(key, true)}:${serializeAbstract(item)}`).join(",")}}`
}

function decodeTransport(node: EncodeJsonUtf8LfV0Transport): AbstractValue {
  if (node.type === "null") return null
  if (node.type === "boolean") return Boolean(node.value)
  if (node.type === "string") return String(node.value)
  if (node.type === "integer") {
    if (typeof node.decimal !== "string" || !/^-?(0|[1-9][0-9]*)$/.test(node.decimal)) {
      throw new EncodeJsonUtf8LfV0Error("UNSUPPORTED_HOST_VALUE")
    }
    return { kind: "integer", value: BigInt(node.decimal) }
  }
  if (node.type === "f64_bits") {
    if (typeof node.hex !== "string" || !/^[0-9a-f]{16}$/.test(node.hex)) {
      throw new EncodeJsonUtf8LfV0Error("UNSUPPORTED_HOST_VALUE")
    }
    const buffer = new ArrayBuffer(8)
    new DataView(buffer).setBigUint64(0, BigInt(`0x${node.hex}`), false)
    return { kind: "f64", value: new DataView(buffer).getFloat64(0, false) }
  }
  if (node.type === "array") return (node.items ?? []).map(decodeTransport)
  if (node.type === "object") {
    return {
      kind: "object",
      entries: (node.entries ?? []).map((entry) => [entry.key, decodeTransport(entry.value)]),
    }
  }
  throw new EncodeJsonUtf8LfV0Error("UNSUPPORTED_HOST_VALUE")
}

function hostToAbstract(value: unknown, active: Set<object>): AbstractValue {
  if (value === null) return null
  if (typeof value === "boolean" || typeof value === "string") return value
  if (typeof value === "number") return { kind: "f64", value }
  if (typeof value !== "object") throw new EncodeJsonUtf8LfV0Error("UNSUPPORTED_HOST_VALUE")
  if (isProxy(value)) throw new EncodeJsonUtf8LfV0Error("UNSUPPORTED_HOST_VALUE")
  if (active.has(value)) throw new EncodeJsonUtf8LfV0Error("CYCLIC_HOST_VALUE")

  active.add(value)
  try {
    if (Array.isArray(value)) {
      const ownNames = Object.getOwnPropertyNames(value)
      const expected = new Set(["length", ...Array.from({ length: value.length }, (_, index) => String(index))])
      if (Object.getOwnPropertySymbols(value).length !== 0 || ownNames.some((name) => !expected.has(name))) {
        throw new EncodeJsonUtf8LfV0Error("UNSUPPORTED_HOST_VALUE")
      }
      const result: AbstractValue[] = []
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
          throw new EncodeJsonUtf8LfV0Error("UNSUPPORTED_HOST_VALUE")
        }
        result.push(hostToAbstract(descriptor.value, active))
      }
      return result
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new EncodeJsonUtf8LfV0Error("UNSUPPORTED_HOST_VALUE")
    }
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new EncodeJsonUtf8LfV0Error("UNSUPPORTED_HOST_VALUE")
    }
    const entries: Array<[string, AbstractValue]> = []
    for (const key of Object.getOwnPropertyNames(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
        throw new EncodeJsonUtf8LfV0Error("UNSUPPORTED_HOST_VALUE")
      }
      entries.push([key, hostToAbstract(descriptor.value, active)])
    }
    return { kind: "object", entries }
  } finally {
    active.delete(value)
  }
}

function encodeAbstract(value: AbstractValue): Buffer {
  return Buffer.from(`${serializeAbstract(value)}\n`, "utf8")
}

/** Encode an ordinary in-memory JSON-shaped TSEI value under the v0 contract. */
export function encodeJsonUtf8LfV0(value: unknown): Buffer {
  return encodeAbstract(hostToAbstract(value, new Set<object>()))
}

/** Exact tagged-transport adapter used to exercise the full normative corpus. */
export function encodeJsonUtf8LfV0Transport(node: EncodeJsonUtf8LfV0Transport): Buffer {
  return encodeAbstract(decodeTransport(node))
}
