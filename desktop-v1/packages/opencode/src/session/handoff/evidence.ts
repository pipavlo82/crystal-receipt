import { createHash } from "node:crypto"
import { Schema } from "effect"
import type { Snapshot } from "@/snapshot"
import type { MessageV2 } from "@/session/message-v2"
import type { Session } from "@/session/session"

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

const AuthorizationActionSchema = Schema.Struct({
  permission: Schema.String,
  pattern: Schema.String,
  action: Schema.String,
})

const ExecutionRecordSchema = Schema.Struct({
  call_id: Schema.String,
  tool: Schema.String,
  action_performed: Schema.String,
  target: Schema.String,
  execution_timestamp: Schema.Number,
  completed_timestamp: Schema.Number,
  status: Schema.Literals(["completed", "error"]),
  scope_match: Schema.NullOr(Schema.Boolean),
})

const AnchorProofSchema = Schema.Struct({
  receipt_root: Schema.String,
  merkle_proof_status: Schema.Union([Schema.Literal("not attached"), Schema.Literal("attached")]),
  merkle_root: Schema.NullOr(Schema.String),
  merkle_leaf_index: Schema.NullOr(Schema.Number),
  merkle_proof: Schema.Array(Schema.String),
  onchain_anchor_status: Schema.Literal("not anchored"),
  network: Schema.Literal("local/off-chain"),
  contract: Schema.NullOr(Schema.String),
  tx_hash: Schema.NullOr(Schema.String),
  verifier_status: Schema.Literal("not verified"),
})

export const HandoffEvidenceSchema = Schema.Struct({
  schema: Schema.Literal("stealth.session.evidence.v1"),
  session_id: Schema.String,
  directory: Schema.String,
  task: Schema.Struct({
    title: Schema.optional(Schema.String),
    prompt: Schema.optional(Schema.String),
  }),
  agent: Schema.Struct({
    id: Schema.optional(Schema.String),
    runtime: Schema.Literal("Stealth"),
  }),
  scope: Schema.Struct({
    permission: Schema.NullOr(Schema.Unknown),
    lease: Schema.optional(Schema.Struct({
      id: Schema.String,
      mode: Schema.Union([Schema.Literal("read_only"), Schema.Literal("edit"), Schema.Literal("execute")]),
      target: Schema.String,
      allowed_actions: Schema.Array(AuthorizationActionSchema),
      issued_at: Schema.NullOr(Schema.Number),
      expires_at: Schema.NullOr(Schema.Number),
      status: Schema.Union([Schema.Literal("active"), Schema.Literal("missing"), Schema.Literal("expired")]),
    })),
  }),
  authorization: Schema.Struct({
    delegation_ref: Schema.NullOr(Schema.String),
    delegator: Schema.NullOr(Schema.String),
    agent_operator: Schema.NullOr(Schema.String),
    target: Schema.String,
    allowed_actions: Schema.Array(AuthorizationActionSchema),
    authorization_valid_from: Schema.NullOr(Schema.Number),
    authorization_expiry: Schema.NullOr(Schema.Number),
    authorization_checked_at: Schema.Number,
    authorization_state_hash: Schema.String,
    authorized_at_execution: Schema.NullOr(Schema.Boolean),
  }),
  execution: Schema.Array(ExecutionRecordSchema),
  commands: Schema.Array(
    Schema.Struct({
      command: Schema.String,
      exit_code: Schema.optional(Schema.Number),
      stdout_summary: Schema.optional(Schema.String),
    }),
  ),
  changes: Schema.Struct({
    files_changed: Schema.Array(Schema.String),
    diff_sha256: Schema.NullOr(Schema.String),
  }),
  anchor: AnchorProofSchema,
  metadata: Schema.Struct({
    message_count: Schema.Number,
    diff_count: Schema.Number,
    generated_by: Schema.Literal("stealth.handoff.evidence.builder.v1"),
  }),
})

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex")
}

function stripAnchor<T extends { anchor?: unknown }>(value: T): Omit<T, "anchor"> {
  const clone = { ...value } as Record<string, unknown>
  delete clone.anchor
  return clone as Omit<T, "anchor">
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`
  }

  const record = value as Record<string, unknown>
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)

  return `{${entries.join(",")}}`
}

function firstUserPrompt(messages: MessageV2.WithParts[]) {
  for (const message of messages) {
    if (message.info.role !== "user") continue
    for (const part of message.parts) {
      if (part.type === "text") return part.text
    }
  }
  return undefined
}

function extractCommands(messages: MessageV2.WithParts[]): HandoffEvidenceCommand[] {
  const commands: HandoffEvidenceCommand[] = []

  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "tool") continue

      const input = part.state.input
      const command =
        typeof input?.command === "string"
          ? input.command
          : typeof input?.cmd === "string"
            ? input.cmd
            : undefined

      if (!command) continue

      const metadata =
        "metadata" in part.state && part.state.metadata && typeof part.state.metadata === "object"
          ? part.state.metadata
          : undefined

      const output =
        "output" in part.state && typeof part.state.output === "string"
          ? part.state.output
          : undefined

      commands.push({
        command,
        exit_code:
          metadata && "exit_code" in metadata && typeof metadata.exit_code === "number"
            ? metadata.exit_code
            : undefined,
        stdout_summary: output ? output.slice(0, 240) : undefined,
      })
    }
  }

  return commands
}

function extractExecution(
  messages: MessageV2.WithParts[],
  target: string,
): HandoffExecutionRecord[] {
  const records: HandoffExecutionRecord[] = []

  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "tool") continue
      if (part.state.status !== "completed" && part.state.status !== "error") continue

      const input = part.state.input
      const command =
        typeof input?.command === "string"
          ? input.command
          : typeof input?.cmd === "string"
            ? input.cmd
            : undefined

      records.push({
        call_id: part.callID,
        tool: part.tool,
        action_performed: command ?? part.tool,
        target,
        execution_timestamp: part.state.time.start,
        completed_timestamp: part.state.time.end,
        status: part.state.status,
        scope_match: null,
      })
    }
  }

  return records
}

function computeReceiptRoot(value: Omit<HandoffEvidence, "anchor">): string {
  return "0x" + sha256(canonicalize(value))
}

function encodeHandoffEvidence(value: HandoffEvidence): HandoffEvidence {
  return Schema.encodeSync(HandoffEvidenceSchema)(value) as HandoffEvidence
}

function deriveScopedLeaseMode(
  allowedActions: HandoffAuthorizationAction[],
): "read_only" | "edit" | "execute" {
  if (allowedActions.length === 0) return "read_only"

  const permissions = allowedActions
    .filter((rule) => rule.action === "allow")
    .map((rule) => rule.permission.toLowerCase())

  if (permissions.some((permission) => permission === "*")) return "execute"
  if (permissions.some((permission) => permission.includes("shell") || permission.includes("bash") || permission.includes("execute"))) {
    return "execute"
  }
  if (permissions.some((permission) => permission.includes("write") || permission.includes("edit") || permission.includes("patch"))) {
    return "edit"
  }

  return "read_only"
}

export function buildHandoffEvidence(input: {
  session: Session.Info
  messages: MessageV2.WithParts[]
  diffs: Snapshot.FileDiff[]
}): HandoffEvidence {
  const filesChanged = [...new Set(input.diffs.map((diff) => diff.file).filter((file): file is string => !!file))]
  const diffPayload = JSON.stringify(input.diffs)

  const allowedActions: HandoffAuthorizationAction[] = (input.session.permission ?? []).map((rule) => ({
    permission: rule.permission,
    pattern: rule.pattern,
    action: rule.action,
  }))

  const leaseStatus = allowedActions.length > 0 ? "active" as const : "missing" as const
  const scopedLease = {
    id: `${input.session.id}:scoped-lease:v1`,
    mode: deriveScopedLeaseMode(allowedActions),
    target: input.session.directory,
    allowed_actions: allowedActions,
    issued_at: input.session.time.created ?? null,
    expires_at: null,
    status: leaseStatus,
  }

  const execution = extractExecution(input.messages, input.session.directory)
  const executionTimestamps = execution.flatMap((record) => [
    record.execution_timestamp,
    record.completed_timestamp,
  ])

  const authorizationCheckedAt = Math.max(
    input.session.time.updated,
    ...executionTimestamps,
  )

  const diffSha256 = input.diffs.length ? sha256(diffPayload) : null

  const baseEvidence: Omit<HandoffEvidence, "anchor"> = {
    schema: "stealth.session.evidence.v1",
    session_id: input.session.id,
    directory: input.session.directory,
    task: {
      title: input.session.title,
      prompt: firstUserPrompt(input.messages),
    },
    agent: {
      id: input.session.agent,
      runtime: "Stealth",
    },
    scope: {
      permission: input.session.permission ?? null,
      lease: scopedLease,
    },
    authorization: {
      delegation_ref: null,
      delegator: null,
      agent_operator: input.session.agent ?? null,
      target: input.session.directory,
      allowed_actions: allowedActions,
      authorization_valid_from: null,
      authorization_expiry: null,
      authorization_checked_at: authorizationCheckedAt,
      authorization_state_hash: sha256(canonicalize(allowedActions)),
      authorized_at_execution: null,
    },
    execution,
    commands: extractCommands(input.messages),
    changes: {
      files_changed: filesChanged,
      diff_sha256: diffSha256,
    },
    metadata: {
      message_count: input.messages.length,
      diff_count: input.diffs.length,
      generated_by: "stealth.handoff.evidence.builder.v1",
    },
  }

  const anchorTemplate: HandoffAnchorProof = {
    receipt_root: "0x",
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

  const encodedEvidenceForRoot = encodeHandoffEvidence({
    ...baseEvidence,
    anchor: anchorTemplate,
  })

  const receiptRoot = computeReceiptRoot(stripAnchor(encodedEvidenceForRoot))

  const finalEvidence = encodeHandoffEvidence({
    ...baseEvidence,
    anchor: {
      ...anchorTemplate,
      receipt_root: receiptRoot,
    },
  })

  const selfVerifiedRoot = computeReceiptRoot(stripAnchor(finalEvidence))
  if (selfVerifiedRoot !== finalEvidence.anchor.receipt_root) {
    throw new Error(
      `handoff evidence anchor root mismatch: expected ${finalEvidence.anchor.receipt_root}, got ${selfVerifiedRoot}`,
    )
  }

  return finalEvidence
}
