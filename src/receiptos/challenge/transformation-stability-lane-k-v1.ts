/**
 * ReceiptOS Transformation Stability v0 — Lane K v1 adapter.
 *
 * This adapter deliberately does NOT reinterpret Lane K v1 as a normative-
 * preservation profile. Lane K's public claim is observational traversal
 * stability with semantic and stability axes kept independent.
 *
 * The adapter wraps Lane K's existing authenticated authority and exposes that
 * evidence to the broader Transformation Stability layer without duplicating
 * schedules, reset semantics, DCN membership, expected-result authority, or
 * worker isolation rules.
 */

import {
  COUNTERFACTUAL_TRAVERSAL_STABILITY_RESULT_SCHEMA_V1,
  EXPECTED_TRAVERSAL_V1_EVALUATIONS,
  EXPECTED_TRAVERSAL_V1_SCHEDULE_COUNT,
  PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V1,
  TRAVERSAL_RESET_MODEL_V0,
  verifyCounterfactualTraversalStabilityV1,
  type TraversalStabilityResultV1,
  type TraversalStabilityRunTelemetryV1,
} from "./counterfactual-traversal-stability-v1"
import {
  COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID_V1,
  COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1,
  COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION_V1,
} from "./counterfactual-traversal-schedules-v1"

export const TRANSFORMATION_STABILITY_LANE_K_V1_ADAPTER_SCHEMA_V0 =
  "receiptos.transformation_stability_lane_k_v1_adapter_result.v0" as const

export const TRANSFORMATION_STABILITY_LANE_K_V1_ADAPTER_ID_V0 =
  "transformation-stability-lane-k-v1-adapter-v0" as const

export const TRANSFORMATION_STABILITY_LANE_K_V1_CLAIM_V0 =
  "observational_stability_evidence" as const

export type LaneKV1AdapterClassificationV0 =
  | "stable"
  | "history_sensitive"
  | "unresolved"

export type LaneKV1SemanticAggregateClassV0 =
  | "all_conformant"
  | "contains_nonconformant"
  | "execution_unresolved"

export type TransformationStabilityLaneKV1AdapterResultV0 = {
  readonly schema: typeof TRANSFORMATION_STABILITY_LANE_K_V1_ADAPTER_SCHEMA_V0
  readonly adapter_id: typeof TRANSFORMATION_STABILITY_LANE_K_V1_ADAPTER_ID_V0
  readonly transformation_claim: typeof TRANSFORMATION_STABILITY_LANE_K_V1_CLAIM_V0
  readonly source_profile_id: typeof COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1
  readonly source_profile_version: typeof COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION_V1
  readonly source_schedule_set_id: typeof COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID_V1
  readonly source_schedule_set_sha256: string
  readonly dcn_sha256: string
  readonly reset_model: typeof TRAVERSAL_RESET_MODEL_V0
  readonly evaluation_state: "evaluated" | "execution_unresolved"
  readonly classification: LaneKV1AdapterClassificationV0
  readonly semantic_aggregate_class: LaneKV1SemanticAggregateClassV0
  readonly schedule_count: typeof EXPECTED_TRAVERSAL_V1_SCHEDULE_COUNT
  readonly member_count: 10
  readonly scheduled_member_evaluations: typeof EXPECTED_TRAVERSAL_V1_EVALUATIONS
  readonly stable: number
  readonly history_sensitive: number
  readonly unresolved: number
  readonly semantic_conformant: number
  readonly semantic_nonconformant: number
  readonly semantic_execution_unresolved: number
  readonly first_position_covered: 10
  readonly first_position_missing: readonly []
}

export class TransformationStabilityLaneKV1AdapterErrorV0 extends Error {
  readonly code = "transformation_stability_lane_k_v1_adapter_error_v0" as const
  readonly reason: string

  constructor(reason: string) {
    super("transformation stability Lane K v1 adapter failed")
    this.name = "TransformationStabilityLaneKV1AdapterErrorV0"
    this.reason = reason
  }
}

function assertLaneKResultIdentity(result: TraversalStabilityResultV1): void {
  if (result.schema !== COUNTERFACTUAL_TRAVERSAL_STABILITY_RESULT_SCHEMA_V1) {
    throw new TransformationStabilityLaneKV1AdapterErrorV0("source_schema_mismatch")
  }
  if (result.profile_id !== COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1) {
    throw new TransformationStabilityLaneKV1AdapterErrorV0("source_profile_mismatch")
  }
  if (result.profile_version !== COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION_V1) {
    throw new TransformationStabilityLaneKV1AdapterErrorV0("source_profile_mismatch")
  }
  if (result.schedule_set_id !== COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID_V1) {
    throw new TransformationStabilityLaneKV1AdapterErrorV0("source_schedule_set_mismatch")
  }
  if (result.schedule_set_sha256 !== PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V1) {
    throw new TransformationStabilityLaneKV1AdapterErrorV0("source_schedule_set_mismatch")
  }
  if (result.reset_model !== TRAVERSAL_RESET_MODEL_V0) {
    throw new TransformationStabilityLaneKV1AdapterErrorV0("source_reset_model_mismatch")
  }
  if (typeof result.dcn_sha256 !== "string" || result.dcn_sha256.length !== 64) {
    throw new TransformationStabilityLaneKV1AdapterErrorV0("source_dcn_identity_mismatch")
  }
}

function assertLaneKClosedShape(result: TraversalStabilityResultV1): void {
  const aggregate = result.aggregate
  if (
    aggregate.schedule_count !== EXPECTED_TRAVERSAL_V1_SCHEDULE_COUNT ||
    aggregate.member_count !== 10 ||
    aggregate.scheduled_member_evaluations !== EXPECTED_TRAVERSAL_V1_EVALUATIONS
  ) {
    throw new TransformationStabilityLaneKV1AdapterErrorV0("source_aggregate_shape_mismatch")
  }

  if (
    aggregate.stable + aggregate.history_sensitive + aggregate.unresolved !==
    EXPECTED_TRAVERSAL_V1_EVALUATIONS
  ) {
    throw new TransformationStabilityLaneKV1AdapterErrorV0("source_stability_partition_mismatch")
  }

  if (
    aggregate.semantic_conformant +
      aggregate.semantic_nonconformant +
      aggregate.semantic_execution_unresolved !==
    EXPECTED_TRAVERSAL_V1_EVALUATIONS
  ) {
    throw new TransformationStabilityLaneKV1AdapterErrorV0("source_semantic_partition_mismatch")
  }

  if (result.comparisons.length !== EXPECTED_TRAVERSAL_V1_EVALUATIONS) {
    throw new TransformationStabilityLaneKV1AdapterErrorV0("source_comparison_count_mismatch")
  }
  if (result.schedules.length !== EXPECTED_TRAVERSAL_V1_SCHEDULE_COUNT) {
    throw new TransformationStabilityLaneKV1AdapterErrorV0("source_schedule_count_mismatch")
  }

  const coverage = result.first_position_coverage
  if (
    coverage.schedule_count !== EXPECTED_TRAVERSAL_V1_SCHEDULE_COUNT ||
    coverage.member_count !== 10 ||
    coverage.scheduled_member_evaluations !== EXPECTED_TRAVERSAL_V1_EVALUATIONS ||
    coverage.first_position_member_count !== 10 ||
    coverage.first_position_covered !== 10 ||
    coverage.first_position_missing.length !== 0
  ) {
    throw new TransformationStabilityLaneKV1AdapterErrorV0(
      "source_first_position_coverage_mismatch",
    )
  }
}

function deriveClassification(
  result: TraversalStabilityResultV1,
): LaneKV1AdapterClassificationV0 {
  const aggregate = result.aggregate

  if (aggregate.unresolved > 0) {
    if (result.evaluation_state !== "execution_unresolved" || result.verdict !== null) {
      throw new TransformationStabilityLaneKV1AdapterErrorV0("source_state_mismatch")
    }
    return "unresolved"
  }

  if (result.evaluation_state !== "evaluated") {
    throw new TransformationStabilityLaneKV1AdapterErrorV0("source_state_mismatch")
  }

  if (aggregate.history_sensitive > 0) {
    if (result.verdict !== "history_sensitive") {
      throw new TransformationStabilityLaneKV1AdapterErrorV0("source_verdict_mismatch")
    }
    return "history_sensitive"
  }

  if (
    aggregate.stable === EXPECTED_TRAVERSAL_V1_EVALUATIONS &&
    result.verdict === "stable"
  ) {
    return "stable"
  }

  throw new TransformationStabilityLaneKV1AdapterErrorV0("source_verdict_mismatch")
}

function deriveSemanticAggregateClass(
  result: TraversalStabilityResultV1,
): LaneKV1SemanticAggregateClassV0 {
  const aggregate = result.aggregate
  if (aggregate.semantic_execution_unresolved > 0) return "execution_unresolved"
  if (aggregate.semantic_nonconformant > 0) return "contains_nonconformant"
  if (aggregate.semantic_conformant === EXPECTED_TRAVERSAL_V1_EVALUATIONS) {
    return "all_conformant"
  }
  throw new TransformationStabilityLaneKV1AdapterErrorV0("source_semantic_partition_mismatch")
}

/**
 * Pure adapter over one authenticated Lane K v1 result.
 *
 * It makes NO `violation` / normative-preservation claim. It preserves the
 * existing Lane K distinction between semantic conformance and schedule
 * stability.
 */
export function adaptCounterfactualTraversalStabilityV1(
  result: TraversalStabilityResultV1,
): TransformationStabilityLaneKV1AdapterResultV0 {
  assertLaneKResultIdentity(result)
  assertLaneKClosedShape(result)

  return {
    schema: TRANSFORMATION_STABILITY_LANE_K_V1_ADAPTER_SCHEMA_V0,
    adapter_id: TRANSFORMATION_STABILITY_LANE_K_V1_ADAPTER_ID_V0,
    transformation_claim: TRANSFORMATION_STABILITY_LANE_K_V1_CLAIM_V0,
    source_profile_id: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1,
    source_profile_version: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION_V1,
    source_schedule_set_id: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID_V1,
    source_schedule_set_sha256: result.schedule_set_sha256,
    dcn_sha256: result.dcn_sha256,
    reset_model: result.reset_model,
    evaluation_state: result.evaluation_state,
    classification: deriveClassification(result),
    semantic_aggregate_class: deriveSemanticAggregateClass(result),
    schedule_count: EXPECTED_TRAVERSAL_V1_SCHEDULE_COUNT,
    member_count: 10,
    scheduled_member_evaluations: EXPECTED_TRAVERSAL_V1_EVALUATIONS,
    stable: result.aggregate.stable,
    history_sensitive: result.aggregate.history_sensitive,
    unresolved: result.aggregate.unresolved,
    semantic_conformant: result.aggregate.semantic_conformant,
    semantic_nonconformant: result.aggregate.semantic_nonconformant,
    semantic_execution_unresolved: result.aggregate.semantic_execution_unresolved,
    first_position_covered: 10,
    first_position_missing: Object.freeze([]) as readonly [],
  }
}

/**
 * Execute existing Lane K v1 authority, then expose a deterministic adapter
 * result plus the original non-normative telemetry out-of-band.
 */
export async function verifyTransformationStabilityLaneKV1(options?: {
  readonly repositoryRoot?: string
  readonly workerScriptPath?: string
  readonly timeoutMs?: number
}): Promise<{
  readonly result: TransformationStabilityLaneKV1AdapterResultV0
  readonly telemetry: TraversalStabilityRunTelemetryV1
}> {
  const laneK = await verifyCounterfactualTraversalStabilityV1(options)
  return {
    result: adaptCounterfactualTraversalStabilityV1(laneK.result),
    telemetry: laneK.telemetry,
  }
}
