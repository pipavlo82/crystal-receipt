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

import type { GenericCase, IdentityRemap, Invariant, MutantDescriptor, RepairDescriptor } from "./model"

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

/**
 * Baseline variant that already violates I_A on its own (alpha starts
 * negative). Exists only to build MUTANT_CASE_NO_TRANSITION below; the
 * shared BASELINE_CASE above satisfies all three invariants and is used
 * everywhere else.
 */
export const BASELINE_ALREADY_VIOLATING_A: GenericCase = {
  alpha: -1,
  beta: "clean-value",
  gamma: [1, 2, 3],
}

/**
 * Discrimination negative control: mutation changes input (alpha -1 -> -5,
 * so it is not a no-op), I_A was ALREADY violated on the baseline, and I_A
 * REMAINS violated after mutation -- no baseline->mutant transition ever
 * occurs for I_A. Declares {I_A} anyway, which happens to make
 * attribution_matches true (mutated_attribution == {I_A} == declared) --
 * that is deliberate: this fixture proves attribution-consistency alone is
 * not sufficient evidence of discrimination. newly_violated must be empty,
 * and this mutant must contribute nothing to any invariant's proven-
 * discriminator set. Must be run against BASELINE_ALREADY_VIOLATING_A, not
 * the shared BASELINE_CASE.
 */
export const MUTANT_CASE_NO_TRANSITION: MutantDescriptor = {
  mutant_id: "M_no_transition_already_violated",
  description: "Changes alpha from one negative value to another; I_A was already violated before the change and stays violated after it.",
  rationale:
    "Negative control for rung 2 (discrimination): an invariant that never flips from holding to violated is not " +
    "discriminated by this mutant, even though its declared attribution happens to equal the observed attribution " +
    "both before and after. Must be run against BASELINE_ALREADY_VIOLATING_A.",
  mutate: (baseline) => ({ ...baseline, alpha: -5 }),
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

/**
 * Case 5: ORACLE-SIDE corrupted attribution identity -- the DECLARED set is
 * corrupted, not the emitted/observed one. Real mutation and predicate
 * behavior untouched; only the declared id is wrong. This is distinct from,
 * and must not be conflated with, the OUTPUT-side corruption controls
 * (EMISSION_CORRUPTION_ID_SUBSTITUTION / EMISSION_CORRUPTION_SWAP_AB below),
 * which corrupt what the gate emits while leaving the declared oracle alone.
 */
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

/**
 * Case 6, ORACLE-SIDE swap: swaps the DECLARED attribution identities.
 * See the output-side swap control (EMISSION_CORRUPTION_SWAP_AB below) for
 * the distinct case where predicates and declarations are both untouched
 * and only what the gate emits is swapped.
 *
 * Half A: swaps M1's declared attribution with MB's real invariant id.
 */
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

/**
 * OUTPUT-side corruption control A: predicate I_A is unchanged, M1's
 * mutation is unchanged, and the declared A_i remains {I_A} unchanged.
 * Only the identity the gate EMITS is corrupted, via remapAttribution, to
 * "I_X" -- modeling a gate whose evaluation logic is correct but whose
 * reporting layer mislabels its own output. Used with
 * runMutantCaseWithCorruptedEmission(INVARIANTS, BASELINE_CASE,
 * MUTANT_M1_SINGLETON, EMISSION_CORRUPTION_ID_SUBSTITUTION).
 */
export const EMISSION_CORRUPTION_ID_SUBSTITUTION: IdentityRemap = new Map([["I_A", "I_X"]])

/**
 * OUTPUT-side corruption control B: I_A and I_B predicates are unchanged,
 * M1 and MB's mutations are unchanged, and both declared expected sets
 * ({I_A} and {I_B} respectively) are unchanged. Only the emitted
 * identities are swapped. Used with both MUTANT_M1_SINGLETON and
 * MUTANT_MB_SINGLETON via runMutantCaseWithCorruptedEmission -- the
 * harness must reject both resulting cases.
 */
export const EMISSION_CORRUPTION_SWAP_AB: IdentityRemap = new Map([
  ["I_A", "I_B"],
  ["I_B", "I_A"],
])

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

// --- Causal negative controls (all built from MUTANT_M2_MULTI's mutated ---
// --- value, {I_A, I_B} violated). Each is deliberately constructed so its  ---
// --- authored expected_attribution_after_repair matches the REAL post-    ---
// --- repair outcome exactly (attribution_matches would be true), yet the  ---
// --- repair is not actually causally correct -- proving causally_supported ---
// --- is doing real work beyond the authored-set check. ---

/**
 * Causal control A: claims to repair I_C, but I_C was never violated by
 * MUTANT_M2_MULTI in the first place (only alpha/beta are touched; gamma,
 * and therefore I_C, is untouched and holds throughout). The repair itself
 * only fixes alpha (a real, effective change) -- post-repair attribution is
 * genuinely {I_B}, exactly matching the authored claim, but claiming to
 * have "repaired I_C" is false because I_C was never broken. Must fail on
 * target_was_violated_before.
 */
export const REPAIR_CASE_A_NEVER_VIOLATED: RepairDescriptor = {
  repair_id: "R_case_a_target_never_violated",
  mutant_id: MUTANT_M2_MULTI.mutant_id,
  target_invariant_id: "I_C",
  repair: (mutated) => ({ ...mutated, alpha: 5 }),
  expected_attribution_after_repair: new Set(["I_B"]),
}

/**
 * Causal control B: claims to repair only I_A, but the repair function
 * actually fixes both alpha AND beta -- removing I_B's attribution too,
 * which was never declared as this repair's target. Post-repair
 * attribution is genuinely empty, exactly matching the authored claim, but
 * removed_attribution is {I_A, I_B}, not the declared singleton {I_A}.
 * Must fail on the exact-singleton-removal check.
 */
export const REPAIR_CASE_B_OVERREACH: RepairDescriptor = {
  repair_id: "R_case_b_overreach",
  mutant_id: MUTANT_M2_MULTI.mutant_id,
  target_invariant_id: "I_A",
  repair: (mutated) => ({ ...mutated, alpha: 5, beta: "clean-again" }),
  expected_attribution_after_repair: new Set([]),
}

/**
 * Causal control C: claims to repair only I_A, and it genuinely does
 * remove I_A's attribution -- but it also reverses gamma as a side effect,
 * newly violating I_C. Post-repair attribution is genuinely {I_B, I_C},
 * exactly matching the authored claim, but added_attribution is {I_C}, a
 * side effect the repair never declared. Must fail on the
 * no-side-effects check.
 */
export const REPAIR_CASE_C_SIDE_EFFECT: RepairDescriptor = {
  repair_id: "R_case_c_side_effect",
  mutant_id: MUTANT_M2_MULTI.mutant_id,
  target_invariant_id: "I_A",
  repair: (mutated) => ({ ...mutated, alpha: 5, gamma: [3, 2, 1] }),
  expected_attribution_after_repair: new Set(["I_B", "I_C"]),
}
