// RSF ISOLATED PRIMITIVES ONLY — positions 9, 10, 11, and 12 of the
// 28-position evaluation order in
// docs/RECURSIVE_SINGLETON_FOLD_REFERENCE_PACKAGE_V0_WORKING_DRAFT.md §12.
//
// Covered, each as an independent, non-chaining primitive:
//   position 9  — cross-object consistency (§6 step 10)
//   position 10 — proof-object identity (§6 step 11)
//   position 11 — proof reference (§6 step 12)
//   position 12 — Chronicle admission gate call succeeds as a whole
//                 (§6 step 14), owning no distinct finding code
//
// Not covered by this module, deliberately:
//   positions 1-8 (already implemented elsewhere), positions 13-28
//   (reconstructed-entry canonical-byte equality, source-entry content
//   commitment, declarations, semantic statement, inclusion set,
//   eligibility, transition, breakdown, aggregate identity, final
//   aggregate validation). This module does not perform reconstructed-vs-
//   claimed entry equality (position 13), does not derive
//   `source_entry_content_commitment` (position 14, derivation-only per
//   the merged position-14 repair), and does not touch position 28's
//   exclusive ownership of `source_entry_content_commitment_mismatch`. It
//   is not the RSF evaluator and is not wired into any evaluator.
//
// Each exported checker accepts only its position-owned subject plus the
// strictly necessary earlier-position outputs, and returns synchronously.
// Checkers never call one another and never run a later position.
//
// Position 9 owns exactly five ordered internal consistency checks that
// all collapse into the single `cross_object_consistency_mismatch` code —
// the code exposes no subreason, matching the reference package's "single
// deterministic primary finding" design (§11). These five checks are
// derived exactly from the five corresponding throw sites inside
// `createChronicleEntryV0` (src/receiptos/capsule/chronicle-portfolio-v0.ts),
// which §6 step 10 names as their normative source.
//
// Position 10's identity comparison is case-sensitive (`!==`), unlike
// position 9's case-insensitive root comparisons — this asymmetry exists
// in the canonical helper itself and is preserved exactly here.
//
// Position 11 consumes position 10's already-derived expected proof-object
// ID, never a fresh recomputation and never the claimed field it is
// checking against.
//
// Position 12 has no distinct finding. It directly reuses the existing,
// unmodified `createChronicleEntryV0`, which defensively repeats checks
// already independently owned by positions 8-11. Under conforming
// operation (positions 8-11 already succeeded) those repeated checks
// cannot fail; an unrecognized exception from this call is an
// implementation failure, not canonical evaluator output, and is never
// mapped to a fabricated position-12 finding.

import type { HandoffEvidence } from "../schema/types"
import type { PortableProofObjectV0 } from "../capsule/portable-proof-object-v0"
import { deriveProofObjectId, deriveProofRef } from "../capsule/portable-proof-object-v0"
import { createChronicleEntryV0, type ChronicleEntryV0 } from "../capsule/chronicle-portfolio-v0"
import type { RsfChronicleConstructorOptions } from "./construction-options-adapter"

export type CrossObjectConsistencyFinding = {
  schema: "recursive_singleton_fold_finding.v0"
  code: "cross_object_consistency_mismatch"
  check_position: 9
}

export type ProofObjectIdentityFinding = {
  schema: "recursive_singleton_fold_finding.v0"
  code: "proof_object_identity_mismatch"
  check_position: 10
}

export type ProofReferenceFinding = {
  schema: "recursive_singleton_fold_finding.v0"
  code: "proof_reference_mismatch"
  check_position: 11
}

export type CheckSourceAdmissionCrossObjectConsistencyResult =
  | { success: true; value: { verifiedReceiptRoot: string } }
  | { success: false; finding: CrossObjectConsistencyFinding }

export type CheckProofObjectIdentityResult =
  | { success: true; value: { expectedProofObjectId: string } }
  | { success: false; finding: ProofObjectIdentityFinding }

export type CheckProofReferenceResult =
  | { success: true; value: { expectedProofObjectId: string; expectedProofRef: string } }
  | { success: false; finding: ProofReferenceFinding }

// Position 12 owns no finding code (§12 row 12: "no distinct code — every
// recognized failure here already maps to positions 8-11"). Under
// conforming operation there is no `{success:false}` branch — an
// unrecognized exception propagates as a host-language error, per §6's
// closing note, rather than being converted into a canonical finding.
export type CheckChronicleAdmissionReconstructionResult = {
  success: true
  value: ChronicleEntryV0
}

function snapshot<T>(value: T): T {
  return structuredClone(value)
}

// Isolated position-9 primitive only. Does not run positions 1-8 or
// 10-28, and does not consume `claimed_source_entry` (position 7) — none
// of the five internal checks below reads it. Accepts only the
// position-5-validated `HandoffEvidence`, the position-6-validated
// `PortableProofObjectV0`, and the position-8 `verifiedReceiptRoot`.
//
// The five internal checks, in exact order (mirrored from
// `createChronicleEntryV0`'s own five throw sites):
//   1. proofObject.receipt_root         vs. verifiedReceiptRoot
//   2. evidence_capsule.receipt_root.stored   vs. verifiedReceiptRoot
//   3. evidence_capsule.receipt_root.computed vs. verifiedReceiptRoot
//      (position 8 already proved the claimed root recomputes, so the
//      position-8 output is the single authoritative value for both the
//      "stored" and "computed" comparisons)
//   4. evidence_capsule.receipt_root.match/status internal consistency
//   5. evidence_capsule.verifier_result.ok/status internal consistency
// All five comparisons are case-insensitive where they involve hex root
// strings, exactly as in the canonical helper; the match/status and
// verifier_result checks are exact literal comparisons (booleans and enum
// strings are not case-folded). The first failing check stops the
// position immediately; every failure maps to the same single code.
export function checkSourceAdmissionCrossObjectConsistency(
  sourceProofObject: PortableProofObjectV0,
  verifiedReceiptRoot: string,
): CheckSourceAdmissionCrossObjectConsistencyResult {
  const finding = (): CheckSourceAdmissionCrossObjectConsistencyResult => ({
    success: false,
    finding: { schema: "recursive_singleton_fold_finding.v0", code: "cross_object_consistency_mismatch", check_position: 9 },
  })

  if (sourceProofObject.receipt_root.toLowerCase() !== verifiedReceiptRoot.toLowerCase()) {
    return finding()
  }

  const capsuleReceiptRoot = sourceProofObject.evidence_capsule.receipt_root
  if (capsuleReceiptRoot.stored.toLowerCase() !== verifiedReceiptRoot.toLowerCase()) {
    return finding()
  }
  if (capsuleReceiptRoot.computed.toLowerCase() !== verifiedReceiptRoot.toLowerCase()) {
    return finding()
  }
  if (capsuleReceiptRoot.match !== true || capsuleReceiptRoot.status !== "verified") {
    return finding()
  }

  const verifierResult = sourceProofObject.evidence_capsule.verifier_result
  if (verifierResult.ok !== true || verifierResult.status !== "verified") {
    return finding()
  }

  return { success: true, value: { verifiedReceiptRoot } }
}

// Isolated position-10 primitive only. Does not run positions 1-9 or
// 11-28. The expected identity is derived exclusively through
// `deriveProofObjectId(verifiedReceiptRoot)` — never from the claimed
// `proof_object_id` being checked, never from metadata, timestamps,
// package identity, or any runtime/network state. Comparison is
// case-sensitive (`!==`), matching `createChronicleEntryV0`'s own
// comparison exactly; this is a deliberate asymmetry with position 9's
// case-insensitive root comparisons, not an inconsistency to "fix."
export function checkProofObjectIdentity(
  sourceProofObject: PortableProofObjectV0,
  verifiedReceiptRoot: string,
): CheckProofObjectIdentityResult {
  const expectedProofObjectId = deriveProofObjectId(verifiedReceiptRoot)
  if (sourceProofObject.proof_object_id !== expectedProofObjectId) {
    return {
      success: false,
      finding: { schema: "recursive_singleton_fold_finding.v0", code: "proof_object_identity_mismatch", check_position: 10 },
    }
  }
  return { success: true, value: { expectedProofObjectId } }
}

// Isolated position-11 primitive only. Does not run positions 1-10 or
// 12-28. Accepts position 10's already-derived `expectedProofObjectId` as
// input rather than recomputing it, and never trusts the claimed
// `proof_object_id` as authority for the expected reference. Comparison
// is case-sensitive (`!==`), matching `createChronicleEntryV0` exactly.
export function checkProofReference(
  sourceProofObject: PortableProofObjectV0,
  expectedProofObjectId: string,
): CheckProofReferenceResult {
  const expectedProofRef = deriveProofRef(expectedProofObjectId)
  if (sourceProofObject.proof_ref !== expectedProofRef) {
    return {
      success: false,
      finding: { schema: "recursive_singleton_fold_finding.v0", code: "proof_reference_mismatch", check_position: 11 },
    }
  }
  return { success: true, value: { expectedProofObjectId, expectedProofRef } }
}

// Isolated position-12 primitive only. Does not run positions 1-11 or
// 13-28, does not perform reconstructed-vs-claimed entry equality
// (position 13), and does not derive `source_entry_content_commitment`
// (position 14). Directly reuses the existing, unmodified
// `createChronicleEntryV0` — the sole normative source for the exact
// reconstruction logic (entry_id/evidence_capsule_ref/etc. defaulting)
// that position 13 must later compare against. `createChronicleEntryV0`
// defensively repeats checks already independently owned by positions
// 8-11; under conforming operation (this function is only ever called
// after 8-11 have already succeeded) those repeated checks cannot fail.
// An unrecognized exception from this call is an implementation failure,
// never converted into a fabricated position-12 finding — there is no
// `{success:false}` branch on this function's result type.
export function checkChronicleAdmissionReconstruction(
  sourceEvidence: HandoffEvidence,
  sourceProofObject: PortableProofObjectV0,
  adaptedConstructionOptions: RsfChronicleConstructorOptions,
): CheckChronicleAdmissionReconstructionResult {
  const reconstructedEntry = createChronicleEntryV0(sourceEvidence, sourceProofObject, adaptedConstructionOptions)
  return { success: true, value: snapshot(reconstructedEntry) }
}
