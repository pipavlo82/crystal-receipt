import { describe, expect, test } from "bun:test"
import {
  defineTransformationCycleEdgeV0,
  defineTransformationCycleProfileV0,
  evaluateTransformationCycleV0,
  TransformationStabilityCycleContractErrorV0,
} from "../../src/receiptos/challenge/transformation-stability-cycle"

type Node = {
  readonly value: number
  readonly observation: string
  readonly telemetry: string
  readonly forbidden: string
  readonly inDomain: boolean
  readonly unresolved?: boolean
}

type Output = {
  readonly verdict: "accept" | "reject"
  readonly observation: string
  readonly telemetry: string
  readonly forbidden: string
}

const edge = (edge_id: string, transform: (node: Node) => Node) =>
  defineTransformationCycleEdgeV0<Node>({
    edge_id,
    precondition: (node) =>
      node.inDomain ? { ok: true } : { ok: false, reason: `${edge_id}_out_of_domain` },
    transform,
  })

function profile(
  edges: ReturnType<typeof edge>[],
  historySensitivePolicy: "classify" | "violation" = "classify",
) {
  return defineTransformationCycleProfileV0<Node, Output>({
    cycle_profile_id: "test-closed-cycle-v0",
    node_object_kind: "test-node",
    recompute_procedure_id: "test-recompute-v0",
    comparison_rule_id: "test-cycle-projection-v0",
    history_sensitive_policy: historySensitivePolicy,
    ordered_edges: edges,
    recompute: (node) =>
      node.unresolved
        ? { state: "unresolved", reason: "worker_timeout" }
        : {
            state: "evaluated",
            value: {
              verdict: node.value >= 0 ? "accept" : "reject",
              observation: node.observation,
              telemetry: node.telemetry,
              forbidden: node.forbidden,
            },
          },
    normative_projection: (result) => ({ verdict: result.verdict }),
    stability_projection: (result) => ({ observation: result.observation }),
    allowed_variant_projection: (result) => ({ telemetry: result.telemetry }),
    forbidden_variant_projection: (result) => ({ forbidden: result.forbidden }),
  })
}

const start: Node = {
  value: 1,
  observation: "canonical",
  telemetry: "pid-a",
  forbidden: "fixed",
  inDomain: true,
}

describe("transformation stability closed cycle v0", () => {
  test("stable closed cycle", async () => {
    const result = await evaluateTransformationCycleV0(
      profile([
        edge("a", (node) => ({ ...node, telemetry: "pid-b" })),
        edge("b", (node) => ({ ...node, telemetry: "pid-a" })),
      ]),
      start,
    )
    expect(result.classification).toBe("stable")
    expect(result.endpoint.normative_match).toBe(true)
  })

  test("endpoint equality cannot erase intermediate normative violation", async () => {
    const result = await evaluateTransformationCycleV0(
      profile([
        edge("flip", (node) => ({ ...node, value: -1 })),
        edge("restore", (node) => ({ ...node, value: 1 })),
      ]),
      start,
    )
    expect(result.classification).toBe("violation")
    expect(result.failed_edge_id).toBe("flip")
    expect(result.failure_reason).toBe("normative_projection_mismatch")
  })

  test("failed applicability is out_of_domain", async () => {
    const result = await evaluateTransformationCycleV0(
      profile([edge("domain", (node) => node)]),
      { ...start, inDomain: false },
    )
    expect(result.classification).toBe("out_of_domain")
  })

  test("duplicate edge IDs rejected before execution", async () => {
    await expect(
      evaluateTransformationCycleV0(
        profile([
          edge("same", (node) => node),
          edge("same", (node) => node),
        ]),
        start,
      ),
    ).rejects.toBeInstanceOf(TransformationStabilityCycleContractErrorV0)
  })
})
