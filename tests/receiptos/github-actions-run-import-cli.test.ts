import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  normalizeGitHubActionsRunOutput,
  runReceiptosImportProducer,
} from "../../scripts/receiptos-import-producer"
import { computeReceiptRoot } from "../../src/receiptos/canon/receipt-root"

function fixturePath(name: string) {
  return resolve(import.meta.dir, "../../src/receiptos/fixtures", name)
}

describe("github actions run import cli", () => {
  test("CLI runs on sample GitHub Actions run output and writes all proof artifacts", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "receiptos-github-actions-run-"))
    const inputPath = fixturePath("github-actions-run.sample.json")

    try {
      await runReceiptosImportProducer([
        "--producer",
        "github-actions",
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
      const substrate = JSON.parse(readFileSync(substratePath, "utf8"))
      const provenance = JSON.parse(readFileSync(provenancePath, "utf8"))

      expect(normalized.schema).toBe("stealth.session.evidence.v1")
      expect(normalized.agent.runtime).toBe("github/actions")
      expect(normalized.metadata.generated_by).toBe("github.actions_run.v0")
      expect(substrate.schema).toBe("receiptos.evidence_capsule.v0")
      expect(provenance.schema).toBe("receiptos.provenance_summary.v0")
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test("normalization maps GitHub Actions fields into the shared ReceiptOS evidence shape", () => {
    const source = JSON.parse(readFileSync(fixturePath("github-actions-run.sample.json"), "utf8"))
    const normalized = normalizeGitHubActionsRunOutput(source)

    expect(source.schema).toBe("github.actions_run.v0")
    expect(normalized.schema).toBe("stealth.session.evidence.v1")
    expect(normalized.session_id).toBe("gha-run-1234567890-job-987654321")
    expect(normalized.directory).toBe(source.repository)
    expect(normalized.task.title).toBe("GitHub Actions CI / receiptos-tests")
    expect(normalized.agent.id).toBe("github-actions")
    expect(normalized.agent.runtime).toBe("github/actions")
    expect(normalized.metadata.generated_by).toBe("github.actions_run.v0")
    expect(normalized.commands.some((command: { command: string }) => command.command === "bun test tests/receiptos")).toBe(true)
    expect(normalized.execution[0].tool).toBe("github-actions-step")
    expect(normalized.changes.files_changed).toEqual([])
    expect(JSON.stringify(normalized)).not.toContain("CYPHES_WORKFLOW")
  })

  test("GitHub Actions roots are anchor-independent", () => {
    const source = JSON.parse(readFileSync(fixturePath("github-actions-run.sample.json"), "utf8"))
    const normalized = normalizeGitHubActionsRunOutput(source)
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

  test("GitHub Actions import keeps shared capsule/provenance schemas without producer-specific schema leakage", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "receiptos-github-actions-run-shared-"))
    const inputPath = fixturePath("github-actions-run.sample.json")

    try {
      await runReceiptosImportProducer([
        "--producer",
        "github-actions",
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
      expect(serialized).not.toContain("github.actions_run.v0")
      expect(serialized).not.toContain("workflow.run_id")
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
