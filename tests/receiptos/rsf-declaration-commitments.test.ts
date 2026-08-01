import { describe, expect, test } from "bun:test"
import {
  checkComparabilityClassDeclaration,
  checkFoldPolicyDeclaration,
  checkTransitionRuleDeclaration,
  COMPARABILITY_CLASS_CANONICAL_BYTE_LENGTH,
  COMPARABILITY_CLASS_COMMITMENT,
  FOLD_POLICY_CANONICAL_BYTE_LENGTH,
  FOLD_POLICY_COMMITMENT,
  TRANSITION_RULE_CANONICAL_BYTE_LENGTH,
  TRANSITION_RULE_COMMITMENT,
} from "../../src/receiptos"
import { canonicalize } from "../../src/receiptos/canon/canonicalize"
import { sha256 } from "../../src/receiptos/canon/receipt-root"

// Independently constructed normative declaration values — RSF profile
// §8.1, §9.1, §10.1. Deliberately NOT imported from production code.

function normativeFoldPolicy() {
  return {
    schema: "recursive_singleton_fold_policy.v0",
    policy_version: "recursive-singleton-fold-policy-v0",
    policy_id: "singleton-chronicle-entry-semantic-preservation",
    source_object_schema: "chronicle_entry.v0",
    aggregate_object_schema: "recursive_singleton_aggregate.v0",
    member_cardinality: 1,
    aggregation_mode: "singleton_only",
    semantic_elevation: "forbidden",
    source_identity_reuse: "forbidden",
    multi_member_extension: "deferred",
  }
}

function normativeComparabilityClass() {
  return {
    schema: "recursive_singleton_comparability_class.v0",
    class_version: "recursive-singleton-comparability-class-v0",
    class_id: "admitted-chronicle-entry-singleton",
    source_object_schema: "chronicle_entry.v0",
    admission_required: true,
    cross_entry_comparability: "not_asserted",
    cross_policy_bridge: "deferred",
    cross_class_bridge: "deferred",
    singleton_eligibility_rule: "exactly_one_independently_admitted_source_entry",
  }
}

function normativeTransitionRule() {
  return {
    schema: "recursive_singleton_transition_rule.v0",
    rule_version: "recursive-singleton-transition-rule-v0",
    rule_id: "semantic_result_preserving_singleton_identity_transition",
    source_object_schema: "chronicle_entry.v0",
    aggregate_object_schema: "recursive_singleton_aggregate.v0",
    preserved_equality_relation: "semantic_result_commitment_equality_only",
    source_identity_reuse: "forbidden",
    stronger_class_creation: "forbidden",
    fail_closed_on_malformed_or_unknown_input: true,
  }
}

// ---------------------------------------------------------------------------
// Pin integrity — recompute each pin independently via the real repository
// canonicalize()/sha256(), from an independently constructed normative value.
// ---------------------------------------------------------------------------

describe("pin integrity", () => {
  test("fold_policy_declaration pin", () => {
    const canonical = canonicalize(normativeFoldPolicy())
    const bytes = Buffer.byteLength(canonical, "utf8")
    const digest = sha256(canonical)
    expect(bytes).toBe(432)
    expect(bytes).toBe(FOLD_POLICY_CANONICAL_BYTE_LENGTH)
    expect(digest).toBe("9c9617921b764cbdea0d2674e397a8a687e28a4a8f25ea4056515a1175b5455f")
    expect(digest).toBe(FOLD_POLICY_COMMITMENT)
  })

  test("comparability_class_declaration pin", () => {
    const canonical = canonicalize(normativeComparabilityClass())
    const bytes = Buffer.byteLength(canonical, "utf8")
    const digest = sha256(canonical)
    expect(bytes).toBe(421)
    expect(bytes).toBe(COMPARABILITY_CLASS_CANONICAL_BYTE_LENGTH)
    expect(digest).toBe("7a11e0f99232c5a0c41823551ca43064becd870b8f6abb941fc8820b57f088ed")
    expect(digest).toBe(COMPARABILITY_CLASS_COMMITMENT)
  })

  test("transition_rule_declaration pin", () => {
    const canonical = canonicalize(normativeTransitionRule())
    const bytes = Buffer.byteLength(canonical, "utf8")
    const digest = sha256(canonical)
    expect(bytes).toBe(477)
    expect(bytes).toBe(TRANSITION_RULE_CANONICAL_BYTE_LENGTH)
    expect(digest).toBe("d5fa45fb6ab73c58d14a635d3ba7b899d653a73a133360b8e7ca7e530cfee25c")
    expect(digest).toBe(TRANSITION_RULE_COMMITMENT)
  })
})

// ---------------------------------------------------------------------------
// Position 15 — fold_policy_declaration
// ---------------------------------------------------------------------------

describe("checkFoldPolicyDeclaration - positive", () => {
  test("exact normative declaration passes", () => {
    const result = checkFoldPolicyDeclaration(normativeFoldPolicy())
    expect(result.success).toBe(true)
  })

  test("different insertion order, identical abstract value, passes", () => {
    const v = normativeFoldPolicy()
    const reordered = {
      multi_member_extension: v.multi_member_extension,
      source_identity_reuse: v.source_identity_reuse,
      semantic_elevation: v.semantic_elevation,
      aggregation_mode: v.aggregation_mode,
      member_cardinality: v.member_cardinality,
      aggregate_object_schema: v.aggregate_object_schema,
      source_object_schema: v.source_object_schema,
      policy_id: v.policy_id,
      policy_version: v.policy_version,
      schema: v.schema,
    }
    expect(checkFoldPolicyDeclaration(reordered).success).toBe(true)
  })

  test("freshly reconstructed host object, identical abstract value, passes", () => {
    const fresh = JSON.parse(JSON.stringify(normativeFoldPolicy()))
    expect(checkFoldPolicyDeclaration(fresh).success).toBe(true)
  })

  test("input remains unmodified", () => {
    const input = Object.freeze(normativeFoldPolicy())
    expect(() => checkFoldPolicyDeclaration(input)).not.toThrow()
    expect(input).toEqual(normativeFoldPolicy())
  })
})

describe("checkFoldPolicyDeclaration - negative: shape (malformed_fold_policy_declaration)", () => {
  function expectMalformed(value: unknown) {
    const result = checkFoldPolicyDeclaration(value)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.finding).toEqual({
      schema: "recursive_singleton_fold_finding.v0",
      code: "malformed_fold_policy_declaration",
      check_position: 15,
    })
  }

  test("null", () => expectMalformed(null))
  test("array", () => expectMalformed([normativeFoldPolicy()]))
  test("non-object scalar", () => expectMalformed("recursive_singleton_fold_policy.v0"))

  test("missing singleton key (schema)", () => {
    const { schema, ...rest } = normativeFoldPolicy()
    expectMalformed(rest)
  })

  test("extra top-level key", () => {
    expectMalformed({ ...normativeFoldPolicy(), extra_field: "unexpected" })
  })

  test("wrong singleton key (schema holds wrong literal)", () => {
    expectMalformed({ ...normativeFoldPolicy(), schema: "wrong_schema.v0" })
  })

  test("missing required inner member", () => {
    const { policy_id, ...rest } = normativeFoldPolicy()
    expectMalformed(rest)
  })

  test("extra inner member", () => {
    expectMalformed({ ...normativeFoldPolicy(), profile_local_notes: null })
  })

  test("wrong pinned literal (aggregation_mode)", () => {
    expectMalformed({ ...normativeFoldPolicy(), aggregation_mode: "batch_mode" })
  })

  test("cross-declaration input is rejected as malformed, not delegated", () => {
    expectMalformed(normativeComparabilityClass())
  })

  // member_cardinality is an exact normative literal (RSF profile §8.1: "1"),
  // not a generic finite-number field. Every value other than the literal 1
  // is a shape failure, never a commitment mismatch.
  const WRONG_MEMBER_CARDINALITY_VALUES: Array<[string, unknown]> = [
    ["0", 0],
    ["-1", -1],
    ["-0", -0],
    ["1.5", 1.5],
    ["2", 2],
    ["Number.MAX_VALUE", Number.MAX_VALUE],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["-Infinity", -Infinity],
    ['string "1"', "1"],
    ["boolean true", true],
    ["null", null],
    ["array", []],
    ["object", {}],
  ]

  for (const [label, value] of WRONG_MEMBER_CARDINALITY_VALUES) {
    test(`member_cardinality ${label} is malformed, not a commitment mismatch`, () => {
      expectMalformed({ ...normativeFoldPolicy(), member_cardinality: value })
    })
  }
})

// Reachability audit (RSF profile §8.1): every field of fold_policy_declaration
// is an exact normative literal, including member_cardinality (1). A value
// that satisfies shape validation is therefore already identical, field for
// field, to the pinned declaration, so its canonical bytes and commitment
// always match FOLD_POLICY_COMMITMENT. No structurally valid input can differ
// from the pinned value while still passing shape validation, so
// `fold_policy_commitment_mismatch` is UNREACHABLE from any well-formed
// declaration under the current exact-literal shape contract. The comparison
// in checkFoldPolicyDeclaration is retained as a defense against a
// canonicalize()/sha256() implementation defect, not because a valid
// mismatching input exists.

// ---------------------------------------------------------------------------
// Position 16 — comparability_class_declaration
// ---------------------------------------------------------------------------

describe("checkComparabilityClassDeclaration - positive", () => {
  test("exact normative declaration passes", () => {
    expect(checkComparabilityClassDeclaration(normativeComparabilityClass()).success).toBe(true)
  })

  test("different insertion order, identical abstract value, passes", () => {
    const v = normativeComparabilityClass()
    const reordered = {
      singleton_eligibility_rule: v.singleton_eligibility_rule,
      cross_class_bridge: v.cross_class_bridge,
      cross_policy_bridge: v.cross_policy_bridge,
      cross_entry_comparability: v.cross_entry_comparability,
      admission_required: v.admission_required,
      source_object_schema: v.source_object_schema,
      class_id: v.class_id,
      class_version: v.class_version,
      schema: v.schema,
    }
    expect(checkComparabilityClassDeclaration(reordered).success).toBe(true)
  })

  test("freshly reconstructed host object, identical abstract value, passes", () => {
    const fresh = JSON.parse(JSON.stringify(normativeComparabilityClass()))
    expect(checkComparabilityClassDeclaration(fresh).success).toBe(true)
  })

  test("input remains unmodified", () => {
    const input = Object.freeze(normativeComparabilityClass())
    expect(() => checkComparabilityClassDeclaration(input)).not.toThrow()
    expect(input).toEqual(normativeComparabilityClass())
  })
})

describe("checkComparabilityClassDeclaration - negative: shape (malformed_comparability_class_declaration)", () => {
  function expectMalformed(value: unknown) {
    const result = checkComparabilityClassDeclaration(value)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.finding).toEqual({
      schema: "recursive_singleton_fold_finding.v0",
      code: "malformed_comparability_class_declaration",
      check_position: 16,
    })
  }

  test("null", () => expectMalformed(null))
  test("array", () => expectMalformed([normativeComparabilityClass()]))
  test("non-object scalar", () => expectMalformed(42))

  test("missing singleton key (schema)", () => {
    const { schema, ...rest } = normativeComparabilityClass()
    expectMalformed(rest)
  })

  test("extra top-level key", () => {
    expectMalformed({ ...normativeComparabilityClass(), extra_field: "unexpected" })
  })

  test("wrong singleton key (schema holds wrong literal)", () => {
    expectMalformed({ ...normativeComparabilityClass(), schema: "wrong_schema.v0" })
  })

  test("missing required inner member", () => {
    const { class_id, ...rest } = normativeComparabilityClass()
    expectMalformed(rest)
  })

  test("extra inner member", () => {
    expectMalformed({ ...normativeComparabilityClass(), profile_local_notes: null })
  })

  test("wrong pinned literal (cross_entry_comparability)", () => {
    expectMalformed({ ...normativeComparabilityClass(), cross_entry_comparability: "asserted" })
  })

  test("cross-declaration input is rejected as malformed, not delegated", () => {
    expectMalformed(normativeTransitionRule())
  })

  // admission_required is an exact normative literal (RSF profile §9.1:
  // "true"), not a generic boolean field. Every value other than the literal
  // true, including false, is a shape failure, never a commitment mismatch.
  const WRONG_ADMISSION_REQUIRED_VALUES: Array<[string, unknown]> = [
    ["boolean false", false],
    ['string "true"', "true"],
    ["number 1", 1],
    ["null", null],
    ["array", []],
    ["object", {}],
  ]

  for (const [label, value] of WRONG_ADMISSION_REQUIRED_VALUES) {
    test(`admission_required ${label} is malformed, not a commitment mismatch`, () => {
      expectMalformed({ ...normativeComparabilityClass(), admission_required: value })
    })
  }
})

// Reachability audit (RSF profile §9.1): every field of
// comparability_class_declaration is an exact normative literal, including
// admission_required (true). A value that satisfies shape validation is
// therefore already identical, field for field, to the pinned declaration, so
// its commitment always matches COMPARABILITY_CLASS_COMMITMENT.
// `comparability_class_commitment_mismatch` is UNREACHABLE from any
// well-formed declaration under the current exact-literal shape contract, for
// the same reason as position 15.

// ---------------------------------------------------------------------------
// Position 17 — transition_rule_declaration
// ---------------------------------------------------------------------------

describe("checkTransitionRuleDeclaration - positive", () => {
  test("exact normative declaration passes", () => {
    expect(checkTransitionRuleDeclaration(normativeTransitionRule()).success).toBe(true)
  })

  test("different insertion order, identical abstract value, passes", () => {
    const v = normativeTransitionRule()
    const reordered = {
      fail_closed_on_malformed_or_unknown_input: v.fail_closed_on_malformed_or_unknown_input,
      stronger_class_creation: v.stronger_class_creation,
      source_identity_reuse: v.source_identity_reuse,
      preserved_equality_relation: v.preserved_equality_relation,
      aggregate_object_schema: v.aggregate_object_schema,
      source_object_schema: v.source_object_schema,
      rule_id: v.rule_id,
      rule_version: v.rule_version,
      schema: v.schema,
    }
    expect(checkTransitionRuleDeclaration(reordered).success).toBe(true)
  })

  test("freshly reconstructed host object, identical abstract value, passes", () => {
    const fresh = JSON.parse(JSON.stringify(normativeTransitionRule()))
    expect(checkTransitionRuleDeclaration(fresh).success).toBe(true)
  })

  test("input remains unmodified", () => {
    const input = Object.freeze(normativeTransitionRule())
    expect(() => checkTransitionRuleDeclaration(input)).not.toThrow()
    expect(input).toEqual(normativeTransitionRule())
  })
})

describe("checkTransitionRuleDeclaration - negative: shape (malformed_transition_rule_declaration)", () => {
  function expectMalformed(value: unknown) {
    const result = checkTransitionRuleDeclaration(value)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.finding).toEqual({
      schema: "recursive_singleton_fold_finding.v0",
      code: "malformed_transition_rule_declaration",
      check_position: 17,
    })
  }

  test("null", () => expectMalformed(null))
  test("array", () => expectMalformed([normativeTransitionRule()]))
  test("non-object scalar", () => expectMalformed(true))

  test("missing singleton key (schema)", () => {
    const { schema, ...rest } = normativeTransitionRule()
    expectMalformed(rest)
  })

  test("extra top-level key", () => {
    expectMalformed({ ...normativeTransitionRule(), extra_field: "unexpected" })
  })

  test("wrong singleton key (schema holds wrong literal)", () => {
    expectMalformed({ ...normativeTransitionRule(), schema: "wrong_schema.v0" })
  })

  test("missing required inner member", () => {
    const { rule_id, ...rest } = normativeTransitionRule()
    expectMalformed(rest)
  })

  test("extra inner member", () => {
    expectMalformed({ ...normativeTransitionRule(), profile_local_notes: null })
  })

  test("wrong pinned literal (preserved_equality_relation)", () => {
    expectMalformed({ ...normativeTransitionRule(), preserved_equality_relation: "byte_identity" })
  })

  test("cross-declaration input is rejected as malformed, not delegated", () => {
    expectMalformed(normativeFoldPolicy())
  })

  // fail_closed_on_malformed_or_unknown_input is an exact normative literal
  // (RSF profile §10.1: "true"), not a generic boolean field. Every value
  // other than the literal true, including false, is a shape failure, never a
  // commitment mismatch.
  const WRONG_FAIL_CLOSED_VALUES: Array<[string, unknown]> = [
    ["boolean false", false],
    ['string "true"', "true"],
    ["number 1", 1],
    ["null", null],
    ["array", []],
    ["object", {}],
  ]

  for (const [label, value] of WRONG_FAIL_CLOSED_VALUES) {
    test(`fail_closed_on_malformed_or_unknown_input ${label} is malformed, not a commitment mismatch`, () => {
      expectMalformed({ ...normativeTransitionRule(), fail_closed_on_malformed_or_unknown_input: value })
    })
  }
})

// Reachability audit (RSF profile §10.1): every field of
// transition_rule_declaration is an exact normative literal, including
// fail_closed_on_malformed_or_unknown_input (true). A value that satisfies
// shape validation is therefore already identical, field for field, to the
// pinned declaration, so its commitment always matches
// TRANSITION_RULE_COMMITMENT. `transition_rule_commitment_mismatch` is
// UNREACHABLE from any well-formed declaration under the current
// exact-literal shape contract, for the same reason as positions 15 and 16.

// ---------------------------------------------------------------------------
// Execution-order behavior
// ---------------------------------------------------------------------------

describe("execution order", () => {
  test("canonicalization is not performed after shape failure (fold policy)", () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    // member_cardinality fails its exact-literal check before any
    // canonicalize/hash step runs; if canonicalization ran anyway on this
    // declaration, the circular reference would throw during JSON.stringify.
    const malformed = { ...normativeFoldPolicy(), member_cardinality: circular }
    let result: ReturnType<typeof checkFoldPolicyDeclaration> | undefined
    expect(() => {
      result = checkFoldPolicyDeclaration(malformed)
    }).not.toThrow()
    expect(result?.success).toBe(false)
    if (result?.success) return
    expect(result?.finding.code).toBe("malformed_fold_policy_declaration")
  })

  test("canonicalization is not performed after shape failure (comparability class)", () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const malformed = { ...normativeComparabilityClass(), admission_required: circular }
    let result: ReturnType<typeof checkComparabilityClassDeclaration> | undefined
    expect(() => {
      result = checkComparabilityClassDeclaration(malformed)
    }).not.toThrow()
    expect(result?.success).toBe(false)
    if (result?.success) return
    expect(result?.finding.code).toBe("malformed_comparability_class_declaration")
  })

  test("canonicalization is not performed after shape failure (transition rule)", () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const malformed = { ...normativeTransitionRule(), fail_closed_on_malformed_or_unknown_input: circular }
    let result: ReturnType<typeof checkTransitionRuleDeclaration> | undefined
    expect(() => {
      result = checkTransitionRuleDeclaration(malformed)
    }).not.toThrow()
    expect(result?.success).toBe(false)
    if (result?.success) return
    expect(result?.finding.code).toBe("malformed_transition_rule_declaration")
  })

  test("commitment comparison occurs only after shape success — malformed input never yields a commitment-mismatch code", () => {
    const malformedInputs: unknown[] = [null, [], "x", {}, { ...normativeFoldPolicy(), extra: 1 }]
    for (const input of malformedInputs) {
      const result = checkFoldPolicyDeclaration(input)
      expect(result.success).toBe(false)
      if (result.success) continue
      expect(result.finding.code).not.toBe("fold_policy_commitment_mismatch")
    }
  })

  test("each function evaluates only its own declaration and does not chain to another position", () => {
    const foldResult = checkFoldPolicyDeclaration(normativeComparabilityClass())
    const comparabilityResult = checkComparabilityClassDeclaration(normativeTransitionRule())
    const transitionResult = checkTransitionRuleDeclaration(normativeFoldPolicy())

    expect(foldResult.success).toBe(false)
    expect(comparabilityResult.success).toBe(false)
    expect(transitionResult.success).toBe(false)

    if (!foldResult.success) expect(foldResult.finding.check_position).toBe(15)
    if (!comparabilityResult.success) expect(comparabilityResult.finding.check_position).toBe(16)
    if (!transitionResult.success) expect(transitionResult.finding.check_position).toBe(17)
  })
})
