import type { ChronicleCheckpointV0 } from "./chronicle-portfolio-v0"
import { verifyChronicleCheckpointV0 } from "./chronicle-portfolio-v0"

export type ChronicleCheckpointContinuityEvaluationState = "evaluated" | "unverifiable" | "malformed" | "not_evaluated"
export type ChronicleCheckpointContinuityVerdict = "valid" | "invalid" | null
export type ChronicleCheckpointContinuityRelation = "genesis" | "successor" | null
export type ChronicleCheckpointContinuityReasonCode =
  | "genesis"
  | "direct_successor"
  | "current_shape_malformed"
  | "current_local_verifier_failed"
  | "predecessor_unknown"
  | "predecessor_shape_malformed"
  | "predecessor_local_verifier_failed"
  | "predecessor_ref_mismatch"
  | "sequence_gap"
  | "predecessor_same_sequence"
  | "predecessor_higher_sequence"

export type ChronicleCheckpointContinuityResultV0 = {
  evaluation_state: ChronicleCheckpointContinuityEvaluationState
  verdict: ChronicleCheckpointContinuityVerdict
  relation: ChronicleCheckpointContinuityRelation
  reason_code: ChronicleCheckpointContinuityReasonCode
}

function isChronicleCheckpointShapeValid(checkpoint: Pick<ChronicleCheckpointV0, "sequence" | "prev_checkpoint">): boolean {
  if (!Number.isInteger(checkpoint.sequence)) {
    return false
  }
  if (checkpoint.sequence < 0) {
    return false
  }
  if (checkpoint.sequence === 0 && checkpoint.prev_checkpoint !== null) {
    return false
  }
  if (
    checkpoint.sequence > 0 &&
    (checkpoint.prev_checkpoint === null || checkpoint.prev_checkpoint === undefined)
  ) {
    return false
  }
  return true
}

export function evaluateChronicleCheckpointContinuityV0(
  current: ChronicleCheckpointV0,
  predecessor: ChronicleCheckpointV0 | null,
): ChronicleCheckpointContinuityResultV0 {
  if (!isChronicleCheckpointShapeValid(current)) {
    return { evaluation_state: "malformed", verdict: null, relation: null, reason_code: "current_shape_malformed" }
  }

  if (!verifyChronicleCheckpointV0(current).ok) {
    return { evaluation_state: "not_evaluated", verdict: null, relation: null, reason_code: "current_local_verifier_failed" }
  }

  if (current.sequence === 0 && current.prev_checkpoint === null) {
    return { evaluation_state: "evaluated", verdict: "valid", relation: "genesis", reason_code: "genesis" }
  }

  if (predecessor === null) {
    return { evaluation_state: "unverifiable", verdict: null, relation: null, reason_code: "predecessor_unknown" }
  }

  if (!isChronicleCheckpointShapeValid(predecessor)) {
    return { evaluation_state: "malformed", verdict: null, relation: null, reason_code: "predecessor_shape_malformed" }
  }

  if (!verifyChronicleCheckpointV0(predecessor).ok) {
    return { evaluation_state: "not_evaluated", verdict: null, relation: null, reason_code: "predecessor_local_verifier_failed" }
  }

  if (current.prev_checkpoint !== predecessor.checkpoint_root) {
    return { evaluation_state: "evaluated", verdict: "invalid", relation: null, reason_code: "predecessor_ref_mismatch" }
  }

  if (predecessor.sequence === current.sequence - 1) {
    return { evaluation_state: "evaluated", verdict: "valid", relation: "successor", reason_code: "direct_successor" }
  }

  if (predecessor.sequence < current.sequence - 1) {
    return { evaluation_state: "evaluated", verdict: "invalid", relation: null, reason_code: "sequence_gap" }
  }

  if (predecessor.sequence === current.sequence) {
    return { evaluation_state: "evaluated", verdict: "invalid", relation: null, reason_code: "predecessor_same_sequence" }
  }

  return { evaluation_state: "evaluated", verdict: "invalid", relation: null, reason_code: "predecessor_higher_sequence" }
}
