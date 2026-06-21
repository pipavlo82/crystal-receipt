import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { createCapsuleSummary, runReceiptosCapsuleDemo } from "../../scripts/receiptos-capsule-demo"

function fixturePath(name: string) {
  return resolve(import.meta.dir, "../../src/receiptos/fixtures", name)
}

describe("receiptos capsule demo cli", () => {
  test("CLI/script can read the local Merkle fixture and write summary plus schema-v0 JSON", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "receiptos-capsule-demo-"))
    const outPath = join(tempDir, "capsule-summary.json")
    const v0Path = join(tempDir, "evidence-capsule.v0.json")
    const renderPlanPath = join(tempDir, "render-plan.v0.json")

    try {
      await runReceiptosCapsuleDemo([
        "--evidence",
        fixturePath("session-evidence.with-local-merkle.sample.json"),
        "--out",
        outPath,
      ])

      expect(existsSync(outPath)).toBe(true)
      expect(existsSync(v0Path)).toBe(true)
      expect(existsSync(renderPlanPath)).toBe(true)
      const summary = JSON.parse(readFileSync(outPath, "utf8"))
      const substrate = JSON.parse(readFileSync(v0Path, "utf8"))
      const renderPlan = JSON.parse(readFileSync(renderPlanPath, "utf8"))
      expect(summary.schema).toBe("receiptos.capsule_summary.v0")
      expect(summary.receipt_verification.ok).toBe(true)
      expect(summary.local_merkle.ok).toBe(true)
      expect(summary.capsule.sections.map((section: { id: string }) => section.id)).toEqual([
        "payload",
        "policy_boundary",
        "authorization",
        "decision_trace",
        "execution",
        "evidence",
        "counterfactual",
        "result",
        "receipt_root",
        "merkle",
        "anchor",
        "replay_manifest",
        "verifier",
      ])
      expect(Object.keys(summary.crystal_mapping)).toEqual([
        "core",
        "inner_ring",
        "facets",
        "outer_shell",
        "anchor_edge",
        "seal",
      ])
      expect(summary.render_plan.schema).toBe("receiptos.render_plan.v0")
      expect(renderPlan).toEqual(summary.render_plan)
      expect(Object.keys(substrate)).toEqual([
        "schema",
        "action",
        "evidence",
        "receipt_root",
        "proof_refs",
        "verifier_result",
        "capsule",
        "replay_manifest",
      ])
      expect(substrate.receipt_root.stored).toBe(summary.receipt_root)
      expect(substrate.receipt_root.computed).toBe(summary.computed_receipt_root)
      expect(substrate.verifier_result.ok).toBe(summary.receipt_verification.ok)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test("script fails gracefully on tampered fixture", async () => {
    const summary = await createCapsuleSummary(fixturePath("session-evidence.tampered.sample.json"))
    expect(summary.receipt_verification.ok).toBe(false)
    expect(summary.receipt_verification.status).toBe("mismatch")
  })

  test("script does not mutate input evidence file and generated summary does not change receipt_root semantics", async () => {
    const evidencePath = fixturePath("session-evidence.with-local-merkle.sample.json")
    const before = readFileSync(evidencePath, "utf8")
    const summary = await createCapsuleSummary(evidencePath)
    const after = readFileSync(evidencePath, "utf8")

    expect(after).toBe(before)
    expect(summary.receipt_root).toBe(summary.computed_receipt_root)
  })
})
