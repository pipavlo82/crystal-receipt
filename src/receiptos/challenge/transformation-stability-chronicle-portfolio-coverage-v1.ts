/**
 * Closed-World Profile Coverage v0 -- pilot: ChroniclePortfolioV0.
 *
 * This is the FIRST pilot of the additive coverage plane
 * (transformation-stability-coverage.ts) against a real domain object. It
 * does not modify, wrap, or depend on the already-merged
 * transformation-stability-chronicle-portfolio.ts profile in any way --
 * that file is untouched. This module builds its own, separate,
 * intentionally minimal AuthenticatedTransformationProfileV0 for
 * ChroniclePortfolioV0, reusing only the frozen, already-public
 * verifyChroniclePortfolioV0 / sortCollectionRefs (from
 * src/receiptos/capsule/chronicle-portfolio-v0.ts) and canonicalize (from
 * src/receiptos/canon/canonicalize.ts) -- no root algorithm or
 * canonicalizer is duplicated.
 *
 * The underlying base profile here deliberately OMITS `schema` from its
 * normative projection and omits `metadata` from its forbidden projection
 * entirely -- this is not a claim that the real, merged Chronicle
 * Portfolio v1 profile has this gap (it does not: see
 * transformation-stability-chronicle-portfolio.ts, whose
 * normative_projection already includes `schema` and whose
 * forbidden_variant_projection already includes `metadata` as a whole
 * value). It is a deliberate, clearly-labeled simulation of exactly the
 * authoring omission this coverage layer exists to catch, so that the
 * pilot tests can prove coverage escalation is real and observable rather
 * than redundant with what the hand-written projections already catch.
 *
 * history_sensitive_policy is "classify" here (not "violation"), so an
 * S-only mismatch (e.g. the omitted `schema`/`metadata` fields differing,
 * which still shows up in the full canonical envelope) classifies as
 * `history_sensitive` at the base layer -- exactly the milder-than-it-
 * should-be classification the coverage plane is required to escalate to
 * `violation`, never the reverse.
 */

import { canonicalize } from "../canon/canonicalize"
import { sortCollectionRefs, verifyChroniclePortfolioV0, type ChroniclePortfolioV0 } from "../capsule/chronicle-portfolio-v0"
import {
  defineTransformationProfileV0,
  type AuthenticatedTransformationProfileV0,
  type RecomputeOutcomeV0,
  type TransformationPreconditionResultV0,
} from "./transformation-stability"
import {
  defineCoverageProfileV0,
  evaluateTransformationStabilityWithCoverageV0,
  type CoverageProfileV0,
  type TransformationStabilityWithCoverageResultV0,
} from "./transformation-stability-coverage"

// ---------------------------------------------------------------------------
// Deliberately minimal base profile (see module comment for why the gaps
// are intentional).
// ---------------------------------------------------------------------------

type PilotObservationV0 = {
  readonly root_match: boolean
  readonly claimed_root: string
  readonly recomputed_root: string
  readonly canonical_envelope: string
}

function recomputePilotPortfolio(node: ChroniclePortfolioV0): RecomputeOutcomeV0<PilotObservationV0> {
  try {
    const verification = verifyChroniclePortfolioV0(node)
    return {
      state: "evaluated",
      value: {
        root_match: verification.ok,
        claimed_root: verification.portfolio_root,
        recomputed_root: verification.recomputed_portfolio_root,
        canonical_envelope: canonicalize({ ...node, collection_refs: sortCollectionRefs(node.collection_refs) }),
      },
    }
  } catch {
    return { state: "unresolved", reason: "chronicle_portfolio_coverage_pilot_recompute_failed" }
  }
}

function pilotInertPrecondition(_node: ChroniclePortfolioV0): TransformationPreconditionResultV0 {
  return { ok: true }
}

export function buildPilotBaseProfileV0(
  transform: (node: ChroniclePortfolioV0) => ChroniclePortfolioV0 | Promise<ChroniclePortfolioV0>,
  transformationProfileId: string,
): AuthenticatedTransformationProfileV0<ChroniclePortfolioV0, ChroniclePortfolioV0, PilotObservationV0> {
  return defineTransformationProfileV0<ChroniclePortfolioV0, ChroniclePortfolioV0, PilotObservationV0>({
    transformation_profile_id: transformationProfileId,
    transformation_family: "chronicle_portfolio_coverage_pilot_v0",
    source_object_kind: "chronicle_portfolio.v0",
    target_object_kind: "chronicle_portfolio.v0",
    recompute_procedure_id: "receiptos.chroniclePortfolioCoveragePilot.v0",
    comparison_rule_id: "root-match-only+full-envelope.v0",
    // classify, not violation -- see module comment.
    history_sensitive_policy: "classify",
    precondition: pilotInertPrecondition,
    transform,
    recompute_source: recomputePilotPortfolio,
    recompute_target: recomputePilotPortfolio,
    // Deliberately omits `schema` -- a schema-only mutation is invisible to
    // this projection alone (it does not move the root, since `schema` is
    // excluded from the root preimage).
    normative_projection: (result) => ({
      root_match: result.root_match,
      claimed_root: result.claimed_root,
      recomputed_root: result.recomputed_root,
    }),
    stability_projection: (result) => ({ canonical_envelope: result.canonical_envelope }),
    allowed_variant_projection: () => ({}),
    // Deliberately empty -- `metadata` is not protected at all by this base
    // profile's own hand-written projections.
    forbidden_variant_projection: () => ({}),
  })
}

// ---------------------------------------------------------------------------
// Coverage declarations. Mechanically account for the real declared
// ChroniclePortfolioV0 surface: schema, portfolio_version, portfolio_id,
// collection_refs, portfolio_root -- all N. `metadata` is DELIBERATELY left
// undeclared: it is a dynamic map (Record<string, unknown>), so nothing
// about its current or future contents is enumerable in advance, and no
// wildcard is used either (see module comment -- this is the headline
// omission test, not a wildcard demonstration). Every metadata-rooted path,
// known or unknown, therefore falls to derived C_F automatically.
// ---------------------------------------------------------------------------

export const PILOT_COLLECTION_REFS_NORMALIZER = (value: unknown): unknown =>
  Array.isArray(value) ? sortCollectionRefs(value as string[]) : value

const PILOT_DECLARATIONS_RESULT = defineCoverageProfileV0({
  same_type: true,
  history_sensitive_policy: "classify",
  declarations: [
    { selector: "schema", targetClass: "N" },
    { selector: "portfolio_version", targetClass: "N" },
    { selector: "portfolio_id", targetClass: "N" },
    { selector: "collection_refs", targetClass: "N" },
    { selector: "portfolio_root", targetClass: "N" },
  ],
  value_normalizers: {
    collection_refs: PILOT_COLLECTION_REFS_NORMALIZER,
  },
})

if (!PILOT_DECLARATIONS_RESULT.ok) {
  // Fails fast at module load if the pilot's own static declarations are
  // ever malformed -- the same fail-closed discipline the coverage plane
  // itself enforces, applied to this pilot's authoring.
  throw new Error(`chronicle portfolio coverage pilot declarations are invalid: ${PILOT_DECLARATIONS_RESULT.reasons.join("; ")}`)
}

export const CHRONICLE_PORTFOLIO_COVERAGE_PROFILE_V0: CoverageProfileV0 = PILOT_DECLARATIONS_RESULT.profile

// ---------------------------------------------------------------------------
// Pilot entry point.
// ---------------------------------------------------------------------------

export async function evaluateChroniclePortfolioWithCoverageV0(
  transform: (node: ChroniclePortfolioV0) => ChroniclePortfolioV0 | Promise<ChroniclePortfolioV0>,
  transformationProfileId: string,
  source: ChroniclePortfolioV0,
): Promise<TransformationStabilityWithCoverageResultV0> {
  const profile = buildPilotBaseProfileV0(transform, transformationProfileId)
  return evaluateTransformationStabilityWithCoverageV0(CHRONICLE_PORTFOLIO_COVERAGE_PROFILE_V0, profile, source)
}
