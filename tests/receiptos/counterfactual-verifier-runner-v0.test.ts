import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import * as RunnerModule from "../../src/receiptos/challenge/counterfactual-verifier-runner"
import {
  COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
  VERIFY_HANDOFF_ADAPTER_IDENTITY,
  CHRONICLE_ADMISSION_ADAPTER_IDENTITY,
  CHRONICLE_CONTINUITY_ADAPTER_IDENTITY,
  CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY,
  RunnerContractError,
  runAndNormalizeVerifierChallenge,
  runVerifierChallenge,
  normalizeSubjectReturnedResult,
  type VerifierChallengeRunRequestV0,
} from "../../src/receiptos/challenge/counterfactual-verifier-runner"
import {
  NormalizationContractError,
  normalizeChronicleAdmissionResult,
  normalizeCounterfactualAuditBoundaryExpected,
  normalizeVerifyHandoffReceiptRootResult,
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
  VERIFIER_CHALLENGE_MODEL_SCHEMA,
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

function loadHandoffEvidence(vectorPath: string): {
  vector: Record<string, unknown>
  baseline: HandoffEvidence
  challenged: HandoffEvidence
  model: VerifierChallengeVectorModelV0
  challenge: CounterfactualChallengeIdentityV0
} {
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
    baseline,
    challenged: challenged as unknown as HandoffEvidence,
    model,
    challenge,
  }
}

function handoffRequest(
  challenge: CounterfactualChallengeIdentityV0,
  evidence: HandoffEvidence,
  extras?: { expected?: unknown; lane_a_model?: VerifierChallengeVectorModelV0 },
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
    input: { evidence },
    ...extras,
  }
}

describe("counterfactual verifier runner v0", () => {
  test("production module exports no invoker-override hook or mutable registry", () => {
    const exported = Object.keys(RunnerModule)
    expect(exported.some((name) => /override|invoker|testOnly|TestOnly/i.test(name))).toBe(false)
    expect(RunnerModule).not.toHaveProperty("__laneDTestOnly_withInvokerOverrides")
    expect(RunnerModule).not.toHaveProperty("testInvokerOverrides")
    expect(RunnerModule).not.toHaveProperty("PRODUCTION_INVOKERS")
    expect(RunnerModule).not.toHaveProperty("captureCabSubjectInvocationThrow")
    expect(RunnerModule).not.toHaveProperty("isRecognizedCabContractRejection")
    expect(typeof RunnerModule.runVerifierChallenge).toBe("function")
  })

  test("verifyHandoff positive/control subject_returned", async () => {
    const { baseline, challenge, vector } = loadHandoffEvidence(
      "conformance/verifier-challenge-observed-not-validated-v0/vectors/V-OBSERVED-NOT-VALIDATED.json",
    )
    const before = structuredClone(baseline)
    const beforeChallenge = structuredClone(challenge)
    const result = await runVerifierChallenge(
      handoffRequest(challenge, baseline, { expected: vector.expected }),
    )
    expect(baseline).toEqual(before)
    expect(challenge).toEqual(beforeChallenge)
    expect(result.execution_state).toBe("subject_returned")
    if (result.execution_state !== "subject_returned") throw new Error("unreachable")
    expect(result.native_result).toEqual(
      (vector.expected as { baseline_verification: unknown }).baseline_verification,
    )
    expect(normalizeSubjectReturnedResult(result).observation_class).toBe("affirmative")
  })

  test("verifyHandoff missing input → subject_returned unverifiable native", async () => {
    const { challenged, challenge, vector } = loadHandoffEvidence(
      "conformance/verifier-challenge-missing-required-input-unverifiable-v0/vectors/V-MISSING-REQUIRED-INPUT.json",
    )
    const result = await runVerifierChallenge(handoffRequest(challenge, challenged))
    expect(result.execution_state).toBe("subject_returned")
    if (result.execution_state !== "subject_returned") throw new Error("unreachable")
    expect(result.native_result).toEqual(
      (vector.expected as { challenged_verification: unknown }).challenged_verification,
    )
    expect(normalizeSubjectReturnedResult(result).observation_class).toBe("unverifiable")
  })

  test("verifyHandoff integrity mismatch → subject_returned rejected native", async () => {
    const { challenged, challenge, vector } = loadHandoffEvidence(
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    )
    const result = await runVerifierChallenge(handoffRequest(challenge, challenged))
    expect(result.execution_state).toBe("subject_returned")
    if (result.execution_state !== "subject_returned") throw new Error("unreachable")
    expect(result.native_result).toEqual(
      (vector.expected as { challenged_verification: unknown }).challenged_verification,
    )
    expect(normalizeSubjectReturnedResult(result).observation_class).toBe("rejected")
  })

  test("Lane A observed_not_validated context remains beside affirmative runtime observation", async () => {
    const path = "conformance/verifier-challenge-observed-not-validated-v0/vectors/V-OBSERVED-NOT-VALIDATED.json"
    const { vector, challenged, challenge, model } = loadHandoffEvidence(path)
    const raw = readJson(path) as Record<string, unknown>
    const before = structuredClone(raw)
    expect(model.model_schema).toBe(VERIFIER_CHALLENGE_MODEL_SCHEMA)
    expect(model.challenge_id).toBe("observed_not_validated")
    expect((model.expected as { observation_cannot_establish_validity: boolean }).observation_cannot_establish_validity).toBe(true)

    const result = await runVerifierChallenge(
      handoffRequest(challenge, challenged, {
        expected: { fabricated: "different-expected" },
        lane_a_model: model,
      }),
    )
    expect(result.execution_state).toBe("subject_returned")
    if (result.execution_state !== "subject_returned") throw new Error("unreachable")
    expect(result.native_result.ok).toBe(true)
    expect(normalizeSubjectReturnedResult(result).observation_class).toBe("affirmative")
    expect(JSON.stringify(result)).not.toContain("observed_not_validated")
    expect(model.challenge_id).toBe("observed_not_validated")
    expect(raw).toEqual(before)
    expect(vector.challenge_id).toBe("observed_not_validated")
  })

  test("expected-only mutation yields identical execution result", async () => {
    const { challenged, challenge } = loadHandoffEvidence(
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    )
    const a = await runVerifierChallenge(handoffRequest(challenge, challenged, { expected: { outcome: "A" } }))
    const b = await runVerifierChallenge(
      handoffRequest(challenge, challenged, { expected: { outcome: "B", extra: 1 } }),
    )
    expect(a).toEqual(b)
  })

  test("Chronicle admission admitted / rejected / unverifiable", async () => {
    const vector = readJson(
      "conformance/verifier-challenge-chronicle-proof-root-mismatch-rejected-v0/vectors/V-CHRONICLE-PROOF-ROOT-MISMATCH.json",
    ) as Record<string, unknown>
    const { challenge } = identityFromVector(vector)
    const source = readJson((vector.source_fixture as { repository_path: string }).repository_path) as {
      input: {
        evidence: HandoffEvidence
        proof_object: PortableProofObjectV0
        options: Record<string, unknown>
      }
    }

    const admittedInput = structuredClone(source.input)
    const admitted = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "chronicle_admission",
      subject: {
        entrypoint: CHRONICLE_ADMISSION_ADAPTER_IDENTITY.entrypoint,
        module_path: CHRONICLE_ADMISSION_ADAPTER_IDENTITY.module_path,
        git_blob_oid: CHRONICLE_ADMISSION_ADAPTER_IDENTITY.git_blob_oid,
      },
      challenge,
      input: {
        evidence: admittedInput.evidence,
        proof_object: admittedInput.proof_object,
        options: admittedInput.options as never,
      },
      expected: vector.expected,
    })
    expect(admitted.execution_state).toBe("subject_returned")
    if (admitted.execution_state !== "subject_returned") throw new Error("unreachable")
    expect(normalizeSubjectReturnedResult(admitted).observation_class).toBe("affirmative")

    const rejectedInput = structuredClone(source.input)
    rejectedInput.proof_object.receipt_root = (vector.mutation as { to: string }).to
    const rejected = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "chronicle_admission",
      subject: {
        entrypoint: CHRONICLE_ADMISSION_ADAPTER_IDENTITY.entrypoint,
        module_path: CHRONICLE_ADMISSION_ADAPTER_IDENTITY.module_path,
        git_blob_oid: CHRONICLE_ADMISSION_ADAPTER_IDENTITY.git_blob_oid,
      },
      challenge,
      input: {
        evidence: rejectedInput.evidence,
        proof_object: rejectedInput.proof_object,
        options: rejectedInput.options as never,
      },
    })
    expect(rejected.execution_state).toBe("subject_returned")
    if (rejected.execution_state !== "subject_returned") throw new Error("unreachable")
    expect(normalizeSubjectReturnedResult(rejected).observation_class).toBe("rejected")

    const fixture = readJson(
      "tests/fixtures/receiptos-chronicle-admission-v0/vectors/02-evidence-root-missing.json",
    ) as {
      input: {
        evidence: HandoffEvidence
        proof_object: PortableProofObjectV0
        options: Record<string, unknown>
      }
    }
    const unverifiableIdentity: CounterfactualChallengeIdentityV0 = {
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
    const unverifiable = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "chronicle_admission",
      subject: unverifiableIdentity.subject!,
      challenge: unverifiableIdentity,
      input: {
        evidence: fixture.input.evidence,
        proof_object: fixture.input.proof_object,
        options: fixture.input.options as never,
      },
    })
    expect(unverifiable.execution_state).toBe("subject_returned")
    if (unverifiable.execution_state !== "subject_returned") throw new Error("unreachable")
    expect(normalizeSubjectReturnedResult(unverifiable).observation_class).toBe("unverifiable")
  })

  test("Chronicle continuity cases preserve native states", async () => {
    const cases: Array<{
      vectorPath: string
      expectedKey: "baseline_continuity" | "challenged_continuity"
      class: string
    }> = [
      {
        vectorPath:
          "conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0/vectors/V-CHRONICLE-PREDECESSOR-UNKNOWN.json",
        expectedKey: "baseline_continuity",
        class: "affirmative",
      },
      {
        vectorPath:
          "conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0/vectors/V-CHRONICLE-PREDECESSOR-UNKNOWN.json",
        expectedKey: "challenged_continuity",
        class: "unverifiable",
      },
      {
        vectorPath:
          "conformance/verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0/vectors/V-CHRONICLE-PREDECESSOR-REF-MISMATCH.json",
        expectedKey: "challenged_continuity",
        class: "rejected",
      },
      {
        vectorPath:
          "conformance/verifier-challenge-chronicle-sequence-gap-rejected-v0/vectors/V-CHRONICLE-SEQUENCE-GAP.json",
        expectedKey: "challenged_continuity",
        class: "rejected",
      },
    ]

    for (const entry of cases) {
      const vector = readJson(entry.vectorPath) as Record<string, unknown>
      const { challenge } = identityFromVector(vector)
      const pairKey = entry.expectedKey === "baseline_continuity" ? "baseline_pair" : "challenged_pair"
      const pair = vector[pairKey] as {
        current: ChronicleCheckpointV0
        predecessor: ChronicleCheckpointV0 | null
      }
      const result = await runVerifierChallenge({
        schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
        surface: "chronicle_continuity",
        subject: {
          entrypoint: CHRONICLE_CONTINUITY_ADAPTER_IDENTITY.entrypoint,
          module_path: CHRONICLE_CONTINUITY_ADAPTER_IDENTITY.module_path,
          git_blob_oid: CHRONICLE_CONTINUITY_ADAPTER_IDENTITY.git_blob_oid,
        },
        challenge,
        input: {
          current: pair.current,
          predecessor: pair.predecessor,
        },
      })
      expect(result.execution_state).toBe("subject_returned")
      if (result.execution_state !== "subject_returned") throw new Error("unreachable")
      expect(result.native_result).toEqual(
        (vector.expected as Record<string, unknown>)[entry.expectedKey],
      )
      expect(normalizeSubjectReturnedResult(result).observation_class).toBe(entry.class)
    }
  })

  test("Chronicle continuity malformed fixture case", async () => {
    const fixture = readJson("tests/fixtures/chronicle-checkpoint-continuity-v0.json") as {
      vectors: Array<{
        name: string
        current: ChronicleCheckpointV0
        predecessor: ChronicleCheckpointV0 | null
        expected: unknown
      }>
    }
    const malformed = fixture.vectors.find((v) => v.name === "current_malformed_non_integer_sequence")
    expect(malformed).toBeDefined()
    const challenge: CounterfactualChallengeIdentityV0 = {
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
      derivation: { kind: "substitution", value: { name: malformed!.name } },
    }
    const result = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "chronicle_continuity",
      subject: challenge.subject!,
      challenge,
      input: {
        current: malformed!.current,
        predecessor: malformed!.predecessor,
      },
    })
    expect(result.execution_state).toBe("subject_returned")
    if (result.execution_state !== "subject_returned") throw new Error("unreachable")
    expect(result.native_result).toEqual(malformed!.expected)
    expect(normalizeSubjectReturnedResult(result).observation_class).toBe("malformed")
  })

  test("checkpoint-local ok / root mismatch / noncanonical refs", async () => {
    const rootMismatch = readJson(
      "conformance/verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH.json",
    ) as Record<string, unknown>
    const entryRefs = readJson(
      "conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL.json",
    ) as Record<string, unknown>

    for (const [vector, checkpointKey, expectedKey, cls] of [
      [rootMismatch, "baseline_checkpoint", "baseline_verification", "affirmative"],
      [rootMismatch, "challenged_checkpoint", "challenged_verification", "rejected"],
      [entryRefs, "challenged_checkpoint", "challenged_verification", "rejected"],
    ] as const) {
      const { challenge } = identityFromVector(vector)
      const result = await runVerifierChallenge({
        schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
        surface: "chronicle_checkpoint_local",
        subject: {
          entrypoint: CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY.entrypoint,
          module_path: CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY.module_path,
          git_blob_oid: CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY.git_blob_oid,
        },
        challenge,
        input: {
          checkpoint: vector[checkpointKey] as ChronicleCheckpointV0,
        },
      })
      expect(result.execution_state).toBe("subject_returned")
      if (result.execution_state !== "subject_returned") throw new Error("unreachable")
      expect(result.native_result).toEqual(
        (vector.expected as Record<string, unknown>)[expectedKey],
      )
      expect(normalizeSubjectReturnedResult(result).observation_class).toBe(cls)
    }
  })

  test("CAB production audit_timestamp throw → subject_contract_rejected", async () => {
    const vector = readJson("conformance/counterfactual-audit-boundary-v0/vectors/V-AT-ROOT.json") as Record<
      string,
      unknown
    >
    const { challenge, model } = identityFromVector(vector)
    const beforeChallenge = structuredClone(challenge)
    const result = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge,
      lane_a_model: model,
      input: { value: vector.input },
      expected: vector.expected,
    })
    expect(challenge).toEqual(beforeChallenge)
    expect(result.execution_state).toBe("subject_contract_rejected")
    if (result.execution_state !== "subject_contract_rejected") throw new Error("unreachable")
    expect(result).not.toHaveProperty("native_result")
    expect(result).not.toHaveProperty("failure")
    expect(result.rejection).toEqual({
      contract: "counterfactual_audit_boundary.semantic_snapshot.v0",
      code: "reserved_audit_timestamp",
      path: '$semantic_artifact["audit_timestamp"]',
    })
    const serialized = JSON.stringify(result)
    expect(serialized).not.toMatch(/[A-Za-z]:\\/)
    expect(serialized).not.toMatch(/\/Users\//)
    expect(serialized).not.toContain("non-semantic audit metadata")
    expect(serialized).not.toContain("stack")
    expect(serialized).not.toContain("\n")
    expect(() => normalizeSubjectReturnedResult(result)).toThrow(RunnerContractError)
    expect(() => normalizeChronicleAdmissionResult(result as never)).toThrow(NormalizationContractError)
    expect(() => normalizeVerifyHandoffReceiptRootResult(result as never)).toThrow(NormalizationContractError)
    const expectedObs = normalizeCounterfactualAuditBoundaryExpected(vector.expected)
    expect(expectedObs.observation_class).toBe("malformed")
    const bundled = await runAndNormalizeVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge,
      input: { value: vector.input },
    })
    expect(bundled.execution.execution_state).toBe("subject_contract_rejected")
    expect(bundled.observation).toBeNull()
  })

  test("CAB accepted snapshot and manifest hash subject_returned", async () => {
    const isolate = readJson("conformance/counterfactual-audit-boundary-v0/vectors/V-AT-ISOLATE.json") as {
      runtime_construction: { initial: unknown }
      expected: { canonical_snapshot_json: string }
    } & Record<string, unknown>
    const { challenge: isolateChallenge } = identityFromVector(isolate)
    const snapshot = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge: isolateChallenge,
      input: { value: isolate.runtime_construction.initial },
    })
    expect(snapshot.execution_state).toBe("subject_returned")
    if (snapshot.execution_state !== "subject_returned") throw new Error("unreachable")
    if (snapshot.native_result.operation !== "semantic_snapshot") throw new Error("unreachable")
    expect(JSON.stringify(snapshot.native_result.snapshot)).toBe(isolate.expected.canonical_snapshot_json)

    const manifest = readJson("conformance/counterfactual-audit-boundary-v0/vectors/V-MAN-UINT8-EXACT.json") as {
      inputs: Array<{ bytes: number[] }>
      expected: { sha256_hex: string }
    } & Record<string, unknown>
    const { challenge: manifestChallenge } = identityFromVector(manifest)
    const hash = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "manifest_file_sha256",
      challenge: manifestChallenge,
      input: { bytes: Uint8Array.from(manifest.inputs[0]!.bytes) },
    })
    expect(hash.execution_state).toBe("subject_returned")
    if (hash.execution_state !== "subject_returned") throw new Error("unreachable")
    expect(hash.native_result).toEqual({
      operation: "manifest_file_sha256",
      sha256_hex: manifest.expected.sha256_hex,
    })
  })

  test("runner contract: surface/subject/identity/CAB mismatches", async () => {
    const { challenge, baseline, model } = loadHandoffEvidence(
      "conformance/verifier-challenge-observed-not-validated-v0/vectors/V-OBSERVED-NOT-VALIDATED.json",
    )

    await expect(
      runVerifierChallenge({
        ...handoffRequest(challenge, baseline),
        surface: "not_a_real_surface" as never,
      }),
    ).rejects.toBeInstanceOf(RunnerContractError)

    await expect(
      runVerifierChallenge({
        ...handoffRequest(challenge, baseline),
        surface: "chronicle_admission" as never,
      }),
    ).rejects.toBeInstanceOf(RunnerContractError)

    await expect(
      runVerifierChallenge({
        ...handoffRequest(challenge, baseline),
        subject: {
          entrypoint: "wrongEntrypoint",
          module_path: VERIFY_HANDOFF_ADAPTER_IDENTITY.module_path,
          git_blob_oid: VERIFY_HANDOFF_ADAPTER_IDENTITY.git_blob_oid,
        },
      }),
    ).rejects.toBeInstanceOf(RunnerContractError)

    await expect(
      runVerifierChallenge({
        ...handoffRequest(challenge, baseline),
        subject: {
          entrypoint: VERIFY_HANDOFF_ADAPTER_IDENTITY.entrypoint,
          module_path: "src/wrong/path.ts",
          git_blob_oid: VERIFY_HANDOFF_ADAPTER_IDENTITY.git_blob_oid,
        },
      }),
    ).rejects.toBeInstanceOf(RunnerContractError)

    await expect(
      runVerifierChallenge({
        ...handoffRequest(challenge, baseline),
        subject: {
          entrypoint: VERIFY_HANDOFF_ADAPTER_IDENTITY.entrypoint,
          module_path: VERIFY_HANDOFF_ADAPTER_IDENTITY.module_path,
          git_blob_oid: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        },
      }),
    ).rejects.toBeInstanceOf(RunnerContractError)

    const mismatchedChallenge = structuredClone(challenge)
    mismatchedChallenge.subject = {
      entrypoint: VERIFY_HANDOFF_ADAPTER_IDENTITY.entrypoint,
      module_path: VERIFY_HANDOFF_ADAPTER_IDENTITY.module_path,
      git_blob_oid: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    }
    await expect(
      runVerifierChallenge(handoffRequest(mismatchedChallenge, baseline)),
    ).rejects.toBeInstanceOf(RunnerContractError)

    const wrongModel = structuredClone(model)
    wrongModel.vector_id = "different-vector"
    await expect(
      runVerifierChallenge(handoffRequest(challenge, baseline, { lane_a_model: wrongModel })),
    ).rejects.toBeInstanceOf(RunnerContractError)

    const cabVector = readJson("conformance/counterfactual-audit-boundary-v0/vectors/V-AT-ROOT.json") as Record<
      string,
      unknown
    >
    const { challenge: cabChallenge } = identityFromVector(cabVector)
    await expect(
      runVerifierChallenge({
        schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
        surface: "counterfactual_audit_boundary",
        subject: {
          entrypoint: "fake",
          module_path: "x",
          git_blob_oid: "y",
        } as never,
        operation: "semantic_snapshot",
        challenge: cabChallenge,
        input: { value: cabVector.input },
      }),
    ).rejects.toBeInstanceOf(RunnerContractError)

    const badDerivation = structuredClone(cabChallenge)
    badDerivation.derivation = { kind: "path_mutation", operation: "set", path: ["x"], from: 1, to: 2 }
    await expect(
      runVerifierChallenge({
        schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
        surface: "counterfactual_audit_boundary",
        subject: null,
        operation: "semantic_snapshot",
        challenge: badDerivation,
        input: { value: cabVector.input },
      }),
    ).rejects.toBeInstanceOf(RunnerContractError)

    const opMismatch = structuredClone(cabChallenge)
    await expect(
      runVerifierChallenge({
        schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
        surface: "counterfactual_audit_boundary",
        subject: null,
        operation: "manifest_file_sha256",
        challenge: opMismatch,
        input: { bytes: "x" },
      }),
    ).rejects.toBeInstanceOf(RunnerContractError)

    try {
      await runVerifierChallenge({
        ...handoffRequest(challenge, baseline),
        subject: {
          entrypoint: "wrongEntrypoint",
          module_path: VERIFY_HANDOFF_ADAPTER_IDENTITY.module_path,
          git_blob_oid: VERIFY_HANDOFF_ADAPTER_IDENTITY.git_blob_oid,
        },
      })
      throw new Error("expected contract error")
    } catch (error) {
      expect(error).toBeInstanceOf(RunnerContractError)
      expect(error).not.toHaveProperty("execution_state")
    }
  })

  test("determinism for identical valid requests", async () => {
    const { challenged, challenge } = loadHandoffEvidence(
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    )
    const a = await runVerifierChallenge(handoffRequest(challenge, challenged))
    const b = await runVerifierChallenge(handoffRequest(challenge, challenged))
    expect(a).toEqual(b)
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
