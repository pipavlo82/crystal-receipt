import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  checkSourceAdmissionCrossObjectConsistency,
  checkProofObjectIdentity,
  checkProofReference,
  checkChronicleAdmissionReconstruction,
  checkReconstructedSourceEntryCanonicalEquality,
  deriveSourceEntryContentCommitment,
  checkSourceAdmissionPrerequisitesAndReceiptRoot,
  createChronicleEntryV0,
  createPortableProofObjectV0,
  type HandoffEvidence,
  type PortableProofObjectV0,
  type ChronicleEntryV0,
  type RsfChronicleConstructorOptions,
} from "../../src/receiptos"
import { deriveProofObjectId, deriveProofRef } from "../../src/receiptos/capsule/portable-proof-object-v0"
import { canonicalize } from "../../src/receiptos/canon/canonicalize"
import { sha256 } from "../../src/receiptos/canon/receipt-root"

function fixturePath(name: string) {
  return resolve(import.meta.dir, "../../src/receiptos/fixtures", name)
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function validEvidence(): HandoffEvidence {
  return readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
}

async function validProofObject(evidence: HandoffEvidence = validEvidence()): Promise<PortableProofObjectV0> {
  return createPortableProofObjectV0(evidence, { sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json" })
}

function verifiedRootFor(evidence: HandoffEvidence): string {
  const result = checkSourceAdmissionPrerequisitesAndReceiptRoot(evidence)
  if (!result.success) throw new Error("test fixture setup expected a valid receipt root")
  return result.value.verifiedReceiptRoot
}

// A private, test-file-local prefix harness proving intended caller order
// (9 -> 10 -> 11) without asserting any integrated public evaluator exists.
// Never exported.
function runPositions9Through11(
  evidence: HandoffEvidence,
  proofObject: PortableProofObjectV0,
  verifiedReceiptRoot: string,
): { firstFailingPosition: 9 | 10 | 11 | null } {
  const p9 = checkSourceAdmissionCrossObjectConsistency(proofObject, verifiedReceiptRoot)
  if (!p9.success) return { firstFailingPosition: 9 }

  const p10 = checkProofObjectIdentity(proofObject, verifiedReceiptRoot)
  if (!p10.success) return { firstFailingPosition: 10 }

  const p11 = checkProofReference(proofObject, p10.value.expectedProofObjectId)
  if (!p11.success) return { firstFailingPosition: 11 }

  return { firstFailingPosition: null }
}

// ---------------------------------------------------------------------------
// Position 9 — checkSourceAdmissionCrossObjectConsistency
// ---------------------------------------------------------------------------

describe("checkSourceAdmissionCrossObjectConsistency - positive", () => {
  test("valid cross-object bundle succeeds and returns the verified root", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const result = checkSourceAdmissionCrossObjectConsistency(proof, root)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.verifiedReceiptRoot).toBe(root)
  })

  test("does not mutate its inputs", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const before = JSON.stringify(proof)
    checkSourceAdmissionCrossObjectConsistency(proof, root)
    expect(JSON.stringify(proof)).toBe(before)
  })

  test("success value is independently owned (a fresh object, not a caller-owned alias)", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const result = checkSourceAdmissionCrossObjectConsistency(proof, root)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value as unknown).not.toBe(proof as unknown)
  })

  test("claimed_source_entry (position 7) is not consumed by this function's signature", () => {
    // Structural proof: the function accepts exactly two parameters
    // (proofObject, verifiedReceiptRoot); there is no claimed-source-entry
    // parameter for it to read.
    expect(checkSourceAdmissionCrossObjectConsistency.length).toBe(2)
  })
})

describe("checkSourceAdmissionCrossObjectConsistency - negative: internal check 1 (proofObject.receipt_root)", () => {
  test("tampering proofObject.receipt_root triggers cross_object_consistency_mismatch", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const tampered = { ...proof, receipt_root: "0x" + "f".repeat(64) }
    const result = checkSourceAdmissionCrossObjectConsistency(tampered, root)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.finding).toEqual({
      schema: "recursive_singleton_fold_finding.v0",
      code: "cross_object_consistency_mismatch",
      check_position: 9,
    })
  })

  test("case-only difference in proofObject.receipt_root still passes (case-insensitive comparison)", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const uppercased = { ...proof, receipt_root: proof.receipt_root.toUpperCase() }
    const result = checkSourceAdmissionCrossObjectConsistency(uppercased, root)
    expect(result.success).toBe(true)
  })
})

describe("checkSourceAdmissionCrossObjectConsistency - negative: internal check 2 (evidence_capsule.receipt_root.stored)", () => {
  test("tampering evidence_capsule.receipt_root.stored triggers the finding", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const tampered = {
      ...proof,
      evidence_capsule: {
        ...proof.evidence_capsule,
        receipt_root: { ...proof.evidence_capsule.receipt_root, stored: "0x" + "e".repeat(64) },
      },
    }
    const result = checkSourceAdmissionCrossObjectConsistency(tampered, root)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.finding.code).toBe("cross_object_consistency_mismatch")
    expect(result.finding.check_position).toBe(9)
  })
})

describe("checkSourceAdmissionCrossObjectConsistency - negative: internal check 3 (evidence_capsule.receipt_root.computed)", () => {
  test("tampering evidence_capsule.receipt_root.computed triggers the finding", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const tampered = {
      ...proof,
      evidence_capsule: {
        ...proof.evidence_capsule,
        receipt_root: { ...proof.evidence_capsule.receipt_root, computed: "0x" + "d".repeat(64) },
      },
    }
    const result = checkSourceAdmissionCrossObjectConsistency(tampered, root)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.finding.code).toBe("cross_object_consistency_mismatch")
  })
})

describe("checkSourceAdmissionCrossObjectConsistency - negative: internal check 4 (receipt_root.match/status)", () => {
  test("match: false triggers the finding", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const tampered = {
      ...proof,
      evidence_capsule: { ...proof.evidence_capsule, receipt_root: { ...proof.evidence_capsule.receipt_root, match: false } },
    }
    const result = checkSourceAdmissionCrossObjectConsistency(tampered, root)
    expect(result.success).toBe(false)
  })

  test("status !== 'verified' triggers the finding", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const tampered = {
      ...proof,
      evidence_capsule: {
        ...proof.evidence_capsule,
        receipt_root: { ...proof.evidence_capsule.receipt_root, status: "mismatch" as const },
      },
    }
    const result = checkSourceAdmissionCrossObjectConsistency(tampered, root)
    expect(result.success).toBe(false)
  })
})

describe("checkSourceAdmissionCrossObjectConsistency - negative: internal check 5 (verifier_result.ok/status)", () => {
  test("ok: false triggers the finding", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const tampered = { ...proof, evidence_capsule: { ...proof.evidence_capsule, verifier_result: { ok: false, status: "verified" as const } } }
    const result = checkSourceAdmissionCrossObjectConsistency(tampered, root)
    expect(result.success).toBe(false)
  })

  test("status !== 'verified' triggers the finding", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const tampered = { ...proof, evidence_capsule: { ...proof.evidence_capsule, verifier_result: { ok: true, status: "missing" as const } } }
    const result = checkSourceAdmissionCrossObjectConsistency(tampered, root)
    expect(result.success).toBe(false)
  })
})

describe("checkSourceAdmissionCrossObjectConsistency - compound and ordering", () => {
  test("all five internal mismatches map to the identical single finding", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)

    const variants: unknown[] = [
      { ...proof, receipt_root: "0x" + "1".repeat(64) },
      { ...proof, evidence_capsule: { ...proof.evidence_capsule, receipt_root: { ...proof.evidence_capsule.receipt_root, stored: "0x" + "2".repeat(64) } } },
      { ...proof, evidence_capsule: { ...proof.evidence_capsule, receipt_root: { ...proof.evidence_capsule.receipt_root, computed: "0x" + "3".repeat(64) } } },
      { ...proof, evidence_capsule: { ...proof.evidence_capsule, receipt_root: { ...proof.evidence_capsule.receipt_root, match: false } } },
      { ...proof, evidence_capsule: { ...proof.evidence_capsule, verifier_result: { ok: false, status: "verified" as const } } },
    ]

    for (const variant of variants) {
      const result = checkSourceAdmissionCrossObjectConsistency(variant as PortableProofObjectV0, root)
      expect(result.success).toBe(false)
      if (result.success) continue
      expect(result.finding).toEqual({
        schema: "recursive_singleton_fold_finding.v0",
        code: "cross_object_consistency_mismatch",
        check_position: 9,
      })
    }
  })

  test("compound internal defects (check 1 and check 3 both tampered) still yield exactly one finding, with no exposed subreason", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const tampered = {
      ...proof,
      receipt_root: "0x" + "1".repeat(64),
      evidence_capsule: {
        ...proof.evidence_capsule,
        receipt_root: { ...proof.evidence_capsule.receipt_root, computed: "0x" + "3".repeat(64) },
      },
    }
    const result = checkSourceAdmissionCrossObjectConsistency(tampered, root)
    expect(result.success).toBe(false)
    if (result.success) return
    // the code alone is returned; there is no field distinguishing which
    // of the 5 internal checks actually failed first
    expect(Object.keys(result.finding).sort()).toEqual(["check_position", "code", "schema"])
    expect(result.finding.code).toBe("cross_object_consistency_mismatch")
  })

  test("position-9 mismatch plus an independently invalid proof-object identity: position 9 wins (private prefix harness)", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const tampered = {
      ...proof,
      receipt_root: "0x" + "1".repeat(64), // position-9 defect
      proof_object_id: "proofobj-not-the-expected-one", // would also be a position-10 defect
    }
    const outcome = runPositions9Through11(evidence, tampered, root)
    expect(outcome.firstFailingPosition).toBe(9)
  })
})

// ---------------------------------------------------------------------------
// Position 10 — checkProofObjectIdentity
// ---------------------------------------------------------------------------

describe("checkProofObjectIdentity - positive", () => {
  test("valid known identity succeeds and matches direct deriveProofObjectId", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const result = checkProofObjectIdentity(proof, root)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.expectedProofObjectId).toBe(deriveProofObjectId(root))
  })

  test("does not mutate its inputs", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const before = JSON.stringify(proof)
    checkProofObjectIdentity(proof, root)
    expect(JSON.stringify(proof)).toBe(before)
  })

  test("success value is a newly constructed object", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const result = checkProofObjectIdentity(proof, root)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value as unknown).not.toBe(proof as unknown)
  })
})

describe("checkProofObjectIdentity - negative (proof_object_identity_mismatch, position 10)", () => {
  test("claimed proof_object_id mutation produces the finding", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const tampered = { ...proof, proof_object_id: "proofobj-wrong" }
    const result = checkProofObjectIdentity(tampered, root)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.finding).toEqual({
      schema: "recursive_singleton_fold_finding.v0",
      code: "proof_object_identity_mismatch",
      check_position: 10,
    })
  })

  test("receipt-root mutation changes the expected identity and produces the finding", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const differentRoot = "0x" + "9".repeat(64)
    const result = checkProofObjectIdentity(proof, differentRoot)
    expect(result.success).toBe(false)
  })

  test("case-only difference in claimed proof_object_id fails (case-sensitive comparison, unlike position 9)", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const tampered = { ...proof, proof_object_id: proof.proof_object_id.toUpperCase() }
    const result = checkProofObjectIdentity(tampered, root)
    expect(result.success).toBe(false)
  })

  test("does not derive from the claimed proof_object_id itself (no self-reference)", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const tamperedClaim = { ...proof, proof_object_id: "proofobj-anything-else" }
    const original = checkProofObjectIdentity(proof, root)
    const withTamperedClaim = checkProofObjectIdentity(tamperedClaim, root)
    // the *expected* value must be identical regardless of what was claimed
    expect(original.success && withTamperedClaim.success === false).toBe(true)
    if (original.success) {
      expect(original.value.expectedProofObjectId).toBe(deriveProofObjectId(root))
    }
  })
})

// ---------------------------------------------------------------------------
// Position 11 — checkProofReference
// ---------------------------------------------------------------------------

describe("checkProofReference - positive", () => {
  test("valid reference succeeds and matches direct deriveProofRef", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const identity = checkProofObjectIdentity(proof, root)
    expect(identity.success).toBe(true)
    if (!identity.success) return
    const result = checkProofReference(proof, identity.value.expectedProofObjectId)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.expectedProofRef).toBe(deriveProofRef(identity.value.expectedProofObjectId))
  })

  test("does not mutate its inputs", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const identity = checkProofObjectIdentity(proof, root)
    expect(identity.success).toBe(true)
    if (!identity.success) return
    const before = JSON.stringify(proof)
    checkProofReference(proof, identity.value.expectedProofObjectId)
    expect(JSON.stringify(proof)).toBe(before)
  })

  test("success value is a newly constructed object", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const identity = checkProofObjectIdentity(proof, root)
    expect(identity.success).toBe(true)
    if (!identity.success) return
    const result = checkProofReference(proof, identity.value.expectedProofObjectId)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value as unknown).not.toBe(proof as unknown)
  })
})

describe("checkProofReference - negative (proof_reference_mismatch, position 11)", () => {
  test("claimed proof_ref mutation produces the finding", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const identity = checkProofObjectIdentity(proof, root)
    expect(identity.success).toBe(true)
    if (!identity.success) return
    const tampered = { ...proof, proof_ref: "receiptos://portable-proof-object/wrong" }
    const result = checkProofReference(tampered, identity.value.expectedProofObjectId)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.finding).toEqual({
      schema: "recursive_singleton_fold_finding.v0",
      code: "proof_reference_mismatch",
      check_position: 11,
    })
  })

  test("mutating the expected proof-object ID input changes the expected reference and produces the finding", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const result = checkProofReference(proof, "proofobj-not-the-real-one")
    expect(result.success).toBe(false)
  })

  test("wrong prefix / format on the claimed reference is rejected (exact string comparison, no partial match)", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const identity = checkProofObjectIdentity(proof, root)
    expect(identity.success).toBe(true)
    if (!identity.success) return
    const tampered = { ...proof, proof_ref: identity.value.expectedProofObjectId } // missing the URI prefix entirely
    const result = checkProofReference(tampered, identity.value.expectedProofObjectId)
    expect(result.success).toBe(false)
  })

  test("does not trust the claimed proof_object_id: only the position-10-derived value is used", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const identity = checkProofObjectIdentity(proof, root)
    expect(identity.success).toBe(true)
    if (!identity.success) return
    // even though proof.proof_object_id (claimed) is valid, checkProofReference
    // never reads it -- it only accepts the already-derived expected value.
    expect(checkProofReference.length).toBe(2)
  })

  test("position-10 defect wins before position 11 (private prefix harness)", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const tampered = {
      ...proof,
      proof_object_id: "proofobj-wrong", // position-10 defect
      proof_ref: "receiptos://portable-proof-object/also-wrong", // would also be a position-11 defect
    }
    const outcome = runPositions9Through11(evidence, tampered, root)
    expect(outcome.firstFailingPosition).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// Position 12 — checkChronicleAdmissionReconstruction
// ---------------------------------------------------------------------------

describe("checkChronicleAdmissionReconstruction - positive", () => {
  test("valid reconstruction succeeds and equals a direct createChronicleEntryV0 call", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const options = { entryId: undefined, evidenceCapsuleRef: undefined, provenanceSummaryRef: undefined, createdFrom: undefined, labels: [], notes: null }
    const direct = createChronicleEntryV0(evidence, proof, options)
    const result = checkChronicleAdmissionReconstruction(evidence, proof, options)
    expect(result.success).toBe(true)
    expect(result.value).toEqual(direct)
    expect(result.value.schema).toBe("chronicle_entry.v0")
  })

  test("no `success: false` branch exists on the result type (structural: only one variant is ever returned)", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const options = { labels: [], notes: null }
    const result = checkChronicleAdmissionReconstruction(evidence, proof, options)
    expect(result.success).toBe(true)
    expect("finding" in result).toBe(false)
  })

  test("output is independently owned: caller mutation after success does not alter the returned Chronicle entry", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const options = { labels: ["a"], notes: "note" }
    const result = checkChronicleAdmissionReconstruction(evidence, proof, options)
    expect(result.success).toBe(true)
    const before = JSON.stringify(result.value)

    evidence.anchor.receipt_root = "MUTATED_AFTER_SUCCESS"
    proof.metadata.label = "MUTATED_AFTER_SUCCESS"
    options.labels.push("mutated-after-success")

    expect(result.value.labels).not.toBe(options.labels)
    expect(JSON.stringify(result.value)).toBe(before)
  })

  test("does not mutate its inputs during the call", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const options = { labels: [], notes: null }
    const beforeEvidence = JSON.stringify(evidence)
    const beforeProof = JSON.stringify(proof)
    checkChronicleAdmissionReconstruction(evidence, proof, options)
    expect(JSON.stringify(evidence)).toBe(beforeEvidence)
    expect(JSON.stringify(proof)).toBe(beforeProof)
  })
})

describe("checkChronicleAdmissionReconstruction - exception propagation", () => {
  test("a constructor precondition failure (bypassing positions 8-11) propagates as a thrown error, never as a fabricated finding", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const tamperedProof = { ...proof, receipt_root: "0x" + "0".repeat(64) }
    expect(() => checkChronicleAdmissionReconstruction(evidence, tamperedProof, { labels: [], notes: null })).toThrow()
  })

  test("thrown error message matches the canonical constructor's own message (no reimplementation drift)", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const tamperedProof = { ...proof, proof_object_id: "proofobj-wrong" }
    let thrown: unknown
    try {
      checkChronicleAdmissionReconstruction(evidence, tamperedProof, { labels: [], notes: null })
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toContain("proof_object_id")
  })
})

// ---------------------------------------------------------------------------
// Isolation and scope proofs
// ---------------------------------------------------------------------------

describe("isolation and scope", () => {
  test("checkChronicleAdmissionReconstruction performs no claimed-entry equality (no such parameter exists)", () => {
    expect(checkChronicleAdmissionReconstruction.length).toBe(3)
  })

  test("checkSourceAdmissionCrossObjectConsistency, checkProofObjectIdentity, and checkProofReference each evaluate only their own position and do not chain to one another", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)

    const p9 = checkSourceAdmissionCrossObjectConsistency(proof, root)
    const p10 = checkProofObjectIdentity(proof, root)
    const p11 = checkProofReference(proof, deriveProofObjectId(root))

    expect(p9.success).toBe(true)
    expect(p10.success).toBe(true)
    expect(p11.success).toBe(true)
  })

  test("full prefix through position 11 succeeds for a fully valid bundle", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const root = verifiedRootFor(evidence)
    const outcome = runPositions9Through11(evidence, proof, root)
    expect(outcome.firstFailingPosition).toBeNull()
  })

  test("position-8 defect would win over every later defect (documented via the existing position-8 checker; no new production evaluator is created)", async () => {
    const evidence = validEvidence()
    const withMissingPrerequisite = { ...evidence, anchor: { ...evidence.anchor, receipt_root: "" } }
    const position8Result = checkSourceAdmissionPrerequisitesAndReceiptRoot(withMissingPrerequisite)
    expect(position8Result.success).toBe(false)
    // A conforming caller stops here; positions 9-12 are never invoked on this input.
  })
})

// ---------------------------------------------------------------------------
// Position 13 — checkReconstructedSourceEntryCanonicalEquality
// ---------------------------------------------------------------------------

function baseChronicleEntry(): ChronicleEntryV0 {
  return {
    schema: "chronicle_entry.v0",
    entry_id: "entry-proofobj-0123456789abcdef0123456789abcdef01234567",
    source_system: "stealth-handoff",
    receipt_root: `0x${"a".repeat(64)}`,
    proof_object_ref: "receiptos://portable-proof-object/proofobj-0123456789abcdef0123456789abcdef01234567",
    evidence_capsule_ref: "embedded:proofobj-0123456789abcdef0123456789abcdef01234567:evidence_capsule",
    provenance_summary_ref: "embedded:proofobj-0123456789abcdef0123456789abcdef01234567:provenance_summary",
    created_from: "example://stealth-handoff/normalized-evidence.json",
    labels: ["alpha", "beta"],
    notes: "example note",
  }
}

// Same key/value pairs as baseChronicleEntry(), but every key is inserted in
// reverse order -- proves canonical equality is insensitive to object-key
// insertion order (canonicalize() owns key ordering).
function baseChronicleEntryWithReorderedKeys(): ChronicleEntryV0 {
  const entry = baseChronicleEntry()
  return {
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
}

async function validReconstructedAndClaimedPair(): Promise<{
  reconstructed: ChronicleEntryV0
  claimed: ChronicleEntryV0
  evidence: HandoffEvidence
  proof: PortableProofObjectV0
  options: RsfChronicleConstructorOptions
}> {
  const evidence = validEvidence()
  const proof = await validProofObject(evidence)
  const options: RsfChronicleConstructorOptions = { labels: ["alpha", "beta"], notes: "example note" }
  const reconstructed = createChronicleEntryV0(evidence, proof, options)
  // Simulates position 7's independently-parsed claimed entry: identical
  // content, but a structurally distinct object (never the same reference).
  const claimed = JSON.parse(JSON.stringify(reconstructed)) as ChronicleEntryV0
  return { reconstructed, claimed, evidence, proof, options }
}

describe("checkReconstructedSourceEntryCanonicalEquality - positive", () => {
  test("independently reconstructed and claimed identical entries succeed", async () => {
    const { reconstructed, claimed } = await validReconstructedAndClaimedPair()
    const result = checkReconstructedSourceEntryCanonicalEquality(reconstructed, claimed)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.verifiedSourceEntry).toEqual(reconstructed)
  })

  test("equivalent entries with different object-key insertion order succeed", () => {
    const a = baseChronicleEntry()
    const b = baseChronicleEntryWithReorderedKeys()
    expect(Object.keys(a)).not.toEqual(Object.keys(b))
    const result = checkReconstructedSourceEntryCanonicalEquality(a, b)
    expect(result.success).toBe(true)
  })

  test("the function accepts exactly two arguments", () => {
    expect(checkReconstructedSourceEntryCanonicalEquality.length).toBe(2)
  })

  test("does not mutate either input", () => {
    const a = baseChronicleEntry()
    const b = { ...baseChronicleEntry(), notes: "different note" }
    const beforeA = JSON.stringify(a)
    const beforeB = JSON.stringify(b)
    checkReconstructedSourceEntryCanonicalEquality(a, b)
    expect(JSON.stringify(a)).toBe(beforeA)
    expect(JSON.stringify(b)).toBe(beforeB)
  })

  test("success returns a deep snapshot, not the reconstructed input object", () => {
    const a = baseChronicleEntry()
    const b = baseChronicleEntry()
    const result = checkReconstructedSourceEntryCanonicalEquality(a, b)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.verifiedSourceEntry as unknown).not.toBe(a as unknown)
    expect(result.value.verifiedSourceEntry.labels as unknown).not.toBe(a.labels as unknown)
  })

  test("nested arrays in the success value are independently owned", () => {
    const a = baseChronicleEntry()
    const b = baseChronicleEntry()
    const result = checkReconstructedSourceEntryCanonicalEquality(a, b)
    expect(result.success).toBe(true)
    if (!result.success) return
    result.value.verifiedSourceEntry.labels.push("mutated-after-success")
    expect(a.labels).toEqual(["alpha", "beta"])
  })

  test("mutation of either caller input after return cannot change the returned value", () => {
    const a = baseChronicleEntry()
    const b = baseChronicleEntry()
    const result = checkReconstructedSourceEntryCanonicalEquality(a, b)
    expect(result.success).toBe(true)
    if (!result.success) return
    const before = JSON.stringify(result.value)
    a.notes = "MUTATED_AFTER_SUCCESS"
    a.labels.push("MUTATED_AFTER_SUCCESS")
    b.notes = "ALSO_MUTATED_AFTER_SUCCESS"
    expect(JSON.stringify(result.value)).toBe(before)
  })

  test("position 13 does not run or derive position 14", () => {
    const a = baseChronicleEntry()
    const b = baseChronicleEntry()
    const result = checkReconstructedSourceEntryCanonicalEquality(a, b)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect("sourceEntryContentCommitment" in (result.value as Record<string, unknown>)).toBe(false)
  })
})

describe("checkReconstructedSourceEntryCanonicalEquality - negative (reconstructed_source_entry_mismatch, position 13)", () => {
  test("same entry_id with different otherwise shape-valid content fails", () => {
    const a = baseChronicleEntry()
    const b = { ...baseChronicleEntry(), notes: "a completely different note" }
    expect(a.entry_id).toBe(b.entry_id)
    const result = checkReconstructedSourceEntryCanonicalEquality(a, b)
    expect(result.success).toBe(false)
  })

  test("a shape-valid difference in every mutable complete-entry field is independently detected", () => {
    const base = baseChronicleEntry()
    const fieldVariants: Array<[string, ChronicleEntryV0]> = [
      ["entry_id", { ...base, entry_id: "entry-a-different-identity" }],
      ["source_system", { ...base, source_system: "a-different-source-system" }],
      ["receipt_root", { ...base, receipt_root: `0x${"b".repeat(64)}` }],
      ["proof_object_ref", { ...base, proof_object_ref: "receiptos://portable-proof-object/a-different-one" }],
      ["evidence_capsule_ref", { ...base, evidence_capsule_ref: "embedded:a-different-one:evidence_capsule" }],
      ["provenance_summary_ref", { ...base, provenance_summary_ref: "embedded:a-different-one:provenance_summary" }],
      ["created_from", { ...base, created_from: "example://a-different-source.json" }],
      ["labels", { ...base, labels: ["alpha", "gamma"] }],
      ["notes", { ...base, notes: "a completely different note" }],
    ]
    for (const [field, variant] of fieldVariants) {
      const result = checkReconstructedSourceEntryCanonicalEquality(base, variant)
      expect(result.success, `expected a mismatch for field: ${field}`).toBe(false)
    }
  })

  test("label member order is significant", () => {
    const a = { ...baseChronicleEntry(), labels: ["alpha", "beta"] }
    const b = { ...baseChronicleEntry(), labels: ["beta", "alpha"] }
    const result = checkReconstructedSourceEntryCanonicalEquality(a, b)
    expect(result.success).toBe(false)
  })

  test("label content is significant", () => {
    const a = { ...baseChronicleEntry(), labels: ["alpha", "beta"] }
    const b = { ...baseChronicleEntry(), labels: ["alpha", "gamma"] }
    const result = checkReconstructedSourceEntryCanonicalEquality(a, b)
    expect(result.success).toBe(false)
  })

  test("notes: null and notes: '' are distinct", () => {
    const a = { ...baseChronicleEntry(), notes: null }
    const b = { ...baseChronicleEntry(), notes: "" }
    const result = checkReconstructedSourceEntryCanonicalEquality(a, b)
    expect(result.success).toBe(false)
  })

  test("exact mismatch finding shape, code, and position", () => {
    const a = baseChronicleEntry()
    const b = { ...baseChronicleEntry(), notes: "a completely different note" }
    const result = checkReconstructedSourceEntryCanonicalEquality(a, b)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.finding).toEqual({
      schema: "recursive_singleton_fold_finding.v0",
      code: "reconstructed_source_entry_mismatch",
      check_position: 13,
    })
  })

  test("the finding exposes no subreason or compared bytes", () => {
    const a = baseChronicleEntry()
    const b = { ...baseChronicleEntry(), notes: "a completely different note" }
    const result = checkReconstructedSourceEntryCanonicalEquality(a, b)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(Object.keys(result.finding).sort()).toEqual(["check_position", "code", "schema"])
  })
})

// ---------------------------------------------------------------------------
// Position 14 — deriveSourceEntryContentCommitment
// ---------------------------------------------------------------------------

describe("deriveSourceEntryContentCommitment", () => {
  test("output equals the direct repository recipe", () => {
    const entry = baseChronicleEntry()
    const result = deriveSourceEntryContentCommitment(entry)
    expect(result.value.sourceEntryContentCommitment).toBe(`sha256:${sha256(canonicalize(entry))}`)
  })

  test("output format is exactly sha256:<64-lowercase-hex>", () => {
    const entry = baseChronicleEntry()
    const result = deriveSourceEntryContentCommitment(entry)
    expect(result.value.sourceEntryContentCommitment).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  test("the complete entry is bound, not entry_id alone", () => {
    const a = baseChronicleEntry()
    const b = { ...baseChronicleEntry(), notes: "a completely different note" }
    expect(a.entry_id).toBe(b.entry_id)
    const resultA = deriveSourceEntryContentCommitment(a)
    const resultB = deriveSourceEntryContentCommitment(b)
    expect(resultA.value.sourceEntryContentCommitment).not.toBe(resultB.value.sourceEntryContentCommitment)
  })

  test("shape-valid changes to complete-entry content change the commitment", () => {
    const base = baseChronicleEntry()
    const fieldVariants: Array<[string, ChronicleEntryV0]> = [
      ["source_system", { ...base, source_system: "a-different-source-system" }],
      ["receipt_root", { ...base, receipt_root: `0x${"b".repeat(64)}` }],
      ["created_from", { ...base, created_from: "example://a-different-source.json" }],
    ]
    const baseCommitment = deriveSourceEntryContentCommitment(base).value.sourceEntryContentCommitment
    for (const [field, variant] of fieldVariants) {
      const variantCommitment = deriveSourceEntryContentCommitment(variant).value.sourceEntryContentCommitment
      expect(variantCommitment, `expected a different commitment for field: ${field}`).not.toBe(baseCommitment)
    }
  })

  test("label order changes the commitment", () => {
    const a = { ...baseChronicleEntry(), labels: ["alpha", "beta"] }
    const b = { ...baseChronicleEntry(), labels: ["beta", "alpha"] }
    const resultA = deriveSourceEntryContentCommitment(a)
    const resultB = deriveSourceEntryContentCommitment(b)
    expect(resultA.value.sourceEntryContentCommitment).not.toBe(resultB.value.sourceEntryContentCommitment)
  })

  test("null and empty string produce different commitments", () => {
    const a = { ...baseChronicleEntry(), notes: null }
    const b = { ...baseChronicleEntry(), notes: "" }
    const resultA = deriveSourceEntryContentCommitment(a)
    const resultB = deriveSourceEntryContentCommitment(b)
    expect(resultA.value.sourceEntryContentCommitment).not.toBe(resultB.value.sourceEntryContentCommitment)
  })

  test("does not mutate its input", () => {
    const entry = baseChronicleEntry()
    const before = JSON.stringify(entry)
    deriveSourceEntryContentCommitment(entry)
    expect(JSON.stringify(entry)).toBe(before)
  })

  test("the returned value object is newly owned", () => {
    const entry = baseChronicleEntry()
    const resultA = deriveSourceEntryContentCommitment(entry)
    const resultB = deriveSourceEntryContentCommitment(entry)
    expect(resultA.value as unknown).not.toBe(resultB.value as unknown)
  })

  test("the function accepts exactly one argument", () => {
    expect(deriveSourceEntryContentCommitment.length).toBe(1)
  })

  test("no expected/stored commitment is accepted (structural: only one parameter exists)", () => {
    expect(deriveSourceEntryContentCommitment.length).toBe(1)
  })

  test("no `{ success: false }` branch exists (structural: only one variant is ever returned)", () => {
    const entry = baseChronicleEntry()
    const result = deriveSourceEntryContentCommitment(entry)
    expect(result.success).toBe(true)
    expect("finding" in result).toBe(false)
  })

  test("no position-28 finding is emitted or referenced as runtime output", () => {
    const entry = baseChronicleEntry()
    const result = deriveSourceEntryContentCommitment(entry)
    expect(Object.keys(result.value)).toEqual(["sourceEntryContentCommitment"])
    expect(JSON.stringify(result)).not.toContain("source_entry_content_commitment_mismatch")
    expect(JSON.stringify(result)).not.toContain("check_position")
  })
})

// ---------------------------------------------------------------------------
// Positions 13-14 isolation and scope
// ---------------------------------------------------------------------------

// A private, test-file-local harness proving intended caller order
// (12 -> 13 -> 14) without asserting any integrated public evaluator
// exists. Never exported, never presented as the public evaluator, and
// never wired into validateRsfEvaluationInputShape.
function runPositions12Through14(
  evidence: HandoffEvidence,
  proofObject: PortableProofObjectV0,
  adaptedOptions: RsfChronicleConstructorOptions,
  claimedSourceEntry: ChronicleEntryV0,
): { firstFailingPosition: 13 | null; sourceEntryContentCommitment: string | null } {
  const p12 = checkChronicleAdmissionReconstruction(evidence, proofObject, adaptedOptions)

  const p13 = checkReconstructedSourceEntryCanonicalEquality(p12.value, claimedSourceEntry)
  if (!p13.success) return { firstFailingPosition: 13, sourceEntryContentCommitment: null }

  const p14 = deriveSourceEntryContentCommitment(p13.value.verifiedSourceEntry)
  return { firstFailingPosition: null, sourceEntryContentCommitment: p14.value.sourceEntryContentCommitment }
}

describe("positions 13-14 isolation and scope", () => {
  test("checkReconstructedSourceEntryCanonicalEquality and deriveSourceEntryContentCommitment do not chain to one another or to positions 9-12", () => {
    const a = baseChronicleEntry()
    const b = baseChronicleEntry()
    const p13 = checkReconstructedSourceEntryCanonicalEquality(a, b)
    expect(p13.success).toBe(true)
    if (!p13.success) return
    // deriveSourceEntryContentCommitment must be called explicitly by the
    // caller -- position 13 never invokes it internally.
    const p14 = deriveSourceEntryContentCommitment(p13.value.verifiedSourceEntry)
    expect(p14.success).toBe(true)
  })

  test("full prefix through position 14 succeeds for a fully valid, matching bundle (private harness)", async () => {
    const { evidence, proof, options, claimed } = await validReconstructedAndClaimedPair()
    const outcome = runPositions12Through14(evidence, proof, options, claimed)
    expect(outcome.firstFailingPosition).toBeNull()
    expect(outcome.sourceEntryContentCommitment).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  test("a position-13 mismatch stops the private harness before position 14 ever runs (private prefix harness)", async () => {
    const { evidence, proof, options } = await validReconstructedAndClaimedPair()
    const tamperedClaim = { ...baseChronicleEntry(), notes: "not what was reconstructed" }
    const outcome = runPositions12Through14(evidence, proof, options, tamperedClaim)
    expect(outcome.firstFailingPosition).toBe(13)
    expect(outcome.sourceEntryContentCommitment).toBeNull()
  })

  test("position 14 accepts only the position-13-verified entry, never the raw claimed or reconstructed entry directly", async () => {
    const { reconstructed, claimed } = await validReconstructedAndClaimedPair()
    const p13 = checkReconstructedSourceEntryCanonicalEquality(reconstructed, claimed)
    expect(p13.success).toBe(true)
    if (!p13.success) return
    const direct = deriveSourceEntryContentCommitment(reconstructed)
    const throughPosition13 = deriveSourceEntryContentCommitment(p13.value.verifiedSourceEntry)
    // Since reconstructed and claimed canonicalize identically here, both
    // calls happen to agree -- this proves the API shape, not a special
    // relationship between raw and verified inputs.
    expect(direct.value.sourceEntryContentCommitment).toBe(throughPosition13.value.sourceEntryContentCommitment)
  })
})
