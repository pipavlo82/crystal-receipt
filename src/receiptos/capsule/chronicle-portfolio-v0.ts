import { canonicalize } from "../canon/canonicalize"
import { sha256 } from "../canon/receipt-root"
import type { PortableProofObjectV0 } from "./portable-proof-object-v0"

export const CHRONICLE_ENTRY_VERSION_V0 = "chronicle_entry.v0"
export const CHRONICLE_COLLECTION_VERSION_V0 = "chronicle.collection.v0"
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

export type ChronicleCollectionV0 = {
  schema: typeof CHRONICLE_COLLECTION_VERSION_V0
  collection_version: typeof CHRONICLE_COLLECTION_VERSION_V0
  collection_id: string
  artifact_refs: string[]
  collection_root: string
  metadata?: Record<string, unknown>
}

export type ChroniclePortfolioV0 = {
  schema: typeof CHRONICLE_PORTFOLIO_VERSION_V0
  portfolio_version: typeof CHRONICLE_PORTFOLIO_VERSION_V0
  portfolio_id: string
  collection_refs: string[]
  portfolio_root: string
  metadata?: Record<string, unknown>
}

export type ChronicleCollectionVerification = {
  ok: boolean
  collection_root: string
  recomputed_collection_root: string
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

export function sortArtifactRefs(artifactRefs: string[]): string[] {
  return [...artifactRefs].sort((a, b) => a.localeCompare(b))
}

export function deriveArtifactRefsFromChronicleEntry(entry: ChronicleEntryV0): string[] {
  return Array.from(new Set(sortArtifactRefs([entry.entry_id])))
}

export function deriveCollectionRefFromChronicleCollection(collection: ChronicleCollectionV0): string {
  return `/collection/${encodeURIComponent(collection.collection_id)}`
}

function deriveCollectionId(artifactRefs: string[]): string {
  const seed = canonicalize({
    collection_version: CHRONICLE_COLLECTION_VERSION_V0,
    artifact_refs: sortArtifactRefs(artifactRefs),
  })
  return `collection-${sha256(seed).slice(0, 24)}`
}

function derivePortfolioId(collectionRefs: string[]): string {
  const seed = canonicalize({
    portfolio_version: CHRONICLE_PORTFOLIO_VERSION_V0,
    collection_refs: sortCollectionRefs(collectionRefs),
  })
  return `portfolio-${sha256(seed).slice(0, 24)}`
}

export function computeChronicleCollectionRoot(input: Pick<ChronicleCollectionV0, "collection_version" | "collection_id" | "artifact_refs">): string {
  return `sha256:${sha256(canonicalize({
    collection_version: input.collection_version,
    collection_id: input.collection_id,
    artifact_refs: sortArtifactRefs(input.artifact_refs),
  }))}`
}

export function computeChroniclePortfolioRoot(input: Pick<ChroniclePortfolioV0, "portfolio_version" | "portfolio_id" | "collection_refs">): string {
  return `sha256:${sha256(canonicalize({
    portfolio_version: input.portfolio_version,
    portfolio_id: input.portfolio_id,
    collection_refs: sortCollectionRefs(input.collection_refs),
  }))}`
}

export function createChronicleCollectionV0(
  entryOrEntries: ChronicleEntryV0 | ChronicleEntryV0[],
  options?: { collectionId?: string; artifactRefs?: string[] },
): ChronicleCollectionV0 {
  const entries = Array.isArray(entryOrEntries) ? entryOrEntries : [entryOrEntries]
  if (entries.length === 0) {
    throw new Error("createChronicleCollectionV0 requires one or more chronicle entries")
  }

  const artifactRefs = sortArtifactRefs(options?.artifactRefs ?? entries.flatMap(deriveArtifactRefsFromChronicleEntry))
  const collectionId = options?.collectionId ?? deriveCollectionId(artifactRefs)

  return {
    schema: CHRONICLE_COLLECTION_VERSION_V0,
    collection_version: CHRONICLE_COLLECTION_VERSION_V0,
    collection_id: collectionId,
    artifact_refs: artifactRefs,
    collection_root: computeChronicleCollectionRoot({
      collection_version: CHRONICLE_COLLECTION_VERSION_V0,
      collection_id: collectionId,
      artifact_refs: artifactRefs,
    }),
  }
}

export function verifyChronicleCollectionV0(collection: ChronicleCollectionV0): ChronicleCollectionVerification {
  const recomputedCollectionRoot = computeChronicleCollectionRoot({
    collection_version: collection.collection_version,
    collection_id: collection.collection_id,
    artifact_refs: collection.artifact_refs,
  })

  return {
    ok: collection.collection_root === recomputedCollectionRoot,
    collection_root: collection.collection_root,
    recomputed_collection_root: recomputedCollectionRoot,
  }
}

export function createChroniclePortfolioV0(
  collectionOrCollections: ChronicleCollectionV0 | ChronicleCollectionV0[],
  options?: { portfolioId?: string; collectionRefs?: string[] },
): ChroniclePortfolioV0 {
  const collections = Array.isArray(collectionOrCollections) ? collectionOrCollections : [collectionOrCollections]
  if (collections.length === 0) {
    throw new Error("createChroniclePortfolioV0 requires one or more chronicle collections")
  }

  const collectionRefs = sortCollectionRefs(options?.collectionRefs ?? collections.map(deriveCollectionRefFromChronicleCollection))
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
