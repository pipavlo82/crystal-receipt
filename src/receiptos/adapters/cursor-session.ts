import type { HandoffEvidence } from "../schema/types"
import type { ProducerAdapter } from "./types"
import { attachReceiptRoot, normalizeAllowedActions } from "./shared"

export type CursorSessionOutput = {
  schema: "cursor.session.v0"
  session_id: string
  project: string
  workspace: string
  runtime: {
    producer_id: "cursor"
    generated_by: "cursor.session.v0"
  }
  task: {
    title: string
    prompt_summary: string
  }
  events: Array<{
    type: "message" | "tool_use"
    role?: "user" | "assistant" | "system"
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

function assertCursorSession(source: CursorSessionOutput) {
  if (source.schema !== "cursor.session.v0") {
    throw new Error(`Expected cursor.session.v0, got ${String(source.schema)}`)
  }
  if (!source.session_id) throw new Error("cursor.session.v0 missing session_id")
  if (!source.task?.title || !source.task?.prompt_summary) {
    throw new Error("cursor.session.v0 missing task title or prompt_summary")
  }
  if (source.runtime?.producer_id !== "cursor") {
    throw new Error("cursor.session.v0 producer_id must be cursor")
  }
  if (source.runtime?.generated_by !== "cursor.session.v0") {
    throw new Error("cursor.session.v0 generated_by must be cursor.session.v0")
  }
  for (const event of source.events) {
    if (!event.type) throw new Error("cursor.session.v0 event missing type")
    if (event.type === "tool_use" && typeof event.exit_code === "number" && !event.command_summary) {
      throw new Error("cursor.session.v0 exec-like tool_use with exit_code requires command_summary")
    }
  }
}

function deriveAllowedActions(events: CursorSessionOutput["events"]): string[] {
  const actions = new Set<string>()
  for (const event of events) {
    if (event.type !== "tool_use") continue
    const tool = (event.tool ?? "").toLowerCase()
    if (["read", "grep", "glob", "search", "list"].includes(tool)) actions.add("read")
    if (["edit", "write", "multiedit", "replace"].includes(tool)) actions.add("write")
    if (["exec", "shell", "bash"].includes(tool) || event.command_summary) actions.add("exec")
  }
  return Array.from(actions)
}

function deriveMode(actions: string[]): "read_only" | "edit" {
  return actions.some((action) => action === "write" || action === "exec") ? "edit" : "read_only"
}

export function normalizeCursorSessionOutput(source: CursorSessionOutput): HandoffEvidence {
  assertCursorSession(source)

  const target = source.workspace
  const actionStrings = deriveAllowedActions(source.events)
  const allowedActions = normalizeAllowedActions(actionStrings, target)
  const mode = deriveMode(actionStrings)
  const toolEvents = source.events.filter((event) => event.type === "tool_use")

  if (toolEvents.length === 0) {
    throw new Error("cursor.session.v0 contains no tool_use events")
  }

  const normalizedWithoutAnchor: Omit<HandoffEvidence, "anchor"> = {
    schema: "stealth.session.evidence.v1",
    session_id: source.session_id,
    directory: source.workspace,
    task: {
      title: source.task.title,
      prompt: source.task.prompt_summary,
    },
    agent: {
      id: "cursor",
      runtime: "cursor",
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
      agent_operator: "cursor",
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
        command: event.command_summary!,
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
      generated_by: "cursor.session.v0",
    },
  }

  return attachReceiptRoot(normalizedWithoutAnchor)
}

export const cursorSessionAdapter: ProducerAdapter<CursorSessionOutput> = {
  id: "cursor-session",
  sourceSchema: "cursor.session.v0",
  matches(input: unknown): boolean {
    return typeof input === "object" && input !== null && (input as { schema?: unknown }).schema === "cursor.session.v0"
  },
  normalize: normalizeCursorSessionOutput,
}
