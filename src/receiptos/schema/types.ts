export type HandoffEvidenceCommand = {
  command: string
  exit_code?: number
  stdout_summary?: string
}

export type HandoffAuthorizationAction = {
  permission: string
  pattern: string
  action: string
}

export type HandoffExecutionRecord = {
  call_id: string
  tool: string
  action_performed: string
  target: string
  execution_timestamp: number
  completed_timestamp: number
  status: "completed" | "error"
  scope_match: boolean | null
}

export type HandoffAnchorProof = {
  receipt_root: string
  merkle_proof_status: "not attached" | "attached"
  merkle_root: string | null
  merkle_leaf_index: number | null
  merkle_proof: string[]
  onchain_anchor_status: "not anchored"
  network: "local/off-chain"
  contract: string | null
  tx_hash: string | null
  verifier_status: "not verified"
}

export type HandoffEvidence = {
  schema: "stealth.session.evidence.v1"
  session_id: string
  directory: string
  task: {
    title?: string
    prompt?: string
  }
  agent: {
    id?: string
    runtime: "Stealth"
  }
  scope: {
    permission: unknown | null
    lease?: {
      id: string
      mode: "read_only" | "edit" | "execute"
      target: string
      allowed_actions: HandoffAuthorizationAction[]
      issued_at: number | null
      expires_at: number | null
      status: "active" | "missing" | "expired"
    }
  }
  authorization: {
    delegation_ref: string | null
    delegator: string | null
    agent_operator: string | null
    target: string
    allowed_actions: HandoffAuthorizationAction[]
    authorization_valid_from: number | null
    authorization_expiry: number | null
    authorization_checked_at: number
    authorization_state_hash: string
    authorized_at_execution: boolean | null
  }
  execution: HandoffExecutionRecord[]
  commands: HandoffEvidenceCommand[]
  changes: {
    files_changed: string[]
    diff_sha256: string | null
  }
  anchor: HandoffAnchorProof
  metadata: {
    message_count: number
    diff_count: number
    generated_by: "stealth.handoff.evidence.builder.v1"
  }
}

export type HandoffReceiptVerification = {
  ok: boolean
  receipt_root: string | null
  recomputed_root: string | null
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

export type SepoliaAnchorOverlay = {
  onchain_anchor_status: "anchored"
  network: "sepolia"
  contract: string
  tx_hash: string
}

export type ImportedAnchorEvent = {
  name?: unknown
  receiptRoot?: unknown
  metadataURI?: unknown
  publisher?: unknown
}

export type ImportedAnchorResult = {
  network?: unknown
  chainId?: unknown
  contractAddress?: unknown
  txHash?: unknown
  receiptRoot?: unknown
  metadataURI?: unknown
  event?: ImportedAnchorEvent | null
}
