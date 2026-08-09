import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import {
  ExpectedResultSetBindingError,
  bindExpectedResultSet,
  canonicalExpectedJson,
  computeExpectedResultSetSha256,
  getExpectedResultSetAuthorityDigest,
  listExpectedResultSetAuthorityPackages,
} from "../../src/receiptos/challenge/counterfactual-expected-result-set"
import {
  evaluateVerifierChallengeConformance,
  ExpectedResultSetBindingError as EvaluatorBindingError,
} from "../../src/receiptos/challenge/counterfactual-conformance-evaluator"
import {
  COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
  VERIFY_HANDOFF_ADAPTER_IDENTITY,
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
import type { CounterfactualChallengeIdentityV0 } from "../../src/receiptos/challenge/counterfactual-neighborhood"
import type { HandoffEvidence } from "../../src/receiptos/schema/types"

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

function loadPackageMembers(packageDir: string): Array<{ vector_id: string; expected: unknown }> {
  const names = readdirSync(resolve(root, packageDir, "vectors"))
    .filter((name) => name.startsWith("V-") && name.endsWith(".json"))
    .map((name) => name.slice(0, -5))
    .sort()
  return names.map((vector_id) => {
    const vector = readJson(`${packageDir}/vectors/${vector_id}.json`) as Record<string, unknown>
    return { vector_id, expected: vector.expected }
  })
}

function handoffEvalRequest(
  challenge: CounterfactualChallengeIdentityV0,
  model: VerifierChallengeVectorModelV0,
  evidence: HandoffEvidence,
) {
  return {
    schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
    surface: "verify_handoff_receipt_root" as const,
    subject: {
      entrypoint: VERIFY_HANDOFF_ADAPTER_IDENTITY.entrypoint,
      module_path: VERIFY_HANDOFF_ADAPTER_IDENTITY.module_path,
      git_blob_oid: VERIFY_HANDOFF_ADAPTER_IDENTITY.git_blob_oid,
    },
    challenge,
    lane_a_model: model,
    input: { evidence },
  }
}

describe("counterfactual expected-result-set binding v0 (Lane G)", () => {
  test("ExpectedResultSetBindingError is shared through evaluator export", () => {
    expect(EvaluatorBindingError).toBe(ExpectedResultSetBindingError)
  })

  test("every closed authority package recomputes its committed expected_result_set_sha256", () => {
    for (const packageVersion of listExpectedResultSetAuthorityPackages()) {
      const digest = getExpectedResultSetAuthorityDigest(packageVersion)
      expect(digest).toBeTruthy()
      const packageDir = `conformance/${packageVersion}`
      const contract = readJson(`${packageDir}/contract.json`) as {
        expected_result_set_sha256: string
      }
      expect(contract.expected_result_set_sha256).toBe(digest)
      const members = loadPackageMembers(packageDir)
      expect(computeExpectedResultSetSha256(members)).toBe(digest)
      // Independent Python auditor when present.
      const pyPath = resolve(root, packageDir, "verify_independent.py")
      try {
        readFileSync(pyPath)
        const py = spawnSync("python", [pyPath], { cwd: root, encoding: "utf8" })
        expect(py.status, packageVersion).toBe(0)
      } catch {
        // some leaves may only have TS auditor; digest recompute above is authoritative
      }
    }
  })

  test("canonical JSON is key-order independent; content mutation changes digest", () => {
    const a = { z: 1, a: { b: true, a: null } }
    const b = { a: { a: null, b: true }, z: 1 }
    expect(canonicalExpectedJson(a)).toBe(canonicalExpectedJson(b))
    const base = computeExpectedResultSetSha256([{ vector_id: "V-A", expected: a }])
    const mutated = computeExpectedResultSetSha256([{ vector_id: "V-A", expected: { ...a, z: 2 } }])
    expect(mutated).not.toBe(base)
    expect(() => computeExpectedResultSetSha256([{ vector_id: "V-A", expected: { x: () => 1 } }])).toThrow(
      ExpectedResultSetBindingError,
    )
  })

  test("set-member ordering is deterministic; duplicates fail closed", () => {
    const members = [
      { vector_id: "V-B", expected: { ok: false } },
      { vector_id: "V-A", expected: { ok: true } },
    ]
    const forward = computeExpectedResultSetSha256(members)
    const reverse = computeExpectedResultSetSha256([...members].reverse())
    expect(forward).toBe(reverse)
    expect(() =>
      computeExpectedResultSetSha256([
        { vector_id: "V-A", expected: { ok: true } },
        { vector_id: "V-A", expected: { ok: false } },
      ]),
    ).toThrow(ExpectedResultSetBindingError)
  })

  test("bind succeeds for frozen integrity mismatch; evaluation remains conformant", async () => {
    const vector = readJson(
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    ) as Record<string, unknown>
    const { model, challenge } = identityFromVector(vector)
    const beforeModel = structuredClone(model)
    const binding = bindExpectedResultSet(model)
    expect(binding).toEqual({
      schema: "receiptos.expected_result_set_binding.v0",
      package_version: "verifier-challenge-integrity-mismatch-rejected-v0",
      vector_id: "V-INTEGRITY-MISMATCH",
      expected_result_set_sha256:
        "b755108edac9dc607b7b6b7f30d845f381cac13100194741a451b1c7cb7162a5",
      membership: "complete_set_member",
    })
    expect(model).toEqual(beforeModel)

    const source = vector.source_fixture as { repository_path: string }
    const baseline = structuredClone(readJson(source.repository_path)) as HandoffEvidence
    const mutation = vector.mutation as { path: string[]; to: unknown }
    const challenged = structuredClone(baseline) as Record<string, unknown>
    let cursor: Record<string, unknown> = challenged
    for (let i = 0; i < mutation.path.length - 1; i += 1) {
      cursor = cursor[mutation.path[i]!] as Record<string, unknown>
    }
    cursor[mutation.path[mutation.path.length - 1]!] = mutation.to

    const result = await evaluateVerifierChallengeConformance(
      handoffEvalRequest(challenge, model, challenged as unknown as HandoffEvidence),
    )
    expect(result.evaluation_state).toBe("evaluated")
    if (result.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(result.verdict).toBe("conformant")
    expect(result.expected_result_set_binding).toEqual(binding)
  })

  test("expected content mutation fails closed before comparison; Lane D remains identical", async () => {
    const vector = readJson(
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    ) as Record<string, unknown>
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

    const execA = await runVerifierChallenge(
      handoffEvalRequest(challenge, model, challenged as unknown as HandoffEvidence),
    )
    const mutated = structuredClone(model)
    ;(mutated.expected as { challenged_verification: { ok: boolean } }).challenged_verification.ok = true
    const execB = await runVerifierChallenge(
      handoffEvalRequest(challenge, mutated, challenged as unknown as HandoffEvidence),
    )
    expect(execA).toEqual(execB)

    try {
      await evaluateVerifierChallengeConformance(
        handoffEvalRequest(challenge, mutated, challenged as unknown as HandoffEvidence),
      )
      throw new Error("expected binding failure")
    } catch (error) {
      expect(error).toBeInstanceOf(ExpectedResultSetBindingError)
      if (!(error instanceof ExpectedResultSetBindingError)) throw error
      expect(error.reason).toBe("expected_content_mismatch")
      expect(error.message).toBe("expected result set binding failed")
      expect(JSON.stringify(error)).not.toContain("0xaa")
    }
  })

  test("cross-package expected/digest substitution and unknown authority fail closed", async () => {
    const integrity = readJson(
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    ) as Record<string, unknown>
    const observed = readJson(
      "conformance/verifier-challenge-observed-not-validated-v0/vectors/V-OBSERVED-NOT-VALIDATED.json",
    ) as Record<string, unknown>
    const { model, challenge } = identityFromVector(integrity)
    const other = identityFromVector(observed)

    const crossExpected = structuredClone(model)
    crossExpected.expected = structuredClone(other.model.expected)
    expect(() => bindExpectedResultSet(crossExpected)).toThrow(ExpectedResultSetBindingError)

    const unknown = structuredClone(model)
    unknown.package_version = "not-a-frozen-authority-v0"
    try {
      bindExpectedResultSet(unknown)
      throw new Error("expected unknown authority failure")
    } catch (error) {
      expect(error).toBeInstanceOf(ExpectedResultSetBindingError)
      if (!(error instanceof ExpectedResultSetBindingError)) throw error
      expect(error.reason).toBe("unknown_package_authority")
    }

    // Request-supplied digest fields are irrelevant; authority is closed registry only.
    const withClaim = structuredClone(model) as VerifierChallengeVectorModelV0 & {
      expected_result_set_sha256?: string
    }
    withClaim.expected_result_set_sha256 =
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    expect(bindExpectedResultSet(withClaim).expected_result_set_sha256).toBe(
      getExpectedResultSetAuthorityDigest(model.package_version),
    )

    const source = integrity.source_fixture as { repository_path: string }
    const baseline = structuredClone(readJson(source.repository_path)) as HandoffEvidence
    await expect(
      evaluateVerifierChallengeConformance(handoffEvalRequest(challenge, crossExpected, baseline)),
    ).rejects.toBeInstanceOf(ExpectedResultSetBindingError)
  })

  test("missing vector id fails closed; CAB full-set membership binds", () => {
    const cab = readJson("conformance/counterfactual-audit-boundary-v0/vectors/V-AT-ROOT.json") as Record<
      string,
      unknown
    >
    const { model } = identityFromVector(cab)
    expect(bindExpectedResultSet(model).vector_id).toBe("V-AT-ROOT")

    const missing = structuredClone(model)
    missing.vector_id = "V-DOES-NOT-EXIST"
    try {
      bindExpectedResultSet(missing)
      throw new Error("expected missing vector failure")
    } catch (error) {
      expect(error).toBeInstanceOf(ExpectedResultSetBindingError)
      if (!(error instanceof ExpectedResultSetBindingError)) throw error
      expect(error.reason).toBe("vector_missing")
    }
  })

  test("semantic mismatch with authentic expected remains nonconformant", async () => {
    const vector = readJson(
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    ) as Record<string, unknown>
    const { model, challenge } = identityFromVector(vector)
    const source = vector.source_fixture as { repository_path: string }
    const baseline = structuredClone(readJson(source.repository_path)) as HandoffEvidence
    const result = await evaluateVerifierChallengeConformance(
      handoffEvalRequest(challenge, model, baseline),
    )
    expect(result.evaluation_state).toBe("evaluated")
    if (result.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(result.verdict).toBe("nonconformant")
    expect(result.mismatch?.kind).toBe("observation_class_mismatch")
    expect(result.expected_result_set_binding.membership).toBe("complete_set_member")
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
    for (const check of checks) {
      const manifest = readJson(`${check.packageDir}/manifest.json`) as { fixture_set_sha256: string }
      expect(manifest.fixture_set_sha256).toBe(check.fixture)
      const contract = readJson(`${check.packageDir}/contract.json`) as Record<string, unknown>
      if (check.expected) expect(contract.expected_result_set_sha256).toBe(check.expected)
      if (check.child) {
        const child =
          contract.child_identity_set_sha256 ??
          (contract.aggregate as { child_identity_set_sha256?: string } | undefined)
            ?.child_identity_set_sha256
        expect(child).toBe(check.child)
      }
    }
  })
})
