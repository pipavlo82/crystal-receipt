import { canonicalize } from "../canon/canonicalize"
import { sha256 } from "../canon/receipt-root"
import type { PortableProofObjectV0 } from "./portable-proof-object-v0"

export type ChronicleEntryV0 = {
  schema: "chronicle_entry.v0"
  entry_id: string
  created_at: string
  relation_type: string
  project_refs: string[]
  proof_object_refs: Array<{
    proof_object_id: string
    proof_system: string
    receipt_root: string
    proof_ref: string
    replay_ref: string | null
    anchor_ref: string | null
  }>
  metadata: {
    label: string
    session_id: string
    position_id: string
    directory: string
    source_evidence_ref: string
    producer_runtime: string
    source_schema: string
  }
}

export type ChroniclePortfolioV0 = {
  portfolio_version: "chronicle_portfolio.v0"
  portfolio_id: string
  collection_refs: string[]
  portfolio_root: string
  metadata?: Record<string, unknown>
}

export type ChroniclePortfolioVerification = {
  ok: boolean
  portfolio_root: string
  recomputed_portfolio_root: string
}

export function createChronicleEntryV0(proofObject: PortableProofObjectV0): ChronicleEntryV0 {
  return {
    schema: "chronicle_entry.v0",
    entry_id: `entry-${proofObject.proof_object_id}`,
    created_at: proofObject.created_at,
    relation_type: proofObject.relation_type,
    project_refs: proofObject.project_refs,
    proof_object_refs: [
      {
        proof_object_id: proofObject.proof_object_id,
        proof_system: proofObject.proof_system,
        receipt_root: proofObject.receipt_root,
        proof_ref: proofObject.proof_ref,
        replay_ref: proofObject.replay_ref,
        anchor_ref: proofObject.anchor_ref,
      },
    ],
    metadata: {
      label: proofObject.metadata.label,
      session_id: proofObject.metadata.session_id,
      position_id: proofObject.metadata.position_id,
      directory: proofObject.metadata.directory,
      source_evidence_ref: proofObject.source_evidence_ref,
      producer_runtime: proofObject.producer.runtime,
      source_schema: proofObject.producer.source_schema,
    },
  }
}

export function sortCollectionRefs(collectionRefs: string[]): string[] {
  return [...collectionRefs].sort((a, b) => a.localeCompare(b))
}

export function deriveCollectionRefsFromChronicleEntry(entry: ChronicleEntryV0): string[] {
  const refs = entry.proof_object_refs.map((proof) => `chronicle://collection/receipt-root/${proof.receipt_root}`)
  return Array.from(new Set(sortCollectionRefs(refs)))
}

function derivePortfolioId(collectionRefs: string[]): string {
  const seed = canonicalize({
    portfolio_version: "chronicle_portfolio.v0",
    collection_refs: sortCollectionRefs(collectionRefs),
  })
  return `portfolio-${sha256(seed).slice(0, 24)}`
}

export function computeChroniclePortfolioRoot(input: Pick<ChroniclePortfolioV0, "portfolio_version" | "portfolio_id" | "collection_refs">): string {
  return `0x${sha256(canonicalize({
    portfolio_version: input.portfolio_version,
    portfolio_id: input.portfolio_id,
    collection_refs: sortCollectionRefs(input.collection_refs),
  }))}`
}

export function createChroniclePortfolioV0(entry: ChronicleEntryV0, options?: { portfolioId?: string; collectionRefs?: string[] }): ChroniclePortfolioV0 {
  const collectionRefs = sortCollectionRefs(options?.collectionRefs ?? deriveCollectionRefsFromChronicleEntry(entry))
  const portfolioId = options?.portfolioId ?? derivePortfolioId(collectionRefs)

  return {
    portfolio_version: "chronicle_portfolio.v0",
    portfolio_id: portfolioId,
    collection_refs: collectionRefs,
    portfolio_root: computeChroniclePortfolioRoot({
      portfolio_version: "chronicle_portfolio.v0",
      portfolio_id: portfolioId,
      collection_refs: collectionRefs,
    }),
  }
}

export function verifyChroniclePortfolioV0(portfolio: ChroniclePortfolioV0): ChroniclePortfolioVerification {
  const recomputedPortfolioRoot = computeChroniclePortfolioRoot({
    portfolio_version: portfolio.portfolio_version,
    portfolio_id: portfolio.portfolio_id,
    collection_refs: portfolio.collection_refs,
  })

  return {
    ok: portfolio.portfolio_root === recomputedPortfolioRoot,
    portfolio_root: portfolio.portfolio_root,
    recomputed_portfolio_root: recomputedPortfolioRoot,
  }
}
