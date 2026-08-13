import { describe, expect, test } from "bun:test"
import {
  type ChronicleCheckpointV0,
  computeChronicleCheckpointRoot,
  createChronicleCheckpointV0,
  verifyChronicleCheckpointV0,
} from "../../src/receiptos/capsule/chronicle-portfolio-v0"
import {
  CHRONICLE_CHECKPOINT_TRANSFORMATION_CYCLE_VECTORS_V1,
  CHRONICLE_CHECKPOINT_TRANSFORMATION_VECTORS_V1,
  evaluateChronicleCheckpointTransformationCycleVectorV1,
  evaluateChronicleCheckpointTransformationMatrixV1,
  evaluateChronicleCheckpointTransformationVectorV1,
} from "../../src/receiptos/challenge/transformation-stability-chronicle-checkpoint"
import {
  defineTransformationCycleEdgeV0,
  defineTransformationCycleProfileV0,
  evaluateTransformationCycleV0,
} from "../../src/receiptos/challenge/transformation-stability-cycle"

// Chronicle-native fixture only — no HandoffEvidence, no Portfolio profile
// import. Built via createChronicleCheckpointV0 directly so the initial
// claimed root is genuine, not hand-computed, and so the shape validator has
// already accepted it once.
function buildFixture(): ChronicleCheckpointV0 {
  return createChronicleCheckpointV0({
    checkpointId: "checkpoint-1",
    collectionRef: "/collection/collection-a",
    entryRefs: ["entry-b", "entry-a"],
    prevCheckpoint: "checkpoint-0",
    sequence: 1,
  })
}

describe("chronicle checkpoint transformation stability v1", () => {
  test("fixture is genuinely multi-element, canonically ordered, and root-valid before any transform", () => {
    const fixture = buildFixture()
    expect(fixture.entry_refs).toEqual(["entry-a", "entry-b"])
    expect(verifyChronicleCheckpointV0(fixture).ok).toBe(true)
  })

  test("flat vector inventory is exact and ordered", () => {
    expect(CHRONICLE_CHECKPOINT_TRANSFORMATION_VECTORS_V1.map((v) => v.vector_id)).toEqual([
      "stable_canonical_roundtrip",
      "checkpoint_id_normative_mutation",
      "entry_refs_reorder_noncanonical",
      "stored_checkpoint_root_tamper",
      "invalid_genesis_out_of_domain",
      "invalid_continuation_out_of_domain",
      "entry_refs_recompute_unresolved",
    ])
  })

  test("cycle vector inventory is exact and ordered", () => {
    expect(CHRONICLE_CHECKPOINT_TRANSFORMATION_CYCLE_VECTORS_V1.map((v) => v.vector_id)).toEqual([
      "stable_multi_edge_roundtrip_reorder",
      "checkpoint_id_mutation_then_restore",
      "invalid_start_out_of_domain",
      "entry_refs_corrupt_unresolved",
    ])
  })

  test("flat matrix reaches the exact required aggregate and passes", async () => {
    const result = await evaluateChronicleCheckpointTransformationMatrixV1(buildFixture())
    expect(result.vector_count).toBe(7)
    expect(result.aggregate).toEqual({
      stable: 1,
      history_sensitive: 0,
      unresolved: 1,
      out_of_domain: 2,
      violation: 3,
    })
    expect(result.pass).toBe(true)
  })

  test("stable_canonical_roundtrip: stable, all matches true", async () => {
    const result = await evaluateChronicleCheckpointTransformationVectorV1(
      "stable_canonical_roundtrip",
      buildFixture(),
    )
    expect(result.classification).toBe("stable")
    expect(result.normative_match).toBe(true)
    expect(result.stability_match).toBe(true)
    expect(result.forbidden_variant_match).toBe(true)
  })

  test("checkpoint_id_normative_mutation: violation, recomputed root moves", async () => {
    const result = await evaluateChronicleCheckpointTransformationVectorV1(
      "checkpoint_id_normative_mutation",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
  })

  test("entry_refs_reorder_noncanonical: violation according to actual verifier semantics, not stable", async () => {
    // Confirms the object's own recompute is stored-order-sensitive: raw
    // reorder is caught as a normative mismatch, not silently normalized.
    const result = await evaluateChronicleCheckpointTransformationVectorV1(
      "entry_refs_reorder_noncanonical",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
  })

  test("stored_checkpoint_root_tamper: violation, only claimed root moves", async () => {
    const result = await evaluateChronicleCheckpointTransformationVectorV1(
      "stored_checkpoint_root_tamper",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
  })

  test("invalid_genesis_out_of_domain: real out_of_domain via the shape validator adapter", async () => {
    const result = await evaluateChronicleCheckpointTransformationVectorV1(
      "invalid_genesis_out_of_domain",
      buildFixture(),
    )
    expect(result.classification).toBe("out_of_domain")
    expect(result.out_of_domain_reason).toBe("chronicle_checkpoint_shape_invalid")
    expect(result.normative_match).toBeNull()
  })

  test("invalid_continuation_out_of_domain: real out_of_domain via the shape validator adapter", async () => {
    const result = await evaluateChronicleCheckpointTransformationVectorV1(
      "invalid_continuation_out_of_domain",
      buildFixture(),
    )
    expect(result.classification).toBe("out_of_domain")
    expect(result.out_of_domain_reason).toBe("chronicle_checkpoint_shape_invalid")
  })

  test("entry_refs_recompute_unresolved: bounded unresolved, localized to this vector only", async () => {
    const fixture = buildFixture()
    const result = await evaluateChronicleCheckpointTransformationVectorV1(
      "entry_refs_recompute_unresolved",
      fixture,
    )
    expect(result.classification).toBe("unresolved")
    expect(result.unresolved_reason).toBe("chronicle_checkpoint_recompute_failed")
    expect(verifyChronicleCheckpointV0(fixture).ok).toBe(true)
  })

  test("every flat vector's observed result matches its declared expectation exactly", async () => {
    const fixture = buildFixture()
    for (const expected of CHRONICLE_CHECKPOINT_TRANSFORMATION_VECTORS_V1) {
      const observed = await evaluateChronicleCheckpointTransformationVectorV1(expected.vector_id, fixture)
      expect(observed.classification).toBe(expected.expected_classification)
      expect(observed.normative_match).toBe(expected.expected_normative_match)
      expect(observed.stability_match).toBe(expected.expected_stability_match)
      expect(observed.forbidden_variant_match).toBe(expected.expected_forbidden_variant_match)
      expect(observed.unresolved_reason).toBe(expected.expected_unresolved_reason)
      expect(observed.out_of_domain_reason).toBe(expected.expected_out_of_domain_reason)
    }
  })

  test("applicability (shape) is independent of recompute (root): a shape-invalid but root-consistent node still recomputes cleanly", () => {
    // Direct evidence for the module's core structural claim, checked
    // against the real committed functions, not merely asserted. The
    // checkpoint_root is freshly recomputed for the shape-invalid field
    // combination so this genuinely isolates "shape invalid" from "root
    // stale" — a node can be root-consistent (ok=true) while still being
    // shape-invalid, because verifyChronicleCheckpointV0 never calls
    // validateChronicleCheckpointShape.
    const fixture = buildFixture()
    const shapeInvalidFields = {
      ...fixture,
      sequence: 0,
      prev_checkpoint: `${fixture.checkpoint_id}-prior`,
    }
    const shapeInvalidButRootConsistent: ChronicleCheckpointV0 = {
      ...shapeInvalidFields,
      checkpoint_root: computeChronicleCheckpointRoot(shapeInvalidFields),
    }
    expect(verifyChronicleCheckpointV0(shapeInvalidButRootConsistent).ok).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Closed cycle
  // -------------------------------------------------------------------------

  test("stable_multi_edge_roundtrip_reorder: 2/2 edges completed, endpoint reached, N/S/F all match", async () => {
    const result = await evaluateChronicleCheckpointTransformationCycleVectorV1(
      "stable_multi_edge_roundtrip_reorder",
      buildFixture(),
    )
    expect(result.classification).toBe("stable")
    expect(result.failed_edge_id).toBeNull()
    expect(result.ordered_edge_ids).toEqual(["canonical-roundtrip", "canonical-order-reapply"])
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

  test("checkpoint_id_mutation_then_restore: violation at first edge, restore never executed, endpoint not reached", async () => {
    const result = await evaluateChronicleCheckpointTransformationCycleVectorV1(
      "checkpoint_id_mutation_then_restore",
      buildFixture(),
    )
    expect(result.classification).toBe("violation")
    expect(result.failed_edge_id).toBe("mutate-checkpoint-id")
    expect(result.failure_reason).toBe("normative_projection_mismatch")
    expect(result.ordered_edge_ids).toEqual(["mutate-checkpoint-id", "restore-checkpoint-id"])
    expect(result.edges.length).toBe(1)
    expect(result.aggregate.completed_edges).toBe(0)
    expect(result.endpoint.normative_match).toBeNull()
  })

  test("invalid_start_out_of_domain: real out_of_domain, zero edges attempted", async () => {
    const result = await evaluateChronicleCheckpointTransformationCycleVectorV1(
      "invalid_start_out_of_domain",
      buildFixture(),
    )
    expect(result.classification).toBe("out_of_domain")
    expect(result.failed_edge_id).toBe("attempt")
    expect(result.failure_reason).toBe("chronicle_checkpoint_shape_invalid")
    expect(result.aggregate.completed_edges).toBe(0)
    expect(result.edges.length).toBe(1)
    expect(result.edges[0]!.evaluation_state).toBe("not_applicable")
    expect(result.endpoint.normative_match).toBeNull()
  })

  test("entry_refs_corrupt_unresolved: unresolved, zero completed edges, endpoint not reached", async () => {
    const result = await evaluateChronicleCheckpointTransformationCycleVectorV1(
      "entry_refs_corrupt_unresolved",
      buildFixture(),
    )
    expect(result.classification).toBe("unresolved")
    expect(result.failed_edge_id).toBe("corrupt-entry-refs")
    expect(result.failure_reason).toBe("chronicle_checkpoint_recompute_failed")
    expect(result.aggregate.completed_edges).toBe(0)
    expect(result.endpoint.normative_match).toBeNull()
  })

  test("every cycle vector's observed result matches its declared expectation exactly", async () => {
    const fixture = buildFixture()
    for (const expected of CHRONICLE_CHECKPOINT_TRANSFORMATION_CYCLE_VECTORS_V1) {
      const observed = await evaluateChronicleCheckpointTransformationCycleVectorV1(expected.vector_id, fixture)
      expect(observed.classification).toBe(expected.expected_classification)
      expect(observed.failed_edge_id).toBe(expected.expected_failed_edge_id)
      expect(observed.failure_reason).toBe(expected.expected_failure_reason)
      expect(observed.aggregate.completed_edges).toBe(expected.expected_completed_edges)
    }
  })

  // -------------------------------------------------------------------------
  // Reachability boundary
  // -------------------------------------------------------------------------

  test("reachable classification set is {stable, violation, unresolved, out_of_domain} — genuinely including out_of_domain this time", () => {
    const flat = new Set(CHRONICLE_CHECKPOINT_TRANSFORMATION_VECTORS_V1.map((v) => v.expected_classification))
    const cycle = new Set(CHRONICLE_CHECKPOINT_TRANSFORMATION_CYCLE_VECTORS_V1.map((v) => v.expected_classification))
    expect(flat).toEqual(new Set(["stable", "violation", "out_of_domain", "unresolved"]))
    expect(cycle).toEqual(new Set(["stable", "violation", "out_of_domain", "unresolved"]))
  })

  test("history_sensitive is absent from both inventories — no F-only surface exists on this object", () => {
    const all = [
      ...CHRONICLE_CHECKPOINT_TRANSFORMATION_VECTORS_V1.map((v) => v.expected_classification),
      ...CHRONICLE_CHECKPOINT_TRANSFORMATION_CYCLE_VECTORS_V1.map((v) => v.expected_classification),
    ]
    expect(all).not.toContain("history_sensitive")
  })

  test("the generic Transformation Stability cycle core still supports history_sensitive elsewhere (sanity check)", async () => {
    // Confirms the absence above is a ChronicleCheckpointV0 profile-domain
    // property (no field maps to F, so F-only drift cannot occur), not a
    // lost generic-core capability.
    type Node = { readonly observation: string }
    type Output = { readonly verdict: "accept"; readonly observation: string }

    const profile = defineTransformationCycleProfileV0<Node, Output>({
      cycle_profile_id: "boundary-proof:chronicle-checkpoint-generic-core-history-sensitive-sanity",
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
    const first = await evaluateChronicleCheckpointTransformationMatrixV1(buildFixture())
    const second = await evaluateChronicleCheckpointTransformationMatrixV1(buildFixture())
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(first.pass).toBe(true)
  })
})
