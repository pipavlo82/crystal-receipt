// RSF ISOLATED PRIMITIVES ONLY — positions 5, 6, 7, and 8 of the 28-position
// evaluation order in
// docs/RECURSIVE_SINGLETON_FOLD_REFERENCE_PACKAGE_V0_WORKING_DRAFT.md §12.
//
// Covered, each as an independent, non-chaining primitive:
//   position 5 — source_evidence shape (`HandoffEvidence`, §6 step 5)
//   position 6 — source_proof_object shape (`PortableProofObjectV0`, §6 step 6)
//   position 7 — claimed_source_entry shape (`chronicle_entry.v0`, §6 step 7)
//   position 8 — receipt-root prerequisite and independent recomputation
//                (§6 steps 8-9)
//
// Not covered by this module, deliberately:
//   positions 1-4 (already implemented in evaluation-input-shape.ts),
//   positions 9-28 (cross-object consistency, proof-object identity, proof
//   reference, the Chronicle admission gate call, reconstructed-entry
//   equality, source-entry content commitment, declarations, semantic
//   statement, inclusion set, eligibility, transition, breakdown, aggregate
//   identity, final aggregate validation). This module does not call
//   `createChronicleEntryV0`, does not perform cross-object consistency, does
//   not derive proof-object identity or proof reference, does not
//   reconstruct the source entry, and does not derive
//   `source_entry_content_commitment`. It is not the RSF evaluator and is
//   not wired into any evaluator.
//
// Each exported checker accepts only its position-owned subject (plus, for
// position 8, the position-5-validated `HandoffEvidence` value it must
// operate on) and returns synchronously. Checkers never call one another and
// never run a later position.

import { HandoffEvidenceSchema } from "../schema/evidence"
import type { HandoffEvidence } from "../schema/types"
import type { PortableProofObjectV0 } from "../capsule/portable-proof-object-v0"
import type { EvidenceCapsuleV0, ProvenanceSummaryV0 } from "../capsule/evidence-capsule-v0"
import type { EvidenceCapsuleSection, CapsuleStatus } from "../capsule/evidence-capsule"
import { CHRONICLE_ENTRY_VERSION_V0, type ChronicleEntryV0 } from "../capsule/chronicle-portfolio-v0"
import { computeReceiptRoot } from "../canon/receipt-root"

export type SourceEvidenceCheckFinding = {
  schema: "recursive_singleton_fold_finding.v0"
  code: "malformed_source_evidence"
  check_position: 5
}

export type PortableProofObjectCheckFinding = {
  schema: "recursive_singleton_fold_finding.v0"
  code: "malformed_portable_proof_object"
  check_position: 6
}

export type ClaimedSourceEntryCheckFinding = {
  schema: "recursive_singleton_fold_finding.v0"
  code: "malformed_source_entry"
  check_position: 7
}

export type SourceAdmissionReceiptRootFindingCode =
  | "source_admission_prerequisite_unavailable"
  | "source_receipt_root_mismatch"

export type SourceAdmissionReceiptRootCheckFinding = {
  schema: "recursive_singleton_fold_finding.v0"
  code: SourceAdmissionReceiptRootFindingCode
  check_position: 8
}

export type CheckSourceEvidenceResult =
  | { success: true; value: HandoffEvidence }
  | { success: false; finding: SourceEvidenceCheckFinding }

export type CheckPortableProofObjectResult =
  | { success: true; value: PortableProofObjectV0 }
  | { success: false; finding: PortableProofObjectCheckFinding }

export type CheckClaimedSourceEntryResult =
  | { success: true; value: ChronicleEntryV0 }
  | { success: false; finding: ClaimedSourceEntryCheckFinding }

// Position 8's only success output: the receipt root independently verified
// by this position (claimed root recomputes). Nothing else from §6 steps
// 10-14 is performed or retained here.
export type CheckSourceAdmissionReceiptRootResult =
  | { success: true; value: { verifiedReceiptRoot: string } }
  | { success: false; finding: SourceAdmissionReceiptRootCheckFinding }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// Deep-snapshots a validated JSON-domain value so a success result never
// aliases the caller-owned object graph. Every value reaching this point has
// already passed exact-shape validation (only plain objects, arrays,
// strings, booleans, numbers, and null), so `structuredClone` cannot
// encounter an unsupported type; if it somehow did, its native
// `DataCloneError` correctly surfaces as an implementation failure rather
// than a fabricated RSF finding.
function snapshot<T>(value: T): T {
  return structuredClone(value)
}

function hasExactOwnKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const ownKeys = Object.keys(value)
  if (ownKeys.length !== keys.length) return false
  return keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isNullOrString(value: unknown): value is string | null {
  return value === null || isString(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

// ---------------------------------------------------------------------------
// Position 5 — source_evidence shape (`HandoffEvidence`)
// ---------------------------------------------------------------------------

// Isolated position-5 primitive only. Does not run positions 1-4 or 6-28,
// does not accept the seven-field evaluation input or the source-admission
// bundle, and does not accept an expected value, package identity, or any
// external source. Reuses the repository's existing, already-normative
// `HandoffEvidenceSchema` shape validator (§5.2: "source_evidence... use[s]
// the exact current repository object shape[]... verbatim, field for
// field. This document does not invent a new producer evidence model") in
// preference to a duplicate, potentially divergent shape check.
export function checkSourceEvidence(declaration: unknown): CheckSourceEvidenceResult {
  const result = HandoffEvidenceSchema.validate(declaration)
  if (!result.success) {
    return {
      success: false,
      finding: { schema: "recursive_singleton_fold_finding.v0", code: "malformed_source_evidence", check_position: 5 },
    }
  }
  return { success: true, value: snapshot(result.value) }
}

// ---------------------------------------------------------------------------
// Position 6 — source_proof_object shape (`PortableProofObjectV0`)
// ---------------------------------------------------------------------------

const CAPSULE_STATUS_VALUES: readonly CapsuleStatus[] = [
  "present",
  "missing",
  "valid",
  "invalid",
  "pending",
  "anchored",
  "verified",
  "mismatch",
  "unknown",
] as const

function isCapsuleStatus(value: unknown): value is CapsuleStatus {
  return typeof value === "string" && (CAPSULE_STATUS_VALUES as readonly string[]).includes(value)
}

const EVIDENCE_CAPSULE_SECTION_ID_VALUES = [
  "payload",
  "policy_boundary",
  "authorization",
  "decision_trace",
  "execution",
  "evidence",
  "counterfactual",
  "result",
  "receipt_root",
  "merkle",
  "anchor",
  "replay_manifest",
  "verifier",
] as const

const EVIDENCE_CAPSULE_SECTION_KEYS = ["id", "label", "status", "summary", "sourceFields"] as const

function isEvidenceCapsuleSection(value: unknown): value is EvidenceCapsuleSection {
  if (!isPlainObject(value)) return false
  if (!hasExactOwnKeys(value, EVIDENCE_CAPSULE_SECTION_KEYS)) return false
  if (!(EVIDENCE_CAPSULE_SECTION_ID_VALUES as readonly unknown[]).includes(value.id)) return false
  if (!isString(value.label)) return false
  if (!isCapsuleStatus(value.status)) return false
  if (!isString(value.summary)) return false
  if (!isStringArray(value.sourceFields)) return false
  return true
}

const RECEIPT_ROOT_STATUS_VALUES = ["verified", "mismatch", "missing"] as const
const MERKLE_STATUS_VALUES = ["valid", "invalid", "missing", "pending"] as const
const ANCHOR_STATUS_VALUES = ["anchored", "pending", "missing", "unknown"] as const

const EVIDENCE_CAPSULE_KEYS = [
  "schema",
  "action",
  "evidence",
  "receipt_root",
  "proof_refs",
  "verifier_result",
  "capsule",
  "replay_manifest",
] as const

function isSummaryFieldsShape(value: unknown): value is { summary: string; source_fields: string[] } {
  if (!isPlainObject(value)) return false
  if (!hasExactOwnKeys(value, ["summary", "source_fields"] as const)) return false
  return isString(value.summary) && isStringArray(value.source_fields)
}

function isEvidenceCapsuleShape(value: unknown): value is EvidenceCapsuleV0 {
  if (!isPlainObject(value)) return false
  if (!hasExactOwnKeys(value, EVIDENCE_CAPSULE_KEYS)) return false
  if (value.schema !== "receiptos.evidence_capsule.v0") return false
  if (!isSummaryFieldsShape(value.action)) return false

  if (!isPlainObject(value.evidence)) return false
  if (!hasExactOwnKeys(value.evidence, ["summary", "source_fields", "status"] as const)) return false
  if (!isString(value.evidence.summary)) return false
  if (!isStringArray(value.evidence.source_fields)) return false
  if (!isString(value.evidence.status)) return false

  if (!isPlainObject(value.receipt_root)) return false
  if (!hasExactOwnKeys(value.receipt_root, ["stored", "computed", "match", "status"] as const)) return false
  if (!isString(value.receipt_root.stored)) return false
  if (!isString(value.receipt_root.computed)) return false
  if (typeof value.receipt_root.match !== "boolean") return false
  if (!(RECEIPT_ROOT_STATUS_VALUES as readonly unknown[]).includes(value.receipt_root.status)) return false

  if (!isPlainObject(value.proof_refs)) return false
  if (!hasExactOwnKeys(value.proof_refs, ["merkle", "anchor"] as const)) return false
  if (!isPlainObject(value.proof_refs.merkle)) return false
  if (!hasExactOwnKeys(value.proof_refs.merkle, ["present", "status"] as const)) return false
  if (typeof value.proof_refs.merkle.present !== "boolean") return false
  if (!(MERKLE_STATUS_VALUES as readonly unknown[]).includes(value.proof_refs.merkle.status)) return false
  if (!isPlainObject(value.proof_refs.anchor)) return false
  if (!hasExactOwnKeys(value.proof_refs.anchor, ["status"] as const)) return false
  if (!(ANCHOR_STATUS_VALUES as readonly unknown[]).includes(value.proof_refs.anchor.status)) return false

  if (!isPlainObject(value.verifier_result)) return false
  if (!hasExactOwnKeys(value.verifier_result, ["ok", "status"] as const)) return false
  if (typeof value.verifier_result.ok !== "boolean") return false
  if (!(RECEIPT_ROOT_STATUS_VALUES as readonly unknown[]).includes(value.verifier_result.status)) return false

  if (!isPlainObject(value.capsule)) return false
  if (!hasExactOwnKeys(value.capsule, ["sections"] as const)) return false
  if (!Array.isArray(value.capsule.sections) || !value.capsule.sections.every(isEvidenceCapsuleSection)) return false

  if (!isSummaryFieldsShape(value.replay_manifest)) return false

  return true
}

const PROVENANCE_SUMMARY_KEYS = [
  "schema",
  "version",
  "what_happened",
  "evidence_present",
  "verifier_status",
  "receipt_root_status",
  "anchor_status",
  "replay_status",
  "warnings",
  "risk_flags",
] as const

function isProvenanceSummaryShape(value: unknown): value is ProvenanceSummaryV0 {
  if (!isPlainObject(value)) return false
  if (!hasExactOwnKeys(value, PROVENANCE_SUMMARY_KEYS)) return false
  if (value.schema !== "receiptos.provenance_summary.v0") return false
  if (value.version !== "v0") return false
  if (!isString(value.what_happened)) return false
  if (typeof value.evidence_present !== "boolean") return false
  if (!(RECEIPT_ROOT_STATUS_VALUES as readonly unknown[]).includes(value.verifier_status)) return false
  if (!(RECEIPT_ROOT_STATUS_VALUES as readonly unknown[]).includes(value.receipt_root_status)) return false
  if (!(ANCHOR_STATUS_VALUES as readonly unknown[]).includes(value.anchor_status)) return false
  if (!isCapsuleStatus(value.replay_status)) return false
  if (!isStringArray(value.warnings)) return false
  if (!isStringArray(value.risk_flags)) return false
  return true
}

const PORTABLE_PROOF_OBJECT_KEYS = [
  "schema",
  "proof_object_id",
  "proof_system",
  "receipt_root",
  "proof_ref",
  "replay_ref",
  "anchor_ref",
  "created_at",
  "relation_type",
  "project_refs",
  "source_evidence_ref",
  "producer",
  "metadata",
  "evidence_capsule",
  "provenance_summary",
] as const

function isPortableProofObjectShape(value: unknown): value is PortableProofObjectV0 {
  if (!isPlainObject(value)) return false
  if (!hasExactOwnKeys(value, PORTABLE_PROOF_OBJECT_KEYS)) return false
  if (value.schema !== "receiptos.portable_proof_object.v0") return false
  if (!isString(value.proof_object_id)) return false
  if (value.proof_system !== "ReceiptOS") return false
  if (!isString(value.receipt_root)) return false
  if (!isString(value.proof_ref)) return false
  if (!isNullOrString(value.replay_ref)) return false
  if (!isNullOrString(value.anchor_ref)) return false
  if (!isString(value.created_at)) return false
  if (value.relation_type !== "imported") return false
  if (!isStringArray(value.project_refs)) return false
  if (!isString(value.source_evidence_ref)) return false

  if (!isPlainObject(value.producer)) return false
  if (!hasExactOwnKeys(value.producer, ["runtime", "agent_id", "generated_by", "source_schema"] as const)) return false
  if (!isString(value.producer.runtime)) return false
  if (!isNullOrString(value.producer.agent_id)) return false
  if (!isNullOrString(value.producer.generated_by)) return false
  if (!isString(value.producer.source_schema)) return false

  if (!isPlainObject(value.metadata)) return false
  if (!hasExactOwnKeys(value.metadata, ["label", "session_id", "directory", "position_id"] as const)) return false
  if (!isString(value.metadata.label)) return false
  if (!isString(value.metadata.session_id)) return false
  if (!isString(value.metadata.directory)) return false
  if (!isString(value.metadata.position_id)) return false

  if (!isEvidenceCapsuleShape(value.evidence_capsule)) return false
  if (!isProvenanceSummaryShape(value.provenance_summary)) return false

  return true
}

// Isolated position-6 primitive only. Does not run positions 1-5 or 7-28,
// does not verify proof-object identity or proof reference (positions 10,
// 11), and does not perform Chronicle admission.
export function checkPortableProofObject(declaration: unknown): CheckPortableProofObjectResult {
  if (!isPortableProofObjectShape(declaration)) {
    return {
      success: false,
      finding: { schema: "recursive_singleton_fold_finding.v0", code: "malformed_portable_proof_object", check_position: 6 },
    }
  }
  return { success: true, value: snapshot(declaration) }
}

// ---------------------------------------------------------------------------
// Position 7 — claimed_source_entry shape (`chronicle_entry.v0`)
// ---------------------------------------------------------------------------

const CLAIMED_SOURCE_ENTRY_KEYS = [
  "schema",
  "entry_id",
  "source_system",
  "receipt_root",
  "proof_object_ref",
  "evidence_capsule_ref",
  "provenance_summary_ref",
  "created_from",
  "labels",
  "notes",
] as const

function isClaimedSourceEntryShape(value: unknown): value is ChronicleEntryV0 {
  if (!isPlainObject(value)) return false
  if (!hasExactOwnKeys(value, CLAIMED_SOURCE_ENTRY_KEYS)) return false
  if (value.schema !== CHRONICLE_ENTRY_VERSION_V0) return false
  if (!isString(value.entry_id)) return false
  if (!isString(value.source_system)) return false
  if (!isString(value.receipt_root)) return false
  if (!isString(value.proof_object_ref)) return false
  if (!isString(value.evidence_capsule_ref)) return false
  if (!isString(value.provenance_summary_ref)) return false
  if (!isNullOrString(value.created_from)) return false
  if (!isStringArray(value.labels)) return false
  if (!isNullOrString(value.notes)) return false
  return true
}

// Isolated position-7 primitive only. Does not run positions 1-6 or 8-28,
// does not reconstruct the entry, does not compare it to a reconstructed
// entry (position 13), and does not derive `source_entry_content_commitment`
// (position 14).
export function checkClaimedSourceEntry(declaration: unknown): CheckClaimedSourceEntryResult {
  if (!isClaimedSourceEntryShape(declaration)) {
    return {
      success: false,
      finding: { schema: "recursive_singleton_fold_finding.v0", code: "malformed_source_entry", check_position: 7 },
    }
  }
  return { success: true, value: snapshot(declaration) }
}

// ---------------------------------------------------------------------------
// Position 8 — receipt-root prerequisite and independent recomputation
// ---------------------------------------------------------------------------

// Isolated position-8 primitive only. Does not run positions 1-7 or 9-28,
// does not call `createChronicleEntryV0`, does not perform cross-object
// consistency (position 9), does not derive proof-object identity or proof
// reference (positions 10, 11), does not reconstruct the source entry, and
// does not derive `source_entry_content_commitment`. Accepts only the
// position-5-validated `HandoffEvidence` value, per §6 steps 8-9: the claimed
// stored root (`sourceEvidence.anchor.receipt_root`) is never trusted as
// ground truth; only the independently recomputed root
// (`computeReceiptRoot`) is authoritative for comparison.
export function checkSourceAdmissionPrerequisitesAndReceiptRoot(
  sourceEvidence: HandoffEvidence,
): CheckSourceAdmissionReceiptRootResult {
  const storedRoot = sourceEvidence.anchor?.receipt_root ?? null
  if (!storedRoot) {
    return {
      success: false,
      finding: {
        schema: "recursive_singleton_fold_finding.v0",
        code: "source_admission_prerequisite_unavailable",
        check_position: 8,
      },
    }
  }

  const recomputedRoot = computeReceiptRoot(sourceEvidence)
  if (storedRoot.toLowerCase() !== recomputedRoot.toLowerCase()) {
    return {
      success: false,
      finding: { schema: "recursive_singleton_fold_finding.v0", code: "source_receipt_root_mismatch", check_position: 8 },
    }
  }

  return { success: true, value: { verifiedReceiptRoot: recomputedRoot } }
}
