/**
 * Independent-authority scaffold contracts (PR #201).
 *
 * Methodology only -- not TSEI runtime, not a change to the #200 ladder
 * results, and not production independent grounding.
 *
 * Four objects:
 *   A -- authority-visible blind problem package
 *   B -- independent authority oracle payload
 *   C -- externally verified provenance (provider-verified; generic envelope
 *        fields never grant VALID_PROVENANCE)
 *   D -- comparison result
 *
 * B cannot self-certify C. C cannot self-certify its own externality.
 * This lane declares no production provider / trust root, so production
 * classification cannot become VALID_PROVENANCE.
 */

import { setDifference, setsEqual, sortedArray } from "./model"

export type IndependentGroundingStatus = "UNPROVEN" | "DISAGREED" | "PROVEN"

export type IndependentGroundingReason =
  | "AWAITING_INDEPENDENT_AUTHORITY"
  | "UNPROVEN_INDEPENDENCE"
  | "AUTHORITY_INCOMPLETE"
  | "AUTHORITY_AMBIGUOUS"
  | "AUTHORITY_DISAGREEMENT"
  | "INDEPENDENT_GROUNDING_NOT_PROVEN"

export type OracleInputState = "ABSENT" | "INVALID_PROVENANCE" | "VALID_PROVENANCE"

export type SemanticRelation = "NOT_EVALUATED" | "INCOMPLETE_OR_AMBIGUOUS" | "DISAGREES" | "AGREES"

export const BLIND_PROBLEM_SCHEMA = "tsei-invariant-discrimination-v0.blind-problem.v0"
export const AUTHORITY_ORACLE_SCHEMA = "tsei-invariant-discrimination-v0.authority-oracle.v0"

/**
 * No production provider is declared in this scaffold. Until a later PR
 * names a concrete provider-specific verifier and its trust root, this
 * remains null and production VALID_PROVENANCE is unreachable.
 */
export const DECLARED_PRODUCTION_PROVIDER: null = null

/** Checkable known-controller identifiers for the mutant/harness/anchor side. */
export const PROHIBITED_CONTROLLER_IDENTIFIERS: readonly string[] = [
  "shtomko@gmail.com",
  "pipavlo82",
  "Pavlo Tvardovskyi",
]

export const ANSWER_BEARING_SOURCE_REFS: readonly string[] = [
  "expected_attribution",
  "expected_attribution_digest",
  "fixtures.ts",
  "tsei-invariant-discrimination-attribution-v0.test.ts",
  "precommitment-manifest.json",
  "derived_attribution_set",
]

/**
 * Keys that must never appear on authority-visible Object A.
 * Executable / implementation material is harness-private.
 */
export const OBJECT_A_FORBIDDEN_KEYS: readonly string[] = [
  "predicate",
  "predicates",
  "predicate_source",
  "predicateSource",
  "evaluator",
  "reference_evaluator",
  "evaluator_output",
  "evaluatorOutput",
  "expected_attribution",
  "expected_attribution_digest",
  "mutated_attribution",
  "observed_attribution",
  "derived_attribution_set",
  "O_i",
  "artifact_digest",
  "implementation",
  "function",
  "imports",
  "independence_claim",
  "source_class",
  "authority_account",
]

export type ConcreteCaseValue = {
  readonly [field: string]: number | string | boolean | readonly number[] | readonly string[] | null
}

export type NormativeInvariant = {
  readonly invariant_id: string
  readonly normative_definition: string
  readonly normative_definition_identity: string
}

export type BlindProblemCase = {
  readonly mutant_id: string
  readonly baseline: ConcreteCaseValue
  readonly mutated: ConcreteCaseValue
}

export type BlindProblemPackage = {
  readonly schema: typeof BLIND_PROBLEM_SCHEMA
  readonly instance_id: string
  readonly evaluation_instruction: string
  readonly invariants: { readonly [invariant_id: string]: NormativeInvariant }
  readonly cases: { readonly [mutant_id: string]: BlindProblemCase }
}

export type AuthorityOracleCase = {
  readonly mutant_id: string
  readonly derived_attribution_set: readonly string[]
}

export type AuthorityOraclePayload = {
  readonly schema: typeof AUTHORITY_ORACLE_SCHEMA
  readonly problem_package_digest: string
  readonly cases: { readonly [mutant_id: string]: AuthorityOracleCase }
  readonly authority_account?: string
  readonly independence_claim?: string
  readonly source_class?: string
  readonly source_material_refs?: readonly string[]
  readonly public_key?: string
  readonly publisher_display_name?: string
  readonly publisher_email?: string
}

/**
 * Generic envelope representation. May record claimed fields for negative
 * tests. It MUST NOT grant VALID_PROVENANCE by itself.
 */
export type GenericProvenanceEnvelope = {
  readonly publisher_display_name?: string
  readonly publisher_email?: string
  readonly publisher_account?: string
  readonly public_key?: string
  readonly source_class?: string
  readonly independence_claim?: string
  readonly created_at?: string
  readonly as_of?: string
  readonly artifact_digest?: string
  readonly problem_package_digest?: string
  readonly source_material_refs?: readonly string[]
}

export type VerifiedPublicationObservations = {
  readonly provider_id: string
  readonly trust_root_id: string
  readonly publisher_identifiers: readonly string[]
  readonly oracle_bytes_sha256: string
  readonly problem_package_digest: string
  readonly freeze_precedes_comparison: boolean
  readonly freeze_precedes_answer_disclosure: boolean
  readonly source_material_refs: readonly string[]
}

export type ProviderInjectionKind = "production" | "synthetic_test_only"

export type ProviderVerificationRequest = {
  readonly oracle_bytes_sha256: string
  readonly problem_package_digest: string
  readonly generic_envelope: GenericProvenanceEnvelope | null
}

export type ProviderVerificationOutcome =
  | { readonly ok: false; readonly reason: string }
  | {
      readonly ok: true
      readonly injection_kind: ProviderInjectionKind
      readonly observations: VerifiedPublicationObservations
    }

/**
 * Provider-specific verification interface. A later lane may supply a
 * production implementation bound to a declared external trust root.
 * This scaffold exports no such production implementation.
 */
export type ExternalProviderVerifier = {
  readonly provider_id: string
  readonly trust_root_id: string
  readonly injection_kind: ProviderInjectionKind
  verify(request: ProviderVerificationRequest): ProviderVerificationOutcome
}

export type CaseUniverseReport = {
  readonly DECLARED_CASE_IDS: readonly string[]
  readonly PACKAGE_CASE_IDS: readonly string[]
  readonly AUTHORITY_CASE_IDS: readonly string[] | null
  readonly COMPARISON_CASE_IDS: readonly string[] | null
  readonly closed: boolean
  readonly missing_from_authority: readonly string[]
  readonly extra_in_authority: readonly string[]
  readonly missing_from_comparison: readonly string[]
  readonly extra_in_comparison: readonly string[]
  /**
   * Present only when the universe is closed. Derived from the closed set
   * cardinality -- never a separately maintained integer.
   */
  readonly closed_case_count: number | null
}

export type LeakCheckResult = {
  readonly clean: boolean
  readonly violations: readonly string[]
}

export type FaithfulnessResult = {
  readonly faithful: boolean
  readonly violations: readonly string[]
}

export type IndependentGroundingResult = {
  readonly independent_grounding: IndependentGroundingStatus
  readonly independent_grounding_reason: IndependentGroundingReason | null
  readonly oracle_input_state: OracleInputState
  readonly semantic_relation: SemanticRelation
  readonly universe: CaseUniverseReport
  readonly synthetic_test_only: boolean
  /** Always false in this scaffold lane. */
  readonly production_publishable: false
}

export { setDifference, setsEqual, sortedArray }
