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
  remapAttribution,
  setDifference,
  setsEqual,
  sortedArray,
  type GenericCase,
  type IdentityRemap,
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

/**
 * Rung 2 is deliberately NOT a single RungStatus field here. A bare
 * `discrimination: "PROVEN"` would silently imply every declared invariant
 * discriminates, which is exactly the false "covered" claim rung 2 exists
 * to prevent (see fixtures.ts's I_C, which is declared but never
 * discriminated by design). LadderReport therefore carries the actual
 * per-invariant result of discriminationStatusPerInvariant() -- callers
 * must not collapse it into a single aggregate.
 */
export type LadderReport = {
  readonly declared: boolean
  readonly discrimination_per_invariant: ReadonlyMap<InvariantId, DiscriminationStatus>
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
  /** Invariants violated on the baseline, BEFORE mutation. */
  readonly baseline_attribution: ReadonlySet<InvariantId>
  /** Invariants violated on the mutated value. */
  readonly mutated_attribution: ReadonlySet<InvariantId>
  /** In mutated_attribution but NOT in baseline_attribution -- the only invariants this mutant can be discrimination evidence for. */
  readonly newly_violated: ReadonlySet<InvariantId>
  /** In baseline_attribution but NOT in mutated_attribution (informational; a mutation can also repair something incidentally). */
  readonly no_longer_violated: ReadonlySet<InvariantId>
  readonly expected_attribution: ReadonlySet<InvariantId>
  /** Exact-set consistency between mutated_attribution and expected_attribution. False whenever is_no_op is true. */
  readonly attribution_matches: boolean
  readonly extra: readonly InvariantId[]
  readonly missing: readonly InvariantId[]
  readonly mutated: GenericCase
}

/**
 * Runs one mutant case end to end: applies the mutation, records
 * effectiveness digests, evaluates the gate on BOTH the baseline and the
 * mutated value, and compares mutated attribution against the declared set
 * A_i by EXACT equality (never subset, never "something failed somewhere").
 *
 * A no-op mutation (baseline_digest === mutant_digest) forces
 * attribution_matches to false unconditionally.
 *
 * Discrimination evidence is NOT this function's `expected_attribution` --
 * it is `newly_violated` (see discriminationEvidence below), because an
 * invariant already violated on the baseline and left violated by a
 * mutation was never actually shown to be flipped by that mutation, no
 * matter what the mutant declares.
 */
export function runMutantCase(
  invariants: readonly Invariant[],
  baseline: GenericCase,
  mutant: MutantDescriptor,
): MutantCaseResult {
  const application = applyMutation(baseline, mutant)
  const baseline_attribution = evaluateViolations(invariants, baseline)
  const mutated_attribution = evaluateViolations(invariants, application.mutated)
  const newly_violated = setDifference(mutated_attribution, baseline_attribution)
  const no_longer_violated = setDifference(baseline_attribution, mutated_attribution)
  const expected_attribution = mutant.expected_attribution
  const attribution_matches = !application.is_no_op && setsEqual(mutated_attribution, expected_attribution)
  const extra = sortedArray(mutated_attribution).filter((id) => !expected_attribution.has(id))
  const missing = sortedArray(expected_attribution).filter((id) => !mutated_attribution.has(id))
  return {
    mutant_id: mutant.mutant_id,
    is_no_op: application.is_no_op,
    baseline_digest: application.baseline_digest,
    mutant_digest: application.mutant_digest,
    baseline_attribution,
    mutated_attribution,
    newly_violated,
    no_longer_violated,
    expected_attribution,
    attribution_matches,
    extra,
    missing,
    mutated: application.mutated,
  }
}

/**
 * The actual discrimination evidence a validated mutant case contributes:
 * its newly_violated set, but ONLY if the case is validated (effective and
 * attribution-consistent). Deliberately NOT `result.expected_attribution`
 * -- discrimination must be derived from the observed baseline->mutant
 * transition, never merely from what was declared.
 */
export function discriminationEvidence(result: MutantCaseResult): ReadonlySet<InvariantId> {
  return result.attribution_matches ? result.newly_violated : new Set<InvariantId>()
}

export type EmissionCorruptedResult = {
  readonly mutant_id: MutantId
  readonly is_no_op: boolean
  /** The real, uncorrupted attribution the predicates actually produced. */
  readonly true_mutated_attribution: ReadonlySet<InvariantId>
  /** The same set with only its identities remapped -- predicates untouched. */
  readonly corrupted_emitted_attribution: ReadonlySet<InvariantId>
  readonly expected_attribution: ReadonlySet<InvariantId>
  readonly attribution_matches: boolean
}

/**
 * Output-side attribution corruption/swap control. Runs the mutation and
 * evaluates the REAL predicates exactly as runMutantCase does (predicate
 * behavior and the declared oracle are both untouched), then corrupts only
 * the emitted attribution's identities before comparing against the
 * (unchanged) declared expected_attribution.
 *
 * This is deliberately distinct from Cases 5/6 in fixtures.ts, which
 * corrupt the DECLARED oracle side. This function corrupts the emitted/
 * observed side instead -- modeling a gate whose predicate logic is
 * correct but whose reporting/labeling layer lies about what it saw.
 */
export function runMutantCaseWithCorruptedEmission(
  invariants: readonly Invariant[],
  baseline: GenericCase,
  mutant: MutantDescriptor,
  emissionRemap: IdentityRemap,
): EmissionCorruptedResult {
  const application = applyMutation(baseline, mutant)
  const true_mutated_attribution = evaluateViolations(invariants, application.mutated)
  const corrupted_emitted_attribution = remapAttribution(true_mutated_attribution, emissionRemap)
  const attribution_matches = !application.is_no_op && setsEqual(corrupted_emitted_attribution, mutant.expected_attribution)
  return {
    mutant_id: mutant.mutant_id,
    is_no_op: application.is_no_op,
    true_mutated_attribution,
    corrupted_emitted_attribution,
    expected_attribution: mutant.expected_attribution,
    attribution_matches,
  }
}

export type RepairCaseResult = {
  readonly repair_id: RepairId
  readonly is_no_op: boolean
  readonly mutated_digest: string
  readonly repaired_digest: string
  /** Invariants violated on the pre-repair (mutated) value. */
  readonly attribution_before_repair: ReadonlySet<InvariantId>
  /** Invariants violated on the post-repair value. */
  readonly attribution_after_repair: ReadonlySet<InvariantId>
  /** In attribution_before_repair but NOT attribution_after_repair. */
  readonly removed_attribution: ReadonlySet<InvariantId>
  /** In attribution_after_repair but NOT attribution_before_repair -- any side effect. */
  readonly added_attribution: ReadonlySet<InvariantId>
  readonly expected_attribution_after_repair: ReadonlySet<InvariantId>
  /**
   * Authored-set consistency ONLY: does the post-repair attribution equal
   * what the repair descriptor claims? This is a secondary, weaker check --
   * see causally_supported for the actual causal claim. A repair can have
   * attribution_matches === true while causally_supported === false (see
   * fixtures.ts's REPAIR_CASE_A/B/C negative controls, each constructed so
   * the authored claim happens to match reality yet the repair is not
   * actually causally correct).
   */
  readonly attribution_matches: boolean
  readonly target_was_violated_before: boolean
  /**
   * The real causal check. True only when: the repair is effective (not a
   * no-op), the declared target invariant was actually violated before the
   * repair, exactly that one invariant's attribution was removed, and no
   * new attribution was introduced as a side effect.
   */
  readonly causally_supported: boolean
}

/**
 * Runs one counterfactual repair and evaluates attribution on BOTH the
 * pre-repair (mutated) value and the post-repair value, so causal support
 * can be derived from the actual observed delta rather than from the
 * repair descriptor's own authored claim.
 */
export function runRepairCase(
  invariants: readonly Invariant[],
  mutated: GenericCase,
  repair: RepairDescriptor,
): RepairCaseResult {
  const application = applyRepair(mutated, repair)
  const attribution_before_repair = evaluateViolations(invariants, mutated)
  const attribution_after_repair = evaluateViolations(invariants, application.repaired)
  const removed_attribution = setDifference(attribution_before_repair, attribution_after_repair)
  const added_attribution = setDifference(attribution_after_repair, attribution_before_repair)
  const expected_attribution_after_repair = repair.expected_attribution_after_repair
  const attribution_matches =
    !application.is_no_op && setsEqual(attribution_after_repair, expected_attribution_after_repair)
  const target_was_violated_before = attribution_before_repair.has(repair.target_invariant_id)
  const causally_supported =
    !application.is_no_op &&
    target_was_violated_before &&
    setsEqual(removed_attribution, new Set([repair.target_invariant_id])) &&
    added_attribution.size === 0
  return {
    repair_id: repair.repair_id,
    is_no_op: application.is_no_op,
    mutated_digest: application.mutated_digest,
    repaired_digest: application.repaired_digest,
    attribution_before_repair,
    attribution_after_repair,
    removed_attribution,
    added_attribution,
    expected_attribution_after_repair,
    attribution_matches,
    target_was_violated_before,
    causally_supported,
  }
}

/**
 * Rung 2 (DISCRIMINATING), per invariant. `provenDiscriminators` must be
 * built from discriminationEvidence(result) (the observed newly_violated
 * transition of validated cases) -- never from a mutant's declared
 * expected_attribution directly. An invariant absent from that union is
 * declared but never actually shown to flip any evaluation outcome, and
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
 * A_i were all authored by the same party that wrote this harness -- and,
 * as of the precommitment repair, the same party that built and pushed the
 * precommitment manifest anchor too. A genuine pushed-commit anchor proves
 * fixture identity was fixed before comparison (see precommitment-manifest.json);
 * it does not, and cannot, prove A_i is the objectively correct oracle,
 * because the anchor and the oracle share an author. See README.md's
 * Oracle Boundary section. This constant must not be flipped to PROVEN
 * without a genuinely separate oracle authority (independent human
 * reviewer, separately authored predicate implementation, or independently
 * frozen conformance artifact) actually existing outside this authoring
 * context -- never by introducing a second in-session persona and calling
 * that independence.
 */
export const INDEPENDENT_GROUNDING_STATUS: RungStatus = "UNPROVEN"

export const INDEPENDENT_GROUNDING_REASON =
  "INDEPENDENT_GROUNDING_NOT_PROVEN: the invariant/mutant/expected-attribution " +
  "fixtures, the harness that checks them, and the precommitment manifest anchor " +
  "all share a single authoring authority in this lane. Exact set equality, " +
  "counterfactual repair evidence, and a genuine pushed-commit precommitment " +
  "anchor prove internal consistency, causal structure, and fixed-before-comparison " +
  "identity respectively -- none of them prove that the expected attribution sets " +
  "A_i are independently correct. Proving this rung requires a separately derived " +
  "oracle -- independent human review, a separately authored predicate " +
  "implementation, or an independently frozen conformance artifact -- none of " +
  "which is used or simulated here."
