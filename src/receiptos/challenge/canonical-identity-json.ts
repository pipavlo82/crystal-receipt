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
 * Recipe: sort object keys ascending; arrays keep declared order; compact
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

export function canonicalIdentityJson(value: unknown): string {
  if (value === null) return "null"
  if (value === true) return "true"
  if (value === false) return "false"
  if (typeof value === "string") return JSON.stringify(value)
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
    const keys = Object.keys(record).sort()
    for (const key of keys) {
      if (record[key] === undefined) {
        throw new Error(`canonicalIdentityJson forbids undefined at key ${JSON.stringify(key)}`)
      }
    }
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalIdentityJson(record[key])}`)
      .join(",")}}`
  }
  throw new Error(`canonicalIdentityJson rejects ${typeof value}`)
}
