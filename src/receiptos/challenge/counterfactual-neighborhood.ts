/**
 * Frozen counterfactual neighborhood identity v0.
 *
 * Lane B: deterministic identity for a *declared ordered* set of frozen
 * challenge descriptors. Does not generate neighbors, evaluate verifiers, or
 * incorporate expected/actual outcomes.
 *
 * Identity recipe (byte-deterministic):
 * 1. Project each challenge to CounterfactualChallengeIdentityV0 (fields below).
 * 2. Build FrozenCounterfactualNeighborhoodV0 with declared member order.
 * 3. Canonical JSON: sort object keys ascending; arrays keep declared order;
 *    compact separators; null preserved; UTF-8; no undefined keys.
 * 4. Digest: SHA-256 over UTF-8 bytes, lowercase hex.
 *
 * Explicitly excluded from challenge/neighborhood identity:
 * - expected verifier observation / expected_result_set
 * - actual verifier results / conformance verdicts
 * - host/runtime state, timestamps, absolute paths
 * - Lane A `native` full clone and `field_classification`
 * - filesystem order (members are caller-declared)
 *
 * Matches the aggregate auditor canonicalization convention used by
 * child_identity_set_sha256 (sort_keys + compact separators), applied to this
 * neighborhood schema rather than package child digests.
 */

import { createHash } from "node:crypto"
import type {
  ChallengeDerivation,
  ChallengeSurfaceKind,
  PinnedGitObjectIdentity,
  SubjectEntrypointIdentity,
  VerifierChallengeVectorModelV0,
} from "./verifier-challenge-model"

// canonicalIdentityJson now lives in canonical-identity-json.ts (a
// dedicated, domain-neutral module with zero runtime imports). Imported
// here for this file's own internal use (below), and re-exported
// unchanged so every existing caller of this module keeps working without
// modification. See that module's header comment for why.
import { canonicalIdentityJson } from "./canonical-identity-json"
export { canonicalIdentityJson }

export const COUNTERFACTUAL_CHALLENGE_IDENTITY_SCHEMA =
  "receiptos.counterfactual_challenge_identity.v0" as const

export const COUNTERFACTUAL_NEIGHBORHOOD_SCHEMA = "receiptos.counterfactual_neighborhood.v0" as const

export type CounterfactualChallengeIdentitySchema = typeof COUNTERFACTUAL_CHALLENGE_IDENTITY_SCHEMA
export type CounterfactualNeighborhoodSchema = typeof COUNTERFACTUAL_NEIGHBORHOOD_SCHEMA

/**
 * Deterministic projection of one frozen challenge for neighborhood membership.
 * Null subject/source/challenge_id are retained explicitly (CAB).
 */
export interface CounterfactualChallengeIdentityV0 {
  readonly schema: CounterfactualChallengeIdentitySchema
  readonly native_schema: string
  readonly package_version: string
  readonly vector_id: string
  readonly challenge_id: string | null
  readonly execution_class: string
  readonly surface: ChallengeSurfaceKind
  readonly subject: SubjectEntrypointIdentity | null
  readonly source: PinnedGitObjectIdentity | null
  readonly derivation: ChallengeDerivation
}

/** Declared ordered frozen neighborhood. Order is identity-significant. */
export interface FrozenCounterfactualNeighborhoodV0 {
  readonly schema: CounterfactualNeighborhoodSchema
  readonly neighborhood_id: string
  readonly version: "v0"
  readonly members: readonly CounterfactualChallengeIdentityV0[]
}

function sha256Utf8Hex(canonicalJson: string): string {
  return createHash("sha256").update(canonicalJson, "utf8").digest("hex")
}

function cloneDerivation(derivation: ChallengeDerivation): ChallengeDerivation {
  return structuredClone(derivation)
}

/**
 * Project a Lane A challenge model into neighborhood challenge identity.
 * Does not mutate `model`. Excludes expected/native/field_classification.
 */
export function projectCounterfactualChallengeIdentity(
  model: VerifierChallengeVectorModelV0,
): CounterfactualChallengeIdentityV0 {
  return {
    schema: COUNTERFACTUAL_CHALLENGE_IDENTITY_SCHEMA,
    native_schema: model.native_schema,
    package_version: model.package_version,
    vector_id: model.vector_id,
    challenge_id: model.challenge_id,
    execution_class: model.execution_class,
    surface: model.surface,
    subject: model.subject === null ? null : { ...model.subject },
    source: model.source === null ? null : { ...model.source },
    derivation: cloneDerivation(model.derivation),
  }
}

export function computeCounterfactualChallengeIdentitySha256(
  identity: CounterfactualChallengeIdentityV0,
): string {
  return sha256Utf8Hex(canonicalIdentityJson(identity))
}

/**
 * Build a frozen neighborhood from Lane A models in declared order.
 * Does not sort members. Does not mutate inputs.
 */
export function projectFrozenCounterfactualNeighborhood(input: {
  readonly neighborhood_id: string
  readonly members: readonly VerifierChallengeVectorModelV0[]
}): FrozenCounterfactualNeighborhoodV0 {
  if (typeof input.neighborhood_id !== "string" || input.neighborhood_id.length === 0) {
    throw new Error("neighborhood_id must be a non-empty string")
  }
  return {
    schema: COUNTERFACTUAL_NEIGHBORHOOD_SCHEMA,
    neighborhood_id: input.neighborhood_id,
    version: "v0",
    members: input.members.map((member) => projectCounterfactualChallengeIdentity(member)),
  }
}

export function computeFrozenCounterfactualNeighborhoodSha256(
  neighborhood: FrozenCounterfactualNeighborhoodV0,
): string {
  if (neighborhood.schema !== COUNTERFACTUAL_NEIGHBORHOOD_SCHEMA) {
    throw new Error(`unsupported neighborhood schema: ${neighborhood.schema}`)
  }
  if (neighborhood.version !== "v0") {
    throw new Error(`unsupported neighborhood version: ${String(neighborhood.version)}`)
  }
  return sha256Utf8Hex(canonicalIdentityJson(neighborhood))
}
