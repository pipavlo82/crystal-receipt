import { describe, expect, test } from "bun:test"
import {
  createChronicleCollectionV0,
  createChroniclePortfolioV0,
  type ChronicleEntryV0,
  type ChroniclePortfolioV0,
} from "../../src/receiptos/capsule/chronicle-portfolio-v0"
import {
  defineCoverageProfileV0,
  evaluateTransformationStabilityWithCoverageV0,
  observedLeafPathsV0,
  parseCoverageSelectorV0,
  runCoveragePlaneV0,
} from "../../src/receiptos/challenge/transformation-stability-coverage"
import {
  defineTransformationProfileV0,
  evaluateTransformationStabilityV0,
  type RecomputeOutcomeV0,
} from "../../src/receiptos/challenge/transformation-stability"
import {
  CHRONICLE_PORTFOLIO_COVERAGE_PROFILE_V0,
  buildPilotBaseProfileV0,
  evaluateChroniclePortfolioWithCoverageV0,
} from "../../src/receiptos/challenge/transformation-stability-chronicle-portfolio-coverage-v1"

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function demoEntry(id: string): ChronicleEntryV0 {
  return {
    schema: "chronicle_entry.v0",
    entry_id: id,
    source_system: "ReceiptOS",
    receipt_root: `0x${"a".repeat(64)}`,
    proof_object_ref: `receiptos://portable-proof-object/${id}`,
    evidence_capsule_ref: `embedded:${id}:evidence_capsule`,
    provenance_summary_ref: `embedded:${id}:provenance_summary`,
    created_from: null,
    labels: [],
    notes: null,
  }
}

function buildPortfolioFixture(): ChroniclePortfolioV0 {
  const collectionA = createChronicleCollectionV0(demoEntry("entry-alpha"), {
    collectionId: "collection-alpha",
    artifactRefs: ["entry-alpha"],
  })
  const collectionB = createChronicleCollectionV0(demoEntry("entry-beta"), {
    collectionId: "collection-beta",
    artifactRefs: ["entry-beta"],
  })
  return createChroniclePortfolioV0([collectionA, collectionB], { portfolioId: "portfolio-coverage-pilot" })
}

describe("closed-world profile coverage v0 -- selector grammar", () => {
  test("exact path parses", () => {
    const result = parseCoverageSelectorV0("portfolio_id")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.selector).toEqual({ raw: "portfolio_id", side: null, segments: ["portfolio_id"], wildcard: false })
    }
  })

  test("multi-segment exact path parses", () => {
    const result = parseCoverageSelectorV0("metadata.owner.wallet")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.selector.segments).toEqual(["metadata", "owner", "wallet"])
  })

  test("deep wildcard parses and matches the prefix itself plus descendants", () => {
    const result = parseCoverageSelectorV0("metadata.**")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.selector.wildcard).toBe(true)
      expect(result.selector.segments).toEqual(["metadata"])
    }
  })

  test("bare deep wildcard parses", () => {
    const result = parseCoverageSelectorV0("**")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.selector.segments).toEqual([])
  })

  test("side-qualified selector parses", () => {
    const result = parseCoverageSelectorV0("source::checkpoint_id")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.selector.side).toBe("source")
      expect(result.selector.segments).toEqual(["checkpoint_id"])
    }
  })

  test("single-segment * is rejected (not in the locked v0 grammar)", () => {
    const result = parseCoverageSelectorV0("metadata.*")
    expect(result.ok).toBe(false)
  })

  test("numeric index / bracket selectors are rejected", () => {
    expect(parseCoverageSelectorV0("collection_refs[0]").ok).toBe(false)
    expect(parseCoverageSelectorV0("collection_refs.0").ok).toBe(false)
  })

  test("malformed side qualifier is rejected", () => {
    expect(parseCoverageSelectorV0("upstream::checkpoint_id").ok).toBe(false)
  })

  test("wildcard in a non-trailing position is rejected", () => {
    expect(parseCoverageSelectorV0("metadata.**.foo").ok).toBe(false)
  })

  test("empty selector and empty path are rejected", () => {
    expect(parseCoverageSelectorV0("").ok).toBe(false)
    expect(parseCoverageSelectorV0("source::").ok).toBe(false)
  })
})

describe("closed-world profile coverage v0 -- structural walk", () => {
  test("nested objects recurse by sorted key; arrays terminate as whole-array leaf atoms", () => {
    const leaves = observedLeafPathsV0({
      b_field: 1,
      a_field: { nested: "x", inner_array: [1, 2, 3] },
      an_array: ["p", "q"],
    })
    expect([...leaves.keys()].sort()).toEqual(["a_field.inner_array", "a_field.nested", "an_array", "b_field"])
    expect(leaves.get("an_array")).toEqual(["p", "q"])
    expect(leaves.get("a_field.inner_array")).toEqual([1, 2, 3])
  })

  test("null is a present leaf, distinct from absent", () => {
    const leaves = observedLeafPathsV0({ present_null: null })
    expect(leaves.has("present_null")).toBe(true)
    expect(leaves.get("present_null")).toBeNull()
  })

  test("undefined-valued keys are treated as absent, matching canonicalize()'s existing convention", () => {
    const leaves = observedLeafPathsV0({ maybe: undefined, real: 1 })
    expect(leaves.has("maybe")).toBe(false)
    expect(leaves.has("real")).toBe(true)
  })

  test("arrays of records are not decomposed per element in v0", () => {
    const leaves = observedLeafPathsV0({ items: [{ id: "a" }, { id: "b" }] })
    expect([...leaves.keys()]).toEqual(["items"])
    expect(leaves.get("items")).toEqual([{ id: "a" }, { id: "b" }])
  })
})

describe("closed-world profile coverage v0 -- profile validation", () => {
  test("wildcard in A is rejected", () => {
    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "metadata.**", targetClass: "A" }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reasons.some((r) => r.includes("wildcard_forbidden_in_A"))).toBe(true)
  })

  test("wildcard in S is rejected unless history_sensitive_policy is violation", () => {
    const classify = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "metadata.**", targetClass: "S" }],
    })
    expect(classify.ok).toBe(false)

    const violation = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "violation",
      declarations: [{ selector: "metadata.**", targetClass: "S" }],
    })
    expect(violation.ok).toBe(true)
  })

  test("wildcard in N and F is always allowed", () => {
    const nResult = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "metadata.**", targetClass: "N" }],
    })
    expect(nResult.ok).toBe(true)
  })

  test("malformed selector invalidates the profile", () => {
    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "collection_refs[0]", targetClass: "N" }],
    })
    expect(result.ok).toBe(false)
  })

  test("equal-specificity conflicting classes invalidate the profile", () => {
    const exactConflict = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [
        { selector: "portfolio_id", targetClass: "N" },
        { selector: "portfolio_id", targetClass: "A" },
      ],
    })
    expect(exactConflict.ok).toBe(false)
    if (!exactConflict.ok) expect(exactConflict.reasons.some((r) => r.includes("conflicting_selector_classes"))).toBe(true)

    const wildcardConflict = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [
        { selector: "metadata.**", targetClass: "N" },
        { selector: "metadata.**", targetClass: "F" as never }, // F is never author-enumerable; still must not silently pass
      ],
    })
    expect(wildcardConflict.ok).toBe(false)
  })

  test("equal-specificity duplicate declarations of the same class are harmless", () => {
    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [
        { selector: "portfolio_id", targetClass: "N" },
        { selector: "portfolio_id", targetClass: "N" },
      ],
    })
    expect(result.ok).toBe(true)
  })

  test("side qualifier is illegal in a same-type profile", () => {
    const result = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "source::portfolio_id", targetClass: "N" }],
    })
    expect(result.ok).toBe(false)
  })

  test("cross-type profiles (same_type: false) are rejected -- unsupported in v0, not merely unverified (see transformation-stability-coverage-cross-type-rejection-v0.test.ts for the full adversarial suite)", () => {
    const result = defineCoverageProfileV0({
      same_type: false,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "portfolio_id", targetClass: "N" }],
    } as unknown as Parameters<typeof defineCoverageProfileV0>[0])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.some((r) => r === "cross_type_coverage_not_supported_in_v0")).toBe(true)
    }
  })
})

describe("closed-world profile coverage v0 -- wildcard precedence", () => {
  const baseProfile = () =>
    defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [
        { selector: "metadata.**", targetClass: "F" },
        { selector: "metadata.render.**", targetClass: "N" },
        { selector: "metadata.render.theme", targetClass: "A" },
      ],
    })

  test("exact selector overrides a broader wildcard deterministically", () => {
    const validated = baseProfile()
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    const report = runCoveragePlaneV0(
      validated.profile,
      { metadata: { render: { theme: "dark" } } },
      { metadata: { render: { theme: "light" } } },
    )
    const themePath = report.paths.find((p) => p.path === "metadata.render.theme")
    expect(themePath?.targetClass).toBe("A")
  })

  test("longer wildcard prefix overrides shorter wildcard prefix deterministically", () => {
    const validated = baseProfile()
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    const report = runCoveragePlaneV0(
      validated.profile,
      { metadata: { render: { other: 1 } } },
      { metadata: { render: { other: 2 } } },
    )
    const otherPath = report.paths.find((p) => p.path === "metadata.render.other")
    expect(otherPath?.targetClass).toBe("N") // metadata.render.** (N), not metadata.** (F)
  })

  test("paths matching only the broader wildcard fall to it", () => {
    const validated = baseProfile()
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    const report = runCoveragePlaneV0(validated.profile, { metadata: { unrelated: 1 } }, { metadata: { unrelated: 2 } })
    const unrelatedPath = report.paths.find((p) => p.path === "metadata.unrelated")
    expect(unrelatedPath?.targetClass).toBe("F")
  })

  test("an unclassified path with no matching selector at all falls to derived F", () => {
    const validated = defineCoverageProfileV0({
      same_type: true,
      history_sensitive_policy: "classify",
      declarations: [{ selector: "portfolio_id", targetClass: "N" }],
    })
    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    const report = runCoveragePlaneV0(validated.profile, { portfolio_id: "a", totally_unmentioned: 1 }, { portfolio_id: "a", totally_unmentioned: 2 })
    expect(report.paths.find((p) => p.path === "totally_unmentioned")?.targetClass).toBe("F")
    expect(report.forbidden_mismatch_paths).toContain("totally_unmentioned")
  })
})

describe("closed-world profile coverage v0 -- generic composition (synthetic fixture, no Chronicle domain)", () => {
  // Mirrors the existing generic-core sanity-check pattern already used
  // elsewhere in this test suite family: a package/domain-neutral synthetic
  // Node/Output shape, not tied to any real ReceiptOS object.
  type Node = { readonly value: string; readonly extra?: Record<string, unknown> }
  type Output = { readonly value: string; readonly extra: Record<string, unknown> | undefined }

  test("coverage plane does not run when the base evaluator returns out_of_domain", async () => {
    const coverage = defineCoverageProfileV0({ same_type: true, history_sensitive_policy: "classify", declarations: [] })
    expect(coverage.ok).toBe(true)
    if (!coverage.ok) return
    const profile = defineTransformationProfileV0<Node, Node, Output>({
      transformation_profile_id: "coverage-synthetic-ood-v0",
      transformation_family: "coverage-synthetic",
      source_object_kind: "synthetic-node",
      target_object_kind: "synthetic-node",
      recompute_procedure_id: "synthetic-recompute",
      comparison_rule_id: "synthetic-comparison",
      history_sensitive_policy: "classify",
      precondition: () => ({ ok: false, reason: "synthetic_out_of_domain" }),
      transform: (node) => node,
      recompute_source: (node): RecomputeOutcomeV0<Output> => ({ state: "evaluated", value: { value: node.value, extra: node.extra } }),
      recompute_target: (node): RecomputeOutcomeV0<Output> => ({ state: "evaluated", value: { value: node.value, extra: node.extra } }),
      normative_projection: () => ({}),
      stability_projection: () => ({}),
      allowed_variant_projection: () => ({}),
      forbidden_variant_projection: () => ({}),
    })
    const result = await evaluateTransformationStabilityWithCoverageV0(coverage.profile, profile, { value: "x" })
    expect(result.base.classification).toBe("out_of_domain")
    expect(result.classification).toBe("out_of_domain")
    expect(result.coverage).toBeNull()
    expect(result.escalated_by_coverage).toBe(false)
  })

  test("coverage escalates a base 'stable' result to 'violation' when an uncovered path changes (N)", async () => {
    const coverage = defineCoverageProfileV0({ same_type: true, history_sensitive_policy: "classify", declarations: [{ selector: "value", targetClass: "A" }] })
    expect(coverage.ok).toBe(true)
    if (!coverage.ok) return
    // Projections deliberately touch nothing (empty), so the base evaluator
    // is genuinely blind to the `extra` field appearing -- proving the
    // escalation below is real, not incidental to some other projection
    // logic. `recompute_*` omits the `extra` key entirely when absent
    // (rather than setting it to `undefined`), matching how every real
    // profile in this codebase avoids feeding `undefined` into the strict
    // comparator.
    const blindProfile = defineTransformationProfileV0<Node, Node, Output>({
      transformation_profile_id: "coverage-synthetic-blind-v0",
      transformation_family: "coverage-synthetic",
      source_object_kind: "synthetic-node",
      target_object_kind: "synthetic-node",
      recompute_procedure_id: "synthetic-recompute",
      comparison_rule_id: "synthetic-comparison",
      history_sensitive_policy: "classify",
      precondition: () => ({ ok: true }),
      transform: (node) => ({ value: node.value, extra: { added: true } }),
      recompute_source: (node): RecomputeOutcomeV0<Output> => ({
        state: "evaluated",
        value: node.extra === undefined ? { value: node.value, extra: undefined } : { value: node.value, extra: node.extra },
      }),
      recompute_target: (node): RecomputeOutcomeV0<Output> => ({
        state: "evaluated",
        value: node.extra === undefined ? { value: node.value, extra: undefined } : { value: node.value, extra: node.extra },
      }),
      normative_projection: () => ({}),
      stability_projection: () => ({}),
      allowed_variant_projection: () => ({}),
      forbidden_variant_projection: () => ({}),
    })
    const baseOnly = await evaluateTransformationStabilityV0(blindProfile, { value: "x" })
    expect(baseOnly.classification).toBe("stable")
    const result = await evaluateTransformationStabilityWithCoverageV0(coverage.profile, blindProfile, { value: "x" })
    expect(result.escalated_by_coverage).toBe(true)
    expect(result.classification).toBe("violation")
    expect(result.coverage?.forbidden_mismatch_paths).toContain("extra.added")
  })

  test("coverage never softens an existing violation", async () => {
    const coverage = defineCoverageProfileV0({ same_type: true, history_sensitive_policy: "classify", declarations: [{ selector: "value", targetClass: "A" }] })
    expect(coverage.ok).toBe(true)
    if (!coverage.ok) return
    const violatingProfile = defineTransformationProfileV0<Node, Node, Output>({
      transformation_profile_id: "coverage-synthetic-violation-v0",
      transformation_family: "coverage-synthetic",
      source_object_kind: "synthetic-node",
      target_object_kind: "synthetic-node",
      recompute_procedure_id: "synthetic-recompute",
      comparison_rule_id: "synthetic-comparison",
      history_sensitive_policy: "classify",
      precondition: () => ({ ok: true }),
      transform: (node) => ({ value: `${node.value}-mutated`, extra: node.extra }),
      recompute_source: (node): RecomputeOutcomeV0<Output> => ({ state: "evaluated", value: { value: node.value, extra: node.extra } }),
      recompute_target: (node): RecomputeOutcomeV0<Output> => ({ state: "evaluated", value: { value: node.value, extra: node.extra } }),
      normative_projection: (result) => ({ value: result.value }),
      stability_projection: (result) => ({ value: result.value }),
      allowed_variant_projection: () => ({}),
      forbidden_variant_projection: () => ({}),
    })
    const result = await evaluateTransformationStabilityWithCoverageV0(coverage.profile, violatingProfile, { value: "x" })
    expect(result.base.classification).toBe("violation")
    expect(result.classification).toBe("violation")
  })
})

// ---------------------------------------------------------------------------
// Pilot: ChroniclePortfolioV0. The three required proof-of-claim mutants,
// plus the reactive-guarantee limit and backward-compatible stable cases.
// ---------------------------------------------------------------------------

describe("closed-world profile coverage v0 -- Chronicle Portfolio v1 pilot", () => {
  test("pilot coverage declarations are valid", () => {
    expect(CHRONICLE_PORTFOLIO_COVERAGE_PROFILE_V0.__coverageBrand).toBe("CoverageProfileV0")
  })

  test("baseline: identical portfolio (no mutation) is stable and not escalated", async () => {
    const fixture = buildPortfolioFixture()
    const result = await evaluateChroniclePortfolioWithCoverageV0((node) => ({ ...node }), "pilot-identity", fixture)
    expect(result.classification).toBe("stable")
    expect(result.escalated_by_coverage).toBe(false)
  })

  test("stable reorder: collection_refs order reversal stays stable under the reused sortCollectionRefs normalizer", async () => {
    const fixture = buildPortfolioFixture()
    const reordered = { ...fixture, collection_refs: [...fixture.collection_refs].reverse() }
    const result = await evaluateChroniclePortfolioWithCoverageV0((node) => reordered, "pilot-reorder", fixture)
    expect(result.classification).toBe("stable")
    expect(result.coverage?.normative_mismatch_paths).toEqual([])
  })

  test("PROOF A -- unknown field appearance: metadata.future_field is discovered from the target instance, defaults into derived F, and escalates to violation", async () => {
    const fixture = buildPortfolioFixture()
    expect("metadata" in fixture).toBe(false)
    const target = { ...fixture, metadata: { future_field: 1 } }

    const result = await evaluateChroniclePortfolioWithCoverageV0((node) => target, "pilot-appearance", fixture)

    // Base evaluator alone (whose forbidden_variant_projection deliberately
    // omits metadata) does NOT independently flag this a violation --
    // proving escalation is real, not redundant.
    expect(result.base.classification).not.toBe("violation")
    expect(result.coverage?.paths.some((p) => p.path === "metadata.future_field")).toBe(true)
    expect(result.coverage?.paths.find((p) => p.path === "metadata.future_field")?.targetClass).toBe("F")
    expect(result.coverage?.paths.find((p) => p.path === "metadata.future_field")?.sourcePresent).toBe(false)
    expect(result.coverage?.paths.find((p) => p.path === "metadata.future_field")?.targetPresent).toBe(true)
    expect(result.coverage?.forbidden_mismatch_paths).toContain("metadata.future_field")
    expect(result.escalated_by_coverage).toBe(true)
    expect(result.classification).toBe("violation")
  })

  test("PROOF B -- unknown field deletion: metadata.future_field present only on source is discovered and escalates to violation", async () => {
    const fixture = buildPortfolioFixture()
    const source = { ...fixture, metadata: { future_field: 1 } }

    const result = await evaluateChroniclePortfolioWithCoverageV0((node) => fixture, "pilot-deletion", source)

    expect(result.base.classification).not.toBe("violation")
    const path = result.coverage?.paths.find((p) => p.path === "metadata.future_field")
    expect(path?.sourcePresent).toBe(true)
    expect(path?.targetPresent).toBe(false)
    expect(path?.targetClass).toBe("F")
    expect(result.coverage?.forbidden_mismatch_paths).toContain("metadata.future_field")
    expect(result.escalated_by_coverage).toBe(true)
    expect(result.classification).toBe("violation")
  })

  test("PROOF C -- unknown nested descendant: metadata.experimental.deep.flag is discovered structurally, without any selector naming experimental/deep/flag, and escalates to violation", async () => {
    const fixture = buildPortfolioFixture()
    const target = { ...fixture, metadata: { experimental: { deep: { flag: true } } } }

    // Sanity: no declared selector anywhere in the pilot profile names any
    // of these segments.
    const declaredSelectors = CHRONICLE_PORTFOLIO_COVERAGE_PROFILE_V0.declarations.map((d) => d.selector.raw)
    expect(declaredSelectors.some((s) => s.includes("experimental") || s.includes("deep") || s.includes("flag"))).toBe(false)

    const result = await evaluateChroniclePortfolioWithCoverageV0((node) => target, "pilot-nested", fixture)

    expect(result.coverage?.paths.some((p) => p.path === "metadata.experimental.deep.flag")).toBe(true)
    expect(result.coverage?.paths.find((p) => p.path === "metadata.experimental.deep.flag")?.targetClass).toBe("F")
    expect(result.coverage?.forbidden_mismatch_paths).toContain("metadata.experimental.deep.flag")
    expect(result.escalated_by_coverage).toBe(true)
    expect(result.classification).toBe("violation")
  })

  test("known metadata mutation remains forbidden: a value change on an already-present metadata field is also caught", async () => {
    const fixture = buildPortfolioFixture()
    const source = { ...fixture, metadata: { scorecard: 1 } }
    const target = { ...fixture, metadata: { scorecard: 2 } }

    const result = await evaluateChroniclePortfolioWithCoverageV0((node) => target, "pilot-known-mutation", source)

    expect(result.coverage?.paths.find((p) => p.path === "metadata.scorecard")?.targetClass).toBe("F")
    expect(result.coverage?.forbidden_mismatch_paths).toContain("metadata.scorecard")
    expect(result.escalated_by_coverage).toBe(true)
    expect(result.classification).toBe("violation")
  })

  test("N-side omission: a schema-only mutation is invisible to the base profile's own normative_projection, but discovered and escalated by coverage", async () => {
    const fixture = buildPortfolioFixture()
    // Off-root-preimage mutation: does not move root_match/claimed_root/recomputed_root.
    const target = { ...fixture, schema: `${fixture.schema}-mutated` } as unknown as ChroniclePortfolioV0

    const result = await evaluateChroniclePortfolioWithCoverageV0((node) => target, "pilot-schema-omission", fixture)

    expect(result.base.classification).not.toBe("violation") // base's own normative_projection never mentions `schema`
    expect(result.coverage?.paths.find((p) => p.path === "schema")?.targetClass).toBe("N")
    expect(result.coverage?.normative_mismatch_paths).toContain("schema")
    expect(result.escalated_by_coverage).toBe(true)
    expect(result.classification).toBe("violation")
  })

  test("REACTIVE GUARANTEE LIMIT: an optional field absent on both source and target is not in U_runtime -- this is the documented weaker, reactive-only guarantee, not schema-total coverage", async () => {
    const fixture = buildPortfolioFixture()
    expect("metadata" in fixture).toBe(false)

    const result = await evaluateChroniclePortfolioWithCoverageV0((node) => ({ ...node }), "pilot-reactive-limit", fixture)

    expect(result.coverage?.paths.some((p) => p.path.startsWith("metadata"))).toBe(false)
    expect(result.classification).toBe("stable")
    // The moment metadata is populated on either side (proven above), it is
    // caught from that evaluation onward -- proactive coverage of a field
    // that has never yet appeared anywhere is exactly what this v0 does not
    // and cannot claim without an authoritative schema, which does not
    // exist for this domain.
  })
})

describe("closed-world profile coverage v0 -- backward compatibility guard", () => {
  test("the coverage-aware entry point is additive: buildPilotBaseProfileV0 still returns a plain AuthenticatedTransformationProfileV0 usable with the unmodified existing evaluator directly", async () => {
    const fixture = buildPortfolioFixture()
    const profile = buildPilotBaseProfileV0((node) => ({ ...node }), "pilot-plain-evaluator")
    const result = await evaluateTransformationStabilityV0(profile, fixture)
    expect(result.classification).toBe("stable")
  })
})
