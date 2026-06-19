import { verifyHandoffReceiptRoot } from "../verify/verify-receipt"
import { verifyLocalMerkleProof } from "../merkle/local-merkle"
import type { HandoffEvidence, LocalMerkleProofAttachment } from "../schema/types"

export type CapsuleStatus =
  | "present"
  | "missing"
  | "valid"
  | "invalid"
  | "pending"
  | "anchored"
  | "verified"
  | "mismatch"
  | "unknown"

export type EvidenceCapsuleSection = {
  id:
    | "payload"
    | "policy_boundary"
    | "authorization"
    | "decision_trace"
    | "execution"
    | "evidence"
    | "counterfactual"
    | "result"
    | "receipt_root"
    | "merkle"
    | "anchor"
    | "replay_manifest"
    | "verifier"
  label: string
  status: CapsuleStatus
  summary: string
  sourceFields: string[]
}

export type EvidenceCapsuleViewModel = {
  schema: string
  session_id: string
  sections: EvidenceCapsuleSection[]
}

export type ProofSurfaceStatus = {
  receipt_root: CapsuleStatus
  merkle: CapsuleStatus
  anchor: CapsuleStatus
  verifier: CapsuleStatus
}

function hasPayload(evidence: HandoffEvidence): boolean {
  return Boolean(evidence.task.title || evidence.task.prompt || evidence.commands.length > 0)
}

function summarizeExecution(evidence: HandoffEvidence): string {
  if (evidence.execution.length === 0) return "No execution records captured."
  const completed = evidence.execution.filter((entry) => entry.status === "completed").length
  const errored = evidence.execution.filter((entry) => entry.status === "error").length
  return `${evidence.execution.length} execution record(s); ${completed} completed, ${errored} error.`
}

function summarizeEvidence(evidence: HandoffEvidence): string {
  return `${evidence.changes.files_changed.length} changed file(s); diff count ${evidence.metadata.diff_count}.`
}

function summarizeDecisionTrace(evidence: HandoffEvidence): string {
  const parts: string[] = []
  if (evidence.task.title) parts.push(`title: ${evidence.task.title}`)
  if (evidence.task.prompt) parts.push("prompt present")
  if (evidence.commands.length > 0) parts.push(`${evidence.commands.length} command(s)`)
  if (evidence.execution.length > 0) parts.push(`${evidence.execution.length} execution step(s)`)
  return parts.length > 0 ? `Decision trace recorded via ${parts.join(", ")}.` : "No explicit decision trace recorded."
}

function summarizeCounterfactual(evidence: HandoffEvidence): string {
  const errored = evidence.execution.filter((entry) => entry.status === "error").length
  if (errored > 0) {
    return `${errored} execution step(s) errored; this is the closest current receipt evidence to denied/counterfactual state.`
  }
  if (evidence.authorization.allowed_actions.length > 0 && evidence.execution.length === 0) {
    return "Authorization rules exist, but no execution record is present; denied-action evidence is not explicit in the current receipt schema."
  }
  return "No explicit denied-action / counterfactual evidence is recorded in the current receipt schema."
}

function summarizeReplayManifest(evidence: HandoffEvidence): string {
  const anchors = [evidence.anchor.receipt_root, evidence.anchor.merkle_root, evidence.anchor.tx_hash].filter(Boolean).length
  return `Replay inputs include session/task context, ${evidence.commands.length} command(s), diff hash state, and ${anchors} anchor reference(s).`
}

function buildMerkleProofAttachment(evidence: HandoffEvidence): LocalMerkleProofAttachment | null {
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

export async function getCapsuleStageStatuses(evidence: HandoffEvidence): Promise<Record<EvidenceCapsuleSection["id"], CapsuleStatus>> {
  const verification = await verifyHandoffReceiptRoot(evidence)
  const merkleProof = buildMerkleProofAttachment(evidence)
  const merkleVerification = merkleProof ? verifyLocalMerkleProof(merkleProof) : null

  return {
    payload: hasPayload(evidence) ? "present" : "missing",
    policy_boundary: evidence.scope.permission !== null || evidence.scope.lease ? "present" : "missing",
    authorization: evidence.authorization.allowed_actions.length > 0 ? "valid" : "present",
    decision_trace: evidence.task.title || evidence.task.prompt || evidence.commands.length > 0 || evidence.execution.length > 0 ? "present" : "missing",
    execution: evidence.execution.length > 0 ? "present" : "missing",
    evidence: evidence.changes.files_changed.length > 0 || evidence.metadata.diff_count > 0 ? "present" : "missing",
    counterfactual: evidence.execution.some((entry) => entry.status === "error")
      ? "invalid"
      : evidence.authorization.allowed_actions.length > 0 && evidence.execution.length === 0
        ? "unknown"
        : "missing",
    result: evidence.commands.some((command) => command.exit_code !== undefined && command.exit_code !== 0) ? "invalid" : "present",
    receipt_root: verification.ok ? "valid" : "mismatch",
    merkle: merkleProof ? (merkleVerification?.ok ? "valid" : "invalid") : "pending",
    anchor: evidence.anchor.onchain_anchor_status === "anchored" ? "anchored" : (evidence.anchor.merkle_proof_status === "attached" ? "pending" : "missing"),
    replay_manifest: evidence.session_id && evidence.directory && evidence.anchor.receipt_root ? "present" : "missing",
    verifier: verification.ok ? "verified" : "mismatch",
  }
}

export async function getProofSurfaceStatus(evidence: HandoffEvidence): Promise<ProofSurfaceStatus> {
  const statuses = await getCapsuleStageStatuses(evidence)
  return {
    receipt_root: statuses.receipt_root,
    merkle: statuses.merkle,
    anchor: statuses.anchor,
    verifier: statuses.verifier,
  }
}

export async function buildEvidenceCapsuleViewModel(evidence: HandoffEvidence): Promise<EvidenceCapsuleViewModel> {
  const statuses = await getCapsuleStageStatuses(evidence)

  return {
    schema: evidence.schema,
    session_id: evidence.session_id,
    sections: [
      {
        id: "payload",
        label: "Payload / Action",
        status: statuses.payload,
        summary: hasPayload(evidence) ? (evidence.task.title ?? evidence.task.prompt ?? `${evidence.commands.length} command(s) captured.`) : "No payload or action prompt captured.",
        sourceFields: ["task.title", "task.prompt", "commands"],
      },
      {
        id: "policy_boundary",
        label: "Policy Boundary",
        status: statuses.policy_boundary,
        summary: evidence.scope.lease ? `Scope lease ${evidence.scope.lease.status} in mode ${evidence.scope.lease.mode}.` : "No scope lease captured.",
        sourceFields: ["scope.permission", "scope.lease"],
      },
      {
        id: "authorization",
        label: "Authorization",
        status: statuses.authorization,
        summary: `${evidence.authorization.allowed_actions.length} allowed action rule(s).`,
        sourceFields: ["authorization.allowed_actions", "authorization.authorization_state_hash", "authorization.authorized_at_execution"],
      },
      {
        id: "decision_trace",
        label: "Decision Trace",
        status: statuses.decision_trace,
        summary: summarizeDecisionTrace(evidence),
        sourceFields: ["task.title", "task.prompt", "commands", "execution", "authorization.authorized_at_execution"],
      },
      {
        id: "execution",
        label: "Execution",
        status: statuses.execution,
        summary: summarizeExecution(evidence),
        sourceFields: ["execution", "commands"],
      },
      {
        id: "evidence",
        label: "Evidence Record",
        status: statuses.evidence,
        summary: summarizeEvidence(evidence),
        sourceFields: ["changes.files_changed", "changes.diff_sha256", "metadata.diff_count", "metadata.message_count"],
      },
      {
        id: "counterfactual",
        label: "Counterfactual / Denied Action",
        status: statuses.counterfactual,
        summary: summarizeCounterfactual(evidence),
        sourceFields: ["authorization.allowed_actions", "execution.status", "commands.exit_code"],
      },
      {
        id: "result",
        label: "Result",
        status: statuses.result,
        summary: evidence.commands.some((command) => command.exit_code !== undefined && command.exit_code !== 0)
          ? "One or more commands exited non-zero."
          : "Recorded result data is internally consistent.",
        sourceFields: ["commands.exit_code", "commands.stdout_summary"],
      },
      {
        id: "receipt_root",
        label: "Receipt Root",
        status: statuses.receipt_root,
        summary: statuses.receipt_root === "valid"
          ? `Stored receipt_root matches recomputed canonical root.`
          : `Stored receipt_root does not match recomputed canonical root.`,
        sourceFields: ["anchor.receipt_root"],
      },
      {
        id: "merkle",
        label: "Merkle Proof",
        status: statuses.merkle,
        summary: statuses.merkle === "valid"
          ? `Local Merkle proof attached and verified.`
          : statuses.merkle === "pending"
            ? `No local Merkle proof attached yet.`
            : `Merkle proof present but invalid.`,
        sourceFields: ["anchor.merkle_proof_status", "anchor.merkle_root", "anchor.merkle_leaf_index", "anchor.merkle_proof"],
      },
      {
        id: "anchor",
        label: "Anchor",
        status: statuses.anchor,
        summary: statuses.anchor === "anchored"
          ? `Evidence is marked as externally anchored.`
          : statuses.anchor === "pending"
            ? `Merkle proof is attached, but no external anchor has been recorded.`
            : `No external anchor recorded.`,
        sourceFields: ["anchor.onchain_anchor_status", "anchor.network", "anchor.contract", "anchor.tx_hash"],
      },
      {
        id: "replay_manifest",
        label: "Replay Manifest",
        status: statuses.replay_manifest,
        summary: summarizeReplayManifest(evidence),
        sourceFields: ["session_id", "directory", "task", "commands", "changes.diff_sha256", "anchor.receipt_root", "anchor.merkle_root", "anchor.tx_hash", "metadata.generated_by"],
      },
      {
        id: "verifier",
        label: "Verifier",
        status: statuses.verifier,
        summary: statuses.verifier === "verified"
          ? `Portable verifier confirmed the receipt root.`
          : `Portable verifier detected a receipt root mismatch.`,
        sourceFields: ["anchor.verifier_status", "anchor.receipt_root"],
      },
    ],
  }
}
