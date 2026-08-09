import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import {
  CAB_MANIFEST_HASH_DIFF_EVALUATION_REQUEST_SCHEMA,
  CabManifestHashDiffContractError,
  evaluateCabManifestHashDiffConformance,
  type CabManifestHashDiffEvaluationRequestV0,
} from "../../src/receiptos/challenge/counterfactual-cab-manifest-hash-diff-evaluator"
import {
  ConformanceEvaluatorContractError,
  evaluateCabManifestHashDiffConformance as exportedDiff,
  evaluateVerifierChallengeConformance,
  ExpectedResultSetBindingError,
} from "../../src/receiptos/challenge/counterfactual-conformance-evaluator"
import {
  COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
  runVerifierChallenge,
} from "../../src/receiptos/challenge/counterfactual-verifier-runner"
import {
  computeFrozenCounterfactualNeighborhoodSha256,
  projectCounterfactualChallengeIdentity,
  type FrozenCounterfactualNeighborhoodV0,
} from "../../src/receiptos/challenge/counterfactual-neighborhood"
import {
  projectVerifierChallengeVector,
  type VerifierChallengeVectorModelV0,
} from "../../src/receiptos/challenge/verifier-challenge-model"
import { canonicalIdentityJson } from "../../src/receiptos/challenge/counterfactual-neighborhood"

const root = resolve(import.meta.dir, "../..")
const LANE_B_SHA256 = "37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d"
const VECTOR_PATH = "conformance/counterfactual-audit-boundary-v0/vectors/V-MAN-HASH-DIFF.json"

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"))
}

function loadManHashDiff() {
  const vector = readJson(VECTOR_PATH) as {
    inputs: Array<{ encoding: string; value: string }>
    expected: { outcome: string }
  } & Record<string, unknown>
  const model = projectVerifierChallengeVector(vector)
  const challenge = projectCounterfactualChallengeIdentity(model)
  const firstBytes = vector.inputs[0]!.value
  const secondBytes = vector.inputs[1]!.value
  return { vector, model, challenge, firstBytes, secondBytes }
}

function diffRequest(
  model: VerifierChallengeVectorModelV0,
  challenge: ReturnType<typeof projectCounterfactualChallengeIdentity>,
  first: string | Uint8Array,
  second: string | Uint8Array,
  extras?: Partial<CabManifestHashDiffEvaluationRequestV0>,
): CabManifestHashDiffEvaluationRequestV0 {
  return {
    schema: CAB_MANIFEST_HASH_DIFF_EVALUATION_REQUEST_SCHEMA,
    surface: "counterfactual_audit_boundary",
    evaluation_operation: "manifest_hash_differs",
    challenge,
    lane_a_model: model,
    operands: {
      first: { bytes: first },
      second: { bytes: second },
    },
    ...extras,
  }
}

describe("counterfactual CAB manifest hash diff evaluation v0", () => {
  test("evaluator re-exports composite API", () => {
    expect(exportedDiff).toBe(evaluateCabManifestHashDiffConformance)
  })

  test("pre-repair single-operand path still unsupported; composite evaluates frozen V-MAN-HASH-DIFF conformant", async () => {
    const { vector, model, challenge, firstBytes, secondBytes } = loadManHashDiff()

    await expect(
      evaluateVerifierChallengeConformance({
        schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
        surface: "counterfactual_audit_boundary",
        subject: null,
        operation: "manifest_file_sha256",
        challenge,
        lane_a_model: model,
        input: { bytes: firstBytes },
      }),
    ).rejects.toMatchObject({
      name: "ConformanceEvaluatorContractError",
      message: "unsupported CAB comparison: bound request lacks multiple runtime hash operands",
    })
    expect(ConformanceEvaluatorContractError).toBeTruthy()

    const beforeModel = structuredClone(model)
    const beforeChallenge = structuredClone(challenge)
    const beforeFirst = firstBytes
    const beforeSecond = secondBytes

    const result = await evaluateCabManifestHashDiffConformance(
      diffRequest(model, challenge, firstBytes, secondBytes),
    )
    expect(result.evaluation_state).toBe("evaluated")
    if (result.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(result.verdict).toBe("conformant")
    expect(result.mismatch).toBeNull()
    expect(result.expected_result_set_binding).toEqual({
      schema: "receiptos.expected_result_set_binding.v0",
      package_version: "counterfactual-audit-boundary-v0",
      vector_id: "V-MAN-HASH-DIFF",
      expected_result_set_sha256:
        "db664c5e8da2f0fb6d1d94a036eab572ae2941ffeb5193624365d4bdbaeec24a",
      membership: "complete_set_member",
    })
    expect(result.expected_observation.native_status).toBe("manifest_hash_differs")
    expect(result.actual_observation?.native_detail.hashes_equal).toBe(false)
    expect(result.actual_observation?.native_detail.operand_count).toBe(2)
    expect(result.subject_contract_rejection).toBeNull()
    expect(model).toEqual(beforeModel)
    expect(challenge).toEqual(beforeChallenge)
    expect(firstBytes).toBe(beforeFirst)
    expect(secondBytes).toBe(beforeSecond)
    expect(vector.inputs).toHaveLength(2)
  })

  test("identical operands → evaluated nonconformant with closed mismatch kind", async () => {
    const { model, challenge, firstBytes } = loadManHashDiff()
    const result = await evaluateCabManifestHashDiffConformance(
      diffRequest(model, challenge, firstBytes, firstBytes),
    )
    expect(result.evaluation_state).toBe("evaluated")
    if (result.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(result.verdict).toBe("nonconformant")
    expect(result.mismatch).toEqual({ kind: "cab_manifest_hash_difference_mismatch" })
    expect(result.actual_observation?.native_detail.hashes_equal).toBe(true)
  })

  test("operand order is symmetric for manifest_hash_differs", async () => {
    const { model, challenge, firstBytes, secondBytes } = loadManHashDiff()
    const forward = await evaluateCabManifestHashDiffConformance(
      diffRequest(model, challenge, firstBytes, secondBytes),
    )
    const reverse = await evaluateCabManifestHashDiffConformance(
      diffRequest(model, challenge, secondBytes, firstBytes),
    )
    expect(forward.evaluation_state).toBe("evaluated")
    expect(reverse.evaluation_state).toBe("evaluated")
    if (forward.evaluation_state !== "evaluated" || reverse.evaluation_state !== "evaluated") {
      throw new Error("unreachable")
    }
    expect(forward.verdict).toBe("conformant")
    expect(reverse.verdict).toBe("conformant")
    // Assertion is symmetric; operand labels swap hash positions but verdict is identical.
    expect(forward.actual_observation?.native_detail.hashes_equal).toBe(false)
    expect(reverse.actual_observation?.native_detail.hashes_equal).toBe(false)
    expect(forward.actual_observation?.native_detail.first_sha256_hex).toBe(
      reverse.actual_observation?.native_detail.second_sha256_hex,
    )
    expect(forward.actual_observation?.native_detail.second_sha256_hex).toBe(
      reverse.actual_observation?.native_detail.first_sha256_hex,
    )
  })

  test("missing / extra operands fail before execution", async () => {
    const { model, challenge, firstBytes, secondBytes } = loadManHashDiff()
    const base = diffRequest(model, challenge, firstBytes, secondBytes)

    try {
      await evaluateCabManifestHashDiffConformance({
        ...base,
        operands: { first: { bytes: firstBytes } } as never,
      })
      throw new Error("expected missing second")
    } catch (error) {
      expect(error).toBeInstanceOf(CabManifestHashDiffContractError)
      expect((error as CabManifestHashDiffContractError).reason).toBe("missing_operand")
    }

    try {
      await evaluateCabManifestHashDiffConformance({
        ...base,
        operands: { second: { bytes: secondBytes } } as never,
      })
      throw new Error("expected missing first")
    } catch (error) {
      expect(error).toBeInstanceOf(CabManifestHashDiffContractError)
      expect((error as CabManifestHashDiffContractError).reason).toBe("missing_operand")
    }

    try {
      await evaluateCabManifestHashDiffConformance({
        ...base,
        operands: {
          first: { bytes: firstBytes },
          second: { bytes: secondBytes },
          third: { bytes: firstBytes },
        } as never,
      })
      throw new Error("expected extra operand")
    } catch (error) {
      expect(error).toBeInstanceOf(CabManifestHashDiffContractError)
      expect((error as CabManifestHashDiffContractError).reason).toBe("extra_operand")
    }
  })

  test("invalid operand type fails closed; materialization failure → unresolved without leak", async () => {
    const { model, challenge, firstBytes, secondBytes } = loadManHashDiff()
    const base = diffRequest(model, challenge, firstBytes, secondBytes)

    try {
      await evaluateCabManifestHashDiffConformance({
        ...base,
        operands: {
          first: { bytes: 123 as never },
          second: { bytes: secondBytes },
        },
      })
      throw new Error("expected invalid bytes")
    } catch (error) {
      expect(error).toBeInstanceOf(CabManifestHashDiffContractError)
      expect((error as CabManifestHashDiffContractError).reason).toBe("invalid_operand_bytes")
      expect(JSON.stringify(error)).not.toContain("\n")
    }

    let firstReads = 0
    let secondReads = 0
    const poisonedFirst = {
      get bytes() {
        firstReads += 1
        if (firstReads === 1) return firstBytes
        throw new Error("clone-stage diagnostic leak")
      },
    }
    const trackedSecond = {
      get bytes() {
        secondReads += 1
        return secondBytes
      },
    }
    const unresolved = await evaluateCabManifestHashDiffConformance({
      ...base,
      operands: {
        first: poisonedFirst,
        second: trackedSecond,
      },
    })
    expect(unresolved.evaluation_state).toBe("execution_unresolved")
    if (unresolved.evaluation_state !== "execution_unresolved") throw new Error("unreachable")
    expect(unresolved.verdict).toBeNull()
    expect(unresolved.execution_failure.failure_stage).toBe("input_materialization")
    expect(unresolved.execution_failure.safe_message).toBe("input materialization failed")
    expect(JSON.stringify(unresolved)).not.toContain("clone-stage diagnostic leak")
    expect(JSON.stringify(unresolved)).not.toContain("\n")
    expect(firstReads).toBe(2)
    expect(secondReads).toBe(1)
  })

  test("expected mutation / cross-package / claimed digest / identity mismatches fail before child execution", async () => {
    const { model, challenge, firstBytes, secondBytes } = loadManHashDiff()
    let reads = 0
    const tracked = (value: string) => ({
      get bytes() {
        reads += 1
        return value
      },
    })

    const mutated = structuredClone(model)
    ;(mutated.expected as { outcome: string }).outcome = "manifest_hash_equals"
    reads = 0
    try {
      await evaluateCabManifestHashDiffConformance({
        schema: CAB_MANIFEST_HASH_DIFF_EVALUATION_REQUEST_SCHEMA,
        surface: "counterfactual_audit_boundary",
        evaluation_operation: "manifest_hash_differs",
        challenge,
        lane_a_model: mutated,
        operands: { first: tracked(firstBytes), second: tracked(secondBytes) },
      })
      throw new Error("expected binding failure")
    } catch (error) {
      expect(error).toBeInstanceOf(ExpectedResultSetBindingError)
      expect((error as ExpectedResultSetBindingError).reason).toBe("expected_content_mismatch")
    }
    expect(reads).toBe(2)

    const cross = structuredClone(model)
    cross.package_version = "verifier-challenge-integrity-mismatch-rejected-v0"
    const crossChallenge = projectCounterfactualChallengeIdentity(cross)
    await expect(
      evaluateCabManifestHashDiffConformance(diffRequest(cross, crossChallenge, firstBytes, secondBytes)),
    ).rejects.toBeInstanceOf(ExpectedResultSetBindingError)

    const withClaim = structuredClone(model) as VerifierChallengeVectorModelV0 & {
      expected_result_set_sha256?: string
    }
    withClaim.expected_result_set_sha256 =
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    const claimed = await evaluateCabManifestHashDiffConformance(
      diffRequest(withClaim, challenge, firstBytes, secondBytes),
    )
    expect(claimed.evaluation_state).toBe("evaluated")
    if (claimed.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(claimed.expected_result_set_binding.expected_result_set_sha256).toBe(
      "db664c5e8da2f0fb6d1d94a036eab572ae2941ffeb5193624365d4bdbaeec24a",
    )

    const wrongVector = structuredClone(model)
    wrongVector.vector_id = "V-AT-ROOT"
    await expect(
      evaluateCabManifestHashDiffConformance(
        diffRequest(wrongVector, projectCounterfactualChallengeIdentity(wrongVector), firstBytes, secondBytes),
      ),
    ).rejects.toBeInstanceOf(ExpectedResultSetBindingError)

    const wrongChallenge = structuredClone(challenge)
    wrongChallenge.derivation = { kind: "audit_boundary_operation", operation: "semantic_snapshot" }
    try {
      await evaluateCabManifestHashDiffConformance(
        diffRequest(model, wrongChallenge, firstBytes, secondBytes),
      )
      throw new Error("expected challenge mismatch")
    } catch (error) {
      expect(error).toBeInstanceOf(CabManifestHashDiffContractError)
      expect((error as CabManifestHashDiffContractError).reason).toBe("challenge_mismatch")
    }

    try {
      await evaluateCabManifestHashDiffConformance({
        ...diffRequest(model, challenge, firstBytes, secondBytes),
        evaluation_operation: "manifest_hash_equals" as never,
      })
      throw new Error("expected unsupported evaluation operation")
    } catch (error) {
      expect(error).toBeInstanceOf(CabManifestHashDiffContractError)
      expect((error as CabManifestHashDiffContractError).reason).toBe("unsupported_evaluation_operation")
    }

    try {
      await evaluateCabManifestHashDiffConformance({
        ...diffRequest(model, challenge, firstBytes, secondBytes),
        schema: "receiptos.counterfactual_verifier_runner.v0" as never,
      })
      throw new Error("expected unsupported schema")
    } catch (error) {
      expect(error).toBeInstanceOf(CabManifestHashDiffContractError)
      expect((error as CabManifestHashDiffContractError).reason).toBe("unsupported_schema")
    }
  })

  test("repeated identical evaluation is byte-identical; child runs use Lane D production path", async () => {
    const { model, challenge, firstBytes, secondBytes } = loadManHashDiff()
    const request = diffRequest(model, challenge, firstBytes, secondBytes)
    const a = await evaluateCabManifestHashDiffConformance(request)
    const b = await evaluateCabManifestHashDiffConformance(request)
    expect(canonicalIdentityJson(a)).toBe(canonicalIdentityJson(b))

    const child = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "manifest_file_sha256",
      challenge,
      lane_a_model: model,
      input: { bytes: firstBytes },
    })
    expect(child.execution_state).toBe("subject_returned")
    if (child.execution_state !== "subject_returned") throw new Error("unreachable")
    expect(child.native_result.operation).toBe("manifest_file_sha256")
    if (a.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(a.actual_observation?.native_detail.first_sha256_hex).toBe(
      (child.native_result as { sha256_hex: string }).sha256_hex,
    )
  })

  test("Lane B SHA256 and frozen package digests remain unchanged", () => {
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

    const cab = readJson("conformance/counterfactual-audit-boundary-v0/contract.json") as {
      expected_result_set_sha256: string
    }
    expect(cab.expected_result_set_sha256).toBe(
      "db664c5e8da2f0fb6d1d94a036eab572ae2941ffeb5193624365d4bdbaeec24a",
    )
    const manifest = readJson("conformance/counterfactual-audit-boundary-v0/manifest.json") as {
      fixture_set_sha256: string
    }
    expect(manifest.fixture_set_sha256).toBe(
      "7503d5cac003a23489f194c5521ef90b01ac0b2ce345a2cec57ad12ffeb274f8",
    )
  })
})
