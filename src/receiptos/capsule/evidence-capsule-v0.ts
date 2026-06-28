import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { buildCrystalReceiptMapping } from "./crystal-mapping"
import { buildEvidenceCapsuleViewModel } from "./evidence-capsule"
import { buildRenderPlanFromCapsule } from "./render-plan"
import { computeReceiptRoot } from "../canon/receipt-root"
import { verifyLocalMerkleProof } from "../merkle/local-merkle"
import { verifyHandoffReceiptRoot } from "../verify/verify-receipt"
import type {
  EvidenceCapsuleSection,
  EvidenceCapsuleViewModel,
} from "./evidence-capsule"
import type { HandoffEvidence, LocalMerkleProofAttachment } from "../schema/types"

export type CapsuleSummary = {
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
    sections: EvidenceCapsuleViewModel["sections"]
  }
  crystal_mapping: Awaited<ReturnType<typeof buildCrystalReceiptMapping>>
  render_plan: ReturnType<typeof buildRenderPlanFromCapsule>
}

export type EvidenceCapsuleV0 = {
  schema: "receiptos.evidence_capsule.v0"
  action: {
    summary: string
    source_fields: string[]
  }
  evidence: {
    summary: string
    source_fields: string[]
    status: string
  }
  receipt_root: {
    stored: string
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
    sections: EvidenceCapsuleSection[]
  }
  replay_manifest: {
    summary: string
    source_fields: string[]
  }
}

export type ProvenanceSummaryV0 = {
  schema: "receiptos.provenance_summary.v0"
  version: "v0"
  what_happened: string
  evidence_present: boolean
  verifier_status: EvidenceCapsuleV0["verifier_result"]["status"]
  receipt_root_status: EvidenceCapsuleV0["receipt_root"]["status"]
  anchor_status: EvidenceCapsuleV0["proof_refs"]["anchor"]["status"]
  replay_status: EvidenceCapsuleSection["status"]
  warnings: string[]
  risk_flags: string[]
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

function getSection(sections: EvidenceCapsuleSection[], id: EvidenceCapsuleSection["id"]) {
  return sections.find((section) => section.id === id)
}

export async function createCapsuleSummaryFromEvidence(evidence: HandoffEvidence, sourceEvidence = "inline:evidence"): Promise<CapsuleSummary> {
  const verification = await verifyHandoffReceiptRoot(evidence)
  const merkleAttachment = buildLocalMerkleAttachment(evidence)
  const merkleVerification = merkleAttachment ? verifyLocalMerkleProof(merkleAttachment) : null
  const capsule = await buildEvidenceCapsuleViewModel(evidence)
  const crystalMapping = await buildCrystalReceiptMapping(evidence)
  const renderPlan = buildRenderPlanFromCapsule(capsule)
  const computedReceiptRoot = computeReceiptRoot(evidence)

  return {
    schema: "receiptos.capsule_summary.v0",
    source_evidence: sourceEvidence,
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
    render_plan: renderPlan,
  }
}

export async function createCapsuleSummary(evidencePath: string): Promise<CapsuleSummary> {
  const sourcePath = resolve(evidencePath)
  const evidence = JSON.parse(readFileSync(sourcePath, "utf8")) as HandoffEvidence
  return createCapsuleSummaryFromEvidence(evidence, sourcePath)
}

export function createEvidenceCapsuleV0(summary: CapsuleSummary): EvidenceCapsuleV0 {
  const action = getSection(summary.capsule.sections, "payload")
  const evidence = getSection(summary.capsule.sections, "evidence")
  const anchor = getSection(summary.capsule.sections, "anchor")
  const replay = getSection(summary.capsule.sections, "replay_manifest") ?? {
    summary: "Replay manifest derived from current capsule summary.",
    sourceFields: ["source_evidence", "receipt_root", "computed_receipt_root", "capsule.sections"],
  }

  if (!summary.receipt_root) {
    throw new Error("Cannot emit evidence-capsule.v0.json without a stored receipt_root")
  }
  if (!action || !evidence) {
    throw new Error("Cannot emit evidence-capsule.v0.json without payload and evidence capsule sections")
  }

  return {
    schema: "receiptos.evidence_capsule.v0",
    action: {
      summary: action.summary,
      source_fields: action.sourceFields,
    },
    evidence: {
      summary: evidence.summary,
      source_fields: evidence.sourceFields,
      status: evidence.status,
    },
    receipt_root: {
      stored: summary.receipt_root,
      computed: summary.computed_receipt_root,
      match: summary.receipt_root === summary.computed_receipt_root,
      status: summary.receipt_verification.status,
    },
    proof_refs: {
      merkle: {
        present: summary.local_merkle.present,
        status: summary.local_merkle.status,
      },
      anchor: {
        status: (anchor?.status as EvidenceCapsuleV0["proof_refs"]["anchor"]["status"] | undefined) ?? "unknown",
      },
    },
    verifier_result: {
      ok: summary.receipt_verification.ok,
      status: summary.receipt_verification.status,
    },
    capsule: {
      sections: summary.capsule.sections,
    },
    replay_manifest: {
      summary: replay.summary,
      source_fields: replay.sourceFields,
    },
  }
}

export function createProvenanceSummaryV0(substrate: EvidenceCapsuleV0): ProvenanceSummaryV0 {
  const replaySection = getSection(substrate.capsule.sections, "replay_manifest")
  const warnings: string[] = []
  const riskFlags: string[] = []

  if (substrate.evidence.status === "missing") {
    warnings.push("Evidence record is missing or incomplete.")
    riskFlags.push("missing_evidence")
  }

  if (substrate.receipt_root.status === "missing") {
    warnings.push("Stored receipt root is missing.")
    riskFlags.push("missing_receipt_root")
  } else if (substrate.receipt_root.status === "mismatch") {
    warnings.push("Stored receipt root does not match the recomputed canonical root.")
    riskFlags.push("receipt_root_mismatch")
  }

  if (substrate.verifier_result.status === "missing") {
    warnings.push("Verifier result is missing.")
    riskFlags.push("missing_verifier_result")
  } else if (substrate.verifier_result.status === "mismatch") {
    warnings.push("Portable verifier reported a mismatch.")
    riskFlags.push("verification_mismatch")
  }

  if (substrate.proof_refs.merkle.present && substrate.proof_refs.merkle.status === "invalid") {
    warnings.push("Local Merkle proof is present but invalid.")
    riskFlags.push("invalid_local_merkle_proof")
  }

  if ((replaySection?.status ?? "missing") === "missing") {
    warnings.push("Replay manifest is incomplete or missing.")
    riskFlags.push("missing_replay_manifest")
  }

  return {
    schema: "receiptos.provenance_summary.v0",
    version: "v0",
    what_happened: substrate.action.summary,
    evidence_present: substrate.evidence.status !== "missing",
    verifier_status: substrate.verifier_result.status,
    receipt_root_status: substrate.receipt_root.status,
    anchor_status: substrate.proof_refs.anchor.status,
    replay_status: replaySection?.status ?? "missing",
    warnings,
    risk_flags: riskFlags,
  }
}
