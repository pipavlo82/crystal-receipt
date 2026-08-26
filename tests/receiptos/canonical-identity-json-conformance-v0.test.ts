/**
 * canonicalIdentityJson conformance v0.
 *
 * The comparator is load-bearing: it is the single equality primitive
 * behind every projection comparison in transformation-stability.ts, every
 * coverage atom comparison in transformation-stability-coverage.ts, and
 * every edge/endpoint comparison in transformation-stability-cycle.ts. If
 * canonicalIdentityJson(x) === canonicalIdentityJson(y) for semantically
 * distinct x/y that should not compare equal, projection mismatches,
 * coverage atom mismatches, and cycle endpoint differences can all become
 * invisible simultaneously, in every one of those consumers at once.
 *
 * This file freezes what the comparator actually does -- it does not
 * invent prettier semantics. The vectors themselves live in
 * conformance/canonical-identity-json-conformance-v0/vectors.json, a
 * plain-data JSON artifact with no TypeScript/production-code dependency,
 * so a future non-TypeScript (e.g. Rust) implementation could consume the
 * same vectors without importing this repository's source.
 *
 * At least one deliberately-broken mutant comparator must fail these same
 * vectors -- this is load-bearing, not decorative: if a mutant passed, the
 * vector set would be insufficient to distinguish the real comparator from
 * a broken one. Four mutants are exercised here (over-collapsing arrays as
 * sets, dropping null-valued fields, case-folding strings, and coercing
 * numeric-looking strings to numbers), each reimplemented independently in
 * this file -- never derived from or delegating to the real comparator.
 */

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { canonicalIdentityJson } from "../../src/receiptos/challenge/canonical-identity-json"

const VECTORS_PATH = resolve(import.meta.dir, "..", "..", "conformance", "canonical-identity-json-conformance-v0", "vectors.json")

type VectorKindKey =
  | "positive_zero"
  | "negative_zero"
  | "nan"
  | "positive_infinity"
  | "negative_infinity"
  | "undefined"
  | "object_with_one_undefined_valued_key"
  | "lone_high_surrogate_string"
  | "lone_low_surrogate_string"

type VectorV0 = {
  readonly vector_id: string
  readonly category: "equal_pair" | "not_equal_pair" | "canonical_form" | "throws"
  readonly description: string
  readonly left?: unknown
  readonly left_kind?: VectorKindKey
  readonly right?: unknown
  readonly right_kind?: VectorKindKey
  readonly value?: unknown
  readonly value_kind?: VectorKindKey
  readonly value_key?: string
  readonly expected_canonical?: string
}

type MutantV0 = {
  readonly mutant_id: string
  readonly description: string
  readonly wrongly_collapses_vector_ids: readonly string[]
}

type VectorFileV0 = {
  readonly schema: string
  readonly vectors: readonly VectorV0[]
  readonly mutants: readonly MutantV0[]
}

const VECTOR_FILE: VectorFileV0 = JSON.parse(readFileSync(VECTORS_PATH, "utf8"))

function resolveKind(kind: VectorKindKey, baseValue: unknown, key: string | undefined): unknown {
  switch (kind) {
    case "positive_zero":
      return 0
    case "negative_zero":
      return -0
    case "nan":
      return NaN
    case "positive_infinity":
      return Infinity
    case "negative_infinity":
      return -Infinity
    case "undefined":
      return undefined
    case "object_with_one_undefined_valued_key": {
      const record: Record<string, unknown> = { ...(baseValue as Record<string, unknown>) }
      record[key!] = undefined
      return record
    }
    case "lone_high_surrogate_string":
      return "\ud800"
    case "lone_low_surrogate_string":
      return "\udc00"
  }
}

function resolveField(vector: VectorV0, base: "left" | "right" | "value"): unknown {
  const kindField = `${base}_kind` as const
  const kind = (vector as unknown as Record<string, VectorKindKey | undefined>)[kindField]
  if (kind !== undefined) {
    return resolveKind(kind, (vector as unknown as Record<string, unknown>)[base], vector.value_key)
  }
  return (vector as unknown as Record<string, unknown>)[base]
}

function vectorById(vectorId: string): VectorV0 {
  const found = VECTOR_FILE.vectors.find((vector) => vector.vector_id === vectorId)
  if (!found) throw new Error(`conformance vector not found: ${vectorId}`)
  return found
}

// ---------------------------------------------------------------------------
// The real comparator, run against every vector.
// ---------------------------------------------------------------------------

describe("canonicalIdentityJson conformance v0: real comparator", () => {
  test("vector file is self-consistent (schema present, at least the required minimum vector/mutant coverage)", () => {
    expect(VECTOR_FILE.schema).toBe("receiptos.canonical_identity_json_conformance_vectors.v0")
    expect(VECTOR_FILE.vectors.length).toBeGreaterThanOrEqual(20)
    expect(VECTOR_FILE.mutants.length).toBeGreaterThanOrEqual(1)
  })

  for (const vector of VECTOR_FILE.vectors) {
    test(`${vector.vector_id} (${vector.category}): ${vector.description}`, () => {
      if (vector.category === "equal_pair") {
        const left = resolveField(vector, "left")
        const right = resolveField(vector, "right")
        expect(canonicalIdentityJson(left)).toBe(canonicalIdentityJson(right))
      } else if (vector.category === "not_equal_pair") {
        const left = resolveField(vector, "left")
        const right = resolveField(vector, "right")
        expect(canonicalIdentityJson(left)).not.toBe(canonicalIdentityJson(right))
      } else if (vector.category === "canonical_form") {
        const value = resolveField(vector, "value")
        expect(canonicalIdentityJson(value)).toBe(vector.expected_canonical)
      } else {
        const value = resolveField(vector, "value")
        expect(() => canonicalIdentityJson(value)).toThrow()
      }
    })
  }

  test("lone surrogates are rejected in object keys as well as values", () => {
    expect(() => canonicalIdentityJson({ ["\ud800"]: 1 })).toThrow()
    expect(() => canonicalIdentityJson({ ["\udc00"]: 1 })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Mutant comparators. Each is a full, independent reimplementation of the
// canonicalization walk with exactly one deliberate flaw -- never derived
// from or delegating to the real canonicalIdentityJson.
// ---------------------------------------------------------------------------

function mutantSortArraysAsSets(value: unknown): string {
  if (value === null) return "null"
  if (value === true) return "true"
  if (value === false) return "false"
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("mutant rejects non-finite numbers")
    return String(value)
  }
  if (Array.isArray(value)) {
    const canonicalizedEntries = value.map((entry) => mutantSortArraysAsSets(entry))
    const dedupedSorted = [...new Set(canonicalizedEntries)].sort()
    return `[${dedupedSorted.join(",")}]`
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    for (const key of keys) {
      if (record[key] === undefined) throw new Error("mutant forbids undefined")
    }
    return `{${keys.map((key) => `${JSON.stringify(key)}:${mutantSortArraysAsSets(record[key])}`).join(",")}}`
  }
  throw new Error(`mutant rejects ${typeof value}`)
}

function mutantDropNullValuedFields(value: unknown): string {
  if (value === null) return "null"
  if (value === true) return "true"
  if (value === false) return "false"
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("mutant rejects non-finite numbers")
    return String(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => mutantDropNullValuedFields(entry)).join(",")}]`
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    // The flaw: silently drop null-valued keys, as if they were absent.
    const keys = Object.keys(record)
      .filter((key) => record[key] !== null)
      .sort()
    for (const key of keys) {
      if (record[key] === undefined) throw new Error("mutant forbids undefined")
    }
    return `{${keys.map((key) => `${JSON.stringify(key)}:${mutantDropNullValuedFields(record[key])}`).join(",")}}`
  }
  throw new Error(`mutant rejects ${typeof value}`)
}

function mutantLowercaseStrings(value: unknown): string {
  if (value === null) return "null"
  if (value === true) return "true"
  if (value === false) return "false"
  // The flaw: fold string case before canonicalizing.
  if (typeof value === "string") return JSON.stringify(value.toLowerCase())
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("mutant rejects non-finite numbers")
    return String(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => mutantLowercaseStrings(entry)).join(",")}]`
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    for (const key of keys) {
      if (record[key] === undefined) throw new Error("mutant forbids undefined")
    }
    return `{${keys.map((key) => `${JSON.stringify(key)}:${mutantLowercaseStrings(record[key])}`).join(",")}}`
  }
  throw new Error(`mutant rejects ${typeof value}`)
}

function numericStringAsNumber(value: string): number | null {
  if (value.trim() === "") return null
  const asNumber = Number(value)
  return Number.isFinite(asNumber) ? asNumber : null
}

function mutantCoerceNumericStringsToNumbers(value: unknown): string {
  if (value === null) return "null"
  if (value === true) return "true"
  if (value === false) return "false"
  if (typeof value === "string") {
    // The flaw: a string that parses as a finite number canonicalizes as
    // that number instead of as a quoted string.
    const coerced = numericStringAsNumber(value)
    return coerced === null ? JSON.stringify(value) : String(coerced)
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("mutant rejects non-finite numbers")
    return String(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => mutantCoerceNumericStringsToNumbers(entry)).join(",")}]`
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    for (const key of keys) {
      if (record[key] === undefined) throw new Error("mutant forbids undefined")
    }
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${mutantCoerceNumericStringsToNumbers(record[key])}`)
      .join(",")}}`
  }
  throw new Error(`mutant rejects ${typeof value}`)
}

const MUTANT_IMPLEMENTATIONS: Readonly<Record<string, (value: unknown) => string>> = Object.freeze({
  sort_arrays_as_sets: mutantSortArraysAsSets,
  drop_null_valued_fields: mutantDropNullValuedFields,
  lowercase_strings: mutantLowercaseStrings,
  coerce_numeric_strings_to_numbers: mutantCoerceNumericStringsToNumbers,
})

describe("canonicalIdentityJson conformance v0: mutant rejection (load-bearing)", () => {
  test("every mutant declared in vectors.json has a corresponding implementation in this file", () => {
    for (const mutant of VECTOR_FILE.mutants) {
      expect(MUTANT_IMPLEMENTATIONS[mutant.mutant_id]).toBeDefined()
    }
  })

  for (const mutant of VECTOR_FILE.mutants) {
    describe(`mutant: ${mutant.mutant_id} -- ${mutant.description}`, () => {
      const implementation = MUTANT_IMPLEMENTATIONS[mutant.mutant_id]!

      for (const vectorId of mutant.wrongly_collapses_vector_ids) {
        test(`wrongly collapses ${vectorId}, which the real comparator correctly keeps distinct`, () => {
          const vector = vectorById(vectorId)
          expect(vector.category).toBe("not_equal_pair")
          const left = resolveField(vector, "left")
          const right = resolveField(vector, "right")

          // The real comparator must correctly reject this pair as equal --
          // re-asserted here (not just in the main vector loop above) so
          // this test file's mutant-rejection claim is self-contained.
          expect(canonicalIdentityJson(left)).not.toBe(canonicalIdentityJson(right))

          // The mutant wrongly accepts it -- this is the actual proof the
          // vector set discriminates the real comparator from this mutant.
          expect(implementation(left)).toBe(implementation(right))
        })
      }
    })
  }
})
