import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import * as IndependentAuthority from "../../conformance/tsei-invariant-discrimination-v0/independent-authority"
import {
  acceptIntendedFaithfulnessV1FromBytes,
  FROZEN_PROTOCOL_V2_SHA256,
  INTENDED_FAITHFULNESS_V1_SCHEMA,
  REKOR_V1_PROVIDER_POLICY_V1_SHA256,
} from "../../conformance/tsei-invariant-discrimination-v0/intended-faithfulness-v1"
import { materializeE0RecordV2, materializeObjectAV1 } from "../../conformance/tsei-invariant-discrimination-v0/object-a-e0-contract-v1"
import { verifyRealIntendedInstanceEligibility } from "../../conformance/tsei-invariant-discrimination-v0/real-intended-instance-eligibility"
import * as RekorV1 from "../../conformance/tsei-invariant-discrimination-v0/rekor-v1-verifier"

const ROOT = resolve(import.meta.dir, "..", "..", "conformance", "tsei-invariant-discrimination-v0")
const POLICY = readFileSync(resolve(ROOT, "provider-policy.rekor-v1.p0-e0-e1-e2.v1.json"))
const spies: { mockRestore(): void }[] = []
afterEach(() => {
  while (spies.length > 0) spies.pop()!.mockRestore()
})

function operands() {
  const definition = "n is even."
  const intendedBytes = IndependentAuthority.encodeJsonUtf8Lf({
    schema: INTENDED_FAITHFULNESS_V1_SCHEMA,
    instance_id: "tsei-ia-future-eligibility-synthetic-test-only",
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
  })
  const intended = acceptIntendedFaithfulnessV1FromBytes({ bytes: intendedBytes })
  if (!intended.ok) throw new Error(intended.reasons.join("|"))
  const objectA = materializeObjectAV1(intended.artifact)
  const e0 = materializeE0RecordV2({
    instance_id: intended.artifact.instance_id,
    problem_package_sha256: objectA.digest,
    intended_faithfulness_sha256: intended.digest,
    oracle_commitment: "aa".repeat(32),
  })
  if (!e0.ok) throw new Error(e0.reasons.join("|"))
  return { intendedBytes, intended, objectA, e0 }
}

function bundle() {
  const data = operands()
  return {
    data,
    input: {
      intended_faithfulness_bytes: data.intendedBytes,
      object_a_bytes: data.objectA.bytes,
      e0_record_bytes: data.e0.bytes,
      policy_bytes: POLICY,
      rekor_documents: [],
    },
  }
}

function publication(artifactSha256: string, globalLogIndex: number, treeId = "1193050959916656506") {
  return {
    ok: true,
    reasons: [] as const,
    provider_id: "rekor-v1" as const,
    injection_kind: "production" as const,
    uuid: `uuid-${globalLogIndex}`,
    global_log_index: globalLogIndex,
    shard_local_log_index: globalLogIndex,
    tree_id: treeId,
    artifact_sha256: artifactSha256,
    san_email: "shtomko@gmail.com",
  }
}

function mockGreen(data: ReturnType<typeof operands>) {
  const p0 = publication(data.intended.digest, 100)
  const e0 = publication(data.e0.digest, 101)
  spies.push(
    spyOn(RekorV1, "verifyRekorV1IntendedEligibilitySequenceV1").mockReturnValue({
      ok: true,
      reasons: [],
      captured_tree_id: "1193050959916656506",
      global_log_indexes: [100, 101],
      publications: [p0, e0],
    }),
  )
}

describe("real intended-instance eligibility", () => {
  test("all byte-derived predicates produce ELIGIBLE in a test-only mocked-provider unit path", () => {
    const { data, input } = bundle()
    mockGreen(data)
    const result = verifyRealIntendedInstanceEligibility(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.status).toBe("ELIGIBLE")
    expect(result.sufficient_for_real_intended_instance).toBe(true)
    expect(result.evidence.order).toBe("P0_LT_E0")
    expect(result.evidence.intended_faithfulness_sha256).toBe(data.intended.digest)
    expect(result.evidence.object_a_sha256).toBe(data.objectA.digest)
    expect(result.evidence.e0_record_sha256).toBe(data.e0.digest)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.evidence)).toBe(true)
    expect(Reflect.set(result.evidence, "p0_global_log_index", 999)).toBe(false)
    const repeated = verifyRealIntendedInstanceEligibility(input)
    expect(repeated.ok && repeated.evidence.p0_global_log_index).toBe(100)
    expect("production_publishable" in result).toBe(false)
    expect("sufficient_for_real_run" in result).toBe(false)
  })

  test("missing, extra, and caller-shaped proof fields fail before provider evaluation", () => {
    expect(verifyRealIntendedInstanceEligibility({}).status).toBe("INELIGIBLE")
    const { data, input } = bundle()
    mockGreen(data)
    expect(verifyRealIntendedInstanceEligibility({ ...input, extra: true }).reasons).toContain("unexpected_eligibility_bundle_key")
    expect(verifyRealIntendedInstanceEligibility({ ...input, eligible: true }).reasons).toContain("caller_shaped_proof_field")
    expect(verifyRealIntendedInstanceEligibility({ ...input, global_log_indexes: [1, 2] }).reasons).toContain("caller_shaped_proof_field")
  })

  test("byte type, canonicality, and old policy failures remain INELIGIBLE", () => {
    const { data, input } = bundle()
    mockGreen(data)
    expect(verifyRealIntendedInstanceEligibility({ ...input, intended_faithfulness_bytes: "not bytes" }).ok).toBe(false)
    expect(verifyRealIntendedInstanceEligibility({ ...input, object_a_bytes: data.objectA.bytes.subarray(0, data.objectA.bytes.length - 1) }).ok).toBe(false)
    expect(verifyRealIntendedInstanceEligibility({ ...input, e0_record_bytes: Buffer.from("{}\n") }).ok).toBe(false)
    const oldPolicy = readFileSync(resolve(ROOT, "provider-policy.rekor-v1.p0-e0-e1-e2.json"))
    expect(verifyRealIntendedInstanceEligibility({ ...input, policy_bytes: oldPolicy }).reasons).toContain("provider_policy_not_frozen")
  })

  test("E0 instance and digest mismatches fail before Rekor sequence acceptance", () => {
    const { data, input } = bundle()
    mockGreen(data)
    const wrongIntended = materializeE0RecordV2({
      instance_id: data.intended.artifact.instance_id,
      problem_package_sha256: data.objectA.digest,
      intended_faithfulness_sha256: "00".repeat(32),
      oracle_commitment: "aa".repeat(32),
    })
    if (!wrongIntended.ok) throw new Error(wrongIntended.reasons.join("|"))
    expect(verifyRealIntendedInstanceEligibility({ ...input, e0_record_bytes: wrongIntended.bytes }).reasons).toContain("e0_intended_digest_mismatch")
    const wrongObjectA = materializeE0RecordV2({
      instance_id: data.intended.artifact.instance_id,
      problem_package_sha256: "11".repeat(32),
      intended_faithfulness_sha256: data.intended.digest,
      oracle_commitment: "aa".repeat(32),
    })
    if (!wrongObjectA.ok) throw new Error(wrongObjectA.reasons.join("|"))
    expect(verifyRealIntendedInstanceEligibility({ ...input, e0_record_bytes: wrongObjectA.bytes }).reasons).toContain("e0_object_a_digest_mismatch")
  })

  test("provider failure, equality, reversal, tree and artifact digest failures remain INELIGIBLE", () => {
    const cases = [
      { indexes: [100, 100], p0Digest: null, e0Digest: null, tree: "1193050959916656506", reason: "p0_not_before_e0" },
      { indexes: [101, 100], p0Digest: null, e0Digest: null, tree: "1193050959916656506", reason: "p0_not_before_e0" },
      { indexes: [100, 101], p0Digest: "ff".repeat(32), e0Digest: null, tree: "1193050959916656506", reason: "p0_digest_mismatch" },
      { indexes: [100, 101], p0Digest: null, e0Digest: "ee".repeat(32), tree: "1193050959916656506", reason: "e0_publication_digest_mismatch" },
    ]
    for (const item of cases) {
      const { data, input } = bundle()
      const p0 = publication(item.p0Digest ?? data.intended.digest, item.indexes[0]!, item.tree)
      const e0 = publication(item.e0Digest ?? data.e0.digest, item.indexes[1]!, item.tree)
      const spy = spyOn(RekorV1, "verifyRekorV1IntendedEligibilitySequenceV1").mockReturnValue({
        ok: true,
        reasons: [],
        captured_tree_id: item.tree,
        global_log_indexes: item.indexes,
        publications: [p0, e0],
      })
      spies.push(spy)
      expect(verifyRealIntendedInstanceEligibility(input).reasons).toContain(item.reason)
      spies.pop()!.mockRestore()
    }
  })

  test("an actual empty Rekor document set cannot become ELIGIBLE", () => {
    const { input } = bundle()
    const result = verifyRealIntendedInstanceEligibility(input)
    expect(result.ok).toBe(false)
    expect(result.status).toBe("INELIGIBLE")
    expect(result.sufficient_for_real_intended_instance).toBe(false)
    expect(result.reasons).toContain("p0_publication_unverified")
  })

  test("a provider duplicate match can never become ELIGIBLE", () => {
    const { input } = bundle()
    spies.push(
      spyOn(RekorV1, "verifyRekorV1IntendedEligibilitySequenceV1").mockReturnValue({
        ok: false,
        reasons: ["multiple_matches"],
        captured_tree_id: null,
        global_log_indexes: [],
        publications: [],
      }),
    )
    const result = verifyRealIntendedInstanceEligibility(input)
    expect(result.status).toBe("INELIGIBLE")
    expect(result.reasons).toContain("multiple_matches")
    expect(result.sufficient_for_real_intended_instance).toBe(false)
  })
})
