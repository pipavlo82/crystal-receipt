import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import {
  auditFindingsDigest,
  AuditEvidenceExtensionSchema,
  AuditFindingsDocumentSchema,
  type AuditFindingRefType,
  type AuditFindingsDocument,
} from "@/session/handoff/audit-findings"

function sampleDocument(): AuditFindingsDocument {
  return {
    schema: "stealth.audit.findings.v1",
    session_id: "ses_123",
    generated_at: 1710000000000,
    generator: {
      kind: "audit-profile",
      id: "solidity-audit",
      version: "1.0.0",
    },
    summary: {
      total: 2,
      critical: 0,
      high: 1,
      medium: 1,
      low: 0,
      info: 0,
    },
    findings: [
      {
        id: "finding-1",
        category: "access-control",
        severity: "high",
        title: "Unauthorized privileged path",
        description: "A privileged path may be reachable without sufficient checks.",
        status: "open",
        refs: [
          { type: "session", value: "ses_123" },
          { type: "execution", value: "call_1" },
          { type: "file", value: "apps/contracts/Foo.sol" },
          { type: "diff", value: "0xabc" },
          { type: "authorization", value: "0xdef" },
          { type: "receipt_root", value: "0x123" },
        ],
        file_refs: ["apps/contracts/Foo.sol"],
        execution_refs: ["call_1"],
        command_refs: ["bun test"],
        metadata: {
          rule_id: "AC-001",
          tool: "audit-profile",
          confidence: "high",
        },
      },
      {
        id: "finding-2",
        category: "invariants",
        severity: "medium",
        title: "Invariant depends on unchecked branch",
        description: "One invariant relies on a branch that is not covered by current checks.",
        status: "open",
        refs: [{ type: "command", value: "forge test" }],
        file_refs: ["apps/contracts/test/Foo.t.sol"],
        execution_refs: ["call_2"],
        command_refs: ["forge test"],
      },
    ],
  }
}

describe("audit findings schema draft", () => {
  test("validates an audit findings document", async () => {
    const decoded = await Schema.decodeUnknownPromise(AuditFindingsDocumentSchema)(sampleDocument())
    expect(decoded.session_id).toBe("ses_123")
    expect(decoded.findings).toHaveLength(2)
  })

  test("validates an audit evidence extension", async () => {
    const doc = sampleDocument()
    const extension = {
      schema: "stealth.audit.evidence-extension.v1",
      session_id: doc.session_id,
      base_evidence_ref: {
        evidence_schema: "stealth.session.evidence.v1",
        receipt_root: "0xreceipt",
        diff_sha256: "0xdiff",
        authorization_state_hash: "0xauth",
      },
      coverage: {
        files_changed: ["apps/contracts/Foo.sol"],
        execution_call_ids: ["call_1", "call_2"],
        command_count: 2,
        message_count: 5,
      },
      findings_ref: {
        schema: "stealth.audit.findings.v1",
        findings_digest: auditFindingsDigest(doc),
        findings_count: doc.findings.length,
      },
      metadata: {
        generated_at: 1710000000001,
        generated_by: "stealth.audit.evidence.extension.builder.v1",
      },
    }

    const decoded = await Schema.decodeUnknownPromise(AuditEvidenceExtensionSchema)(extension)
    expect(decoded.base_evidence_ref.receipt_root).toBe("0xreceipt")
  })

  test("produces a deterministic digest for the same document", () => {
    const first = sampleDocument()
    const second = sampleDocument()
    expect(auditFindingsDigest(first)).toBe(auditFindingsDigest(second))
  })

  test("changes digest when finding content changes", () => {
    const first = sampleDocument()
    const second: AuditFindingsDocument = {
      ...sampleDocument(),
      findings: sampleDocument().findings.map((finding, index) =>
        index === 0 ? { ...finding, title: "Changed title" } : finding,
      ),
    }
    expect(auditFindingsDigest(first)).not.toBe(auditFindingsDigest(second))
  })

  test("allows only the supported ref types", async () => {
    const validTypes: AuditFindingRefType[] = [
      "session",
      "execution",
      "command",
      "file",
      "diff",
      "authorization",
      "receipt_root",
    ]

    for (const type of validTypes) {
      const base = sampleDocument()
      const doc: AuditFindingsDocument = {
        ...base,
        findings: base.findings.map((finding, index) =>
          index === 0 ? { ...finding, refs: [{ type, value: "x" }] } : finding,
        ),
      }
      const decoded = await Schema.decodeUnknownPromise(AuditFindingsDocumentSchema)(doc)
      expect(decoded.findings[0].refs[0].type).toBe(type)
    }
  })

  test("rejects unknown ref type", async () => {
    const base = sampleDocument()
    const doc = {
      ...base,
      findings: base.findings.map((finding, index) =>
        index === 0
          ? {
              ...finding,
              refs: [{ type: "unknown", value: "x" }],
            }
          : finding,
      ),
    }

    await expect(
      Schema.decodeUnknownPromise(AuditFindingsDocumentSchema)(doc),
    ).rejects.toBeDefined()
  })

  test("digest is stable when object keys are reordered", () => {
    const first = sampleDocument()
    const reordered = {
      findings: [
        {
          metadata: {
            confidence: "high",
            tool: "audit-profile",
            rule_id: "AC-001",
          },
          command_refs: ["bun test"],
          execution_refs: ["call_1"],
          file_refs: ["apps/contracts/Foo.sol"],
          refs: [
            { value: "ses_123", type: "session" },
            { value: "call_1", type: "execution" },
            { value: "apps/contracts/Foo.sol", type: "file" },
            { value: "0xabc", type: "diff" },
            { value: "0xdef", type: "authorization" },
            { value: "0x123", type: "receipt_root" },
          ],
          status: "open",
          description: "A privileged path may be reachable without sufficient checks.",
          title: "Unauthorized privileged path",
          severity: "high",
          category: "access-control",
          id: "finding-1",
        },
        {
          command_refs: ["forge test"],
          execution_refs: ["call_2"],
          file_refs: ["apps/contracts/test/Foo.t.sol"],
          refs: [{ value: "forge test", type: "command" }],
          status: "open",
          description: "One invariant relies on a branch that is not covered by current checks.",
          title: "Invariant depends on unchecked branch",
          severity: "medium",
          category: "invariants",
          id: "finding-2",
        },
      ],
      summary: {
        info: 0,
        low: 0,
        medium: 1,
        high: 1,
        critical: 0,
        total: 2,
      },
      generator: {
        version: "1.0.0",
        id: "solidity-audit",
        kind: "audit-profile",
      },
      generated_at: 1710000000000,
      session_id: "ses_123",
      schema: "stealth.audit.findings.v1",
    } satisfies AuditFindingsDocument

    expect(auditFindingsDigest(first)).toBe(auditFindingsDigest(reordered))
  })
})
