import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { buildEvidenceCapsuleViewModel } from "../../src/receiptos/capsule/evidence-capsule"
import { buildRenderPlan, buildRenderPlanFromCapsule, getRenderPlanZoneDefinitions } from "../../src/receiptos/capsule/render-plan"
import { buildCrystalReceiptMapping } from "../../src/receiptos/capsule/crystal-mapping"
import type { HandoffEvidence } from "../../src/receiptos/schema/types"

function readEvidence(name: string): HandoffEvidence {
  return JSON.parse(readFileSync(resolve(import.meta.dir, "../../src/receiptos/fixtures", name), "utf8")) as HandoffEvidence
}

describe("receiptos render plan", () => {
  test("semantic zone definitions are stable and ordered", () => {
    expect(getRenderPlanZoneDefinitions().map((zone) => zone.id)).toEqual([
      "core",
      "inner_ring",
      "facets",
      "outer_shell",
      "anchor_edge",
      "seal",
    ])
  })

  test("builds a complete unique mapping over capsule sections", async () => {
    const capsule = await buildEvidenceCapsuleViewModel(readEvidence("session-evidence.sample.json"))
    const plan = buildRenderPlanFromCapsule(capsule)

    expect(plan.source.section_count).toBe(capsule.sections.length)
    expect(plan.invariants.complete).toBe(true)
    expect(plan.invariants.unique).toBe(true)
    expect(plan.invariants.unmapped_section_ids).toEqual([])
    expect(plan.invariants.duplicate_section_ids).toEqual([])
    expect([...plan.invariants.mapped_section_ids].sort()).toEqual([...plan.invariants.all_section_ids].sort())
  })

  test("is deterministic when derived twice from the same capsule", async () => {
    const capsule = await buildEvidenceCapsuleViewModel(readEvidence("session-evidence.with-local-merkle.sample.json"))
    const planA = buildRenderPlanFromCapsule(capsule)
    const planB = buildRenderPlanFromCapsule(capsule)
    expect(planA).toEqual(planB)
  })

  test("preserves crystal mapping section membership for the existing renderer semantics", async () => {
    const evidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    const plan = await buildRenderPlan(evidence)
    const mapping = await buildCrystalReceiptMapping(evidence)

    expect(plan.zones.find((zone) => zone.id === "core")?.section_ids).toEqual(mapping.core.map((section) => section.id))
    expect(plan.zones.find((zone) => zone.id === "inner_ring")?.section_ids).toEqual(mapping.inner_ring.map((section) => section.id))
    expect(plan.zones.find((zone) => zone.id === "facets")?.section_ids).toEqual(mapping.facets.map((section) => section.id))
    expect(plan.zones.find((zone) => zone.id === "outer_shell")?.section_ids).toEqual(mapping.outer_shell.map((section) => section.id))
    expect(plan.zones.find((zone) => zone.id === "anchor_edge")?.section_ids).toEqual(mapping.anchor_edge.map((section) => section.id))
    expect(plan.zones.find((zone) => zone.id === "seal")?.section_ids).toEqual(mapping.seal.sections.map((section) => section.id))
  })

  test("tracks mismatched proof status without mutating receipt semantics", async () => {
    const plan = await buildRenderPlan(readEvidence("session-evidence.tampered.sample.json"))
    const outerShell = plan.zones.find((zone) => zone.id === "outer_shell")
    const seal = plan.zones.find((zone) => zone.id === "seal")

    expect(outerShell?.sections.find((section) => section.id === "receipt_root")?.status).toBe("mismatch")
    expect(seal?.sections.find((section) => section.id === "verifier")?.status).toBe("mismatch")
  })
})
