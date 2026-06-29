import type { HandoffEvidence } from "@/pages/session/handoff"

export type SepoliaAnchorPayload = {
  schema: "stealth.receipt_anchor.onchain_payload.v1"
  receipt_root: string
  merkle_root: string
  merkle_leaf_index: number
  merkle_proof: string[]
  merkle_proof_status: "attached"
  anchor_target: "onchain"
  network: "sepolia"
  hash: "sha256(left || right)"
}

type HandoffEvidenceWithAnchor = HandoffEvidence & {
  anchor?: {
    receipt_root?: string | null
    merkle_root?: string | null
    merkle_leaf_index?: number | null
    merkle_proof?: string[]
    merkle_proof_status?: string | null
  }
}

function normalizeRoot(value: string, label: string): string {
  const root = value.toLowerCase()
  if (!/^0x[0-9a-f]{64}$/.test(root)) {
    throw new Error(`invalid ${label}: ${value}`)
  }
  return root
}

export function prepareSepoliaAnchorPayload(evidence: HandoffEvidenceWithAnchor): SepoliaAnchorPayload {
  const anchor = evidence.anchor

  if (!anchor) {
    throw new Error("missing anchor object")
  }
  if (anchor.merkle_proof_status !== "attached") {
    throw new Error("merkle proof must be attached before preparing Sepolia payload")
  }
  if (!anchor.receipt_root) {
    throw new Error("missing anchor.receipt_root")
  }
  if (!anchor.merkle_root) {
    throw new Error("missing anchor.merkle_root")
  }
  const leafIndex = anchor.merkle_leaf_index
  if (typeof leafIndex !== "number" || !Number.isInteger(leafIndex) || leafIndex < 0) {
    throw new Error("invalid anchor.merkle_leaf_index")
  }
  const normalizedLeafIndex: number = leafIndex
  if (!Array.isArray(anchor.merkle_proof)) {
    throw new Error("anchor.merkle_proof must be an array")
  }

  return {
    schema: "stealth.receipt_anchor.onchain_payload.v1",
    receipt_root: normalizeRoot(anchor.receipt_root, "receipt_root"),
    merkle_root: normalizeRoot(anchor.merkle_root, "merkle_root"),
    merkle_leaf_index: normalizedLeafIndex,
    merkle_proof: anchor.merkle_proof.map((entry, index) => normalizeRoot(entry, `merkle_proof[${index}]`)),
    merkle_proof_status: "attached",
    anchor_target: "onchain",
    network: "sepolia",
    hash: "sha256(left || right)",
  }
}
