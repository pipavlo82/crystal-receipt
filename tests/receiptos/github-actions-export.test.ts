import { describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { execFileSync } from "node:child_process"

function runHelper(env: Record<string, string>) {
  const tempDir = mkdtempSync(join(tmpdir(), "receiptos-github-actions-export-"))
  const outPath = resolve(tempDir, "github.actions_run.v0.json")

  try {
    execFileSync(
      process.execPath,
      [
        "scripts/export-github-actions-run.mjs",
        "--out",
        outPath,
        "--workflow-name",
        "ReceiptOS Export",
        "--job-name",
        "receiptos-export",
        "--conclusion",
        "success",
        "--artifact-summary",
        "ReceiptOS test suite passed in CI.",
        "--command-summary",
        "bun test tests/receiptos",
      ],
      {
        cwd: resolve(import.meta.dir, "../.."),
        env: {
          ...process.env,
          ...env,
        },
        stdio: "pipe",
      },
    )

    return JSON.parse(readFileSync(outPath, "utf8"))
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

describe("github actions export helper", () => {
  test("emits a curated github.actions_run.v0 artifact from whitelisted env", () => {
    const json = runHelper({
      GITHUB_REPOSITORY: "pipavlo82/crystal-receipt",
      GITHUB_REF: "refs/heads/main",
      GITHUB_SHA: "0123456789abcdef0123456789abcdef01234567",
      GITHUB_RUN_ID: "1234567890",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_EVENT_NAME: "workflow_dispatch",
      GITHUB_ACTOR: "octocat",
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_JOB: "receiptos-export",
      RUNNER_NAME: "GitHub Actions hosted runner",
      RECEIPTOS_JOB_STARTED_AT: "2026-06-25T12:00:00Z",
      RECEIPTOS_JOB_COMPLETED_AT: "2026-06-25T12:03:00Z",
    })

    expect(json.schema).toBe("github.actions_run.v0")
    expect(json.repository).toBe("pipavlo82/crystal-receipt")
    expect(json.ref).toBe("refs/heads/main")
    expect(json.commit_sha).toBe("0123456789abcdef0123456789abcdef01234567")
    expect(json.workflow.run_id).toBe(1234567890)
    expect(json.workflow.run_attempt).toBe(1)
    expect(json.workflow.event_name).toBe("workflow_dispatch")
    expect(json.source_metadata.producer_id).toBe("github-actions")
    expect(json.source_metadata.generated_by).toBe("github.actions_run.v0")
    expect(json.steps[2].command_summary).toBe("bun test tests/receiptos")
    expect(json.evidence.artifact_hash).toMatch(/^0x[a-f0-9]{64}$/)
  })
})
