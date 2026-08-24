/** Byte-derived protocol-v2 real intended-instance eligibility verifier. */

import { REKOR_V1_ENDPOINT, REKOR_V1_LOG_ID } from "./independent-authority-model"
import { acceptIntendedFaithfulnessV1FromBytes } from "./intended-faithfulness-v1"
import { acceptE0RecordV2FromBytes, acceptObjectAV1FromBytes } from "./object-a-e0-contract-v1"
import * as RekorV1 from "./rekor-v1-verifier"

export const REAL_INTENDED_INSTANCE_ELIGIBILITY_SCHEMA =
  "tsei-invariant-discrimination-v1.real-intended-instance-eligibility.v0" as const

export const REAL_INTENDED_INSTANCE_ELIGIBILITY_INPUT_KEYS = [
  "intended_faithfulness_bytes",
  "object_a_bytes",
  "e0_record_bytes",
  "policy_bytes",
  "rekor_documents",
] as const

const CALLER_SHAPED_KEYS = new Set([
  "intended",
  "object_a",
  "e0_record",
  "digests",
  "global_log_indexes",
  "observations",
  "publisher_identifiers",
  "trust_root_id",
  "captured_tree",
  "freeze_precedes_object_a",
  "freeze_precedes_e0",
  "eligible",
  "eligibility",
  "status",
  "production_publishable",
  "sufficient_for_real_intended_instance",
  "sufficient_for_proven_grounding",
  "sufficient_for_real_run",
  "PROVEN",
  "synthetic",
])

export type RealIntendedInstanceEligibilityEvidence = {
  readonly e0_global_log_index: number
  readonly e0_record_sha256: string
  readonly instance_id: string
  readonly intended_faithfulness_sha256: string
  readonly log_id: string
  readonly object_a_sha256: string
  readonly order: "P0_LT_E0"
  readonly p0_global_log_index: number
  readonly provider_id: "rekor-v1"
  readonly tree_id: string
}

export type RealIntendedInstanceEligibilityResult =
  | {
      readonly evidence: RealIntendedInstanceEligibilityEvidence
      readonly ok: true
      readonly reasons: readonly []
      readonly status: "ELIGIBLE"
      readonly sufficient_for_real_intended_instance: true
    }
  | {
      readonly evidence: null
      readonly ok: false
      readonly reasons: readonly string[]
      readonly status: "INELIGIBLE"
      readonly sufficient_for_real_intended_instance: false
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value
  Object.freeze(value)
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item)
  } else {
    for (const key of Object.keys(value as object)) deepFreeze((value as Record<string, unknown>)[key])
  }
  return value
}

function unique(reasons: readonly string[]): string[] {
  return [...new Set(reasons)]
}

function fail(reasons: readonly string[]): RealIntendedInstanceEligibilityResult {
  return deepFreeze({
    evidence: null,
    ok: false,
    reasons: unique(reasons.length > 0 ? reasons : ["malformed_eligibility_bundle"]),
    status: "INELIGIBLE",
    sufficient_for_real_intended_instance: false,
  })
}

function exactInputKeys(value: Record<string, unknown>): { ok: true } | { ok: false; reasons: string[] } {
  const reasons: string[] = []
  const allowed = new Set<string>(REAL_INTENDED_INSTANCE_ELIGIBILITY_INPUT_KEYS)
  for (const key of Object.keys(value)) {
    if (CALLER_SHAPED_KEYS.has(key)) reasons.push("caller_shaped_proof_field")
    else if (!allowed.has(key)) reasons.push("unexpected_eligibility_bundle_key")
  }
  for (const key of REAL_INTENDED_INSTANCE_ELIGIBILITY_INPUT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) reasons.push(`missing_${key}`)
  }
  return reasons.length === 0 ? { ok: true } : { ok: false, reasons: unique(reasons) }
}

export function verifyRealIntendedInstanceEligibility(input: unknown): RealIntendedInstanceEligibilityResult {
  try {
    if (!isRecord(input)) return fail(["malformed_eligibility_bundle"])
    const keyCheck = exactInputKeys(input)
    if (!keyCheck.ok) return fail(keyCheck.reasons)

    const intendedBytes = input["intended_faithfulness_bytes"]
    const objectABytes = input["object_a_bytes"]
    const e0Bytes = input["e0_record_bytes"]
    const policyBytes = input["policy_bytes"]
    const documents = input["rekor_documents"]
    if (!(intendedBytes instanceof Uint8Array)) return fail(["intended_bytes_not_bytes"])
    if (!(objectABytes instanceof Uint8Array)) return fail(["object_a_bytes_not_bytes"])
    if (!(e0Bytes instanceof Uint8Array)) return fail(["e0_record_bytes_not_bytes"])
    if (!(policyBytes instanceof Uint8Array)) return fail(["policy_bytes_not_bytes"])
    if (!Array.isArray(documents)) return fail(["rekor_documents_not_array"])

    const intended = acceptIntendedFaithfulnessV1FromBytes({ bytes: intendedBytes })
    if (!intended.ok) return fail(["intended_not_accepted", ...intended.reasons])
    const objectA = acceptObjectAV1FromBytes({ bytes: objectABytes, intended })
    if (!objectA.ok) return fail(["object_a_not_accepted", ...objectA.reasons])
    const e0 = acceptE0RecordV2FromBytes({ bytes: e0Bytes })
    if (!e0.ok) return fail(["e0_record_not_accepted", ...e0.reasons])

    if (intended.artifact.instance_id !== objectA.artifact.instance_id || objectA.artifact.instance_id !== e0.record.instance_id) {
      return fail(["instance_id_mismatch"])
    }
    if (e0.record.intended_faithfulness_sha256 !== intended.digest) return fail(["e0_intended_digest_mismatch"])
    if (e0.record.problem_package_sha256 !== objectA.digest) return fail(["e0_object_a_digest_mismatch"])

    const policy = RekorV1.evaluateP0ProviderPolicyFreezeV1(policyBytes)
    if (!policy.frozen || policy.digest !== RekorV1.REKOR_V1_P0_PROVIDER_POLICY_V1_SHA256) {
      return fail(["provider_policy_not_frozen", ...policy.reasons])
    }

    const sequence = RekorV1.verifyRekorV1IntendedEligibilitySequenceV1({
      policy_bytes: policyBytes,
      p0_artifact_bytes: intendedBytes,
      e0_artifact_bytes: e0Bytes,
      lookup: RekorV1.lookupFromRekorDocuments(documents),
      observed_endpoint: REKOR_V1_ENDPOINT,
    })
    if (!sequence.ok) {
      const stage = sequence.publications.length <= 1 ? "p0_publication_unverified" : "e0_publication_unverified"
      return fail([stage, ...sequence.reasons])
    }
    const p0 = sequence.publications[0]
    const e0Publication = sequence.publications[1]
    const p0Index = sequence.global_log_indexes[0]
    const e0Index = sequence.global_log_indexes[1]
    if (!p0?.ok || !e0Publication?.ok || p0Index === undefined || e0Index === undefined || !sequence.captured_tree_id) {
      return fail(["p0_e0_publication_evidence_incomplete"])
    }
    if (!(p0Index < e0Index)) return fail(["p0_not_before_e0"])
    if (p0.artifact_sha256 !== intended.digest) return fail(["p0_digest_mismatch"])
    if (e0Publication.artifact_sha256 !== e0.digest) return fail(["e0_publication_digest_mismatch"])

    const evidence: RealIntendedInstanceEligibilityEvidence = {
      e0_global_log_index: e0Index,
      e0_record_sha256: e0.digest,
      instance_id: intended.artifact.instance_id,
      intended_faithfulness_sha256: intended.digest,
      log_id: REKOR_V1_LOG_ID,
      object_a_sha256: objectA.digest,
      order: "P0_LT_E0",
      p0_global_log_index: p0Index,
      provider_id: "rekor-v1",
      tree_id: sequence.captured_tree_id,
    }
    return deepFreeze({
      evidence,
      ok: true,
      reasons: [],
      status: "ELIGIBLE",
      sufficient_for_real_intended_instance: true,
    })
  } catch {
    return fail(["malformed_eligibility_bundle"])
  }
}
