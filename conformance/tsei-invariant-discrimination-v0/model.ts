/**
 * Generic conformance-case model for the invariant discrimination /
 * attribution ladder (declared -> discriminating -> attribution-consistent
 * -> causally-supported -> independently-grounded).
 *
 * Everything here is purpose-built for this conformance lane. It is not a
 * redeclaration of, substitute for, or dependency on the Section 11
 * canonical-identity comparator (src/receiptos/challenge/canonical-identity-json.ts)
 * -- canonicalDigest below exists only for this lane's own mutation/repair
 * effectiveness bookkeeping and deliberately does not import that module.
 *
 * Fixtures (conformance-case bodies: invariants, mutants, repairs) are
 * synthetic and domain-neutral. Nothing here encodes Chronicle, ReceiptOS,
 * IPFS, ENS, SCITT, or registry semantics -- see fixtures.ts.
 */

import { createHash } from "node:crypto"

export type InvariantId = string
export type MutantId = string
export type RepairId = string

export type GenericCase = {
  readonly alpha: number
  readonly beta: string
  readonly gamma: readonly number[]
}

export type Invariant = {
  readonly invariant_id: InvariantId
  readonly description: string
  readonly predicate: (value: GenericCase) => boolean
}

export type MutantDescriptor = {
  readonly mutant_id: MutantId
  readonly description: string
  readonly rationale: string
  readonly mutate: (baseline: GenericCase) => GenericCase
  /** A_i -- the declared expected attribution set. Never assumed singleton. */
  readonly expected_attribution: ReadonlySet<InvariantId>
  readonly has_counterfactual_repair: boolean
}

export type RepairDescriptor = {
  readonly repair_id: RepairId
  readonly mutant_id: MutantId
  readonly target_invariant_id: InvariantId
  readonly repair: (mutated: GenericCase) => GenericCase
  readonly expected_attribution_after_repair: ReadonlySet<InvariantId>
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]"
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  const parts = keys.map((key) => JSON.stringify(key) + ":" + stableStringify(record[key]))
  return "{" + parts.join(",") + "}"
}

/**
 * A minimal structural-identity digest used only to prove a mutation or
 * repair actually changed its input (Section "MUTATION EFFECTIVENESS").
 * Deliberately independent of the TSEI Section 11 comparator.
 */
export function canonicalDigest(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex")
}

export function evaluateViolations(invariants: readonly Invariant[], value: GenericCase): ReadonlySet<InvariantId> {
  const violated = new Set<InvariantId>()
  for (const invariant of invariants) {
    if (!invariant.predicate(value)) violated.add(invariant.invariant_id)
  }
  return violated
}

export function setsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false
  for (const item of a) {
    if (!b.has(item)) return false
  }
  return true
}

export function sortedArray<T>(s: ReadonlySet<T>): T[] {
  return [...s].sort()
}

export type MutationApplication = {
  readonly mutated: GenericCase
  readonly baseline_digest: string
  readonly mutant_digest: string
  readonly is_no_op: boolean
}

/**
 * Applies a mutant's declared mutation procedure and records
 * baseline/mutant canonical digests. A mutation that leaves the digest
 * unchanged is a NO_OP_MUTANT -- callers must check `is_no_op` before
 * treating any resulting gate output as discrimination evidence.
 */
export function applyMutation(baseline: GenericCase, mutant: MutantDescriptor): MutationApplication {
  const mutated = mutant.mutate(baseline)
  const baseline_digest = canonicalDigest(baseline)
  const mutant_digest = canonicalDigest(mutated)
  return { mutated, baseline_digest, mutant_digest, is_no_op: baseline_digest === mutant_digest }
}

export type RepairApplication = {
  readonly repaired: GenericCase
  readonly mutated_digest: string
  readonly repaired_digest: string
  readonly is_no_op: boolean
}

/** Same effectiveness bookkeeping as applyMutation, for counterfactual repairs. */
export function applyRepair(mutated: GenericCase, repair: RepairDescriptor): RepairApplication {
  const repaired = repair.repair(mutated)
  const mutated_digest = canonicalDigest(mutated)
  const repaired_digest = canonicalDigest(repaired)
  return { repaired, mutated_digest, repaired_digest, is_no_op: mutated_digest === repaired_digest }
}

export type PrecommitmentRecord = {
  readonly invariant_set_digest: string
  readonly baseline_digest: string
  readonly mutant_descriptor_digest: string
  readonly expected_attribution_digest: string
  readonly combined_digest: string
}

/**
 * Freezes stable identities for the invariant set, the baseline case, the
 * mutant descriptor (including its mutate function's own source text, via
 * Function.prototype.toString, so a silent logic change is also digest-
 * visible), and the declared expected attribution set A_i.
 *
 * This proves PRECOMMITMENT only: that these values were fixed before a
 * gate result was compared against them. It does not, and cannot, prove
 * A_i was independently correct -- see ladder.ts's INDEPENDENT_GROUNDING
 * constant and conformance/tsei-invariant-discrimination-v0/README.md.
 */
export function derivePrecommitment(
  invariants: readonly Invariant[],
  baseline: GenericCase,
  mutant: MutantDescriptor,
): PrecommitmentRecord {
  const invariant_set_digest = deriveInvariantSetDigest(invariants)
  const baseline_digest = canonicalDigest(baseline)
  const mutant_descriptor_digest = deriveMutantDescriptorDigest(mutant)
  const expected_attribution_digest = deriveExpectedAttributionDigest(mutant.expected_attribution)
  const combined_digest = canonicalDigest({
    invariant_set_digest,
    baseline_digest,
    mutant_descriptor_digest,
    expected_attribution_digest,
  })
  return { invariant_set_digest, baseline_digest, mutant_descriptor_digest, expected_attribution_digest, combined_digest }
}

export function deriveInvariantSetDigest(invariants: readonly Invariant[]): string {
  const rows = [...invariants]
    .map((invariant) => ({
      invariant_id: invariant.invariant_id,
      description: invariant.description,
      predicate_source: invariant.predicate.toString(),
    }))
    .sort((a, b) => (a.invariant_id < b.invariant_id ? -1 : a.invariant_id > b.invariant_id ? 1 : 0))
  return canonicalDigest(rows)
}

export function deriveMutantDescriptorDigest(mutant: MutantDescriptor): string {
  return canonicalDigest({
    mutant_id: mutant.mutant_id,
    description: mutant.description,
    rationale: mutant.rationale,
    mutate_source: mutant.mutate.toString(),
  })
}

export function deriveExpectedAttributionDigest(expected: ReadonlySet<InvariantId>): string {
  return canonicalDigest(sortedArray(expected))
}
