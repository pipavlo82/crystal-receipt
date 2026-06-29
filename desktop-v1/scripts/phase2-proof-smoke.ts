import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import {
  createCapsuleSummaryFromEvidence,
  createEvidenceCapsuleV0,
  createPortableProofObjectV0,
  createProvenanceSummaryV0,
  type PortableProofObjectV0,
} from "../../src/receiptos"
import { normalizeStealthHandoffOutput } from "../../src/receiptos/adapters/stealth-handoff"

const inputPath = resolve("src/receiptos/fixtures/session-evidence.sample.json")
const outputPath = resolve("desktop-v1/tmp/portable-proof-object-v0.smoke.json")

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  const raw = JSON.parse(readFileSync(inputPath, "utf8"))
  const normalized = normalizeStealthHandoffOutput(raw)
  const summary = await createCapsuleSummaryFromEvidence(normalized, inputPath)
  const capsule = createEvidenceCapsuleV0(summary)
  const provenance = createProvenanceSummaryV0(capsule)
  const proofObject = await createPortableProofObjectV0(normalized, {
    sourceEvidenceRef: inputPath,
  })

  assert(typeof proofObject.receipt_root === "string" && /^0x[0-9a-f]{64}$/.test(proofObject.receipt_root), "Invalid receipt_root")
  assert(proofObject.schema === "receiptos.portable_proof_object.v0", "Invalid portable proof object schema")
  assert(proofObject.proof_system === "ReceiptOS", "Invalid proof_system")
  assert(typeof proofObject.proof_object_id === "string" && proofObject.proof_object_id.length > 0, "Missing proof_object_id")
  assert(Array.isArray(proofObject.project_refs) && proofObject.project_refs.length > 0, "Missing project_refs")
  assert(proofObject.evidence_capsule.schema === "receiptos.evidence_capsule.v0", "Invalid evidence capsule schema")
  assert(proofObject.provenance_summary.schema === "receiptos.provenance_summary.v0", "Invalid provenance summary schema")

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, JSON.stringify(proofObject, null, 2) + "\n")

  const report = {
    command: "bun run desktop-v1/scripts/phase2-proof-smoke.ts",
    inputPath,
    outputPath,
    receipt_root: summary.computed_receipt_root,
    evidence_capsule_schema: capsule.schema,
    provenance_summary_schema: provenance.schema,
    top_level_fields: Object.keys(proofObject satisfies PortableProofObjectV0),
    validation: "ok",
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exit(1)
})
