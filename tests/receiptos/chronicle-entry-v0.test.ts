import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createChronicleEntryV0, createPortableProofObjectV0, type HandoffEvidence } from "../../src/receiptos"

function fixturePath(name: string) {
  return resolve(import.meta.dir, "../../src/receiptos/fixtures", name)
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

describe("chronicle entry v0", () => {
  test("matches canonical Chronicle web field contract", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })

    const entry = createChronicleEntryV0(evidence, proof)

    expect(entry).toEqual({
      schema: "chronicle_entry.v0",
      entry_id: `entry-${proof.proof_object_id}`,
      source_system: proof.proof_system,
      receipt_root: proof.receipt_root,
      proof_object_ref: proof.proof_ref,
      evidence_capsule_ref: `embedded:${proof.proof_object_id}:evidence_capsule`,
      provenance_summary_ref: `embedded:${proof.proof_object_id}:provenance_summary`,
      created_from: proof.source_evidence_ref,
      labels: [],
      notes: null,
    })
  })

  test("supports Chronicle-compatible optional overrides", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence)

    const entry = createChronicleEntryV0(evidence, proof, {
      entryId: "entry-custom",
      evidenceCapsuleRef: "capsule://custom",
      provenanceSummaryRef: "provenance://custom",
      createdFrom: "import://custom",
      labels: ["demo", "portable"],
      notes: "reviewed",
    })

    expect(entry.entry_id).toBe("entry-custom")
    expect(entry.evidence_capsule_ref).toBe("capsule://custom")
    expect(entry.provenance_summary_ref).toBe("provenance://custom")
    expect(entry.created_from).toBe("import://custom")
    expect(entry.labels).toEqual(["demo", "portable"])
    expect(entry.notes).toBe("reviewed")
  })
})

describe("chronicle entry v0 admission gate", () => {
  test("A. clean fixture: portable proof object and chronicle entry are both created", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })

    expect(proof.schema).toBe("receiptos.portable_proof_object.v0")

    const entry = createChronicleEntryV0(evidence, proof)

    expect(entry.schema).toBe("chronicle_entry.v0")
    expect(entry.receipt_root).toBe(proof.receipt_root)
  })

  test("B. tampered fixture: portable proof object is still created and preserves mismatch, but Chronicle Entry creation fails", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.tampered.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/tampered-evidence.json",
    })

    // The mismatch is evidence and must not be erased merely because it is not admissible to Chronicle.
    expect(proof.schema).toBe("receiptos.portable_proof_object.v0")
    expect(proof.evidence_capsule.receipt_root.status).toBe("mismatch")
    expect(proof.evidence_capsule.receipt_root.match).toBe(false)
    expect(proof.evidence_capsule.verifier_result.status).toBe("mismatch")
    expect(proof.evidence_capsule.verifier_result.ok).toBe(false)
    expect(proof.provenance_summary.warnings).toContain("Stored receipt root does not match the recomputed canonical root.")
    expect(proof.provenance_summary.warnings).toContain("Portable verifier reported a mismatch.")
    expect(proof.provenance_summary.risk_flags).toContain("receipt_root_mismatch")
    expect(proof.provenance_summary.risk_flags).toContain("verification_mismatch")

    // No admitted path exists from the tampered proof object to a Chronicle Entry (and therefore no Collection).
    let thrown: unknown
    try {
      createChronicleEntryV0(evidence, proof)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toMatch(/independently recompute \(mismatch\)/)
  })

  test("C. missing stored receipt root fails distinctly from mismatch", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })

    const evidenceWithoutRoot = structuredClone(evidence)
    delete (evidenceWithoutRoot.anchor as { receipt_root?: string }).receipt_root

    expect(() => createChronicleEntryV0(evidenceWithoutRoot, proof)).toThrow(
      "createChronicleEntryV0 requires evidence.anchor.receipt_root to be present",
    )
  })

  test("D. cross-object inconsistency: independently valid evidence paired with an altered proof object receipt_root fails", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })

    const alteredProof = { ...proof, receipt_root: `0x${"f".repeat(64)}` }

    expect(() => createChronicleEntryV0(evidence, alteredProof)).toThrow(
      "createChronicleEntryV0 requires proofObject.receipt_root to equal the verified stored/recomputed receipt_root",
    )
  })
})

describe("chronicle entry v0 cross-object consistency", () => {
  test("A. embedded capsule stored root mutated fails", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })

    const tamperedProof = structuredClone(proof)
    tamperedProof.evidence_capsule.receipt_root.stored = `0x${"e".repeat(64)}`

    expect(() => createChronicleEntryV0(evidence, tamperedProof)).toThrow(
      "createChronicleEntryV0 requires evidence_capsule.receipt_root.stored to equal the verified receipt_root",
    )
  })

  test("B. embedded capsule computed root mutated fails", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })

    const tamperedProof = structuredClone(proof)
    tamperedProof.evidence_capsule.receipt_root.computed = `0x${"d".repeat(64)}`

    expect(() => createChronicleEntryV0(evidence, tamperedProof)).toThrow(
      "createChronicleEntryV0 requires evidence_capsule.receipt_root.computed to equal the independently recomputed receipt_root",
    )
  })

  test("C. correct root values with contradictory match/status fail as internal inconsistency, not as evidence-root mismatch", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })

    const tamperedProof = structuredClone(proof)
    // stored/computed are left untouched and correct; only the label is contradicted.
    tamperedProof.evidence_capsule.receipt_root.match = false

    let thrown: unknown
    try {
      createChronicleEntryV0(evidence, tamperedProof)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toBe(
      "createChronicleEntryV0 requires evidence_capsule.receipt_root.match/status to be internally consistent with the verified root",
    )
    expect((thrown as Error).message).not.toMatch(/independently recompute \(mismatch\)/)
  })

  test("C2. correct root values with a contradictory verifier_result fail as internal inconsistency", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })

    const tamperedProof = structuredClone(proof)
    tamperedProof.evidence_capsule.verifier_result.ok = false

    expect(() => createChronicleEntryV0(evidence, tamperedProof)).toThrow(
      "createChronicleEntryV0 requires evidence_capsule.verifier_result to be internally consistent with a successful independent recomputation",
    )
  })

  test("D. proof_object_id mutated while top-level receipt_root remains valid fails", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })

    const tamperedProof = { ...proof, proof_object_id: "proofobj-not-the-real-id" }

    expect(() => createChronicleEntryV0(evidence, tamperedProof)).toThrow(
      "createChronicleEntryV0 requires proofObject.proof_object_id to be the canonical derivation of the verified receipt_root",
    )
  })

  test("D2. proof_ref mutated while proof_object_id and receipt_root remain valid fails", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })

    const tamperedProof = { ...proof, proof_ref: "receiptos://portable-proof-object/not-the-real-ref" }

    expect(() => createChronicleEntryV0(evidence, tamperedProof)).toThrow(
      "createChronicleEntryV0 requires proofObject.proof_ref to be the canonical derivation of proof_object_id",
    )
  })
})
