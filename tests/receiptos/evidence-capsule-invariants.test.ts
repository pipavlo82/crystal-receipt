import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { validateEvidenceCapsuleInvariants } from "../../scripts/evidence-capsule-invariants"

function readJson(path: string) {
  return JSON.parse(readFileSync(resolve(import.meta.dir, path), "utf8"))
}

describe("receiptos evidence capsule invariants", () => {
  test("clean passes", () => {
    const doc = readJson("../../examples/receipt-examples/clean-local-proof/evidence-capsule.v0.json")
    const result = validateEvidenceCapsuleInvariants(doc)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  test("anchored passes", () => {
    const doc = readJson("../../examples/receipt-examples/anchored-proof/evidence-capsule.v0.json")
    const result = validateEvidenceCapsuleInvariants(doc)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  test("tampered fails", () => {
    const doc = readJson("../../examples/receipt-examples/tampered-mismatch/evidence-capsule.v0.json")
    const result = validateEvidenceCapsuleInvariants(doc)
    expect(result.ok).toBe(false)
    expect(result.errors).toContain("receipt_root.match must be true for an invariant-valid substrate")
    expect(result.errors).toContain("verifier_result.ok must be true for an invariant-valid substrate")
  })

  test("contradictory anchor fixture fails", () => {
    const doc = readJson("../fixtures/contradictory-anchor.evidence-capsule.v0.json")
    const result = validateEvidenceCapsuleInvariants(doc)
    expect(result.ok).toBe(false)
    expect(result.errors).toContain("proof_refs.anchor.status must match capsule.sections[id=anchor].status")
  })
})
