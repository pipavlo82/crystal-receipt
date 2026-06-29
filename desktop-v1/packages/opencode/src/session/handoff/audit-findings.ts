import { createHash } from "node:crypto"
import { Schema } from "effect"

export const AuditFindingSeveritySchema = Schema.Literals([
  "critical",
  "high",
  "medium",
  "low",
  "info",
])
export type AuditFindingSeverity = typeof AuditFindingSeveritySchema.Type

export const AuditFindingStatusSchema = Schema.Literals([
  "open",
  "accepted",
  "mitigated",
  "false_positive",
])
export type AuditFindingStatus = typeof AuditFindingStatusSchema.Type

export const AuditFindingRefTypeSchema = Schema.Literals([
  "session",
  "execution",
  "command",
  "file",
  "diff",
  "authorization",
  "receipt_root",
])
export type AuditFindingRefType = typeof AuditFindingRefTypeSchema.Type

export const AuditFindingRefSchema = Schema.Struct({
  type: AuditFindingRefTypeSchema,
  value: Schema.String,
})
export type AuditFindingRef = typeof AuditFindingRefSchema.Type

export const AuditFindingMetadataSchema = Schema.Struct({
  rule_id: Schema.optional(Schema.String),
  tool: Schema.optional(Schema.String),
  confidence: Schema.optional(Schema.Literals(["high", "medium", "low"])),
})
export type AuditFindingMetadata = typeof AuditFindingMetadataSchema.Type

export const AuditFindingSchema = Schema.Struct({
  id: Schema.String,
  category: Schema.String,
  severity: AuditFindingSeveritySchema,
  title: Schema.String,
  description: Schema.String,
  status: AuditFindingStatusSchema,
  refs: Schema.Array(AuditFindingRefSchema),
  file_refs: Schema.Array(Schema.String),
  execution_refs: Schema.Array(Schema.String),
  command_refs: Schema.Array(Schema.String),
  metadata: Schema.optional(AuditFindingMetadataSchema),
})
export type AuditFinding = typeof AuditFindingSchema.Type

export const AuditFindingsSummarySchema = Schema.Struct({
  total: Schema.Number,
  critical: Schema.Number,
  high: Schema.Number,
  medium: Schema.Number,
  low: Schema.Number,
  info: Schema.Number,
})
export type AuditFindingsSummary = typeof AuditFindingsSummarySchema.Type

export const AuditFindingsDocumentSchema = Schema.Struct({
  schema: Schema.Literal("stealth.audit.findings.v1"),
  session_id: Schema.String,
  generated_at: Schema.Number,
  generator: Schema.Struct({
    kind: Schema.Literal("audit-profile"),
    id: Schema.optional(Schema.String),
    version: Schema.optional(Schema.String),
  }),
  summary: AuditFindingsSummarySchema,
  findings: Schema.Array(AuditFindingSchema),
})
export type AuditFindingsDocument = typeof AuditFindingsDocumentSchema.Type

export const AuditEvidenceExtensionSchema = Schema.Struct({
  schema: Schema.Literal("stealth.audit.evidence-extension.v1"),
  session_id: Schema.String,
  base_evidence_ref: Schema.Struct({
    evidence_schema: Schema.Literal("stealth.session.evidence.v1"),
    receipt_root: Schema.String,
    diff_sha256: Schema.NullOr(Schema.String),
    authorization_state_hash: Schema.String,
  }),
  coverage: Schema.Struct({
    files_changed: Schema.Array(Schema.String),
    execution_call_ids: Schema.Array(Schema.String),
    command_count: Schema.Number,
    message_count: Schema.Number,
  }),
  findings_ref: Schema.Struct({
    schema: Schema.Literal("stealth.audit.findings.v1"),
    findings_digest: Schema.String,
    findings_count: Schema.Number,
  }),
  metadata: Schema.Struct({
    generated_at: Schema.Number,
    generated_by: Schema.Literal("stealth.audit.evidence.extension.builder.v1"),
  }),
})
export type AuditEvidenceExtension = typeof AuditEvidenceExtensionSchema.Type

export function canonicalizeAuditValue(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeAuditValue).join(",")}]`
  }

  const record = value as Record<string, unknown>
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeAuditValue(record[key])}`)

  return `{${entries.join(",")}}`
}

export function auditFindingsDigest(document: AuditFindingsDocument): string {
  return "0x" + createHash("sha256").update(canonicalizeAuditValue(document)).digest("hex")
}
