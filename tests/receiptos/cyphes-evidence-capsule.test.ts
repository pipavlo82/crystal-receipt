import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import {
  createCapsuleSummary,
  createEvidenceCapsuleV0,
  createProvenanceSummaryV0,
} from "../../src/receiptos"

type CyphesWorkflowContext = {
  objects_present: Array<"campaign" | "work_unit" | "claim" | "contribution" | "verification" | "credit" | "report">
  verification_present: boolean
  credit_present: boolean
  credit_without_verification: boolean
  contribution_hash_mismatch: boolean
  report_mismatch: boolean
}

function fixturePath(name: string) {
  return `src/receiptos/fixtures/${name}`
}

function readCyphesWorkflowContext(path: string): CyphesWorkflowContext {
  const doc = JSON.parse(readFileSync(path, "utf8")) as { task?: { prompt?: string } }
  const prompt = doc.task?.prompt
  const prefix = "CYPHES_WORKFLOW:"

  if (!prompt || !prompt.startsWith(prefix)) {
    throw new Error(`Missing CYPHES_WORKFLOW payload in ${path}`)
  }

  const payload = JSON.parse(prompt.slice(prefix.length).trim()) as {
    campaign?: unknown
    work_unit?: unknown
    claim?: unknown
    contribution?: { hash?: unknown } | null
    verification?: { contribution_hash?: unknown } | null
    credit?: unknown
    report?: { contribution_hash?: unknown } | null
  }

  const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === "object" && value !== null && !Array.isArray(value)
  )

  const hasCampaign = isRecord(payload.campaign)
  const hasWorkUnit = isRecord(payload.work_unit)
  const hasClaim = isRecord(payload.claim)
  const hasContribution = isRecord(payload.contribution)
  const hasVerification = isRecord(payload.verification)
  const hasCredit = isRecord(payload.credit)
  const hasReport = isRecord(payload.report)
  const contributionHash = typeof payload.contribution?.hash === "string" ? payload.contribution.hash : null
  const verificationContributionHash = typeof payload.verification?.contribution_hash === "string"
    ? payload.verification.contribution_hash
    : null
  const reportContributionHash = typeof payload.report?.contribution_hash === "string"
    ? payload.report.contribution_hash
    : null

  return {
    objects_present: [
      hasCampaign ? "campaign" : null,
      hasWorkUnit ? "work_unit" : null,
      hasClaim ? "claim" : null,
      hasContribution ? "contribution" : null,
      hasVerification ? "verification" : null,
      hasCredit ? "credit" : null,
      hasReport ? "report" : null,
    ].filter(Boolean) as CyphesWorkflowContext["objects_present"],
    verification_present: hasVerification,
    credit_present: hasCredit,
    credit_without_verification: hasCredit && !hasVerification,
    contribution_hash_mismatch: Boolean(
      contributionHash && verificationContributionHash && contributionHash !== verificationContributionHash,
    ),
    report_mismatch: Boolean(
      contributionHash && reportContributionHash && contributionHash !== reportContributionHash,
    ),
  }
}

function deriveCyphesRiskFlags(workflow: CyphesWorkflowContext) {
  const warnings: string[] = []
  const riskFlags: string[] = []

  if (workflow.credit_without_verification) {
    warnings.push("CYPHES credit is present without a corresponding verification decision.")
    riskFlags.push("credit_without_verification")
  }

  if (workflow.contribution_hash_mismatch) {
    warnings.push("CYPHES contribution hash does not match the referenced verification contribution hash.")
    riskFlags.push("contribution_hash_mismatch")
  }

  if (workflow.report_mismatch) {
    warnings.push("CYPHES report summary does not match the referenced contribution hash.")
    riskFlags.push("report_contribution_mismatch")
  }

  return { warnings, riskFlags }
}

describe("CYPHES evidence capsule boundary", () => {
  test("CYPHES-like workflow evidence maps into the current Evidence Capsule boundary", async () => {
    const path = fixturePath("session-evidence.cyphes-workflow.sample.json")
    const workflow = readCyphesWorkflowContext(path)
    const summary = await createCapsuleSummary(path)
    const substrate = createEvidenceCapsuleV0(summary)
    const provenance = createProvenanceSummaryV0(substrate)

    expect(workflow).toEqual({
      objects_present: ["campaign", "work_unit", "claim", "contribution", "verification", "credit", "report"],
      verification_present: true,
      credit_present: true,
      credit_without_verification: false,
      contribution_hash_mismatch: false,
      report_mismatch: false,
    })
    expect(substrate.schema).toBe("receiptos.evidence_capsule.v0")
    expect(substrate.action.summary).toBe("CYPHES workflow proof boundary sample")
    expect(substrate.evidence.status).toBe("present")
    expect(substrate.verifier_result.status).toBe("verified")
    expect(substrate.proof_refs.anchor.status).toBe("missing")
    expect(provenance.evidence_present).toBe(true)
    expect(provenance.anchor_status).toBe("missing")
    expect(provenance.verifier_status).toBe("verified")
    expect(provenance.warnings).toEqual([])
    expect(provenance.risk_flags).toEqual([])
  })

  test("credit remains recorded as evidence/result and is not computed as reputation", async () => {
    const summary = await createCapsuleSummary(fixturePath("session-evidence.cyphes-workflow.sample.json"))
    const substrate = createEvidenceCapsuleV0(summary)

    expect(substrate.evidence.summary).toContain("changed file")
    expect(substrate.capsule.sections.find((section) => section.id === "result")?.summary).toContain("internally consistent")
    expect(JSON.stringify(substrate)).not.toContain("reputation")
    expect(JSON.stringify(substrate)).not.toContain("score")
    expect(JSON.stringify(substrate)).not.toContain("aggregate_credit")
  })

  test("credit without verification creates warning and risk flag", async () => {
    const path = fixturePath("session-evidence.cyphes-credit-without-verification.sample.json")
    const workflow = readCyphesWorkflowContext(path)
    const summary = await createCapsuleSummary(path)
    const substrate = createEvidenceCapsuleV0(summary)
    const provenance = createProvenanceSummaryV0(substrate)
    const cyphesFlags = deriveCyphesRiskFlags(workflow)

    expect(workflow.credit_without_verification).toBe(true)
    expect(workflow.verification_present).toBe(false)
    expect(provenance.verifier_status).toBe("verified")
    expect(cyphesFlags.warnings).toContain("CYPHES credit is present without a corresponding verification decision.")
    expect(cyphesFlags.riskFlags).toContain("credit_without_verification")
  })

  test("receipt_root mismatch creates warning and risk flag", async () => {
    const path = fixturePath("session-evidence.cyphes-receipt-root-mismatch.sample.json")
    const summary = await createCapsuleSummary(path)
    const substrate = createEvidenceCapsuleV0(summary)
    const provenance = createProvenanceSummaryV0(substrate)

    expect(substrate.receipt_root.match).toBe(false)
    expect(substrate.receipt_root.status).toBe("mismatch")
    expect(provenance.warnings).toContain("Stored receipt root does not match the recomputed canonical root.")
    expect(provenance.warnings).toContain("Portable verifier reported a mismatch.")
    expect(provenance.risk_flags).toContain("receipt_root_mismatch")
    expect(provenance.risk_flags).toContain("verification_mismatch")
  })

  test("modified contribution hash creates warning and risk flag without changing verifier semantics", async () => {
    const path = fixturePath("session-evidence.cyphes-contribution-hash-mismatch.sample.json")
    const workflow = readCyphesWorkflowContext(path)
    const summary = await createCapsuleSummary(path)
    const substrate = createEvidenceCapsuleV0(summary)
    const provenance = createProvenanceSummaryV0(substrate)
    const cyphesFlags = deriveCyphesRiskFlags(workflow)

    expect(workflow.contribution_hash_mismatch).toBe(true)
    expect(workflow.report_mismatch).toBe(true)
    expect(substrate.verifier_result.status).toBe("verified")
    expect(provenance.verifier_status).toBe("verified")
    expect(cyphesFlags.warnings).toContain("CYPHES contribution hash does not match the referenced verification contribution hash.")
    expect(cyphesFlags.warnings).toContain("CYPHES report summary does not match the referenced contribution hash.")
    expect(cyphesFlags.riskFlags).toContain("contribution_hash_mismatch")
    expect(cyphesFlags.riskFlags).toContain("report_contribution_mismatch")
  })

  test("missing anchor remains local/unanchored and does not fail proof by itself", async () => {
    const summary = await createCapsuleSummary(fixturePath("session-evidence.cyphes-workflow.sample.json"))
    const substrate = createEvidenceCapsuleV0(summary)
    const provenance = createProvenanceSummaryV0(substrate)

    expect(substrate.proof_refs.anchor.status).toBe("missing")
    expect(substrate.verifier_result.ok).toBe(true)
    expect(substrate.verifier_result.status).toBe("verified")
    expect(provenance.anchor_status).toBe("missing")
    expect(provenance.risk_flags).not.toContain("verification_mismatch")
    expect(provenance.risk_flags).not.toContain("receipt_root_mismatch")
  })
})
