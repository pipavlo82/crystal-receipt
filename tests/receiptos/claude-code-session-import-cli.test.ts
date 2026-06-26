import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  normalizeClaudeCodeSessionOutput,
  runReceiptosImportProducer,
} from "../../scripts/receiptos-import-producer"
import { computeReceiptRoot } from "../../src/receiptos/canon/receipt-root"

function fixturePath(name: string) {
  return resolve(import.meta.dir, "../../src/receiptos/fixtures", name)
}

describe("claude code session import cli", () => {
  test("CLI runs on sample Claude Code session output and writes all proof artifacts", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "receiptos-claude-code-session-"))
    const inputPath = fixturePath("claude-code-session.sample.json")

    try {
      await runReceiptosImportProducer([
        "--producer",
        "claude-code-session",
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

  test("normalization maps Claude Code session fields into the shared ReceiptOS evidence shape", () => {
    const source = JSON.parse(readFileSync(fixturePath("claude-code-session.sample.json"), "utf8"))
    const normalized = normalizeClaudeCodeSessionOutput(source)

    expect(normalized.schema).toBe("stealth.session.evidence.v1")
    expect(normalized.agent.id).toBe("claude-code")
    expect(normalized.agent.runtime).toBe("claude/code")
    expect(normalized.metadata.generated_by).toBe("claude.code.session.v0")
    expect(normalized.task.title).toBe(source.task.title)
    expect(normalized.commands[0].command).toBe("bun test tests/receiptos")
    expect(normalized.execution.some((record) => record.tool === "exec")).toBe(true)
  })

  test("Claude Code session roots are anchor-independent", () => {
    const source = JSON.parse(readFileSync(fixturePath("claude-code-session.sample.json"), "utf8"))
    const normalized = normalizeClaudeCodeSessionOutput(source)
    const { anchor, ...withoutAnchor } = normalized
    const withFakeAnchor = {
      ...withoutAnchor,
      anchor: {
        receipt_root: "0x" + "f".repeat(64),
        merkle_proof_status: "attached",
        merkle_root: "0x" + "a".repeat(64),
        merkle_leaf_index: 4,
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

  test("Claude Code import keeps shared capsule/provenance schemas without producer-specific schema leakage", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "receiptos-claude-code-session-shared-"))
    const inputPath = fixturePath("claude-code-session.sample.json")

    try {
      await runReceiptosImportProducer([
        "--producer",
        "claude-code-session",
        "--input",
        inputPath,
        "--out",
        tempDir,
      ])

      const substrate = JSON.parse(readFileSync(join(tempDir, "evidence-capsule.v0.json"), "utf8"))
      const provenance = JSON.parse(readFileSync(join(tempDir, "provenance-summary.v0.json"), "utf8"))
      const serialized = JSON.stringify({ substrate, provenance })

      expect(substrate.schema).toBe("receiptos.evidence_capsule.v0")
      expect(provenance.schema).toBe("receiptos.provenance_summary.v0")
      expect(serialized).not.toContain("claude.code.session.v0")
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
