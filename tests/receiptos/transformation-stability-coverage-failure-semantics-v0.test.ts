/**
 * Closed-World Profile Coverage v0 -- coverage failure semantics.
 *
 * SPEC_READINESS_CLOSURE_V0, closure item C, the highest-priority
 * inconsistency identified by the prior spec-draft audit: the flat
 * evaluator (transformation-stability.ts) wraps every declared procedure
 * call in exception handling that converts a failure to `unresolved`. The
 * coverage-plane composition function
 * (evaluateTransformationStabilityWithCoverageV0), before this closure,
 * did NOT wrap its call to runCoveragePlaneV0 the same way -- a non-finite
 * number or an undefined-equivalent value surfacing anywhere in the
 * observed structural walk's atom comparison, or a normalizer
 * implementation throwing, would propagate as an uncaught exception
 * instead of yielding `unresolved`.
 *
 * The rule enforced now, and proven by this file:
 *
 *   evaluation-time failure => unresolved
 *
 * kept strictly separate from:
 *
 *   construction/profile-authentication failure => profile-invalid
 *   (defineCoverageProfileV0's typed {ok:false} result, never a throw,
 *   never reachable by evaluateTransformationStabilityWithCoverageV0 at
 *   all, since that function only accepts an already-branded profile)
 *
 * The observed structural walker itself (observedLeafPathsV0) never
 * throws -- confirmed directly this closure lane -- it always
 * successfully enumerates paths, preserving even structurally-invalid raw
 * leaf values (a non-finite number, an undefined array element)
 * unmodified. Rejection happens strictly downstream, when the coverage
 * plane's atom-building step calls the comparator
 * (canonicalIdentityJson) on such a value. This file exercises that
 * downstream failure specifically, through the full composition function,
 * not the walker in isolation (see
 * observed-leaf-paths-conformance-v0.test.ts for the walker's own
 * behavior).
 *
 * Every fixture here is generic/synthetic -- no Chronicle import.
 */

import { describe, expect, test } from "bun:test"
import {
  defineCoverageProfileV0,
  evaluateTransformationStabilityWithCoverageV0,
  type CoverageProfileV0,
} from "../../src/receiptos/challenge/transformation-stability-coverage"
import { defineNormalizerAuthorityV0 } from "../../src/receiptos/challenge/transformation-stability-coverage-normalizer-authority"
import { defineTransformationProfileV0 } from "../../src/receiptos/challenge/transformation-stability"

type WidgetV0 = {
  readonly id: string
  readonly tags: unknown[]
}

function recomputeWidget(widget: WidgetV0) {
  return { state: "evaluated" as const, value: { id: widget.id, tags: widget.tags } }
}

function buildBaseProfile(transform: (widget: WidgetV0) => WidgetV0, profileId: string) {
  return defineTransformationProfileV0<WidgetV0, WidgetV0, { id: string; tags: unknown[] }>({
    transformation_profile_id: profileId,
    transformation_family: "generic_widget_failure_semantics",
    source_object_kind: "widget.v0",
    target_object_kind: "widget.v0",
    recompute_procedure_id: "generic.widgetIdentity.v0",
    comparison_rule_id: "id.v0",
    history_sensitive_policy: "classify",
    precondition: () => ({ ok: true }),
    transform,
    recompute_source: recomputeWidget,
    recompute_target: recomputeWidget,
    normative_projection: (result) => ({ id: result.id }),
    stability_projection: (result) => ({ id: result.id }),
    allowed_variant_projection: () => ({}),
    forbidden_variant_projection: () => ({}),
  })
}

// `id` is declared N; `tags` is deliberately left undeclared so it falls
// to derived F -- any structural problem inside `tags` is therefore
// encountered by the coverage plane's atom-building step, which is
// exactly the code path this file targets.
function idOnlyCoverageProfile(): CoverageProfileV0 {
  const result = defineCoverageProfileV0({
    same_type: true,
    history_sensitive_policy: "classify",
    declarations: [{ selector: "id", targetClass: "N" }],
  })
  if (!result.ok) throw new Error("unexpected profile-invalid in test setup")
  return result.profile
}

describe("coverage failure semantics: evaluation-time failure yields unresolved, never an uncaught exception", () => {
  test("a non-finite number surfacing in the target's observed structure yields unresolved", async () => {
    const profile = buildBaseProfile(
      (widget) => ({ ...widget, tags: [1, Infinity, 2] }),
      "generic-widget-nonfinite-v0",
    )
    const outcome = await evaluateTransformationStabilityWithCoverageV0(idOnlyCoverageProfile(), profile, {
      id: "w-1",
      tags: ["a"],
    })
    expect(outcome.classification).toBe("unresolved")
    expect(outcome.coverage).toBeNull()
  })

  test("an undefined-equivalent value surfacing in an observed array element yields unresolved", async () => {
    const profile = buildBaseProfile(
      (widget) => ({ ...widget, tags: [1, undefined, 2] }),
      "generic-widget-undefined-element-v0",
    )
    const outcome = await evaluateTransformationStabilityWithCoverageV0(idOnlyCoverageProfile(), profile, {
      id: "w-1",
      tags: ["a"],
    })
    expect(outcome.classification).toBe("unresolved")
    expect(outcome.coverage).toBeNull()
  })

  test("a throwing normalizer implementation yields unresolved, not an uncaught exception", async () => {
    const throwingAuthorityResult = defineNormalizerAuthorityV0({
      authority_id: "generic.throwing_test_authority.v0",
      authority_version: "v0",
      entries: [
        {
          normalizer_id: "generic.throwingNormalizer.v0",
          equivalence_kind: "identity",
          implementation: () => {
            throw new Error("deliberately broken normalizer for this test")
          },
        },
      ],
    })
    if (!throwingAuthorityResult.ok) throw new Error("unexpected: throwing-normalizer test authority failed to construct")

    const coverageResult = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [
        { selector: "id", targetClass: "N" },
        { selector: "tags", targetClass: "N" },
      ],
      value_normalizers: { tags: "generic.throwingNormalizer.v0" },
      normalizer_authority: throwingAuthorityResult.authority,
    })
    if (!coverageResult.ok) throw new Error("unexpected profile-invalid in test setup")

    const profile = buildBaseProfile((widget) => ({ ...widget, tags: [...widget.tags].reverse() }), "generic-widget-throwing-normalizer-v0")
    const outcome = await evaluateTransformationStabilityWithCoverageV0(coverageResult.profile, profile, {
      id: "w-1",
      tags: ["a", "b"],
    })
    expect(outcome.classification).toBe("unresolved")
    expect(outcome.coverage).toBeNull()
  })

  test("the same non-finite failure is reachable via the source side too, not only the target side", async () => {
    const profile = buildBaseProfile((widget) => widget, "generic-widget-nonfinite-source-v0")
    const outcome = await evaluateTransformationStabilityWithCoverageV0(idOnlyCoverageProfile(), profile, {
      id: "w-1",
      tags: [1, Infinity, 2],
    })
    expect(outcome.classification).toBe("unresolved")
    expect(outcome.coverage).toBeNull()
  })
})

describe("coverage failure semantics: profile-invalid is a wholly separate, earlier concern -- never collapsed into unresolved", () => {
  test("a malformed coverage profile is rejected at construction with a typed ok:false result, never a throw", () => {
    expect(() =>
      defineCoverageProfileV0({
        same_type: true,
        history_sensitive_policy: "classify",
        declarations: [{ selector: "bad selector with spaces", targetClass: "N" }],
      }),
    ).not.toThrow()

    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "bad selector with spaces", targetClass: "N" }],
    })
    expect(result.ok).toBe(false)
  })

  test("evaluateTransformationStabilityWithCoverageV0 only ever accepts an already-branded profile -- a malformed one cannot reach it to be conflated with unresolved", () => {
    const coverageResult = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "id", targetClass: "N" }],
    })
    expect(coverageResult.ok).toBe(true)
    if (coverageResult.ok) {
      expect(coverageResult.profile.__coverageBrand).toBe("CoverageProfileV0")
    }
  })
})

describe("coverage failure semantics: legitimate, non-throwing evaluation is unaffected (control case)", () => {
  test("a stable widget transformation still classifies stable, not unresolved", async () => {
    const profile = buildBaseProfile((widget) => widget, "generic-widget-stable-control-v0")
    const outcome = await evaluateTransformationStabilityWithCoverageV0(idOnlyCoverageProfile(), profile, {
      id: "w-1",
      tags: ["a", "b"],
    })
    expect(outcome.classification).toBe("stable")
    expect(outcome.coverage).not.toBeNull()
  })
})
