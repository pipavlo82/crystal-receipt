import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  runExportPortableProofObjectV0,
} from "../../scripts/export-portable-proof-object-v0"
import type { PortableProofObjectV0 } from "../../src/receiptos"

function fixturePath(name: string) {
  return resolve(import.meta.dir, "../../src/receiptos/fixtures", name)
}

describe("portable proof object export cli", () => {
  test("CLI exports Chronicle-ready portable proof object from Stealth evidence", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "receiptos-portable-proof-export-"))
    const inputPath = fixturePath("session-evidence.sample.json")
    const outputPath = join(tempDir, "portable-proof-object-v0.json")

    try {
      await runExportPortableProofObjectV0([inputPath, outputPath])

      expect(existsSync(outputPath)).toBe(true)
      const exported = JSON.parse(readFileSync(outputPath, "utf8")) as PortableProofObjectV0
      expect(exported.schema).toBe("receiptos.portable_proof_object.v0")
      expect(exported.proof_system).toBe("ReceiptOS")
      expect(exported.proof_object_id).toMatch(/^proofobj-/)
      expect(exported.receipt_root).toMatch(/^0x[0-9a-f]{64}$/)
      expect(exported.evidence_capsule.schema).toBe("receiptos.evidence_capsule.v0")
      expect(exported.provenance_summary.schema).toBe("receiptos.provenance_summary.v0")
      expect(exported.source_evidence_ref).toBe(inputPath)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
