import { createHash } from "node:crypto"
import { describe, expect, test } from "bun:test"
import { buildHandoffEvidence } from "@/session/handoff/evidence"
import type { MessageV2 } from "@/session/message-v2"
import type { Session } from "@/session/session"
import type { Snapshot } from "@/snapshot"

function session(permission: unknown = [
  {
    permission: "bash",
    pattern: "git diff -- README.md",
    action: "allow" as const,
  },
]) {
  return {
    id: "ses_authorization_test",
    directory: "C:\\demo\\stealth-project",
    title: "Update README",
    agent: "build",
    permission,
    time: {
      created: 1_781_000_000_000,
      updated: 1_781_000_003_000,
    },
  } as unknown as Session.Info
}

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex")
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

function stripAnchor<T extends { anchor?: unknown }>(value: T): Omit<T, "anchor"> {
  const clone = { ...value } as Record<string, unknown>
  delete clone.anchor
  return clone as Omit<T, "anchor">
}

function messages() {
  return [
    {
      info: {
        role: "assistant",
      },
      parts: [
        {
          type: "tool",
          callID: "call_demo_001",
          tool: "bash",
          state: {
            status: "completed",
            input: {
              command: "git diff -- README.md",
            },
            output: "README.md changed",
            title: "Run git diff",
            metadata: {
              exit_code: 0,
            },
            time: {
              start: 1_781_000_001_000,
              end: 1_781_000_002_000,
            },
          },
        },
      ],
    },
  ] as unknown as MessageV2.WithParts[]
}

describe("buildHandoffEvidence v1", () => {
  test("captures authorization snapshot and execution timestamps without overclaiming", () => {
    const evidence = buildHandoffEvidence({
      session: session(),
      messages: messages(),
      diffs: [],
    })

    expect(evidence.schema).toBe("stealth.session.evidence.v1")
    expect(evidence.metadata.generated_by).toBe("stealth.handoff.evidence.builder.v1")

    expect(evidence.authorization.target).toBe("C:\\demo\\stealth-project")
    expect(evidence.authorization.agent_operator).toBe("build")
    expect(evidence.authorization.allowed_actions).toEqual([
      {
        permission: "bash",
        pattern: "git diff -- README.md",
        action: "allow",
      },
    ])

    expect(evidence.authorization.authorization_state_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(evidence.authorization.authorization_checked_at).toBe(1_781_000_003_000)

    expect(evidence.authorization.delegation_ref).toBeNull()
    expect(evidence.authorization.authorization_valid_from).toBeNull()
    expect(evidence.authorization.authorization_expiry).toBeNull()
    expect(evidence.authorization.authorized_at_execution).toBeNull()

    expect(evidence.execution).toEqual([
      {
        call_id: "call_demo_001",
        tool: "bash",
        action_performed: "git diff -- README.md",
        target: "C:\\demo\\stealth-project",
        execution_timestamp: 1_781_000_001_000,
        completed_timestamp: 1_781_000_002_000,
        status: "completed",
        scope_match: null,
      },
    ])
  })

  test("produces a deterministic authorization hash and changes it when permission changes", () => {
    const first = buildHandoffEvidence({
      session: session(),
      messages: [],
      diffs: [],
    })

    const second = buildHandoffEvidence({
      session: session(),
      messages: [],
      diffs: [],
    })

    const changed = buildHandoffEvidence({
      session: session([
        {
          permission: "bash",
          pattern: "bun test",
          action: "allow",
        },
      ]),
      messages: [],
      diffs: [],
    })

    expect(first.authorization.authorization_state_hash).toBe(
      second.authorization.authorization_state_hash,
    )

    expect(changed.authorization.authorization_state_hash).not.toBe(
      first.authorization.authorization_state_hash,
    )
  })

  test("self-verifies receipt_root against full evidence json without anchor", () => {
    const evidence = buildHandoffEvidence({
      session: session(),
      messages: messages(),
      diffs: [
        {
          file: "apps/contracts/anchor-root-encoded-test.txt",
          additions: 1,
          deletions: 0,
          status: "modified",
        } as Snapshot.FileDiff,
      ],
    })

    const withoutAnchor = stripAnchor(evidence)
    const recomputed = "0x" + sha256(canonicalize(withoutAnchor))

    expect(evidence.anchor.receipt_root).toBe(recomputed)
  })

  test("uses explicit null for scope.permission when permission is absent", () => {
    const noPermissionSession = {
      ...session(),
      permission: undefined,
    } as unknown as Session.Info

    const evidence = buildHandoffEvidence({
      session: noPermissionSession,
      messages: messages(),
      diffs: [],
    })

    expect(evidence.scope).toEqual({
      permission: null,
    })

    const withoutAnchor = stripAnchor(evidence)
    const recomputed = "0x" + sha256(canonicalize(withoutAnchor))

    expect(evidence.anchor.receipt_root).toBe(recomputed)
  })
  test("defaults Merkle proof metadata to not attached", () => {
    const evidence = buildHandoffEvidence({
      session: session(),
      messages: messages(),
      diffs: [],
    })

    expect(evidence.anchor).toMatchObject({
      merkle_proof_status: "not attached",
      merkle_root: null,
      merkle_leaf_index: null,
      merkle_proof: [],
      onchain_anchor_status: "not anchored",
      network: "local/off-chain",
      contract: null,
      tx_hash: null,
      verifier_status: "not verified",
    })

    const withoutAnchor = stripAnchor(evidence)
    const recomputed = "0x" + sha256(canonicalize(withoutAnchor))

    expect(evidence.anchor.receipt_root).toBe(recomputed)
  })
})
