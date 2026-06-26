import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  normalizeCodexSessionOutput,
  runReceiptosImportProducer,
} from "../../scripts/receiptos-import-producer"
import { computeReceiptRoot } from "../../src/receiptos/canon/receipt-root"

function fixturePath(name: string) {
  return resolve(import.meta.dir, "../../src/receiptos/fixtures", name)
}

describe("codex session import cli", () => {
  test("CLI runs on sample Codex session output and writes all proof artifacts", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "receiptos-codex-session-"))
    const inputPath = fixturePath("codex-session.sample.json")

    try {
      await runReceiptosImportProducer([
        "--producer",
        "codex-session",
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

  test("normalization maps Codex session fields into the shared ReceiptOS evidence shape", () => {
    const source = JSON.parse(readFileSync(fixturePath("codex-session.sample.json"), "utf8"))
    const normalized = normalizeCodexSessionOutput(source)

    expect(normalized.schema).toBe("stealth.session.evidence.v1")
    expect(normalized.agent.id).toBe("codex")
    expect(normalized.agent.runtime).toBe("openai/codex")
    expect(normalized.metadata.generated_by).toBe("codex.session.v0")
    expect(normalized.task.title).toBe(source.task.title)
    expect(normalized.execution.map((record) => record.tool)).toEqual(expect.arrayContaining(["read", "edit", "exec"]))
    expect(normalized.commands.some((command) => command.command === "bun test tests/receiptos")).toBe(true)
    expect(normalized.commands.some((command) => command.exit_code === 0)).toBe(true)
  })

  test("Codex session roots are anchor-independent", () => {
    const source = JSON.parse(readFileSync(fixturePath("codex-session.sample.json"), "utf8"))
    const normalized = normalizeCodexSessionOutput(source)
    const { anchor, ...withoutAnchor } = normalized
    const withFakeAnchor = {
      ...withoutAnchor,
      anchor: {
        receipt_root: "0x" + "f".repeat(64),
        merkle_proof_status: "attached",
        merkle_root: "0x" + "a".repeat(64),
        merkle_leaf_index: 5,
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

  test("Codex import keeps shared capsule/provenance schemas without producer-specific schema leakage", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "receiptos-codex-session-shared-"))
    const inputPath = fixturePath("codex-session.sample.json")

    try {
      await runReceiptosImportProducer([
        "--producer",
        "codex-session",
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
      expect(serialized).not.toContain("codex.session.v0")
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test("malformed codex.session.v0 fails closed instead of producing near-empty evidence", () => {
    expect(() => normalizeCodexSessionOutput({
      schema: "codex.session.v0",
      session_id: "bad-codex-session",
      project: "crystal-receipt",
      workspace: "/repo/crystal-receipt",
      runtime: {
        producer_id: "codex",
        generated_by: "codex.session.v0",
      },
      task: {
        title: "Bad Codex session",
        prompt_summary: "Missing event types.",
      },
      events: [
        {
          tool: "exec",
          exit_code: 0,
        },
      ],
      summary: {
        status: "completed",
        message_count: 0,
        tool_call_count: 0,
        command_count: 0,
        files_changed: [],
        diff_sha256: null,
      },
    } as never)).toThrow("codex.session.v0 event missing type")
  })
})
