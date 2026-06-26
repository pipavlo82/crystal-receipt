import type { HandoffEvidence } from "../schema/types"
import type { ProducerAdapter } from "./types"
import { attachReceiptRoot, normalizeAllowedActions } from "./shared"

export type ClaudeCodeSessionOutput = {
  schema: "claude.code.session.v0"
  project: string
  session_id: string
  workspace: string
  source_format: "claude-code-jsonl"
  runtime: {
    producer_id: string
    generated_by: string
  }
  task: {
    title?: string
    prompt_summary?: string
  }
  events: Array<{
    type: "message" | "tool_use"
    role?: string
    summary?: string
    tool?: string
    target?: string
    status?: "completed" | "error"
    command_summary?: string
    exit_code?: number
    stdout_summary?: string
  }>
  summary: {
    status: "completed" | "error"
    message_count: number
    tool_call_count: number
    command_count: number
    files_changed: string[]
    diff_sha256: string | null
  }
}

function deriveAllowedActions(events: ClaudeCodeSessionOutput["events"]): string[] {
  const actions = new Set<string>()
  for (const event of events) {
    if (event.type !== "tool_use") continue
    if (event.tool === "read") actions.add("read")
    if (event.tool === "edit" || event.tool === "write") actions.add("write")
    if (event.tool === "exec" || event.command_summary) actions.add("exec")
  }
  return Array.from(actions)
}

function deriveMode(actions: string[]): "read_only" | "edit" {
  return actions.some((action) => action === "write" || action === "exec") ? "edit" : "read_only"
}

export function normalizeClaudeCodeSessionOutput(source: ClaudeCodeSessionOutput): HandoffEvidence {
  const actionStrings = deriveAllowedActions(source.events)
  const target = source.workspace
  const allowedActions = normalizeAllowedActions(actionStrings, target)
  const mode = deriveMode(actionStrings)
  const toolEvents = source.events.filter((event) => event.type === "tool_use")

  const normalizedWithoutAnchor: Omit<HandoffEvidence, "anchor"> = {
    schema: "stealth.session.evidence.v1",
    session_id: source.session_id,
    directory: source.workspace,
    task: {
      title: source.task.title,
      prompt: source.task.prompt_summary,
    },
    agent: {
      id: source.runtime.producer_id,
      runtime: "claude/code",
    },
    scope: {
      permission: null,
      lease: {
        id: `${source.session_id}:scoped-lease:v1`,
        mode,
        target,
        allowed_actions: allowedActions,
        issued_at: null,
        expires_at: null,
        status: "missing",
      },
    },
    authorization: {
      delegation_ref: null,
      delegator: null,
      agent_operator: source.runtime.producer_id,
      target,
      allowed_actions: allowedActions,
      authorization_valid_from: null,
      authorization_expiry: null,
      authorization_checked_at: 0,
      authorization_state_hash: source.summary.diff_sha256 ?? "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      authorized_at_execution: null,
    },
    execution: toolEvents.map((event, index) => ({
      call_id: `${source.session_id}:tool-${String(index + 1).padStart(3, "0")}`,
      tool: event.tool ?? "tool_use",
      action_performed: event.command_summary ?? event.target ?? event.tool ?? "tool_use",
      target: event.target ?? target,
      execution_timestamp: 0,
      completed_timestamp: 0,
      status: event.status ?? "completed",
      scope_match: null,
    })),
    commands: toolEvents
      .filter((event) => event.tool === "exec" || Boolean(event.command_summary))
      .map((event) => ({
        command: event.command_summary ?? event.tool ?? "exec",
        exit_code: event.exit_code,
        stdout_summary: event.stdout_summary,
      })),
    changes: {
      files_changed: source.summary.files_changed,
      diff_sha256: source.summary.diff_sha256,
    },
    metadata: {
      message_count: source.summary.message_count,
      diff_count: source.summary.command_count,
      generated_by: source.runtime.generated_by,
    },
  }

  return attachReceiptRoot(normalizedWithoutAnchor)
}

export const claudeCodeSessionAdapter: ProducerAdapter<ClaudeCodeSessionOutput> = {
  id: "claude-code-session",
  sourceSchema: "claude.code.session.v0",
  matches(input: unknown): boolean {
    return typeof input === "object" && input !== null && (input as { schema?: unknown }).schema === "claude.code.session.v0"
  },
  normalize: normalizeClaudeCodeSessionOutput,
}
