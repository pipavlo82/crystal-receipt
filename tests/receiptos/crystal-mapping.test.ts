import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { buildCrystalReceiptMapping } from "../../src/receiptos/capsule/crystal-mapping"
import type { HandoffEvidence } from "../../src/receiptos/schema/types"

function readEvidence(name: string): HandoffEvidence {
  return JSON.parse(readFileSync(resolve(import.meta.dir, "../../src/receiptos/fixtures", name), "utf8")) as HandoffEvidence
}

describe("receiptos crystal receipt mapping", () => {
  test("core maps to payload/action", async () => {
    const mapping = await buildCrystalReceiptMapping(readEvidence("session-evidence.sample.json"))
    expect(mapping.core.map((section) => section.id)).toEqual(["payload"])
  })

  test("inner ring maps to policy + authorization + decision trace", async () => {
    const mapping = await buildCrystalReceiptMapping(readEvidence("session-evidence.sample.json"))
    expect(mapping.inner_ring.map((section) => section.id)).toEqual(["policy_boundary", "authorization", "decision_trace"])
  })

  test("facets map to execution + evidence + counterfactual", async () => {
    const mapping = await buildCrystalReceiptMapping(readEvidence("session-evidence.sample.json"))
    expect(mapping.facets.map((section) => section.id)).toEqual(["execution", "evidence", "counterfactual"])
  })

  test("outer shell maps to result + receipt_root + replay_manifest", async () => {
    const mapping = await buildCrystalReceiptMapping(readEvidence("session-evidence.sample.json"))
    expect(mapping.outer_shell.map((section) => section.id)).toEqual(["result", "receipt_root", "replay_manifest"])
  })

  test("anchor edge maps to Merkle/external anchor status", async () => {
    const mapping = await buildCrystalReceiptMapping(readEvidence("session-evidence.with-local-merkle.sample.json"))
    expect(mapping.anchor_edge.map((section) => section.id)).toEqual(["merkle", "anchor"])
  })

  test("seal maps to verifier status", async () => {
    const mapping = await buildCrystalReceiptMapping(readEvidence("session-evidence.sample.json"))
    expect(mapping.seal.sections.map((section) => section.id)).toEqual(["verifier"])
    expect(mapping.seal.status).toBe("verified")
  })
})
