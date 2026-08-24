/** Protocol-v2 outer production composition tests. Synthetic fixtures only. */

import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import * as IndependentAuthority from "../../conformance/tsei-invariant-discrimination-v0/independent-authority"
import {
  AUTHORITY_ORACLE_SCHEMA,
  AUTHORITY_SAN_EMAIL,
  REKOR_V1_LOG_ID,
} from "../../conformance/tsei-invariant-discrimination-v0/independent-authority-model"
import {
  acceptIntendedFaithfulnessV1FromBytes,
  FROZEN_PROTOCOL_V2_SHA256,
  INTENDED_FAITHFULNESS_V1_SCHEMA,
  REKOR_V1_PROVIDER_POLICY_V1_SHA256,
} from "../../conformance/tsei-invariant-discrimination-v0/intended-faithfulness-v1"
import { materializeE0RecordV2, materializeObjectAV1 } from "../../conformance/tsei-invariant-discrimination-v0/object-a-e0-contract-v1"
import {
  ORIGINATOR_DECLARED_CASE_IDS,
  ORIGINATOR_DECLARED_INVARIANT_IDS,
  materializeOriginatorOracle,
} from "../../conformance/tsei-invariant-discrimination-v0/originator-oracle"
import * as EligibilityV1 from "../../conformance/tsei-invariant-discrimination-v0/real-intended-instance-eligibility"
import * as RekorV1 from "../../conformance/tsei-invariant-discrimination-v0/rekor-v1-verifier"

const ROOT = resolve(import.meta.dir, "..", "..", "conformance", "tsei-invariant-discrimination-v0")
const POLICY = readFileSync(resolve(ROOT, "provider-policy.rekor-v1.p0-e0-e1-e2.v1.json"))
const TREE_ID = "1193050959916656506"
const NONCE = Uint8Array.from({ length: 32 }, () => 0x51)
const spies: { mockRestore(): void }[] = []

afterEach(() => {
  while (spies.length > 0) spies.pop()!.mockRestore()
})

const DEFINITIONS = {
  I_A: "n is odd.",
  I_B: "n is greater than or equal to 100.",
  I_C: "n is negative.",
} as const

function publication(artifactSha256: string, globalLogIndex: number, controller: "originator" | "authority") {
  return {
    ok: true,
    reasons: [] as const,
    provider_id: "rekor-v1" as const,
    injection_kind: "production" as const,
    uuid: `uuid-${globalLogIndex}`,
    global_log_index: globalLogIndex,
    shard_local_log_index: globalLogIndex,
    tree_id: TREE_ID,
    artifact_sha256: artifactSha256,
    san_email: controller === "authority" ? AUTHORITY_SAN_EMAIL : "shtomko@gmail.com",
  }
}

function buildOperands() {
  const invariants = Object.fromEntries(
    ORIGINATOR_DECLARED_INVARIANT_IDS.map((id) => [
      id,
      {
        invariant_id: id,
        normative_definition: DEFINITIONS[id],
        normative_definition_identity: IndependentAuthority.normativeDefinitionIdentity(DEFINITIONS[id]),
      },
    ]),
  )
  const cases = Object.fromEntries(
    ORIGINATOR_DECLARED_CASE_IDS.map((id) => [id, { mutant_id: id, baseline: { n: 4 }, mutated: { n: 2 } }]),
  )
  const intendedBytes = IndependentAuthority.encodeJsonUtf8Lf({
    schema: INTENDED_FAITHFULNESS_V1_SCHEMA,
    instance_id: "tsei-ia-future-production-synthetic-test-only",
    protocol_sha256: FROZEN_PROTOCOL_V2_SHA256,
    provider_policy_sha256: REKOR_V1_PROVIDER_POLICY_V1_SHA256,
    invariants,
    cases,
  })
  const intended = acceptIntendedFaithfulnessV1FromBytes({ bytes: intendedBytes })
  if (!intended.ok) throw new Error(intended.reasons.join("|"))
  const objectA = materializeObjectAV1(intended.artifact)
  const oracle = materializeOriginatorOracle({
    instance_id: intended.artifact.instance_id,
    problem_package_sha256: objectA.digest,
    cases: Object.fromEntries(
      ORIGINATOR_DECLARED_CASE_IDS.map((id) => [id, { mutant_id: id, originator_attribution_set: [] as string[] }]),
    ),
  })
  if (!oracle.ok) throw new Error(oracle.reasons.join("|"))
  const commitment = IndependentAuthority.computeOracleCommitment({
    instance_id: intended.artifact.instance_id,
    problem_package_sha256: objectA.digest,
    nonce: NONCE,
    oracle_bytes: oracle.bytes,
  })
  if (!commitment.ok) throw new Error(commitment.reasons.join("|"))
  const e0 = materializeE0RecordV2({
    instance_id: intended.artifact.instance_id,
    problem_package_sha256: objectA.digest,
    intended_faithfulness_sha256: intended.digest,
    oracle_commitment: commitment.commitment,
  })
  if (!e0.ok) throw new Error(e0.reasons.join("|"))
  const objectBBytes = IndependentAuthority.encodeJsonUtf8Lf({
    schema: AUTHORITY_ORACLE_SCHEMA,
    problem_package_digest: objectA.digest,
    cases: Object.fromEntries(
      ORIGINATOR_DECLARED_CASE_IDS.map((id) => [id, { mutant_id: id, derived_attribution_set: [] as string[] }]),
    ),
  })
  return { intendedBytes, intended, objectA, oracle, e0, objectBBytes }
}

function bundle(data = buildOperands()) {
  return {
    data,
    input: {
      intended_faithfulness_bytes: data.intendedBytes,
      object_a_bytes: data.objectA.bytes,
      object_b_bytes: data.objectBBytes,
      e1_artifact_bytes: data.objectBBytes,
      originator_oracle_bytes: data.oracle.bytes,
      e2_artifact_bytes: data.oracle.bytes,
      nonce_bytes: NONCE,
      e0_record_bytes: data.e0.bytes,
      policy_bytes: POLICY,
      rekor_documents: [],
    },
  }
}

function mockGreen(data: ReturnType<typeof buildOperands>) {
  const p0 = publication(data.intended.digest, 100, "originator")
  const e0 = publication(data.e0.digest, 101, "originator")
  const e1 = publication(IndependentAuthority.sha256ExactBytes(data.objectBBytes), 102, "authority")
  const e2 = publication(data.oracle.digest, 103, "originator")
  spies.push(
    spyOn(EligibilityV1, "verifyRealIntendedInstanceEligibility").mockReturnValue({
      evidence: {
        e0_global_log_index: 101,
        e0_record_sha256: data.e0.digest,
        instance_id: data.intended.artifact.instance_id,
        intended_faithfulness_sha256: data.intended.digest,
        log_id: REKOR_V1_LOG_ID,
        object_a_sha256: data.objectA.digest,
        order: "P0_LT_E0",
        p0_global_log_index: 100,
        provider_id: "rekor-v1",
        tree_id: TREE_ID,
      },
      ok: true,
      reasons: [],
      status: "ELIGIBLE",
      sufficient_for_real_intended_instance: true,
    }),
  )
  spies.push(
    spyOn(RekorV1, "verifyRekorV1ProductionSequenceV1").mockReturnValue({
      ok: true,
      reasons: [],
      captured_tree_id: TREE_ID,
      global_log_indexes: [100, 101, 102, 103],
      publications: [p0, e0, e1, e2],
      sufficient_for_proven_grounding: false,
      production_publishable: false,
    }),
  )
}

describe("protocol-v2 outer production composition", () => {
  test("the exact internally derived conjunction can mint production grounding in a test-only provider path", () => {
    const { data, input } = bundle()
    mockGreen(data)
    const result = IndependentAuthority.evaluateProductionRekorIndependentGroundingV1(input)
    expect(result.ok).toBe(true)
    expect(result.intended_instance_eligibility?.status).toBe("ELIGIBLE")
    expect(result.intended_instance_eligibility?.evidence?.log_id).toBe(REKOR_V1_LOG_ID)
    expect(JSON.parse(JSON.stringify(result)).intended_instance_eligibility.evidence.log_id).toBe(REKOR_V1_LOG_ID)
    expect(result.independent_grounding).toBe("PROVEN")
    expect(result.oracle_input_state).toBe("VALID_PROVENANCE")
    expect(result.semantic_relation).toBe("AGREES")
    expect(result.production_publishable).toBe(true)
    expect(result.sufficient_for_proven_grounding).toBe(true)
    expect(result.sufficient_for_real_run).toBe(false)
  })

  test("caller-shaped eligibility, indexes, digests, statuses, and verdicts fail before evaluation", () => {
    const { input } = bundle()
    for (const forged of [
      { eligibility: { status: "ELIGIBLE" } },
      { global_log_indexes: [1, 2, 3, 4] },
      { digests: { p0: "00".repeat(32) } },
      { status: "ELIGIBLE" },
      { production_publishable: true },
      { sufficient_for_real_intended_instance: true },
    ]) {
      const result = IndependentAuthority.evaluateProductionRekorIndependentGroundingV1({ ...input, ...forged })
      expect(result.production_publishable).toBe(false)
      expect(result.independent_grounding).toBe("UNPROVEN")
    }
  })

  test("an INELIGIBLE internal result blocks the outer evaluator", () => {
    const { data, input } = bundle()
    spies.push(
      spyOn(EligibilityV1, "verifyRealIntendedInstanceEligibility").mockReturnValue({
        evidence: null,
        ok: false,
        reasons: ["p0_not_before_e0"],
        status: "INELIGIBLE",
        sufficient_for_real_intended_instance: false,
      }),
    )
    const result = IndependentAuthority.evaluateProductionRekorIndependentGroundingV1(input)
    expect(result.reasons).toContain("real_intended_instance_ineligible")
    expect(result.production_publishable).toBe(false)
    expect(result.intended_instance_eligibility?.status).toBe("INELIGIBLE")
    expect(data.intended.ok).toBe(true)
  })

  test("payload equality, commitment opening, and the full production sequence each fail closed", () => {
    const first = bundle()
    mockGreen(first.data)
    expect(IndependentAuthority.evaluateProductionRekorIndependentGroundingV1({ ...first.input, e1_artifact_bytes: Buffer.from("{}\n") }).reasons)
      .toContain("e1_payload_bytes_not_object_b")

    while (spies.length > 0) spies.pop()!.mockRestore()
    const second = bundle()
    mockGreen(second.data)
    expect(IndependentAuthority.evaluateProductionRekorIndependentGroundingV1({ ...second.input, nonce_bytes: Uint8Array.from({ length: 32 }, () => 0x52) }).reasons)
      .toContain("commitment_failure")

    while (spies.length > 0) spies.pop()!.mockRestore()
    const third = bundle()
    mockGreen(third.data)
    spies.pop()!.mockRestore()
    spies.push(
      spyOn(RekorV1, "verifyRekorV1ProductionSequenceV1").mockReturnValue({
        ok: false,
        reasons: ["reversed_log_index"],
        captured_tree_id: TREE_ID,
        global_log_indexes: [100, 101, 99],
        publications: [],
        sufficient_for_proven_grounding: false,
        production_publishable: false,
      }),
    )
    expect(IndependentAuthority.evaluateProductionRekorIndependentGroundingV1(third.input).reasons).toContain("production_sequence_unverified")
  })

  test("exact-set disagreement is reported but never production-publishable", () => {
    const { data, input } = bundle()
    mockGreen(data)
    const mismatched = IndependentAuthority.encodeJsonUtf8Lf({
      schema: AUTHORITY_ORACLE_SCHEMA,
      problem_package_digest: data.objectA.digest,
      cases: Object.fromEntries(
        ORIGINATOR_DECLARED_CASE_IDS.map((id, index) => [
          id,
          { mutant_id: id, derived_attribution_set: index === 0 ? ["I_A"] : [] },
        ]),
      ),
    })
    while (spies.length > 0) spies.pop()!.mockRestore()
    const changed = { ...data, objectBBytes: mismatched }
    mockGreen(changed)
    const result = IndependentAuthority.evaluateProductionRekorIndependentGroundingV1({
      ...input,
      object_b_bytes: mismatched,
      e1_artifact_bytes: mismatched,
    })
    expect(result.independent_grounding).toBe("DISAGREED")
    expect(result.semantic_relation).toBe("DISAGREES")
    expect(result.production_publishable).toBe(false)
    expect(result.sufficient_for_proven_grounding).toBe(false)
  })

  test("the frozen old evaluator remains unable to mint the new contract", () => {
    const { data, input } = bundle()
    mockGreen(data)
    const old = IndependentAuthority.evaluateProductionRekorIndependentGrounding(input)
    expect(old.production_publishable).toBe(false)
    expect(old.sufficient_for_proven_grounding).toBe(false)
  })
})
