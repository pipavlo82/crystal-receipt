import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { auditPackage } from "../../conformance/verifier-challenge-observed-not-validated-v0/audit_package"
import type { HandoffEvidence } from "../../src/receiptos/schema/types"
import { verifyHandoffReceiptRoot } from "../../src/receiptos/verify/verify-receipt"

const root = resolve(import.meta.dir, "../..")
const pkg = "conformance/verifier-challenge-observed-not-validated-v0"
const vector = JSON.parse(
  readFileSync(resolve(root, `${pkg}/vectors/V-OBSERVED-NOT-VALIDATED.json`), "utf8"),
)

function applyMutation(baseline: HandoffEvidence): HandoffEvidence {
  const challenged = structuredClone(baseline)
  expect(challenged.anchor.verifier_status).toBe(vector.mutation.from)
  ;(challenged.anchor as { verifier_status: string }).verifier_status = vector.mutation.to
  return challenged
}

describe("verifier-challenge-observed-not-validated-v0 package", () => {
  test("independent package audit reconstructs inventory and expected-result digests", () => {
    const result = auditPackage()
    expect(result.production_imports).toBe(0)
    expect(result).toEqual(
      JSON.parse(readFileSync(resolve(root, `${pkg}/typescript-audit-output.json`), "utf8")),
    )
  })

  test("frozen vector binds verifyHandoffReceiptRoot non-elevation", async () => {
    const fixturePath = resolve(root, vector.source_fixture.repository_path)
    const baseline: HandoffEvidence = JSON.parse(readFileSync(fixturePath, "utf8"))
    expect(baseline.anchor.verifier_status).toBe("not verified")

    const challenged = applyMutation(baseline)
    expect(challenged.anchor.verifier_status).toBe("verified")
    expect(challenged.anchor.receipt_root).toBe(baseline.anchor.receipt_root)

    const baselineVerification = await verifyHandoffReceiptRoot(baseline)
    const challengedVerification = await verifyHandoffReceiptRoot(challenged)

    expect(baselineVerification).toEqual(vector.expected.baseline_verification)
    expect(challengedVerification).toEqual(vector.expected.challenged_verification)
    expect(challengedVerification).toEqual(baselineVerification)
  })
})
