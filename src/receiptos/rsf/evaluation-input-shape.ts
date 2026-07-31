// RSF STRUCTURAL SCOPE ONLY — positions 1, 2, 3, and 4 of the 28-position
// evaluation order in
// docs/RECURSIVE_SINGLETON_FOLD_REFERENCE_PACKAGE_V0_WORKING_DRAFT.md §12.
//
// Covered:
//   position 1 — evaluation-input top-level shape (§7)
//   position 2 — source-admission-bundle outer shape and pinned literals (§5, §5.4)
//   position 3 — nested source-admission containers present as objects (§6 step 3)
//   position 4 — construction-options shape (§8)
//
// Not covered by this module, deliberately:
//   positions 5-28 (evidence shape, proof-object shape, claimed-entry shape,
//   declaration shapes, Chronicle admission recomputation, aggregate
//   construction/validation, the four-state evaluation envelope).
//
// A `success` result means positions 1-4 passed. It does NOT mean:
//   - source_evidence, source_proof_object, or claimed_source_entry are
//     semantically valid (their interiors are never inspected here);
//   - fold_policy_declaration, comparability_class_declaration, or
//     transition_rule_declaration are valid or even object-shaped (position 1
//     only requires them to be non-null; their shape is checked at positions
//     15-17, not implemented here);
//   - Chronicle admission has run or would succeed;
//   - an aggregate exists or could be constructed;
//   - this is RSF conformance, full RSF validation, or the RSF evaluator.
//
// The input is an already-available JavaScript value. This module does not
// parse JSON text or bytes, does not define a transport/parser contract, and
// makes no cross-language conformance claim.

const EVALUATION_INPUT_SCHEMA = "recursive_singleton_fold_evaluation_input.v0"
const EVALUATION_INPUT_PROFILE_ID = "recursive-singleton-fold-profile-v0"

const EVALUATION_INPUT_KEYS = [
  "schema",
  "profile_id",
  "source_admission_bundle",
  "fold_policy_declaration",
  "comparability_class_declaration",
  "transition_rule_declaration",
  "profile_local_notes",
] as const

const BUNDLE_SCHEMA = "recursive_singleton_fold_source_admission_bundle.v0"
const BUNDLE_VERSION = "recursive-singleton-fold-source-admission-bundle-v0"
const ADMISSION_PROFILE_ID = "receiptos-chronicle-admission-v0"
const ADMISSION_FIXTURE_SET_SHA256 = "ff35ca8ae5cef10009479d50c10e111869875f6f62fb9d6bcb00f5aa5a1b4b4f"

const BUNDLE_KEYS = [
  "schema",
  "bundle_version",
  "admission_profile_id",
  "admission_fixture_set_sha256",
  "source_evidence",
  "source_proof_object",
  "source_entry_construction_options",
  "claimed_source_entry",
] as const

const BUNDLE_CONTAINER_KEYS = [
  "source_evidence",
  "source_proof_object",
  "source_entry_construction_options",
  "claimed_source_entry",
] as const

const CONSTRUCTION_OPTION_KEYS = [
  "entry_id",
  "evidence_capsule_ref",
  "provenance_summary_ref",
  "created_from",
  "labels",
  "notes",
] as const

export type RsfStructuralFindingCode =
  | "malformed_evaluation_input"
  | "malformed_source_admission_bundle"
  | "malformed_source_entry_construction_options"

export type RsfStructuralCheckPosition = 1 | 2 | 3 | 4

export type RsfStructuralFinding = {
  schema: "recursive_singleton_fold_finding.v0"
  code: RsfStructuralFindingCode
  check_position: RsfStructuralCheckPosition
}

// Fully validated at position 4 — every field's value-type/nullability rule
// from ref-pkg §8.1-§8.8 has been checked.
export type RsfConstructionOptionsShape = {
  entry_id: string | null
  evidence_capsule_ref: string | null
  provenance_summary_ref: string | null
  created_from: string | null
  labels: string[]
  notes: string | null
}

// Proven at position 2 (own outer shape/literals) and position 3 (the four
// nested members are object containers). Their interiors are NOT validated
// here, except source_entry_construction_options, which position 4 fully
// validates.
export type RsfSourceAdmissionBundleShape = {
  schema: typeof BUNDLE_SCHEMA
  bundle_version: typeof BUNDLE_VERSION
  admission_profile_id: typeof ADMISSION_PROFILE_ID
  admission_fixture_set_sha256: typeof ADMISSION_FIXTURE_SET_SHA256
  source_evidence: Record<string, unknown>
  source_proof_object: Record<string, unknown>
  source_entry_construction_options: RsfConstructionOptionsShape
  claimed_source_entry: Record<string, unknown>
}

// Proven at position 1. The three declaration fields are only proven
// non-null here — their shape is out of scope for this module (RSF profile
// §8.1/§9.1/§10.1, ref-pkg §12 positions 15-17, not implemented).
export type RsfEvaluationInputShape = {
  schema: typeof EVALUATION_INPUT_SCHEMA
  profile_id: typeof EVALUATION_INPUT_PROFILE_ID
  source_admission_bundle: RsfSourceAdmissionBundleShape
  fold_policy_declaration: unknown
  comparability_class_declaration: unknown
  transition_rule_declaration: unknown
  profile_local_notes: string | null
}

export type RsfStructuralValidationResult =
  | { success: true; value: RsfEvaluationInputShape }
  | { success: false; finding: RsfStructuralFinding }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasExactOwnKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const ownKeys = Object.keys(value)
  if (ownKeys.length !== keys.length) return false
  return keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
}

function isNonNullPresent(value: unknown): boolean {
  return value !== null && value !== undefined
}

function finding(code: RsfStructuralFindingCode, check_position: RsfStructuralCheckPosition): RsfStructuralFinding {
  return { schema: "recursive_singleton_fold_finding.v0", code, check_position }
}

type Step<T> = { ok: true; value: T } | { ok: false }

function checkPosition1(input: unknown): Step<{
  schema: typeof EVALUATION_INPUT_SCHEMA
  profile_id: typeof EVALUATION_INPUT_PROFILE_ID
  source_admission_bundle: unknown
  fold_policy_declaration: unknown
  comparability_class_declaration: unknown
  transition_rule_declaration: unknown
  profile_local_notes: string | null
}> {
  if (!isPlainObject(input)) return { ok: false }
  if (!hasExactOwnKeys(input, EVALUATION_INPUT_KEYS)) return { ok: false }
  if (input.schema !== EVALUATION_INPUT_SCHEMA) return { ok: false }
  if (input.profile_id !== EVALUATION_INPUT_PROFILE_ID) return { ok: false }

  const notes = input.profile_local_notes
  if (notes !== null && typeof notes !== "string") return { ok: false }

  if (!isNonNullPresent(input.source_admission_bundle)) return { ok: false }
  if (!isNonNullPresent(input.fold_policy_declaration)) return { ok: false }
  if (!isNonNullPresent(input.comparability_class_declaration)) return { ok: false }
  if (!isNonNullPresent(input.transition_rule_declaration)) return { ok: false }

  return {
    ok: true,
    value: {
      schema: EVALUATION_INPUT_SCHEMA,
      profile_id: EVALUATION_INPUT_PROFILE_ID,
      source_admission_bundle: input.source_admission_bundle,
      fold_policy_declaration: input.fold_policy_declaration,
      comparability_class_declaration: input.comparability_class_declaration,
      transition_rule_declaration: input.transition_rule_declaration,
      profile_local_notes: notes,
    },
  }
}

function checkPosition2(bundle: unknown): Step<{
  schema: typeof BUNDLE_SCHEMA
  bundle_version: typeof BUNDLE_VERSION
  admission_profile_id: typeof ADMISSION_PROFILE_ID
  admission_fixture_set_sha256: typeof ADMISSION_FIXTURE_SET_SHA256
  source_evidence: unknown
  source_proof_object: unknown
  source_entry_construction_options: unknown
  claimed_source_entry: unknown
}> {
  if (!isPlainObject(bundle)) return { ok: false }
  if (!hasExactOwnKeys(bundle, BUNDLE_KEYS)) return { ok: false }
  if (bundle.schema !== BUNDLE_SCHEMA) return { ok: false }
  if (bundle.bundle_version !== BUNDLE_VERSION) return { ok: false }
  if (bundle.admission_profile_id !== ADMISSION_PROFILE_ID) return { ok: false }
  if (bundle.admission_fixture_set_sha256 !== ADMISSION_FIXTURE_SET_SHA256) return { ok: false }

  for (const key of BUNDLE_CONTAINER_KEYS) {
    if (!isNonNullPresent(bundle[key])) return { ok: false }
  }

  return {
    ok: true,
    value: {
      schema: BUNDLE_SCHEMA,
      bundle_version: BUNDLE_VERSION,
      admission_profile_id: ADMISSION_PROFILE_ID,
      admission_fixture_set_sha256: ADMISSION_FIXTURE_SET_SHA256,
      source_evidence: bundle.source_evidence,
      source_proof_object: bundle.source_proof_object,
      source_entry_construction_options: bundle.source_entry_construction_options,
      claimed_source_entry: bundle.claimed_source_entry,
    },
  }
}

// Position 3 proves ONLY that the four bundle members are object containers.
// No interior field of any of the four is inspected here.
function checkPosition3<T extends { source_evidence: unknown; source_proof_object: unknown; source_entry_construction_options: unknown; claimed_source_entry: unknown }>(
  bundle: T,
): Step<
  Omit<T, "source_evidence" | "source_proof_object" | "source_entry_construction_options" | "claimed_source_entry"> & {
    source_evidence: Record<string, unknown>
    source_proof_object: Record<string, unknown>
    source_entry_construction_options: Record<string, unknown>
    claimed_source_entry: Record<string, unknown>
  }
> {
  if (!isPlainObject(bundle.source_evidence)) return { ok: false }
  if (!isPlainObject(bundle.source_proof_object)) return { ok: false }
  if (!isPlainObject(bundle.source_entry_construction_options)) return { ok: false }
  if (!isPlainObject(bundle.claimed_source_entry)) return { ok: false }

  return {
    ok: true,
    value: {
      ...bundle,
      source_evidence: bundle.source_evidence,
      source_proof_object: bundle.source_proof_object,
      source_entry_construction_options: bundle.source_entry_construction_options,
      claimed_source_entry: bundle.claimed_source_entry,
    },
  }
}

function checkPosition4(options: unknown): Step<RsfConstructionOptionsShape> {
  if (!isPlainObject(options)) return { ok: false }
  if (!hasExactOwnKeys(options, CONSTRUCTION_OPTION_KEYS)) return { ok: false }

  const entryId = options.entry_id
  if (entryId !== null && typeof entryId !== "string") return { ok: false }

  const evidenceCapsuleRef = options.evidence_capsule_ref
  if (evidenceCapsuleRef !== null && typeof evidenceCapsuleRef !== "string") return { ok: false }

  const provenanceSummaryRef = options.provenance_summary_ref
  if (provenanceSummaryRef !== null && typeof provenanceSummaryRef !== "string") return { ok: false }

  const createdFrom = options.created_from
  if (createdFrom !== null && typeof createdFrom !== "string") return { ok: false }

  const labels = options.labels
  if (!Array.isArray(labels) || !labels.every((member) => typeof member === "string")) return { ok: false }

  const notes = options.notes
  if (notes !== null && typeof notes !== "string") return { ok: false }

  return {
    ok: true,
    value: {
      entry_id: entryId,
      evidence_capsule_ref: evidenceCapsuleRef,
      provenance_summary_ref: provenanceSummaryRef,
      created_from: createdFrom,
      labels: labels as string[],
      notes,
    },
  }
}

// Structural validation ONLY, for RSF evaluation-input positions 1, 2, 3,
// and 4 (of 28) — see the module header for the exact boundary.
//
// Runs first-position semantics: position 1, then 2, then 3, then 4. The
// first failing position returns immediately with exactly that position's
// finding; later positions never run and never produce a result. Multiple
// defects within one position collapse to that position's single code.
//
// success: true means positions 1-4 passed. It does not validate
// source_evidence, source_proof_object, or claimed_source_entry interiors,
// does not validate the three declarations' shape, does not run Chronicle
// admission, and does not imply an aggregate exists.
export function validateRsfEvaluationInputShape(input: unknown): RsfStructuralValidationResult {
  const position1 = checkPosition1(input)
  if (!position1.ok) return { success: false, finding: finding("malformed_evaluation_input", 1) }

  const position2 = checkPosition2(position1.value.source_admission_bundle)
  if (!position2.ok) return { success: false, finding: finding("malformed_source_admission_bundle", 2) }

  const position3 = checkPosition3(position2.value)
  if (!position3.ok) return { success: false, finding: finding("malformed_source_admission_bundle", 3) }

  const position4 = checkPosition4(position3.value.source_entry_construction_options)
  if (!position4.ok) return { success: false, finding: finding("malformed_source_entry_construction_options", 4) }

  return {
    success: true,
    value: {
      schema: position1.value.schema,
      profile_id: position1.value.profile_id,
      source_admission_bundle: {
        schema: position3.value.schema,
        bundle_version: position3.value.bundle_version,
        admission_profile_id: position3.value.admission_profile_id,
        admission_fixture_set_sha256: position3.value.admission_fixture_set_sha256,
        source_evidence: position3.value.source_evidence,
        source_proof_object: position3.value.source_proof_object,
        source_entry_construction_options: position4.value,
        claimed_source_entry: position3.value.claimed_source_entry,
      },
      fold_policy_declaration: position1.value.fold_policy_declaration,
      comparability_class_declaration: position1.value.comparability_class_declaration,
      transition_rule_declaration: position1.value.transition_rule_declaration,
      profile_local_notes: position1.value.profile_local_notes,
    },
  }
}
