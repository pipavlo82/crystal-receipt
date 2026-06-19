import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { createCapsuleSummary, createEvidenceCapsuleV0 } from "./receiptos-capsule-demo"

type VerifyResult = {
  schema: "receiptos.verify_result.v0"
  source_evidence: string
  receipt_root: {
    stored: string | null
    computed: string
    match: boolean
    status: "verified" | "mismatch" | "missing"
  }
  proof_refs: {
    merkle: {
      present: boolean
      status: "valid" | "invalid" | "missing" | "pending"
    }
    anchor: {
      status: "anchored" | "pending" | "missing" | "unknown"
    }
  }
  verifier_result: {
    ok: boolean
    status: "verified" | "mismatch" | "missing"
  }
  capsule: {
    sections: ReturnType<typeof createEvidenceCapsuleV0>["capsule"]["sections"]
  }
  replay_manifest: ReturnType<typeof createEvidenceCapsuleV0>["replay_manifest"]
}

function parseArgs(argv: string[]) {
  let evidence: string | undefined
  let out: string | undefined
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--evidence") evidence = argv[index + 1]
    if (arg === "--out") out = argv[index + 1]
  }
  if (!evidence) throw new Error("Usage: bun scripts/receiptos-verify.ts --evidence <path> [--out <path>]")
  return { evidence, out }
}

export async function createVerifyResult(evidencePath: string): Promise<VerifyResult> {
  const summary = await createCapsuleSummary(evidencePath)
  const substrate = createEvidenceCapsuleV0(summary)
  return {
    schema: "receiptos.verify_result.v0",
    source_evidence: resolve(evidencePath),
    receipt_root: {
      stored: summary.receipt_root,
      computed: summary.computed_receipt_root,
      match: summary.receipt_root === summary.computed_receipt_root,
      status: summary.receipt_verification.status,
    },
    proof_refs: substrate.proof_refs,
    verifier_result: substrate.verifier_result,
    capsule: substrate.capsule,
    replay_manifest: substrate.replay_manifest,
  }
}

export async function runReceiptosVerify(argv: string[]) {
  const { evidence, out } = parseArgs(argv)
  const result = await createVerifyResult(evidence)
  if (!out) {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  const outPath = resolve(out)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n")
  console.log(outPath)
}

if (import.meta.main) {
  runReceiptosVerify(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
