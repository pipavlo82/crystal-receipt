import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { computeReceiptRoot, stripAnchor } from "../../src/receiptos/canon/receipt-root"
import {
  buildEvidenceCapsuleViewModel,
  getCapsuleStageStatuses,
  getProofSurfaceStatus,
} from "../../src/receiptos/capsule/evidence-capsule"
import type { HandoffEvidence } from "../../src/receiptos/schema/types"

function readEvidence(name: string): HandoffEvidence {
  return JSON.parse(readFileSync(resolve(import.meta.dir, "../../src/receiptos/fixtures", name), "utf8")) as HandoffEvidence
}

describe("receiptos evidence capsule view model", () => {
  test("valid sample produces capsule sections", async () => {
    const evidence = readEvidence("session-evidence.sample.json")
    const capsule = await buildEvidenceCapsuleViewModel(evidence)
    expect(capsule.sections.length).toBe(13)
  })

  test("includes payload/action section", async () => {
    const evidence = readEvidence("session-evidence.sample.json")
    const capsule = await buildEvidenceCapsuleViewModel(evidence)
    expect(capsule.sections.some((section) => section.id === "payload")).toBe(true)
  })

  test("includes policy/authorization section", async () => {
    const evidence = readEvidence("session-evidence.sample.json")
    const capsule = await buildEvidenceCapsuleViewModel(evidence)
    expect(capsule.sections.some((section) => section.id === "policy_boundary")).toBe(true)
    expect(capsule.sections.some((section) => section.id === "authorization")).toBe(true)
  })

  test("includes execution/evidence section", async () => {
    const evidence = readEvidence("session-evidence.sample.json")
    const capsule = await buildEvidenceCapsuleViewModel(evidence)
    expect(capsule.sections.some((section) => section.id === "execution")).toBe(true)
    expect(capsule.sections.some((section) => section.id === "evidence")).toBe(true)
  })

  test("includes decision trace, counterfactual, and replay manifest sections", async () => {
    const evidence = readEvidence("session-evidence.sample.json")
    const capsule = await buildEvidenceCapsuleViewModel(evidence)
    expect(capsule.sections.some((section) => section.id === "decision_trace")).toBe(true)
    expect(capsule.sections.some((section) => section.id === "counterfactual")).toBe(true)
    expect(capsule.sections.some((section) => section.id === "replay_manifest")).toBe(true)
  })

  test("includes receipt_root section", async () => {
    const evidence = readEvidence("session-evidence.sample.json")
    const capsule = await buildEvidenceCapsuleViewModel(evidence)
    expect(capsule.sections.some((section) => section.id === "receipt_root")).toBe(true)
  })

  test("base sample without local Merkle shows Merkle/anchor as pending or missing", async () => {
    const evidence = readEvidence("session-evidence.sample.json")
    const statuses = await getCapsuleStageStatuses(evidence)
    expect(statuses.merkle).toBe("pending")
    expect(statuses.anchor).toBe("missing")
  })

  test("local Merkle fixture shows Merkle as valid", async () => {
    const evidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    const statuses = await getCapsuleStageStatuses(evidence)
    expect(statuses.merkle).toBe("valid")
    expect(statuses.anchor).toBe("pending")
  })

  test("verifier status reflects root verification", async () => {
    const evidence = readEvidence("session-evidence.sample.json")
    const proof = await getProofSurfaceStatus(evidence)
    expect(proof.verifier).toBe("verified")
  })

  test("tampered fixture shows mismatch/invalid verification", async () => {
    const evidence = readEvidence("session-evidence.tampered.sample.json")
    const proof = await getProofSurfaceStatus(evidence)
    expect(proof.receipt_root).toBe("mismatch")
    expect(proof.verifier).toBe("mismatch")
  })

  test("counterfactual remains interpretive when no denied-action evidence exists", async () => {
    const evidence = readEvidence("session-evidence.sample.json")
    const capsule = await buildEvidenceCapsuleViewModel(evidence)
    const counterfactual = capsule.sections.find((section) => section.id === "counterfactual")
    expect(counterfactual?.status).toBe("missing")
    expect(counterfactual?.summary).toContain("No explicit denied-action")
  })

  test("input evidence is not mutated", async () => {
    const evidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    const before = JSON.stringify(evidence)
    void await buildEvidenceCapsuleViewModel(evidence)
    expect(JSON.stringify(evidence)).toBe(before)
  })

  test("computeReceiptRoot(evidence) is unchanged before and after building view model", async () => {
    const evidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    const before = computeReceiptRoot(stripAnchor(evidence))
    void await buildEvidenceCapsuleViewModel(evidence)
    const after = computeReceiptRoot(stripAnchor(evidence))
    expect(after).toBe(before)
  })
})
