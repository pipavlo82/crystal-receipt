/**
 * Aggregate counterfactual neighborhood conformance evaluation v0 (Lane H).
 *
 * Authenticates the pinned Lane B neighborhood, binds complete one-to-one
 * materialized member requests, authenticates every expected via Lane G, then
 * evaluates members through the correct Lane E path:
 * - ordinary members → evaluateVerifierChallengeConformance
 * - V-MAN-HASH-DIFF → evaluateCabManifestHashDiffConformance
 *
 * Unresolved member execution never collapses into aggregate
 * conformant/nonconformant. Inventory/identity failures are pre-execution
 * contract errors and never become semantic nonconformance.
 */

import {
  COUNTERFACTUAL_NEIGHBORHOOD_SCHEMA,
  canonicalIdentityJson,
  computeFrozenCounterfactualNeighborhoodSha256,
  type CounterfactualChallengeIdentityV0,
  type FrozenCounterfactualNeighborhoodV0,
} from "./counterfactual-neighborhood"
import {
  ExpectedResultSetBindingError,
  bindExpectedResultSet,
} from "./counterfactual-expected-result-set"
import {
  evaluateVerifierChallengeConformance,
  type ConformanceMismatchKindV0,
  type CounterfactualConformanceEvaluationV0,
} from "./counterfactual-conformance-evaluator"
import {
  CAB_MANIFEST_HASH_DIFF_EVALUATION_REQUEST_SCHEMA,
  evaluateCabManifestHashDiffConformance,
  type CabManifestHashDiffEvaluationRequestV0,
  type CabManifestHashDiffEvaluationResultV0,
} from "./counterfactual-cab-manifest-hash-diff-evaluator"
import type { ChallengeSurfaceKind } from "./verifier-challenge-model"
import {
  COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
  type ExecutionFailureStageV0,
  type VerifierChallengeRunRequestV0,
} from "./counterfactual-verifier-runner"
import type { AuthenticatedScheduleOrderV0 } from "./counterfactual-traversal-schedules"
import type { CounterfactualObservationV0 } from "./counterfactual-result-normalization"
import type { SubjectContractRejectionV0 } from "./counterfactual-verifier-runner"

export const PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0 =
  "37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d" as const

export const COUNTERFACTUAL_NEIGHBORHOOD_CONFORMANCE_REQUEST_SCHEMA =
  "receiptos.counterfactual_neighborhood_conformance_request.v0" as const

export const COUNTERFACTUAL_NEIGHBORHOOD_CONFORMANCE_EVALUATION_SCHEMA =
  "receiptos.counterfactual_neighborhood_conformance_evaluation.v0" as const

export const COUNTERFACTUAL_NEIGHBORHOOD_MEMBER_CARRIER_SCHEMA =
  "receiptos.counterfactual_neighborhood_member_carrier.v0" as const

/** Exact frozen Lane B inventory (declared neighborhood order). */
export const PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0 = Object.freeze([
  Object.freeze({
    package_version: "verifier-challenge-observed-not-validated-v0",
    vector_id: "V-OBSERVED-NOT-VALIDATED",
    surface: "verify_handoff_receipt_root" as const,
    route: "single_vector" as const,
  }),
  Object.freeze({
    package_version: "verifier-challenge-missing-required-input-unverifiable-v0",
    vector_id: "V-MISSING-REQUIRED-INPUT",
    surface: "verify_handoff_receipt_root" as const,
    route: "single_vector" as const,
  }),
  Object.freeze({
    package_version: "verifier-challenge-integrity-mismatch-rejected-v0",
    vector_id: "V-INTEGRITY-MISMATCH",
    surface: "verify_handoff_receipt_root" as const,
    route: "single_vector" as const,
  }),
  Object.freeze({
    package_version: "verifier-challenge-chronicle-proof-root-mismatch-rejected-v0",
    vector_id: "V-CHRONICLE-PROOF-ROOT-MISMATCH",
    surface: "chronicle_admission" as const,
    route: "single_vector" as const,
  }),
  Object.freeze({
    package_version: "verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0",
    vector_id: "V-CHRONICLE-PREDECESSOR-UNKNOWN",
    surface: "chronicle_continuity" as const,
    route: "single_vector" as const,
  }),
  Object.freeze({
    package_version: "verifier-challenge-chronicle-sequence-gap-rejected-v0",
    vector_id: "V-CHRONICLE-SEQUENCE-GAP",
    surface: "chronicle_continuity" as const,
    route: "single_vector" as const,
  }),
  Object.freeze({
    package_version: "verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0",
    vector_id: "V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH",
    surface: "chronicle_checkpoint_local" as const,
    route: "single_vector" as const,
  }),
  Object.freeze({
    package_version: "verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0",
    vector_id: "V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL",
    surface: "chronicle_checkpoint_local" as const,
    route: "single_vector" as const,
  }),
  Object.freeze({
    package_version: "counterfactual-audit-boundary-v0",
    vector_id: "V-AT-NEST-OBJ",
    surface: "counterfactual_audit_boundary" as const,
    route: "single_vector" as const,
  }),
  Object.freeze({
    package_version: "counterfactual-audit-boundary-v0",
    vector_id: "V-MAN-HASH-DIFF",
    surface: "counterfactual_audit_boundary" as const,
    route: "cab_manifest_hash_diff" as const,
  }),
] as const)

export type NeighborhoodMemberRouteV0 = "single_vector" | "cab_manifest_hash_diff"

export type OrdinaryNeighborhoodMemberCarrierV0 = {
  readonly schema: typeof COUNTERFACTUAL_NEIGHBORHOOD_MEMBER_CARRIER_SCHEMA
  readonly route: "single_vector"
  readonly request: VerifierChallengeRunRequestV0
}

export type CabManifestDiffNeighborhoodMemberCarrierV0 = {
  readonly schema: typeof COUNTERFACTUAL_NEIGHBORHOOD_MEMBER_CARRIER_SCHEMA
  readonly route: "cab_manifest_hash_diff"
  readonly request: CabManifestHashDiffEvaluationRequestV0
}

export type NeighborhoodMemberCarrierV0 =
  | OrdinaryNeighborhoodMemberCarrierV0
  | CabManifestDiffNeighborhoodMemberCarrierV0

export type CounterfactualNeighborhoodConformanceRequestV0 = {
  readonly schema: typeof COUNTERFACTUAL_NEIGHBORHOOD_CONFORMANCE_REQUEST_SCHEMA
  readonly neighborhood: FrozenCounterfactualNeighborhoodV0
  readonly members: readonly NeighborhoodMemberCarrierV0[]
}

export type NeighborhoodMemberSummaryV0 = {
  readonly vector_id: string
  readonly package_version: string
  readonly surface: ChallengeSurfaceKind
  readonly route: NeighborhoodMemberRouteV0
  readonly evaluation_state: "evaluated" | "execution_unresolved"
  readonly verdict: "conformant" | "nonconformant" | null
  readonly mismatch_kind: ConformanceMismatchKindV0 | null
  readonly failure_stage: ExecutionFailureStageV0 | null
}

type AggregateCountsV0 = {
  readonly total_member_count: number
  readonly conformant_count: number
  readonly nonconformant_count: number
  readonly unresolved_count: number
}

export type EvaluatedNeighborhoodConformanceV0 = {
  readonly schema: typeof COUNTERFACTUAL_NEIGHBORHOOD_CONFORMANCE_EVALUATION_SCHEMA
  readonly evaluation_state: "evaluated"
  readonly verdict: "conformant" | "nonconformant"
  readonly neighborhood_sha256: string
  readonly counts: AggregateCountsV0
  readonly members: readonly NeighborhoodMemberSummaryV0[]
}

export type UnresolvedNeighborhoodConformanceV0 = {
  readonly schema: typeof COUNTERFACTUAL_NEIGHBORHOOD_CONFORMANCE_EVALUATION_SCHEMA
  readonly evaluation_state: "execution_unresolved"
  readonly verdict: null
  readonly neighborhood_sha256: string
  readonly counts: AggregateCountsV0
  readonly members: readonly NeighborhoodMemberSummaryV0[]
}

export type CounterfactualNeighborhoodConformanceEvaluationV0 =
  | EvaluatedNeighborhoodConformanceV0
  | UnresolvedNeighborhoodConformanceV0

export type NeighborhoodConformanceContractReasonV0 =
  | "unsupported_schema"
  | "unsupported_neighborhood_schema"
  | "neighborhood_digest_mismatch"
  | "neighborhood_inventory_mismatch"
  | "neighborhood_member_duplicate"
  | "request_count_mismatch"
  | "request_missing"
  | "request_duplicate"
  | "request_extra"
  | "challenge_identity_mismatch"
  | "unsupported_member_route"
  | "wrong_composite_schema"
  | "malformed_manifest_difference_carrier"
  | "missing_lane_a_model"
  | "subject_identity_mismatch"

export class NeighborhoodConformanceContractError extends Error {
  readonly code = "neighborhood_conformance_contract_error" as const
  readonly reason: NeighborhoodConformanceContractReasonV0

  constructor(reason: NeighborhoodConformanceContractReasonV0) {
    super("neighborhood conformance contract failed")
    this.name = "NeighborhoodConformanceContractError"
    this.reason = reason
  }
}

type BoundMemberV0 = {
  readonly index: number
  readonly identity: CounterfactualChallengeIdentityV0
  readonly route: NeighborhoodMemberRouteV0
  readonly carrier: NeighborhoodMemberCarrierV0
}

function cloneJson<T>(value: T): T {
  return structuredClone(value)
}

function memberKey(identity: CounterfactualChallengeIdentityV0): string {
  return canonicalIdentityJson(identity)
}

function expectedRouteFor(identity: CounterfactualChallengeIdentityV0): NeighborhoodMemberRouteV0 {
  if (
    identity.package_version === "counterfactual-audit-boundary-v0" &&
    identity.vector_id === "V-MAN-HASH-DIFF"
  ) {
    return "cab_manifest_hash_diff"
  }
  return "single_vector"
}

function assertPinnedInventory(neighborhood: FrozenCounterfactualNeighborhoodV0): void {
  if (neighborhood.members.length !== PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0.length) {
    throw new NeighborhoodConformanceContractError("neighborhood_inventory_mismatch")
  }
  for (let i = 0; i < PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0.length; i += 1) {
    const expected = PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0[i]!
    const actual = neighborhood.members[i]!
    if (
      actual.package_version !== expected.package_version ||
      actual.vector_id !== expected.vector_id ||
      actual.surface !== expected.surface ||
      expectedRouteFor(actual) !== expected.route
    ) {
      throw new NeighborhoodConformanceContractError("neighborhood_inventory_mismatch")
    }
  }
}

function validateOrdinaryCarrier(
  carrier: OrdinaryNeighborhoodMemberCarrierV0,
  identity: CounterfactualChallengeIdentityV0,
): void {
  const request = carrier.request
  if (request.schema !== COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA) {
    throw new NeighborhoodConformanceContractError("unsupported_member_route")
  }
  if (request.surface !== identity.surface) {
    throw new NeighborhoodConformanceContractError("challenge_identity_mismatch")
  }
  if (canonicalIdentityJson(request.challenge) !== memberKey(identity)) {
    throw new NeighborhoodConformanceContractError("challenge_identity_mismatch")
  }
  if (!("lane_a_model" in request) || request.lane_a_model === undefined) {
    throw new NeighborhoodConformanceContractError("missing_lane_a_model")
  }
  if (identity.surface === "counterfactual_audit_boundary") {
    if (request.subject !== null || identity.subject !== null) {
      throw new NeighborhoodConformanceContractError("subject_identity_mismatch")
    }
    if (!("operation" in request) || request.operation !== "semantic_snapshot") {
      throw new NeighborhoodConformanceContractError("unsupported_member_route")
    }
  } else {
    if (request.subject === null || identity.subject === null) {
      throw new NeighborhoodConformanceContractError("subject_identity_mismatch")
    }
    if (canonicalIdentityJson(request.subject) !== canonicalIdentityJson(identity.subject)) {
      throw new NeighborhoodConformanceContractError("subject_identity_mismatch")
    }
  }
}

function validateCompositeCarrier(
  carrier: CabManifestDiffNeighborhoodMemberCarrierV0,
  identity: CounterfactualChallengeIdentityV0,
): void {
  const request = carrier.request
  if (request.schema !== CAB_MANIFEST_HASH_DIFF_EVALUATION_REQUEST_SCHEMA) {
    throw new NeighborhoodConformanceContractError("wrong_composite_schema")
  }
  if (
    request.surface !== "counterfactual_audit_boundary" ||
    request.evaluation_operation !== "manifest_hash_differs"
  ) {
    throw new NeighborhoodConformanceContractError("malformed_manifest_difference_carrier")
  }
  if (canonicalIdentityJson(request.challenge) !== memberKey(identity)) {
    throw new NeighborhoodConformanceContractError("challenge_identity_mismatch")
  }
  if (request.lane_a_model === undefined || request.lane_a_model === null) {
    throw new NeighborhoodConformanceContractError("missing_lane_a_model")
  }
  const operands = request.operands
  if (operands === null || typeof operands !== "object" || Array.isArray(operands)) {
    throw new NeighborhoodConformanceContractError("malformed_manifest_difference_carrier")
  }
  const keys = Object.keys(operands as object).sort()
  if (keys.length !== 2 || keys[0] !== "first" || keys[1] !== "second") {
    throw new NeighborhoodConformanceContractError("malformed_manifest_difference_carrier")
  }
  const first = (operands as { first?: { bytes?: unknown } }).first
  const second = (operands as { second?: { bytes?: unknown } }).second
  if (first === undefined || second === undefined) {
    throw new NeighborhoodConformanceContractError("malformed_manifest_difference_carrier")
  }
  if (!("bytes" in first) || !("bytes" in second)) {
    throw new NeighborhoodConformanceContractError("malformed_manifest_difference_carrier")
  }
  const firstBytes = first.bytes
  const secondBytes = second.bytes
  if (
    !(typeof firstBytes === "string" || firstBytes instanceof Uint8Array) ||
    !(typeof secondBytes === "string" || secondBytes instanceof Uint8Array)
  ) {
    throw new NeighborhoodConformanceContractError("malformed_manifest_difference_carrier")
  }
  if (identity.vector_id !== "V-MAN-HASH-DIFF") {
    throw new NeighborhoodConformanceContractError("unsupported_member_route")
  }
}

function extractChallenge(carrier: NeighborhoodMemberCarrierV0): CounterfactualChallengeIdentityV0 {
  return carrier.request.challenge
}

function extractModel(carrier: NeighborhoodMemberCarrierV0) {
  if (carrier.route === "cab_manifest_hash_diff") {
    return carrier.request.lane_a_model
  }
  if (!("lane_a_model" in carrier.request) || carrier.request.lane_a_model === undefined) {
    throw new NeighborhoodConformanceContractError("missing_lane_a_model")
  }
  return carrier.request.lane_a_model
}

function validateCarrierShape(carrier: unknown): NeighborhoodMemberCarrierV0 {
  if (carrier === null || typeof carrier !== "object" || Array.isArray(carrier)) {
    throw new NeighborhoodConformanceContractError("unsupported_member_route")
  }
  const object = carrier as Record<string, unknown>
  if (object.schema !== COUNTERFACTUAL_NEIGHBORHOOD_MEMBER_CARRIER_SCHEMA) {
    throw new NeighborhoodConformanceContractError("unsupported_member_route")
  }
  if (object.route === "single_vector") {
    if (object.request === null || typeof object.request !== "object" || Array.isArray(object.request)) {
      throw new NeighborhoodConformanceContractError("unsupported_member_route")
    }
    return carrier as OrdinaryNeighborhoodMemberCarrierV0
  }
  if (object.route === "cab_manifest_hash_diff") {
    if (object.request === null || typeof object.request !== "object" || Array.isArray(object.request)) {
      throw new NeighborhoodConformanceContractError("wrong_composite_schema")
    }
    return carrier as CabManifestDiffNeighborhoodMemberCarrierV0
  }
  throw new NeighborhoodConformanceContractError("unsupported_member_route")
}

/**
 * Complete preflight: schema, neighborhood digest, inventory, 1:1 request
 * membership, route selection, subject identity, and Lane G binding for every
 * member. Does not execute any Lane D/E evaluator.
 */
function preflightAggregate(
  request: unknown,
): {
  readonly neighborhood: FrozenCounterfactualNeighborhoodV0
  readonly neighborhoodSha256: string
  readonly boundMembers: readonly BoundMemberV0[]
} {
  if (request === null || typeof request !== "object" || Array.isArray(request)) {
    throw new NeighborhoodConformanceContractError("unsupported_schema")
  }
  const object = request as Record<string, unknown>
  if (object.schema !== COUNTERFACTUAL_NEIGHBORHOOD_CONFORMANCE_REQUEST_SCHEMA) {
    throw new NeighborhoodConformanceContractError("unsupported_schema")
  }
  if (
    object.neighborhood === null ||
    typeof object.neighborhood !== "object" ||
    Array.isArray(object.neighborhood)
  ) {
    throw new NeighborhoodConformanceContractError("unsupported_neighborhood_schema")
  }
  const neighborhood = object.neighborhood as FrozenCounterfactualNeighborhoodV0
  if (neighborhood.schema !== COUNTERFACTUAL_NEIGHBORHOOD_SCHEMA || neighborhood.version !== "v0") {
    throw new NeighborhoodConformanceContractError("unsupported_neighborhood_schema")
  }
  if (!Array.isArray(neighborhood.members)) {
    throw new NeighborhoodConformanceContractError("unsupported_neighborhood_schema")
  }

  const seenIdentity = new Set<string>()
  for (const member of neighborhood.members) {
    const key = memberKey(member)
    if (seenIdentity.has(key)) {
      throw new NeighborhoodConformanceContractError("neighborhood_member_duplicate")
    }
    seenIdentity.add(key)
  }

  assertPinnedInventory(neighborhood)

  let neighborhoodSha256: string
  try {
    neighborhoodSha256 = computeFrozenCounterfactualNeighborhoodSha256(neighborhood)
  } catch {
    throw new NeighborhoodConformanceContractError("unsupported_neighborhood_schema")
  }
  if (neighborhoodSha256 !== PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0) {
    throw new NeighborhoodConformanceContractError("neighborhood_digest_mismatch")
  }

  if (!Array.isArray(object.members)) {
    throw new NeighborhoodConformanceContractError("request_count_mismatch")
  }
  if (object.members.length !== neighborhood.members.length) {
    if (object.members.length < neighborhood.members.length) {
      throw new NeighborhoodConformanceContractError("request_missing")
    }
    if (object.members.length > neighborhood.members.length) {
      throw new NeighborhoodConformanceContractError("request_extra")
    }
    throw new NeighborhoodConformanceContractError("request_count_mismatch")
  }

  const carriers = object.members.map((entry) => validateCarrierShape(entry))
  const unused = new Set(carriers.map((_, index) => index))
  const boundMembers: BoundMemberV0[] = []

  for (let i = 0; i < neighborhood.members.length; i += 1) {
    const identity = neighborhood.members[i]!
    const identityCanonical = memberKey(identity)
    const expectedRoute = expectedRouteFor(identity)
    const matches: number[] = []
    for (const index of unused) {
      const carrier = carriers[index]!
      if (memberKey(extractChallenge(carrier)) === identityCanonical) {
        matches.push(index)
      }
    }
    if (matches.length === 0) {
      throw new NeighborhoodConformanceContractError("request_missing")
    }
    if (matches.length > 1) {
      throw new NeighborhoodConformanceContractError("request_duplicate")
    }
    const matchIndex = matches[0]!
    unused.delete(matchIndex)
    const carrier = carriers[matchIndex]!
    if (carrier.route !== expectedRoute) {
      throw new NeighborhoodConformanceContractError("unsupported_member_route")
    }
    if (carrier.route === "single_vector") {
      validateOrdinaryCarrier(carrier, identity)
    } else {
      validateCompositeCarrier(carrier, identity)
    }
    boundMembers.push({
      index: i,
      identity,
      route: expectedRoute,
      carrier,
    })
  }

  if (unused.size !== 0) {
    throw new NeighborhoodConformanceContractError("request_extra")
  }

  // Lane G for every member before any evaluation.
  for (const bound of boundMembers) {
    try {
      bindExpectedResultSet(extractModel(bound.carrier))
    } catch (error) {
      if (error instanceof ExpectedResultSetBindingError) throw error
      throw error
    }
  }

  return { neighborhood, neighborhoodSha256, boundMembers }
}

function summarizeMember(
  bound: BoundMemberV0,
  evaluation: CounterfactualConformanceEvaluationV0 | CabManifestHashDiffEvaluationResultV0,
): NeighborhoodMemberSummaryV0 {
  if (evaluation.evaluation_state === "execution_unresolved") {
    return {
      vector_id: bound.identity.vector_id,
      package_version: bound.identity.package_version,
      surface: bound.identity.surface,
      route: bound.route,
      evaluation_state: "execution_unresolved",
      verdict: null,
      mismatch_kind: null,
      failure_stage: evaluation.execution_failure.failure_stage,
    }
  }
  return {
    vector_id: bound.identity.vector_id,
    package_version: bound.identity.package_version,
    surface: bound.identity.surface,
    route: bound.route,
    evaluation_state: "evaluated",
    verdict: evaluation.verdict,
    mismatch_kind: evaluation.mismatch === null ? null : evaluation.mismatch.kind,
    failure_stage: null,
  }
}

async function evaluateBoundMember(
  bound: BoundMemberV0,
): Promise<CounterfactualConformanceEvaluationV0 | CabManifestHashDiffEvaluationResultV0> {
  if (bound.route === "cab_manifest_hash_diff") {
    const carrier = bound.carrier as CabManifestDiffNeighborhoodMemberCarrierV0
    return evaluateCabManifestHashDiffConformance(carrier.request)
  }
  const carrier = bound.carrier as OrdinaryNeighborhoodMemberCarrierV0
  return evaluateVerifierChallengeConformance(carrier.request)
}

export const SCHEDULED_MEMBER_OBSERVATION_SCHEMA =
  "receiptos.counterfactual_traversal_member_observation.v0" as const

export const SCHEDULED_NEIGHBORHOOD_OBSERVATION_BUNDLE_SCHEMA =
  "receiptos.counterfactual_traversal_schedule_observation_bundle.v0" as const

export type ScheduledMemberObservationV0 = {
  readonly schema: typeof SCHEDULED_MEMBER_OBSERVATION_SCHEMA
  readonly vector_id: string
  readonly package_version: string
  readonly surface: ChallengeSurfaceKind
  readonly route: NeighborhoodMemberRouteV0
  readonly execution_state: "evaluated" | "execution_unresolved"
  readonly verdict: "conformant" | "nonconformant" | null
  readonly normative_expected: CounterfactualObservationV0 | null
  readonly scheduled_observed: CounterfactualObservationV0 | null
  readonly subject_contract_rejection: SubjectContractRejectionV0 | null
  readonly mismatch_kind: ConformanceMismatchKindV0 | null
  readonly failure_stage: ExecutionFailureStageV0 | null
}

export type ScheduledNeighborhoodObservationBundleV0 = {
  readonly schema: typeof SCHEDULED_NEIGHBORHOOD_OBSERVATION_BUNDLE_SCHEMA
  readonly schedule_id: string
  readonly ordered_vector_ids_sha256: string
  readonly neighborhood_sha256: string
  readonly reset_model: "fresh_process_per_schedule_shared_process_within_schedule"
  /** Members serialized in canonical DCN order, never traversal order. */
  readonly members: readonly ScheduledMemberObservationV0[]
  /** Execution order actually used (schedule order); diagnostic for workers only. */
  readonly execution_vector_ids: readonly string[]
}

function observationFromEvaluation(
  bound: BoundMemberV0,
  evaluation: CounterfactualConformanceEvaluationV0 | CabManifestHashDiffEvaluationResultV0,
): ScheduledMemberObservationV0 {
  if (evaluation.evaluation_state === "execution_unresolved") {
    return {
      schema: SCHEDULED_MEMBER_OBSERVATION_SCHEMA,
      vector_id: bound.identity.vector_id,
      package_version: bound.identity.package_version,
      surface: bound.identity.surface,
      route: bound.route,
      execution_state: "execution_unresolved",
      verdict: null,
      normative_expected: null,
      scheduled_observed: null,
      subject_contract_rejection: null,
      mismatch_kind: null,
      failure_stage: evaluation.execution_failure.failure_stage,
    }
  }
  const evaluated = evaluation
  return {
    schema: SCHEDULED_MEMBER_OBSERVATION_SCHEMA,
    vector_id: bound.identity.vector_id,
    package_version: bound.identity.package_version,
    surface: bound.identity.surface,
    route: bound.route,
    execution_state: "evaluated",
    verdict: evaluated.verdict,
    normative_expected: cloneJson(evaluated.expected_observation),
    scheduled_observed:
      evaluated.actual_observation === null ? null : cloneJson(evaluated.actual_observation),
    subject_contract_rejection:
      evaluated.subject_contract_rejection === null
        ? null
        : cloneJson(evaluated.subject_contract_rejection),
    mismatch_kind: evaluated.mismatch === null ? null : evaluated.mismatch.kind,
    failure_stage: null,
  }
}

function orderBoundMembersForSchedule(
  boundMembers: readonly BoundMemberV0[],
  authenticatedSchedule: AuthenticatedScheduleOrderV0,
): BoundMemberV0[] {
  const byVectorId = new Map<string, BoundMemberV0>()
  for (const bound of boundMembers) {
    byVectorId.set(bound.identity.vector_id, bound)
  }
  const ordered: BoundMemberV0[] = []
  for (const vectorId of authenticatedSchedule.ordered_vector_ids) {
    const bound = byVectorId.get(vectorId)
    if (!bound) {
      throw new NeighborhoodConformanceContractError("request_missing")
    }
    ordered.push(bound)
  }
  if (ordered.length !== boundMembers.length) {
    throw new NeighborhoodConformanceContractError("request_count_mismatch")
  }
  return ordered
}

/**
 * Aggregate neighborhood conformance evaluation.
 * Completes full preflight before any member execution.
 * Always executes in canonical DCN order after identity rematch.
 */
export async function evaluateCounterfactualNeighborhoodConformance(
  request: CounterfactualNeighborhoodConformanceRequestV0,
): Promise<CounterfactualNeighborhoodConformanceEvaluationV0> {
  const { neighborhoodSha256, boundMembers } = preflightAggregate(request)

  const summaries: NeighborhoodMemberSummaryV0[] = []
  for (const bound of boundMembers) {
    const evaluation = await evaluateBoundMember(bound)
    summaries.push(summarizeMember(bound, evaluation))
  }

  let conformant_count = 0
  let nonconformant_count = 0
  let unresolved_count = 0
  for (const summary of summaries) {
    if (summary.evaluation_state === "execution_unresolved") {
      unresolved_count += 1
    } else if (summary.verdict === "conformant") {
      conformant_count += 1
    } else if (summary.verdict === "nonconformant") {
      nonconformant_count += 1
    }
  }

  const counts: AggregateCountsV0 = {
    total_member_count: summaries.length,
    conformant_count,
    nonconformant_count,
    unresolved_count,
  }

  if (unresolved_count > 0) {
    return {
      schema: COUNTERFACTUAL_NEIGHBORHOOD_CONFORMANCE_EVALUATION_SCHEMA,
      evaluation_state: "execution_unresolved",
      verdict: null,
      neighborhood_sha256: neighborhoodSha256,
      counts,
      members: summaries.map((entry) => cloneJson(entry)),
    }
  }

  const verdict = nonconformant_count === 0 ? "conformant" : "nonconformant"
  return {
    schema: COUNTERFACTUAL_NEIGHBORHOOD_CONFORMANCE_EVALUATION_SCHEMA,
    evaluation_state: "evaluated",
    verdict,
    neighborhood_sha256: neighborhoodSha256,
    counts,
    members: summaries.map((entry) => cloneJson(entry)),
  }
}

/**
 * Package-internal Lane K seam: full Lane H/G preflight, then sequential
 * evaluation in an authenticated frozen schedule order.
 *
 * Not a public caller-controlled execution-order API. Only accepts
 * AuthenticatedScheduleOrderV0 produced by authenticateFrozenTraversalSchedule.
 * Member results are always serialized in canonical DCN order.
 */
export async function evaluateCounterfactualNeighborhoodUnderAuthenticatedSchedule(
  request: CounterfactualNeighborhoodConformanceRequestV0,
  authenticatedSchedule: AuthenticatedScheduleOrderV0,
): Promise<ScheduledNeighborhoodObservationBundleV0> {
  if (authenticatedSchedule.__brand !== "AuthenticatedScheduleOrderV0") {
    throw new NeighborhoodConformanceContractError("unsupported_member_route")
  }
  if (
    authenticatedSchedule.reset_model !==
    "fresh_process_per_schedule_shared_process_within_schedule"
  ) {
    throw new NeighborhoodConformanceContractError("unsupported_schema")
  }

  const { neighborhoodSha256, boundMembers } = preflightAggregate(request)
  const executionOrder = orderBoundMembersForSchedule(boundMembers, authenticatedSchedule)

  const byVectorId = new Map<string, ScheduledMemberObservationV0>()
  for (const bound of executionOrder) {
    const evaluation = await evaluateBoundMember(bound)
    byVectorId.set(bound.identity.vector_id, observationFromEvaluation(bound, evaluation))
  }

  const members: ScheduledMemberObservationV0[] = []
  for (const bound of boundMembers) {
    const observation = byVectorId.get(bound.identity.vector_id)
    if (!observation) {
      throw new NeighborhoodConformanceContractError("request_missing")
    }
    members.push(cloneJson(observation))
  }

  return {
    schema: SCHEDULED_NEIGHBORHOOD_OBSERVATION_BUNDLE_SCHEMA,
    schedule_id: authenticatedSchedule.schedule_id,
    ordered_vector_ids_sha256: authenticatedSchedule.ordered_vector_ids_sha256,
    neighborhood_sha256: neighborhoodSha256,
    reset_model: "fresh_process_per_schedule_shared_process_within_schedule",
    members,
    execution_vector_ids: authenticatedSchedule.ordered_vector_ids.map((id) => id),
  }
}

export { ExpectedResultSetBindingError }
