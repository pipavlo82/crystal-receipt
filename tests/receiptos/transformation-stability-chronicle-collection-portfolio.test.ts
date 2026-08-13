import { describe, expect, test } from "bun:test"
import {
  type ChronicleCollectionV0,
  type ChroniclePortfolioV0,
  createChronicleCollectionV0,
  createChroniclePortfolioV0,
  deriveCollectionRefFromChronicleCollection,
  verifyChronicleCollectionV0,
  verifyChroniclePortfolioV0,
} from "../../src/receiptos/capsule/chronicle-portfolio-v0"
import {
  type ChronicleCollectionsPortfolioBundleV0,
  CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_CYCLE_VECTORS_V0,
  CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_VECTORS_V0,
  evaluateChronicleCollectionsPortfolioTransformationCycleVectorV0,
  evaluateChronicleCollectionsPortfolioTransformationMatrixV0,
  evaluateChronicleCollectionsPortfolioTransformationVectorV0,
} from "../../src/receiptos/challenge/transformation-stability-chronicle-collection-portfolio"
import {
  defineTransformationCycleEdgeV0,
  defineTransformationCycleProfileV0,
  evaluateTransformationCycleV0,
} from "../../src/receiptos/challenge/transformation-stability-cycle"

// Chronicle-native fixture only -- no HandoffEvidence. Built via the real
// constructors so the initial claimed roots are genuine and the cross-link
// is genuinely consistent at the start. Two genuinely distinct Collections
// (different collection_id, different artifact_refs) so reorder/set vectors
// are never exercised against a single-element array.
function buildFixture(): ChronicleCollectionsPortfolioBundleV0 {
  const collectionA = createChronicleCollectionV0(
    {
      schema: "chronicle_entry.v0",
      entry_id: "entry-alpha",
      source_system: "ReceiptOS",
      receipt_root: `0x${"a".repeat(64)}`,
      proof_object_ref: "receiptos://portable-proof-object/entry-alpha",
      evidence_capsule_ref: "embedded:entry-alpha:evidence_capsule",
      provenance_summary_ref: "embedded:entry-alpha:provenance_summary",
      created_from: null,
      labels: [],
      notes: null,
    },
    { collectionId: "collection-alpha", artifactRefs: ["entry-alpha-2", "entry-alpha-1"] },
  )
  const collectionB = createChronicleCollectionV0(
    {
      schema: "chronicle_entry.v0",
      entry_id: "entry-beta",
      source_system: "ReceiptOS",
      receipt_root: `0x${"b".repeat(64)}`,
      proof_object_ref: "receiptos://portable-proof-object/entry-beta",
      evidence_capsule_ref: "embedded:entry-beta:evidence_capsule",
      provenance_summary_ref: "embedded:entry-beta:provenance_summary",
      created_from: null,
      labels: [],
      notes: null,
    },
    { collectionId: "collection-beta", artifactRefs: ["entry-beta-1"] },
  )
  const portfolio = createChroniclePortfolioV0([collectionA, collectionB], { portfolioId: "portfolio-1" })
  return { collections: [collectionA, collectionB], portfolio }
}

describe("chronicle cross-object transformation stability v0 (collections -> portfolio)", () => {
  test("fixture is genuinely multi-collection, cross-link-consistent, and every object locally valid before any transform", () => {
    const { collections, portfolio } = buildFixture()
    expect(collections.length).toBe(2)
    expect(collections[0]!.collection_id).not.toBe(collections[1]!.collection_id)
    for (const collection of collections) {
      expect(verifyChronicleCollectionV0(collection).ok).toBe(true)
    }
    expect(verifyChroniclePortfolioV0(portfolio).ok).toBe(true)
    expect([...portfolio.collection_refs].sort()).toEqual(
      collections.map(deriveCollectionRefFromChronicleCollection).sort(),
    )
  })

  test("flat vector inventory is exact and ordered", () => {
    expect(CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_VECTORS_V0.map((v) => v.vector_id)).toEqual([
      "stable_canonical_roundtrip",
      "collections_and_refs_reorder_stable",
      "upstream_collection_mutation_without_portfolio_update",
      "downstream_portfolio_ref_tamper_recomputed",
      "coordinated_collection_and_portfolio_update",
      "missing_portfolio_ref",
      "extra_portfolio_ref",
      "replace_bundled_collection_with_other_valid_collection",
      "duplicate_collection_ref_multiset_mismatch",
      "collection_metadata_forbidden_mutation",
      "portfolio_metadata_forbidden_mutation",
      "collection_schema_literal_mutation",
      "portfolio_schema_literal_mutation",
      "stored_collection_root_tamper",
      "stored_portfolio_root_tamper",
      "empty_collections_out_of_domain",
      "collection_artifact_refs_corrupt_unresolved",
      "portfolio_collection_refs_corrupt_unresolved",
    ])
  })

  test("cycle vector inventory is exact and ordered", () => {
    expect(CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_CYCLE_VECTORS_V0.map((v) => v.vector_id)).toEqual([
      "stable_multi_edge_roundtrip_reorder",
      "cross_link_mutation_then_restore",
      "link_only_mutation_then_restore",
      "invalid_start_out_of_domain",
      "collections_corrupt_unresolved",
    ])
  })

  test("flat matrix reaches the exact required aggregate and passes", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationMatrixV0(buildFixture())
    expect(result.vector_count).toBe(18)
    expect(result.aggregate).toEqual({
      stable: 2,
      history_sensitive: 0,
      unresolved: 2,
      out_of_domain: 1,
      violation: 13,
    })
    expect(result.pass).toBe(true)
  })

  test("stable_canonical_roundtrip: stable, all matches true", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "stable_canonical_roundtrip",
      buildFixture(),
    )
    expect(result.classification).toBe("stable")
    expect(result.normative_match).toBe(true)
    expect(result.stability_match).toBe(true)
    expect(result.forbidden_variant_match).toBe(true)
  })

  test("collections_and_refs_reorder_stable: bundle position, artifact_refs, and collection_refs all reorder but stay stable", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "collections_and_refs_reorder_stable",
      buildFixture(),
    )
    expect(result.classification).toBe("stable")
    expect(result.normative_match).toBe(true)
    expect(result.stability_match).toBe(true)
  })

  test("upstream_collection_mutation_without_portfolio_update: both sides locally valid, cross-link false", async () => {
    const fixture = buildFixture()
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "upstream_collection_mutation_without_portfolio_update",
      fixture,
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)

    // Directly reconstruct the target state to prove both sides verify
    // individually while the cross-link is broken -- the star property
    // this profile exists to catch.
    const mutatedCollection: ChronicleCollectionV0 = {
      ...fixture.collections[0]!,
      collection_id: `${fixture.collections[0]!.collection_id}-mutated`,
    }
    mutatedCollection.collection_root = verifyChronicleCollectionV0(mutatedCollection).recomputed_collection_root
    expect(verifyChronicleCollectionV0(mutatedCollection).ok).toBe(true)
    expect(verifyChronicleCollectionV0(fixture.collections[1]!).ok).toBe(true)
    expect(verifyChroniclePortfolioV0(fixture.portfolio).ok).toBe(true)
    expect(fixture.portfolio.collection_refs).not.toContain(
      deriveCollectionRefFromChronicleCollection(mutatedCollection),
    )
  })

  test("downstream_portfolio_ref_tamper_recomputed: both sides locally valid, cross-link false", async () => {
    const fixture = buildFixture()
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "downstream_portfolio_ref_tamper_recomputed",
      fixture,
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)

    const tamperedRefs = fixture.portfolio.collection_refs.map((ref, index) => (index === 0 ? `${ref}-tampered` : ref))
    const tamperedPortfolio: ChroniclePortfolioV0 = { ...fixture.portfolio, collection_refs: tamperedRefs }
    tamperedPortfolio.portfolio_root = verifyChroniclePortfolioV0(tamperedPortfolio).recomputed_portfolio_root
    for (const collection of fixture.collections) {
      expect(verifyChronicleCollectionV0(collection).ok).toBe(true)
    }
    expect(verifyChroniclePortfolioV0(tamperedPortfolio).ok).toBe(true)
    const derivedRefs = fixture.collections.map(deriveCollectionRefFromChronicleCollection).sort()
    expect([...tamperedPortfolio.collection_refs].sort()).not.toEqual(derivedRefs)
  })

  test("coordinated_collection_and_portfolio_update: cross-link stays true, but roots move -> violation", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "coordinated_collection_and_portfolio_update",
      buildFixture(),
    )
    // Critical design assertion: a coordinated update that keeps the
    // cross-link internally consistent must still classify as violation,
    // because the underlying root identity changed. N must not be
    // weakened to let this pass as stable.
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
  })

  test("missing_portfolio_ref: derived multiset has an extra member the stored set lacks", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "missing_portfolio_ref",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
  })

  test("extra_portfolio_ref: stored multiset has an extra member the derived set lacks", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "extra_portfolio_ref",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
  })

  test("replace_bundled_collection_with_other_valid_collection: replacement is independently valid, cross-link false", async () => {
    const fixture = buildFixture()
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "replace_bundled_collection_with_other_valid_collection",
      fixture,
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
    expect(verifyChroniclePortfolioV0(fixture.portfolio).ok).toBe(true)
  })

  test("duplicate_collection_ref_multiset_mismatch: two locally valid Collections share one ref, Portfolio stores it once", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "duplicate_collection_ref_multiset_mismatch",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
  })

  test("collection_metadata_forbidden_mutation: N unchanged (including cross-link), F mismatch", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "collection_metadata_forbidden_mutation",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(true)
    expect(result.forbidden_variant_match).toBe(false)
  })

  test("portfolio_metadata_forbidden_mutation: N unchanged, F mismatch", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "portfolio_metadata_forbidden_mutation",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(true)
    expect(result.forbidden_variant_match).toBe(false)
  })

  test("collection_schema_literal_mutation: violation via literal schema alone, root unaffected", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "collection_schema_literal_mutation",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
  })

  test("portfolio_schema_literal_mutation: violation via literal schema alone, root unaffected", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "portfolio_schema_literal_mutation",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
  })

  test("stored_collection_root_tamper: violation, portfolio side and cross-link unaffected", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "stored_collection_root_tamper",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
  })

  test("stored_portfolio_root_tamper: violation, collection side unaffected", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "stored_portfolio_root_tamper",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
  })

  test("empty_collections_out_of_domain: real out_of_domain via the portfolio constructor probe", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "empty_collections_out_of_domain",
      buildFixture(),
    )
    expect(result.classification).toBe("out_of_domain")
    expect(result.out_of_domain_reason).toBe("chronicle_collections_portfolio_empty")
    expect(result.normative_match).toBeNull()
  })

  test("collection_artifact_refs_corrupt_unresolved: bounded unresolved, localized to this vector only", async () => {
    const fixture = buildFixture()
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "collection_artifact_refs_corrupt_unresolved",
      fixture,
    )
    expect(result.classification).toBe("unresolved")
    expect(result.unresolved_reason).toBe("chronicle_collections_portfolio_recompute_failed")
    for (const collection of fixture.collections) {
      expect(verifyChronicleCollectionV0(collection).ok).toBe(true)
    }
    expect(verifyChroniclePortfolioV0(fixture.portfolio).ok).toBe(true)
  })

  test("portfolio_collection_refs_corrupt_unresolved: bounded unresolved, localized to this vector only", async () => {
    const fixture = buildFixture()
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "portfolio_collection_refs_corrupt_unresolved",
      fixture,
    )
    expect(result.classification).toBe("unresolved")
    expect(result.unresolved_reason).toBe("chronicle_collections_portfolio_recompute_failed")
    for (const collection of fixture.collections) {
      expect(verifyChronicleCollectionV0(collection).ok).toBe(true)
    }
    expect(verifyChroniclePortfolioV0(fixture.portfolio).ok).toBe(true)
  })

  test("every flat vector's observed result matches its declared expectation exactly", async () => {
    const fixture = buildFixture()
    for (const expected of CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_VECTORS_V0) {
      const observed = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(expected.vector_id, fixture)
      expect(observed.classification).toBe(expected.expected_classification)
      expect(observed.normative_match).toBe(expected.expected_normative_match)
      expect(observed.stability_match).toBe(expected.expected_stability_match)
      expect(observed.forbidden_variant_match).toBe(expected.expected_forbidden_variant_match)
      expect(observed.unresolved_reason).toBe(expected.expected_unresolved_reason)
      expect(observed.out_of_domain_reason).toBe(expected.expected_out_of_domain_reason)
    }
  })

  test("metadata observation is a defensive snapshot: later nested mutation of the source cannot alter an already-produced observation", async () => {
    const fixture = buildFixture()
    const mutable: Record<string, unknown> = { nested: { count: 1 } }
    const bundleWithMetadata: ChronicleCollectionsPortfolioBundleV0 = {
      collections: [{ ...fixture.collections[0]!, metadata: mutable }, fixture.collections[1]!],
      portfolio: fixture.portfolio,
    }
    const result = await evaluateChronicleCollectionsPortfolioTransformationVectorV0(
      "collection_metadata_forbidden_mutation",
      bundleWithMetadata,
    )
    ;(mutable.nested as Record<string, unknown>).count = 999
    expect(result.classification).toBe("violation")
    expect(result.forbidden_variant_match).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Closed cycle
  // -------------------------------------------------------------------------

  test("stable_multi_edge_roundtrip_reorder: 2/2 edges completed, endpoint reached, N/S/F all match", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationCycleVectorV0(
      "stable_multi_edge_roundtrip_reorder",
      buildFixture(),
    )
    expect(result.classification).toBe("stable")
    expect(result.failed_edge_id).toBeNull()
    expect(result.ordered_edge_ids).toEqual(["canonical-roundtrip", "collections-and-refs-reorder"])
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

  test("cross_link_mutation_then_restore: violation at first edge, restore never executed, endpoint not reached", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationCycleVectorV0(
      "cross_link_mutation_then_restore",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.failed_edge_id).toBe("mutate-collection-id-stale-ref")
    expect(result.failure_reason).toBe("normative_projection_mismatch")
    expect(result.ordered_edge_ids).toEqual(["mutate-collection-id-stale-ref", "restore-collection-id-and-ref"])
    expect(result.edges.length).toBe(1)
    expect(result.aggregate.completed_edges).toBe(0)
    expect(result.endpoint.normative_match).toBeNull()
  })

  test("link_only_mutation_then_restore: violation at first edge via a pure downstream-only edit, restore never executed", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationCycleVectorV0(
      "link_only_mutation_then_restore",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.failed_edge_id).toBe("tamper-portfolio-ref-only")
    expect(result.failure_reason).toBe("normative_projection_mismatch")
    expect(result.ordered_edge_ids).toEqual(["tamper-portfolio-ref-only", "restore-portfolio-ref"])
    expect(result.edges.length).toBe(1)
    expect(result.aggregate.completed_edges).toBe(0)
    expect(result.endpoint.normative_match).toBeNull()
  })

  test("invalid_start_out_of_domain: real out_of_domain, zero edges attempted, terminates before transform", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationCycleVectorV0(
      "invalid_start_out_of_domain",
      buildFixture(),
    )
    expect(result.classification).toBe("out_of_domain")
    expect(result.failed_edge_id).toBe("attempt")
    expect(result.failure_reason).toBe("chronicle_collections_portfolio_empty")
    expect(result.aggregate.completed_edges).toBe(0)
    expect(result.edges[0]!.evaluation_state).toBe("not_applicable")
    expect(result.endpoint.normative_match).toBeNull()
  })

  test("collections_corrupt_unresolved: unresolved, zero completed edges, endpoint not reached", async () => {
    const result = await evaluateChronicleCollectionsPortfolioTransformationCycleVectorV0(
      "collections_corrupt_unresolved",
      buildFixture(),
    )
    expect(result.classification).toBe("unresolved")
    expect(result.failed_edge_id).toBe("corrupt-collection-artifact-refs")
    expect(result.failure_reason).toBe("chronicle_collections_portfolio_recompute_failed")
    expect(result.aggregate.completed_edges).toBe(0)
    expect(result.endpoint.normative_match).toBeNull()
  })

  test("every cycle vector's observed result matches its declared expectation exactly", async () => {
    const fixture = buildFixture()
    for (const expected of CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_CYCLE_VECTORS_V0) {
      const observed = await evaluateChronicleCollectionsPortfolioTransformationCycleVectorV0(
        expected.vector_id,
        fixture,
      )
      expect(observed.classification).toBe(expected.expected_classification)
      expect(observed.failed_edge_id).toBe(expected.expected_failed_edge_id)
      expect(observed.failure_reason).toBe(expected.expected_failure_reason)
      expect(observed.aggregate.completed_edges).toBe(expected.expected_completed_edges)
    }
  })

  // -------------------------------------------------------------------------
  // Complete field accounting / reachability boundary
  // -------------------------------------------------------------------------

  test("complete field accounting: every declared field across every bundled Collection, the Portfolio, and the cross-link is protected by N, F, normalized away, or bounded by applicability/recompute failure", () => {
    // Field-by-field ledger, cross-referenced against the actual vector
    // table above rather than merely asserted:
    //   collection.schema           -> N (collection_schema_literal_mutation)
    //   collection.collection_version -> N indirectly, via recomputed_collection_root
    //   collection.collection_id    -> N, via recomputed_collection_root and derived_collection_refs
    //                                   (upstream_collection_mutation_without_portfolio_update,
    //                                   duplicate_collection_ref_multiset_mismatch)
    //   collection.artifact_refs    -> normalized away (collections_and_refs_reorder_stable is stable)
    //   collection.collection_root  -> N, via collection_root_match (stored_collection_root_tamper)
    //   collection.metadata         -> F (collection_metadata_forbidden_mutation)
    //   portfolio.schema            -> N (portfolio_schema_literal_mutation)
    //   portfolio.portfolio_version -> N indirectly, via recomputed_portfolio_root
    //   portfolio.portfolio_id      -> N indirectly, via recomputed_portfolio_root
    //   portfolio.collection_refs   -> N directly (stored_collection_refs, cross_link_match:
    //                                   downstream_portfolio_ref_tamper_recomputed, missing_portfolio_ref,
    //                                   extra_portfolio_ref) and indirectly via recomputed_portfolio_root;
    //                                   order normalized away (collections_and_refs_reorder_stable)
    //   portfolio.portfolio_root    -> N, via portfolio_root_match (stored_portfolio_root_tamper)
    //   portfolio.metadata          -> F (portfolio_metadata_forbidden_mutation)
    //   synthetic bundle.collections position -> normalized away (collections_and_refs_reorder_stable)
    //   bundle cardinality (>= 1 Collection)  -> applicability (empty_collections_out_of_domain)
    // No field is left unaccounted for, and no field maps only to S.
    const flatClassifications = new Set(
      CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_VECTORS_V0.map((v) => v.expected_classification),
    )
    const cycleClassifications = new Set(
      CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_CYCLE_VECTORS_V0.map((v) => v.expected_classification),
    )
    expect(flatClassifications).toEqual(new Set(["stable", "violation", "out_of_domain", "unresolved"]))
    expect(cycleClassifications).toEqual(new Set(["stable", "violation", "out_of_domain", "unresolved"]))
  })

  test("history_sensitive is absent from both inventories", () => {
    const all = [
      ...CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_VECTORS_V0.map((v) => v.expected_classification),
      ...CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_CYCLE_VECTORS_V0.map((v) => v.expected_classification),
    ]
    expect(all).not.toContain("history_sensitive")
  })

  test("the generic Transformation Stability cycle core still supports history_sensitive elsewhere (sanity check)", async () => {
    type Node = { readonly observation: string }
    type Output = { readonly verdict: "accept"; readonly observation: string }

    const profile = defineTransformationCycleProfileV0<Node, Output>({
      cycle_profile_id: "boundary-proof:chronicle-collections-portfolio-generic-core-history-sensitive-sanity",
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
    const result = await evaluateTransformationCycleV0(profile, { observation: "original" })
    expect(result.classification).toBe("history_sensitive")
  })

  test("fresh live recompute is deterministic across independent evaluations", async () => {
    const first = await evaluateChronicleCollectionsPortfolioTransformationMatrixV0(buildFixture())
    const second = await evaluateChronicleCollectionsPortfolioTransformationMatrixV0(buildFixture())
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(first.pass).toBe(true)
  })
})
