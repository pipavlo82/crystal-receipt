import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { auditPackage } from "../../conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0/audit_package"
import {
  createChronicleCheckpointV0,
  sortEntryRefs,
  verifyChronicleCheckpointV0,
  type ChronicleCheckpointV0,
} from "../../src/receiptos"

const root = resolve(import.meta.dir, "../..")
const pkg = "conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0"
const vector = JSON.parse(
  readFileSync(resolve(root, `${pkg}/vectors/V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL.json`), "utf8"),
)

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
    entry_refs: [...vector.substitution.challenged_entry_refs],
  }
}

describe("verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0 package", () => {
  test("independent package audit reconstructs inventory and expected-result digests", () => {
    const result = auditPackage()
    expect(result.production_imports).toBe(0)
    expect(result).toEqual(
      JSON.parse(readFileSync(resolve(root, `${pkg}/typescript-audit-output.json`), "utf8")),
    )
  })

  test("frozen vector binds verifyChronicleCheckpointV0 non-canonical entry_refs rejection", () => {
    const baseline = buildBaselineFromAuthority()
    expect(baseline).toEqual(vector.baseline_checkpoint)

    const baselineCanonical = sortEntryRefs(baseline.entry_refs)
    expect(baseline.entry_refs).toEqual(baselineCanonical)
    expect(baseline.entry_refs).toEqual(vector.substitution.baseline_entry_refs)

    const baselineVerification = verifyChronicleCheckpointV0(baseline)
    expect(baselineVerification).toEqual(vector.expected.baseline_verification)
    expect(baselineVerification.ok).toBe(true)

    const challenged = buildChallengedFromBaseline(baseline)
    expect(challenged).toEqual(vector.challenged_checkpoint)

    for (const field of vector.substitution.unchanged_fields) {
      expect(challenged[field as keyof ChronicleCheckpointV0]).toEqual(baseline[field as keyof ChronicleCheckpointV0])
    }

    expect([...challenged.entry_refs].sort()).toEqual([...baseline.entry_refs].sort())
    expect(challenged.entry_refs).not.toEqual(baseline.entry_refs)
    expect(challenged.entry_refs).toEqual(vector.substitution.challenged_entry_refs)

    const challengedCanonical = sortEntryRefs(challenged.entry_refs)
    expect(challenged.entry_refs).not.toEqual(challengedCanonical)
    expect(challengedCanonical).toEqual(baseline.entry_refs)

    expect(challenged.checkpoint_root).toBe(baseline.checkpoint_root)

    expect(() => verifyChronicleCheckpointV0(challenged)).not.toThrow()
    const challengedVerification = verifyChronicleCheckpointV0(challenged)
    expect(challengedVerification).toEqual(vector.expected.challenged_verification)
    expect(challengedVerification.ok).toBe(false)
    expect(challengedVerification.checkpoint_root).toBe(baseline.checkpoint_root)
    expect(challengedVerification.recomputed_checkpoint_root).not.toBe(challenged.checkpoint_root)
    expect(challengedVerification.recomputed_checkpoint_root).not.toBe(baselineVerification.recomputed_checkpoint_root)
  })
})
