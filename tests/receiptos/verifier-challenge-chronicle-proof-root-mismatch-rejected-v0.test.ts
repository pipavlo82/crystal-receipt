import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { auditPackage } from "../../conformance/verifier-challenge-chronicle-proof-root-mismatch-rejected-v0/audit_package"
import { tryCreateChronicleEntryV0 } from "../../src/receiptos"
import type { HandoffEvidence } from "../../src/receiptos/schema/types"
import type { PortableProofObjectV0 } from "../../src/receiptos/capsule/portable-proof-object-v0"
import { verifyHandoffReceiptRoot } from "../../src/receiptos/verify/verify-receipt"

const root = resolve(import.meta.dir, "../..")
const pkg = "conformance/verifier-challenge-chronicle-proof-root-mismatch-rejected-v0"
const vector = JSON.parse(
  readFileSync(resolve(root, `${pkg}/vectors/V-CHRONICLE-PROOF-ROOT-MISMATCH.json`), "utf8"),
)

type AdmissionInput = {
  evidence: HandoffEvidence
  proof_object: PortableProofObjectV0
  options: Record<string, unknown>
}

function loadBaselineInput(): AdmissionInput {
  const source = JSON.parse(
    readFileSync(resolve(root, vector.source_fixture.repository_path), "utf8"),
  )
  return structuredClone(source.input) as AdmissionInput
}

function applyMutation(input: AdmissionInput): AdmissionInput {
  const challenged = structuredClone(input)
  expect(challenged.proof_object.receipt_root).toBe(vector.mutation.from)
  challenged.proof_object.receipt_root = vector.mutation.to
  return challenged
}

function withoutProofObjectReceiptRoot(input: AdmissionInput) {
  const cloned = structuredClone(input)
  const { receipt_root: _ignored, ...proofWithoutRoot } = cloned.proof_object
  return {
    ...cloned,
    proof_object: proofWithoutRoot,
  }
}

describe("verifier-challenge-chronicle-proof-root-mismatch-rejected-v0 package", () => {
  test("independent package audit reconstructs inventory and expected-result digests", () => {
    const result = auditPackage()
    expect(result.production_imports).toBe(0)
    expect(result).toEqual(
      JSON.parse(readFileSync(resolve(root, `${pkg}/typescript-audit-output.json`), "utf8")),
    )
  })

  test("frozen vector binds tryCreateChronicleEntryV0 proof-root mismatch rejection", async () => {
    const baselineInput = loadBaselineInput()
    expect(baselineInput.proof_object.receipt_root).toBe(vector.mutation.from)
    expect(baselineInput.evidence.anchor.receipt_root).toBe(vector.mutation.from)

    const baselineAdmission = tryCreateChronicleEntryV0(
      baselineInput.evidence,
      baselineInput.proof_object,
      baselineInput.options as never,
    )
    expect(baselineAdmission).toEqual(vector.expected.baseline_admission)

    const baselineReceiptRoot = await verifyHandoffReceiptRoot(baselineInput.evidence)
    expect(baselineReceiptRoot).toEqual(vector.expected.receipt_root_control)

    const challengedInput = applyMutation(baselineInput)
    expect(challengedInput.evidence).toEqual(baselineInput.evidence)
    expect(challengedInput.options).toEqual(baselineInput.options)
    expect(withoutProofObjectReceiptRoot(challengedInput)).toEqual(withoutProofObjectReceiptRoot(baselineInput))
    expect(challengedInput.proof_object.receipt_root).toBe(vector.mutation.to)

    const challengedAdmission = tryCreateChronicleEntryV0(
      challengedInput.evidence,
      challengedInput.proof_object,
      challengedInput.options as never,
    )
    expect(challengedAdmission).toEqual(vector.expected.challenged_admission)
    expect(challengedAdmission.success).toBe(false)
    if (!challengedAdmission.success) {
      expect(challengedAdmission.failure).toEqual({
        failure_class: "cross_object_inconsistency",
        reason_code: "proof_root_mismatch",
      })
    }

    const challengedReceiptRoot = await verifyHandoffReceiptRoot(challengedInput.evidence)
    expect(challengedReceiptRoot).toEqual(vector.expected.receipt_root_control)
    expect(challengedReceiptRoot.ok).toBe(true)
  })
})
