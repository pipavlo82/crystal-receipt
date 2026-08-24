import { describe, expect, test } from "bun:test"
import * as IndependentAuthority from "../../conformance/tsei-invariant-discrimination-v0/independent-authority"
import {
  acceptIntendedFaithfulnessV1FromBytes,
  FROZEN_PROTOCOL_V2_SHA256,
  INTENDED_FAITHFULNESS_V1_SCHEMA,
  REKOR_V1_PROVIDER_POLICY_V1_SHA256,
} from "../../conformance/tsei-invariant-discrimination-v0/intended-faithfulness-v1"
import {
  acceptE0RecordV2FromBytes,
  acceptObjectAV1FromBytes,
  BLIND_PROBLEM_V1_SCHEMA,
  E0_RECORD_V2_SCHEMA,
  materializeE0RecordV2,
  materializeObjectAV1,
  OBJECT_A_V1_EVALUATION_INSTRUCTION,
} from "../../conformance/tsei-invariant-discrimination-v0/object-a-e0-contract-v1"

function acceptedIntended() {
  const definition = "n is even."
  const artifact = {
    schema: INTENDED_FAITHFULNESS_V1_SCHEMA,
    instance_id: "tsei-ia-future-object-a-synthetic-test-only",
    protocol_sha256: FROZEN_PROTOCOL_V2_SHA256,
    provider_policy_sha256: REKOR_V1_PROVIDER_POLICY_V1_SHA256,
    invariants: {
      I_A: {
        invariant_id: "I_A",
        normative_definition: definition,
        normative_definition_identity: IndependentAuthority.normativeDefinitionIdentity(definition),
      },
    },
    cases: { c01: { mutant_id: "c01", baseline: { n: 2 }, mutated: { n: 3 } } },
  }
  const accepted = acceptIntendedFaithfulnessV1FromBytes({ bytes: IndependentAuthority.encodeJsonUtf8Lf(artifact) })
  if (!accepted.ok) throw new Error(accepted.reasons.join("|"))
  return accepted
}

describe("protocol-v2 Object A exact contract", () => {
  test("materializes exact faithful Object A bytes and normalized core package", () => {
    const intended = acceptedIntended()
    const materialized = materializeObjectAV1(intended.artifact)
    const accepted = acceptObjectAV1FromBytes({ bytes: materialized.bytes, intended })
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(accepted.artifact.schema).toBe(BLIND_PROBLEM_V1_SCHEMA)
    expect(accepted.artifact.evaluation_instruction).toBe(OBJECT_A_V1_EVALUATION_INSTRUCTION)
    expect(accepted.package.schema).toBe("tsei-invariant-discrimination-v0.blind-problem.v0")
    expect(accepted.digest).toBe(IndependentAuthority.sha256ExactBytes(materialized.bytes))
    expect(Object.isFrozen(accepted.artifact)).toBe(true)
  })

  test("rejects semantic similarity without exact byte faithfulness", () => {
    const intended = acceptedIntended()
    const materialized = materializeObjectAV1(intended.artifact)
    const parsed = JSON.parse(materialized.bytes.toString("utf8"))
    parsed.evaluation_instruction = "Report violations."
    expect(acceptObjectAV1FromBytes({ bytes: IndependentAuthority.encodeJsonUtf8Lf(parsed), intended }).reasons).toContain("object_a_not_faithful")
    parsed.evaluation_instruction = OBJECT_A_V1_EVALUATION_INSTRUCTION
    parsed.schema = "tsei-invariant-discrimination-v0.blind-problem.v0"
    expect(acceptObjectAV1FromBytes({ bytes: IndependentAuthority.encodeJsonUtf8Lf(parsed), intended }).ok).toBe(false)
  })

  test("rejects non-canonical Object A and caller-shaped intended projection", () => {
    const intended = acceptedIntended()
    const materialized = materializeObjectAV1(intended.artifact)
    const pretty = Buffer.from(`${JSON.stringify(JSON.parse(materialized.bytes.toString("utf8")), null, 2)}\n`)
    expect(acceptObjectAV1FromBytes({ bytes: pretty, intended }).ok).toBe(false)
    expect(acceptObjectAV1FromBytes({ bytes: materialized.bytes, intended: intended.intended }).ok).toBe(false)
  })
})

describe("protocol-v2 E0 record exact contract", () => {
  test("materializes and accepts exact eight-key E0 bindings", () => {
    const intended = acceptedIntended()
    const objectA = materializeObjectAV1(intended.artifact)
    const e0 = materializeE0RecordV2({
      instance_id: intended.artifact.instance_id,
      problem_package_sha256: objectA.digest,
      intended_faithfulness_sha256: intended.digest,
      oracle_commitment: "ab".repeat(32),
    })
    expect(e0.ok).toBe(true)
    if (!e0.ok) return
    expect(e0.record.schema).toBe(E0_RECORD_V2_SCHEMA)
    expect(e0.record.protocol_sha256).toBe(FROZEN_PROTOCOL_V2_SHA256)
    expect(e0.record.provider_policy_sha256).toBe(REKOR_V1_PROVIDER_POLICY_V1_SHA256)
    expect(Object.keys(e0.record).sort()).toEqual([
      "authority_relationship_class",
      "instance_id",
      "intended_faithfulness_sha256",
      "oracle_commitment",
      "problem_package_sha256",
      "protocol_sha256",
      "provider_policy_sha256",
      "schema",
    ])
    expect(Object.isFrozen(e0.record)).toBe(true)
  })

  test("rejects historical schema, extra keys, wrong pins, and non-canonical bytes", () => {
    const intended = acceptedIntended()
    const objectA = materializeObjectAV1(intended.artifact)
    const accepted = materializeE0RecordV2({
      instance_id: intended.artifact.instance_id,
      problem_package_sha256: objectA.digest,
      intended_faithfulness_sha256: intended.digest,
      oracle_commitment: "cd".repeat(32),
    })
    if (!accepted.ok) throw new Error(accepted.reasons.join("|"))
    const base = JSON.parse(accepted.bytes.toString("utf8"))
    for (const variant of [
      { ...base, schema: "tsei-invariant-discrimination-v0.e0-record.v1" },
      { ...base, protocol_sha256: "00".repeat(32) },
      { ...base, provider_policy_sha256: "11".repeat(32) },
      { ...base, nonce: "forbidden" },
    ]) {
      expect(acceptE0RecordV2FromBytes({ bytes: IndependentAuthority.encodeJsonUtf8Lf(variant) }).ok).toBe(false)
    }
    const pretty = Buffer.from(`${JSON.stringify(base, null, 2)}\n`)
    expect(acceptE0RecordV2FromBytes({ bytes: pretty }).ok).toBe(false)
  })
})
