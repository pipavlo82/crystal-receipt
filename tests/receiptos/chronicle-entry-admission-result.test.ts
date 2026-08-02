import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  tryCreateChronicleEntryV0,
  createChronicleEntryV0,
  createPortableProofObjectV0,
  type HandoffEvidence,
  type PortableProofObjectV0,
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

// ---------------------------------------------------------------------------
// Typed success
// ---------------------------------------------------------------------------

describe("tryCreateChronicleEntryV0 - typed success", () => {
  test("valid evidence and proof object return success: true", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const result = tryCreateChronicleEntryV0(evidence, proof, { labels: [], notes: null })
    expect(result.success).toBe(true)
  })

  test("returned entry is byte-semantically equal to the pre-A3 createChronicleEntryV0 output", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const options = { labels: ["alpha"], notes: "a note" }
    const result = tryCreateChronicleEntryV0(evidence, proof, options)
    expect(result.success).toBe(true)
    if (!result.success) return
    // The exact recipe pre-A3 createChronicleEntryV0 used to return,
    // reconstructed independently here (not via the production function).
    const expected = {
      schema: "chronicle_entry.v0",
      entry_id: options.entryId ?? `entry-${proof.proof_object_id}`,
      source_system: proof.proof_system,
      receipt_root: proof.receipt_root,
      proof_object_ref: proof.proof_ref,
      evidence_capsule_ref: `embedded:${proof.proof_object_id}:evidence_capsule`,
      provenance_summary_ref: `embedded:${proof.proof_object_id}:provenance_summary`,
      created_from: proof.source_evidence_ref ?? null,
      labels: ["alpha"],
      notes: "a note",
    }
    expect(result.value).toEqual(expected)
  })

  test("all constructor options preserve their existing behavior", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const options = {
      entryId: "entry-custom",
      evidenceCapsuleRef: "custom:evidence_capsule",
      provenanceSummaryRef: "custom:provenance_summary",
      createdFrom: "custom:created-from",
      labels: ["a", "b"],
      notes: "custom note",
    }
    const result = tryCreateChronicleEntryV0(evidence, proof, options)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.entry_id).toBe("entry-custom")
    expect(result.value.evidence_capsule_ref).toBe("custom:evidence_capsule")
    expect(result.value.provenance_summary_ref).toBe("custom:provenance_summary")
    expect(result.value.created_from).toBe("custom:created-from")
    expect(result.value.labels).toEqual(["a", "b"])
    expect(result.value.notes).toBe("custom note")
  })

  test("defaults preserve their existing behavior", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const result = tryCreateChronicleEntryV0(evidence, proof)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.entry_id).toBe(`entry-${proof.proof_object_id}`)
    expect(result.value.evidence_capsule_ref).toBe(`embedded:${proof.proof_object_id}:evidence_capsule`)
    expect(result.value.provenance_summary_ref).toBe(`embedded:${proof.proof_object_id}:provenance_summary`)
    expect(result.value.created_from).toBe(proof.source_evidence_ref ?? null)
    expect(result.value.labels).toEqual([])
    expect(result.value.notes).toBeNull()
  })

  test("caller inputs are not mutated", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const options = { labels: ["a"], notes: "note" }
    const beforeEvidence = JSON.stringify(evidence)
    const beforeProof = JSON.stringify(proof)
    const beforeOptions = JSON.stringify(options)
    tryCreateChronicleEntryV0(evidence, proof, options)
    expect(JSON.stringify(evidence)).toBe(beforeEvidence)
    expect(JSON.stringify(proof)).toBe(beforeProof)
    expect(JSON.stringify(options)).toBe(beforeOptions)
  })

  test("the returned entry is newly owned", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const result = tryCreateChronicleEntryV0(evidence, proof, { labels: [], notes: null })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value as unknown).not.toBe(proof as unknown)
    expect(result.value as unknown).not.toBe(evidence as unknown)
  })

  test("the returned labels array does not alias the caller's labels array", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const labels = ["a", "b"]
    const result = tryCreateChronicleEntryV0(evidence, proof, { labels, notes: null })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.labels).not.toBe(labels)
    result.value.labels.push("mutated-after-success")
    expect(labels).toEqual(["a", "b"])
  })

  test("mutation of caller options after return cannot alter the result", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const options = { labels: ["a"], notes: "note" }
    const result = tryCreateChronicleEntryV0(evidence, proof, options)
    expect(result.success).toBe(true)
    if (!result.success) return
    const before = JSON.stringify(result.value)
    options.labels.push("MUTATED_AFTER_SUCCESS")
    options.notes = "MUTATED_AFTER_SUCCESS"
    expect(JSON.stringify(result.value)).toBe(before)
  })
})

// ---------------------------------------------------------------------------
// All nine typed failures
// ---------------------------------------------------------------------------

function expectExactFailure(
  result: ReturnType<typeof tryCreateChronicleEntryV0>,
  failure_class: string,
  reason_code: string,
) {
  expect(result.success).toBe(false)
  if (result.success) return
  expect(result.failure).toEqual({ failure_class, reason_code } as never)
  expect(Object.keys(result.failure).sort()).toEqual(["failure_class", "reason_code"])
}

describe("tryCreateChronicleEntryV0 - all nine typed failures", () => {
  test("evidence_root_missing (check 1)", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const tampered = { ...evidence, anchor: { ...evidence.anchor, receipt_root: "" } }
    const result = tryCreateChronicleEntryV0(tampered, proof, { labels: [], notes: null })
    expect(() => result).not.toThrow()
    expectExactFailure(result, "unverifiable", "evidence_root_missing")
  })

  test("evidence_root_mismatch (check 2)", async () => {
    const evidence = tamperedEvidence()
    expect(evidence.anchor.receipt_root).toBeTruthy()
    const proof = await validProofObject(validEvidence())
    const result = tryCreateChronicleEntryV0(evidence, proof, { labels: [], notes: null })
    expect(() => result).not.toThrow()
    expectExactFailure(result, "evidence_mismatch", "evidence_root_mismatch")
  })

  test("proof_root_mismatch (check 3)", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const tampered = { ...proof, receipt_root: `0x${"f".repeat(64)}` }
    const result = tryCreateChronicleEntryV0(evidence, tampered, { labels: [], notes: null })
    expect(() => result).not.toThrow()
    expectExactFailure(result, "cross_object_inconsistency", "proof_root_mismatch")
  })

  test("capsule_stored_mismatch (check 4)", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const tampered = {
      ...proof,
      evidence_capsule: {
        ...proof.evidence_capsule,
        receipt_root: { ...proof.evidence_capsule.receipt_root, stored: `0x${"e".repeat(64)}` },
      },
    }
    const result = tryCreateChronicleEntryV0(evidence, tampered, { labels: [], notes: null })
    expect(() => result).not.toThrow()
    expectExactFailure(result, "cross_object_inconsistency", "capsule_stored_mismatch")
  })

  test("capsule_computed_mismatch (check 5)", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const tampered = {
      ...proof,
      evidence_capsule: {
        ...proof.evidence_capsule,
        receipt_root: { ...proof.evidence_capsule.receipt_root, computed: `0x${"d".repeat(64)}` },
      },
    }
    const result = tryCreateChronicleEntryV0(evidence, tampered, { labels: [], notes: null })
    expect(() => result).not.toThrow()
    expectExactFailure(result, "cross_object_inconsistency", "capsule_computed_mismatch")
  })

  test("capsule_label_inconsistent (check 6)", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const tampered = {
      ...proof,
      evidence_capsule: { ...proof.evidence_capsule, receipt_root: { ...proof.evidence_capsule.receipt_root, match: false } },
    }
    const result = tryCreateChronicleEntryV0(evidence, tampered, { labels: [], notes: null })
    expect(() => result).not.toThrow()
    expectExactFailure(result, "reported_state_inconsistency", "capsule_label_inconsistent")
  })

  test("verifier_result_inconsistent (check 7)", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const tampered = {
      ...proof,
      evidence_capsule: { ...proof.evidence_capsule, verifier_result: { ok: false, status: "verified" as const } },
    }
    const result = tryCreateChronicleEntryV0(evidence, tampered, { labels: [], notes: null })
    expect(() => result).not.toThrow()
    expectExactFailure(result, "reported_state_inconsistency", "verifier_result_inconsistent")
  })

  test("proof_object_id_invalid (check 8)", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const tampered = { ...proof, proof_object_id: "proofobj-wrong" }
    const result = tryCreateChronicleEntryV0(evidence, tampered, { labels: [], notes: null })
    expect(() => result).not.toThrow()
    expectExactFailure(result, "identity_inconsistency", "proof_object_id_invalid")
  })

  test("proof_ref_invalid (check 9)", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const tampered = { ...proof, proof_ref: "receiptos://portable-proof-object/wrong" }
    const result = tryCreateChronicleEntryV0(evidence, tampered, { labels: [], notes: null })
    expect(() => result).not.toThrow()
    expectExactFailure(result, "identity_inconsistency", "proof_ref_invalid")
  })
})

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

describe("tryCreateChronicleEntryV0 - first-failure ordering", () => {
  test("evidence_root_missing beats every later defect", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const tamperedEvidenceInput = { ...evidence, anchor: { ...evidence.anchor, receipt_root: "" } }
    const tamperedProof = { ...proof, receipt_root: `0x${"1".repeat(64)}`, proof_object_id: "proofobj-also-wrong" }
    const result = tryCreateChronicleEntryV0(tamperedEvidenceInput, tamperedProof, { labels: [], notes: null })
    expectExactFailure(result, "unverifiable", "evidence_root_missing")
  })

  test("evidence_root_mismatch beats proof-root and identity defects", async () => {
    const evidence = tamperedEvidence()
    const proof = await validProofObject(validEvidence())
    const tamperedProof = { ...proof, receipt_root: `0x${"2".repeat(64)}`, proof_object_id: "proofobj-also-wrong" }
    const result = tryCreateChronicleEntryV0(evidence, tamperedProof, { labels: [], notes: null })
    expectExactFailure(result, "evidence_mismatch", "evidence_root_mismatch")
  })

  test("proof_root_mismatch beats capsule and identity defects", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const tampered = {
      ...proof,
      receipt_root: `0x${"3".repeat(64)}`, // check-3 defect
      evidence_capsule: { ...proof.evidence_capsule, receipt_root: { ...proof.evidence_capsule.receipt_root, stored: `0x${"4".repeat(64)}` } }, // would also be check 4
      proof_object_id: "proofobj-also-wrong", // would also be check 8
    }
    const result = tryCreateChronicleEntryV0(evidence, tampered, { labels: [], notes: null })
    expectExactFailure(result, "cross_object_inconsistency", "proof_root_mismatch")
  })

  test("capsule_stored_mismatch beats capsule-computed and identity defects", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const tampered = {
      ...proof,
      evidence_capsule: {
        ...proof.evidence_capsule,
        receipt_root: {
          ...proof.evidence_capsule.receipt_root,
          stored: `0x${"5".repeat(64)}`, // check-4 defect
          computed: `0x${"6".repeat(64)}`, // would also be check 5
        },
      },
      proof_object_id: "proofobj-also-wrong", // would also be check 8
    }
    const result = tryCreateChronicleEntryV0(evidence, tampered, { labels: [], notes: null })
    expectExactFailure(result, "cross_object_inconsistency", "capsule_stored_mismatch")
  })

  test("capsule_label_inconsistent beats verifier-result and identity defects", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const tampered = {
      ...proof,
      evidence_capsule: {
        ...proof.evidence_capsule,
        receipt_root: { ...proof.evidence_capsule.receipt_root, match: false }, // check-6 defect
        verifier_result: { ok: false, status: "verified" as const }, // would also be check 7
      },
      proof_object_id: "proofobj-also-wrong", // would also be check 8
    }
    const result = tryCreateChronicleEntryV0(evidence, tampered, { labels: [], notes: null })
    expectExactFailure(result, "reported_state_inconsistency", "capsule_label_inconsistent")
  })

  test("proof_object_id_invalid beats proof_ref_invalid", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const tampered = {
      ...proof,
      proof_object_id: "proofobj-wrong", // check-8 defect
      proof_ref: "receiptos://portable-proof-object/also-wrong", // would also be check 9
    }
    const result = tryCreateChronicleEntryV0(evidence, tampered, { labels: [], notes: null })
    expectExactFailure(result, "identity_inconsistency", "proof_object_id_invalid")
  })
})

// ---------------------------------------------------------------------------
// Legacy compatibility
// ---------------------------------------------------------------------------

const legacyMessages: Array<[string, string]> = [
  ["evidence_root_missing", "createChronicleEntryV0 requires evidence.anchor.receipt_root to be present"],
  ["evidence_root_mismatch", "createChronicleEntryV0 requires the stored receipt_root to independently recompute (mismatch)"],
  ["proof_root_mismatch", "createChronicleEntryV0 requires proofObject.receipt_root to equal the verified stored/recomputed receipt_root"],
  ["capsule_stored_mismatch", "createChronicleEntryV0 requires evidence_capsule.receipt_root.stored to equal the verified receipt_root"],
  ["capsule_computed_mismatch", "createChronicleEntryV0 requires evidence_capsule.receipt_root.computed to equal the independently recomputed receipt_root"],
  ["capsule_label_inconsistent", "createChronicleEntryV0 requires evidence_capsule.receipt_root.match/status to be internally consistent with the verified root"],
  ["verifier_result_inconsistent", "createChronicleEntryV0 requires evidence_capsule.verifier_result to be internally consistent with a successful independent recomputation"],
  ["proof_object_id_invalid", "createChronicleEntryV0 requires proofObject.proof_object_id to be the canonical derivation of the verified receipt_root"],
  ["proof_ref_invalid", "createChronicleEntryV0 requires proofObject.proof_ref to be the canonical derivation of proof_object_id"],
]

async function tamperedInputsFor(reasonCode: string): Promise<{ evidence: HandoffEvidence; proof: PortableProofObjectV0 }> {
  const baseEvidence = validEvidence()
  const baseProof = await validProofObject(baseEvidence)
  switch (reasonCode) {
    case "evidence_root_missing":
      return { evidence: { ...baseEvidence, anchor: { ...baseEvidence.anchor, receipt_root: "" } }, proof: baseProof }
    case "evidence_root_mismatch":
      return { evidence: tamperedEvidence(), proof: await validProofObject(validEvidence()) }
    case "proof_root_mismatch":
      return { evidence: baseEvidence, proof: { ...baseProof, receipt_root: `0x${"f".repeat(64)}` } }
    case "capsule_stored_mismatch":
      return {
        evidence: baseEvidence,
        proof: {
          ...baseProof,
          evidence_capsule: { ...baseProof.evidence_capsule, receipt_root: { ...baseProof.evidence_capsule.receipt_root, stored: `0x${"e".repeat(64)}` } },
        },
      }
    case "capsule_computed_mismatch":
      return {
        evidence: baseEvidence,
        proof: {
          ...baseProof,
          evidence_capsule: { ...baseProof.evidence_capsule, receipt_root: { ...baseProof.evidence_capsule.receipt_root, computed: `0x${"d".repeat(64)}` } },
        },
      }
    case "capsule_label_inconsistent":
      return {
        evidence: baseEvidence,
        proof: {
          ...baseProof,
          evidence_capsule: { ...baseProof.evidence_capsule, receipt_root: { ...baseProof.evidence_capsule.receipt_root, match: false } },
        },
      }
    case "verifier_result_inconsistent":
      return {
        evidence: baseEvidence,
        proof: { ...baseProof, evidence_capsule: { ...baseProof.evidence_capsule, verifier_result: { ok: false, status: "verified" as const } } },
      }
    case "proof_object_id_invalid":
      return { evidence: baseEvidence, proof: { ...baseProof, proof_object_id: "proofobj-wrong" } }
    case "proof_ref_invalid":
      return { evidence: baseEvidence, proof: { ...baseProof, proof_ref: "receiptos://portable-proof-object/wrong" } }
    default:
      throw new Error(`no tampered-input recipe for reason code: ${reasonCode}`)
  }
}

describe("createChronicleEntryV0 - legacy compatibility", () => {
  for (const [reasonCode, message] of legacyMessages) {
    test(`${reasonCode}: throws the exact pre-A3 message`, async () => {
      const { evidence, proof } = await tamperedInputsFor(reasonCode)
      let thrown: unknown
      try {
        createChronicleEntryV0(evidence, proof, { labels: [], notes: null })
      } catch (error) {
        thrown = error
      }
      expect(thrown).toBeInstanceOf(Error)
      expect((thrown as Error).message).toBe(message)
    })
  }

  test("the wrapper calls the typed semantics rather than maintaining divergent behavior (full nine-case matrix agreement)", async () => {
    for (const [reasonCode] of legacyMessages) {
      const { evidence, proof } = await tamperedInputsFor(reasonCode)
      const typedResult = tryCreateChronicleEntryV0(evidence, proof, { labels: [], notes: null })
      expect(typedResult.success).toBe(false)
      if (typedResult.success) continue
      expect(typedResult.failure.reason_code).toBe(reasonCode)

      let thrown: unknown
      try {
        createChronicleEntryV0(evidence, proof, { labels: [], notes: null })
      } catch (error) {
        thrown = error
      }
      expect(thrown).toBeInstanceOf(Error)
    }
  })

  test("valid output from both APIs is deeply equal", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    const options = { labels: ["a", "b"], notes: "note" }
    const typedResult = tryCreateChronicleEntryV0(evidence, proof, options)
    const legacyResult = createChronicleEntryV0(evidence, proof, options)
    expect(typedResult.success).toBe(true)
    if (!typedResult.success) return
    expect(typedResult.value).toEqual(legacyResult)
  })

  test("no successful typed result throws", async () => {
    const evidence = validEvidence()
    const proof = await validProofObject(evidence)
    expect(() => tryCreateChronicleEntryV0(evidence, proof, { labels: [], notes: null })).not.toThrow()
  })

  test("no recognized typed rejection leaks through the wrapper as a different message", async () => {
    for (const [reasonCode, message] of legacyMessages) {
      const { evidence, proof } = await tamperedInputsFor(reasonCode)
      try {
        createChronicleEntryV0(evidence, proof, { labels: [], notes: null })
        throw new Error(`expected createChronicleEntryV0 to throw for ${reasonCode}`)
      } catch (error) {
        expect((error as Error).message).toBe(message)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Function surface
// ---------------------------------------------------------------------------

describe("function surface", () => {
  test("tryCreateChronicleEntryV0.length === 3", () => {
    expect(tryCreateChronicleEntryV0.length).toBe(3)
  })

  test("createChronicleEntryV0.length === 3", () => {
    expect(createChronicleEntryV0.length).toBe(3)
  })
})
