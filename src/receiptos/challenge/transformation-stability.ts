/**
 * ReceiptOS Transformation Stability v0 — generic normative-preservation core.
 *
 * DESIGN DRAFT. Frozen profiles bind concrete transformation, recomputation,
 * projection, and applicability authority in repository code.
 */

import { canonicalIdentityJson } from "./counterfactual-neighborhood"

export const TRANSFORMATION_STABILITY_RESULT_SCHEMA_V0 =
  "receiptos.transformation_stability_result.v0" as const

export const TRANSFORMATION_STABILITY_CLAIM_V0 =
  "normative_preservation" as const

export type TransformationStabilityClassificationV0 =
  | "stable"
  | "history_sensitive"
  | "unresolved"
  | "out_of_domain"
  | "violation"

export type TransformationStabilityEvaluationStateV0 =
  | "evaluated"
  | "execution_unresolved"
  | "not_applicable"

export type HistorySensitivePolicyV0 = "classify" | "violation"

export type TransformationPreconditionResultV0 =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string }

export type RecomputeOutcomeV0<T> =
  | { readonly state: "evaluated"; readonly value: T }
  | { readonly state: "unresolved"; readonly reason: string }

export type AuthenticatedTransformationProfileV0<TSource, TTarget, TResult> = {
  readonly __brand: "AuthenticatedTransformationProfileV0"
  readonly transformation_claim: typeof TRANSFORMATION_STABILITY_CLAIM_V0
  readonly transformation_profile_id: string
  readonly transformation_family: string
  readonly source_object_kind: string
  readonly target_object_kind: string
  readonly recompute_procedure_id: string
  readonly comparison_rule_id: string
  readonly history_sensitive_policy: HistorySensitivePolicyV0
  readonly precondition: (source: TSource) => TransformationPreconditionResultV0
  readonly transform: (source: TSource) => TTarget | Promise<TTarget>
  readonly recompute_source: (
    source: TSource,
  ) => RecomputeOutcomeV0<TResult> | Promise<RecomputeOutcomeV0<TResult>>
  readonly recompute_target: (
    target: TTarget,
  ) => RecomputeOutcomeV0<TResult> | Promise<RecomputeOutcomeV0<TResult>>
  readonly normative_projection: (result: TResult) => unknown
  readonly stability_projection: (result: TResult) => unknown
  readonly allowed_variant_projection: (result: TResult) => unknown
  readonly forbidden_variant_projection: (result: TResult) => unknown
}

export type TransformationStabilityResultV0 = {
  readonly schema: typeof TRANSFORMATION_STABILITY_RESULT_SCHEMA_V0
  readonly transformation_claim: typeof TRANSFORMATION_STABILITY_CLAIM_V0
  readonly transformation_profile_id: string
  readonly transformation_family: string
  readonly source_object_kind: string
  readonly target_object_kind: string
  readonly recompute_procedure_id: string
  readonly comparison_rule_id: string
  readonly evaluation_state: TransformationStabilityEvaluationStateV0
  readonly classification: TransformationStabilityClassificationV0
  readonly out_of_domain_reason: string | null
  readonly unresolved_reason: string | null
  readonly normative_match: boolean | null
  readonly stability_match: boolean | null
  readonly forbidden_variant_match: boolean | null
  readonly allowed_variant_changed: boolean | null
}

export class TransformationStabilityContractErrorV0 extends Error {
  readonly code = "transformation_stability_contract_error_v0" as const
  readonly reason: string

  constructor(reason: string) {
    super("transformation stability contract v0 failed")
    this.name = "TransformationStabilityContractErrorV0"
    this.reason = reason
  }
}

function projectionEqual(left: unknown, right: unknown): boolean {
  return canonicalIdentityJson(left) === canonicalIdentityJson(right)
}

function baseResult<TSource, TTarget, TResult>(
  profile: AuthenticatedTransformationProfileV0<TSource, TTarget, TResult>,
): Omit<
  TransformationStabilityResultV0,
  | "evaluation_state"
  | "classification"
  | "out_of_domain_reason"
  | "unresolved_reason"
  | "normative_match"
  | "stability_match"
  | "forbidden_variant_match"
  | "allowed_variant_changed"
> {
  if (profile.__brand !== "AuthenticatedTransformationProfileV0") {
    throw new TransformationStabilityContractErrorV0("unauthenticated_profile")
  }
  if (profile.transformation_claim !== TRANSFORMATION_STABILITY_CLAIM_V0) {
    throw new TransformationStabilityContractErrorV0("unsupported_transformation_claim")
  }

  for (const [label, value] of [
    ["transformation_profile_id", profile.transformation_profile_id],
    ["transformation_family", profile.transformation_family],
    ["source_object_kind", profile.source_object_kind],
    ["target_object_kind", profile.target_object_kind],
    ["recompute_procedure_id", profile.recompute_procedure_id],
    ["comparison_rule_id", profile.comparison_rule_id],
  ] as const) {
    if (typeof value !== "string" || value.length === 0) {
      throw new TransformationStabilityContractErrorV0(`${label}_missing`)
    }
  }

  return {
    schema: TRANSFORMATION_STABILITY_RESULT_SCHEMA_V0,
    transformation_claim: TRANSFORMATION_STABILITY_CLAIM_V0,
    transformation_profile_id: profile.transformation_profile_id,
    transformation_family: profile.transformation_family,
    source_object_kind: profile.source_object_kind,
    target_object_kind: profile.target_object_kind,
    recompute_procedure_id: profile.recompute_procedure_id,
    comparison_rule_id: profile.comparison_rule_id,
  }
}

function unresolved<TSource, TTarget, TResult>(
  profile: AuthenticatedTransformationProfileV0<TSource, TTarget, TResult>,
  reason: string,
): TransformationStabilityResultV0 {
  return {
    ...baseResult(profile),
    evaluation_state: "execution_unresolved",
    classification: "unresolved",
    out_of_domain_reason: null,
    unresolved_reason: reason,
    normative_match: null,
    stability_match: null,
    forbidden_variant_match: null,
    allowed_variant_changed: null,
  }
}

export async function evaluateTransformationStabilityV0<TSource, TTarget, TResult>(
  profile: AuthenticatedTransformationProfileV0<TSource, TTarget, TResult>,
  source: TSource,
): Promise<TransformationStabilityResultV0> {
  const common = baseResult(profile)

  let applicability: TransformationPreconditionResultV0
  try {
    applicability = profile.precondition(source)
  } catch {
    return unresolved(profile, "precondition_evaluation_failed")
  }

  if (!applicability.ok) {
    return {
      ...common,
      evaluation_state: "not_applicable",
      classification: "out_of_domain",
      out_of_domain_reason: applicability.reason,
      unresolved_reason: null,
      normative_match: null,
      stability_match: null,
      forbidden_variant_match: null,
      allowed_variant_changed: null,
    }
  }

  let target: TTarget
  try {
    target = await profile.transform(source)
  } catch {
    return unresolved(profile, "transformation_failed")
  }

  let sourceOutcome: RecomputeOutcomeV0<TResult>
  try {
    sourceOutcome = await profile.recompute_source(source)
  } catch {
    return unresolved(profile, "source_recompute_failed")
  }
  if (sourceOutcome.state === "unresolved") {
    return unresolved(profile, sourceOutcome.reason)
  }

  let targetOutcome: RecomputeOutcomeV0<TResult>
  try {
    targetOutcome = await profile.recompute_target(target)
  } catch {
    return unresolved(profile, "target_recompute_failed")
  }
  if (targetOutcome.state === "unresolved") {
    return unresolved(profile, targetOutcome.reason)
  }

  let normativeMatch: boolean
  let stabilityMatch: boolean
  let forbiddenVariantMatch: boolean
  let allowedVariantChanged: boolean
  try {
    normativeMatch = projectionEqual(
      profile.normative_projection(sourceOutcome.value),
      profile.normative_projection(targetOutcome.value),
    )
    stabilityMatch = projectionEqual(
      profile.stability_projection(sourceOutcome.value),
      profile.stability_projection(targetOutcome.value),
    )
    forbiddenVariantMatch = projectionEqual(
      profile.forbidden_variant_projection(sourceOutcome.value),
      profile.forbidden_variant_projection(targetOutcome.value),
    )
    allowedVariantChanged = !projectionEqual(
      profile.allowed_variant_projection(sourceOutcome.value),
      profile.allowed_variant_projection(targetOutcome.value),
    )
  } catch {
    return unresolved(profile, "projection_comparison_failed")
  }

  if (!normativeMatch || !forbiddenVariantMatch) {
    return {
      ...common,
      evaluation_state: "evaluated",
      classification: "violation",
      out_of_domain_reason: null,
      unresolved_reason: null,
      normative_match: normativeMatch,
      stability_match: stabilityMatch,
      forbidden_variant_match: forbiddenVariantMatch,
      allowed_variant_changed: allowedVariantChanged,
    }
  }

  if (!stabilityMatch) {
    return {
      ...common,
      evaluation_state: "evaluated",
      classification:
        profile.history_sensitive_policy === "classify"
          ? "history_sensitive"
          : "violation",
      out_of_domain_reason: null,
      unresolved_reason: null,
      normative_match: true,
      stability_match: false,
      forbidden_variant_match: true,
      allowed_variant_changed: allowedVariantChanged,
    }
  }

  return {
    ...common,
    evaluation_state: "evaluated",
    classification: "stable",
    out_of_domain_reason: null,
    unresolved_reason: null,
    normative_match: true,
    stability_match: true,
    forbidden_variant_match: true,
    allowed_variant_changed: allowedVariantChanged,
  }
}

export function defineTransformationProfileV0<TSource, TTarget, TResult>(
  profile: Omit<
    AuthenticatedTransformationProfileV0<TSource, TTarget, TResult>,
    "__brand" | "transformation_claim"
  >,
): AuthenticatedTransformationProfileV0<TSource, TTarget, TResult> {
  return Object.freeze({
    __brand: "AuthenticatedTransformationProfileV0" as const,
    transformation_claim: TRANSFORMATION_STABILITY_CLAIM_V0,
    ...profile,
  })
}
