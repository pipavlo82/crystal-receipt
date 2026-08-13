/**
 * ReceiptOS Transformation Stability v1 — HandoffEvidence closed-cycle profile.
 *
 * Moves closed-cycle proof from the generic synthetic node domain onto a real
 * ReceiptOS object boundary (HandoffEvidence). Every N/S/F/A projection,
 * precondition, and recompute function here is imported unchanged from
 * transformation-stability-handoff-roundtrip.ts; this module only wires them
 * into transformation-stability-cycle.ts's generic engine with concrete edge
 * sequences. No new canonicalizer, schema, or root logic is introduced.
 *
 * Reachable classification set: `stable`, `violation`, `unresolved`.
 *
 * `out_of_domain` is intentionally absent from this profile. The generic
 * Transformation Stability cycle core fully supports it (see
 * transformation-stability-cycle-v0.test.ts, "failed applicability is
 * out_of_domain") — this is a property of the Handoff profile's concrete
 * primitives, not a limitation or weakening of the generic core.
 *
 * Why: `evaluateTransformationCycleV0` unconditionally recomputes the start
 * node before any edge precondition is ever consulted. `HandoffEvidenceSchema
 * .parse()` (used by recomputeHandoffEvidenceV0) calls `.validate()`
 * internally (the same check used by handoffEvidencePreconditionV0), so the
 * two are provably congruent: any node that fails recompute also fails
 * precondition, and vice versa. A schema-invalid Handoff node is therefore
 * always caught by the initial (or an edge's) recompute — classifying as
 * `unresolved` — before a cycle applicability boundary could ever see it and
 * classify it as `out_of_domain`. That boundary genuinely never fires for
 * this profile with the current merged primitives. See
 * transformation-stability-handoff-cycle-v1.test.ts for a direct empirical
 * proof of this property (not merely its absence from the vector table).
 */

import { canonicalize } from "../canon/canonicalize"
import type { HandoffEvidence } from "../schema/types"
import {
  defineTransformationCycleEdgeV0,
  defineTransformationCycleProfileV0,
  evaluateTransformationCycleV0,
  type AuthenticatedTransformationCycleProfileV0,
  type TransformationCycleClassificationV0,
  type TransformationStabilityCycleResultV0,
} from "./transformation-stability-cycle"
import { reverseObjectKeyOrder } from "./transformation-stability-handoff-matrix"
import {
  handoffAllowedVariantProjectionV0,
  handoffEvidencePreconditionV0,
  handoffForbiddenVariantProjectionV0,
  handoffNormativeProjectionV0,
  handoffStabilityProjectionV0,
  recomputeHandoffEvidenceV0,
  validateHandoffEvidenceV0,
  type HandoffEvidenceRoundTripObservationV0,
} from "./transformation-stability-handoff-roundtrip"

export const HANDOFF_TRANSFORMATION_CYCLE_SCHEMA_V1 =
  "receiptos.transformation_stability_handoff_cycle.v1" as const

export const HANDOFF_TRANSFORMATION_CYCLE_ID_V1 =
  "handoff-transformation-stability-cycle-v1" as const

export type HandoffTransformationCycleVectorIdV1 =
  | "stable_multi_edge_roundtrip_reorder"
  | "representation_reorder_stable"
  | "session_id_mutation_then_restore"
  | "anchor_mutation_then_restore"
  | "transform_output_recompute_unresolved"

export type HandoffTransformationCycleVectorRecordV1 = {
  readonly vector_id: HandoffTransformationCycleVectorIdV1
  readonly expected_classification: TransformationCycleClassificationV0
  readonly expected_failed_edge_id: string | null
  readonly expected_failure_reason: string | null
  readonly expected_completed_edges: number
}

export const HANDOFF_TRANSFORMATION_CYCLE_VECTORS_V1: readonly HandoffTransformationCycleVectorRecordV1[] =
  Object.freeze([
    Object.freeze({
      vector_id: "stable_multi_edge_roundtrip_reorder",
      expected_classification: "stable",
      expected_failed_edge_id: null,
      expected_failure_reason: null,
      expected_completed_edges: 2,
    }),
    Object.freeze({
      vector_id: "representation_reorder_stable",
      expected_classification: "stable",
      expected_failed_edge_id: null,
      expected_failure_reason: null,
      expected_completed_edges: 1,
    }),
    Object.freeze({
      vector_id: "session_id_mutation_then_restore",
      expected_classification: "violation",
      expected_failed_edge_id: "mutate-session-id",
      expected_failure_reason: "normative_projection_mismatch",
      expected_completed_edges: 0,
    }),
    Object.freeze({
      vector_id: "anchor_mutation_then_restore",
      expected_classification: "violation",
      expected_failed_edge_id: "mutate-anchor-contract",
      expected_failure_reason: "forbidden_variant_mismatch",
      expected_completed_edges: 0,
    }),
    Object.freeze({
      vector_id: "transform_output_recompute_unresolved",
      expected_classification: "unresolved",
      expected_failed_edge_id: "corrupt-mid-cycle",
      expected_failure_reason: "handoff_evidence_recompute_failed",
      expected_completed_edges: 0,
    }),
  ])

function commonCycleProfileFields() {
  return {
    node_object_kind: "stealth.session.evidence.v1",
    recompute_procedure_id: "receiptos.computeReceiptRoot+canonicalize.v0",
    comparison_rule_id: "receipt-root+canonical-envelope+anchor.v0",
    history_sensitive_policy: "violation" as const,
    recompute: recomputeHandoffEvidenceV0,
    normative_projection: handoffNormativeProjectionV0,
    stability_projection: handoffStabilityProjectionV0,
    allowed_variant_projection: handoffAllowedVariantProjectionV0,
    forbidden_variant_projection: handoffForbiddenVariantProjectionV0,
  }
}

function handoffEdge(
  edgeId: string,
  transform: (node: HandoffEvidence) => HandoffEvidence,
) {
  return defineTransformationCycleEdgeV0<HandoffEvidence>({
    edge_id: edgeId,
    precondition: handoffEvidencePreconditionV0,
    transform,
  })
}

const canonicalRoundTripTransform = (node: HandoffEvidence): HandoffEvidence =>
  validateHandoffEvidenceV0(JSON.parse(canonicalize(node)))

const reverseKeyOrderTransform = (node: HandoffEvidence): HandoffEvidence =>
  validateHandoffEvidenceV0(reverseObjectKeyOrder(node))

function buildValidNodeProfile(
  cycleProfileId: string,
  ordered_edges: ReturnType<typeof handoffEdge>[],
): AuthenticatedTransformationCycleProfileV0<HandoffEvidence, HandoffEvidenceRoundTripObservationV0> {
  return defineTransformationCycleProfileV0<HandoffEvidence, HandoffEvidenceRoundTripObservationV0>({
    ...commonCycleProfileFields(),
    cycle_profile_id: cycleProfileId,
    ordered_edges,
  })
}

function buildVectorProfile(
  vectorId: HandoffTransformationCycleVectorIdV1,
): AuthenticatedTransformationCycleProfileV0<HandoffEvidence, HandoffEvidenceRoundTripObservationV0> {
  const cycleProfileId = `handoff-cycle-v1:${vectorId}`

  if (vectorId === "stable_multi_edge_roundtrip_reorder") {
    return buildValidNodeProfile(cycleProfileId, [
      handoffEdge("canonical-roundtrip", canonicalRoundTripTransform),
      handoffEdge("reverse-key-order", reverseKeyOrderTransform),
    ])
  }

  if (vectorId === "representation_reorder_stable") {
    return buildValidNodeProfile(cycleProfileId, [handoffEdge("reverse-key-order", reverseKeyOrderTransform)])
  }

  if (vectorId === "session_id_mutation_then_restore") {
    return buildValidNodeProfile(cycleProfileId, [
      handoffEdge("mutate-session-id", (node) => {
        const target = structuredClone(node)
        target.session_id = "session-demo-001-mutated"
        return validateHandoffEvidenceV0(target)
      }),
      // Declared but never reached: the cycle terminates at mutate-session-id
      // because N/F mismatch is immediately terminal. This edge exists to
      // prove endpoint equality cannot erase that intermediate violation —
      // restoring session_id here would bring N back into agreement with R0,
      // but the evaluator never gets this far.
      handoffEdge("restore-session-id", (node) => {
        const target = structuredClone(node)
        target.session_id = "session-demo-001"
        return validateHandoffEvidenceV0(target)
      }),
    ])
  }

  if (vectorId === "anchor_mutation_then_restore") {
    return buildValidNodeProfile(cycleProfileId, [
      handoffEdge("mutate-anchor-contract", (node) => {
        const target = structuredClone(node)
        target.anchor.contract = "0xdeadbeef"
        return validateHandoffEvidenceV0(target)
      }),
      // Declared but never reached, same reasoning as
      // session_id_mutation_then_restore: F mismatch (anchor changed) is
      // terminal even though N (receipt_root) never moved, since anchor is
      // excluded from the receipt-root preimage.
      handoffEdge("restore-anchor-contract", (node) => {
        const target = structuredClone(node)
        target.anchor.contract = null
        return validateHandoffEvidenceV0(target)
      }),
    ])
  }

  // transform_output_recompute_unresolved
  return buildValidNodeProfile(cycleProfileId, [
    defineTransformationCycleEdgeV0<HandoffEvidence>({
      edge_id: "corrupt-mid-cycle",
      precondition: handoffEvidencePreconditionV0,
      transform: (node) => {
        const corrupted = structuredClone(node) as unknown as Record<string, unknown>
        delete corrupted.session_id
        return corrupted as unknown as HandoffEvidence
      },
    }),
  ])
}

export async function evaluateHandoffTransformationCycleVectorV1(
  vectorId: HandoffTransformationCycleVectorIdV1,
  fixture: HandoffEvidence,
): Promise<TransformationStabilityCycleResultV0> {
  return evaluateTransformationCycleV0(buildVectorProfile(vectorId), fixture)
}

export type HandoffTransformationCycleMemberResultV1 = {
  readonly vector_id: HandoffTransformationCycleVectorIdV1
  readonly expected: HandoffTransformationCycleVectorRecordV1
  readonly observed: TransformationStabilityCycleResultV0
}

export type HandoffTransformationCycleMatrixResultV1 = {
  readonly schema: typeof HANDOFF_TRANSFORMATION_CYCLE_SCHEMA_V1
  readonly cycle_matrix_id: typeof HANDOFF_TRANSFORMATION_CYCLE_ID_V1
  readonly vector_count: 5
  readonly members: readonly HandoffTransformationCycleMemberResultV1[]
  readonly pass: boolean
}

function memberPass(member: HandoffTransformationCycleMemberResultV1): boolean {
  const { expected, observed } = member
  return (
    observed.classification === expected.expected_classification &&
    observed.failed_edge_id === expected.expected_failed_edge_id &&
    observed.failure_reason === expected.expected_failure_reason &&
    observed.aggregate.completed_edges === expected.expected_completed_edges
  )
}

export async function evaluateHandoffTransformationCycleMatrixV1(
  sourceValue: unknown,
): Promise<HandoffTransformationCycleMatrixResultV1> {
  const fixture = validateHandoffEvidenceV0(sourceValue)
  const members: HandoffTransformationCycleMemberResultV1[] = []

  for (const expected of HANDOFF_TRANSFORMATION_CYCLE_VECTORS_V1) {
    const observed = await evaluateHandoffTransformationCycleVectorV1(expected.vector_id, fixture)
    members.push({ vector_id: expected.vector_id, expected, observed })
  }

  const pass = members.length === 5 && members.every(memberPass)

  return {
    schema: HANDOFF_TRANSFORMATION_CYCLE_SCHEMA_V1,
    cycle_matrix_id: HANDOFF_TRANSFORMATION_CYCLE_ID_V1,
    vector_count: 5,
    members,
    pass,
  }
}
