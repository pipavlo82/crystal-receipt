/**
 * Generic normalizer authority v0.
 *
 * Repairs a defect in the first cut of dependency injection for
 * transformation-stability-coverage.ts's value normalizers: a naked
 * `(normalizerId: string) => { implementation } | undefined` resolver
 * closure let any caller attach an arbitrary implementation to an
 * otherwise-valid normalizer_id, recreating the exact inline-normalizer
 * trust hole this whole mechanism exists to close, just one layer lower
 * (in the resolver closure, instead of directly in `value_normalizers`).
 *
 * The fix is a structural separation, enforced by this module:
 *
 *   profile declaration   -- selects an identity (a normalizer_id string)
 *   normalizer authority  -- assigns meaning to that identity
 *   normalizer implementation -- the reused, unmodified code an authority
 *                                 entry points to
 *
 * A normalizer authority is not a bare function. It is a validated,
 * branded, immutable object, constructed only via
 * defineNormalizerAuthorityV0 below -- which checks structural
 * well-formedness (duplicate ID rejection, entry shape) once, at
 * construction, and returns entries whose Map-backed storage makes
 * `resolve(id)` structurally incapable of returning an entry for any ID
 * other than the one it was stored under.
 *
 * transformation-stability-coverage.ts consumes only a branded
 * NormalizerAuthorityV0's `resolve` method, and additionally cross-checks
 * that the entry an authority returns actually carries the ID that was
 * requested (`entry.normalizer_id === normalizerId`) before trusting it --
 * defense in depth against an authority object that is not honestly
 * constructed through this module's own constructor (e.g. a hand-rolled
 * object that merely forges the `__brand` tag).
 *
 * This module has no default/implicit registry of its own and no
 * ReceiptOS/Chronicle import. The generic core does not need to prove an
 * authority's domain semantics -- `equivalence_kind` is an opaque,
 * non-empty string here; what it means is entirely the embedding domain's
 * concern, authenticated by that domain's own conformance evidence (see
 * transformation-stability-coverage-normalizer-registry.ts for the
 * ReceiptOS binding, and its equivalence vectors for that evidence).
 */

export type NormalizerAuthorityEntryV0 = {
  readonly normalizer_id: string
  readonly equivalence_kind: string
  readonly implementation: (value: unknown) => unknown
}

export type NormalizerAuthorityV0 = {
  readonly __brand: "NormalizerAuthorityV0"
  readonly authority_id: string
  readonly authority_version: string
  resolve(normalizerId: string): NormalizerAuthorityEntryV0 | undefined
}

export type NormalizerAuthorityInputV0 = {
  readonly authority_id: string
  readonly authority_version: string
  readonly entries: readonly NormalizerAuthorityEntryV0[]
}

export type NormalizerAuthorityValidationFailureV0 = {
  readonly ok: false
  readonly reasons: readonly string[]
}

export type NormalizerAuthorityValidationResultV0 =
  | { readonly ok: true; readonly authority: NormalizerAuthorityV0 }
  | NormalizerAuthorityValidationFailureV0

export const NORMALIZER_AUTHORITY_BRAND_V0 = "NormalizerAuthorityV0" as const

/**
 * Validates and brands a normalizer authority. Never throws -- returns a
 * typed failure so callers (and tests) can inspect reasons without a
 * try/catch, matching this file's own defineCoverageProfileV0 convention.
 * A malformed authority can never reach a coverage profile: only a
 * branded NormalizerAuthorityV0 this constructor produces on success has
 * the right shape, and transformation-stability-coverage.ts additionally
 * checks the brand tag at profile-validation time before trusting one.
 */
export function defineNormalizerAuthorityV0(input: NormalizerAuthorityInputV0): NormalizerAuthorityValidationResultV0 {
  const reasons: string[] = []

  if (typeof input.authority_id !== "string" || input.authority_id.length === 0) {
    reasons.push("authority_id_missing")
  }
  if (typeof input.authority_version !== "string" || input.authority_version.length === 0) {
    reasons.push("authority_version_missing")
  }

  const entries = new Map<string, NormalizerAuthorityEntryV0>()
  for (const entry of input.entries) {
    if (typeof entry?.normalizer_id !== "string" || entry.normalizer_id.length === 0) {
      reasons.push("normalizer_authority_entry_id_missing")
      continue
    }
    if (entries.has(entry.normalizer_id)) {
      // Fail closed at construction -- duplicate normalizer_id registration
      // within one authority must never silently resolve to "whichever
      // entry was declared last".
      reasons.push(`duplicate_normalizer_id_in_authority:${entry.normalizer_id}`)
      continue
    }
    if (typeof entry.implementation !== "function") {
      reasons.push(`normalizer_authority_entry_implementation_missing:${entry.normalizer_id}`)
      continue
    }
    if (typeof entry.equivalence_kind !== "string" || entry.equivalence_kind.length === 0) {
      reasons.push(`normalizer_authority_entry_equivalence_kind_missing:${entry.normalizer_id}`)
      continue
    }
    entries.set(entry.normalizer_id, Object.freeze({ ...entry }))
  }

  if (reasons.length > 0) return { ok: false, reasons }

  // `entries` is a closure-private Map -- nothing external can reach or
  // mutate it after this point. resolve() can only ever return an entry
  // stored under the exact ID it was requested with.
  const authority: NormalizerAuthorityV0 = Object.freeze({
    __brand: NORMALIZER_AUTHORITY_BRAND_V0,
    authority_id: input.authority_id,
    authority_version: input.authority_version,
    resolve: (normalizerId: string) => entries.get(normalizerId),
  })

  return { ok: true, authority }
}
