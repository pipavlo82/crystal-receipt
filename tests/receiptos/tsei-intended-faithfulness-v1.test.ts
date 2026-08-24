import { describe, expect, test } from "bun:test"
import * as IndependentAuthority from "../../conformance/tsei-invariant-discrimination-v0/independent-authority"
import {
  acceptIntendedFaithfulnessV1FromBytes,
  FROZEN_PROTOCOL_V2_SHA256,
  INTENDED_FAITHFULNESS_V1_SCHEMA,
  REKOR_V1_PROVIDER_POLICY_V1_SHA256,
} from "../../conformance/tsei-invariant-discrimination-v0/intended-faithfulness-v1"

const INSTANCE = "tsei-ia-future-synthetic-v2-test-only"

function artifact() {
  const definition = "n is even."
  return {
    schema: INTENDED_FAITHFULNESS_V1_SCHEMA,
    instance_id: INSTANCE,
    protocol_sha256: FROZEN_PROTOCOL_V2_SHA256,
    provider_policy_sha256: REKOR_V1_PROVIDER_POLICY_V1_SHA256,
    invariants: {
      I_A: {
        invariant_id: "I_A",
        normative_definition: definition,
        normative_definition_identity: IndependentAuthority.normativeDefinitionIdentity(definition),
      },
    },
    cases: {
      c01: { mutant_id: "c01", baseline: { n: 2 }, mutated: { n: 3 } },
      c02: { mutant_id: "c02", baseline: { n: 3 }, mutated: { n: 4 } },
    },
  }
}

const bytes = () => IndependentAuthority.encodeJsonUtf8Lf(artifact())

describe("protocol-v2 intended exact-byte acceptance", () => {
  test("accepts canonical answer-free bytes but does not mint eligibility", () => {
    const result = acceptIntendedFaithfulnessV1FromBytes({ bytes: bytes() })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.accepted_state).toBe("INTENDED_BYTES_ACCEPTED")
    expect(result.artifact.instance_id).toBe(INSTANCE)
    expect(result.digest).toBe(IndependentAuthority.sha256ExactBytes(bytes()))
    expect(Object.isFrozen(result.artifact)).toBe(true)
    expect(Object.isFrozen(result.artifact.cases)).toBe(true)
    expect("sufficient_for_real_intended_instance" in result).toBe(false)
    expect("production_publishable" in result).toBe(false)
  })

  test("rejects caller-shaped object acceptance and extra input keys", () => {
    expect(acceptIntendedFaithfulnessV1FromBytes({ intended: artifact() }).ok).toBe(false)
    expect(acceptIntendedFaithfulnessV1FromBytes({ bytes: bytes(), eligible: true }).ok).toBe(false)
  })

  test("rejects non-canonical byte variants", () => {
    const canonical = bytes()
    const pretty = Buffer.from(`${JSON.stringify(artifact(), null, 2)}\n`, "utf8")
    const missingLf = canonical.subarray(0, canonical.length - 1)
    const extraLf = Buffer.concat([canonical, Buffer.from("\n")])
    const crlf = Buffer.from(canonical.toString("utf8").replace("\n", "\r\n"), "utf8")
    const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), canonical])
    for (const candidate of [pretty, missingLf, extraLf, crlf, bom]) {
      expect(acceptIntendedFaithfulnessV1FromBytes({ bytes: candidate }).ok).toBe(false)
    }
  })

  test("rejects wrong schema, pins, identity, and historical instance", () => {
    const variants = [
      { ...artifact(), schema: "tsei-invariant-discrimination-v0.intended-faithfulness.v0" },
      { ...artifact(), protocol_sha256: "00".repeat(32) },
      { ...artifact(), provider_policy_sha256: "11".repeat(32) },
      { ...artifact(), instance_id: "tsei-ia-real-v1-20260821-02" },
      {
        ...artifact(),
        invariants: { ...artifact().invariants, I_A: { ...artifact().invariants.I_A, normative_definition_identity: "22".repeat(32) } },
      },
    ]
    for (const variant of variants) {
      expect(acceptIntendedFaithfulnessV1FromBytes({ bytes: IndependentAuthority.encodeJsonUtf8Lf(variant) }).ok).toBe(false)
    }
  })

  test("rejects answer and attribution leakage anywhere in the graph", () => {
    const leaked = { ...artifact(), answers: { c01: ["I_A"] } }
    const nested = {
      ...artifact(),
      cases: { ...artifact().cases, c01: { ...artifact().cases.c01, mutated: { n: 3, note: "derived_attribution_set" } } },
    }
    expect(acceptIntendedFaithfulnessV1FromBytes({ bytes: IndependentAuthority.encodeJsonUtf8Lf(leaked) }).ok).toBe(false)
    expect(acceptIntendedFaithfulnessV1FromBytes({ bytes: IndependentAuthority.encodeJsonUtf8Lf(nested) }).ok).toBe(false)
  })
})
