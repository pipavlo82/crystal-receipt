import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  normalizeExternalCodingRunOutput,
  runReceiptosImportProducer,
} from "../../scripts/receiptos-import-producer"
import { computeReceiptRoot } from "../../src/receiptos/canon/receipt-root"

function fixturePath(name: string) {
  return resolve(import.meta.dir, "../../src/receiptos/fixtures", name)
}

describe("external coding-run import cli", () => {
  test("CLI runs on sample external coding-run output and writes all proof artifacts", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "receiptos-external-coding-run-"))
    const inputPath = fixturePath("external-coding-run.sample.json")

    try {
      await runReceiptosImportProducer([
        "--producer",
        "external-coding-run",
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
      expect(normalized.agent.id).toBe("external-coding-agent")
      expect(normalized.agent.runtime).toBe("external/coding-agent")
      expect(normalized.metadata.generated_by).toBe("external.coding_run.v0")
      expect(normalized.authorization.allowed_actions.map((item: { action: string }) => item.action)).toEqual(["read", "write", "test"])
      expect(substrate.schema).toBe("receiptos.evidence_capsule.v0")
      expect(provenance.schema).toBe("receiptos.provenance_summary.v0")
      expect(substrate.receipt_root.match).toBe(true)
      expect(substrate.verifier_result.status).toBe("verified")
      expect(summary.receipt_root).toBe(summary.computed_receipt_root)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test("normalization maps external coding-run fields into the shared ReceiptOS evidence shape", () => {
    const source = JSON.parse(readFileSync(fixturePath("external-coding-run.sample.json"), "utf8"))
    const normalized = normalizeExternalCodingRunOutput(source)

    expect(source.schema).toBe("external.coding_run.v0")
    expect(normalized.schema).toBe("stealth.session.evidence.v1")
    expect(normalized.task.title).toBe(source.task.title)
    expect(normalized.task.prompt).toBe(source.task.prompt_summary)
    expect(normalized.agent.id).toBe(source.producer.id)
    expect(normalized.agent.runtime).toBe(source.producer.runtime)
    expect(normalized.metadata.generated_by).toBe(source.producer.generated_by)
    expect(normalized.commands[0].command).toBe(source.execution.commands[0].command)
    expect(normalized.execution[0].tool).toBe(source.execution.tool_calls[0].tool)
    expect(normalized.changes.files_changed).toEqual(source.evidence.files_changed)
    expect(normalized.changes.diff_sha256).toBe(source.evidence.diff_sha256)
  })

  test("external coding-run roots are anchor-independent", () => {
    const source = JSON.parse(readFileSync(fixturePath("external-coding-run.sample.json"), "utf8"))
    const normalized = normalizeExternalCodingRunOutput(source)
    const { anchor, ...withoutAnchor } = normalized
    const withFakeAnchor = {
      ...withoutAnchor,
      anchor: {
        receipt_root: "0x" + "f".repeat(64),
        merkle_proof_status: "attached",
        merkle_root: "0x" + "a".repeat(64),
        merkle_leaf_index: 9,
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
