/**
 * Independent-authority scaffold mechanics (PR #201).
 *
 * Production independent grounding remains unavailable: this file never
 * emits production-publishable PROVEN evidence, and generic provenance
 * envelopes never become VALID_PROVENANCE.
 */

import { createHash } from "node:crypto"
import {
  ANSWER_BEARING_SOURCE_REFS,
  AUTHORITY_ORACLE_SCHEMA,
  BLIND_PROBLEM_SCHEMA,
  DECLARED_PRODUCTION_PROVIDER,
  OBJECT_A_FORBIDDEN_KEYS,
  PROHIBITED_CONTROLLER_IDENTIFIERS,
  setDifference,
  setsEqual,
  sortedArray,
  type AuthorityOraclePayload,
  type BlindProblemPackage,
  type CaseUniverseReport,
  type ConcreteCaseValue,
  type FaithfulnessResult,
  type GenericProvenanceEnvelope,
  type IndependentGroundingResult,
  type LeakCheckResult,
  type OracleInputState,
  type ProviderVerificationOutcome,
  type SemanticRelation,
} from "./independent-authority-model"

export function sha256ExactBytes(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex")
}

export function sha256ExactUtf8(text: string): string {
  return sha256ExactBytes(Buffer.from(text, "utf8"))
}

/**
 * Exact-byte digest of Object A. Computed outside the package. The package
 * MUST NOT contain artifact_digest -- including one is a leak, not a digest
 * input.
 */
export function digestBlindProblemBytes(bytes: Uint8Array | Buffer): string {
  return sha256ExactBytes(bytes)
}

export function digestAuthorityOracleBytes(bytes: Uint8Array | Buffer): string {
  return sha256ExactBytes(bytes)
}

export function normativeDefinitionIdentity(normative_definition: string): string {
  return sha256ExactUtf8(normative_definition)
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

/** UTF-8 LF JSON bytes for in-memory objects. Digest is of these bytes, not a self-field. */
export function encodeJsonUtf8Lf(value: unknown): Buffer {
  return Buffer.from(stableStringify(value) + "\n", "utf8")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function walkForbidden(value: unknown, path: string, violations: string[]): void {
  if (typeof value === "function") {
    violations.push(`${path}: executable function value is forbidden on Object A`)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkForbidden(item, `${path}[${index}]`, violations))
    return
  }
  if (!isRecord(value)) {
    if (typeof value === "string") {
      const lowered = value.toLowerCase()
      const forbiddenSubstrings = [
        "expected_attribution",
        "expected_attribution_digest",
        "predicate_source",
        "evaluator_output",
        "derived_attribution_set",
      ]
      if (forbiddenSubstrings.some((token) => lowered.includes(token))) {
        violations.push(`${path}: string mentions forbidden implementation/answer token`)
      }
      if (value.includes("=>") || /\bfunction\s*\(/.test(value)) {
        violations.push(`${path}: string looks like executable predicate/source`)
      }
    }
    return
  }
  for (const key of Object.keys(value)) {
    if (OBJECT_A_FORBIDDEN_KEYS.includes(key)) {
      violations.push(`${path}.${key}: forbidden Object A key`)
    }
    walkForbidden(value[key], `${path}.${key}`, violations)
  }
}

export function leakCheckBlindPackage(pkg: unknown): LeakCheckResult {
  const violations: string[] = []
  if (!isRecord(pkg)) {
    return { clean: false, violations: ["package is not an object"] }
  }
  walkForbidden(pkg, "A", violations)
  if (pkg["schema"] !== BLIND_PROBLEM_SCHEMA) {
    violations.push("A.schema must be the blind-problem schema")
  }
  return { clean: violations.length === 0, violations }
}

function valuesEqual(a: ConcreteCaseValue, b: ConcreteCaseValue): boolean {
  return stableStringify(a) === stableStringify(b)
}

export type IntendedFaithfulness = {
  readonly invariants: {
    readonly [invariant_id: string]: { readonly normative_definition: string; readonly normative_definition_identity: string }
  }
  readonly cases: {
    readonly [mutant_id: string]: { readonly baseline: ConcreteCaseValue; readonly mutated: ConcreteCaseValue }
  }
}

/**
 * Faithfulness of A to declared normative semantic definitions and intended
 * concrete case values. Not identity with an internal evaluator implementation.
 */
export function checkBlindPackageFaithfulness(pkg: BlindProblemPackage, intended: IntendedFaithfulness): FaithfulnessResult {
  const violations: string[] = []
  const leak = leakCheckBlindPackage(pkg)
  if (!leak.clean) violations.push(...leak.violations)

  const pkgInvariantIds = new Set(Object.keys(pkg.invariants))
  const intendedInvariantIds = new Set(Object.keys(intended.invariants))
  if (!setsEqual(pkgInvariantIds, intendedInvariantIds)) {
    violations.push("invariant id universe differs from intended normative set")
  }
  for (const id of intendedInvariantIds) {
    const actual = pkg.invariants[id]
    const expected = intended.invariants[id]
    if (!actual) continue
    if (actual.invariant_id !== id) violations.push(`invariants[${id}].invariant_id mismatch`)
    if (actual.normative_definition !== expected.normative_definition) {
      violations.push(`invariants[${id}] normative definition is not the declared definition`)
    }
    const identity = normativeDefinitionIdentity(actual.normative_definition)
    if (actual.normative_definition_identity !== identity) {
      violations.push(`invariants[${id}] normative definition identity does not match definition bytes`)
    }
    if (actual.normative_definition_identity !== expected.normative_definition_identity) {
      violations.push(`invariants[${id}] normative definition identity does not match intended identity`)
    }
  }

  const pkgCaseIds = new Set(Object.keys(pkg.cases))
  const intendedCaseIds = new Set(Object.keys(intended.cases))
  if (!setsEqual(pkgCaseIds, intendedCaseIds)) {
    violations.push("case id universe differs from intended cases")
  }
  for (const id of intendedCaseIds) {
    const actual = pkg.cases[id]
    const expected = intended.cases[id]
    if (!actual) continue
    if (actual.mutant_id !== id) violations.push(`cases[${id}].mutant_id mismatch`)
    if (!valuesEqual(actual.baseline, expected.baseline)) {
      violations.push(`cases[${id}] baseline does not match intended concrete value`)
    }
    if (!valuesEqual(actual.mutated, expected.mutated)) {
      violations.push(`cases[${id}] mutated value does not match intended concrete value`)
    }
    const required = new Set([...Object.keys(expected.baseline), ...Object.keys(expected.mutated)])
    for (const field of required) {
      if (!(field in actual.baseline) || !(field in actual.mutated)) {
        violations.push(`cases[${id}] missing required semantic field ${field}`)
      }
    }
  }

  if (typeof pkg.evaluation_instruction !== "string" || pkg.evaluation_instruction.trim().length === 0) {
    violations.push("evaluation_instruction must be a non-empty implementation-independent instruction")
  }

  return { faithful: violations.length === 0, violations }
}

function idSet(ids: Iterable<string>): ReadonlySet<string> {
  return new Set(ids)
}

export function caseIdsFromMap(map: { readonly [id: string]: unknown }): ReadonlySet<string> {
  return idSet(Object.keys(map))
}

export function closeCaseUniverse(input: {
  readonly declared: ReadonlySet<string>
  readonly packaged: ReadonlySet<string>
  readonly authority: ReadonlySet<string> | null
  readonly comparison: ReadonlySet<string> | null
}): CaseUniverseReport {
  const declared = idSet(input.declared)
  const packaged = idSet(input.packaged)
  const declaredEqualsPackage = setsEqual(declared, packaged)

  const missing_from_authority = input.authority ? sortedArray(setDifference(declared, input.authority)) : sortedArray(declared)
  const extra_in_authority = input.authority ? sortedArray(setDifference(input.authority, declared)) : []
  const missing_from_comparison = input.comparison ? sortedArray(setDifference(declared, input.comparison)) : sortedArray(declared)
  const extra_in_comparison = input.comparison ? sortedArray(setDifference(input.comparison, declared)) : []

  const authorityClosed = input.authority !== null && missing_from_authority.length === 0 && extra_in_authority.length === 0
  const comparisonClosed =
    input.comparison !== null && missing_from_comparison.length === 0 && extra_in_comparison.length === 0
  const closed = declaredEqualsPackage && authorityClosed && comparisonClosed
  const closed_case_count = closed ? declared.size : null

  return {
    DECLARED_CASE_IDS: sortedArray(declared),
    PACKAGE_CASE_IDS: sortedArray(packaged),
    AUTHORITY_CASE_IDS: input.authority ? sortedArray(input.authority) : null,
    COMPARISON_CASE_IDS: input.comparison ? sortedArray(input.comparison) : null,
    closed,
    missing_from_authority,
    extra_in_authority,
    missing_from_comparison,
    extra_in_comparison,
    closed_case_count,
  }
}

function refsAreAnswerBearing(refs: readonly string[] | undefined): boolean {
  if (!refs) return false
  return refs.some((ref) => ANSWER_BEARING_SOURCE_REFS.some((token) => ref.includes(token)))
}

function publisherIntersectsProhibited(identifiers: readonly string[]): boolean {
  const prohibited = new Set(PROHIBITED_CONTROLLER_IDENTIFIERS.map((id) => id.toLowerCase()))
  return identifiers.some((id) => prohibited.has(id.toLowerCase()))
}

export function parseAttributionSet(raw: unknown): { readonly ok: true; readonly set: ReadonlySet<string> } | { readonly ok: false; readonly reason: "AMBIGUOUS" } {
  if (!Array.isArray(raw)) return { ok: false, reason: "AMBIGUOUS" }
  if (!raw.every((item) => typeof item === "string")) return { ok: false, reason: "AMBIGUOUS" }
  const items = raw as string[]
  if (items.some((item) => item.trim() !== item || item.length === 0)) return { ok: false, reason: "AMBIGUOUS" }
  if (items.some((item) => /[\s]|\/|\bor\b/i.test(item))) return { ok: false, reason: "AMBIGUOUS" }
  if (new Set(items).size !== items.length) return { ok: false, reason: "AMBIGUOUS" }
  return { ok: true, set: new Set(items) }
}

function classifyProviderOutcome(
  authority: AuthorityOraclePayload | null,
  generic_envelope: GenericProvenanceEnvelope | null,
  provider_outcome: ProviderVerificationOutcome | null,
  oracle_bytes_sha256: string | null,
  problem_package_digest: string,
): OracleInputState {
  if (authority === null) return "ABSENT"

  // Generic envelope fields, claimed identity on B, keys, names, emails:
  // never sufficient. A provider verifier must independently verify.
  if (provider_outcome === null || provider_outcome.ok !== true) return "INVALID_PROVENANCE"

  // This lane has no declared production provider. A "production" injection
  // cannot mint VALID_PROVENANCE here -- that would let C self-certify.
  if (provider_outcome.injection_kind !== "synthetic_test_only") return "INVALID_PROVENANCE"
  // DECLARED_PRODUCTION_PROVIDER is null in this lane; retained as a
  // mechanical non-claim that no production trust root is configured.
  void DECLARED_PRODUCTION_PROVIDER

  const observations = provider_outcome.observations
  if (oracle_bytes_sha256 !== null && observations.oracle_bytes_sha256 !== oracle_bytes_sha256) {
    return "INVALID_PROVENANCE"
  }
  if (observations.problem_package_digest !== problem_package_digest) return "INVALID_PROVENANCE"
  if (authority.problem_package_digest !== problem_package_digest) return "INVALID_PROVENANCE"
  if (!observations.freeze_precedes_comparison) return "INVALID_PROVENANCE"
  if (!observations.freeze_precedes_answer_disclosure) return "INVALID_PROVENANCE"
  if (publisherIntersectsProhibited(observations.publisher_identifiers)) return "INVALID_PROVENANCE"
  if (refsAreAnswerBearing(observations.source_material_refs)) return "INVALID_PROVENANCE"
  if (refsAreAnswerBearing(authority.source_material_refs)) return "INVALID_PROVENANCE"
  if (refsAreAnswerBearing(generic_envelope?.source_material_refs)) return "INVALID_PROVENANCE"
  return "VALID_PROVENANCE"
}

export type EvaluateIndependentGroundingInput = {
  readonly pkg: BlindProblemPackage
  readonly problem_package_digest: string
  readonly observed_attribution: { readonly [mutant_id: string]: readonly string[] }
  readonly authority: AuthorityOraclePayload | null
  readonly authority_bytes_sha256: string | null
  readonly generic_envelope: GenericProvenanceEnvelope | null
  readonly provider_outcome: ProviderVerificationOutcome | null
}

function unproven(
  reason: IndependentGroundingResult["independent_grounding_reason"],
  oracle_input_state: OracleInputState,
  semantic_relation: SemanticRelation,
  universe: CaseUniverseReport,
  synthetic_test_only: boolean,
): IndependentGroundingResult {
  return {
    independent_grounding: "UNPROVEN",
    independent_grounding_reason: reason,
    oracle_input_state,
    semantic_relation,
    universe,
    synthetic_test_only,
    production_publishable: false,
  }
}

export function evaluateIndependentGrounding(input: EvaluateIndependentGroundingInput): IndependentGroundingResult {
  const declared = caseIdsFromMap(input.pkg.cases)
  const packaged = caseIdsFromMap(input.pkg.cases)
  const synthetic =
    input.provider_outcome?.ok === true && input.provider_outcome.injection_kind === "synthetic_test_only"

  if (input.authority === null) {
    const universe = closeCaseUniverse({
      declared,
      packaged,
      authority: null,
      comparison: null,
    })
    return unproven("AWAITING_INDEPENDENT_AUTHORITY", "ABSENT", "NOT_EVALUATED", universe, false)
  }

  if (input.authority.schema !== AUTHORITY_ORACLE_SCHEMA) {
    const universe = closeCaseUniverse({
      declared,
      packaged,
      authority: caseIdsFromMap(input.authority.cases),
      comparison: null,
    })
    return unproven("UNPROVEN_INDEPENDENCE", "INVALID_PROVENANCE", "NOT_EVALUATED", universe, false)
  }

  const oracleState = classifyProviderOutcome(
    input.authority,
    input.generic_envelope,
    input.provider_outcome,
    input.authority_bytes_sha256,
    input.problem_package_digest,
  )

  if (oracleState !== "VALID_PROVENANCE") {
    const universe = closeCaseUniverse({
      declared,
      packaged,
      authority: caseIdsFromMap(input.authority.cases),
      comparison: null,
    })
    return unproven("UNPROVEN_INDEPENDENCE", oracleState, "NOT_EVALUATED", universe, false)
  }

  const authorityIds = caseIdsFromMap(input.authority.cases)
  const parsed = new Map<string, ReadonlySet<string>>()
  let ambiguous = false
  for (const id of authorityIds) {
    const parsedSet = parseAttributionSet(input.authority.cases[id]?.derived_attribution_set)
    if (!parsedSet.ok) {
      ambiguous = true
      break
    }
    parsed.set(id, parsedSet.set)
  }

  if (ambiguous) {
    const universe = closeCaseUniverse({
      declared,
      packaged,
      authority: authorityIds,
      comparison: null,
    })
    return unproven("AUTHORITY_AMBIGUOUS", "VALID_PROVENANCE", "INCOMPLETE_OR_AMBIGUOUS", universe, synthetic)
  }

  const universeForCoverage = closeCaseUniverse({
    declared,
    packaged,
    authority: authorityIds,
    comparison: null,
  })
  if (!setsEqual(declared, authorityIds)) {
    return unproven(
      "AUTHORITY_INCOMPLETE",
      "VALID_PROVENANCE",
      "INCOMPLETE_OR_AMBIGUOUS",
      universeForCoverage,
      synthetic,
    )
  }

  // Comparison universe is derived from the closed declared/package/authority
  // set -- the gate compares exactly those ids, never a hand-counted subset.
  const comparisonIds = declared
  const universe = closeCaseUniverse({
    declared,
    packaged,
    authority: authorityIds,
    comparison: comparisonIds,
  })

  let disagrees = false
  for (const id of comparisonIds) {
    const observedRaw = input.observed_attribution[id]
    const observed = parseAttributionSet(observedRaw)
    const expected = parsed.get(id)
    if (!observed.ok || !expected || !setsEqual(observed.set, expected)) {
      disagrees = true
      break
    }
  }

  if (disagrees) {
    return {
      independent_grounding: "DISAGREED",
      independent_grounding_reason: "AUTHORITY_DISAGREEMENT",
      oracle_input_state: "VALID_PROVENANCE",
      semantic_relation: "DISAGREES",
      universe,
      synthetic_test_only: synthetic,
      production_publishable: false,
    }
  }

  return {
    independent_grounding: "PROVEN",
    independent_grounding_reason: null,
    oracle_input_state: "VALID_PROVENANCE",
    semantic_relation: "AGREES",
    universe,
    synthetic_test_only: synthetic,
    production_publishable: false,
  }
}

/**
 * Production entry: never accepts a provider outcome. Non-arrival is
 * awaiting; any present authority without a declared provider is invalid
 * provenance. Never DISAGREED (absence is not disagreement).
 */
export function evaluateProductionIndependentGrounding(input: {
  readonly pkg: BlindProblemPackage
  readonly problem_package_digest: string
  readonly observed_attribution: { readonly [mutant_id: string]: readonly string[] }
  readonly authority: AuthorityOraclePayload | null
  readonly authority_bytes_sha256: string | null
  readonly generic_envelope: GenericProvenanceEnvelope | null
}): IndependentGroundingResult {
  return evaluateIndependentGrounding({
    ...input,
    provider_outcome: null,
  })
}

/** This lane cannot mint production grounding evidence. Always null. */
export function asProductionGroundingEvidence(_result: IndependentGroundingResult): null {
  return null
}

export function isTseiRuntimeViolation(_result: IndependentGroundingResult): false {
  return false
}
