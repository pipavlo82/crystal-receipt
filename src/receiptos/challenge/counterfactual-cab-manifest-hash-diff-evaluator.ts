/**
 * Closed Lane E composite evaluation for CAB manifest_hash_differs (v0).
 *
 * Evaluates exactly two already-materialized manifest-hash operands through the
 * existing Lane D `manifest_file_sha256` production path (two ordinary
 * runVerifierChallenge calls). Does not add a Lane D adapter, does not invent
 * operands, and does not perform aggregate neighborhood verdicts.
 *
 * Comparison semantics (after Lane G binding):
 * - both subject_returned with valid hashes, hashes differ → evaluated conformant
 * - both subject_returned with valid hashes, hashes equal → evaluated nonconformant
 *   (mismatch: cab_manifest_hash_difference_mismatch)
 *
 * Execution rule: run operand `first`, then `second` only if `first` returned
 * subject_returned. First-child execution_failure yields execution_unresolved
 * without invoking the second child.
 */

import {
  COUNTERFACTUAL_OBSERVATION_SCHEMA,
  normalizeCounterfactualAuditBoundaryExpected,
  type CounterfactualObservationV0,
} from "./counterfactual-result-normalization"
import {
  canonicalIdentityJson,
  projectCounterfactualChallengeIdentity,
  type CounterfactualChallengeIdentityV0,
} from "./counterfactual-neighborhood"
import {
  ExpectedResultSetBindingError,
  bindExpectedResultSet,
  type AuthenticatedExpectedResultSetBindingV0,
} from "./counterfactual-expected-result-set"
import type { VerifierChallengeVectorModelV0 } from "./verifier-challenge-model"
import {
  COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
  runVerifierChallenge,
  type CabManifestHashRunRequestV0,
  type ExecutionFailureV0,
  type VerifierChallengeExecutionResultV0,
} from "./counterfactual-verifier-runner"

/** Same schema string as Lane E single-vector evaluations. */
const COUNTERFACTUAL_CONFORMANCE_EVALUATION_SCHEMA =
  "receiptos.counterfactual_conformance_evaluation.v0" as const

export const CAB_MANIFEST_HASH_DIFF_EVALUATION_REQUEST_SCHEMA =
  "receiptos.counterfactual_cab_manifest_hash_diff_evaluation_request.v0" as const

export type CabManifestHashDiffEvaluationRequestSchema =
  typeof CAB_MANIFEST_HASH_DIFF_EVALUATION_REQUEST_SCHEMA

export type CabManifestHashDiffOperandV0 = {
  readonly bytes: string | Uint8Array
}

/**
 * Versioned composite carrier. Distinct from VerifierChallengeRunRequestV0.
 * Operand labels are fixed: `first` and `second` only.
 */
export type CabManifestHashDiffEvaluationRequestV0 = {
  readonly schema: CabManifestHashDiffEvaluationRequestSchema
  readonly surface: "counterfactual_audit_boundary"
  readonly evaluation_operation: "manifest_hash_differs"
  readonly challenge: CounterfactualChallengeIdentityV0
  readonly lane_a_model: VerifierChallengeVectorModelV0
  readonly operands: {
    readonly first: CabManifestHashDiffOperandV0
    readonly second: CabManifestHashDiffOperandV0
  }
}

export type CabManifestHashDiffContractReasonV0 =
  | "unsupported_schema"
  | "unsupported_surface"
  | "unsupported_evaluation_operation"
  | "operand_cardinality"
  | "missing_operand"
  | "extra_operand"
  | "invalid_operand_bytes"
  | "challenge_mismatch"
  | "lane_a_model_mismatch"
  | "unsupported_expected_operation"
  | "unexpected_subject_contract_rejected"
  | "malformed_child_native_result"

export class CabManifestHashDiffContractError extends Error {
  readonly code = "cab_manifest_hash_diff_contract_error" as const
  readonly reason: CabManifestHashDiffContractReasonV0

  constructor(reason: CabManifestHashDiffContractReasonV0) {
    super("cab manifest hash diff evaluation contract failed")
    this.name = "CabManifestHashDiffContractError"
    this.reason = reason
  }
}

type EvaluatedCompositeResultV0 = {
  readonly schema: typeof COUNTERFACTUAL_CONFORMANCE_EVALUATION_SCHEMA
  readonly evaluation_state: "evaluated"
  readonly verdict: "conformant" | "nonconformant"
  readonly challenge: CounterfactualChallengeIdentityV0
  readonly surface: "counterfactual_audit_boundary"
  readonly expected_observation_source: "lane_a_model"
  readonly expected_result_set_binding: AuthenticatedExpectedResultSetBindingV0
  readonly expected_observation: CounterfactualObservationV0
  readonly actual_observation: CounterfactualObservationV0
  readonly subject_contract_rejection: null
  readonly mismatch: { readonly kind: "cab_manifest_hash_difference_mismatch" } | null
  readonly materialized_input_binding: "caller_supplied_unproven"
}

type UnresolvedCompositeResultV0 = {
  readonly schema: typeof COUNTERFACTUAL_CONFORMANCE_EVALUATION_SCHEMA
  readonly evaluation_state: "execution_unresolved"
  readonly verdict: null
  readonly challenge: CounterfactualChallengeIdentityV0
  readonly surface: "counterfactual_audit_boundary"
  readonly expected_observation_source: "lane_a_model"
  readonly execution_failure: ExecutionFailureV0["failure"]
  readonly materialized_input_binding: "caller_supplied_unproven"
}

export type CabManifestHashDiffEvaluationResultV0 =
  | EvaluatedCompositeResultV0
  | UnresolvedCompositeResultV0

function cloneJson<T>(value: T): T {
  return structuredClone(value)
}

function assertExactOperandKeys(operands: unknown): asserts operands is {
  first: CabManifestHashDiffOperandV0
  second: CabManifestHashDiffOperandV0
} {
  if (operands === null || typeof operands !== "object" || Array.isArray(operands)) {
    throw new CabManifestHashDiffContractError("operand_cardinality")
  }
  const record = operands as Record<string, unknown>
  const keys = Object.keys(record).sort()
  if (keys.length > 2) {
    throw new CabManifestHashDiffContractError("extra_operand")
  }
  if (!("first" in record) || !("second" in record)) {
    throw new CabManifestHashDiffContractError("missing_operand")
  }
  if (keys.length !== 2 || keys[0] !== "first" || keys[1] !== "second") {
    throw new CabManifestHashDiffContractError("extra_operand")
  }
}

function assertMaterializedBytes(bytes: unknown): asserts bytes is string | Uint8Array {
  if (typeof bytes === "string") return
  if (bytes instanceof Uint8Array) return
  throw new CabManifestHashDiffContractError("invalid_operand_bytes")
}

function validateCompositeRequest(request: unknown): CabManifestHashDiffEvaluationRequestV0 {
  if (request === null || typeof request !== "object" || Array.isArray(request)) {
    throw new CabManifestHashDiffContractError("unsupported_schema")
  }
  const object = request as Record<string, unknown>
  if (object.schema !== CAB_MANIFEST_HASH_DIFF_EVALUATION_REQUEST_SCHEMA) {
    throw new CabManifestHashDiffContractError("unsupported_schema")
  }
  if (object.surface !== "counterfactual_audit_boundary") {
    throw new CabManifestHashDiffContractError("unsupported_surface")
  }
  if (object.evaluation_operation !== "manifest_hash_differs") {
    throw new CabManifestHashDiffContractError("unsupported_evaluation_operation")
  }
  if (object.challenge === null || typeof object.challenge !== "object" || Array.isArray(object.challenge)) {
    throw new CabManifestHashDiffContractError("challenge_mismatch")
  }
  if (
    object.lane_a_model === null ||
    typeof object.lane_a_model !== "object" ||
    Array.isArray(object.lane_a_model)
  ) {
    throw new CabManifestHashDiffContractError("lane_a_model_mismatch")
  }

  const challenge = object.challenge as CounterfactualChallengeIdentityV0
  const model = object.lane_a_model as VerifierChallengeVectorModelV0

  if (challenge.surface !== "counterfactual_audit_boundary") {
    throw new CabManifestHashDiffContractError("challenge_mismatch")
  }
  if (challenge.subject !== null || challenge.challenge_id !== null) {
    throw new CabManifestHashDiffContractError("challenge_mismatch")
  }
  if (
    challenge.derivation.kind !== "audit_boundary_operation" ||
    challenge.derivation.operation !== "manifest_file_sha256"
  ) {
    throw new CabManifestHashDiffContractError("challenge_mismatch")
  }

  const projected = projectCounterfactualChallengeIdentity(model)
  if (canonicalIdentityJson(projected) !== canonicalIdentityJson(challenge)) {
    throw new CabManifestHashDiffContractError("lane_a_model_mismatch")
  }

  assertExactOperandKeys(object.operands)
  const first = object.operands.first
  const second = object.operands.second
  if (first === null || typeof first !== "object" || Array.isArray(first) || !("bytes" in first)) {
    throw new CabManifestHashDiffContractError("missing_operand")
  }
  if (second === null || typeof second !== "object" || Array.isArray(second) || !("bytes" in second)) {
    throw new CabManifestHashDiffContractError("missing_operand")
  }
  // Type-check materialized carriers without copying values so Lane D still
  // observes live getters during child input materialization.
  assertMaterializedBytes(first.bytes)
  assertMaterializedBytes(second.bytes)

  return {
    schema: CAB_MANIFEST_HASH_DIFF_EVALUATION_REQUEST_SCHEMA,
    surface: "counterfactual_audit_boundary",
    evaluation_operation: "manifest_hash_differs",
    challenge,
    lane_a_model: model,
    operands: {
      first: first as CabManifestHashDiffOperandV0,
      second: second as CabManifestHashDiffOperandV0,
    },
  }
}

function buildChildRequest(
  challenge: CounterfactualChallengeIdentityV0,
  model: VerifierChallengeVectorModelV0,
  operand: CabManifestHashDiffOperandV0,
): CabManifestHashRunRequestV0 {
  return {
    schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
    surface: "counterfactual_audit_boundary",
    subject: null,
    operation: "manifest_file_sha256",
    challenge,
    lane_a_model: model,
    // Pass the operand object through so bytes getters fire inside Lane D.
    input: operand,
  }
}

function extractManifestHash(execution: VerifierChallengeExecutionResultV0): string {
  if (execution.execution_state === "execution_failure") {
    throw new Error("internal: extractManifestHash called on execution_failure")
  }
  if (execution.execution_state === "subject_contract_rejected") {
    throw new CabManifestHashDiffContractError("unexpected_subject_contract_rejected")
  }
  if (execution.surface !== "counterfactual_audit_boundary") {
    throw new CabManifestHashDiffContractError("malformed_child_native_result")
  }
  const native = execution.native_result
  if (native.operation !== "manifest_file_sha256" || typeof native.sha256_hex !== "string") {
    throw new CabManifestHashDiffContractError("malformed_child_native_result")
  }
  if (!/^[0-9a-f]{64}$/.test(native.sha256_hex)) {
    throw new CabManifestHashDiffContractError("malformed_child_native_result")
  }
  return native.sha256_hex
}

function comparisonObservation(
  hashesEqual: boolean,
  firstHash: string,
  secondHash: string,
): CounterfactualObservationV0 {
  return {
    schema: COUNTERFACTUAL_OBSERVATION_SCHEMA,
    surface: "counterfactual_audit_boundary",
    observation_class: "operation",
    native_status: hashesEqual ? "manifest_hash_equals" : "manifest_hash_differs",
    native_reason_code: null,
    native_detail: {
      operation: "manifest_file_sha256",
      operand_count: 2,
      hashes_equal: hashesEqual,
      first_sha256_hex: firstHash,
      second_sha256_hex: secondHash,
    },
  }
}

function unresolvedResult(
  challenge: CounterfactualChallengeIdentityV0,
  failure: ExecutionFailureV0["failure"],
): UnresolvedCompositeResultV0 {
  return {
    schema: COUNTERFACTUAL_CONFORMANCE_EVALUATION_SCHEMA,
    evaluation_state: "execution_unresolved",
    verdict: null,
    challenge: cloneJson(challenge),
    surface: "counterfactual_audit_boundary",
    expected_observation_source: "lane_a_model",
    execution_failure: cloneJson(failure),
    materialized_input_binding: "caller_supplied_unproven",
  }
}

function evaluatedResult(input: {
  challenge: CounterfactualChallengeIdentityV0
  verdict: "conformant" | "nonconformant"
  expected_result_set_binding: AuthenticatedExpectedResultSetBindingV0
  expected_observation: CounterfactualObservationV0
  actual_observation: CounterfactualObservationV0
  mismatch: { readonly kind: "cab_manifest_hash_difference_mismatch" } | null
}): EvaluatedCompositeResultV0 {
  return {
    schema: COUNTERFACTUAL_CONFORMANCE_EVALUATION_SCHEMA,
    evaluation_state: "evaluated",
    verdict: input.verdict,
    challenge: cloneJson(input.challenge),
    surface: "counterfactual_audit_boundary",
    expected_observation_source: "lane_a_model",
    expected_result_set_binding: cloneJson(input.expected_result_set_binding),
    expected_observation: cloneJson(input.expected_observation),
    actual_observation: cloneJson(input.actual_observation),
    subject_contract_rejection: null,
    mismatch: input.mismatch === null ? null : cloneJson(input.mismatch),
    materialized_input_binding: "caller_supplied_unproven",
  }
}

/**
 * Evaluate a two-operand CAB manifest_hash_differs assertion through Lane G +
 * two Lane D manifest_file_sha256 runs + Lane E comparison.
 */
export async function evaluateCabManifestHashDiffConformance(
  request: CabManifestHashDiffEvaluationRequestV0,
): Promise<CabManifestHashDiffEvaluationResultV0> {
  const validated = validateCompositeRequest(request)
  const model = validated.lane_a_model
  const challenge = validated.challenge
  const expectedNative = model.expected

  // Lane G once, before either child execution.
  let expectedResultSetBinding: AuthenticatedExpectedResultSetBindingV0
  try {
    expectedResultSetBinding = bindExpectedResultSet(model)
  } catch (error) {
    if (error instanceof ExpectedResultSetBindingError) throw error
    throw error
  }

  if (
    expectedNative === null ||
    typeof expectedNative !== "object" ||
    Array.isArray(expectedNative) ||
    (expectedNative as { outcome?: unknown }).outcome !== "manifest_hash_differs"
  ) {
    throw new CabManifestHashDiffContractError("unsupported_expected_operation")
  }

  const expectedObservation = normalizeCounterfactualAuditBoundaryExpected(expectedNative)

  const firstExecution = await runVerifierChallenge(
    buildChildRequest(challenge, model, validated.operands.first),
  )
  if (firstExecution.execution_state === "execution_failure") {
    return unresolvedResult(challenge, firstExecution.failure)
  }
  if (firstExecution.execution_state === "subject_contract_rejected") {
    throw new CabManifestHashDiffContractError("unexpected_subject_contract_rejected")
  }
  const firstHash = extractManifestHash(firstExecution)

  const secondExecution = await runVerifierChallenge(
    buildChildRequest(challenge, model, validated.operands.second),
  )
  if (secondExecution.execution_state === "execution_failure") {
    return unresolvedResult(challenge, secondExecution.failure)
  }
  if (secondExecution.execution_state === "subject_contract_rejected") {
    throw new CabManifestHashDiffContractError("unexpected_subject_contract_rejected")
  }
  const secondHash = extractManifestHash(secondExecution)

  const hashesEqual = firstHash === secondHash
  const actualObservation = comparisonObservation(hashesEqual, firstHash, secondHash)

  if (!hashesEqual) {
    return evaluatedResult({
      challenge,
      verdict: "conformant",
      expected_result_set_binding: expectedResultSetBinding,
      expected_observation: expectedObservation,
      actual_observation: actualObservation,
      mismatch: null,
    })
  }

  return evaluatedResult({
    challenge,
    verdict: "nonconformant",
    expected_result_set_binding: expectedResultSetBinding,
    expected_observation: expectedObservation,
    actual_observation: actualObservation,
    mismatch: { kind: "cab_manifest_hash_difference_mismatch" },
  })
}

export { ExpectedResultSetBindingError }
