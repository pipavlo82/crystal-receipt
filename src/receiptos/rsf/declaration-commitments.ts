// RSF ISOLATED PRIMITIVES ONLY — positions 15, 16, and 17 of the 28-position
// evaluation order in
// docs/RECURSIVE_SINGLETON_FOLD_REFERENCE_PACKAGE_V0_WORKING_DRAFT.md §12,
// §12.1.
//
// Covered, each as an independent, non-chaining primitive:
//   position 15 — fold_policy_declaration shape, then commitment (§8.1)
//   position 16 — comparability_class_declaration shape, then commitment (§9.1)
//   position 17 — transition_rule_declaration shape, then commitment (§10.1)
//
// Not covered by this module, deliberately:
//   positions 1-14 and 18-28 (evaluation-input shape, source-admission
//   recomputation, semantic statement/inclusion-set/breakdown construction,
//   aggregate identity, the four-state evaluation envelope). This module does
//   not wire into `validateRsfEvaluationInputShape` and does not represent
//   positions 5-14 as evaluated. It is not the RSF evaluator.
//
// Each exported checker accepts exactly one declaration value, performs its
// own position-owned shape check, and — only on shape success — canonicalizes
// and hashes that single declaration and compares it against a module-local
// normative pin. Checkers never call one another and never run a later
// position.

import { canonicalize } from "../canon/canonicalize"
import { sha256 } from "../canon/receipt-root"

const FOLD_POLICY_SCHEMA = "recursive_singleton_fold_policy.v0"
const FOLD_POLICY_VERSION = "recursive-singleton-fold-policy-v0"
const FOLD_POLICY_ID = "singleton-chronicle-entry-semantic-preservation"
const FOLD_POLICY_SOURCE_OBJECT_SCHEMA = "chronicle_entry.v0"
const FOLD_POLICY_AGGREGATE_OBJECT_SCHEMA = "recursive_singleton_aggregate.v0"
const FOLD_POLICY_AGGREGATION_MODE = "singleton_only"
const FOLD_POLICY_SEMANTIC_ELEVATION = "forbidden"
const FOLD_POLICY_SOURCE_IDENTITY_REUSE = "forbidden"
const FOLD_POLICY_MULTI_MEMBER_EXTENSION = "deferred"

const FOLD_POLICY_KEYS = [
  "schema",
  "policy_version",
  "policy_id",
  "source_object_schema",
  "aggregate_object_schema",
  "member_cardinality",
  "aggregation_mode",
  "semantic_elevation",
  "source_identity_reuse",
  "multi_member_extension",
] as const

const COMPARABILITY_CLASS_SCHEMA = "recursive_singleton_comparability_class.v0"
const COMPARABILITY_CLASS_VERSION = "recursive-singleton-comparability-class-v0"
const COMPARABILITY_CLASS_ID = "admitted-chronicle-entry-singleton"
const COMPARABILITY_SOURCE_OBJECT_SCHEMA = "chronicle_entry.v0"
const COMPARABILITY_CROSS_ENTRY_COMPARABILITY = "not_asserted"
const COMPARABILITY_CROSS_POLICY_BRIDGE = "deferred"
const COMPARABILITY_CROSS_CLASS_BRIDGE = "deferred"
const COMPARABILITY_SINGLETON_ELIGIBILITY_RULE = "exactly_one_independently_admitted_source_entry"

const COMPARABILITY_CLASS_KEYS = [
  "schema",
  "class_version",
  "class_id",
  "source_object_schema",
  "admission_required",
  "cross_entry_comparability",
  "cross_policy_bridge",
  "cross_class_bridge",
  "singleton_eligibility_rule",
] as const

const TRANSITION_RULE_SCHEMA = "recursive_singleton_transition_rule.v0"
const TRANSITION_RULE_VERSION = "recursive-singleton-transition-rule-v0"
const TRANSITION_RULE_ID = "semantic_result_preserving_singleton_identity_transition"
const TRANSITION_SOURCE_OBJECT_SCHEMA = "chronicle_entry.v0"
const TRANSITION_AGGREGATE_OBJECT_SCHEMA = "recursive_singleton_aggregate.v0"
const TRANSITION_PRESERVED_EQUALITY_RELATION = "semantic_result_commitment_equality_only"
const TRANSITION_SOURCE_IDENTITY_REUSE = "forbidden"
const TRANSITION_STRONGER_CLASS_CREATION = "forbidden"

const TRANSITION_RULE_KEYS = [
  "schema",
  "rule_version",
  "rule_id",
  "source_object_schema",
  "aggregate_object_schema",
  "preserved_equality_relation",
  "source_identity_reuse",
  "stronger_class_creation",
  "fail_closed_on_malformed_or_unknown_input",
] as const

// Immutable reference-package pins — RECURSIVE_SINGLETON_FOLD_REFERENCE_PACKAGE_V0_WORKING_DRAFT.md §12.1.
export const FOLD_POLICY_COMMITMENT = "9c9617921b764cbdea0d2674e397a8a687e28a4a8f25ea4056515a1175b5455f" as const
export const COMPARABILITY_CLASS_COMMITMENT = "7a11e0f99232c5a0c41823551ca43064becd870b8f6abb941fc8820b57f088ed" as const
export const TRANSITION_RULE_COMMITMENT = "d5fa45fb6ab73c58d14a635d3ba7b899d653a73a133360b8e7ca7e530cfee25c" as const

export const FOLD_POLICY_CANONICAL_BYTE_LENGTH = 432 as const
export const COMPARABILITY_CLASS_CANONICAL_BYTE_LENGTH = 421 as const
export const TRANSITION_RULE_CANONICAL_BYTE_LENGTH = 477 as const

export type FoldPolicyDeclarationFindingCode = "malformed_fold_policy_declaration" | "fold_policy_commitment_mismatch"
export type ComparabilityClassDeclarationFindingCode =
  | "malformed_comparability_class_declaration"
  | "comparability_class_commitment_mismatch"
export type TransitionRuleDeclarationFindingCode =
  | "malformed_transition_rule_declaration"
  | "transition_rule_commitment_mismatch"

export type FoldPolicyDeclarationCheckFinding = {
  schema: "recursive_singleton_fold_finding.v0"
  code: FoldPolicyDeclarationFindingCode
  check_position: 15
}

export type ComparabilityClassDeclarationCheckFinding = {
  schema: "recursive_singleton_fold_finding.v0"
  code: ComparabilityClassDeclarationFindingCode
  check_position: 16
}

export type TransitionRuleDeclarationCheckFinding = {
  schema: "recursive_singleton_fold_finding.v0"
  code: TransitionRuleDeclarationFindingCode
  check_position: 17
}

// Proven only after shape success — every field's literal/type rule from RSF
// profile §8.1 has been checked.
export type FoldPolicyDeclarationShape = {
  schema: typeof FOLD_POLICY_SCHEMA
  policy_version: typeof FOLD_POLICY_VERSION
  policy_id: typeof FOLD_POLICY_ID
  source_object_schema: typeof FOLD_POLICY_SOURCE_OBJECT_SCHEMA
  aggregate_object_schema: typeof FOLD_POLICY_AGGREGATE_OBJECT_SCHEMA
  member_cardinality: number
  aggregation_mode: typeof FOLD_POLICY_AGGREGATION_MODE
  semantic_elevation: typeof FOLD_POLICY_SEMANTIC_ELEVATION
  source_identity_reuse: typeof FOLD_POLICY_SOURCE_IDENTITY_REUSE
  multi_member_extension: typeof FOLD_POLICY_MULTI_MEMBER_EXTENSION
}

export type ComparabilityClassDeclarationShape = {
  schema: typeof COMPARABILITY_CLASS_SCHEMA
  class_version: typeof COMPARABILITY_CLASS_VERSION
  class_id: typeof COMPARABILITY_CLASS_ID
  source_object_schema: typeof COMPARABILITY_SOURCE_OBJECT_SCHEMA
  admission_required: boolean
  cross_entry_comparability: typeof COMPARABILITY_CROSS_ENTRY_COMPARABILITY
  cross_policy_bridge: typeof COMPARABILITY_CROSS_POLICY_BRIDGE
  cross_class_bridge: typeof COMPARABILITY_CROSS_CLASS_BRIDGE
  singleton_eligibility_rule: typeof COMPARABILITY_SINGLETON_ELIGIBILITY_RULE
}

export type TransitionRuleDeclarationShape = {
  schema: typeof TRANSITION_RULE_SCHEMA
  rule_version: typeof TRANSITION_RULE_VERSION
  rule_id: typeof TRANSITION_RULE_ID
  source_object_schema: typeof TRANSITION_SOURCE_OBJECT_SCHEMA
  aggregate_object_schema: typeof TRANSITION_AGGREGATE_OBJECT_SCHEMA
  preserved_equality_relation: typeof TRANSITION_PRESERVED_EQUALITY_RELATION
  source_identity_reuse: typeof TRANSITION_SOURCE_IDENTITY_REUSE
  stronger_class_creation: typeof TRANSITION_STRONGER_CLASS_CREATION
  fail_closed_on_malformed_or_unknown_input: boolean
}

export type FoldPolicyDeclarationCheckResult =
  | { success: true; value: FoldPolicyDeclarationShape }
  | { success: false; finding: FoldPolicyDeclarationCheckFinding }

export type ComparabilityClassDeclarationCheckResult =
  | { success: true; value: ComparabilityClassDeclarationShape }
  | { success: false; finding: ComparabilityClassDeclarationCheckFinding }

export type TransitionRuleDeclarationCheckResult =
  | { success: true; value: TransitionRuleDeclarationShape }
  | { success: false; finding: TransitionRuleDeclarationCheckFinding }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasExactOwnKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const ownKeys = Object.keys(value)
  if (ownKeys.length !== keys.length) return false
  return keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function checkFoldPolicyShape(value: unknown): FoldPolicyDeclarationShape | null {
  if (!isPlainObject(value)) return null
  if (!hasExactOwnKeys(value, FOLD_POLICY_KEYS)) return null

  if (value.schema !== FOLD_POLICY_SCHEMA) return null
  if (value.policy_version !== FOLD_POLICY_VERSION) return null
  if (value.policy_id !== FOLD_POLICY_ID) return null
  if (value.source_object_schema !== FOLD_POLICY_SOURCE_OBJECT_SCHEMA) return null
  if (value.aggregate_object_schema !== FOLD_POLICY_AGGREGATE_OBJECT_SCHEMA) return null
  if (!isFiniteNumber(value.member_cardinality)) return null
  if (value.aggregation_mode !== FOLD_POLICY_AGGREGATION_MODE) return null
  if (value.semantic_elevation !== FOLD_POLICY_SEMANTIC_ELEVATION) return null
  if (value.source_identity_reuse !== FOLD_POLICY_SOURCE_IDENTITY_REUSE) return null
  if (value.multi_member_extension !== FOLD_POLICY_MULTI_MEMBER_EXTENSION) return null

  return {
    schema: FOLD_POLICY_SCHEMA,
    policy_version: FOLD_POLICY_VERSION,
    policy_id: FOLD_POLICY_ID,
    source_object_schema: FOLD_POLICY_SOURCE_OBJECT_SCHEMA,
    aggregate_object_schema: FOLD_POLICY_AGGREGATE_OBJECT_SCHEMA,
    member_cardinality: value.member_cardinality,
    aggregation_mode: FOLD_POLICY_AGGREGATION_MODE,
    semantic_elevation: FOLD_POLICY_SEMANTIC_ELEVATION,
    source_identity_reuse: FOLD_POLICY_SOURCE_IDENTITY_REUSE,
    multi_member_extension: FOLD_POLICY_MULTI_MEMBER_EXTENSION,
  }
}

function checkComparabilityClassShape(value: unknown): ComparabilityClassDeclarationShape | null {
  if (!isPlainObject(value)) return null
  if (!hasExactOwnKeys(value, COMPARABILITY_CLASS_KEYS)) return null

  if (value.schema !== COMPARABILITY_CLASS_SCHEMA) return null
  if (value.class_version !== COMPARABILITY_CLASS_VERSION) return null
  if (value.class_id !== COMPARABILITY_CLASS_ID) return null
  if (value.source_object_schema !== COMPARABILITY_SOURCE_OBJECT_SCHEMA) return null
  if (typeof value.admission_required !== "boolean") return null
  if (value.cross_entry_comparability !== COMPARABILITY_CROSS_ENTRY_COMPARABILITY) return null
  if (value.cross_policy_bridge !== COMPARABILITY_CROSS_POLICY_BRIDGE) return null
  if (value.cross_class_bridge !== COMPARABILITY_CROSS_CLASS_BRIDGE) return null
  if (value.singleton_eligibility_rule !== COMPARABILITY_SINGLETON_ELIGIBILITY_RULE) return null

  return {
    schema: COMPARABILITY_CLASS_SCHEMA,
    class_version: COMPARABILITY_CLASS_VERSION,
    class_id: COMPARABILITY_CLASS_ID,
    source_object_schema: COMPARABILITY_SOURCE_OBJECT_SCHEMA,
    admission_required: value.admission_required,
    cross_entry_comparability: COMPARABILITY_CROSS_ENTRY_COMPARABILITY,
    cross_policy_bridge: COMPARABILITY_CROSS_POLICY_BRIDGE,
    cross_class_bridge: COMPARABILITY_CROSS_CLASS_BRIDGE,
    singleton_eligibility_rule: COMPARABILITY_SINGLETON_ELIGIBILITY_RULE,
  }
}

function checkTransitionRuleShape(value: unknown): TransitionRuleDeclarationShape | null {
  if (!isPlainObject(value)) return null
  if (!hasExactOwnKeys(value, TRANSITION_RULE_KEYS)) return null

  if (value.schema !== TRANSITION_RULE_SCHEMA) return null
  if (value.rule_version !== TRANSITION_RULE_VERSION) return null
  if (value.rule_id !== TRANSITION_RULE_ID) return null
  if (value.source_object_schema !== TRANSITION_SOURCE_OBJECT_SCHEMA) return null
  if (value.aggregate_object_schema !== TRANSITION_AGGREGATE_OBJECT_SCHEMA) return null
  if (value.preserved_equality_relation !== TRANSITION_PRESERVED_EQUALITY_RELATION) return null
  if (value.source_identity_reuse !== TRANSITION_SOURCE_IDENTITY_REUSE) return null
  if (value.stronger_class_creation !== TRANSITION_STRONGER_CLASS_CREATION) return null
  if (typeof value.fail_closed_on_malformed_or_unknown_input !== "boolean") return null

  return {
    schema: TRANSITION_RULE_SCHEMA,
    rule_version: TRANSITION_RULE_VERSION,
    rule_id: TRANSITION_RULE_ID,
    source_object_schema: TRANSITION_SOURCE_OBJECT_SCHEMA,
    aggregate_object_schema: TRANSITION_AGGREGATE_OBJECT_SCHEMA,
    preserved_equality_relation: TRANSITION_PRESERVED_EQUALITY_RELATION,
    source_identity_reuse: TRANSITION_SOURCE_IDENTITY_REUSE,
    stronger_class_creation: TRANSITION_STRONGER_CLASS_CREATION,
    fail_closed_on_malformed_or_unknown_input: value.fail_closed_on_malformed_or_unknown_input,
  }
}

function commitmentOf(value: unknown): string {
  return sha256(canonicalize(value))
}

// Isolated position-15 primitive only. Does not run positions 1-14 or 16-28,
// does not accept the seven-field evaluation input, and does not accept an
// expected commitment, package identity, or any external source.
export function checkFoldPolicyDeclaration(declaration: unknown): FoldPolicyDeclarationCheckResult {
  const shape = checkFoldPolicyShape(declaration)
  if (shape === null) {
    return {
      success: false,
      finding: { schema: "recursive_singleton_fold_finding.v0", code: "malformed_fold_policy_declaration", check_position: 15 },
    }
  }

  if (commitmentOf(shape) !== FOLD_POLICY_COMMITMENT) {
    return {
      success: false,
      finding: { schema: "recursive_singleton_fold_finding.v0", code: "fold_policy_commitment_mismatch", check_position: 15 },
    }
  }

  return { success: true, value: shape }
}

// Isolated position-16 primitive only. Does not run positions 1-15 or 17-28.
export function checkComparabilityClassDeclaration(declaration: unknown): ComparabilityClassDeclarationCheckResult {
  const shape = checkComparabilityClassShape(declaration)
  if (shape === null) {
    return {
      success: false,
      finding: {
        schema: "recursive_singleton_fold_finding.v0",
        code: "malformed_comparability_class_declaration",
        check_position: 16,
      },
    }
  }

  if (commitmentOf(shape) !== COMPARABILITY_CLASS_COMMITMENT) {
    return {
      success: false,
      finding: {
        schema: "recursive_singleton_fold_finding.v0",
        code: "comparability_class_commitment_mismatch",
        check_position: 16,
      },
    }
  }

  return { success: true, value: shape }
}

// Isolated position-17 primitive only. Does not run positions 1-16 or 18-28.
export function checkTransitionRuleDeclaration(declaration: unknown): TransitionRuleDeclarationCheckResult {
  const shape = checkTransitionRuleShape(declaration)
  if (shape === null) {
    return {
      success: false,
      finding: {
        schema: "recursive_singleton_fold_finding.v0",
        code: "malformed_transition_rule_declaration",
        check_position: 17,
      },
    }
  }

  if (commitmentOf(shape) !== TRANSITION_RULE_COMMITMENT) {
    return {
      success: false,
      finding: {
        schema: "recursive_singleton_fold_finding.v0",
        code: "transition_rule_commitment_mismatch",
        check_position: 17,
      },
    }
  }

  return { success: true, value: shape }
}
