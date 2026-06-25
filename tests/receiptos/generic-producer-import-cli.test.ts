import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { normalizeGenericProducerOutput, runReceiptosImportProducer } from "../../scripts/receiptos-import-producer"
import { computeReceiptRoot } from "../../src/receiptos/canon/receipt-root"

function fixturePath(name: string) {
  return resolve(import.meta.dir, "../../src/receiptos/fixtures", name)
}

describe("generic producer import cli", () => {
  test("CLI runs on sample producer output and writes all proof artifacts", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "receiptos-import-producer-"))
    const inputPath = fixturePath("generic-producer-output.sample.json")

    try {
      await runReceiptosImportProducer([
        "--producer",
        "generic",
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

      const normalized = JSON.parse(readFileSync(normalizedPath, "utf8"))
      const summary = JSON.parse(readFileSync(summaryPath, "utf8"))
      const substrate = JSON.parse(readFileSync(substratePath, "utf8"))
      const provenance = JSON.parse(readFileSync(provenancePath, "utf8"))

      expect(normalized.schema).toBe("stealth.session.evidence.v1")
      expect(normalized.agent.runtime).toBe("generic-producer-import")
      expect(normalized.metadata.generated_by).toBe("receiptos.generic_producer_import.v0")
      expect(substrate.schema).toBe("receiptos.evidence_capsule.v0")
      expect(provenance.schema).toBe("receiptos.provenance_summary.v0")
      expect(substrate.receipt_root.stored).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(substrate.receipt_root.match).toBe(true)
      expect(["verified", "mismatch", "missing"]).toContain(substrate.receipt_root.status)
      expect(substrate.verifier_result.ok).toBe(true)
      expect(substrate.verifier_result.status).toBe("verified")
      expect(["anchored", "pending", "missing", "unknown"]).toContain(substrate.proof_refs.anchor.status)
      expect(summary.receipt_verification.ok).toBe(true)
      expect(summary.receipt_root).toBe(summary.computed_receipt_root)

      const serializedOutput = JSON.stringify({ normalized, substrate, provenance })
      expect(serializedOutput).not.toContain("CYPHES_WORKFLOW")
      expect(serializedOutput).not.toContain("reputation")
      expect(serializedOutput).not.toContain("score")
      expect(serializedOutput).not.toContain("settlement")
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test("normalization does not require producer-side Stealth or CYPHES fields", () => {
    const source = JSON.parse(readFileSync(fixturePath("generic-producer-output.sample.json"), "utf8"))
    const normalized = normalizeGenericProducerOutput(source)

    expect(source.producer).toBe("generic")
    expect(source.action.tool).toBe("exec")
    expect(source.task).toBeUndefined()
    expect(JSON.stringify(source)).not.toContain("CYPHES_WORKFLOW")
    expect(JSON.stringify(source)).not.toContain("stealth.session.evidence.v1")

    expect(normalized.schema).toBe("stealth.session.evidence.v1")
    expect(normalized.anchor.receipt_root).toMatch(/^0x[a-fA-F0-9]{64}$/)
  })

  test("generic producer import roots are anchor-independent", () => {
    const source = JSON.parse(readFileSync(fixturePath("generic-producer-output.sample.json"), "utf8"))
    const normalized = normalizeGenericProducerOutput(source)
    const { anchor, ...withoutAnchor } = normalized
    const withFakeAnchor = {
      ...withoutAnchor,
      anchor: {
        receipt_root: "0x" + "f".repeat(64),
        merkle_proof_status: "attached",
        merkle_root: "0x" + "a".repeat(64),
        merkle_leaf_index: 7,
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
})
