import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import {
  COUNTERFACTUAL_OBSERVATION_SCHEMA,
  NormalizationContractError,
  normalizeChronicleAdmissionChallengeExpected,
  normalizeChronicleAdmissionResult,
  normalizeChronicleCheckpointLocalChallengeExpected,
  normalizeChronicleCheckpointLocalResult,
  normalizeChronicleContinuityChallengeExpected,
  normalizeChronicleContinuityResult,
  normalizeCounterfactualAuditBoundaryExpected,
  normalizeVerifyHandoffChallengeExpected,
  normalizeVerifyHandoffReceiptRootResult,
  type CounterfactualObservationClassV0,
  type CounterfactualObservationV0,
} from "../../src/receiptos/challenge/counterfactual-result-normalization"
import {
  computeFrozenCounterfactualNeighborhoodSha256,
  type FrozenCounterfactualNeighborhoodV0,
} from "../../src/receiptos/challenge/counterfactual-neighborhood"
import {
  projectVerifierChallengeVector,
  VERIFIER_CHALLENGE_MODEL_SCHEMA,
} from "../../src/receiptos/challenge/verifier-challenge-model"
import type { ChronicleEntryAdmissionFailureV0 } from "../../src/receiptos/capsule/chronicle-portfolio-v0"

const root = resolve(import.meta.dir, "../..")
const LANE_B_SHA256 = "37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d"

/** Exact ChronicleEntryAdmissionFailureV0 production pairs. */
const ADMISSION_FAILURE_PAIRS: Array<{
  failure: ChronicleEntryAdmissionFailureV0
  observation_class: Extract<CounterfactualObservationClassV0, "unverifiable" | "rejected">
}> = [
  {
    failure: { failure_class: "unverifiable", reason_code: "evidence_root_missing" },
    observation_class: "unverifiable",
  },
  {
    failure: { failure_class: "evidence_mismatch", reason_code: "evidence_root_mismatch" },
    observation_class: "rejected",
  },
  {
    failure: { failure_class: "cross_object_inconsistency", reason_code: "proof_root_mismatch" },
    observation_class: "rejected",
  },
  {
    failure: { failure_class: "cross_object_inconsistency", reason_code: "capsule_stored_mismatch" },
    observation_class: "rejected",
  },
  {
    failure: { failure_class: "cross_object_inconsistency", reason_code: "capsule_computed_mismatch" },
    observation_class: "rejected",
  },
  {
    failure: { failure_class: "reported_state_inconsistency", reason_code: "capsule_label_inconsistent" },
    observation_class: "rejected",
  },
  {
    failure: { failure_class: "reported_state_inconsistency", reason_code: "verifier_result_inconsistent" },
    observation_class: "rejected",
  },
  {
    failure: { failure_class: "identity_inconsistency", reason_code: "proof_object_id_invalid" },
    observation_class: "rejected",
  },
  {
    failure: { failure_class: "identity_inconsistency", reason_code: "proof_ref_invalid" },
    observation_class: "rejected",
  },
]

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"))
}

function assertImmutable(input: unknown, normalize: (value: unknown) => unknown) {
  const before = structuredClone(input)
  normalize(input)
  expect(input).toEqual(before)
}

function assertNoSourceValidityField(obs: CounterfactualObservationV0) {
  expect(Object.prototype.hasOwnProperty.call(obs, "source_validity_effect")).toBe(false)
  expect(Object.prototype.hasOwnProperty.call(obs, "source_validity")).toBe(false)
  expect(JSON.stringify(obs)).not.toContain("source_validity")
}

function assertObservation(obs: CounterfactualObservationV0, cls: CounterfactualObservationClassV0) {
  expect(obs.schema).toBe(COUNTERFACTUAL_OBSERVATION_SCHEMA)
  expect(obs.observation_class).toBe(cls)
  assertNoSourceValidityField(obs)
}

describe("counterfactual result normalization v0", () => {
  test("verifyHandoff observed_not_validated expected → affirmative (ok:true)", () => {
    const vector = readJson(
      "conformance/verifier-challenge-observed-not-validated-v0/vectors/V-OBSERVED-NOT-VALIDATED.json",
    ) as { expected: unknown }
    const fromExpected = normalizeVerifyHandoffChallengeExpected(vector.expected)
    const challenged = (vector.expected as { challenged_verification: Parameters<typeof normalizeVerifyHandoffReceiptRootResult>[0] })
      .challenged_verification
    const fromActual = normalizeVerifyHandoffReceiptRootResult(challenged)
    expect(fromExpected).toEqual(fromActual)
    assertObservation(fromExpected, "affirmative")
    expect(fromExpected.native_status).toBe("ok_true")
    assertImmutable(vector.expected, normalizeVerifyHandoffChallengeExpected)
  })

  test("verifyHandoff missing_required_input_unverifiable expected → unverifiable", () => {
    const vector = readJson(
      "conformance/verifier-challenge-missing-required-input-unverifiable-v0/vectors/V-MISSING-REQUIRED-INPUT.json",
    ) as { expected: { challenged_verification: Parameters<typeof normalizeVerifyHandoffReceiptRootResult>[0] } }
    const fromExpected = normalizeVerifyHandoffChallengeExpected(vector.expected)
    const fromActual = normalizeVerifyHandoffReceiptRootResult(vector.expected.challenged_verification)
    expect(fromExpected).toEqual(fromActual)
    assertObservation(fromExpected, "unverifiable")
    expect(fromExpected.native_reason_code).toBe("missing_required_receipt_root")
  })

  test("verifyHandoff integrity_mismatch_rejected expected → rejected", () => {
    const vector = readJson(
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    ) as { expected: { challenged_verification: Parameters<typeof normalizeVerifyHandoffReceiptRootResult>[0] } }
    const fromExpected = normalizeVerifyHandoffChallengeExpected(vector.expected)
    const fromActual = normalizeVerifyHandoffReceiptRootResult(vector.expected.challenged_verification)
    expect(fromExpected).toEqual(fromActual)
    assertObservation(fromExpected, "rejected")
    expect(fromExpected.native_reason_code).toBe("receipt_root_mismatch")
  })

  test("verifyHandoff raw runtime observation cannot encode observed_not_validated challenge semantics", () => {
    // Challenge-level non-elevation (observed_not_validated) has ok:true challenged_verification.
    // Raw runtime result alone therefore cannot distinguish that challenge story from ordinary success.
    const observed = readJson(
      "conformance/verifier-challenge-observed-not-validated-v0/vectors/V-OBSERVED-NOT-VALIDATED.json",
    ) as { expected: { challenged_verification: Parameters<typeof normalizeVerifyHandoffReceiptRootResult>[0]; observation_cannot_establish_validity: boolean } }
    const missing = readJson(
      "conformance/verifier-challenge-missing-required-input-unverifiable-v0/vectors/V-MISSING-REQUIRED-INPUT.json",
    ) as { expected: { challenged_verification: Parameters<typeof normalizeVerifyHandoffReceiptRootResult>[0] } }
    const integrity = readJson(
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    ) as { expected: { challenged_verification: Parameters<typeof normalizeVerifyHandoffReceiptRootResult>[0] } }

    const nObserved = normalizeVerifyHandoffReceiptRootResult(observed.expected.challenged_verification)
    const nMissing = normalizeVerifyHandoffReceiptRootResult(missing.expected.challenged_verification)
    const nIntegrity = normalizeVerifyHandoffReceiptRootResult(integrity.expected.challenged_verification)

    expect(nObserved.observation_class).toBe("affirmative")
    expect(nMissing.observation_class).toBe("unverifiable")
    expect(nIntegrity.observation_class).toBe("rejected")
    expect(nMissing.observation_class).not.toBe(nIntegrity.observation_class)
    expect(observed.expected.observation_cannot_establish_validity).toBe(true)
  })

  test("Lane A retains observed_not_validated challenge context alongside affirmative runtime observation", () => {
    // Architectural boundary:
    //   Lane A challenge context ≠ Lane C native verifier observation
    // Lane D/E must carry the Lane A model alongside normalize(expected)/normalize(actual).
    const path = "conformance/verifier-challenge-observed-not-validated-v0/vectors/V-OBSERVED-NOT-VALIDATED.json"
    const raw = readJson(path) as Record<string, unknown>
    const before = structuredClone(raw)
    const model = projectVerifierChallengeVector(raw)
    expect(raw).toEqual(before)
    expect(model.model_schema).toBe(VERIFIER_CHALLENGE_MODEL_SCHEMA)
    expect(model.challenge_id).toBe("observed_not_validated")
    expect(model.native).toEqual(raw)
    expect(model.expected).toEqual(raw.expected)
    expect((model.expected as { observation_cannot_establish_validity: boolean }).observation_cannot_establish_validity).toBe(true)
    expect((model.native as { expected: { observation_cannot_establish_validity: boolean } }).expected.observation_cannot_establish_validity).toBe(true)

    const normalized = normalizeVerifyHandoffChallengeExpected(raw.expected)
    assertObservation(normalized, "affirmative")
    expect(raw).toEqual(before)
    expect(normalized.observation_class).not.toBe("rejected")
    // Challenge context is not injected into the normalized runtime observation.
    expect(JSON.stringify(normalized)).not.toContain("observed_not_validated")
    expect(JSON.stringify(normalized)).not.toContain("observation_cannot_establish_validity")
  })

  test("Chronicle admission admitted → affirmative without synthesizing source validity", () => {
    const vector = readJson(
      "conformance/verifier-challenge-chronicle-proof-root-mismatch-rejected-v0/vectors/V-CHRONICLE-PROOF-ROOT-MISMATCH.json",
    ) as {
      expected: {
        baseline_admission: Parameters<typeof normalizeChronicleAdmissionResult>[0]
        challenged_admission: Parameters<typeof normalizeChronicleAdmissionResult>[0]
      }
    }
    const admitted = normalizeChronicleAdmissionResult(vector.expected.baseline_admission)
    assertObservation(admitted, "affirmative")
    expect(admitted.native_status).toBe("admitted")
    expect(admitted.native_detail.admission_scope).toBeUndefined()
  })

  test("Chronicle admission proof-root mismatch → rejected (local admission, not source invalidity)", () => {
    const vector = readJson(
      "conformance/verifier-challenge-chronicle-proof-root-mismatch-rejected-v0/vectors/V-CHRONICLE-PROOF-ROOT-MISMATCH.json",
    ) as {
      expected: {
        challenged_admission: Parameters<typeof normalizeChronicleAdmissionResult>[0]
        outcomes: string[]
      }
      receipt_root_control: unknown
    }
    const fromExpected = normalizeChronicleAdmissionChallengeExpected(vector.expected)
    const fromActual = normalizeChronicleAdmissionResult(vector.expected.challenged_admission)
    expect(fromExpected).toEqual(fromActual)
    assertObservation(fromExpected, "rejected")
    expect(fromExpected.native_reason_code).toBe("proof_root_mismatch")
    expect(fromExpected.native_detail.admission_scope).toBe("chronicle_entry_local")
    expect(vector.expected.outcomes).toContain("receipt_root_control_valid")
    expect(vector.receipt_root_control).toBeDefined()
    assertImmutable(vector.expected, normalizeChronicleAdmissionChallengeExpected)
  })

  test("Chronicle admission accepts every legitimate ChronicleEntryAdmissionFailureV0 pair", () => {
    for (const entry of ADMISSION_FAILURE_PAIRS) {
      const input = { success: false as const, failure: entry.failure }
      const before = structuredClone(input)
      const obs = normalizeChronicleAdmissionResult(input)
      expect(input).toEqual(before)
      assertObservation(obs, entry.observation_class)
      expect(obs.native_reason_code).toBe(entry.failure.reason_code)
      expect(obs.native_status).toBe(`admission_${entry.failure.failure_class}`)
      expect(obs.native_detail.failure).toEqual(entry.failure)
      expect(obs.native_detail.admission_scope).toBe("chronicle_entry_local")
    }
    const unverifiable = ADMISSION_FAILURE_PAIRS.filter((p) => p.observation_class === "unverifiable")
    const rejected = ADMISSION_FAILURE_PAIRS.filter((p) => p.observation_class === "rejected")
    expect(unverifiable).toHaveLength(1)
    expect(rejected.length).toBe(ADMISSION_FAILURE_PAIRS.length - 1)
    expect(unverifiable[0]!.observation_class).not.toBe(rejected[0]!.observation_class)
  })

  test("Chronicle admission rejects unknown/host/runtime/out-of-contract failures", () => {
    const cases: unknown[] = [
      { success: false, failure: { failure_class: "host_error", reason_code: "synthetic_host_failure" } },
      { success: false, failure: { failure_class: "timeout", reason_code: "deadline_exceeded" } },
      { success: false, failure: { failure_class: "totally_unknown", reason_code: "evidence_root_missing" } },
      // known class with reason belonging to another class
      { success: false, failure: { failure_class: "unverifiable", reason_code: "proof_root_mismatch" } },
      { success: false, failure: { failure_class: "evidence_mismatch", reason_code: "evidence_root_missing" } },
      // known class with unknown reason
      { success: false, failure: { failure_class: "identity_inconsistency", reason_code: "not_a_real_reason" } },
      // thrown Error / Lane-D-shaped execution failure objects are not native results
      new Error("adapter timeout"),
      { kind: "execution_failure", error: "timeout", surface: "chronicle_admission" },
      { success: false, failure: { failure_class: "cross_object_inconsistency" } },
    ]
    for (const input of cases) {
      expect(() => normalizeChronicleAdmissionResult(input as never)).toThrow(NormalizationContractError)
    }
  })

  test("Chronicle continuity direct_successor → affirmative", () => {
    const vector = readJson(
      "conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0/vectors/V-CHRONICLE-PREDECESSOR-UNKNOWN.json",
    ) as {
      expected: {
        baseline_continuity: Parameters<typeof normalizeChronicleContinuityResult>[0]
      }
    }
    const obs = normalizeChronicleContinuityResult(vector.expected.baseline_continuity)
    assertObservation(obs, "affirmative")
    expect(obs.native_reason_code).toBe("direct_successor")
  })

  test("Chronicle continuity predecessor_unknown → unverifiable", () => {
    const vector = readJson(
      "conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0/vectors/V-CHRONICLE-PREDECESSOR-UNKNOWN.json",
    ) as {
      expected: { challenged_continuity: Parameters<typeof normalizeChronicleContinuityResult>[0] }
    }
    const fromExpected = normalizeChronicleContinuityChallengeExpected(vector.expected)
    const fromActual = normalizeChronicleContinuityResult(vector.expected.challenged_continuity)
    expect(fromExpected).toEqual(fromActual)
    assertObservation(fromExpected, "unverifiable")
    expect(fromExpected.native_reason_code).toBe("predecessor_unknown")
  })

  test("Chronicle continuity predecessor_ref_mismatch → rejected", () => {
    const vector = readJson(
      "conformance/verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0/vectors/V-CHRONICLE-PREDECESSOR-REF-MISMATCH.json",
    ) as {
      expected: { challenged_continuity: Parameters<typeof normalizeChronicleContinuityResult>[0] }
    }
    const obs = normalizeChronicleContinuityChallengeExpected(vector.expected)
    assertObservation(obs, "rejected")
    expect(obs.native_reason_code).toBe("predecessor_ref_mismatch")
  })

  test("Chronicle continuity sequence_gap → rejected", () => {
    const vector = readJson(
      "conformance/verifier-challenge-chronicle-sequence-gap-rejected-v0/vectors/V-CHRONICLE-SEQUENCE-GAP.json",
    ) as {
      expected: { challenged_continuity: Parameters<typeof normalizeChronicleContinuityResult>[0] }
    }
    const obs = normalizeChronicleContinuityChallengeExpected(vector.expected)
    assertObservation(obs, "rejected")
    expect(obs.native_reason_code).toBe("sequence_gap")
  })

  test("Chronicle continuity malformed state remains distinct", () => {
    const fixture = readJson("tests/fixtures/chronicle-checkpoint-continuity-v0.json") as {
      vectors: Array<{
        name: string
        expected: Parameters<typeof normalizeChronicleContinuityResult>[0]
      }>
    }
    const malformed = fixture.vectors.find((v) => v.name === "current_malformed_non_integer_sequence")
    expect(malformed).toBeDefined()
    const obs = normalizeChronicleContinuityResult(malformed!.expected)
    assertObservation(obs, "malformed")
    expect(obs.native_reason_code).toBe("current_shape_malformed")
  })

  test("checkpoint-local ok:true → affirmative", () => {
    const vector = readJson(
      "conformance/verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH.json",
    ) as {
      expected: { baseline_verification: Parameters<typeof normalizeChronicleCheckpointLocalResult>[0] }
    }
    const obs = normalizeChronicleCheckpointLocalResult(vector.expected.baseline_verification)
    assertObservation(obs, "affirmative")
    expect(obs.native_detail.rootMatches).toBe(true)
    expect(obs.native_detail.entryRefsAreCanonical).toBe(true)
    expect(obs.native_detail.local_scope).toBe("chronicle_checkpoint_local")
  })

  test("checkpoint-local root mismatch → rejected (local scope)", () => {
    const vector = readJson(
      "conformance/verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH.json",
    ) as {
      expected: {
        challenged_verification: Parameters<typeof normalizeChronicleCheckpointLocalResult>[0]
        challenged_root_matches: boolean
      }
    }
    const fromExpected = normalizeChronicleCheckpointLocalChallengeExpected(vector.expected)
    const fromActual = normalizeChronicleCheckpointLocalResult(vector.expected.challenged_verification)
    expect(fromExpected).toEqual(fromActual)
    assertObservation(fromExpected, "rejected")
    expect(fromExpected.native_detail.rootMatches).toBe(false)
    expect(fromExpected.native_detail.local_scope).toBe("chronicle_checkpoint_local")
  })

  test("checkpoint-local noncanonical entry refs → rejected", () => {
    const vector = readJson(
      "conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL.json",
    ) as {
      expected: {
        challenged_verification: Parameters<typeof normalizeChronicleCheckpointLocalResult>[0]
        challenged_entry_refs_canonical: boolean
      }
    }
    const obs = normalizeChronicleCheckpointLocalChallengeExpected(vector.expected)
    assertObservation(obs, "rejected")
    expect(vector.expected.challenged_entry_refs_canonical).toBe(false)
    // Runtime result alone cannot always recover entryRefsAreCanonical when roots differ.
    expect(obs.native_detail.ok).toBe(false)
  })

  test("CAB audit_timestamp rejection → malformed (not operation verdict)", () => {
    const vector = readJson("conformance/counterfactual-audit-boundary-v0/vectors/V-AT-ROOT.json") as {
      expected: unknown
    }
    const obs = normalizeCounterfactualAuditBoundaryExpected(vector.expected)
    assertObservation(obs, "malformed")
    expect(obs.native_status).toBe("rejected")
    assertImmutable(vector.expected, normalizeCounterfactualAuditBoundaryExpected)
  })

  test("CAB accepted snapshot → operation", () => {
    const vector = readJson("conformance/counterfactual-audit-boundary-v0/vectors/V-AT-ISOLATE.json") as {
      expected: unknown
    }
    const obs = normalizeCounterfactualAuditBoundaryExpected(vector.expected)
    assertObservation(obs, "operation")
    expect(obs.native_status).toBe("accepted_snapshot")
  })

  test("CAB manifest hash differs → operation (non-verdict)", () => {
    const vector = readJson("conformance/counterfactual-audit-boundary-v0/vectors/V-MAN-HASH-DIFF.json") as {
      expected: unknown
    }
    const obs = normalizeCounterfactualAuditBoundaryExpected(vector.expected)
    assertObservation(obs, "operation")
    expect(obs.native_status).toBe("manifest_hash_differs")
  })

  test("anti-collapse: unverifiable ≠ rejected ≠ malformed ≠ operation ≠ affirmative", () => {
    const missing = normalizeVerifyHandoffReceiptRootResult({
      ok: false,
      receipt_root: null,
      recomputed_root: null,
    })
    const integrity = normalizeVerifyHandoffReceiptRootResult({
      ok: false,
      receipt_root: "0xaa",
      recomputed_root: "0xbb",
    })
    const affirmative = normalizeVerifyHandoffReceiptRootResult({
      ok: true,
      receipt_root: "0xaa",
      recomputed_root: "0xaa",
    })
    const malformed = normalizeChronicleContinuityResult({
      evaluation_state: "malformed",
      verdict: null,
      relation: null,
      reason_code: "current_shape_malformed",
    })
    const operation = normalizeCounterfactualAuditBoundaryExpected({
      outcome: "manifest_hash_differs",
    })
    const predecessorUnknown = normalizeChronicleContinuityResult({
      evaluation_state: "unverifiable",
      verdict: null,
      relation: null,
      reason_code: "predecessor_unknown",
    })
    const refMismatch = normalizeChronicleContinuityResult({
      evaluation_state: "evaluated",
      verdict: "invalid",
      relation: null,
      reason_code: "predecessor_ref_mismatch",
    })
    const sequenceGap = normalizeChronicleContinuityResult({
      evaluation_state: "evaluated",
      verdict: "invalid",
      relation: null,
      reason_code: "sequence_gap",
    })

    expect(missing.observation_class).toBe("unverifiable")
    expect(integrity.observation_class).toBe("rejected")
    expect(malformed.observation_class).toBe("malformed")
    expect(operation.observation_class).toBe("operation")
    expect(affirmative.observation_class).toBe("affirmative")

    expect(missing.observation_class).not.toBe(integrity.observation_class)
    expect(malformed.observation_class).not.toBe(integrity.observation_class)
    expect(malformed.observation_class).not.toBe(missing.observation_class)
    expect(operation.observation_class).not.toBe(integrity.observation_class)
    expect(operation.observation_class).not.toBe(affirmative.observation_class)

    expect(predecessorUnknown.observation_class).toBe("unverifiable")
    expect(refMismatch.observation_class).toBe("rejected")
    expect(sequenceGap.observation_class).toBe("rejected")
    expect(predecessorUnknown.native_reason_code).not.toBe(refMismatch.native_reason_code)
    expect(predecessorUnknown.native_reason_code).not.toBe(sequenceGap.native_reason_code)
    expect(refMismatch.native_reason_code).not.toBe(sequenceGap.native_reason_code)
  })

  test("host/runtime non-collapse: thrown Error and invalid inputs are not semantic observations", () => {
    expect(() => normalizeVerifyHandoffReceiptRootResult(new Error("timeout") as never)).toThrow(
      NormalizationContractError,
    )
    expect(() => normalizeVerifyHandoffReceiptRootResult("not-a-result" as never)).toThrow(
      NormalizationContractError,
    )
    expect(() =>
      normalizeVerifyHandoffReceiptRootResult({
        ok: false,
        receipt_root: "0xaa",
        recomputed_root: null,
      }),
    ).toThrow(NormalizationContractError)
    expect(() => normalizeChronicleAdmissionResult(null as never)).toThrow(NormalizationContractError)
    expect(() =>
      normalizeChronicleContinuityResult({
        evaluation_state: "weird",
        verdict: null,
        relation: null,
        reason_code: "predecessor_unknown",
      } as never),
    ).toThrow(NormalizationContractError)
    expect(() =>
      normalizeChronicleContinuityResult({
        evaluation_state: "unverifiable",
        verdict: null,
        relation: null,
        reason_code: "sequence_gap",
      }),
    ).toThrow(NormalizationContractError)
    expect(() => normalizeChronicleCheckpointLocalResult({ ok: false } as never)).toThrow(
      NormalizationContractError,
    )
    expect(() => normalizeCounterfactualAuditBoundaryExpected({ outcome: "host_error" })).toThrow(
      NormalizationContractError,
    )
    expect(() => normalizeVerifyHandoffChallengeExpected({})).toThrow(NormalizationContractError)
  })

  test("determinism: equivalent natives normalize byte-equivalently", () => {
    const a = normalizeVerifyHandoffReceiptRootResult({
      ok: false,
      receipt_root: "0xaa",
      recomputed_root: "0xbb",
    })
    const b = normalizeVerifyHandoffReceiptRootResult({
      ok: false,
      receipt_root: "0xaa",
      recomputed_root: "0xbb",
    })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(createHash("sha256").update(JSON.stringify(a)).digest("hex")).toBe(
      createHash("sha256").update(JSON.stringify(b)).digest("hex"),
    )
  })

  test("Lane B neighborhood SHA256 remains frozen", () => {
    const fixture = readJson("tests/fixtures/counterfactual-neighborhood-identity-v0/neighborhood.json") as {
      neighborhood: FrozenCounterfactualNeighborhoodV0
      expected_neighborhood_sha256: string
    }
    expect(fixture.expected_neighborhood_sha256).toBe(LANE_B_SHA256)
    expect(computeFrozenCounterfactualNeighborhoodSha256(fixture.neighborhood)).toBe(LANE_B_SHA256)
    const py = spawnSync(
      "python",
      [resolve(root, "tests/fixtures/counterfactual-neighborhood-identity-v0/verify_independent.py")],
      { cwd: root, encoding: "utf8" },
    )
    expect(py.status).toBe(0)
    expect(py.stdout.trim()).toBe(LANE_B_SHA256)

    // Lane A projection still works; Lane C fields are not in neighborhood identity.
    const handoff = readJson(
      "conformance/verifier-challenge-observed-not-validated-v0/vectors/V-OBSERVED-NOT-VALIDATED.json",
    ) as Record<string, unknown>
    projectVerifierChallengeVector(handoff)
  })

  test("frozen production package digests remain unchanged", () => {
    const checks: Array<{ packageDir: string; fixture: string; child?: string; expected?: string }> = [
      {
        packageDir: "conformance/counterfactual-audit-boundary-v0",
        fixture: "7503d5cac003a23489f194c5521ef90b01ac0b2ce345a2cec57ad12ffeb274f8",
        expected: "db664c5e8da2f0fb6d1d94a036eab572ae2941ffeb5193624365d4bdbaeec24a",
      },
      {
        packageDir: "conformance/verifier-challenge-set-v0",
        fixture: "6a4f84a109f633559c7df2e9dd86092e00ce52a81c4a3dcd46c112175748e284",
        child: "945ec30015490b3d92c01177124be5eddcee18b99308d3aed7701fedff67d326",
      },
      {
        packageDir: "conformance/verifier-challenge-chronicle-admission-set-v0",
        fixture: "dbf062131278b8164373725442e069eb53328729058960b52213dd74b78c83c5",
        child: "55c8f203255bf97c40ab76255a95db3447bc2dc30ec961fd65f6a39eba12f22a",
      },
      {
        packageDir: "conformance/verifier-challenge-chronicle-continuity-set-v0",
        fixture: "77261f48e3a712536e3cd37f4384c0b62a5063a3c6be7cf14ac648848feea716",
        child: "4448c728b264cc51d369de7b42430205b9dfdabedb09a282c619e5a42e0d61ac",
      },
      {
        packageDir: "conformance/verifier-challenge-chronicle-checkpoint-local-set-v0",
        fixture: "2c5b171806a253c32495a819d011087c46f4cfb8bad27b0821f6abd280a6ef89",
        child: "5bcdef8fa4fdb24287e29efb273b4e1998e443047ea1251ec12e3c8097269e28",
      },
    ]

    for (const entry of checks) {
      const manifest = JSON.parse(readFileSync(resolve(root, `${entry.packageDir}/manifest.json`), "utf8"))
      expect(manifest.fixture_set_sha256).toBe(entry.fixture)
      const contract = JSON.parse(readFileSync(resolve(root, `${entry.packageDir}/contract.json`), "utf8"))
      if (entry.expected) expect(contract.expected_result_set_sha256).toBe(entry.expected)
      if (entry.child) {
        const child =
          contract.child_identity_set_sha256 ?? contract.aggregate?.child_identity_set_sha256
        expect(child).toBe(entry.child)
      }
    }
  })
})
