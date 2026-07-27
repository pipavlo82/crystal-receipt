import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import {
 createCapsuleSummaryFromEvidence,
 createEvidenceCapsuleV0,
} from "../../src/receiptos/capsule/evidence-capsule-v0"
import type { HandoffEvidence } from "../../src/receiptos/schema/types"
import { verifyHandoffReceiptRoot } from "../../src/receiptos/verify/verify-receipt"

/**
 * Non-normative runtime-adversarial isolation prototype.
 *
 * This is not a frozen ReceiptOS Verifier Challenge Set vector.
 *
 * The current HandoffEvidence type permits only
 * anchor.verifier_status = "not verified".
 *
 * The injected runtime value "verified" deliberately models untrusted JSON
 * outside that current TypeScript literal contract.
 *
 * This prototype tests only semantic non-elevation:
 * a producer-supplied observation must not override independently recomputed
 * ReceiptOS validity.
 *
 * Current production output does not expose a separate positive observation
 * axis, so observation preservation remains a future design and implementation
 * gap.
 */

const fixturePath =
 "src/receiptos/fixtures/session-evidence.cyphes-workflow.sample.json"

function withoutAnchorVerifierStatus(evidence: HandoffEvidence) {
 const cloned = structuredClone(evidence)
 const {
 verifier_status: _ignored,
 ...anchorWithoutVerifierStatus
 } = cloned.anchor

 return {
 ...cloned,
 anchor: anchorWithoutVerifierStatus,
 }
}

describe("observed_not_validated runtime-adversarial isolation prototype", () => {
 test("producer observation does not override independently recomputed validity", async () => {
 const baselineEvidence: HandoffEvidence = JSON.parse(
 readFileSync(fixturePath, "utf8"),
 )

 expect(baselineEvidence.anchor.verifier_status).toBe("not verified")
 expect(baselineEvidence.anchor.receipt_root).toBeTruthy()

 const challengedEvidence = structuredClone(baselineEvidence)

 ;(challengedEvidence.anchor as { verifier_status: string })
 .verifier_status = "verified"

 expect(challengedEvidence.anchor.verifier_status).toBe("verified")

 expect(
 withoutAnchorVerifierStatus(challengedEvidence),
 ).toEqual(
 withoutAnchorVerifierStatus(baselineEvidence),
 )

 expect(challengedEvidence.anchor.receipt_root).toBe(
 baselineEvidence.anchor.receipt_root,
 )

 const baselineVerification =
 await verifyHandoffReceiptRoot(baselineEvidence)

 const challengedVerification =
 await verifyHandoffReceiptRoot(challengedEvidence)

 expect(baselineVerification.ok).toBe(true)
 expect(challengedVerification.ok).toBe(true)

 expect(challengedVerification).toEqual(
 baselineVerification,
 )

 expect(challengedVerification.receipt_root).toBe(
 baselineVerification.receipt_root,
 )

 expect(challengedVerification.recomputed_root).toBe(
 baselineVerification.recomputed_root,
 )

 const sourceEvidence = "fixture:cyphes-workflow"

 const baselineSummary =
 await createCapsuleSummaryFromEvidence(
 baselineEvidence,
 sourceEvidence,
 )

 const challengedSummary =
 await createCapsuleSummaryFromEvidence(
 challengedEvidence,
 sourceEvidence,
 )

 expect(challengedSummary.computed_receipt_root).toBe(
 baselineSummary.computed_receipt_root,
 )

 expect(challengedSummary.receipt_verification).toEqual(
 baselineSummary.receipt_verification,
 )

 const baselineVerifierSection =
 baselineSummary.capsule.sections.find(
 (section) => section.id === "verifier",
 )

 const challengedVerifierSection =
 challengedSummary.capsule.sections.find(
 (section) => section.id === "verifier",
 )

 expect(baselineVerifierSection).toBeDefined()
 expect(challengedVerifierSection).toBeDefined()

 expect(challengedVerifierSection?.status).toBe(
 baselineVerifierSection?.status,
 )

 const baselineCapsule =
 createEvidenceCapsuleV0(baselineSummary)

 const challengedCapsule =
 createEvidenceCapsuleV0(challengedSummary)

 expect(challengedCapsule.receipt_root).toEqual(
 baselineCapsule.receipt_root,
 )

 expect(challengedCapsule.verifier_result).toEqual(
 baselineCapsule.verifier_result,
 )

 expect(baselineCapsule.verifier_result).toEqual({
 ok: baselineSummary.receipt_verification.ok,
 status: baselineSummary.receipt_verification.status,
 })

 expect(challengedCapsule.verifier_result).toEqual({
 ok: challengedSummary.receipt_verification.ok,
 status: challengedSummary.receipt_verification.status,
 })
 })
})
