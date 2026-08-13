/**
 * ReceiptOS Transformation Stability v1 — ChronicleCheckpointV0 profile.
 *
 * The third independent real ReceiptOS object boundary carrying the
 * Transformation Stability N/S/A/F model, alongside the existing Handoff and
 * Chronicle Portfolio profiles. Every recompute/comparison primitive here is
 * imported unchanged from src/receiptos/capsule/chronicle-portfolio-v0.ts
 * and src/receiptos/canon/canonicalize.ts; this module only wires them into
 * the existing generic transformation-stability.ts / transformation-
 * stability-cycle.ts evaluators. No new schema, root algorithm,
 * canonicalizer, or applicability rule is introduced — the applicability
 * check below invokes the already-merged `validateChronicleCheckpointShape`
 * indirectly, through the already-public `createChronicleCheckpointV0`
 * constructor used as a shape-validation oracle. No existing file is
 * modified for this, and the validator's rules are never duplicated.
 * ChronicleCheckpointV0 imports no HandoffEvidence and calls no
 * computeReceiptRoot; this module inherits that independence and adds none
 * of its own. It also has no dependency on the Chronicle Portfolio profile
 * module — only the shared capsule/canon primitives are common.
 *
 * Reachable classification set: `stable`, `violation`, `unresolved`,
 * `out_of_domain`.
 *
 * Unlike the Handoff and Chronicle Portfolio profiles, `out_of_domain` is
 * genuinely reachable here. `validateChronicleCheckpointShape` (sequence /
 * prev_checkpoint consistency) is called only by `createChronicleCheckpointV0`
 * — `verifyChronicleCheckpointV0` never calls it. Confirmed directly: a node
 * with an internally-consistent `checkpoint_root` but a shape-invalid
 * sequence/prev_checkpoint combination still recomputes cleanly
 * (`verifyChronicleCheckpointV0(...).ok === true`), so the applicability
 * check below and recompute are provably independent — the congruence
 * problem that made `out_of_domain` unreachable for the Handoff cycle does
 * not exist for this object.
 *
 * `entry_refs` order is normative-sensitive here, not merely
 * representational. `verifyChronicleCheckpointV0` recomputes
 * `recomputed_checkpoint_root` from *stored* order (it does not sort), and
 * separately requires `entry_refs` to already be canonically sorted for
 * `ok` to be true. A raw reorder therefore moves both `N` (the recomputed
 * root) and the canonical envelope — it is a `violation`, not a `stable`
 * vector, unlike the analogous Chronicle Portfolio case where
 * `collection_refs` order is fully normalized away by the object's own root
 * computation. `S` below intentionally does *not* re-sort `entry_refs`,
 * matching the object's own stored-order-sensitive semantics exactly.
 *
 * `F` is `{}` (fixed, not merely defaulted). ChronicleCheckpointV0 has no
 * field analogous to Chronicle Portfolio's `metadata` — no committed field
 * is excluded from `checkpoint_root`'s preimage while still being part of
 * the declared object. No such surface was mechanically found, so none is
 * invented.
 */

import {
  type ChronicleCheckpointV0,
  createChronicleCheckpointV0,
  sortEntryRefs,
  verifyChronicleCheckpointV0,
} from "../capsule/chronicle-portfolio-v0"
import { canonicalize } from "../canon/canonicalize"
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
// Observation
// ---------------------------------------------------------------------------

export type ChronicleCheckpointRoundTripObservationV1 = {
  readonly schema: string
  readonly claimed_checkpoint_root: string
  readonly recomputed_checkpoint_root: string
  readonly root_match: boolean
  readonly canonical_envelope: string
}

function recomputeChronicleCheckpointV1(
  node: ChronicleCheckpointV0,
): RecomputeOutcomeV0<ChronicleCheckpointRoundTripObservationV1> {
  try {
    // Reused directly — this already combines the root comparison and the
    // canonical entry_refs order check; not duplicated here.
    const verification = verifyChronicleCheckpointV0(node)
    // Deliberately NOT sorted: entry_refs order is normative-sensitive for
    // this object (see module-level comment), so the envelope must reflect
    // stored order exactly, the same way computeChronicleCheckpointRootFromStoredOrder
    // (internal to verifyChronicleCheckpointV0) does.
    const canonicalEnvelope = canonicalize({ ...node })
    return {
      state: "evaluated",
      value: {
        schema: node.schema,
        claimed_checkpoint_root: verification.checkpoint_root,
        recomputed_checkpoint_root: verification.recomputed_checkpoint_root,
        root_match: verification.ok,
        canonical_envelope: canonicalEnvelope,
      },
    }
  } catch {
    return { state: "unresolved", reason: "chronicle_checkpoint_recompute_failed" }
  }
}

// Uses the already-public createChronicleCheckpointV0 as a shape-validation
// oracle rather than importing the private validator directly (no existing
// file is modified for this). The probe deliberately uses ONLY prev_checkpoint
// and sequence from the node, with fixed safe values for every other field
// (checkpointId/collectionRef/entryRefs=[]): this keeps applicability scoped
// to exactly the sequence/prev_checkpoint relationship, so an unrelated
// malformation elsewhere on the node (e.g. corrupted entry_refs) can never be
// misclassified as an applicability failure — it must still surface as a
// bounded recompute failure (unresolved), not out_of_domain. Applicability
// (sequence/prev_checkpoint consistency) is independent of recompute
// (root/canonical-order consistency); see module-level comment.
function chronicleCheckpointShapePreconditionV1(
  node: ChronicleCheckpointV0,
): TransformationPreconditionResultV0 {
  try {
    createChronicleCheckpointV0({
      checkpointId: "transformation-stability-shape-probe",
      collectionRef: "transformation-stability-shape-probe",
      entryRefs: [],
      prevCheckpoint: node.prev_checkpoint,
      sequence: node.sequence,
    })
    return { ok: true }
  } catch {
    return { ok: false, reason: "chronicle_checkpoint_shape_invalid" }
  }
}

function chronicleCheckpointNormativeProjectionV1(
  result: ChronicleCheckpointRoundTripObservationV1,
): unknown {
  return {
    schema: result.schema,
    claimed_checkpoint_root: result.claimed_checkpoint_root,
    recomputed_checkpoint_root: result.recomputed_checkpoint_root,
    root_match: result.root_match,
  }
}

function chronicleCheckpointStabilityProjectionV1(
  result: ChronicleCheckpointRoundTripObservationV1,
): unknown {
  return { canonical_envelope: result.canonical_envelope }
}

function chronicleCheckpointAllowedVariantProjectionV1(
  _result: ChronicleCheckpointRoundTripObservationV1,
): unknown {
  return {}
}

// Fixed, not merely defaulted — see module-level comment for why no
// forbidden surface exists on this object.
function chronicleCheckpointForbiddenVariantProjectionV1(
  _result: ChronicleCheckpointRoundTripObservationV1,
): unknown {
  return {}
}

// ---------------------------------------------------------------------------
// Flat vector inventory
// ---------------------------------------------------------------------------

export const CHRONICLE_CHECKPOINT_TRANSFORMATION_MATRIX_SCHEMA_V1 =
  "receiptos.transformation_stability_chronicle_checkpoint_matrix.v1" as const

export const CHRONICLE_CHECKPOINT_TRANSFORMATION_MATRIX_ID_V1 =
  "chronicle-checkpoint-transformation-stability-matrix-v1" as const

export type ChronicleCheckpointTransformationVectorIdV1 =
  | "stable_canonical_roundtrip"
  | "checkpoint_id_normative_mutation"
  | "entry_refs_reorder_noncanonical"
  | "stored_checkpoint_root_tamper"
  | "invalid_genesis_out_of_domain"
  | "invalid_continuation_out_of_domain"
  | "entry_refs_recompute_unresolved"

export type ChronicleCheckpointTransformationVectorRecordV1 = {
  readonly vector_id: ChronicleCheckpointTransformationVectorIdV1
  readonly expected_classification: TransformationStabilityClassificationV0
  readonly expected_normative_match: boolean | null
  readonly expected_stability_match: boolean | null
  readonly expected_forbidden_variant_match: boolean | null
  readonly expected_unresolved_reason: string | null
  readonly expected_out_of_domain_reason: string | null
}

export const CHRONICLE_CHECKPOINT_TRANSFORMATION_VECTORS_V1: readonly ChronicleCheckpointTransformationVectorRecordV1[] =
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
      vector_id: "checkpoint_id_normative_mutation",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "entry_refs_reorder_noncanonical",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
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
      vector_id: "invalid_genesis_out_of_domain",
      expected_classification: "out_of_domain",
      expected_normative_match: null,
      expected_stability_match: null,
      expected_forbidden_variant_match: null,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: "chronicle_checkpoint_shape_invalid",
    }),
    Object.freeze({
      vector_id: "invalid_continuation_out_of_domain",
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
      expected_unresolved_reason: "chronicle_checkpoint_recompute_failed",
      expected_out_of_domain_reason: null,
    }),
  ])

function commonCheckpointProfileFields() {
  return {
    transformation_family: "chronicle_checkpoint_transformation_matrix",
    source_object_kind: "chronicle_checkpoint.v0",
    target_object_kind: "chronicle_checkpoint.v0",
    recompute_procedure_id: "receiptos.computeChronicleCheckpointRoot+canonicalize.v1",
    comparison_rule_id: "checkpoint-root+canonical-envelope.v1",
    history_sensitive_policy: "violation" as const,
    precondition: chronicleCheckpointShapePreconditionV1,
    recompute_source: recomputeChronicleCheckpointV1,
    recompute_target: recomputeChronicleCheckpointV1,
    normative_projection: chronicleCheckpointNormativeProjectionV1,
    stability_projection: chronicleCheckpointStabilityProjectionV1,
    allowed_variant_projection: chronicleCheckpointAllowedVariantProjectionV1,
    forbidden_variant_projection: chronicleCheckpointForbiddenVariantProjectionV1,
  }
}

const CHRONICLE_CHECKPOINT_FLAT_PROFILE_ID_V1 = "chronicle-checkpoint-canonical-roundtrip-v1" as const

// Locally-constructed, shape-invalid-but-root-consistent sources for the two
// out_of_domain vectors. Precondition is checked on the source, before
// transform ever runs (see transformation-stability.ts) — these never reach
// their (irrelevant) identity transform.
function invalidGenesisSource(node: ChronicleCheckpointV0): ChronicleCheckpointV0 {
  return { ...node, sequence: 0, prev_checkpoint: `${node.checkpoint_id}-prior` }
}

function invalidContinuationSource(node: ChronicleCheckpointV0): ChronicleCheckpointV0 {
  return { ...node, sequence: node.sequence > 0 ? node.sequence : 1, prev_checkpoint: null }
}

function buildFlatVectorProfile(vectorId: ChronicleCheckpointTransformationVectorIdV1) {
  const common = commonCheckpointProfileFields()

  if (vectorId === "stable_canonical_roundtrip") {
    return defineTransformationProfileV0<ChronicleCheckpointV0, ChronicleCheckpointV0, ChronicleCheckpointRoundTripObservationV1>({
      ...common,
      transformation_profile_id: CHRONICLE_CHECKPOINT_FLAT_PROFILE_ID_V1,
      transform: (node) => JSON.parse(canonicalize(node)) as ChronicleCheckpointV0,
    })
  }

  if (vectorId === "checkpoint_id_normative_mutation") {
    return defineTransformationProfileV0<ChronicleCheckpointV0, ChronicleCheckpointV0, ChronicleCheckpointRoundTripObservationV1>({
      ...common,
      transformation_profile_id: CHRONICLE_CHECKPOINT_FLAT_PROFILE_ID_V1,
      transform: (node) => ({ ...node, checkpoint_id: `${node.checkpoint_id}-mutated` }),
    })
  }

  if (vectorId === "entry_refs_reorder_noncanonical") {
    return defineTransformationProfileV0<ChronicleCheckpointV0, ChronicleCheckpointV0, ChronicleCheckpointRoundTripObservationV1>({
      ...common,
      transformation_profile_id: CHRONICLE_CHECKPOINT_FLAT_PROFILE_ID_V1,
      transform: (node) => ({ ...node, entry_refs: [...node.entry_refs].reverse() }),
    })
  }

  if (vectorId === "stored_checkpoint_root_tamper") {
    return defineTransformationProfileV0<ChronicleCheckpointV0, ChronicleCheckpointV0, ChronicleCheckpointRoundTripObservationV1>({
      ...common,
      transformation_profile_id: CHRONICLE_CHECKPOINT_FLAT_PROFILE_ID_V1,
      transform: (node) => ({ ...node, checkpoint_root: `sha256:${"0".repeat(64)}` }),
    })
  }

  if (vectorId === "invalid_genesis_out_of_domain" || vectorId === "invalid_continuation_out_of_domain") {
    // Precondition rejects the source before transform/recompute ever runs;
    // the identity transform below is never reached.
    return defineTransformationProfileV0<ChronicleCheckpointV0, ChronicleCheckpointV0, ChronicleCheckpointRoundTripObservationV1>({
      ...common,
      transformation_profile_id: CHRONICLE_CHECKPOINT_FLAT_PROFILE_ID_V1,
      transform: (node) => node,
    })
  }

  // entry_refs_recompute_unresolved
  return defineTransformationProfileV0<ChronicleCheckpointV0, ChronicleCheckpointV0, ChronicleCheckpointRoundTripObservationV1>({
    ...common,
    transformation_profile_id: CHRONICLE_CHECKPOINT_FLAT_PROFILE_ID_V1,
    // Malformed entry_refs, local to this one adversarial vector only —
    // ChronicleCheckpointV0's declared shape is never weakened.
    transform: (node) => ({ ...node, entry_refs: null }) as unknown as ChronicleCheckpointV0,
  })
}

export type ChronicleCheckpointTransformationMemberResultV1 = {
  readonly vector_id: ChronicleCheckpointTransformationVectorIdV1
  readonly expected: ChronicleCheckpointTransformationVectorRecordV1
  readonly observed: TransformationStabilityResultV0
}

export type ChronicleCheckpointTransformationMatrixResultV1 = {
  readonly schema: typeof CHRONICLE_CHECKPOINT_TRANSFORMATION_MATRIX_SCHEMA_V1
  readonly matrix_id: typeof CHRONICLE_CHECKPOINT_TRANSFORMATION_MATRIX_ID_V1
  readonly vector_count: 7
  readonly aggregate: {
    readonly stable: number
    readonly history_sensitive: number
    readonly unresolved: number
    readonly out_of_domain: number
    readonly violation: number
  }
  readonly members: readonly ChronicleCheckpointTransformationMemberResultV1[]
  readonly pass: boolean
}

function memberPass(member: ChronicleCheckpointTransformationMemberResultV1): boolean {
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
  members: readonly ChronicleCheckpointTransformationMemberResultV1[],
): ChronicleCheckpointTransformationMatrixResultV1["aggregate"] {
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

export async function evaluateChronicleCheckpointTransformationVectorV1(
  vectorId: ChronicleCheckpointTransformationVectorIdV1,
  source: ChronicleCheckpointV0,
): Promise<TransformationStabilityResultV0> {
  const profile = buildFlatVectorProfile(vectorId)
  if (vectorId === "invalid_genesis_out_of_domain") {
    return evaluateTransformationStabilityV0(profile, invalidGenesisSource(source))
  }
  if (vectorId === "invalid_continuation_out_of_domain") {
    return evaluateTransformationStabilityV0(profile, invalidContinuationSource(source))
  }
  return evaluateTransformationStabilityV0(profile, source)
}

export async function evaluateChronicleCheckpointTransformationMatrixV1(
  source: ChronicleCheckpointV0,
): Promise<ChronicleCheckpointTransformationMatrixResultV1> {
  const members: ChronicleCheckpointTransformationMemberResultV1[] = []

  for (const expected of CHRONICLE_CHECKPOINT_TRANSFORMATION_VECTORS_V1) {
    const observed = await evaluateChronicleCheckpointTransformationVectorV1(expected.vector_id, source)
    members.push({ vector_id: expected.vector_id, expected, observed })
  }

  const aggregate = aggregateMembers(members)
  const pass =
    members.length === 7 &&
    members.every(memberPass) &&
    aggregate.stable === 1 &&
    aggregate.history_sensitive === 0 &&
    aggregate.unresolved === 1 &&
    aggregate.out_of_domain === 2 &&
    aggregate.violation === 3

  return {
    schema: CHRONICLE_CHECKPOINT_TRANSFORMATION_MATRIX_SCHEMA_V1,
    matrix_id: CHRONICLE_CHECKPOINT_TRANSFORMATION_MATRIX_ID_V1,
    vector_count: 7,
    aggregate,
    members,
    pass,
  }
}

// ---------------------------------------------------------------------------
// Closed-cycle vector inventory
// ---------------------------------------------------------------------------

export type ChronicleCheckpointTransformationCycleVectorIdV1 =
  | "stable_multi_edge_roundtrip_reorder"
  | "checkpoint_id_mutation_then_restore"
  | "invalid_start_out_of_domain"
  | "entry_refs_corrupt_unresolved"

export type ChronicleCheckpointTransformationCycleVectorRecordV1 = {
  readonly vector_id: ChronicleCheckpointTransformationCycleVectorIdV1
  readonly expected_classification: TransformationStabilityClassificationV0
  readonly expected_failed_edge_id: string | null
  readonly expected_failure_reason: string | null
  readonly expected_completed_edges: number
}

export const CHRONICLE_CHECKPOINT_TRANSFORMATION_CYCLE_VECTORS_V1: readonly ChronicleCheckpointTransformationCycleVectorRecordV1[] =
  Object.freeze([
    Object.freeze({
      vector_id: "stable_multi_edge_roundtrip_reorder",
      expected_classification: "stable",
      expected_failed_edge_id: null,
      expected_failure_reason: null,
      expected_completed_edges: 2,
    }),
    Object.freeze({
      vector_id: "checkpoint_id_mutation_then_restore",
      expected_classification: "violation",
      expected_failed_edge_id: "mutate-checkpoint-id",
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
      expected_failure_reason: "chronicle_checkpoint_recompute_failed",
      expected_completed_edges: 0,
    }),
  ])

function commonCheckpointCycleProfileFields() {
  return {
    node_object_kind: "chronicle_checkpoint.v0",
    recompute_procedure_id: "receiptos.computeChronicleCheckpointRoot+canonicalize.v1",
    comparison_rule_id: "checkpoint-root+canonical-envelope.v1",
    history_sensitive_policy: "violation" as const,
    recompute: recomputeChronicleCheckpointV1,
    normative_projection: chronicleCheckpointNormativeProjectionV1,
    stability_projection: chronicleCheckpointStabilityProjectionV1,
    allowed_variant_projection: chronicleCheckpointAllowedVariantProjectionV1,
    forbidden_variant_projection: chronicleCheckpointForbiddenVariantProjectionV1,
  }
}

function checkpointCycleEdge(
  edgeId: string,
  transform: (node: ChronicleCheckpointV0) => ChronicleCheckpointV0,
): AuthenticatedTransformationCycleEdgeV0<ChronicleCheckpointV0> {
  return defineTransformationCycleEdgeV0<ChronicleCheckpointV0>({
    edge_id: edgeId,
    precondition: chronicleCheckpointShapePreconditionV1,
    transform,
  })
}

function buildCycleVectorProfile(vectorId: ChronicleCheckpointTransformationCycleVectorIdV1) {
  const common = commonCheckpointCycleProfileFields()
  const cycleProfileId = `chronicle-checkpoint-cycle-v1:${vectorId}`

  if (vectorId === "stable_multi_edge_roundtrip_reorder") {
    return defineTransformationCycleProfileV0<ChronicleCheckpointV0, ChronicleCheckpointRoundTripObservationV1>({
      ...common,
      cycle_profile_id: cycleProfileId,
      ordered_edges: [
        checkpointCycleEdge("canonical-roundtrip", (node) => JSON.parse(canonicalize(node)) as ChronicleCheckpointV0),
        // Idempotent given an already-canonically-sorted fixture: re-applying
        // sortEntryRefs to entry_refs that are already sorted is a true
        // no-op, distinct from the arbitrary-reorder vector above (which is
        // NOT stable — see module-level comment).
        checkpointCycleEdge("canonical-order-reapply", (node) => ({
          ...node,
          entry_refs: sortEntryRefs(node.entry_refs),
        })),
      ],
    })
  }

  if (vectorId === "checkpoint_id_mutation_then_restore") {
    return defineTransformationCycleProfileV0<ChronicleCheckpointV0, ChronicleCheckpointRoundTripObservationV1>({
      ...common,
      cycle_profile_id: cycleProfileId,
      ordered_edges: [
        checkpointCycleEdge("mutate-checkpoint-id", (node) => ({
          ...node,
          checkpoint_id: `${node.checkpoint_id}-mutated`,
        })),
        // Declared but never reached: N mismatch is immediately terminal at
        // mutate-checkpoint-id. Restoring checkpoint_id here would bring N
        // back into agreement with R0, but the cycle never gets this far —
        // this is the proof that endpoint equality cannot erase an
        // intermediate violation.
        checkpointCycleEdge("restore-checkpoint-id", (node) => {
          const restored = node.checkpoint_id.replace(/-mutated$/, "")
          return { ...node, checkpoint_id: restored }
        }),
      ],
    })
  }

  if (vectorId === "invalid_start_out_of_domain") {
    return defineTransformationCycleProfileV0<ChronicleCheckpointV0, ChronicleCheckpointRoundTripObservationV1>({
      ...common,
      cycle_profile_id: cycleProfileId,
      ordered_edges: [checkpointCycleEdge("attempt", (node) => node)],
    })
  }

  // entry_refs_corrupt_unresolved
  return defineTransformationCycleProfileV0<ChronicleCheckpointV0, ChronicleCheckpointRoundTripObservationV1>({
    ...common,
    cycle_profile_id: cycleProfileId,
    ordered_edges: [
      defineTransformationCycleEdgeV0<ChronicleCheckpointV0>({
        edge_id: "corrupt-entry-refs",
        precondition: chronicleCheckpointShapePreconditionV1,
        transform: (node) => ({ ...node, entry_refs: null }) as unknown as ChronicleCheckpointV0,
      }),
    ],
  })
}

export async function evaluateChronicleCheckpointTransformationCycleVectorV1(
  vectorId: ChronicleCheckpointTransformationCycleVectorIdV1,
  source: ChronicleCheckpointV0,
): Promise<TransformationStabilityCycleResultV0> {
  // The cycle's own unconditional initial recompute (verifyChronicleCheckpointV0)
  // must succeed for the start node in order to reach edge evaluation at all
  // (see module-level comment). invalid_start_out_of_domain therefore starts
  // from a shape-invalid-but-root-consistent node, constructed the same way
  // as the flat out_of_domain vectors' sources.
  const startNode = vectorId === "invalid_start_out_of_domain" ? invalidGenesisSource(source) : source
  return evaluateTransformationCycleV0(buildCycleVectorProfile(vectorId), startNode)
}
