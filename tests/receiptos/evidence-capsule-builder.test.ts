import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  createCapsuleSummary,
  createEvidenceCapsuleV0,
  createProvenanceSummaryV0,
} from "../../src/receiptos"
import type { EvidenceCapsuleV0 } from "../../src/receiptos"

function fixturePath(name: string) {
  return resolve(import.meta.dir, "../../src/receiptos/fixtures", name)
}

function examplePath(name: string) {
  return resolve(import.meta.dir, "../../examples/receipt-examples", name)
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

describe("receiptos evidence capsule builder extraction", () => {
  test("shared builder reproduces the current clean local proof substrate exactly", async () => {
    const summary = await createCapsuleSummary(fixturePath("session-evidence.with-local-merkle.sample.json"))
    const substrate = createEvidenceCapsuleV0(summary)
    const expected = readJson<EvidenceCapsuleV0>(examplePath("clean-local-proof/evidence-capsule.v0.json"))

    expect(substrate).toEqual(expected)
  })

  test("provenance summary is deterministic for the same substrate", async () => {
    const summary = await createCapsuleSummary(fixturePath("session-evidence.with-local-merkle.sample.json"))
    const substrate = createEvidenceCapsuleV0(summary)

    expect(createProvenanceSummaryV0(substrate)).toEqual(createProvenanceSummaryV0(substrate))
  })

  test("tampered mismatch example emits mismatch warning and risk flag", async () => {
    const summary = await createCapsuleSummary(fixturePath("session-evidence.tampered.sample.json"))
    const substrate = createEvidenceCapsuleV0(summary)
    const provenance = createProvenanceSummaryV0(substrate)

    expect(provenance.verifier_status).toBe("mismatch")
    expect(provenance.receipt_root_status).toBe("mismatch")
    expect(provenance.warnings).toContain("Stored receipt root does not match the recomputed canonical root.")
    expect(provenance.warnings).toContain("Portable verifier reported a mismatch.")
    expect(provenance.risk_flags).toContain("receipt_root_mismatch")
    expect(provenance.risk_flags).toContain("verification_mismatch")
  })

  test("clean local proof example reports OK verification and local proof status", async () => {
    const summary = await createCapsuleSummary(fixturePath("session-evidence.with-local-merkle.sample.json"))
    const substrate = createEvidenceCapsuleV0(summary)
    const provenance = createProvenanceSummaryV0(substrate)

    expect(provenance.evidence_present).toBe(true)
    expect(provenance.verifier_status).toBe("verified")
    expect(provenance.receipt_root_status).toBe("verified")
    expect(provenance.anchor_status).toBe("pending")
    expect(substrate.proof_refs.merkle.status).toBe("valid")
    expect(provenance.warnings).toEqual([])
    expect(provenance.risk_flags).toEqual([])
  })

  test("anchored example reports anchored status when available", () => {
    const substrate = readJson<EvidenceCapsuleV0>(examplePath("anchored-proof/evidence-capsule.v0.json"))
    const provenance = createProvenanceSummaryV0(substrate)

    expect(provenance.anchor_status).toBe("anchored")
    expect(provenance.verifier_status).toBe("verified")
  })
})
