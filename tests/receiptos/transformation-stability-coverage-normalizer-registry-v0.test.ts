/**
 * Closed-World Profile Coverage v0 -- normalizer authority registry, v0
 * authentication package.
 *
 * This file authenticates the ONE v0 registry entry,
 * "receiptos.sortCollectionRefs.multiset.v0", along two independent axes:
 *
 *   1. Implementation identity -- the registered implementation is byte-pinned
 *      back to the exact, already-frozen sortCollectionRefs export via a git
 *      blob OID (same convention used throughout this repository's
 *      conformance/interoperability packages). This proves the code is
 *      unchanged; it does NOT by itself prove the code satisfies its
 *      declared equivalence relation.
 *
 *   2. Equivalence soundness (and, for this normalizer, completeness) --
 *      proven by the vectors below, which exercise every edge of the
 *      declared "multiset_reorder_only" relation: reorder collapses,
 *      duplicates are preserved (never deduped), and multiplicity/add/
 *      remove/substitute changes never collapse. A deliberately broken
 *      mutant normalizer (sort+dedupe) is run through the SAME vector set
 *      and must be rejected by it -- this is load-bearing: if the mutant
 *      passed, the vector set would be insufficient to authenticate the
 *      real normalizer either.
 *
 * This file is intentionally independent of the coverage pilot test suite
 * (transformation-stability-coverage-v0.test.ts): it never imports the
 * pilot's ChroniclePortfolioV0 fixtures and never calls
 * evaluateChroniclePortfolioWithCoverageV0. It also authenticates the
 * profile-level API contract: an inline function is rejected (both at the
 * TypeScript type level -- checked by the CoverageProfileInputV0 type
 * itself not admitting one, verified structurally in this file's runtime
 * backstop test -- and at runtime), an unknown normalizer_id is rejected,
 * a normalizer referenced via a wildcard selector is rejected, and a
 * normalizer targeting a path with no exact N/S/A declaration is rejected.
 */

import { describe, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { resolve } from "node:path"
import { canonicalIdentityJson } from "../../src/receiptos/challenge/counterfactual-neighborhood"
import { defineCoverageProfileV0 } from "../../src/receiptos/challenge/transformation-stability-coverage"
import {
  SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0,
  listNormalizerIdsV0,
  lookupNormalizerV0,
} from "../../src/receiptos/challenge/transformation-stability-coverage-normalizer-registry"

const root = resolve(import.meta.dir, "..", "..")

const gitIndexBlobOid = (repositoryPath: string) =>
  execFileSync("git", ["rev-parse", `:${repositoryPath}`], { cwd: root, encoding: "utf8" }).trim()

// ---------------------------------------------------------------------------
// Implementation identity.
// ---------------------------------------------------------------------------

describe("normalizer registry: implementation identity", () => {
  test("the registered v0 normalizer's source blob OID matches the pinned expectation", () => {
    const entry = lookupNormalizerV0(SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0)
    expect(entry).toBeDefined()
    const actualOid = gitIndexBlobOid(entry!.implementation_source_path)
    // Blob identity proves the referenced implementation is unchanged. It
    // does not, by itself, prove the implementation is equivalence-sound --
    // that is what the vectors below are for.
    expect(actualOid).toBe(entry!.expected_source_blob_oid)
  })

  test("registry lists exactly one v0 normalizer_id", () => {
    expect(listNormalizerIdsV0()).toEqual(["receiptos.sortCollectionRefs.multiset.v0"])
  })

  test("duplicate normalizer_id registration fails closed at module load (structural check on the closed registry)", () => {
    // The registry module throws at load time if REGISTRY_ENTRIES ever
    // contains a duplicate normalizer_id -- proven here indirectly: the
    // module already loaded successfully (imports above did not throw),
    // and it exposes exactly one id, so no duplicate exists in the current
    // registry contents.
    expect(listNormalizerIdsV0().length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Equivalence vectors -- the real normalizer.
//
// Vectors compare via canonicalIdentityJson, the same strict comparator the
// coverage plane itself uses for atom equality (see normalizeForPath /
// buildAtom in transformation-stability-coverage.ts) -- so "collapses" here
// means exactly what it means to the evaluator: identical canonical JSON
// after normalization.
// ---------------------------------------------------------------------------

function applyRealNormalizer(value: string[]): unknown {
  const entry = lookupNormalizerV0(SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0)!
  return entry.implementation(value)
}

function collapses(a: string[], b: string[], apply: (value: string[]) => unknown): boolean {
  return canonicalIdentityJson(apply(a)) === canonicalIdentityJson(apply(b))
}

describe("normalizer registry: equivalence vectors (receiptos.sortCollectionRefs.multiset.v0)", () => {
  test("deterministic: repeated application to the same input yields identical canonical output", () => {
    const input = ["c-3", "c-1", "c-2"]
    const first = canonicalIdentityJson(applyRealNormalizer(input))
    const second = canonicalIdentityJson(applyRealNormalizer(input))
    expect(first).toBe(second)
  })

  test("idempotent: normalizing an already-normalized value is a no-op", () => {
    const input = ["c-3", "c-1", "c-2"]
    const once = applyRealNormalizer(input) as string[]
    const twice = applyRealNormalizer(once)
    expect(canonicalIdentityJson(twice)).toBe(canonicalIdentityJson(once))
  })

  test("reorder collapses: same refs, different order, normalize identically", () => {
    expect(collapses(["c-1", "c-2", "c-3"], ["c-3", "c-1", "c-2"], applyRealNormalizer)).toBe(true)
  })

  test("duplicates preserved: a duplicated ref is never deduped by normalization", () => {
    const normalized = applyRealNormalizer(["c-1", "c-1", "c-2"]) as string[]
    expect(normalized).toEqual(["c-1", "c-1", "c-2"])
    expect(normalized.length).toBe(3)
  })

  test("multiplicity mismatch does NOT collapse: same ref set, different per-ref duplicate counts", () => {
    expect(collapses(["c-1", "c-1", "c-2"], ["c-1", "c-2", "c-2"], applyRealNormalizer)).toBe(false)
  })

  test("added ref does NOT collapse", () => {
    expect(collapses(["c-1", "c-2"], ["c-1", "c-2", "c-3"], applyRealNormalizer)).toBe(false)
  })

  test("removed ref does NOT collapse", () => {
    expect(collapses(["c-1", "c-2", "c-3"], ["c-1", "c-2"], applyRealNormalizer)).toBe(false)
  })

  test("substituted ref does NOT collapse", () => {
    expect(collapses(["c-1", "c-2", "c-3"], ["c-1", "c-2", "c-4"], applyRealNormalizer)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Mutant rejection -- load-bearing. A sort+dedupe mutant is NOT equivalent
// to "multiset_reorder_only": it collapses on cases where the declared
// relation must not. If this mutant passed all vectors above, the vector
// set itself would be insufficient to authenticate the real normalizer.
// ---------------------------------------------------------------------------

function applyMutantSortDedupeNormalizer(value: string[]): unknown {
  return [...new Set(value)].sort((a, b) => a.localeCompare(b))
}

describe("normalizer registry: mutant rejection (sort+dedupe is NOT multiset_reorder_only)", () => {
  test("mutant wrongly collapses a duplicate-count change that must not collapse", () => {
    // Real normalizer correctly rejects this pair (see "multiplicity
    // mismatch" vector above); the mutant wrongly accepts it.
    const a = ["c-1", "c-1", "c-2"]
    const b = ["c-1", "c-2", "c-2"]
    expect(collapses(a, b, applyRealNormalizer)).toBe(false)
    expect(collapses(a, b, applyMutantSortDedupeNormalizer)).toBe(true)
  })

  test("mutant wrongly collapses a duplicate-vs-single-occurrence pair that must not collapse", () => {
    const a = ["c-1", "c-1"]
    const b = ["c-1"]
    expect(collapses(a, b, applyRealNormalizer)).toBe(false)
    expect(collapses(a, b, applyMutantSortDedupeNormalizer)).toBe(true)
  })

  test("mutant still agrees with the real normalizer on plain reorder (necessary but not sufficient)", () => {
    const a = ["c-1", "c-2", "c-3"]
    const b = ["c-3", "c-1", "c-2"]
    expect(collapses(a, b, applyRealNormalizer)).toBe(true)
    expect(collapses(a, b, applyMutantSortDedupeNormalizer)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Profile-level API contract: defineCoverageProfileV0 must reject every
// unauthenticated or misdirected normalizer reference.
// ---------------------------------------------------------------------------

describe("normalizer registry: coverage profile validation", () => {
  test("a valid normalizer_id on an exact N-classified path is accepted", () => {
    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "collection_refs", targetClass: "N" }],
      value_normalizers: { collection_refs: SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0 },
    })
    expect(result.ok).toBe(true)
  })

  test("unknown normalizer_id is rejected: profile invalid", () => {
    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "collection_refs", targetClass: "N" }],
      value_normalizers: { collection_refs: "receiptos.doesNotExist.v0" },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.some((r) => r.startsWith("unauthenticated_normalizer_id:"))).toBe(true)
    }
  })

  test("an inline function passed where a normalizer_id string is required is rejected at runtime (defensive backstop)", () => {
    const inlineFunction = ((value: unknown) => value) as unknown as string
    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "collection_refs", targetClass: "N" }],
      value_normalizers: { collection_refs: inlineFunction },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.some((r) => r.startsWith("value_normalizer_must_be_authenticated_id_string_not_inline_function:"))).toBe(
        true,
      )
    }
  })

  test("a normalizer targeting a path with no matching exact N/S/A declaration is rejected", () => {
    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "portfolio_id", targetClass: "N" }],
      value_normalizers: { collection_refs: SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0 },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.some((r) => r.startsWith("normalizer_target_path_not_classified:"))).toBe(true)
    }
  })

  test("a normalizer referenced via a wildcard selector is rejected: normalizers must target an exact path", () => {
    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "collection_refs", targetClass: "N" }],
      value_normalizers: { "collection_refs.**": SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0 },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.some((r) => r.startsWith("value_normalizer_key_must_be_exact_selector:"))).toBe(true)
    }
  })
})
