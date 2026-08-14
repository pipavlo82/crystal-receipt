/**
 * Closed-World Profile Coverage v0 -- ReceiptOS Chronicle normalizer
 * authority, v0 authentication package.
 *
 * This file authenticates the ONE v0 authority entry,
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
 * repaired profile-level API contract (see
 * transformation-stability-coverage-normalizer-authority.ts's header
 * comment for the defect this repairs): a bare resolver function/closure
 * is no longer an accepted shape for `normalizer_authority` at all; an
 * authority that returns an entry for the wrong requested ID fails
 * closed; duplicate IDs fail authority construction, not just profile
 * validation; an inline function is rejected (both at the TypeScript type
 * level and at runtime); an unknown normalizer_id is rejected; a
 * normalizer referenced via a wildcard selector is rejected; a normalizer
 * targeting a path with no exact N/S/A declaration is rejected; and --
 * since the generic coverage module carries no default authority of its
 * own -- a real, valid normalizer_id is still rejected when this test
 * omits the `normalizer_authority` the ReceiptOS binding otherwise
 * supplies explicitly (see
 * transformation-stability-chronicle-portfolio-coverage-v1.ts).
 */

import { describe, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { resolve } from "node:path"
import { canonicalIdentityJson } from "../../src/receiptos/challenge/canonical-identity-json"
import { defineCoverageProfileV0 } from "../../src/receiptos/challenge/transformation-stability-coverage"
import {
  defineNormalizerAuthorityV0,
  type NormalizerAuthorityV0,
} from "../../src/receiptos/challenge/transformation-stability-coverage-normalizer-authority"
import {
  CHRONICLE_NORMALIZER_AUTHORITY_V0,
  SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0,
  listChronicleNormalizerIdsV0,
  lookupChronicleNormalizerProvenanceV0,
} from "../../src/receiptos/challenge/transformation-stability-coverage-normalizer-registry"

const root = resolve(import.meta.dir, "..", "..")

const gitIndexBlobOid = (repositoryPath: string) =>
  execFileSync("git", ["rev-parse", `:${repositoryPath}`], { cwd: root, encoding: "utf8" }).trim()

// ---------------------------------------------------------------------------
// Implementation identity.
// ---------------------------------------------------------------------------

describe("normalizer authority: implementation identity", () => {
  test("the registered v0 normalizer's source blob OID matches the pinned expectation", () => {
    const provenance = lookupChronicleNormalizerProvenanceV0(SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0)
    expect(provenance).toBeDefined()
    const actualOid = gitIndexBlobOid(provenance!.implementation_source_path)
    // Blob identity proves the referenced implementation is unchanged. It
    // does not, by itself, prove the implementation is equivalence-sound --
    // that is what the vectors below are for.
    expect(actualOid).toBe(provenance!.expected_source_blob_oid)
  })

  test("authority lists exactly one v0 normalizer_id", () => {
    expect(listChronicleNormalizerIdsV0()).toEqual(["receiptos.sortCollectionRefs.multiset.v0"])
  })

  test("the authority object is properly branded and resolves its one entry with a matching normalizer_id", () => {
    expect(CHRONICLE_NORMALIZER_AUTHORITY_V0.__brand).toBe("NormalizerAuthorityV0")
    const entry = CHRONICLE_NORMALIZER_AUTHORITY_V0.resolve(SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0)
    expect(entry).toBeDefined()
    expect(entry!.normalizer_id).toBe(SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0)
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
  const entry = CHRONICLE_NORMALIZER_AUTHORITY_V0.resolve(SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0)!
  return entry.implementation(value)
}

function collapses(a: string[], b: string[], apply: (value: string[]) => unknown): boolean {
  return canonicalIdentityJson(apply(a)) === canonicalIdentityJson(apply(b))
}

describe("normalizer authority: equivalence vectors (receiptos.sortCollectionRefs.multiset.v0)", () => {
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

describe("normalizer authority: mutant rejection (sort+dedupe is NOT multiset_reorder_only)", () => {
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

describe("normalizer authority: coverage profile validation", () => {
  test("a valid normalizer_id on an exact N-classified path is accepted when the caller supplies the ReceiptOS authority", () => {
    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "collection_refs", targetClass: "N" }],
      value_normalizers: { collection_refs: SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0 },
      normalizer_authority: CHRONICLE_NORMALIZER_AUTHORITY_V0,
    })
    expect(result.ok).toBe(true)
  })

  test("a valid normalizer_id with no authority supplied is rejected: no implicit/default authority exists", () => {
    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "collection_refs", targetClass: "N" }],
      value_normalizers: { collection_refs: SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0 },
      // No normalizer_authority -- even a real, valid ReceiptOS ID must be
      // rejected, because this module has no default authority of its own.
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.some((r) => r.startsWith("unauthenticated_normalizer_id:"))).toBe(true)
    }
  })

  test("unknown normalizer_id is rejected: profile invalid", () => {
    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "collection_refs", targetClass: "N" }],
      value_normalizers: { collection_refs: "receiptos.doesNotExist.v0" },
      normalizer_authority: CHRONICLE_NORMALIZER_AUTHORITY_V0,
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
      normalizer_authority: CHRONICLE_NORMALIZER_AUTHORITY_V0,
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

// ---------------------------------------------------------------------------
// Adversarial tests for the repaired authority boundary. These specifically
// target the defect this repair lane closes: a naked resolver closure (or
// any object that is not a genuinely-constructed, __brand-checked
// authority) must never be trusted to assign meaning to a normalizer_id.
// ---------------------------------------------------------------------------

describe("normalizer authority: adversarial boundary tests", () => {
  test("a naked resolver function is no longer an accepted normalizer_authority shape", () => {
    const nakedResolver = ((normalizerId: string) =>
      normalizerId === SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0
        ? { implementation: (value: unknown) => value }
        : undefined) as unknown as NormalizerAuthorityV0

    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "collection_refs", targetClass: "N" }],
      value_normalizers: { collection_refs: SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0 },
      normalizer_authority: nakedResolver,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.some((r) => r === "normalizer_authority_not_authenticated")).toBe(true)
    }
  })

  test("an authority object shaped like one but missing the __brand tag is rejected the same way a naked resolver is", () => {
    const unbranded = {
      authority_id: "fake.authority.v0",
      authority_version: "v0",
      resolve: () => ({
        normalizer_id: SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0,
        equivalence_kind: "multiset_reorder_only",
        implementation: (value: unknown) => value,
      }),
    } as unknown as NormalizerAuthorityV0

    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "collection_refs", targetClass: "N" }],
      value_normalizers: { collection_refs: SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0 },
      normalizer_authority: unbranded,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.some((r) => r === "normalizer_authority_not_authenticated")).toBe(true)
    }
  })

  test("an authority that returns an entry for the wrong requested ID fails closed (ID substitution rejected)", () => {
    // A deliberately misbehaving authority: correctly __brand-tagged (so it
    // passes the authentication check), but its resolve() always returns
    // an entry whose declared normalizer_id does not match what was asked
    // for -- simulating a buggy or compromised embedding-domain authority
    // implementation that was not honestly built through
    // defineNormalizerAuthorityV0's own Map-backed construction.
    const idSubstitutingAuthority: NormalizerAuthorityV0 = {
      __brand: "NormalizerAuthorityV0",
      authority_id: "adversarial.id_substituting_authority.v0",
      authority_version: "v0",
      resolve: (_requestedId: string) => ({
        normalizer_id: "some.completely.different.normalizer.v0",
        equivalence_kind: "multiset_reorder_only",
        implementation: (value: unknown) => value,
      }),
    }

    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "collection_refs", targetClass: "N" }],
      value_normalizers: { collection_refs: SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0 },
      normalizer_authority: idSubstitutingAuthority,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.some((r) => r.startsWith("normalizer_authority_id_mismatch:"))).toBe(true)
    }
  })

  test("duplicate normalizer_id entries fail authority construction itself, not just profile validation", () => {
    const duplicateImplementation = (value: unknown) => value
    const result = defineNormalizerAuthorityV0({
      authority_id: "adversarial.duplicate_id_authority.v0",
      authority_version: "v0",
      entries: [
        { normalizer_id: "dup.v0", equivalence_kind: "identity", implementation: duplicateImplementation },
        { normalizer_id: "dup.v0", equivalence_kind: "identity", implementation: duplicateImplementation },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.some((r) => r.startsWith("duplicate_normalizer_id_in_authority:dup.v0"))).toBe(true)
    }
  })

  test("the ReceiptOS Chronicle authority remains non-implicit: importing the registry module alone does not make its ID resolvable without explicit injection", () => {
    // Redundant with the "no authority supplied" test above, restated here
    // explicitly as a boundary assertion: merely having CHRONICLE_NORMALIZER_AUTHORITY_V0
    // imported and in scope in this test file does not make it apply to a
    // profile that does not explicitly pass it as normalizer_authority.
    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "collection_refs", targetClass: "N" }],
      value_normalizers: { collection_refs: SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0 },
    })
    expect(result.ok).toBe(false)
  })
})
