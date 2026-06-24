import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import {
  createCapsuleSummary,
  createEvidenceCapsuleV0,
  createProvenanceSummaryV0,
} from "../src/receiptos"

export { createCapsuleSummary, createEvidenceCapsuleV0, createProvenanceSummaryV0 } from "../src/receiptos"

function parseArgs(argv: string[]) {
  let evidence: string | undefined
  let out: string | undefined

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--evidence") evidence = argv[index + 1]
    if (arg === "--out") out = argv[index + 1]
  }

  if (!evidence || !out) {
    throw new Error("Usage: bun scripts/receiptos-capsule-demo.ts --evidence <path> --out <path>")
  }

  return { evidence, out }
}


export async function runReceiptosCapsuleDemo(argv: string[]) {
  const { evidence, out } = parseArgs(argv)
  const summary = await createCapsuleSummary(evidence)
  const substrate = createEvidenceCapsuleV0(summary)
  const provenanceSummary = createProvenanceSummaryV0(substrate)
  const outPath = resolve(out)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify({ ...summary, provenance_summary: provenanceSummary }, null, 2) + "\n")
  const substratePath = resolve(dirname(outPath), "evidence-capsule.v0.json")
  writeFileSync(substratePath, JSON.stringify(substrate, null, 2) + "\n")
  const renderPlanPath = resolve(dirname(outPath), "render-plan.v0.json")
  writeFileSync(renderPlanPath, JSON.stringify(summary.render_plan, null, 2) + "\n")
  console.log(outPath)
}

if (import.meta.main) {
  runReceiptosCapsuleDemo(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
