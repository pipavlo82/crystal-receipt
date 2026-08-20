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
  | "PROBLEM_PACKAGE_NOT_FAITHFUL"
  | "INDEPENDENT_GROUNDING_NOT_PROVEN"

export type OracleInputState = "ABSENT" | "INVALID_PROVENANCE" | "VALID_PROVENANCE" | "NOT_EVALUATED"

export type SemanticRelation = "NOT_EVALUATED" | "INCOMPLETE_OR_AMBIGUOUS" | "DISAGREES" | "AGREES"

export const BLIND_PROBLEM_SCHEMA = "tsei-invariant-discrimination-v0.blind-problem.v0"
export const AUTHORITY_ORACLE_SCHEMA = "tsei-invariant-discrimination-v0.authority-oracle.v0"

export const DECLARED_PROVIDER_SELECTION = "rekor-v1" as const
export const DECLARED_PRODUCTION_PROVIDER = "rekor-v1" as const

/** Rekor v2 remains an unselected candidate. It is not the frozen provider. */
export const PROVIDER_CANDIDATE_REKOR_V2 = "rekor-v2-candidate-not-selected" as const

export const REKOR_V1_ENDPOINT = "https://rekor.sigstore.dev" as const
export const REKOR_V1_LOG_ID = "c0d23d6ad406973f9559f3ba2d1ca01f84147d8ffc5b8445c224f98b9591801d" as const
export const ORIGINATOR_SAN_EMAIL = "shtomko@gmail.com" as const
export const AUTHORITY_SAN_EMAIL = "114340671+TMerlini@users.noreply.github.com" as const
export const OIDC_ISSUER_GITHUB_OAUTH = "https://github.com/login/oauth" as const
export const DUMMY_GATE_RUN = "tsei-ia-provider-dry-run-v0-20260819" as const
export const DUMMY_GATE_D0_SHA256 = "76fedc450e284e9cee23d04331b729493fceffe7fb0ed381f050ba3093e9e10e" as const
export const DUMMY_GATE_D1_SHA256 = "219b960d52790ee193e59177e8e4f1c937fcf8ae5463041ee8334c697a72d927" as const
export const DUMMY_GATE_D2_SHA256 = "eba13ec8c232e99e0c1680078780bb8781207ad273d495779304852fee98667a" as const

export const PROVIDER_DRY_RUN_REQUIRED_BEFORE_OBJECT_A = true

export const CO_SIGNED_CHECKPOINT_TIME = "NOT_YET_QUALIFIED" as const

export const AUTHORITY_RELATIONSHIP_CLASS = "EXTERNAL_PRIOR_PROTOCOL_EXPOSURE" as const

/**
 * Frozen claim-boundary judgments are protocol-side declared experimental
 * conditions. They are not independently verified historical facts and
 * MUST NOT be read as provenance, provider verification, or PROVEN.
 */
export const DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED =
  "DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED" as const

export type ClaimBoundary = {
  readonly authority_semantic_judgment: "HUMAN_PRIMARY"
  readonly authority_assistant_role: "MECHANICAL_ONLY"
  readonly originator_semantic_judgment: "HUMAN_PRIMARY"
  readonly originator_assistant_role: "MECHANICAL_ONLY"
  readonly class: typeof DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED
}

/**
 * Public snapshot of the declared claim boundary. Not the private
 * comparator baseline. Runtime-frozen; mutating it must not be possible
 * through ordinary property assignment.
 */
export const CLAIM_BOUNDARY: ClaimBoundary = Object.freeze({
  authority_semantic_judgment: "HUMAN_PRIMARY",
  authority_assistant_role: "MECHANICAL_ONLY",
  originator_semantic_judgment: "HUMAN_PRIMARY",
  originator_assistant_role: "MECHANICAL_ONLY",
  class: DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED,
})

export const MECHANICAL_ONLY_OPERATIONS: readonly string[] = [
  "serialization",
  "byte-exactness",
  "schema validation",
  "deterministic ordering",
  "hashing",
  "commitment construction/checking",
  "provider-proof verification",
  "exact-set comparison",
]

export const SECOND_PARTY_OBSERVATION_ONLY = "SECOND_PARTY_OBSERVATION_ONLY" as const

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
 * Bounded runtime allow-list for the authority-visible Object A contract.
 * Unexpected keys at these levels are rejected. Concrete baseline/mutated
 * values remain domain data and are not subject to this metadata allow-list,
 * but they are still scanned for forbidden implementation/answer keys.
 *
 * Residual nonclaim: this does not detect arbitrary semantic steganography
 * in natural-language normative definitions.
 */
export const OBJECT_A_TOP_LEVEL_KEYS: readonly string[] = [
  "schema",
  "instance_id",
  "evaluation_instruction",
  "invariants",
  "cases",
]

export const OBJECT_A_INVARIANT_KEYS: readonly string[] = [
  "invariant_id",
  "normative_definition",
  "normative_definition_identity",
]

export const OBJECT_A_CASE_KEYS: readonly string[] = ["mutant_id", "baseline", "mutated"]

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
  /**
   * Observational metadata frozen by Authority before Originator reveal.
   * Not a second attribution channel. Must not alter exact-set comparison.
   */
  readonly definition_ambiguity_observation?: DefinitionAmbiguityObservation
  /**
   * Non-gating telemetry. Must not inject IDs into the comparison universe.
   */
  readonly observed_undeclared_effects?: readonly ObservedUndeclaredEffect[]
}

export type DefinitionAmbiguityObservation = {
  readonly observed: boolean
  readonly invariant_ids: readonly string[]
  readonly note?: string
  readonly readings_considered?: number
}

export type ObservedUndeclaredEffect = {
  readonly note: string
}

export type AuthorityAnswerFreeObservation = {
  readonly package_appeared_answer_free: boolean
  readonly notes?: string
  readonly class: typeof SECOND_PARTY_OBSERVATION_ONLY
}

export type AuthorityOraclePayload = {
  readonly schema: typeof AUTHORITY_ORACLE_SCHEMA
  readonly problem_package_digest: string
  readonly cases: { readonly [mutant_id: string]: AuthorityOracleCase }
  readonly authority_observations?: {
    readonly package_appeared_answer_free: boolean
    readonly notes?: string
  }
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
  readonly declared_invariant_ids: readonly string[]
  readonly synthetic_test_only: boolean
  /** Always false in this scaffold lane. */
  readonly production_publishable: false
  readonly claim_boundary: ClaimBoundary
  readonly claim_boundary_class: typeof DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED
  readonly authority_observations: AuthorityAnswerFreeObservation | null
  readonly definition_ambiguity_observations: {
    readonly [mutant_id: string]: {
      readonly observed: boolean
      readonly invariant_ids: readonly string[]
      readonly note?: string
      readonly readings_considered?: number
    }
  }
  readonly observed_undeclared_effects: {
    readonly [mutant_id: string]: readonly { readonly note: string }[]
  }
}

/**
 * Outer result of the future-run Rekor production evaluator.
 * IndependentGroundingResult.production_publishable remains literal false.
 * This type may carry a boolean publishable flag without widening that lock.
 */
export type ProductionRekorIndependentGroundingResult = {
  readonly ok: boolean
  readonly reasons: readonly string[]
  readonly independent_grounding: IndependentGroundingStatus
  readonly independent_grounding_reason: IndependentGroundingReason | null
  readonly oracle_input_state: OracleInputState
  readonly semantic_relation: SemanticRelation
  readonly production_publishable: boolean
  readonly sufficient_for_proven_grounding: boolean
  readonly sufficient_for_real_run: false
  readonly core: IndependentGroundingResult | null
}

export type DummyProviderEventKind = "D0" | "D1" | "D2"

export type DummyProviderEvent = {
  readonly kind: DummyProviderEventKind
  readonly originator_identity: string
  readonly authority_identity: string
  readonly artifact_digest: string
  readonly provider_id: string
  readonly log_identity: string
  readonly ordering_index: number
  readonly proof_material: string
}

export type ProviderDryRunInput = {
  readonly events: {
    readonly D0: DummyProviderEvent
    readonly D1: DummyProviderEvent
    readonly D2: DummyProviderEvent
  }
  readonly expected_originator_identity: string
  readonly expected_authority_identity: string
  readonly expected_artifact_digest: string
  readonly expected_provider_id: string
  readonly expected_log_identity: string
  readonly expected_proof_material: string
  readonly independently_verified_cross_log_bridge: boolean
}

export type ProviderDryRunResult = {
  readonly ok: boolean
  readonly model_checks_pass: boolean
  readonly reasons: readonly string[]
  readonly ordering_policy: "D0_lt_D1_lt_D2"
  /** Model/in-memory checks cannot freeze a real provider policy. */
  readonly provider_policy_freezable: false
  readonly declared_provider_selection: typeof DECLARED_PROVIDER_SELECTION
  readonly selected_provider_pass: false
  readonly independently_verified_cross_log_bridge_established: false
  readonly caller_supplied_proof_material_verified: false
  readonly independent_provider_condition_established: false
  readonly sufficient_for_real_object_a: false
  readonly sufficient_for_proven_grounding: false
  readonly production_publishable: false
}

export { setDifference, setsEqual, sortedArray }
