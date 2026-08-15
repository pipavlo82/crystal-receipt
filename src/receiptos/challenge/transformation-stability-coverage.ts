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
 *
 * Value normalization (for whole-array leaf atoms whose declared coverage
 * semantics are order-insensitive) never accepts an inline function.
 * Coverage classification, a normalizer's declared equivalence relation,
 * and a normalizer's implementation are three separate concerns -- a
 * profile may only reference an authenticated `normalizer_id`, resolved
 * against a `normalizer_authority` the profile author supplies explicitly
 * (see `NormalizerAuthorityV0`, imported type-only from
 * transformation-stability-coverage-normalizer-authority.ts). That module,
 * not this one, owns constructing and validating an authority; this
 * module only trusts a branded authority object and additionally
 * cross-checks that the entry an authority returns for a requested ID
 * actually carries that same ID (`entry.normalizer_id === normalizerId`)
 * before using its implementation -- defense in depth against an
 * authority object that was not honestly built through that module's own
 * constructor. This module has no default, implicit, or ReceiptOS-
 * specific authority of its own, and needs no runtime import of the
 * authority module at all (the import below is type-only, erased at
 * build time): a profile that declares no `value_normalizers` needs no
 * authority at all, and a profile that does needs whatever authority its
 * caller injects -- generic or domain-specific, this module cannot tell
 * the difference and does not try to. The ReceiptOS Chronicle Portfolio
 * pilot binds this to its own closed authority
 * (transformation-stability-coverage-normalizer-registry.ts) explicitly,
 * at the call site, exactly like every other adapter-supplied function on
 * a coverage or transformation profile. An unreviewed inline normalizer
 * remains forbidden regardless of authority: it would be a value-level
 * reopening of the exact same omission/fail-open class this whole layer
 * exists to close at the path level. A naked resolver *function* (this
 * module's first, since-repaired cut at dependency injection) is likewise
 * no longer accepted -- see transformation-stability-coverage-normalizer-
 * authority.ts's header comment for why a bare closure was itself a
 * reopened trust hole.
 *
 * Generic artifact structural contract (v0, frozen; no new schema
 * machinery is introduced to enforce it -- it is enforced entirely by the
 * existing comparator/walker validation already described above):
 *   - an artifact evaluated by this module MUST be representable in the
 *     comparator/path-walker value domain (null, boolean, finite number,
 *     string, array, or plain object -- the same domain
 *     canonicalIdentityJson accepts);
 *   - objects MAY nest objects to any depth; the walker recurses;
 *   - arrays are accepted only as whole-array atoms in this version --
 *     never decomposed into per-index paths (see the structural walk
 *     section below);
 *   - a value the comparator cannot represent (a non-finite number, an
 *     undefined-equivalent value reachable from an array element) fails
 *     evaluation -- as `unresolved`, per the evaluation-time-failure rule
 *     in evaluateTransformationStabilityWithCoverageV0 below -- rather
 *     than being silently accepted or silently dropped;
 *   - an artifact bundle (a plain object or array grouping several
 *     domain sub-artifacts) is an ordinary structured value under this
 *     contract, not a separate protocol-level type -- this module has no
 *     bundle-specific code path;
 *   - relationship semantics among bundled sub-artifacts remain entirely
 *     adapter-authored: nothing here mechanically derives or enforces a
 *     cross-artifact invariant a binding did not declare.
 */

import { canonicalIdentityJson } from "./canonical-identity-json"
import type { NormalizerAuthorityV0 } from "./transformation-stability-coverage-normalizer-authority"
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
  // Locked to `true` (same-type profiles only) -- see the
  // cross_type_coverage_not_supported_in_v0 rejection in
  // defineCoverageProfileV0 below for why: runCoveragePlaneV0 does not
  // thread a per-path source/target side into classifyPathV0 (it always
  // classifies with side=null), so a side-qualified cross-type
  // declaration set would silently fail to match anything and every
  // observed path would derive to F -- not merely unverified, actively
  // unsafe. This field is retained (rather than removed outright) so a
  // future version can reintroduce cross-type support without changing
  // this shape again.
  readonly same_type: true
  readonly history_sensitive_policy: HistorySensitivePolicyV0
  readonly declarations: readonly CoverageDeclarationInputV0[]
  // Authenticated normalizer_id strings ONLY -- never a function. This is
  // the TypeScript-level half of "inline functions must fail"; see
  // defineCoverageProfileV0 for the runtime backstop that also rejects a
  // non-string value smuggled in via `any`/a cast.
  readonly value_normalizers?: Readonly<Record<string, string>>
  // Explicit, caller-supplied authority for resolving the normalizer_id
  // strings above -- a validated, branded NormalizerAuthorityV0 (see
  // transformation-stability-coverage-normalizer-authority.ts), never a
  // bare resolver function. Optional: a profile with no value_normalizers
  // needs no authority at all. A profile that references a normalizer_id
  // with no authority supplied fails closed, identically to an unknown ID.
  readonly normalizer_authority?: NormalizerAuthorityV0
}

type ParsedDeclarationV0 = {
  readonly selector: ParsedCoverageSelectorV0
  readonly targetClass: "N" | "S" | "A"
}

export type ResolvedNormalizerV0 = {
  readonly normalizerId: string
  readonly apply: (value: unknown) => unknown
}

export type CoverageProfileV0 = {
  readonly __coverageBrand: "CoverageProfileV0"
  readonly coverage_claim: typeof COVERAGE_PROFILE_CLAIM_V0
  readonly same_type: true
  readonly history_sensitive_policy: HistorySensitivePolicyV0
  readonly declarations: readonly ParsedDeclarationV0[]
  readonly value_normalizers: Readonly<Record<string, ResolvedNormalizerV0>>
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

  // Runtime backstop for the same_type:true type lock above -- a caller
  // reaching this through `any`/a cast/plain JS could still smuggle in
  // `false`. Rejected unconditionally, before any declaration is
  // inspected: cross-type coverage is not merely unverified in v0, it is
  // actively unsafe (see the field comment on CoverageProfileInputV0), so
  // this is a narrowing of what was previously silently accepted, not a
  // new restriction invented for its own sake.
  if (input.same_type !== true) {
    reasons.push("cross_type_coverage_not_supported_in_v0")
  }

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

  // The supplied authority, if any, must be a genuinely branded
  // NormalizerAuthorityV0 -- not a plain object/closure shaped to look
  // like one. A forged/malformed authority is treated as no authority at
  // all for every normalizer_id lookup below, so it fails exactly like an
  // unauthenticated ID rather than partially succeeding.
  const suppliedAuthority = input.normalizer_authority
  if (suppliedAuthority !== undefined && suppliedAuthority.__brand !== "NormalizerAuthorityV0") {
    reasons.push("normalizer_authority_not_authenticated")
  }
  const authority = suppliedAuthority?.__brand === "NormalizerAuthorityV0" ? suppliedAuthority : undefined

  const resolvedNormalizers: Record<string, ResolvedNormalizerV0> = {}
  for (const [path, normalizerId] of Object.entries(input.value_normalizers ?? {})) {
    // Runtime backstop: even though CoverageProfileInputV0 types this as
    // `string`, a caller reaching this through `any`/a cast/plain JS could
    // still smuggle in a function. Reject it explicitly rather than letting
    // it flow through as a truthy, non-string "normalizer_id".
    if (typeof normalizerId !== "string") {
      reasons.push(`value_normalizer_must_be_authenticated_id_string_not_inline_function:${path}`)
      continue
    }

    const result = parseCoverageSelectorV0(path)
    if (!result.ok || result.selector.wildcard) {
      reasons.push(`value_normalizer_key_must_be_exact_selector:${path}`)
      continue
    }
    const selector = result.selector

    // No default/implicit authority: a normalizer_id can only be
    // authenticated if this profile's own caller supplied one. A missing
    // authority and an unrecognized ID are deliberately the same failure
    // -- both mean "this module cannot vouch for this ID."
    const authorityEntry = authority?.resolve(normalizerId)
    if (!authorityEntry) {
      reasons.push(`unauthenticated_normalizer_id:${normalizerId}`)
      continue
    }

    // Defense in depth: even a branded authority must return an entry
    // whose own declared normalizer_id matches the ID that was actually
    // requested. This is what makes "profile selects identity; authority
    // assigns meaning to that identity" a checked invariant rather than a
    // convention an authority implementation could silently violate --
    // an authority that returns entry A for requested ID B fails closed
    // here, never silently substituting A's implementation for B.
    if (authorityEntry.normalizer_id !== normalizerId) {
      reasons.push(`normalizer_authority_id_mismatch:${path}:requested=${normalizerId}:returned=${authorityEntry.normalizer_id}`)
      continue
    }

    // The normalized value only ever feeds an N/S/A comparison, never F --
    // so the path must already carry an exact (non-wildcard) N/S/A
    // declaration. A normalizer on an unclassified path would be silently
    // inert (F is never normalized), which is exactly the kind of
    // author-omission failure this whole layer exists to catch, not hide.
    const targetKey = selectorKey(selector)
    const classifiesTarget = parsed.some(
      (decl) => !decl.selector.wildcard && selectorKey(decl.selector) === targetKey,
    )
    if (!classifiesTarget) {
      reasons.push(`normalizer_target_path_not_classified:${path}`)
      continue
    }

    resolvedNormalizers[path] = Object.freeze({ normalizerId, apply: authorityEntry.implementation })
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
      value_normalizers: Object.freeze(resolvedNormalizers),
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
  return normalizer ? normalizer.apply(value) : value
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

  // Evaluation-time failure => unresolved, matching the rule the flat
  // evaluator already enforces for its own declared procedures (Section 6
  // of the generic specification). A profile that reaches this point is
  // already authenticated (only a branded CoverageProfileV0 can arrive
  // here) -- construction/profile-authentication failure is a wholly
  // separate, earlier concern (defineCoverageProfileV0's typed
  // ok:false result) and is never collapsed into this unresolved case.
  // What can still throw here, at runtime, on an otherwise-valid profile:
  // a non-finite number or an undefined-valued array element surfacing
  // during the observed structural walk's atom comparison (the walker
  // itself never throws -- see observedLeafPathsV0 -- only the comparator
  // does, downstream, when an atom is actually built), or a normalizer
  // implementation throwing.
  let coverage: TransformationStabilityCoverageReportV0
  try {
    coverage = runCoveragePlaneV0(coverageProfile, source, target)
  } catch {
    return { base, coverage: null, classification: "unresolved", escalated_by_coverage: false, coverage_escalation_reason: null }
  }

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
