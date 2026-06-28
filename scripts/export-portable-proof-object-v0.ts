import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import {
  createPortableProofObjectV0,
  type HandoffEvidence,
} from "../src/receiptos"
import {
  normalizeStealthHandoffOutput,
  type StealthHandoffOutput,
} from "../src/receiptos/adapters/stealth-handoff"

function parseArgs(argv: string[]) {
  const [input, output] = argv

  if (!input || !output) {
    throw new Error("Usage: bun scripts/export-portable-proof-object-v0.ts <stealth-evidence.json> <portable-proof-object-v0.json>")
  }

  return { input, output }
}

export async function runExportPortableProofObjectV0(argv: string[]) {
  const { input, output } = parseArgs(argv)
  const inputPath = resolve(input)
  const outputPath = resolve(output)
  const source = JSON.parse(readFileSync(inputPath, "utf8")) as StealthHandoffOutput
  const normalized = normalizeStealthHandoffOutput(source) as HandoffEvidence
  const portableProofObject = await createPortableProofObjectV0(normalized, {
    sourceEvidenceRef: inputPath,
  })

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, JSON.stringify(portableProofObject, null, 2) + "\n")
  console.log(outputPath)
}

if (import.meta.main) {
  runExportPortableProofObjectV0(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
