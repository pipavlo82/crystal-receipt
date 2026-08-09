/**
 * Canonical verifier-challenge model v0.
 *
 * Structural extraction only: projects existing frozen challenge vectors into a
 * shared view without changing package bytes or scientific semantics.
 *
 * Distinguishes:
 * 1. source artifact identity — pinned independently (when a package pins one)
 * 2. challenge/mutation derivation — describes a derived test input
 * 3. native expected verifier observation — surface-specific; not normalized here
 *
 * A challenge does not rewrite source artifact validity. Expected observation is
 * scoped to the challenge package/surface. This module does not evaluate
 * conformance, normalize outcomes, or define host_error semantics.
 */

export const VERIFIER_CHALLENGE_MODEL_SCHEMA = "receiptos.verifier_challenge_model.v0" as const

export type VerifierChallengeModelSchema = typeof VERIFIER_CHALLENGE_MODEL_SCHEMA

/** Repository path + Git index/object-store blob OID (git rev-parse :<path>). */
export interface PinnedGitObjectIdentity {
  readonly repository_path: string
  readonly git_blob_oid: string
}

/** Production subject entrypoint pinned by module path and Git blob OID. */
export interface SubjectEntrypointIdentity {
  readonly entrypoint: string
  readonly module_path: string
  readonly git_blob_oid: string
}

/**
 * Path mutation used by verifyHandoffReceiptRoot and Chronicle admission leaves.
 * `from`/`to` may be null (e.g. missing-required-input).
 */
export interface ChallengePathMutation {
  readonly kind: "path_mutation"
  readonly operation: string
  readonly path: readonly string[]
  readonly from: unknown
  readonly to: unknown
}

/**
 * Substitution / pair replacement used by Chronicle continuity and
 * checkpoint-local leaves. Native substitution object is preserved losslessly.
 */
export interface ChallengeSubstitution {
  readonly kind: "substitution"
  readonly value: unknown
}

/**
 * Counterfactual Audit Boundary operation (semantic snapshot / manifest hash).
 * CAB is not a production-verifier challenge leaf; it uses typed operations.
 */
export interface ChallengeAuditBoundaryOperation {
  readonly kind: "audit_boundary_operation"
  readonly operation: string
}

export type ChallengeDerivation =
  | ChallengePathMutation
  | ChallengeSubstitution
  | ChallengeAuditBoundaryOperation

export type ChallengeSurfaceKind =
  | "verify_handoff_receipt_root"
  | "chronicle_admission"
  | "chronicle_continuity"
  | "chronicle_checkpoint_local"
  | "counterfactual_audit_boundary"

/**
 * Shared view over a frozen challenge/audit-boundary vector.
 *
 * `native` is a deep clone of the original vector and remains authoritative for
 * any package-specific field not lifted into the shared slots.
 */
export interface VerifierChallengeVectorModelV0 {
  readonly model_schema: VerifierChallengeModelSchema
  /** Native package vector `schema` string. */
  readonly native_schema: string
  readonly vector_id: string
  readonly package_version: string
  /**
   * Challenge identifier on verifier-challenge leaves.
   * Counterfactual Audit Boundary vectors have no `challenge_id` → null.
   */
  readonly challenge_id: string | null
  readonly execution_class: string
  readonly surface: ChallengeSurfaceKind
  /**
   * Primary production subject under test.
   * Counterfactual Audit Boundary has no subject verifier → null.
   */
  readonly subject: SubjectEntrypointIdentity | null
  /**
   * Source fixture identity when the package pins `source_fixture`.
   * Extra native source fields (e.g. baseline_vector_name) remain in `native`.
   * Checkpoint-local and CAB vectors typically have no source_fixture → null.
   */
  readonly source: PinnedGitObjectIdentity | null
  /** How the challenged input is derived; does not rewrite source validity. */
  readonly derivation: ChallengeDerivation
  /** Present on verifier-challenge leaves; absent on CAB → null. */
  readonly field_classification: Readonly<Record<string, unknown>> | null
  /**
   * Native expected observation/result payload.
   * Not coerced into a cross-surface enum in this model version.
   */
  readonly expected: unknown
  /** Complete original vector (deep clone). */
  readonly native: Readonly<Record<string, unknown>>
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`)
  }
  return value as Record<string, unknown>
}

function requireString(object: Record<string, unknown>, key: string, label: string): string {
  const value = object[key]
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${key} must be a non-empty string`)
  }
  return value
}

function optionalString(object: Record<string, unknown>, key: string): string | null {
  const value = object[key]
  if (value === undefined || value === null) return null
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} must be a non-empty string when present`)
  }
  return value
}

function projectSubject(value: unknown, label: string): SubjectEntrypointIdentity {
  const object = asObject(value, label)
  return {
    entrypoint: requireString(object, "entrypoint", label),
    module_path: requireString(object, "module_path", label),
    git_blob_oid: requireString(object, "git_blob_oid", label),
  }
}

function projectSource(value: unknown): PinnedGitObjectIdentity | null {
  if (value === undefined || value === null) return null
  const object = asObject(value, "source_fixture")
  return {
    repository_path: requireString(object, "repository_path", "source_fixture"),
    git_blob_oid: requireString(object, "git_blob_oid", "source_fixture"),
  }
}

function projectPathMutation(value: unknown): ChallengePathMutation {
  const object = asObject(value, "mutation")
  const path = object.path
  if (!Array.isArray(path) || path.some((segment) => typeof segment !== "string")) {
    throw new Error("mutation.path must be an array of strings")
  }
  if (!Object.prototype.hasOwnProperty.call(object, "from")) {
    throw new Error("mutation.from is required")
  }
  if (!Object.prototype.hasOwnProperty.call(object, "to")) {
    throw new Error("mutation.to is required")
  }
  return {
    kind: "path_mutation",
    operation: requireString(object, "operation", "mutation"),
    path: path.slice() as string[],
    from: object.from,
    to: object.to,
  }
}

function detectSurface(raw: Record<string, unknown>): {
  surface: ChallengeSurfaceKind
  subject: SubjectEntrypointIdentity | null
} {
  const nativeSchema = optionalString(raw, "schema") ?? ""
  if (
    nativeSchema.startsWith("counterfactual_audit_boundary_vector") ||
    optionalString(raw, "package_version") === "counterfactual-audit-boundary-v0"
  ) {
    return { surface: "counterfactual_audit_boundary", subject: null }
  }

  if (raw.subject_verifier !== undefined) {
    return {
      surface: "verify_handoff_receipt_root",
      subject: projectSubject(raw.subject_verifier, "subject_verifier"),
    }
  }
  if (raw.subject_admission_verifier !== undefined) {
    return {
      surface: "chronicle_admission",
      subject: projectSubject(raw.subject_admission_verifier, "subject_admission_verifier"),
    }
  }
  if (raw.subject_continuity_evaluator !== undefined) {
    return {
      surface: "chronicle_continuity",
      subject: projectSubject(raw.subject_continuity_evaluator, "subject_continuity_evaluator"),
    }
  }
  if (raw.subject_local_checkpoint_verifier !== undefined) {
    return {
      surface: "chronicle_checkpoint_local",
      subject: projectSubject(raw.subject_local_checkpoint_verifier, "subject_local_checkpoint_verifier"),
    }
  }

  throw new Error(
    `unable to detect challenge surface for vector_id=${String(raw.vector_id ?? "<missing>")}`,
  )
}

function projectDerivation(
  raw: Record<string, unknown>,
  surface: ChallengeSurfaceKind,
): ChallengeDerivation {
  if (surface === "counterfactual_audit_boundary") {
    return {
      kind: "audit_boundary_operation",
      operation: requireString(raw, "operation", "vector"),
    }
  }
  if (raw.mutation !== undefined) {
    return projectPathMutation(raw.mutation)
  }
  if (raw.substitution !== undefined) {
    return {
      kind: "substitution",
      value: structuredClone(raw.substitution),
    }
  }
  throw new Error(
    `vector ${String(raw.vector_id)} has neither mutation nor substitution derivation`,
  )
}

function projectFieldClassification(
  value: unknown,
): Readonly<Record<string, unknown>> | null {
  if (value === undefined || value === null) return null
  return structuredClone(asObject(value, "field_classification"))
}

/**
 * Project a frozen native challenge/audit-boundary vector into the shared model.
 * Does not mutate `raw`. Does not evaluate the challenge.
 */
export function projectVerifierChallengeVector(raw: unknown): VerifierChallengeVectorModelV0 {
  const object = asObject(raw, "verifier challenge vector")
  const { surface, subject } = detectSurface(object)

  if (!Object.prototype.hasOwnProperty.call(object, "expected")) {
    throw new Error(`vector ${String(object.vector_id)} missing expected payload`)
  }

  return {
    model_schema: VERIFIER_CHALLENGE_MODEL_SCHEMA,
    native_schema: requireString(object, "schema", "vector"),
    vector_id: requireString(object, "vector_id", "vector"),
    package_version: requireString(object, "package_version", "vector"),
    challenge_id: optionalString(object, "challenge_id"),
    execution_class: requireString(object, "execution_class", "vector"),
    surface,
    subject,
    source: projectSource(object.source_fixture),
    derivation: projectDerivation(object, surface),
    field_classification: projectFieldClassification(object.field_classification),
    expected: structuredClone(object.expected),
    native: structuredClone(object),
  }
}
