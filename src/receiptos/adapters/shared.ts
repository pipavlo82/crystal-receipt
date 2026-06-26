import { computeReceiptRoot, type HandoffEvidence } from "../index"

export function buildDefaultAnchor(receiptRoot: string): HandoffEvidence["anchor"] {
  return {
    receipt_root: receiptRoot,
    merkle_proof_status: "not attached",
    merkle_root: null,
    merkle_leaf_index: null,
    merkle_proof: [],
    onchain_anchor_status: "not anchored",
    network: "local/off-chain",
    contract: null,
    tx_hash: null,
    verifier_status: "not verified",
  }
}

export function normalizeAllowedActions(actions: string[], target: string) {
  return actions.map((action) => ({
    permission: action,
    pattern: target,
    action,
  }))
}

export function attachReceiptRoot(normalizedWithoutAnchor: Omit<HandoffEvidence, "anchor">): HandoffEvidence {
  const receiptRoot = computeReceiptRoot({ ...normalizedWithoutAnchor, anchor: undefined } as HandoffEvidence)
  return {
    ...normalizedWithoutAnchor,
    anchor: buildDefaultAnchor(receiptRoot),
  }
}

export function parseUnixTimestamp(value: string): number {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid timestamp: ${value}`)
  }
  return Math.floor(timestamp / 1000)
}
