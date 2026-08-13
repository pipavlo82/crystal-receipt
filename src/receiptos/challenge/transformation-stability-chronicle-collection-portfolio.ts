/**
 * ReceiptOS Transformation Stability v0 — cross-object profile:
 * ChronicleCollectionV0[] -> ChroniclePortfolioV0.
 *
 * The second cross-object / multi-boundary Transformation Stability profile,
 * and the first set-valued one: the upstream side is a bundle of zero or
 * more Collections, not a single object. Every recompute/comparison
 * primitive here is imported unchanged from
 * src/receiptos/capsule/chronicle-portfolio-v0.ts and
 * src/receiptos/canon/canonicalize.ts; this module only wires them into the
 * existing generic transformation-stability.ts / transformation-stability-
 * cycle.ts evaluators. No new schema, root algorithm, canonicalizer,
 * reference format, or synchronization rule is introduced.
 * src/receiptos/capsule/chronicle-portfolio-v0.ts is NOT modified — its
 * blob is pinned by frozen conformance packages. Every mutation vector below
 * constructs its own local ChronicleCollectionV0 / ChroniclePortfolioV0
 * values instead.
 *
 * Cross-object invariant:
 *   sortCollectionRefs(collections.map(deriveCollectionRefFromChronicleCollection))
 *     === sortCollectionRefs(portfolio.collection_refs)
 *
 * This is multiset equality: order is ignored (both sides are already
 * normalized through the reused sortCollectionRefs), but duplicates are
 * preserved and duplicate counts matter. Confirmed live against the
 * committed functions during design: createChroniclePortfolioV0 maps
 * collections to refs and sorts them with no Set-based dedup (contrast
 * deriveArtifactRefsFromChronicleEntry, which explicitly wraps its result in
 * `Array.from(new Set(...))`), and computeChroniclePortfolioRoot hashes the
 * sorted (still duplicate-preserving) array directly — a portfolio holding
 * one copy of a ref genuinely hashes differently from one holding two, so
 * set equality would silently accept a real multiplicity mismatch.
 *
 * Locally-valid/globally-inconsistent cases this profile catches that
 * neither verifyChronicleCollectionV0 nor verifyChroniclePortfolioV0 can see
 * on their own (each only checks an object's *own* internal root
 * consistency): an upstream Collection identity mutation with a stale
 * Portfolio ref; a downstream Portfolio ref tamper with a recomputed
 * Portfolio root; a missing Portfolio ref; an extra Portfolio ref; wholesale
 * replacement of a bundled Collection with a different, independently valid
 * one; and a duplicate-ref multiplicity mismatch (two bundled Collections
 * sharing one collection_id, but the Portfolio storing only one copy of the
 * derived ref).
 *
 * Coordinated updates are NOT stable. If a mutation changes a Collection's
 * identity, that Collection's own claimed/recomputed root pair moves — and
 * `N` includes each Collection's root pair directly, not merely the
 * aggregate cross-link fact. Even when `portfolio.collection_refs` is
 * updated in lockstep so the cross-link itself stays consistent, the
 * underlying object identity still changed, and that remains a `violation`
 * by the same rule every other Transformation Stability profile in this
 * repository already enforces. Weakening `N` to omit the individual root
 * pairs — leaving only the aggregate cross-link boolean — would let a
 * coordinated identity change through as `stable`; that is deliberately
 * rejected here, matching the Collection -> Checkpoint profile.
 *
 * Reachable classification set: `stable`, `violation`, `unresolved`,
 * `out_of_domain`.
 *
 * `out_of_domain` is reached via the one real constructor-level
 * applicability boundary this profile's committed primitives actually
 * expose: createChroniclePortfolioV0 throws when given zero collections.
 * The precondition below uses that already-exported constructor as a live
 * probe (never a hand-copied `.length === 0` check), exactly the same
 * pattern the Collection -> Checkpoint profile already established for
 * createChronicleCheckpointV0. ChroniclePortfolioV0 alone has no
 * independent applicability rule distinct from recompute (confirmed by the
 * standalone Chronicle Portfolio profile) — the boundary here exists only
 * because a *bundle* of Collections is a new, first-class input to this
 * profile.
 *
 * `history_sensitive` is intentionally absent. Every declared field across
 * every bundled Collection, the Portfolio, and the derived/stored
 * cross-link set is accounted for in `N` or `F`: each Collection's
 * `schema`, claimed/recomputed root pair and match flag are `N`
 * (`schema` is excluded from the Collection root preimage, so it needs its
 * own explicit `N` field, confirmed by reading
 * computeChronicleCollectionRoot's Pick type); the normalized derived/stored
 * ref multisets and their cross-link match are `N`; the Portfolio's
 * `schema`, claimed/recomputed root pair and match flag are `N` (`schema`
 * is likewise excluded from the Portfolio root preimage); every `metadata`
 * (per-Collection and Portfolio) is `F`, since both are excluded from their
 * respective root preimages the same way; `artifact_refs` order and
 * `collection_refs` order are normalized away (confirmed live: neither
 * verifyChronicleCollectionV0 nor verifyChroniclePortfolioV0 gates stored
 * order the way verifyChronicleCheckpointV0 does for entry_refs — both
 * always re-sort internally before recomputing), and so is the position of
 * a Collection within the synthetic `bundle.collections` array, which has
 * no stored/committed meaning of its own. `S` is a canonical envelope of
 * the complete bundle with only those same non-normative orders stripped,
 * so it is a strict superset of `N`'s and `F`'s sensitivity — there is no
 * field that can move `S` alone.
 */

import { canonicalize } from "../canon/canonicalize"
import {
  type ChronicleCollectionV0,
  type ChroniclePortfolioV0,
  createChroniclePortfolioV0,
  deriveCollectionRefFromChronicleCollection,
  sortArtifactRefs,
  sortCollectionRefs,
  verifyChronicleCollectionV0,
  verifyChroniclePortfolioV0,
} from "../capsule/chronicle-portfolio-v0"
import {
  defineTransformationProfileV0,
  evaluateTransformationStabilityV0,
  type RecomputeOutcomeV0,
  type TransformationPreconditionResultV0,
  type TransformationStabilityClassificationV0,
  type TransformationStabilityResultV0,
} from "./transformation-stability"
import {
  defineTransformationCycleEdgeV0,
  defineTransformationCycleProfileV0,
  evaluateTransformationCycleV0,
  type AuthenticatedTransformationCycleEdgeV0,
  type TransformationStabilityCycleResultV0,
} from "./transformation-stability-cycle"

// ---------------------------------------------------------------------------
// Bundle and observation
// ---------------------------------------------------------------------------

export type ChronicleCollectionsPortfolioBundleV0 = {
  readonly collections: readonly ChronicleCollectionV0[]
  readonly portfolio: ChroniclePortfolioV0
}

export type ChronicleCollectionNormativeRecordV0 = {
  readonly schema: string
  readonly claimed_collection_root: string
  readonly recomputed_collection_root: string
  readonly collection_root_match: boolean
}

export type ChronicleCollectionMetadataRecordV0 = {
  readonly normative_collection_identity: ChronicleCollectionNormativeRecordV0
  readonly metadata: Record<string, unknown> | undefined
}

export type ChronicleCollectionsPortfolioObservationV0 = {
  readonly collection_normative_records: readonly ChronicleCollectionNormativeRecordV0[]
  readonly derived_collection_refs: readonly string[]
  readonly stored_collection_refs: readonly string[]
  readonly cross_link_match: boolean
  readonly portfolio_schema: string
  readonly claimed_portfolio_root: string
  readonly recomputed_portfolio_root: string
  readonly portfolio_root_match: boolean
  readonly collection_metadata_records: readonly ChronicleCollectionMetadataRecordV0[]
  readonly portfolio_metadata: Record<string, unknown> | undefined
  readonly canonical_envelope: string
}

// Duplicate-safe normalization: sorts by the canonical identity of each item
// itself (never by a field like derived_ref alone), so bundle position
// becomes non-observable even when multiple Collections derive the same
// ref. Reuses canonicalize() (not the generic core's canonicalIdentityJson)
// deliberately -- canonicalize() silently drops undefined-valued keys
// instead of throwing, which is required for sorting the metadata records
// below without forcing a premature null-normalization of the observation.
function sortByCanonicalKey<T>(items: readonly T[]): T[] {
  return items
    .map((item) => ({ item, key: canonicalize(item) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((entry) => entry.item)
}

function sortedStringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function recomputeChronicleCollectionsPortfolioV0(
  bundle: ChronicleCollectionsPortfolioBundleV0,
): RecomputeOutcomeV0<ChronicleCollectionsPortfolioObservationV0> {
  try {
    // Each Collection verifier call happens exactly once per bundled
    // Collection, inside this single map -- never duplicated elsewhere.
    const collectionEntries = bundle.collections.map((collection) => {
      const verification = verifyChronicleCollectionV0(collection)
      const record: ChronicleCollectionNormativeRecordV0 = {
        schema: collection.schema,
        claimed_collection_root: verification.collection_root,
        recomputed_collection_root: verification.recomputed_collection_root,
        collection_root_match: verification.ok,
      }
      return {
        derivedRef: deriveCollectionRefFromChronicleCollection(collection),
        record,
        metadataRecord: {
          normative_collection_identity: record,
          // Defensive snapshot: never return the bundle's own live nested
          // metadata reference.
          metadata: collection.metadata === undefined ? undefined : structuredClone(collection.metadata),
        } as ChronicleCollectionMetadataRecordV0,
        normalizedObject: { ...collection, artifact_refs: sortArtifactRefs(collection.artifact_refs) },
      }
    })

    // The Portfolio verifier call happens exactly once.
    const portfolioVerification = verifyChroniclePortfolioV0(bundle.portfolio)

    const derivedCollectionRefs = sortCollectionRefs(collectionEntries.map((entry) => entry.derivedRef))
    const storedCollectionRefs = sortCollectionRefs(bundle.portfolio.collection_refs)

    const canonicalEnvelope = canonicalize({
      collections: sortByCanonicalKey(collectionEntries.map((entry) => entry.normalizedObject)),
      portfolio: { ...bundle.portfolio, collection_refs: storedCollectionRefs },
    })

    return {
      state: "evaluated",
      value: {
        collection_normative_records: sortByCanonicalKey(collectionEntries.map((entry) => entry.record)),
        derived_collection_refs: derivedCollectionRefs,
        stored_collection_refs: storedCollectionRefs,
        cross_link_match: sortedStringArraysEqual(derivedCollectionRefs, storedCollectionRefs),
        portfolio_schema: bundle.portfolio.schema,
        claimed_portfolio_root: portfolioVerification.portfolio_root,
        recomputed_portfolio_root: portfolioVerification.recomputed_portfolio_root,
        portfolio_root_match: portfolioVerification.ok,
        collection_metadata_records: sortByCanonicalKey(collectionEntries.map((entry) => entry.metadataRecord)),
        portfolio_metadata:
          bundle.portfolio.metadata === undefined ? undefined : structuredClone(bundle.portfolio.metadata),
        canonical_envelope: canonicalEnvelope,
      },
    }
  } catch {
    return { state: "unresolved", reason: "chronicle_collections_portfolio_recompute_failed" }
  }
}

// Uses the already-exported createChroniclePortfolioV0 as a live
// constructor/validation probe for the one real applicability boundary this
// domain has: one or more Collections required. The probe inspects ONLY
// bundle.collections; it never inspects artifact_refs, stored Portfolio
// refs, metadata, or local roots -- those remain recompute/comparison
// concerns. No private validator is imported or duplicated.
function chronicleCollectionsPortfolioPreconditionV0(
  bundle: ChronicleCollectionsPortfolioBundleV0,
): TransformationPreconditionResultV0 {
  try {
    createChroniclePortfolioV0([...bundle.collections])
    return { ok: true }
  } catch {
    return { ok: false, reason: "chronicle_collections_portfolio_empty" }
  }
}

function chronicleCollectionsPortfolioNormativeProjectionV0(
  result: ChronicleCollectionsPortfolioObservationV0,
): unknown {
  return {
    collection_normative_records: result.collection_normative_records,
    derived_collection_refs: result.derived_collection_refs,
    stored_collection_refs: result.stored_collection_refs,
    cross_link_match: result.cross_link_match,
    portfolio_schema: result.portfolio_schema,
    claimed_portfolio_root: result.claimed_portfolio_root,
    recomputed_portfolio_root: result.recomputed_portfolio_root,
    portfolio_root_match: result.portfolio_root_match,
  }
}

function chronicleCollectionsPortfolioStabilityProjectionV0(
  result: ChronicleCollectionsPortfolioObservationV0,
): unknown {
  return { canonical_envelope: result.canonical_envelope }
}

function chronicleCollectionsPortfolioAllowedVariantProjectionV0(
  _result: ChronicleCollectionsPortfolioObservationV0,
): unknown {
  return {}
}

function chronicleCollectionsPortfolioForbiddenVariantProjectionV0(
  result: ChronicleCollectionsPortfolioObservationV0,
): unknown {
  // canonicalIdentityJson (the generic core's comparison canonicalizer)
  // throws on an object key whose value is literally `undefined`. Metadata
  // absence is normalized to `null` here, at the comparison boundary only;
  // the observation itself still honestly carries `undefined`.
  //
  // Only the metadata values are compared here -- `normative_collection_identity`
  // exists on collection_metadata_records purely as the duplicate-safe sort
  // key that fixes each metadata value's position (see
  // recomputeChronicleCollectionsPortfolioV0). It must NOT also be part of
  // the compared payload: identity/root movement is already N's concern
  // (collection_normative_records), and re-including it here would make F
  // spuriously mismatch on every root-affecting vector, double-counting a
  // change N already reports.
  return {
    collection_metadata: result.collection_metadata_records.map((entry) => entry.metadata ?? null),
    portfolio_metadata: result.portfolio_metadata ?? null,
  }
}

// ---------------------------------------------------------------------------
// Shared mutation helpers
//
// "Recompute root to match" is done by reading each verifier's own
// `recomputed_*_root` output for the mutated fields, never by importing
// computeChronicleCollectionRoot/computeChroniclePortfolioRoot directly --
// this keeps every root-shaped value traceable to the already-reused
// verifier functions.
// ---------------------------------------------------------------------------

function withRecomputedCollectionRoot(collection: ChronicleCollectionV0): ChronicleCollectionV0 {
  const verification = verifyChronicleCollectionV0(collection)
  return { ...collection, collection_root: verification.recomputed_collection_root }
}

function withRecomputedPortfolioRoot(portfolio: ChroniclePortfolioV0): ChroniclePortfolioV0 {
  const verification = verifyChroniclePortfolioV0(portfolio)
  return { ...portfolio, portfolio_root: verification.recomputed_portfolio_root }
}

// A wholesale replacement Collection: independently locally valid, but with
// no relationship at all to the source Collection's identity.
function buildReplacementCollectionV0(source: ChronicleCollectionV0): ChronicleCollectionV0 {
  return withRecomputedCollectionRoot({
    ...source,
    collection_id: `${source.collection_id}-replacement`,
    artifact_refs: [...source.artifact_refs, "replacement-artifact"],
  })
}

function emptyCollectionsBundle(
  bundle: ChronicleCollectionsPortfolioBundleV0,
): ChronicleCollectionsPortfolioBundleV0 {
  return { collections: [], portfolio: bundle.portfolio }
}

// ---------------------------------------------------------------------------
// Flat vector inventory
// ---------------------------------------------------------------------------

export const CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_MATRIX_SCHEMA_V0 =
  "receiptos.transformation_stability_chronicle_collections_portfolio_matrix.v0" as const

export const CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_MATRIX_ID_V0 =
  "chronicle-collections-portfolio-transformation-stability-matrix-v0" as const

export type ChronicleCollectionsPortfolioTransformationVectorIdV0 =
  | "stable_canonical_roundtrip"
  | "collections_and_refs_reorder_stable"
  | "upstream_collection_mutation_without_portfolio_update"
  | "downstream_portfolio_ref_tamper_recomputed"
  | "coordinated_collection_and_portfolio_update"
  | "missing_portfolio_ref"
  | "extra_portfolio_ref"
  | "replace_bundled_collection_with_other_valid_collection"
  | "duplicate_collection_ref_multiset_mismatch"
  | "collection_metadata_forbidden_mutation"
  | "portfolio_metadata_forbidden_mutation"
  | "collection_schema_literal_mutation"
  | "portfolio_schema_literal_mutation"
  | "stored_collection_root_tamper"
  | "stored_portfolio_root_tamper"
  | "empty_collections_out_of_domain"
  | "collection_artifact_refs_corrupt_unresolved"
  | "portfolio_collection_refs_corrupt_unresolved"

export type ChronicleCollectionsPortfolioTransformationVectorRecordV0 = {
  readonly vector_id: ChronicleCollectionsPortfolioTransformationVectorIdV0
  readonly expected_classification: TransformationStabilityClassificationV0
  readonly expected_normative_match: boolean | null
  readonly expected_stability_match: boolean | null
  readonly expected_forbidden_variant_match: boolean | null
  readonly expected_unresolved_reason: string | null
  readonly expected_out_of_domain_reason: string | null
}

export const CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_VECTORS_V0: readonly ChronicleCollectionsPortfolioTransformationVectorRecordV0[] =
  Object.freeze([
    Object.freeze({
      vector_id: "stable_canonical_roundtrip",
      expected_classification: "stable",
      expected_normative_match: true,
      expected_stability_match: true,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "collections_and_refs_reorder_stable",
      expected_classification: "stable",
      expected_normative_match: true,
      expected_stability_match: true,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "upstream_collection_mutation_without_portfolio_update",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "downstream_portfolio_ref_tamper_recomputed",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "coordinated_collection_and_portfolio_update",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "missing_portfolio_ref",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "extra_portfolio_ref",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "replace_bundled_collection_with_other_valid_collection",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "duplicate_collection_ref_multiset_mismatch",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "collection_metadata_forbidden_mutation",
      expected_classification: "violation",
      expected_normative_match: true,
      expected_stability_match: false,
      expected_forbidden_variant_match: false,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "portfolio_metadata_forbidden_mutation",
      expected_classification: "violation",
      expected_normative_match: true,
      expected_stability_match: false,
      expected_forbidden_variant_match: false,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "collection_schema_literal_mutation",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "portfolio_schema_literal_mutation",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "stored_collection_root_tamper",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "stored_portfolio_root_tamper",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "empty_collections_out_of_domain",
      expected_classification: "out_of_domain",
      expected_normative_match: null,
      expected_stability_match: null,
      expected_forbidden_variant_match: null,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: "chronicle_collections_portfolio_empty",
    }),
    Object.freeze({
      vector_id: "collection_artifact_refs_corrupt_unresolved",
      expected_classification: "unresolved",
      expected_normative_match: null,
      expected_stability_match: null,
      expected_forbidden_variant_match: null,
      expected_unresolved_reason: "chronicle_collections_portfolio_recompute_failed",
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "portfolio_collection_refs_corrupt_unresolved",
      expected_classification: "unresolved",
      expected_normative_match: null,
      expected_stability_match: null,
      expected_forbidden_variant_match: null,
      expected_unresolved_reason: "chronicle_collections_portfolio_recompute_failed",
      expected_out_of_domain_reason: null,
    }),
  ])

function commonBundleProfileFields() {
  return {
    transformation_family: "chronicle_collections_portfolio_transformation_matrix",
    source_object_kind: "chronicle_collections_portfolio_bundle.v0",
    target_object_kind: "chronicle_collections_portfolio_bundle.v0",
    recompute_procedure_id: "receiptos.chronicleCollectionsPortfolioCrossLink+canonicalize.v0",
    comparison_rule_id: "collection-roots+portfolio-root+cross-link-multiset+canonical-envelope+metadata.v0",
    history_sensitive_policy: "violation" as const,
    precondition: chronicleCollectionsPortfolioPreconditionV0,
    recompute_source: recomputeChronicleCollectionsPortfolioV0,
    recompute_target: recomputeChronicleCollectionsPortfolioV0,
    normative_projection: chronicleCollectionsPortfolioNormativeProjectionV0,
    stability_projection: chronicleCollectionsPortfolioStabilityProjectionV0,
    allowed_variant_projection: chronicleCollectionsPortfolioAllowedVariantProjectionV0,
    forbidden_variant_projection: chronicleCollectionsPortfolioForbiddenVariantProjectionV0,
  }
}

const CHRONICLE_COLLECTIONS_PORTFOLIO_FLAT_PROFILE_ID_V0 =
  "chronicle-collections-portfolio-canonical-roundtrip-v0" as const

function buildFlatVectorProfile(vectorId: ChronicleCollectionsPortfolioTransformationVectorIdV0) {
  const common = commonBundleProfileFields()
  const transformationProfileId = CHRONICLE_COLLECTIONS_PORTFOLIO_FLAT_PROFILE_ID_V0

  if (vectorId === "stable_canonical_roundtrip") {
    return defineTransformationProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => JSON.parse(canonicalize(bundle)) as ChronicleCollectionsPortfolioBundleV0,
    })
  }

  if (vectorId === "collections_and_refs_reorder_stable") {
    return defineTransformationProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => ({
        collections: [...bundle.collections]
          .reverse()
          .map((collection) => ({ ...collection, artifact_refs: [...collection.artifact_refs].reverse() })),
        portfolio: { ...bundle.portfolio, collection_refs: [...bundle.portfolio.collection_refs].reverse() },
      }),
    })
  }

  if (vectorId === "upstream_collection_mutation_without_portfolio_update") {
    return defineTransformationProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => ({
        collections: [
          withRecomputedCollectionRoot({
            ...bundle.collections[0]!,
            collection_id: `${bundle.collections[0]!.collection_id}-mutated`,
          }),
          ...bundle.collections.slice(1),
        ],
        // portfolio.collection_refs is deliberately left untouched -- now
        // stale relative to the mutated collection.
        portfolio: bundle.portfolio,
      }),
    })
  }

  if (vectorId === "downstream_portfolio_ref_tamper_recomputed") {
    return defineTransformationProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => ({
        collections: bundle.collections,
        portfolio: withRecomputedPortfolioRoot({
          ...bundle.portfolio,
          collection_refs: bundle.portfolio.collection_refs.map((ref, index) =>
            index === 0 ? `${ref}-tampered` : ref,
          ),
        }),
      }),
    })
  }

  if (vectorId === "coordinated_collection_and_portfolio_update") {
    return defineTransformationProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => {
        const source = bundle.collections[0]!
        const mutatedCollection = withRecomputedCollectionRoot({
          ...source,
          collection_id: `${source.collection_id}-mutated`,
        })
        const oldRef = deriveCollectionRefFromChronicleCollection(source)
        const newRef = deriveCollectionRefFromChronicleCollection(mutatedCollection)
        const mutatedPortfolio = withRecomputedPortfolioRoot({
          ...bundle.portfolio,
          collection_refs: bundle.portfolio.collection_refs.map((ref) => (ref === oldRef ? newRef : ref)),
        })
        return { collections: [mutatedCollection, ...bundle.collections.slice(1)], portfolio: mutatedPortfolio }
      },
    })
  }

  if (vectorId === "missing_portfolio_ref") {
    return defineTransformationProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => {
        const keepRef = deriveCollectionRefFromChronicleCollection(bundle.collections[0]!)
        return {
          collections: bundle.collections,
          portfolio: withRecomputedPortfolioRoot({ ...bundle.portfolio, collection_refs: [keepRef] }),
        }
      },
    })
  }

  if (vectorId === "extra_portfolio_ref") {
    return defineTransformationProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => ({
        collections: bundle.collections,
        portfolio: withRecomputedPortfolioRoot({
          ...bundle.portfolio,
          collection_refs: [...bundle.portfolio.collection_refs, "/collection/not-in-bundle"],
        }),
      }),
    })
  }

  if (vectorId === "replace_bundled_collection_with_other_valid_collection") {
    return defineTransformationProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => ({
        collections: [buildReplacementCollectionV0(bundle.collections[0]!), ...bundle.collections.slice(1)],
        portfolio: bundle.portfolio,
      }),
    })
  }

  if (vectorId === "duplicate_collection_ref_multiset_mismatch") {
    return defineTransformationProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => {
        const base = bundle.collections[0]!
        const duplicate = { ...base }
        const singleRef = deriveCollectionRefFromChronicleCollection(base)
        return {
          collections: [base, duplicate],
          portfolio: withRecomputedPortfolioRoot({ ...bundle.portfolio, collection_refs: [singleRef] }),
        }
      },
    })
  }

  if (vectorId === "collection_metadata_forbidden_mutation") {
    return defineTransformationProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => ({
        collections: [{ ...bundle.collections[0]!, metadata: { tampered: true } }, ...bundle.collections.slice(1)],
        portfolio: bundle.portfolio,
      }),
    })
  }

  if (vectorId === "portfolio_metadata_forbidden_mutation") {
    return defineTransformationProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => ({
        collections: bundle.collections,
        portfolio: { ...bundle.portfolio, metadata: { tampered: true } },
      }),
    })
  }

  if (vectorId === "collection_schema_literal_mutation") {
    return defineTransformationProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => ({
        // Local cast: schema is a literal-typed field; divergence from
        // collection_version is deliberately off-path here.
        collections: [
          { ...bundle.collections[0]!, schema: `${bundle.collections[0]!.schema}-tampered` } as unknown as ChronicleCollectionV0,
          ...bundle.collections.slice(1),
        ],
        portfolio: bundle.portfolio,
      }),
    })
  }

  if (vectorId === "portfolio_schema_literal_mutation") {
    return defineTransformationProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => ({
        collections: bundle.collections,
        // Local cast: schema is a literal-typed field; divergence from
        // portfolio_version is deliberately off-path here.
        portfolio: { ...bundle.portfolio, schema: `${bundle.portfolio.schema}-tampered` } as unknown as ChroniclePortfolioV0,
      }),
    })
  }

  if (vectorId === "stored_collection_root_tamper") {
    return defineTransformationProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => ({
        collections: [
          { ...bundle.collections[0]!, collection_root: `sha256:${"0".repeat(64)}` },
          ...bundle.collections.slice(1),
        ],
        portfolio: bundle.portfolio,
      }),
    })
  }

  if (vectorId === "stored_portfolio_root_tamper") {
    return defineTransformationProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => ({
        collections: bundle.collections,
        portfolio: { ...bundle.portfolio, portfolio_root: `sha256:${"1".repeat(64)}` },
      }),
    })
  }

  if (vectorId === "empty_collections_out_of_domain") {
    // Precondition rejects the source before transform/recompute ever runs;
    // the identity transform below is never reached.
    return defineTransformationProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => bundle,
    })
  }

  if (vectorId === "collection_artifact_refs_corrupt_unresolved") {
    return defineTransformationProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      // Malformed artifact_refs, local to this one adversarial vector only
      // -- ChronicleCollectionV0's declared shape is never weakened.
      transform: (bundle) => ({
        collections: [
          { ...bundle.collections[0]!, artifact_refs: null } as unknown as ChronicleCollectionV0,
          ...bundle.collections.slice(1),
        ],
        portfolio: bundle.portfolio,
      }),
    })
  }

  // portfolio_collection_refs_corrupt_unresolved
  return defineTransformationProfileV0<
    ChronicleCollectionsPortfolioBundleV0,
    ChronicleCollectionsPortfolioBundleV0,
    ChronicleCollectionsPortfolioObservationV0
  >({
    ...common,
    transformation_profile_id: transformationProfileId,
    // Malformed collection_refs, local to this one adversarial vector only
    // -- ChroniclePortfolioV0's declared shape is never weakened.
    transform: (bundle) => ({
      collections: bundle.collections,
      portfolio: { ...bundle.portfolio, collection_refs: null } as unknown as ChroniclePortfolioV0,
    }),
  })
}

export type ChronicleCollectionsPortfolioTransformationMemberResultV0 = {
  readonly vector_id: ChronicleCollectionsPortfolioTransformationVectorIdV0
  readonly expected: ChronicleCollectionsPortfolioTransformationVectorRecordV0
  readonly observed: TransformationStabilityResultV0
}

export type ChronicleCollectionsPortfolioTransformationMatrixResultV0 = {
  readonly schema: typeof CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_MATRIX_SCHEMA_V0
  readonly matrix_id: typeof CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_MATRIX_ID_V0
  readonly vector_count: 18
  readonly aggregate: {
    readonly stable: number
    readonly history_sensitive: number
    readonly unresolved: number
    readonly out_of_domain: number
    readonly violation: number
  }
  readonly members: readonly ChronicleCollectionsPortfolioTransformationMemberResultV0[]
  readonly pass: boolean
}

function memberPass(member: ChronicleCollectionsPortfolioTransformationMemberResultV0): boolean {
  const { expected, observed } = member
  return (
    observed.classification === expected.expected_classification &&
    observed.normative_match === expected.expected_normative_match &&
    observed.stability_match === expected.expected_stability_match &&
    observed.forbidden_variant_match === expected.expected_forbidden_variant_match &&
    observed.unresolved_reason === expected.expected_unresolved_reason &&
    observed.out_of_domain_reason === expected.expected_out_of_domain_reason
  )
}

function aggregateMembers(
  members: readonly ChronicleCollectionsPortfolioTransformationMemberResultV0[],
): ChronicleCollectionsPortfolioTransformationMatrixResultV0["aggregate"] {
  let stable = 0
  let historySensitive = 0
  let unresolved = 0
  let outOfDomain = 0
  let violation = 0

  for (const member of members) {
    if (member.observed.classification === "stable") stable += 1
    else if (member.observed.classification === "history_sensitive") historySensitive += 1
    else if (member.observed.classification === "unresolved") unresolved += 1
    else if (member.observed.classification === "out_of_domain") outOfDomain += 1
    else violation += 1
  }

  return { stable, history_sensitive: historySensitive, unresolved, out_of_domain: outOfDomain, violation }
}

export async function evaluateChronicleCollectionsPortfolioTransformationVectorV0(
  vectorId: ChronicleCollectionsPortfolioTransformationVectorIdV0,
  source: ChronicleCollectionsPortfolioBundleV0,
): Promise<TransformationStabilityResultV0> {
  const profile = buildFlatVectorProfile(vectorId)
  if (vectorId === "empty_collections_out_of_domain") {
    return evaluateTransformationStabilityV0(profile, emptyCollectionsBundle(source))
  }
  return evaluateTransformationStabilityV0(profile, source)
}

export async function evaluateChronicleCollectionsPortfolioTransformationMatrixV0(
  source: ChronicleCollectionsPortfolioBundleV0,
): Promise<ChronicleCollectionsPortfolioTransformationMatrixResultV0> {
  const members: ChronicleCollectionsPortfolioTransformationMemberResultV0[] = []

  for (const expected of CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_VECTORS_V0) {
    const observed = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(expected.vector_id, source)
    members.push({ vector_id: expected.vector_id, expected, observed })
  }

  const aggregate = aggregateMembers(members)
  const pass =
    members.length === 18 &&
    members.every(memberPass) &&
    aggregate.stable === 2 &&
    aggregate.history_sensitive === 0 &&
    aggregate.unresolved === 2 &&
    aggregate.out_of_domain === 1 &&
    aggregate.violation === 13

  return {
    schema: CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_MATRIX_SCHEMA_V0,
    matrix_id: CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_MATRIX_ID_V0,
    vector_count: 18,
    aggregate,
    members,
    pass,
  }
}

// ---------------------------------------------------------------------------
// Closed-cycle vector inventory
// ---------------------------------------------------------------------------

export type ChronicleCollectionsPortfolioTransformationCycleVectorIdV0 =
  | "stable_multi_edge_roundtrip_reorder"
  | "cross_link_mutation_then_restore"
  | "link_only_mutation_then_restore"
  | "invalid_start_out_of_domain"
  | "collections_corrupt_unresolved"

export type ChronicleCollectionsPortfolioTransformationCycleVectorRecordV0 = {
  readonly vector_id: ChronicleCollectionsPortfolioTransformationCycleVectorIdV0
  readonly expected_classification: TransformationStabilityClassificationV0
  readonly expected_failed_edge_id: string | null
  readonly expected_failure_reason: string | null
  readonly expected_completed_edges: number
}

export const CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_CYCLE_VECTORS_V0: readonly ChronicleCollectionsPortfolioTransformationCycleVectorRecordV0[] =
  Object.freeze([
    Object.freeze({
      vector_id: "stable_multi_edge_roundtrip_reorder",
      expected_classification: "stable",
      expected_failed_edge_id: null,
      expected_failure_reason: null,
      expected_completed_edges: 2,
    }),
    Object.freeze({
      vector_id: "cross_link_mutation_then_restore",
      expected_classification: "violation",
      expected_failed_edge_id: "mutate-collection-id-stale-ref",
      expected_failure_reason: "normative_projection_mismatch",
      expected_completed_edges: 0,
    }),
    Object.freeze({
      vector_id: "link_only_mutation_then_restore",
      expected_classification: "violation",
      expected_failed_edge_id: "tamper-portfolio-ref-only",
      expected_failure_reason: "normative_projection_mismatch",
      expected_completed_edges: 0,
    }),
    Object.freeze({
      vector_id: "invalid_start_out_of_domain",
      expected_classification: "out_of_domain",
      expected_failed_edge_id: "attempt",
      expected_failure_reason: "chronicle_collections_portfolio_empty",
      expected_completed_edges: 0,
    }),
    Object.freeze({
      vector_id: "collections_corrupt_unresolved",
      expected_classification: "unresolved",
      expected_failed_edge_id: "corrupt-collection-artifact-refs",
      expected_failure_reason: "chronicle_collections_portfolio_recompute_failed",
      expected_completed_edges: 0,
    }),
  ])

function commonBundleCycleProfileFields() {
  return {
    node_object_kind: "chronicle_collections_portfolio_bundle.v0",
    recompute_procedure_id: "receiptos.chronicleCollectionsPortfolioCrossLink+canonicalize.v0",
    comparison_rule_id: "collection-roots+portfolio-root+cross-link-multiset+canonical-envelope+metadata.v0",
    history_sensitive_policy: "violation" as const,
    recompute: recomputeChronicleCollectionsPortfolioV0,
    normative_projection: chronicleCollectionsPortfolioNormativeProjectionV0,
    stability_projection: chronicleCollectionsPortfolioStabilityProjectionV0,
    allowed_variant_projection: chronicleCollectionsPortfolioAllowedVariantProjectionV0,
    forbidden_variant_projection: chronicleCollectionsPortfolioForbiddenVariantProjectionV0,
  }
}

function bundleCycleEdge(
  edgeId: string,
  transform: (bundle: ChronicleCollectionsPortfolioBundleV0) => ChronicleCollectionsPortfolioBundleV0,
): AuthenticatedTransformationCycleEdgeV0<ChronicleCollectionsPortfolioBundleV0> {
  return defineTransformationCycleEdgeV0<ChronicleCollectionsPortfolioBundleV0>({
    edge_id: edgeId,
    precondition: chronicleCollectionsPortfolioPreconditionV0,
    transform,
  })
}

function buildCycleVectorProfile(vectorId: ChronicleCollectionsPortfolioTransformationCycleVectorIdV0) {
  const common = commonBundleCycleProfileFields()
  const cycleProfileId = `chronicle-collections-portfolio-cycle-v0:${vectorId}`

  if (vectorId === "stable_multi_edge_roundtrip_reorder") {
    return defineTransformationCycleProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      cycle_profile_id: cycleProfileId,
      ordered_edges: [
        bundleCycleEdge(
          "canonical-roundtrip",
          (bundle) => JSON.parse(canonicalize(bundle)) as ChronicleCollectionsPortfolioBundleV0,
        ),
        bundleCycleEdge("collections-and-refs-reorder", (bundle) => ({
          collections: [...bundle.collections]
            .reverse()
            .map((collection) => ({ ...collection, artifact_refs: [...collection.artifact_refs].reverse() })),
          portfolio: { ...bundle.portfolio, collection_refs: [...bundle.portfolio.collection_refs].reverse() },
        })),
      ],
    })
  }

  if (vectorId === "cross_link_mutation_then_restore") {
    return defineTransformationCycleProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      cycle_profile_id: cycleProfileId,
      ordered_edges: [
        bundleCycleEdge("mutate-collection-id-stale-ref", (bundle) => ({
          collections: [
            withRecomputedCollectionRoot({
              ...bundle.collections[0]!,
              collection_id: `${bundle.collections[0]!.collection_id}-mutated`,
            }),
            ...bundle.collections.slice(1),
          ],
          portfolio: bundle.portfolio,
        })),
        // Declared but never reached: N mismatch (cross_link_match flips
        // false, and the mutated collection's own root pair moves) is
        // immediately terminal at mutate-collection-id-stale-ref. Restoring
        // collection_id here would bring N back into agreement with R0, but
        // the cycle never gets this far -- this is the proof that endpoint
        // equality cannot erase an intermediate cross-object violation.
        bundleCycleEdge("restore-collection-id-and-ref", (bundle) => {
          const restoredId = bundle.collections[0]!.collection_id.replace(/-mutated$/, "")
          const restoredCollection = withRecomputedCollectionRoot({
            ...bundle.collections[0]!,
            collection_id: restoredId,
          })
          return { collections: [restoredCollection, ...bundle.collections.slice(1)], portfolio: bundle.portfolio }
        }),
      ],
    })
  }

  if (vectorId === "link_only_mutation_then_restore") {
    return defineTransformationCycleProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      cycle_profile_id: cycleProfileId,
      ordered_edges: [
        bundleCycleEdge("tamper-portfolio-ref-only", (bundle) => ({
          collections: bundle.collections,
          portfolio: withRecomputedPortfolioRoot({
            ...bundle.portfolio,
            collection_refs: bundle.portfolio.collection_refs.map((ref, index) =>
              index === 0 ? `${ref}-tampered` : ref,
            ),
          }),
        })),
        // Declared but never reached, same reasoning as
        // cross_link_mutation_then_restore -- this is the second,
        // independent demonstration of the closed-cycle invariant, using a
        // pure downstream-only edit rather than an upstream identity
        // mutation, which is the failure mode unique to a set-valued
        // cross-object relationship.
        bundleCycleEdge("restore-portfolio-ref", (bundle) => ({
          collections: bundle.collections,
          portfolio: withRecomputedPortfolioRoot({
            ...bundle.portfolio,
            collection_refs: bundle.portfolio.collection_refs.map((ref, index) =>
              index === 0 ? ref.replace(/-tampered$/, "") : ref,
            ),
          }),
        })),
      ],
    })
  }

  if (vectorId === "invalid_start_out_of_domain") {
    return defineTransformationCycleProfileV0<
      ChronicleCollectionsPortfolioBundleV0,
      ChronicleCollectionsPortfolioObservationV0
    >({
      ...common,
      cycle_profile_id: cycleProfileId,
      ordered_edges: [bundleCycleEdge("attempt", (bundle) => bundle)],
    })
  }

  // collections_corrupt_unresolved
  return defineTransformationCycleProfileV0<
    ChronicleCollectionsPortfolioBundleV0,
    ChronicleCollectionsPortfolioObservationV0
  >({
    ...common,
    cycle_profile_id: cycleProfileId,
    ordered_edges: [
      defineTransformationCycleEdgeV0<ChronicleCollectionsPortfolioBundleV0>({
        edge_id: "corrupt-collection-artifact-refs",
        precondition: chronicleCollectionsPortfolioPreconditionV0,
        transform: (bundle) => ({
          collections: [
            { ...bundle.collections[0]!, artifact_refs: null } as unknown as ChronicleCollectionV0,
            ...bundle.collections.slice(1),
          ],
          portfolio: bundle.portfolio,
        }),
      }),
    ],
  })
}

export async function evaluateChronicleCollectionsPortfolioTransformationCycleVectorV0(
  vectorId: ChronicleCollectionsPortfolioTransformationCycleVectorIdV0,
  source: ChronicleCollectionsPortfolioBundleV0,
): Promise<TransformationStabilityCycleResultV0> {
  // The cycle's own unconditional initial recompute (verifyChronicleCollectionV0
  // per Collection + verifyChroniclePortfolioV0) must succeed for the start
  // bundle in order to reach edge evaluation at all -- an empty collections
  // array does NOT make that initial recompute throw (it produces an empty,
  // internally consistent observation), so invalid_start_out_of_domain
  // reaches its edge's precondition exactly as intended.
  const startBundle = vectorId === "invalid_start_out_of_domain" ? emptyCollectionsBundle(source) : source
  return evaluateTransformationCycleV0(buildCycleVectorProfile(vectorId), startBundle)
}
