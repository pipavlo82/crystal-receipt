/**
 * Closed-World Profile Coverage v0 -- generic artifact structural
 * contract.
 *
 * SPEC_READINESS_CLOSURE_V0, closure item D. No new schema machinery is
 * introduced by this closure: the minimum generic structural contract
 * (documented in full in transformation-stability-coverage.ts's module
 * header) is enforced entirely by the existing comparator/walker
 * validation already proven elsewhere (see
 * observed-leaf-paths-conformance-v0.test.ts for the walker's own
 * behavior and transformation-stability-coverage-failure-semantics-v0.test.ts
 * for the "unsupported value fails evaluation" half). This file's job is
 * narrow: prove the contract holds end to end, in one place, for a single
 * artifact shaped like a real adapter bundle -- nested objects, a
 * whole-array-atom field, and a sub-collection of sub-artifacts -- with
 * no bundle-specific code path anywhere in the coverage module.
 *
 * Every fixture here is generic/synthetic -- no Chronicle import.
 */

import { describe, expect, test } from "bun:test"
import {
  defineCoverageProfileV0,
  evaluateTransformationStabilityWithCoverageV0,
} from "../../src/receiptos/challenge/transformation-stability-coverage"
import { defineTransformationProfileV0 } from "../../src/receiptos/challenge/transformation-stability"

// A synthetic "bundle" -- an ordinary nested object grouping several
// sub-artifacts under an array field, exactly the shape an adapter would
// use for a relationship/bundle artifact (see transformation-stability-
// chronicle-collection-portfolio.ts for the real-domain analogue). This
// module has no special type or code path for "bundle" -- it is just
// another value in the comparator/walker's domain.
type BundleV0 = {
  readonly bundle_id: string
  readonly members: readonly { readonly member_id: string; readonly weight: number }[]
  readonly labels: string[]
}

function recomputeBundle(bundle: BundleV0) {
  return { state: "evaluated" as const, value: bundle }
}

function buildBundleProfile(transform: (bundle: BundleV0) => BundleV0, profileId: string) {
  return defineTransformationProfileV0<BundleV0, BundleV0, BundleV0>({
    transformation_profile_id: profileId,
    transformation_family: "generic_structural_contract",
    source_object_kind: "bundle.v0",
    target_object_kind: "bundle.v0",
    recompute_procedure_id: "generic.bundleIdentity.v0",
    comparison_rule_id: "bundle_id.v0",
    history_sensitive_policy: "classify",
    precondition: () => ({ ok: true }),
    transform,
    recompute_source: recomputeBundle,
    recompute_target: recomputeBundle,
    normative_projection: (result) => ({ bundle_id: result.bundle_id }),
    stability_projection: (result) => result,
    allowed_variant_projection: () => ({}),
    forbidden_variant_projection: () => ({}),
  })
}

function fullBundleCoverageProfile() {
  const result = defineCoverageProfileV0({
    same_type: true,
    history_sensitive_policy: "classify",
    declarations: [
      { selector: "bundle_id", targetClass: "N" },
      { selector: "members", targetClass: "N" },
      { selector: "labels", targetClass: "N" },
    ],
  })
  if (!result.ok) throw new Error("unexpected profile-invalid in test setup")
  return result.profile
}

const SAMPLE_BUNDLE: BundleV0 = {
  bundle_id: "bundle-1",
  members: [
    { member_id: "m-1", weight: 1 },
    { member_id: "m-2", weight: 2 },
  ],
  labels: ["x", "y"],
}

describe("generic artifact structural contract: objects may nest objects", () => {
  test("a bundle artifact with nested member objects and an array field evaluates end to end with no bundle-specific code path", async () => {
    const outcome = await evaluateTransformationStabilityWithCoverageV0(
      fullBundleCoverageProfile(),
      buildBundleProfile((bundle) => bundle, "generic-bundle-identity-v0"),
      SAMPLE_BUNDLE,
    )
    expect(outcome.classification).toBe("stable")
  })
})

describe("generic artifact structural contract: arrays are whole-array atoms only", () => {
  test("reordering the labels array collapses under a plain equality projection only if the array is literally unchanged -- proving arrays are compared whole, not per-index", async () => {
    const outcome = await evaluateTransformationStabilityWithCoverageV0(
      fullBundleCoverageProfile(),
      buildBundleProfile((bundle) => ({ ...bundle, labels: [...bundle.labels].reverse() }), "generic-bundle-labels-reorder-v0"),
      SAMPLE_BUNDLE,
    )
    // No normalizer is declared for `labels`, so a reorder is a genuine
    // whole-array-atom mismatch under N -- proving the array is compared
    // as one atom (order-significant), not decomposed into per-index
    // paths that could partially match.
    expect(outcome.classification).toBe("violation")
  })

  test("the members array is likewise a whole-array atom: adding a member is a single-path mismatch, not per-element noise", async () => {
    const outcome = await evaluateTransformationStabilityWithCoverageV0(
      fullBundleCoverageProfile(),
      buildBundleProfile(
        (bundle) => ({ ...bundle, members: [...bundle.members, { member_id: "m-3", weight: 3 }] }),
        "generic-bundle-members-append-v0",
      ),
      SAMPLE_BUNDLE,
    )
    expect(outcome.classification).toBe("violation")
    expect(outcome.coverage?.normative_mismatch_paths).toEqual(["members"])
  })
})

describe("generic artifact structural contract: unsupported values fail evaluation, not silently accepted", () => {
  test("a non-finite value reachable from the artifact fails evaluation as unresolved (cross-referencing closure item C's fix)", async () => {
    const outcome = await evaluateTransformationStabilityWithCoverageV0(
      fullBundleCoverageProfile(),
      buildBundleProfile((bundle) => ({ ...bundle, labels: [1 as unknown as string, Infinity as unknown as string] }), "generic-bundle-nonfinite-v0"),
      SAMPLE_BUNDLE,
    )
    expect(outcome.classification).toBe("unresolved")
  })
})

describe("generic artifact structural contract: a bundle is an ordinary value, not a distinguished protocol type", () => {
  test("a non-bundle-shaped artifact (no array field, no nested sub-artifacts) is evaluated by the exact same generic machinery with no special-casing", async () => {
    type PlainV0 = { readonly id: string }
    const profile = defineTransformationProfileV0<PlainV0, PlainV0, PlainV0>({
      transformation_profile_id: "generic-plain-artifact-v0",
      transformation_family: "generic_structural_contract",
      source_object_kind: "plain.v0",
      target_object_kind: "plain.v0",
      recompute_procedure_id: "generic.plainIdentity.v0",
      comparison_rule_id: "id.v0",
      history_sensitive_policy: "classify",
      precondition: () => ({ ok: true }),
      transform: (value) => value,
      recompute_source: (value) => ({ state: "evaluated" as const, value }),
      recompute_target: (value) => ({ state: "evaluated" as const, value }),
      normative_projection: (result) => result,
      stability_projection: (result) => result,
      allowed_variant_projection: () => ({}),
      forbidden_variant_projection: () => ({}),
    })
    const coverageResult = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "id", targetClass: "N" }],
    })
    if (!coverageResult.ok) throw new Error("unexpected profile-invalid")

    const outcome = await evaluateTransformationStabilityWithCoverageV0(coverageResult.profile, profile, { id: "p-1" })
    expect(outcome.classification).toBe("stable")
  })
})
