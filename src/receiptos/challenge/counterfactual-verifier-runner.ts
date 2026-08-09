/**
 * Bounded generalized verifier adapter/runner v0 (Lane D).
 *
 * Executes explicitly registered pinned ReceiptOS adapters for the current
 * frozen verifier-challenge surfaces. Returns either a native subject result
 * or a separate execution_failure.
 *
 * Does not:
 * - compare expected vs actual
 * - decide conformance
 * - normalize host/runtime failure into Lane C observation classes
 * - generate counterfactual neighbors
 * - dynamically load arbitrary modules/functions
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
  snapshotCounterfactualSemanticJson,
  type CounterfactualSemanticJson,
} from "./counterfactual-audit-boundary"
import type {
  ChallengeSurfaceKind,
  SubjectEntrypointIdentity,
  VerifierChallengeVectorModelV0,
} from "./verifier-challenge-model"
import {
  normalizeChronicleAdmissionResult,
  normalizeChronicleCheckpointLocalResult,
  normalizeChronicleContinuityResult,
  normalizeVerifyHandoffReceiptRootResult,
  type CounterfactualObservationV0,
} from "./counterfactual-result-normalization"

export const COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA = "receiptos.counterfactual_verifier_runner.v0" as const

export type CounterfactualVerifierRunnerSchema = typeof COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA

// --- Registered adapter identities (finite, production-closed) ----------------

export const VERIFY_HANDOFF_ADAPTER_IDENTITY = {
  surface: "verify_handoff_receipt_root",
  entrypoint: "verifyHandoffReceiptRoot",
  module_path: "src/receiptos/verify/verify-receipt.ts",
  git_blob_oid: "2e2e45bf30529de93eac58a04465f17ef81edeaa",
} as const satisfies SubjectEntrypointIdentity & { surface: ChallengeSurfaceKind }

export const CHRONICLE_ADMISSION_ADAPTER_IDENTITY = {
  surface: "chronicle_admission",
  entrypoint: "tryCreateChronicleEntryV0",
  module_path: "src/receiptos/capsule/chronicle-portfolio-v0.ts",
  git_blob_oid: "0e790911092546c62344f980e6b611542bcd00fe",
} as const satisfies SubjectEntrypointIdentity & { surface: ChallengeSurfaceKind }

export const CHRONICLE_CONTINUITY_ADAPTER_IDENTITY = {
  surface: "chronicle_continuity",
  entrypoint: "evaluateChronicleCheckpointContinuityV0",
  module_path: "src/receiptos/capsule/chronicle-checkpoint-continuity-v0.ts",
  git_blob_oid: "428923f10aac54bfaaebedfad494118cbb17d744",
} as const satisfies SubjectEntrypointIdentity & { surface: ChallengeSurfaceKind }

export const CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY = {
  surface: "chronicle_checkpoint_local",
  entrypoint: "verifyChronicleCheckpointV0",
  module_path: "src/receiptos/capsule/chronicle-portfolio-v0.ts",
  git_blob_oid: "0e790911092546c62344f980e6b611542bcd00fe",
} as const satisfies SubjectEntrypointIdentity & { surface: ChallengeSurfaceKind }

export const CAB_ADAPTER_OPERATIONS = ["semantic_snapshot", "manifest_file_sha256"] as const
export type CabAdapterOperationV0 = (typeof CAB_ADAPTER_OPERATIONS)[number]

export const CAB_ADAPTER_IDENTITY = {
  surface: "counterfactual_audit_boundary",
  subject: null,
  challenge_id: null,
  module_path: "src/receiptos/challenge/counterfactual-audit-boundary.ts",
  operations: CAB_ADAPTER_OPERATIONS,
} as const

/** Bounded challenge identity carried for continuity; ignored by execution branching. */
export type VerifierChallengeIdentityProjectionV0 = {
  readonly vector_id: string
  readonly challenge_id: string | null
  readonly package_version: string
  readonly native_schema: string
}

type ChallengeCarrier = {
  readonly challenge: VerifierChallengeIdentityProjectionV0
  /**
   * Optional Lane A model for caller identity continuity.
   * Execution never reads expected / field_classification / derivation.
   */
  readonly lane_a_model?: VerifierChallengeVectorModelV0
  /**
   * Optional expected payload. Execution must ignore it completely.
   */
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

export type ExecutionFailureV0 = {
  readonly execution_state: "execution_failure"
  readonly surface: ChallengeSurfaceKind
  readonly failure: {
    readonly failure_stage: "subject_invocation"
    readonly failure_kind: ExecutionFailureKindV0
    readonly error_name: string
    readonly safe_message: string
  }
}

export type VerifierChallengeExecutionResultV0 = SubjectReturnedResultV0 | ExecutionFailureV0

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

function subjectMatches(
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

function validateChallengeIdentity(challenge: unknown): VerifierChallengeIdentityProjectionV0 {
  const object = asObject(challenge, "challenge")
  return {
    vector_id: requireString(object, "vector_id", "challenge"),
    challenge_id:
      object.challenge_id === null
        ? null
        : requireString(object, "challenge_id", "challenge"),
    package_version: requireString(object, "package_version", "challenge"),
    native_schema: requireString(object, "native_schema", "challenge"),
  }
}

function validateEnvelope(request: unknown): Record<string, unknown> {
  const object = asObject(request, "VerifierChallengeRunRequestV0")
  if (object.schema !== COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA) {
    throw new RunnerContractError("unsupported runner request schema")
  }
  validateChallengeIdentity(object.challenge)
  return object
}

function sanitizeSafeMessage(raw: string): string {
  let message = raw
  // Strip absolute Windows and POSIX paths.
  message = message.replace(/[A-Za-z]:\\[^\s"']+/g, "<path>")
  message = message.replace(/\/(?:Users|home|tmp|var|etc|opt)\/[^\s"']+/g, "<path>")
  message = message.replace(/\r?\n[\s\S]*$/, "")
  if (message.length > 240) message = `${message.slice(0, 240)}…`
  return message
}

function toExecutionFailure(surface: ChallengeSurfaceKind, thrown: unknown): ExecutionFailureV0 {
  if (thrown instanceof Error) {
    return {
      execution_state: "execution_failure",
      surface,
      failure: {
        failure_stage: "subject_invocation",
        failure_kind: "thrown_error",
        error_name: thrown.name || "Error",
        safe_message: sanitizeSafeMessage(String(thrown.message ?? "")),
      },
    }
  }
  return {
    execution_state: "execution_failure",
    surface,
    failure: {
      failure_stage: "subject_invocation",
      failure_kind: "non_error_throw",
      error_name: typeof thrown,
      safe_message: sanitizeSafeMessage(typeof thrown === "string" ? thrown : "non-error throw"),
    },
  }
}

function cloneJson<T>(value: T): T {
  return structuredClone(value)
}

// --- Production invokers (closed registry) -----------------------------------

type ProductionInvokers = {
  verify_handoff_receipt_root: (evidence: HandoffEvidence) => Promise<HandoffReceiptVerification>
  chronicle_admission: (
    evidence: HandoffEvidence,
    proofObject: PortableProofObjectV0,
    options?: ChronicleAdmissionRunRequestV0["input"]["options"],
  ) => TryCreateChronicleEntryV0Result
  chronicle_continuity: (
    current: ChronicleCheckpointV0,
    predecessor: ChronicleCheckpointV0 | null,
  ) => ChronicleCheckpointContinuityResultV0
  chronicle_checkpoint_local: (checkpoint: ChronicleCheckpointV0) => ChronicleCheckpointVerification
  cab_semantic_snapshot: (value: unknown) => CounterfactualSemanticJson
  cab_manifest_hash: (bytes: string | Uint8Array) => string
}

const PRODUCTION_INVOKERS: ProductionInvokers = {
  verify_handoff_receipt_root: (evidence) => verifyHandoffReceiptRoot(evidence),
  chronicle_admission: (evidence, proofObject, options) =>
    tryCreateChronicleEntryV0(evidence, proofObject, options),
  chronicle_continuity: (current, predecessor) =>
    evaluateChronicleCheckpointContinuityV0(current, predecessor),
  chronicle_checkpoint_local: (checkpoint) => verifyChronicleCheckpointV0(checkpoint),
  cab_semantic_snapshot: (value) => snapshotCounterfactualSemanticJson(value),
  cab_manifest_hash: (bytes) => computeCounterfactualManifestFileSha256(bytes),
}

/**
 * Test-only invoker override seam. Not part of the production adapter registry.
 * Overrides cannot register new surfaces — only replace invoke implementations
 * for already-registered production surfaces during a scoped callback.
 */
let testInvokerOverrides: Partial<ProductionInvokers> | null = null

export function __laneDTestOnly_withInvokerOverrides<T>(
  overrides: Partial<ProductionInvokers>,
  run: () => Promise<T> | T,
): Promise<T> | T {
  const previous = testInvokerOverrides
  testInvokerOverrides = { ...(testInvokerOverrides ?? {}), ...overrides }
  const restore = () => {
    testInvokerOverrides = previous
  }
  try {
    const result = run()
    if (result && typeof (result as Promise<T>).then === "function") {
      return (result as Promise<T>).finally(restore)
    }
    restore()
    return result
  } catch (error) {
    restore()
    throw error
  }
}

function invokers(): ProductionInvokers {
  if (!testInvokerOverrides) return PRODUCTION_INVOKERS
  return { ...PRODUCTION_INVOKERS, ...testInvokerOverrides }
}

async function runVerifyHandoff(request: VerifyHandoffRunRequestV0): Promise<VerifierChallengeExecutionResultV0> {
  subjectMatches(request.subject, VERIFY_HANDOFF_ADAPTER_IDENTITY, request.surface)
  const evidence = cloneJson(request.input.evidence)
  try {
    const native_result = await invokers().verify_handoff_receipt_root(evidence)
    return {
      execution_state: "subject_returned",
      surface: "verify_handoff_receipt_root",
      native_result: cloneJson(native_result),
    }
  } catch (error) {
    return toExecutionFailure("verify_handoff_receipt_root", error)
  }
}

function runChronicleAdmission(request: ChronicleAdmissionRunRequestV0): VerifierChallengeExecutionResultV0 {
  subjectMatches(request.subject, CHRONICLE_ADMISSION_ADAPTER_IDENTITY, request.surface)
  const evidence = cloneJson(request.input.evidence)
  const proofObject = cloneJson(request.input.proof_object)
  const options = request.input.options === undefined ? undefined : cloneJson(request.input.options)
  try {
    const native_result = invokers().chronicle_admission(evidence, proofObject, options)
    return {
      execution_state: "subject_returned",
      surface: "chronicle_admission",
      native_result: cloneJson(native_result),
    }
  } catch (error) {
    return toExecutionFailure("chronicle_admission", error)
  }
}

function runChronicleContinuity(request: ChronicleContinuityRunRequestV0): VerifierChallengeExecutionResultV0 {
  subjectMatches(request.subject, CHRONICLE_CONTINUITY_ADAPTER_IDENTITY, request.surface)
  const current = cloneJson(request.input.current)
  const predecessor = request.input.predecessor === null ? null : cloneJson(request.input.predecessor)
  try {
    const native_result = invokers().chronicle_continuity(current, predecessor)
    return {
      execution_state: "subject_returned",
      surface: "chronicle_continuity",
      native_result: cloneJson(native_result),
    }
  } catch (error) {
    return toExecutionFailure("chronicle_continuity", error)
  }
}

function runCheckpointLocal(request: ChronicleCheckpointLocalRunRequestV0): VerifierChallengeExecutionResultV0 {
  subjectMatches(request.subject, CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY, request.surface)
  const checkpoint = cloneJson(request.input.checkpoint)
  try {
    const native_result = invokers().chronicle_checkpoint_local(checkpoint)
    return {
      execution_state: "subject_returned",
      surface: "chronicle_checkpoint_local",
      native_result: cloneJson(native_result),
    }
  } catch (error) {
    return toExecutionFailure("chronicle_checkpoint_local", error)
  }
}

function runCab(request: CabSemanticSnapshotRunRequestV0 | CabManifestHashRunRequestV0): VerifierChallengeExecutionResultV0 {
  if (request.subject !== null) {
    throw new RunnerContractError("counterfactual_audit_boundary requires subject:null")
  }
  if (request.challenge.challenge_id !== null) {
    throw new RunnerContractError("counterfactual_audit_boundary requires challenge.challenge_id:null")
  }
  if (request.operation === "semantic_snapshot") {
    const value = cloneJson(request.input.value)
    try {
      const snapshot = invokers().cab_semantic_snapshot(value)
      return {
        execution_state: "subject_returned",
        surface: "counterfactual_audit_boundary",
        native_result: { operation: "semantic_snapshot", snapshot: cloneJson(snapshot) },
      }
    } catch (error) {
      return toExecutionFailure("counterfactual_audit_boundary", error)
    }
  }
  const bytes =
    typeof request.input.bytes === "string" ? request.input.bytes : new Uint8Array(request.input.bytes)
  try {
    const sha256_hex = invokers().cab_manifest_hash(bytes)
    return {
      execution_state: "subject_returned",
      surface: "counterfactual_audit_boundary",
      native_result: { operation: "manifest_file_sha256", sha256_hex },
    }
  } catch (error) {
    return toExecutionFailure("counterfactual_audit_boundary", error)
  }
}

/**
 * Execute a bounded verifier-challenge run request through the closed adapter registry.
 * Expected payloads and Lane A model expected fields are ignored for execution.
 */
export async function runVerifierChallenge(
  request: VerifierChallengeRunRequestV0,
): Promise<VerifierChallengeExecutionResultV0> {
  const object = validateEnvelope(request)
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
      return runVerifyHandoff(request as VerifyHandoffRunRequestV0)
    }
    case "chronicle_admission": {
      if (!object.subject || typeof object.subject !== "object") {
        throw new RunnerContractError("chronicle_admission requires subject")
      }
      const input = asObject(object.input, "chronicle_admission.input")
      if (!("evidence" in input) || !("proof_object" in input)) {
        throw new RunnerContractError("chronicle_admission requires evidence and proof_object")
      }
      return runChronicleAdmission(request as ChronicleAdmissionRunRequestV0)
    }
    case "chronicle_continuity": {
      if (!object.subject || typeof object.subject !== "object") {
        throw new RunnerContractError("chronicle_continuity requires subject")
      }
      const input = asObject(object.input, "chronicle_continuity.input")
      if (!("current" in input) || !("predecessor" in input)) {
        throw new RunnerContractError("chronicle_continuity requires current and predecessor")
      }
      return runChronicleContinuity(request as ChronicleContinuityRunRequestV0)
    }
    case "chronicle_checkpoint_local": {
      if (!object.subject || typeof object.subject !== "object") {
        throw new RunnerContractError("chronicle_checkpoint_local requires subject")
      }
      const input = asObject(object.input, "chronicle_checkpoint_local.input")
      if (!("checkpoint" in input)) {
        throw new RunnerContractError("chronicle_checkpoint_local requires checkpoint")
      }
      return runCheckpointLocal(request as ChronicleCheckpointLocalRunRequestV0)
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
      return runCab(request as CabSemanticSnapshotRunRequestV0 | CabManifestHashRunRequestV0)
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
    throw new RunnerContractError("cannot normalize execution_failure through Lane C")
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
  if (execution.execution_state === "execution_failure") {
    return { execution, observation: null }
  }
  if (execution.surface === "counterfactual_audit_boundary") {
    return { execution, observation: null }
  }
  return { execution, observation: normalizeSubjectReturnedResult(execution) }
}

// Re-export useful types for callers/tests without implying ChronicleEntry construction.
export type { ChronicleEntryV0, HandoffReceiptVerification, TryCreateChronicleEntryV0Result }
