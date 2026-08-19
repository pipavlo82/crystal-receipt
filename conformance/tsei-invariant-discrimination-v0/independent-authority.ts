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
  DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED,
  DECLARED_PROVIDER_SELECTION,
  OBJECT_A_CASE_KEYS,
  OBJECT_A_FORBIDDEN_KEYS,
  OBJECT_A_INVARIANT_KEYS,
  OBJECT_A_TOP_LEVEL_KEYS,
  PROHIBITED_CONTROLLER_IDENTIFIERS,
  SECOND_PARTY_OBSERVATION_ONLY,
  setDifference,
  setsEqual,
  sortedArray,
  type AuthorityOraclePayload,
  type BlindProblemPackage,
  type CaseUniverseReport,
  type ClaimBoundary,
  type ConcreteCaseValue,
  type FaithfulnessResult,
  type GenericProvenanceEnvelope,
  type IndependentGroundingResult,
  type LeakCheckResult,
  type OracleInputState,
  type ProviderDryRunInput,
  type ProviderDryRunResult,
  type SemanticRelation,
  type VerifiedPublicationObservations,
} from "./independent-authority-model"

export function sha256ExactBytes(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex")
}

export function sha256ExactUtf8(text: string): string {
  return sha256ExactBytes(Buffer.from(text, "utf8"))
}

const CANONICAL_CLAIM_BOUNDARY: ClaimBoundary = Object.freeze({
  authority_semantic_judgment: "HUMAN_PRIMARY",
  authority_assistant_role: "MECHANICAL_ONLY",
  originator_semantic_judgment: "HUMAN_PRIMARY",
  originator_assistant_role: "MECHANICAL_ONLY",
  class: DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED,
})

function snapshotClaimBoundary(): ClaimBoundary {
  return Object.freeze({
    authority_semantic_judgment: CANONICAL_CLAIM_BOUNDARY.authority_semantic_judgment,
    authority_assistant_role: CANONICAL_CLAIM_BOUNDARY.authority_assistant_role,
    originator_semantic_judgment: CANONICAL_CLAIM_BOUNDARY.originator_semantic_judgment,
    originator_assistant_role: CANONICAL_CLAIM_BOUNDARY.originator_assistant_role,
    class: CANONICAL_CLAIM_BOUNDARY.class,
  })
}

function sortedIdList(ids: Iterable<string>): string[] {
  return sortedArray(new Set(ids))
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

function rejectUnexpectedKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  violations: string[],
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      violations.push(`${path}.${key}: unexpected Object A key`)
    }
  }
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
  rejectUnexpectedKeys(pkg, OBJECT_A_TOP_LEVEL_KEYS, "A", violations)
  walkForbidden(pkg, "A", violations)
  if (pkg["schema"] !== BLIND_PROBLEM_SCHEMA) {
    violations.push("A.schema must be the blind-problem schema")
  }
  if (isRecord(pkg["invariants"])) {
    for (const [id, invariant] of Object.entries(pkg["invariants"])) {
      if (!isRecord(invariant)) {
        violations.push(`A.invariants.${id}: invariant must be an object`)
        continue
      }
      rejectUnexpectedKeys(invariant, OBJECT_A_INVARIANT_KEYS, `A.invariants.${id}`, violations)
    }
  }
  if (isRecord(pkg["cases"])) {
    for (const [id, row] of Object.entries(pkg["cases"])) {
      if (!isRecord(row)) {
        violations.push(`A.cases.${id}: case must be an object`)
        continue
      }
      rejectUnexpectedKeys(row, OBJECT_A_CASE_KEYS, `A.cases.${id}`, violations)
    }
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

function classifyVerifiedObservations(
  authority: AuthorityOraclePayload | null,
  generic_envelope: GenericProvenanceEnvelope | null,
  observations: VerifiedPublicationObservations | null,
  oracle_bytes_sha256: string | null,
  problem_package_digest: string,
): OracleInputState {
  if (authority === null) return "ABSENT"

  // Generic envelope fields, claimed identity on B, keys, names, emails:
  // never sufficient. Verified observations must come from an issued
  // synthetic-test path or a later declared production provider.
  if (observations === null) return "INVALID_PROVENANCE"

  // Provider selection does not mint observations. Production evaluation
  // still ignores caller-supplied provider_outcome and synthetic injection.

  if (oracle_bytes_sha256 === null) return "INVALID_PROVENANCE"
  if (observations.oracle_bytes_sha256 !== oracle_bytes_sha256) return "INVALID_PROVENANCE"
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

export type EvaluateProductionIndependentGroundingInput = {
  readonly pkg: BlindProblemPackage
  readonly intended: IntendedFaithfulness
  readonly problem_package_digest: string
  readonly observed_attribution: { readonly [mutant_id: string]: readonly string[] }
  readonly authority: AuthorityOraclePayload | null
  readonly authority_bytes_sha256: string | null
  readonly generic_envelope: GenericProvenanceEnvelope | null
}

const issuedSyntheticProvenance = new WeakSet<object>()

/** Called only by independent-authority-synthetic.ts after minting a test-only outcome. */
export function issueSyntheticTestProvenance(outcome: object): void {
  issuedSyntheticProvenance.add(outcome)
}

function isIssuedSyntheticTestProvenance(value: unknown): value is object {
  return typeof value === "object" && value !== null && issuedSyntheticProvenance.has(value)
}

function observationsFromIssuedSynthetic(synthetic: unknown): VerifiedPublicationObservations | null {
  if (!isIssuedSyntheticTestProvenance(synthetic) || !isRecord(synthetic)) return null
  if (synthetic["ok"] !== true) return null
  if (synthetic["injection_kind"] !== "synthetic_test_only") return null
  const observations = synthetic["observations"]
  if (!isRecord(observations)) return null
  if (typeof observations["oracle_bytes_sha256"] !== "string") return null
  if (typeof observations["problem_package_digest"] !== "string") return null
  if (typeof observations["freeze_precedes_comparison"] !== "boolean") return null
  if (typeof observations["freeze_precedes_answer_disclosure"] !== "boolean") return null
  if (!Array.isArray(observations["publisher_identifiers"])) return null
  if (!Array.isArray(observations["source_material_refs"])) return null
  if (typeof observations["provider_id"] !== "string") return null
  if (typeof observations["trust_root_id"] !== "string") return null
  return observations as unknown as VerifiedPublicationObservations
}

function unproven(
  reason: IndependentGroundingResult["independent_grounding_reason"],
  oracle_input_state: OracleInputState,
  semantic_relation: SemanticRelation,
  universe: CaseUniverseReport,
  synthetic_test_only: boolean,
  pkg: BlindProblemPackage,
  evidence: ProtocolEvidence | null,
): IndependentGroundingResult {
  return {
    independent_grounding: "UNPROVEN",
    independent_grounding_reason: reason,
    oracle_input_state,
    semantic_relation,
    universe,
    declared_invariant_ids: sortedIdList(Object.keys(pkg.invariants)),
    synthetic_test_only,
    production_publishable: false,
    ...(evidence ?? emptyProtocolEvidence()),
  }
}

type ProtocolEvidence = Pick<
  IndependentGroundingResult,
  | "claim_boundary"
  | "claim_boundary_class"
  | "authority_observations"
  | "definition_ambiguity_observations"
  | "observed_undeclared_effects"
>

function emptyProtocolEvidence(): ProtocolEvidence {
  return {
    claim_boundary: snapshotClaimBoundary(),
    claim_boundary_class: DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED,
    authority_observations: null,
    definition_ambiguity_observations: {},
    observed_undeclared_effects: {},
  }
}

export type AuthorityObservationValidation =
  | { readonly ok: true; readonly evidence: ProtocolEvidence }
  | { readonly ok: false; readonly reason: "AUTHORITY_INCOMPLETE" | "AUTHORITY_AMBIGUOUS"; readonly violations: readonly string[] }

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value) && value >= 0
}

function validateAndNormalizeAuthorityObservations(
  pkg: BlindProblemPackage,
  authority: unknown,
): AuthorityObservationValidation {
  const violations: string[] = []
  let duplicate = false
  let unknown = false
  const declaredInvariants = new Set(Object.keys(pkg.invariants))
  if (!isRecord(authority)) {
    return { ok: false, reason: "AUTHORITY_AMBIGUOUS", violations: ["authority payload is not an object"] }
  }
  const cases = authority["cases"]
  if (!isRecord(cases)) {
    return { ok: false, reason: "AUTHORITY_AMBIGUOUS", violations: ["authority.cases is not an object"] }
  }

  const ambiguity: ProtocolEvidence["definition_ambiguity_observations"] = {}
  const undeclared: { [mutant_id: string]: { readonly note: string }[] } = {}

  for (const [mutantId, row] of Object.entries(cases)) {
    if (!isRecord(row)) {
      violations.push(`cases[${mutantId}] is not an object`)
      continue
    }
    if (Object.prototype.hasOwnProperty.call(row, "definition_ambiguity_observation")) {
      const amb = row["definition_ambiguity_observation"]
      if (amb == null || !isRecord(amb)) {
        violations.push(`cases[${mutantId}].definition_ambiguity_observation must be an object`)
        continue
      }
      if (typeof amb["observed"] !== "boolean") {
        violations.push(`cases[${mutantId}].definition_ambiguity_observation.observed must be boolean`)
      }
      const idsRaw = amb["invariant_ids"]
      if (!Array.isArray(idsRaw)) {
        violations.push(`cases[${mutantId}].definition_ambiguity_observation.invariant_ids must be string[]`)
      } else {
        const ids = idsRaw
        if (!ids.every((id) => typeof id === "string" && id.length > 0)) {
          violations.push(`cases[${mutantId}].definition_ambiguity_observation.invariant_ids must be non-empty strings`)
        } else {
          if (new Set(ids).size !== ids.length) {
            duplicate = true
            violations.push(`cases[${mutantId}].definition_ambiguity_observation.invariant_ids contains duplicates`)
          }
          for (const id of ids) {
            if (!declaredInvariants.has(id)) {
              unknown = true
              violations.push(`cases[${mutantId}].definition_ambiguity_observation references undeclared invariant ${id}`)
            }
          }
        }
      }
      if (Object.prototype.hasOwnProperty.call(amb, "note") && amb["note"] !== undefined && typeof amb["note"] !== "string") {
        violations.push(`cases[${mutantId}].definition_ambiguity_observation.note must be a string when present`)
      }
      if (Object.prototype.hasOwnProperty.call(amb, "readings_considered") && amb["readings_considered"] !== undefined) {
        if (!isFiniteNonNegativeInteger(amb["readings_considered"])) {
          violations.push(`cases[${mutantId}].definition_ambiguity_observation.readings_considered must be a finite non-negative integer when present`)
        }
      }
      if (violations.length === 0 && typeof amb["observed"] === "boolean" && Array.isArray(idsRaw) && idsRaw.every((id) => typeof id === "string")) {
        const entry: {
          observed: boolean
          invariant_ids: readonly string[]
          note?: string
          readings_considered?: number
        } = {
          observed: amb["observed"],
          invariant_ids: sortedIdList(idsRaw),
        }
        if (typeof amb["note"] === "string") entry.note = amb["note"]
        if (isFiniteNonNegativeInteger(amb["readings_considered"])) entry.readings_considered = amb["readings_considered"]
        ambiguity[mutantId] = entry
      }
    }
    if (Object.prototype.hasOwnProperty.call(row, "observed_undeclared_effects")) {
      const effects = row["observed_undeclared_effects"]
      if (effects == null || !Array.isArray(effects)) {
        violations.push(`cases[${mutantId}].observed_undeclared_effects must be an array`)
      } else {
        const normalized: { readonly note: string }[] = []
        let effectsOk = true
        for (const effect of effects) {
          if (!isRecord(effect) || typeof effect["note"] !== "string") {
            violations.push(`cases[${mutantId}].observed_undeclared_effects notes must be objects with string note`)
            effectsOk = false
            break
          }
          normalized.push({ note: effect["note"] })
        }
        if (effectsOk && normalized.length > 0) undeclared[mutantId] = normalized
      }
    }
  }

  let answerFree: ProtocolEvidence["authority_observations"] = null
  if (Object.prototype.hasOwnProperty.call(authority, "authority_observations")) {
    const top = authority["authority_observations"]
    if (top == null || !isRecord(top)) {
      violations.push("authority_observations must be an object")
    } else {
      if (typeof top["package_appeared_answer_free"] !== "boolean") {
        violations.push("authority_observations.package_appeared_answer_free must be boolean")
      }
      if (Object.prototype.hasOwnProperty.call(top, "notes") && top["notes"] !== undefined && typeof top["notes"] !== "string") {
        violations.push("authority_observations.notes must be a string when present")
      }
      if (violations.length === 0 && typeof top["package_appeared_answer_free"] === "boolean") {
        answerFree = {
          package_appeared_answer_free: top["package_appeared_answer_free"],
          class: SECOND_PARTY_OBSERVATION_ONLY,
          ...(typeof top["notes"] === "string" ? { notes: top["notes"] } : {}),
        }
      }
    }
  }

  if (violations.length > 0) {
    return { ok: false, reason: unknown && !duplicate ? "AUTHORITY_INCOMPLETE" : "AUTHORITY_AMBIGUOUS", violations }
  }
  return {
    ok: true,
    evidence: {
      claim_boundary: snapshotClaimBoundary(),
      claim_boundary_class: DECLARED_CONDITION_NOT_INDEPENDENTLY_VERIFIED,
      authority_observations: answerFree,
      definition_ambiguity_observations: ambiguity,
      observed_undeclared_effects: undeclared,
    },
  }
}

export function validateAuthorityObservationalMetadata(
  pkg: BlindProblemPackage,
  authority: AuthorityOraclePayload,
): AuthorityObservationValidation {
  return validateAndNormalizeAuthorityObservations(pkg, authority)
}

function evaluateIndependentGroundingCore(
  input: EvaluateProductionIndependentGroundingInput,
  observations: VerifiedPublicationObservations | null,
  synthetic_test_only: boolean,
): IndependentGroundingResult {
  const declared = caseIdsFromMap(input.pkg.cases)
  const packaged = caseIdsFromMap(input.pkg.cases)
  try {
    return evaluateIndependentGroundingCoreUnchecked(input, observations, synthetic_test_only, declared, packaged)
  } catch {
    return unproven(
      "AUTHORITY_AMBIGUOUS",
      "NOT_EVALUATED",
      "NOT_EVALUATED",
      closeCaseUniverse({ declared, packaged, authority: null, comparison: null }),
      false,
      input.pkg,
      emptyProtocolEvidence(),
    )
  }
}

function evaluateIndependentGroundingCoreUnchecked(
  input: EvaluateProductionIndependentGroundingInput,
  observations: VerifiedPublicationObservations | null,
  synthetic_test_only: boolean,
  declared: ReadonlySet<string>,
  packaged: ReadonlySet<string>,
): IndependentGroundingResult {
  const declaredInvariants = new Set(Object.keys(input.pkg.invariants))

  const faithfulness = checkBlindPackageFaithfulness(input.pkg, input.intended)
  let observationValidation: AuthorityObservationValidation =
    input.authority === null ? { ok: true, evidence: emptyProtocolEvidence() } : { ok: false, reason: "AUTHORITY_AMBIGUOUS", violations: ["observation validation failed closed"] }
  try {
    observationValidation =
      input.authority === null ? { ok: true, evidence: emptyProtocolEvidence() } : validateAndNormalizeAuthorityObservations(input.pkg, input.authority)
  } catch {
    observationValidation = { ok: false, reason: "AUTHORITY_AMBIGUOUS", violations: ["observation validation failed closed"] }
  }
  const evidence = observationValidation.ok ? observationValidation.evidence : emptyProtocolEvidence()

  if (!faithfulness.faithful) {
    const universe = closeCaseUniverse({
      declared,
      packaged,
      authority: null,
      comparison: null,
    })
    return unproven("PROBLEM_PACKAGE_NOT_FAITHFUL", "NOT_EVALUATED", "NOT_EVALUATED", universe, false, input.pkg, evidence)
  }

  if (input.authority === null) {
    const universe = closeCaseUniverse({
      declared,
      packaged,
      authority: null,
      comparison: null,
    })
    return unproven("AWAITING_INDEPENDENT_AUTHORITY", "ABSENT", "NOT_EVALUATED", universe, false, input.pkg, null)
  }

  if (!isRecord(input.authority)) {
    const universe = closeCaseUniverse({
      declared,
      packaged,
      authority: null,
      comparison: null,
    })
    return unproven("AUTHORITY_AMBIGUOUS", "NOT_EVALUATED", "NOT_EVALUATED", universe, false, input.pkg, emptyProtocolEvidence())
  }

  if (!observationValidation.ok) {
    const universe = closeCaseUniverse({
      declared,
      packaged,
      authority: isRecord(input.authority["cases"]) ? caseIdsFromMap(input.authority["cases"] as { readonly [id: string]: unknown }) : null,
      comparison: null,
    })
    return unproven(
      observationValidation.reason,
      "NOT_EVALUATED",
      "NOT_EVALUATED",
      universe,
      false,
      input.pkg,
      emptyProtocolEvidence(),
    )
  }

  if (input.authority.schema !== AUTHORITY_ORACLE_SCHEMA) {
    const universe = closeCaseUniverse({
      declared,
      packaged,
      authority: isRecord(input.authority.cases) ? caseIdsFromMap(input.authority.cases) : null,
      comparison: null,
    })
    return unproven("UNPROVEN_INDEPENDENCE", "INVALID_PROVENANCE", "NOT_EVALUATED", universe, false, input.pkg, evidence)
  }

  const oracleState = classifyVerifiedObservations(
    input.authority,
    input.generic_envelope,
    observations,
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
    return unproven("UNPROVEN_INDEPENDENCE", oracleState, "NOT_EVALUATED", universe, false, input.pkg, evidence)
  }

  const authorityIds = caseIdsFromMap(input.authority.cases)
  const parsed = new Map<string, ReadonlySet<string>>()
  let ambiguous = false
  let undeclaredAttribution = false
  for (const id of authorityIds) {
    const parsedSet = parseAttributionSet(input.authority.cases[id]?.derived_attribution_set)
    if (!parsedSet.ok) {
      ambiguous = true
      break
    }
    for (const invariantId of parsedSet.set) {
      if (!declaredInvariants.has(invariantId)) {
        undeclaredAttribution = true
      }
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
    return unproven("AUTHORITY_AMBIGUOUS", "VALID_PROVENANCE", "INCOMPLETE_OR_AMBIGUOUS", universe, synthetic_test_only, input.pkg, evidence)
  }

  const universeForCoverage = closeCaseUniverse({
    declared,
    packaged,
    authority: authorityIds,
    comparison: null,
  })
  if (!setsEqual(declared, authorityIds) || undeclaredAttribution) {
    return unproven(
      "AUTHORITY_INCOMPLETE",
      "VALID_PROVENANCE",
      "INCOMPLETE_OR_AMBIGUOUS",
      universeForCoverage,
      synthetic_test_only,
      input.pkg,
      evidence,
    )
  }

  // Comparison universe is derived from the closed declared/package/authority
  // set -- the gate compares exactly those ids, never a hand-counted subset.
  // Observational metadata is excluded from this equality.
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

  const declared_invariant_ids = sortedIdList(Object.keys(input.pkg.invariants))

  if (disagrees) {
    return {
      independent_grounding: "DISAGREED",
      independent_grounding_reason: "AUTHORITY_DISAGREEMENT",
      oracle_input_state: "VALID_PROVENANCE",
      semantic_relation: "DISAGREES",
      universe,
      declared_invariant_ids,
      synthetic_test_only,
      production_publishable: false,
      ...evidence,
    }
  }

  return {
    independent_grounding: "PROVEN",
    independent_grounding_reason: null,
    oracle_input_state: "VALID_PROVENANCE",
    semantic_relation: "AGREES",
    universe,
    declared_invariant_ids,
    synthetic_test_only,
    production_publishable: false,
    ...evidence,
  }
}

/**
 * Production entry: never accepts a provider outcome or verified
 * observations. Non-arrival is awaiting; any present authority without a
 * declared provider is invalid provenance. Never DISAGREED (absence is
 * not disagreement). Extra runtime fields such as provider_outcome are
 * ignored -- they cannot mint VALID_PROVENANCE on this path.
 */
export function evaluateProductionIndependentGrounding(
  input: EvaluateProductionIndependentGroundingInput,
): IndependentGroundingResult {
  return evaluateIndependentGroundingCore(input, null, false)
}

/**
 * TEST-ONLY evaluator. VALID_PROVENANCE is reachable only when `synthetic`
 * is an object previously issued by injectSyntheticVerifiedProvenance.
 * A caller-shaped { injection_kind: "synthetic_test_only" } literal is
 * not issued and cannot mint verified provenance.
 */
export function evaluateSyntheticIndependentGrounding(
  input: EvaluateProductionIndependentGroundingInput & { readonly synthetic: unknown },
): IndependentGroundingResult {
  const observations = observationsFromIssuedSynthetic(input.synthetic)
  return evaluateIndependentGroundingCore(input, observations, observations !== null)
}

/** This lane cannot mint production grounding evidence. Always null. */
export function asProductionGroundingEvidence(_result: IndependentGroundingResult): null {
  return null
}

export function isTseiRuntimeViolation(_result: IndependentGroundingResult): false {
  return false
}

export function claimBoundaryUnchanged(observed: unknown): boolean {
  return stableStringify(observed) === stableStringify(CANONICAL_CLAIM_BOUNDARY)
}

const ORACLE_COMMIT_DOMAIN = Buffer.from("TSEI-IA-COMMIT-v0", "ascii")
const COMMIT_SEP = Buffer.from([0])
const INSTANCE_ID_RE = /^[a-z0-9._-]+$/
const LOWER_HEX_64 = /^[0-9a-f]{64}$/

function asCommitmentBytes(value: unknown, label: string, reasons: string[], expectedLength?: number): Buffer | null {
  if (!(value instanceof Uint8Array)) {
    reasons.push(`${label}_not_bytes`)
    return null
  }
  const buf = Buffer.from(value)
  if (expectedLength !== undefined && buf.length !== expectedLength) {
    reasons.push(`${label}_length`)
    return null
  }
  if (expectedLength === undefined && buf.length === 0) {
    reasons.push(`${label}_empty`)
    return null
  }
  return buf
}

function validateOracleCommitmentParts(
  input: unknown,
): { ok: true; instance_id: string; digest: string; nonce: Buffer; oracle: Buffer } | { ok: false; reasons: string[] } {
  const reasons: string[] = []
  if (!isRecord(input)) return { ok: false, reasons: ["malformed_commitment_input"] }
  const instance_id = input["instance_id"]
  const digest = input["problem_package_sha256"]
  if (typeof instance_id !== "string" || !INSTANCE_ID_RE.test(instance_id)) reasons.push("invalid_instance_id")
  if (typeof digest !== "string" || !LOWER_HEX_64.test(digest)) reasons.push("invalid_problem_package_sha256")
  const nonce = asCommitmentBytes(input["nonce"], "nonce", reasons, 32)
  const oracle = asCommitmentBytes(input["oracle_bytes"], "oracle_bytes", reasons)
  if (reasons.length > 0 || typeof instance_id !== "string" || typeof digest !== "string" || !nonce || !oracle) {
    return { ok: false, reasons }
  }
  return { ok: true, instance_id, digest, nonce, oracle }
}

function commitmentPreimage(parts: { instance_id: string; digest: string; nonce: Buffer; oracle: Buffer }): Buffer {
  return Buffer.concat([
    ORACLE_COMMIT_DOMAIN,
    COMMIT_SEP,
    Buffer.from(parts.instance_id, "ascii"),
    COMMIT_SEP,
    Buffer.from(parts.digest, "ascii"),
    COMMIT_SEP,
    parts.nonce,
    COMMIT_SEP,
    parts.oracle,
  ])
}

export function computeOracleCommitment(
  input: unknown,
): { ok: true; commitment: string } | { ok: false; reasons: readonly string[] } {
  try {
    const parsed = validateOracleCommitmentParts(input)
    if (!parsed.ok) return parsed
    return { ok: true, commitment: sha256ExactBytes(commitmentPreimage(parsed)) }
  } catch {
    return { ok: false, reasons: ["malformed_commitment_input"] }
  }
}

export function verifyOracleCommitment(input: unknown): { ok: boolean; reasons: readonly string[] } {
  try {
    if (!isRecord(input)) return { ok: false, reasons: ["malformed_commitment_input"] }
    const computed = computeOracleCommitment(input)
    if (!computed.ok) return computed
    const commitment = input["commitment"]
    if (typeof commitment !== "string" || !LOWER_HEX_64.test(commitment)) {
      return { ok: false, reasons: ["invalid_commitment"] }
    }
    if (commitment !== computed.commitment) return { ok: false, reasons: ["commitment_mismatch"] }
    return { ok: true, reasons: [] }
  } catch {
    return { ok: false, reasons: ["malformed_commitment_input"] }
  }
}

function modelDryRunInsufficient(): Pick<
  ProviderDryRunResult,
  | "provider_policy_freezable"
  | "declared_provider_selection"
  | "selected_provider_pass"
  | "independently_verified_cross_log_bridge_established"
  | "caller_supplied_proof_material_verified"
  | "independent_provider_condition_established"
  | "sufficient_for_real_object_a"
  | "sufficient_for_proven_grounding"
  | "production_publishable"
> {
  return {
    provider_policy_freezable: false,
    declared_provider_selection: DECLARED_PROVIDER_SELECTION,
    selected_provider_pass: false,
    independently_verified_cross_log_bridge_established: false,
    caller_supplied_proof_material_verified: false,
    independent_provider_condition_established: false,
    sufficient_for_real_object_a: false,
    sufficient_for_proven_grounding: false,
    production_publishable: false,
  }
}

/**
 * In-memory model of dummy D0 < D1 < D2 checks. Caller-supplied strings are
 * not verified proofs. This function cannot freeze a provider policy and
 * cannot satisfy REAL_EXTERNAL_PROVIDER_DRY_RUN_PASS.
 */
export function evaluateProviderDryRun(input: ProviderDryRunInput): ProviderDryRunResult {
  const reasons: string[] = []
  const events = isRecord(input) ? input.events : undefined
  const D0 = isRecord(events) ? events["D0"] : undefined
  const D1 = isRecord(events) ? events["D1"] : undefined
  const D2 = isRecord(events) ? events["D2"] : undefined
  if (!isRecord(D0) || !isRecord(D1) || !isRecord(D2) || D0["kind"] !== "D0" || D1["kind"] !== "D1" || D2["kind"] !== "D2") {
    reasons.push("dummy event kinds must be D0, D1, D2")
  } else {
    const d0 = D0 as unknown as ProviderDryRunInput["events"]["D0"]
    const d1 = D1 as unknown as ProviderDryRunInput["events"]["D1"]
    const d2 = D2 as unknown as ProviderDryRunInput["events"]["D2"]
    if (!(d0.ordering_index < d1.ordering_index && d1.ordering_index < d2.ordering_index)) {
      reasons.push("wrong event order: required D0 < D1 < D2 under the frozen ordering policy")
    }
    for (const event of [d0, d1, d2]) {
      if (event.originator_identity !== input.expected_originator_identity) {
        reasons.push("wrong Originator identity")
      }
      if (event.authority_identity !== input.expected_authority_identity) {
        reasons.push("wrong Authority identity")
      }
      if (event.artifact_digest !== input.expected_artifact_digest) {
        reasons.push("corrupted artifact digest")
      }
      if (event.proof_material !== input.expected_proof_material) {
        reasons.push("caller-supplied proof material does not match expected dummy material")
      }
      if (event.provider_id !== input.expected_provider_id) {
        reasons.push("wrong provider/log identity")
      }
    }
    const logs = new Set([d0.log_identity, d1.log_identity, d2.log_identity])
    if (logs.size !== 1) {
      reasons.push("cross-log/shard ordering without an independently verified bridge")
    }
    if (![d0, d1, d2].every((event) => event.log_identity === input.expected_log_identity)) {
      reasons.push("wrong provider/log identity")
    }
    if (input.expected_originator_identity === input.expected_authority_identity) {
      reasons.push("Originator and Authority identities are not distinct; model cannot establish independent-provider condition")
    }
  }
  if (input.independently_verified_cross_log_bridge === true) {
    reasons.push("caller-asserted independently_verified_cross_log_bridge is not an independently verified bridge")
  }
  reasons.push("evaluateProviderDryRun is an in-memory model and cannot mint a selected-provider pass")
  const uniqueReasons = [...new Set(reasons)]
  const modelShapeOk = !uniqueReasons.some(
    (reason) =>
      reason.startsWith("dummy event") ||
      reason.startsWith("wrong event order") ||
      reason.startsWith("wrong Originator") ||
      reason.startsWith("wrong Authority") ||
      reason.startsWith("corrupted artifact") ||
      reason.startsWith("caller-supplied proof") ||
      reason.startsWith("wrong provider/log") ||
      reason.startsWith("cross-log/shard") ||
      reason.startsWith("Originator and Authority identities"),
  )
  return {
    ok: modelShapeOk,
    model_checks_pass: modelShapeOk,
    reasons: uniqueReasons,
    ordering_policy: "D0_lt_D1_lt_D2",
    ...modelDryRunInsufficient(),
  }
}

export {
  evaluateProviderPolicyFreeze,
  lookupFromRekorDocuments,
  providerPolicySha256,
  verifyRekorV1OrderedEvents,
  verifyRekorV1Publication,
} from "./rekor-v1-verifier"
