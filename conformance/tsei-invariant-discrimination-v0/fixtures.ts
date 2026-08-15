/**
 * Generic, synthetic fixtures for the invariant discrimination / attribution
 * conformance ladder. No Chronicle, ReceiptOS, IPFS, ENS, SCITT, or registry
 * semantics appear here -- the scenario is a plain three-field record with
 * three independent invariants, deliberately shaped so the required test
 * cases can be built without inventing domain meaning.
 *
 * GenericCase = { alpha: number, beta: string, gamma: number[] }
 *   I_A: alpha is non-negative
 *   I_B: beta does not contain the forbidden marker substring "FORBIDDEN"
 *   I_C: gamma is strictly increasing
 *
 * I_C is declared but deliberately never targeted by any mutant below. This
 * is intentional, not an oversight: it is this lane's own concrete proof
 * that "declared" and "discriminating" are different rungs (see
 * ladder.ts's discriminationStatusPerInvariant and the test file's
 * assertion that I_C reports UNPROVEN_DISCRIMINATION).
 */

import { derivePrecommitment, type GenericCase, type Invariant, type MutantDescriptor, type RepairDescriptor } from "./model"

function isStrictlyIncreasing(xs: readonly number[]): boolean {
  for (let i = 1; i < xs.length; i++) {
    if (!(xs[i] > xs[i - 1])) return false
  }
  return true
}

export const INVARIANT_A: Invariant = {
  invariant_id: "I_A",
  description: "alpha is non-negative",
  predicate: (value) => value.alpha >= 0,
}

export const INVARIANT_B: Invariant = {
  invariant_id: "I_B",
  description: 'beta does not contain the forbidden marker substring "FORBIDDEN"',
  predicate: (value) => !value.beta.includes("FORBIDDEN"),
}

export const INVARIANT_C: Invariant = {
  invariant_id: "I_C",
  description: "gamma is strictly increasing",
  predicate: (value) => isStrictlyIncreasing(value.gamma),
}

/** Declared invariant set. Stable ids: I_A, I_B, I_C. */
export const INVARIANTS: readonly Invariant[] = [INVARIANT_A, INVARIANT_B, INVARIANT_C]

/** Satisfies I_A, I_B, and I_C. */
export const BASELINE_CASE: GenericCase = {
  alpha: 5,
  beta: "clean-value",
  gamma: [1, 2, 3],
}

const FORBIDDEN_BETA = "this text is FORBIDDEN here"

// --- Positive mutants (real, correctly-declared discrimination evidence) ---

/** Case 1: singleton discrimination. Breaks only I_A. */
export const MUTANT_M1_SINGLETON: MutantDescriptor = {
  mutant_id: "M1_singleton_break_alpha",
  description: "Sets alpha to a negative value; beta and gamma are left untouched.",
  rationale: "Isolates I_A: Case 1 (singleton discrimination) requires a mutant that breaks exactly one declared invariant.",
  mutate: (baseline) => ({ ...baseline, alpha: -1 }),
  expected_attribution: new Set(["I_A"]),
  has_counterfactual_repair: false,
}

/**
 * Helper mutant: breaks only I_B. Not one of the ten numbered cases by
 * itself, but required to build the Case 6 swapped-attribution-ID control
 * (a swap needs two distinct real singleton mutants to swap labels between).
 */
export const MUTANT_MB_SINGLETON: MutantDescriptor = {
  mutant_id: "MB_singleton_break_beta",
  description: "Sets beta to a string containing the forbidden marker; alpha and gamma are left untouched.",
  rationale: "Isolates I_B; paired with M1 to build the Case 6 swapped-attribution-ID control.",
  mutate: (baseline) => ({ ...baseline, beta: FORBIDDEN_BETA }),
  expected_attribution: new Set(["I_B"]),
  has_counterfactual_repair: false,
}

/** Case 2: legitimate multi-attribution. Breaks I_A and I_B together. */
export const MUTANT_M2_MULTI: MutantDescriptor = {
  mutant_id: "M2_multi_break_alpha_beta",
  description: "Sets alpha to a negative value and beta to a string containing the forbidden marker; gamma is left untouched.",
  rationale:
    "Proves attribution is a set, not a singleton assumption: one mutant that legitimately breaks two declared " +
    "invariants at once. Also the base mutant for the Case 7/8/9 counterfactual-repair cases.",
  mutate: (baseline) => ({ ...baseline, alpha: -1, beta: FORBIDDEN_BETA }),
  expected_attribution: new Set(["I_A", "I_B"]),
  has_counterfactual_repair: true,
}

/** Case 10: no-op mutant. Declares a mutation but changes nothing. */
export const MUTANT_M_NOOP: MutantDescriptor = {
  mutant_id: "M_noop_identity",
  description: "Declares itself a mutation but its mutate function returns a value structurally identical to the baseline.",
  rationale:
    "A mutation descriptor that does not actually change its input must be rejected as NO_OP_MUTANT before its " +
    "gate output is ever treated as discrimination evidence, regardless of what it declares.",
  mutate: (baseline) => ({ ...baseline }),
  // Deliberately a plausible-looking declaration; the harness must never reach the point of consulting it.
  expected_attribution: new Set(["I_A"]),
  has_counterfactual_repair: false,
}

// --- Negative-control mutants (the harness must reject every one of these) ---

/** Case 3: unexpected extra attribution. Real mutation breaks {I_A, I_B}; declares only {I_A}. */
export const MUTANT_CASE3_UNDERDECLARED: MutantDescriptor = {
  mutant_id: "M_case3_underdeclared_extra_observed",
  description: "Reuses M2's real mutation (which truly breaks I_A and I_B) but declares only {I_A} as expected attribution.",
  rationale:
    "Negative control for Case 3: observed attribution ({I_A, I_B}) contains an invariant absent from the " +
    "declared set ({I_A}). The harness must reject this as unexplained/extra attribution.",
  mutate: MUTANT_M2_MULTI.mutate,
  expected_attribution: new Set(["I_A"]),
  has_counterfactual_repair: false,
}

/** Case 4: missing attribution. Real mutation breaks only {I_A}; declares {I_A, I_B}. */
export const MUTANT_CASE4_OVERDECLARED: MutantDescriptor = {
  mutant_id: "M_case4_overdeclared_missing_observed",
  description: "Reuses M1's real mutation (which truly breaks only I_A) but declares {I_A, I_B} as expected attribution.",
  rationale:
    "Negative control for Case 4: the declared set names I_B, which never appears in observed attribution. " +
    "The harness must reject this as missing declared attribution.",
  mutate: MUTANT_M1_SINGLETON.mutate,
  expected_attribution: new Set(["I_A", "I_B"]),
  has_counterfactual_repair: false,
}

/** Case 5: corrupted attribution identity. Real mutation and predicate behavior untouched; only the declared id is wrong. */
export const MUTANT_CASE5_CORRUPTED_ID: MutantDescriptor = {
  mutant_id: "M_case5_corrupted_attribution_id",
  description:
    "Reuses M1's real mutation (which truly breaks only I_A) but declares the attribution under the identity " +
    '"I_X", which names no real invariant.',
  rationale:
    "Negative control for Case 5: predicates are untouched, only the declared attribution label is corrupted. " +
    "The harness must reject on set-identity mismatch, independent of predicate behavior.",
  mutate: MUTANT_M1_SINGLETON.mutate,
  expected_attribution: new Set(["I_X"]),
  has_counterfactual_repair: false,
}

/** Case 6, half A: swaps M1's declared attribution with MB's real invariant id. */
export const MUTANT_CASE6_M1_SWAPPED: MutantDescriptor = {
  mutant_id: "M_case6_m1_swapped_id",
  description: "Reuses M1's real mutation (breaks only I_A) but declares the attribution as {I_B} -- swapped with MB's label.",
  rationale:
    "Negative control for Case 6 (half 1 of 2): underlying predicate behavior is unchanged; only the attribution " +
    "identity is swapped with a different real invariant's id.",
  mutate: MUTANT_M1_SINGLETON.mutate,
  expected_attribution: new Set(["I_B"]),
  has_counterfactual_repair: false,
}

/** Case 6, half B: swaps MB's declared attribution with M1's real invariant id. */
export const MUTANT_CASE6_MB_SWAPPED: MutantDescriptor = {
  mutant_id: "M_case6_mb_swapped_id",
  description: "Reuses MB's real mutation (breaks only I_B) but declares the attribution as {I_A} -- swapped with M1's label.",
  rationale:
    "Negative control for Case 6 (half 2 of 2): underlying predicate behavior is unchanged; only the attribution " +
    "identity is swapped with a different real invariant's id.",
  mutate: MUTANT_MB_SINGLETON.mutate,
  expected_attribution: new Set(["I_A"]),
  has_counterfactual_repair: false,
}

// --- Counterfactual repairs, both built from MUTANT_M2_MULTI's mutated value ---

/** Case 7: repair only I_A. I_A's attribution must disappear; I_B's must remain. */
export const REPAIR_R1_FIX_ALPHA: RepairDescriptor = {
  repair_id: "R1_fix_alpha",
  mutant_id: MUTANT_M2_MULTI.mutant_id,
  target_invariant_id: "I_A",
  repair: (mutated) => ({ ...mutated, alpha: 5 }),
  expected_attribution_after_repair: new Set(["I_B"]),
}

/** Case 8: repair only I_B (the other direction, same source mutant). I_B disappears; I_A remains. */
export const REPAIR_R2_FIX_BETA: RepairDescriptor = {
  repair_id: "R2_fix_beta",
  mutant_id: MUTANT_M2_MULTI.mutant_id,
  target_invariant_id: "I_B",
  repair: (mutated) => ({ ...mutated, beta: "clean-again" }),
  expected_attribution_after_repair: new Set(["I_A"]),
}

/**
 * Case 9: wrong repair declaration. Changes something (beta's casing, so
 * it is not a no-op) but never touches alpha, so it does not causally
 * restore its claimed target (I_A). Falsely claims the post-repair
 * attribution is {I_B}.
 */
export const REPAIR_R_WRONG: RepairDescriptor = {
  repair_id: "R_wrong_claims_alpha_fix",
  mutant_id: MUTANT_M2_MULTI.mutant_id,
  target_invariant_id: "I_A",
  repair: (mutated) => ({ ...mutated, beta: mutated.beta.toUpperCase() }),
  expected_attribution_after_repair: new Set(["I_B"]),
}

// --- Eagerly-computed precommitment records (frozen at fixture-declaration ---
// --- time, i.e. before any test in this lane runs the gate). ---

export const M1_PRECOMMITMENT = derivePrecommitment(INVARIANTS, BASELINE_CASE, MUTANT_M1_SINGLETON)
export const M2_PRECOMMITMENT = derivePrecommitment(INVARIANTS, BASELINE_CASE, MUTANT_M2_MULTI)
