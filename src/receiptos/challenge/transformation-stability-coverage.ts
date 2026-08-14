/**
 * ReceiptOS Closed-World Profile Coverage v0.
 *
 * Additive, generic layer. Does not modify transformation-stability.ts,
 * transformation-stability-cycle.ts, or any existing profile. Every export
 * here is new; nothing exported elsewhere changes shape or behavior.
 *
 * Authority mode: reactive_coverage. There is no authoritative Chronicle
 * runtime schema/validator in this repository, so the universe below is
 *
 *   U_runtime = observed_paths(canonical(source)) UNION observed_paths(canonical(target))
 *
 * only -- no third, schema-sourced term. This module must never claim
 * schema-total or proactive optional-field coverage; it only guarantees
 * that any path actually observed on either side of a given evaluation is
 * mechanically classified, with every unclassified observed path failing
 * closed into F.
 *
 * Canonicalization is reused, not reinvented: leaf values are compared via
 * canonicalIdentityJson (the same strict comparator the generic evaluator
 * already uses for projection equality). This module adds a structural
 * *path walker* -- a new capability, since canonicalize()/canonicalIdentityJson
 * only serialize a whole value, they do not enumerate paths -- but the
 * walker's own traversal rules (object keys sorted, arrays terminate as
 * leaves) mirror canonicalize()'s existing rules rather than inventing new
 * ones.
 */

import { canonicalIdentityJson } from "./counterfactual-neighborhood"
import {
  evaluateTransformationStabilityV0,
  type AuthenticatedTransformationProfileV0,
  type HistorySensitivePolicyV0,
  type TransformationStabilityClassificationV0,
  type TransformationStabilityResultV0,
} from "./transformation-stability"

export const COVERAGE_PROFILE_CLAIM_V0 = "closed_world_reactive_coverage_v0" as const

// ---------------------------------------------------------------------------
// Selector grammar (locked):
//
//   selector        = [ side_qualifier "::" ] path_expr ;
//   side_qualifier  = "source" | "target" ;
//   path_expr       = exact_path | deep_wildcard ;
//   exact_path      = segment { "." segment } ;
//   deep_wildcard   = segment { "." segment } "." "**" | "**" ;
//   segment         = letter { letter | digit | "_" } ;
//
// No single-segment "*". No array indices. No bracket syntax. No raw byte
// offsets. No iteration-order dependence (segments are matched against the
// sorted structural walk below, never raw object insertion order).
// ---------------------------------------------------------------------------

export type CoverageSideV0 = "source" | "target"
export type CoverageClassV0 = "N" | "S" | "A" | "F"

export type ParsedCoverageSelectorV0 = {
  readonly raw: string
  readonly side: CoverageSideV0 | null
  readonly segments: readonly string[]
  readonly wildcard: boolean
}

export type SelectorParseResultV0 =
  | { readonly ok: true; readonly selector: ParsedCoverageSelectorV0 }
  | { readonly ok: false; readonly reason: string }

const SEGMENT_RE = /^[A-Za-z][A-Za-z0-9_]*$/

export function parseCoverageSelectorV0(raw: string): SelectorParseResultV0 {
  if (typeof raw !== "string" || raw.length === 0) {
    return { ok: false, reason: `empty_selector:${JSON.stringify(raw)}` }
  }

  let side: CoverageSideV0 | null = null
  let rest = raw
  const sideMatch = /^(source|target)::([\s\S]+)$/.exec(raw)
  if (sideMatch) {
    side = sideMatch[1] as CoverageSideV0
    rest = sideMatch[2]!
  } else if (raw.includes("::")) {
    return { ok: false, reason: `malformed_side_qualifier:${raw}` }
  }

  if (rest.length === 0) return { ok: false, reason: `empty_path:${raw}` }

  const parts = rest.split(".")
  const wildcard = parts[parts.length - 1] === "**"
  const segments = wildcard ? parts.slice(0, -1) : parts

  for (const segment of segments) {
    if (!SEGMENT_RE.test(segment)) {
      return { ok: false, reason: `malformed_segment:${JSON.stringify(segment)}:${raw}` }
    }
  }

  return { ok: true, selector: { raw, side, segments, wildcard } }
}

function selectorMatchesPath(selector: ParsedCoverageSelectorV0, pathSegments: readonly string[]): boolean {
  if (selector.wildcard) {
    if (selector.segments.length > pathSegments.length) return false
    return selector.segments.every((segment, index) => pathSegments[index] === segment)
  }
  return (
    selector.segments.length === pathSegments.length &&
    selector.segments.every((segment, index) => pathSegments[index] === segment)
  )
}

function selectorKey(selector: ParsedCoverageSelectorV0): string {
  return `${selector.side ?? ""}::${selector.segments.join(".")}${selector.wildcard ? ".**" : ""}`
}

// ---------------------------------------------------------------------------
// Coverage profile declaration + validation. C_F is never author-declared --
// only N/S/A may be targeted by a declaration; F is always the derived
// complement (see runCoveragePlaneV0 below).
// ---------------------------------------------------------------------------

export type CoverageDeclarationInputV0 = {
  readonly selector: string
  readonly targetClass: "N" | "S" | "A"
}

export type CoverageProfileInputV0 = {
  readonly same_type: boolean
  readonly history_sensitive_policy: HistorySensitivePolicyV0
  readonly declarations: readonly CoverageDeclarationInputV0[]
  readonly value_normalizers?: Readonly<Record<string, (value: unknown) => unknown>>
}

type ParsedDeclarationV0 = {
  readonly selector: ParsedCoverageSelectorV0
  readonly targetClass: "N" | "S" | "A"
}

export type CoverageProfileV0 = {
  readonly __coverageBrand: "CoverageProfileV0"
  readonly coverage_claim: typeof COVERAGE_PROFILE_CLAIM_V0
  readonly same_type: boolean
  readonly history_sensitive_policy: HistorySensitivePolicyV0
  readonly declarations: readonly ParsedDeclarationV0[]
  readonly value_normalizers: Readonly<Record<string, (value: unknown) => unknown>>
}

export type CoverageProfileValidationFailureV0 = {
  readonly ok: false
  readonly reasons: readonly string[]
}

export type CoverageProfileValidationResultV0 =
  | { readonly ok: true; readonly profile: CoverageProfileV0 }
  | CoverageProfileValidationFailureV0

export class CoverageProfileContractErrorV0 extends Error {
  readonly code = "coverage_profile_contract_error_v0" as const
  readonly reasons: readonly string[]

  constructor(reasons: readonly string[]) {
    super("closed-world coverage profile contract v0 failed")
    this.name = "CoverageProfileContractErrorV0"
    this.reasons = reasons
  }
}

/**
 * Validates and brands a coverage profile. Never throws -- returns a typed
 * failure so callers (and tests) can inspect reasons without a try/catch.
 * A malformed profile can never reach evaluateTransformationStabilityWithCoverageV0:
 * that function's signature only accepts the branded CoverageProfileV0 this
 * constructor produces on success.
 */
export function defineCoverageProfileV0(input: CoverageProfileInputV0): CoverageProfileValidationResultV0 {
  const reasons: string[] = []
  const parsed: ParsedDeclarationV0[] = []

  for (const declaration of input.declarations) {
    const result = parseCoverageSelectorV0(declaration.selector)
    if (!result.ok) {
      reasons.push(`selector_parse_error:${result.reason}`)
      continue
    }
    const selector = result.selector

    if (input.same_type && selector.side !== null) {
      reasons.push(`side_qualifier_illegal_in_same_type_profile:${selector.raw}`)
    }
    if (!input.same_type && selector.side === null) {
      reasons.push(`side_qualifier_required_in_cross_type_profile:${selector.raw}`)
    }
    if (declaration.targetClass === "A" && selector.wildcard) {
      reasons.push(`wildcard_forbidden_in_A:${selector.raw}`)
    }
    if (declaration.targetClass === "S" && selector.wildcard && input.history_sensitive_policy !== "violation") {
      reasons.push(`wildcard_forbidden_in_S_unless_history_sensitive_policy_is_violation:${selector.raw}`)
    }

    parsed.push({ selector, targetClass: declaration.targetClass })
  }

  // Conflict rule: two declarations of identical specificity (same side,
  // same segments, same wildcard-ness -- i.e. an identical normalized
  // selector key) that disagree on class are unresolvable. Identical
  // key + identical class is redundant, not an error.
  const byKey = new Map<string, Set<CoverageClassV0>>()
  for (const decl of parsed) {
    const key = selectorKey(decl.selector)
    const classes = byKey.get(key) ?? new Set<CoverageClassV0>()
    classes.add(decl.targetClass)
    byKey.set(key, classes)
  }
  for (const [key, classes] of byKey) {
    if (classes.size > 1) {
      reasons.push(`conflicting_selector_classes:${key}:${[...classes].sort().join(",")}`)
    }
  }

  for (const path of Object.keys(input.value_normalizers ?? {})) {
    const result = parseCoverageSelectorV0(path)
    if (!result.ok || result.selector.wildcard) {
      reasons.push(`value_normalizer_key_must_be_exact_selector:${path}`)
    }
  }

  if (reasons.length > 0) return { ok: false, reasons }

  return {
    ok: true,
    profile: Object.freeze({
      __coverageBrand: "CoverageProfileV0" as const,
      coverage_claim: COVERAGE_PROFILE_CLAIM_V0,
      same_type: input.same_type,
      history_sensitive_policy: input.history_sensitive_policy,
      declarations: Object.freeze(parsed),
      value_normalizers: Object.freeze({ ...(input.value_normalizers ?? {}) }),
    }),
  }
}

// ---------------------------------------------------------------------------
// Structural walk. Mirrors canonicalize()'s own rules (object keys sorted,
// no re-normalization) but is a distinct capability: a *path enumerator*,
// not a second serializer. Rules:
//   - nested objects recurse by named key (sorted, for deterministic order)
//   - arrays terminate decomposition and are whole-array leaf atoms
//   - no per-index array paths are ever produced
//   - a key whose value is `undefined` is treated as absent, matching the
//     existing canonicalize() convention (which silently drops such keys)
//   - `null` is a present leaf value, distinct from absent
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function walkStructuralV0(value: unknown, prefix: string, out: Map<string, unknown>): void {
  if (Array.isArray(value)) {
    if (prefix.length > 0) out.set(prefix, value)
    return
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort()
    for (const key of keys) {
      const childValue = value[key]
      if (childValue === undefined) continue
      const childPath = prefix.length > 0 ? `${prefix}.${key}` : key
      walkStructuralV0(childValue, childPath, out)
    }
    return
  }
  if (prefix.length > 0) out.set(prefix, value)
}

export function observedLeafPathsV0(root: unknown): Map<string, unknown> {
  const out = new Map<string, unknown>()
  walkStructuralV0(root, "", out)
  return out
}

// ---------------------------------------------------------------------------
// Coverage atom + comparison.
// ---------------------------------------------------------------------------

export type CoverageAtomV0 = { readonly present: false } | { readonly present: true; readonly canonical: string }

function buildAtom(leafValue: unknown, present: boolean): CoverageAtomV0 {
  if (!present) return { present: false }
  return { present: true, canonical: canonicalIdentityJson(leafValue) }
}

function atomsEqual(a: CoverageAtomV0, b: CoverageAtomV0): boolean {
  if (a.present !== b.present) return false
  if (!a.present) return true
  return a.canonical === (b as { present: true; canonical: string }).canonical
}

// ---------------------------------------------------------------------------
// Classification: resolves the coverage class for one observed path against
// a validated profile's declarations. Precedence: exact beats any matching
// wildcard; among matching wildcards, the longest segment prefix wins.
// Because defineCoverageProfileV0 already rejects identical-specificity
// conflicts, a single deterministic winner is always resolvable here.
// ---------------------------------------------------------------------------

function classifyPathV0(
  declarations: readonly ParsedDeclarationV0[],
  side: CoverageSideV0 | null,
  pathSegments: readonly string[],
): { readonly targetClass: CoverageClassV0; readonly matchedSelector: string | null } {
  const matches = declarations.filter(
    (decl) => (decl.selector.side === null || decl.selector.side === side) && selectorMatchesPath(decl.selector, pathSegments),
  )
  if (matches.length === 0) return { targetClass: "F", matchedSelector: null }

  const exact = matches.filter((m) => !m.selector.wildcard)
  if (exact.length > 0) {
    const winner = exact[0]!
    return { targetClass: winner.targetClass, matchedSelector: winner.selector.raw }
  }

  const longest = matches.reduce((best, m) => (m.selector.segments.length > best.selector.segments.length ? m : best))
  return { targetClass: longest.targetClass, matchedSelector: longest.selector.raw }
}

// ---------------------------------------------------------------------------
// Coverage plane evaluation.
// ---------------------------------------------------------------------------

export type CoveragePathReportV0 = {
  readonly path: string
  readonly targetClass: CoverageClassV0
  readonly matchedSelector: string | null
  readonly sourcePresent: boolean
  readonly targetPresent: boolean
  readonly match: boolean
}

export type TransformationStabilityCoverageReportV0 = {
  readonly universe_size: number
  readonly classified_n: number
  readonly classified_s: number
  readonly classified_a: number
  readonly derived_f: number
  readonly normative_mismatch_paths: readonly string[]
  readonly forbidden_mismatch_paths: readonly string[]
  readonly stability_mismatch_paths: readonly string[]
  readonly allowed_mismatch_paths: readonly string[]
  readonly paths: readonly CoveragePathReportV0[]
}

function normalizeForPath(profile: CoverageProfileV0, path: string, value: unknown): unknown {
  const normalizer = profile.value_normalizers[path]
  return normalizer ? normalizer(value) : value
}

export function runCoveragePlaneV0(
  profile: CoverageProfileV0,
  source: unknown,
  target: unknown,
): TransformationStabilityCoverageReportV0 {
  const sourceLeaves = observedLeafPathsV0(source)
  const targetLeaves = observedLeafPathsV0(target)
  const allPaths = new Set<string>([...sourceLeaves.keys(), ...targetLeaves.keys()])

  const paths: CoveragePathReportV0[] = []
  let n = 0
  let s = 0
  let a = 0
  let f = 0
  const nMismatch: string[] = []
  const fMismatch: string[] = []
  const sMismatch: string[] = []
  const aMismatch: string[] = []

  for (const path of [...allPaths].sort()) {
    const segments = path.split(".")
    const sourcePresent = sourceLeaves.has(path)
    const targetPresent = targetLeaves.has(path)
    const sourceAtom = buildAtom(sourcePresent ? normalizeForPath(profile, path, sourceLeaves.get(path)) : undefined, sourcePresent)
    const targetAtom = buildAtom(targetPresent ? normalizeForPath(profile, path, targetLeaves.get(path)) : undefined, targetPresent)
    const match = atomsEqual(sourceAtom, targetAtom)

    // Same-type profiles use one shared, side-neutral path space; cross-type
    // profiles are out of scope for this pilot but the classification call
    // is side-aware for forward compatibility.
    const { targetClass, matchedSelector } = classifyPathV0(profile.declarations, null, segments)

    if (targetClass === "N") {
      n += 1
      if (!match) nMismatch.push(path)
    } else if (targetClass === "S") {
      s += 1
      if (!match) sMismatch.push(path)
    } else if (targetClass === "A") {
      a += 1
      if (!match) aMismatch.push(path)
    } else {
      f += 1
      if (!match) fMismatch.push(path)
    }

    paths.push({ path, targetClass, matchedSelector, sourcePresent, targetPresent, match })
  }

  return {
    universe_size: allPaths.size,
    classified_n: n,
    classified_s: s,
    classified_a: a,
    derived_f: f,
    normative_mismatch_paths: nMismatch,
    forbidden_mismatch_paths: fMismatch,
    stability_mismatch_paths: sMismatch,
    allowed_mismatch_paths: aMismatch,
    paths,
  }
}

// ---------------------------------------------------------------------------
// Composition with the existing, unmodified generic evaluator.
//
// Run order: (1) profile validity is already guaranteed by construction --
// only a branded CoverageProfileV0 can reach this function; (2) the
// existing evaluateTransformationStabilityV0 runs completely unmodified and
// produces `base`; (3) the coverage plane runs, using its own independent
// call to profile.transform to obtain the same target instance. transform
// is deterministic/pure across every profile in this codebase, so this
// redundant second call always agrees with the one
// evaluateTransformationStabilityV0 already made internally, and is cheap.
// Composition is escalate-only: coverage can turn a milder base
// classification into "violation", never the reverse.
// ---------------------------------------------------------------------------

export type TransformationStabilityWithCoverageResultV0 = {
  readonly base: TransformationStabilityResultV0
  readonly coverage: TransformationStabilityCoverageReportV0 | null
  readonly classification: TransformationStabilityClassificationV0
  readonly escalated_by_coverage: boolean
  readonly coverage_escalation_reason: string | null
}

export async function evaluateTransformationStabilityWithCoverageV0<TSource, TTarget, TResult>(
  coverageProfile: CoverageProfileV0,
  transformationProfile: AuthenticatedTransformationProfileV0<TSource, TTarget, TResult>,
  source: TSource,
): Promise<TransformationStabilityWithCoverageResultV0> {
  const base = await evaluateTransformationStabilityV0(transformationProfile, source)

  if (base.classification === "out_of_domain" || base.classification === "unresolved") {
    return { base, coverage: null, classification: base.classification, escalated_by_coverage: false, coverage_escalation_reason: null }
  }

  let target: TTarget
  try {
    target = await transformationProfile.transform(source)
  } catch {
    return { base, coverage: null, classification: base.classification, escalated_by_coverage: false, coverage_escalation_reason: null }
  }

  const coverage = runCoveragePlaneV0(coverageProfile, source, target)

  const nEscalate = coverage.normative_mismatch_paths.length > 0
  const fEscalate = coverage.forbidden_mismatch_paths.length > 0
  const shouldEscalate = base.classification !== "violation" && (nEscalate || fEscalate)

  return {
    base,
    coverage,
    classification: shouldEscalate ? "violation" : base.classification,
    escalated_by_coverage: shouldEscalate,
    coverage_escalation_reason: shouldEscalate
      ? nEscalate
        ? `coverage_normative_mismatch:${coverage.normative_mismatch_paths.join(",")}`
        : `coverage_forbidden_mismatch:${coverage.forbidden_mismatch_paths.join(",")}`
      : null,
  }
}
