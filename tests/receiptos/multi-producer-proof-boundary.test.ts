import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import {
  createCapsuleSummary,
  createEvidenceCapsuleV0,
  createProvenanceSummaryV0,
} from "../../src/receiptos"
import type { HandoffEvidence } from "../../src/receiptos"

function fixturePath(name: string) {
  return `src/receiptos/fixtures/${name}`
}

function readEvidence(name: string): HandoffEvidence {
  return JSON.parse(readFileSync(fixturePath(name), "utf8")) as HandoffEvidence
}

const producers = [
  {
    id: "stealth-handoff",
    fixture: "session-evidence.with-local-merkle.sample.json",
    sourceKind: "stealth",
  },
  {
    id: "cyphes-workflow",
    fixture: "session-evidence.cyphes-workflow.sample.json",
    sourceKind: "cyphes",
  },
  {
    id: "generic-tool-run",
    fixture: "session-evidence.generic-tool-run.sample.json",
    sourceKind: "generic",
  },
] as const

describe("multi-producer proof boundary", () => {
  for (const producer of producers) {
    test(`${producer.id} builds shared summary, capsule, and provenance outputs`, async () => {
      const summary = await createCapsuleSummary(fixturePath(producer.fixture))
      const substrate = createEvidenceCapsuleV0(summary)
      const provenance = createProvenanceSummaryV0(substrate)

      expect(summary.schema).toBe("receiptos.capsule_summary.v0")
      expect(substrate.schema).toBe("receiptos.evidence_capsule.v0")
      expect(provenance.schema).toBe("receiptos.provenance_summary.v0")
      expect(provenance.version).toBe("v0")

      expect(substrate.receipt_root.stored).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(substrate.receipt_root.computed).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(["verified", "mismatch", "missing"]).toContain(substrate.receipt_root.status)

      expect(typeof substrate.verifier_result.ok).toBe("boolean")
      expect(["verified", "mismatch", "missing"]).toContain(substrate.verifier_result.status)

      expect(typeof substrate.proof_refs.merkle.present).toBe("boolean")
      expect(["valid", "invalid", "missing", "pending"]).toContain(substrate.proof_refs.merkle.status)
      expect(["anchored", "pending", "missing", "unknown"]).toContain(substrate.proof_refs.anchor.status)

      expect(["verified", "mismatch", "missing"]).toContain(provenance.verifier_status)
      expect(["verified", "mismatch", "missing"]).toContain(provenance.receipt_root_status)
      expect(["anchored", "pending", "missing", "unknown"]).toContain(provenance.anchor_status)
      expect(Array.isArray(provenance.warnings)).toBe(true)
      expect(Array.isArray(provenance.risk_flags)).toBe(true)
    })
  }

  test("producer-specific source shapes differ while the proof boundary stays stable", async () => {
    const stealthEvidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    const cyphesEvidence = readEvidence("session-evidence.cyphes-workflow.sample.json")
    const genericEvidence = readEvidence("session-evidence.generic-tool-run.sample.json")

    expect(stealthEvidence.task.prompt).toBe("Verify portable receipt_root parity.")
    expect(cyphesEvidence.task.prompt?.startsWith("CYPHES_WORKFLOW:")).toBe(true)
    expect(genericEvidence.task.prompt?.startsWith("CYPHES_WORKFLOW:")).toBe(false)

    const [stealth, cyphes, generic] = await Promise.all([
      createCapsuleSummary(fixturePath("session-evidence.with-local-merkle.sample.json")),
      createCapsuleSummary(fixturePath("session-evidence.cyphes-workflow.sample.json")),
      createCapsuleSummary(fixturePath("session-evidence.generic-tool-run.sample.json")),
    ])

    const outputs = [stealth, cyphes, generic].map((summary) => ({
      capsule: createEvidenceCapsuleV0(summary),
      provenance: createProvenanceSummaryV0(createEvidenceCapsuleV0(summary)),
    }))

    for (const output of outputs) {
      expect(Object.keys(output.capsule)).toEqual([
        "schema",
        "action",
        "evidence",
        "receipt_root",
        "proof_refs",
        "verifier_result",
        "capsule",
        "replay_manifest",
      ])
      expect(Object.keys(output.provenance)).toEqual([
        "schema",
        "version",
        "what_happened",
        "evidence_present",
        "verifier_status",
        "receipt_root_status",
        "anchor_status",
        "replay_status",
        "warnings",
        "risk_flags",
      ])
    }
  })

  test("generic producer does not need producer-specific parsing or producer-specific proof fields", async () => {
    const summary = await createCapsuleSummary(fixturePath("session-evidence.generic-tool-run.sample.json"))
    const substrate = createEvidenceCapsuleV0(summary)
    const provenance = createProvenanceSummaryV0(substrate)
    const serializedCapsule = JSON.stringify(substrate)
    const serializedProvenance = JSON.stringify(provenance)

    expect(substrate.action.summary).toBe("Generic tool-run execution proof sample")
    expect(substrate.verifier_result.status).toBe("verified")
    expect(substrate.proof_refs.anchor.status).toBe("missing")
    expect(serializedCapsule).not.toContain("CYPHES_WORKFLOW")
    expect(serializedCapsule).not.toContain("campaign")
    expect(serializedCapsule).not.toContain("credit")
    expect(serializedCapsule).not.toContain("reputation")
    expect(serializedCapsule).not.toContain("score")
    expect(serializedProvenance).not.toContain("CYPHES_WORKFLOW")
    expect(serializedProvenance).not.toContain("credit")
    expect(serializedProvenance).not.toContain("reputation")
    expect(serializedProvenance).not.toContain("score")
  })
})
