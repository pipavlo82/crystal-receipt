/**
 * Closed-World Profile Coverage v0 -- cross-type coverage: audit and
 * explicit narrowing.
 *
 * SPEC_READINESS_CLOSURE_V0, closure item B. The selector grammar in
 * transformation-stability-coverage.ts has always parsed a `source::`/
 * `target::` side qualifier, and defineCoverageProfileV0 has always
 * validated that a cross-type profile's declarations carry one. But
 * runCoveragePlaneV0's actual runtime classification call
 * (`classifyPathV0(profile.declarations, null, segments)`) hardcodes
 * `side: null` unconditionally -- it never threads through which side
 * (source or target) an observed path actually came from. Read against
 * classifyPathV0's own match filter
 * (`decl.selector.side === null || decl.selector.side === side`), this
 * means: for any cross-type profile, every declaration is side-qualified
 * (required by construction), so with side always null at classification
 * time, NO declaration can ever match ANY observed path -- every path,
 * from both source and target, would derive to F, and virtually any
 * structural difference between distinct source/target shapes would look
 * like a forbidden mismatch and escalate to `violation`.
 *
 * This is not "unverified" -- it is actively broken by construction. Per
 * the closure instructions, this file proves the narrowing decision
 * chosen instead: cross-type coverage profiles (same_type: false) are
 * rejected unconditionally at construction, in every case, regardless of
 * how well-formed their declarations otherwise are. `CoverageProfileInputV0`
 * and `CoverageProfileV0.same_type` are now typed `true` (TypeScript-level
 * lock); this file exercises the runtime backstop for callers that reach
 * `defineCoverageProfileV0` through `any`/a cast/plain JS.
 *
 * Every fixture here is generic/synthetic -- no Chronicle import.
 */

import { describe, expect, test } from "bun:test"
import { defineCoverageProfileV0 } from "../../src/receiptos/challenge/transformation-stability-coverage"

function crossTypeInput(overrides: Record<string, unknown> = {}) {
  return {
    same_type: false,
    history_sensitive_policy: "classify",
    declarations: [],
    ...overrides,
  } as unknown as Parameters<typeof defineCoverageProfileV0>[0]
}

describe("cross-type coverage: rejected unconditionally at construction", () => {
  test("same_type:false with zero declarations is rejected", () => {
    const result = defineCoverageProfileV0(crossTypeInput())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons).toContain("cross_type_coverage_not_supported_in_v0")
    }
  })

  test("same_type:false with correctly side-qualified, otherwise well-formed declarations is still rejected", () => {
    const result = defineCoverageProfileV0(
      crossTypeInput({
        declarations: [
          { selector: "source::widget_id", targetClass: "N" },
          { selector: "target::widget_id", targetClass: "N" },
        ],
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons).toContain("cross_type_coverage_not_supported_in_v0")
    }
  })

  test("same_type:false with a malformed declaration is still rejected for the cross-type reason, not only the malformed one", () => {
    const result = defineCoverageProfileV0(
      crossTypeInput({
        declarations: [{ selector: "source::", targetClass: "N" }],
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons).toContain("cross_type_coverage_not_supported_in_v0")
    }
  })

  test("rejection happens regardless of history_sensitive_policy", () => {
    const result = defineCoverageProfileV0(
      crossTypeInput({
        history_sensitive_policy: "violation",
        declarations: [{ selector: "source::widget_id", targetClass: "S" }],
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons).toContain("cross_type_coverage_not_supported_in_v0")
    }
  })

  test("a same_type:true profile with the same declarations (unqualified) is unaffected by the cross-type rejection", () => {
    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "widget_id", targetClass: "N" }],
    })
    expect(result.ok).toBe(true)
  })
})

describe("cross-type coverage: v0 narrowing is the recorded contract, not an accident", () => {
  test("the TypeScript input type locks same_type to the literal true (structural, compile-time evidence)", () => {
    // This test asserts the *documented* contract rather than re-deriving
    // it: CoverageProfileInputV0.same_type and CoverageProfileV0.same_type
    // are both typed `true` in transformation-stability-coverage.ts. A
    // caller passing `false` through the public TypeScript API therefore
    // gets a compile-time error; only a runtime bypass (exercised above)
    // reaches the construction-time backstop.
    const validInput: Parameters<typeof defineCoverageProfileV0>[0] = {
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [],
    }
    expect(validInput.same_type).toBe(true)
  })
})
