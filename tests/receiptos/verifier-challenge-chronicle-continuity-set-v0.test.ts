import { createHash } from "node:crypto"
import { describe, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { auditPackage } from "../../conformance/verifier-challenge-chronicle-continuity-set-v0/audit_package"

const root = resolve(import.meta.dir, "../..")
const pkg = "conformance/verifier-challenge-chronicle-continuity-set-v0"

const expectedChildOrder = [
  "predecessor_unknown_unverifiable",
  "predecessor_ref_mismatch_rejected",
  "sequence_gap_rejected",
]

const expectedTrustBoundaries = [
  "predecessor-availability / epistemic-unverifiability",
  "predecessor-reference-binding",
  "sequence-adjacency",
]

const expectedGates = [4, 7, 8]

const expectedTrustBoundaryMapping = {
  "predecessor-availability / epistemic-unverifiability": "predecessor_unknown_unverifiable",
  "predecessor-reference-binding": "predecessor_ref_mismatch_rejected",
  "sequence-adjacency": "sequence_gap_rejected",
}

const expectedChildIdentitySetSha256 = "4448c728b264cc51d369de7b42430205b9dfdabedb09a282c619e5a42e0d61ac"

const gitIndexBlobOid = (repositoryPath: string) =>
  execFileSync("git", ["rev-parse", `:${repositoryPath}`], { cwd: root, encoding: "utf8" }).trim()

const canonicalJson = (value: unknown): string => {
  if (value === null) return "null"
  if (value === true) return "true"
  if (value === false) return "false"
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number") return String(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`
  }
  throw new Error(`non-canonical json value: ${typeof value}`)
}

const childIdentitySetSha256 = (children: Array<Record<string, unknown>>) =>
  createHash("sha256")
    .update(
      Buffer.from(
        canonicalJson(
          children.map((child) => ({
            ordinal: child.ordinal,
            challenge_id: child.challenge_id,
            package_path: child.package_path,
            vector_count: child.vector_count,
            execution_class: child.execution_class,
            fixture_set_sha256: child.fixture_set_sha256,
            expected_result_set_sha256: child.expected_result_set_sha256,
          })),
        ),
        "utf8",
      ),
    )
    .digest("hex")

describe("verifier-challenge-chronicle-continuity-set-v0 aggregate index", () => {
  test("independent package audit reconstructs aggregate inventory and child references", () => {
    const result = auditPackage()
    expect(result.production_imports).toBe(0)
    expect(result).toEqual(
      JSON.parse(readFileSync(resolve(root, `${pkg}/typescript-audit-output.json`), "utf8")),
    )
  })

  test("frozen child inventory matches declared package digests, gate order, and trust boundaries", () => {
    const contract = JSON.parse(readFileSync(resolve(root, `${pkg}/contract.json`), "utf8"))
    const manifest = JSON.parse(readFileSync(resolve(root, `${pkg}/manifest.json`), "utf8"))
    const children = contract.children

    expect(existsSync(resolve(root, pkg, "vectors"))).toBe(false)
    expect(contract.expected_result_set_sha256).toBeUndefined()

    expect(contract.set_id).toBe("verifier-challenge-chronicle-continuity-set-v0")
    expect(contract.version).toBe("v0")

    expect(children).toHaveLength(3)
    expect(children.map((child: { challenge_id: string }) => child.challenge_id)).toEqual(
      expectedChildOrder,
    )
    expect(children.map((child: { trust_boundary: string }) => child.trust_boundary)).toEqual(
      expectedTrustBoundaries,
    )
    expect(children.map((child: { gate: number }) => child.gate)).toEqual(expectedGates)
    expect(contract.trust_boundary_mapping).toEqual(expectedTrustBoundaryMapping)

    expect(contract.subject_continuity_evaluator.entrypoint).toBe(
      "evaluateChronicleCheckpointContinuityV0",
    )
    expect(contract.subject_continuity_evaluator.module_path).toBe(
      "src/receiptos/capsule/chronicle-checkpoint-continuity-v0.ts",
    )
    expect(gitIndexBlobOid(contract.subject_continuity_evaluator.module_path)).toBe(
      contract.subject_continuity_evaluator.git_blob_oid,
    )
    expect(contract.subject_continuity_evaluator.git_blob_oid).toBe(
      "428923f10aac54bfaaebedfad494118cbb17d744",
    )

    for (const [index, child] of children.entries()) {
      expect(child.ordinal).toBe(index + 1)
      expect(child.vector_count).toBe(1)
      expect(child.execution_class).toBe("production-continuity-binding")
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
    expect(contract.aggregate.vector_count).toBe(0)
    expect(contract.aggregate.child_vector_count).toBe(3)
    expect(contract.aggregate.execution_class_counts).toEqual({
      "production-continuity-binding": 3,
    })
    expect(manifest.aggregate_vector_count).toBe(0)
    expect(manifest.child_vector_count).toBe(3)

    const identityHash = childIdentitySetSha256(children)
    expect(identityHash).toBe(expectedChildIdentitySetSha256)
    expect(identityHash).toBe(contract.aggregate.child_identity_set_sha256)
    expect(identityHash).toBe(manifest.child_identity_set_sha256)
    expect(identityHash).toBe(manifest.child_identity_set_sha256)
  })
})
