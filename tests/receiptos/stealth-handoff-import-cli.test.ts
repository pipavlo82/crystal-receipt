import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  normalizeStealthHandoffOutput,
  runReceiptosImportProducer,
} from "../../scripts/receiptos-import-producer"
import { computeReceiptRoot } from "../../src/receiptos/canon/receipt-root"

function fixturePath(name: string) {
  return resolve(import.meta.dir, "../../src/receiptos/fixtures", name)
}

describe("stealth handoff import cli", () => {
  test("CLI runs on existing Stealth handoff evidence and writes all proof artifacts", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "receiptos-stealth-handoff-"))
    const inputPath = fixturePath("session-evidence.sample.json")

    try {
      await runReceiptosImportProducer([
        "--producer",
        "stealth-handoff",
        "--input",
        inputPath,
        "--out",
        tempDir,
      ])

      const normalizedPath = join(tempDir, "normalized-evidence.json")
      const summaryPath = join(tempDir, "capsule-summary.json")
      const substratePath = join(tempDir, "evidence-capsule.v0.json")
      const provenancePath = join(tempDir, "provenance-summary.v0.json")

      expect(existsSync(normalizedPath)).toBe(true)
      expect(existsSync(summaryPath)).toBe(true)
      expect(existsSync(substratePath)).toBe(true)
      expect(existsSync(provenancePath)).toBe(true)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test("normalization passes through Stealth handoff evidence unchanged", () => {
    const source = JSON.parse(readFileSync(fixturePath("session-evidence.sample.json"), "utf8"))
    const normalized = normalizeStealthHandoffOutput(source)

    expect(normalized.schema).toBe("stealth.session.evidence.v1")
    expect(normalized.session_id).toBe(source.session_id)
    expect(normalized.agent.runtime).toBe(source.agent.runtime)
    expect(normalized.metadata.generated_by).toBe(source.metadata.generated_by)
    expect(normalized.task.title).toBe(source.task.title)
  })

  test("Stealth handoff roots are anchor-independent", () => {
    const source = JSON.parse(readFileSync(fixturePath("session-evidence.sample.json"), "utf8"))
    const normalized = normalizeStealthHandoffOutput(source)
    const { anchor, ...withoutAnchor } = normalized
    const withFakeAnchor = {
      ...withoutAnchor,
      anchor: {
        receipt_root: "0x" + "f".repeat(64),
        merkle_proof_status: "attached",
        merkle_root: "0x" + "a".repeat(64),
        merkle_leaf_index: 3,
        merkle_proof: ["0x" + "b".repeat(64)],
        onchain_anchor_status: "anchored",
        network: "sepolia",
        contract: "0x" + "1".repeat(40),
        tx_hash: "0x" + "2".repeat(64),
        verifier_status: "verified",
      },
    }

    expect(computeReceiptRoot(withoutAnchor)).toBe(computeReceiptRoot(withFakeAnchor))
    expect(computeReceiptRoot(withFakeAnchor)).toBe(normalized.anchor.receipt_root)
  })

  test("Stealth handoff import keeps shared capsule/provenance schemas without producer-specific schema leakage", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "receiptos-stealth-handoff-shared-"))
    const inputPath = fixturePath("session-evidence.sample.json")

    try {
      await runReceiptosImportProducer([
        "--producer",
        "stealth-handoff",
        "--input",
        inputPath,
        "--out",
        tempDir,
      ])

      const substrate = JSON.parse(readFileSync(join(tempDir, "evidence-capsule.v0.json"), "utf8"))
      const provenance = JSON.parse(readFileSync(join(tempDir, "provenance-summary.v0.json"), "utf8"))

      expect(substrate.schema).toBe("receiptos.evidence_capsule.v0")
      expect(provenance.schema).toBe("receiptos.provenance_summary.v0")
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
