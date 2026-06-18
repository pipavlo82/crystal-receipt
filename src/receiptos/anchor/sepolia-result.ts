import type {
  HandoffEvidence,
  ImportedAnchorResult,
  SepoliaAnchorOverlay,
} from "../schema/types"

type HandoffEvidenceWithAnchor = HandoffEvidence & {
  anchor?: {
    merkle_root?: string | null
  }
}

function normalizeRoot(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`)
  }
  const root = value.toLowerCase()
  if (!/^0x[0-9a-f]{64}$/.test(root)) {
    throw new Error(`invalid ${label}: ${value}`)
  }
  return root
}

function normalizeAddress(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`)
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`invalid ${label}: ${value}`)
  }
  return value
}

function normalizeTxHash(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`)
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(`invalid ${label}: ${value}`)
  }
  return value
}

function normalizeChainId(value: unknown): string {
  if (value === 11155111 || value === "11155111") return "11155111"
  throw new Error(`invalid chainId: expected 11155111, got ${JSON.stringify(value)}`)
}

export function importSepoliaAnchorResult(
  evidence: HandoffEvidenceWithAnchor,
  raw: unknown,
): SepoliaAnchorOverlay {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("anchor result must be a JSON object")
  }

  const value = raw as ImportedAnchorResult

  if (value.network !== "sepolia") {
    throw new Error(`invalid network: expected "sepolia", got ${JSON.stringify(value.network)}`)
  }

  normalizeChainId(value.chainId)

  const contractAddress = normalizeAddress(value.contractAddress, "contractAddress")
  const txHash = normalizeTxHash(value.txHash, "txHash")
  const importedRoot = normalizeRoot(value.receiptRoot, "receiptRoot")
  const expectedMerkleRoot = normalizeRoot(evidence.anchor?.merkle_root, "anchor.merkle_root")

  if (importedRoot !== expectedMerkleRoot) {
    throw new Error(`imported receiptRoot does not match anchor.merkle_root: ${importedRoot} != ${expectedMerkleRoot}`)
  }

  if (value.event != null) {
    if (typeof value.event !== "object" || Array.isArray(value.event)) {
      throw new Error("event must be an object when present")
    }
    if (value.event.name !== undefined && value.event.name !== "ReceiptAnchored") {
      throw new Error(`invalid event.name: expected "ReceiptAnchored", got ${JSON.stringify(value.event.name)}`)
    }
    if (value.event.receiptRoot !== undefined) {
      const eventRoot = normalizeRoot(value.event.receiptRoot, "event.receiptRoot")
      if (eventRoot !== expectedMerkleRoot) {
        throw new Error(`event.receiptRoot does not match anchor.merkle_root: ${eventRoot} != ${expectedMerkleRoot}`)
      }
    }
  }

  return {
    onchain_anchor_status: "anchored",
    network: "sepolia",
    contract: contractAddress,
    tx_hash: txHash,
  }
}

export { normalizeRoot, normalizeAddress, normalizeTxHash, normalizeChainId }
