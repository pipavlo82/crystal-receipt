import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { auditPackage } from "../../conformance/verifier-challenge-missing-required-input-unverifiable-v0/audit_package"
import type { HandoffEvidence } from "../../src/receiptos/schema/types"
import { verifyHandoffReceiptRoot } from "../../src/receiptos/verify/verify-receipt"

const root = resolve(import.meta.dir, "../..")
const pkg = "conformance/verifier-challenge-missing-required-input-unverifiable-v0"
const vector = JSON.parse(
  readFileSync(resolve(root, `${pkg}/vectors/V-MISSING-REQUIRED-INPUT.json`), "utf8"),
)

function applyMutation(baseline: HandoffEvidence): HandoffEvidence {
  const challenged = structuredClone(baseline)
  expect(challenged.anchor.receipt_root).toBe(vector.mutation.from)
  ;(challenged.anchor as { receipt_root: string | null }).receipt_root = vector.mutation.to
  return challenged
}

function withoutAnchorReceiptRoot(evidence: HandoffEvidence) {
  const cloned = structuredClone(evidence)
  const { receipt_root: _ignored, ...anchorWithoutReceiptRoot } = cloned.anchor
  return {
    ...cloned,
    anchor: anchorWithoutReceiptRoot,
  }
}

describe("verifier-challenge-missing-required-input-unverifiable-v0 package", () => {
  test("independent package audit reconstructs inventory and expected-result digests", () => {
    const result = auditPackage()
    expect(result.production_imports).toBe(0)
    expect(result).toEqual(
      JSON.parse(readFileSync(resolve(root, `${pkg}/typescript-audit-output.json`), "utf8")),
    )
  })

  test("frozen vector binds verifyHandoffReceiptRoot missing-input unverifiability", async () => {
    const fixturePath = resolve(root, vector.source_fixture.repository_path)
    const baseline: HandoffEvidence = JSON.parse(readFileSync(fixturePath, "utf8"))
    expect(baseline.anchor.receipt_root).toBe(vector.mutation.from)

    const challenged = applyMutation(baseline)
    expect(challenged.anchor.receipt_root).toBe(null)

    expect(withoutAnchorReceiptRoot(challenged)).toEqual(withoutAnchorReceiptRoot(baseline))

    const baselineWithoutAnchor = { ...baseline }
    delete (baselineWithoutAnchor as { anchor?: unknown }).anchor
    const challengedWithoutAnchor = { ...challenged }
    delete (challengedWithoutAnchor as { anchor?: unknown }).anchor
    expect(challengedWithoutAnchor).toEqual(baselineWithoutAnchor)

    const baselineVerification = await verifyHandoffReceiptRoot(baseline)
    const challengedVerification = await verifyHandoffReceiptRoot(challenged)

    expect(baselineVerification).toEqual(vector.expected.baseline_verification)
    expect(challengedVerification).toEqual(vector.expected.challenged_verification)
    expect(challengedVerification).not.toEqual(baselineVerification)
  })
})
