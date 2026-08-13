/**
 * ReceiptOS Transformation Stability v0 — cross-object profile:
 * ChronicleCollectionV0 → ChronicleCheckpointV0.
 *
 * The first cross-object / multi-boundary Transformation Stability profile.
 * Every recompute/comparison primitive here is imported unchanged from
 * src/receiptos/capsule/chronicle-portfolio-v0.ts and
 * src/receiptos/canon/canonicalize.ts; this module only wires them into the
 * existing generic transformation-stability.ts / transformation-stability-
 * cycle.ts evaluators. No new schema, root algorithm, canonicalizer,
 * reference format, or synchronization rule is introduced.
 * src/receiptos/capsule/chronicle-portfolio-v0.ts is NOT modified — its
 * blob is pinned by frozen conformance packages (see the incident this
 * repository already hit once with a single-word visibility edit to that
 * file). Every mutation vector below constructs its own local
 * ChronicleCollectionV0 / ChronicleCheckpointV0 values instead.
 *
 * Cross-object invariant:
 *   deriveCollectionRefFromChronicleCollection(bundle.collection)
 *     === bundle.checkpoint.collection_ref
 *
 * This is a genuinely new observable beyond what either object's own
 * verifier can see: verifyChronicleCollectionV0 and verifyChronicleCheckpointV0
 * each only check an object's *own* internal root consistency — neither
 * inspects the other object at all. A checkpoint can claim a
 * `collection_ref` that no longer matches the actual referenced collection
 * while both objects independently report `ok: true`. Confirmed live
 * against the committed functions during design (not merely asserted):
 * mutating `collection.collection_id` and recomputing `collection_root`
 * leaves `checkpoint.collection_ref` stale while both individual verifiers
 * still pass; symmetrically, mutating `checkpoint.collection_ref` and
 * recomputing `checkpoint_root` to match also leaves both individually
 * valid while the cross-link is broken.
 *
 * Reachable classification set: `stable`, `violation`, `unresolved`,
 * `out_of_domain` — all four, inherited from ChronicleCheckpointV0's own
 * applicability rule (see below).
 *
 * `history_sensitive` is intentionally absent. Every declared field across
 * both objects is accounted for: `collection.schema`, both root identity
 * triples, the derived/stored collection-ref pair and cross-link match all
 * participate in `N`; `collection.metadata` is `F`; `collection.artifact_refs`
 * order is normalized away (Collection has no separate canonical-order gate,
 * unlike Checkpoint — confirmed live: a raw reorder leaves
 * `verifyChronicleCollectionV0().ok === true`); `checkpoint.entry_refs`
 * order is left exactly as stored in `S` (not normalized), matching
 * Checkpoint's own stored-order-sensitive semantics, and any change to it
 * is already caught via `N` (`checkpoint_root_match`/`recomputed_checkpoint_root`)
 * before `S` alone could ever matter. `S` is a canonical envelope of the
 * complete bundle and is therefore a strict superset of `N`'s and `F`'s
 * sensitivity — there is no field that can move `S` alone.
 *
 * `out_of_domain` is reached the same way it is for the standalone
 * Checkpoint profile: `createChronicleCheckpointV0` is used as a
 * shape-validation oracle (a safe probe using only
 * `checkpoint.prev_checkpoint` and `checkpoint.sequence`, with fixed safe
 * values for every other field), never by importing a private validator.
 * `ChronicleCollectionV0` contributes no applicability rule of its own and
 * is never inspected by the precondition.
 *
 * Coordinated normative updates are NOT stable. If a mutation changes
 * `collection.collection_id`, `collection_root` moves — and `N` includes
 * that root identity directly, not merely the cross-link fact. Even when
 * `checkpoint.collection_ref` is updated in lockstep so the cross-link
 * itself stays consistent, the underlying object identities still changed,
 * and that is a `violation` by the same rule every other Transformation
 * Stability profile in this repository already enforces (any normative
 * identity change is a violation, regardless of what else stayed
 * consistent). Weakening `N` to omit the individual root triples — leaving
 * only the cross-link fact — would let a coordinated identity change through
 * as `stable`; that was deliberately rejected during design.
 */

import { canonicalize } from "../canon/canonicalize"
import {
  type ChronicleCheckpointV0,
  type ChronicleCollectionV0,
  createChronicleCheckpointV0,
  deriveCollectionRefFromChronicleCollection,
  sortArtifactRefs,
  verifyChronicleCheckpointV0,
  verifyChronicleCollectionV0,
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

export type ChronicleCollectionCheckpointBundleV0 = {
  readonly collection: ChronicleCollectionV0
  readonly checkpoint: ChronicleCheckpointV0
}

export type ChronicleCollectionCheckpointObservationV0 = {
  readonly collection_schema: string
  readonly claimed_collection_root: string
  readonly recomputed_collection_root: string
  readonly collection_root_match: boolean
  readonly claimed_checkpoint_root: string
  readonly recomputed_checkpoint_root: string
  readonly checkpoint_root_match: boolean
  readonly derived_collection_ref: string
  readonly stored_collection_ref: string
  readonly cross_link_match: boolean
  readonly collection_metadata: Record<string, unknown> | undefined
  readonly canonical_envelope: string
}

function recomputeChronicleCollectionCheckpointV0(
  bundle: ChronicleCollectionCheckpointBundleV0,
): RecomputeOutcomeV0<ChronicleCollectionCheckpointObservationV0> {
  try {
    // Reused directly — each verifier already combines root comparison
    // (and, for Checkpoint, canonical entry_refs order) internally; neither
    // check is duplicated here.
    const collectionVerification = verifyChronicleCollectionV0(bundle.collection)
    const checkpointVerification = verifyChronicleCheckpointV0(bundle.checkpoint)
    const derivedCollectionRef = deriveCollectionRefFromChronicleCollection(bundle.collection)

    const canonicalEnvelope = canonicalize({
      collection: { ...bundle.collection, artifact_refs: sortArtifactRefs(bundle.collection.artifact_refs) },
      // Deliberately NOT sorted: entry_refs order is normative-sensitive for
      // Checkpoint (see module-level comment).
      checkpoint: { ...bundle.checkpoint },
    })

    return {
      state: "evaluated",
      value: {
        collection_schema: bundle.collection.schema,
        claimed_collection_root: collectionVerification.collection_root,
        recomputed_collection_root: collectionVerification.recomputed_collection_root,
        collection_root_match: collectionVerification.ok,
        claimed_checkpoint_root: checkpointVerification.checkpoint_root,
        recomputed_checkpoint_root: checkpointVerification.recomputed_checkpoint_root,
        checkpoint_root_match: checkpointVerification.ok,
        derived_collection_ref: derivedCollectionRef,
        stored_collection_ref: bundle.checkpoint.collection_ref,
        cross_link_match: derivedCollectionRef === bundle.checkpoint.collection_ref,
        // Defensive snapshot: never return the bundle's own live nested
        // metadata reference.
        collection_metadata:
          bundle.collection.metadata === undefined ? undefined : structuredClone(bundle.collection.metadata),
        canonical_envelope: canonicalEnvelope,
      },
    }
  } catch {
    return { state: "unresolved", reason: "chronicle_collection_checkpoint_recompute_failed" }
  }
}

// Uses the already-public createChronicleCheckpointV0 as a shape-validation
// oracle — same pattern as the standalone Checkpoint profile, no private
// validator imported, no rule duplicated. The probe inspects ONLY
// bundle.checkpoint.prev_checkpoint and bundle.checkpoint.sequence; every
// other field is a fixed safe value, and bundle.collection is never
// inspected here at all — applicability is scoped exactly to the
// sequence/prev_checkpoint relationship, never to anything collection-side.
function chronicleCollectionCheckpointPreconditionV0(
  bundle: ChronicleCollectionCheckpointBundleV0,
): TransformationPreconditionResultV0 {
  try {
    createChronicleCheckpointV0({
      checkpointId: "transformation-stability-shape-probe",
      collectionRef: "transformation-stability-shape-probe",
      entryRefs: [],
      prevCheckpoint: bundle.checkpoint.prev_checkpoint,
      sequence: bundle.checkpoint.sequence,
    })
    return { ok: true }
  } catch {
    return { ok: false, reason: "chronicle_checkpoint_shape_invalid" }
  }
}

function chronicleCollectionCheckpointNormativeProjectionV0(
  result: ChronicleCollectionCheckpointObservationV0,
): unknown {
  return {
    collection_schema: result.collection_schema,
    claimed_collection_root: result.claimed_collection_root,
    recomputed_collection_root: result.recomputed_collection_root,
    collection_root_match: result.collection_root_match,
    claimed_checkpoint_root: result.claimed_checkpoint_root,
    recomputed_checkpoint_root: result.recomputed_checkpoint_root,
    checkpoint_root_match: result.checkpoint_root_match,
    derived_collection_ref: result.derived_collection_ref,
    stored_collection_ref: result.stored_collection_ref,
    cross_link_match: result.cross_link_match,
  }
}

function chronicleCollectionCheckpointStabilityProjectionV0(
  result: ChronicleCollectionCheckpointObservationV0,
): unknown {
  return { canonical_envelope: result.canonical_envelope }
}

function chronicleCollectionCheckpointAllowedVariantProjectionV0(
  _result: ChronicleCollectionCheckpointObservationV0,
): unknown {
  return {}
}

function chronicleCollectionCheckpointForbiddenVariantProjectionV0(
  result: ChronicleCollectionCheckpointObservationV0,
): unknown {
  // canonicalIdentityJson (the generic core's comparison canonicalizer)
  // throws on an object key whose value is literally `undefined` — see the
  // identical fix already applied in the Chronicle Portfolio profile.
  // metadata absence is normalized to `null` here, at the comparison
  // boundary only; the observation itself still carries `undefined`.
  return { collection_metadata: result.collection_metadata ?? null }
}

// ---------------------------------------------------------------------------
// Shared mutation helpers
//
// "Recompute root to match" is done by reading each verifier's own
// `recomputed_*_root` output for the mutated fields, never by importing
// computeChronicleCollectionRoot/computeChronicleCheckpointRoot directly —
// this keeps every root-shaped value traceable to the already-reused
// verifier functions.
// ---------------------------------------------------------------------------

function withRecomputedCollectionRoot(collection: ChronicleCollectionV0): ChronicleCollectionV0 {
  const verification = verifyChronicleCollectionV0(collection)
  return { ...collection, collection_root: verification.recomputed_collection_root }
}

function withRecomputedCheckpointRoot(checkpoint: ChronicleCheckpointV0): ChronicleCheckpointV0 {
  const verification = verifyChronicleCheckpointV0(checkpoint)
  return { ...checkpoint, checkpoint_root: verification.recomputed_checkpoint_root }
}

function invalidGenesisBundle(bundle: ChronicleCollectionCheckpointBundleV0): ChronicleCollectionCheckpointBundleV0 {
  return {
    collection: bundle.collection,
    checkpoint: {
      ...bundle.checkpoint,
      sequence: 0,
      prev_checkpoint: `${bundle.checkpoint.checkpoint_id}-prior`,
    },
  }
}

// ---------------------------------------------------------------------------
// Flat vector inventory
// ---------------------------------------------------------------------------

export const CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_MATRIX_SCHEMA_V0 =
  "receiptos.transformation_stability_chronicle_collection_checkpoint_matrix.v0" as const

export const CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_MATRIX_ID_V0 =
  "chronicle-collection-checkpoint-transformation-stability-matrix-v0" as const

export type ChronicleCollectionCheckpointTransformationVectorIdV0 =
  | "stable_coordinated_roundtrip"
  | "collection_artifact_refs_reorder_stable"
  | "upstream_mutation_without_downstream_update"
  | "downstream_reference_tamper_recomputed"
  | "coordinated_upstream_downstream_update"
  | "collection_metadata_forbidden_mutation"
  | "stored_checkpoint_root_tamper"
  | "stored_collection_root_tamper"
  | "collection_schema_literal_mutation"
  | "invalid_genesis_out_of_domain"
  | "entry_refs_recompute_unresolved"

export type ChronicleCollectionCheckpointTransformationVectorRecordV0 = {
  readonly vector_id: ChronicleCollectionCheckpointTransformationVectorIdV0
  readonly expected_classification: TransformationStabilityClassificationV0
  readonly expected_normative_match: boolean | null
  readonly expected_stability_match: boolean | null
  readonly expected_forbidden_variant_match: boolean | null
  readonly expected_unresolved_reason: string | null
  readonly expected_out_of_domain_reason: string | null
}

export const CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_VECTORS_V0: readonly ChronicleCollectionCheckpointTransformationVectorRecordV0[] =
  Object.freeze([
    Object.freeze({
      vector_id: "stable_coordinated_roundtrip",
      expected_classification: "stable",
      expected_normative_match: true,
      expected_stability_match: true,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "collection_artifact_refs_reorder_stable",
      expected_classification: "stable",
      expected_normative_match: true,
      expected_stability_match: true,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "upstream_mutation_without_downstream_update",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "downstream_reference_tamper_recomputed",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "coordinated_upstream_downstream_update",
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
      vector_id: "stored_checkpoint_root_tamper",
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
      vector_id: "collection_schema_literal_mutation",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "invalid_genesis_out_of_domain",
      expected_classification: "out_of_domain",
      expected_normative_match: null,
      expected_stability_match: null,
      expected_forbidden_variant_match: null,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: "chronicle_checkpoint_shape_invalid",
    }),
    Object.freeze({
      vector_id: "entry_refs_recompute_unresolved",
      expected_classification: "unresolved",
      expected_normative_match: null,
      expected_stability_match: null,
      expected_forbidden_variant_match: null,
      expected_unresolved_reason: "chronicle_collection_checkpoint_recompute_failed",
      expected_out_of_domain_reason: null,
    }),
  ])

function commonBundleProfileFields() {
  return {
    transformation_family: "chronicle_collection_checkpoint_transformation_matrix",
    source_object_kind: "chronicle_collection_checkpoint_bundle.v0",
    target_object_kind: "chronicle_collection_checkpoint_bundle.v0",
    recompute_procedure_id: "receiptos.chronicleCollectionCheckpointCrossLink+canonicalize.v0",
    comparison_rule_id: "collection-root+checkpoint-root+cross-link+canonical-envelope+metadata.v0",
    history_sensitive_policy: "violation" as const,
    precondition: chronicleCollectionCheckpointPreconditionV0,
    recompute_source: recomputeChronicleCollectionCheckpointV0,
    recompute_target: recomputeChronicleCollectionCheckpointV0,
    normative_projection: chronicleCollectionCheckpointNormativeProjectionV0,
    stability_projection: chronicleCollectionCheckpointStabilityProjectionV0,
    allowed_variant_projection: chronicleCollectionCheckpointAllowedVariantProjectionV0,
    forbidden_variant_projection: chronicleCollectionCheckpointForbiddenVariantProjectionV0,
  }
}

const CHRONICLE_COLLECTION_CHECKPOINT_FLAT_PROFILE_ID_V0 =
  "chronicle-collection-checkpoint-canonical-roundtrip-v0" as const

function buildFlatVectorProfile(vectorId: ChronicleCollectionCheckpointTransformationVectorIdV0) {
  const common = commonBundleProfileFields()
  const transformationProfileId = CHRONICLE_COLLECTION_CHECKPOINT_FLAT_PROFILE_ID_V0

  if (vectorId === "stable_coordinated_roundtrip") {
    return defineTransformationProfileV0<
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => JSON.parse(canonicalize(bundle)) as ChronicleCollectionCheckpointBundleV0,
    })
  }

  if (vectorId === "collection_artifact_refs_reorder_stable") {
    return defineTransformationProfileV0<
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => ({
        collection: { ...bundle.collection, artifact_refs: [...bundle.collection.artifact_refs].reverse() },
        checkpoint: bundle.checkpoint,
      }),
    })
  }

  if (vectorId === "upstream_mutation_without_downstream_update") {
    return defineTransformationProfileV0<
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => ({
        collection: withRecomputedCollectionRoot({
          ...bundle.collection,
          collection_id: `${bundle.collection.collection_id}-mutated`,
        }),
        // checkpoint.collection_ref is deliberately left untouched — now
        // stale relative to the mutated collection.
        checkpoint: bundle.checkpoint,
      }),
    })
  }

  if (vectorId === "downstream_reference_tamper_recomputed") {
    return defineTransformationProfileV0<
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => ({
        collection: bundle.collection,
        checkpoint: withRecomputedCheckpointRoot({
          ...bundle.checkpoint,
          collection_ref: `${bundle.checkpoint.collection_ref}-tampered`,
        }),
      }),
    })
  }

  if (vectorId === "coordinated_upstream_downstream_update") {
    return defineTransformationProfileV0<
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => {
        const mutatedCollection = withRecomputedCollectionRoot({
          ...bundle.collection,
          collection_id: `${bundle.collection.collection_id}-mutated`,
        })
        const newRef = deriveCollectionRefFromChronicleCollection(mutatedCollection)
        const mutatedCheckpoint = withRecomputedCheckpointRoot({ ...bundle.checkpoint, collection_ref: newRef })
        return { collection: mutatedCollection, checkpoint: mutatedCheckpoint }
      },
    })
  }

  if (vectorId === "collection_metadata_forbidden_mutation") {
    return defineTransformationProfileV0<
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => ({
        collection: { ...bundle.collection, metadata: { tampered: true } },
        checkpoint: bundle.checkpoint,
      }),
    })
  }

  if (vectorId === "stored_checkpoint_root_tamper") {
    return defineTransformationProfileV0<
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => ({
        collection: bundle.collection,
        checkpoint: { ...bundle.checkpoint, checkpoint_root: `sha256:${"0".repeat(64)}` },
      }),
    })
  }

  if (vectorId === "stored_collection_root_tamper") {
    return defineTransformationProfileV0<
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => ({
        collection: { ...bundle.collection, collection_root: `sha256:${"1".repeat(64)}` },
        checkpoint: bundle.checkpoint,
      }),
    })
  }

  if (vectorId === "collection_schema_literal_mutation") {
    return defineTransformationProfileV0<
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => ({
        // Local cast: schema is a literal-typed field; divergence from
        // collection_version is deliberately off-path here.
        collection: { ...bundle.collection, schema: `${bundle.collection.schema}-tampered` } as unknown as ChronicleCollectionV0,
        checkpoint: bundle.checkpoint,
      }),
    })
  }

  if (vectorId === "invalid_genesis_out_of_domain") {
    // Precondition rejects the source before transform/recompute ever runs;
    // the identity transform below is never reached.
    return defineTransformationProfileV0<
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointObservationV0
    >({
      ...common,
      transformation_profile_id: transformationProfileId,
      transform: (bundle) => bundle,
    })
  }

  // entry_refs_recompute_unresolved
  return defineTransformationProfileV0<
    ChronicleCollectionCheckpointBundleV0,
    ChronicleCollectionCheckpointBundleV0,
    ChronicleCollectionCheckpointObservationV0
  >({
    ...common,
    transformation_profile_id: transformationProfileId,
    // Malformed entry_refs, local to this one adversarial vector only —
    // ChronicleCheckpointV0's declared shape is never weakened.
    transform: (bundle) => ({
      collection: bundle.collection,
      checkpoint: { ...bundle.checkpoint, entry_refs: null } as unknown as ChronicleCheckpointV0,
    }),
  })
}

export type ChronicleCollectionCheckpointTransformationMemberResultV0 = {
  readonly vector_id: ChronicleCollectionCheckpointTransformationVectorIdV0
  readonly expected: ChronicleCollectionCheckpointTransformationVectorRecordV0
  readonly observed: TransformationStabilityResultV0
}

export type ChronicleCollectionCheckpointTransformationMatrixResultV0 = {
  readonly schema: typeof CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_MATRIX_SCHEMA_V0
  readonly matrix_id: typeof CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_MATRIX_ID_V0
  readonly vector_count: 11
  readonly aggregate: {
    readonly stable: number
    readonly history_sensitive: number
    readonly unresolved: number
    readonly out_of_domain: number
    readonly violation: number
  }
  readonly members: readonly ChronicleCollectionCheckpointTransformationMemberResultV0[]
  readonly pass: boolean
}

function memberPass(member: ChronicleCollectionCheckpointTransformationMemberResultV0): boolean {
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
  members: readonly ChronicleCollectionCheckpointTransformationMemberResultV0[],
): ChronicleCollectionCheckpointTransformationMatrixResultV0["aggregate"] {
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

export async function evaluateChronicleCollectionCheckpointTransformationVectorV0(
  vectorId: ChronicleCollectionCheckpointTransformationVectorIdV0,
  source: ChronicleCollectionCheckpointBundleV0,
): Promise<TransformationStabilityResultV0> {
  const profile = buildFlatVectorProfile(vectorId)
  if (vectorId === "invalid_genesis_out_of_domain") {
    return evaluateTransformationStabilityV0(profile, invalidGenesisBundle(source))
  }
  return evaluateTransformationStabilityV0(profile, source)
}

export async function evaluateChronicleCollectionCheckpointTransformationMatrixV0(
  source: ChronicleCollectionCheckpointBundleV0,
): Promise<ChronicleCollectionCheckpointTransformationMatrixResultV0> {
  const members: ChronicleCollectionCheckpointTransformationMemberResultV0[] = []

  for (const expected of CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_VECTORS_V0) {
    const observed = await evaluateChronicleCollectionCheckpointTransformationVectorV0(expected.vector_id, source)
    members.push({ vector_id: expected.vector_id, expected, observed })
  }

  const aggregate = aggregateMembers(members)
  const pass =
    members.length === 11 &&
    members.every(memberPass) &&
    aggregate.stable === 2 &&
    aggregate.history_sensitive === 0 &&
    aggregate.unresolved === 1 &&
    aggregate.out_of_domain === 1 &&
    aggregate.violation === 7

  return {
    schema: CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_MATRIX_SCHEMA_V0,
    matrix_id: CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_MATRIX_ID_V0,
    vector_count: 11,
    aggregate,
    members,
    pass,
  }
}

// ---------------------------------------------------------------------------
// Closed-cycle vector inventory
// ---------------------------------------------------------------------------

export type ChronicleCollectionCheckpointTransformationCycleVectorIdV0 =
  | "stable_multi_edge_roundtrip_reorder"
  | "cross_link_mutation_then_restore"
  | "invalid_start_out_of_domain"
  | "entry_refs_corrupt_unresolved"

export type ChronicleCollectionCheckpointTransformationCycleVectorRecordV0 = {
  readonly vector_id: ChronicleCollectionCheckpointTransformationCycleVectorIdV0
  readonly expected_classification: TransformationStabilityClassificationV0
  readonly expected_failed_edge_id: string | null
  readonly expected_failure_reason: string | null
  readonly expected_completed_edges: number
}

export const CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_CYCLE_VECTORS_V0: readonly ChronicleCollectionCheckpointTransformationCycleVectorRecordV0[] =
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
      vector_id: "invalid_start_out_of_domain",
      expected_classification: "out_of_domain",
      expected_failed_edge_id: "attempt",
      expected_failure_reason: "chronicle_checkpoint_shape_invalid",
      expected_completed_edges: 0,
    }),
    Object.freeze({
      vector_id: "entry_refs_corrupt_unresolved",
      expected_classification: "unresolved",
      expected_failed_edge_id: "corrupt-entry-refs",
      expected_failure_reason: "chronicle_collection_checkpoint_recompute_failed",
      expected_completed_edges: 0,
    }),
  ])

function commonBundleCycleProfileFields() {
  return {
    node_object_kind: "chronicle_collection_checkpoint_bundle.v0",
    recompute_procedure_id: "receiptos.chronicleCollectionCheckpointCrossLink+canonicalize.v0",
    comparison_rule_id: "collection-root+checkpoint-root+cross-link+canonical-envelope+metadata.v0",
    history_sensitive_policy: "violation" as const,
    recompute: recomputeChronicleCollectionCheckpointV0,
    normative_projection: chronicleCollectionCheckpointNormativeProjectionV0,
    stability_projection: chronicleCollectionCheckpointStabilityProjectionV0,
    allowed_variant_projection: chronicleCollectionCheckpointAllowedVariantProjectionV0,
    forbidden_variant_projection: chronicleCollectionCheckpointForbiddenVariantProjectionV0,
  }
}

function bundleCycleEdge(
  edgeId: string,
  transform: (bundle: ChronicleCollectionCheckpointBundleV0) => ChronicleCollectionCheckpointBundleV0,
): AuthenticatedTransformationCycleEdgeV0<ChronicleCollectionCheckpointBundleV0> {
  return defineTransformationCycleEdgeV0<ChronicleCollectionCheckpointBundleV0>({
    edge_id: edgeId,
    precondition: chronicleCollectionCheckpointPreconditionV0,
    transform,
  })
}

function buildCycleVectorProfile(vectorId: ChronicleCollectionCheckpointTransformationCycleVectorIdV0) {
  const common = commonBundleCycleProfileFields()
  const cycleProfileId = `chronicle-collection-checkpoint-cycle-v0:${vectorId}`

  if (vectorId === "stable_multi_edge_roundtrip_reorder") {
    return defineTransformationCycleProfileV0<
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointObservationV0
    >({
      ...common,
      cycle_profile_id: cycleProfileId,
      ordered_edges: [
        bundleCycleEdge(
          "canonical-roundtrip",
          (bundle) => JSON.parse(canonicalize(bundle)) as ChronicleCollectionCheckpointBundleV0,
        ),
        bundleCycleEdge("collection-artifact-refs-reorder", (bundle) => ({
          collection: { ...bundle.collection, artifact_refs: [...bundle.collection.artifact_refs].reverse() },
          checkpoint: bundle.checkpoint,
        })),
      ],
    })
  }

  if (vectorId === "cross_link_mutation_then_restore") {
    return defineTransformationCycleProfileV0<
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointObservationV0
    >({
      ...common,
      cycle_profile_id: cycleProfileId,
      ordered_edges: [
        bundleCycleEdge("mutate-collection-id-stale-ref", (bundle) => ({
          collection: withRecomputedCollectionRoot({
            ...bundle.collection,
            collection_id: `${bundle.collection.collection_id}-mutated`,
          }),
          checkpoint: bundle.checkpoint,
        })),
        // Declared but never reached: N mismatch (cross_link_match flips
        // false) is immediately terminal at mutate-collection-id-stale-ref.
        // Restoring collection_id and syncing checkpoint.collection_ref
        // here would bring N back into agreement with R0, but the cycle
        // never gets this far — this is the proof that endpoint equality
        // cannot erase an intermediate cross-object violation.
        bundleCycleEdge("restore-collection-id-and-ref", (bundle) => {
          const restoredId = bundle.collection.collection_id.replace(/-mutated$/, "")
          const restoredCollection = withRecomputedCollectionRoot({
            ...bundle.collection,
            collection_id: restoredId,
          })
          const restoredRef = deriveCollectionRefFromChronicleCollection(restoredCollection)
          return {
            collection: restoredCollection,
            checkpoint: withRecomputedCheckpointRoot({ ...bundle.checkpoint, collection_ref: restoredRef }),
          }
        }),
      ],
    })
  }

  if (vectorId === "invalid_start_out_of_domain") {
    return defineTransformationCycleProfileV0<
      ChronicleCollectionCheckpointBundleV0,
      ChronicleCollectionCheckpointObservationV0
    >({
      ...common,
      cycle_profile_id: cycleProfileId,
      ordered_edges: [bundleCycleEdge("attempt", (bundle) => bundle)],
    })
  }

  // entry_refs_corrupt_unresolved
  return defineTransformationCycleProfileV0<
    ChronicleCollectionCheckpointBundleV0,
    ChronicleCollectionCheckpointObservationV0
  >({
    ...common,
    cycle_profile_id: cycleProfileId,
    ordered_edges: [
      defineTransformationCycleEdgeV0<ChronicleCollectionCheckpointBundleV0>({
        edge_id: "corrupt-entry-refs",
        precondition: chronicleCollectionCheckpointPreconditionV0,
        transform: (bundle) => ({
          collection: bundle.collection,
          checkpoint: { ...bundle.checkpoint, entry_refs: null } as unknown as ChronicleCheckpointV0,
        }),
      }),
    ],
  })
}

export async function evaluateChronicleCollectionCheckpointTransformationCycleVectorV0(
  vectorId: ChronicleCollectionCheckpointTransformationCycleVectorIdV0,
  source: ChronicleCollectionCheckpointBundleV0,
): Promise<TransformationStabilityCycleResultV0> {
  // The cycle's own unconditional initial recompute (verifyChronicleCollectionV0
  // + verifyChronicleCheckpointV0) must succeed for the start bundle in order
  // to reach edge evaluation at all (see module-level comment).
  // invalid_start_out_of_domain therefore starts from a shape-invalid-but-
  // root-consistent checkpoint, constructed the same way as the flat
  // out_of_domain vector's source.
  const startBundle = vectorId === "invalid_start_out_of_domain" ? invalidGenesisBundle(source) : source
  return evaluateTransformationCycleV0(buildCycleVectorProfile(vectorId), startBundle)
}
