// PR D — the ordered RSF prefix evaluator through position 17 of the
// 28-position evaluation order in
// docs/RECURSIVE_SINGLETON_FOLD_REFERENCE_PACKAGE_V0_WORKING_DRAFT.md §12.
//
// This module wires the already-existing, independently owned position 1-17
// primitives into one deterministic, synchronous, first-failure-wins
// sequence. It reimplements none of their logic — every check, finding, and
// commitment pin used here is imported verbatim from the module that already
// owns it.
//
// This is a prefix evaluator only. Success means positions 1-17 were
// evaluated in exact order and all passed. It does NOT mean:
//   - the complete RSF evaluation (positions 1-28) was accepted;
//   - an aggregate exists;
//   - positions 18-28 passed;
//   - the four normative evaluation-outcome labels defined by the closed
//     RSF result contract, or the closed evaluation-result carrier they
//     belong to, may be emitted by this module;
//   - RSF conformance is complete.
//
// This module does not implement positions 18-28, does not construct or
// return an aggregate, and does not define or emit that closed
// evaluation-outcome carrier or its four labels. Those remain the
// responsibility of the complete positions 1-28 evaluator, which does not
// yet exist.

import {
  validateRsfEvaluationInputShape,
  type RsfStructuralFinding,
} from "./evaluation-input-shape"
import { adaptRsfConstructionOptions } from "./construction-options-adapter"
import {
  checkSourceEvidence,
  checkPortableProofObject,
  checkClaimedSourceEntry,
  checkSourceAdmissionPrerequisitesAndReceiptRoot,
  type SourceEvidenceCheckFinding,
  type PortableProofObjectCheckFinding,
  type ClaimedSourceEntryCheckFinding,
  type SourceAdmissionReceiptRootCheckFinding,
} from "./source-admission-shape"
import {
  checkSourceAdmissionCrossObjectConsistency,
  checkProofObjectIdentity,
  checkProofReference,
  checkChronicleAdmissionReconstruction,
  checkReconstructedSourceEntryCanonicalEquality,
  deriveSourceEntryContentCommitment,
  type CrossObjectConsistencyFinding,
  type ProofObjectIdentityFinding,
  type ProofReferenceFinding,
  type ReconstructedSourceEntryFinding,
} from "./source-admission-recomputation"
import {
  checkFoldPolicyDeclaration,
  checkComparabilityClassDeclaration,
  checkTransitionRuleDeclaration,
  FOLD_POLICY_COMMITMENT,
  COMPARABILITY_CLASS_COMMITMENT,
  TRANSITION_RULE_COMMITMENT,
  type FoldPolicyDeclarationCheckFinding,
  type ComparabilityClassDeclarationCheckFinding,
  type TransitionRuleDeclarationCheckFinding,
  type FoldPolicyDeclarationShape,
  type ComparabilityClassDeclarationShape,
  type TransitionRuleDeclarationShape,
} from "./declaration-commitments"
import type { ChronicleEntryV0 } from "../capsule/chronicle-portfolio-v0"

// Position 12 owns no finding; position 14 owns no finding. Neither
// contributes a member to this union.
export type RsfPrefixThroughPosition17Finding =
  | RsfStructuralFinding
  | SourceEvidenceCheckFinding
  | PortableProofObjectCheckFinding
  | ClaimedSourceEntryCheckFinding
  | SourceAdmissionReceiptRootCheckFinding
  | CrossObjectConsistencyFinding
  | ProofObjectIdentityFinding
  | ProofReferenceFinding
  | ReconstructedSourceEntryFinding
  | FoldPolicyDeclarationCheckFinding
  | ComparabilityClassDeclarationCheckFinding
  | TransitionRuleDeclarationCheckFinding

// An implementation composition surface, not the normative final envelope.
// Carries only the continuation state positions 18-28 could consume later —
// no intermediate evidence, proof object, construction options, IDs, or
// receipt roots.
export type RsfPrefixThroughPosition17Value = {
  verifiedSourceEntry: ChronicleEntryV0
  sourceEntryContentCommitment: string

  foldPolicyDeclaration: FoldPolicyDeclarationShape
  foldPolicyCommitment: string

  comparabilityClassDeclaration: ComparabilityClassDeclarationShape
  comparabilityClassCommitment: string

  transitionRuleDeclaration: TransitionRuleDeclarationShape
  transitionRuleCommitment: string

  profileLocalNotes: string | null
}

export type EvaluateRsfPrefixThroughPosition17Result =
  | {
      success: true
      value: RsfPrefixThroughPosition17Value
    }
  | {
      success: false
      finding: RsfPrefixThroughPosition17Finding
    }

// Ordered composition of the already-existing positions 1-17, executed
// synchronously, first-failure-wins. Every failing position returns
// immediately with exactly that position's already-owned finding; no later
// position ever runs after an earlier failure. This function reimplements
// no position's check logic — it only sequences the existing exported
// primitives and threads each position's output into the next position's
// required input, exactly as each primitive's own signature already
// requires.
export function evaluateRsfPrefixThroughPosition17(
  input: unknown,
): EvaluateRsfPrefixThroughPosition17Result {
  // Positions 1-4
  const structural = validateRsfEvaluationInputShape(input)
  if (!structural.success) {
    return { success: false, finding: structural.finding }
  }

  // Construction-options adapter -- not a check position, emits no finding.
  const adaptedConstructionOptions = adaptRsfConstructionOptions(
    structural.value.source_admission_bundle.source_entry_construction_options,
  )

  // Position 5
  const position5 = checkSourceEvidence(structural.value.source_admission_bundle.source_evidence)
  if (!position5.success) {
    return { success: false, finding: position5.finding }
  }

  // Position 6
  const position6 = checkPortableProofObject(structural.value.source_admission_bundle.source_proof_object)
  if (!position6.success) {
    return { success: false, finding: position6.finding }
  }

  // Position 7
  const position7 = checkClaimedSourceEntry(structural.value.source_admission_bundle.claimed_source_entry)
  if (!position7.success) {
    return { success: false, finding: position7.finding }
  }

  // Position 8
  const position8 = checkSourceAdmissionPrerequisitesAndReceiptRoot(position5.value)
  if (!position8.success) {
    return { success: false, finding: position8.finding }
  }

  // Position 9
  const position9 = checkSourceAdmissionCrossObjectConsistency(position6.value, position8.value.verifiedReceiptRoot)
  if (!position9.success) {
    return { success: false, finding: position9.finding }
  }

  // Position 10
  const position10 = checkProofObjectIdentity(position6.value, position8.value.verifiedReceiptRoot)
  if (!position10.success) {
    return { success: false, finding: position10.finding }
  }

  // Position 11
  const position11 = checkProofReference(position6.value, position10.value.expectedProofObjectId)
  if (!position11.success) {
    return { success: false, finding: position11.finding }
  }

  // Position 12 -- owns no finding. Under conforming operation (positions
  // 8-11 already independently passed) a typed Chronicle rejection here is
  // an implementation invariant violation, surfaced as a thrown Error by
  // checkChronicleAdmissionReconstruction itself. This evaluator does not
  // catch it and does not translate it into a canonical prefix result.
  const position12 = checkChronicleAdmissionReconstruction(position5.value, position6.value, adaptedConstructionOptions)

  // Position 13
  const position13 = checkReconstructedSourceEntryCanonicalEquality(position12.value, position7.value)
  if (!position13.success) {
    return { success: false, finding: position13.finding }
  }

  // Position 14 -- owns no finding, no comparison, derivation-only.
  const position14 = deriveSourceEntryContentCommitment(position13.value.verifiedSourceEntry)

  // Position 15
  const position15 = checkFoldPolicyDeclaration(structural.value.fold_policy_declaration)
  if (!position15.success) {
    return { success: false, finding: position15.finding }
  }

  // Position 16
  const position16 = checkComparabilityClassDeclaration(structural.value.comparability_class_declaration)
  if (!position16.success) {
    return { success: false, finding: position16.finding }
  }

  // Position 17
  const position17 = checkTransitionRuleDeclaration(structural.value.transition_rule_declaration)
  if (!position17.success) {
    return { success: false, finding: position17.finding }
  }

  // Prefix success. The three commitment literals below are retention of
  // values each corresponding checker already independently canonicalized,
  // recomputed, and compared equal to these exact pinned constants -- not a
  // second hash computed here.
  return {
    success: true,
    value: {
      verifiedSourceEntry: position13.value.verifiedSourceEntry,
      sourceEntryContentCommitment: position14.value.sourceEntryContentCommitment,

      foldPolicyDeclaration: position15.value,
      foldPolicyCommitment: `sha256:${FOLD_POLICY_COMMITMENT}`,

      comparabilityClassDeclaration: position16.value,
      comparabilityClassCommitment: `sha256:${COMPARABILITY_CLASS_COMMITMENT}`,

      transitionRuleDeclaration: position17.value,
      transitionRuleCommitment: `sha256:${TRANSITION_RULE_COMMITMENT}`,

      profileLocalNotes: structural.value.profile_local_notes,
    },
  }
}
