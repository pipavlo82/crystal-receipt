/** Protocol-v2 Object A and E0 exact-byte contracts. */

import {
  AUTHORITY_RELATIONSHIP_CLASS,
  BLIND_PROBLEM_SCHEMA,
  type BlindProblemPackage,
  type ConcreteCaseValue,
} from "./independent-authority-model"
import * as IndependentAuthority from "./independent-authority"
import {
  FROZEN_PROTOCOL_V2_SHA256,
  HISTORICAL_IA_INSTANCE_IDS,
  INTENDED_FAITHFULNESS_V1_SCHEMA,
  REKOR_V1_PROVIDER_POLICY_V1_SHA256,
  type IntendedFaithfulnessAcceptanceV1,
  type IntendedFaithfulnessArtifactV1,
} from "./intended-faithfulness-v1"

export const BLIND_PROBLEM_V1_SCHEMA = "tsei-invariant-discrimination-v1.blind-problem.v1" as const
export const E0_RECORD_V2_SCHEMA = "tsei-invariant-discrimination-v1.e0-record.v2" as const
export const OBJECT_A_V1_EVALUATION_INSTRUCTION =
  "For each case, determine the exact set of declared invariants violated by the mutated value, using only the invariant definitions and case data contained in Object A." as const

export const OBJECT_A_V1_KEYS = ["schema", "instance_id", "evaluation_instruction", "invariants", "cases"] as const
export const E0_RECORD_V2_KEYS = [
  "schema",
  "protocol_sha256",
  "provider_policy_sha256",
  "instance_id",
  "problem_package_sha256",
  "intended_faithfulness_sha256",
  "authority_relationship_class",
  "oracle_commitment",
] as const

const INVARIANT_KEYS = ["invariant_id", "normative_definition", "normative_definition_identity"] as const
const CASE_KEYS = ["mutant_id", "baseline", "mutated"] as const
const INSTANCE_ID_RE = /^[a-z0-9._-]+$/
const HEX64 = /^[0-9a-f]{64}$/

export type BlindProblemPackageV1 = {
  readonly schema: typeof BLIND_PROBLEM_V1_SCHEMA
  readonly instance_id: string
  readonly evaluation_instruction: typeof OBJECT_A_V1_EVALUATION_INSTRUCTION
  readonly invariants: {
    readonly [invariantId: string]: {
      readonly invariant_id: string
      readonly normative_definition: string
      readonly normative_definition_identity: string
    }
  }
  readonly cases: {
    readonly [mutantId: string]: {
      readonly mutant_id: string
      readonly baseline: ConcreteCaseValue
      readonly mutated: ConcreteCaseValue
    }
  }
}

export type ObjectAAcceptanceV1 =
  | {
      readonly ok: true
      readonly reasons: readonly []
      readonly bytes: Buffer
      readonly digest: string
      readonly artifact: BlindProblemPackageV1
      readonly package: BlindProblemPackage
    }
  | {
      readonly ok: false
      readonly reasons: readonly string[]
      readonly bytes: null
      readonly digest: null
      readonly artifact: null
      readonly package: null
    }

export type E0RecordV2 = {
  readonly schema: typeof E0_RECORD_V2_SCHEMA
  readonly protocol_sha256: typeof FROZEN_PROTOCOL_V2_SHA256
  readonly provider_policy_sha256: typeof REKOR_V1_PROVIDER_POLICY_V1_SHA256
  readonly instance_id: string
  readonly problem_package_sha256: string
  readonly intended_faithfulness_sha256: string
  readonly authority_relationship_class: typeof AUTHORITY_RELATIONSHIP_CLASS
  readonly oracle_commitment: string
}

export type E0AcceptanceV2 =
  | { readonly ok: true; readonly reasons: readonly []; readonly bytes: Buffer; readonly digest: string; readonly record: E0RecordV2 }
  | { readonly ok: false; readonly reasons: readonly string[]; readonly bytes: null; readonly digest: null; readonly record: null }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function keysExact(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value
  if (ArrayBuffer.isView(value)) return value
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

function parseCanonical(bytes: Buffer, label: string): { ok: true; value: unknown } | { ok: false; reasons: string[] } {
  const reasons: string[] = []
  if (bytes.length === 0) reasons.push(`${label}_empty`)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) reasons.push(`${label}_bom`)
  let lf = 0
  for (const byte of bytes) {
    if (byte === 0) reasons.push(`${label}_nul`)
    if (byte === 13) reasons.push(`${label}_cr`)
    if (byte === 10) lf += 1
  }
  if (bytes.length === 0 || bytes[bytes.length - 1] !== 10) reasons.push(`${label}_missing_lf`)
  if (lf !== 1) reasons.push(`${label}_wrong_lf_count`)
  if (reasons.length > 0) return { ok: false, reasons: unique(reasons) }
  let value: unknown
  try {
    value = JSON.parse(bytes.toString("utf8").slice(0, -1))
  } catch {
    return { ok: false, reasons: [`${label}_invalid_json`] }
  }
  try {
    if (!IndependentAuthority.encodeJsonUtf8Lf(value).equals(bytes)) {
      return { ok: false, reasons: [`${label}_non_canonical`] }
    }
  } catch {
    return { ok: false, reasons: [`${label}_non_canonical`] }
  }
  return { ok: true, value }
}

function copyConcrete(value: ConcreteCaseValue): ConcreteCaseValue {
  const out: Record<string, ConcreteCaseValue[string]> = {}
  for (const [key, item] of Object.entries(value)) {
    out[key] = Array.isArray(item) ? ([...item] as number[] | string[]) : item
  }
  return out
}

export function materializeObjectAV1(intended: IntendedFaithfulnessArtifactV1): {
  readonly artifact: BlindProblemPackageV1
  readonly package: BlindProblemPackage
  readonly bytes: Buffer
  readonly digest: string
} {
  const invariants = Object.fromEntries(
    Object.keys(intended.invariants).map((id) => {
      const row = intended.invariants[id]!
      return [id, { invariant_id: row.invariant_id, normative_definition: row.normative_definition, normative_definition_identity: row.normative_definition_identity }]
    }),
  )
  const cases = Object.fromEntries(
    Object.keys(intended.cases).map((id) => {
      const row = intended.cases[id]!
      return [id, { mutant_id: row.mutant_id, baseline: copyConcrete(row.baseline), mutated: copyConcrete(row.mutated) }]
    }),
  )
  const artifact: BlindProblemPackageV1 = {
    schema: BLIND_PROBLEM_V1_SCHEMA,
    instance_id: intended.instance_id,
    evaluation_instruction: OBJECT_A_V1_EVALUATION_INSTRUCTION,
    invariants,
    cases,
  }
  const pkg: BlindProblemPackage = {
    schema: BLIND_PROBLEM_SCHEMA,
    instance_id: artifact.instance_id,
    evaluation_instruction: artifact.evaluation_instruction,
    invariants,
    cases,
  }
  const bytes = IndependentAuthority.encodeJsonUtf8Lf(artifact)
  return deepFreeze({ artifact, package: pkg, bytes, digest: IndependentAuthority.sha256ExactBytes(bytes) })
}

function failObjectA(reasons: readonly string[]): ObjectAAcceptanceV1 {
  return { ok: false, reasons: unique(reasons), bytes: null, digest: null, artifact: null, package: null }
}

export function acceptObjectAV1FromBytes(input: unknown): ObjectAAcceptanceV1 {
  try {
    if (!isRecord(input) || !keysExact(input, ["bytes", "intended"])) return failObjectA(["malformed_object_a_input"])
    if (!(input["bytes"] instanceof Uint8Array)) return failObjectA(["object_a_bytes_not_bytes"])
    const intended = input["intended"] as IntendedFaithfulnessAcceptanceV1
    if (!isRecord(intended) || intended.ok !== true || intended.artifact?.schema !== INTENDED_FAITHFULNESS_V1_SCHEMA) {
      return failObjectA(["intended_not_accepted"])
    }
    const bytes = Buffer.from(input["bytes"])
    const parsed = parseCanonical(bytes, "object_a_bytes")
    if (!parsed.ok) return failObjectA(parsed.reasons)
    if (!isRecord(parsed.value) || !keysExact(parsed.value, OBJECT_A_V1_KEYS)) return failObjectA(["object_a_shape_mismatch"])
    const materialized = materializeObjectAV1(intended.artifact)
    if (!materialized.bytes.equals(bytes)) return failObjectA(["object_a_not_faithful"])
    return {
      ok: true,
      reasons: [],
      bytes: Buffer.from(bytes),
      digest: materialized.digest,
      artifact: materialized.artifact,
      package: materialized.package,
    }
  } catch {
    return failObjectA(["malformed_object_a_input"])
  }
}

function failE0(reasons: readonly string[]): E0AcceptanceV2 {
  return { ok: false, reasons: unique(reasons), bytes: null, digest: null, record: null }
}

export function materializeE0RecordV2(input: {
  readonly instance_id: string
  readonly problem_package_sha256: string
  readonly intended_faithfulness_sha256: string
  readonly oracle_commitment: string
}): E0AcceptanceV2 {
  const record: E0RecordV2 = {
    schema: E0_RECORD_V2_SCHEMA,
    protocol_sha256: FROZEN_PROTOCOL_V2_SHA256,
    provider_policy_sha256: REKOR_V1_PROVIDER_POLICY_V1_SHA256,
    instance_id: input.instance_id,
    problem_package_sha256: input.problem_package_sha256,
    intended_faithfulness_sha256: input.intended_faithfulness_sha256,
    authority_relationship_class: AUTHORITY_RELATIONSHIP_CLASS,
    oracle_commitment: input.oracle_commitment,
  }
  return acceptE0RecordV2FromBytes({ bytes: IndependentAuthority.encodeJsonUtf8Lf(record) })
}

export function acceptE0RecordV2FromBytes(input: unknown): E0AcceptanceV2 {
  try {
    if (!isRecord(input) || !keysExact(input, ["bytes"])) return failE0(["malformed_e0_input"])
    if (!(input["bytes"] instanceof Uint8Array)) return failE0(["e0_record_bytes_not_bytes"])
    const bytes = Buffer.from(input["bytes"])
    const parsed = parseCanonical(bytes, "e0_record")
    if (!parsed.ok) return failE0(parsed.reasons)
    if (!isRecord(parsed.value) || !keysExact(parsed.value, E0_RECORD_V2_KEYS)) return failE0(["e0_record_shape_mismatch"])
    const value = parsed.value
    const reasons: string[] = []
    if (value["schema"] !== E0_RECORD_V2_SCHEMA) reasons.push("e0_schema_mismatch")
    if (value["protocol_sha256"] !== FROZEN_PROTOCOL_V2_SHA256) reasons.push("e0_protocol_digest_mismatch")
    if (value["provider_policy_sha256"] !== REKOR_V1_PROVIDER_POLICY_V1_SHA256) reasons.push("e0_provider_policy_digest_mismatch")
    const instanceId = value["instance_id"]
    if (typeof instanceId !== "string" || !INSTANCE_ID_RE.test(instanceId)) reasons.push("e0_instance_id_malformed")
    else if (HISTORICAL_IA_INSTANCE_IDS.has(instanceId)) reasons.push("instance_id_not_real_candidate")
    const problemDigest = value["problem_package_sha256"]
    const intendedDigest = value["intended_faithfulness_sha256"]
    const commitment = value["oracle_commitment"]
    if (typeof problemDigest !== "string" || !HEX64.test(problemDigest)) reasons.push("e0_problem_package_digest_malformed")
    if (typeof intendedDigest !== "string" || !HEX64.test(intendedDigest)) reasons.push("e0_intended_digest_malformed")
    if (typeof commitment !== "string" || !HEX64.test(commitment)) reasons.push("e0_oracle_commitment_malformed")
    if (value["authority_relationship_class"] !== AUTHORITY_RELATIONSHIP_CLASS) reasons.push("e0_authority_relationship_mismatch")
    if (reasons.length > 0 || typeof instanceId !== "string" || typeof problemDigest !== "string" || typeof intendedDigest !== "string" || typeof commitment !== "string") {
      return failE0(reasons)
    }
    const record: E0RecordV2 = {
      schema: E0_RECORD_V2_SCHEMA,
      protocol_sha256: FROZEN_PROTOCOL_V2_SHA256,
      provider_policy_sha256: REKOR_V1_PROVIDER_POLICY_V1_SHA256,
      instance_id: instanceId,
      problem_package_sha256: problemDigest,
      intended_faithfulness_sha256: intendedDigest,
      authority_relationship_class: AUTHORITY_RELATIONSHIP_CLASS,
      oracle_commitment: commitment,
    }
    if (!IndependentAuthority.encodeJsonUtf8Lf(record).equals(bytes)) return failE0(["e0_record_non_canonical"])
    return { ok: true, reasons: [], bytes: Buffer.from(bytes), digest: IndependentAuthority.sha256ExactBytes(bytes), record: deepFreeze(record) }
  } catch {
    return failE0(["malformed_e0_input"])
  }
}
