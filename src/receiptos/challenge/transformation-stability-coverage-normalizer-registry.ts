/**
 * Closed-World Profile Coverage v0 -- normalizer authority registry.
 *
 * Follow-up to transformation-stability-coverage.ts (see commit
 * ee5bafb1e5cc0c44ba42b640ce03663fd8db6876). That commit's
 * `value_normalizers` field accepted an arbitrary inline
 * `(value: unknown) => unknown` function per path, with no mechanical check
 * on what the function actually did. This module closes that gap: a
 * coverage profile may now only reference an authenticated `normalizer_id`
 * string resolved against the closed registry below -- never an inline
 * function.
 *
 * Three concepts are kept structurally separate, on purpose:
 *   - coverage classification (N/S/A/F)              -- unaffected by this file
 *   - declared equivalence relation E                 -- prose/data, below
 *   - normalizer implementation                        -- reused, unchanged code
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
 * would be insufficient.
 */

import { sortCollectionRefs } from "../capsule/chronicle-portfolio-v0"

export type NormalizerEquivalenceKindV0 = "multiset_reorder_only"

export type NormalizerRegistryEntryV0 = {
  readonly normalizer_id: string
  readonly equivalence_kind: NormalizerEquivalenceKindV0
  readonly description: string
  readonly implementation: (value: unknown) => unknown
  readonly implementation_source_path: string
  readonly implementation_export_name: string
  readonly expected_source_blob_oid: string
  readonly deterministic: true
  readonly idempotent: true
  readonly duplicate_semantics: "preserved" | "collapsed"
  readonly order_semantics: "non_normative" | "normative"
}

function sortCollectionRefsNormalizerV0(value: unknown): unknown {
  if (!Array.isArray(value)) return value
  return sortCollectionRefs(value as string[])
}

// ---------------------------------------------------------------------------
// Closed registry. Not extensible by profile authors -- this array is the
// only place a new normalizer_id can ever be admitted, and every entry
// requires the full authentication chain documented in the module comment
// above before it may be added here.
// ---------------------------------------------------------------------------

const REGISTRY_ENTRIES: readonly NormalizerRegistryEntryV0[] = [
  {
    normalizer_id: "receiptos.sortCollectionRefs.multiset.v0",
    equivalence_kind: "multiset_reorder_only",
    description:
      "Two collection_refs arrays are equivalent iff they contain the same ref values with the same per-ref " +
      "multiplicities; order is non-normative. Reorder collapses; add/remove/substitute a ref or change any " +
      "ref's multiplicity does not collapse.",
    implementation: sortCollectionRefsNormalizerV0,
    implementation_source_path: "src/receiptos/capsule/chronicle-portfolio-v0.ts",
    implementation_export_name: "sortCollectionRefs",
    expected_source_blob_oid: "0e790911092546c62344f980e6b611542bcd00fe",
    deterministic: true,
    idempotent: true,
    duplicate_semantics: "preserved",
    order_semantics: "non_normative",
  },
]

function buildRegistryV0(): ReadonlyMap<string, NormalizerRegistryEntryV0> {
  const map = new Map<string, NormalizerRegistryEntryV0>()
  for (const entry of REGISTRY_ENTRIES) {
    if (map.has(entry.normalizer_id)) {
      // Fail closed at module load -- duplicate normalizer_id registration
      // must never silently resolve to "whichever was registered last".
      throw new Error(`duplicate_normalizer_id_registration:${entry.normalizer_id}`)
    }
    map.set(entry.normalizer_id, Object.freeze(entry))
  }
  return map
}

const REGISTRY_V0: ReadonlyMap<string, NormalizerRegistryEntryV0> = buildRegistryV0()

export function lookupNormalizerV0(normalizerId: string): NormalizerRegistryEntryV0 | undefined {
  return REGISTRY_V0.get(normalizerId)
}

export function listNormalizerIdsV0(): readonly string[] {
  return [...REGISTRY_V0.keys()].sort()
}

export const SORT_COLLECTION_REFS_MULTISET_NORMALIZER_ID_V0 = "receiptos.sortCollectionRefs.multiset.v0" as const
