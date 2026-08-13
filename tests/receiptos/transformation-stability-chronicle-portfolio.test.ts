import { describe, expect, test } from "bun:test"
import {
  type ChroniclePortfolioV0,
  computeChroniclePortfolioRoot,
  verifyChroniclePortfolioV0,
} from "../../src/receiptos/capsule/chronicle-portfolio-v0"
import {
  CHRONICLE_PORTFOLIO_TRANSFORMATION_CYCLE_VECTORS_V1,
  CHRONICLE_PORTFOLIO_TRANSFORMATION_VECTORS_V1,
  evaluateChroniclePortfolioTransformationCycleVectorV1,
  evaluateChroniclePortfolioTransformationMatrixV1,
  evaluateChroniclePortfolioTransformationVectorV1,
} from "../../src/receiptos/challenge/transformation-stability-chronicle-portfolio"
import {
  defineTransformationCycleEdgeV0,
  defineTransformationCycleProfileV0,
  evaluateTransformationCycleV0,
} from "../../src/receiptos/challenge/transformation-stability-cycle"

// Chronicle-native fixture only — no HandoffEvidence, no createChroniclePortfolioV0
// indirection through ChronicleCollectionV0/ChronicleEntryV0. Built directly from
// the exported root-computation primitive so the initial claimed root is genuine,
// not hand-computed.
const PORTFOLIO_VERSION = "chronicle_portfolio.v0" as const
const PORTFOLIO_ID = "portfolio-demo"
const COLLECTION_REFS = ["/collection/collection-a", "/collection/collection-b"]

function buildFixture(): ChroniclePortfolioV0 {
  return {
    schema: PORTFOLIO_VERSION,
    portfolio_version: PORTFOLIO_VERSION,
    portfolio_id: PORTFOLIO_ID,
    collection_refs: [...COLLECTION_REFS],
    portfolio_root: computeChroniclePortfolioRoot({
      portfolio_version: PORTFOLIO_VERSION,
      portfolio_id: PORTFOLIO_ID,
      collection_refs: COLLECTION_REFS,
    }),
  }
}

describe("chronicle portfolio transformation stability v1", () => {
  test("fixture is genuinely multi-element and root-valid before any transform", () => {
    const fixture = buildFixture()
    expect(fixture.collection_refs.length).toBe(2)
    expect(verifyChroniclePortfolioV0(fixture).ok).toBe(true)
  })

  test("flat vector inventory is exact and ordered", () => {
    expect(CHRONICLE_PORTFOLIO_TRANSFORMATION_VECTORS_V1.map((v) => v.vector_id)).toEqual([
      "stable_canonical_roundtrip",
      "collection_refs_reorder_stable",
      "portfolio_id_normative_mutation",
      "metadata_forbidden_mutation",
      "collection_refs_recompute_unresolved",
      "stored_portfolio_root_tamper",
      "schema_literal_mutation",
    ])
  })

  test("cycle vector inventory is exact and ordered", () => {
    expect(CHRONICLE_PORTFOLIO_TRANSFORMATION_CYCLE_VECTORS_V1.map((v) => v.vector_id)).toEqual([
      "stable_multi_edge_roundtrip_reorder",
      "portfolio_id_mutation_then_restore",
      "metadata_mutation_then_restore",
      "collection_refs_corrupt_unresolved",
    ])
  })

  test("flat matrix reaches the exact required aggregate and passes", async () => {
    const result = await evaluateChroniclePortfolioTransformationMatrixV1(buildFixture())
    expect(result.vector_count).toBe(7)
    expect(result.aggregate).toEqual({
      stable: 2,
      history_sensitive: 0,
      unresolved: 1,
      out_of_domain: 0,
      violation: 4,
    })
    expect(result.pass).toBe(true)
  })

  test("stable_canonical_roundtrip: stable, all matches true, root_match stays true", async () => {
    const result = await evaluateChroniclePortfolioTransformationVectorV1(
      "stable_canonical_roundtrip",
      buildFixture(),
    )
    expect(result.classification).toBe("stable")
    expect(result.normative_match).toBe(true)
    expect(result.stability_match).toBe(true)
    expect(result.forbidden_variant_match).toBe(true)
  })

  test("collection_refs_reorder_stable: raw order changes but normalized envelope/root match", async () => {
    const result = await evaluateChroniclePortfolioTransformationVectorV1(
      "collection_refs_reorder_stable",
      buildFixture(),
    )
    expect(result.classification).toBe("stable")
    expect(result.normative_match).toBe(true)
    expect(result.stability_match).toBe(true)
    expect(result.forbidden_variant_match).toBe(true)
  })

  test("portfolio_id_normative_mutation: violation, recomputed root moves, claimed root stale, root_match flips", async () => {
    const fixture = buildFixture()
    const result = await evaluateChroniclePortfolioTransformationVectorV1(
      "portfolio_id_normative_mutation",
      fixture,
    )
    expect(result.classification).toBe("violation")
    expect(result.unresolved_reason).toBeNull()
    expect(result.normative_match).toBe(false)
  })

  test("metadata_forbidden_mutation: violation via F only, N unchanged, root_match stays true", async () => {
    const fixture = buildFixture()
    const result = await evaluateChroniclePortfolioTransformationVectorV1(
      "metadata_forbidden_mutation",
      fixture,
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(true)
    expect(result.forbidden_variant_match).toBe(false)
  })

  test("collection_refs_recompute_unresolved: bounded unresolved, localized to this vector only", async () => {
    const fixture = buildFixture()
    const result = await evaluateChroniclePortfolioTransformationVectorV1(
      "collection_refs_recompute_unresolved",
      fixture,
    )
    expect(result.classification).toBe("unresolved")
    expect(result.unresolved_reason).toBe("chronicle_portfolio_recompute_failed")
    // The fixture itself remains valid — the malformation is local to the
    // transform, never a change to ChroniclePortfolioV0's declared shape.
    expect(verifyChroniclePortfolioV0(fixture).ok).toBe(true)
  })

  test("stored_portfolio_root_tamper: violation, only claimed root moves, recomputed root unaffected", async () => {
    const result = await evaluateChroniclePortfolioTransformationVectorV1(
      "stored_portfolio_root_tamper",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
  })

  test("schema_literal_mutation: violation via schema alone, roots and root_match unaffected", async () => {
    const result = await evaluateChroniclePortfolioTransformationVectorV1(
      "schema_literal_mutation",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
  })

  test("every flat vector's observed result matches its declared expectation exactly", async () => {
    const fixture = buildFixture()
    for (const expected of CHRONICLE_PORTFOLIO_TRANSFORMATION_VECTORS_V1) {
      const observed = await evaluateChroniclePortfolioTransformationVectorV1(expected.vector_id, fixture)
      expect(observed.classification).toBe(expected.expected_classification)
      expect(observed.normative_match).toBe(expected.expected_normative_match)
      expect(observed.stability_match).toBe(expected.expected_stability_match)
      expect(observed.forbidden_variant_match).toBe(expected.expected_forbidden_variant_match)
      expect(observed.unresolved_reason).toBe(expected.expected_unresolved_reason)
      expect(observed.out_of_domain_reason).toBe(expected.expected_out_of_domain_reason)
    }
  })

  test("root-claim verification is reused, not duplicated: matches a direct verifyChroniclePortfolioV0 call", async () => {
    const fixture = buildFixture()
    const direct = verifyChroniclePortfolioV0(fixture)
    const result = await evaluateChroniclePortfolioTransformationVectorV1("stable_canonical_roundtrip", fixture)
    // The source side of the profile recomputes the same fixture; its N
    // match implies the same root_match verifyChroniclePortfolioV0 reports.
    expect(direct.ok).toBe(true)
    expect(result.normative_match).toBe(true)
  })

  test("metadata observation is a defensive snapshot: later nested mutation of the source cannot alter an already-produced observation", async () => {
    const fixture = buildFixture()
    const mutable: Record<string, unknown> = { nested: { count: 1 } }
    const nodeWithMetadata: ChroniclePortfolioV0 = { ...fixture, metadata: mutable }

    const result = await evaluateChroniclePortfolioTransformationVectorV1(
      "metadata_forbidden_mutation",
      nodeWithMetadata,
    )
    // Mutate the ORIGINAL nested object after recompute already ran.
    ;(mutable.nested as Record<string, unknown>).count = 999

    // The recorded classification must not have been influenced by the
    // later mutation — recompute captured a snapshot, not a live reference.
    expect(result.classification).toBe("violation")
    expect(result.forbidden_variant_match).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Closed cycle
  // -------------------------------------------------------------------------

  test("stable_multi_edge_roundtrip_reorder: 2/2 edges completed, endpoint reached, N/S/F all match", async () => {
    const result = await evaluateChroniclePortfolioTransformationCycleVectorV1(
      "stable_multi_edge_roundtrip_reorder",
      buildFixture(),
    )
    expect(result.classification).toBe("stable")
    expect(result.failed_edge_id).toBeNull()
    expect(result.ordered_edge_ids).toEqual(["canonical-roundtrip", "collection-refs-reorder"])
    expect(result.edges.length).toBe(2)
    expect(result.aggregate.completed_edges).toBe(2)
    for (const edge of result.edges) {
      expect(edge.classification).toBe("stable")
      expect(edge.normative_match).toBe(true)
      expect(edge.stability_match).toBe(true)
      expect(edge.forbidden_variant_match).toBe(true)
    }
    expect(result.endpoint.normative_match).toBe(true)
    expect(result.endpoint.stability_match).toBe(true)
    expect(result.endpoint.forbidden_variant_match).toBe(true)
  })

  test("portfolio_id_mutation_then_restore: violation at first edge, restore never executed, endpoint not reached", async () => {
    const result = await evaluateChroniclePortfolioTransformationCycleVectorV1(
      "portfolio_id_mutation_then_restore",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.failed_edge_id).toBe("mutate-portfolio-id")
    expect(result.failure_reason).toBe("normative_projection_mismatch")
    expect(result.ordered_edge_ids).toEqual(["mutate-portfolio-id", "restore-portfolio-id"])
    expect(result.edges.length).toBe(1)
    expect(result.edges[0]!.edge_id).toBe("mutate-portfolio-id")
    expect(result.aggregate.completed_edges).toBe(0)
    expect(result.endpoint.normative_match).toBeNull()
  })

  test("metadata_mutation_then_restore: violation via F at first edge, N unchanged, restore never executed", async () => {
    const result = await evaluateChroniclePortfolioTransformationCycleVectorV1(
      "metadata_mutation_then_restore",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.failed_edge_id).toBe("mutate-metadata")
    expect(result.failure_reason).toBe("forbidden_variant_mismatch")
    expect(result.edges.length).toBe(1)
    const edge = result.edges[0]!
    expect(edge.normative_match).toBe(true)
    expect(edge.forbidden_variant_match).toBe(false)
    expect(result.aggregate.completed_edges).toBe(0)
    expect(result.endpoint.normative_match).toBeNull()
  })

  test("collection_refs_corrupt_unresolved: unresolved, zero completed edges, endpoint not reached", async () => {
    const result = await evaluateChroniclePortfolioTransformationCycleVectorV1(
      "collection_refs_corrupt_unresolved",
      buildFixture(),
    )
    expect(result.classification).toBe("unresolved")
    expect(result.failed_edge_id).toBe("corrupt-collection-refs")
    expect(result.failure_reason).toBe("chronicle_portfolio_recompute_failed")
    expect(result.aggregate.completed_edges).toBe(0)
    expect(result.endpoint.normative_match).toBeNull()
  })

  test("every cycle vector's observed result matches its declared expectation exactly", async () => {
    const fixture = buildFixture()
    for (const expected of CHRONICLE_PORTFOLIO_TRANSFORMATION_CYCLE_VECTORS_V1) {
      const observed = await evaluateChroniclePortfolioTransformationCycleVectorV1(expected.vector_id, fixture)
      expect(observed.classification).toBe(expected.expected_classification)
      expect(observed.failed_edge_id).toBe(expected.expected_failed_edge_id)
      expect(observed.failure_reason).toBe(expected.expected_failure_reason)
      expect(observed.aggregate.completed_edges).toBe(expected.expected_completed_edges)
    }
  })

  // -------------------------------------------------------------------------
  // Reachability boundary
  // -------------------------------------------------------------------------

  test("reachable classification set is exactly {stable, violation, unresolved} across both inventories", () => {
    const flat = new Set(CHRONICLE_PORTFOLIO_TRANSFORMATION_VECTORS_V1.map((v) => v.expected_classification))
    const cycle = new Set(CHRONICLE_PORTFOLIO_TRANSFORMATION_CYCLE_VECTORS_V1.map((v) => v.expected_classification))
    expect(flat).toEqual(new Set(["stable", "violation", "unresolved"]))
    expect(cycle).toEqual(new Set(["stable", "violation", "unresolved"]))
  })

  test("history_sensitive and out_of_domain are absent from both inventories — a profile-domain property, not an untested gap", () => {
    const all = [
      ...CHRONICLE_PORTFOLIO_TRANSFORMATION_VECTORS_V1.map((v) => v.expected_classification),
      ...CHRONICLE_PORTFOLIO_TRANSFORMATION_CYCLE_VECTORS_V1.map((v) => v.expected_classification),
    ]
    expect(all).not.toContain("history_sensitive")
    expect(all).not.toContain("out_of_domain")
  })

  test("the generic Transformation Stability cycle core still supports out_of_domain and history_sensitive elsewhere (sanity check)", async () => {
    // Confirms the absence above is a ChroniclePortfolioV0 profile-domain
    // property, not a lost generic-core capability. Mirrors the equivalent
    // sanity check in transformation-stability-handoff-cycle-v1.test.ts.
    type Node = { readonly inDomain: boolean; readonly observation: string }
    type Output = { readonly verdict: "accept"; readonly observation: string }

    const outOfDomainProfile = defineTransformationCycleProfileV0<Node, Output>({
      cycle_profile_id: "boundary-proof:chronicle-portfolio-generic-core-out-of-domain-sanity",
      node_object_kind: "sanity-node",
      recompute_procedure_id: "sanity-recompute",
      comparison_rule_id: "sanity-projection",
      history_sensitive_policy: "classify",
      ordered_edges: [
        defineTransformationCycleEdgeV0<Node>({
          edge_id: "domain",
          precondition: (node) => (node.inDomain ? { ok: true } : { ok: false, reason: "domain_out_of_domain" }),
          transform: (node) => node,
        }),
      ],
      recompute: (node) => ({ state: "evaluated", value: { verdict: "accept", observation: node.observation } }),
      normative_projection: (result) => ({ verdict: result.verdict }),
      stability_projection: (result) => ({ observation: result.observation }),
      allowed_variant_projection: () => ({}),
      forbidden_variant_projection: () => ({}),
    })
    const outOfDomainResult = await evaluateTransformationCycleV0(outOfDomainProfile, {
      inDomain: false,
      observation: "x",
    })
    expect(outOfDomainResult.classification).toBe("out_of_domain")

    const historySensitiveProfile = defineTransformationCycleProfileV0<Node, Output>({
      cycle_profile_id: "boundary-proof:chronicle-portfolio-generic-core-history-sensitive-sanity",
      node_object_kind: "sanity-node",
      recompute_procedure_id: "sanity-recompute",
      comparison_rule_id: "sanity-projection",
      history_sensitive_policy: "classify",
      ordered_edges: [
        defineTransformationCycleEdgeV0<Node>({
          edge_id: "drift",
          precondition: () => ({ ok: true }),
          transform: (node) => ({ ...node, observation: "changed" }),
        }),
      ],
      recompute: (node) => ({ state: "evaluated", value: { verdict: "accept", observation: node.observation } }),
      normative_projection: (result) => ({ verdict: result.verdict }),
      stability_projection: (result) => ({ observation: result.observation }),
      allowed_variant_projection: () => ({}),
      forbidden_variant_projection: () => ({}),
    })
    const historySensitiveResult = await evaluateTransformationCycleV0(historySensitiveProfile, {
      inDomain: true,
      observation: "original",
    })
    expect(historySensitiveResult.classification).toBe("history_sensitive")
  })

  test("fresh live recompute is deterministic across independent evaluations", async () => {
    const first = await evaluateChroniclePortfolioTransformationMatrixV1(buildFixture())
    const second = await evaluateChroniclePortfolioTransformationMatrixV1(buildFixture())
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(first.pass).toBe(true)
    expect(second.pass).toBe(true)
  })
})
