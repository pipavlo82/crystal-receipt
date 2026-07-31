// Deterministic adapter from a position-4-validated RSF construction-options
// object (ref-pkg §8.1) to the existing `createChronicleEntryV0` constructor's
// `options` parameter (ref-pkg §8.2-§8.8).
//
// This module does not call `createChronicleEntryV0`, does not inspect
// evidence or proof objects, does not perform receipt-root or any other
// admission check, does not derive IDs, and does not emit RSF findings. It is
// only a pure, deterministic value mapping.
//
// `createChronicleEntryV0` is imported for its type only (`import type`), to
// keep the adapter's output structurally exact-compatible with the real
// constructor's parameter type without duplicating or re-declaring it. There
// is no runtime dependency on Chronicle admission code.

import type { createChronicleEntryV0 } from "../capsule/chronicle-portfolio-v0"
import type { RsfConstructionOptionsShape } from "./evaluation-input-shape"

export type RsfChronicleConstructorOptions = NonNullable<Parameters<typeof createChronicleEntryV0>[2]>

// Maps a position-4-validated RsfConstructionOptionsShape onto the exact
// deterministic adapter defined in ref-pkg §8:
//
// - entry_id / evidence_capsule_ref / provenance_summary_ref:
//   null -> key omitted (constructor default path applies); string
//   (including "") -> passed through unchanged.
// - created_from / notes: null -> passed through as null unchanged (never
//   omitted); string (including "") -> passed through unchanged.
// - labels: a fresh array copy, exact order and duplicate members
//   preserved, no normalization/dedup/sort.
//
// Callers must pass an object that has already passed
// validateRsfEvaluationInputShape's position-4 check (or an equivalent
// structural guarantee) — this function performs no shape validation of its
// own.
export function adaptRsfConstructionOptions(options: RsfConstructionOptionsShape): RsfChronicleConstructorOptions {
  return {
    ...(options.entry_id !== null ? { entryId: options.entry_id } : {}),
    ...(options.evidence_capsule_ref !== null ? { evidenceCapsuleRef: options.evidence_capsule_ref } : {}),
    ...(options.provenance_summary_ref !== null ? { provenanceSummaryRef: options.provenance_summary_ref } : {}),
    createdFrom: options.created_from,
    labels: [...options.labels],
    notes: options.notes,
  }
}
