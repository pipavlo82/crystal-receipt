import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  normalizeClaudeCodeSessionOutput,
  parseClaudeCodeJsonlSession,
  runReceiptosImportProducer,
} from "../../scripts/receiptos-import-producer"
import { computeReceiptRoot } from "../../src/receiptos/canon/receipt-root"

function fixturePath(name: string) {
  return resolve(import.meta.dir, "../../src/receiptos/fixtures", name)
}

describe("claude code session jsonl import cli", () => {
  test("CLI runs on sample Claude Code JSONL session and writes all proof artifacts", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "receiptos-claude-code-jsonl-"))
    const inputPath = fixturePath("claude-code-session.sample.jsonl")

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

  test("JSONL normalization derives task, execution, and command data into the shared ReceiptOS evidence shape", () => {
    const sourceText = readFileSync(fixturePath("claude-code-session.sample.jsonl"), "utf8")
    const wrapped = parseClaudeCodeJsonlSession(sourceText, {
      project: "crystal-receipt",
      sessionId: "claude-code-session-jsonl-001",
      workspace: "/repo/crystal-receipt",
      sourcePath: fixturePath("claude-code-session.sample.jsonl"),
    })
    const normalized = normalizeClaudeCodeSessionOutput(wrapped)

    expect(normalized.schema).toBe("stealth.session.evidence.v1")
    expect(normalized.agent.runtime).toBe("claude/code")
    expect(normalized.metadata.generated_by).toBe("claude.code.session.v0")
    expect(normalized.task.prompt).toBe("Requested a small ReceiptOS adapter implementation.")
    expect(normalized.execution.length).toBeGreaterThan(0)
    expect(normalized.commands.some((command) => command.command === "bun test tests/receiptos")).toBe(true)
  })

  test("JSONL-derived Claude Code roots are anchor-independent", () => {
    const sourceText = readFileSync(fixturePath("claude-code-session.sample.jsonl"), "utf8")
    const wrapped = parseClaudeCodeJsonlSession(sourceText)
    const normalized = normalizeClaudeCodeSessionOutput(wrapped)
    const { anchor, ...withoutAnchor } = normalized
    const withFakeAnchor = {
      ...withoutAnchor,
      anchor: {
        receipt_root: "0x" + "f".repeat(64),
        merkle_proof_status: "attached",
        merkle_root: "0x" + "a".repeat(64),
        merkle_leaf_index: 6,
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

  test("invalid JSONL reports the failing line number", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "receiptos-claude-code-bad-jsonl-"))
    const badPath = resolve(tempDir, "bad-session.jsonl")

    try {
      writeFileSync(badPath, '{"type":"message","role":"user","summary":"ok"}\n{not-json}\n')
      expect(() => parseClaudeCodeJsonlSession(readFileSync(badPath, "utf8"), { sourcePath: badPath })).toThrow("Invalid JSONL at line 2")
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
