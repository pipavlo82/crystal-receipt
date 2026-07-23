import { canonicalize } from "../canon/canonicalize"
import { computeReceiptRoot, sha256 } from "../canon/receipt-root"
import type { HandoffEvidence } from "../schema/types"
import { deriveProofObjectId, deriveProofRef } from "./portable-proof-object-v0"
import type { PortableProofObjectV0 } from "./portable-proof-object-v0"

export const CHRONICLE_ENTRY_VERSION_V0 = "chronicle_entry.v0"
export const CHRONICLE_COLLECTION_VERSION_V0 = "chronicle.collection.v0"
export const CHRONICLE_PORTFOLIO_VERSION_V0 = "chronicle_portfolio.v0"
export const CHRONICLE_CHECKPOINT_VERSION_V0 = "chronicle_checkpoint.v0"

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

export type ChronicleCheckpointV0 = {
  schema: typeof CHRONICLE_CHECKPOINT_VERSION_V0
  checkpoint_id: string
  collection_ref: string
  entry_refs: string[]
  prev_checkpoint: string | null
  sequence: number
  checkpoint_root: string
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

export type ChronicleCheckpointVerification = {
  ok: boolean
  checkpoint_root: string
  recomputed_checkpoint_root: string
}

export function createChronicleEntryV0(
  evidence: HandoffEvidence,
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
  // Admission gate: chronicle_entry.v0 MUST NOT be produced from evidence_capsule
  // status/match/ok labels alone (they are consistency signals, not source of
  // truth). The receipt_root is independently recomputed here from the raw
  // evidence using the same canonicalization the capsule/verifier already use.
  const storedRoot = evidence.anchor?.receipt_root ?? null
  if (!storedRoot) {
    throw new Error("createChronicleEntryV0 requires evidence.anchor.receipt_root to be present")
  }

  const recomputedRoot = computeReceiptRoot(evidence)
  if (storedRoot.toLowerCase() !== recomputedRoot.toLowerCase()) {
    throw new Error("createChronicleEntryV0 requires the stored receipt_root to independently recompute (mismatch)")
  }

  if (proofObject.receipt_root.toLowerCase() !== storedRoot.toLowerCase()) {
    throw new Error("createChronicleEntryV0 requires proofObject.receipt_root to equal the verified stored/recomputed receipt_root")
  }

  const verifiedRoot = storedRoot

  // Cross-object consistency: the embedded evidence_capsule must not merely
  // exist -- it must agree with the root we just independently verified.
  // These are consistency assertions layered on top of the independent
  // recomputation above, never a replacement for it.
  const capsuleReceiptRoot = proofObject.evidence_capsule.receipt_root
  if (capsuleReceiptRoot.stored.toLowerCase() !== verifiedRoot.toLowerCase()) {
    throw new Error("createChronicleEntryV0 requires evidence_capsule.receipt_root.stored to equal the verified receipt_root")
  }
  if (capsuleReceiptRoot.computed.toLowerCase() !== recomputedRoot.toLowerCase()) {
    throw new Error("createChronicleEntryV0 requires evidence_capsule.receipt_root.computed to equal the independently recomputed receipt_root")
  }
  if (capsuleReceiptRoot.match !== true || capsuleReceiptRoot.status !== "verified") {
    throw new Error("createChronicleEntryV0 requires evidence_capsule.receipt_root.match/status to be internally consistent with the verified root")
  }

  const verifierResult = proofObject.evidence_capsule.verifier_result
  if (verifierResult.ok !== true || verifierResult.status !== "verified") {
    throw new Error("createChronicleEntryV0 requires evidence_capsule.verifier_result to be internally consistent with a successful independent recomputation")
  }

  // Identity binding: proof_object_id/proof_ref are normatively derived from
  // the verified receipt_root. Reuse the existing derivation helpers rather
  // than a second rule, so this can never drift from createPortableProofObjectV0.
  const expectedProofObjectId = deriveProofObjectId(verifiedRoot)
  if (proofObject.proof_object_id !== expectedProofObjectId) {
    throw new Error("createChronicleEntryV0 requires proofObject.proof_object_id to be the canonical derivation of the verified receipt_root")
  }
  if (proofObject.proof_ref !== deriveProofRef(expectedProofObjectId)) {
    throw new Error("createChronicleEntryV0 requires proofObject.proof_ref to be the canonical derivation of proof_object_id")
  }

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

export function sortEntryRefs(entryRefs: string[]): string[] {
  return [...entryRefs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
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

export function computeChronicleCheckpointRoot(input: Pick<ChronicleCheckpointV0, "schema" | "checkpoint_id" | "collection_ref" | "entry_refs" | "prev_checkpoint" | "sequence">): string {
  return `sha256:${sha256(canonicalize({
    schema: input.schema,
    checkpoint_id: input.checkpoint_id,
    collection_ref: input.collection_ref,
    entry_refs: sortEntryRefs(input.entry_refs),
    prev_checkpoint: input.prev_checkpoint,
    sequence: input.sequence,
  }))}`
}

function computeChronicleCheckpointRootFromStoredOrder(input: Pick<ChronicleCheckpointV0, "schema" | "checkpoint_id" | "collection_ref" | "entry_refs" | "prev_checkpoint" | "sequence">): string {
  return `sha256:${sha256(canonicalize({
    schema: input.schema,
    checkpoint_id: input.checkpoint_id,
    collection_ref: input.collection_ref,
    entry_refs: [...input.entry_refs],
    prev_checkpoint: input.prev_checkpoint,
    sequence: input.sequence,
  }))}`
}

function validateChronicleCheckpointShape(input: {
  prevCheckpoint?: string | null
  sequence: number
}) {
  if (!Number.isInteger(input.sequence)) {
    throw new Error("chronicle_checkpoint.v0 sequence must be an integer")
  }
  if (input.sequence < 0) {
    throw new Error("chronicle_checkpoint.v0 sequence must be >= 0")
  }
  const prevCheckpoint = input.prevCheckpoint ?? null
  if (input.sequence === 0 && prevCheckpoint !== null) {
    throw new Error("chronicle_checkpoint.v0 sequence 0 requires prev_checkpoint = null")
  }
  if (input.sequence > 0 && prevCheckpoint === null) {
    throw new Error("chronicle_checkpoint.v0 sequence > 0 requires prev_checkpoint")
  }
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

export function createChronicleCheckpointV0(
  input: {
    checkpointId: string
    collectionRef: string
    entryRefs: string[]
    prevCheckpoint?: string | null
    sequence: number
  },
): ChronicleCheckpointV0 {
  validateChronicleCheckpointShape(input)
  const entryRefs = sortEntryRefs(input.entryRefs)
  const prevCheckpoint = input.prevCheckpoint ?? null

  return {
    schema: CHRONICLE_CHECKPOINT_VERSION_V0,
    checkpoint_id: input.checkpointId,
    collection_ref: input.collectionRef,
    entry_refs: entryRefs,
    prev_checkpoint: prevCheckpoint,
    sequence: input.sequence,
    checkpoint_root: computeChronicleCheckpointRoot({
      schema: CHRONICLE_CHECKPOINT_VERSION_V0,
      checkpoint_id: input.checkpointId,
      collection_ref: input.collectionRef,
      entry_refs: entryRefs,
      prev_checkpoint: prevCheckpoint,
      sequence: input.sequence,
    }),
  }
}

export function verifyChronicleCheckpointV0(checkpoint: ChronicleCheckpointV0): ChronicleCheckpointVerification {
  const recomputedCheckpointRoot = computeChronicleCheckpointRootFromStoredOrder({
    schema: checkpoint.schema,
    checkpoint_id: checkpoint.checkpoint_id,
    collection_ref: checkpoint.collection_ref,
    entry_refs: checkpoint.entry_refs,
    prev_checkpoint: checkpoint.prev_checkpoint,
    sequence: checkpoint.sequence,
  })
  const canonicalEntryRefs = sortEntryRefs(checkpoint.entry_refs)
  const entryRefsAreCanonical = checkpoint.entry_refs.length === canonicalEntryRefs.length
    && checkpoint.entry_refs.every((value, index) => value === canonicalEntryRefs[index])

  return {
    ok: checkpoint.checkpoint_root === recomputedCheckpointRoot && entryRefsAreCanonical,
    checkpoint_root: checkpoint.checkpoint_root,
    recomputed_checkpoint_root: recomputedCheckpointRoot,
  }
}
