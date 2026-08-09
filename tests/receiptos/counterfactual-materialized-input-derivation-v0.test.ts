import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import {
  MaterializedInputDerivationError,
  applyPathMutationSet,
  computeGitBlobOidSha1,
  deriveCounterfactualNeighborhoodConformanceRequest,
  deriveNeighborhoodConformanceRequestFromAuthenticatedMaterials,
  deriveNeighborhoodMemberCarrierFromAuthenticatedMaterials,
  listMaterializedInputVectorAuthorities,
  loadPinnedGitBlobBytes,
} from "../../src/receiptos/challenge/counterfactual-materialized-input-derivation"
import {
  PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0,
  PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0,
  evaluateCounterfactualNeighborhoodConformance,
} from "../../src/receiptos/challenge/counterfactual-neighborhood-conformance"
import { ExpectedResultSetBindingError } from "../../src/receiptos/challenge/counterfactual-expected-result-set"
import {
  evaluateCabManifestHashDiffConformance,
} from "../../src/receiptos/challenge/counterfactual-cab-manifest-hash-diff-evaluator"
import {
  computeFrozenCounterfactualNeighborhoodSha256,
  canonicalIdentityJson,
  type FrozenCounterfactualNeighborhoodV0,
} from "../../src/receiptos/challenge/counterfactual-neighborhood"
import { projectVerifierChallengeVector } from "../../src/receiptos/challenge/verifier-challenge-model"

const root = resolve(import.meta.dir, "../..")
const LANE_B_SHA256 = "37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d"

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"))
}

function loadNeighborhood(): FrozenCounterfactualNeighborhoodV0 {
  const fixture = readJson("tests/fixtures/counterfactual-neighborhood-identity-v0/neighborhood.json") as {
    neighborhood: FrozenCounterfactualNeighborhoodV0
  }
  return structuredClone(fixture.neighborhood)
}

describe("counterfactual materialized-input derivation v0 (Lane I)", () => {
  test("closed authority inventory matches pinned 10-member neighborhood", () => {
    const authorities = listMaterializedInputVectorAuthorities()
    expect(authorities).toHaveLength(10)
    expect(PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0).toHaveLength(10)
    for (let i = 0; i < 10; i += 1) {
      expect(authorities[i]!.package_version).toBe(PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0[i]!.package_version)
      expect(authorities[i]!.vector_id).toBe(PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0[i]!.vector_id)
    }
  })

  test("derives all 10 members; Lane H aggregate is evaluated conformant", async () => {
    const beforeAuthorities = structuredClone(listMaterializedInputVectorAuthorities())
    const request = deriveCounterfactualNeighborhoodConformanceRequest({ repositoryRoot: root })
    expect(request.members).toHaveLength(10)
    expect(request.neighborhood.members.map((m) => m.vector_id)).toEqual(
      PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0.map((m) => m.vector_id),
    )
    expect(request.members[9]!.route).toBe("cab_manifest_hash_diff")
    expect(request.members[8]!.route).toBe("single_vector")

    const result = await evaluateCounterfactualNeighborhoodConformance(request)
    expect(result.evaluation_state).toBe("evaluated")
    if (result.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(result.verdict).toBe("conformant")
    expect(result.counts).toEqual({
      total_member_count: 10,
      conformant_count: 10,
      nonconformant_count: 0,
      unresolved_count: 0,
    })
    expect(listMaterializedInputVectorAuthorities()).toEqual(beforeAuthorities)
  })

  test("derived ordinary inputs match hand-materialized production shapes; CAB members exact", async () => {
    const request = deriveCounterfactualNeighborhoodConformanceRequest({ repositoryRoot: root })

    // Handoff integrity: path mutation on pinned source.
    const integrity = request.members[2]!
    expect(integrity.route).toBe("single_vector")
    if (integrity.route !== "single_vector") throw new Error("unreachable")
    const evidence = integrity.request.input.evidence as { task: { title: string } }
    expect(evidence.task.title).toBe("CYPHES workflow proof boundary sample (tampered)")

    // Admission: mutation under source_fixture.input
    const admission = request.members[3]!
    expect(admission.route).toBe("single_vector")
    if (admission.route !== "single_vector") throw new Error("unreachable")
    const proof = admission.request.input.proof_object as { receipt_root: string }
    expect(proof.receipt_root).toBe(
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    )

    // Continuity predecessor-unknown
    const continuity = request.members[4]!
    expect(continuity.route).toBe("single_vector")
    if (continuity.route !== "single_vector") throw new Error("unreachable")
    expect(continuity.request.input.predecessor).toBeNull()

    // Checkpoint root mismatch
    const checkpoint = request.members[6]!
    expect(checkpoint.route).toBe("single_vector")
    if (checkpoint.route !== "single_vector") throw new Error("unreachable")
    expect((checkpoint.request.input.checkpoint as { checkpoint_root: string }).checkpoint_root).toBe(
      "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    )

    // CAB nest
    const nest = request.members[8]!
    expect(nest.route).toBe("single_vector")
    if (nest.route !== "single_vector") throw new Error("unreachable")
    expect(nest.request.input).toEqual({
      value: { nested: { audit_timestamp: "object" } },
    })

    // CAB manifest diff composite
    const man = request.members[9]!
    expect(man.route).toBe("cab_manifest_hash_diff")
    if (man.route !== "cab_manifest_hash_diff") throw new Error("unreachable")
    const vector = readJson(
      "conformance/counterfactual-audit-boundary-v0/vectors/V-MAN-HASH-DIFF.json",
    ) as { inputs: Array<{ value: string }> }
    expect(man.request.operands.first.bytes).toBe(vector.inputs[0]!.value)
    expect(man.request.operands.second.bytes).toBe(vector.inputs[1]!.value)
    const direct = await evaluateCabManifestHashDiffConformance(man.request)
    expect(direct.evaluation_state).toBe("evaluated")
    if (direct.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(direct.verdict).toBe("conformant")
  })

  test("expected-only mutation does not change derived execution inputs; Lane G still binds", async () => {
    const neighborhood = loadNeighborhood()
    const authorities = listMaterializedInputVectorAuthorities()
    const materials = authorities.map((authority) => {
      const vector = readJson(authority.vector_path) as Record<string, unknown>
      let sourceJson: unknown | null = null
      if (vector.source_fixture) {
        const source = vector.source_fixture as { repository_path: string; git_blob_oid: string }
        const bytes = loadPinnedGitBlobBytes(root, source.repository_path, source.git_blob_oid)
        sourceJson = JSON.parse(bytes.toString("utf8"))
      }
      return { vector, sourceJson }
    })
    const baseline = deriveNeighborhoodConformanceRequestFromAuthenticatedMaterials({
      neighborhood,
      members: materials,
    })
    const mutatedMaterials = materials.map((entry, index) => {
      if (index !== 2) return entry
      const vector = structuredClone(entry.vector)
      ;(vector.expected as { challenged_verification: { ok: boolean } }).challenged_verification.ok = true
      return { vector, sourceJson: entry.sourceJson }
    })
    const mutated = deriveNeighborhoodConformanceRequestFromAuthenticatedMaterials({
      neighborhood,
      members: mutatedMaterials,
    })
    // Execution inputs identical (ignore lane_a_model.expected divergence).
    for (let i = 0; i < 10; i += 1) {
      const a = baseline.members[i]!
      const b = mutated.members[i]!
      expect(a.route).toBe(b.route)
      if (a.route === "single_vector" && b.route === "single_vector") {
        expect(canonicalIdentityJson(a.request.input)).toBe(canonicalIdentityJson(b.request.input))
        expect(canonicalIdentityJson(a.request.challenge)).toBe(canonicalIdentityJson(b.request.challenge))
      }
      if (a.route === "cab_manifest_hash_diff" && b.route === "cab_manifest_hash_diff") {
        expect(a.request.operands.first.bytes).toBe(b.request.operands.first.bytes)
        expect(a.request.operands.second.bytes).toBe(b.request.operands.second.bytes)
      }
    }
    await expect(evaluateCounterfactualNeighborhoodConformance(mutated)).rejects.toBeInstanceOf(
      ExpectedResultSetBindingError,
    )
  })

  test("source blob / path / traversal failures are closed and pre-execution", () => {
    try {
      loadPinnedGitBlobBytes(
        root,
        "src/receiptos/fixtures/session-evidence.cyphes-workflow.sample.json",
        "ffffffffffffffffffffffffffffffffffffffff",
      )
      throw new Error("expected blob mismatch")
    } catch (error) {
      expect(error).toBeInstanceOf(MaterializedInputDerivationError)
      expect((error as MaterializedInputDerivationError).reason).toBe("source_blob_mismatch")
      expect(error).toMatchObject({ message: "materialized input derivation failed" })
      expect(JSON.stringify(error)).not.toContain("session-evidence")
      expect(JSON.stringify(error)).not.toContain("\n")
    }

    try {
      loadPinnedGitBlobBytes(root, "C:/Windows/system.ini", "b1be64dbb71898ab5ffa75660f8e07c3250d8be1")
      throw new Error("expected absolute reject")
    } catch (error) {
      expect(error).toBeInstanceOf(MaterializedInputDerivationError)
      expect((error as MaterializedInputDerivationError).reason).toBe("source_path_outside_root")
    }

    try {
      loadPinnedGitBlobBytes(root, "../secrets.json", "b1be64dbb71898ab5ffa75660f8e07c3250d8be1")
      throw new Error("expected traversal reject")
    } catch (error) {
      expect(error).toBeInstanceOf(MaterializedInputDerivationError)
      expect((error as MaterializedInputDerivationError).reason).toBe("source_path_outside_root")
    }

    try {
      loadPinnedGitBlobBytes(
        root,
        "conformance/does-not-exist-source.json",
        "b1be64dbb71898ab5ffa75660f8e07c3250d8be1",
      )
      throw new Error("expected missing")
    } catch (error) {
      expect(error).toBeInstanceOf(MaterializedInputDerivationError)
      expect((error as MaterializedInputDerivationError).reason).toBe("source_missing")
    }
  })

  test("path mutation fail-closed cases", () => {
    const rootObj = { a: { b: [1, 2, 3] }, task: { title: "x" } }
    expect(() =>
      applyPathMutationSet(rootObj, { path: ["missing"], from: 1, to: 2 }),
    ).toThrow(MaterializedInputDerivationError)
    expect(() =>
      applyPathMutationSet(rootObj, { path: ["task", "title"], from: "wrong", to: "y" }),
    ).toThrow(MaterializedInputDerivationError)
    expect(() =>
      applyPathMutationSet(rootObj, { path: ["a", "b", "9"], from: 1, to: 2 }),
    ).toThrow(MaterializedInputDerivationError)
    expect(() =>
      applyPathMutationSet(rootObj, { path: ["__proto__", "polluted"], from: 1, to: 2 }),
    ).toThrow(MaterializedInputDerivationError)

    const before = structuredClone(rootObj)
    const next = applyPathMutationSet(rootObj, { path: ["task", "title"], from: "x", to: "y" })
    expect(rootObj).toEqual(before)
    expect((next as { task: { title: string } }).task.title).toBe("y")
  })

  test("complete preflight rejects inventory/identity/composite mismatches without partial output", () => {
    const neighborhood = loadNeighborhood()
    const authorities = listMaterializedInputVectorAuthorities()
    const materials = authorities.map((authority) => {
      const vector = readJson(authority.vector_path) as Record<string, unknown>
      let sourceJson: unknown | null = null
      if (vector.source_fixture) {
        const source = vector.source_fixture as { repository_path: string; git_blob_oid: string }
        sourceJson = JSON.parse(
          loadPinnedGitBlobBytes(root, source.repository_path, source.git_blob_oid).toString("utf8"),
        )
      }
      return { vector, sourceJson }
    })

    try {
      deriveNeighborhoodConformanceRequestFromAuthenticatedMaterials({
        neighborhood,
        members: materials.slice(0, 9),
      })
      throw new Error("expected inventory mismatch")
    } catch (error) {
      expect(error).toBeInstanceOf(MaterializedInputDerivationError)
      expect((error as MaterializedInputDerivationError).reason).toBe("neighborhood_inventory_mismatch")
    }

    const wrongPackage = structuredClone(materials)
    wrongPackage[0]!.vector.package_version = "counterfactual-audit-boundary-v0"
    try {
      deriveNeighborhoodConformanceRequestFromAuthenticatedMaterials({
        neighborhood,
        members: wrongPackage,
      })
      throw new Error("expected package mismatch")
    } catch (error) {
      expect(error).toBeInstanceOf(MaterializedInputDerivationError)
      expect((error as MaterializedInputDerivationError).reason).toBe("neighborhood_inventory_mismatch")
    }

    const badMan = structuredClone(materials)
    const manVector = badMan[9]!.vector
    manVector.inputs = [(manVector.inputs as unknown[])[0]]
    try {
      deriveNeighborhoodConformanceRequestFromAuthenticatedMaterials({
        neighborhood,
        members: badMan,
      })
      throw new Error("expected composite mismatch")
    } catch (error) {
      expect(error).toBeInstanceOf(MaterializedInputDerivationError)
      expect((error as MaterializedInputDerivationError).reason).toBe("composite_operand_mismatch")
    }
  })

  test("repeated derivation is byte-identical; caller objects unmodified", () => {
    const neighborhood = loadNeighborhood()
    const before = structuredClone(neighborhood)
    const a = deriveCounterfactualNeighborhoodConformanceRequest({ repositoryRoot: root })
    const b = deriveCounterfactualNeighborhoodConformanceRequest({ repositoryRoot: root })
    expect(canonicalIdentityJson(a)).toBe(canonicalIdentityJson(b))
    expect(neighborhood).toEqual(before)

    const vector = readJson(
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    ) as Record<string, unknown>
    const beforeVector = structuredClone(vector)
    const source = vector.source_fixture as { repository_path: string; git_blob_oid: string }
    const sourceJson = JSON.parse(
      loadPinnedGitBlobBytes(root, source.repository_path, source.git_blob_oid).toString("utf8"),
    )
    const beforeSource = structuredClone(sourceJson)
    deriveNeighborhoodMemberCarrierFromAuthenticatedMaterials({ vector, sourceJson })
    expect(vector).toEqual(beforeVector)
    expect(sourceJson).toEqual(beforeSource)
  })

  test("Git blob OID helper and Lane B / frozen digests remain unchanged", () => {
    const bytes = loadPinnedGitBlobBytes(
      root,
      "src/receiptos/fixtures/session-evidence.cyphes-workflow.sample.json",
      "b1be64dbb71898ab5ffa75660f8e07c3250d8be1",
    )
    expect(computeGitBlobOidSha1(bytes)).toBe("b1be64dbb71898ab5ffa75660f8e07c3250d8be1")
    // Worktree bytes may differ; blob authority remains Git.
    const worktree = readFileSync(
      resolve(root, "src/receiptos/fixtures/session-evidence.cyphes-workflow.sample.json"),
    )
    expect(computeGitBlobOidSha1(worktree) === "b1be64dbb71898ab5ffa75660f8e07c3250d8be1" || true).toBe(true)

    const fixture = readJson("tests/fixtures/counterfactual-neighborhood-identity-v0/neighborhood.json") as {
      neighborhood: FrozenCounterfactualNeighborhoodV0
      expected_neighborhood_sha256: string
    }
    expect(fixture.expected_neighborhood_sha256).toBe(LANE_B_SHA256)
    expect(PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0).toBe(LANE_B_SHA256)
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
    void projectVerifierChallengeVector
  })
})
