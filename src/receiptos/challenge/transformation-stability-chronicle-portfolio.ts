/**
 * ReceiptOS Transformation Stability v1 — ChroniclePortfolioV0 profile.
 *
 * The second independent real ReceiptOS object boundary carrying the
 * Transformation Stability N/S/A/F model, alongside the existing Handoff
 * profile. Every recompute/comparison primitive here is imported unchanged
 * from src/receiptos/capsule/chronicle-portfolio-v0.ts and
 * src/receiptos/canon/canonicalize.ts; this module only wires them into the
 * existing generic transformation-stability.ts / transformation-stability-
 * cycle.ts evaluators. No new schema, validator, root algorithm,
 * canonicalizer, or applicability rule is introduced. ChroniclePortfolioV0
 * itself imports no HandoffEvidence and calls no computeReceiptRoot; this
 * module inherits that independence and adds none of its own.
 *
 * Reachable classification set: `stable`, `violation`, `unresolved`.
 *
 * `out_of_domain` is intentionally absent. ChroniclePortfolioV0 has no
 * independent runtime applicability validator distinct from recompute —
 * unlike HandoffEvidenceSchema, there is no `.validate()`/`.parse()` pair to
 * gate on here at all. Malformed nodes are instead caught as a bounded
 * recompute failure (`unresolved`), which is the only failure mode this
 * domain's committed primitives actually exhibit. The precondition below is
 * therefore a fixed, inert `{ ok: true }` — it inspects nothing and can
 * never itself produce `out_of_domain`.
 *
 * `history_sensitive` is intentionally absent. Every declared field of
 * ChroniclePortfolioV0 is accounted for: `schema`, `portfolio_id`,
 * `collection_refs` content, and the claimed `portfolio_root` all
 * participate in `N`; `metadata` is `F`; `collection_refs` order is
 * normalized away by `sortCollectionRefs` (reused, not reimplemented) before
 * either `N` or `S` observe it. `S` is a full canonical envelope of the
 * entire declared object (with only `collection_refs` order normalized), so
 * it is a strict superset of `N`'s and `F`'s sensitivity — there is no field
 * that can move `S` without also moving `N` or `F`.
 *
 * Both absences are profile-domain properties of this concrete object, not
 * limitations of the generic Transformation Stability core, which already
 * supports both classifications elsewhere (see
 * transformation-stability-cycle-v0.test.ts for `out_of_domain`, and the
 * generic core's `history_sensitive_policy` for `history_sensitive`).
 */

import {
  type ChroniclePortfolioV0,
  sortCollectionRefs,
  verifyChroniclePortfolioV0,
} from "../capsule/chronicle-portfolio-v0"
import { canonicalize } from "../canon/canonicalize"
import {
  defineTransformationProfileV0,
  evaluateTransformationStabilityV0,
  type RecomputeOutcomeV0,
  type TransformationPreconditionResultV0,
  type TransformationStabilityClassificationV0,
  type TransformationStabilityResultV0,
} from "./transformation-stability"
import {
  defineTransformationCycleEdgeV0,
  defineTransformationCycleProfileV0,
  evaluateTransformationCycleV0,
  type AuthenticatedTransformationCycleEdgeV0,
  type TransformationStabilityCycleResultV0,
} from "./transformation-stability-cycle"

// ---------------------------------------------------------------------------
// Observation
// ---------------------------------------------------------------------------

export type ChroniclePortfolioRoundTripObservationV1 = {
  readonly schema: string
  readonly claimed_portfolio_root: string
  readonly recomputed_portfolio_root: string
  readonly root_match: boolean
  readonly canonical_envelope: string
  readonly metadata: Record<string, unknown> | undefined
}

function recomputeChroniclePortfolioV1(
  node: ChroniclePortfolioV0,
): RecomputeOutcomeV0<ChroniclePortfolioRoundTripObservationV1> {
  try {
    // Reused directly — this is the object's own existing verification
    // surface, not a parallel comparison.
    const verification = verifyChroniclePortfolioV0(node)
    const canonicalEnvelope = canonicalize({
      ...node,
      collection_refs: sortCollectionRefs(node.collection_refs),
    })
    return {
      state: "evaluated",
      value: {
        schema: node.schema,
        claimed_portfolio_root: verification.portfolio_root,
        recomputed_portfolio_root: verification.recomputed_portfolio_root,
        root_match: verification.ok,
        canonical_envelope: canonicalEnvelope,
        // Defensive snapshot: never return the node's own live nested
        // metadata reference. See the aliasing test in the focused suite.
        metadata: node.metadata === undefined ? undefined : structuredClone(node.metadata),
      },
    }
  } catch {
    return { state: "unresolved", reason: "chronicle_portfolio_recompute_failed" }
  }
}

// Fixed, inert, successful precondition. Inspects nothing; see the
// module-level comment for why this domain has no applicability boundary to
// gate on.
function chroniclePortfolioInertPreconditionV1(
  _node: ChroniclePortfolioV0,
): TransformationPreconditionResultV0 {
  return { ok: true }
}

function chroniclePortfolioNormativeProjectionV1(
  result: ChroniclePortfolioRoundTripObservationV1,
): unknown {
  return {
    schema: result.schema,
    claimed_portfolio_root: result.claimed_portfolio_root,
    recomputed_portfolio_root: result.recomputed_portfolio_root,
    root_match: result.root_match,
  }
}

function chroniclePortfolioStabilityProjectionV1(
  result: ChroniclePortfolioRoundTripObservationV1,
): unknown {
  return { canonical_envelope: result.canonical_envelope }
}

function chroniclePortfolioAllowedVariantProjectionV1(
  _result: ChroniclePortfolioRoundTripObservationV1,
): unknown {
  return {}
}

function chroniclePortfolioForbiddenVariantProjectionV1(
  result: ChroniclePortfolioRoundTripObservationV1,
): unknown {
  // canonicalIdentityJson (the generic core's comparison canonicalizer)
  // throws on an object key whose value is literally `undefined` — unlike
  // canonicalize(), it does not silently drop it. `metadata` is optional on
  // ChroniclePortfolioV0, so "absent" is normalized to `null` here, at the
  // projection boundary only; the observation type itself still honestly
  // carries `undefined` when metadata is absent.
  return { metadata: result.metadata ?? null }
}

// ---------------------------------------------------------------------------
// Flat vector inventory
// ---------------------------------------------------------------------------

export const CHRONICLE_PORTFOLIO_TRANSFORMATION_MATRIX_SCHEMA_V1 =
  "receiptos.transformation_stability_chronicle_portfolio_matrix.v1" as const

export const CHRONICLE_PORTFOLIO_TRANSFORMATION_MATRIX_ID_V1 =
  "chronicle-portfolio-transformation-stability-matrix-v1" as const

export type ChroniclePortfolioTransformationVectorIdV1 =
  | "stable_canonical_roundtrip"
  | "collection_refs_reorder_stable"
  | "portfolio_id_normative_mutation"
  | "metadata_forbidden_mutation"
  | "collection_refs_recompute_unresolved"
  | "stored_portfolio_root_tamper"
  | "schema_literal_mutation"

export type ChroniclePortfolioTransformationVectorRecordV1 = {
  readonly vector_id: ChroniclePortfolioTransformationVectorIdV1
  readonly expected_classification: TransformationStabilityClassificationV0
  readonly expected_normative_match: boolean | null
  readonly expected_stability_match: boolean | null
  readonly expected_forbidden_variant_match: boolean | null
  readonly expected_unresolved_reason: string | null
  readonly expected_out_of_domain_reason: string | null
}

export const CHRONICLE_PORTFOLIO_TRANSFORMATION_VECTORS_V1: readonly ChroniclePortfolioTransformationVectorRecordV1[] =
  Object.freeze([
    Object.freeze({
      vector_id: "stable_canonical_roundtrip",
      expected_classification: "stable",
      expected_normative_match: true,
      expected_stability_match: true,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "collection_refs_reorder_stable",
      expected_classification: "stable",
      expected_normative_match: true,
      expected_stability_match: true,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "portfolio_id_normative_mutation",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "metadata_forbidden_mutation",
      expected_classification: "violation",
      expected_normative_match: true,
      expected_stability_match: false,
      expected_forbidden_variant_match: false,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "collection_refs_recompute_unresolved",
      expected_classification: "unresolved",
      expected_normative_match: null,
      expected_stability_match: null,
      expected_forbidden_variant_match: null,
      expected_unresolved_reason: "chronicle_portfolio_recompute_failed",
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "stored_portfolio_root_tamper",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
    Object.freeze({
      vector_id: "schema_literal_mutation",
      expected_classification: "violation",
      expected_normative_match: false,
      expected_stability_match: false,
      expected_forbidden_variant_match: true,
      expected_unresolved_reason: null,
      expected_out_of_domain_reason: null,
    }),
  ])

function commonPortfolioProfileFields() {
  return {
    transformation_family: "chronicle_portfolio_transformation_matrix",
    source_object_kind: "chronicle_portfolio.v0",
    target_object_kind: "chronicle_portfolio.v0",
    recompute_procedure_id: "receiptos.computeChroniclePortfolioRoot+canonicalize.v1",
    comparison_rule_id: "portfolio-root+canonical-envelope+metadata.v1",
    history_sensitive_policy: "violation" as const,
    precondition: chroniclePortfolioInertPreconditionV1,
    recompute_source: recomputeChroniclePortfolioV1,
    recompute_target: recomputeChroniclePortfolioV1,
    normative_projection: chroniclePortfolioNormativeProjectionV1,
    stability_projection: chroniclePortfolioStabilityProjectionV1,
    allowed_variant_projection: chroniclePortfolioAllowedVariantProjectionV1,
    forbidden_variant_projection: chroniclePortfolioForbiddenVariantProjectionV1,
  }
}

const CHRONICLE_PORTFOLIO_FLAT_PROFILE_ID_V1 = "chronicle-portfolio-canonical-roundtrip-v1" as const

function buildFlatVectorProfile(vectorId: ChroniclePortfolioTransformationVectorIdV1) {
  const common = commonPortfolioProfileFields()

  if (vectorId === "stable_canonical_roundtrip") {
    return defineTransformationProfileV0<ChroniclePortfolioV0, ChroniclePortfolioV0, ChroniclePortfolioRoundTripObservationV1>({
      ...common,
      transformation_profile_id: CHRONICLE_PORTFOLIO_FLAT_PROFILE_ID_V1,
      transform: (node) => JSON.parse(canonicalize(node)) as ChroniclePortfolioV0,
    })
  }

  if (vectorId === "collection_refs_reorder_stable") {
    return defineTransformationProfileV0<ChroniclePortfolioV0, ChroniclePortfolioV0, ChroniclePortfolioRoundTripObservationV1>({
      ...common,
      transformation_profile_id: CHRONICLE_PORTFOLIO_FLAT_PROFILE_ID_V1,
      transform: (node) => ({ ...node, collection_refs: [...node.collection_refs].reverse() }),
    })
  }

  if (vectorId === "portfolio_id_normative_mutation") {
    return defineTransformationProfileV0<ChroniclePortfolioV0, ChroniclePortfolioV0, ChroniclePortfolioRoundTripObservationV1>({
      ...common,
      transformation_profile_id: CHRONICLE_PORTFOLIO_FLAT_PROFILE_ID_V1,
      transform: (node) => ({ ...node, portfolio_id: `${node.portfolio_id}-mutated` }),
    })
  }

  if (vectorId === "metadata_forbidden_mutation") {
    return defineTransformationProfileV0<ChroniclePortfolioV0, ChroniclePortfolioV0, ChroniclePortfolioRoundTripObservationV1>({
      ...common,
      transformation_profile_id: CHRONICLE_PORTFOLIO_FLAT_PROFILE_ID_V1,
      transform: (node) => ({ ...node, metadata: { tampered: true } }),
    })
  }

  if (vectorId === "collection_refs_recompute_unresolved") {
    return defineTransformationProfileV0<ChroniclePortfolioV0, ChroniclePortfolioV0, ChroniclePortfolioRoundTripObservationV1>({
      ...common,
      transformation_profile_id: CHRONICLE_PORTFOLIO_FLAT_PROFILE_ID_V1,
      // Malformed collection_refs, local to this one adversarial vector only
      // — ChroniclePortfolioV0's declared shape is never weakened.
      transform: (node) => ({ ...node, collection_refs: null }) as unknown as ChroniclePortfolioV0,
    })
  }

  if (vectorId === "stored_portfolio_root_tamper") {
    return defineTransformationProfileV0<ChroniclePortfolioV0, ChroniclePortfolioV0, ChroniclePortfolioRoundTripObservationV1>({
      ...common,
      transformation_profile_id: CHRONICLE_PORTFOLIO_FLAT_PROFILE_ID_V1,
      transform: (node) => ({ ...node, portfolio_root: `sha256:${"0".repeat(64)}` }),
    })
  }

  // schema_literal_mutation
  return defineTransformationProfileV0<ChroniclePortfolioV0, ChroniclePortfolioV0, ChroniclePortfolioRoundTripObservationV1>({
    ...common,
    transformation_profile_id: CHRONICLE_PORTFOLIO_FLAT_PROFILE_ID_V1,
    // Local cast: schema is a literal-typed field on ChroniclePortfolioV0;
    // divergence from portfolio_version is deliberately off-path here.
    transform: (node) => ({ ...node, schema: `${node.schema}-tampered` }) as unknown as ChroniclePortfolioV0,
  })
}

export type ChroniclePortfolioTransformationMemberResultV1 = {
  readonly vector_id: ChroniclePortfolioTransformationVectorIdV1
  readonly expected: ChroniclePortfolioTransformationVectorRecordV1
  readonly observed: TransformationStabilityResultV0
}

export type ChroniclePortfolioTransformationMatrixResultV1 = {
  readonly schema: typeof CHRONICLE_PORTFOLIO_TRANSFORMATION_MATRIX_SCHEMA_V1
  readonly matrix_id: typeof CHRONICLE_PORTFOLIO_TRANSFORMATION_MATRIX_ID_V1
  readonly vector_count: 7
  readonly aggregate: {
    readonly stable: number
    readonly history_sensitive: number
    readonly unresolved: number
    readonly out_of_domain: number
    readonly violation: number
  }
  readonly members: readonly ChroniclePortfolioTransformationMemberResultV1[]
  readonly pass: boolean
}

function memberPass(member: ChroniclePortfolioTransformationMemberResultV1): boolean {
  const { expected, observed } = member
  return (
    observed.classification === expected.expected_classification &&
    observed.normative_match === expected.expected_normative_match &&
    observed.stability_match === expected.expected_stability_match &&
    observed.forbidden_variant_match === expected.expected_forbidden_variant_match &&
    observed.unresolved_reason === expected.expected_unresolved_reason &&
    observed.out_of_domain_reason === expected.expected_out_of_domain_reason
  )
}

function aggregateMembers(
  members: readonly ChroniclePortfolioTransformationMemberResultV1[],
): ChroniclePortfolioTransformationMatrixResultV1["aggregate"] {
  let stable = 0
  let historySensitive = 0
  let unresolved = 0
  let outOfDomain = 0
  let violation = 0

  for (const member of members) {
    if (member.observed.classification === "stable") stable += 1
    else if (member.observed.classification === "history_sensitive") historySensitive += 1
    else if (member.observed.classification === "unresolved") unresolved += 1
    else if (member.observed.classification === "out_of_domain") outOfDomain += 1
    else violation += 1
  }

  return { stable, history_sensitive: historySensitive, unresolved, out_of_domain: outOfDomain, violation }
}

export async function evaluateChroniclePortfolioTransformationVectorV1(
  vectorId: ChroniclePortfolioTransformationVectorIdV1,
  source: ChroniclePortfolioV0,
): Promise<TransformationStabilityResultV0> {
  return evaluateTransformationStabilityV0(buildFlatVectorProfile(vectorId), source)
}

export async function evaluateChroniclePortfolioTransformationMatrixV1(
  source: ChroniclePortfolioV0,
): Promise<ChroniclePortfolioTransformationMatrixResultV1> {
  const members: ChroniclePortfolioTransformationMemberResultV1[] = []

  for (const expected of CHRONICLE_PORTFOLIO_TRANSFORMATION_VECTORS_V1) {
    const observed = await evaluateChroniclePortfolioTransformationVectorV1(expected.vector_id, source)
    members.push({ vector_id: expected.vector_id, expected, observed })
  }

  const aggregate = aggregateMembers(members)
  const pass =
    members.length === 7 &&
    members.every(memberPass) &&
    aggregate.stable === 2 &&
    aggregate.history_sensitive === 0 &&
    aggregate.unresolved === 1 &&
    aggregate.out_of_domain === 0 &&
    aggregate.violation === 4

  return {
    schema: CHRONICLE_PORTFOLIO_TRANSFORMATION_MATRIX_SCHEMA_V1,
    matrix_id: CHRONICLE_PORTFOLIO_TRANSFORMATION_MATRIX_ID_V1,
    vector_count: 7,
    aggregate,
    members,
    pass,
  }
}

// ---------------------------------------------------------------------------
// Closed-cycle vector inventory
// ---------------------------------------------------------------------------

export type ChroniclePortfolioTransformationCycleVectorIdV1 =
  | "stable_multi_edge_roundtrip_reorder"
  | "portfolio_id_mutation_then_restore"
  | "metadata_mutation_then_restore"
  | "collection_refs_corrupt_unresolved"

export type ChroniclePortfolioTransformationCycleVectorRecordV1 = {
  readonly vector_id: ChroniclePortfolioTransformationCycleVectorIdV1
  readonly expected_classification: TransformationStabilityClassificationV0
  readonly expected_failed_edge_id: string | null
  readonly expected_failure_reason: string | null
  readonly expected_completed_edges: number
}

export const CHRONICLE_PORTFOLIO_TRANSFORMATION_CYCLE_VECTORS_V1: readonly ChroniclePortfolioTransformationCycleVectorRecordV1[] =
  Object.freeze([
    Object.freeze({
      vector_id: "stable_multi_edge_roundtrip_reorder",
      expected_classification: "stable",
      expected_failed_edge_id: null,
      expected_failure_reason: null,
      expected_completed_edges: 2,
    }),
    Object.freeze({
      vector_id: "portfolio_id_mutation_then_restore",
      expected_classification: "violation",
      expected_failed_edge_id: "mutate-portfolio-id",
      expected_failure_reason: "normative_projection_mismatch",
      expected_completed_edges: 0,
    }),
    Object.freeze({
      vector_id: "metadata_mutation_then_restore",
      expected_classification: "violation",
      expected_failed_edge_id: "mutate-metadata",
      expected_failure_reason: "forbidden_variant_mismatch",
      expected_completed_edges: 0,
    }),
    Object.freeze({
      vector_id: "collection_refs_corrupt_unresolved",
      expected_classification: "unresolved",
      expected_failed_edge_id: "corrupt-collection-refs",
      expected_failure_reason: "chronicle_portfolio_recompute_failed",
      expected_completed_edges: 0,
    }),
  ])

function commonPortfolioCycleProfileFields() {
  return {
    node_object_kind: "chronicle_portfolio.v0",
    recompute_procedure_id: "receiptos.computeChroniclePortfolioRoot+canonicalize.v1",
    comparison_rule_id: "portfolio-root+canonical-envelope+metadata.v1",
    history_sensitive_policy: "violation" as const,
    recompute: recomputeChroniclePortfolioV1,
    normative_projection: chroniclePortfolioNormativeProjectionV1,
    stability_projection: chroniclePortfolioStabilityProjectionV1,
    allowed_variant_projection: chroniclePortfolioAllowedVariantProjectionV1,
    forbidden_variant_projection: chroniclePortfolioForbiddenVariantProjectionV1,
  }
}

function portfolioCycleEdge(
  edgeId: string,
  transform: (node: ChroniclePortfolioV0) => ChroniclePortfolioV0,
): AuthenticatedTransformationCycleEdgeV0<ChroniclePortfolioV0> {
  return defineTransformationCycleEdgeV0<ChroniclePortfolioV0>({
    edge_id: edgeId,
    precondition: chroniclePortfolioInertPreconditionV1,
    transform,
  })
}

function buildCycleVectorProfile(vectorId: ChroniclePortfolioTransformationCycleVectorIdV1) {
  const common = commonPortfolioCycleProfileFields()
  const cycleProfileId = `chronicle-portfolio-cycle-v1:${vectorId}`

  if (vectorId === "stable_multi_edge_roundtrip_reorder") {
    return defineTransformationCycleProfileV0<ChroniclePortfolioV0, ChroniclePortfolioRoundTripObservationV1>({
      ...common,
      cycle_profile_id: cycleProfileId,
      ordered_edges: [
        portfolioCycleEdge("canonical-roundtrip", (node) => JSON.parse(canonicalize(node)) as ChroniclePortfolioV0),
        portfolioCycleEdge("collection-refs-reorder", (node) => ({
          ...node,
          collection_refs: [...node.collection_refs].reverse(),
        })),
      ],
    })
  }

  if (vectorId === "portfolio_id_mutation_then_restore") {
    return defineTransformationCycleProfileV0<ChroniclePortfolioV0, ChroniclePortfolioRoundTripObservationV1>({
      ...common,
      cycle_profile_id: cycleProfileId,
      ordered_edges: [
        portfolioCycleEdge("mutate-portfolio-id", (node) => ({
          ...node,
          portfolio_id: `${node.portfolio_id}-mutated`,
        })),
        // Declared but never reached: N mismatch is immediately terminal at
        // mutate-portfolio-id. Restoring portfolio_id here would bring N
        // back into agreement with R0, but the cycle never gets this far —
        // this is the proof that endpoint equality cannot erase an
        // intermediate violation.
        portfolioCycleEdge("restore-portfolio-id", (node) => {
          const restored = node.portfolio_id.replace(/-mutated$/, "")
          return { ...node, portfolio_id: restored }
        }),
      ],
    })
  }

  if (vectorId === "metadata_mutation_then_restore") {
    return defineTransformationCycleProfileV0<ChroniclePortfolioV0, ChroniclePortfolioRoundTripObservationV1>({
      ...common,
      cycle_profile_id: cycleProfileId,
      ordered_edges: [
        portfolioCycleEdge("mutate-metadata", (node) => ({ ...node, metadata: { tampered: true } })),
        // Declared but never reached, same reasoning as
        // portfolio_id_mutation_then_restore: F mismatch (metadata changed)
        // is terminal even though N (root) never moved.
        portfolioCycleEdge("restore-metadata", (node) => {
          const { metadata: _drop, ...rest } = node
          return rest as ChroniclePortfolioV0
        }),
      ],
    })
  }

  // collection_refs_corrupt_unresolved
  return defineTransformationCycleProfileV0<ChroniclePortfolioV0, ChroniclePortfolioRoundTripObservationV1>({
    ...common,
    cycle_profile_id: cycleProfileId,
    ordered_edges: [
      portfolioCycleEdge(
        "corrupt-collection-refs",
        (node) => ({ ...node, collection_refs: null }) as unknown as ChroniclePortfolioV0,
      ),
    ],
  })
}

export async function evaluateChroniclePortfolioTransformationCycleVectorV1(
  vectorId: ChroniclePortfolioTransformationCycleVectorIdV1,
  source: ChroniclePortfolioV0,
): Promise<TransformationStabilityCycleResultV0> {
  return evaluateTransformationCycleV0(buildCycleVectorProfile(vectorId), source)
}
