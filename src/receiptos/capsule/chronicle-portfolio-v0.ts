import { canonicalize } from "../canon/canonicalize"
import { sha256 } from "../canon/receipt-root"
import type { PortableProofObjectV0 } from "./portable-proof-object-v0"

export const CHRONICLE_ENTRY_VERSION_V0 = "chronicle_entry.v0"
export const CHRONICLE_PORTFOLIO_VERSION_V0 = "chronicle_portfolio.v0"

export type ChronicleEntryV0 = {
  schema: typeof CHRONICLE_ENTRY_VERSION_V0
  entry_id: string
  source_system: string
  receipt_root: string
  proof_object_ref: string
  evidence_capsule_ref: string
  provenance_summary_ref: string
  created_from: string | null
  labels: string[]
  notes: string | null
}

export type ChroniclePortfolioV0 = {
  schema: typeof CHRONICLE_PORTFOLIO_VERSION_V0
  portfolio_version: typeof CHRONICLE_PORTFOLIO_VERSION_V0
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

export function createChronicleEntryV0(
  proofObject: PortableProofObjectV0,
  options?: {
    entryId?: string
    evidenceCapsuleRef?: string
    provenanceSummaryRef?: string
    createdFrom?: string | null
    labels?: string[]
    notes?: string | null
  },
): ChronicleEntryV0 {
  return {
    schema: CHRONICLE_ENTRY_VERSION_V0,
    entry_id: options?.entryId ?? `entry-${proofObject.proof_object_id}`,
    source_system: proofObject.proof_system,
    receipt_root: proofObject.receipt_root,
    proof_object_ref: proofObject.proof_ref,
    evidence_capsule_ref: options?.evidenceCapsuleRef ?? `embedded:${proofObject.proof_object_id}:evidence_capsule`,
    provenance_summary_ref: options?.provenanceSummaryRef ?? `embedded:${proofObject.proof_object_id}:provenance_summary`,
    created_from: options?.createdFrom ?? proofObject.source_evidence_ref ?? null,
    labels: Array.isArray(options?.labels) ? options!.labels.filter((value): value is string => typeof value === "string") : [],
    notes: typeof options?.notes === "string" ? options.notes : null,
  }
}

export function sortCollectionRefs(collectionRefs: string[]): string[] {
  return [...collectionRefs].sort((a, b) => a.localeCompare(b))
}

export function deriveCollectionRefsFromChronicleEntry(entry: ChronicleEntryV0): string[] {
  return Array.from(new Set(sortCollectionRefs([entry.entry_id])))
}

function derivePortfolioId(collectionRefs: string[]): string {
  const seed = canonicalize({
    portfolio_version: CHRONICLE_PORTFOLIO_VERSION_V0,
    collection_refs: sortCollectionRefs(collectionRefs),
  })
  return `portfolio-${sha256(seed).slice(0, 24)}`
}

export function computeChroniclePortfolioRoot(input: Pick<ChroniclePortfolioV0, "portfolio_version" | "portfolio_id" | "collection_refs">): string {
  return `sha256:${sha256(canonicalize({
    portfolio_version: input.portfolio_version,
    portfolio_id: input.portfolio_id,
    collection_refs: sortCollectionRefs(input.collection_refs),
  }))}`
}

export function createChroniclePortfolioV0(
  entryOrEntries: ChronicleEntryV0 | ChronicleEntryV0[],
  options?: { portfolioId?: string; collectionRefs?: string[] },
): ChroniclePortfolioV0 {
  const entries = Array.isArray(entryOrEntries) ? entryOrEntries : [entryOrEntries]
  if (entries.length === 0) {
    throw new Error("createChroniclePortfolioV0 requires one or more chronicle entries")
  }

  const collectionRefs = sortCollectionRefs(options?.collectionRefs ?? entries.flatMap(deriveCollectionRefsFromChronicleEntry))
  const portfolioId = options?.portfolioId ?? derivePortfolioId(collectionRefs)

  return {
    schema: CHRONICLE_PORTFOLIO_VERSION_V0,
    portfolio_version: CHRONICLE_PORTFOLIO_VERSION_V0,
    portfolio_id: portfolioId,
    collection_refs: collectionRefs,
    portfolio_root: computeChroniclePortfolioRoot({
      portfolio_version: CHRONICLE_PORTFOLIO_VERSION_V0,
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
