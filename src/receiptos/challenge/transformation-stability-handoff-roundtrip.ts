/**
 * ReceiptOS Transformation Stability v0 — HandoffEvidence canonical round-trip.
 */

import { canonicalize } from "../canon/canonicalize"
import { computeReceiptRoot } from "../canon/receipt-root"
import { HandoffEvidenceSchema } from "../schema/evidence"
import type { HandoffEvidence } from "../schema/types"
import {
  defineTransformationProfileV0,
  evaluateTransformationStabilityV0,
  type RecomputeOutcomeV0,
  type TransformationPreconditionResultV0,
  type TransformationStabilityResultV0,
} from "./transformation-stability"

export const HANDOFF_EVIDENCE_CANONICAL_ROUNDTRIP_PROFILE_ID_V0 =
  "handoff-evidence-canonical-roundtrip-v0" as const

export const HANDOFF_EVIDENCE_CANONICAL_ROUNDTRIP_FAMILY_V0 =
  "serialization_round_trip" as const

export type HandoffEvidenceRoundTripObservationV0 = {
  readonly receipt_root: string
  readonly canonical_envelope: string
  readonly anchor: HandoffEvidence["anchor"]
}

export function validateHandoffEvidenceV0(value: unknown): HandoffEvidence {
  return HandoffEvidenceSchema.parse(value)
}

export function handoffEvidencePreconditionV0(
  value: unknown,
): TransformationPreconditionResultV0 {
  const result = HandoffEvidenceSchema.validate(value)
  return result.success
    ? { ok: true }
    : { ok: false, reason: "handoff_evidence_schema_mismatch" }
}

export function recomputeHandoffEvidenceV0(
  value: unknown,
): RecomputeOutcomeV0<HandoffEvidenceRoundTripObservationV0> {
  try {
    const parsed = validateHandoffEvidenceV0(value)
    return {
      state: "evaluated",
      value: {
        receipt_root: computeReceiptRoot(parsed),
        canonical_envelope: canonicalize(parsed),
        anchor: structuredClone(parsed.anchor),
      },
    }
  } catch {
    return {
      state: "unresolved",
      reason: "handoff_evidence_recompute_failed",
    }
  }
}

export function handoffNormativeProjectionV0(
  result: HandoffEvidenceRoundTripObservationV0,
): unknown {
  return { receipt_root: result.receipt_root }
}

export function handoffStabilityProjectionV0(
  result: HandoffEvidenceRoundTripObservationV0,
): unknown {
  return { canonical_envelope: result.canonical_envelope }
}

export function handoffAllowedVariantProjectionV0(
  _result: HandoffEvidenceRoundTripObservationV0,
): unknown {
  return {}
}

export function handoffForbiddenVariantProjectionV0(
  result: HandoffEvidenceRoundTripObservationV0,
): unknown {
  return { anchor: result.anchor }
}

export const HANDOFF_EVIDENCE_CANONICAL_ROUNDTRIP_PROFILE_V0 =
  defineTransformationProfileV0<
    HandoffEvidence,
    HandoffEvidence,
    HandoffEvidenceRoundTripObservationV0
  >({
    transformation_profile_id: HANDOFF_EVIDENCE_CANONICAL_ROUNDTRIP_PROFILE_ID_V0,
    transformation_family: HANDOFF_EVIDENCE_CANONICAL_ROUNDTRIP_FAMILY_V0,
    source_object_kind: "stealth.session.evidence.v1",
    target_object_kind: "stealth.session.evidence.v1",
    recompute_procedure_id: "receiptos.computeReceiptRoot+canonicalize.v0",
    comparison_rule_id: "receipt-root+canonical-envelope+anchor.v0",
    history_sensitive_policy: "violation",
    precondition: handoffEvidencePreconditionV0,
    transform: (source) =>
      validateHandoffEvidenceV0(JSON.parse(canonicalize(source))),
    recompute_source: recomputeHandoffEvidenceV0,
    recompute_target: recomputeHandoffEvidenceV0,
    normative_projection: handoffNormativeProjectionV0,
    stability_projection: handoffStabilityProjectionV0,
    allowed_variant_projection: handoffAllowedVariantProjectionV0,
    forbidden_variant_projection: handoffForbiddenVariantProjectionV0,
  })

export async function verifyHandoffEvidenceCanonicalRoundTripV0(
  value: unknown,
): Promise<TransformationStabilityResultV0> {
  const source = validateHandoffEvidenceV0(value)
  return evaluateTransformationStabilityV0(
    HANDOFF_EVIDENCE_CANONICAL_ROUNDTRIP_PROFILE_V0,
    source,
  )
}
