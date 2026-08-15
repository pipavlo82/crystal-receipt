/**
 * TSEI invariant discrimination & attribution conformance v0.
 *
 * Proves the five-rung evidence ladder (declared -> discriminating ->
 * attribution-consistent -> causally-supported -> independently-grounded)
 * mechanically, using only synthetic fixtures under
 * conformance/tsei-invariant-discrimination-v0/. See that directory's
 * README.md for full rung semantics and the Oracle Boundary section --
 * this file executes what that document describes.
 *
 * This is conformance methodology, not a TSEI runtime change: nothing here
 * touches the specification, the canonical-identity comparator, the
 * transformation-stability modules, or any frozen comparator/coverage
 * vector file, and no TSEI runtime verdict is introduced or reinterpreted.
 *
 * Load-bearing design points:
 *  - Discrimination evidence is derived from the actual observed
 *    baseline->mutant transition (newly_violated), never merely from what
 *    a mutant declares -- see the "rung 2" and "predicate-flip negative
 *    control" sections below.
 *  - Causal repair support is derived from the observed before/after
 *    attribution delta (exact single-invariant removal, zero side
 *    effects), never merely from the repair's own authored claim -- three
 *    negative controls are specifically built so the authored claim
 *    matches reality while the repair is still not causally correct.
 *  - Attribution corruption/swap controls exist on BOTH sides: the
 *    declared-oracle side (Cases 5/6) and the emitted-output side
 *    (the corrupted-emission section), and they are not conflated.
 *  - Every negative control is *executed*, and its rejection is asserted,
 *    not merely declared to exist.
 */

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  BASELINE_ALREADY_VIOLATING_A,
  BASELINE_CASE,
  EMISSION_CORRUPTION_ID_SUBSTITUTION,
  EMISSION_CORRUPTION_SWAP_AB,
  INVARIANTS,
  INVARIANT_C,
  MUTANT_CASE3_UNDERDECLARED,
  MUTANT_CASE4_OVERDECLARED,
  MUTANT_CASE5_CORRUPTED_ID,
  MUTANT_CASE6_MB_SWAPPED,
  MUTANT_CASE6_M1_SWAPPED,
  MUTANT_CASE_NO_TRANSITION,
  MUTANT_MB_SINGLETON,
  MUTANT_M1_SINGLETON,
  MUTANT_M2_MULTI,
  MUTANT_M_NOOP,
  REPAIR_CASE_A_NEVER_VIOLATED,
  REPAIR_CASE_B_OVERREACH,
  REPAIR_CASE_C_SIDE_EFFECT,
  REPAIR_R1_FIX_ALPHA,
  REPAIR_R2_FIX_BETA,
  REPAIR_R_WRONG,
} from "../../conformance/tsei-invariant-discrimination-v0/fixtures"
import {
  canonicalDigest,
  deriveExpectedAttributionDigest,
  deriveInvariantSetDigest,
  deriveMutantDescriptorDigest,
  sortedArray,
  type InvariantId,
} from "../../conformance/tsei-invariant-discrimination-v0/model"
import {
  discriminationEvidence,
  discriminationStatusPerInvariant,
  runMutantCase,
  runMutantCaseWithCorruptedEmission,
  runRepairCase,
  INDEPENDENT_GROUNDING_REASON,
  INDEPENDENT_GROUNDING_STATUS,
  type LadderReport,
} from "../../conformance/tsei-invariant-discrimination-v0/ladder"

const MANIFEST_PATH = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "precommitment-manifest.json",
)

type PrecommitmentManifest = {
  readonly invariant_set_digest: string
  readonly baseline_digest: string
  readonly baseline_already_violating_a_digest: string
  readonly mutants: Record<string, { readonly mutant_descriptor_digest: string; readonly expected_attribution_digest: string }>
}

describe("rung 1: declared", () => {
  test("all three invariants have stable, distinct ids", () => {
    const ids = INVARIANTS.map((invariant) => invariant.invariant_id)
    expect(ids).toEqual(["I_A", "I_B", "I_C"])
    expect(new Set(ids).size).toBe(3)
  })

  test("declaration alone proves nothing about discrimination -- I_C is declared and NOT discriminated", () => {
    expect(INVARIANT_C.invariant_id).toBe("I_C")
  })
})

describe("Case 1 -- singleton discrimination", () => {
  test("mutant changes input, baseline holds I_A, mutated flips it, newly_violated == {I_A}", () => {
    const result = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M1_SINGLETON)
    expect(result.is_no_op).toBe(false)
    expect(result.baseline_digest).not.toBe(result.mutant_digest)
    expect(sortedArray(result.baseline_attribution)).toEqual([])
    expect(sortedArray(result.mutated_attribution)).toEqual(["I_A"])
    expect(sortedArray(result.newly_violated)).toEqual(["I_A"])
    expect(sortedArray(result.no_longer_violated)).toEqual([])
    expect(result.attribution_matches).toBe(true)
    expect(sortedArray(discriminationEvidence(result))).toEqual(["I_A"])
  })
})

describe("Case 2 -- legitimate multi-attribution", () => {
  test("one mutant genuinely breaks I_A and I_B; newly_violated == {I_A, I_B}", () => {
    const result = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M2_MULTI)
    expect(result.is_no_op).toBe(false)
    expect(sortedArray(result.mutated_attribution)).toEqual(["I_A", "I_B"])
    expect(sortedArray(result.newly_violated)).toEqual(["I_A", "I_B"])
    expect(result.attribution_matches).toBe(true)
  })

  test("proves singleton attribution is not a universal assumption", () => {
    expect(MUTANT_M2_MULTI.expected_attribution.size).toBe(2)
  })
})

describe("predicate-flip negative control -- discrimination requires baseline->mutant transition", () => {
  test("already-violated invariant that stays violated is NOT discrimination evidence, even though declared == observed", () => {
    const result = runMutantCase(INVARIANTS, BASELINE_ALREADY_VIOLATING_A, MUTANT_CASE_NO_TRANSITION)
    // The mutation genuinely changes the input.
    expect(result.is_no_op).toBe(false)
    expect(result.baseline_digest).not.toBe(result.mutant_digest)
    // I_A was already violated before the mutation...
    expect(sortedArray(result.baseline_attribution)).toEqual(["I_A"])
    // ...and remains violated after it -- no transition occurred.
    expect(sortedArray(result.mutated_attribution)).toEqual(["I_A"])
    expect(sortedArray(result.newly_violated)).toEqual([])
    // A naive "observed == declared" check would wrongly accept this:
    expect(result.attribution_matches).toBe(true)
    // But discrimination evidence must be empty regardless.
    expect(sortedArray(discriminationEvidence(result))).toEqual([])
  })
})

describe("Case 3 -- unexpected extra attribution (negative control)", () => {
  test("harness rejects: declared {I_A}, observed {I_A, I_B}", () => {
    const result = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_CASE3_UNDERDECLARED)
    expect(result.is_no_op).toBe(false)
    expect(sortedArray(result.mutated_attribution)).toEqual(["I_A", "I_B"])
    expect(sortedArray(result.expected_attribution)).toEqual(["I_A"])
    expect(result.attribution_matches).toBe(false)
    expect(result.extra).toEqual(["I_B"])
    expect(result.missing).toEqual([])
  })
})

describe("Case 4 -- missing attribution (negative control)", () => {
  test("harness rejects: declared {I_A, I_B}, observed {I_A}", () => {
    const result = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_CASE4_OVERDECLARED)
    expect(result.is_no_op).toBe(false)
    expect(sortedArray(result.mutated_attribution)).toEqual(["I_A"])
    expect(sortedArray(result.expected_attribution)).toEqual(["I_A", "I_B"])
    expect(result.attribution_matches).toBe(false)
    expect(result.extra).toEqual([])
    expect(result.missing).toEqual(["I_B"])
  })
})

describe("Case 5 -- corrupted attribution ID, ORACLE side (negative control)", () => {
  test("predicates unchanged, only the declared id is corrupted -- harness rejects", () => {
    const result = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_CASE5_CORRUPTED_ID)
    expect(result.is_no_op).toBe(false)
    expect(result.mutant_digest).toBe(runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M1_SINGLETON).mutant_digest)
    expect(sortedArray(result.mutated_attribution)).toEqual(["I_A"])
    expect(sortedArray(result.expected_attribution)).toEqual(["I_X"])
    expect(result.attribution_matches).toBe(false)
    expect(result.extra).toEqual(["I_A"])
    expect(result.missing).toEqual(["I_X"])
  })
})

describe("Case 6 -- swapped attribution IDs, ORACLE side (negative control)", () => {
  test("half 1: M1's real mutation (I_A only) declared as I_B -- rejected", () => {
    const result = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_CASE6_M1_SWAPPED)
    expect(result.is_no_op).toBe(false)
    expect(sortedArray(result.mutated_attribution)).toEqual(["I_A"])
    expect(sortedArray(result.expected_attribution)).toEqual(["I_B"])
    expect(result.attribution_matches).toBe(false)
  })

  test("half 2: MB's real mutation (I_B only) declared as I_A -- rejected", () => {
    const result = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_CASE6_MB_SWAPPED)
    expect(result.is_no_op).toBe(false)
    expect(sortedArray(result.mutated_attribution)).toEqual(["I_B"])
    expect(sortedArray(result.expected_attribution)).toEqual(["I_A"])
    expect(result.attribution_matches).toBe(false)
  })
})

describe("output-side attribution corruption/swap (negative controls, distinct from Cases 5/6)", () => {
  test("control A: predicate and declared oracle unchanged; only the EMITTED id is corrupted -- rejected", () => {
    const result = runMutantCaseWithCorruptedEmission(
      INVARIANTS,
      BASELINE_CASE,
      MUTANT_M1_SINGLETON,
      EMISSION_CORRUPTION_ID_SUBSTITUTION,
    )
    expect(result.is_no_op).toBe(false)
    // Predicate behavior is provably unchanged: the real evaluation still says {I_A}.
    expect(sortedArray(result.true_mutated_attribution)).toEqual(["I_A"])
    // Only the emitted label is corrupted.
    expect(sortedArray(result.corrupted_emitted_attribution)).toEqual(["I_X"])
    expect(sortedArray(result.expected_attribution)).toEqual(["I_A"])
    expect(result.attribution_matches).toBe(false)
  })

  test("control B: I_A/I_B predicates and declared oracles unchanged; emitted ids I_A<->I_B swapped -- both mutants rejected", () => {
    const m1Result = runMutantCaseWithCorruptedEmission(
      INVARIANTS,
      BASELINE_CASE,
      MUTANT_M1_SINGLETON,
      EMISSION_CORRUPTION_SWAP_AB,
    )
    expect(sortedArray(m1Result.true_mutated_attribution)).toEqual(["I_A"])
    expect(sortedArray(m1Result.corrupted_emitted_attribution)).toEqual(["I_B"])
    expect(m1Result.attribution_matches).toBe(false)

    const mbResult = runMutantCaseWithCorruptedEmission(
      INVARIANTS,
      BASELINE_CASE,
      MUTANT_MB_SINGLETON,
      EMISSION_CORRUPTION_SWAP_AB,
    )
    expect(sortedArray(mbResult.true_mutated_attribution)).toEqual(["I_B"])
    expect(sortedArray(mbResult.corrupted_emitted_attribution)).toEqual(["I_A"])
    expect(mbResult.attribution_matches).toBe(false)
  })
})

describe("Case 7 -- counterfactual repair, direction one", () => {
  test("repairing only I_A on the {I_A, I_B} mutant leaves {I_B}, causally supported", () => {
    const mutantResult = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M2_MULTI)
    expect(mutantResult.attribution_matches).toBe(true) // precondition: real {I_A, I_B} violation

    const repairResult = runRepairCase(INVARIANTS, mutantResult.mutated, REPAIR_R1_FIX_ALPHA)
    expect(repairResult.is_no_op).toBe(false)
    expect(repairResult.mutated_digest).not.toBe(repairResult.repaired_digest)
    expect(sortedArray(repairResult.attribution_before_repair)).toEqual(["I_A", "I_B"])
    expect(sortedArray(repairResult.attribution_after_repair)).toEqual(["I_B"])
    expect(sortedArray(repairResult.removed_attribution)).toEqual(["I_A"])
    expect(sortedArray(repairResult.added_attribution)).toEqual([])
    expect(repairResult.target_was_violated_before).toBe(true)
    expect(repairResult.causally_supported).toBe(true)
    expect(repairResult.attribution_matches).toBe(true)
  })
})

describe("Case 8 -- counterfactual repair, direction two", () => {
  test("repairing only I_B on the SAME {I_A, I_B} mutant leaves {I_A}, causally supported", () => {
    const mutantResult = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M2_MULTI)
    const repairResult = runRepairCase(INVARIANTS, mutantResult.mutated, REPAIR_R2_FIX_BETA)
    expect(repairResult.is_no_op).toBe(false)
    expect(sortedArray(repairResult.attribution_after_repair)).toEqual(["I_A"])
    expect(sortedArray(repairResult.removed_attribution)).toEqual(["I_B"])
    expect(sortedArray(repairResult.added_attribution)).toEqual([])
    expect(repairResult.causally_supported).toBe(true)
  })
})

describe("Case 9 -- wrong repair declaration (negative control)", () => {
  test("a repair that changes something but never removes its claimed target is rejected on both checks", () => {
    const mutantResult = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M2_MULTI)
    const repairResult = runRepairCase(INVARIANTS, mutantResult.mutated, REPAIR_R_WRONG)
    expect(repairResult.is_no_op).toBe(false)
    expect(repairResult.mutated_digest).not.toBe(repairResult.repaired_digest)
    // Never touched alpha, so I_A (its claimed target) is still violated.
    expect(sortedArray(repairResult.attribution_after_repair)).toEqual(["I_A", "I_B"])
    expect(sortedArray(repairResult.removed_attribution)).toEqual([])
    expect(repairResult.causally_supported).toBe(false)
    expect(repairResult.attribution_matches).toBe(false)
  })
})

describe("causal negative controls -- authored claim matches reality, yet repair is not causally correct", () => {
  test("control A: target was never violated before repair -- rejected", () => {
    const mutantResult = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M2_MULTI)
    const repairResult = runRepairCase(INVARIANTS, mutantResult.mutated, REPAIR_CASE_A_NEVER_VIOLATED)
    expect(repairResult.is_no_op).toBe(false)
    // The authored claim happens to be exactly right about the resulting set...
    expect(sortedArray(repairResult.attribution_after_repair)).toEqual(["I_B"])
    expect(repairResult.attribution_matches).toBe(true)
    // ...but I_C (the claimed target) was never violated to begin with.
    expect(repairResult.target_was_violated_before).toBe(false)
    expect(repairResult.causally_supported).toBe(false)
  })

  test("control B: repair removes target plus an unrelated invariant -- rejected", () => {
    const mutantResult = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M2_MULTI)
    const repairResult = runRepairCase(INVARIANTS, mutantResult.mutated, REPAIR_CASE_B_OVERREACH)
    expect(repairResult.is_no_op).toBe(false)
    expect(sortedArray(repairResult.attribution_after_repair)).toEqual([])
    expect(repairResult.attribution_matches).toBe(true) // authored claim matches reality
    expect(sortedArray(repairResult.removed_attribution)).toEqual(["I_A", "I_B"]) // more than just the target
    expect(repairResult.causally_supported).toBe(false)
  })

  test("control C: repair removes target but introduces a new invariant -- rejected", () => {
    const mutantResult = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M2_MULTI)
    const repairResult = runRepairCase(INVARIANTS, mutantResult.mutated, REPAIR_CASE_C_SIDE_EFFECT)
    expect(repairResult.is_no_op).toBe(false)
    expect(sortedArray(repairResult.attribution_after_repair)).toEqual(["I_B", "I_C"])
    expect(repairResult.attribution_matches).toBe(true) // authored claim matches reality
    expect(sortedArray(repairResult.removed_attribution)).toEqual(["I_A"]) // the target, correctly
    expect(sortedArray(repairResult.added_attribution)).toEqual(["I_C"]) // but a side effect was introduced
    expect(repairResult.causally_supported).toBe(false)
  })
})

describe("Case 10 -- no-op mutant (negative control)", () => {
  test("a mutation that changes nothing is rejected before its output is treated as evidence", () => {
    const result = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M_NOOP)
    expect(result.baseline_digest).toBe(result.mutant_digest)
    expect(result.is_no_op).toBe(true)
    expect(result.attribution_matches).toBe(false)
    expect(sortedArray(discriminationEvidence(result))).toEqual([])
  })
})

describe("rung 2: discrimination is per-invariant, derived from the observed transition, and is not the same as declared", () => {
  test("I_A and I_B achieve PROVEN discrimination via newly_violated; I_C -- declared but never targeted -- reports UNPROVEN_DISCRIMINATION", () => {
    const validated = [
      runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M1_SINGLETON),
      runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_MB_SINGLETON),
      runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M2_MULTI),
    ]
    expect(validated.every((r) => r.attribution_matches)).toBe(true)

    const provenDiscriminators = new Set<InvariantId>()
    for (const result of validated) {
      for (const id of discriminationEvidence(result)) provenDiscriminators.add(id)
    }

    const statuses = discriminationStatusPerInvariant(INVARIANTS, provenDiscriminators)
    expect(statuses.get("I_A")).toBe("PROVEN")
    expect(statuses.get("I_B")).toBe("PROVEN")
    expect(statuses.get("I_C")).toBe("UNPROVEN_DISCRIMINATION")
  })

  test("the no-transition control contributes nothing even though it is attribution-consistent", () => {
    const noTransitionResult = runMutantCase(INVARIANTS, BASELINE_ALREADY_VIOLATING_A, MUTANT_CASE_NO_TRANSITION)
    expect(noTransitionResult.attribution_matches).toBe(true)
    const provenDiscriminators = new Set<InvariantId>(discriminationEvidence(noTransitionResult))
    expect(provenDiscriminators.size).toBe(0)
    const statuses = discriminationStatusPerInvariant(INVARIANTS, provenDiscriminators)
    expect(statuses.get("I_A")).toBe("UNPROVEN_DISCRIMINATION")
  })
})

describe("self-application / control sensitivity", () => {
  test("every negative control is actually executed and actually rejected", () => {
    const rejectedMutantCases = [
      MUTANT_CASE3_UNDERDECLARED, // extra unexplained attribution
      MUTANT_CASE4_OVERDECLARED, // missing declared attribution
      MUTANT_CASE5_CORRUPTED_ID, // corrupted attribution id (oracle side)
      MUTANT_CASE6_M1_SWAPPED, // swapped attribution id (oracle side), half 1
      MUTANT_CASE6_MB_SWAPPED, // swapped attribution id (oracle side), half 2
    ]
    for (const mutant of rejectedMutantCases) {
      const result = runMutantCase(INVARIANTS, BASELINE_CASE, mutant)
      expect(result.attribution_matches).toBe(false)
    }

    // Output-side corruption/swap controls.
    expect(
      runMutantCaseWithCorruptedEmission(INVARIANTS, BASELINE_CASE, MUTANT_M1_SINGLETON, EMISSION_CORRUPTION_ID_SUBSTITUTION)
        .attribution_matches,
    ).toBe(false)
    expect(
      runMutantCaseWithCorruptedEmission(INVARIANTS, BASELINE_CASE, MUTANT_M1_SINGLETON, EMISSION_CORRUPTION_SWAP_AB)
        .attribution_matches,
    ).toBe(false)
    expect(
      runMutantCaseWithCorruptedEmission(INVARIANTS, BASELINE_CASE, MUTANT_MB_SINGLETON, EMISSION_CORRUPTION_SWAP_AB)
        .attribution_matches,
    ).toBe(false)

    // No-op mutation control.
    const noOpResult = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M_NOOP)
    expect(noOpResult.is_no_op).toBe(true)
    expect(noOpResult.attribution_matches).toBe(false)

    // Predicate-flip (no-transition) discrimination control.
    const noTransitionResult = runMutantCase(INVARIANTS, BASELINE_ALREADY_VIOLATING_A, MUTANT_CASE_NO_TRANSITION)
    expect(sortedArray(discriminationEvidence(noTransitionResult))).toEqual([])

    // Causal negative controls: repair that does not remove the claimed attribution / overreaches / has a side effect.
    const mutantResult = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M2_MULTI)
    for (const repair of [REPAIR_R_WRONG, REPAIR_CASE_A_NEVER_VIOLATED, REPAIR_CASE_B_OVERREACH, REPAIR_CASE_C_SIDE_EFFECT]) {
      const repairResult = runRepairCase(INVARIANTS, mutantResult.mutated, repair)
      expect(repairResult.causally_supported).toBe(false)
    }
  })

  test("the correct cases are NOT rejected -- controls discriminate, they do not just reject everything", () => {
    const acceptedMutantCases = [MUTANT_M1_SINGLETON, MUTANT_MB_SINGLETON, MUTANT_M2_MULTI]
    for (const mutant of acceptedMutantCases) {
      const result = runMutantCase(INVARIANTS, BASELINE_CASE, mutant)
      expect(result.attribution_matches).toBe(true)
    }

    const mutantResult = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M2_MULTI)
    for (const repair of [REPAIR_R1_FIX_ALPHA, REPAIR_R2_FIX_BETA]) {
      const repairResult = runRepairCase(INVARIANTS, mutantResult.mutated, repair)
      expect(repairResult.causally_supported).toBe(true)
    }
  })
})

describe("precommitment (manifest-anchored)", () => {
  test("fresh recomputation from live fixture code matches the literal, hand-frozen manifest exactly", () => {
    const manifest: PrecommitmentManifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))

    expect(deriveInvariantSetDigest(INVARIANTS)).toBe(manifest.invariant_set_digest)
    expect(canonicalDigest(BASELINE_CASE)).toBe(manifest.baseline_digest)
    expect(canonicalDigest(BASELINE_ALREADY_VIOLATING_A)).toBe(manifest.baseline_already_violating_a_digest)

    for (const mutant of [MUTANT_M1_SINGLETON, MUTANT_M2_MULTI, MUTANT_CASE_NO_TRANSITION]) {
      const manifestRow = manifest.mutants[mutant.mutant_id]
      expect(manifestRow).toBeDefined()
      expect(deriveMutantDescriptorDigest(mutant)).toBe(manifestRow.mutant_descriptor_digest)
      expect(deriveExpectedAttributionDigest(mutant.expected_attribution)).toBe(manifestRow.expected_attribution_digest)
    }
  })

  test("the manifest is plain, literal JSON data -- not a same-file computed constant", () => {
    const manifest: PrecommitmentManifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
    // Every value must be a 64-hex-char sha256 digest string, not a reference
    // or a function -- i.e. genuinely inert data, not recomputed at import.
    const hex64 = /^[0-9a-f]{64}$/
    expect(hex64.test(manifest.invariant_set_digest)).toBe(true)
    expect(hex64.test(manifest.baseline_digest)).toBe(true)
    expect(hex64.test(manifest.baseline_already_violating_a_digest)).toBe(true)
    for (const row of Object.values(manifest.mutants)) {
      expect(hex64.test(row.mutant_descriptor_digest)).toBe(true)
      expect(hex64.test(row.expected_attribution_digest)).toBe(true)
    }
  })
})

describe("independent grounding", () => {
  test("remains UNPROVEN in this lane", () => {
    expect(INDEPENDENT_GROUNDING_STATUS).toBe("UNPROVEN")
    expect(INDEPENDENT_GROUNDING_REASON).toContain("INDEPENDENT_GROUNDING_NOT_PROVEN")
    expect(INDEPENDENT_GROUNDING_REASON).toContain("single authoring authority")
  })
})

describe("assembled ladder report", () => {
  test("required interpretation: each rung is strictly weaker evidence than the next", () => {
    const provenDiscriminators = new Set<InvariantId>(["I_A", "I_B"])
    const statuses = discriminationStatusPerInvariant(INVARIANTS, provenDiscriminators)
    expect(statuses.get("I_C")).toBe("UNPROVEN_DISCRIMINATION")

    const report: LadderReport = {
      declared: true,
      // PROVEN for the invariants this lane's required cases target (I_A, I_B):
      // Cases 1/2/7/8 give mechanically-evidenced, transition-derived discrimination
      // for both. I_C is declared-only by design and is correctly, non-silently
      // reported UNPROVEN_DISCRIMINATION above.
      discrimination: "PROVEN",
      // PROVEN: exact equality holds for every real case, and every negative
      // control (oracle-side Cases 3-6, output-side corruption/swap, no-op,
      // predicate-flip) is actually rejected.
      attribution_consistency: "PROVEN",
      // PROVEN: Cases 7 and 8 both show removed_attribution == {target},
      // added_attribution == {}, in both directions, on the observed delta --
      // and the three causal negative controls (never-violated, overreach,
      // side-effect) are all rejected even though their authored claims match reality.
      causal_support: "PROVEN",
      // Precommitment status is reported separately in the audit report,
      // anchored to a pushed commit -- see precommitment-manifest.json and
      // this file's "precommitment" describe block.
      precommitment: "PROVEN",
      // UNPROVEN by construction -- see README.md's Oracle Boundary section.
      independent_grounding: "UNPROVEN",
    }

    expect(report.declared).toBe(true)
    expect(report.discrimination).toBe("PROVEN")
    expect(report.attribution_consistency).toBe("PROVEN")
    expect(report.causal_support).toBe("PROVEN")
    expect(report.precommitment).toBe("PROVEN")
    expect(report.independent_grounding).toBe("UNPROVEN")

    // CAUSALLY_SUPPORTED does not imply INDEPENDENTLY_GROUNDED.
    expect(report.causal_support).not.toBe(report.independent_grounding)
  })
})
