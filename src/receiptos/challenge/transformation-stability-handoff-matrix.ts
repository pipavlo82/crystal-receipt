/**
 * ReceiptOS Transformation Stability v0 — HandoffEvidence adversarial matrix.
 *
 * Candidate matrix only; not frozen conformance authority yet.
 */

import { canonicalize } from "../canon/canonicalize"
import type { HandoffEvidence } from "../schema/types"
import {
  defineTransformationProfileV0,
  evaluateTransformationStabilityV0,
  type RecomputeOutcomeV0,
  type TransformationStabilityClassificationV0,
  type TransformationStabilityResultV0,
} from "./transformation-stability"
import {
  handoffAllowedVariantProjectionV0,
  handoffEvidencePreconditionV0,
  handoffForbiddenVariantProjectionV0,
  handoffNormativeProjectionV0,
  handoffStabilityProjectionV0,
  recomputeHandoffEvidenceV0,
  validateHandoffEvidenceV0,
  type HandoffEvidenceRoundTripObservationV0,
} from "./transformation-stability-handoff-roundtrip"

export const HANDOFF_TRANSFORMATION_MATRIX_SCHEMA_V0 =
  "receiptos.transformation_stability_handoff_matrix.v0" as const

export const HANDOFF_TRANSFORMATION_MATRIX_ID_V0 =
  "handoff-transformation-stability-matrix-v0" as const

export const HANDOFF_TRANSFORMATION_MATRIX_SAMPLE_ROOT_V0 =
  "0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc" as const

export const HANDOFF_TRANSFORMATION_MATRIX_NORMATIVE_MUTATION_ROOT_V0 =
  "0x41479b4374e63fb0d9f42c03323c6949458a67cadb728e5a2d187c59582bf53e" as const

export type HandoffTransformationVectorIdV0 =
  | "H-ROUNDTRIP-STABLE"
  | "H-KEY-ORDER-REVERSE"
  | "H-NORMATIVE-SESSION-ID-MUTATION"
  | "H-FORBIDDEN-ANCHOR-CONTRACT-MUTATION"
  | "H-SOURCE-SCHEMA-MISMATCH"
  | "H-TARGET-RECOMPUTE-UNRESOLVED"

export type HandoffTransformationVectorRecordV0 = {
  readonly vector_id: HandoffTransformationVectorIdV0
  readonly transformation_class: string
  readonly expected_classification: TransformationStabilityClassificationV0
  readonly expected_normative_match: boolean | null
  readonly expected_stability_match: boolean | null
  readonly expected_forbidden_variant_match: boolean | null
  readonly expected_unresolved_reason: string | null
  readonly expected_out_of_domain_reason: string | null
}

export const HANDOFF_TRANSFORMATION_VECTORS_V0: readonly HandoffTransformationVectorRecordV0[] =
  Object.freeze([
    Object.freeze({
      vector_id: "H-ROUNDTRIP-STABLE",
      transformation_class: "canonical_round_trip",
      expected_classification: "stable",
      expected_normative_match: true,
      expected_stability_match: true,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "H-KEY-ORDER-REVERSE",
      transformation_class: "representation_key_order",
      expected_classification: "stable",
      expected_normative_match: true,
      expected_stability_match: true,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "H-NORMATIVE-SESSION-ID-MUTATION",
      transformation_class: "normative_preimage_mutation",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "H-FORBIDDEN-ANCHOR-CONTRACT-MUTATION",
      transformation_class: "forbidden_anchor_mutation",
      expected_classification: "violation",
      expected_normative_match: true,
      expected_stability_match: false,
      expected_forbidden_variant_match: false,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "H-SOURCE-SCHEMA-MISMATCH",
      transformation_class: "source_domain_failure",
      expected_classification: "out_of_domain",
      expected_normative_match: null,
      expected_stability_match: null,
      expected_forbidden_variant_match: null,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: "handoff_evidence_schema_mismatch",
    }),
    Object.freeze({
      vector_id: "H-TARGET-RECOMPUTE-UNRESOLVED",
      transformation_class: "bounded_target_recompute_failure",
      expected_classification: "unresolved",
      expected_normative_match: null,
      expected_stability_match: null,
      expected_forbidden_variant_match: null,
      expected_unresolved_reason: "synthetic_target_recompute_unresolved",
      expected_out_of_domain_reason: null,
    }),
  ])

function reverseObjectKeyOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeyOrder)
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(record).reverse()) {
      out[key] = reverseObjectKeyOrder(record[key])
    }
    return out
  }
  return value
}

function cloneEvidence(value: HandoffEvidence): HandoffEvidence {
  return structuredClone(value)
}

function commonProfileFields() {
  return {
    transformation_family: "handoff_adversarial_matrix",
    source_object_kind: "stealth.session.evidence.v1",
    target_object_kind: "stealth.session.evidence.v1",
    recompute_procedure_id: "receiptos.computeReceiptRoot+canonicalize.v0",
    comparison_rule_id: "receipt-root+canonical-envelope+anchor.v0",
    history_sensitive_policy: "violation" as const,
    precondition: handoffEvidencePreconditionV0,
    recompute_source: recomputeHandoffEvidenceV0,
    normative_projection: handoffNormativeProjectionV0,
    stability_projection: handoffStabilityProjectionV0,
    allowed_variant_projection: handoffAllowedVariantProjectionV0,
    forbidden_variant_projection: handoffForbiddenVariantProjectionV0,
  }
}

function buildVectorProfile(
  vectorId: Exclude<HandoffTransformationVectorIdV0, "H-SOURCE-SCHEMA-MISMATCH">,
) {
  const common = commonProfileFields()

  if (vectorId === "H-ROUNDTRIP-STABLE") {
    return defineTransformationProfileV0<
      HandoffEvidence,
      HandoffEvidence,
      HandoffEvidenceRoundTripObservationV0
    >({
      ...common,
      transformation_profile_id: `handoff-matrix:${vectorId}`,
      transform: (source) =>
        validateHandoffEvidenceV0(JSON.parse(canonicalize(source))),
      recompute_target: recomputeHandoffEvidenceV0,
    })
  }

  if (vectorId === "H-KEY-ORDER-REVERSE") {
    return defineTransformationProfileV0<
      HandoffEvidence,
      HandoffEvidence,
      HandoffEvidenceRoundTripObservationV0
    >({
      ...common,
      transformation_profile_id: `handoff-matrix:${vectorId}`,
      transform: (source) =>
        validateHandoffEvidenceV0(reverseObjectKeyOrder(source)),
      recompute_target: recomputeHandoffEvidenceV0,
    })
  }

  if (vectorId === "H-NORMATIVE-SESSION-ID-MUTATION") {
    return defineTransformationProfileV0<
      HandoffEvidence,
      HandoffEvidence,
      HandoffEvidenceRoundTripObservationV0
    >({
      ...common,
      transformation_profile_id: `handoff-matrix:${vectorId}`,
      transform: (source) => {
        const target = cloneEvidence(source)
        target.session_id = "session-demo-001-mutated"
        return validateHandoffEvidenceV0(target)
      },
      recompute_target: recomputeHandoffEvidenceV0,
    })
  }

  if (vectorId === "H-FORBIDDEN-ANCHOR-CONTRACT-MUTATION") {
    return defineTransformationProfileV0<
      HandoffEvidence,
      HandoffEvidence,
      HandoffEvidenceRoundTripObservationV0
    >({
      ...common,
      transformation_profile_id: `handoff-matrix:${vectorId}`,
      transform: (source) => {
        const target = cloneEvidence(source)
        target.anchor.contract = "0xdeadbeef"
        return validateHandoffEvidenceV0(target)
      },
      recompute_target: recomputeHandoffEvidenceV0,
    })
  }

  return defineTransformationProfileV0<
    HandoffEvidence,
    HandoffEvidence,
    HandoffEvidenceRoundTripObservationV0
  >({
    ...common,
    transformation_profile_id: `handoff-matrix:${vectorId}`,
    transform: cloneEvidence,
    recompute_target: (_target): RecomputeOutcomeV0<HandoffEvidenceRoundTripObservationV0> => ({
      state: "unresolved",
      reason: "synthetic_target_recompute_unresolved",
    }),
  })
}

function buildInvalidSourceProfile() {
  return defineTransformationProfileV0<
    unknown,
    HandoffEvidence,
    HandoffEvidenceRoundTripObservationV0
  >({
    transformation_profile_id: "handoff-matrix:H-SOURCE-SCHEMA-MISMATCH",
    transformation_family: "handoff_adversarial_matrix",
    source_object_kind: "unknown",
    target_object_kind: "stealth.session.evidence.v1",
    recompute_procedure_id: "receiptos.computeReceiptRoot+canonicalize.v0",
    comparison_rule_id: "receipt-root+canonical-envelope+anchor.v0",
    history_sensitive_policy: "violation",
    precondition: handoffEvidencePreconditionV0,
    transform: validateHandoffEvidenceV0,
    recompute_source: recomputeHandoffEvidenceV0,
    recompute_target: recomputeHandoffEvidenceV0,
    normative_projection: handoffNormativeProjectionV0,
    stability_projection: handoffStabilityProjectionV0,
    allowed_variant_projection: handoffAllowedVariantProjectionV0,
    forbidden_variant_projection: handoffForbiddenVariantProjectionV0,
  })
}

export type HandoffTransformationMatrixMemberResultV0 = {
  readonly vector_id: HandoffTransformationVectorIdV0
  readonly expected: HandoffTransformationVectorRecordV0
  readonly observed: TransformationStabilityResultV0
}

export type HandoffTransformationMatrixResultV0 = {
  readonly schema: typeof HANDOFF_TRANSFORMATION_MATRIX_SCHEMA_V0
  readonly matrix_id: typeof HANDOFF_TRANSFORMATION_MATRIX_ID_V0
  readonly vector_count: 6
  readonly aggregate: {
    readonly stable: number
    readonly history_sensitive: number
    readonly unresolved: number
    readonly out_of_domain: number
    readonly violation: number
  }
  readonly members: readonly HandoffTransformationMatrixMemberResultV0[]
  readonly pass: boolean
}

function memberPass(member: HandoffTransformationMatrixMemberResultV0): boolean {
  const { expected, observed } = member
  return (
    observed.classification === expected.expected_classification &&
    observed.normative_match === expected.expected_normative_match &&
    observed.stability_match === expected.expected_stability_match &&
    observed.forbidden_variant_match === expected.expected_forbidden_variant_match &&
    observed.unresolved_reason === expected.expected_unresolved_reason &&
    observed.out_of_domain_reason === expected.expected_out_of_domain_reason
  )
}

function aggregateMembers(
  members: readonly HandoffTransformationMatrixMemberResultV0[],
): HandoffTransformationMatrixResultV0["aggregate"] {
  let stable = 0
  let historySensitive = 0
  let unresolved = 0
  let outOfDomain = 0
  let violation = 0

  for (const member of members) {
    if (member.observed.classification === "stable") stable += 1
    else if (member.observed.classification === "history_sensitive") historySensitive += 1
    else if (member.observed.classification === "unresolved") unresolved += 1
    else if (member.observed.classification === "out_of_domain") outOfDomain += 1
    else violation += 1
  }

  return {
    stable,
    history_sensitive: historySensitive,
    unresolved,
    out_of_domain: outOfDomain,
    violation,
  }
}

export async function evaluateHandoffTransformationMatrixV0(
  sourceValue: unknown,
): Promise<HandoffTransformationMatrixResultV0> {
  const source = validateHandoffEvidenceV0(sourceValue)
  const members: HandoffTransformationMatrixMemberResultV0[] = []

  for (const expected of HANDOFF_TRANSFORMATION_VECTORS_V0) {
    let observed: TransformationStabilityResultV0

    if (expected.vector_id === "H-SOURCE-SCHEMA-MISMATCH") {
      const invalid = structuredClone(source) as unknown as Record<string, unknown>
      delete invalid.session_id
      observed = await evaluateTransformationStabilityV0(
        buildInvalidSourceProfile(),
        invalid,
      )
    } else {
      observed = await evaluateTransformationStabilityV0(
        buildVectorProfile(expected.vector_id),
        source,
      )
    }

    members.push({
      vector_id: expected.vector_id,
      expected,
      observed,
    })
  }

  const aggregate = aggregateMembers(members)
  const pass =
    members.length === 6 &&
    members.every(memberPass) &&
    aggregate.stable === 2 &&
    aggregate.history_sensitive === 0 &&
    aggregate.unresolved === 1 &&
    aggregate.out_of_domain === 1 &&
    aggregate.violation === 2

  return {
    schema: HANDOFF_TRANSFORMATION_MATRIX_SCHEMA_V0,
    matrix_id: HANDOFF_TRANSFORMATION_MATRIX_ID_V0,
    vector_count: 6,
    aggregate,
    members,
    pass,
  }
}
