import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { auditPackage } from "../../conformance/verifier-challenge-set-v0/audit_package"

const root = resolve(import.meta.dir, "../..")
const pkg = "conformance/verifier-challenge-set-v0"

const expectedChildOrder = [
  "observed_not_validated",
  "missing_required_input_unverifiable",
  "integrity_mismatch_rejected",
]

describe("verifier-challenge-set-v0 aggregate index", () => {
  test("independent package audit reconstructs aggregate inventory and child references", () => {
    const result = auditPackage()
    expect(result.production_imports).toBe(0)
    expect(result).toEqual(
      JSON.parse(readFileSync(resolve(root, `${pkg}/typescript-audit-output.json`), "utf8")),
    )
  })

  test("frozen child inventory matches declared package digests and order", () => {
    const contract = JSON.parse(readFileSync(resolve(root, `${pkg}/contract.json`), "utf8"))
    const children = contract.children

    expect(children).toHaveLength(3)
    expect(children.map((child: { challenge_id: string }) => child.challenge_id)).toEqual(
      expectedChildOrder,
    )

    for (const [index, child] of children.entries()) {
      expect(child.ordinal).toBe(index + 1)
      expect(child.vector_count).toBe(1)
      expect(child.execution_class).toBe("production-verifier-binding")
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
      "production-verifier-binding": 3,
    })
    expect(contract.subject_verifier.entrypoint).toBe("verifyHandoffReceiptRoot")
    expect(contract.subject_verifier.git_blob_oid).toBe("2e2e45bf30529de93eac58a04465f17ef81edeaa")
  })
})
