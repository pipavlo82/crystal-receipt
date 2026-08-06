import { describe, expect, test } from "bun:test"
import {
  computeCounterfactualManifestFileSha256,
  computeCounterfactualSemanticArtifactRef,
  validateCounterfactualSemanticArtifact,
} from "../../src/receiptos/challenge/counterfactual-audit-boundary"

const semanticArtifact = {
  challenge_id: "observed_not_validated",
  profile_id: "counterfactual-review-v0",
  expected_conformance_observation: "preserve semantic non-elevation",
}

function reviewManifest(auditTimestamp?: string) {
  return {
    semantic_artifact: structuredClone(semanticArtifact),
    ...(auditTimestamp === undefined ? {} : { audit_timestamp: auditTimestamp }),
  }
}

describe("Counterfactual audit timestamp boundary", () => {
  test("changing only audit_timestamp does not change the semantic artifact reference", () => {
    const earlier = reviewManifest("2026-07-27T12:00:00Z")
    const later = reviewManifest("2026-08-05T12:00:00Z")

    expect(computeCounterfactualSemanticArtifactRef(earlier.semantic_artifact)).toBe(
      computeCounterfactualSemanticArtifactRef(later.semantic_artifact),
    )
  })

  test("removing optional audit_timestamp does not change the semantic artifact reference", () => {
    const timestamped = reviewManifest("2026-08-05T12:00:00Z")
    const untimestamped = reviewManifest()

    expect(computeCounterfactualSemanticArtifactRef(timestamped.semantic_artifact)).toBe(
      computeCounterfactualSemanticArtifactRef(untimestamped.semantic_artifact),
    )
  })

  test("mutating a semantic field changes the semantic artifact reference", () => {
    const baseline = reviewManifest()
    const mutated = reviewManifest()
    mutated.semantic_artifact.expected_conformance_observation = "incorrectly promote observation"

    expect(computeCounterfactualSemanticArtifactRef(mutated.semantic_artifact)).not.toBe(
      computeCounterfactualSemanticArtifactRef(baseline.semantic_artifact),
    )
  })

  test("validator rejects audit_timestamp anywhere in the semantic canonicalization domain", () => {
    expect(() => validateCounterfactualSemanticArtifact({ ...semanticArtifact, audit_timestamp: "2026-08-05T12:00:00Z" }))
      .toThrow("$semantic_artifact.audit_timestamp is non-semantic audit metadata")

    expect(() => validateCounterfactualSemanticArtifact({
      ...semanticArtifact,
      mutation_parameters: { audit_timestamp: "2026-08-05T12:00:00Z" },
    })).toThrow("$semantic_artifact.mutation_parameters.audit_timestamp is non-semantic audit metadata")
  })

  test("manifest file hashes cover timestamp bytes honestly", () => {
    const earlierBytes = `${JSON.stringify(reviewManifest("2026-07-27T12:00:00Z"), null, 2)}\n`
    const laterBytes = `${JSON.stringify(reviewManifest("2026-08-05T12:00:00Z"), null, 2)}\n`
    const earlierHash = computeCounterfactualManifestFileSha256(earlierBytes)
    const laterHash = computeCounterfactualManifestFileSha256(laterBytes)

    expect(earlierBytes).toContain('"audit_timestamp": "2026-07-27T12:00:00Z"')
    expect(laterBytes).toContain('"audit_timestamp": "2026-08-05T12:00:00Z"')
    expect(earlierHash).not.toBe(laterHash)
    expect(earlierHash).toMatch(/^[0-9a-f]{64}$/)
    expect(laterHash).toMatch(/^[0-9a-f]{64}$/)
  })
})
