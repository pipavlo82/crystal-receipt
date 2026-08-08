import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { auditPackage } from "../../conformance/verifier-challenge-chronicle-sequence-gap-rejected-v0/audit_package"
import {
  evaluateChronicleCheckpointContinuityV0,
  verifyChronicleCheckpointV0,
} from "../../src/receiptos"
import type { ChronicleCheckpointV0 } from "../../src/receiptos"

const root = resolve(import.meta.dir, "../..")
const pkg = "conformance/verifier-challenge-chronicle-sequence-gap-rejected-v0"
const vector = JSON.parse(
  readFileSync(resolve(root, `${pkg}/vectors/V-CHRONICLE-SEQUENCE-GAP.json`), "utf8"),
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

describe("verifier-challenge-chronicle-sequence-gap-rejected-v0 package", () => {
  test("independent package audit reconstructs inventory and expected-result digests", () => {
    const result = auditPackage()
    expect(result.production_imports).toBe(0)
    expect(result).toEqual(
      JSON.parse(readFileSync(resolve(root, `${pkg}/typescript-audit-output.json`), "utf8")),
    )
  })

  test("frozen vector binds evaluateChronicleCheckpointContinuityV0 sequence gap rejection", () => {
    const fixture = loadFixture()
    const validSuccessor = findVector(fixture, vector.source_fixture.baseline_vector_name)
    const sequenceGap = findVector(fixture, vector.source_fixture.precedent_vector_name)

    expect(validSuccessor.current).toEqual(vector.baseline_pair.current)
    expect(validSuccessor.predecessor).toEqual(vector.baseline_pair.predecessor)
    expect(sequenceGap.current).toEqual(vector.challenged_pair.current)

    const baselineCurrent = structuredClone(validSuccessor.current)
    const challengedCurrent = structuredClone(sequenceGap.current)
    const predecessor = structuredClone(validSuccessor.predecessor!)

    const baselineCurrentVerify = verifyChronicleCheckpointV0(baselineCurrent)
    expect(baselineCurrentVerify.ok).toBe(true)
    expect(baselineCurrentVerify).toEqual(vector.local_verification_controls.baseline_current)

    const predecessorVerify = verifyChronicleCheckpointV0(predecessor)
    expect(predecessorVerify.ok).toBe(true)
    expect(predecessorVerify).toEqual(vector.local_verification_controls.predecessor)

    const baselineContinuity = evaluateChronicleCheckpointContinuityV0(baselineCurrent, predecessor)
    expect(baselineContinuity).toEqual(vector.expected.baseline_continuity)
    expect(baselineContinuity).toEqual({
      evaluation_state: "evaluated",
      verdict: "valid",
      relation: "successor",
      reason_code: "direct_successor",
    })

    expect(predecessor).toEqual(vector.challenged_pair.predecessor)
    expect(challengedCurrent).toEqual(vector.challenged_pair.current)
    expect(challengedCurrent.prev_checkpoint).toBe(predecessor.checkpoint_root)
    expect(predecessor.sequence).toBeLessThan(challengedCurrent.sequence - 1)

    const challengedCurrentVerify = verifyChronicleCheckpointV0(challengedCurrent)
    expect(challengedCurrentVerify.ok).toBe(true)
    expect(challengedCurrentVerify).toEqual(vector.local_verification_controls.challenged_current)

    const challengedContinuity = evaluateChronicleCheckpointContinuityV0(challengedCurrent, predecessor)
    expect(challengedContinuity).toEqual(vector.expected.challenged_continuity)
    expect(challengedContinuity).toEqual({
      evaluation_state: "evaluated",
      verdict: "invalid",
      relation: null,
      reason_code: "sequence_gap",
    })

    expect(vector.continuity_profile.challenged_first_classifying_gate).toBe("sequence_gap")
    expect(vector.expected.predecessor_ref_gate_passes).toBe(true)
    expect(vector.expected.sequence_gate_is_first_classifying_failure).toBe(true)

    expect(evaluateChronicleCheckpointContinuityV0(sequenceGap.current, sequenceGap.predecessor)).toEqual(
      sequenceGap.expected,
    )
    expect(sequenceGap.expected.reason_code).toBe("sequence_gap")
  })
})
