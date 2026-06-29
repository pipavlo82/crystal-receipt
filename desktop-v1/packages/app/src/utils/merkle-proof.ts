import type { HandoffEvidence } from "@/pages/session/handoff"

type HandoffEvidenceWithAnchor = HandoffEvidence & {
  anchor?: {
    receipt_root?: string | null
    merkle_proof_status?: string | null
    merkle_root?: string | null
    merkle_leaf_index?: number | null
    merkle_proof?: string[]
    onchain_anchor_status?: string | null
    network?: string | null
    contract?: string | null
    tx_hash?: string | null
    verifier_status?: string | null
  }
}

export type LocalMerkleProofAttachment = {
  receipt_root: string
  merkle_root: string
  merkle_leaf_index: number
  merkle_proof: string[]
  merkle_proof_status: "attached"
  onchain_anchor_status: "not anchored"
  network: string
  contract: null
  tx_hash: null
  verifier_status?: null
}

export type LocalMerkleVerification = {
  ok: boolean
  merkle_root: string | null
  recomputed_root: string | null
  merkle_leaf_index: number | null
  merkle_proof_count: number
}

export function attachLocalMerkleProof(evidence: HandoffEvidenceWithAnchor): LocalMerkleProofAttachment {
  const receiptRoot = evidence.anchor?.receipt_root

  if (!receiptRoot) {
    throw new Error("Missing anchor.receipt_root")
  }

  return {
    receipt_root: receiptRoot,
    merkle_root: receiptRoot,
    merkle_leaf_index: 0,
    merkle_proof: [],
    merkle_proof_status: "attached",
    onchain_anchor_status: "not anchored",
    network: "local/off-chain",
    contract: null,
    tx_hash: null,
  }
}

export function applyLocalMerkleProofToEvidence(
  evidence: HandoffEvidenceWithAnchor,
  proof: LocalMerkleProofAttachment,
): HandoffEvidenceWithAnchor {
  return {
    ...evidence,
    anchor: {
      ...(evidence.anchor ?? {}),
      merkle_proof_status: proof.merkle_proof_status,
      merkle_root: proof.merkle_root,
      merkle_leaf_index: proof.merkle_leaf_index,
      merkle_proof: [...proof.merkle_proof],
      onchain_anchor_status: proof.onchain_anchor_status,
      network: proof.network,
      contract: proof.contract,
      tx_hash: proof.tx_hash,
      verifier_status: evidence.anchor?.verifier_status ?? null,
    },
  }
}

export function verifyLocalMerkleProof(proof: LocalMerkleProofAttachment): LocalMerkleVerification {
  const ok = proof.merkle_leaf_index === 0 && proof.merkle_proof.length === 0 && proof.merkle_root === proof.receipt_root

  return {
    ok,
    merkle_root: proof.merkle_root,
    recomputed_root: proof.receipt_root,
    merkle_leaf_index: proof.merkle_leaf_index,
    merkle_proof_count: proof.merkle_proof.length,
  }
}
