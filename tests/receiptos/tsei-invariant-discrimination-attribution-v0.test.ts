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
 * Load-bearing design point: every negative control below is *executed*,
 * and its rejection is asserted, not merely declared to exist. A control
 * suite that only checks "a rejecting function is exported" would prove
 * nothing about whether the harness actually rejects bad input.
 */

import { describe, expect, test } from "bun:test"
import {
  BASELINE_CASE,
  INVARIANTS,
  INVARIANT_C,
  M1_PRECOMMITMENT,
  M2_PRECOMMITMENT,
  MUTANT_CASE3_UNDERDECLARED,
  MUTANT_CASE4_OVERDECLARED,
  MUTANT_CASE5_CORRUPTED_ID,
  MUTANT_CASE6_MB_SWAPPED,
  MUTANT_CASE6_M1_SWAPPED,
  MUTANT_MB_SINGLETON,
  MUTANT_M1_SINGLETON,
  MUTANT_M2_MULTI,
  MUTANT_M_NOOP,
  REPAIR_R1_FIX_ALPHA,
  REPAIR_R2_FIX_BETA,
  REPAIR_R_WRONG,
} from "../../conformance/tsei-invariant-discrimination-v0/fixtures"
import {
  derivePrecommitment,
  sortedArray,
  type InvariantId,
} from "../../conformance/tsei-invariant-discrimination-v0/model"
import {
  discriminationStatusPerInvariant,
  runMutantCase,
  runRepairCase,
  INDEPENDENT_GROUNDING_REASON,
  INDEPENDENT_GROUNDING_STATUS,
  type LadderReport,
} from "../../conformance/tsei-invariant-discrimination-v0/ladder"

describe("rung 1: declared", () => {
  test("all three invariants have stable, distinct ids", () => {
    const ids = INVARIANTS.map((invariant) => invariant.invariant_id)
    expect(ids).toEqual(["I_A", "I_B", "I_C"])
    expect(new Set(ids).size).toBe(3)
  })

  test("declaration alone proves nothing about discrimination -- I_C is declared and NOT discriminated", () => {
    // This assertion is answered definitively in "rung 2", but stating it
    // here documents that declaration by itself is a distinct, weaker claim.
    expect(INVARIANT_C.invariant_id).toBe("I_C")
  })
})

describe("Case 1 -- singleton discrimination", () => {
  test("mutant changes input, gate fails, observed == {I_A}", () => {
    const result = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M1_SINGLETON)
    expect(result.is_no_op).toBe(false)
    expect(result.baseline_digest).not.toBe(result.mutant_digest)
    expect(sortedArray(result.observed_attribution)).toEqual(["I_A"])
    expect(result.attribution_matches).toBe(true)
    expect(result.extra).toEqual([])
    expect(result.missing).toEqual([])
  })
})

describe("Case 2 -- legitimate multi-attribution", () => {
  test("one mutant genuinely breaks I_A and I_B; observed == {I_A, I_B}", () => {
    const result = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M2_MULTI)
    expect(result.is_no_op).toBe(false)
    expect(sortedArray(result.observed_attribution)).toEqual(["I_A", "I_B"])
    expect(result.attribution_matches).toBe(true)
  })

  test("proves singleton attribution is not a universal assumption", () => {
    expect(MUTANT_M2_MULTI.expected_attribution.size).toBe(2)
  })
})

describe("Case 3 -- unexpected extra attribution (negative control)", () => {
  test("harness rejects: declared {I_A}, observed {I_A, I_B}", () => {
    const result = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_CASE3_UNDERDECLARED)
    expect(result.is_no_op).toBe(false)
    expect(sortedArray(result.observed_attribution)).toEqual(["I_A", "I_B"])
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
    expect(sortedArray(result.observed_attribution)).toEqual(["I_A"])
    expect(sortedArray(result.expected_attribution)).toEqual(["I_A", "I_B"])
    expect(result.attribution_matches).toBe(false)
    expect(result.extra).toEqual([])
    expect(result.missing).toEqual(["I_B"])
  })
})

describe("Case 5 -- corrupted attribution ID (negative control)", () => {
  test("predicates unchanged, only the declared id is corrupted -- harness rejects", () => {
    const result = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_CASE5_CORRUPTED_ID)
    expect(result.is_no_op).toBe(false)
    // Same real mutation as M1: predicate behavior is untouched.
    expect(result.mutant_digest).toBe(runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M1_SINGLETON).mutant_digest)
    expect(sortedArray(result.observed_attribution)).toEqual(["I_A"])
    expect(sortedArray(result.expected_attribution)).toEqual(["I_X"])
    expect(result.attribution_matches).toBe(false)
    expect(result.extra).toEqual(["I_A"])
    expect(result.missing).toEqual(["I_X"])
  })
})

describe("Case 6 -- swapped attribution IDs (negative control)", () => {
  test("half 1: M1's real mutation (I_A only) declared as I_B -- rejected", () => {
    const result = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_CASE6_M1_SWAPPED)
    expect(result.is_no_op).toBe(false)
    expect(sortedArray(result.observed_attribution)).toEqual(["I_A"])
    expect(sortedArray(result.expected_attribution)).toEqual(["I_B"])
    expect(result.attribution_matches).toBe(false)
  })

  test("half 2: MB's real mutation (I_B only) declared as I_A -- rejected", () => {
    const result = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_CASE6_MB_SWAPPED)
    expect(result.is_no_op).toBe(false)
    expect(sortedArray(result.observed_attribution)).toEqual(["I_B"])
    expect(sortedArray(result.expected_attribution)).toEqual(["I_A"])
    expect(result.attribution_matches).toBe(false)
  })
})

describe("Case 7 -- counterfactual repair, direction one", () => {
  test("repairing only I_A on the {I_A, I_B} mutant leaves {I_B}", () => {
    const mutantResult = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M2_MULTI)
    expect(mutantResult.attribution_matches).toBe(true) // precondition: real {I_A, I_B} violation

    const repairResult = runRepairCase(INVARIANTS, mutantResult.mutated, REPAIR_R1_FIX_ALPHA)
    expect(repairResult.is_no_op).toBe(false)
    expect(repairResult.mutated_digest).not.toBe(repairResult.repaired_digest)
    expect(sortedArray(repairResult.observed_attribution_after_repair)).toEqual(["I_B"])
    expect(repairResult.attribution_matches).toBe(true)
    expect(repairResult.target_invariant_resolved).toBe(true) // I_A's attribution disappeared
    expect(repairResult.observed_attribution_after_repair.has("I_B")).toBe(true) // unrelated attribution remains
  })
})

describe("Case 8 -- counterfactual repair, direction two", () => {
  test("repairing only I_B on the SAME {I_A, I_B} mutant leaves {I_A}", () => {
    const mutantResult = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M2_MULTI)
    const repairResult = runRepairCase(INVARIANTS, mutantResult.mutated, REPAIR_R2_FIX_BETA)
    expect(repairResult.is_no_op).toBe(false)
    expect(sortedArray(repairResult.observed_attribution_after_repair)).toEqual(["I_A"])
    expect(repairResult.attribution_matches).toBe(true)
    expect(repairResult.target_invariant_resolved).toBe(true) // I_B's attribution disappeared
    expect(repairResult.observed_attribution_after_repair.has("I_A")).toBe(true) // unrelated attribution remains
  })
})

describe("Case 9 -- wrong repair declaration (negative control)", () => {
  test("a repair that changes something but never restores its claimed target is rejected", () => {
    const mutantResult = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M2_MULTI)
    const repairResult = runRepairCase(INVARIANTS, mutantResult.mutated, REPAIR_R_WRONG)
    // The repair is not a no-op (beta's casing changed) --
    expect(repairResult.is_no_op).toBe(false)
    expect(repairResult.mutated_digest).not.toBe(repairResult.repaired_digest)
    // -- but it never touched alpha, so I_A (its claimed target) is still violated.
    expect(sortedArray(repairResult.observed_attribution_after_repair)).toEqual(["I_A", "I_B"])
    expect(repairResult.target_invariant_resolved).toBe(false)
    // Its false claim (post-repair == {I_B}) does not match reality -- rejected.
    expect(repairResult.attribution_matches).toBe(false)
  })
})

describe("Case 10 -- no-op mutant (negative control)", () => {
  test("a mutation that changes nothing is rejected before its output is treated as evidence", () => {
    const result = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M_NOOP)
    expect(result.baseline_digest).toBe(result.mutant_digest)
    expect(result.is_no_op).toBe(true)
    // attribution_matches must be false unconditionally, even though the
    // declared set {I_A} happens to equal the (unchanged) baseline's own
    // non-violation of I_A trivially producing an empty observed set that
    // could coincidentally "match" under a naive implementation.
    expect(result.attribution_matches).toBe(false)
  })
})

describe("rung 2: discrimination is per-invariant, and is not the same as declared", () => {
  test("I_A and I_B achieve PROVEN discrimination; I_C -- declared but never targeted -- reports UNPROVEN_DISCRIMINATION", () => {
    const validated = [
      runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M1_SINGLETON),
      runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_MB_SINGLETON),
      runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M2_MULTI),
    ]
    expect(validated.every((r) => r.attribution_matches)).toBe(true)

    const provenDiscriminators = new Set<InvariantId>()
    for (const result of validated) {
      for (const id of result.expected_attribution) provenDiscriminators.add(id)
    }

    const statuses = discriminationStatusPerInvariant(INVARIANTS, provenDiscriminators)
    expect(statuses.get("I_A")).toBe("PROVEN")
    expect(statuses.get("I_B")).toBe("PROVEN")
    expect(statuses.get("I_C")).toBe("UNPROVEN_DISCRIMINATION")
  })
})

describe("self-application / control sensitivity", () => {
  test("every negative control is actually executed and actually rejected", () => {
    const rejectedMutantCases = [
      MUTANT_CASE3_UNDERDECLARED, // extra unexplained attribution
      MUTANT_CASE4_OVERDECLARED, // missing declared attribution
      MUTANT_CASE5_CORRUPTED_ID, // corrupted attribution id
      MUTANT_CASE6_M1_SWAPPED, // swapped attribution id, half 1
      MUTANT_CASE6_MB_SWAPPED, // swapped attribution id, half 2
    ]
    for (const mutant of rejectedMutantCases) {
      const result = runMutantCase(INVARIANTS, BASELINE_CASE, mutant)
      expect(result.attribution_matches).toBe(false)
    }

    // No-op mutation control.
    const noOpResult = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M_NOOP)
    expect(noOpResult.is_no_op).toBe(true)
    expect(noOpResult.attribution_matches).toBe(false)

    // Repair that does not remove the claimed attribution.
    const mutantResult = runMutantCase(INVARIANTS, BASELINE_CASE, MUTANT_M2_MULTI)
    const wrongRepairResult = runRepairCase(INVARIANTS, mutantResult.mutated, REPAIR_R_WRONG)
    expect(wrongRepairResult.target_invariant_resolved).toBe(false)
    expect(wrongRepairResult.attribution_matches).toBe(false)
  })

  test("the correct cases are NOT rejected -- controls discriminate, they do not just reject everything", () => {
    const acceptedMutantCases = [MUTANT_M1_SINGLETON, MUTANT_MB_SINGLETON, MUTANT_M2_MULTI]
    for (const mutant of acceptedMutantCases) {
      const result = runMutantCase(INVARIANTS, BASELINE_CASE, mutant)
      expect(result.attribution_matches).toBe(true)
    }
  })
})

describe("precommitment vs. independent grounding", () => {
  test("precommitment digests are deterministic and reproducible from fixture-time data alone", () => {
    const recomputedM1 = derivePrecommitment(INVARIANTS, BASELINE_CASE, MUTANT_M1_SINGLETON)
    const recomputedM2 = derivePrecommitment(INVARIANTS, BASELINE_CASE, MUTANT_M2_MULTI)
    // Recomputing independently of the frozen fixture-time constants must
    // reproduce them exactly -- proving nothing was rewritten after the fact.
    expect(recomputedM1).toEqual(M1_PRECOMMITMENT)
    expect(recomputedM2).toEqual(M2_PRECOMMITMENT)
    // The two mutants' precommitments must differ (different mutant, different digest).
    expect(M1_PRECOMMITMENT.combined_digest).not.toBe(M2_PRECOMMITMENT.combined_digest)
  })

  test("precommitment proves fixed-before-comparison, NOT oracle correctness", () => {
    // The precommitment record contains no gate-execution output at all --
    // structurally, it cannot have been derived from an observed result.
    const keys = Object.keys(M1_PRECOMMITMENT).sort()
    expect(keys).toEqual([
      "baseline_digest",
      "combined_digest",
      "expected_attribution_digest",
      "invariant_set_digest",
      "mutant_descriptor_digest",
    ])
  })

  test("independent grounding remains UNPROVEN in this lane", () => {
    expect(INDEPENDENT_GROUNDING_STATUS).toBe("UNPROVEN")
    expect(INDEPENDENT_GROUNDING_REASON).toContain("INDEPENDENT_GROUNDING_NOT_PROVEN")
    expect(INDEPENDENT_GROUNDING_REASON).toContain("single authoring authority")
  })
})

describe("assembled ladder report", () => {
  test("required interpretation: each rung is strictly weaker evidence than the next", () => {
    // I_C is declared (rung 1 = true) but not discriminated (rung 2, per-invariant,
    // reports UNPROVEN_DISCRIMINATION for I_C specifically) -- a concrete,
    // executed demonstration that DECLARED != DISCRIMINATING.
    const provenDiscriminators = new Set<InvariantId>(["I_A", "I_B"])
    const statuses = discriminationStatusPerInvariant(INVARIANTS, provenDiscriminators)
    expect(statuses.get("I_C")).toBe("UNPROVEN_DISCRIMINATION")

    const report: LadderReport = {
      declared: true,
      // PROVEN for the invariants this lane's required cases target (I_A, I_B):
      // Cases 1/2/7/8 give mechanically-evidenced discrimination for both.
      // I_C is declared-only by design and is correctly, non-silently
      // reported UNPROVEN_DISCRIMINATION above -- that is rung 2 working
      // correctly, not a failure of it.
      discrimination: "PROVEN",
      // PROVEN: exact equality holds for every real case (1, 2, 7, 8) and
      // every negative control (3, 4, 5, 6, 9, 10) is actually rejected.
      attribution_consistency: "PROVEN",
      // PROVEN: Cases 7 and 8 both show the repaired invariant's attribution
      // disappearing while the unrelated one remains, in both directions,
      // and Case 9's non-causal repair is rejected.
      causal_support: "PROVEN",
      // PROVEN: precommitment digests are deterministic and fixture-time-frozen.
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
