import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { canonicalize, sha256 } from "../../src/receiptos"
import { auditPackage } from "../../conformance/verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0/audit_package"
import {
  createChronicleCheckpointV0,
  sortEntryRefs,
  verifyChronicleCheckpointV0,
  type ChronicleCheckpointV0,
} from "../../src/receiptos"

const root = resolve(import.meta.dir, "../..")
const pkg = "conformance/verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0"
const vector = JSON.parse(
  readFileSync(resolve(root, `${pkg}/vectors/V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH.json`), "utf8"),
)

const BASELINE_ROOT = "sha256:32423e924c8f5e540bf7a36e2e2f969eb07e537885688e1affda37b5be808e87"
const CHALLENGED_ROOT = "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

function buildBaselineFromAuthority(): ChronicleCheckpointV0 {
  const input = vector.baseline_authority.construction_input
  return createChronicleCheckpointV0({
    checkpointId: input.checkpointId,
    collectionRef: input.collectionRef,
    entryRefs: input.entryRefs,
    prevCheckpoint: input.prevCheckpoint,
    sequence: input.sequence,
  })
}

function buildChallengedFromBaseline(baseline: ChronicleCheckpointV0): ChronicleCheckpointV0 {
  return {
    ...baseline,
    checkpoint_root: vector.substitution.challenged_checkpoint_root,
  }
}

function computeCheckpointRootWithEntryRefsExactlyAsStored(input: {
  schema: "chronicle_checkpoint.v0"
  checkpoint_id: string
  collection_ref: string
  entry_refs: string[]
  prev_checkpoint: string | null
  sequence: number
}) {
  return `sha256:${sha256(canonicalize({
    schema: input.schema,
    checkpoint_id: input.checkpoint_id,
    collection_ref: input.collection_ref,
    entry_refs: input.entry_refs,
    prev_checkpoint: input.prev_checkpoint,
    sequence: input.sequence,
  }))}`
}

describe("verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0 package", () => {
  test("independent package audit reconstructs inventory and expected-result digests", () => {
    const result = auditPackage()
    expect(result.production_imports).toBe(0)
    expect(result).toEqual(
      JSON.parse(readFileSync(resolve(root, `${pkg}/typescript-audit-output.json`), "utf8")),
    )
  })

  test("frozen vector binds verifyChronicleCheckpointV0 stored-root integrity rejection", () => {
    const baseline = buildBaselineFromAuthority()
    expect(baseline).toEqual(vector.baseline_checkpoint)

    const baselineCanonical = sortEntryRefs(baseline.entry_refs)
    expect(baseline.entry_refs).toEqual(baselineCanonical)

    const baselineVerification = verifyChronicleCheckpointV0(baseline)
    expect(baselineVerification).toEqual(vector.expected.baseline_verification)
    expect(baselineVerification.ok).toBe(true)
    expect(baselineVerification.checkpoint_root).toBe(BASELINE_ROOT)
    expect(baselineVerification.recomputed_checkpoint_root).toBe(BASELINE_ROOT)

    const challenged = buildChallengedFromBaseline(baseline)
    expect(challenged).toEqual(vector.challenged_checkpoint)

    for (const field of vector.substitution.unchanged_fields) {
      expect(challenged[field as keyof ChronicleCheckpointV0]).toEqual(baseline[field as keyof ChronicleCheckpointV0])
    }

    expect(challenged.entry_refs).toEqual(baseline.entry_refs)
    expect(sortEntryRefs(challenged.entry_refs)).toEqual(baseline.entry_refs)
    expect(challenged.checkpoint_root).toBe(CHALLENGED_ROOT)
    expect(challenged.checkpoint_root).not.toBe(baseline.checkpoint_root)

    expect(() => verifyChronicleCheckpointV0(challenged)).not.toThrow()
    const challengedVerification = verifyChronicleCheckpointV0(challenged)
    expect(challengedVerification).toEqual(vector.expected.challenged_verification)
    expect(challengedVerification.ok).toBe(false)
    expect(challengedVerification.checkpoint_root).toBe(CHALLENGED_ROOT)
    expect(challengedVerification.recomputed_checkpoint_root).toBe(BASELINE_ROOT)
    expect(challengedVerification.checkpoint_root).not.toBe(challengedVerification.recomputed_checkpoint_root)
  })

  test("canonical-order and stored-root integrity predicates are independent", () => {
    const baseline = buildBaselineFromAuthority()
    const noncanonicalRefs = ["entry-gamma", "entry-alpha", "entry-beta"]
    const matchingStoredOrderRoot = computeCheckpointRootWithEntryRefsExactlyAsStored({
      schema: baseline.schema,
      checkpoint_id: baseline.checkpoint_id,
      collection_ref: baseline.collection_ref,
      entry_refs: noncanonicalRefs,
      prev_checkpoint: baseline.prev_checkpoint,
      sequence: baseline.sequence,
    })

    const canonicalOrderFailure = {
      ...baseline,
      entry_refs: noncanonicalRefs,
      checkpoint_root: matchingStoredOrderRoot,
    }

    expect(sortEntryRefs(canonicalOrderFailure.entry_refs)).not.toEqual(canonicalOrderFailure.entry_refs)
    const result = verifyChronicleCheckpointV0(canonicalOrderFailure)
    expect(result.ok).toBe(false)
    expect(result.checkpoint_root).toBe(result.recomputed_checkpoint_root)

    const rootIntegrityFailure = buildChallengedFromBaseline(baseline)
    const rootResult = verifyChronicleCheckpointV0(rootIntegrityFailure)
    expect(rootResult.ok).toBe(false)
    expect(rootResult.checkpoint_root).not.toBe(rootResult.recomputed_checkpoint_root)
    expect(sortEntryRefs(rootIntegrityFailure.entry_refs)).toEqual(rootIntegrityFailure.entry_refs)
  })
})
