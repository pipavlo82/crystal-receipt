import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import {
  computeReceiptRoot,
  createCapsuleSummary,
  createEvidenceCapsuleV0,
  createProvenanceSummaryV0,
  type HandoffEvidence,
} from "../src/receiptos"

type GenericProducerOutput = {
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

type NormalizedEvidence = HandoffEvidence

function parseArgs(argv: string[]) {
  let producer: string | undefined
  let input: string | undefined
  let out: string | undefined

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--producer") producer = argv[index + 1]
    if (arg === "--input") input = argv[index + 1]
    if (arg === "--out") out = argv[index + 1]
  }

  if (producer !== "generic" || !input || !out) {
    throw new Error("Usage: bun scripts/receiptos-import-producer.ts --producer generic --input <path> --out <dir>")
  }

  return { producer, input, out }
}

export function normalizeGenericProducerOutput(source: GenericProducerOutput): NormalizedEvidence {
  const normalizedWithoutAnchor: Omit<NormalizedEvidence, "anchor"> = {
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

  const receiptRoot = computeReceiptRoot({ ...normalizedWithoutAnchor, anchor: undefined } as NormalizedEvidence)

  return {
    ...normalizedWithoutAnchor,
    anchor: {
      receipt_root: receiptRoot,
      merkle_proof_status: "not attached",
      merkle_root: null,
      merkle_leaf_index: null,
      merkle_proof: [],
      onchain_anchor_status: "not anchored",
      network: "local/off-chain",
      contract: null,
      tx_hash: null,
      verifier_status: "not verified",
    },
  }
}

export async function runReceiptosImportProducer(argv: string[]) {
  const { input, out } = parseArgs(argv)
  const inputPath = resolve(input)
  const outDir = resolve(out)
  const source = JSON.parse(readFileSync(inputPath, "utf8")) as GenericProducerOutput
  const normalized = normalizeGenericProducerOutput(source)

  mkdirSync(outDir, { recursive: true })

  const normalizedPath = resolve(outDir, "normalized-evidence.json")
  writeFileSync(normalizedPath, JSON.stringify(normalized, null, 2) + "\n")

  const summary = await createCapsuleSummary(normalizedPath)
  const substrate = createEvidenceCapsuleV0(summary)
  const provenance = createProvenanceSummaryV0(substrate)

  writeFileSync(resolve(outDir, "capsule-summary.json"), JSON.stringify(summary, null, 2) + "\n")
  writeFileSync(resolve(outDir, "evidence-capsule.v0.json"), JSON.stringify(substrate, null, 2) + "\n")
  writeFileSync(resolve(outDir, "provenance-summary.v0.json"), JSON.stringify(provenance, null, 2) + "\n")
  console.log(outDir)
}

if (import.meta.main) {
  runReceiptosImportProducer(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
