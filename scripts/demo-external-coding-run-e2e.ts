import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"
import {
  computeReceiptRoot,
  createCapsuleSummary,
  createEvidenceCapsuleV0,
  createProvenanceSummaryV0,
} from "../src/receiptos"
import { normalizeExternalCodingRunOutput } from "./receiptos-import-producer"

async function runDemo() {
  const sourcePath = resolve("src/receiptos/fixtures/external-coding-run.sample.json")
  const source = JSON.parse(readFileSync(sourcePath, "utf8"))
  const tempDir = mkdtempSync(join(tmpdir(), "receiptos-external-coding-run-e2e-"))

  try {
    console.log("External Coding Run")
    console.log("│")
    console.log("▼ source artifact")
    console.log(JSON.stringify(source, null, 2))

    console.log("│")
    console.log("▼ normalizeExternalCodingRunOutput()")
    const normalized = normalizeExternalCodingRunOutput(source)
    console.log(JSON.stringify(normalized, null, 2))

    console.log("│")
    console.log("▼ computeReceiptRoot()")
    const receiptRoot = computeReceiptRoot(normalized)
    console.log(JSON.stringify({ receipt_root: receiptRoot, stored_receipt_root: normalized.anchor.receipt_root }, null, 2))

    const normalizedPath = resolve(tempDir, "normalized-evidence.json")
    writeFileSync(normalizedPath, JSON.stringify(normalized, null, 2) + "\n")

    console.log("│")
    console.log("▼ createCapsuleSummary()")
    const summary = await createCapsuleSummary(normalizedPath)
    console.log(JSON.stringify(summary, null, 2))

    console.log("│")
    console.log("▼ createEvidenceCapsuleV0()")
    const capsule = createEvidenceCapsuleV0(summary)
    console.log(JSON.stringify(capsule, null, 2))

    console.log("│")
    console.log("▼ createProvenanceSummaryV0()")
    const provenance = createProvenanceSummaryV0(capsule)
    console.log(JSON.stringify(provenance, null, 2))

    console.log("│")
    console.log("▼ artifacts")
    console.log(JSON.stringify({
      source_artifact_path: sourcePath,
      normalized_evidence_path: normalizedPath,
      receipt_root: receiptRoot,
      evidence_capsule_schema: capsule.schema,
      provenance_summary_schema: provenance.schema,
    }, null, 2))
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  runDemo().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
