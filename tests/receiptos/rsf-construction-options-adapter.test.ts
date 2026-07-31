import { describe, expect, test } from "bun:test"
import { adaptRsfConstructionOptions, type RsfConstructionOptionsShape } from "../../src/receiptos"

function baseOptions(): RsfConstructionOptionsShape {
  return {
    entry_id: null,
    evidence_capsule_ref: null,
    provenance_summary_ref: null,
    created_from: null,
    labels: [],
    notes: null,
  }
}

describe("adaptRsfConstructionOptions", () => {
  describe("entry_id", () => {
    test("null -> entryId omitted", () => {
      const result = adaptRsfConstructionOptions({ ...baseOptions(), entry_id: null })
      expect("entryId" in result).toBe(false)
    })

    test('"" -> entryId preserved exactly', () => {
      const result = adaptRsfConstructionOptions({ ...baseOptions(), entry_id: "" })
      expect(result.entryId).toBe("")
    })

    test("non-empty string -> entryId preserved exactly", () => {
      const result = adaptRsfConstructionOptions({ ...baseOptions(), entry_id: "abc" })
      expect(result.entryId).toBe("abc")
    })
  })

  describe("evidence_capsule_ref", () => {
    test("null -> evidenceCapsuleRef omitted", () => {
      const result = adaptRsfConstructionOptions({ ...baseOptions(), evidence_capsule_ref: null })
      expect("evidenceCapsuleRef" in result).toBe(false)
    })

    test('"" -> evidenceCapsuleRef preserved exactly', () => {
      const result = adaptRsfConstructionOptions({ ...baseOptions(), evidence_capsule_ref: "" })
      expect(result.evidenceCapsuleRef).toBe("")
    })

    test("non-empty string -> evidenceCapsuleRef preserved exactly", () => {
      const result = adaptRsfConstructionOptions({ ...baseOptions(), evidence_capsule_ref: "cap-ref" })
      expect(result.evidenceCapsuleRef).toBe("cap-ref")
    })
  })

  describe("provenance_summary_ref", () => {
    test("null -> provenanceSummaryRef omitted", () => {
      const result = adaptRsfConstructionOptions({ ...baseOptions(), provenance_summary_ref: null })
      expect("provenanceSummaryRef" in result).toBe(false)
    })

    test('"" -> provenanceSummaryRef preserved exactly', () => {
      const result = adaptRsfConstructionOptions({ ...baseOptions(), provenance_summary_ref: "" })
      expect(result.provenanceSummaryRef).toBe("")
    })

    test("non-empty string -> provenanceSummaryRef preserved exactly", () => {
      const result = adaptRsfConstructionOptions({ ...baseOptions(), provenance_summary_ref: "prov-ref" })
      expect(result.provenanceSummaryRef).toBe("prov-ref")
    })
  })

  describe("created_from", () => {
    test("null -> createdFrom explicit null, not omitted", () => {
      const result = adaptRsfConstructionOptions({ ...baseOptions(), created_from: null })
      expect("createdFrom" in result).toBe(true)
      expect(result.createdFrom).toBeNull()
    })

    test('"" -> createdFrom preserved exactly', () => {
      const result = adaptRsfConstructionOptions({ ...baseOptions(), created_from: "" })
      expect(result.createdFrom).toBe("")
    })

    test("non-empty string -> createdFrom preserved exactly", () => {
      const result = adaptRsfConstructionOptions({ ...baseOptions(), created_from: "src-ref" })
      expect(result.createdFrom).toBe("src-ref")
    })
  })

  describe("notes", () => {
    test("null -> notes explicit null, not omitted", () => {
      const result = adaptRsfConstructionOptions({ ...baseOptions(), notes: null })
      expect("notes" in result).toBe(true)
      expect(result.notes).toBeNull()
    })

    test('"" -> notes preserved exactly', () => {
      const result = adaptRsfConstructionOptions({ ...baseOptions(), notes: "" })
      expect(result.notes).toBe("")
    })

    test("non-empty string -> notes preserved exactly", () => {
      const result = adaptRsfConstructionOptions({ ...baseOptions(), notes: "a note" })
      expect(result.notes).toBe("a note")
    })
  })

  describe("labels", () => {
    test("empty array preserved", () => {
      const result = adaptRsfConstructionOptions({ ...baseOptions(), labels: [] })
      expect(result.labels).toEqual([])
    })

    test("order preserved", () => {
      const result = adaptRsfConstructionOptions({ ...baseOptions(), labels: ["z", "a", "m"] })
      expect(result.labels).toEqual(["z", "a", "m"])
    })

    test("duplicates preserved", () => {
      const result = adaptRsfConstructionOptions({ ...baseOptions(), labels: ["a", "a", "b"] })
      expect(result.labels).toEqual(["a", "a", "b"])
    })

    test("fresh array copy: result is not the same array reference as input", () => {
      const inputLabels = ["a", "b"]
      const result = adaptRsfConstructionOptions({ ...baseOptions(), labels: inputLabels })
      expect(result.labels).not.toBe(inputLabels)
      expect(result.labels).toEqual(inputLabels)
    })

    test("input labels array is not mutated by the adapter", () => {
      const inputLabels = ["a", "b"]
      const options = { ...baseOptions(), labels: inputLabels }
      const result = adaptRsfConstructionOptions(options)
      result.labels?.push("mutated")
      expect(inputLabels).toEqual(["a", "b"])
    })
  })

  test("adapter accepts exactly one argument and never invokes Chronicle admission", () => {
    // The adapter's signature takes only the options object -- it has no
    // parameter through which evidence or a proof object could reach it, so
    // it cannot call createChronicleEntryV0 (which requires both). This is a
    // structural guarantee, not a spy-based one: chronicle-portfolio-v0 is
    // imported by this module only as a type (`import type`), so there is no
    // runtime reference to createChronicleEntryV0 in the adapter at all.
    expect(adaptRsfConstructionOptions.length).toBe(1)
  })

  test("full mapping example matches every field's documented rule simultaneously", () => {
    const result = adaptRsfConstructionOptions({
      entry_id: "entry-1",
      evidence_capsule_ref: null,
      provenance_summary_ref: "",
      created_from: null,
      labels: ["x", "x", "y"],
      notes: "",
    })

    expect(result.entryId).toBe("entry-1")
    expect("evidenceCapsuleRef" in result).toBe(false)
    expect(result.provenanceSummaryRef).toBe("")
    expect(result.createdFrom).toBeNull()
    expect(result.labels).toEqual(["x", "x", "y"])
    expect(result.notes).toBe("")
  })
})
