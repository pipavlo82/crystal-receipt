import type { HandoffEvidence } from "../schema/types"
import type { ProducerAdapter } from "./types"
import { attachReceiptRoot, normalizeAllowedActions } from "./shared"

export type ExternalCodingRunOutput = {
  schema: "external.coding_run.v0"
  run_id: string
  workspace: string
  task: {
    title?: string
    prompt_summary?: string
  }
  producer: {
    id?: string
    runtime: string
    generated_by: string
  }
  scope?: {
    target: string
    mode: "read_only" | "edit" | "execute"
    allowed_actions: string[]
  }
  timing: {
    started_at: number
    completed_at: number
  }
  result: {
    status: "completed" | "error"
    exit_code?: number
    summary?: string
  }
  execution: {
    commands: {
      command: string
      exit_code?: number
      stdout_summary?: string
    }[]
    tool_calls: {
      tool: string
      action: string
      target: string
      status: "completed" | "error"
    }[]
  }
  evidence: {
    files_changed: string[]
    diff_sha256: string | null
  }
  source_metadata: {
    message_count: number
    diff_count: number
  }
}

export function normalizeExternalCodingRunOutput(source: ExternalCodingRunOutput): HandoffEvidence {
  const target = source.scope?.target ?? source.workspace
  const allowedActions = normalizeAllowedActions(source.scope?.allowed_actions ?? [], target)
  const normalizedWithoutAnchor: Omit<HandoffEvidence, "anchor"> = {
    schema: "stealth.session.evidence.v1",
    session_id: source.run_id,
    directory: source.workspace,
    task: {
      title: source.task.title,
      prompt: source.task.prompt_summary,
    },
    agent: {
      id: source.producer.id,
      runtime: source.producer.runtime,
    },
    scope: {
      permission: null,
      lease: {
        id: `${source.run_id}:scoped-lease:v1`,
        mode: source.scope?.mode ?? "edit",
        target,
        allowed_actions: allowedActions,
        issued_at: source.timing.started_at,
        expires_at: null,
        status: "missing",
      },
    },
    authorization: {
      delegation_ref: null,
      delegator: null,
      agent_operator: source.producer.id ?? null,
      target,
      allowed_actions: allowedActions,
      authorization_valid_from: null,
      authorization_expiry: null,
      authorization_checked_at: source.timing.completed_at,
      authorization_state_hash: source.evidence.diff_sha256 ?? "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      authorized_at_execution: null,
    },
    execution: source.execution.tool_calls.map((toolCall, index) => ({
      call_id: `${source.run_id}:call-${String(index + 1).padStart(3, "0")}`,
      tool: toolCall.tool,
      action_performed: toolCall.action,
      target: toolCall.target,
      execution_timestamp: source.timing.started_at,
      completed_timestamp: source.timing.completed_at,
      status: toolCall.status,
      scope_match: null,
    })),
    commands: source.execution.commands.length > 0
      ? source.execution.commands.map((command) => ({
          command: command.command,
          exit_code: command.exit_code,
          stdout_summary: command.stdout_summary,
        }))
      : source.result.summary
        ? [{ command: "(no command recorded)", exit_code: source.result.exit_code, stdout_summary: source.result.summary }]
        : [],
    changes: {
      files_changed: source.evidence.files_changed,
      diff_sha256: source.evidence.diff_sha256,
    },
    metadata: {
      message_count: source.source_metadata.message_count,
      diff_count: source.source_metadata.diff_count,
      generated_by: source.producer.generated_by,
    },
  }

  return attachReceiptRoot(normalizedWithoutAnchor)
}

export const externalCodingRunAdapter: ProducerAdapter<ExternalCodingRunOutput> = {
  id: "external-coding-run",
  sourceSchema: "external.coding_run.v0",
  normalize: normalizeExternalCodingRunOutput,
}
