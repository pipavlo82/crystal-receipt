import { describe, expect, test } from "bun:test"
import { validateRsfEvaluationInputShape, type RsfStructuralValidationResult } from "../../src/receiptos"

function validOptions() {
  return {
    entry_id: null,
    evidence_capsule_ref: null,
    provenance_summary_ref: null,
    created_from: null,
    labels: [] as string[],
    notes: null,
  }
}

function validBundle() {
  return {
    schema: "recursive_singleton_fold_source_admission_bundle.v0",
    bundle_version: "recursive-singleton-fold-source-admission-bundle-v0",
    admission_profile_id: "receiptos-chronicle-admission-v0",
    admission_fixture_set_sha256: "ff35ca8ae5cef10009479d50c10e111869875f6f62fb9d6bcb00f5aa5a1b4b4f",
    source_evidence: {},
    source_proof_object: {},
    source_entry_construction_options: validOptions(),
    claimed_source_entry: {},
  }
}

function validInput() {
  return {
    schema: "recursive_singleton_fold_evaluation_input.v0",
    profile_id: "recursive-singleton-fold-profile-v0",
    source_admission_bundle: validBundle(),
    fold_policy_declaration: {},
    comparability_class_declaration: {},
    transition_rule_declaration: {},
    profile_local_notes: null as string | null,
  }
}

function expectMalformed(
  result: RsfStructuralValidationResult,
  code: "malformed_evaluation_input" | "malformed_source_admission_bundle" | "malformed_source_entry_construction_options",
  position: 1 | 2 | 3 | 4,
) {
  expect(result.success).toBe(false)
  if (result.success) return
  expect(result.finding).toEqual({
    schema: "recursive_singleton_fold_finding.v0",
    code,
    check_position: position,
  })
}

const NON_OBJECT_VALUES: Array<[string, unknown]> = [
  ["null", null],
  ["string", "x"],
  ["number", 42],
  ["boolean", true],
  ["array", []],
  ["undefined", undefined],
]

describe("validateRsfEvaluationInputShape - valid structural input", () => {
  test("valid seven-field input passes", () => {
    const result = validateRsfEvaluationInputShape(validInput())
    expect(result.success).toBe(true)
  })

  test("profile_local_notes: null passes", () => {
    const input = validInput()
    input.profile_local_notes = null
    expect(validateRsfEvaluationInputShape(input).success).toBe(true)
  })

  test('profile_local_notes: "" passes and is distinct from null', () => {
    const input = validInput()
    input.profile_local_notes = ""
    const result = validateRsfEvaluationInputShape(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value.profile_local_notes).toBe("")
      expect(result.value.profile_local_notes).not.toBeNull()
    }
  })

  test("non-empty profile_local_notes string passes", () => {
    const input = validInput()
    input.profile_local_notes = "a note"
    expect(validateRsfEvaluationInputShape(input).success).toBe(true)
  })

  test("empty labels array passes", () => {
    const input = validInput()
    input.source_admission_bundle.source_entry_construction_options.labels = []
    expect(validateRsfEvaluationInputShape(input).success).toBe(true)
  })

  test("duplicate labels pass", () => {
    const input = validInput()
    input.source_admission_bundle.source_entry_construction_options.labels = ["a", "a", "b"]
    const result = validateRsfEvaluationInputShape(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value.source_admission_bundle.source_entry_construction_options.labels).toEqual(["a", "a", "b"])
    }
  })

  test("labels retain input order", () => {
    const input = validInput()
    input.source_admission_bundle.source_entry_construction_options.labels = ["z", "a", "m"]
    const result = validateRsfEvaluationInputShape(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value.source_admission_bundle.source_entry_construction_options.labels).toEqual(["z", "a", "m"])
    }
  })

  test("success does not imply nested evidence/proof/declaration/entry semantic validity", () => {
    // Each of these containers is structurally empty / not a recognized
    // declaration shape. Structural validation still succeeds, because
    // positions 5-7 and 15-17 are not implemented by this module.
    const input = validInput()
    input.source_admission_bundle.source_evidence = { not: "a real HandoffEvidence" }
    input.source_admission_bundle.source_proof_object = { not: "a real PortableProofObjectV0" }
    input.source_admission_bundle.claimed_source_entry = { not: "a real chronicle_entry.v0" }
    input.fold_policy_declaration = { not: "a real fold_policy_declaration" }
    input.comparability_class_declaration = { not: "a real comparability_class_declaration" }
    input.transition_rule_declaration = { not: "a real transition_rule_declaration" }

    const result = validateRsfEvaluationInputShape(input)
    expect(result.success).toBe(true)
  })
})

describe("validateRsfEvaluationInputShape - position 1", () => {
  for (const [label, value] of NON_OBJECT_VALUES) {
    test(`non-object input (${label}) -> position 1`, () => {
      expectMalformed(validateRsfEvaluationInputShape(value), "malformed_evaluation_input", 1)
    })
  }

  const topLevelFields = [
    "schema",
    "profile_id",
    "source_admission_bundle",
    "fold_policy_declaration",
    "comparability_class_declaration",
    "transition_rule_declaration",
    "profile_local_notes",
  ] as const

  for (const field of topLevelFields) {
    test(`missing top-level field "${field}" -> position 1`, () => {
      const input: Record<string, unknown> = validInput()
      delete input[field]
      expectMalformed(validateRsfEvaluationInputShape(input), "malformed_evaluation_input", 1)
    })
  }

  test("unknown eighth top-level field -> position 1", () => {
    const input: Record<string, unknown> = validInput()
    input.unexpected_field = "x"
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_evaluation_input", 1)
  })

  test("historical profile_sha256 field as an eighth field -> position 1", () => {
    const input: Record<string, unknown> = validInput()
    input.profile_sha256 = "170909acb19d28cae58c8870c5169dfde8ae1416e84a5c798a89f336bc1974c5"
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_evaluation_input", 1)
  })

  test("wrong schema literal -> position 1", () => {
    const input = validInput()
    // @ts-expect-error deliberately wrong literal
    input.schema = "wrong_schema.v0"
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_evaluation_input", 1)
  })

  test("wrong profile_id literal -> position 1", () => {
    const input = validInput()
    // @ts-expect-error deliberately wrong literal
    input.profile_id = "wrong-profile-id"
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_evaluation_input", 1)
  })

  test("schema: null -> position 1", () => {
    const input: Record<string, unknown> = validInput()
    input.schema = null
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_evaluation_input", 1)
  })

  test("profile_id: null -> position 1", () => {
    const input: Record<string, unknown> = validInput()
    input.profile_id = null
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_evaluation_input", 1)
  })

  const wrongNotesTypes: Array<[string, unknown]> = [
    ["number", 1],
    ["boolean", true],
    ["array", []],
    ["object", {}],
  ]
  for (const [label, value] of wrongNotesTypes) {
    test(`profile_local_notes wrong primitive type (${label}) -> position 1`, () => {
      const input: Record<string, unknown> = validInput()
      input.profile_local_notes = value
      expectMalformed(validateRsfEvaluationInputShape(input), "malformed_evaluation_input", 1)
    })
  }

  const nullableRequiredFields = [
    "source_admission_bundle",
    "fold_policy_declaration",
    "comparability_class_declaration",
    "transition_rule_declaration",
  ] as const
  for (const field of nullableRequiredFields) {
    test(`top-level field "${field}" set to null -> position 1`, () => {
      const input: Record<string, unknown> = validInput()
      input[field] = null
      expectMalformed(validateRsfEvaluationInputShape(input), "malformed_evaluation_input", 1)
    })
  }
})

describe("validateRsfEvaluationInputShape - position 2", () => {
  test("bundle not an object -> position 2", () => {
    const input = validInput()
    // @ts-expect-error deliberately wrong type
    input.source_admission_bundle = "not-an-object"
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_admission_bundle", 2)
  })

  const bundleFields = [
    "schema",
    "bundle_version",
    "admission_profile_id",
    "admission_fixture_set_sha256",
    "source_evidence",
    "source_proof_object",
    "source_entry_construction_options",
    "claimed_source_entry",
  ] as const

  for (const field of bundleFields) {
    test(`missing bundle field "${field}" -> position 2`, () => {
      const input = validInput()
      const bundle: Record<string, unknown> = input.source_admission_bundle
      delete bundle[field]
      expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_admission_bundle", 2)
    })

    test(`bundle field "${field}" set to null -> position 2`, () => {
      const input = validInput()
      const bundle: Record<string, unknown> = input.source_admission_bundle
      bundle[field] = null
      expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_admission_bundle", 2)
    })
  }

  test("unknown bundle field -> position 2", () => {
    const input = validInput()
    const bundle: Record<string, unknown> = input.source_admission_bundle
    bundle.unexpected_field = "x"
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_admission_bundle", 2)
  })

  const literalFields = ["schema", "bundle_version", "admission_profile_id", "admission_fixture_set_sha256"] as const
  for (const field of literalFields) {
    test(`wrong pinned literal for bundle "${field}" -> position 2`, () => {
      const input = validInput()
      const bundle: Record<string, unknown> = input.source_admission_bundle
      bundle[field] = "wrong-literal-value"
      expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_admission_bundle", 2)
    })
  }
})

describe("validateRsfEvaluationInputShape - position 3", () => {
  const nonObjectVariants: Array<[string, unknown]> = [
    ["string", "x"],
    ["number", 42],
    ["boolean", true],
    ["array", []],
  ]

  for (const [label, value] of nonObjectVariants) {
    test(`source_evidence not an object (${label}) -> position 3`, () => {
      const input = validInput()
      input.source_admission_bundle.source_evidence = value as never
      expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_admission_bundle", 3)
    })
  }

  test("source_proof_object not an object (string) -> position 3", () => {
    const input = validInput()
    input.source_admission_bundle.source_proof_object = "x" as never
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_admission_bundle", 3)
  })

  test("source_entry_construction_options not an object (string) -> position 3", () => {
    const input = validInput()
    input.source_admission_bundle.source_entry_construction_options = "x" as never
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_admission_bundle", 3)
  })

  test("claimed_source_entry not an object (string) -> position 3", () => {
    const input = validInput()
    input.source_admission_bundle.claimed_source_entry = "x" as never
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_admission_bundle", 3)
  })
})

describe("validateRsfEvaluationInputShape - position 4", () => {
  const optionFields = [
    "entry_id",
    "evidence_capsule_ref",
    "provenance_summary_ref",
    "created_from",
    "labels",
    "notes",
  ] as const

  for (const field of optionFields) {
    test(`missing construction-options field "${field}" -> position 4`, () => {
      const input = validInput()
      const options: Record<string, unknown> = input.source_admission_bundle.source_entry_construction_options
      delete options[field]
      expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_entry_construction_options", 4)
    })
  }

  test("unknown construction-options field -> position 4", () => {
    const input = validInput()
    const options: Record<string, unknown> = input.source_admission_bundle.source_entry_construction_options
    options.unexpected_field = "x"
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_entry_construction_options", 4)
  })

  const nullableStringFields = ["entry_id", "evidence_capsule_ref", "provenance_summary_ref", "created_from"] as const
  for (const field of nullableStringFields) {
    test(`"${field}" with invalid non-string/non-null value (number) -> position 4`, () => {
      const input = validInput()
      const options: Record<string, unknown> = input.source_admission_bundle.source_entry_construction_options
      options[field] = 42
      expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_entry_construction_options", 4)
    })
  }

  test("labels: null -> position 4", () => {
    const input = validInput()
    const options: Record<string, unknown> = input.source_admission_bundle.source_entry_construction_options
    options.labels = null
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_entry_construction_options", 4)
  })

  test("labels not an array (string) -> position 4", () => {
    const input = validInput()
    const options: Record<string, unknown> = input.source_admission_bundle.source_entry_construction_options
    options.labels = "not-an-array"
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_entry_construction_options", 4)
  })

  const invalidLabelMembers: Array<[string, unknown]> = [
    ["number", 1],
    ["null", null],
    ["object", {}],
    ["array", []],
    ["boolean", true],
  ]
  for (const [label, member] of invalidLabelMembers) {
    test(`labels containing a ${label} member -> position 4`, () => {
      const input = validInput()
      const options: Record<string, unknown> = input.source_admission_bundle.source_entry_construction_options
      options.labels = ["ok", member]
      expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_entry_construction_options", 4)
    })
  }

  test("notes with wrong type (number) -> position 4", () => {
    const input = validInput()
    const options: Record<string, unknown> = input.source_admission_bundle.source_entry_construction_options
    options.notes = 1
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_entry_construction_options", 4)
  })

  test("explicit undefined value for a required field -> position 4", () => {
    const input = validInput()
    const options: Record<string, unknown> = input.source_admission_bundle.source_entry_construction_options
    options.notes = undefined
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_entry_construction_options", 4)
  })
})

describe("validateRsfEvaluationInputShape - first-position precedence", () => {
  test("position-1 defect + position-2 defect -> position 1", () => {
    const input: Record<string, unknown> = validInput()
    delete input.schema // position 1 defect
    input.source_admission_bundle = "not-an-object" // would-be position 2 defect
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_evaluation_input", 1)
  })

  test("position-2 defect + position-3 defect -> position 2", () => {
    const input = validInput()
    const bundle: Record<string, unknown> = input.source_admission_bundle
    delete bundle.schema // position 2 defect
    bundle.source_evidence = "not-an-object" // would-be position 3 defect
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_admission_bundle", 2)
  })

  test("position-3 defect + position-4 defect -> position 3", () => {
    const input = validInput()
    input.source_admission_bundle.source_evidence = "not-an-object" // position 3 defect
    const options: Record<string, unknown> = input.source_admission_bundle.source_entry_construction_options
    delete options.notes // would-be position 4 defect
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_admission_bundle", 3)
  })

  test("position-2 defect + position-4 defect -> position 2", () => {
    const input = validInput()
    const bundle: Record<string, unknown> = input.source_admission_bundle
    bundle.admission_profile_id = "wrong" // position 2 defect
    const options: Record<string, unknown> = bundle.source_entry_construction_options as Record<string, unknown>
    delete options.notes // would-be position 4 defect
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_source_admission_bundle", 2)
  })

  test("position-1 defect + position-4 defect -> position 1", () => {
    const input: Record<string, unknown> = validInput()
    delete input.profile_id // position 1 defect
    const bundle = (input.source_admission_bundle as Record<string, unknown>)
    const options: Record<string, unknown> = bundle.source_entry_construction_options as Record<string, unknown>
    delete options.notes // would-be position 4 defect
    expectMalformed(validateRsfEvaluationInputShape(input), "malformed_evaluation_input", 1)
  })
})
