import { describe, expect, test } from "bun:test"
import { canonicalize } from "../../src/receiptos/canon/canonicalize"

describe("receiptos canonicalize", () => {
  test("object keys sort deterministically", () => {
    expect(canonicalize({ b: 2, a: 1 })).toBe('{"a":1,"b":2}')
  })

  test("nested objects serialize deterministically", () => {
    const left = { z: { b: 2, a: 1 }, a: [{ y: 2, x: 1 }] }
    const right = { a: [{ x: 1, y: 2 }], z: { a: 1, b: 2 } }
    expect(canonicalize(left)).toBe(canonicalize(right))
    expect(canonicalize(left)).toBe('{"a":[{"x":1,"y":2}],"z":{"a":1,"b":2}}')
  })

  test("arrays preserve order", () => {
    expect(canonicalize(["b", "a"])).toBe('["b","a"]')
    expect(canonicalize(["a", "b"])).toBe('["a","b"]')
  })

  test("undefined fields are skipped and canonical string is stable", () => {
    const value = { b: undefined, a: 1, c: { z: undefined, y: true } }
    expect(canonicalize(value)).toBe('{"a":1,"c":{"y":true}}')
    expect(canonicalize(value)).toBe(canonicalize({ c: { y: true, z: undefined }, a: 1, b: undefined }))
  })
})
