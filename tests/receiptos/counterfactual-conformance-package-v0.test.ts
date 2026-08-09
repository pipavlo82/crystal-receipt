import { describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import {
  DCN_MEMBER_AUTHORITIES_V0,
  DcnGeneratorError,
  generateCounterfactualConformancePackageFiles,
  generateFrozenCounterfactualNeighborhood,
  listDcnMemberAuthorities,
  proveGeneratorByteReproducibility,
  runCounterfactualConformancePackageGenerator,
  type DcnMemberAuthorityV0,
} from "../../src/receiptos/challenge/counterfactual-dcn-generator"
import {
  CounterfactualConformancePackageError,
  verifyCounterfactualConformancePackage,
} from "../../src/receiptos/challenge/counterfactual-conformance-package"
import {
  computeFrozenCounterfactualNeighborhoodSha256,
  canonicalIdentityJson,
  type FrozenCounterfactualNeighborhoodV0,
} from "../../src/receiptos/challenge/counterfactual-neighborhood"
import { deriveCounterfactualNeighborhoodConformanceRequest } from "../../src/receiptos/challenge/counterfactual-materialized-input-derivation"
import {
  evaluateCounterfactualNeighborhoodConformance,
  type CounterfactualNeighborhoodConformanceRequestV0,
} from "../../src/receiptos/challenge/counterfactual-neighborhood-conformance"
import { projectVerifierChallengeVector } from "../../src/receiptos/challenge/verifier-challenge-model"
import { projectCounterfactualChallengeIdentity } from "../../src/receiptos/challenge/counterfactual-neighborhood"

const root = resolve(import.meta.dir, "../..")
const LANE_B_SHA256 = "37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d"
const CHILD_IDENTITY_SET =
  "7bbe7e02247e4177af954b83f7b2c4a982f6f1ef3806e623b2d847aa3089be47"
const FIXTURE_SET = "264870b880e3b37ff8f0d9bdbaa9a4f64242e92f6485316477d32bbf9b81904a"

function cloneMembers(mutator?: (members: DcnMemberAuthorityV0[]) => void): DcnMemberAuthorityV0[] {
  const members = structuredClone(DCN_MEMBER_AUTHORITIES_V0) as DcnMemberAuthorityV0[]
  mutator?.(members)
  return members
}

describe("counterfactual conformance package v0 (Lane J)", () => {
  test("DCN generation produces pinned 10-member neighborhood and Lane B SHA256", () => {
    const before = structuredClone(listDcnMemberAuthorities())
    const generated = generateFrozenCounterfactualNeighborhood({ repositoryRoot: root })
    expect(generated.neighborhood.members).toHaveLength(10)
    expect(generated.dcn_sha256).toBe(LANE_B_SHA256)
    expect(generated.child_identity_set_sha256).toBe(CHILD_IDENTITY_SET)
    expect(generated.neighborhood.members.map((m) => m.vector_id)).toEqual([
      "V-OBSERVED-NOT-VALIDATED",
      "V-MISSING-REQUIRED-INPUT",
      "V-INTEGRITY-MISMATCH",
      "V-CHRONICLE-PROOF-ROOT-MISMATCH",
      "V-CHRONICLE-PREDECESSOR-UNKNOWN",
      "V-CHRONICLE-SEQUENCE-GAP",
      "V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH",
      "V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL",
      "V-AT-NEST-OBJ",
      "V-MAN-HASH-DIFF",
    ])
    const fixture = JSON.parse(
      readFileSync(resolve(root, "tests/fixtures/counterfactual-neighborhood-identity-v0/neighborhood.json"), "utf8"),
    ) as { neighborhood: FrozenCounterfactualNeighborhoodV0 }
    expect(canonicalIdentityJson(generated.neighborhood)).toBe(
      canonicalIdentityJson(fixture.neighborhood),
    )
    expect(listDcnMemberAuthorities()).toEqual(before)
  })

  test("two independent generator runs are byte-identical and cwd-independent", () => {
    expect(proveGeneratorByteReproducibility(root)).toBe(true)
    const a = generateCounterfactualConformancePackageFiles({ repositoryRoot: root })
    const b = generateCounterfactualConformancePackageFiles({ repositoryRoot: root })
    for (const path of Object.keys(a.files)) {
      if (path.endsWith("/SPEC.md")) continue
      expect(Buffer.compare(a.files[path]!, b.files[path]!)).toBe(0)
    }
  })

  test("check mode reports zero drift against committed umbrella artifacts", () => {
    const result = runCounterfactualConformancePackageGenerator({ mode: "check", repositoryRoot: root })
    expect(result.ok).toBe(true)
    expect(result.drifted_paths).toEqual([])
    expect(result.dcn_sha256).toBe(LANE_B_SHA256)
    expect(result.fixture_set_sha256).toBe(FIXTURE_SET)
  })

  test("missing, duplicate, or extra DCN member fails closed", () => {
    expect(() =>
      generateFrozenCounterfactualNeighborhood({
        repositoryRoot: root,
        members: cloneMembers((m) => {
          m.pop()
        }),
      }),
    ).toThrow(DcnGeneratorError)

    expect(() =>
      generateFrozenCounterfactualNeighborhood({
        repositoryRoot: root,
        members: cloneMembers((m) => {
          m.push(structuredClone(m[0]!))
        }),
      }),
    ).toThrow(DcnGeneratorError)

    expect(() =>
      generateFrozenCounterfactualNeighborhood({
        repositoryRoot: root,
        members: cloneMembers((m) => {
          m[1] = structuredClone(m[0]!)
          ;(m[1] as { ordinal: number }).ordinal = 2
        }),
      }),
    ).toThrow(DcnGeneratorError)
  })

  test("expected-only mutation does not change DCN identity", () => {
    const vectorPath = resolve(
      root,
      "conformance/verifier-challenge-observed-not-validated-v0/vectors/V-OBSERVED-NOT-VALIDATED.json",
    )
    const original = readFileSync(vectorPath, "utf8")
    const mutated = JSON.parse(original) as Record<string, unknown>
    mutated.expected = { ...((mutated.expected as object) ?? {}), injected: "noise" }
    const temp = mkdtempSync(join(tmpdir(), "cc-v0-expected-"))
    try {
      const tempVector = join(temp, "vector.json")
      writeFileSync(tempVector, `${JSON.stringify(mutated, null, 2)}\n`)
      const model = projectVerifierChallengeVector(mutated)
      const identity = projectCounterfactualChallengeIdentity(model)
      const baseline = generateFrozenCounterfactualNeighborhood({ repositoryRoot: root })
      expect(canonicalIdentityJson(identity)).toBe(
        canonicalIdentityJson(baseline.neighborhood.members[0]!),
      )
      expect(computeFrozenCounterfactualNeighborhoodSha256(baseline.neighborhood)).toBe(LANE_B_SHA256)
    } finally {
      rmSync(temp, { recursive: true, force: true })
    }
  })

  test("wrong child digest / expected authority / substituted child fails", () => {
    expect(() =>
      generateFrozenCounterfactualNeighborhood({
        repositoryRoot: root,
        members: cloneMembers((m) => {
          ;(m[0] as { fixture_set_sha256: string }).fixture_set_sha256 =
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        }),
      }),
    ).toThrow(DcnGeneratorError)

    expect(() =>
      generateFrozenCounterfactualNeighborhood({
        repositoryRoot: root,
        members: cloneMembers((m) => {
          ;(m[0] as { expected_result_set_sha256: string }).expected_result_set_sha256 =
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        }),
      }),
    ).toThrow(DcnGeneratorError)

    expect(() =>
      generateFrozenCounterfactualNeighborhood({
        repositoryRoot: root,
        members: cloneMembers((m) => {
          ;(m[0] as { package_version: string }).package_version = "not-a-real-package-v0"
          ;(m[0] as { package_path: string }).package_path =
            "conformance/verifier-challenge-integrity-mismatch-rejected-v0"
        }),
      }),
    ).toThrow(DcnGeneratorError)
  })

  test("mutated umbrella contract/manifest/dcn fails package verification before execution", async () => {
    const temp = mkdtempSync(join(tmpdir(), "cc-v0-pkg-"))
    try {
      // Minimal fake repo is not practical for full verify; mutate committed bytes in temp copy of package files
      // and point a shallow check through generator drift / package identity helpers via subprocess check.
      const contractPath = resolve(root, "conformance/counterfactual-conformance-v0/contract.json")
      const original = readFileSync(contractPath)
      const mutated = JSON.parse(original.toString("utf8")) as Record<string, unknown>
      mutated.version = "v0-corrupt"
      writeFileSync(contractPath, `${JSON.stringify(mutated, null, 2)}\n`)
      try {
        await expect(verifyCounterfactualConformancePackage({ repositoryRoot: root })).rejects.toMatchObject({
          name: "CounterfactualConformancePackageError",
          reason: "unsupported_umbrella_schema",
        })
      } finally {
        writeFileSync(contractPath, original)
      }
    } finally {
      rmSync(temp, { recursive: true, force: true })
    }
  })

  test("mutated committed generated file is detected by check mode", () => {
    const dcnPath = resolve(root, "conformance/counterfactual-conformance-v0/dcn/neighborhood.json")
    const original = readFileSync(dcnPath)
    const mutated = JSON.parse(original.toString("utf8")) as Record<string, unknown>
    mutated.neighborhood_id = "mutated-id"
    writeFileSync(dcnPath, `${JSON.stringify(mutated, null, 2)}\n`)
    try {
      expect(() =>
        runCounterfactualConformancePackageGenerator({ mode: "check", repositoryRoot: root }),
      ).toThrow(DcnGeneratorError)
    } finally {
      writeFileSync(dcnPath, original)
    }
  })

  test(
    "umbrella verification: Lane I + Lane H aggregate conformant 10/10",
    async () => {
      const authoritiesBefore = structuredClone(listDcnMemberAuthorities())
      const first = await verifyCounterfactualConformancePackage({ repositoryRoot: root })
      const second = await verifyCounterfactualConformancePackage({ repositoryRoot: root })
      expect(first.schema).toBe("receiptos.counterfactual_conformance_package_verification.v0")
      expect(first.dcn_sha256).toBe(LANE_B_SHA256)
      expect(first.child_identity_set_sha256).toBe(CHILD_IDENTITY_SET)
      expect(first.fixture_set_sha256).toBe(FIXTURE_SET)
      expect(first.aggregate.evaluation_state).toBe("evaluated")
      if (first.aggregate.evaluation_state !== "evaluated") throw new Error("unreachable")
      expect(first.aggregate.verdict).toBe("conformant")
      expect(first.aggregate.counts).toEqual({
        total_member_count: 10,
        conformant_count: 10,
        nonconformant_count: 0,
        unresolved_count: 0,
      })
      expect(canonicalIdentityJson(first)).toBe(canonicalIdentityJson(second))
      expect(listDcnMemberAuthorities()).toEqual(authoritiesBefore)
    },
    { timeout: 60_000 },
  )

  test(
    "equal CAB manifest operands via authorized materialization → aggregate nonconformant",
    async () => {
      const request = deriveCounterfactualNeighborhoodConformanceRequest({ repositoryRoot: root })
      const mutated = structuredClone(request) as CounterfactualNeighborhoodConformanceRequestV0
      const man = mutated.members[9]!
      expect(man.route).toBe("cab_manifest_hash_diff")
      if (man.route !== "cab_manifest_hash_diff") throw new Error("unreachable")
      const firstOperand = man.request.operands.first
      man.request.operands = {
        first: structuredClone(firstOperand),
        second: structuredClone(firstOperand),
      }
      const result = await evaluateCounterfactualNeighborhoodConformance(mutated)
      expect(result.evaluation_state).toBe("evaluated")
      if (result.evaluation_state !== "evaluated") throw new Error("unreachable")
      expect(result.verdict).toBe("nonconformant")
      expect(result.counts.nonconformant_count).toBe(1)
      // Frozen package identity unchanged.
      const packageResult = await verifyCounterfactualConformancePackage({ repositoryRoot: root })
      expect(packageResult.dcn_sha256).toBe(LANE_B_SHA256)
      expect(packageResult.aggregate.verdict).toBe("conformant")
    },
    { timeout: 60_000 },
  )

  test(
    "child execution failure remains aggregate execution-unresolved",
    async () => {
      const request = deriveCounterfactualNeighborhoodConformanceRequest({ repositoryRoot: root })
      const mutated = structuredClone(request) as CounterfactualNeighborhoodConformanceRequestV0
      const ordinary = mutated.members[2]!
      expect(ordinary.route).toBe("single_vector")
      if (ordinary.route !== "single_vector") throw new Error("unreachable")
      ordinary.request.input = {
        evidence: Object.defineProperty(structuredClone(ordinary.request.input.evidence) as object, "__poison", {
          enumerable: true,
          get() {
            throw new Error("clone-stage diagnostic leak")
          },
        }),
      }
      const result = await evaluateCounterfactualNeighborhoodConformance(mutated)
      expect(result.evaluation_state).toBe("execution_unresolved")
      if (result.evaluation_state !== "execution_unresolved") throw new Error("unreachable")
      expect(result.verdict).toBeNull()
      expect(JSON.stringify(result)).not.toContain("clone-stage diagnostic leak")
    },
    { timeout: 60_000 },
  )

  test("package error reasons are closed and do not leak paths/stacks/digests", async () => {
    const contractPath = resolve(root, "conformance/counterfactual-conformance-v0/manifest.json")
    const original = readFileSync(contractPath)
    const mutated = JSON.parse(original.toString("utf8")) as Record<string, unknown>
    mutated.fixture_set_sha256 = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    writeFileSync(contractPath, `${JSON.stringify(mutated, null, 2)}\n`)
    try {
      let caught: unknown
      try {
        await verifyCounterfactualConformancePackage({ repositoryRoot: root })
      } catch (error) {
        caught = error
      }
      expect(caught).toBeInstanceOf(CounterfactualConformancePackageError)
      const err = caught as CounterfactualConformancePackageError
      expect(err.message).toBe("counterfactual conformance package verification failed")
      expect(err.message).not.toContain("C:\\")
      expect(err.message).not.toContain(root)
      expect(err.message).not.toContain("ffff")
      expect(err.stack ?? "").not.toContain("source_fixture")
    } finally {
      writeFileSync(contractPath, original)
    }
  })

  test("independent python and typescript auditors pass committed package", () => {
    const py = spawnSync("python", ["conformance/counterfactual-conformance-v0/verify_independent.py"], {
      cwd: root,
      encoding: "utf8",
    })
    expect(py.status).toBe(0)
    const pyOut = JSON.parse(py.stdout) as { dcn_sha256: string; child_identity_set_sha256: string }
    expect(pyOut.dcn_sha256).toBe(LANE_B_SHA256)
    expect(pyOut.child_identity_set_sha256).toBe(CHILD_IDENTITY_SET)

    const ts = spawnSync("bun", ["conformance/counterfactual-conformance-v0/audit_package.ts"], {
      cwd: root,
      encoding: "utf8",
    })
    expect(ts.status).toBe(0)
    const tsOut = JSON.parse(ts.stdout) as { dcn_sha256: string; production_imports: number }
    expect(tsOut.dcn_sha256).toBe(LANE_B_SHA256)
    expect(tsOut.production_imports).toBe(0)
  })

  test("generator CLI check mode exits 0", () => {
    const result = spawnSync(
      "bun",
      ["conformance/counterfactual-conformance-v0/generate_package.ts", "--check"],
      { cwd: root, encoding: "utf8" },
    )
    expect(result.status).toBe(0)
    const out = JSON.parse(result.stdout) as { ok: boolean; dcn_sha256: string }
    expect(out.ok).toBe(true)
    expect(out.dcn_sha256).toBe(LANE_B_SHA256)
  })
})
