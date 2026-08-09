/**
 * Cross-surface counterfactual observation normalization v0 (Lane C).
 *
 * Maps native verifier/challenge observations into a shared observation_class
 * without evaluating conformance, running verifiers, or capturing host errors.
 *
 * Explicit separation:
 * - observation_class describes verifier/operation observation only
 * - source_validity_effect is always "none" (never synthesizes source validity)
 *
 * Host/runtime failures (thrown Error, invalid non-result inputs) are NOT mapped
 * to semantic classes — normalizers throw NormalizationContractError instead.
 */

import type { HandoffReceiptVerification } from "../schema/types"
import type {
  ChronicleCheckpointContinuityResultV0,
  ChronicleCheckpointContinuityEvaluationState,
  ChronicleCheckpointContinuityReasonCode,
} from "../capsule/chronicle-checkpoint-continuity-v0"
import type {
  ChronicleCheckpointVerification,
  TryCreateChronicleEntryV0Result,
} from "../capsule/chronicle-portfolio-v0"

export const COUNTERFACTUAL_OBSERVATION_SCHEMA = "receiptos.counterfactual_observation.v0" as const

export type CounterfactualObservationSchema = typeof COUNTERFACTUAL_OBSERVATION_SCHEMA

/**
 * Minimal shared semantic observation classes for current frozen surfaces.
 *
 * - affirmative: verifier-local / admission success
 * - rejected: validity/integrity/admission/local-predicate failure the subject checks
 * - unverifiable: epistemic unavailability (required evidence/state absent)
 * - malformed: shape/out-of-profile cannot be evaluated under the contract
 * - operation: CAB (and similar) non-verdict deterministic observations
 */
export type CounterfactualObservationClassV0 =
  | "affirmative"
  | "rejected"
  | "unverifiable"
  | "malformed"
  | "operation"

export type CounterfactualObservationSurfaceV0 =
  | "verify_handoff_receipt_root"
  | "chronicle_admission"
  | "chronicle_continuity"
  | "chronicle_checkpoint_local"
  | "counterfactual_audit_boundary"

export interface CounterfactualObservationV0 {
  readonly schema: CounterfactualObservationSchema
  readonly surface: CounterfactualObservationSurfaceV0
  readonly observation_class: CounterfactualObservationClassV0
  /**
   * Lane C never asserts source-artifact validity.
   * Always "none" — challenge/admission/local failures do not rewrite source validity.
   */
  readonly source_validity_effect: "none"
  /** Compact native status token for audit (not a universal enum). */
  readonly native_status: string
  /** Native reason/reason_code when the surface provides one; otherwise null. */
  readonly native_reason_code: string | null
  /** Deterministic native projection / detail (structured clone; no host state). */
  readonly native_detail: Readonly<Record<string, unknown>>
}

export class NormalizationContractError extends Error {
  readonly code = "normalization_contract_error" as const
  constructor(message: string) {
    super(message)
    this.name = "NormalizationContractError"
  }
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new NormalizationContractError(`${label} must be a JSON object`)
  }
  return value as Record<string, unknown>
}

function requireBoolean(object: Record<string, unknown>, key: string, label: string): boolean {
  const value = object[key]
  if (typeof value !== "boolean") {
    throw new NormalizationContractError(`${label}.${key} must be a boolean`)
  }
  return value
}

function observation(input: {
  surface: CounterfactualObservationSurfaceV0
  observation_class: CounterfactualObservationClassV0
  native_status: string
  native_reason_code: string | null
  native_detail: Record<string, unknown>
}): CounterfactualObservationV0 {
  return {
    schema: COUNTERFACTUAL_OBSERVATION_SCHEMA,
    surface: input.surface,
    observation_class: input.observation_class,
    source_validity_effect: "none",
    native_status: input.native_status,
    native_reason_code: input.native_reason_code,
    native_detail: structuredClone(input.native_detail),
  }
}

// --- verifyHandoffReceiptRoot ------------------------------------------------

/**
 * Runtime/actual normalization for verifyHandoffReceiptRoot.
 *
 * Limitation: the production result is only `{ok, receipt_root, recomputed_root}`.
 * Distinguishes:
 * - ok:true → affirmative
 * - ok:false with both roots null → unverifiable (missing comparison operand)
 * - ok:false with roots present → rejected (integrity mismatch)
 *
 * It cannot encode challenge-level non-elevation semantics (observed_not_validated);
 * those remain challenge expected/context concerns. When ok:true, observation is
 * affirmative even if an observation-only field was mutated.
 */
export function normalizeVerifyHandoffReceiptRootResult(
  result: HandoffReceiptVerification,
): CounterfactualObservationV0 {
  const object = asObject(result, "HandoffReceiptVerification")
  const ok = requireBoolean(object, "ok", "HandoffReceiptVerification")
  if (!("receipt_root" in object) || !("recomputed_root" in object)) {
    throw new NormalizationContractError("HandoffReceiptVerification missing root fields")
  }
  const receiptRoot = object.receipt_root
  const recomputedRoot = object.recomputed_root
  if (receiptRoot !== null && typeof receiptRoot !== "string") {
    throw new NormalizationContractError("receipt_root must be string|null")
  }
  if (recomputedRoot !== null && typeof recomputedRoot !== "string") {
    throw new NormalizationContractError("recomputed_root must be string|null")
  }

  const detail = {
    ok,
    receipt_root: receiptRoot,
    recomputed_root: recomputedRoot,
  }

  if (ok) {
    return observation({
      surface: "verify_handoff_receipt_root",
      observation_class: "affirmative",
      native_status: "ok_true",
      native_reason_code: null,
      native_detail: detail,
    })
  }

  if (receiptRoot === null && recomputedRoot === null) {
    return observation({
      surface: "verify_handoff_receipt_root",
      observation_class: "unverifiable",
      native_status: "ok_false_missing_roots",
      native_reason_code: "missing_required_receipt_root",
      native_detail: detail,
    })
  }

  return observation({
    surface: "verify_handoff_receipt_root",
    observation_class: "rejected",
    native_status: "ok_false_integrity_mismatch",
    native_reason_code: "receipt_root_mismatch",
    native_detail: detail,
  })
}

/**
 * Expected-side normalization for frozen verifyHandoff challenge vectors.
 * Delegates to the runtime normalizer on `challenged_verification` for
 * exact expected/actual symmetry on the native observation.
 */
export function normalizeVerifyHandoffChallengeExpected(expected: unknown): CounterfactualObservationV0 {
  const object = asObject(expected, "verifyHandoff expected")
  if (!("challenged_verification" in object)) {
    throw new NormalizationContractError("verifyHandoff expected missing challenged_verification")
  }
  return normalizeVerifyHandoffReceiptRootResult(
    object.challenged_verification as HandoffReceiptVerification,
  )
}

// --- Chronicle admission -----------------------------------------------------

export function normalizeChronicleAdmissionResult(
  result: TryCreateChronicleEntryV0Result,
): CounterfactualObservationV0 {
  const object = asObject(result, "TryCreateChronicleEntryV0Result")
  if (!("success" in object) || typeof object.success !== "boolean") {
    throw new NormalizationContractError("TryCreateChronicleEntryV0Result.success must be boolean")
  }

  if (object.success === true) {
    if (!("value" in object)) {
      throw new NormalizationContractError("successful admission missing value")
    }
    return observation({
      surface: "chronicle_admission",
      observation_class: "affirmative",
      native_status: "admitted",
      native_reason_code: null,
      native_detail: { success: true, value: structuredClone(object.value) },
    })
  }

  const failure = asObject(object.failure, "admission failure")
  const failureClass = failure.failure_class
  const reasonCode = failure.reason_code
  if (typeof failureClass !== "string" || typeof reasonCode !== "string") {
    throw new NormalizationContractError("admission failure requires failure_class and reason_code")
  }

  const observationClass: CounterfactualObservationClassV0 =
    failureClass === "unverifiable" ? "unverifiable" : "rejected"

  return observation({
    surface: "chronicle_admission",
    observation_class: observationClass,
    native_status: `admission_${failureClass}`,
    native_reason_code: reasonCode,
    native_detail: {
      success: false,
      failure: structuredClone(failure),
      // Local admission semantics only — not source receipt invalidity.
      admission_scope: "chronicle_entry_local",
    },
  })
}

export function normalizeChronicleAdmissionChallengeExpected(expected: unknown): CounterfactualObservationV0 {
  const object = asObject(expected, "chronicle admission expected")
  if (!("challenged_admission" in object)) {
    throw new NormalizationContractError("admission expected missing challenged_admission")
  }
  return normalizeChronicleAdmissionResult(
    object.challenged_admission as TryCreateChronicleEntryV0Result,
  )
}

// --- Chronicle continuity ----------------------------------------------------

const CONTINUITY_STATES = new Set<ChronicleCheckpointContinuityEvaluationState>([
  "evaluated",
  "unverifiable",
  "malformed",
  "not_evaluated",
])

export function normalizeChronicleContinuityResult(
  result: ChronicleCheckpointContinuityResultV0,
): CounterfactualObservationV0 {
  const object = asObject(result, "ChronicleCheckpointContinuityResultV0")
  const evaluationState = object.evaluation_state
  const reasonCode = object.reason_code
  if (typeof evaluationState !== "string" || !CONTINUITY_STATES.has(evaluationState as ChronicleCheckpointContinuityEvaluationState)) {
    throw new NormalizationContractError("invalid continuity evaluation_state")
  }
  if (typeof reasonCode !== "string") {
    throw new NormalizationContractError("continuity reason_code must be a string")
  }

  const detail = {
    evaluation_state: evaluationState,
    verdict: object.verdict ?? null,
    relation: object.relation ?? null,
    reason_code: reasonCode as ChronicleCheckpointContinuityReasonCode,
  }

  let observationClass: CounterfactualObservationClassV0
  if (evaluationState === "malformed") {
    observationClass = "malformed"
  } else if (evaluationState === "unverifiable") {
    observationClass = "unverifiable"
  } else if (evaluationState === "not_evaluated") {
    // Local checkpoint verifier failed before continuity gates — scoped failure.
    observationClass = "rejected"
  } else if (object.verdict === "valid") {
    observationClass = "affirmative"
  } else if (object.verdict === "invalid") {
    observationClass = "rejected"
  } else {
    throw new NormalizationContractError("evaluated continuity requires verdict valid|invalid")
  }

  return observation({
    surface: "chronicle_continuity",
    observation_class: observationClass,
    native_status: `${evaluationState}:${reasonCode}`,
    native_reason_code: reasonCode,
    native_detail: detail,
  })
}

export function normalizeChronicleContinuityChallengeExpected(expected: unknown): CounterfactualObservationV0 {
  const object = asObject(expected, "continuity expected")
  if (!("challenged_continuity" in object)) {
    throw new NormalizationContractError("continuity expected missing challenged_continuity")
  }
  return normalizeChronicleContinuityResult(
    object.challenged_continuity as ChronicleCheckpointContinuityResultV0,
  )
}

// --- Chronicle checkpoint-local ---------------------------------------------

export function normalizeChronicleCheckpointLocalResult(
  result: ChronicleCheckpointVerification,
): CounterfactualObservationV0 {
  const object = asObject(result, "ChronicleCheckpointVerification")
  const ok = requireBoolean(object, "ok", "ChronicleCheckpointVerification")
  const checkpointRoot = object.checkpoint_root
  const recomputed = object.recomputed_checkpoint_root
  if (typeof checkpointRoot !== "string" || typeof recomputed !== "string") {
    throw new NormalizationContractError("checkpoint verification requires string roots")
  }
  const rootMatches = checkpointRoot === recomputed
  // When ok is false and roots match, entry-ref canonicity is the failing predicate.
  // When roots differ, entryRefsAreCanonical is not fully recoverable from the result alone.
  const entryRefsAreCanonical = ok ? true : rootMatches ? false : null

  const detail = {
    ok,
    checkpoint_root: checkpointRoot,
    recomputed_checkpoint_root: recomputed,
    rootMatches,
    entryRefsAreCanonical,
    local_scope: "chronicle_checkpoint_local",
  }

  return observation({
    surface: "chronicle_checkpoint_local",
    observation_class: ok ? "affirmative" : "rejected",
    native_status: ok ? "ok_true" : "ok_false",
    // No invented reason taxonomy — only the local predicates in native_detail.
    native_reason_code: null,
    native_detail: detail,
  })
}

/**
 * Expected-side normalization. When frozen expected also carries explicit
 * local predicate booleans, they are validated against the derived projection
 * but the normalized observation remains the runtime-result projection so
 * expected/actual converge.
 */
export function normalizeChronicleCheckpointLocalChallengeExpected(expected: unknown): CounterfactualObservationV0 {
  const object = asObject(expected, "checkpoint-local expected")
  if (!("challenged_verification" in object)) {
    throw new NormalizationContractError("checkpoint-local expected missing challenged_verification")
  }
  const normalized = normalizeChronicleCheckpointLocalResult(
    object.challenged_verification as ChronicleCheckpointVerification,
  )
  if (typeof object.challenged_root_matches === "boolean") {
    if (object.challenged_root_matches !== normalized.native_detail.rootMatches) {
      throw new NormalizationContractError("checkpoint-local expected rootMatches disagrees with challenged_verification")
    }
  }
  if (typeof object.challenged_entry_refs_canonical === "boolean") {
    const derived = normalized.native_detail.entryRefsAreCanonical
    if (derived !== null && object.challenged_entry_refs_canonical !== derived) {
      throw new NormalizationContractError(
        "checkpoint-local expected entryRefsAreCanonical disagrees with challenged_verification",
      )
    }
  }
  return normalized
}

// --- Counterfactual Audit Boundary ------------------------------------------

const CAB_OUTCOMES = new Set([
  "rejected",
  "accepted_snapshot",
  "manifest_hash_differs",
  "manifest_hash_equals",
  "manifest_hash_value",
])

/**
 * Normalize CAB expected/outcome objects.
 * - outcome "rejected" (reserved audit_timestamp in semantic input) → malformed
 * - accepted_snapshot / manifest_hash_* → operation (non-verdict)
 */
export function normalizeCounterfactualAuditBoundaryExpected(expected: unknown): CounterfactualObservationV0 {
  const object = asObject(expected, "CAB expected")
  const outcome = object.outcome
  if (typeof outcome !== "string" || !CAB_OUTCOMES.has(outcome)) {
    throw new NormalizationContractError(`unsupported CAB outcome: ${String(outcome)}`)
  }

  if (outcome === "rejected") {
    return observation({
      surface: "counterfactual_audit_boundary",
      observation_class: "malformed",
      native_status: "rejected",
      native_reason_code: "audit_timestamp_forbidden_in_semantic_input",
      native_detail: structuredClone(object),
    })
  }

  return observation({
    surface: "counterfactual_audit_boundary",
    observation_class: "operation",
    native_status: outcome,
    native_reason_code: null,
    native_detail: structuredClone(object),
  })
}
