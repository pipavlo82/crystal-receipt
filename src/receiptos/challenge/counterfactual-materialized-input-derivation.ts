/**
 * Deterministic materialized-input derivation v0 (Lane I).
 *
 * Constructs the exact Lane H aggregate request from closed frozen package
 * vectors and pinned Git blob sources. Expected payloads are carried for Lane G
 * but never select sources, mutations, routes, or operands.
 *
 * Loader authority for non-null sources:
 *   1. reject absolute / traversal / outside-root paths
 *   2. require git index or HEAD path OID == pinned git_blob_oid
 *   3. load exact bytes via `git cat-file blob <oid>`
 *   4. recompute SHA1("blob " + len + "\\0" + bytes) and require equality
 *
 * Pure core operates only on already-authenticated JSON materials.
 */

import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, isAbsolute, normalize, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import {
  PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0,
  PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0,
  COUNTERFACTUAL_NEIGHBORHOOD_CONFORMANCE_REQUEST_SCHEMA,
  COUNTERFACTUAL_NEIGHBORHOOD_MEMBER_CARRIER_SCHEMA,
  type CounterfactualNeighborhoodConformanceRequestV0,
  type NeighborhoodMemberCarrierV0,
} from "./counterfactual-neighborhood-conformance"
import {
  COUNTERFACTUAL_NEIGHBORHOOD_SCHEMA,
  canonicalIdentityJson,
  computeFrozenCounterfactualNeighborhoodSha256,
  projectCounterfactualChallengeIdentity,
  type FrozenCounterfactualNeighborhoodV0,
} from "./counterfactual-neighborhood"
import {
  projectVerifierChallengeVector,
  type VerifierChallengeVectorModelV0,
} from "./verifier-challenge-model"
import {
  CAB_MANIFEST_HASH_DIFF_EVALUATION_REQUEST_SCHEMA,
} from "./counterfactual-cab-manifest-hash-diff-evaluator"
import {
  COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
  VERIFY_HANDOFF_ADAPTER_IDENTITY,
  CHRONICLE_ADMISSION_ADAPTER_IDENTITY,
  CHRONICLE_CONTINUITY_ADAPTER_IDENTITY,
  CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY,
} from "./counterfactual-verifier-runner"

export const MATERIALIZED_INPUT_DERIVATION_SCHEMA =
  "receiptos.counterfactual_materialized_input_derivation.v0" as const

export type MaterializedInputDerivationReasonV0 =
  | "unknown_package"
  | "unknown_vector"
  | "neighborhood_inventory_mismatch"
  | "unsupported_source_scheme"
  | "source_path_outside_root"
  | "source_missing"
  | "source_blob_mismatch"
  | "source_parse_failure"
  | "unsupported_derivation"
  | "mutation_path_missing"
  | "mutation_from_value_mismatch"
  | "invalid_array_index"
  | "non_canonical_material"
  | "unsupported_cab_materialization"
  | "composite_operand_mismatch"
  | "derived_request_identity_mismatch"
  | "dangerous_prototype_path"
  | "unsupported_baseline_root"
  | "vector_parse_failure"
  | "vector_blob_mismatch"

export class MaterializedInputDerivationError extends Error {
  readonly code = "materialized_input_derivation_error" as const
  readonly reason: MaterializedInputDerivationReasonV0

  constructor(reason: MaterializedInputDerivationReasonV0) {
    super("materialized input derivation failed")
    this.name = "MaterializedInputDerivationError"
    this.reason = reason
  }
}

type VectorAuthorityV0 = {
  readonly package_version: string
  readonly vector_id: string
  readonly vector_path: string
  readonly vector_git_blob_oid: string | null
}

/**
 * Closed authority for the exact pinned Lane B neighborhood members.
 * vector_git_blob_oid null → load via path OID from git (vector itself pinned by path+content through package audits).
 */
const VECTOR_AUTHORITIES: readonly VectorAuthorityV0[] = Object.freeze([
  Object.freeze({
    package_version: "verifier-challenge-observed-not-validated-v0",
    vector_id: "V-OBSERVED-NOT-VALIDATED",
    vector_path: "conformance/verifier-challenge-observed-not-validated-v0/vectors/V-OBSERVED-NOT-VALIDATED.json",
    vector_git_blob_oid: null,
  }),
  Object.freeze({
    package_version: "verifier-challenge-missing-required-input-unverifiable-v0",
    vector_id: "V-MISSING-REQUIRED-INPUT",
    vector_path:
      "conformance/verifier-challenge-missing-required-input-unverifiable-v0/vectors/V-MISSING-REQUIRED-INPUT.json",
    vector_git_blob_oid: null,
  }),
  Object.freeze({
    package_version: "verifier-challenge-integrity-mismatch-rejected-v0",
    vector_id: "V-INTEGRITY-MISMATCH",
    vector_path: "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    vector_git_blob_oid: null,
  }),
  Object.freeze({
    package_version: "verifier-challenge-chronicle-proof-root-mismatch-rejected-v0",
    vector_id: "V-CHRONICLE-PROOF-ROOT-MISMATCH",
    vector_path:
      "conformance/verifier-challenge-chronicle-proof-root-mismatch-rejected-v0/vectors/V-CHRONICLE-PROOF-ROOT-MISMATCH.json",
    vector_git_blob_oid: null,
  }),
  Object.freeze({
    package_version: "verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0",
    vector_id: "V-CHRONICLE-PREDECESSOR-UNKNOWN",
    vector_path:
      "conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0/vectors/V-CHRONICLE-PREDECESSOR-UNKNOWN.json",
    vector_git_blob_oid: null,
  }),
  Object.freeze({
    package_version: "verifier-challenge-chronicle-sequence-gap-rejected-v0",
    vector_id: "V-CHRONICLE-SEQUENCE-GAP",
    vector_path:
      "conformance/verifier-challenge-chronicle-sequence-gap-rejected-v0/vectors/V-CHRONICLE-SEQUENCE-GAP.json",
    vector_git_blob_oid: null,
  }),
  Object.freeze({
    package_version: "verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0",
    vector_id: "V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH",
    vector_path:
      "conformance/verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH.json",
    vector_git_blob_oid: null,
  }),
  Object.freeze({
    package_version: "verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0",
    vector_id: "V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL",
    vector_path:
      "conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL.json",
    vector_git_blob_oid: null,
  }),
  Object.freeze({
    package_version: "counterfactual-audit-boundary-v0",
    vector_id: "V-AT-NEST-OBJ",
    vector_path: "conformance/counterfactual-audit-boundary-v0/vectors/V-AT-NEST-OBJ.json",
    vector_git_blob_oid: null,
  }),
  Object.freeze({
    package_version: "counterfactual-audit-boundary-v0",
    vector_id: "V-MAN-HASH-DIFF",
    vector_path: "conformance/counterfactual-audit-boundary-v0/vectors/V-MAN-HASH-DIFF.json",
    vector_git_blob_oid: null,
  }),
])

const NEIGHBORHOOD_FIXTURE_PATH =
  "tests/fixtures/counterfactual-neighborhood-identity-v0/neighborhood.json" as const

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_REPOSITORY_ROOT = resolve(MODULE_DIR, "../../..")

const FORBIDDEN_PATH_KEYS = new Set(["__proto__", "prototype", "constructor"])

export function computeGitBlobOidSha1(bytes: Uint8Array): string {
  const header = Buffer.from(`blob ${bytes.byteLength}\0`, "utf8")
  return createHash("sha1").update(header).update(bytes).digest("hex")
}

function cloneJson<T>(value: T): T {
  return structuredClone(value)
}

function asObject(value: unknown, reason: MaterializedInputDerivationReasonV0): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new MaterializedInputDerivationError(reason)
  }
  return value as Record<string, unknown>
}

function assertSafeRelativePath(repositoryPath: string): string {
  if (typeof repositoryPath !== "string" || repositoryPath.length === 0) {
    throw new MaterializedInputDerivationError("unsupported_source_scheme")
  }
  if (isAbsolute(repositoryPath)) {
    throw new MaterializedInputDerivationError("source_path_outside_root")
  }
  if (repositoryPath.includes("\0")) {
    throw new MaterializedInputDerivationError("source_path_outside_root")
  }
  const normalized = normalize(repositoryPath).replace(/\\/g, "/")
  if (normalized.startsWith("../") || normalized === ".." || normalized.startsWith("/")) {
    throw new MaterializedInputDerivationError("source_path_outside_root")
  }
  if (normalized.split("/").some((part) => part === "..")) {
    throw new MaterializedInputDerivationError("source_path_outside_root")
  }
  return normalized
}

function resolveUnderRoot(repositoryRoot: string, repositoryPath: string): string {
  const safe = assertSafeRelativePath(repositoryPath)
  const absolute = resolve(repositoryRoot, ...safe.split("/"))
  const rel = relative(repositoryRoot, absolute)
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new MaterializedInputDerivationError("source_path_outside_root")
  }
  // Windows drive-letter absolute fallback
  if (rel.includes(`..${sep}`)) {
    throw new MaterializedInputDerivationError("source_path_outside_root")
  }
  return absolute
}

function runGit(repositoryRoot: string, args: string[]): Buffer | null {
  try {
    return execFileSync("git", args, {
      cwd: repositoryRoot,
      stdio: ["ignore", "pipe", "ignore"],
    })
  } catch {
    return null
  }
}

function gitPathOid(repositoryRoot: string, repositoryPath: string): string | null {
  const index = runGit(repositoryRoot, ["rev-parse", `:${repositoryPath}`])
  if (index !== null) {
    const oid = index.toString("utf8").trim()
    if (/^[0-9a-f]{40}$/.test(oid)) return oid
  }
  const head = runGit(repositoryRoot, ["rev-parse", `HEAD:${repositoryPath}`])
  if (head !== null) {
    const oid = head.toString("utf8").trim()
    if (/^[0-9a-f]{40}$/.test(oid)) return oid
  }
  return null
}

/**
 * Load exact pinned Git blob bytes for a repository-relative path.
 * Does not use worktree bytes as authority.
 */
export function loadPinnedGitBlobBytes(
  repositoryRoot: string,
  repositoryPath: string,
  gitBlobOid: string,
): Buffer {
  if (typeof gitBlobOid !== "string" || !/^[0-9a-f]{40}$/.test(gitBlobOid)) {
    throw new MaterializedInputDerivationError("source_blob_mismatch")
  }
  assertSafeRelativePath(repositoryPath)
  resolveUnderRoot(repositoryRoot, repositoryPath)
  const pathOid = gitPathOid(repositoryRoot, repositoryPath)
  if (pathOid === null) {
    throw new MaterializedInputDerivationError("source_missing")
  }
  if (pathOid !== gitBlobOid) {
    throw new MaterializedInputDerivationError("source_blob_mismatch")
  }
  const bytes = runGit(repositoryRoot, ["cat-file", "blob", gitBlobOid])
  if (bytes === null) {
    throw new MaterializedInputDerivationError("source_missing")
  }
  if (computeGitBlobOidSha1(bytes) !== gitBlobOid) {
    throw new MaterializedInputDerivationError("source_blob_mismatch")
  }
  return bytes
}

function parseJsonBytes(bytes: Buffer, reason: MaterializedInputDerivationReasonV0): unknown {
  try {
    return JSON.parse(bytes.toString("utf8"))
  } catch {
    throw new MaterializedInputDerivationError(reason)
  }
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return canonicalIdentityJson(a) === canonicalIdentityJson(b)
}

/**
 * Apply a committed path_mutation.set to a fresh JSON clone.
 */
export function applyPathMutationSet(
  root: unknown,
  mutation: { readonly path: readonly string[]; readonly from: unknown; readonly to: unknown },
): unknown {
  if (mutation.path.length === 0) {
    throw new MaterializedInputDerivationError("mutation_path_missing")
  }
  const clone = cloneJson(root)
  let cursor: unknown = clone
  for (let i = 0; i < mutation.path.length - 1; i += 1) {
    const segment = mutation.path[i]!
    if (FORBIDDEN_PATH_KEYS.has(segment)) {
      throw new MaterializedInputDerivationError("dangerous_prototype_path")
    }
    if (Array.isArray(cursor)) {
      if (!/^(0|[1-9]\d*)$/.test(segment)) {
        throw new MaterializedInputDerivationError("invalid_array_index")
      }
      const index = Number(segment)
      if (index < 0 || index >= cursor.length) {
        throw new MaterializedInputDerivationError("invalid_array_index")
      }
      cursor = cursor[index]
    } else if (cursor !== null && typeof cursor === "object") {
      const record = cursor as Record<string, unknown>
      if (!Object.prototype.hasOwnProperty.call(record, segment)) {
        throw new MaterializedInputDerivationError("mutation_path_missing")
      }
      cursor = record[segment]
    } else {
      throw new MaterializedInputDerivationError("mutation_path_missing")
    }
  }

  const last = mutation.path[mutation.path.length - 1]!
  if (FORBIDDEN_PATH_KEYS.has(last)) {
    throw new MaterializedInputDerivationError("dangerous_prototype_path")
  }

  if (Array.isArray(cursor)) {
    if (!/^(0|[1-9]\d*)$/.test(last)) {
      throw new MaterializedInputDerivationError("invalid_array_index")
    }
    const index = Number(last)
    if (index < 0 || index >= cursor.length) {
      throw new MaterializedInputDerivationError("invalid_array_index")
    }
    if (!valuesEqual(cursor[index], mutation.from)) {
      throw new MaterializedInputDerivationError("mutation_from_value_mismatch")
    }
    cursor[index] = cloneJson(mutation.to)
    return clone
  }

  if (cursor === null || typeof cursor !== "object") {
    throw new MaterializedInputDerivationError("mutation_path_missing")
  }
  const record = cursor as Record<string, unknown>
  if (!Object.prototype.hasOwnProperty.call(record, last)) {
    throw new MaterializedInputDerivationError("mutation_path_missing")
  }
  if (!valuesEqual(record[last], mutation.from)) {
    throw new MaterializedInputDerivationError("mutation_from_value_mismatch")
  }
  record[last] = cloneJson(mutation.to)
  return clone
}

function resolveMutationRoot(
  vector: Record<string, unknown>,
  sourceJson: unknown,
): unknown {
  const baseline = vector.baseline_input
  if (baseline === undefined || baseline === null) {
    return sourceJson
  }
  const baselineObject = asObject(baseline, "unsupported_baseline_root")
  const sourceSelector = baselineObject.source
  if (sourceSelector === "source_fixture") {
    return sourceJson
  }
  if (sourceSelector === "source_fixture.input") {
    const sourceObject = asObject(sourceJson, "source_parse_failure")
    if (!Object.prototype.hasOwnProperty.call(sourceObject, "input")) {
      throw new MaterializedInputDerivationError("unsupported_baseline_root")
    }
    return sourceObject.input
  }
  throw new MaterializedInputDerivationError("unsupported_baseline_root")
}

function derivePathMutationInput(
  vector: Record<string, unknown>,
  sourceJson: unknown,
): unknown {
  const mutation = asObject(vector.mutation, "unsupported_derivation")
  if (mutation.operation !== "set") {
    throw new MaterializedInputDerivationError("unsupported_derivation")
  }
  if (!Array.isArray(mutation.path) || mutation.path.some((part) => typeof part !== "string")) {
    throw new MaterializedInputDerivationError("unsupported_derivation")
  }
  const root = resolveMutationRoot(vector, sourceJson)
  return applyPathMutationSet(root, {
    path: mutation.path as string[],
    from: mutation.from,
    to: mutation.to,
  })
}

function deriveContinuityInput(vector: Record<string, unknown>): {
  current: unknown
  predecessor: unknown
} {
  // Committed challenged materialization is authoritative; verify against baseline+substitution.
  const challenged = asObject(vector.challenged_pair, "unsupported_derivation")
  const baseline = asObject(vector.baseline_pair, "unsupported_derivation")
  const substitution = asObject(vector.substitution, "unsupported_derivation")
  const operation = substitution.operation
  if (operation === "remove_predecessor_argument") {
    const derived = {
      current: cloneJson(baseline.current),
      predecessor: null,
    }
    if (!valuesEqual(derived, { current: challenged.current, predecessor: challenged.predecessor })) {
      throw new MaterializedInputDerivationError("derived_request_identity_mismatch")
    }
    return derived
  }
  if (operation === "replace_current_argument") {
    // Challenged current body is committed on the vector; predecessor must match baseline.
    if (!valuesEqual(challenged.predecessor, baseline.predecessor)) {
      throw new MaterializedInputDerivationError("derived_request_identity_mismatch")
    }
    if (challenged.current === undefined) {
      throw new MaterializedInputDerivationError("unsupported_derivation")
    }
    return {
      current: cloneJson(challenged.current),
      predecessor: cloneJson(challenged.predecessor),
    }
  }
  throw new MaterializedInputDerivationError("unsupported_derivation")
}

function deriveCheckpointInput(vector: Record<string, unknown>): unknown {
  const challenged = vector.challenged_checkpoint
  const baseline = vector.baseline_checkpoint
  const substitution = asObject(vector.substitution, "unsupported_derivation")
  if (challenged === undefined || baseline === undefined) {
    throw new MaterializedInputDerivationError("unsupported_derivation")
  }
  const baselineObject = asObject(baseline, "non_canonical_material")
  const challengedObject = asObject(challenged, "non_canonical_material")
  const derived = cloneJson(baselineObject)
  if (substitution.operation === "mutate_checkpoint_root_only") {
    if (
      typeof substitution.baseline_checkpoint_root !== "string" ||
      typeof substitution.challenged_checkpoint_root !== "string"
    ) {
      throw new MaterializedInputDerivationError("unsupported_derivation")
    }
    if (!valuesEqual(baselineObject.checkpoint_root, substitution.baseline_checkpoint_root)) {
      throw new MaterializedInputDerivationError("mutation_from_value_mismatch")
    }
    derived.checkpoint_root = substitution.challenged_checkpoint_root
  } else if (substitution.operation === "permute_entry_refs_order_only") {
    if (!valuesEqual(baselineObject.entry_refs, substitution.baseline_entry_refs)) {
      throw new MaterializedInputDerivationError("mutation_from_value_mismatch")
    }
    derived.entry_refs = cloneJson(substitution.challenged_entry_refs)
  } else {
    throw new MaterializedInputDerivationError("unsupported_derivation")
  }
  if (!valuesEqual(derived, challengedObject)) {
    throw new MaterializedInputDerivationError("derived_request_identity_mismatch")
  }
  return cloneJson(challengedObject)
}

function deriveCabNestInput(vector: Record<string, unknown>): unknown {
  if (!Object.prototype.hasOwnProperty.call(vector, "input")) {
    throw new MaterializedInputDerivationError("unsupported_cab_materialization")
  }
  if (vector.operation !== "semantic_snapshot") {
    throw new MaterializedInputDerivationError("unsupported_cab_materialization")
  }
  return cloneJson(vector.input)
}

function deriveCabManifestOperands(vector: Record<string, unknown>): {
  first: string
  second: string
} {
  if (vector.operation !== "manifest_file_sha256") {
    throw new MaterializedInputDerivationError("unsupported_cab_materialization")
  }
  if (!Array.isArray(vector.inputs) || vector.inputs.length !== 2) {
    throw new MaterializedInputDerivationError("composite_operand_mismatch")
  }
  const first = asObject(vector.inputs[0], "composite_operand_mismatch")
  const second = asObject(vector.inputs[1], "composite_operand_mismatch")
  if (first.encoding !== "utf8_string" || second.encoding !== "utf8_string") {
    throw new MaterializedInputDerivationError("composite_operand_mismatch")
  }
  if (typeof first.value !== "string" || typeof second.value !== "string") {
    throw new MaterializedInputDerivationError("composite_operand_mismatch")
  }
  return { first: first.value, second: second.value }
}

function buildOrdinaryCarrier(
  model: VerifierChallengeVectorModelV0,
  input: unknown,
): NeighborhoodMemberCarrierV0 {
  const challenge = projectCounterfactualChallengeIdentity(model)
  switch (model.surface) {
    case "verify_handoff_receipt_root":
      return {
        schema: COUNTERFACTUAL_NEIGHBORHOOD_MEMBER_CARRIER_SCHEMA,
        route: "single_vector",
        request: {
          schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
          surface: "verify_handoff_receipt_root",
          subject: {
            entrypoint: VERIFY_HANDOFF_ADAPTER_IDENTITY.entrypoint,
            module_path: VERIFY_HANDOFF_ADAPTER_IDENTITY.module_path,
            git_blob_oid: VERIFY_HANDOFF_ADAPTER_IDENTITY.git_blob_oid,
          },
          challenge,
          lane_a_model: model,
          input: { evidence: input as never },
        },
      }
    case "chronicle_admission": {
      const admission = asObject(input, "non_canonical_material")
      return {
        schema: COUNTERFACTUAL_NEIGHBORHOOD_MEMBER_CARRIER_SCHEMA,
        route: "single_vector",
        request: {
          schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
          surface: "chronicle_admission",
          subject: {
            entrypoint: CHRONICLE_ADMISSION_ADAPTER_IDENTITY.entrypoint,
            module_path: CHRONICLE_ADMISSION_ADAPTER_IDENTITY.module_path,
            git_blob_oid: CHRONICLE_ADMISSION_ADAPTER_IDENTITY.git_blob_oid,
          },
          challenge,
          lane_a_model: model,
          input: {
            evidence: admission.evidence as never,
            proof_object: admission.proof_object as never,
            options: admission.options as never,
          },
        },
      }
    }
    case "chronicle_continuity": {
      const pair = asObject(input, "non_canonical_material")
      return {
        schema: COUNTERFACTUAL_NEIGHBORHOOD_MEMBER_CARRIER_SCHEMA,
        route: "single_vector",
        request: {
          schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
          surface: "chronicle_continuity",
          subject: {
            entrypoint: CHRONICLE_CONTINUITY_ADAPTER_IDENTITY.entrypoint,
            module_path: CHRONICLE_CONTINUITY_ADAPTER_IDENTITY.module_path,
            git_blob_oid: CHRONICLE_CONTINUITY_ADAPTER_IDENTITY.git_blob_oid,
          },
          challenge,
          lane_a_model: model,
          input: {
            current: pair.current as never,
            predecessor: pair.predecessor as never,
          },
        },
      }
    }
    case "chronicle_checkpoint_local":
      return {
        schema: COUNTERFACTUAL_NEIGHBORHOOD_MEMBER_CARRIER_SCHEMA,
        route: "single_vector",
        request: {
          schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
          surface: "chronicle_checkpoint_local",
          subject: {
            entrypoint: CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY.entrypoint,
            module_path: CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY.module_path,
            git_blob_oid: CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY.git_blob_oid,
          },
          challenge,
          lane_a_model: model,
          input: { checkpoint: input as never },
        },
      }
    case "counterfactual_audit_boundary":
      return {
        schema: COUNTERFACTUAL_NEIGHBORHOOD_MEMBER_CARRIER_SCHEMA,
        route: "single_vector",
        request: {
          schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
          surface: "counterfactual_audit_boundary",
          subject: null,
          operation: "semantic_snapshot",
          challenge,
          lane_a_model: model,
          input: { value: input },
        },
      }
    default: {
      const _exhaustive: never = model.surface
      return _exhaustive
    }
  }
}

/**
 * Pure derivation of one neighborhood member carrier from authenticated JSON.
 */
export function deriveNeighborhoodMemberCarrierFromAuthenticatedMaterials(input: {
  readonly vector: Record<string, unknown>
  readonly sourceJson: unknown | null
}): NeighborhoodMemberCarrierV0 {
  const model = projectVerifierChallengeVector(cloneJson(input.vector))
  const surface = model.surface

  if (surface === "verify_handoff_receipt_root") {
    if (input.sourceJson === null) {
      throw new MaterializedInputDerivationError("source_missing")
    }
    const evidence = derivePathMutationInput(input.vector, input.sourceJson)
    return buildOrdinaryCarrier(model, evidence)
  }

  if (surface === "chronicle_admission") {
    if (input.sourceJson === null) {
      throw new MaterializedInputDerivationError("source_missing")
    }
    const admissionInput = derivePathMutationInput(input.vector, input.sourceJson)
    return buildOrdinaryCarrier(model, admissionInput)
  }

  if (surface === "chronicle_continuity") {
    const pair = deriveContinuityInput(input.vector)
    return buildOrdinaryCarrier(model, pair)
  }

  if (surface === "chronicle_checkpoint_local") {
    const checkpoint = deriveCheckpointInput(input.vector)
    return buildOrdinaryCarrier(model, checkpoint)
  }

  if (surface === "counterfactual_audit_boundary") {
    if (model.vector_id === "V-AT-NEST-OBJ") {
      return buildOrdinaryCarrier(model, deriveCabNestInput(input.vector))
    }
    if (model.vector_id === "V-MAN-HASH-DIFF") {
      const operands = deriveCabManifestOperands(input.vector)
      const challenge = projectCounterfactualChallengeIdentity(model)
      return {
        schema: COUNTERFACTUAL_NEIGHBORHOOD_MEMBER_CARRIER_SCHEMA,
        route: "cab_manifest_hash_diff",
        request: {
          schema: CAB_MANIFEST_HASH_DIFF_EVALUATION_REQUEST_SCHEMA,
          surface: "counterfactual_audit_boundary",
          evaluation_operation: "manifest_hash_differs",
          challenge,
          lane_a_model: model,
          operands: {
            first: { bytes: operands.first },
            second: { bytes: operands.second },
          },
        },
      }
    }
    throw new MaterializedInputDerivationError("unknown_vector")
  }

  throw new MaterializedInputDerivationError("unsupported_derivation")
}

function loadVectorJson(repositoryRoot: string, authority: VectorAuthorityV0): Record<string, unknown> {
  assertSafeRelativePath(authority.vector_path)
  const pathOid = gitPathOid(repositoryRoot, authority.vector_path)
  if (pathOid === null) {
    throw new MaterializedInputDerivationError("unknown_vector")
  }
  const oid = authority.vector_git_blob_oid ?? pathOid
  if (authority.vector_git_blob_oid !== null && authority.vector_git_blob_oid !== pathOid) {
    throw new MaterializedInputDerivationError("vector_blob_mismatch")
  }
  const bytes = runGit(repositoryRoot, ["cat-file", "blob", oid])
  if (bytes === null) {
    // Fallback: some environments may lack the object; still reject worktree-as-authority
    // unless OID matches recomputed worktree bytes exactly.
    try {
      const absolute = resolveUnderRoot(repositoryRoot, authority.vector_path)
      const worktree = readFileSync(absolute)
      if (computeGitBlobOidSha1(worktree) !== oid) {
        throw new MaterializedInputDerivationError("vector_blob_mismatch")
      }
      return asObject(parseJsonBytes(worktree, "vector_parse_failure"), "vector_parse_failure")
    } catch (error) {
      if (error instanceof MaterializedInputDerivationError) throw error
      throw new MaterializedInputDerivationError("unknown_vector")
    }
  }
  if (computeGitBlobOidSha1(bytes) !== oid) {
    throw new MaterializedInputDerivationError("vector_blob_mismatch")
  }
  return asObject(parseJsonBytes(bytes, "vector_parse_failure"), "vector_parse_failure")
}

function loadSourceForVector(
  repositoryRoot: string,
  vector: Record<string, unknown>,
): unknown | null {
  if (!Object.prototype.hasOwnProperty.call(vector, "source_fixture") || vector.source_fixture === null) {
    return null
  }
  const sourceFixture = asObject(vector.source_fixture, "unsupported_source_scheme")
  const repositoryPath = sourceFixture.repository_path
  const gitBlobOid = sourceFixture.git_blob_oid
  if (typeof repositoryPath !== "string" || typeof gitBlobOid !== "string") {
    throw new MaterializedInputDerivationError("unsupported_source_scheme")
  }
  const bytes = loadPinnedGitBlobBytes(repositoryRoot, repositoryPath, gitBlobOid)
  return parseJsonBytes(bytes, "source_parse_failure")
}

function loadPinnedNeighborhood(repositoryRoot: string): FrozenCounterfactualNeighborhoodV0 {
  const pathOid = gitPathOid(repositoryRoot, NEIGHBORHOOD_FIXTURE_PATH)
  if (pathOid === null) {
    throw new MaterializedInputDerivationError("neighborhood_inventory_mismatch")
  }
  const bytes = runGit(repositoryRoot, ["cat-file", "blob", pathOid])
  let parsed: unknown
  if (bytes !== null && computeGitBlobOidSha1(bytes) === pathOid) {
    parsed = parseJsonBytes(bytes, "non_canonical_material")
  } else {
    const worktree = readFileSync(resolveUnderRoot(repositoryRoot, NEIGHBORHOOD_FIXTURE_PATH))
    if (computeGitBlobOidSha1(worktree) !== pathOid) {
      throw new MaterializedInputDerivationError("neighborhood_inventory_mismatch")
    }
    parsed = parseJsonBytes(worktree, "non_canonical_material")
  }
  const fixture = asObject(parsed, "neighborhood_inventory_mismatch")
  const neighborhood = fixture.neighborhood as FrozenCounterfactualNeighborhoodV0
  if (neighborhood?.schema !== COUNTERFACTUAL_NEIGHBORHOOD_SCHEMA) {
    throw new MaterializedInputDerivationError("neighborhood_inventory_mismatch")
  }
  if (computeFrozenCounterfactualNeighborhoodSha256(neighborhood) !== PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0) {
    throw new MaterializedInputDerivationError("neighborhood_inventory_mismatch")
  }
  if (neighborhood.members.length !== PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0.length) {
    throw new MaterializedInputDerivationError("neighborhood_inventory_mismatch")
  }
  for (let i = 0; i < PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0.length; i += 1) {
    const pinned = PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0[i]!
    const member = neighborhood.members[i]!
    if (
      member.package_version !== pinned.package_version ||
      member.vector_id !== pinned.vector_id ||
      member.surface !== pinned.surface
    ) {
      throw new MaterializedInputDerivationError("neighborhood_inventory_mismatch")
    }
  }
  return cloneJson(neighborhood)
}

/**
 * Pure aggregate assembly from already-authenticated per-member materials.
 */
export function deriveNeighborhoodConformanceRequestFromAuthenticatedMaterials(input: {
  readonly neighborhood: FrozenCounterfactualNeighborhoodV0
  readonly members: ReadonlyArray<{
    readonly vector: Record<string, unknown>
    readonly sourceJson: unknown | null
  }>
}): CounterfactualNeighborhoodConformanceRequestV0 {
  if (input.members.length !== PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0.length) {
    throw new MaterializedInputDerivationError("neighborhood_inventory_mismatch")
  }
  if (computeFrozenCounterfactualNeighborhoodSha256(input.neighborhood) !== PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0) {
    throw new MaterializedInputDerivationError("neighborhood_inventory_mismatch")
  }
  const carriers: NeighborhoodMemberCarrierV0[] = []
  for (let i = 0; i < input.members.length; i += 1) {
    const pinned = PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0[i]!
    const material = input.members[i]!
    const vector = asObject(material.vector, "vector_parse_failure")
    if (vector.package_version !== pinned.package_version || vector.vector_id !== pinned.vector_id) {
      throw new MaterializedInputDerivationError("neighborhood_inventory_mismatch")
    }
    const carrier = deriveNeighborhoodMemberCarrierFromAuthenticatedMaterials({
      vector,
      sourceJson: material.sourceJson,
    })
    const challenge = carrier.request.challenge
    const expectedIdentity = input.neighborhood.members[i]!
    if (canonicalIdentityJson(challenge) !== canonicalIdentityJson(expectedIdentity)) {
      throw new MaterializedInputDerivationError("derived_request_identity_mismatch")
    }
    if (carrier.route !== pinned.route) {
      throw new MaterializedInputDerivationError("derived_request_identity_mismatch")
    }
    carriers.push(carrier)
  }
  return {
    schema: COUNTERFACTUAL_NEIGHBORHOOD_CONFORMANCE_REQUEST_SCHEMA,
    neighborhood: cloneJson(input.neighborhood),
    members: carriers,
  }
}

/**
 * Production entry: load closed frozen authorities and derive the Lane H request.
 */
export function deriveCounterfactualNeighborhoodConformanceRequest(options?: {
  readonly repositoryRoot?: string
}): CounterfactualNeighborhoodConformanceRequestV0 {
  const repositoryRoot = resolve(options?.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT)
  const neighborhood = loadPinnedNeighborhood(repositoryRoot)

  if (VECTOR_AUTHORITIES.length !== PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0.length) {
    throw new MaterializedInputDerivationError("neighborhood_inventory_mismatch")
  }

  const materials: Array<{ vector: Record<string, unknown>; sourceJson: unknown | null }> = []
  for (let i = 0; i < VECTOR_AUTHORITIES.length; i += 1) {
    const authority = VECTOR_AUTHORITIES[i]!
    const pinned = PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0[i]!
    if (
      authority.package_version !== pinned.package_version ||
      authority.vector_id !== pinned.vector_id
    ) {
      throw new MaterializedInputDerivationError("neighborhood_inventory_mismatch")
    }
    const vector = loadVectorJson(repositoryRoot, authority)
    if (vector.package_version !== authority.package_version || vector.vector_id !== authority.vector_id) {
      throw new MaterializedInputDerivationError("unknown_vector")
    }
    const sourceJson = loadSourceForVector(repositoryRoot, vector)
    materials.push({ vector, sourceJson })
  }

  return deriveNeighborhoodConformanceRequestFromAuthenticatedMaterials({
    neighborhood,
    members: materials,
  })
}

export function listMaterializedInputVectorAuthorities(): readonly VectorAuthorityV0[] {
  return VECTOR_AUTHORITIES
}
