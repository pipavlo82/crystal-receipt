import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  HANDOFF_TRANSFORMATION_CYCLE_VECTORS_V1,
  evaluateHandoffTransformationCycleMatrixV1,
  evaluateHandoffTransformationCycleVectorV1,
} from "../../src/receiptos/challenge/transformation-stability-handoff-cycle"
import {
  defineTransformationCycleEdgeV0,
  defineTransformationCycleProfileV0,
  evaluateTransformationCycleV0,
} from "../../src/receiptos/challenge/transformation-stability-cycle"
import {
  handoffAllowedVariantProjectionV0,
  handoffEvidencePreconditionV0,
  handoffForbiddenVariantProjectionV0,
  handoffNormativeProjectionV0,
  handoffStabilityProjectionV0,
  recomputeHandoffEvidenceV0,
  validateHandoffEvidenceV0,
  type HandoffEvidenceRoundTripObservationV0,
} from "../../src/receiptos/challenge/transformation-stability-handoff-roundtrip"

const root = resolve(import.meta.dir, "../..")
const fixture = validateHandoffEvidenceV0(
  JSON.parse(readFileSync(resolve(root, "src/receiptos/fixtures/session-evidence.sample.json"), "utf8")),
)

describe("handoff transformation stability cycle v1", () => {
  test("candidate inventory is exact", () => {
    expect(HANDOFF_TRANSFORMATION_CYCLE_VECTORS_V1.map((entry) => entry.vector_id)).toEqual([
      "stable_multi_edge_roundtrip_reorder",
      "representation_reorder_stable",
      "session_id_mutation_then_restore",
      "anchor_mutation_then_restore",
      "transform_output_recompute_unresolved",
    ])
  })

  test("matrix reaches required result classes", async () => {
    const result = await evaluateHandoffTransformationCycleMatrixV1(fixture)
    expect(result.vector_count).toBe(5)
    expect(result.pass).toBe(true)
  })

  test("out_of_domain is not a reachable classification for any frozen vector in this profile", () => {
    // Locked as a deliberate profile-domain property, not an accidental gap.
    // See the module-level comment in transformation-stability-handoff-cycle.ts
    // for why, and the empirical proof below for how.
    const classifications = HANDOFF_TRANSFORMATION_CYCLE_VECTORS_V1.map(
      (entry) => entry.expected_classification,
    )
    expect(classifications).not.toContain("out_of_domain")
    expect(new Set(classifications)).toEqual(new Set(["stable", "violation", "unresolved"]))
  })

  test("stable_multi_edge_roundtrip_reorder: both edges complete, endpoint reached, stable", async () => {
    const result = await evaluateHandoffTransformationCycleVectorV1(
      "stable_multi_edge_roundtrip_reorder",
      fixture,
    )
    expect(result.classification).toBe("stable")
    expect(result.failed_edge_id).toBeNull()
    expect(result.ordered_edge_ids).toEqual(["canonical-roundtrip", "reverse-key-order"])
    expect(result.edges.length).toBe(2)
    expect(result.aggregate.completed_edges).toBe(2)
    for (const edge of result.edges) {
      expect(edge.classification).toBe("stable")
      expect(edge.normative_match).toBe(true)
      expect(edge.stability_match).toBe(true)
      expect(edge.forbidden_variant_match).toBe(true)
    }
    // Endpoint is reached (all edges completed) and equals R0.
    expect(result.endpoint.normative_match).toBe(true)
    expect(result.endpoint.stability_match).toBe(true)
    expect(result.endpoint.forbidden_variant_match).toBe(true)
  })

  test("representation_reorder_stable: single edge, stable", async () => {
    const result = await evaluateHandoffTransformationCycleVectorV1("representation_reorder_stable", fixture)
    expect(result.classification).toBe("stable")
    expect(result.aggregate.completed_edges).toBe(1)
    expect(result.endpoint.normative_match).toBe(true)
  })

  test("session_id_mutation_then_restore: violation at first edge, endpoint never reached", async () => {
    const result = await evaluateHandoffTransformationCycleVectorV1(
      "session_id_mutation_then_restore",
      fixture,
    )
    expect(result.classification).toBe("violation")
    expect(result.failed_edge_id).toBe("mutate-session-id")
    expect(result.failure_reason).toBe("normative_projection_mismatch")
    // The restore edge is declared in the profile...
    expect(result.ordered_edge_ids).toEqual(["mutate-session-id", "restore-session-id"])
    // ...but the cycle terminates at the first edge and never executes it.
    expect(result.edges.length).toBe(1)
    expect(result.edges[0]!.edge_id).toBe("mutate-session-id")
    expect(result.aggregate.completed_edges).toBe(0)
    // Endpoint comparison is never reached — the invariant this vector proves.
    expect(result.endpoint.normative_match).toBeNull()
    expect(result.endpoint.forbidden_variant_match).toBeNull()
  })

  test("anchor_mutation_then_restore: violation via forbidden mismatch with normative unchanged", async () => {
    const result = await evaluateHandoffTransformationCycleVectorV1("anchor_mutation_then_restore", fixture)
    expect(result.classification).toBe("violation")
    expect(result.failed_edge_id).toBe("mutate-anchor-contract")
    expect(result.failure_reason).toBe("forbidden_variant_mismatch")
    expect(result.edges.length).toBe(1)
    const edge = result.edges[0]!
    // Root (N) is unaffected by an anchor-only mutation; F is what moves.
    expect(edge.normative_match).toBe(true)
    expect(edge.forbidden_variant_match).toBe(false)
    expect(result.aggregate.completed_edges).toBe(0)
    expect(result.endpoint.normative_match).toBeNull()
  })

  test("transform_output_recompute_unresolved: recompute fails on corrupted edge output", async () => {
    const result = await evaluateHandoffTransformationCycleVectorV1(
      "transform_output_recompute_unresolved",
      fixture,
    )
    expect(result.classification).toBe("unresolved")
    expect(result.failed_edge_id).toBe("corrupt-mid-cycle")
    expect(result.failure_reason).toBe("handoff_evidence_recompute_failed")
    expect(result.aggregate.completed_edges).toBe(0)
    expect(result.edges[0]!.evaluation_state).toBe("execution_unresolved")
  })

  test("out_of_domain is genuinely unreachable: a schema-invalid start state resolves to unresolved, not out_of_domain", async () => {
    // This is a boundary-property proof, not one of the five frozen vectors
    // above — it exists to make the absence of out_of_domain a tested fact
    // rather than an untested gap. Built entirely from already-exported,
    // already-merged primitives (no new precondition, no new schema logic,
    // no generic-core change): handoffEvidencePreconditionV0 and
    // recomputeHandoffEvidenceV0 both gate on HandoffEvidenceSchema, and
    // HandoffEvidenceSchema.parse() calls .validate() internally, so the two
    // functions are provably congruent. evaluateTransformationCycleV0 also
    // recomputes the start node unconditionally before any edge precondition
    // is ever consulted. Combined, a schema-invalid start node is always
    // caught by that initial recompute — classifying unresolved — before any
    // applicability boundary could see it and classify it out_of_domain.
    const invalidStart = structuredClone(fixture) as unknown as Record<string, unknown>
    delete invalidStart.session_id

    const profile = defineTransformationCycleProfileV0<unknown, HandoffEvidenceRoundTripObservationV0>({
      cycle_profile_id: "handoff-cycle-v1:boundary-proof:schema-invalid-start",
      node_object_kind: "stealth.session.evidence.v1",
      recompute_procedure_id: "receiptos.computeReceiptRoot+canonicalize.v0",
      comparison_rule_id: "receipt-root+canonical-envelope+anchor.v0",
      history_sensitive_policy: "violation",
      ordered_edges: [
        defineTransformationCycleEdgeV0<unknown>({
          edge_id: "attempt",
          precondition: handoffEvidencePreconditionV0,
          transform: validateHandoffEvidenceV0,
        }),
      ],
      recompute: recomputeHandoffEvidenceV0,
      normative_projection: handoffNormativeProjectionV0,
      stability_projection: handoffStabilityProjectionV0,
      allowed_variant_projection: handoffAllowedVariantProjectionV0,
      forbidden_variant_projection: handoffForbiddenVariantProjectionV0,
    })

    const result = await evaluateTransformationCycleV0(profile, invalidStart)
    expect(result.classification).toBe("unresolved")
    expect(result.classification).not.toBe("out_of_domain")
    expect(result.evaluation_state).toBe("execution_unresolved")
    // recomputeHandoffEvidenceV0 catches its own parse failure internally
    // and returns this reason directly (it never throws), so the cycle
    // engine's "start_recompute_failed" fallback reason is never reached.
    expect(result.failure_reason).toBe("handoff_evidence_recompute_failed")
    // Zero edges even attempted — the applicability boundary (edge
    // precondition) is never reached at all, not merely "reached and failed".
    expect(result.edges.length).toBe(0)
  })

  test("the generic Transformation Stability cycle core does support out_of_domain (sanity check on the claim above)", async () => {
    // Confirms the absence of out_of_domain in this Handoff profile is a
    // domain property, not evidence that the generic core lost the
    // capability. Mirrors "failed applicability is out_of_domain" in
    // transformation-stability-cycle-v0.test.ts with the synthetic domain,
    // where precondition genuinely is independent of recompute.
    type Node = { readonly inDomain: boolean }
    type Output = { readonly verdict: "accept" }
    const profile = defineTransformationCycleProfileV0<Node, Output>({
      cycle_profile_id: "boundary-proof:generic-core-out-of-domain-sanity",
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
      recompute: () => ({ state: "evaluated", value: { verdict: "accept" } }),
      normative_projection: (result) => result,
      stability_projection: (result) => result,
      allowed_variant_projection: () => ({}),
      forbidden_variant_projection: () => ({}),
    })
    const result = await evaluateTransformationCycleV0(profile, { inDomain: false })
    expect(result.classification).toBe("out_of_domain")
  })
})
