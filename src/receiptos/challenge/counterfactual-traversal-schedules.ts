/**
 * Counterfactual Conformance v0 — Lane K frozen traversal schedule set.
 *
 * Schedule identity is separate from DCN identity. Caller-supplied schedule
 * lists/digests/reset models are never authority. Runtime never computes
 * Recamán or other recurrences; π_nonlocal_v0 is a frozen ordered vector-ID list.
 */

import { createHash } from "node:crypto"
import { canonicalIdentityJson } from "./counterfactual-neighborhood"

/** Pinned Lane B DCN digest (literal; schedule identity remains separate). */
export const TRAVERSAL_BOUND_DCN_SHA256_V0 =
  "37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d" as const

export const COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SCHEMA =
  "receiptos.counterfactual_traversal_schedule.v0" as const

export const COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_SCHEMA =
  "receiptos.counterfactual_traversal_schedule_set.v0" as const

export const COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID =
  "counterfactual-traversal-stability-v0" as const

export const COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION = "v0" as const

export const COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID =
  "counterfactual-traversal-schedule-set-v0" as const

export const TRAVERSAL_RESET_MODEL_V0 =
  "fresh_process_per_schedule_shared_process_within_schedule" as const

export const CANONICAL_DCN_VECTOR_IDS_V0 = Object.freeze([
  "V-OBSERVED-NOT-VALIDATED",
  "V-MISSING-REQUIRED-INPUT",
  "V-INTEGRITY-MISMATCH",
  "V-CHRONICLE-PROOF-ROOT-MISMATCH",
  "V-CHRONICLE-PREDECESSOR-UNKNOWN",
  "V-CHRONICLE-SEQUENCE-GAP",
  "V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH",
  "V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL",
  "V-AT-NEST-OBJ",
  "V-MAN-HASH-DIFF",
] as const)

export type CanonicalDcnVectorIdV0 = (typeof CANONICAL_DCN_VECTOR_IDS_V0)[number]

export type TraversalScheduleIdV0 =
  | "pi_canonical"
  | "pi_reverse"
  | "pi_composite_first"
  | "pi_boundary_first"
  | "pi_nonlocal_v0"

/**
 * Frozen π_nonlocal_v0 order.
 * Generator provenance only (not runtime authority): Recamán-inspired preferred
 * jumps over indices 0..9 with deterministic min-unused fallback when the
 * preferred index is out of domain or already visited. Conformance authority is
 * this exact ordered vector-ID list and its digest.
 */
export const PI_NONLOCAL_V0_ORDERED_VECTOR_IDS = Object.freeze([
  "V-OBSERVED-NOT-VALIDATED",
  "V-MISSING-REQUIRED-INPUT",
  "V-CHRONICLE-PROOF-ROOT-MISMATCH",
  "V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH",
  "V-INTEGRITY-MISMATCH",
  "V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL",
  "V-CHRONICLE-PREDECESSOR-UNKNOWN",
  "V-CHRONICLE-SEQUENCE-GAP",
  "V-AT-NEST-OBJ",
  "V-MAN-HASH-DIFF",
] as const satisfies readonly CanonicalDcnVectorIdV0[])

export type TraversalScheduleRecordV0 = {
  readonly schema: typeof COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SCHEMA
  readonly schedule_id: TraversalScheduleIdV0
  readonly member_count: 10
  readonly ordered_vector_ids: readonly CanonicalDcnVectorIdV0[]
  readonly ordered_vector_ids_sha256: string
}

export type TraversalScheduleSetRecordV0 = {
  readonly schema: typeof COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_SCHEMA
  readonly schedule_set_id: typeof COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID
  readonly profile_id: typeof COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID
  readonly profile_version: typeof COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION
  readonly dcn_sha256: typeof TRAVERSAL_BOUND_DCN_SHA256_V0
  readonly member_count: 10
  readonly schedule_count: 5
  readonly reset_model: typeof TRAVERSAL_RESET_MODEL_V0
  readonly canonical_vector_ids: readonly CanonicalDcnVectorIdV0[]
  readonly schedules: readonly TraversalScheduleRecordV0[]
  readonly schedule_set_sha256: string
}

/**
 * Branded authenticated schedule order. Constructible only via
 * authenticateFrozenTraversalSchedule / loadAuthenticatedScheduleOrder.
 */
export type AuthenticatedScheduleOrderV0 = {
  readonly __brand: "AuthenticatedScheduleOrderV0"
  readonly schedule_id: TraversalScheduleIdV0
  readonly ordered_vector_ids: readonly CanonicalDcnVectorIdV0[]
  readonly ordered_vector_ids_sha256: string
  readonly schedule_set_sha256: string
  readonly reset_model: typeof TRAVERSAL_RESET_MODEL_V0
}

export class TraversalScheduleContractError extends Error {
  readonly code = "traversal_schedule_contract_error" as const
  readonly reason: string

  constructor(reason: string) {
    super("traversal schedule contract failed")
    this.name = "TraversalScheduleContractError"
    this.reason = reason
  }
}

function sha256Utf8Hex(canonicalJson: string): string {
  return createHash("sha256").update(canonicalJson, "utf8").digest("hex")
}

export function computeOrderedVectorIdsSha256(
  orderedVectorIds: readonly string[],
): string {
  return sha256Utf8Hex(canonicalIdentityJson(orderedVectorIds))
}

function assertExactTenUniqueCanonical(ordered: readonly string[], label: string): asserts ordered is readonly CanonicalDcnVectorIdV0[] {
  if (ordered.length !== 10) {
    throw new TraversalScheduleContractError(`${label}_member_count`)
  }
  const seen = new Set<string>()
  for (const id of ordered) {
    if (!CANONICAL_DCN_VECTOR_IDS_V0.includes(id as CanonicalDcnVectorIdV0)) {
      throw new TraversalScheduleContractError(`${label}_unknown_member`)
    }
    if (seen.has(id)) {
      throw new TraversalScheduleContractError(`${label}_duplicate_member`)
    }
    seen.add(id)
  }
  for (const id of CANONICAL_DCN_VECTOR_IDS_V0) {
    if (!seen.has(id)) {
      throw new TraversalScheduleContractError(`${label}_missing_member`)
    }
  }
}

function makeSchedule(
  schedule_id: TraversalScheduleIdV0,
  ordered_vector_ids: readonly CanonicalDcnVectorIdV0[],
): TraversalScheduleRecordV0 {
  assertExactTenUniqueCanonical(ordered_vector_ids, schedule_id)
  return {
    schema: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SCHEMA,
    schedule_id,
    member_count: 10,
    ordered_vector_ids,
    ordered_vector_ids_sha256: computeOrderedVectorIdsSha256(ordered_vector_ids),
  }
}

function buildFrozenSchedules(): readonly TraversalScheduleRecordV0[] {
  const canonical = [...CANONICAL_DCN_VECTOR_IDS_V0] as CanonicalDcnVectorIdV0[]
  const reverse = [...canonical].reverse() as CanonicalDcnVectorIdV0[]
  const compositeFirst: CanonicalDcnVectorIdV0[] = [
    "V-MAN-HASH-DIFF",
    ...canonical.filter((id) => id !== "V-MAN-HASH-DIFF"),
  ]
  const boundaryFirst: CanonicalDcnVectorIdV0[] = [
    "V-AT-NEST-OBJ",
    ...canonical.filter((id) => id !== "V-AT-NEST-OBJ"),
  ]
  return Object.freeze([
    makeSchedule("pi_canonical", canonical),
    makeSchedule("pi_reverse", reverse),
    makeSchedule("pi_composite_first", compositeFirst),
    makeSchedule("pi_boundary_first", boundaryFirst),
    makeSchedule("pi_nonlocal_v0", [...PI_NONLOCAL_V0_ORDERED_VECTOR_IDS]),
  ])
}

export const FROZEN_TRAVERSAL_SCHEDULES_V0 = buildFrozenSchedules()

function scheduleSetPreimage(schedules: readonly TraversalScheduleRecordV0[]): unknown {
  return {
    schema: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_SCHEMA,
    schedule_set_id: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID,
    profile_id: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID,
    profile_version: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION,
    dcn_sha256: TRAVERSAL_BOUND_DCN_SHA256_V0,
    member_count: 10,
    schedule_count: 5,
    reset_model: TRAVERSAL_RESET_MODEL_V0,
    canonical_vector_ids: CANONICAL_DCN_VECTOR_IDS_V0,
    schedules: schedules.map((schedule) => ({
      schedule_id: schedule.schedule_id,
      ordered_vector_ids: schedule.ordered_vector_ids,
      ordered_vector_ids_sha256: schedule.ordered_vector_ids_sha256,
    })),
  }
}

export function computeTraversalScheduleSetSha256(
  schedules: readonly TraversalScheduleRecordV0[] = FROZEN_TRAVERSAL_SCHEDULES_V0,
): string {
  return sha256Utf8Hex(canonicalIdentityJson(scheduleSetPreimage(schedules)))
}

export const PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0 = computeTraversalScheduleSetSha256()

export function buildFrozenTraversalScheduleSet(): TraversalScheduleSetRecordV0 {
  const schedules = FROZEN_TRAVERSAL_SCHEDULES_V0
  const schedule_set_sha256 = computeTraversalScheduleSetSha256(schedules)
  return {
    schema: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_SCHEMA,
    schedule_set_id: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID,
    profile_id: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID,
    profile_version: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION,
    dcn_sha256: TRAVERSAL_BOUND_DCN_SHA256_V0,
    member_count: 10,
    schedule_count: 5,
    reset_model: TRAVERSAL_RESET_MODEL_V0,
    canonical_vector_ids: CANONICAL_DCN_VECTOR_IDS_V0,
    schedules,
    schedule_set_sha256,
  }
}

export function getFrozenTraversalSchedule(
  scheduleId: TraversalScheduleIdV0,
): TraversalScheduleRecordV0 {
  const found = FROZEN_TRAVERSAL_SCHEDULES_V0.find((entry) => entry.schedule_id === scheduleId)
  if (!found) {
    throw new TraversalScheduleContractError("unknown_schedule_id")
  }
  return found
}

/**
 * Authenticate a frozen schedule id against the closed schedule-set identity.
 * Rejects caller-invented ordered lists: only schedule_id is accepted.
 */
export function authenticateFrozenTraversalSchedule(
  scheduleId: string,
): AuthenticatedScheduleOrderV0 {
  const allowed = new Set(FROZEN_TRAVERSAL_SCHEDULES_V0.map((entry) => entry.schedule_id))
  if (!allowed.has(scheduleId as TraversalScheduleIdV0)) {
    throw new TraversalScheduleContractError("unknown_schedule_id")
  }
  const schedule = getFrozenTraversalSchedule(scheduleId as TraversalScheduleIdV0)
  const recomputed = computeOrderedVectorIdsSha256(schedule.ordered_vector_ids)
  if (recomputed !== schedule.ordered_vector_ids_sha256) {
    throw new TraversalScheduleContractError("schedule_digest_mismatch")
  }
  const setSha = computeTraversalScheduleSetSha256()
  if (setSha !== PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0) {
    throw new TraversalScheduleContractError("schedule_set_digest_mismatch")
  }
  return {
    __brand: "AuthenticatedScheduleOrderV0",
    schedule_id: schedule.schedule_id,
    ordered_vector_ids: schedule.ordered_vector_ids,
    ordered_vector_ids_sha256: schedule.ordered_vector_ids_sha256,
    schedule_set_sha256: setSha,
    reset_model: TRAVERSAL_RESET_MODEL_V0,
  }
}

export function assertFrozenScheduleSetIntegrity(): void {
  const set = buildFrozenTraversalScheduleSet()
  if (set.schedules.length !== 5) {
    throw new TraversalScheduleContractError("schedule_count")
  }
  if (set.schedule_set_sha256 !== PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0) {
    throw new TraversalScheduleContractError("schedule_set_digest_mismatch")
  }
  for (const schedule of set.schedules) {
    assertExactTenUniqueCanonical(schedule.ordered_vector_ids, schedule.schedule_id)
    if (
      computeOrderedVectorIdsSha256(schedule.ordered_vector_ids) !==
      schedule.ordered_vector_ids_sha256
    ) {
      throw new TraversalScheduleContractError("schedule_digest_mismatch")
    }
  }
  const totalSlots = set.schedules.reduce((sum, schedule) => sum + schedule.ordered_vector_ids.length, 0)
  if (totalSlots !== 50) {
    throw new TraversalScheduleContractError("schedule_slot_count")
  }
}
