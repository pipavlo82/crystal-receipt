import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  evaluateRsfPrefixThroughPosition17,
  createPortableProofObjectV0,
  createChronicleEntryV0,
  adaptRsfConstructionOptions,
  canonicalize,
  sha256,
  FOLD_POLICY_COMMITMENT,
  COMPARABILITY_CLASS_COMMITMENT,
  TRANSITION_RULE_COMMITMENT,
  type HandoffEvidence,
  type PortableProofObjectV0,
  type ChronicleEntryV0,
  type RsfConstructionOptionsShape,
} from "../../src/receiptos"

// ---------------------------------------------------------------------------
// Fixtures and independently assembled normative objects
// ---------------------------------------------------------------------------

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

// Independently assembled, per RSF profile §8.1/§9.1/§10.1 -- deliberately
// not imported from production code.
function normativeFoldPolicy() {
  return {
    schema: "recursive_singleton_fold_policy.v0",
    policy_version: "recursive-singleton-fold-policy-v0",
    policy_id: "singleton-chronicle-entry-semantic-preservation",
    source_object_schema: "chronicle_entry.v0",
    aggregate_object_schema: "recursive_singleton_aggregate.v0",
    member_cardinality: 1,
    aggregation_mode: "singleton_only",
    semantic_elevation: "forbidden",
    source_identity_reuse: "forbidden",
    multi_member_extension: "deferred",
  }
}

function normativeComparabilityClass() {
  return {
    schema: "recursive_singleton_comparability_class.v0",
    class_version: "recursive-singleton-comparability-class-v0",
    class_id: "admitted-chronicle-entry-singleton",
    source_object_schema: "chronicle_entry.v0",
    admission_required: true,
    cross_entry_comparability: "not_asserted",
    cross_policy_bridge: "deferred",
    cross_class_bridge: "deferred",
    singleton_eligibility_rule: "exactly_one_independently_admitted_source_entry",
  }
}

function normativeTransitionRule() {
  return {
    schema: "recursive_singleton_transition_rule.v0",
    rule_version: "recursive-singleton-transition-rule-v0",
    rule_id: "semantic_result_preserving_singleton_identity_transition",
    source_object_schema: "chronicle_entry.v0",
    aggregate_object_schema: "recursive_singleton_aggregate.v0",
    preserved_equality_relation: "semantic_result_commitment_equality_only",
    source_identity_reuse: "forbidden",
    stronger_class_creation: "forbidden",
    fail_closed_on_malformed_or_unknown_input: true,
  }
}

// Same key/value pairs as normativeFoldPolicy(), reverse key insertion order.
function normativeFoldPolicyReorderedKeys() {
  const d = normativeFoldPolicy()
  return {
    multi_member_extension: d.multi_member_extension,
    source_identity_reuse: d.source_identity_reuse,
    semantic_elevation: d.semantic_elevation,
    aggregation_mode: d.aggregation_mode,
    member_cardinality: d.member_cardinality,
    aggregate_object_schema: d.aggregate_object_schema,
    source_object_schema: d.source_object_schema,
    policy_id: d.policy_id,
    policy_version: d.policy_version,
    schema: d.schema,
  }
}

const ADMISSION_FIXTURE_SET_SHA256 = "ff35ca8ae5cef10009479d50c10e111869875f6f62fb9d6bcb00f5aa5a1b4b4f"

function validConstructionOptions(): RsfConstructionOptionsShape {
  return {
    entry_id: null,
    evidence_capsule_ref: null,
    provenance_summary_ref: null,
    created_from: null,
    labels: [],
    notes: null,
  }
}

// Same key/value pairs as `entry`, reverse key insertion order.
function entryWithReorderedKeys(entry: ChronicleEntryV0): ChronicleEntryV0 {
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

async function buildValidInput(options: RsfConstructionOptionsShape = validConstructionOptions()) {
  const evidence = validEvidence()
  const proof = await validProofObject(evidence)
  const adapted = adaptRsfConstructionOptions(options)
  const expectedEntry = createChronicleEntryV0(evidence, proof, adapted)
  const claimedSourceEntry = JSON.parse(JSON.stringify(expectedEntry)) as ChronicleEntryV0

  const input = {
    schema: "recursive_singleton_fold_evaluation_input.v0",
    profile_id: "recursive-singleton-fold-profile-v0",
    source_admission_bundle: {
      schema: "recursive_singleton_fold_source_admission_bundle.v0",
      bundle_version: "recursive-singleton-fold-source-admission-bundle-v0",
      admission_profile_id: "receiptos-chronicle-admission-v0",
      admission_fixture_set_sha256: ADMISSION_FIXTURE_SET_SHA256,
      source_evidence: evidence,
      source_proof_object: proof,
      source_entry_construction_options: options,
      claimed_source_entry: claimedSourceEntry,
    },
    fold_policy_declaration: normativeFoldPolicy(),
    comparability_class_declaration: normativeComparabilityClass(),
    transition_rule_declaration: normativeTransitionRule(),
    profile_local_notes: null as string | null,
  }

  return { input, evidence, proof, expectedEntry }
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

// ---------------------------------------------------------------------------
// Valid prefix
// ---------------------------------------------------------------------------

describe("evaluateRsfPrefixThroughPosition17 - valid prefix", () => {
  test("one complete valid input succeeds through position 17", async () => {
    const { input } = await buildValidInput()
    const result = evaluateRsfPrefixThroughPosition17(input)
    expect(result.success).toBe(true)
  })

  test("success contains exactly the nine required fields", async () => {
    const { input } = await buildValidInput()
    const result = evaluateRsfPrefixThroughPosition17(input)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(Object.keys(result.value).sort()).toEqual(
      [
        "verifiedSourceEntry",
        "sourceEntryContentCommitment",
        "foldPolicyDeclaration",
        "foldPolicyCommitment",
        "comparabilityClassDeclaration",
        "comparabilityClassCommitment",
        "transitionRuleDeclaration",
        "transitionRuleCommitment",
        "profileLocalNotes",
      ].sort(),
    )
  })

  test("success contains no envelope fields", async () => {
    const { input } = await buildValidInput()
    const result = evaluateRsfPrefixThroughPosition17(input)
    expect(result.success).toBe(true)
    if (!result.success) return
    const keys = Object.keys(result.value)
    expect(keys).not.toContain("schema")
    expect(keys).not.toContain("evaluation_state")
    expect(keys).not.toContain("profile_verdict")
    expect(keys).not.toContain("aggregate")
  })

  test("no aggregate is returned", async () => {
    const { input } = await buildValidInput()
    const result = evaluateRsfPrefixThroughPosition17(input)
    expect(result.success).toBe(true)
    if (!result.success) return
    // "aggregate_object_schema" legitimately appears inside the declaration
    // values themselves (RSF profile §8.1/§9.1/§10.1); what must be absent
    // is a top-level `aggregate` key/object, not the substring.
    expect(result.value).not.toHaveProperty("aggregate")
    expect((result.value as Record<string, unknown>).aggregate).toBeUndefined()
  })

  test("verified source entry equals the independently expected Chronicle entry", async () => {
    const { input, expectedEntry } = await buildValidInput()
    const result = evaluateRsfPrefixThroughPosition17(input)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.verifiedSourceEntry).toEqual(expectedEntry)
  })

  test("source-entry commitment equals direct repository recomputation", async () => {
    const { input, expectedEntry } = await buildValidInput()
    const result = evaluateRsfPrefixThroughPosition17(input)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.sourceEntryContentCommitment).toBe(`sha256:${sha256(canonicalize(expectedEntry))}`)
  })

  test("all three declarations equal the validated normative declarations", async () => {
    const { input } = await buildValidInput()
    const result = evaluateRsfPrefixThroughPosition17(input)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.foldPolicyDeclaration).toEqual(normativeFoldPolicy())
    expect(result.value.comparabilityClassDeclaration).toEqual(normativeComparabilityClass())
    expect(result.value.transitionRuleDeclaration).toEqual(normativeTransitionRule())
  })

  test("all three formatted commitments equal the exact sha256:<pin> values", async () => {
    const { input } = await buildValidInput()
    const result = evaluateRsfPrefixThroughPosition17(input)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.foldPolicyCommitment).toBe(`sha256:${FOLD_POLICY_COMMITMENT}`)
    expect(result.value.comparabilityClassCommitment).toBe(`sha256:${COMPARABILITY_CLASS_COMMITMENT}`)
    expect(result.value.transitionRuleCommitment).toBe(`sha256:${TRANSITION_RULE_COMMITMENT}`)
  })

  test("profileLocalNotes: null is preserved", async () => {
    const { input } = await buildValidInput()
    const result = evaluateRsfPrefixThroughPosition17(input)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.profileLocalNotes).toBeNull()
  })

  test("a non-null notes string is preserved unchanged", async () => {
    const { input } = await buildValidInput()
    input.profile_local_notes = "a local note"
    const result = evaluateRsfPrefixThroughPosition17(input)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.profileLocalNotes).toBe("a local note")
  })

  test("caller inputs are not mutated", async () => {
    const { input } = await buildValidInput()
    const before = JSON.stringify(input)
    evaluateRsfPrefixThroughPosition17(input)
    expect(JSON.stringify(input)).toBe(before)
  })

  test("success values do not alias caller-owned entry or label arrays", async () => {
    const options = validConstructionOptions()
    options.labels = ["a", "b"]
    const { input } = await buildValidInput(options)
    const result = evaluateRsfPrefixThroughPosition17(input)
    expect(result.success).toBe(true)
    if (!result.success) return
    const bundle = (input as any).source_admission_bundle
    expect(result.value.verifiedSourceEntry as unknown).not.toBe(bundle.claimed_source_entry as unknown)
    expect(result.value.verifiedSourceEntry.labels as unknown).not.toBe(bundle.claimed_source_entry.labels as unknown)
    result.value.verifiedSourceEntry.labels.push("mutated-after-success")
    expect(bundle.claimed_source_entry.labels).toEqual(["a", "b"])
  })

  test("mutation of caller inputs after return cannot change the result", async () => {
    const { input } = await buildValidInput()
    const result = evaluateRsfPrefixThroughPosition17(input)
    expect(result.success).toBe(true)
    if (!result.success) return
    const before = JSON.stringify(result.value)
    ;(input as any).source_admission_bundle.claimed_source_entry.notes = "MUTATED_AFTER_SUCCESS"
    ;(input as any).profile_local_notes = "MUTATED_AFTER_SUCCESS"
    expect(JSON.stringify(result.value)).toBe(before)
  })

  test("repeated evaluation of independently cloned equal inputs is deeply equal", async () => {
    const { input } = await buildValidInput()
    const clonedInput = deepClone(input)
    const resultA = evaluateRsfPrefixThroughPosition17(input)
    const resultB = evaluateRsfPrefixThroughPosition17(clonedInput)
    expect(resultA).toEqual(resultB)
  })

  test("object-key insertion order differences in valid declaration and claimed-entry objects do not change success", async () => {
    const { input, expectedEntry } = await buildValidInput()
    const reorderedInput = {
      ...input,
      fold_policy_declaration: normativeFoldPolicyReorderedKeys(),
      source_admission_bundle: {
        ...input.source_admission_bundle,
        claimed_source_entry: entryWithReorderedKeys(deepClone(expectedEntry)),
      },
    }
    const result = evaluateRsfPrefixThroughPosition17(reorderedInput)
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Positions 1-7 exact prefix propagation
// ---------------------------------------------------------------------------

function expectExactFinding(
  result: ReturnType<typeof evaluateRsfPrefixThroughPosition17>,
  code: string,
  check_position: number,
) {
  expect(result.success).toBe(false)
  if (result.success) return
  expect(result.finding).toEqual({
    schema: "recursive_singleton_fold_finding.v0",
    code,
    check_position,
  } as never)
  expect(Object.keys(result.finding).sort()).toEqual(["check_position", "code", "schema"])
}

describe("evaluateRsfPrefixThroughPosition17 - positions 1-7 exact prefix propagation", () => {
  test("position 1 -- malformed_evaluation_input", () => {
    const result = evaluateRsfPrefixThroughPosition17({ not: "a valid evaluation input" })
    expectExactFinding(result, "malformed_evaluation_input", 1)
  })

  test("position 2 -- malformed_source_admission_bundle", async () => {
    const { input } = await buildValidInput()
    const tampered = { ...input, source_admission_bundle: "not-an-object" }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "malformed_source_admission_bundle", 2)
  })

  test("position 3 -- malformed_source_admission_bundle", async () => {
    const { input } = await buildValidInput()
    const tampered = { ...input, source_admission_bundle: { ...input.source_admission_bundle, source_evidence: "x" } }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "malformed_source_admission_bundle", 3)
  })

  test("position 4 -- malformed_source_entry_construction_options", async () => {
    const { input } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: { ...input.source_admission_bundle, source_entry_construction_options: { not: "valid" } },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "malformed_source_entry_construction_options", 4)
  })

  test("position 5 -- malformed_source_evidence", async () => {
    const { input } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: { ...input.source_admission_bundle, source_evidence: { not: "a real HandoffEvidence" } },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "malformed_source_evidence", 5)
  })

  test("position 6 -- malformed_portable_proof_object", async () => {
    const { input } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: { ...input.source_admission_bundle, source_proof_object: { not: "a real PortableProofObjectV0" } },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "malformed_portable_proof_object", 6)
  })

  test("position 7 -- malformed_source_entry", async () => {
    const { input } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: { ...input.source_admission_bundle, claimed_source_entry: { not: "a real chronicle_entry.v0" } },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "malformed_source_entry", 7)
  })
})

// ---------------------------------------------------------------------------
// All nine A3 rejection causes terminate before position 12
// ---------------------------------------------------------------------------

describe("evaluateRsfPrefixThroughPosition17 - all nine A3 rejection causes terminate at positions 8-11", () => {
  test("evidence_root_missing -> position 8 -> source_admission_prerequisite_unavailable", async () => {
    const { input } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: {
        ...input.source_admission_bundle,
        source_evidence: { ...input.source_admission_bundle.source_evidence, anchor: { ...(input.source_admission_bundle.source_evidence as any).anchor, receipt_root: "" } },
      },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "source_admission_prerequisite_unavailable", 8)
  })

  test("evidence_root_mismatch -> position 8 -> source_receipt_root_mismatch", async () => {
    const { input } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: { ...input.source_admission_bundle, source_evidence: tamperedEvidence() },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "source_receipt_root_mismatch", 8)
  })

  test("proof_root_mismatch -> position 9 -> cross_object_consistency_mismatch", async () => {
    const { input, proof } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: { ...input.source_admission_bundle, source_proof_object: { ...proof, receipt_root: `0x${"f".repeat(64)}` } },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "cross_object_consistency_mismatch", 9)
  })

  test("capsule_stored_mismatch -> position 9 -> cross_object_consistency_mismatch", async () => {
    const { input, proof } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: {
        ...input.source_admission_bundle,
        source_proof_object: {
          ...proof,
          evidence_capsule: { ...proof.evidence_capsule, receipt_root: { ...proof.evidence_capsule.receipt_root, stored: `0x${"e".repeat(64)}` } },
        },
      },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "cross_object_consistency_mismatch", 9)
  })

  test("capsule_computed_mismatch -> position 9 -> cross_object_consistency_mismatch", async () => {
    const { input, proof } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: {
        ...input.source_admission_bundle,
        source_proof_object: {
          ...proof,
          evidence_capsule: { ...proof.evidence_capsule, receipt_root: { ...proof.evidence_capsule.receipt_root, computed: `0x${"d".repeat(64)}` } },
        },
      },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "cross_object_consistency_mismatch", 9)
  })

  test("capsule_label_inconsistent -> position 9 -> cross_object_consistency_mismatch", async () => {
    const { input, proof } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: {
        ...input.source_admission_bundle,
        source_proof_object: {
          ...proof,
          evidence_capsule: { ...proof.evidence_capsule, receipt_root: { ...proof.evidence_capsule.receipt_root, match: false } },
        },
      },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "cross_object_consistency_mismatch", 9)
  })

  test("verifier_result_inconsistent -> position 9 -> cross_object_consistency_mismatch", async () => {
    const { input, proof } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: {
        ...input.source_admission_bundle,
        source_proof_object: { ...proof, evidence_capsule: { ...proof.evidence_capsule, verifier_result: { ok: false, status: "verified" as const } } },
      },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "cross_object_consistency_mismatch", 9)
  })

  test("proof_object_id_invalid -> position 10 -> proof_object_identity_mismatch", async () => {
    const { input, proof } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: { ...input.source_admission_bundle, source_proof_object: { ...proof, proof_object_id: "proofobj-wrong" } },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "proof_object_identity_mismatch", 10)
  })

  test("proof_ref_invalid -> position 11 -> proof_reference_mismatch", async () => {
    const { input, proof } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: { ...input.source_admission_bundle, source_proof_object: { ...proof, proof_ref: "receiptos://portable-proof-object/wrong" } },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "proof_reference_mismatch", 11)
  })

  test("no Chronicle reason_code or failure_class is exposed in any of the above findings", async () => {
    const { input, proof } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: { ...input.source_admission_bundle, source_proof_object: { ...proof, proof_object_id: "proofobj-wrong" } },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(JSON.stringify(result.finding)).not.toContain("reason_code")
    expect(JSON.stringify(result.finding)).not.toContain("failure_class")
  })
})

// ---------------------------------------------------------------------------
// Positions 13-17
// ---------------------------------------------------------------------------

describe("evaluateRsfPrefixThroughPosition17 - positions 13, 15, 16, 17", () => {
  test("position 13 -- reconstructed_source_entry_mismatch", async () => {
    const { input } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: {
        ...input.source_admission_bundle,
        claimed_source_entry: { ...input.source_admission_bundle.claimed_source_entry, notes: "not what will be reconstructed" },
      },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "reconstructed_source_entry_mismatch", 13)
  })

  test("position 15 -- malformed_fold_policy_declaration", async () => {
    const { input } = await buildValidInput()
    const tampered = { ...input, fold_policy_declaration: { ...normativeFoldPolicy(), policy_id: "wrong" } }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "malformed_fold_policy_declaration", 15)
  })

  test("position 16 -- malformed_comparability_class_declaration", async () => {
    const { input } = await buildValidInput()
    const tampered = { ...input, comparability_class_declaration: { ...normativeComparabilityClass(), class_id: "wrong" } }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "malformed_comparability_class_declaration", 16)
  })

  test("position 17 -- malformed_transition_rule_declaration", async () => {
    const { input } = await buildValidInput()
    const tampered = { ...input, transition_rule_declaration: { ...normativeTransitionRule(), rule_id: "wrong" } }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "malformed_transition_rule_declaration", 17)
  })

  // Position 14 has no failure case (derivation-only). The three
  // declaration commitment-mismatch codes are currently unreachable from
  // structurally valid exact-literal declarations -- not fabricated here.
})

// ---------------------------------------------------------------------------
// First-finding order
// ---------------------------------------------------------------------------

describe("evaluateRsfPrefixThroughPosition17 - first-finding order", () => {
  test("position 1 beats every later defect", async () => {
    const result = evaluateRsfPrefixThroughPosition17("not even an object")
    expectExactFinding(result, "malformed_evaluation_input", 1)
  })

  test("position 4 beats positions 5-17", async () => {
    const { input } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: {
        ...input.source_admission_bundle,
        source_entry_construction_options: { not: "valid" },
        source_evidence: { not: "a real HandoffEvidence" }, // would also be position 5
      },
      fold_policy_declaration: { not: "valid" }, // would also be position 15
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "malformed_source_entry_construction_options", 4)
  })

  test("position 5 beats position 6", async () => {
    const { input } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: {
        ...input.source_admission_bundle,
        source_evidence: { not: "a real HandoffEvidence" },
        source_proof_object: { not: "a real PortableProofObjectV0" },
      },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "malformed_source_evidence", 5)
  })

  test("position 6 beats position 7", async () => {
    const { input } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: {
        ...input.source_admission_bundle,
        source_proof_object: { not: "a real PortableProofObjectV0" },
        claimed_source_entry: { not: "a real chronicle_entry.v0" },
      },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "malformed_portable_proof_object", 6)
  })

  test("position 7 beats position 8", async () => {
    const { input } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: {
        ...input.source_admission_bundle,
        claimed_source_entry: { not: "a real chronicle_entry.v0" },
        source_evidence: { ...input.source_admission_bundle.source_evidence, anchor: { ...(input.source_admission_bundle.source_evidence as any).anchor, receipt_root: "" } },
      },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "malformed_source_entry", 7)
  })

  test("position 8 beats positions 9-17", async () => {
    const { input, proof } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: {
        ...input.source_admission_bundle,
        source_evidence: { ...input.source_admission_bundle.source_evidence, anchor: { ...(input.source_admission_bundle.source_evidence as any).anchor, receipt_root: "" } },
        source_proof_object: { ...proof, proof_object_id: "proofobj-wrong" }, // would also be position 10
      },
      fold_policy_declaration: { not: "valid" }, // would also be position 15
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "source_admission_prerequisite_unavailable", 8)
  })

  test("position 9 beats positions 10-17", async () => {
    const { input, proof } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: {
        ...input.source_admission_bundle,
        source_proof_object: {
          ...proof,
          receipt_root: `0x${"1".repeat(64)}`, // position 9 defect
          proof_object_id: "proofobj-also-wrong", // would also be position 10
        },
      },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "cross_object_consistency_mismatch", 9)
  })

  test("position 10 beats position 11", async () => {
    const { input, proof } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: {
        ...input.source_admission_bundle,
        source_proof_object: {
          ...proof,
          proof_object_id: "proofobj-wrong", // position 10 defect
          proof_ref: "receiptos://portable-proof-object/also-wrong", // would also be position 11
        },
      },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "proof_object_identity_mismatch", 10)
  })

  test("position 11 beats position 13", async () => {
    const { input, proof } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: {
        ...input.source_admission_bundle,
        source_proof_object: { ...proof, proof_ref: "receiptos://portable-proof-object/wrong" }, // position 11 defect
        claimed_source_entry: { ...input.source_admission_bundle.claimed_source_entry, notes: "would also be position 13" },
      },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "proof_reference_mismatch", 11)
  })

  test("position 13 beats position 15", async () => {
    const { input } = await buildValidInput()
    const tampered = {
      ...input,
      source_admission_bundle: {
        ...input.source_admission_bundle,
        claimed_source_entry: { ...input.source_admission_bundle.claimed_source_entry, notes: "position 13 defect" },
      },
      fold_policy_declaration: { not: "valid" }, // would also be position 15
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "reconstructed_source_entry_mismatch", 13)
  })

  test("position 15 beats position 16", async () => {
    const { input } = await buildValidInput()
    const tampered = {
      ...input,
      fold_policy_declaration: { not: "valid" }, // position 15 defect
      comparability_class_declaration: { not: "valid" }, // would also be position 16
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "malformed_fold_policy_declaration", 15)
  })

  test("position 16 beats position 17", async () => {
    const { input } = await buildValidInput()
    const tampered = {
      ...input,
      comparability_class_declaration: { not: "valid" }, // position 16 defect
      transition_rule_declaration: { not: "valid" }, // would also be position 17
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expectExactFinding(result, "malformed_comparability_class_declaration", 16)
  })

  test("the prefix returns exactly one finding, never an array", async () => {
    const { input } = await buildValidInput()
    const tampered = {
      ...input,
      fold_policy_declaration: { not: "valid" },
      comparability_class_declaration: { not: "valid" },
      transition_rule_declaration: { not: "valid" },
    }
    const result = evaluateRsfPrefixThroughPosition17(tampered)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(Array.isArray(result.finding)).toBe(false)
    expect(Object.keys(result).sort()).toEqual(["finding", "success"])
  })
})

// ---------------------------------------------------------------------------
// Surface
// ---------------------------------------------------------------------------

describe("function surface", () => {
  test("evaluateRsfPrefixThroughPosition17.length === 1", () => {
    expect(evaluateRsfPrefixThroughPosition17.length).toBe(1)
  })
})
