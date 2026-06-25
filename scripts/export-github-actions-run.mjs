#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { createHash } from "node:crypto"

function parseArgs(argv) {
  const args = {
    out: undefined,
    workflowName: undefined,
    jobName: undefined,
    conclusion: undefined,
    artifactSummary: undefined,
    commandSummary: undefined,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--out") args.out = argv[i + 1]
    if (arg === "--workflow-name") args.workflowName = argv[i + 1]
    if (arg === "--job-name") args.jobName = argv[i + 1]
    if (arg === "--conclusion") args.conclusion = argv[i + 1]
    if (arg === "--artifact-summary") args.artifactSummary = argv[i + 1]
    if (arg === "--command-summary") args.commandSummary = argv[i + 1]
  }

  if (!args.out || !args.workflowName || !args.jobName || !args.conclusion || !args.artifactSummary || !args.commandSummary) {
    throw new Error(
      "Usage: node scripts/export-github-actions-run.mjs --out <path> --workflow-name <name> --job-name <name> --conclusion <success|failure|cancelled|neutral> --artifact-summary <text> --command-summary <text>",
    )
  }

  return args
}

function requireEnv(name, fallback) {
  const value = process.env[name] ?? fallback
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function toInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function isoNow() {
  return new Date().toISOString()
}

function buildArtifactHash(fields) {
  return `0x${createHash("sha256").update(JSON.stringify(fields)).digest("hex")}`
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  const repository = requireEnv("GITHUB_REPOSITORY", "local/repo")
  const ref = requireEnv("GITHUB_REF", "refs/heads/main")
  const commitSha = requireEnv("GITHUB_SHA", "0000000000000000000000000000000000000000")
  const runId = toInteger(process.env.GITHUB_RUN_ID, 0)
  const runAttempt = toInteger(process.env.GITHUB_RUN_ATTEMPT, 1)
  const eventName = requireEnv("GITHUB_EVENT_NAME", "workflow_dispatch")
  const actor = requireEnv("GITHUB_ACTOR", "local-actor")
  const serverUrl = requireEnv("GITHUB_SERVER_URL", "https://github.com")
  const githubJob = requireEnv("GITHUB_JOB", args.jobName)
  const runnerName = requireEnv("RUNNER_NAME", "local-runner")

  const startedAt = process.env.RECEIPTOS_JOB_STARTED_AT ?? isoNow()
  const completedAt = process.env.RECEIPTOS_JOB_COMPLETED_AT ?? isoNow()

  const runUrl = `${serverUrl}/${repository}/actions/runs/${runId}`
  const artifactHash = buildArtifactHash({
    repository,
    ref,
    commitSha,
    runId,
    runAttempt,
    eventName,
    actor,
    workflowName: args.workflowName,
    jobName: args.jobName,
    conclusion: args.conclusion,
    commandSummary: args.commandSummary,
    artifactSummary: args.artifactSummary,
  })

  const payload = {
    schema: "github.actions_run.v0",
    repository,
    ref,
    commit_sha: commitSha,
    workflow: {
      name: args.workflowName,
      run_id: runId,
      run_attempt: runAttempt,
      event_name: eventName,
      html_url: runUrl,
    },
    job: {
      id: runId,
      name: args.jobName,
      runner_name: runnerName,
      status: "completed",
      conclusion: args.conclusion,
      started_at: startedAt,
      completed_at: completedAt,
    },
    actor: {
      login: actor,
    },
    steps: [
      {
        name: "Checkout",
        status: "completed",
        conclusion: "success",
      },
      {
        name: "Install dependencies",
        status: "completed",
        conclusion: "success",
        command_summary: "bun install",
      },
      {
        name: "Run ReceiptOS tests",
        status: "completed",
        conclusion: args.conclusion,
        command_summary: args.commandSummary,
      },
      {
        name: "Generate ReceiptOS artifacts",
        status: "completed",
        conclusion: args.conclusion,
      },
    ],
    evidence: {
      artifact_summary: args.artifactSummary,
      artifact_hash: artifactHash,
      files_changed: [],
      diff_sha256: null,
    },
    source_metadata: {
      producer_id: "github-actions",
      generated_by: "github.actions_run.v0",
    },
  }

  const outPath = resolve(args.out)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n")
  console.log(outPath)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
