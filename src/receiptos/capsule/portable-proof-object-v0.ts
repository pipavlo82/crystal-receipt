import { basename } from "node:path"
import type { HandoffEvidence } from "../schema/types"
import {
  createCapsuleSummaryFromEvidence,
  createEvidenceCapsuleV0,
  createProvenanceSummaryV0,
  type EvidenceCapsuleV0,
  type ProvenanceSummaryV0,
} from "./evidence-capsule-v0"

export type PortableProofObjectV0 = {
  schema: "receiptos.portable_proof_object.v0"
  proof_object_id: string
  proof_system: "ReceiptOS"
  receipt_root: string
  proof_ref: string
  replay_ref: string | null
  anchor_ref: string | null
  created_at: string
  relation_type: "imported"
  project_refs: string[]
  source_evidence_ref: string
  producer: {
    runtime: string
    agent_id: string | null
    generated_by: string | null
    source_schema: string
  }
  metadata: {
    label: string
    session_id: string
    directory: string
    position_id: string
  }
  evidence_capsule: EvidenceCapsuleV0
  provenance_summary: ProvenanceSummaryV0
}

function toIsoFromUnixSeconds(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null
}

function deriveCreatedAt(evidence: HandoffEvidence) {
  const completed = evidence.execution
    .map((item) => toIsoFromUnixSeconds(item.completed_timestamp))
    .filter((value): value is string => typeof value === "string")
    .sort((a, b) => a.localeCompare(b))
  return completed[completed.length - 1]
    ?? toIsoFromUnixSeconds(evidence.authorization.authorization_checked_at)
    ?? new Date(0).toISOString()
}

function deriveLabel(evidence: HandoffEvidence) {
  return evidence.task.title?.trim()
    || evidence.task.prompt?.trim()
    || `Portable proof object for ${evidence.session_id}`
}

function deriveProofObjectId(receiptRoot: string) {
  return `proofobj-${receiptRoot.replace(/^0x/, "")}`
}

function deriveReplayRef(evidence: HandoffEvidence) {
  return evidence.session_id ? `receiptos://replay/${encodeURIComponent(evidence.session_id)}` : null
}

function deriveAnchorRef(evidence: HandoffEvidence) {
  return evidence.anchor.tx_hash ? `receiptos://anchor/${encodeURIComponent(evidence.anchor.tx_hash)}` : null
}

function deriveProjectRef(evidence: HandoffEvidence) {
  const raw = basename(evidence.directory || evidence.session_id || "unpositioned").trim().toLowerCase()
  const normalized = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return normalized || "unpositioned"
}

export async function createPortableProofObjectV0(
  evidence: HandoffEvidence,
  options?: { sourceEvidenceRef?: string },
): Promise<PortableProofObjectV0> {
  const sourceEvidenceRef = options?.sourceEvidenceRef ?? `inline:${basename(evidence.directory || evidence.session_id || "evidence")}`
  const summary = await createCapsuleSummaryFromEvidence(evidence, sourceEvidenceRef)

  if (!summary.receipt_root) {
    throw new Error("Cannot emit portable_proof_object.v0 without a stored receipt_root")
  }

  const evidenceCapsule = createEvidenceCapsuleV0(summary)
  const provenanceSummary = createProvenanceSummaryV0(evidenceCapsule)
  const proofObjectId = deriveProofObjectId(summary.receipt_root)
  const projectRef = deriveProjectRef(evidence)

  return {
    schema: "receiptos.portable_proof_object.v0",
    proof_object_id: proofObjectId,
    proof_system: "ReceiptOS",
    receipt_root: summary.receipt_root,
    proof_ref: `receiptos://portable-proof-object/${proofObjectId}`,
    replay_ref: deriveReplayRef(evidence),
    anchor_ref: deriveAnchorRef(evidence),
    created_at: deriveCreatedAt(evidence),
    relation_type: "imported",
    project_refs: [projectRef],
    source_evidence_ref: sourceEvidenceRef,
    producer: {
      runtime: evidence.agent.runtime,
      agent_id: evidence.agent.id ?? null,
      generated_by: evidence.metadata.generated_by ?? null,
      source_schema: evidence.schema,
    },
    metadata: {
      label: deriveLabel(evidence),
      session_id: evidence.session_id,
      directory: evidence.directory,
      position_id: projectRef,
    },
    evidence_capsule: evidenceCapsule,
    provenance_summary: provenanceSummary,
  }
}
