import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  HANDOFF_TRANSFORMATION_MATRIX_NORMATIVE_MUTATION_ROOT_V0,
  HANDOFF_TRANSFORMATION_MATRIX_SAMPLE_ROOT_V0,
  HANDOFF_TRANSFORMATION_VECTORS_V0,
  evaluateHandoffTransformationMatrixV0,
} from "../../src/receiptos/challenge/transformation-stability-handoff-matrix"

const root = resolve(import.meta.dir, "../..")
const fixture = JSON.parse(
  readFileSync(resolve(root, "src/receiptos/fixtures/session-evidence.sample.json"), "utf8"),
)

describe("handoff transformation stability matrix v0", () => {
  test("candidate inventory is exact", () => {
    expect(HANDOFF_TRANSFORMATION_VECTORS_V0.map((entry) => entry.vector_id)).toEqual([
      "H-ROUNDTRIP-STABLE",
      "H-KEY-ORDER-REVERSE",
      "H-NORMATIVE-SESSION-ID-MUTATION",
      "H-FORBIDDEN-ANCHOR-CONTRACT-MUTATION",
      "H-SOURCE-SCHEMA-MISMATCH",
      "H-TARGET-RECOMPUTE-UNRESOLVED",
    ])
  })

  test("matrix reaches required result classes", async () => {
    const result = await evaluateHandoffTransformationMatrixV0(fixture)

    expect(result.pass).toBe(true)
    expect(result.aggregate).toEqual({
      stable: 2,
      history_sensitive: 0,
      unresolved: 1,
      out_of_domain: 1,
      violation: 2,
    })

    const byId = new Map(result.members.map((entry) => [entry.vector_id, entry]))

    expect(byId.get("H-ROUNDTRIP-STABLE")!.observed.classification).toBe("stable")
    expect(byId.get("H-KEY-ORDER-REVERSE")!.observed.classification).toBe("stable")

    const normative = byId.get("H-NORMATIVE-SESSION-ID-MUTATION")!.observed
    expect(normative.classification).toBe("violation")
    expect(normative.normative_match).toBe(false)

    const forbidden = byId.get("H-FORBIDDEN-ANCHOR-CONTRACT-MUTATION")!.observed
    expect(forbidden.classification).toBe("violation")
    expect(forbidden.normative_match).toBe(true)
    expect(forbidden.forbidden_variant_match).toBe(false)

    expect(byId.get("H-SOURCE-SCHEMA-MISMATCH")!.observed.classification).toBe(
      "out_of_domain",
    )
    expect(
      byId.get("H-TARGET-RECOMPUTE-UNRESOLVED")!.observed.classification,
    ).toBe("unresolved")
  })

  test("root identities are pinned", () => {
    expect(HANDOFF_TRANSFORMATION_MATRIX_SAMPLE_ROOT_V0).toBe(
      "0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc",
    )
    expect(HANDOFF_TRANSFORMATION_MATRIX_NORMATIVE_MUTATION_ROOT_V0).toBe(
      "0x41479b4374e63fb0d9f42c03323c6949458a67cadb728e5a2d187c59582bf53e",
    )
    expect(HANDOFF_TRANSFORMATION_MATRIX_NORMATIVE_MUTATION_ROOT_V0).not.toBe(
      HANDOFF_TRANSFORMATION_MATRIX_SAMPLE_ROOT_V0,
    )
  })
})
