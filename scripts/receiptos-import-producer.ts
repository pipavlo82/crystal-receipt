import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  createCapsuleSummary,
  createEvidenceCapsuleV0,
  createProvenanceSummaryV0,
} from "../src/receiptos"
import {
  normalizeExternalCodingRunOutput,
  type ExternalCodingRunOutput,
} from "../src/receiptos/adapters/external-coding-run"
import {
  normalizeGenericProducerOutput,
  type GenericProducerOutput,
} from "../src/receiptos/adapters/generic"
import {
  normalizeGitHubActionsRunOutput,
  type GitHubActionsRunOutput,
} from "../src/receiptos/adapters/github-actions"
import {
  normalizeStealthHandoffOutput,
  type StealthHandoffOutput,
} from "../src/receiptos/adapters/stealth-handoff"
import {
  normalizeClaudeCodeSessionOutput,
  type ClaudeCodeSessionOutput,
} from "../src/receiptos/adapters/claude-code-session"
import { resolveProducerAdapter } from "../src/receiptos/adapters/registry"

export {
  normalizeGenericProducerOutput,
  normalizeExternalCodingRunOutput,
  normalizeGitHubActionsRunOutput,
  normalizeStealthHandoffOutput,
  normalizeClaudeCodeSessionOutput,
}

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

  if ((producer !== "generic" && producer !== "external-coding-run" && producer !== "github-actions" && producer !== "stealth-handoff" && producer !== "claude-code-session") || !input || !out) {
    throw new Error("Usage: bun scripts/receiptos-import-producer.ts --producer <generic|external-coding-run|github-actions|stealth-handoff|claude-code-session> --input <path> --out <dir>")
  }

  return { producer, input, out }
}

export async function runReceiptosImportProducer(argv: string[]) {
  const { producer, input, out } = parseArgs(argv)
  const inputPath = resolve(input)
  const outDir = resolve(out)
  const source = JSON.parse(readFileSync(inputPath, "utf8")) as GenericProducerOutput | ExternalCodingRunOutput | GitHubActionsRunOutput | StealthHandoffOutput | ClaudeCodeSessionOutput
  const adapter = resolveProducerAdapter(producer)
  const normalized = adapter.normalize(source as never)

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
