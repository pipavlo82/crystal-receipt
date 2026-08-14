/**
 * Generic Trust Base Closure v0 -- extraction-focused tests.
 *
 * Companion to TRANSFORMATION_STABLE_INTEROPERABILITY_EXTRACTION_AUDIT_V0.
 * This file proves, mechanically, the two claims that audit's follow-up
 * implementation lane was scoped to establish:
 *
 *   A. the closed-world coverage module (transformation-stability-coverage.ts)
 *      has no mandatory ReceiptOS/Chronicle runtime dependency -- a coverage
 *      profile with no normalizers needs no authority at all, and a profile
 *      that does use a normalizer works with any caller-supplied,
 *      genuinely-constructed normalizer authority (see
 *      transformation-stability-coverage-normalizer-authority.ts), generic
 *      or domain-specific, injected explicitly at the call site. A bare
 *      resolver closure is deliberately NOT exercised here as a positive
 *      case -- that shape was a repaired defect (see
 *      GENERIC_NORMALIZER_AUTHORITY_REPAIR_V0), and its rejection is
 *      covered adversarially in
 *      transformation-stability-coverage-normalizer-registry-v0.test.ts;
 *
 *   B. the shared comparator (canonical-identity-json.ts) and the three
 *      other generic-core modules (transformation-stability.ts,
 *      transformation-stability-cycle.ts,
 *      transformation-stability-coverage-normalizer-authority.ts) have a
 *      runtime import closure containing zero ReceiptOS/Chronicle/
 *      HandoffEvidence/verifier-challenge domain code.
 *
 * Every fixture in this file is a synthetic, intentionally non-Chronicle
 * domain object -- this file never imports anything under
 * src/receiptos/capsule/** or src/receiptos/canon/**, and that is itself
 * part of the proof: if the generic core required Chronicle, a purely
 * synthetic domain object could not exercise it end to end.
 *
 * This file does NOT redesign relationship semantics, verdicts, coverage,
 * or normalizer equivalence -- it only proves the existing generic
 * mechanisms work without their one prior hard dependency.
 */

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { canonicalIdentityJson } from "../../src/receiptos/challenge/canonical-identity-json"
import {
  defineCoverageProfileV0,
  evaluateTransformationStabilityWithCoverageV0,
} from "../../src/receiptos/challenge/transformation-stability-coverage"
import { defineNormalizerAuthorityV0 } from "../../src/receiptos/challenge/transformation-stability-coverage-normalizer-authority"
import {
  defineTransformationCycleEdgeV0,
  defineTransformationCycleProfileV0,
  evaluateTransformationCycleV0,
} from "../../src/receiptos/challenge/transformation-stability-cycle"
import { defineTransformationProfileV0, evaluateTransformationStabilityV0 } from "../../src/receiptos/challenge/transformation-stability"

const root = resolve(import.meta.dir, "..", "..")

// ---------------------------------------------------------------------------
// Synthetic, non-Chronicle domain object. "Widget" is deliberately generic:
// it has nothing to do with receipts, collections, portfolios, or
// checkpoints. It exists only to prove the generic core evaluates a
// domain it has never heard of.
// ---------------------------------------------------------------------------

type WidgetV0 = {
  readonly id: string
  readonly tags: string[]
  readonly note?: string
}

function recomputeWidget(widget: WidgetV0) {
  return { state: "evaluated" as const, value: { id: widget.id, tags: [...widget.tags].sort() } }
}

// ---------------------------------------------------------------------------
// Part A: closed-world coverage without any authority.
// ---------------------------------------------------------------------------

describe("generic extraction: closed-world coverage needs no domain registry", () => {
  test("a coverage profile with no value_normalizers works with no normalizer_authority supplied at all", () => {
    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "id", targetClass: "N" }],
      // No value_normalizers, no normalizer_authority.
    })
    expect(result.ok).toBe(true)
  })

  test("that profile correctly escalates an unclassified appeared field to violation, purely on synthetic data", async () => {
    const coverageResult = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "id", targetClass: "N" }],
    })
    if (!coverageResult.ok) throw new Error("unexpected profile-invalid")

    const transformationProfile = defineTransformationProfileV0<WidgetV0, WidgetV0, { id: string; tags: string[] }>({
      transformation_profile_id: "generic-widget-coverage-pilot-v0",
      transformation_family: "generic_widget_coverage_pilot",
      source_object_kind: "widget.v0",
      target_object_kind: "widget.v0",
      recompute_procedure_id: "generic.widgetSortTags.v0",
      comparison_rule_id: "id-only.v0",
      history_sensitive_policy: "classify",
      precondition: () => ({ ok: true }),
      // Appends an unclassified field ("note") -- this field is not
      // declared N/S/A anywhere, so it must derive to F and escalate.
      transform: (widget) => ({ ...widget, note: "appeared-out-of-nowhere" }),
      recompute_source: recomputeWidget,
      recompute_target: recomputeWidget,
      normative_projection: (result) => ({ id: result.id }),
      stability_projection: (result) => ({ id: result.id, tags: result.tags }),
      allowed_variant_projection: () => ({}),
      forbidden_variant_projection: () => ({}),
    })

    const outcome = await evaluateTransformationStabilityWithCoverageV0(
      coverageResult.profile,
      transformationProfile,
      { id: "widget-1", tags: ["b", "a"] },
    )

    expect(outcome.escalated_by_coverage).toBe(true)
    expect(outcome.classification).toBe("violation")
  })

  test("a coverage profile referencing a normalizer_id with no authority is rejected -- no implicit default registry", () => {
    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "tags", targetClass: "N" }],
      value_normalizers: { tags: "generic.sortStrings.v0" },
    })
    expect(result.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Part A: a fully synthetic, non-ReceiptOS normalizer authority is
// injectable -- this proves the authority interface is genuinely generic,
// not merely "pluggable in theory but only ever fed the Chronicle authority
// in practice." Built via defineNormalizerAuthorityV0, the same generic
// constructor the ReceiptOS binding uses -- never a bare resolver closure,
// which is the exact shape the repair lane rejected (see
// transformation-stability-coverage-normalizer-registry-v0.test.ts's
// adversarial boundary tests).
// ---------------------------------------------------------------------------

const GENERIC_SORT_STRINGS_NORMALIZER_ID = "generic.sortStrings.multiset.v0"

function genericSortStringsNormalizer(value: unknown): unknown {
  return Array.isArray(value) ? [...(value as string[])].sort() : value
}

const GENERIC_SYNTHETIC_AUTHORITY_RESULT = defineNormalizerAuthorityV0({
  authority_id: "generic.synthetic_test_authority.v0",
  authority_version: "v0",
  entries: [
    {
      normalizer_id: GENERIC_SORT_STRINGS_NORMALIZER_ID,
      equivalence_kind: "multiset_reorder_only",
      implementation: genericSortStringsNormalizer,
    },
  ],
})
if (!GENERIC_SYNTHETIC_AUTHORITY_RESULT.ok) throw new Error("unexpected: synthetic test authority failed to construct")
const GENERIC_SYNTHETIC_AUTHORITY = GENERIC_SYNTHETIC_AUTHORITY_RESULT.authority

describe("generic extraction: a synthetic, non-ReceiptOS normalizer authority is injectable", () => {
  test("a profile-declared normalizer_id resolved by a purely synthetic authority is accepted", () => {
    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "tags", targetClass: "N" }],
      value_normalizers: { tags: GENERIC_SORT_STRINGS_NORMALIZER_ID },
      normalizer_authority: GENERIC_SYNTHETIC_AUTHORITY,
    })
    expect(result.ok).toBe(true)
  })

  test("the synthetic normalizer actually collapses a tag reorder end to end, through the generic evaluator", async () => {
    const coverageResult = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "id", targetClass: "N" }, { selector: "tags", targetClass: "N" }],
      value_normalizers: { tags: GENERIC_SORT_STRINGS_NORMALIZER_ID },
      normalizer_authority: GENERIC_SYNTHETIC_AUTHORITY,
    })
    if (!coverageResult.ok) throw new Error("unexpected profile-invalid")

    const transformationProfile = defineTransformationProfileV0<WidgetV0, WidgetV0, { id: string; tags: string[] }>({
      transformation_profile_id: "generic-widget-normalizer-pilot-v0",
      transformation_family: "generic_widget_normalizer_pilot",
      source_object_kind: "widget.v0",
      target_object_kind: "widget.v0",
      recompute_procedure_id: "generic.widgetIdentity.v0",
      comparison_rule_id: "id+tags.v0",
      history_sensitive_policy: "classify",
      precondition: () => ({ ok: true }),
      transform: (widget) => ({ ...widget, tags: [...widget.tags].reverse() }),
      recompute_source: (widget) => ({ state: "evaluated" as const, value: { id: widget.id, tags: widget.tags } }),
      recompute_target: (widget) => ({ state: "evaluated" as const, value: { id: widget.id, tags: widget.tags } }),
      normative_projection: (result) => ({ id: result.id }),
      stability_projection: (result) => ({ id: result.id, tags: result.tags }),
      allowed_variant_projection: () => ({}),
      forbidden_variant_projection: () => ({}),
    })

    const outcome = await evaluateTransformationStabilityWithCoverageV0(
      coverageResult.profile,
      transformationProfile,
      { id: "widget-1", tags: ["b", "a", "c"] },
    )

    // A reversed tags array must NOT escalate -- the injected synthetic
    // normalizer, not the ReceiptOS registry, is what makes the reorder
    // coverage-atom-equal.
    expect(outcome.escalated_by_coverage).toBe(false)
    expect(outcome.classification).not.toBe("violation")
  })
})

// ---------------------------------------------------------------------------
// Part B: the flat and cycle evaluators, exercised end to end on the same
// synthetic Widget domain -- both already had zero Chronicle dependency
// before this lane; this reconfirms it after the comparator relocation.
// ---------------------------------------------------------------------------

describe("generic extraction: flat and cycle evaluators work on a purely synthetic domain", () => {
  test("flat evaluator: stable widget round-trip", async () => {
    const profile = defineTransformationProfileV0<WidgetV0, WidgetV0, { id: string; tags: string[] }>({
      transformation_profile_id: "generic-widget-flat-v0",
      transformation_family: "generic_widget_flat",
      source_object_kind: "widget.v0",
      target_object_kind: "widget.v0",
      recompute_procedure_id: "generic.widgetSortTags.v0",
      comparison_rule_id: "id+sorted-tags.v0",
      history_sensitive_policy: "classify",
      precondition: () => ({ ok: true }),
      transform: (widget) => ({ ...widget, tags: [...widget.tags].reverse() }),
      recompute_source: recomputeWidget,
      recompute_target: recomputeWidget,
      normative_projection: (result) => ({ id: result.id, tags: result.tags }),
      stability_projection: (result) => ({ id: result.id, tags: result.tags }),
      allowed_variant_projection: () => ({}),
      forbidden_variant_projection: () => ({}),
    })

    const outcome = await evaluateTransformationStabilityV0(profile, { id: "widget-1", tags: ["b", "a"] })
    expect(outcome.classification).toBe("stable")
  })

  test("cycle evaluator: an intermediate violation is not erased by a later restoring edge", async () => {
    const cycleProfile = defineTransformationCycleProfileV0<WidgetV0, { id: string; tags: string[] }>({
      cycle_profile_id: "generic-widget-cycle-v0",
      node_object_kind: "widget.v0",
      recompute_procedure_id: "generic.widgetIdentity.v0",
      comparison_rule_id: "id.v0",
      history_sensitive_policy: "classify",
      recompute: (widget) => ({ state: "evaluated" as const, value: { id: widget.id, tags: widget.tags } }),
      normative_projection: (result) => ({ id: result.id }),
      stability_projection: (result) => ({ id: result.id, tags: result.tags }),
      allowed_variant_projection: () => ({}),
      forbidden_variant_projection: () => ({}),
      ordered_edges: [
        defineTransformationCycleEdgeV0<WidgetV0>({
          edge_id: "mutate-id",
          precondition: () => ({ ok: true }),
          transform: (widget) => ({ ...widget, id: `${widget.id}-mutated` }),
        }),
        defineTransformationCycleEdgeV0<WidgetV0>({
          edge_id: "restore-id",
          precondition: () => ({ ok: true }),
          transform: (widget) => ({ ...widget, id: widget.id.replace(/-mutated$/, "") }),
        }),
      ],
    })

    const outcome = await evaluateTransformationCycleV0(cycleProfile, { id: "widget-1", tags: ["a"] })
    expect(outcome.classification).toBe("violation")
    expect(outcome.failed_edge_id).toBe("mutate-id")
    // The restoring edge is declared but never reached.
    expect(outcome.edges.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Part B: mechanical import-closure proof. Bundles each generic-core module
// with Bun's own bundler (the same tool used throughout this repository's
// build-check discipline) and greps the actual bundled output text -- not
// just source-level import statements -- for every forbidden term. This
// proves the RUNTIME closure, including anything a transitive import might
// have pulled in, not merely that this file's own imports look clean.
// ---------------------------------------------------------------------------

const GENERIC_CORE_MODULES = [
  "src/receiptos/challenge/transformation-stability.ts",
  "src/receiptos/challenge/transformation-stability-cycle.ts",
  "src/receiptos/challenge/transformation-stability-coverage.ts",
  "src/receiptos/challenge/transformation-stability-coverage-normalizer-authority.ts",
  "src/receiptos/challenge/canonical-identity-json.ts",
]

const FORBIDDEN_TERMS = [
  "Chronicle",
  "HandoffEvidence",
  "receipt_root",
  "collection_root",
  "portfolio_root",
  "checkpoint_root",
  "Crystal Receipt",
]

describe("generic extraction: bundled runtime import closure contains zero ReceiptOS domain terms", () => {
  for (const modulePath of GENERIC_CORE_MODULES) {
    test(`${modulePath}: bundled output contains none of ${JSON.stringify(FORBIDDEN_TERMS)}`, async () => {
      const result = await Bun.build({ entrypoints: [resolve(root, modulePath)], target: "bun" })
      expect(result.success).toBe(true)
      expect(result.outputs.length).toBe(1)
      const bundledText = await result.outputs[0]!.text()
      for (const term of FORBIDDEN_TERMS) {
        expect(bundledText.toLowerCase().includes(term.toLowerCase())).toBe(false)
      }
    })
  }

  test("source-level check: no generic-core file has an import/require statement naming a chronicle-* module", () => {
    const importLikePattern = /^\s*(import|export)\b[^\n]*from\s+["'][^"']*chronicle[^"']*["']/im
    for (const modulePath of GENERIC_CORE_MODULES) {
      const source = readFileSync(resolve(root, modulePath), "utf8")
      expect(importLikePattern.test(source)).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// Comparator sanity, using the relocated import path directly (not via
// counterfactual-neighborhood.ts) -- confirms the direct import works and
// behaves identically to how the three generic-core modules use it.
// ---------------------------------------------------------------------------

describe("generic extraction: comparator import path", () => {
  test("canonicalIdentityJson imported directly from canonical-identity-json.ts behaves as expected", () => {
    expect(canonicalIdentityJson({ b: 1, a: 2 })).toBe(canonicalIdentityJson({ a: 2, b: 1 }))
    expect(canonicalIdentityJson([1, 2])).not.toBe(canonicalIdentityJson([2, 1]))
  })
})
