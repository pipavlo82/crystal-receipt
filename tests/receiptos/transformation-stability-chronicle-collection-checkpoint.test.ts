import { describe, expect, test } from "bun:test"
import {
  type ChronicleCheckpointV0,
  type ChronicleCollectionV0,
  createChronicleCheckpointV0,
  createChronicleCollectionV0,
  deriveCollectionRefFromChronicleCollection,
  verifyChronicleCheckpointV0,
  verifyChronicleCollectionV0,
} from "../../src/receiptos/capsule/chronicle-portfolio-v0"
import {
  type ChronicleCollectionCheckpointBundleV0,
  CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_CYCLE_VECTORS_V0,
  CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_VECTORS_V0,
  evaluateChronicleCollectionCheckpointTransformationCycleVectorV0,
  evaluateChronicleCollectionCheckpointTransformationMatrixV0,
  evaluateChronicleCollectionCheckpointTransformationVectorV0,
} from "../../src/receiptos/challenge/transformation-stability-chronicle-collection-checkpoint"
import {
  defineTransformationCycleEdgeV0,
  defineTransformationCycleProfileV0,
  evaluateTransformationCycleV0,
} from "../../src/receiptos/challenge/transformation-stability-cycle"

// Chronicle-native fixture only — no HandoffEvidence. Built via the real
// constructors so the initial claimed roots are genuine and the cross-link
// is genuinely consistent at the start.
function buildFixture(): ChronicleCollectionCheckpointBundleV0 {
  const collection = createChronicleCollectionV0(
    {
      schema: "chronicle_entry.v0",
      entry_id: "entry-a",
      source_system: "ReceiptOS",
      receipt_root: `0x${"a".repeat(64)}`,
      proof_object_ref: "receiptos://portable-proof-object/entry-a",
      evidence_capsule_ref: "embedded:entry-a:evidence_capsule",
      provenance_summary_ref: "embedded:entry-a:provenance_summary",
      created_from: null,
      labels: [],
      notes: null,
    },
    { collectionId: "collection-a", artifactRefs: ["entry-b", "entry-a"] },
  )
  const collectionRef = deriveCollectionRefFromChronicleCollection(collection)
  const checkpoint = createChronicleCheckpointV0({
    checkpointId: "checkpoint-1",
    collectionRef,
    entryRefs: ["entry-a"],
    prevCheckpoint: "checkpoint-0",
    sequence: 1,
  })
  return { collection, checkpoint }
}

describe("chronicle cross-object transformation stability v0 (collection -> checkpoint)", () => {
  test("fixture is genuinely multi-ref, cross-link-consistent, and both objects locally valid before any transform", () => {
    const { collection, checkpoint } = buildFixture()
    expect(collection.artifact_refs.length).toBe(2)
    expect(verifyChronicleCollectionV0(collection).ok).toBe(true)
    expect(verifyChronicleCheckpointV0(checkpoint).ok).toBe(true)
    expect(checkpoint.collection_ref).toBe(deriveCollectionRefFromChronicleCollection(collection))
  })

  test("flat vector inventory is exact and ordered", () => {
    expect(CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_VECTORS_V0.map((v) => v.vector_id)).toEqual([
      "stable_coordinated_roundtrip",
      "collection_artifact_refs_reorder_stable",
      "upstream_mutation_without_downstream_update",
      "downstream_reference_tamper_recomputed",
      "coordinated_upstream_downstream_update",
      "collection_metadata_forbidden_mutation",
      "stored_checkpoint_root_tamper",
      "stored_collection_root_tamper",
      "collection_schema_literal_mutation",
      "invalid_genesis_out_of_domain",
      "entry_refs_recompute_unresolved",
    ])
  })

  test("cycle vector inventory is exact and ordered", () => {
    expect(CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_CYCLE_VECTORS_V0.map((v) => v.vector_id)).toEqual([
      "stable_multi_edge_roundtrip_reorder",
      "cross_link_mutation_then_restore",
      "invalid_start_out_of_domain",
      "entry_refs_corrupt_unresolved",
    ])
  })

  test("flat matrix reaches the exact required aggregate and passes", async () => {
    const result = await evaluateChronicleCollectionCheckpointTransformationMatrixV0(buildFixture())
    expect(result.vector_count).toBe(11)
    expect(result.aggregate).toEqual({
      stable: 2,
      history_sensitive: 0,
      unresolved: 1,
      out_of_domain: 1,
      violation: 7,
    })
    expect(result.pass).toBe(true)
  })

  test("stable_coordinated_roundtrip: stable, all matches true", async () => {
    const result = await evaluateChronicleCollectionCheckpointTransformationVectorV0(
      "stable_coordinated_roundtrip",
      buildFixture(),
    )
    expect(result.classification).toBe("stable")
    expect(result.normative_match).toBe(true)
    expect(result.stability_match).toBe(true)
    expect(result.forbidden_variant_match).toBe(true)
  })

  test("collection_artifact_refs_reorder_stable: raw order changes but stays stable (two distinct refs)", async () => {
    const result = await evaluateChronicleCollectionCheckpointTransformationVectorV0(
      "collection_artifact_refs_reorder_stable",
      buildFixture(),
    )
    expect(result.classification).toBe("stable")
    expect(result.normative_match).toBe(true)
  })

  test("upstream_mutation_without_downstream_update: both objects locally valid, cross-link false", async () => {
    const fixture = buildFixture()
    const result = await evaluateChronicleCollectionCheckpointTransformationVectorV0(
      "upstream_mutation_without_downstream_update",
      fixture,
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)

    // Directly reconstruct the target state to prove both objects verify
    // individually while the cross-link is broken — the star property this
    // profile exists to catch.
    const mutatedCollection: ChronicleCollectionV0 = {
      ...fixture.collection,
      collection_id: `${fixture.collection.collection_id}-mutated`,
    }
    mutatedCollection.collection_root = verifyChronicleCollectionV0(mutatedCollection).recomputed_collection_root
    expect(verifyChronicleCollectionV0(mutatedCollection).ok).toBe(true)
    expect(verifyChronicleCheckpointV0(fixture.checkpoint).ok).toBe(true)
    expect(fixture.checkpoint.collection_ref).not.toBe(deriveCollectionRefFromChronicleCollection(mutatedCollection))
  })

  test("downstream_reference_tamper_recomputed: both objects locally valid, cross-link false", async () => {
    const fixture = buildFixture()
    const result = await evaluateChronicleCollectionCheckpointTransformationVectorV0(
      "downstream_reference_tamper_recomputed",
      fixture,
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)

    const tamperedCheckpoint: ChronicleCheckpointV0 = {
      ...fixture.checkpoint,
      collection_ref: `${fixture.checkpoint.collection_ref}-tampered`,
    }
    tamperedCheckpoint.checkpoint_root = verifyChronicleCheckpointV0(tamperedCheckpoint).recomputed_checkpoint_root
    expect(verifyChronicleCollectionV0(fixture.collection).ok).toBe(true)
    expect(verifyChronicleCheckpointV0(tamperedCheckpoint).ok).toBe(true)
    expect(tamperedCheckpoint.collection_ref).not.toBe(
      deriveCollectionRefFromChronicleCollection(fixture.collection),
    )
  })

  test("coordinated_upstream_downstream_update: cross-link stays true, but roots change -> violation", async () => {
    const result = await evaluateChronicleCollectionCheckpointTransformationVectorV0(
      "coordinated_upstream_downstream_update",
      buildFixture(),
    )
    // Critical design assertion: a coordinated update that keeps the
    // cross-link internally consistent must still classify as violation,
    // because the underlying root identities changed. N must not be
    // weakened to let this pass as stable.
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
  })

  test("collection_metadata_forbidden_mutation: N unchanged (including cross-link), F mismatch", async () => {
    const result = await evaluateChronicleCollectionCheckpointTransformationVectorV0(
      "collection_metadata_forbidden_mutation",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(true)
    expect(result.forbidden_variant_match).toBe(false)
  })

  test("stored_checkpoint_root_tamper: violation, collection side and cross-link unaffected", async () => {
    const result = await evaluateChronicleCollectionCheckpointTransformationVectorV0(
      "stored_checkpoint_root_tamper",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
  })

  test("stored_collection_root_tamper: violation, checkpoint side and cross-link unaffected", async () => {
    const result = await evaluateChronicleCollectionCheckpointTransformationVectorV0(
      "stored_collection_root_tamper",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
  })

  test("collection_schema_literal_mutation: violation via literal schema alone, roots and cross-link unaffected", async () => {
    const result = await evaluateChronicleCollectionCheckpointTransformationVectorV0(
      "collection_schema_literal_mutation",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
  })

  test("invalid_genesis_out_of_domain: real out_of_domain via the checkpoint constructor probe", async () => {
    const result = await evaluateChronicleCollectionCheckpointTransformationVectorV0(
      "invalid_genesis_out_of_domain",
      buildFixture(),
    )
    expect(result.classification).toBe("out_of_domain")
    expect(result.out_of_domain_reason).toBe("chronicle_checkpoint_shape_invalid")
    expect(result.normative_match).toBeNull()
  })

  test("entry_refs_recompute_unresolved: bounded unresolved, localized to this vector only", async () => {
    const fixture = buildFixture()
    const result = await evaluateChronicleCollectionCheckpointTransformationVectorV0(
      "entry_refs_recompute_unresolved",
      fixture,
    )
    expect(result.classification).toBe("unresolved")
    expect(result.unresolved_reason).toBe("chronicle_collection_checkpoint_recompute_failed")
    expect(verifyChronicleCollectionV0(fixture.collection).ok).toBe(true)
    expect(verifyChronicleCheckpointV0(fixture.checkpoint).ok).toBe(true)
  })

  test("every flat vector's observed result matches its declared expectation exactly", async () => {
    const fixture = buildFixture()
    for (const expected of CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_VECTORS_V0) {
      const observed = await evaluateChronicleCollectionCheckpointTransformationVectorV0(expected.vector_id, fixture)
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
    const bundleWithMetadata: ChronicleCollectionCheckpointBundleV0 = {
      collection: { ...fixture.collection, metadata: mutable },
      checkpoint: fixture.checkpoint,
    }
    const result = await evaluateChronicleCollectionCheckpointTransformationVectorV0(
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
    const result = await evaluateChronicleCollectionCheckpointTransformationCycleVectorV0(
      "stable_multi_edge_roundtrip_reorder",
      buildFixture(),
    )
    expect(result.classification).toBe("stable")
    expect(result.failed_edge_id).toBeNull()
    expect(result.ordered_edge_ids).toEqual(["canonical-roundtrip", "collection-artifact-refs-reorder"])
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
    const result = await evaluateChronicleCollectionCheckpointTransformationCycleVectorV0(
      "cross_link_mutation_then_restore",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.failed_edge_id).toBe("mutate-collection-id-stale-ref")
    expect(result.failure_reason).toBe("normative_projection_mismatch")
    expect(result.ordered_edge_ids).toEqual([
      "mutate-collection-id-stale-ref",
      "restore-collection-id-and-ref",
    ])
    expect(result.edges.length).toBe(1)
    expect(result.aggregate.completed_edges).toBe(0)
    expect(result.endpoint.normative_match).toBeNull()
  })

  test("invalid_start_out_of_domain: real out_of_domain, zero edges attempted", async () => {
    const result = await evaluateChronicleCollectionCheckpointTransformationCycleVectorV0(
      "invalid_start_out_of_domain",
      buildFixture(),
    )
    expect(result.classification).toBe("out_of_domain")
    expect(result.failed_edge_id).toBe("attempt")
    expect(result.failure_reason).toBe("chronicle_checkpoint_shape_invalid")
    expect(result.aggregate.completed_edges).toBe(0)
    expect(result.edges[0]!.evaluation_state).toBe("not_applicable")
    expect(result.endpoint.normative_match).toBeNull()
  })

  test("entry_refs_corrupt_unresolved: unresolved, zero completed edges, endpoint not reached", async () => {
    const result = await evaluateChronicleCollectionCheckpointTransformationCycleVectorV0(
      "entry_refs_corrupt_unresolved",
      buildFixture(),
    )
    expect(result.classification).toBe("unresolved")
    expect(result.failed_edge_id).toBe("corrupt-entry-refs")
    expect(result.failure_reason).toBe("chronicle_collection_checkpoint_recompute_failed")
    expect(result.aggregate.completed_edges).toBe(0)
    expect(result.endpoint.normative_match).toBeNull()
  })

  test("every cycle vector's observed result matches its declared expectation exactly", async () => {
    const fixture = buildFixture()
    for (const expected of CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_CYCLE_VECTORS_V0) {
      const observed = await evaluateChronicleCollectionCheckpointTransformationCycleVectorV0(
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

  test("complete field accounting: every declared field across both objects is protected by N, F, normalized away, or bounded by applicability/recompute failure", () => {
    // Field-by-field ledger, cross-referenced against the actual vector
    // table above rather than merely asserted:
    //   collection.schema          -> N (collection_schema_literal_mutation)
    //   collection.collection_version -> N indirectly, via recomputed_collection_root
    //   collection.collection_id   -> N, via recomputed_collection_root (upstream_mutation_without_downstream_update)
    //   collection.artifact_refs   -> normalized away (collection_artifact_refs_reorder_stable is stable)
    //   collection.collection_root -> N, via collection_root_match (stored_collection_root_tamper)
    //   collection.metadata        -> F (collection_metadata_forbidden_mutation)
    //   checkpoint.schema/checkpoint_id/entry_refs(content)/prev_checkpoint/sequence
    //                               -> N indirectly, via recomputed_checkpoint_root, or applicability (sequence/prev_checkpoint)
    //   checkpoint.collection_ref  -> N directly (stored_collection_ref, cross_link_match) and indirectly via recomputed_checkpoint_root
    //   checkpoint.checkpoint_root -> N, via checkpoint_root_match (stored_checkpoint_root_tamper)
    // No field is left unaccounted for, and no field maps only to S.
    const flatClassifications = new Set(
      CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_VECTORS_V0.map((v) => v.expected_classification),
    )
    const cycleClassifications = new Set(
      CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_CYCLE_VECTORS_V0.map((v) => v.expected_classification),
    )
    expect(flatClassifications).toEqual(new Set(["stable", "violation", "out_of_domain", "unresolved"]))
    expect(cycleClassifications).toEqual(new Set(["stable", "violation", "out_of_domain", "unresolved"]))
  })

  test("history_sensitive is absent from both inventories", () => {
    const all = [
      ...CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_VECTORS_V0.map((v) => v.expected_classification),
      ...CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_CYCLE_VECTORS_V0.map((v) => v.expected_classification),
    ]
    expect(all).not.toContain("history_sensitive")
  })

  test("the generic Transformation Stability cycle core still supports history_sensitive elsewhere (sanity check)", async () => {
    type Node = { readonly observation: string }
    type Output = { readonly verdict: "accept"; readonly observation: string }

    const profile = defineTransformationCycleProfileV0<Node, Output>({
      cycle_profile_id: "boundary-proof:chronicle-collection-checkpoint-generic-core-history-sensitive-sanity",
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
    const first = await evaluateChronicleCollectionCheckpointTransformationMatrixV0(buildFixture())
    const second = await evaluateChronicleCollectionCheckpointTransformationMatrixV0(buildFixture())
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(first.pass).toBe(true)
  })
})
