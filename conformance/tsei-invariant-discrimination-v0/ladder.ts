/**
 * Evidence-ladder mechanics: declared -> discriminating ->
 * attribution-consistent -> causally-supported -> independently-grounded.
 *
 * These are conformance-methodology statuses for THIS lane only. They are
 * not TSEI runtime verdicts and must never be confused with, or mapped
 * onto, the five-outcome verdict vocabulary (stable / history_sensitive /
 * violation / out_of_domain / unresolved) defined in Section 5 of
 * docs/TRANSFORMATION_STABLE_EVIDENCE_INTEROPERABILITY_V0.md.
 */

import {
  applyMutation,
  applyRepair,
  evaluateViolations,
  setsEqual,
  sortedArray,
  type GenericCase,
  type Invariant,
  type InvariantId,
  type MutantDescriptor,
  type MutantId,
  type RepairDescriptor,
  type RepairId,
} from "./model"

export type RungStatus = "PROVEN" | "UNPROVEN"

/** Per-invariant discrimination status (rung 2). Never silently "covered". */
export type DiscriminationStatus = "PROVEN" | "UNPROVEN_DISCRIMINATION"

export type LadderReport = {
  readonly declared: boolean
  readonly discrimination: RungStatus
  readonly attribution_consistency: RungStatus
  readonly causal_support: RungStatus
  readonly precommitment: RungStatus
  readonly independent_grounding: RungStatus
}

export type MutantCaseResult = {
  readonly mutant_id: MutantId
  readonly is_no_op: boolean
  readonly baseline_digest: string
  readonly mutant_digest: string
  readonly observed_attribution: ReadonlySet<InvariantId>
  readonly expected_attribution: ReadonlySet<InvariantId>
  /** false whenever is_no_op is true, regardless of set contents. */
  readonly attribution_matches: boolean
  readonly extra: readonly InvariantId[]
  readonly missing: readonly InvariantId[]
  readonly mutated: GenericCase
}

/**
 * Runs one mutant case end to end: applies the mutation, records
 * effectiveness digests, evaluates the gate, and compares observed
 * attribution against the declared set A_i by EXACT equality (never
 * subset, never "something failed somewhere").
 *
 * A no-op mutation (baseline_digest === mutant_digest) forces
 * attribution_matches to false unconditionally -- a mutation that changed
 * nothing must never be treated as discrimination evidence, even if its
 * declared set happens to equal the (unchanged) observed set.
 */
export function runMutantCase(
  invariants: readonly Invariant[],
  baseline: GenericCase,
  mutant: MutantDescriptor,
): MutantCaseResult {
  const application = applyMutation(baseline, mutant)
  const observed_attribution = evaluateViolations(invariants, application.mutated)
  const expected_attribution = mutant.expected_attribution
  const attribution_matches = !application.is_no_op && setsEqual(observed_attribution, expected_attribution)
  const extra = sortedArray(observed_attribution).filter((id) => !expected_attribution.has(id))
  const missing = sortedArray(expected_attribution).filter((id) => !observed_attribution.has(id))
  return {
    mutant_id: mutant.mutant_id,
    is_no_op: application.is_no_op,
    baseline_digest: application.baseline_digest,
    mutant_digest: application.mutant_digest,
    observed_attribution,
    expected_attribution,
    attribution_matches,
    extra,
    missing,
    mutated: application.mutated,
  }
}

export type RepairCaseResult = {
  readonly repair_id: RepairId
  readonly is_no_op: boolean
  readonly mutated_digest: string
  readonly repaired_digest: string
  readonly observed_attribution_after_repair: ReadonlySet<InvariantId>
  readonly expected_attribution_after_repair: ReadonlySet<InvariantId>
  readonly attribution_matches: boolean
  /** True iff the declared target_invariant_id is absent from observed post-repair attribution. */
  readonly target_invariant_resolved: boolean
}

/**
 * Runs one counterfactual repair: applies it to an already-mutated case,
 * and checks both (a) exact post-repair attribution-set equality against
 * the repair's own declared expectation, and (b) that the specific
 * declared target invariant's attribution actually disappeared. (b) is
 * what makes this a causal check rather than a label-agreement check: a
 * "repair" that changes something unrelated and happens to match a
 * mis-declared expected set would still fail (b).
 */
export function runRepairCase(
  invariants: readonly Invariant[],
  mutated: GenericCase,
  repair: RepairDescriptor,
): RepairCaseResult {
  const application = applyRepair(mutated, repair)
  const observed_attribution_after_repair = evaluateViolations(invariants, application.repaired)
  const attribution_matches =
    !application.is_no_op && setsEqual(observed_attribution_after_repair, repair.expected_attribution_after_repair)
  const target_invariant_resolved = !observed_attribution_after_repair.has(repair.target_invariant_id)
  return {
    repair_id: repair.repair_id,
    is_no_op: application.is_no_op,
    mutated_digest: application.mutated_digest,
    repaired_digest: application.repaired_digest,
    observed_attribution_after_repair,
    expected_attribution_after_repair: repair.expected_attribution_after_repair,
    attribution_matches,
    target_invariant_resolved,
  }
}

/**
 * Rung 2 (DISCRIMINATING), per invariant. `provenDiscriminators` is the
 * union of expected_attribution over mutant cases the caller has already
 * validated as effective (not no-op) and attribution-consistent
 * (attribution_matches === true). An invariant absent from that union is
 * declared but never actually shown to change any evaluation outcome, and
 * MUST report UNPROVEN_DISCRIMINATION -- it must never be silently folded
 * into an aggregate "covered" status.
 */
export function discriminationStatusPerInvariant(
  invariants: readonly Invariant[],
  provenDiscriminators: ReadonlySet<InvariantId>,
): ReadonlyMap<InvariantId, DiscriminationStatus> {
  const result = new Map<InvariantId, DiscriminationStatus>()
  for (const invariant of invariants) {
    result.set(invariant.invariant_id, provenDiscriminators.has(invariant.invariant_id) ? "PROVEN" : "UNPROVEN_DISCRIMINATION")
  }
  return result
}

/**
 * Rung 5. Always UNPROVEN in this lane by construction: the invariant
 * definitions, the mutant descriptors, and the expected attribution sets
 * A_i were all authored by the same party that wrote this harness. Exact
 * set-equality checks and counterfactual-repair evidence establish
 * internal consistency and causal structure; neither establishes that A_i
 * is the objectively correct oracle. See README.md's Oracle Boundary
 * section. This constant must not be flipped to PROVEN without a
 * genuinely separate oracle authority (independent human reviewer,
 * separately authored predicate implementation, or independently frozen
 * conformance artifact) actually existing outside this authoring context
 * -- never by introducing a second in-session persona and calling that
 * independence.
 */
export const INDEPENDENT_GROUNDING_STATUS: RungStatus = "UNPROVEN"

export const INDEPENDENT_GROUNDING_REASON =
  "INDEPENDENT_GROUNDING_NOT_PROVEN: the invariant/mutant/expected-attribution " +
  "fixtures and the harness that checks them share a single authoring authority " +
  "in this lane. Exact set equality and counterfactual repair evidence prove " +
  "internal consistency and causal structure, not that the expected attribution " +
  "sets A_i are independently correct. Proving this rung requires a separately " +
  "derived oracle -- independent human review, a separately authored predicate " +
  "implementation, or an independently frozen conformance artifact -- none of " +
  "which is used or simulated here."
