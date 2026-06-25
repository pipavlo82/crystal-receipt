import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"
import {
  computeReceiptRoot,
  createCapsuleSummary,
  createEvidenceCapsuleV0,
  createProvenanceSummaryV0,
} from "../src/receiptos"
import { normalizeGenericProducerOutput } from "./receiptos-import-producer"

const demoProducerOutput = {
  producer: "generic" as const,
  run_id: "demo-generic-run-001",
  workspace: "/demo/workspace",
  action: {
    title: "Demo generic producer import",
    prompt: "Show the full ReceiptOS external producer integration path.",
    tool: "exec",
    command: "bun test tests/receiptos/generic-producer-import-cli.test.ts",
    target: "tests/receiptos/generic-producer-import-cli.test.ts",
  },
  timing: {
    started_at: 1735689600,
    completed_at: 1735689660,
  },
  result: {
    status: "completed" as const,
    exit_code: 0,
    stdout_summary: "1 focused generic producer import regression test passed.",
  },
  evidence: {
    files_changed: ["tests/receiptos/generic-producer-import-cli.test.ts"],
    diff_sha256: "8b7f6d3f4d20c9d7a9c08f31ac2d93f4d6c0f34e9db3e54a808f7ab6f0b9a123",
  },
  metadata: {
    message_count: 4,
    diff_count: 1,
    producer_id: "generic-demo-producer",
  },
}

async function runDemo() {
  const tempDir = mkdtempSync(join(tmpdir(), "receiptos-external-producer-e2e-"))

  try {
    console.log("Generic Producer")
    console.log("│")
    console.log("▼ normalizeGenericProducerOutput()")
    const normalized = normalizeGenericProducerOutput(demoProducerOutput)
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
      normalized_evidence_path: normalizedPath,
      normalized_evidence: JSON.parse(readFileSync(normalizedPath, "utf8")),
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
