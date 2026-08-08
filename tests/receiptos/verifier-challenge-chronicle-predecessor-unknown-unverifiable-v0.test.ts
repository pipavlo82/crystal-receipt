import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { auditPackage } from "../../conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0/audit_package"
import {
  evaluateChronicleCheckpointContinuityV0,
  verifyChronicleCheckpointV0,
} from "../../src/receiptos"
import type { ChronicleCheckpointV0 } from "../../src/receiptos"

const root = resolve(import.meta.dir, "../..")
const pkg = "conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0"
const vector = JSON.parse(
  readFileSync(resolve(root, `${pkg}/vectors/V-CHRONICLE-PREDECESSOR-UNKNOWN.json`), "utf8"),
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

describe("verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0 package", () => {
  test("independent package audit reconstructs inventory and expected-result digests", () => {
    const result = auditPackage()
    expect(result.production_imports).toBe(0)
    expect(result).toEqual(
      JSON.parse(readFileSync(resolve(root, `${pkg}/typescript-audit-output.json`), "utf8")),
    )
  })

  test("frozen vector binds evaluateChronicleCheckpointContinuityV0 predecessor unknown unverifiability", () => {
    const fixture = loadFixture()
    const validSuccessor = findVector(fixture, vector.source_fixture.baseline_vector_name)

    expect(validSuccessor.current).toEqual(vector.baseline_pair.current)
    expect(validSuccessor.predecessor).toEqual(vector.baseline_pair.predecessor)

    const current = structuredClone(validSuccessor.current)
    const baselinePredecessor = structuredClone(validSuccessor.predecessor!)
    const currentBefore = structuredClone(current)

    const currentVerify = verifyChronicleCheckpointV0(current)
    expect(currentVerify.ok).toBe(true)
    expect(currentVerify).toEqual(vector.local_verification_controls.current)
    expect(current.sequence).toBeGreaterThan(0)

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

    expect(current).toEqual(currentBefore)
    expect(current).toEqual(vector.challenged_pair.current)

    const challengedContinuity = evaluateChronicleCheckpointContinuityV0(current, null)
    expect(challengedContinuity).toEqual(vector.expected.challenged_continuity)
    expect(challengedContinuity).toEqual({
      evaluation_state: "unverifiable",
      verdict: null,
      relation: null,
      reason_code: "predecessor_unknown",
    })

    expect(challengedContinuity.verdict).not.toBe("invalid")
    expect(challengedContinuity.evaluation_state).not.toBe("evaluated")
    expect(vector.continuity_profile.challenged_first_failure_gate).toBe("predecessor_unknown")
    expect(vector.expected.predecessor_ref_gate_not_reached).toBe(true)
    expect(vector.expected.sequence_gate_not_reached).toBe(true)
    expect(vector.expected.missing_predecessor_does_not_imply_invalid).toBe(true)

    const precedentUnknown = findVector(fixture, "predecessor_unknown")
    expect(evaluateChronicleCheckpointContinuityV0(precedentUnknown.current, precedentUnknown.predecessor)).toEqual(
      precedentUnknown.expected,
    )
    expect(precedentUnknown.expected).toEqual({
      evaluation_state: "unverifiable",
      verdict: null,
      relation: null,
      reason_code: "predecessor_unknown",
    })
  })
})
