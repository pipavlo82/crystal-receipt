/**
 * Pure Lane K comparison core (injectable for adversarial tests).
 *
 * Keeps semantic and schedule-stability axes independent. Does not execute
 * subjects and does not import process/spawn APIs.
 */

import { canonicalIdentityJson } from "./counterfactual-neighborhood"
import type { CounterfactualObservationV0 } from "./counterfactual-result-normalization"
import type { SubjectContractRejectionV0 } from "./counterfactual-verifier-runner"

export type ScheduleStabilityClassV0 = "stable" | "history_sensitive" | "unresolved"

export type SemanticAxisV0 = "conformant" | "nonconformant" | "execution_unresolved"

export type StabilityAxisV0 = "stable" | "history_sensitive" | "execution_unresolved"

export type ComparableMemberObservationV0 = {
  readonly vector_id: string
  readonly execution_state: "evaluated" | "execution_unresolved"
  readonly verdict: "conformant" | "nonconformant" | null
  readonly normative_expected: CounterfactualObservationV0 | null
  readonly observed: CounterfactualObservationV0 | null
  readonly subject_contract_rejection: SubjectContractRejectionV0 | null
  readonly mismatch_kind: string | null
  readonly failure_stage: string | null
}

export type MemberStabilityComparisonV0 = {
  readonly schedule_id: string
  readonly vector_id: string
  readonly execution_state: "evaluated" | "execution_unresolved"
  readonly normative_expected: CounterfactualObservationV0 | null
  readonly canonical_observed: CounterfactualObservationV0 | null
  readonly scheduled_observed: CounterfactualObservationV0 | null
  readonly semantic_match: true | false | null
  readonly canonical_match: true | false | null
  readonly schedule_stability: ScheduleStabilityClassV0
  readonly semantic_axis: SemanticAxisV0
  readonly stability_axis: StabilityAxisV0
  readonly failure_stage: string | null
  readonly mismatch_kind: string | null
}

function comparablePayload(member: ComparableMemberObservationV0): unknown {
  return {
    vector_id: member.vector_id,
    execution_state: member.execution_state,
    verdict: member.verdict,
    normative_expected: member.normative_expected,
    observed: member.observed,
    subject_contract_rejection: member.subject_contract_rejection,
    mismatch_kind: member.mismatch_kind,
    failure_stage: member.failure_stage,
  }
}

export function memberObservationsEqual(
  left: ComparableMemberObservationV0,
  right: ComparableMemberObservationV0,
): boolean {
  return canonicalIdentityJson(comparablePayload(left)) === canonicalIdentityJson(comparablePayload(right))
}

/**
 * Precedence:
 * 1. unresolved → null matches, schedule_stability unresolved
 * 2. both resolve but differ → history_sensitive
 * 3. scheduled vs normative → semantic axis independent
 */
export function compareMemberScheduleStability(input: {
  readonly schedule_id: string
  readonly canonical: ComparableMemberObservationV0
  readonly scheduled: ComparableMemberObservationV0
}): MemberStabilityComparisonV0 {
  const { schedule_id, canonical, scheduled } = input
  if (canonical.vector_id !== scheduled.vector_id) {
    throw new Error("vector_id_mismatch")
  }

  const unresolved =
    canonical.execution_state === "execution_unresolved" ||
    scheduled.execution_state === "execution_unresolved"

  if (unresolved) {
    const semanticResolved =
      scheduled.execution_state === "evaluated" ? scheduled.verdict === "conformant" : null
    return {
      schedule_id,
      vector_id: scheduled.vector_id,
      execution_state: "execution_unresolved",
      normative_expected: scheduled.normative_expected ?? canonical.normative_expected,
      canonical_observed: canonical.observed,
      scheduled_observed: scheduled.observed,
      semantic_match: semanticResolved,
      canonical_match: null,
      schedule_stability: "unresolved",
      semantic_axis:
        scheduled.execution_state === "execution_unresolved"
          ? "execution_unresolved"
          : scheduled.verdict === "conformant"
            ? "conformant"
            : "nonconformant",
      stability_axis: "execution_unresolved",
      failure_stage: scheduled.failure_stage ?? canonical.failure_stage,
      mismatch_kind: scheduled.mismatch_kind,
    }
  }

  const canonical_match = memberObservationsEqual(canonical, scheduled)
  const schedule_stability: ScheduleStabilityClassV0 = canonical_match ? "stable" : "history_sensitive"
  const semantic_match = scheduled.verdict === "conformant"
  const semantic_axis: SemanticAxisV0 = semantic_match ? "conformant" : "nonconformant"

  return {
    schedule_id,
    vector_id: scheduled.vector_id,
    execution_state: "evaluated",
    normative_expected: scheduled.normative_expected,
    canonical_observed: canonical.observed,
    scheduled_observed: scheduled.observed,
    semantic_match,
    canonical_match,
    schedule_stability,
    semantic_axis,
    stability_axis: schedule_stability === "stable" ? "stable" : "history_sensitive",
    failure_stage: null,
    mismatch_kind: scheduled.mismatch_kind,
  }
}

export type TraversalStabilityAggregateV0 = {
  readonly schedule_count: number
  readonly member_count: number
  readonly scheduled_member_evaluations: number
  readonly stable: number
  readonly history_sensitive: number
  readonly unresolved: number
  readonly semantic_conformant: number
  readonly semantic_nonconformant: number
  readonly semantic_execution_unresolved: number
}

export function aggregateTraversalStability(
  comparisons: readonly MemberStabilityComparisonV0[],
  scheduleCount: number,
  memberCount: number,
): TraversalStabilityAggregateV0 {
  let stable = 0
  let history_sensitive = 0
  let unresolved = 0
  let semantic_conformant = 0
  let semantic_nonconformant = 0
  let semantic_execution_unresolved = 0
  for (const entry of comparisons) {
    if (entry.schedule_stability === "stable") stable += 1
    else if (entry.schedule_stability === "history_sensitive") history_sensitive += 1
    else unresolved += 1
    if (entry.semantic_axis === "conformant") semantic_conformant += 1
    else if (entry.semantic_axis === "nonconformant") semantic_nonconformant += 1
    else semantic_execution_unresolved += 1
  }
  return {
    schedule_count: scheduleCount,
    member_count: memberCount,
    scheduled_member_evaluations: comparisons.length,
    stable,
    history_sensitive,
    unresolved,
    semantic_conformant,
    semantic_nonconformant,
    semantic_execution_unresolved,
  }
}

export function isTraversalStabilityPass(aggregate: TraversalStabilityAggregateV0): boolean {
  return (
    aggregate.schedule_count === 5 &&
    aggregate.member_count === 10 &&
    aggregate.scheduled_member_evaluations === 50 &&
    aggregate.stable === 50 &&
    aggregate.history_sensitive === 0 &&
    aggregate.unresolved === 0 &&
    aggregate.semantic_conformant === 50 &&
    aggregate.semantic_nonconformant === 0 &&
    aggregate.semantic_execution_unresolved === 0
  )
}

/** Parameterized PASS gate for versioned profiles (v1: 12×10 → 120). */
export function isTraversalStabilityPassFor(
  aggregate: TraversalStabilityAggregateV0,
  expected: { readonly scheduleCount: number; readonly evaluations: number },
): boolean {
  return (
    aggregate.schedule_count === expected.scheduleCount &&
    aggregate.member_count === 10 &&
    aggregate.scheduled_member_evaluations === expected.evaluations &&
    aggregate.stable === expected.evaluations &&
    aggregate.history_sensitive === 0 &&
    aggregate.unresolved === 0 &&
    aggregate.semantic_conformant === expected.evaluations &&
    aggregate.semantic_nonconformant === 0 &&
    aggregate.semantic_execution_unresolved === 0
  )
}
