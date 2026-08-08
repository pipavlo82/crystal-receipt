import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { auditPackage } from "../../conformance/verifier-challenge-integrity-mismatch-rejected-v0/audit_package"
import type { HandoffEvidence } from "../../src/receiptos/schema/types"
import { verifyHandoffReceiptRoot } from "../../src/receiptos/verify/verify-receipt"

const root = resolve(import.meta.dir, "../..")
const pkg = "conformance/verifier-challenge-integrity-mismatch-rejected-v0"
const vector = JSON.parse(
  readFileSync(resolve(root, `${pkg}/vectors/V-INTEGRITY-MISMATCH.json`), "utf8"),
)

function applyMutation(baseline: HandoffEvidence): HandoffEvidence {
  const challenged = structuredClone(baseline)
  expect(challenged.task.title).toBe(vector.mutation.from)
  challenged.task.title = vector.mutation.to
  return challenged
}

function withoutTaskTitle(evidence: HandoffEvidence) {
  const cloned = structuredClone(evidence)
  const { title: _ignored, ...taskWithoutTitle } = cloned.task
  return {
    ...cloned,
    task: taskWithoutTitle,
  }
}

describe("verifier-challenge-integrity-mismatch-rejected-v0 package", () => {
  test("independent package audit reconstructs inventory and expected-result digests", () => {
    const result = auditPackage()
    expect(result.production_imports).toBe(0)
    expect(result).toEqual(
      JSON.parse(readFileSync(resolve(root, `${pkg}/typescript-audit-output.json`), "utf8")),
    )
  })

  test("frozen vector binds verifyHandoffReceiptRoot integrity mismatch rejection", async () => {
    const fixturePath = resolve(root, vector.source_fixture.repository_path)
    const baseline: HandoffEvidence = JSON.parse(readFileSync(fixturePath, "utf8"))
    expect(baseline.task.title).toBe(vector.mutation.from)
    expect(baseline.anchor.receipt_root).toBe(vector.expected.baseline_verification.receipt_root)

    const challenged = applyMutation(baseline)
    expect(challenged.task.title).toBe(vector.mutation.to)
    expect(challenged.anchor.receipt_root).toBe(baseline.anchor.receipt_root)
    expect(withoutTaskTitle(challenged)).toEqual(withoutTaskTitle(baseline))

    const baselineWithoutTaskTitle = structuredClone(baseline)
    delete (baselineWithoutTaskTitle.task as { title?: string }).title
    const challengedWithoutTaskTitle = structuredClone(challenged)
    delete (challengedWithoutTaskTitle.task as { title?: string }).title
    expect(challengedWithoutTaskTitle).toEqual(baselineWithoutTaskTitle)

    const baselineVerification = await verifyHandoffReceiptRoot(baseline)
    const challengedVerification = await verifyHandoffReceiptRoot(challenged)

    expect(baselineVerification).toEqual(vector.expected.baseline_verification)
    expect(challengedVerification).toEqual(vector.expected.challenged_verification)
    expect(challengedVerification).not.toEqual(baselineVerification)
    expect(challengedVerification.receipt_root).not.toBe(challengedVerification.recomputed_root)
  })
})
