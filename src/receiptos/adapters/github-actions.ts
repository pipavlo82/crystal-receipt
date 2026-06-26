import type { HandoffEvidence } from "../schema/types"
import type { ProducerAdapter } from "./types"
import { attachReceiptRoot, normalizeAllowedActions, parseUnixTimestamp } from "./shared"

export type GitHubActionsRunOutput = {
  schema: "github.actions_run.v0"
  repository: string
  ref: string
  commit_sha: string
  workflow: {
    name: string
    run_id: number
    run_attempt: number
    event_name: string
    html_url: string
  }
  job: {
    id: number
    name: string
    runner_name: string
    status: "completed" | "error"
    conclusion: "success" | "failure" | "cancelled" | "neutral"
    started_at: string
    completed_at: string
  }
  actor: {
    login: string
  }
  steps: {
    name: string
    status: "completed" | "error"
    conclusion: "success" | "failure" | "cancelled" | "neutral"
    command_summary?: string
  }[]
  evidence: {
    artifact_summary?: string
    artifact_hash?: string | null
    files_changed: string[]
    diff_sha256: string | null
  }
  source_metadata: {
    producer_id: string
    generated_by: string
  }
}

export function normalizeGitHubActionsRunOutput(source: GitHubActionsRunOutput): HandoffEvidence {
  const sessionId = `gha-run-${source.workflow.run_id}-job-${source.job.id}`
  const target = source.repository
  const startedAt = parseUnixTimestamp(source.job.started_at)
  const completedAt = parseUnixTimestamp(source.job.completed_at)
  const allowedActions = normalizeAllowedActions([], target)
  const stateHash = source.evidence.diff_sha256 ?? source.evidence.artifact_hash ?? "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

  const normalizedWithoutAnchor: Omit<HandoffEvidence, "anchor"> = {
    schema: "stealth.session.evidence.v1",
    session_id: sessionId,
    directory: source.repository,
    task: {
      title: `GitHub Actions ${source.workflow.name} / ${source.job.name}`,
      prompt: source.evidence.artifact_summary ?? `${source.workflow.event_name} on ${source.ref} at ${source.commit_sha}`,
    },
    agent: {
      id: source.source_metadata.producer_id,
      runtime: "github/actions",
    },
    scope: {
      permission: null,
      lease: {
        id: `${sessionId}:scoped-lease:v1`,
        mode: "read_only",
        target,
        allowed_actions: allowedActions,
        issued_at: startedAt,
        expires_at: null,
        status: "missing",
      },
    },
    authorization: {
      delegation_ref: null,
      delegator: source.actor.login,
      agent_operator: source.source_metadata.producer_id,
      target,
      allowed_actions: allowedActions,
      authorization_valid_from: null,
      authorization_expiry: null,
      authorization_checked_at: completedAt,
      authorization_state_hash: stateHash,
      authorized_at_execution: null,
    },
    execution: source.steps.map((step, index) => ({
      call_id: `${sessionId}:step-${String(index + 1).padStart(3, "0")}`,
      tool: "github-actions-step",
      action_performed: step.command_summary ?? step.name,
      target: source.workflow.html_url,
      execution_timestamp: startedAt,
      completed_timestamp: completedAt,
      status: step.conclusion === "failure" ? "error" : "completed",
      scope_match: null,
    })),
    commands: source.steps
      .filter((step) => Boolean(step.command_summary))
      .map((step) => ({
        command: step.command_summary!,
        stdout_summary: `${step.name}: ${step.conclusion}`,
      })),
    changes: {
      files_changed: source.evidence.files_changed,
      diff_sha256: source.evidence.diff_sha256,
    },
    metadata: {
      message_count: source.steps.length,
      diff_count: source.evidence.files_changed.length,
      generated_by: source.source_metadata.generated_by,
    },
  }

  const normalized = attachReceiptRoot(normalizedWithoutAnchor)

  return normalized.commands.length > 0
    ? normalized
    : {
        ...normalized,
        commands: source.evidence.artifact_summary
          ? [{ command: "(no command recorded)", stdout_summary: source.evidence.artifact_summary }]
          : normalized.commands,
      }
}

export const githubActionsAdapter: ProducerAdapter<GitHubActionsRunOutput> = {
  id: "github-actions",
  sourceSchema: "github.actions_run.v0",
  matches(input: unknown): boolean {
    return typeof input === "object" && input !== null && (input as { schema?: unknown }).schema === "github.actions_run.v0"
  },
  normalize: normalizeGitHubActionsRunOutput,
}
