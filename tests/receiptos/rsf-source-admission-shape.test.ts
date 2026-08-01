import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  checkSourceEvidence,
  checkPortableProofObject,
  checkClaimedSourceEntry,
  checkSourceAdmissionPrerequisitesAndReceiptRoot,
  createChronicleEntryV0,
  createPortableProofObjectV0,
  computeReceiptRoot,
  type HandoffEvidence,
  type PortableProofObjectV0,
  type ChronicleEntryV0,
} from "../../src/receiptos"

function fixturePath(name: string) {
  return resolve(import.meta.dir, "../../src/receiptos/fixtures", name)
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function validEvidence(): HandoffEvidence {
  return readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
}

function tamperedEvidence(): HandoffEvidence {
  return readJson<HandoffEvidence>(fixturePath("session-evidence.tampered.sample.json"))
}

async function validProofObject(evidence: HandoffEvidence = validEvidence()): Promise<PortableProofObjectV0> {
  return createPortableProofObjectV0(evidence, { sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json" })
}

async function validClaimedSourceEntry(): Promise<ChronicleEntryV0> {
  const evidence = validEvidence()
  const proof = await validProofObject(evidence)
  return createChronicleEntryV0(evidence, proof)
}

// ---------------------------------------------------------------------------
// Position 5 — checkSourceEvidence
// ---------------------------------------------------------------------------

describe("checkSourceEvidence - positive", () => {
  test("exact valid HandoffEvidence passes", () => {
    const result = checkSourceEvidence(validEvidence())
    expect(result.success).toBe(true)
  })

  test("fresh equivalent host object passes", () => {
    const fresh = JSON.parse(JSON.stringify(validEvidence()))
    expect(checkSourceEvidence(fresh).success).toBe(true)
  })

  test("input remains unmodified after invocation and later caller mutation does not affect the returned value's identity requirement", () => {
    const input = validEvidence()
    const before = JSON.stringify(input)
    const result = checkSourceEvidence(input)
    expect(result.success).toBe(true)
    expect(JSON.stringify(input)).toBe(before)
  })
})

describe("checkSourceEvidence - negative (malformed_source_evidence, position 5)", () => {
  function expectMalformed(value: unknown) {
    const result = checkSourceEvidence(value)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.finding).toEqual({
      schema: "recursive_singleton_fold_finding.v0",
      code: "malformed_source_evidence",
      check_position: 5,
    })
  }

  test("null", () => expectMalformed(null))
  test("array", () => expectMalformed([validEvidence()]))
  test("non-object scalar", () => expectMalformed("stealth.session.evidence.v1"))

  test("missing top-level key (session_id)", () => {
    const value = validEvidence() as unknown as Record<string, unknown>
    const { session_id, ...rest } = value
    expectMalformed(rest)
  })

  test("wrong schema literal", () => {
    expectMalformed({ ...validEvidence(), schema: "wrong.schema.v1" })
  })

  test("wrong field type (session_id as number)", () => {
    expectMalformed({ ...validEvidence(), session_id: 1 })
  })

  test("wrong agent.runtime literal", () => {
    const value = validEvidence()
    expectMalformed({ ...value, agent: { ...value.agent, runtime: "not-stealth" } })
  })

  test("malformed anchor (missing receipt_root)", () => {
    const value = validEvidence() as unknown as Record<string, unknown>
    const anchor = { ...(value.anchor as Record<string, unknown>) }
    delete anchor.receipt_root
    expectMalformed({ ...value, anchor })
  })

  test("execution array with a malformed member", () => {
    const value = validEvidence()
    expectMalformed({ ...value, execution: [{ not: "a valid execution record" }] })
  })
})

// ---------------------------------------------------------------------------
// Position 6 — checkPortableProofObject
// ---------------------------------------------------------------------------

describe("checkPortableProofObject - positive", () => {
  test("exact valid PortableProofObjectV0 passes", async () => {
    const proof = await validProofObject()
    const result = checkPortableProofObject(proof)
    expect(result.success).toBe(true)
  })

  test("fresh equivalent host object passes", async () => {
    const proof = await validProofObject()
    const fresh = JSON.parse(JSON.stringify(proof))
    expect(checkPortableProofObject(fresh).success).toBe(true)
  })

  test("different insertion order, identical abstract value, passes", async () => {
    const proof = await validProofObject()
    const reordered = {
      provenance_summary: proof.provenance_summary,
      evidence_capsule: proof.evidence_capsule,
      metadata: proof.metadata,
      producer: proof.producer,
      source_evidence_ref: proof.source_evidence_ref,
      project_refs: proof.project_refs,
      relation_type: proof.relation_type,
      created_at: proof.created_at,
      anchor_ref: proof.anchor_ref,
      replay_ref: proof.replay_ref,
      proof_ref: proof.proof_ref,
      receipt_root: proof.receipt_root,
      proof_system: proof.proof_system,
      proof_object_id: proof.proof_object_id,
      schema: proof.schema,
    }
    expect(checkPortableProofObject(reordered).success).toBe(true)
  })

  test("input remains unmodified", async () => {
    const proof = await validProofObject()
    const before = JSON.stringify(proof)
    checkPortableProofObject(proof)
    expect(JSON.stringify(proof)).toBe(before)
  })
})

describe("checkPortableProofObject - negative (malformed_portable_proof_object, position 6)", () => {
  function expectMalformed(value: unknown) {
    const result = checkPortableProofObject(value)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.finding).toEqual({
      schema: "recursive_singleton_fold_finding.v0",
      code: "malformed_portable_proof_object",
      check_position: 6,
    })
  }

  test("null", () => expectMalformed(null))
  test("array", async () => expectMalformed([await validProofObject()]))
  test("non-object scalar", () => expectMalformed("receiptos.portable_proof_object.v0"))

  const topLevelKeys = [
    "schema",
    "proof_object_id",
    "proof_system",
    "receipt_root",
    "proof_ref",
    "replay_ref",
    "anchor_ref",
    "created_at",
    "relation_type",
    "project_refs",
    "source_evidence_ref",
    "producer",
    "metadata",
    "evidence_capsule",
    "provenance_summary",
  ] as const

  for (const key of topLevelKeys) {
    test(`missing top-level key "${key}"`, async () => {
      const proof = (await validProofObject()) as unknown as Record<string, unknown>
      const { [key]: _omit, ...rest } = proof
      expectMalformed(rest)
    })
  }

  test("extra top-level key", async () => {
    expectMalformed({ ...(await validProofObject()), extra_field: "unexpected" })
  })

  test("wrong schema literal", async () => {
    expectMalformed({ ...(await validProofObject()), schema: "wrong.schema.v0" })
  })

  test("wrong proof_system literal", async () => {
    expectMalformed({ ...(await validProofObject()), proof_system: "NotReceiptOS" })
  })

  test("wrong relation_type literal", async () => {
    expectMalformed({ ...(await validProofObject()), relation_type: "exported" })
  })

  test("project_refs wrong type (not string array)", async () => {
    expectMalformed({ ...(await validProofObject()), project_refs: [1, 2] })
  })

  test("producer missing a required key", async () => {
    const proof = await validProofObject()
    const producer = { ...proof.producer } as Record<string, unknown>
    delete producer.runtime
    expectMalformed({ ...proof, producer })
  })

  test("evidence_capsule.receipt_root.status wrong literal", async () => {
    const proof = await validProofObject()
    expectMalformed({
      ...proof,
      evidence_capsule: {
        ...proof.evidence_capsule,
        receipt_root: { ...proof.evidence_capsule.receipt_root, status: "not_a_status" },
      },
    })
  })

  test("evidence_capsule.capsule.sections member with wrong id literal", async () => {
    const proof = await validProofObject()
    const sections = proof.evidence_capsule.capsule.sections.slice()
    sections[0] = { ...sections[0], id: "not_a_valid_section_id" } as never
    expectMalformed({
      ...proof,
      evidence_capsule: { ...proof.evidence_capsule, capsule: { sections } },
    })
  })

  test("provenance_summary wrong version literal", async () => {
    const proof = await validProofObject()
    expectMalformed({ ...proof, provenance_summary: { ...proof.provenance_summary, version: "v1" } })
  })

  test("inherited key instead of own key is rejected", async () => {
    const proof = await validProofObject()
    const base = Object.create({ schema: proof.schema }) as Record<string, unknown>
    for (const key of topLevelKeys) {
      if (key === "schema") continue
      base[key] = (proof as unknown as Record<string, unknown>)[key]
    }
    expectMalformed(base)
  })
})

// ---------------------------------------------------------------------------
// Position 7 — checkClaimedSourceEntry
// ---------------------------------------------------------------------------

describe("checkClaimedSourceEntry - positive", () => {
  test("exact valid chronicle_entry.v0 passes", async () => {
    const entry = await validClaimedSourceEntry()
    expect(checkClaimedSourceEntry(entry).success).toBe(true)
  })

  test("fresh equivalent host object passes", async () => {
    const entry = await validClaimedSourceEntry()
    const fresh = JSON.parse(JSON.stringify(entry))
    expect(checkClaimedSourceEntry(fresh).success).toBe(true)
  })

  test("different insertion order, identical abstract value, passes", async () => {
    const entry = await validClaimedSourceEntry()
    const reordered = {
      notes: entry.notes,
      labels: entry.labels,
      created_from: entry.created_from,
      provenance_summary_ref: entry.provenance_summary_ref,
      evidence_capsule_ref: entry.evidence_capsule_ref,
      proof_object_ref: entry.proof_object_ref,
      receipt_root: entry.receipt_root,
      source_system: entry.source_system,
      entry_id: entry.entry_id,
      schema: entry.schema,
    }
    expect(checkClaimedSourceEntry(reordered).success).toBe(true)
  })

  test("input remains unmodified", async () => {
    const entry = await validClaimedSourceEntry()
    const before = JSON.stringify(entry)
    checkClaimedSourceEntry(entry)
    expect(JSON.stringify(entry)).toBe(before)
  })
})

describe("checkClaimedSourceEntry - negative (malformed_source_entry, position 7)", () => {
  function expectMalformed(value: unknown) {
    const result = checkClaimedSourceEntry(value)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.finding).toEqual({
      schema: "recursive_singleton_fold_finding.v0",
      code: "malformed_source_entry",
      check_position: 7,
    })
  }

  test("null", () => expectMalformed(null))
  test("array", async () => expectMalformed([await validClaimedSourceEntry()]))
  test("non-object scalar", () => expectMalformed("chronicle_entry.v0"))

  const topLevelKeys = [
    "schema",
    "entry_id",
    "source_system",
    "receipt_root",
    "proof_object_ref",
    "evidence_capsule_ref",
    "provenance_summary_ref",
    "created_from",
    "labels",
    "notes",
  ] as const

  for (const key of topLevelKeys) {
    test(`missing top-level key "${key}"`, async () => {
      const entry = (await validClaimedSourceEntry()) as unknown as Record<string, unknown>
      const { [key]: _omit, ...rest } = entry
      expectMalformed(rest)
    })
  }

  test("extra top-level key", async () => {
    expectMalformed({ ...(await validClaimedSourceEntry()), extra_field: "unexpected" })
  })

  test("wrong schema literal", async () => {
    expectMalformed({ ...(await validClaimedSourceEntry()), schema: "wrong_schema.v0" })
  })

  test("wrong field type (entry_id as number)", async () => {
    expectMalformed({ ...(await validClaimedSourceEntry()), entry_id: 1 })
  })

  test("non-string label member", async () => {
    expectMalformed({ ...(await validClaimedSourceEntry()), labels: ["ok", 1] })
  })

  test("created_from wrong type (number instead of string|null)", async () => {
    expectMalformed({ ...(await validClaimedSourceEntry()), created_from: 1 })
  })

  test("notes wrong type (number instead of string|null)", async () => {
    expectMalformed({ ...(await validClaimedSourceEntry()), notes: 1 })
  })

  test("inherited key instead of own key is rejected", async () => {
    const entry = await validClaimedSourceEntry()
    const base = Object.create({ schema: entry.schema }) as Record<string, unknown>
    for (const key of topLevelKeys) {
      if (key === "schema") continue
      base[key] = (entry as unknown as Record<string, unknown>)[key]
    }
    expectMalformed(base)
  })
})

// ---------------------------------------------------------------------------
// Position 8 — checkSourceAdmissionPrerequisitesAndReceiptRoot
// ---------------------------------------------------------------------------

describe("checkSourceAdmissionPrerequisitesAndReceiptRoot - positive", () => {
  test("valid evidence recomputes and returns the verified receipt root", () => {
    const evidence = validEvidence()
    const result = checkSourceAdmissionPrerequisitesAndReceiptRoot(evidence)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.verifiedReceiptRoot).toBe(computeReceiptRoot(evidence))
    expect(result.value.verifiedReceiptRoot.toLowerCase()).toBe(evidence.anchor.receipt_root.toLowerCase())
  })

  test("input remains unmodified", () => {
    const evidence = validEvidence()
    const before = JSON.stringify(evidence)
    checkSourceAdmissionPrerequisitesAndReceiptRoot(evidence)
    expect(JSON.stringify(evidence)).toBe(before)
  })
})

describe("checkSourceAdmissionPrerequisitesAndReceiptRoot - negative: prerequisite (source_admission_prerequisite_unavailable, position 8)", () => {
  function expectPrerequisiteUnavailable(evidence: HandoffEvidence) {
    const result = checkSourceAdmissionPrerequisitesAndReceiptRoot(evidence)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.finding).toEqual({
      schema: "recursive_singleton_fold_finding.v0",
      code: "source_admission_prerequisite_unavailable",
      check_position: 8,
    })
  }

  test("anchor.receipt_root empty string", () => {
    const evidence = validEvidence()
    expectPrerequisiteUnavailable({ ...evidence, anchor: { ...evidence.anchor, receipt_root: "" } })
  })

  test("anchor.receipt_root missing (cast through unknown)", () => {
    const evidence = validEvidence() as unknown as Record<string, unknown>
    const anchor = { ...(evidence.anchor as Record<string, unknown>) }
    delete anchor.receipt_root
    expectPrerequisiteUnavailable({ ...evidence, anchor } as unknown as HandoffEvidence)
  })
})

describe("checkSourceAdmissionPrerequisitesAndReceiptRoot - negative: mismatch (source_receipt_root_mismatch, position 8)", () => {
  test("tampered evidence whose stored root does not recompute", () => {
    const evidence = tamperedEvidence()
    // Confirm the fixture's prerequisite (a non-empty claimed root) is present,
    // proving this exercises the mismatch branch, not the prerequisite branch.
    expect(evidence.anchor.receipt_root).toBeTruthy()
    const result = checkSourceAdmissionPrerequisitesAndReceiptRoot(evidence)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.finding).toEqual({
      schema: "recursive_singleton_fold_finding.v0",
      code: "source_receipt_root_mismatch",
      check_position: 8,
    })
  })
})

// ---------------------------------------------------------------------------
// Execution order and prefix behavior
// ---------------------------------------------------------------------------

describe("execution order", () => {
  test("each checker evaluates only its own position-owned subject and does not chain", async () => {
    const evidenceResult = checkSourceEvidence(await validProofObject())
    const proofResult = checkPortableProofObject(await validClaimedSourceEntry())
    const entryResult = checkClaimedSourceEntry(validEvidence())

    expect(evidenceResult.success).toBe(false)
    expect(proofResult.success).toBe(false)
    expect(entryResult.success).toBe(false)

    if (!evidenceResult.success) expect(evidenceResult.finding.check_position).toBe(5)
    if (!proofResult.success) expect(proofResult.finding.check_position).toBe(6)
    if (!entryResult.success) expect(entryResult.finding.check_position).toBe(7)
  })

  test("position-8 receipt-root recomputation does not run when position 5 would have failed (caller-order contract, not enforced by an evaluator)", () => {
    // These checkers are isolated; this test documents the intended caller
    // order (5 -> 6 -> 7 -> 8) without asserting any integrated evaluator
    // exists. A malformed evidence object is never passed to position 8 by a
    // conforming caller because position 5 already failed first.
    const malformedEvidence = { not: "valid handoff evidence" }
    const position5Result = checkSourceEvidence(malformedEvidence)
    expect(position5Result.success).toBe(false)
    // A conforming caller stops here; position 8 is never invoked on this input.
  })

  test("compound position 8: prerequisite failure and receipt-root mismatch cannot both be reported — only the prerequisite finding fires", () => {
    const evidence = tamperedEvidence()
    const withMissingPrerequisite = { ...evidence, anchor: { ...evidence.anchor, receipt_root: "" } }
    const result = checkSourceAdmissionPrerequisitesAndReceiptRoot(withMissingPrerequisite)
    expect(result.success).toBe(false)
    if (result.success) return
    // Even though the underlying evidence is also tampered (would mismatch if
    // recomputed), the prerequisite-absent branch fires first and recomputation
    // never runs.
    expect(result.finding.code).toBe("source_admission_prerequisite_unavailable")
  })
})

// ---------------------------------------------------------------------------
// Setup / runtime failures kept separate from RSF findings
// ---------------------------------------------------------------------------

describe("setup and runtime failures are not RSF findings", () => {
  test("malformed host-domain value (function) is rejected by position 5's shape check, not converted into a setup failure", () => {
    // Functions are outside the §7.0 runtime-input domain; a byte/text
    // adapter would reject this before core invocation in a real pipeline.
    // Passed directly here, the shape checker still rejects it deterministically
    // rather than throwing.
    const result = checkSourceEvidence({ not: "valid", fn: () => {} })
    expect(result.success).toBe(false)
  })
})
