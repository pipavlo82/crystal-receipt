/**
 * Closed-World Profile Coverage v0 -- ReceiptOS Chronicle normalizer
 * authority binding.
 *
 * Follow-up to transformation-stability-coverage.ts (see commit
 * ee5bafb1e5cc0c44ba42b640ce03663fd8db6876, which accepted an arbitrary
 * inline `(value: unknown) => unknown` function per path, and commit
 * b8c72e629dd169fa79d767f16a6e08edea966c95, whose first cut of dependency
 * injection -- a naked `(normalizerId) => {implementation}` resolver
 * closure -- reopened the same trust hole one layer lower, since any
 * caller could attach an arbitrary implementation behind an otherwise-
 * valid normalizer_id). Both gaps are closed the same way: a coverage
 * profile may only reference an authenticated `normalizer_id` string,
 * resolved against a validated, branded `NormalizerAuthorityV0` (see
 * transformation-stability-coverage-normalizer-authority.ts) -- never an
 * inline function, and never a bare resolver closure.
 *
 * This file is the ReceiptOS-specific *binding*: it constructs exactly
 * one such authority, containing exactly one entry
 * (`receiptos.sortCollectionRefs.multiset.v0`), via the generic
 * authority's own constructor -- it is not itself part of the generic
 * mechanism, and transformation-stability-coverage.ts has no import of
 * this file (or any Chronicle module) at all.
 *
 * Four concepts are kept structurally separate, on purpose:
 *   - coverage classification (N/S/A/F)              -- unaffected by this file
 *   - declared equivalence relation E                 -- prose/data, below
 *   - normalizer implementation                        -- reused, unchanged code
 *   - normalizer authority (identity binding)          -- this file's authority object
 *
 * A normalizer's *implementation identity* (which exact code runs) is
 * authenticated by a pinned source blob OID, exactly like every other
 * frozen-primitive reference in this repository's conformance and
 * interoperability packages. That is necessary but NOT sufficient: blob
 * identity proves the code is unchanged, not that it satisfies its
 * declared equivalence relation. Equivalence *soundness* (and, for this
 * one v0 normalizer, completeness) is authenticated separately, by the
 * conformance vectors in
 * transformation-stability-coverage-normalizer-registry-v0.test.ts, which
 * also proves a deliberately broken (sort+dedupe) mutant normalizer is
 * rejected by the same vector set -- if the mutant passed, the vectors
 * would be insufficient. This provenance metadata (blob OID, source path,
 * export name, determinism/idempotence/duplicate/order semantics) is kept
 * as a separate ReceiptOS-specific record below, since the generic
 * NormalizerAuthorityEntryV0 shape intentionally carries only
 * normalizer_id + equivalence_kind + implementation -- provenance-grade
 * evidence is this domain's concern, not the generic mechanism's.
 */

import { sortCollectionRefs } from "../capsule/chronicle-portfolio-v0"
import {
  defineNormalizerAuthorityV0,
  type NormalizerAuthorityV0,
} from "./transformation-stability-coverage-normalizer-authority"

export const SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0 = "receiptos.sortCollectionRefs.multiset.v0" as const

function sortCollectionRefsNormalizerV0(value: unknown): unknown {
  if (!Array.isArray(value)) return value
  return sortCollectionRefs(value as string[])
}

// ---------------------------------------------------------------------------
// ReceiptOS-specific provenance metadata. Not part of the generic
// authority entry shape -- looked up separately by normalizer_id, purely
// for this domain's own conformance/authentication evidence.
// ---------------------------------------------------------------------------

export type ChronicleNormalizerProvenanceV0 = {
  readonly normalizer_id: string
  readonly equivalence_kind: string
  readonly description: string
  readonly implementation_source_path: string
  readonly implementation_export_name: string
  readonly expected_source_blob_oid: string
  readonly deterministic: true
  readonly idempotent: true
  readonly duplicate_semantics: "preserved" | "collapsed"
  readonly order_semantics: "non_normative" | "normative"
}

const CHRONICLE_NORMALIZER_PROVENANCE_V0: readonly ChronicleNormalizerProvenanceV0[] = Object.freeze([
  Object.freeze({
    normalizer_id: SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0,
    equivalence_kind: "multiset_reorder_only",
    description:
      "Two collection_refs arrays are equivalent iff they contain the same ref values with the same per-ref " +
      "multiplicities; order is non-normative. Reorder collapses; add/remove/substitute a ref or change any " +
      "ref's multiplicity does not collapse.",
    implementation_source_path: "src/receiptos/capsule/chronicle-portfolio-v0.ts",
    implementation_export_name: "sortCollectionRefs",
    expected_source_blob_oid: "0e790911092546c62344f980e6b611542bcd00fe",
    deterministic: true,
    idempotent: true,
    duplicate_semantics: "preserved",
    order_semantics: "non_normative",
  }),
])

export function lookupChronicleNormalizerProvenanceV0(normalizerId: string): ChronicleNormalizerProvenanceV0 | undefined {
  return CHRONICLE_NORMALIZER_PROVENANCE_V0.find((entry) => entry.normalizer_id === normalizerId)
}

export function listChronicleNormalizerIdsV0(): readonly string[] {
  return CHRONICLE_NORMALIZER_PROVENANCE_V0.map((entry) => entry.normalizer_id).sort()
}

// ---------------------------------------------------------------------------
// The actual normalizer authority. Constructed once, via the generic
// constructor -- not hand-assembled -- so it inherits that constructor's
// own duplicate-ID rejection and entry-shape validation. Not extensible
// at runtime by profile authors: this module-load-time construction is
// the only place a new normalizer_id can ever be admitted into this
// authority.
// ---------------------------------------------------------------------------

const CHRONICLE_NORMALIZER_AUTHORITY_RESULT_V0 = defineNormalizerAuthorityV0({
  authority_id: "receiptos.chronicle.normalizer_authority.v0",
  authority_version: "v0",
  entries: [
    {
      normalizer_id: SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0,
      equivalence_kind: "multiset_reorder_only",
      implementation: sortCollectionRefsNormalizerV0,
    },
  ],
})

if (!CHRONICLE_NORMALIZER_AUTHORITY_RESULT_V0.ok) {
  // Fails fast at module load if this binding's own authority
  // construction is ever malformed -- the same fail-closed discipline the
  // generic authority constructor itself enforces.
  throw new Error(
    `chronicle normalizer authority is invalid: ${CHRONICLE_NORMALIZER_AUTHORITY_RESULT_V0.reasons.join("; ")}`,
  )
}

export const CHRONICLE_NORMALIZER_AUTHORITY_V0: NormalizerAuthorityV0 = CHRONICLE_NORMALIZER_AUTHORITY_RESULT_V0.authority
