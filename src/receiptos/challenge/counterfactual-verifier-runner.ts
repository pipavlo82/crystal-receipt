/**
 * Bounded generalized verifier adapter/runner v0 (Lane D).
 *
 * Executes explicitly registered pinned ReceiptOS adapters for the current
 * frozen verifier-challenge surfaces. Returns one of:
 * - subject_returned
 * - subject_contract_rejected (typed CAB contract rejection only, v0)
 * - execution_failure
 *
 * Production boundary:
 * - immutable closed adapter registry (no caller-supplied invoker overrides)
 * - request bound to canonical Lane A/B challenge identity
 * - expected outcomes never consulted for dispatch
 * - execution_failure diagnostics are bounded and host-string-safe
 * - CAB stages separated: binding → input materialization → subject → output clone
 * - typed CAB rejection only from the subject-invocation catch via opaque extractor
 */

import type { HandoffEvidence, HandoffReceiptVerification } from "../schema/types"
import { verifyHandoffReceiptRoot } from "../verify/verify-receipt"
import {
  tryCreateChronicleEntryV0,
  verifyChronicleCheckpointV0,
  type ChronicleCheckpointV0,
  type ChronicleCheckpointVerification,
  type ChronicleEntryV0,
  type TryCreateChronicleEntryV0Result,
} from "../capsule/chronicle-portfolio-v0"
import type { PortableProofObjectV0 } from "../capsule/portable-proof-object-v0"
import {
  evaluateChronicleCheckpointContinuityV0,
  type ChronicleCheckpointContinuityResultV0,
} from "../capsule/chronicle-checkpoint-continuity-v0"
import {
  computeCounterfactualManifestFileSha256,
  extractCabContractRejection,
  snapshotCounterfactualSemanticJson,
  type CabContractRejectionEvidenceV0,
  type CounterfactualSemanticJson,
} from "./counterfactual-audit-boundary"
import type {
  ChallengeSurfaceKind,
  SubjectEntrypointIdentity,
  VerifierChallengeVectorModelV0,
} from "./verifier-challenge-model"
import {
  COUNTERFACTUAL_CHALLENGE_IDENTITY_SCHEMA,
  canonicalIdentityJson,
  projectCounterfactualChallengeIdentity,
  type CounterfactualChallengeIdentityV0,
} from "./counterfactual-neighborhood"
import {
  normalizeChronicleAdmissionResult,
  normalizeChronicleCheckpointLocalResult,
  normalizeChronicleContinuityResult,
  normalizeVerifyHandoffReceiptRootResult,
  type CounterfactualObservationV0,
} from "./counterfactual-result-normalization"

export const COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA = "receiptos.counterfactual_verifier_runner.v0" as const

export type CounterfactualVerifierRunnerSchema = typeof COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA

/** Explicit v0 identifier for the Lane D/F execution-outcome union. */
export const COUNTERFACTUAL_EXECUTION_OUTCOME_SCHEMA =
  "receiptos.counterfactual_execution_outcome.v0" as const

export type CounterfactualExecutionOutcomeSchema = typeof COUNTERFACTUAL_EXECUTION_OUTCOME_SCHEMA

// --- Registered adapter identities (finite, production-closed) ----------------

export const VERIFY_HANDOFF_ADAPTER_IDENTITY = Object.freeze({
  surface: "verify_handoff_receipt_root",
  entrypoint: "verifyHandoffReceiptRoot",
  module_path: "src/receiptos/verify/verify-receipt.ts",
  git_blob_oid: "2e2e45bf30529de93eac58a04465f17ef81edeaa",
} as const satisfies SubjectEntrypointIdentity & { surface: ChallengeSurfaceKind })

export const CHRONICLE_ADMISSION_ADAPTER_IDENTITY = Object.freeze({
  surface: "chronicle_admission",
  entrypoint: "tryCreateChronicleEntryV0",
  module_path: "src/receiptos/capsule/chronicle-portfolio-v0.ts",
  git_blob_oid: "0e790911092546c62344f980e6b611542bcd00fe",
} as const satisfies SubjectEntrypointIdentity & { surface: ChallengeSurfaceKind })

export const CHRONICLE_CONTINUITY_ADAPTER_IDENTITY = Object.freeze({
  surface: "chronicle_continuity",
  entrypoint: "evaluateChronicleCheckpointContinuityV0",
  module_path: "src/receiptos/capsule/chronicle-checkpoint-continuity-v0.ts",
  git_blob_oid: "428923f10aac54bfaaebedfad494118cbb17d744",
} as const satisfies SubjectEntrypointIdentity & { surface: ChallengeSurfaceKind })

export const CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY = Object.freeze({
  surface: "chronicle_checkpoint_local",
  entrypoint: "verifyChronicleCheckpointV0",
  module_path: "src/receiptos/capsule/chronicle-portfolio-v0.ts",
  git_blob_oid: "0e790911092546c62344f980e6b611542bcd00fe",
} as const satisfies SubjectEntrypointIdentity & { surface: ChallengeSurfaceKind })

export const CAB_ADAPTER_OPERATIONS = Object.freeze(["semantic_snapshot", "manifest_file_sha256"] as const)
export type CabAdapterOperationV0 = (typeof CAB_ADAPTER_OPERATIONS)[number]

export const CAB_ADAPTER_IDENTITY = Object.freeze({
  surface: "counterfactual_audit_boundary",
  subject: null,
  challenge_id: null,
  module_path: "src/receiptos/challenge/counterfactual-audit-boundary.ts",
  operations: CAB_ADAPTER_OPERATIONS,
} as const)

type ChallengeCarrier = {
  /** Canonical Lane B challenge identity (identity-significant fields only). */
  readonly challenge: CounterfactualChallengeIdentityV0
  /**
   * Optional Lane A model. If present, its Lane B projection must equal
   * `challenge` exactly. Expected/native fields are never read for dispatch.
   */
  readonly lane_a_model?: VerifierChallengeVectorModelV0
  /** Optional expected payload. Execution must ignore it completely. */
  readonly expected?: unknown
}

export type VerifyHandoffRunRequestV0 = ChallengeCarrier & {
  readonly schema: CounterfactualVerifierRunnerSchema
  readonly surface: "verify_handoff_receipt_root"
  readonly subject: SubjectEntrypointIdentity
  readonly input: {
    readonly evidence: HandoffEvidence
  }
}

export type ChronicleAdmissionRunRequestV0 = ChallengeCarrier & {
  readonly schema: CounterfactualVerifierRunnerSchema
  readonly surface: "chronicle_admission"
  readonly subject: SubjectEntrypointIdentity
  readonly input: {
    readonly evidence: HandoffEvidence
    readonly proof_object: PortableProofObjectV0
    readonly options?: {
      readonly entryId?: string
      readonly evidenceCapsuleRef?: string
      readonly provenanceSummaryRef?: string
      readonly createdFrom?: string | null
      readonly labels?: string[]
      readonly notes?: string | null
    }
  }
}

export type ChronicleContinuityRunRequestV0 = ChallengeCarrier & {
  readonly schema: CounterfactualVerifierRunnerSchema
  readonly surface: "chronicle_continuity"
  readonly subject: SubjectEntrypointIdentity
  readonly input: {
    readonly current: ChronicleCheckpointV0
    readonly predecessor: ChronicleCheckpointV0 | null
  }
}

export type ChronicleCheckpointLocalRunRequestV0 = ChallengeCarrier & {
  readonly schema: CounterfactualVerifierRunnerSchema
  readonly surface: "chronicle_checkpoint_local"
  readonly subject: SubjectEntrypointIdentity
  readonly input: {
    readonly checkpoint: ChronicleCheckpointV0
  }
}

export type CabSemanticSnapshotRunRequestV0 = ChallengeCarrier & {
  readonly schema: CounterfactualVerifierRunnerSchema
  readonly surface: "counterfactual_audit_boundary"
  readonly subject: null
  readonly operation: "semantic_snapshot"
  readonly input: {
    readonly value: unknown
  }
}

export type CabManifestHashRunRequestV0 = ChallengeCarrier & {
  readonly schema: CounterfactualVerifierRunnerSchema
  readonly surface: "counterfactual_audit_boundary"
  readonly subject: null
  readonly operation: "manifest_file_sha256"
  readonly input: {
    readonly bytes: string | Uint8Array
  }
}

export type VerifierChallengeRunRequestV0 =
  | VerifyHandoffRunRequestV0
  | ChronicleAdmissionRunRequestV0
  | ChronicleContinuityRunRequestV0
  | ChronicleCheckpointLocalRunRequestV0
  | CabSemanticSnapshotRunRequestV0
  | CabManifestHashRunRequestV0

export type CabNativeResultV0 =
  | {
      readonly operation: "semantic_snapshot"
      readonly snapshot: CounterfactualSemanticJson
    }
  | {
      readonly operation: "manifest_file_sha256"
      readonly sha256_hex: string
    }

export type SubjectReturnedResultV0 =
  | {
      readonly execution_state: "subject_returned"
      readonly surface: "verify_handoff_receipt_root"
      readonly native_result: HandoffReceiptVerification
    }
  | {
      readonly execution_state: "subject_returned"
      readonly surface: "chronicle_admission"
      readonly native_result: TryCreateChronicleEntryV0Result
    }
  | {
      readonly execution_state: "subject_returned"
      readonly surface: "chronicle_continuity"
      readonly native_result: ChronicleCheckpointContinuityResultV0
    }
  | {
      readonly execution_state: "subject_returned"
      readonly surface: "chronicle_checkpoint_local"
      readonly native_result: ChronicleCheckpointVerification
    }
  | {
      readonly execution_state: "subject_returned"
      readonly surface: "counterfactual_audit_boundary"
      readonly native_result: CabNativeResultV0
    }

export type ExecutionFailureKindV0 = "thrown_error" | "non_error_throw"

export type BoundedExecutionErrorNameV0 =
  | "Error"
  | "TypeError"
  | "RangeError"
  | "SyntaxError"
  | "ReferenceError"
  | "NonErrorThrow"

export type ExecutionFailureV0 = {
  readonly execution_state: "execution_failure"
  readonly surface: ChallengeSurfaceKind
  readonly failure: {
    readonly failure_stage: "subject_invocation"
    readonly failure_kind: ExecutionFailureKindV0
    readonly error_name: BoundedExecutionErrorNameV0
    readonly safe_message: "subject invocation failed" | "subject produced a non-error throw"
  }
}

/**
 * Bounded typed CAB subject-contract rejection evidence.
 * Identity is contract + code + path — never Error.message / stack.
 */
export type SubjectContractRejectionV0 = CabContractRejectionEvidenceV0

export type SubjectContractRejectedResultV0 = {
  readonly execution_state: "subject_contract_rejected"
  readonly surface: "counterfactual_audit_boundary"
  readonly rejection: SubjectContractRejectionV0
}

export type VerifierChallengeExecutionResultV0 =
  | SubjectReturnedResultV0
  | SubjectContractRejectedResultV0
  | ExecutionFailureV0

export class RunnerContractError extends Error {
  readonly code = "runner_contract_error" as const
  constructor(message: string) {
    super(message)
    this.name = "RunnerContractError"
  }
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new RunnerContractError(`${label} must be a JSON object`)
  }
  return value as Record<string, unknown>
}

function requireString(object: Record<string, unknown>, key: string, label: string): string {
  const value = object[key]
  if (typeof value !== "string" || value.length === 0) {
    throw new RunnerContractError(`${label}.${key} must be a non-empty string`)
  }
  return value
}

function subjectsEqual(a: SubjectEntrypointIdentity | null, b: SubjectEntrypointIdentity | null): boolean {
  if (a === null || b === null) return a === b
  return (
    a.entrypoint === b.entrypoint &&
    a.module_path === b.module_path &&
    a.git_blob_oid === b.git_blob_oid
  )
}

function subjectMatchesRegistered(
  declared: SubjectEntrypointIdentity,
  registered: SubjectEntrypointIdentity,
  surface: string,
): void {
  if (declared.entrypoint !== registered.entrypoint) {
    throw new RunnerContractError(`${surface} entrypoint mismatch`)
  }
  if (declared.module_path !== registered.module_path) {
    throw new RunnerContractError(`${surface} module_path mismatch`)
  }
  if (declared.git_blob_oid !== registered.git_blob_oid) {
    throw new RunnerContractError(`${surface} git_blob_oid mismatch`)
  }
}

function parseSubject(value: unknown, label: string): SubjectEntrypointIdentity | null {
  if (value === null) return null
  const object = asObject(value, label)
  return {
    entrypoint: requireString(object, "entrypoint", label),
    module_path: requireString(object, "module_path", label),
    git_blob_oid: requireString(object, "git_blob_oid", label),
  }
}

function parseSource(value: unknown): CounterfactualChallengeIdentityV0["source"] {
  if (value === null) return null
  const object = asObject(value, "challenge.source")
  return {
    repository_path: requireString(object, "repository_path", "challenge.source"),
    git_blob_oid: requireString(object, "git_blob_oid", "challenge.source"),
  }
}

function parseDerivation(value: unknown): CounterfactualChallengeIdentityV0["derivation"] {
  const object = asObject(value, "challenge.derivation")
  const kind = requireString(object, "kind", "challenge.derivation")
  if (kind === "path_mutation") {
    const path = object.path
    if (!Array.isArray(path) || path.some((segment) => typeof segment !== "string")) {
      throw new RunnerContractError("challenge.derivation.path must be string[]")
    }
    if (!Object.prototype.hasOwnProperty.call(object, "from") || !Object.prototype.hasOwnProperty.call(object, "to")) {
      throw new RunnerContractError("challenge.derivation path_mutation requires from/to")
    }
    return {
      kind: "path_mutation",
      operation: requireString(object, "operation", "challenge.derivation"),
      path: path.slice() as string[],
      from: structuredClone(object.from),
      to: structuredClone(object.to),
    }
  }
  if (kind === "substitution") {
    if (!("value" in object)) {
      throw new RunnerContractError("challenge.derivation substitution requires value")
    }
    return { kind: "substitution", value: structuredClone(object.value) }
  }
  if (kind === "audit_boundary_operation") {
    return {
      kind: "audit_boundary_operation",
      operation: requireString(object, "operation", "challenge.derivation"),
    }
  }
  throw new RunnerContractError(`unsupported challenge.derivation.kind: ${kind}`)
}

function parseChallengeIdentity(value: unknown): CounterfactualChallengeIdentityV0 {
  const object = asObject(value, "challenge")
  if (object.schema !== COUNTERFACTUAL_CHALLENGE_IDENTITY_SCHEMA) {
    throw new RunnerContractError("challenge.schema must be receiptos.counterfactual_challenge_identity.v0")
  }
  const surface = requireString(object, "surface", "challenge") as ChallengeSurfaceKind
  const allowed: ChallengeSurfaceKind[] = [
    "verify_handoff_receipt_root",
    "chronicle_admission",
    "chronicle_continuity",
    "chronicle_checkpoint_local",
    "counterfactual_audit_boundary",
  ]
  if (!allowed.includes(surface)) {
    throw new RunnerContractError(`unsupported challenge.surface: ${surface}`)
  }
  return {
    schema: COUNTERFACTUAL_CHALLENGE_IDENTITY_SCHEMA,
    native_schema: requireString(object, "native_schema", "challenge"),
    package_version: requireString(object, "package_version", "challenge"),
    vector_id: requireString(object, "vector_id", "challenge"),
    challenge_id:
      object.challenge_id === null ? null : requireString(object, "challenge_id", "challenge"),
    execution_class: requireString(object, "execution_class", "challenge"),
    surface,
    subject: parseSubject(object.subject, "challenge.subject"),
    source: parseSource(object.source),
    derivation: parseDerivation(object.derivation),
  }
}

function validateLaneAModelConsistency(
  challenge: CounterfactualChallengeIdentityV0,
  laneAModel: unknown,
): void {
  if (laneAModel === undefined) return
  if (laneAModel === null || typeof laneAModel !== "object" || Array.isArray(laneAModel)) {
    throw new RunnerContractError("lane_a_model must be a VerifierChallengeVectorModelV0 object")
  }
  let projected: CounterfactualChallengeIdentityV0
  try {
    projected = projectCounterfactualChallengeIdentity(laneAModel as VerifierChallengeVectorModelV0)
  } catch {
    throw new RunnerContractError("lane_a_model is not a valid Lane A model for identity projection")
  }
  if (canonicalIdentityJson(projected) !== canonicalIdentityJson(challenge)) {
    throw new RunnerContractError("lane_a_model projection does not match challenge identity")
  }
}

function validateNonCabBinding(
  requestSurface: ChallengeSurfaceKind,
  requestSubject: SubjectEntrypointIdentity,
  challenge: CounterfactualChallengeIdentityV0,
  registered: SubjectEntrypointIdentity & { surface: ChallengeSurfaceKind },
): void {
  if (challenge.surface !== requestSurface) {
    throw new RunnerContractError("request.surface does not match challenge.surface")
  }
  if (challenge.subject === null) {
    throw new RunnerContractError(`${requestSurface} requires non-null challenge.subject`)
  }
  if (!subjectsEqual(requestSubject, challenge.subject)) {
    throw new RunnerContractError("request.subject does not match challenge.subject")
  }
  if (challenge.surface !== registered.surface) {
    throw new RunnerContractError("challenge.surface is unsupported by registered adapter")
  }
  subjectMatchesRegistered(requestSubject, registered, requestSurface)
}

function validateCabBinding(
  request: CabSemanticSnapshotRunRequestV0 | CabManifestHashRunRequestV0,
  challenge: CounterfactualChallengeIdentityV0,
): void {
  if (request.surface !== "counterfactual_audit_boundary") {
    throw new RunnerContractError("CAB request.surface must be counterfactual_audit_boundary")
  }
  if (challenge.surface !== "counterfactual_audit_boundary") {
    throw new RunnerContractError("request.surface does not match challenge.surface")
  }
  if (request.subject !== null) {
    throw new RunnerContractError("counterfactual_audit_boundary requires subject:null")
  }
  if (challenge.subject !== null) {
    throw new RunnerContractError("counterfactual_audit_boundary requires challenge.subject:null")
  }
  if (challenge.challenge_id !== null) {
    throw new RunnerContractError("counterfactual_audit_boundary requires challenge.challenge_id:null")
  }
  if (challenge.derivation.kind !== "audit_boundary_operation") {
    throw new RunnerContractError("CAB challenge.derivation must be audit_boundary_operation")
  }
  if (challenge.derivation.operation !== request.operation) {
    throw new RunnerContractError("CAB challenge.derivation.operation does not match request.operation")
  }
}

function validateEnvelope(request: unknown): {
  object: Record<string, unknown>
  challenge: CounterfactualChallengeIdentityV0
} {
  const object = asObject(request, "VerifierChallengeRunRequestV0")
  if (object.schema !== COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA) {
    throw new RunnerContractError("unsupported runner request schema")
  }
  const challenge = parseChallengeIdentity(object.challenge)
  validateLaneAModelConsistency(challenge, object.lane_a_model)
  return { object, challenge }
}

function toExecutionFailure(surface: ChallengeSurfaceKind, thrown: unknown): ExecutionFailureV0 {
  if (thrown instanceof Error) {
    const known: BoundedExecutionErrorNameV0[] = [
      "Error",
      "TypeError",
      "RangeError",
      "SyntaxError",
      "ReferenceError",
    ]
    const name = known.includes(thrown.name as BoundedExecutionErrorNameV0)
      ? (thrown.name as BoundedExecutionErrorNameV0)
      : "Error"
    return {
      execution_state: "execution_failure",
      surface,
      failure: {
        failure_stage: "subject_invocation",
        failure_kind: "thrown_error",
        error_name: name,
        safe_message: "subject invocation failed",
      },
    }
  }
  return {
    execution_state: "execution_failure",
    surface,
    failure: {
      failure_stage: "subject_invocation",
      failure_kind: "non_error_throw",
      error_name: "NonErrorThrow",
      safe_message: "subject produced a non-error throw",
    },
  }
}

/**
 * Classify a throw that crossed the CAB production subject-invocation boundary
 * only. Adapter-stage failures must never call this.
 */
function classifyCabSubjectInvocationThrow(
  thrown: unknown,
): SubjectContractRejectedResultV0 | ExecutionFailureV0 {
  const rejection = extractCabContractRejection(thrown)
  if (rejection !== null) {
    return {
      execution_state: "subject_contract_rejected",
      surface: "counterfactual_audit_boundary",
      rejection,
    }
  }
  return toExecutionFailure("counterfactual_audit_boundary", thrown)
}

function cloneJson<T>(value: T): T {
  return structuredClone(value)
}

// --- Immutable closed production registry ------------------------------------

const PRODUCTION_INVOKERS = Object.freeze({
  verify_handoff_receipt_root: Object.freeze(verifyHandoffReceiptRoot),
  chronicle_admission: Object.freeze(tryCreateChronicleEntryV0),
  chronicle_continuity: Object.freeze(evaluateChronicleCheckpointContinuityV0),
  chronicle_checkpoint_local: Object.freeze(verifyChronicleCheckpointV0),
  cab_semantic_snapshot: Object.freeze(snapshotCounterfactualSemanticJson),
  cab_manifest_hash: Object.freeze(computeCounterfactualManifestFileSha256),
})

async function runVerifyHandoff(
  request: VerifyHandoffRunRequestV0,
  challenge: CounterfactualChallengeIdentityV0,
): Promise<VerifierChallengeExecutionResultV0> {
  validateNonCabBinding(request.surface, request.subject, challenge, VERIFY_HANDOFF_ADAPTER_IDENTITY)
  const evidence = cloneJson(request.input.evidence)
  try {
    const native_result = await PRODUCTION_INVOKERS.verify_handoff_receipt_root(evidence)
    return {
      execution_state: "subject_returned",
      surface: "verify_handoff_receipt_root",
      native_result: cloneJson(native_result),
    }
  } catch (error) {
    return toExecutionFailure("verify_handoff_receipt_root", error)
  }
}

function runChronicleAdmission(
  request: ChronicleAdmissionRunRequestV0,
  challenge: CounterfactualChallengeIdentityV0,
): VerifierChallengeExecutionResultV0 {
  validateNonCabBinding(request.surface, request.subject, challenge, CHRONICLE_ADMISSION_ADAPTER_IDENTITY)
  const evidence = cloneJson(request.input.evidence)
  const proofObject = cloneJson(request.input.proof_object)
  const options = request.input.options === undefined ? undefined : cloneJson(request.input.options)
  try {
    const native_result = PRODUCTION_INVOKERS.chronicle_admission(evidence, proofObject, options)
    return {
      execution_state: "subject_returned",
      surface: "chronicle_admission",
      native_result: cloneJson(native_result),
    }
  } catch (error) {
    return toExecutionFailure("chronicle_admission", error)
  }
}

function runChronicleContinuity(
  request: ChronicleContinuityRunRequestV0,
  challenge: CounterfactualChallengeIdentityV0,
): VerifierChallengeExecutionResultV0 {
  validateNonCabBinding(request.surface, request.subject, challenge, CHRONICLE_CONTINUITY_ADAPTER_IDENTITY)
  const current = cloneJson(request.input.current)
  const predecessor = request.input.predecessor === null ? null : cloneJson(request.input.predecessor)
  try {
    const native_result = PRODUCTION_INVOKERS.chronicle_continuity(current, predecessor)
    return {
      execution_state: "subject_returned",
      surface: "chronicle_continuity",
      native_result: cloneJson(native_result),
    }
  } catch (error) {
    return toExecutionFailure("chronicle_continuity", error)
  }
}

function runCheckpointLocal(
  request: ChronicleCheckpointLocalRunRequestV0,
  challenge: CounterfactualChallengeIdentityV0,
): VerifierChallengeExecutionResultV0 {
  validateNonCabBinding(
    request.surface,
    request.subject,
    challenge,
    CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY,
  )
  const checkpoint = cloneJson(request.input.checkpoint)
  try {
    const native_result = PRODUCTION_INVOKERS.chronicle_checkpoint_local(checkpoint)
    return {
      execution_state: "subject_returned",
      surface: "chronicle_checkpoint_local",
      native_result: cloneJson(native_result),
    }
  } catch (error) {
    return toExecutionFailure("chronicle_checkpoint_local", error)
  }
}

function runCab(
  request: CabSemanticSnapshotRunRequestV0 | CabManifestHashRunRequestV0,
  challenge: CounterfactualChallengeIdentityV0,
): VerifierChallengeExecutionResultV0 {
  // Stage 1: request binding/validation (throws RunnerContractError).
  validateCabBinding(request, challenge)

  if (request.operation === "semantic_snapshot") {
    // Stage 2: input materialization/cloning — never typed CAB rejection.
    let value: unknown
    try {
      value = cloneJson(request.input.value)
    } catch (error) {
      return toExecutionFailure("counterfactual_audit_boundary", error)
    }

    // Stage 3: production subject invocation — sole typed-rejection boundary.
    let snapshot: CounterfactualSemanticJson
    try {
      snapshot = PRODUCTION_INVOKERS.cab_semantic_snapshot(value)
    } catch (error) {
      return classifyCabSubjectInvocationThrow(error)
    }

    // Stage 4: output cloning/serialization — never typed CAB rejection.
    try {
      return {
        execution_state: "subject_returned",
        surface: "counterfactual_audit_boundary",
        native_result: { operation: "semantic_snapshot", snapshot: cloneJson(snapshot) },
      }
    } catch (error) {
      return toExecutionFailure("counterfactual_audit_boundary", error)
    }
  }

  // Stage 2: manifest input conversion/materialization.
  let bytes: string | Uint8Array
  try {
    bytes =
      typeof request.input.bytes === "string" ? request.input.bytes : new Uint8Array(request.input.bytes)
  } catch (error) {
    return toExecutionFailure("counterfactual_audit_boundary", error)
  }

  // Stage 3: manifest subject — file-byte hash only; no invented semantic rejection.
  let sha256_hex: string
  try {
    sha256_hex = PRODUCTION_INVOKERS.cab_manifest_hash(bytes)
  } catch (error) {
    return toExecutionFailure("counterfactual_audit_boundary", error)
  }

  return {
    execution_state: "subject_returned",
    surface: "counterfactual_audit_boundary",
    native_result: { operation: "manifest_file_sha256", sha256_hex },
  }
}

/**
 * Execute a bounded verifier-challenge run request through the closed adapter registry.
 * Expected payloads and Lane A model expected fields are ignored for execution.
 */
export async function runVerifierChallenge(
  request: VerifierChallengeRunRequestV0,
): Promise<VerifierChallengeExecutionResultV0> {
  const { object, challenge } = validateEnvelope(request)
  const surface = object.surface
  if (typeof surface !== "string") {
    throw new RunnerContractError("request.surface must be a string")
  }

  switch (surface) {
    case "verify_handoff_receipt_root": {
      if (!object.subject || typeof object.subject !== "object") {
        throw new RunnerContractError("verify_handoff_receipt_root requires subject")
      }
      if (!object.input || typeof object.input !== "object") {
        throw new RunnerContractError("verify_handoff_receipt_root requires materialized input")
      }
      const input = object.input as Record<string, unknown>
      if (!("evidence" in input)) {
        throw new RunnerContractError("verify_handoff_receipt_root input.evidence is required")
      }
      return runVerifyHandoff(request as VerifyHandoffRunRequestV0, challenge)
    }
    case "chronicle_admission": {
      if (!object.subject || typeof object.subject !== "object") {
        throw new RunnerContractError("chronicle_admission requires subject")
      }
      const input = asObject(object.input, "chronicle_admission.input")
      if (!("evidence" in input) || !("proof_object" in input)) {
        throw new RunnerContractError("chronicle_admission requires evidence and proof_object")
      }
      return runChronicleAdmission(request as ChronicleAdmissionRunRequestV0, challenge)
    }
    case "chronicle_continuity": {
      if (!object.subject || typeof object.subject !== "object") {
        throw new RunnerContractError("chronicle_continuity requires subject")
      }
      const input = asObject(object.input, "chronicle_continuity.input")
      if (!("current" in input) || !("predecessor" in input)) {
        throw new RunnerContractError("chronicle_continuity requires current and predecessor")
      }
      return runChronicleContinuity(request as ChronicleContinuityRunRequestV0, challenge)
    }
    case "chronicle_checkpoint_local": {
      if (!object.subject || typeof object.subject !== "object") {
        throw new RunnerContractError("chronicle_checkpoint_local requires subject")
      }
      const input = asObject(object.input, "chronicle_checkpoint_local.input")
      if (!("checkpoint" in input)) {
        throw new RunnerContractError("chronicle_checkpoint_local requires checkpoint")
      }
      return runCheckpointLocal(request as ChronicleCheckpointLocalRunRequestV0, challenge)
    }
    case "counterfactual_audit_boundary": {
      if (object.subject !== null) {
        throw new RunnerContractError("counterfactual_audit_boundary requires subject:null")
      }
      const operation = object.operation
      if (operation !== "semantic_snapshot" && operation !== "manifest_file_sha256") {
        throw new RunnerContractError(`unsupported CAB operation: ${String(operation)}`)
      }
      if (!object.input || typeof object.input !== "object") {
        throw new RunnerContractError("counterfactual_audit_boundary requires materialized input")
      }
      return runCab(request as CabSemanticSnapshotRunRequestV0 | CabManifestHashRunRequestV0, challenge)
    }
    default:
      throw new RunnerContractError(`unknown adapter/surface: ${surface}`)
  }
}

/**
 * Normalize a subject_returned native result via the matching Lane C normalizer.
 * Never accepts execution_failure — that is a contract error at this boundary.
 */
export function normalizeSubjectReturnedResult(
  result: VerifierChallengeExecutionResultV0,
): CounterfactualObservationV0 {
  if (result.execution_state !== "subject_returned") {
    throw new RunnerContractError(
      "cannot normalize non-subject_returned execution outcomes through Lane C",
    )
  }
  switch (result.surface) {
    case "verify_handoff_receipt_root":
      return normalizeVerifyHandoffReceiptRootResult(result.native_result)
    case "chronicle_admission":
      return normalizeChronicleAdmissionResult(result.native_result)
    case "chronicle_continuity":
      return normalizeChronicleContinuityResult(result.native_result)
    case "chronicle_checkpoint_local":
      return normalizeChronicleCheckpointLocalResult(result.native_result)
    case "counterfactual_audit_boundary":
      throw new RunnerContractError(
        "CAB runtime native results are not Lane C verifier-observation inputs; use expected-side CAB normalization separately",
      )
    default: {
      const _exhaustive: never = result
      return _exhaustive
    }
  }
}

/** Convenience helper preserving execution state, native result, and optional normalization. */
export async function runAndNormalizeVerifierChallenge(request: VerifierChallengeRunRequestV0): Promise<{
  readonly execution: VerifierChallengeExecutionResultV0
  readonly observation: CounterfactualObservationV0 | null
}> {
  const execution = await runVerifierChallenge(request)
  if (
    execution.execution_state === "execution_failure" ||
    execution.execution_state === "subject_contract_rejected"
  ) {
    return { execution, observation: null }
  }
  if (execution.surface === "counterfactual_audit_boundary") {
    return { execution, observation: null }
  }
  return { execution, observation: normalizeSubjectReturnedResult(execution) }
}

export type { ChronicleEntryV0, HandoffReceiptVerification, TryCreateChronicleEntryV0Result }
export type { CounterfactualChallengeIdentityV0 }
