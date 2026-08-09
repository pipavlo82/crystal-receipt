/**
 * Cross-surface counterfactual observation normalization v0 (Lane C).
 *
 * Maps native verifier/challenge observations into a shared observation_class
 * without evaluating conformance, running verifiers, or capturing host errors.
 *
 * observation_class describes verifier/operation observation only. Lane C does
 * not synthesize source-artifact validity fields or conclusions.
 *
 * Host/runtime failures (thrown Error, invalid non-result inputs) are NOT mapped
 * to semantic classes — normalizers throw NormalizationContractError instead.
 */

import type { HandoffReceiptVerification } from "../schema/types"
import type {
  ChronicleCheckpointContinuityResultV0,
  ChronicleCheckpointContinuityEvaluationState,
  ChronicleCheckpointContinuityReasonCode,
  ChronicleCheckpointContinuityVerdict,
  ChronicleCheckpointContinuityRelation,
} from "../capsule/chronicle-checkpoint-continuity-v0"
import type {
  ChronicleCheckpointVerification,
  ChronicleEntryAdmissionFailureV0,
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
    native_status: input.native_status,
    native_reason_code: input.native_reason_code,
    native_detail: structuredClone(input.native_detail),
  }
}

// --- verifyHandoffReceiptRoot ------------------------------------------------

/**
 * Runtime/actual normalization for verifyHandoffReceiptRoot.
 *
 * Production contract (verifyHandoffReceiptRoot):
 * - missing required root → {ok:false, receipt_root:null, recomputed_root:null}
 * - otherwise → {ok, receipt_root:string, recomputed_root:string} with ok iff equal
 *
 * Challenge-level non-elevation (observed_not_validated) remains Lane A context;
 * runtime ok:true is affirmative and cannot invent that challenge story.
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

  const bothNull = receiptRoot === null && recomputedRoot === null
  const bothString = typeof receiptRoot === "string" && typeof recomputedRoot === "string"
  if (!bothNull && !bothString) {
    throw new NormalizationContractError(
      "HandoffReceiptVerification roots must both be null or both be strings",
    )
  }

  const detail = {
    ok,
    receipt_root: receiptRoot,
    recomputed_root: recomputedRoot,
  }

  if (ok) {
    if (!bothString) {
      throw new NormalizationContractError("ok:true requires non-null receipt roots")
    }
    if (receiptRoot.toLowerCase() !== recomputedRoot.toLowerCase()) {
      throw new NormalizationContractError("ok:true requires equal receipt roots")
    }
    return observation({
      surface: "verify_handoff_receipt_root",
      observation_class: "affirmative",
      native_status: "ok_true",
      native_reason_code: null,
      native_detail: detail,
    })
  }

  if (bothNull) {
    return observation({
      surface: "verify_handoff_receipt_root",
      observation_class: "unverifiable",
      native_status: "ok_false_missing_roots",
      native_reason_code: "missing_required_receipt_root",
      native_detail: detail,
    })
  }

  if (receiptRoot.toLowerCase() === recomputedRoot.toLowerCase()) {
    throw new NormalizationContractError("ok:false with equal roots is outside production contract")
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

/**
 * Exact production pairs from ChronicleEntryAdmissionFailureV0.
 * No open-ended fallback: unknown class/reason throws.
 */
const ADMISSION_FAILURE_CONTRACT: {
  readonly [K in ChronicleEntryAdmissionFailureV0["failure_class"]]: {
    readonly observation_class: Extract<CounterfactualObservationClassV0, "unverifiable" | "rejected">
    readonly reason_codes: ReadonlySet<
      Extract<ChronicleEntryAdmissionFailureV0, { failure_class: K }>["reason_code"]
    >
  }
} = {
  unverifiable: {
    observation_class: "unverifiable",
    reason_codes: new Set(["evidence_root_missing"]),
  },
  evidence_mismatch: {
    observation_class: "rejected",
    reason_codes: new Set(["evidence_root_mismatch"]),
  },
  cross_object_inconsistency: {
    observation_class: "rejected",
    reason_codes: new Set([
      "proof_root_mismatch",
      "capsule_stored_mismatch",
      "capsule_computed_mismatch",
    ]),
  },
  reported_state_inconsistency: {
    observation_class: "rejected",
    reason_codes: new Set(["capsule_label_inconsistent", "verifier_result_inconsistent"]),
  },
  identity_inconsistency: {
    observation_class: "rejected",
    reason_codes: new Set(["proof_object_id_invalid", "proof_ref_invalid"]),
  },
}

function parseAdmissionFailure(failure: Record<string, unknown>): ChronicleEntryAdmissionFailureV0 {
  const failureClass = failure.failure_class
  const reasonCode = failure.reason_code
  if (typeof failureClass !== "string" || typeof reasonCode !== "string") {
    throw new NormalizationContractError("admission failure requires failure_class and reason_code")
  }
  if (!(failureClass in ADMISSION_FAILURE_CONTRACT)) {
    throw new NormalizationContractError(`unknown admission failure_class: ${failureClass}`)
  }
  const contract = ADMISSION_FAILURE_CONTRACT[failureClass as keyof typeof ADMISSION_FAILURE_CONTRACT]
  if (!contract.reason_codes.has(reasonCode as never)) {
    throw new NormalizationContractError(
      `invalid admission reason_code ${reasonCode} for failure_class ${failureClass}`,
    )
  }
  return { failure_class: failureClass, reason_code: reasonCode } as ChronicleEntryAdmissionFailureV0
}

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
    if ("failure" in object && object.failure !== undefined) {
      throw new NormalizationContractError("successful admission must not include failure")
    }
    return observation({
      surface: "chronicle_admission",
      observation_class: "affirmative",
      native_status: "admitted",
      native_reason_code: null,
      native_detail: { success: true, value: structuredClone(object.value) },
    })
  }

  if (!("failure" in object)) {
    throw new NormalizationContractError("failed admission missing failure")
  }
  if ("value" in object && object.value !== undefined) {
    throw new NormalizationContractError("failed admission must not include value")
  }
  const failure = parseAdmissionFailure(asObject(object.failure, "admission failure"))
  const contract = ADMISSION_FAILURE_CONTRACT[failure.failure_class]

  return observation({
    surface: "chronicle_admission",
    observation_class: contract.observation_class,
    native_status: `admission_${failure.failure_class}`,
    native_reason_code: failure.reason_code,
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

/**
 * Exact production pairs from evaluateChronicleCheckpointContinuityV0 returns.
 */
type ContinuityContractEntry = {
  readonly evaluation_state: ChronicleCheckpointContinuityEvaluationState
  readonly verdict: ChronicleCheckpointContinuityVerdict
  readonly relation: ChronicleCheckpointContinuityRelation
  readonly observation_class: CounterfactualObservationClassV0
}

const CONTINUITY_REASON_CONTRACT: Readonly<
  Record<ChronicleCheckpointContinuityReasonCode, ContinuityContractEntry>
> = {
  current_shape_malformed: {
    evaluation_state: "malformed",
    verdict: null,
    relation: null,
    observation_class: "malformed",
  },
  predecessor_shape_malformed: {
    evaluation_state: "malformed",
    verdict: null,
    relation: null,
    observation_class: "malformed",
  },
  current_local_verifier_failed: {
    evaluation_state: "not_evaluated",
    verdict: null,
    relation: null,
    observation_class: "rejected",
  },
  predecessor_local_verifier_failed: {
    evaluation_state: "not_evaluated",
    verdict: null,
    relation: null,
    observation_class: "rejected",
  },
  predecessor_unknown: {
    evaluation_state: "unverifiable",
    verdict: null,
    relation: null,
    observation_class: "unverifiable",
  },
  genesis: {
    evaluation_state: "evaluated",
    verdict: "valid",
    relation: "genesis",
    observation_class: "affirmative",
  },
  direct_successor: {
    evaluation_state: "evaluated",
    verdict: "valid",
    relation: "successor",
    observation_class: "affirmative",
  },
  predecessor_ref_mismatch: {
    evaluation_state: "evaluated",
    verdict: "invalid",
    relation: null,
    observation_class: "rejected",
  },
  sequence_gap: {
    evaluation_state: "evaluated",
    verdict: "invalid",
    relation: null,
    observation_class: "rejected",
  },
  predecessor_same_sequence: {
    evaluation_state: "evaluated",
    verdict: "invalid",
    relation: null,
    observation_class: "rejected",
  },
  predecessor_higher_sequence: {
    evaluation_state: "evaluated",
    verdict: "invalid",
    relation: null,
    observation_class: "rejected",
  },
}

export function normalizeChronicleContinuityResult(
  result: ChronicleCheckpointContinuityResultV0,
): CounterfactualObservationV0 {
  const object = asObject(result, "ChronicleCheckpointContinuityResultV0")
  const evaluationState = object.evaluation_state
  const reasonCode = object.reason_code
  const verdict = object.verdict === undefined ? null : object.verdict
  const relation = object.relation === undefined ? null : object.relation

  if (typeof evaluationState !== "string") {
    throw new NormalizationContractError("continuity evaluation_state must be a string")
  }
  if (typeof reasonCode !== "string") {
    throw new NormalizationContractError("continuity reason_code must be a string")
  }
  if (!(reasonCode in CONTINUITY_REASON_CONTRACT)) {
    throw new NormalizationContractError(`unknown continuity reason_code: ${reasonCode}`)
  }

  const contract = CONTINUITY_REASON_CONTRACT[reasonCode as ChronicleCheckpointContinuityReasonCode]
  if (evaluationState !== contract.evaluation_state) {
    throw new NormalizationContractError(
      `continuity evaluation_state ${evaluationState} incompatible with reason_code ${reasonCode}`,
    )
  }
  if (verdict !== contract.verdict) {
    throw new NormalizationContractError(
      `continuity verdict ${String(verdict)} incompatible with reason_code ${reasonCode}`,
    )
  }
  if (relation !== contract.relation) {
    throw new NormalizationContractError(
      `continuity relation ${String(relation)} incompatible with reason_code ${reasonCode}`,
    )
  }

  return observation({
    surface: "chronicle_continuity",
    observation_class: contract.observation_class,
    native_status: `${evaluationState}:${reasonCode}`,
    native_reason_code: reasonCode,
    native_detail: {
      evaluation_state: evaluationState,
      verdict,
      relation,
      reason_code: reasonCode,
    },
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

  if (ok && !rootMatches) {
    throw new NormalizationContractError("checkpoint ok:true requires matching roots")
  }

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
