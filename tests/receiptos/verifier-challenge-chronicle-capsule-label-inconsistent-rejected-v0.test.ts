import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { auditPackage } from "../../conformance/verifier-challenge-chronicle-capsule-label-inconsistent-rejected-v0/audit_package"
import { tryCreateChronicleEntryV0 } from "../../src/receiptos"
import type { HandoffEvidence } from "../../src/receiptos/schema/types"
import type { PortableProofObjectV0 } from "../../src/receiptos/capsule/portable-proof-object-v0"
import { deriveProofObjectId, deriveProofRef } from "../../src/receiptos/capsule/portable-proof-object-v0"
import { verifyHandoffReceiptRoot } from "../../src/receiptos/verify/verify-receipt"

const root = resolve(import.meta.dir, "../..")
const pkg = "conformance/verifier-challenge-chronicle-capsule-label-inconsistent-rejected-v0"
const vector = JSON.parse(
  readFileSync(resolve(root, `${pkg}/vectors/V-CHRONICLE-CAPSULE-LABEL-INCONSISTENT.json`), "utf8"),
)

const VERIFIED_ROOT = "0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc"

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
  expect(challenged.proof_object.evidence_capsule.receipt_root.match).toBe(vector.mutation.from)
  challenged.proof_object.evidence_capsule.receipt_root.match = vector.mutation.to
  return challenged
}

function withoutCapsuleMatch(input: AdmissionInput) {
  const cloned = structuredClone(input)
  const { match: _ignored, ...receiptRootWithoutMatch } = cloned.proof_object.evidence_capsule.receipt_root
  return {
    ...cloned,
    proof_object: {
      ...cloned.proof_object,
      evidence_capsule: {
        ...cloned.proof_object.evidence_capsule,
        receipt_root: receiptRootWithoutMatch,
      },
    },
  }
}

describe("verifier-challenge-chronicle-capsule-label-inconsistent-rejected-v0 package", () => {
  test("independent package audit reconstructs inventory and expected-result digests", () => {
    const result = auditPackage()
    expect(result.production_imports).toBe(0)
    expect(result).toEqual(
      JSON.parse(readFileSync(resolve(root, `${pkg}/typescript-audit-output.json`), "utf8")),
    )
  })

  test("frozen vector binds tryCreateChronicleEntryV0 capsule label inconsistency rejection", async () => {
    const baselineInput = loadBaselineInput()
    const capsuleRoot = baselineInput.proof_object.evidence_capsule.receipt_root
    expect(capsuleRoot.match).toBe(true)
    expect(capsuleRoot.status).toBe("verified")
    expect(baselineInput.proof_object.evidence_capsule.verifier_result).toEqual({
      ok: true,
      status: "verified",
    })
    expect(baselineInput.proof_object.receipt_root).toBe(VERIFIED_ROOT)
    expect(capsuleRoot.stored).toBe(VERIFIED_ROOT)
    expect(capsuleRoot.computed).toBe(VERIFIED_ROOT)
    expect(baselineInput.proof_object.proof_object_id).toBe(deriveProofObjectId(VERIFIED_ROOT))
    expect(baselineInput.proof_object.proof_ref).toBe(
      deriveProofRef(deriveProofObjectId(VERIFIED_ROOT)),
    )

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
    expect(challengedInput.proof_object.receipt_root).toBe(baselineInput.proof_object.receipt_root)
    expect(challengedInput.proof_object.proof_object_id).toBe(baselineInput.proof_object.proof_object_id)
    expect(challengedInput.proof_object.proof_ref).toBe(baselineInput.proof_object.proof_ref)
    expect(challengedInput.proof_object.evidence_capsule.verifier_result).toEqual(
      baselineInput.proof_object.evidence_capsule.verifier_result,
    )
    expect(withoutCapsuleMatch(challengedInput)).toEqual(withoutCapsuleMatch(baselineInput))
    expect(challengedInput.proof_object.evidence_capsule.receipt_root.match).toBe(false)
    expect(challengedInput.proof_object.evidence_capsule.receipt_root.status).toBe("verified")
    expect(challengedInput.proof_object.evidence_capsule.receipt_root.stored).toBe(VERIFIED_ROOT)
    expect(challengedInput.proof_object.evidence_capsule.receipt_root.computed).toBe(VERIFIED_ROOT)

    const challengedAdmission = tryCreateChronicleEntryV0(
      challengedInput.evidence,
      challengedInput.proof_object,
      challengedInput.options as never,
    )
    expect(challengedAdmission).toEqual(vector.expected.challenged_admission)
    expect(challengedAdmission.success).toBe(false)
    if (!challengedAdmission.success) {
      expect(challengedAdmission.failure).toEqual({
        failure_class: "reported_state_inconsistency",
        reason_code: "capsule_label_inconsistent",
      })
    }

    const challengedReceiptRoot = await verifyHandoffReceiptRoot(challengedInput.evidence)
    expect(challengedReceiptRoot).toEqual(vector.expected.receipt_root_control)
    expect(challengedReceiptRoot.ok).toBe(true)
  })
})
