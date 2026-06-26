import { basename } from "node:path"
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
    unsupported_block_count: number
    unmatched_tool_result_count: number
    nested_tool_use_count: number
    parsed_tool_use_count: number
  }
}

function deriveAllowedActions(events: ClaudeCodeSessionOutput["events"]): string[] {
  const actions = new Set<string>()
  for (const event of events) {
    if (event.type !== "tool_use") continue
    const tool = (event.tool ?? "").toLowerCase()
    if (["read", "grep", "glob", "ls", "list", "search"].includes(tool)) actions.add("read")
    if (["edit", "write", "multiedit", "replace"].includes(tool)) actions.add("write")
    if (["bash", "shell", "exec"].includes(tool) || event.command_summary) actions.add("exec")
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

function summarizeText(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  const compact = value.replace(/\s+/g, " ").trim()
  if (!compact) return fallback
  return compact.length > 140 ? `${compact.slice(0, 137)}...` : compact
}

function summarizeToolResultContent(content: unknown): { stdout_summary?: string; exit_code?: number } {
  if (typeof content === "string") {
    return { stdout_summary: "Tool result available." }
  }
  if (Array.isArray(content)) {
    const types = content
      .map((item) => (item && typeof item === "object" && typeof (item as { type?: unknown }).type === "string") ? (item as { type: string }).type : null)
      .filter(Boolean)
    return { stdout_summary: types.length ? `Tool result blocks: ${types.join(", ")}` : "Tool result available." }
  }
  if (content && typeof content === "object") {
    const record = content as Record<string, unknown>
    const summary = typeof record.summary === "string"
      ? record.summary
      : typeof record.stdout_summary === "string"
        ? record.stdout_summary
        : undefined
    const exitCode = typeof record.exit_code === "number" ? record.exit_code : undefined
    return {
      stdout_summary: summary ? summarizeText(summary, "Tool result available.") : "Tool result available.",
      exit_code: exitCode,
    }
  }
  return {}
}

function summarizeMessageLine(line: Record<string, unknown>, role: string, content: unknown): string {
  if (typeof line.summary === "string") {
    return summarizeText(line.summary, `${role} message`)
  }
  if (typeof content === "string") {
    return summarizeText(content, `${role} message`)
  }
  if (Array.isArray(content)) {
    const blockTypes = content
      .map((block) => (block && typeof block === "object" && typeof (block as { type?: unknown }).type === "string") ? (block as { type: string }).type : null)
      .filter(Boolean)
    return blockTypes.length ? `${role} content blocks: ${blockTypes.join(", ")}` : `${role} message`
  }
  return `${role} message`
}

export function parseClaudeCodeJsonlSession(
  text: string,
  options: { project?: string; sessionId?: string; workspace?: string; sourcePath?: string } = {},
): ClaudeCodeSessionOutput {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const parsed = lines.map((line, index) => {
    try {
      return JSON.parse(line) as Record<string, unknown>
    } catch {
      throw new Error(`Invalid JSONL at line ${index + 1}`)
    }
  })

  const project = options.project ?? "unknown-project"
  const sessionId = options.sessionId ?? (options.sourcePath ? basename(options.sourcePath, ".jsonl") : "claude-code-session-jsonl-001")
  const workspace = options.workspace ?? "/repo/unknown"

  const events: ClaudeCodeSessionOutput["events"] = []
  const toolUses = new Map<string, ClaudeCodeSessionOutput["events"][number]>()
  let sawNestedToolUse = false
  let sawNestedContentArray = false
  let unsupportedBlockCount = 0
  let unmatchedToolResultCount = 0
  let nestedToolUseCount = 0
  let parsedToolUseCount = 0
  const filesChanged = new Set<string>()
  let diffSha256: string | null = null

  for (const line of parsed) {
    const topType = typeof line.type === "string" ? line.type : undefined

    if (topType === "tool_use") {
      const tool = typeof line.tool === "string" ? line.tool : undefined
      const target = typeof line.target === "string" ? line.target : undefined
      const event = {
        type: "tool_use" as const,
        tool,
        target,
        status: line.status === "error" ? "error" as const : "completed" as const,
        command_summary: typeof line.command_summary === "string" ? line.command_summary : undefined,
        exit_code: typeof line.exit_code === "number" ? line.exit_code : undefined,
        stdout_summary: typeof line.stdout_summary === "string" ? summarizeText(line.stdout_summary, "Tool result available.") : undefined,
      }
      events.push(event)
      continue
    }

    const role = topType === "user" || topType === "assistant" || topType === "system"
      ? topType
      : typeof line.role === "string"
        ? line.role
        : "message"
    const message = line.message && typeof line.message === "object" ? line.message as Record<string, unknown> : null
    const content = message?.content ?? line.content

    if (Array.isArray(content)) {
      sawNestedContentArray = true
      events.push({
        type: "message",
        role,
        summary: summarizeMessageLine(line, role, content),
      })

      for (const block of content) {
        if (!block || typeof block !== "object") continue
        const blockRecord = block as Record<string, unknown>
        const blockType = typeof blockRecord.type === "string" ? blockRecord.type : undefined

        if (blockType === "tool_use") {
          sawNestedToolUse = true
          nestedToolUseCount += 1
          if (typeof blockRecord.name !== "string") {
            throw new Error("Unsupported Claude Code tool_use block: missing name")
          }
          const input = blockRecord.input && typeof blockRecord.input === "object" ? blockRecord.input as Record<string, unknown> : {}
          const target = typeof input.file_path === "string"
            ? input.file_path
            : typeof input.path === "string"
              ? input.path
              : typeof input.command === "string"
                ? input.command
                : workspace
          const tool = blockRecord.name
          const commandSummary = ["bash", "shell", "exec"].includes(tool.toLowerCase()) && typeof input.command === "string"
            ? input.command
            : undefined
          const event = {
            type: "tool_use" as const,
            tool,
            target,
            status: "pending" as const,
            command_summary: commandSummary,
            exit_code: undefined,
            stdout_summary: undefined,
          }
          events.push(event)
          parsedToolUseCount += 1
          const toolId = typeof blockRecord.id === "string" ? blockRecord.id : `${tool}-${events.length}`
          toolUses.set(toolId, event)
          if (typeof input.file_path === "string") filesChanged.add(input.file_path)
          if (typeof input.path === "string") filesChanged.add(input.path)
          if (typeof input.diff_sha256 === "string") diffSha256 = input.diff_sha256
          continue
        }

        if (blockType === "tool_result") {
          const toolUseId = typeof blockRecord.tool_use_id === "string" ? blockRecord.tool_use_id : undefined
          if (!toolUseId || !toolUses.has(toolUseId)) {
            unmatchedToolResultCount += 1
            continue
          }
          const event = toolUses.get(toolUseId)!
          const result = summarizeToolResultContent(blockRecord.content)
          event.status = blockRecord.status === "error" ? "error" : "completed"
          if (result.stdout_summary) event.stdout_summary = result.stdout_summary
          if (typeof result.exit_code === "number") event.exit_code = result.exit_code
          continue
        }

        if (blockType && blockType !== "text") {
          unsupportedBlockCount += 1
        }
      }
      continue
    }

    events.push({
      type: "message",
      role,
      summary: summarizeMessageLine(line, role, content),
    })
  }

  const messageEvents = events.filter((event) => event.type === "message")
  const toolEvents = events.filter((event) => event.type === "tool_use")
  const commandEvents = toolEvents.filter((event) => {
    const tool = (event.tool ?? "").toLowerCase()
    return ["bash", "shell", "exec"].includes(tool) || Boolean(event.command_summary)
  })
  const hasError = toolEvents.some((event) => event.status === "error")
  const firstUserSummary = messageEvents.find((event) => event.role === "user" && event.summary)?.summary

  if (sawNestedContentArray && sawNestedToolUse && toolEvents.length === 0) {
    throw new Error("Unsupported Claude Code JSONL: nested tool_use blocks could not be parsed")
  }

  return {
    schema: "claude.code.session.v0",
    project,
    session_id: sessionId,
    workspace,
    source_format: "claude-code-jsonl",
    runtime: {
      producer_id: "claude-code",
      generated_by: "claude.code.session.v0",
    },
    task: {
      title: "Claude Code local session",
      prompt_summary: firstUserSummary ?? "Claude Code local session transcript import.",
    },
    events,
    summary: {
      status: hasError ? "error" : "completed",
      message_count: messageEvents.length,
      tool_call_count: toolEvents.length,
      command_count: commandEvents.length,
      files_changed: Array.from(filesChanged),
      diff_sha256: diffSha256,
      unsupported_block_count: unsupportedBlockCount,
      unmatched_tool_result_count: unmatchedToolResultCount,
      nested_tool_use_count: nestedToolUseCount,
      parsed_tool_use_count: parsedToolUseCount,
    },
  }
}

export const claudeCodeSessionAdapter: ProducerAdapter<ClaudeCodeSessionOutput> = {
  id: "claude-code-session",
  sourceSchema: "claude.code.session.v0",
  matches(input: unknown): boolean {
    return typeof input === "object" && input !== null && (input as { schema?: unknown }).schema === "claude.code.session.v0"
  },
  normalize: normalizeClaudeCodeSessionOutput,
}
