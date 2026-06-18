export * from "./schema/types"
export { AuthorizationActionSchema, ExecutionRecordSchema, AnchorProofSchema, HandoffEvidenceSchema } from "./schema/evidence"
export { canonicalize } from "./canon/canonicalize"
export { computeReceiptRoot, sha256, stripAnchor } from "./canon/receipt-root"
export { verifyHandoffReceiptRoot } from "./verify/verify-receipt"
export { attachLocalMerkleProof, applyLocalMerkleProofToEvidence, verifyLocalMerkleProof } from "./merkle/local-merkle"
export { prepareSepoliaAnchorPayload } from "./anchor/sepolia-payload"
export { importSepoliaAnchorResult, normalizeRoot, normalizeAddress, normalizeTxHash, normalizeChainId } from "./anchor/sepolia-result"
export {
  buildEvidenceCapsuleViewModel,
  getCapsuleStageStatuses,
  getProofSurfaceStatus,
  type CapsuleStatus,
  type EvidenceCapsuleSection,
  type EvidenceCapsuleViewModel,
  type ProofSurfaceStatus,
} from "./capsule/evidence-capsule"
export { buildCrystalReceiptMapping, type CrystalReceiptMapping } from "./capsule/crystal-mapping"
