/**
 * ReceiptOS Transformation Stability v0 — closed transformation cycles.
 *
 * A closed cycle is an authenticated ordered sequence of admissible
 * transformations over a common node domain:
 *
 *   R0 --T1--> R1 --T2--> ... --Tn--> Rn
 *
 * v0 requires edgewise normative preservation and then independently checks
 * endpoint closure. Byte equality of R0 and Rn is neither required nor implied.
 */

import { canonicalIdentityJson } from "./canonical-identity-json"
import type {
  HistorySensitivePolicyV0,
  RecomputeOutcomeV0,
  TransformationPreconditionResultV0,
} from "./transformation-stability"

export const TRANSFORMATION_STABILITY_CYCLE_RESULT_SCHEMA_V0 =
  "receiptos.transformation_stability_cycle_result.v0" as const

export const TRANSFORMATION_STABILITY_CYCLE_CLAIM_V0 =
  "edgewise_normative_preservation_closed_cycle" as const

export type TransformationCycleClassificationV0 =
  | "stable"
  | "history_sensitive"
  | "unresolved"
  | "out_of_domain"
  | "violation"

export type TransformationCycleEvaluationStateV0 =
  | "evaluated"
  | "execution_unresolved"
  | "not_applicable"

export type AuthenticatedTransformationCycleEdgeV0<TNode> = {
  readonly __brand: "AuthenticatedTransformationCycleEdgeV0"
  readonly edge_id: string
  readonly precondition: (node: TNode) => TransformationPreconditionResultV0
  readonly transform: (node: TNode) => TNode | Promise<TNode>
}

export type AuthenticatedTransformationCycleProfileV0<TNode, TResult> = {
  readonly __brand: "AuthenticatedTransformationCycleProfileV0"
  readonly transformation_claim: typeof TRANSFORMATION_STABILITY_CYCLE_CLAIM_V0
  readonly cycle_profile_id: string
  readonly node_object_kind: string
  readonly recompute_procedure_id: string
  readonly comparison_rule_id: string
  readonly history_sensitive_policy: HistorySensitivePolicyV0
  readonly ordered_edges: readonly AuthenticatedTransformationCycleEdgeV0<TNode>[]
  readonly recompute: (
    node: TNode,
  ) => RecomputeOutcomeV0<TResult> | Promise<RecomputeOutcomeV0<TResult>>
  readonly normative_projection: (result: TResult) => unknown
  readonly stability_projection: (result: TResult) => unknown
  readonly allowed_variant_projection: (result: TResult) => unknown
  readonly forbidden_variant_projection: (result: TResult) => unknown
}

export type TransformationCycleEdgeResultV0 = {
  readonly edge_id: string
  readonly edge_index: number
  readonly evaluation_state: TransformationCycleEvaluationStateV0
  readonly classification: TransformationCycleClassificationV0
  readonly reason: string | null
  readonly normative_match: boolean | null
  readonly stability_match: boolean | null
  readonly forbidden_variant_match: boolean | null
  readonly allowed_variant_changed: boolean | null
}

export type TransformationCycleEndpointResultV0 = {
  readonly normative_match: boolean | null
  readonly stability_match: boolean | null
  readonly forbidden_variant_match: boolean | null
  readonly allowed_variant_changed: boolean | null
}

export type TransformationCycleAggregateV0 = {
  readonly edge_count: number
  readonly completed_edges: number
  readonly stable: number
  readonly history_sensitive: number
  readonly unresolved: number
  readonly out_of_domain: number
  readonly violation: number
}

export type TransformationStabilityCycleResultV0 = {
  readonly schema: typeof TRANSFORMATION_STABILITY_CYCLE_RESULT_SCHEMA_V0
  readonly transformation_claim: typeof TRANSFORMATION_STABILITY_CYCLE_CLAIM_V0
  readonly cycle_profile_id: string
  readonly node_object_kind: string
  readonly recompute_procedure_id: string
  readonly comparison_rule_id: string
  readonly ordered_edge_ids: readonly string[]
  readonly evaluation_state: TransformationCycleEvaluationStateV0
  readonly classification: TransformationCycleClassificationV0
  readonly failed_edge_id: string | null
  readonly failure_reason: string | null
  readonly aggregate: TransformationCycleAggregateV0
  readonly edges: readonly TransformationCycleEdgeResultV0[]
  readonly endpoint: TransformationCycleEndpointResultV0
}

export class TransformationStabilityCycleContractErrorV0 extends Error {
  readonly code = "transformation_stability_cycle_contract_error_v0" as const
  readonly reason: string

  constructor(reason: string) {
    super("transformation stability cycle contract v0 failed")
    this.name = "TransformationStabilityCycleContractErrorV0"
    this.reason = reason
  }
}

type ProjectionComparison = {
  readonly normative_match: boolean
  readonly stability_match: boolean
  readonly forbidden_variant_match: boolean
  readonly allowed_variant_changed: boolean
}

function projectionEqual(left: unknown, right: unknown): boolean {
  return canonicalIdentityJson(left) === canonicalIdentityJson(right)
}

function compareProjections<TNode, TResult>(
  profile: AuthenticatedTransformationCycleProfileV0<TNode, TResult>,
  left: TResult,
  right: TResult,
): ProjectionComparison {
  return {
    normative_match: projectionEqual(
      profile.normative_projection(left),
      profile.normative_projection(right),
    ),
    stability_match: projectionEqual(
      profile.stability_projection(left),
      profile.stability_projection(right),
    ),
    forbidden_variant_match: projectionEqual(
      profile.forbidden_variant_projection(left),
      profile.forbidden_variant_projection(right),
    ),
    allowed_variant_changed: !projectionEqual(
      profile.allowed_variant_projection(left),
      profile.allowed_variant_projection(right),
    ),
  }
}

function validateProfile<TNode, TResult>(
  profile: AuthenticatedTransformationCycleProfileV0<TNode, TResult>,
): void {
  if (profile.__brand !== "AuthenticatedTransformationCycleProfileV0") {
    throw new TransformationStabilityCycleContractErrorV0("unauthenticated_cycle_profile")
  }
  if (profile.transformation_claim !== TRANSFORMATION_STABILITY_CYCLE_CLAIM_V0) {
    throw new TransformationStabilityCycleContractErrorV0("unsupported_cycle_claim")
  }
  for (const [label, value] of [
    ["cycle_profile_id", profile.cycle_profile_id],
    ["node_object_kind", profile.node_object_kind],
    ["recompute_procedure_id", profile.recompute_procedure_id],
    ["comparison_rule_id", profile.comparison_rule_id],
  ] as const) {
    if (typeof value !== "string" || value.length === 0) {
      throw new TransformationStabilityCycleContractErrorV0(`${label}_missing`)
    }
  }
  if (profile.ordered_edges.length === 0) {
    throw new TransformationStabilityCycleContractErrorV0("empty_cycle")
  }

  const seen = new Set<string>()
  for (const edge of profile.ordered_edges) {
    if (edge.__brand !== "AuthenticatedTransformationCycleEdgeV0") {
      throw new TransformationStabilityCycleContractErrorV0("unauthenticated_cycle_edge")
    }
    if (typeof edge.edge_id !== "string" || edge.edge_id.length === 0) {
      throw new TransformationStabilityCycleContractErrorV0("edge_id_missing")
    }
    if (seen.has(edge.edge_id)) {
      throw new TransformationStabilityCycleContractErrorV0("duplicate_edge_id")
    }
    seen.add(edge.edge_id)
  }
}

function zeroEndpoint(): TransformationCycleEndpointResultV0 {
  return {
    normative_match: null,
    stability_match: null,
    forbidden_variant_match: null,
    allowed_variant_changed: null,
  }
}

function aggregateEdges(
  edgeCount: number,
  edges: readonly TransformationCycleEdgeResultV0[],
): TransformationCycleAggregateV0 {
  let stable = 0
  let historySensitive = 0
  let unresolved = 0
  let outOfDomain = 0
  let violation = 0

  for (const edge of edges) {
    if (edge.classification === "stable") stable += 1
    else if (edge.classification === "history_sensitive") historySensitive += 1
    else if (edge.classification === "unresolved") unresolved += 1
    else if (edge.classification === "out_of_domain") outOfDomain += 1
    else violation += 1
  }

  return {
    edge_count: edgeCount,
    completed_edges: edges.filter(
      (edge) =>
        edge.classification === "stable" || edge.classification === "history_sensitive",
    ).length,
    stable,
    history_sensitive: historySensitive,
    unresolved,
    out_of_domain: outOfDomain,
    violation,
  }
}

function terminalResult<TNode, TResult>(input: {
  readonly profile: AuthenticatedTransformationCycleProfileV0<TNode, TResult>
  readonly classification: "unresolved" | "out_of_domain" | "violation"
  readonly failedEdgeId: string | null
  readonly failureReason: string
  readonly edges: readonly TransformationCycleEdgeResultV0[]
  readonly endpoint?: TransformationCycleEndpointResultV0
}): TransformationStabilityCycleResultV0 {
  const { profile, classification, failedEdgeId, failureReason, edges } = input
  return {
    schema: TRANSFORMATION_STABILITY_CYCLE_RESULT_SCHEMA_V0,
    transformation_claim: TRANSFORMATION_STABILITY_CYCLE_CLAIM_V0,
    cycle_profile_id: profile.cycle_profile_id,
    node_object_kind: profile.node_object_kind,
    recompute_procedure_id: profile.recompute_procedure_id,
    comparison_rule_id: profile.comparison_rule_id,
    ordered_edge_ids: profile.ordered_edges.map((edge) => edge.edge_id),
    evaluation_state:
      classification === "unresolved"
        ? "execution_unresolved"
        : classification === "out_of_domain"
          ? "not_applicable"
          : "evaluated",
    classification,
    failed_edge_id: failedEdgeId,
    failure_reason: failureReason,
    aggregate: aggregateEdges(profile.ordered_edges.length, edges),
    edges,
    endpoint: input.endpoint ?? zeroEndpoint(),
  }
}

async function recomputeNode<TNode, TResult>(
  profile: AuthenticatedTransformationCycleProfileV0<TNode, TResult>,
  node: TNode,
  reasonOnThrow: string,
): Promise<RecomputeOutcomeV0<TResult>> {
  try {
    return await profile.recompute(node)
  } catch {
    return { state: "unresolved", reason: reasonOnThrow }
  }
}

export async function evaluateTransformationCycleV0<TNode, TResult>(
  profile: AuthenticatedTransformationCycleProfileV0<TNode, TResult>,
  startNode: TNode,
): Promise<TransformationStabilityCycleResultV0> {
  validateProfile(profile)

  const startOutcome = await recomputeNode(profile, startNode, "start_recompute_failed")
  if (startOutcome.state === "unresolved") {
    return terminalResult({
      profile,
      classification: "unresolved",
      failedEdgeId: null,
      failureReason: startOutcome.reason,
      edges: [],
    })
  }

  let currentNode = startNode
  let previousResult = startOutcome.value
  const edgeResults: TransformationCycleEdgeResultV0[] = []

  for (let edgeIndex = 0; edgeIndex < profile.ordered_edges.length; edgeIndex += 1) {
    const edge = profile.ordered_edges[edgeIndex]!

    let precondition: TransformationPreconditionResultV0
    try {
      precondition = edge.precondition(currentNode)
    } catch {
      const edgeResult: TransformationCycleEdgeResultV0 = {
        edge_id: edge.edge_id,
        edge_index: edgeIndex,
        evaluation_state: "execution_unresolved",
        classification: "unresolved",
        reason: "precondition_evaluation_failed",
        normative_match: null,
        stability_match: null,
        forbidden_variant_match: null,
        allowed_variant_changed: null,
      }
      edgeResults.push(edgeResult)
      return terminalResult({
        profile,
        classification: "unresolved",
        failedEdgeId: edge.edge_id,
        failureReason: edgeResult.reason!,
        edges: edgeResults,
      })
    }

    if (!precondition.ok) {
      const edgeResult: TransformationCycleEdgeResultV0 = {
        edge_id: edge.edge_id,
        edge_index: edgeIndex,
        evaluation_state: "not_applicable",
        classification: "out_of_domain",
        reason: precondition.reason,
        normative_match: null,
        stability_match: null,
        forbidden_variant_match: null,
        allowed_variant_changed: null,
      }
      edgeResults.push(edgeResult)
      return terminalResult({
        profile,
        classification: "out_of_domain",
        failedEdgeId: edge.edge_id,
        failureReason: precondition.reason,
        edges: edgeResults,
      })
    }

    let nextNode: TNode
    try {
      nextNode = await edge.transform(currentNode)
    } catch {
      const edgeResult: TransformationCycleEdgeResultV0 = {
        edge_id: edge.edge_id,
        edge_index: edgeIndex,
        evaluation_state: "execution_unresolved",
        classification: "unresolved",
        reason: "transformation_failed",
        normative_match: null,
        stability_match: null,
        forbidden_variant_match: null,
        allowed_variant_changed: null,
      }
      edgeResults.push(edgeResult)
      return terminalResult({
        profile,
        classification: "unresolved",
        failedEdgeId: edge.edge_id,
        failureReason: edgeResult.reason!,
        edges: edgeResults,
      })
    }

    const nextOutcome = await recomputeNode(profile, nextNode, "edge_recompute_failed")
    if (nextOutcome.state === "unresolved") {
      const edgeResult: TransformationCycleEdgeResultV0 = {
        edge_id: edge.edge_id,
        edge_index: edgeIndex,
        evaluation_state: "execution_unresolved",
        classification: "unresolved",
        reason: nextOutcome.reason,
        normative_match: null,
        stability_match: null,
        forbidden_variant_match: null,
        allowed_variant_changed: null,
      }
      edgeResults.push(edgeResult)
      return terminalResult({
        profile,
        classification: "unresolved",
        failedEdgeId: edge.edge_id,
        failureReason: nextOutcome.reason,
        edges: edgeResults,
      })
    }

    let comparison: ProjectionComparison
    try {
      comparison = compareProjections(profile, previousResult, nextOutcome.value)
    } catch {
      const edgeResult: TransformationCycleEdgeResultV0 = {
        edge_id: edge.edge_id,
        edge_index: edgeIndex,
        evaluation_state: "execution_unresolved",
        classification: "unresolved",
        reason: "projection_comparison_failed",
        normative_match: null,
        stability_match: null,
        forbidden_variant_match: null,
        allowed_variant_changed: null,
      }
      edgeResults.push(edgeResult)
      return terminalResult({
        profile,
        classification: "unresolved",
        failedEdgeId: edge.edge_id,
        failureReason: edgeResult.reason!,
        edges: edgeResults,
      })
    }

    if (!comparison.normative_match || !comparison.forbidden_variant_match) {
      const edgeResult: TransformationCycleEdgeResultV0 = {
        edge_id: edge.edge_id,
        edge_index: edgeIndex,
        evaluation_state: "evaluated",
        classification: "violation",
        reason: !comparison.normative_match
          ? "normative_projection_mismatch"
          : "forbidden_variant_mismatch",
        ...comparison,
      }
      edgeResults.push(edgeResult)
      return terminalResult({
        profile,
        classification: "violation",
        failedEdgeId: edge.edge_id,
        failureReason: edgeResult.reason!,
        edges: edgeResults,
      })
    }

    if (!comparison.stability_match && profile.history_sensitive_policy === "violation") {
      const edgeResult: TransformationCycleEdgeResultV0 = {
        edge_id: edge.edge_id,
        edge_index: edgeIndex,
        evaluation_state: "evaluated",
        classification: "violation",
        reason: "stability_projection_mismatch",
        ...comparison,
      }
      edgeResults.push(edgeResult)
      return terminalResult({
        profile,
        classification: "violation",
        failedEdgeId: edge.edge_id,
        failureReason: edgeResult.reason!,
        edges: edgeResults,
      })
    }

    edgeResults.push({
      edge_id: edge.edge_id,
      edge_index: edgeIndex,
      evaluation_state: "evaluated",
      classification: comparison.stability_match ? "stable" : "history_sensitive",
      reason: comparison.stability_match ? null : "stability_projection_mismatch",
      ...comparison,
    })

    currentNode = nextNode
    previousResult = nextOutcome.value
  }

  let endpoint: TransformationCycleEndpointResultV0
  try {
    endpoint = compareProjections(profile, startOutcome.value, previousResult)
  } catch {
    return terminalResult({
      profile,
      classification: "unresolved",
      failedEdgeId: null,
      failureReason: "endpoint_projection_comparison_failed",
      edges: edgeResults,
    })
  }

  if (!endpoint.normative_match || !endpoint.forbidden_variant_match) {
    return terminalResult({
      profile,
      classification: "violation",
      failedEdgeId: null,
      failureReason: !endpoint.normative_match
        ? "endpoint_normative_projection_mismatch"
        : "endpoint_forbidden_variant_mismatch",
      edges: edgeResults,
      endpoint,
    })
  }

  if (!endpoint.stability_match && profile.history_sensitive_policy === "violation") {
    return terminalResult({
      profile,
      classification: "violation",
      failedEdgeId: null,
      failureReason: "endpoint_stability_projection_mismatch",
      edges: edgeResults,
      endpoint,
    })
  }

  const hasHistorySensitive =
    edgeResults.some((edge) => edge.classification === "history_sensitive") ||
    !endpoint.stability_match

  return {
    schema: TRANSFORMATION_STABILITY_CYCLE_RESULT_SCHEMA_V0,
    transformation_claim: TRANSFORMATION_STABILITY_CYCLE_CLAIM_V0,
    cycle_profile_id: profile.cycle_profile_id,
    node_object_kind: profile.node_object_kind,
    recompute_procedure_id: profile.recompute_procedure_id,
    comparison_rule_id: profile.comparison_rule_id,
    ordered_edge_ids: profile.ordered_edges.map((edge) => edge.edge_id),
    evaluation_state: "evaluated",
    classification: hasHistorySensitive ? "history_sensitive" : "stable",
    failed_edge_id: null,
    failure_reason: null,
    aggregate: aggregateEdges(profile.ordered_edges.length, edgeResults),
    edges: edgeResults,
    endpoint,
  }
}

export function defineTransformationCycleEdgeV0<TNode>(
  edge: Omit<AuthenticatedTransformationCycleEdgeV0<TNode>, "__brand">,
): AuthenticatedTransformationCycleEdgeV0<TNode> {
  return Object.freeze({
    __brand: "AuthenticatedTransformationCycleEdgeV0" as const,
    ...edge,
  })
}

export function defineTransformationCycleProfileV0<TNode, TResult>(
  profile: Omit<
    AuthenticatedTransformationCycleProfileV0<TNode, TResult>,
    "__brand" | "transformation_claim"
  >,
): AuthenticatedTransformationCycleProfileV0<TNode, TResult> {
  return Object.freeze({
    __brand: "AuthenticatedTransformationCycleProfileV0" as const,
    transformation_claim: TRANSFORMATION_STABILITY_CYCLE_CLAIM_V0,
    ...profile,
    ordered_edges: Object.freeze([...profile.ordered_edges]),
  })
}
