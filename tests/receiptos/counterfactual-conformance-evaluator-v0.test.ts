import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import * as EvaluatorModule from "../../src/receiptos/challenge/counterfactual-conformance-evaluator"
import {
  COUNTERFACTUAL_CONFORMANCE_EVALUATION_SCHEMA,
  ConformanceEvaluatorContractError,
  compareNormalizedObservations,
  evaluateVerifierChallengeConformance,
  RunnerContractError,
} from "../../src/receiptos/challenge/counterfactual-conformance-evaluator"
import {
  COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
  VERIFY_HANDOFF_ADAPTER_IDENTITY,
  CHRONICLE_ADMISSION_ADAPTER_IDENTITY,
  CHRONICLE_CONTINUITY_ADAPTER_IDENTITY,
  CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY,
  type VerifierChallengeRunRequestV0,
} from "../../src/receiptos/challenge/counterfactual-verifier-runner"
import {
  COUNTERFACTUAL_OBSERVATION_SCHEMA,
  normalizeVerifyHandoffChallengeExpected,
  type CounterfactualObservationV0,
} from "../../src/receiptos/challenge/counterfactual-result-normalization"
import {
  COUNTERFACTUAL_CHALLENGE_IDENTITY_SCHEMA,
  computeFrozenCounterfactualNeighborhoodSha256,
  projectCounterfactualChallengeIdentity,
  type CounterfactualChallengeIdentityV0,
  type FrozenCounterfactualNeighborhoodV0,
} from "../../src/receiptos/challenge/counterfactual-neighborhood"
import {
  projectVerifierChallengeVector,
  type VerifierChallengeVectorModelV0,
} from "../../src/receiptos/challenge/verifier-challenge-model"
import type { HandoffEvidence } from "../../src/receiptos/schema/types"
import type { PortableProofObjectV0 } from "../../src/receiptos/capsule/portable-proof-object-v0"
import type { ChronicleCheckpointV0 } from "../../src/receiptos/capsule/chronicle-portfolio-v0"

const root = resolve(import.meta.dir, "../..")
const LANE_B_SHA256 = "37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d"

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"))
}

function identityFromVector(vector: Record<string, unknown>): {
  model: VerifierChallengeVectorModelV0
  challenge: CounterfactualChallengeIdentityV0
} {
  const model = projectVerifierChallengeVector(vector)
  return { model, challenge: projectCounterfactualChallengeIdentity(model) }
}

function loadHandoff(vectorPath: string) {
  const vector = readJson(vectorPath) as Record<string, unknown>
  const { model, challenge } = identityFromVector(vector)
  const source = vector.source_fixture as { repository_path: string }
  const baseline = structuredClone(readJson(source.repository_path)) as HandoffEvidence
  const mutation = vector.mutation as { path: string[]; to: unknown }
  const challenged = structuredClone(baseline) as Record<string, unknown>
  let cursor: Record<string, unknown> = challenged
  for (let i = 0; i < mutation.path.length - 1; i += 1) {
    cursor = cursor[mutation.path[i]!] as Record<string, unknown>
  }
  cursor[mutation.path[mutation.path.length - 1]!] = mutation.to
  return {
    vector,
    model,
    challenge,
    baseline,
    challenged: challenged as unknown as HandoffEvidence,
  }
}

function handoffEvalRequest(
  challenge: CounterfactualChallengeIdentityV0,
  model: VerifierChallengeVectorModelV0,
  evidence: HandoffEvidence,
  extras?: Partial<VerifierChallengeRunRequestV0>,
): VerifierChallengeRunRequestV0 {
  return {
    schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
    surface: "verify_handoff_receipt_root",
    subject: {
      entrypoint: VERIFY_HANDOFF_ADAPTER_IDENTITY.entrypoint,
      module_path: VERIFY_HANDOFF_ADAPTER_IDENTITY.module_path,
      git_blob_oid: VERIFY_HANDOFF_ADAPTER_IDENTITY.git_blob_oid,
    },
    challenge,
    lane_a_model: model,
    input: { evidence },
    ...extras,
  }
}

describe("counterfactual conformance evaluator v0", () => {
  test("no detached-execution bound evaluator API is exported", () => {
    const keys = Object.keys(EvaluatorModule)
    expect(keys).toContain("evaluateVerifierChallengeConformance")
    expect(keys).toContain("compareNormalizedObservations")
    expect(keys.some((k) => /fromExecution|withExecution|detached/i.test(k))).toBe(false)
  })

  test("verifyHandoff frozen leaves evaluate conformant", async () => {
    const paths = [
      "conformance/verifier-challenge-observed-not-validated-v0/vectors/V-OBSERVED-NOT-VALIDATED.json",
      "conformance/verifier-challenge-missing-required-input-unverifiable-v0/vectors/V-MISSING-REQUIRED-INPUT.json",
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    ]
    for (const path of paths) {
      const { model, challenge, challenged } = loadHandoff(path)
      const beforeModel = structuredClone(model)
      const beforeChallenge = structuredClone(challenge)
      const result = await evaluateVerifierChallengeConformance(
        handoffEvalRequest(challenge, model, challenged),
      )
      expect(result.evaluation_state).toBe("evaluated")
      if (result.evaluation_state !== "evaluated") throw new Error("unreachable")
      expect(result.verdict).toBe("conformant")
      expect(result.schema).toBe(COUNTERFACTUAL_CONFORMANCE_EVALUATION_SCHEMA)
      expect(result.challenge).toEqual(challenge)
      expect(result.expected_observation_source).toBe("lane_a_model")
      expect(result.materialized_input_binding).toBe("caller_supplied_unproven")
      expect(result.mismatch).toBeNull()
      expect(model).toEqual(beforeModel)
      expect(challenge).toEqual(beforeChallenge)
      if (path.includes("observed-not-validated")) {
        expect(result.challenge.challenge_id).toBe("observed_not_validated")
        expect(result.expected_observation.observation_class).toBe("affirmative")
        expect(result.actual_observation?.observation_class).toBe("affirmative")
      }
    }
  })

  test("verifyHandoff expected mismatch and same-class different detail → nonconformant", async () => {
    const { model, challenge, challenged } = loadHandoff(
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    )
    const wrongExpectedModel = structuredClone(model)
    ;(wrongExpectedModel.expected as { challenged_verification: { ok: boolean } }).challenged_verification = {
      ok: true,
      receipt_root: "0xaa",
      recomputed_root: "0xaa",
    } as never
    const mismatched = await evaluateVerifierChallengeConformance(
      handoffEvalRequest(challenge, wrongExpectedModel, challenged),
    )
    expect(mismatched.evaluation_state).toBe("evaluated")
    if (mismatched.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(mismatched.verdict).toBe("nonconformant")
    expect(mismatched.mismatch?.kind).toBe("observation_class_mismatch")

    const sameClass = structuredClone(model)
    ;(sameClass.expected as { challenged_verification: { recomputed_root: string } }).challenged_verification.recomputed_root =
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    const detailMismatch = await evaluateVerifierChallengeConformance(
      handoffEvalRequest(challenge, sameClass, challenged),
    )
    expect(detailMismatch.evaluation_state).toBe("evaluated")
    if (detailMismatch.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(detailMismatch.verdict).toBe("nonconformant")
    expect(detailMismatch.expected_observation.observation_class).toBe(
      detailMismatch.actual_observation?.observation_class,
    )
    expect(detailMismatch.mismatch?.kind).toBe("native_detail_mismatch")
  })

  test("Chronicle admission admitted / rejected / unverifiable evaluate conformant", async () => {
    const vector = readJson(
      "conformance/verifier-challenge-chronicle-proof-root-mismatch-rejected-v0/vectors/V-CHRONICLE-PROOF-ROOT-MISMATCH.json",
    ) as Record<string, unknown>
    const { model, challenge } = identityFromVector(vector)
    const source = readJson((vector.source_fixture as { repository_path: string }).repository_path) as {
      input: {
        evidence: HandoffEvidence
        proof_object: PortableProofObjectV0
        options: Record<string, unknown>
      }
    }

    const admittedModel = structuredClone(model)
    admittedModel.expected = {
      challenged_admission: (vector.expected as { baseline_admission: unknown }).baseline_admission,
    }
    const admitted = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "chronicle_admission",
      subject: challenge.subject!,
      challenge,
      lane_a_model: admittedModel,
      input: {
        evidence: source.input.evidence,
        proof_object: source.input.proof_object,
        options: source.input.options as never,
      },
    })
    expect(admitted.evaluation_state).toBe("evaluated")
    if (admitted.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(admitted.verdict).toBe("conformant")
    expect(admitted.actual_observation?.native_detail.admission_scope).toBeUndefined()

    const rejectedInput = structuredClone(source.input)
    rejectedInput.proof_object.receipt_root = (vector.mutation as { to: string }).to
    const rejected = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "chronicle_admission",
      subject: challenge.subject!,
      challenge,
      lane_a_model: model,
      input: {
        evidence: rejectedInput.evidence,
        proof_object: rejectedInput.proof_object,
        options: rejectedInput.options as never,
      },
    })
    expect(rejected.evaluation_state).toBe("evaluated")
    if (rejected.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(rejected.verdict).toBe("conformant")
    expect(rejected.actual_observation?.observation_class).toBe("rejected")
    expect(rejected.actual_observation?.native_detail.admission_scope).toBe("chronicle_entry_local")

    const fixture = readJson(
      "tests/fixtures/receiptos-chronicle-admission-v0/vectors/02-evidence-root-missing.json",
    ) as {
      input: {
        evidence: HandoffEvidence
        proof_object: PortableProofObjectV0
        options: Record<string, unknown>
      }
    }
    const unverifiableChallenge: CounterfactualChallengeIdentityV0 = {
      schema: COUNTERFACTUAL_CHALLENGE_IDENTITY_SCHEMA,
      native_schema: "receiptos_chronicle_admission_vector.v0",
      package_version: "receiptos-chronicle-admission-v0",
      vector_id: "fixture-evidence-root-missing",
      challenge_id: "evidence_root_missing",
      execution_class: "production-admission-binding",
      surface: "chronicle_admission",
      subject: {
        entrypoint: CHRONICLE_ADMISSION_ADAPTER_IDENTITY.entrypoint,
        module_path: CHRONICLE_ADMISSION_ADAPTER_IDENTITY.module_path,
        git_blob_oid: CHRONICLE_ADMISSION_ADAPTER_IDENTITY.git_blob_oid,
      },
      source: null,
      derivation: {
        kind: "path_mutation",
        operation: "set",
        path: ["evidence", "anchor", "receipt_root"],
        from: "present",
        to: null,
      },
    }
    const unverifiableModel = {
      model_schema: "receiptos.verifier_challenge_model.v0",
      native_schema: unverifiableChallenge.native_schema,
      vector_id: unverifiableChallenge.vector_id,
      package_version: unverifiableChallenge.package_version,
      challenge_id: unverifiableChallenge.challenge_id,
      execution_class: unverifiableChallenge.execution_class,
      surface: unverifiableChallenge.surface,
      subject: unverifiableChallenge.subject,
      source: null,
      derivation: unverifiableChallenge.derivation,
      field_classification: null,
      expected: {
        challenged_admission: {
          success: false,
          failure: { failure_class: "unverifiable", reason_code: "evidence_root_missing" },
        },
      },
      native: {},
    } as unknown as VerifierChallengeVectorModelV0
    const unverifiable = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "chronicle_admission",
      subject: unverifiableChallenge.subject!,
      challenge: unverifiableChallenge,
      lane_a_model: unverifiableModel,
      input: {
        evidence: fixture.input.evidence,
        proof_object: fixture.input.proof_object,
        options: fixture.input.options as never,
      },
    })
    expect(unverifiable.evaluation_state).toBe("evaluated")
    if (unverifiable.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(unverifiable.verdict).toBe("conformant")
    expect(unverifiable.actual_observation?.observation_class).toBe("unverifiable")

    const wrongReasonModel = structuredClone(model)
    ;(wrongReasonModel.expected as { challenged_admission: { failure: { reason_code: string } } })
      .challenged_admission.failure.reason_code = "capsule_stored_mismatch"
    const reasonMismatch = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "chronicle_admission",
      subject: challenge.subject!,
      challenge,
      lane_a_model: wrongReasonModel,
      input: {
        evidence: rejectedInput.evidence,
        proof_object: rejectedInput.proof_object,
        options: rejectedInput.options as never,
      },
    })
    expect(reasonMismatch.evaluation_state).toBe("evaluated")
    if (reasonMismatch.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(reasonMismatch.verdict).toBe("nonconformant")
    expect(reasonMismatch.mismatch?.kind).toBe("native_reason_mismatch")
  })

  test("Chronicle continuity frozen cases evaluate conformant; wrong reason nonconformant", async () => {
    const cases: Array<{
      path: string
      pair: "baseline_pair" | "challenged_pair"
      expectedKey: "baseline_continuity" | "challenged_continuity"
    }> = [
      {
        path: "conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0/vectors/V-CHRONICLE-PREDECESSOR-UNKNOWN.json",
        pair: "baseline_pair",
        expectedKey: "baseline_continuity",
      },
      {
        path: "conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0/vectors/V-CHRONICLE-PREDECESSOR-UNKNOWN.json",
        pair: "challenged_pair",
        expectedKey: "challenged_continuity",
      },
      {
        path: "conformance/verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0/vectors/V-CHRONICLE-PREDECESSOR-REF-MISMATCH.json",
        pair: "challenged_pair",
        expectedKey: "challenged_continuity",
      },
      {
        path: "conformance/verifier-challenge-chronicle-sequence-gap-rejected-v0/vectors/V-CHRONICLE-SEQUENCE-GAP.json",
        pair: "challenged_pair",
        expectedKey: "challenged_continuity",
      },
    ]

    for (const entry of cases) {
      const vector = readJson(entry.path) as Record<string, unknown>
      const { model, challenge } = identityFromVector(vector)
      const evalModel = structuredClone(model)
      evalModel.expected = {
        challenged_continuity: (vector.expected as Record<string, unknown>)[entry.expectedKey],
      }
      const pair = vector[entry.pair] as {
        current: ChronicleCheckpointV0
        predecessor: ChronicleCheckpointV0 | null
      }
      const result = await evaluateVerifierChallengeConformance({
        schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
        surface: "chronicle_continuity",
        subject: {
          entrypoint: CHRONICLE_CONTINUITY_ADAPTER_IDENTITY.entrypoint,
          module_path: CHRONICLE_CONTINUITY_ADAPTER_IDENTITY.module_path,
          git_blob_oid: CHRONICLE_CONTINUITY_ADAPTER_IDENTITY.git_blob_oid,
        },
        challenge,
        lane_a_model: evalModel,
        input: { current: pair.current, predecessor: pair.predecessor },
      })
      expect(result.evaluation_state).toBe("evaluated")
      if (result.evaluation_state !== "evaluated") throw new Error("unreachable")
      expect(result.verdict).toBe("conformant")
    }

    const fixture = readJson("tests/fixtures/chronicle-checkpoint-continuity-v0.json") as {
      vectors: Array<{
        name: string
        current: ChronicleCheckpointV0
        predecessor: ChronicleCheckpointV0 | null
        expected: unknown
      }>
    }
    const malformed = fixture.vectors.find((v) => v.name === "current_malformed_non_integer_sequence")!
    const malformedChallenge: CounterfactualChallengeIdentityV0 = {
      schema: COUNTERFACTUAL_CHALLENGE_IDENTITY_SCHEMA,
      native_schema: "chronicle_checkpoint_continuity_fixture.v0",
      package_version: "chronicle-checkpoint-continuity-v0",
      vector_id: "fixture-malformed",
      challenge_id: "current_shape_malformed",
      execution_class: "production-continuity-binding",
      surface: "chronicle_continuity",
      subject: {
        entrypoint: CHRONICLE_CONTINUITY_ADAPTER_IDENTITY.entrypoint,
        module_path: CHRONICLE_CONTINUITY_ADAPTER_IDENTITY.module_path,
        git_blob_oid: CHRONICLE_CONTINUITY_ADAPTER_IDENTITY.git_blob_oid,
      },
      source: null,
      derivation: { kind: "substitution", value: { name: malformed.name } },
    }
    const malformedModel = {
      model_schema: "receiptos.verifier_challenge_model.v0",
      native_schema: malformedChallenge.native_schema,
      vector_id: malformedChallenge.vector_id,
      package_version: malformedChallenge.package_version,
      challenge_id: malformedChallenge.challenge_id,
      execution_class: malformedChallenge.execution_class,
      surface: malformedChallenge.surface,
      subject: malformedChallenge.subject,
      source: null,
      derivation: malformedChallenge.derivation,
      field_classification: null,
      expected: { challenged_continuity: malformed.expected },
      native: {},
    } as unknown as VerifierChallengeVectorModelV0
    const malformedResult = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "chronicle_continuity",
      subject: malformedChallenge.subject!,
      challenge: malformedChallenge,
      lane_a_model: malformedModel,
      input: { current: malformed.current, predecessor: malformed.predecessor },
    })
    expect(malformedResult.evaluation_state).toBe("evaluated")
    if (malformedResult.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(malformedResult.verdict).toBe("conformant")

    const gap = readJson(
      "conformance/verifier-challenge-chronicle-sequence-gap-rejected-v0/vectors/V-CHRONICLE-SEQUENCE-GAP.json",
    ) as Record<string, unknown>
    const { model: gapModel, challenge: gapChallenge } = identityFromVector(gap)
    const wrong = structuredClone(gapModel)
    ;(wrong.expected as { challenged_continuity: { reason_code: string } }).challenged_continuity.reason_code =
      "predecessor_ref_mismatch"
    const wrongResult = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "chronicle_continuity",
      subject: gapChallenge.subject!,
      challenge: gapChallenge,
      lane_a_model: wrong,
      input: {
        current: (gap.challenged_pair as { current: ChronicleCheckpointV0 }).current,
        predecessor: (gap.challenged_pair as { predecessor: ChronicleCheckpointV0 }).predecessor,
      },
    })
    expect(wrongResult.evaluation_state).toBe("evaluated")
    if (wrongResult.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(wrongResult.verdict).toBe("nonconformant")
    // Same observation_class (rejected) but native_status encodes reason_code.
    expect(wrongResult.mismatch?.kind).toBe("native_status_mismatch")
    expect(wrongResult.expected_observation.observation_class).toBe(
      wrongResult.actual_observation?.observation_class,
    )
  })

  test("checkpoint-local frozen cases evaluate conformant; predicate mismatch nonconformant", async () => {
    const rootMismatch = readJson(
      "conformance/verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH.json",
    ) as Record<string, unknown>
    const entryRefs = readJson(
      "conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL.json",
    ) as Record<string, unknown>

    for (const [vector, checkpointKey, expectedKey] of [
      [rootMismatch, "baseline_checkpoint", "baseline_verification"],
      [rootMismatch, "challenged_checkpoint", "challenged_verification"],
      [entryRefs, "challenged_checkpoint", "challenged_verification"],
    ] as const) {
      const { model, challenge } = identityFromVector(vector)
      const evalModel = structuredClone(model)
      evalModel.expected = {
        challenged_verification: (vector.expected as Record<string, unknown>)[expectedKey],
        ...(typeof (vector.expected as { challenged_root_matches?: boolean }).challenged_root_matches ===
        "boolean" && expectedKey === "challenged_verification"
          ? {
              challenged_root_matches: (vector.expected as { challenged_root_matches: boolean })
                .challenged_root_matches,
            }
          : {}),
        ...(typeof (vector.expected as { challenged_entry_refs_canonical?: boolean })
          .challenged_entry_refs_canonical === "boolean" && expectedKey === "challenged_verification"
          ? {
              challenged_entry_refs_canonical: (
                vector.expected as { challenged_entry_refs_canonical: boolean }
              ).challenged_entry_refs_canonical,
            }
          : {}),
      }
      const result = await evaluateVerifierChallengeConformance({
        schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
        surface: "chronicle_checkpoint_local",
        subject: {
          entrypoint: CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY.entrypoint,
          module_path: CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY.module_path,
          git_blob_oid: CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY.git_blob_oid,
        },
        challenge,
        lane_a_model: evalModel,
        input: { checkpoint: vector[checkpointKey] as ChronicleCheckpointV0 },
      })
      expect(result.evaluation_state).toBe("evaluated")
      if (result.evaluation_state !== "evaluated") throw new Error("unreachable")
      expect(result.verdict).toBe("conformant")
      expect(result.actual_observation?.native_detail.local_scope).toBe("chronicle_checkpoint_local")
    }

    const { model, challenge } = identityFromVector(rootMismatch)
    const storedRoot = (
      rootMismatch.expected as {
        challenged_verification: { checkpoint_root: string }
      }
    ).challenged_verification.checkpoint_root
    const wrong = structuredClone(model)
    // Affirmative expected (matching roots) vs actual root-mismatch rejection.
    // Omit challenged_root_matches to avoid expected-side contract disagreement.
    wrong.expected = {
      challenged_verification: {
        ok: true,
        checkpoint_root: storedRoot,
        recomputed_checkpoint_root: storedRoot,
      },
    }
    const mismatch = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "chronicle_checkpoint_local",
      subject: challenge.subject!,
      challenge,
      lane_a_model: wrong,
      input: { checkpoint: rootMismatch.challenged_checkpoint as ChronicleCheckpointV0 },
    })
    expect(mismatch.evaluation_state).toBe("evaluated")
    if (mismatch.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(mismatch.verdict).toBe("nonconformant")
    expect(mismatch.mismatch?.kind).toBe("observation_class_mismatch")
  })

  test("CAB accepted snapshot and manifest hash evaluate conformant; mismatch nonconformant", async () => {
    const isolate = readJson("conformance/counterfactual-audit-boundary-v0/vectors/V-AT-ISOLATE.json") as Record<
      string,
      unknown
    > & { runtime_construction: { initial: unknown } }
    const { model, challenge } = identityFromVector(isolate)
    const ok = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge,
      lane_a_model: model,
      input: { value: isolate.runtime_construction.initial },
    })
    expect(ok.evaluation_state).toBe("evaluated")
    if (ok.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(ok.verdict).toBe("conformant")

    const wrongSnapshotModel = structuredClone(model)
    ;(wrongSnapshotModel.expected as { canonical_snapshot_json: string }).canonical_snapshot_json =
      "{\"tampered\":true}"
    const badSnapshot = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge,
      lane_a_model: wrongSnapshotModel,
      input: { value: isolate.runtime_construction.initial },
    })
    expect(badSnapshot.evaluation_state).toBe("evaluated")
    if (badSnapshot.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(badSnapshot.verdict).toBe("nonconformant")
    expect(badSnapshot.mismatch?.kind).toBe("cab_result_mismatch")

    const manifest = readJson(
      "conformance/counterfactual-audit-boundary-v0/vectors/V-MAN-UINT8-EXACT.json",
    ) as Record<string, unknown> & { inputs: Array<{ bytes: number[] }> }
    const { model: mModel, challenge: mChallenge } = identityFromVector(manifest)
    const hashOk = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "manifest_file_sha256",
      challenge: mChallenge,
      lane_a_model: mModel,
      input: { bytes: Uint8Array.from(manifest.inputs[0]!.bytes) },
    })
    expect(hashOk.evaluation_state).toBe("evaluated")
    if (hashOk.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(hashOk.verdict).toBe("conformant")

    const wrongHash = structuredClone(mModel)
    ;(wrongHash.expected as { sha256_hex: string }).sha256_hex =
      "0000000000000000000000000000000000000000000000000000000000000000"
    const badHash = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "manifest_file_sha256",
      challenge: mChallenge,
      lane_a_model: wrongHash,
      input: { bytes: Uint8Array.from(manifest.inputs[0]!.bytes) },
    })
    expect(badHash.evaluation_state).toBe("evaluated")
    if (badHash.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(badHash.verdict).toBe("nonconformant")
    expect(badHash.mismatch?.kind).toBe("cab_result_mismatch")
  })

  test("CAB audit_timestamp throw → execution_unresolved with verdict null", async () => {
    const vector = readJson("conformance/counterfactual-audit-boundary-v0/vectors/V-AT-ROOT.json") as Record<
      string,
      unknown
    >
    const { model, challenge } = identityFromVector(vector)
    const result = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge,
      lane_a_model: model,
      input: { value: vector.input },
    })
    expect(result.evaluation_state).toBe("execution_unresolved")
    if (result.evaluation_state !== "execution_unresolved") throw new Error("unreachable")
    expect(result.verdict).toBeNull()
    expect(result.execution_failure.safe_message).toBe("subject invocation failed")
    expect(JSON.stringify(result)).not.toContain("nonconformant")
    expect(JSON.stringify(result)).not.toContain("source_validity")
  })

  test("unsupported CAB multi-operand comparison is contract error, not guessed conformance", async () => {
    const vector = readJson("conformance/counterfactual-audit-boundary-v0/vectors/V-MAN-HASH-DIFF.json") as Record<
      string,
      unknown
    > & { inputs: Array<{ value: string }> }
    const { model, challenge } = identityFromVector(vector)
    await expect(
      evaluateVerifierChallengeConformance({
        schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
        surface: "counterfactual_audit_boundary",
        subject: null,
        operation: "manifest_file_sha256",
        challenge,
        lane_a_model: model,
        input: { bytes: vector.inputs[0]!.value },
      }),
    ).rejects.toBeInstanceOf(ConformanceEvaluatorContractError)
  })

  test("cross-cutting contract/error policies", async () => {
    const { model, challenge, challenged } = loadHandoff(
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    )

    await expect(
      evaluateVerifierChallengeConformance({
        schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
        surface: "verify_handoff_receipt_root",
        subject: challenge.subject!,
        challenge,
        input: { evidence: challenged },
      } as never),
    ).rejects.toBeInstanceOf(ConformanceEvaluatorContractError)

    const wrongModel = structuredClone(model)
    wrongModel.vector_id = "different"
    await expect(
      evaluateVerifierChallengeConformance(handoffEvalRequest(challenge, wrongModel, challenged)),
    ).rejects.toBeInstanceOf(RunnerContractError)

    await expect(
      evaluateVerifierChallengeConformance(
        handoffEvalRequest(challenge, model, challenged, { expected: { unrelated: true } }),
      ),
    ).rejects.toBeInstanceOf(ConformanceEvaluatorContractError)

    const badExpected = structuredClone(model)
    badExpected.expected = { not_a_valid_expected: true }
    await expect(
      evaluateVerifierChallengeConformance(handoffEvalRequest(challenge, badExpected, challenged)),
    ).rejects.toBeInstanceOf(ConformanceEvaluatorContractError)

    await expect(
      evaluateVerifierChallengeConformance({
        ...handoffEvalRequest(challenge, model, challenged),
        subject: {
          entrypoint: "wrong",
          module_path: VERIFY_HANDOFF_ADAPTER_IDENTITY.module_path,
          git_blob_oid: VERIFY_HANDOFF_ADAPTER_IDENTITY.git_blob_oid,
        },
      }),
    ).rejects.toBeInstanceOf(RunnerContractError)
  })

  test("pure comparator scopes equality without claiming bound provenance", () => {
    const { model } = loadHandoff(
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    )
    const a = normalizeVerifyHandoffChallengeExpected(model.expected)
    const b = normalizeVerifyHandoffChallengeExpected(model.expected)
    expect(compareNormalizedObservations(a, b)).toEqual({ equal: true, mismatch: null })
    const c: CounterfactualObservationV0 = {
      ...a,
      native_reason_code: "different_reason",
    }
    const compared = compareNormalizedObservations(a, c)
    expect(compared.equal).toBe(false)
    expect(compared.mismatch?.kind).toBe("native_reason_mismatch")
    expect(Object.keys(EvaluatorModule)).not.toContain("evaluateFromExecutionResult")
  })

  test("anti-collapse and identity/determinism", async () => {
    const { model, challenge, challenged } = loadHandoff(
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    )
    const a = await evaluateVerifierChallengeConformance(handoffEvalRequest(challenge, model, challenged))
    const b = await evaluateVerifierChallengeConformance(handoffEvalRequest(challenge, model, challenged))
    expect(a).toEqual(b)
    expect(a.challenge).not.toBe(challenge)
    expect(a.challenge).toEqual(challenge)

    const cab = readJson("conformance/counterfactual-audit-boundary-v0/vectors/V-AT-ROOT.json") as Record<
      string,
      unknown
    >
    const { model: cabModel, challenge: cabChallenge } = identityFromVector(cab)
    const unresolved = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge: cabChallenge,
      lane_a_model: cabModel,
      input: { value: cab.input },
    })
    expect(a.evaluation_state).toBe("evaluated")
    expect(unresolved.evaluation_state).toBe("execution_unresolved")
    if (a.evaluation_state !== "evaluated" || unresolved.evaluation_state !== "execution_unresolved") {
      throw new Error("unreachable")
    }
    expect(a.verdict).not.toBe(unresolved.verdict)
    expect(unresolved.verdict).toBeNull()
    expect(JSON.stringify(a)).not.toContain("source_validity")
    expect(JSON.stringify(unresolved)).not.toContain("source_validity")
    expect(a.expected_observation.schema).toBe(COUNTERFACTUAL_OBSERVATION_SCHEMA)
  })

  test("Lane B neighborhood SHA256 and frozen digests remain unchanged", () => {
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
