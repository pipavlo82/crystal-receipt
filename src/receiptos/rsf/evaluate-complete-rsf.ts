import {
  evaluateRsfPrefixThroughPosition17,
  type RsfPrefixThroughPosition17Finding,
  type RsfPrefixThroughPosition17Value,
} from "./evaluate-prefix-through-position-17"
import {
  evaluateRsfPositions18Through28,
  type RecursiveSingletonAggregateV0,
  type RsfPositions18Through28Finding,
} from "./evaluate-positions-18-through-28"
import { snapshotRsfJson } from "./strict-json-snapshot"

export type RecursiveSingletonFoldFinding = RsfPrefixThroughPosition17Finding | RsfPositions18Through28Finding

export type RecursiveSingletonFoldEvaluation =
  | {
      schema: "recursive_singleton_fold_evaluation.v0"
      evaluation_state: "evaluated"
      profile_verdict: "accepted"
      aggregate: RecursiveSingletonAggregateV0
      finding: null
    }
  | {
      schema: "recursive_singleton_fold_evaluation.v0"
      evaluation_state: "evaluated"
      profile_verdict: "rejected"
      aggregate: null
      finding: RecursiveSingletonFoldFinding
    }
  | {
      schema: "recursive_singleton_fold_evaluation.v0"
      evaluation_state: "unverifiable"
      profile_verdict: null
      aggregate: null
      finding: RecursiveSingletonFoldFinding
    }
  | {
      schema: "recursive_singleton_fold_evaluation.v0"
      evaluation_state: "malformed"
      profile_verdict: null
      aggregate: null
      finding: RecursiveSingletonFoldFinding
    }

const MALFORMED_PREFIX_CODES = new Set([
  "malformed_evaluation_input",
  "malformed_source_admission_bundle",
  "malformed_source_entry_construction_options",
  "malformed_source_evidence",
  "malformed_portable_proof_object",
  "malformed_source_entry",
  "malformed_fold_policy_declaration",
  "malformed_comparability_class_declaration",
  "malformed_transition_rule_declaration",
])

function malformedInputFinding(): RecursiveSingletonFoldEvaluation {
  return {schema:"recursive_singleton_fold_evaluation.v0",evaluation_state:"malformed",profile_verdict:null,aggregate:null,
    finding:{schema:"recursive_singleton_fold_finding.v0",code:"malformed_evaluation_input",check_position:1}}
}

function prefixEnvelope(finding: RsfPrefixThroughPosition17Finding): RecursiveSingletonFoldEvaluation {
  if (finding.code === "source_admission_prerequisite_unavailable") {
    return {schema:"recursive_singleton_fold_evaluation.v0",evaluation_state:"unverifiable",profile_verdict:null,aggregate:null,finding}
  }
  if (MALFORMED_PREFIX_CODES.has(finding.code)) {
    return {schema:"recursive_singleton_fold_evaluation.v0",evaluation_state:"malformed",profile_verdict:null,aggregate:null,finding}
  }
  return {schema:"recursive_singleton_fold_evaluation.v0",evaluation_state:"evaluated",profile_verdict:"rejected",aggregate:null,finding}
}

/** Complete public evaluator. Only this function can construct the canonical accepted envelope. */
export function evaluateCompleteRsf(input: unknown, stageInput: unknown): RecursiveSingletonFoldEvaluation {
  let inputSnapshot: unknown
  try { inputSnapshot = snapshotRsfJson(input,"$input") } catch { return malformedInputFinding() }

  const prefix = evaluateRsfPrefixThroughPosition17(inputSnapshot)
  if (!prefix.success) return prefixEnvelope(prefix.finding)

  return evaluateCompleteRsfFromPrefix(prefix.value,stageInput)
}

/** Composition seam for an already mechanically established position-17 continuation. Not re-exported publicly. */
export function evaluateCompleteRsfFromPrefix(prefixValue: RsfPrefixThroughPosition17Value, stageInput: unknown): RecursiveSingletonFoldEvaluation {
  const stage = evaluateRsfPositions18Through28(prefixValue,stageInput)
  if (stage.kind === "finding") {
    const state = stage.finding.code === "malformed_rsf_stage_input" ? "malformed" : "evaluated"
    return {schema:"recursive_singleton_fold_evaluation.v0",evaluation_state:state,
      profile_verdict:state === "evaluated" ? "rejected" : null,aggregate:null,finding:stage.finding} as RecursiveSingletonFoldEvaluation
  }

  return {schema:"recursive_singleton_fold_evaluation.v0",evaluation_state:"evaluated",profile_verdict:"accepted",
    aggregate:stage.aggregate,finding:null}
}
