import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { auditPackage } from "../../conformance/verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0/audit_package"
import {
  evaluateChronicleCheckpointContinuityV0,
  verifyChronicleCheckpointV0,
} from "../../src/receiptos"
import type { ChronicleCheckpointV0 } from "../../src/receiptos"

const root = resolve(import.meta.dir, "../..")
const pkg = "conformance/verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0"
const vector = JSON.parse(
  readFileSync(resolve(root, `${pkg}/vectors/V-CHRONICLE-PREDECESSOR-REF-MISMATCH.json`), "utf8"),
)

type ContinuityVector = {
  name: string
  current: ChronicleCheckpointV0
  predecessor: ChronicleCheckpointV0 | null
  expected: {
    evaluation_state: string
    verdict: string | null
    relation: string | null
    reason_code: string
  }
}

type ContinuityFixture = {
  profile: string
  description: string
  vectors: ContinuityVector[]
}

function loadFixture(): ContinuityFixture {
  return JSON.parse(
    readFileSync(resolve(root, vector.source_fixture.repository_path), "utf8"),
  ) as ContinuityFixture
}

function findVector(fixture: ContinuityFixture, name: string): ContinuityVector {
  const match = fixture.vectors.find((entry) => entry.name === name)
  if (!match) {
    throw new Error(`expected fixture to contain vector ${name}`)
  }
  return match
}

describe("verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0 package", () => {
  test("independent package audit reconstructs inventory and expected-result digests", () => {
    const result = auditPackage()
    expect(result.production_imports).toBe(0)
    expect(result).toEqual(
      JSON.parse(readFileSync(resolve(root, `${pkg}/typescript-audit-output.json`), "utf8")),
    )
  })

  test("frozen vector binds evaluateChronicleCheckpointContinuityV0 predecessor ref mismatch rejection", () => {
    const fixture = loadFixture()
    const validSuccessor = findVector(fixture, vector.source_fixture.baseline_vector_name)
    const precedent = findVector(fixture, vector.source_fixture.precedent_vector_name)

    expect(validSuccessor.current).toEqual(vector.baseline_pair.current)
    expect(validSuccessor.predecessor).toEqual(vector.baseline_pair.predecessor)
    expect(precedent.predecessor).toEqual(vector.challenged_pair.predecessor)

    const current = structuredClone(validSuccessor.current)
    const baselinePredecessor = structuredClone(validSuccessor.predecessor!)
    const challengedPredecessor = structuredClone(precedent.predecessor!)

    const currentVerify = verifyChronicleCheckpointV0(current)
    expect(currentVerify.ok).toBe(true)
    expect(currentVerify).toEqual(vector.local_verification_controls.current)

    const baselinePredecessorVerify = verifyChronicleCheckpointV0(baselinePredecessor)
    expect(baselinePredecessorVerify.ok).toBe(true)
    expect(baselinePredecessorVerify).toEqual(vector.local_verification_controls.baseline_predecessor)

    const baselineContinuity = evaluateChronicleCheckpointContinuityV0(current, baselinePredecessor)
    expect(baselineContinuity).toEqual(vector.expected.baseline_continuity)
    expect(baselineContinuity).toEqual({
      evaluation_state: "evaluated",
      verdict: "valid",
      relation: "successor",
      reason_code: "direct_successor",
    })

    expect(current).toEqual(vector.challenged_pair.current)
    expect(current.prev_checkpoint).not.toBe(challengedPredecessor.checkpoint_root)
    expect(current.prev_checkpoint).toBe(baselinePredecessor.checkpoint_root)

    const challengedPredecessorVerify = verifyChronicleCheckpointV0(challengedPredecessor)
    expect(challengedPredecessorVerify.ok).toBe(true)
    expect(challengedPredecessorVerify).toEqual(vector.local_verification_controls.challenged_predecessor)

    const challengedContinuity = evaluateChronicleCheckpointContinuityV0(current, challengedPredecessor)
    expect(challengedContinuity).toEqual(vector.expected.challenged_continuity)
    expect(challengedContinuity).toEqual({
      evaluation_state: "evaluated",
      verdict: "invalid",
      relation: null,
      reason_code: "predecessor_ref_mismatch",
    })

    expect(challengedPredecessor.sequence).toBe(current.sequence - 1)
    expect(vector.continuity_profile.challenged_first_failure_gate).toBe("predecessor_ref_mismatch")

    const existingMismatch = findVector(fixture, "predecessor_ref_mismatch")
    expect(evaluateChronicleCheckpointContinuityV0(existingMismatch.current, existingMismatch.predecessor)).toEqual(
      existingMismatch.expected,
    )
    expect(existingMismatch.expected.reason_code).toBe("predecessor_ref_mismatch")
  })
})
