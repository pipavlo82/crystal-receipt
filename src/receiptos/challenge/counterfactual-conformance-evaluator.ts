/**
 * Bound per-challenge counterfactual conformance evaluator v0 (Lane E/F).
 *
 * Executes one canonical Lane D request, normalizes the supplied Lane A
 * expected observation and the returned native observation through Lane C
 * (where supported), and emits:
 * - evaluated conformant
 * - evaluated nonconformant
 * - execution_unresolved (verdict null)
 *
 * Lane F: typed CAB subject_contract_rejected is comparable against frozen
 * CAB expected rejection via closed code→token mapping + deterministic path.
 * Untyped execution_failure remains unresolved (never conformant/nonconformant).
 *
 * Does not:
 * - accept detached/precomputed execution results for bound verdicts
 * - treat execution_failure as verifier rejection/nonconformance
 * - validate expected_result_set_sha256
 * - prove materialized input was derived from source/derivation
 * - synthesize source-artifact validity
 * - parse raw exception strings for classification or comparison
 */

import {
  CAB_CONTRACT_CODE_TO_EXPECTED_MESSAGE_TOKEN,
  COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT,
} from "./counterfactual-audit-boundary"
import {
  COUNTERFACTUAL_OBSERVATION_SCHEMA,
  NormalizationContractError,
  normalizeChronicleAdmissionChallengeExpected,
  normalizeChronicleAdmissionResult,
  normalizeChronicleCheckpointLocalChallengeExpected,
  normalizeChronicleCheckpointLocalResult,
  normalizeChronicleContinuityChallengeExpected,
  normalizeChronicleContinuityResult,
  normalizeCounterfactualAuditBoundaryExpected,
  normalizeVerifyHandoffChallengeExpected,
  normalizeVerifyHandoffReceiptRootResult,
  type CounterfactualObservationV0,
} from "./counterfactual-result-normalization"
import {
  canonicalIdentityJson,
  type CounterfactualChallengeIdentityV0,
} from "./counterfactual-neighborhood"
import type { ChallengeSurfaceKind, VerifierChallengeVectorModelV0 } from "./verifier-challenge-model"
import {
  RunnerContractError,
  runVerifierChallenge,
  type CabNativeResultV0,
  type ExecutionFailureV0,
  type SubjectContractRejectionV0,
  type SubjectContractRejectedResultV0,
  type SubjectReturnedResultV0,
  type VerifierChallengeExecutionResultV0,
  type VerifierChallengeRunRequestV0,
} from "./counterfactual-verifier-runner"

export const COUNTERFACTUAL_CONFORMANCE_EVALUATION_SCHEMA =
  "receiptos.counterfactual_conformance_evaluation.v0" as const

export type CounterfactualConformanceEvaluationSchema =
  typeof COUNTERFACTUAL_CONFORMANCE_EVALUATION_SCHEMA

/**
 * Expected observation authority is the supplied Lane A model only.
 * Lane E does not independently validate aggregate expected_result_set_sha256.
 */
export type ExpectedObservationSourceV0 = "lane_a_model"

export type ConformanceMismatchKindV0 =
  | "observation_class_mismatch"
  | "native_status_mismatch"
  | "native_reason_mismatch"
  | "native_detail_mismatch"
  | "actual_result_out_of_contract"
  | "cab_operation_mismatch"
  | "cab_result_mismatch"
  | "unexpected_subject_contract_rejection"
  | "expected_subject_contract_rejection_missing"
  | "subject_contract_rejection_mismatch"

export type ConformanceMismatchV0 = {
  readonly kind: ConformanceMismatchKindV0
}

export type EvaluatedConformanceResultV0 = {
  readonly schema: CounterfactualConformanceEvaluationSchema
  readonly evaluation_state: "evaluated"
  readonly verdict: "conformant" | "nonconformant"
  readonly challenge: CounterfactualChallengeIdentityV0
  readonly surface: ChallengeSurfaceKind
  readonly expected_observation_source: ExpectedObservationSourceV0
  readonly expected_observation: CounterfactualObservationV0
  readonly actual_observation: CounterfactualObservationV0 | null
  readonly subject_contract_rejection: SubjectContractRejectionV0 | null
  readonly mismatch: ConformanceMismatchV0 | null
  /**
   * Inherited Lane D limitation: materialized input was executed as supplied;
   * derivation from source pin is not proven by this evaluation.
   */
  readonly materialized_input_binding: "caller_supplied_unproven"
}

export type ExecutionUnresolvedConformanceResultV0 = {
  readonly schema: CounterfactualConformanceEvaluationSchema
  readonly evaluation_state: "execution_unresolved"
  readonly verdict: null
  readonly challenge: CounterfactualChallengeIdentityV0
  readonly surface: ChallengeSurfaceKind
  readonly expected_observation_source: ExpectedObservationSourceV0
  readonly execution_failure: ExecutionFailureV0["failure"]
  readonly materialized_input_binding: "caller_supplied_unproven"
}

export type CounterfactualConformanceEvaluationV0 =
  | EvaluatedConformanceResultV0
  | ExecutionUnresolvedConformanceResultV0

export class ConformanceEvaluatorContractError extends Error {
  readonly code = "conformance_evaluator_contract_error" as const
  constructor(message: string) {
    super(message)
    this.name = "ConformanceEvaluatorContractError"
  }
}

function cloneJson<T>(value: T): T {
  return structuredClone(value)
}

function observationsEqual(a: CounterfactualObservationV0, b: CounterfactualObservationV0): boolean {
  return canonicalIdentityJson(a) === canonicalIdentityJson(b)
}

/**
 * Pure normalized-observation comparator.
 * Does not claim bound runner provenance or produce a full challenge-conformance record.
 */
export function compareNormalizedObservations(
  expected: CounterfactualObservationV0,
  actual: CounterfactualObservationV0,
): { readonly equal: boolean; readonly mismatch: ConformanceMismatchV0 | null } {
  if (observationsEqual(expected, actual)) {
    return { equal: true, mismatch: null }
  }
  if (expected.observation_class !== actual.observation_class) {
    return { equal: false, mismatch: { kind: "observation_class_mismatch" } }
  }
  if (expected.native_status !== actual.native_status) {
    return { equal: false, mismatch: { kind: "native_status_mismatch" } }
  }
  if (expected.native_reason_code !== actual.native_reason_code) {
    return { equal: false, mismatch: { kind: "native_reason_mismatch" } }
  }
  return { equal: false, mismatch: { kind: "native_detail_mismatch" } }
}

function requireLaneAModel(request: VerifierChallengeRunRequestV0): VerifierChallengeVectorModelV0 {
  if (!("lane_a_model" in request) || request.lane_a_model === undefined) {
    throw new ConformanceEvaluatorContractError("evaluateVerifierChallengeConformance requires lane_a_model")
  }
  return request.lane_a_model
}

function resolveExpectedPayload(
  request: VerifierChallengeRunRequestV0,
  model: VerifierChallengeVectorModelV0,
): unknown {
  const fromModel = model.expected
  if ("expected" in request && request.expected !== undefined) {
    if (canonicalIdentityJson(request.expected) !== canonicalIdentityJson(fromModel)) {
      throw new ConformanceEvaluatorContractError(
        "request.expected conflicts with lane_a_model.expected",
      )
    }
  }
  return fromModel
}

function normalizeExpectedObservation(
  surface: ChallengeSurfaceKind,
  expected: unknown,
): CounterfactualObservationV0 {
  try {
    switch (surface) {
      case "verify_handoff_receipt_root":
        return normalizeVerifyHandoffChallengeExpected(expected)
      case "chronicle_admission":
        return normalizeChronicleAdmissionChallengeExpected(expected)
      case "chronicle_continuity":
        return normalizeChronicleContinuityChallengeExpected(expected)
      case "chronicle_checkpoint_local":
        return normalizeChronicleCheckpointLocalChallengeExpected(expected)
      case "counterfactual_audit_boundary":
        return normalizeCounterfactualAuditBoundaryExpected(expected)
      default: {
        const _exhaustive: never = surface
        return _exhaustive
      }
    }
  } catch (error) {
    if (error instanceof NormalizationContractError) {
      throw new ConformanceEvaluatorContractError(
        "expected observation failed Lane C expected-side normalization",
      )
    }
    throw error
  }
}

function normalizeActualObservation(
  result: SubjectReturnedResultV0,
):
  | { readonly ok: true; readonly observation: CounterfactualObservationV0 }
  | { readonly ok: false; readonly mismatch: ConformanceMismatchV0 } {
  try {
    switch (result.surface) {
      case "verify_handoff_receipt_root":
        return {
          ok: true,
          observation: normalizeVerifyHandoffReceiptRootResult(result.native_result),
        }
      case "chronicle_admission":
        return { ok: true, observation: normalizeChronicleAdmissionResult(result.native_result) }
      case "chronicle_continuity":
        return { ok: true, observation: normalizeChronicleContinuityResult(result.native_result) }
      case "chronicle_checkpoint_local":
        return {
          ok: true,
          observation: normalizeChronicleCheckpointLocalResult(result.native_result),
        }
      case "counterfactual_audit_boundary":
        throw new ConformanceEvaluatorContractError(
          "internal: CAB actual normalization must use CAB comparison path",
        )
      default: {
        const _exhaustive: never = result
        return _exhaustive
      }
    }
  } catch (error) {
    if (error instanceof NormalizationContractError) {
      return { ok: false, mismatch: { kind: "actual_result_out_of_contract" } }
    }
    throw error
  }
}

function cabActualObservation(
  native: CabNativeResultV0,
  expectedNormalized: CounterfactualObservationV0,
): CounterfactualObservationV0 {
  if (native.operation === "semantic_snapshot") {
    return {
      schema: COUNTERFACTUAL_OBSERVATION_SCHEMA,
      surface: "counterfactual_audit_boundary",
      observation_class: "operation",
      native_status: "accepted_snapshot",
      native_reason_code: null,
      native_detail: {
        operation: "semantic_snapshot",
        canonical_snapshot_json: canonicalIdentityJson(native.snapshot),
      },
    }
  }
  return {
    schema: COUNTERFACTUAL_OBSERVATION_SCHEMA,
    surface: "counterfactual_audit_boundary",
    observation_class: "operation",
    native_status:
      expectedNormalized.native_status === "manifest_hash_value"
        ? "manifest_hash_value"
        : "manifest_file_sha256",
    native_reason_code: null,
    native_detail: {
      operation: "manifest_file_sha256",
      sha256_hex: native.sha256_hex,
    },
  }
}

/**
 * Compare typed CAB rejection against frozen expected rejection fields without
 * reading runtime Error.message. Uses closed code→token mapping + optional path.
 */
export function compareCabSubjectContractRejection(
  expectedNative: unknown,
  rejection: SubjectContractRejectionV0,
): { readonly match: true } | { readonly match: false; readonly mismatch: ConformanceMismatchV0 } {
  if (expectedNative === null || typeof expectedNative !== "object" || Array.isArray(expectedNative)) {
    throw new ConformanceEvaluatorContractError("CAB expected must be a JSON object")
  }
  const expectedObject = expectedNative as Record<string, unknown>
  const outcome = expectedObject.outcome
  if (typeof outcome !== "string") {
    throw new ConformanceEvaluatorContractError("CAB expected.outcome must be a string")
  }
  if (outcome !== "rejected") {
    return { match: false, mismatch: { kind: "unexpected_subject_contract_rejection" } }
  }
  if (rejection.contract !== COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT) {
    return { match: false, mismatch: { kind: "subject_contract_rejection_mismatch" } }
  }
  const token = CAB_CONTRACT_CODE_TO_EXPECTED_MESSAGE_TOKEN[
    rejection.code as keyof typeof CAB_CONTRACT_CODE_TO_EXPECTED_MESSAGE_TOKEN
  ]
  if (token === undefined) {
    return { match: false, mismatch: { kind: "subject_contract_rejection_mismatch" } }
  }
  if (expectedObject.error_message_contains !== token) {
    return { match: false, mismatch: { kind: "subject_contract_rejection_mismatch" } }
  }
  if (typeof expectedObject.error_path === "string") {
    if (rejection.path !== expectedObject.error_path) {
      return { match: false, mismatch: { kind: "subject_contract_rejection_mismatch" } }
    }
  }
  return { match: true }
}

function evaluateCabSubjectReturned(
  expectedNative: unknown,
  expectedObservation: CounterfactualObservationV0,
  native: CabNativeResultV0,
): Pick<
  EvaluatedConformanceResultV0,
  | "verdict"
  | "expected_observation"
  | "actual_observation"
  | "subject_contract_rejection"
  | "mismatch"
> {
  const expectedObject = expectedNative as Record<string, unknown>
  const outcome = expectedObject.outcome
  if (typeof outcome !== "string") {
    throw new ConformanceEvaluatorContractError("CAB expected.outcome must be a string")
  }

  if (outcome === "rejected") {
    return {
      verdict: "nonconformant",
      expected_observation: expectedObservation,
      actual_observation: cabActualObservation(native, expectedObservation),
      subject_contract_rejection: null,
      mismatch: { kind: "expected_subject_contract_rejection_missing" },
    }
  }

  if (native.operation === "semantic_snapshot") {
    if (outcome !== "accepted_snapshot") {
      return {
        verdict: "nonconformant",
        expected_observation: expectedObservation,
        actual_observation: cabActualObservation(native, expectedObservation),
        subject_contract_rejection: null,
        mismatch: { kind: "cab_operation_mismatch" },
      }
    }
    const expectedJson = expectedObject.canonical_snapshot_json
    if (typeof expectedJson !== "string") {
      throw new ConformanceEvaluatorContractError(
        "CAB accepted_snapshot expected requires canonical_snapshot_json",
      )
    }
    const actualJson = canonicalIdentityJson(native.snapshot)
    // Frozen vectors store compact JSON string; compare via parsed canonical form when possible.
    let expectedCanonical = expectedJson
    try {
      expectedCanonical = canonicalIdentityJson(JSON.parse(expectedJson))
    } catch {
      // keep literal string comparison fallback
    }
    const actualObservation = cabActualObservation(native, expectedObservation)
    if (actualJson === expectedCanonical || JSON.stringify(native.snapshot) === expectedJson) {
      return {
        verdict: "conformant",
        expected_observation: expectedObservation,
        actual_observation: actualObservation,
        subject_contract_rejection: null,
        mismatch: null,
      }
    }
    return {
      verdict: "nonconformant",
      expected_observation: expectedObservation,
      actual_observation: actualObservation,
      subject_contract_rejection: null,
      mismatch: { kind: "cab_result_mismatch" },
    }
  }

  // manifest_file_sha256
  if (outcome === "manifest_hash_value") {
    const expectedHash = expectedObject.sha256_hex
    if (typeof expectedHash !== "string") {
      throw new ConformanceEvaluatorContractError("CAB manifest_hash_value expected requires sha256_hex")
    }
    const actualObservation = cabActualObservation(native, expectedObservation)
    if (native.sha256_hex === expectedHash) {
      return {
        verdict: "conformant",
        expected_observation: expectedObservation,
        actual_observation: actualObservation,
        subject_contract_rejection: null,
        mismatch: null,
      }
    }
    return {
      verdict: "nonconformant",
      expected_observation: expectedObservation,
      actual_observation: actualObservation,
      subject_contract_rejection: null,
      mismatch: { kind: "cab_result_mismatch" },
    }
  }

  if (outcome === "manifest_hash_equals" || outcome === "manifest_hash_differs") {
    throw new ConformanceEvaluatorContractError(
      "unsupported CAB comparison: bound request lacks multiple runtime hash operands",
    )
  }

  if (outcome === "accepted_snapshot") {
    return {
      verdict: "nonconformant",
      expected_observation: expectedObservation,
      actual_observation: cabActualObservation(native, expectedObservation),
      subject_contract_rejection: null,
      mismatch: { kind: "cab_operation_mismatch" },
    }
  }

  throw new ConformanceEvaluatorContractError(`unsupported CAB expected outcome: ${outcome}`)
}

function evaluateCabSubjectContractRejected(
  expectedNative: unknown,
  expectedObservation: CounterfactualObservationV0,
  execution: SubjectContractRejectedResultV0,
): Pick<
  EvaluatedConformanceResultV0,
  | "verdict"
  | "expected_observation"
  | "actual_observation"
  | "subject_contract_rejection"
  | "mismatch"
> {
  const compared = compareCabSubjectContractRejection(expectedNative, execution.rejection)
  if (compared.match) {
    return {
      verdict: "conformant",
      expected_observation: expectedObservation,
      actual_observation: null,
      subject_contract_rejection: cloneJson(execution.rejection),
      mismatch: null,
    }
  }
  return {
    verdict: "nonconformant",
    expected_observation: expectedObservation,
    actual_observation: null,
    subject_contract_rejection: cloneJson(execution.rejection),
    mismatch: compared.mismatch,
  }
}

function evaluatedResult(input: {
  challenge: CounterfactualChallengeIdentityV0
  surface: ChallengeSurfaceKind
  verdict: "conformant" | "nonconformant"
  expected_observation: CounterfactualObservationV0
  actual_observation: CounterfactualObservationV0 | null
  subject_contract_rejection: SubjectContractRejectionV0 | null
  mismatch: ConformanceMismatchV0 | null
}): EvaluatedConformanceResultV0 {
  return {
    schema: COUNTERFACTUAL_CONFORMANCE_EVALUATION_SCHEMA,
    evaluation_state: "evaluated",
    verdict: input.verdict,
    challenge: cloneJson(input.challenge),
    surface: input.surface,
    expected_observation_source: "lane_a_model",
    expected_observation: cloneJson(input.expected_observation),
    actual_observation: input.actual_observation === null ? null : cloneJson(input.actual_observation),
    subject_contract_rejection:
      input.subject_contract_rejection === null ? null : cloneJson(input.subject_contract_rejection),
    mismatch: input.mismatch === null ? null : cloneJson(input.mismatch),
    materialized_input_binding: "caller_supplied_unproven",
  }
}

/**
 * Bound evaluator: validates via Lane D, requires Lane A model, executes the
 * same request, then compares expected vs actual for that invocation only.
 */
export async function evaluateVerifierChallengeConformance(
  request: VerifierChallengeRunRequestV0,
): Promise<CounterfactualConformanceEvaluationV0> {
  const model = requireLaneAModel(request)
  const expectedNative = resolveExpectedPayload(request, model)
  const expectedObservation = normalizeExpectedObservation(request.surface, expectedNative)

  // Lane D validates challenge/subject/lane_a_model identity and executes.
  let execution: VerifierChallengeExecutionResultV0
  try {
    execution = await runVerifierChallenge(request)
  } catch (error) {
    // RunnerContractError and unexpected errors must not become conformance verdicts.
    throw error
  }

  const challenge = cloneJson(request.challenge)
  if (challenge.surface !== request.surface) {
    throw new ConformanceEvaluatorContractError("request.surface does not match challenge.surface")
  }

  if (execution.execution_state === "execution_failure") {
    return {
      schema: COUNTERFACTUAL_CONFORMANCE_EVALUATION_SCHEMA,
      evaluation_state: "execution_unresolved",
      verdict: null,
      challenge,
      surface: request.surface,
      expected_observation_source: "lane_a_model",
      execution_failure: cloneJson(execution.failure),
      materialized_input_binding: "caller_supplied_unproven",
    }
  }

  if (execution.surface !== request.surface) {
    throw new ConformanceEvaluatorContractError("execution surface does not match request.surface")
  }

  if (execution.execution_state === "subject_contract_rejected") {
    if (execution.surface !== "counterfactual_audit_boundary") {
      throw new ConformanceEvaluatorContractError(
        "subject_contract_rejected is only defined for counterfactual_audit_boundary in v0",
      )
    }
    const cab = evaluateCabSubjectContractRejected(expectedNative, expectedObservation, execution)
    return evaluatedResult({
      challenge,
      surface: request.surface,
      verdict: cab.verdict,
      expected_observation: cab.expected_observation,
      actual_observation: cab.actual_observation,
      subject_contract_rejection: cab.subject_contract_rejection,
      mismatch: cab.mismatch,
    })
  }

  if (execution.surface === "counterfactual_audit_boundary") {
    const cab = evaluateCabSubjectReturned(
      expectedNative,
      expectedObservation,
      execution.native_result,
    )
    return evaluatedResult({
      challenge,
      surface: request.surface,
      verdict: cab.verdict,
      expected_observation: cab.expected_observation,
      actual_observation: cab.actual_observation,
      subject_contract_rejection: cab.subject_contract_rejection,
      mismatch: cab.mismatch,
    })
  }

  const actual = normalizeActualObservation(execution)
  if (!actual.ok) {
    return evaluatedResult({
      challenge,
      surface: request.surface,
      verdict: "nonconformant",
      expected_observation: expectedObservation,
      actual_observation: null,
      subject_contract_rejection: null,
      mismatch: actual.mismatch,
    })
  }

  const compared = compareNormalizedObservations(expectedObservation, actual.observation)
  if (compared.equal) {
    return evaluatedResult({
      challenge,
      surface: request.surface,
      verdict: "conformant",
      expected_observation: expectedObservation,
      actual_observation: actual.observation,
      subject_contract_rejection: null,
      mismatch: null,
    })
  }
  return evaluatedResult({
    challenge,
    surface: request.surface,
    verdict: "nonconformant",
    expected_observation: expectedObservation,
    actual_observation: actual.observation,
    subject_contract_rejection: null,
    mismatch: compared.mismatch,
  })
}

// Re-export RunnerContractError for callers that only import the evaluator.
export { RunnerContractError }
