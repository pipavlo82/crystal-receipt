/**
 * Canonical identity JSON -- generic comparator v0.
 *
 * This is the one shared, domain-neutral equality primitive used by
 * transformation-stability.ts, transformation-stability-cycle.ts, and
 * transformation-stability-coverage.ts for every projection/atom/endpoint
 * comparison in the Transformation Stability generic core. It has zero
 * runtime dependency on any ReceiptOS/Chronicle/HandoffEvidence/verifier-
 * challenge domain concept -- this file imports nothing beyond the language
 * itself.
 *
 * Relocated, unchanged, from counterfactual-neighborhood.ts (see
 * TRANSFORMATION_STABLE_INTEROPERABILITY_EXTRACTION_AUDIT_V0's "remaining
 * ReceiptOS dependencies" finding #2): that module still re-exports this
 * same implementation so every existing caller keeps working without
 * modification. Semantics are byte-for-byte identical to the prior
 * implementation; only the module boundary moved.
 *
 * Recipe: validate strings as Unicode scalar-value sequences, sort object
 * keys lexicographically by Unicode scalar value; arrays keep declared order; compact
 * separators; `null` is a present value, distinct from an absent key;
 * non-finite numbers and `undefined` (top-level or key-valued) are
 * rejected, never silently coerced. See
 * tests/receiptos/canonical-identity-json-conformance-v0.test.ts and
 * conformance/canonical-identity-json-conformance-v0/vectors.json for
 * mechanically-authenticated, frozen evidence of exactly what this function
 * does and does not consider equal -- including JS-specific behavior
 * (e.g. `0` and `-0` canonicalize identically) that is documented as
 * observed fact, not redesigned.
 */

function assertUnicodeScalarSequence(value: string, context: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index)
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new Error(`canonicalIdentityJson rejects lone surrogate in ${context}`)
      }
      index += 1
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new Error(`canonicalIdentityJson rejects lone surrogate in ${context}`)
    }
  }
}

function compareUnicodeScalarSequences(left: string, right: string): number {
  assertUnicodeScalarSequence(left, "object key")
  assertUnicodeScalarSequence(right, "object key")

  let leftIndex = 0
  let rightIndex = 0
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftScalar = left.codePointAt(leftIndex)!
    const rightScalar = right.codePointAt(rightIndex)!
    if (leftScalar !== rightScalar) return leftScalar < rightScalar ? -1 : 1
    leftIndex += leftScalar > 0xffff ? 2 : 1
    rightIndex += rightScalar > 0xffff ? 2 : 1
  }
  if (leftIndex === left.length && rightIndex === right.length) return 0
  return leftIndex === left.length ? -1 : 1
}

export function canonicalIdentityJson(value: unknown): string {
  if (value === null) return "null"
  if (value === true) return "true"
  if (value === false) return "false"
  if (typeof value === "string") {
    assertUnicodeScalarSequence(value, "string value")
    return JSON.stringify(value)
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("canonicalIdentityJson rejects non-finite numbers")
    }
    return String(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalIdentityJson(entry)).join(",")}]`
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record)
    for (const key of keys) {
      assertUnicodeScalarSequence(key, "object key")
      if (record[key] === undefined) {
        throw new Error(`canonicalIdentityJson forbids undefined at key ${JSON.stringify(key)}`)
      }
    }
    keys.sort(compareUnicodeScalarSequences)
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalIdentityJson(record[key])}`)
      .join(",")}}`
  }
  throw new Error(`canonicalIdentityJson rejects ${typeof value}`)
}
