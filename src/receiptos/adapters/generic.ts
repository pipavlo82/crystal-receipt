import type { HandoffEvidence } from "../schema/types"
import type { ProducerAdapter } from "./types"
import { attachReceiptRoot } from "./shared"

export type GenericProducerOutput = {
  producer: "generic"
  run_id: string
  workspace: string
  action: {
    title?: string
    prompt?: string
    tool: string
    command: string
    target: string
  }
  timing: {
    started_at: number
    completed_at: number
  }
  result: {
    status: "completed" | "error"
    exit_code?: number
    stdout_summary?: string
  }
  evidence: {
    files_changed: string[]
    diff_sha256: string | null
  }
  metadata: {
    message_count: number
    diff_count: number
    producer_id?: string
  }
}

export function normalizeGenericProducerOutput(source: GenericProducerOutput): HandoffEvidence {
  const normalizedWithoutAnchor: Omit<HandoffEvidence, "anchor"> = {
    schema: "stealth.session.evidence.v1",
    session_id: source.run_id,
    directory: source.workspace,
    task: {
      title: source.action.title,
      prompt: source.action.prompt,
    },
    agent: {
      id: source.metadata.producer_id ?? source.producer,
      runtime: "generic-producer-import",
    },
    scope: {
      permission: null,
      lease: {
        id: `${source.run_id}:scoped-lease:v1`,
        mode: "read_only",
        target: source.workspace,
        allowed_actions: [],
        issued_at: source.timing.started_at,
        expires_at: null,
        status: "missing",
      },
    },
    authorization: {
      delegation_ref: null,
      delegator: null,
      agent_operator: source.metadata.producer_id ?? source.producer,
      target: source.action.target,
      allowed_actions: [],
      authorization_valid_from: null,
      authorization_expiry: null,
      authorization_checked_at: source.timing.completed_at,
      authorization_state_hash: source.evidence.diff_sha256 ?? "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      authorized_at_execution: null,
    },
    execution: [
      {
        call_id: `${source.run_id}:call-001`,
        tool: source.action.tool,
        action_performed: source.action.command,
        target: source.action.target,
        execution_timestamp: source.timing.started_at,
        completed_timestamp: source.timing.completed_at,
        status: source.result.status,
        scope_match: null,
      },
    ],
    commands: [
      {
        command: source.action.command,
        exit_code: source.result.exit_code,
        stdout_summary: source.result.stdout_summary,
      },
    ],
    changes: {
      files_changed: source.evidence.files_changed,
      diff_sha256: source.evidence.diff_sha256,
    },
    metadata: {
      message_count: source.metadata.message_count,
      diff_count: source.metadata.diff_count,
      generated_by: "receiptos.generic_producer_import.v0",
    },
  }

  return attachReceiptRoot(normalizedWithoutAnchor)
}

export const genericAdapter: ProducerAdapter<GenericProducerOutput> = {
  id: "generic",
  sourceSchema: null,
  matches(input: unknown): boolean {
    return typeof input === "object" && input !== null && (input as { producer?: unknown }).producer === "generic"
  },
  normalize: normalizeGenericProducerOutput,
}
