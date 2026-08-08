import { describe, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { auditPackage } from "../../conformance/verifier-challenge-chronicle-admission-set-v0/audit_package"

const root = resolve(import.meta.dir, "../..")
const pkg = "conformance/verifier-challenge-chronicle-admission-set-v0"

const expectedChildOrder = [
  "proof_root_mismatch_rejected",
  "proof_object_id_invalid_rejected",
  "capsule_label_inconsistent_rejected",
]

const expectedTrustBoundaries = [
  "cross-object-consistency",
  "identity-consistency",
  "reported-state-consistency",
]

const expectedTrustBoundaryMapping = {
  "cross-object-consistency": "proof_root_mismatch_rejected",
  "identity-consistency": "proof_object_id_invalid_rejected",
  "reported-state-consistency": "capsule_label_inconsistent_rejected",
}

const gitIndexBlobOid = (repositoryPath: string) =>
  execFileSync("git", ["rev-parse", `:${repositoryPath}`], { cwd: root, encoding: "utf8" }).trim()

describe("verifier-challenge-chronicle-admission-set-v0 aggregate index", () => {
  test("independent package audit reconstructs aggregate inventory and child references", () => {
    const result = auditPackage()
    expect(result.production_imports).toBe(0)
    expect(result).toEqual(
      JSON.parse(readFileSync(resolve(root, `${pkg}/typescript-audit-output.json`), "utf8")),
    )
  })

  test("frozen child inventory matches declared package digests, order, and trust boundaries", () => {
    const contract = JSON.parse(readFileSync(resolve(root, `${pkg}/contract.json`), "utf8"))
    const children = contract.children

    expect(existsSync(resolve(root, pkg, "vectors"))).toBe(false)
    expect(contract.expected_result_set_sha256).toBeUndefined()

    expect(children).toHaveLength(3)
    expect(children.map((child: { challenge_id: string }) => child.challenge_id)).toEqual(
      expectedChildOrder,
    )
    expect(children.map((child: { trust_boundary: string }) => child.trust_boundary)).toEqual(
      expectedTrustBoundaries,
    )
    expect(contract.trust_boundary_mapping).toEqual(expectedTrustBoundaryMapping)

    expect(contract.subject_admission_verifier.entrypoint).toBe("tryCreateChronicleEntryV0")
    expect(contract.subject_admission_verifier.module_path).toBe(
      "src/receiptos/capsule/chronicle-portfolio-v0.ts",
    )
    expect(gitIndexBlobOid(contract.subject_admission_verifier.module_path)).toBe(
      contract.subject_admission_verifier.git_blob_oid,
    )
    expect(contract.subject_admission_verifier.git_blob_oid).toBe(
      "0e790911092546c62344f980e6b611542bcd00fe",
    )

    for (const [index, child] of children.entries()) {
      expect(child.ordinal).toBe(index + 1)
      expect(child.vector_count).toBe(1)
      expect(child.execution_class).toBe("production-admission-binding")
      expect(existsSync(resolve(root, child.package_path))).toBe(true)

      const childManifest = JSON.parse(
        readFileSync(resolve(root, `${child.package_path}/manifest.json`), "utf8"),
      )
      const childContract = JSON.parse(
        readFileSync(resolve(root, `${child.package_path}/contract.json`), "utf8"),
      )

      expect(childManifest.fixture_set_sha256).toBe(child.fixture_set_sha256)
      expect(childContract.expected_result_set_sha256).toBe(child.expected_result_set_sha256)
    }

    expect(contract.aggregate.child_count).toBe(3)
    expect(contract.aggregate.vector_count).toBe(3)
    expect(contract.aggregate.execution_class_counts).toEqual({
      "production-admission-binding": 3,
    })
  })
})
