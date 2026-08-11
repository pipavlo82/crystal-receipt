/**
 * Counterfactual Traversal Stability v1 — frozen schedule set with complete
 * first-position cold-start coverage over the exact ten-member DCN.
 *
 * Append-only relative to v0: the five v0 permutations and their
 * ordered-vector digests are preserved byte-for-byte. Seven cold_start_*
 * schedules close first-position coverage for previously uncovered members.
 */

import { createHash } from "node:crypto"
import { canonicalIdentityJson } from "./counterfactual-neighborhood"
import {
  CANONICAL_DCN_VECTOR_IDS_V0,
  PI_NONLOCAL_V0_ORDERED_VECTOR_IDS,
  TRAVERSAL_BOUND_DCN_SHA256_V0,
  TRAVERSAL_RESET_MODEL_V0,
  computeOrderedVectorIdsSha256,
  type CanonicalDcnVectorIdV0,
} from "./counterfactual-traversal-schedules"

export const COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SCHEMA_V1 =
  "receiptos.counterfactual_traversal_schedule.v1" as const

export const COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_SCHEMA_V1 =
  "receiptos.counterfactual_traversal_schedule_set.v1" as const

export const COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1 =
  "counterfactual-traversal-stability-v1" as const

export const COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION_V1 = "v1" as const

export const COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID_V1 =
  "counterfactual-traversal-schedule-set-v1" as const

export type TraversalScheduleIdV1 =
  | "pi_canonical"
  | "pi_reverse"
  | "pi_composite_first"
  | "pi_boundary_first"
  | "pi_nonlocal_v0"
  | "cold_start_missing-required-input"
  | "cold_start_integrity-mismatch"
  | "cold_start_chronicle-proof-root-mismatch"
  | "cold_start_chronicle-predecessor-unknown"
  | "cold_start_chronicle-sequence-gap"
  | "cold_start_chronicle-checkpoint-root-mismatch"
  | "cold_start_chronicle-checkpoint-entry-refs-noncanonical"

export type TraversalScheduleRecordV1 = {
  readonly schema: typeof COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SCHEMA_V1
  readonly schedule_id: TraversalScheduleIdV1
  readonly member_count: 10
  readonly ordered_vector_ids: readonly CanonicalDcnVectorIdV0[]
  readonly ordered_vector_ids_sha256: string
}

export type TraversalScheduleSetRecordV1 = {
  readonly schema: typeof COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_SCHEMA_V1
  readonly schedule_set_id: typeof COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID_V1
  readonly profile_id: typeof COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1
  readonly profile_version: typeof COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION_V1
  readonly dcn_sha256: typeof TRAVERSAL_BOUND_DCN_SHA256_V0
  readonly member_count: 10
  readonly schedule_count: 12
  readonly reset_model: typeof TRAVERSAL_RESET_MODEL_V0
  readonly canonical_vector_ids: readonly CanonicalDcnVectorIdV0[]
  readonly schedules: readonly TraversalScheduleRecordV1[]
  readonly schedule_set_sha256: string
}

export type AuthenticatedScheduleOrderV1 = {
  readonly __brand: "AuthenticatedScheduleOrderV1"
  readonly schedule_id: TraversalScheduleIdV1
  readonly ordered_vector_ids: readonly CanonicalDcnVectorIdV0[]
  readonly ordered_vector_ids_sha256: string
  readonly schedule_set_sha256: string
  readonly reset_model: typeof TRAVERSAL_RESET_MODEL_V0
}

export type FirstPositionCoverageRecordV1 = {
  readonly vector_id: CanonicalDcnVectorIdV0
  readonly first_position_schedule_ids: readonly TraversalScheduleIdV1[]
  readonly cold_start_covered: true
}

export type FirstPositionCoverageAuthorityV1 = {
  readonly schema: "receiptos.counterfactual_traversal_first_position_coverage.v1"
  readonly schedule_count: 12
  readonly member_count: 10
  readonly scheduled_member_evaluations: 120
  readonly first_position_member_count: 10
  readonly first_position_covered: 10
  readonly first_position_missing: readonly []
  readonly records: readonly FirstPositionCoverageRecordV1[]
}

export class TraversalScheduleContractErrorV1 extends Error {
  readonly code = "traversal_schedule_contract_error_v1" as const
  readonly reason: string

  constructor(reason: string) {
    super("traversal schedule contract v1 failed")
    this.name = "TraversalScheduleContractErrorV1"
    this.reason = reason
  }
}

function sha256Utf8Hex(canonicalJson: string): string {
  return createHash("sha256").update(canonicalJson, "utf8").digest("hex")
}

function assertExactTenUniqueCanonical(
  ordered: readonly string[],
  label: string,
): asserts ordered is readonly CanonicalDcnVectorIdV0[] {
  if (ordered.length !== 10) {
    throw new TraversalScheduleContractErrorV1(`${label}_member_count`)
  }
  const seen = new Set<string>()
  for (const id of ordered) {
    if (!CANONICAL_DCN_VECTOR_IDS_V0.includes(id as CanonicalDcnVectorIdV0)) {
      throw new TraversalScheduleContractErrorV1(`${label}_unknown_member`)
    }
    if (seen.has(id)) {
      throw new TraversalScheduleContractErrorV1(`${label}_duplicate_member`)
    }
    seen.add(id)
  }
  for (const id of CANONICAL_DCN_VECTOR_IDS_V0) {
    if (!seen.has(id)) {
      throw new TraversalScheduleContractErrorV1(`${label}_missing_member`)
    }
  }
}

function makeSchedule(
  schedule_id: TraversalScheduleIdV1,
  ordered_vector_ids: readonly CanonicalDcnVectorIdV0[],
): TraversalScheduleRecordV1 {
  assertExactTenUniqueCanonical(ordered_vector_ids, schedule_id)
  return {
    schema: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SCHEMA_V1,
    schedule_id,
    member_count: 10,
    ordered_vector_ids,
    ordered_vector_ids_sha256: computeOrderedVectorIdsSha256(ordered_vector_ids),
  }
}

function coldStartOrder(first: CanonicalDcnVectorIdV0): readonly CanonicalDcnVectorIdV0[] {
  return Object.freeze([
    first,
    ...CANONICAL_DCN_VECTOR_IDS_V0.filter((id) => id !== first),
  ]) as readonly CanonicalDcnVectorIdV0[]
}

/** Preserved v0 ordered digests — must remain unchanged. */
export const PRESERVED_V0_ORDERED_VECTOR_DIGESTS = Object.freeze({
  pi_canonical: "10fe5ab9156154a5a03b369a75cd8d6782da68149be97acb3ad645c9d86c95c7",
  pi_reverse: "5bf691951414804217d0830215d699a5eaf61167fb782cf5388350afe6635f84",
  pi_composite_first: "7545c4b2309b2e996b6139b75eb663932b0b906d25bccc4713974e7723ce5038",
  pi_boundary_first: "4d4d5c88a7295de490fcd2d186e28e03503d3ef5f0bfdd0ecb92637a6eb49480",
  pi_nonlocal_v0: "62d965b95f8004f4229f25b8b50c399ea10f5b0840efdba97b351fb7ee33db65",
} as const)

/** Candidate digests from the prerequisite cold-start audit — must match. */
export const COLD_START_ORDERED_VECTOR_DIGESTS_V1 = Object.freeze({
  "cold_start_missing-required-input":
    "4a7fb6fa12597689f7f78a6b9b49dd93a14e2c4758aeae1fcfd13826e76b4f8f",
  "cold_start_integrity-mismatch":
    "3e2d4fb7f6e8a21d4b593e9f068e308384436dd85cdb5299ba816586b7ddf039",
  "cold_start_chronicle-proof-root-mismatch":
    "c15395a1764775095d338eb5a64641b83996c94b4501da4fff929d4a6837ec34",
  "cold_start_chronicle-predecessor-unknown":
    "4e410451f22cbdb7ebbde5906a0fe7f2653494bcceb17804cc8d5b74ee1c32a9",
  "cold_start_chronicle-sequence-gap":
    "017dac70e31a81b7ebba961bb920dd243e03b7113a3520d22d26c36baa36dbc3",
  "cold_start_chronicle-checkpoint-root-mismatch":
    "5cdf453ffe784bc17299df021072e1bb43e3600015ae6fddf0d0ea2aa0a0b3ac",
  "cold_start_chronicle-checkpoint-entry-refs-noncanonical":
    "88ade9f7539f2cb10b4f46a59a9e4751d415351063b9f58ed2d94928ec664562",
} as const)

function buildFrozenSchedulesV1(): readonly TraversalScheduleRecordV1[] {
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

  const schedules = Object.freeze([
    makeSchedule("pi_canonical", canonical),
    makeSchedule("pi_reverse", reverse),
    makeSchedule("pi_composite_first", compositeFirst),
    makeSchedule("pi_boundary_first", boundaryFirst),
    makeSchedule("pi_nonlocal_v0", [...PI_NONLOCAL_V0_ORDERED_VECTOR_IDS]),
    makeSchedule("cold_start_missing-required-input", coldStartOrder("V-MISSING-REQUIRED-INPUT")),
    makeSchedule("cold_start_integrity-mismatch", coldStartOrder("V-INTEGRITY-MISMATCH")),
    makeSchedule(
      "cold_start_chronicle-proof-root-mismatch",
      coldStartOrder("V-CHRONICLE-PROOF-ROOT-MISMATCH"),
    ),
    makeSchedule(
      "cold_start_chronicle-predecessor-unknown",
      coldStartOrder("V-CHRONICLE-PREDECESSOR-UNKNOWN"),
    ),
    makeSchedule("cold_start_chronicle-sequence-gap", coldStartOrder("V-CHRONICLE-SEQUENCE-GAP")),
    makeSchedule(
      "cold_start_chronicle-checkpoint-root-mismatch",
      coldStartOrder("V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH"),
    ),
    makeSchedule(
      "cold_start_chronicle-checkpoint-entry-refs-noncanonical",
      coldStartOrder("V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL"),
    ),
  ])

  for (const schedule of schedules) {
    const preserved =
      PRESERVED_V0_ORDERED_VECTOR_DIGESTS[
        schedule.schedule_id as keyof typeof PRESERVED_V0_ORDERED_VECTOR_DIGESTS
      ]
    if (preserved !== undefined && schedule.ordered_vector_ids_sha256 !== preserved) {
      throw new TraversalScheduleContractErrorV1("preserved_v0_digest_mismatch")
    }
    const cold =
      COLD_START_ORDERED_VECTOR_DIGESTS_V1[
        schedule.schedule_id as keyof typeof COLD_START_ORDERED_VECTOR_DIGESTS_V1
      ]
    if (cold !== undefined && schedule.ordered_vector_ids_sha256 !== cold) {
      throw new TraversalScheduleContractErrorV1("cold_start_digest_mismatch")
    }
  }

  return schedules
}

export const FROZEN_TRAVERSAL_SCHEDULES_V1 = buildFrozenSchedulesV1()

function scheduleSetPreimageV1(schedules: readonly TraversalScheduleRecordV1[]): unknown {
  return {
    schema: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_SCHEMA_V1,
    schedule_set_id: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID_V1,
    profile_id: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1,
    profile_version: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION_V1,
    dcn_sha256: TRAVERSAL_BOUND_DCN_SHA256_V0,
    member_count: 10,
    schedule_count: 12,
    reset_model: TRAVERSAL_RESET_MODEL_V0,
    canonical_vector_ids: CANONICAL_DCN_VECTOR_IDS_V0,
    schedules: schedules.map((schedule) => ({
      schedule_id: schedule.schedule_id,
      ordered_vector_ids: schedule.ordered_vector_ids,
      ordered_vector_ids_sha256: schedule.ordered_vector_ids_sha256,
    })),
  }
}

export function computeTraversalScheduleSetSha256V1(
  schedules: readonly TraversalScheduleRecordV1[] = FROZEN_TRAVERSAL_SCHEDULES_V1,
): string {
  return sha256Utf8Hex(canonicalIdentityJson(scheduleSetPreimageV1(schedules)))
}

export const PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V1 = computeTraversalScheduleSetSha256V1()

export function buildFrozenTraversalScheduleSetV1(): TraversalScheduleSetRecordV1 {
  const schedules = FROZEN_TRAVERSAL_SCHEDULES_V1
  return {
    schema: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_SCHEMA_V1,
    schedule_set_id: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID_V1,
    profile_id: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1,
    profile_version: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION_V1,
    dcn_sha256: TRAVERSAL_BOUND_DCN_SHA256_V0,
    member_count: 10,
    schedule_count: 12,
    reset_model: TRAVERSAL_RESET_MODEL_V0,
    canonical_vector_ids: CANONICAL_DCN_VECTOR_IDS_V0,
    schedules,
    schedule_set_sha256: computeTraversalScheduleSetSha256V1(schedules),
  }
}

export function deriveFirstPositionCoverageAuthorityV1(
  schedules: readonly TraversalScheduleRecordV1[] = FROZEN_TRAVERSAL_SCHEDULES_V1,
): FirstPositionCoverageAuthorityV1 {
  if (schedules.length !== 12) {
    throw new TraversalScheduleContractErrorV1("incomplete_first_position_coverage")
  }
  const byVector = new Map<CanonicalDcnVectorIdV0, TraversalScheduleIdV1[]>()
  for (const id of CANONICAL_DCN_VECTOR_IDS_V0) {
    byVector.set(id, [])
  }
  for (const schedule of schedules) {
    assertExactTenUniqueCanonical(schedule.ordered_vector_ids, schedule.schedule_id)
    const first = schedule.ordered_vector_ids[0]!
    byVector.get(first)!.push(schedule.schedule_id)
  }
  const missing = CANONICAL_DCN_VECTOR_IDS_V0.filter((id) => (byVector.get(id) ?? []).length === 0)
  if (missing.length !== 0) {
    throw new TraversalScheduleContractErrorV1("incomplete_first_position_coverage")
  }
  const records: FirstPositionCoverageRecordV1[] = CANONICAL_DCN_VECTOR_IDS_V0.map((vector_id) => ({
    vector_id,
    first_position_schedule_ids: Object.freeze([...(byVector.get(vector_id) ?? [])]),
    cold_start_covered: true as const,
  }))
  return {
    schema: "receiptos.counterfactual_traversal_first_position_coverage.v1",
    schedule_count: 12,
    member_count: 10,
    scheduled_member_evaluations: 120,
    first_position_member_count: 10,
    first_position_covered: 10,
    first_position_missing: Object.freeze([]) as readonly [],
    records: Object.freeze(records),
  }
}

export function getFrozenTraversalScheduleV1(
  scheduleId: TraversalScheduleIdV1,
): TraversalScheduleRecordV1 {
  const found = FROZEN_TRAVERSAL_SCHEDULES_V1.find((entry) => entry.schedule_id === scheduleId)
  if (!found) {
    throw new TraversalScheduleContractErrorV1("unknown_schedule_id")
  }
  return found
}

export function authenticateFrozenTraversalScheduleV1(
  scheduleId: string,
): AuthenticatedScheduleOrderV1 {
  const allowed = new Set(FROZEN_TRAVERSAL_SCHEDULES_V1.map((entry) => entry.schedule_id))
  if (!allowed.has(scheduleId as TraversalScheduleIdV1)) {
    throw new TraversalScheduleContractErrorV1("unknown_schedule_id")
  }
  const schedule = getFrozenTraversalScheduleV1(scheduleId as TraversalScheduleIdV1)
  const recomputed = computeOrderedVectorIdsSha256(schedule.ordered_vector_ids)
  if (recomputed !== schedule.ordered_vector_ids_sha256) {
    throw new TraversalScheduleContractErrorV1("schedule_digest_mismatch")
  }
  const setSha = computeTraversalScheduleSetSha256V1()
  if (setSha !== PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V1) {
    throw new TraversalScheduleContractErrorV1("schedule_set_digest_mismatch")
  }
  // Coverage must authenticate from frozen schedules before execution.
  deriveFirstPositionCoverageAuthorityV1()
  return {
    __brand: "AuthenticatedScheduleOrderV1",
    schedule_id: schedule.schedule_id,
    ordered_vector_ids: schedule.ordered_vector_ids,
    ordered_vector_ids_sha256: schedule.ordered_vector_ids_sha256,
    schedule_set_sha256: setSha,
    reset_model: TRAVERSAL_RESET_MODEL_V0,
  }
}

export function assertFrozenScheduleSetIntegrityV1(): void {
  const set = buildFrozenTraversalScheduleSetV1()
  if (set.schedules.length !== 12) {
    throw new TraversalScheduleContractErrorV1("schedule_count")
  }
  if (set.schedule_set_sha256 !== PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V1) {
    throw new TraversalScheduleContractErrorV1("schedule_set_digest_mismatch")
  }
  for (const schedule of set.schedules) {
    assertExactTenUniqueCanonical(schedule.ordered_vector_ids, schedule.schedule_id)
    if (
      computeOrderedVectorIdsSha256(schedule.ordered_vector_ids) !==
      schedule.ordered_vector_ids_sha256
    ) {
      throw new TraversalScheduleContractErrorV1("schedule_digest_mismatch")
    }
  }
  const totalSlots = set.schedules.reduce(
    (sum, schedule) => sum + schedule.ordered_vector_ids.length,
    0,
  )
  if (totalSlots !== 120) {
    throw new TraversalScheduleContractErrorV1("schedule_slot_count")
  }
  deriveFirstPositionCoverageAuthorityV1(set.schedules)
}
