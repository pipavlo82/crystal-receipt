import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import {
  buildCrystalReceiptMapping,
  buildEvidenceCapsuleViewModel,
  computeReceiptRoot,
  stripAnchor,
  verifyHandoffReceiptRoot,
  verifyLocalMerkleProof,
} from "../src/receiptos"
import type { HandoffEvidence, LocalMerkleProofAttachment } from "../src/receiptos"

type CapsuleSummary = {
  schema: "receiptos.capsule_summary.v0"
  source_evidence: string
  receipt_root: string | null
  computed_receipt_root: string
  receipt_verification: {
    ok: boolean
    status: "verified" | "mismatch" | "missing"
  }
  local_merkle: {
    present: boolean
    ok: boolean
    status: "valid" | "invalid" | "missing" | "pending"
  }
  capsule: {
    sections: Awaited<ReturnType<typeof buildEvidenceCapsuleViewModel>>["sections"]
  }
  crystal_mapping: Awaited<ReturnType<typeof buildCrystalReceiptMapping>>
}

function parseArgs(argv: string[]) {
  let evidence: string | undefined
  let out: string | undefined

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--evidence") evidence = argv[index + 1]
    if (arg === "--out") out = argv[index + 1]
  }

  if (!evidence || !out) {
    throw new Error("Usage: bun scripts/receiptos-capsule-demo.ts --evidence <path> --out <path>")
  }

  return { evidence, out }
}

function buildLocalMerkleAttachment(evidence: HandoffEvidence): LocalMerkleProofAttachment | null {
  if (evidence.anchor.merkle_proof_status !== "attached") return null
  if (!evidence.anchor.receipt_root) return null
  if (!evidence.anchor.merkle_root) return null
  if (typeof evidence.anchor.merkle_leaf_index !== "number") return null
  if (!Array.isArray(evidence.anchor.merkle_proof)) return null

  return {
    receipt_root: evidence.anchor.receipt_root,
    merkle_root: evidence.anchor.merkle_root,
    merkle_leaf_index: evidence.anchor.merkle_leaf_index,
    merkle_proof: evidence.anchor.merkle_proof,
    merkle_proof_status: "attached",
    onchain_anchor_status: "not anchored",
    network: evidence.anchor.network,
    contract: evidence.anchor.contract,
    tx_hash: evidence.anchor.tx_hash,
  }
}

export async function createCapsuleSummary(evidencePath: string): Promise<CapsuleSummary> {
  const sourcePath = resolve(evidencePath)
  const evidence = JSON.parse(readFileSync(sourcePath, "utf8")) as HandoffEvidence
  const verification = await verifyHandoffReceiptRoot(evidence)
  const merkleAttachment = buildLocalMerkleAttachment(evidence)
  const merkleVerification = merkleAttachment ? verifyLocalMerkleProof(merkleAttachment) : null
  const capsule = await buildEvidenceCapsuleViewModel(evidence)
  const crystalMapping = await buildCrystalReceiptMapping(evidence)
  const computedReceiptRoot = computeReceiptRoot(stripAnchor(evidence))

  return {
    schema: "receiptos.capsule_summary.v0",
    source_evidence: sourcePath,
    receipt_root: evidence.anchor?.receipt_root ?? null,
    computed_receipt_root: computedReceiptRoot,
    receipt_verification: {
      ok: verification.ok,
      status: verification.receipt_root === null ? "missing" : verification.ok ? "verified" : "mismatch",
    },
    local_merkle: {
      present: merkleAttachment !== null,
      ok: merkleVerification?.ok ?? false,
      status: merkleAttachment === null
        ? (evidence.anchor.merkle_proof_status === "attached" ? "pending" : "missing")
        : merkleVerification?.ok ? "valid" : "invalid",
    },
    capsule: {
      sections: capsule.sections,
    },
    crystal_mapping: crystalMapping,
  }
}

export async function runReceiptosCapsuleDemo(argv: string[]) {
  const { evidence, out } = parseArgs(argv)
  const summary = await createCapsuleSummary(evidence)
  const outPath = resolve(out)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(summary, null, 2) + "\n")
  console.log(outPath)
}

if (import.meta.main) {
  runReceiptosCapsuleDemo(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
