import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import {
  COUNTERFACTUAL_NEIGHBORHOOD_CONFORMANCE_EVALUATION_SCHEMA,
  COUNTERFACTUAL_NEIGHBORHOOD_CONFORMANCE_REQUEST_SCHEMA,
  COUNTERFACTUAL_NEIGHBORHOOD_MEMBER_CARRIER_SCHEMA,
  NeighborhoodConformanceContractError,
  PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0,
  PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0,
  evaluateCounterfactualNeighborhoodConformance,
  type CounterfactualNeighborhoodConformanceRequestV0,
  type NeighborhoodMemberCarrierV0,
} from "../../src/receiptos/challenge/counterfactual-neighborhood-conformance"
import {
  CAB_MANIFEST_HASH_DIFF_EVALUATION_REQUEST_SCHEMA,
  evaluateCabManifestHashDiffConformance,
} from "../../src/receiptos/challenge/counterfactual-cab-manifest-hash-diff-evaluator"
import { ExpectedResultSetBindingError } from "../../src/receiptos/challenge/counterfactual-expected-result-set"
import {
  COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
  VERIFY_HANDOFF_ADAPTER_IDENTITY,
  CHRONICLE_ADMISSION_ADAPTER_IDENTITY,
  CHRONICLE_CONTINUITY_ADAPTER_IDENTITY,
  CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY,
  runVerifierChallenge,
} from "../../src/receiptos/challenge/counterfactual-verifier-runner"
import {
  computeFrozenCounterfactualNeighborhoodSha256,
  projectCounterfactualChallengeIdentity,
  canonicalIdentityJson,
  type FrozenCounterfactualNeighborhoodV0,
  type CounterfactualChallengeIdentityV0,
} from "../../src/receiptos/challenge/counterfactual-neighborhood"
import {
  projectVerifierChallengeVector,
  type VerifierChallengeVectorModelV0,
} from "../../src/receiptos/challenge/verifier-challenge-model"
import type { HandoffEvidence } from "../../src/receiptos/schema/types"
import type { PortableProofObjectV0 } from "../../src/receiptos/capsule/portable-proof-object-v0"
import type { ChronicleCheckpointV0 } from "../../src/receiptos/capsule/chronicle-portfolio-v0"

const root = resolve(import.meta.dir, "../..")
const LANE_B_SHA256 = "37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d"

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"))
}

function loadNeighborhood(): FrozenCounterfactualNeighborhoodV0 {
  const fixture = readJson("tests/fixtures/counterfactual-neighborhood-identity-v0/neighborhood.json") as {
    neighborhood: FrozenCounterfactualNeighborhoodV0
    expected_neighborhood_sha256: string
  }
  expect(fixture.expected_neighborhood_sha256).toBe(LANE_B_SHA256)
  return structuredClone(fixture.neighborhood)
}

function identityFromVector(vector: Record<string, unknown>): {
  model: VerifierChallengeVectorModelV0
  challenge: CounterfactualChallengeIdentityV0
} {
  const model = projectVerifierChallengeVector(vector)
  return { model, challenge: projectCounterfactualChallengeIdentity(model) }
}

function ordinary(
  request: import("../../src/receiptos/challenge/counterfactual-verifier-runner").VerifierChallengeRunRequestV0,
): NeighborhoodMemberCarrierV0 {
  return {
    schema: COUNTERFACTUAL_NEIGHBORHOOD_MEMBER_CARRIER_SCHEMA,
    route: "single_vector",
    request,
  }
}

function composite(
  request: import("../../src/receiptos/challenge/counterfactual-cab-manifest-hash-diff-evaluator").CabManifestHashDiffEvaluationRequestV0,
): NeighborhoodMemberCarrierV0 {
  return {
    schema: COUNTERFACTUAL_NEIGHBORHOOD_MEMBER_CARRIER_SCHEMA,
    route: "cab_manifest_hash_diff",
    request,
  }
}

function loadHandoffChallenged(vectorPath: string) {
  const vector = readJson(vectorPath) as Record<string, unknown>
  const { model, challenge } = identityFromVector(vector)
  const source = vector.source_fixture as { repository_path: string }
  const baseline = structuredClone(readJson(source.repository_path)) as HandoffEvidence
  const mutation = vector.mutation as { path: string[]; to: unknown }
  const challenged = structuredClone(baseline) as Record<string, unknown>
  let cursor: Record<string, unknown> = challenged
  for (let i = 0; i < mutation.path.length - 1; i += 1) {
    cursor = cursor[mutation.path[i]!] as Record<string, unknown>
  }
  cursor[mutation.path[mutation.path.length - 1]!] = mutation.to
  return {
    model,
    challenge,
    baseline,
    challenged: challenged as unknown as HandoffEvidence,
    vector,
  }
}

function handoffCarrier(vectorPath: string, evidence: "challenged" | "baseline" = "challenged"): NeighborhoodMemberCarrierV0 {
  const loaded = loadHandoffChallenged(vectorPath)
  return ordinary({
    schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
    surface: "verify_handoff_receipt_root",
    subject: {
      entrypoint: VERIFY_HANDOFF_ADAPTER_IDENTITY.entrypoint,
      module_path: VERIFY_HANDOFF_ADAPTER_IDENTITY.module_path,
      git_blob_oid: VERIFY_HANDOFF_ADAPTER_IDENTITY.git_blob_oid,
    },
    challenge: loaded.challenge,
    lane_a_model: loaded.model,
    input: { evidence: evidence === "challenged" ? loaded.challenged : loaded.baseline },
  })
}

function buildConformantMembers(options?: {
  readonly integrityEvidence?: "challenged" | "baseline"
  readonly manHashSecond?: "differing" | "equal"
  readonly nestInput?: "authentic" | "mismatch"
}): NeighborhoodMemberCarrierV0[] {
  const integrityEvidence = options?.integrityEvidence ?? "challenged"
  const manHashSecond = options?.manHashSecond ?? "differing"
  const nestInput = options?.nestInput ?? "authentic"

  const admission = readJson(
    "conformance/verifier-challenge-chronicle-proof-root-mismatch-rejected-v0/vectors/V-CHRONICLE-PROOF-ROOT-MISMATCH.json",
  ) as Record<string, unknown>
  const { model: admissionModel, challenge: admissionChallenge } = identityFromVector(admission)
  const admissionSource = readJson((admission.source_fixture as { repository_path: string }).repository_path) as {
    input: {
      evidence: HandoffEvidence
      proof_object: PortableProofObjectV0
      options: Record<string, unknown>
    }
  }
  const admissionInput = structuredClone(admissionSource.input)
  admissionInput.proof_object.receipt_root = (admission.mutation as { to: string }).to

  const predecessorUnknown = readJson(
    "conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0/vectors/V-CHRONICLE-PREDECESSOR-UNKNOWN.json",
  ) as Record<string, unknown>
  const { model: puModel, challenge: puChallenge } = identityFromVector(predecessorUnknown)
  const puPair = predecessorUnknown.challenged_pair as {
    current: ChronicleCheckpointV0
    predecessor: ChronicleCheckpointV0 | null
  }

  const sequenceGap = readJson(
    "conformance/verifier-challenge-chronicle-sequence-gap-rejected-v0/vectors/V-CHRONICLE-SEQUENCE-GAP.json",
  ) as Record<string, unknown>
  const { model: sgModel, challenge: sgChallenge } = identityFromVector(sequenceGap)
  const sgPair = sequenceGap.challenged_pair as {
    current: ChronicleCheckpointV0
    predecessor: ChronicleCheckpointV0 | null
  }

  const rootMismatch = readJson(
    "conformance/verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH.json",
  ) as Record<string, unknown>
  const { model: rmModel, challenge: rmChallenge } = identityFromVector(rootMismatch)

  const entryRefs = readJson(
    "conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL.json",
  ) as Record<string, unknown>
  const { model: erModel, challenge: erChallenge } = identityFromVector(entryRefs)

  const nest = readJson("conformance/counterfactual-audit-boundary-v0/vectors/V-AT-NEST-OBJ.json") as Record<
    string,
    unknown
  >
  const { model: nestModel, challenge: nestChallenge } = identityFromVector(nest)

  const man = readJson("conformance/counterfactual-audit-boundary-v0/vectors/V-MAN-HASH-DIFF.json") as {
    inputs: Array<{ value: string }>
  } & Record<string, unknown>
  const { model: manModel, challenge: manChallenge } = identityFromVector(man)
  const firstBytes = man.inputs[0]!.value
  const secondBytes = manHashSecond === "differing" ? man.inputs[1]!.value : firstBytes

  return [
    handoffCarrier(
      "conformance/verifier-challenge-observed-not-validated-v0/vectors/V-OBSERVED-NOT-VALIDATED.json",
    ),
    handoffCarrier(
      "conformance/verifier-challenge-missing-required-input-unverifiable-v0/vectors/V-MISSING-REQUIRED-INPUT.json",
    ),
    handoffCarrier(
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
      integrityEvidence,
    ),
    ordinary({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "chronicle_admission",
      subject: {
        entrypoint: CHRONICLE_ADMISSION_ADAPTER_IDENTITY.entrypoint,
        module_path: CHRONICLE_ADMISSION_ADAPTER_IDENTITY.module_path,
        git_blob_oid: CHRONICLE_ADMISSION_ADAPTER_IDENTITY.git_blob_oid,
      },
      challenge: admissionChallenge,
      lane_a_model: admissionModel,
      input: {
        evidence: admissionInput.evidence,
        proof_object: admissionInput.proof_object,
        options: admissionInput.options as never,
      },
    }),
    ordinary({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "chronicle_continuity",
      subject: {
        entrypoint: CHRONICLE_CONTINUITY_ADAPTER_IDENTITY.entrypoint,
        module_path: CHRONICLE_CONTINUITY_ADAPTER_IDENTITY.module_path,
        git_blob_oid: CHRONICLE_CONTINUITY_ADAPTER_IDENTITY.git_blob_oid,
      },
      challenge: puChallenge,
      lane_a_model: puModel,
      input: { current: puPair.current, predecessor: puPair.predecessor },
    }),
    ordinary({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "chronicle_continuity",
      subject: {
        entrypoint: CHRONICLE_CONTINUITY_ADAPTER_IDENTITY.entrypoint,
        module_path: CHRONICLE_CONTINUITY_ADAPTER_IDENTITY.module_path,
        git_blob_oid: CHRONICLE_CONTINUITY_ADAPTER_IDENTITY.git_blob_oid,
      },
      challenge: sgChallenge,
      lane_a_model: sgModel,
      input: { current: sgPair.current, predecessor: sgPair.predecessor },
    }),
    ordinary({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "chronicle_checkpoint_local",
      subject: {
        entrypoint: CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY.entrypoint,
        module_path: CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY.module_path,
        git_blob_oid: CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY.git_blob_oid,
      },
      challenge: rmChallenge,
      lane_a_model: rmModel,
      input: { checkpoint: rootMismatch.challenged_checkpoint as ChronicleCheckpointV0 },
    }),
    ordinary({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "chronicle_checkpoint_local",
      subject: {
        entrypoint: CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY.entrypoint,
        module_path: CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY.module_path,
        git_blob_oid: CHRONICLE_CHECKPOINT_LOCAL_ADAPTER_IDENTITY.git_blob_oid,
      },
      challenge: erChallenge,
      lane_a_model: erModel,
      input: { checkpoint: entryRefs.challenged_checkpoint as ChronicleCheckpointV0 },
    }),
    ordinary({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge: nestChallenge,
      lane_a_model: nestModel,
      input: {
        value: nestInput === "authentic" ? nest.input : { nested: { value: "tampered" } },
      },
    }),
    composite({
      schema: CAB_MANIFEST_HASH_DIFF_EVALUATION_REQUEST_SCHEMA,
      surface: "counterfactual_audit_boundary",
      evaluation_operation: "manifest_hash_differs",
      challenge: manChallenge,
      lane_a_model: manModel,
      operands: {
        first: { bytes: firstBytes },
        second: { bytes: secondBytes },
      },
    }),
  ]
}

function aggregateRequest(
  neighborhood: FrozenCounterfactualNeighborhoodV0,
  members: NeighborhoodMemberCarrierV0[],
): CounterfactualNeighborhoodConformanceRequestV0 {
  return {
    schema: COUNTERFACTUAL_NEIGHBORHOOD_CONFORMANCE_REQUEST_SCHEMA,
    neighborhood,
    members,
  }
}

describe("counterfactual neighborhood conformance v0 (Lane H)", () => {
  test("pinned inventory is exact 10-member frozen Lane B set", () => {
    const neighborhood = loadNeighborhood()
    expect(neighborhood.members).toHaveLength(10)
    expect(PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0).toHaveLength(10)
    expect(PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0).toBe(LANE_B_SHA256)
    for (let i = 0; i < 10; i += 1) {
      const pinned = PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0[i]!
      const member = neighborhood.members[i]!
      expect(member.package_version).toBe(pinned.package_version)
      expect(member.vector_id).toBe(pinned.vector_id)
      expect(member.surface).toBe(pinned.surface)
    }
    expect(computeFrozenCounterfactualNeighborhoodSha256(neighborhood)).toBe(LANE_B_SHA256)
  })

  test("exact complete frozen neighborhood evaluates aggregate conformant", async () => {
    const neighborhood = loadNeighborhood()
    const members = buildConformantMembers()
    const beforeNeighborhood = structuredClone(neighborhood)
    const beforeMembers = structuredClone(members)
    const result = await evaluateCounterfactualNeighborhoodConformance(
      aggregateRequest(neighborhood, members),
    )
    expect(result.schema).toBe(COUNTERFACTUAL_NEIGHBORHOOD_CONFORMANCE_EVALUATION_SCHEMA)
    expect(result.evaluation_state).toBe("evaluated")
    if (result.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(result.verdict).toBe("conformant")
    expect(result.neighborhood_sha256).toBe(LANE_B_SHA256)
    expect(result.counts).toEqual({
      total_member_count: 10,
      conformant_count: 10,
      nonconformant_count: 0,
      unresolved_count: 0,
    })
    expect(result.members).toHaveLength(10)
    expect(result.members.map((m) => m.vector_id)).toEqual(
      PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0.map((m) => m.vector_id),
    )
    expect(result.members.every((m) => m.verdict === "conformant")).toBe(true)
    const man = result.members.find((m) => m.vector_id === "V-MAN-HASH-DIFF")!
    expect(man.route).toBe("cab_manifest_hash_diff")
    const nest = result.members.find((m) => m.vector_id === "V-AT-NEST-OBJ")!
    expect(nest.route).toBe("single_vector")
    expect(nest.verdict).toBe("conformant")
    expect(neighborhood).toEqual(beforeNeighborhood)
    expect(members).toEqual(beforeMembers)
    expect(JSON.stringify(result)).not.toContain("clone-stage")
    expect(JSON.stringify(result)).not.toContain("\\n")
    expect(JSON.stringify(result)).not.toMatch(/[A-Za-z]:\\/)
  })

  test("equal manifest operands → member and aggregate nonconformant", async () => {
    const result = await evaluateCounterfactualNeighborhoodConformance(
      aggregateRequest(loadNeighborhood(), buildConformantMembers({ manHashSecond: "equal" })),
    )
    expect(result.evaluation_state).toBe("evaluated")
    if (result.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(result.verdict).toBe("nonconformant")
    expect(result.counts.nonconformant_count).toBe(1)
    expect(result.counts.conformant_count).toBe(9)
    expect(result.counts.unresolved_count).toBe(0)
    const man = result.members.find((m) => m.vector_id === "V-MAN-HASH-DIFF")!
    expect(man.verdict).toBe("nonconformant")
    expect(man.mismatch_kind).toBe("cab_manifest_hash_difference_mismatch")
  })

  test("CAB rejection mismatch and ordinary semantic mismatch → aggregate nonconformant", async () => {
    const cabMismatch = await evaluateCounterfactualNeighborhoodConformance(
      aggregateRequest(loadNeighborhood(), buildConformantMembers({ nestInput: "mismatch" })),
    )
    expect(cabMismatch.evaluation_state).toBe("evaluated")
    if (cabMismatch.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(cabMismatch.verdict).toBe("nonconformant")
    expect(cabMismatch.members.find((m) => m.vector_id === "V-AT-NEST-OBJ")!.verdict).toBe("nonconformant")

    const ordinaryMismatch = await evaluateCounterfactualNeighborhoodConformance(
      aggregateRequest(loadNeighborhood(), buildConformantMembers({ integrityEvidence: "baseline" })),
    )
    expect(ordinaryMismatch.evaluation_state).toBe("evaluated")
    if (ordinaryMismatch.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(ordinaryMismatch.verdict).toBe("nonconformant")
    expect(ordinaryMismatch.members.find((m) => m.vector_id === "V-INTEGRITY-MISMATCH")!.verdict).toBe(
      "nonconformant",
    )
  })

  test("multiple nonconformant members keep canonical summary order", async () => {
    const result = await evaluateCounterfactualNeighborhoodConformance(
      aggregateRequest(
        loadNeighborhood(),
        buildConformantMembers({
          integrityEvidence: "baseline",
          manHashSecond: "equal",
          nestInput: "mismatch",
        }),
      ),
    )
    expect(result.evaluation_state).toBe("evaluated")
    if (result.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(result.verdict).toBe("nonconformant")
    expect(result.counts.nonconformant_count).toBe(3)
    expect(result.members.map((m) => m.vector_id)).toEqual(
      PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0.map((m) => m.vector_id),
    )
  })

  test("ordinary input-materialization failure → aggregate unresolved", async () => {
    const members = buildConformantMembers()
    const integrity = members[2]!
    if (integrity.route !== "single_vector") throw new Error("expected ordinary")
    const poisoned = {
      ...integrity,
      request: {
        ...integrity.request,
        input: {
          evidence: Object.defineProperty(structuredClone(integrity.request.input.evidence) as object, "__poison", {
            enumerable: true,
            get() {
              throw new Error("clone-stage diagnostic leak")
            },
          }) as HandoffEvidence,
        },
      },
    }
    members[2] = poisoned
    const result = await evaluateCounterfactualNeighborhoodConformance(
      aggregateRequest(loadNeighborhood(), members),
    )
    expect(result.evaluation_state).toBe("execution_unresolved")
    if (result.evaluation_state !== "execution_unresolved") throw new Error("unreachable")
    expect(result.verdict).toBeNull()
    expect(result.counts.unresolved_count).toBe(1)
    const summary = result.members.find((m) => m.vector_id === "V-INTEGRITY-MISMATCH")!
    expect(summary.evaluation_state).toBe("execution_unresolved")
    expect(summary.failure_stage).toBe("input_materialization")
    expect(JSON.stringify(result)).not.toContain("clone-stage diagnostic leak")
  })

  test("composite first-child failure → unresolved; second child skipped", async () => {
    const members = buildConformantMembers()
    const man = members[9]!
    if (man.route !== "cab_manifest_hash_diff") throw new Error("expected composite")
    let firstReads = 0
    let secondReads = 0
    const firstBytes = (man.request.operands.first as { bytes: string }).bytes
    const secondBytes = (man.request.operands.second as { bytes: string }).bytes
    members[9] = {
      ...man,
      request: {
        ...man.request,
        operands: {
          first: {
            get bytes() {
              // reads: aggregate preflight, composite preflight, then Lane D.
              firstReads += 1
              if (firstReads <= 2) return firstBytes
              throw new Error("clone-stage diagnostic leak")
            },
          },
          second: {
            get bytes() {
              secondReads += 1
              return secondBytes
            },
          },
        },
      },
    }
    const result = await evaluateCounterfactualNeighborhoodConformance(
      aggregateRequest(loadNeighborhood(), members),
    )
    expect(result.evaluation_state).toBe("execution_unresolved")
    if (result.evaluation_state !== "execution_unresolved") throw new Error("unreachable")
    expect(result.verdict).toBeNull()
    expect(result.members.find((m) => m.vector_id === "V-MAN-HASH-DIFF")!.failure_stage).toBe(
      "input_materialization",
    )
    expect(firstReads).toBe(3)
    // Aggregate + composite preflight only; Lane D skip rule avoids a third read.
    expect(secondReads).toBe(2)
    expect(JSON.stringify(result)).not.toContain("clone-stage diagnostic leak")
  })

  test("nonconformant plus unresolved → aggregate unresolved with both counts", async () => {
    const members = buildConformantMembers({ integrityEvidence: "baseline" })
    const man = members[9]!
    if (man.route !== "cab_manifest_hash_diff") throw new Error("expected composite")
    let firstReads = 0
    const firstBytes = (man.request.operands.first as { bytes: string }).bytes
    const secondBytes = (man.request.operands.second as { bytes: string }).bytes
    members[9] = {
      ...man,
      request: {
        ...man.request,
        operands: {
          first: {
            get bytes() {
              firstReads += 1
              if (firstReads <= 2) return firstBytes
              throw new Error("clone-stage diagnostic leak")
            },
          },
          second: { bytes: secondBytes },
        },
      },
    }
    const result = await evaluateCounterfactualNeighborhoodConformance(
      aggregateRequest(loadNeighborhood(), members),
    )
    expect(result.evaluation_state).toBe("execution_unresolved")
    if (result.evaluation_state !== "execution_unresolved") throw new Error("unreachable")
    expect(result.verdict).toBeNull()
    expect(result.counts.nonconformant_count).toBe(1)
    expect(result.counts.unresolved_count).toBe(1)
    expect(result.members.find((m) => m.vector_id === "V-INTEGRITY-MISMATCH")!.verdict).toBe("nonconformant")
    expect(result.members.find((m) => m.vector_id === "V-MAN-HASH-DIFF")!.evaluation_state).toBe(
      "execution_unresolved",
    )
  })

  test("missing/duplicate/extra requests and neighborhood mutation fail before execution", async () => {
    const neighborhood = loadNeighborhood()
    const members = buildConformantMembers()
    let materializations = 0
    const poisonedMembers = members.map((member) => {
      if (member.route !== "single_vector" || member.request.surface !== "verify_handoff_receipt_root") {
        return member
      }
      const evidence = member.request.input.evidence
      return {
        ...member,
        request: {
          ...member.request,
          input: {
            evidence: Object.defineProperty(structuredClone(evidence) as object, "__aggregate_preflight_probe", {
              enumerable: true,
              get() {
                materializations += 1
                throw new Error("clone-stage diagnostic leak")
              },
            }) as HandoffEvidence,
          },
        },
      } as NeighborhoodMemberCarrierV0
    })

    try {
      await evaluateCounterfactualNeighborhoodConformance(
        aggregateRequest(neighborhood, poisonedMembers.slice(0, 9)),
      )
      throw new Error("expected missing")
    } catch (error) {
      expect(error).toBeInstanceOf(NeighborhoodConformanceContractError)
      expect((error as NeighborhoodConformanceContractError).reason).toBe("request_missing")
    }
    expect(materializations).toBe(0)

    try {
      await evaluateCounterfactualNeighborhoodConformance(
        aggregateRequest(neighborhood, [...poisonedMembers, poisonedMembers[0]!]),
      )
      throw new Error("expected extra/duplicate")
    } catch (error) {
      expect(error).toBeInstanceOf(NeighborhoodConformanceContractError)
      expect(["request_extra", "request_duplicate"]).toContain(
        (error as NeighborhoodConformanceContractError).reason,
      )
    }
    expect(materializations).toBe(0)

    const dup = [...poisonedMembers]
    dup[1] = {
      schema: COUNTERFACTUAL_NEIGHBORHOOD_MEMBER_CARRIER_SCHEMA,
      route: "single_vector",
      request: poisonedMembers[0]!.route === "single_vector" ? poisonedMembers[0]!.request : (null as never),
    }
    try {
      await evaluateCounterfactualNeighborhoodConformance(aggregateRequest(neighborhood, dup))
      throw new Error("expected duplicate")
    } catch (error) {
      expect(error).toBeInstanceOf(NeighborhoodConformanceContractError)
      expect(["request_duplicate", "request_missing"]).toContain(
        (error as NeighborhoodConformanceContractError).reason,
      )
    }
    expect(materializations).toBe(0)

    const mutated = structuredClone(neighborhood)
    mutated.members[0] = {
      ...mutated.members[0]!,
      vector_id: "V-TAMPERED",
    }
    try {
      await evaluateCounterfactualNeighborhoodConformance(aggregateRequest(mutated, poisonedMembers))
      throw new Error("expected digest/inventory failure")
    } catch (error) {
      expect(error).toBeInstanceOf(NeighborhoodConformanceContractError)
      expect(["neighborhood_inventory_mismatch", "neighborhood_digest_mismatch"]).toContain(
        (error as NeighborhoodConformanceContractError).reason,
      )
    }
    expect(materializations).toBe(0)
  })

  test("wrong package/surface/subject/challenge/composite/expected fail before execution", async () => {
    const neighborhood = loadNeighborhood()
    const members = buildConformantMembers()

    const wrongPackage = structuredClone(members)
    if (wrongPackage[0]!.route !== "single_vector") throw new Error("expected ordinary")
    wrongPackage[0] = {
      ...wrongPackage[0]!,
      request: {
        ...wrongPackage[0]!.request,
        challenge: {
          ...wrongPackage[0]!.request.challenge,
          package_version: "counterfactual-audit-boundary-v0",
        },
        lane_a_model: {
          ...wrongPackage[0]!.request.lane_a_model!,
          package_version: "counterfactual-audit-boundary-v0",
        },
      },
    }
    await expect(
      evaluateCounterfactualNeighborhoodConformance(aggregateRequest(neighborhood, wrongPackage)),
    ).rejects.toBeInstanceOf(NeighborhoodConformanceContractError)

    const wrongSubject = structuredClone(members)
    if (wrongSubject[0]!.route !== "single_vector") throw new Error("expected ordinary")
    wrongSubject[0] = {
      ...wrongSubject[0]!,
      request: {
        ...wrongSubject[0]!.request,
        subject: {
          entrypoint: "wrong",
          module_path: VERIFY_HANDOFF_ADAPTER_IDENTITY.module_path,
          git_blob_oid: VERIFY_HANDOFF_ADAPTER_IDENTITY.git_blob_oid,
        },
      },
    }
    try {
      await evaluateCounterfactualNeighborhoodConformance(aggregateRequest(neighborhood, wrongSubject))
      throw new Error("expected subject mismatch")
    } catch (error) {
      expect(error).toBeInstanceOf(NeighborhoodConformanceContractError)
      expect((error as NeighborhoodConformanceContractError).reason).toBe("subject_identity_mismatch")
    }

    const wrongComposite = structuredClone(members)
    if (wrongComposite[9]!.route !== "cab_manifest_hash_diff") throw new Error("expected composite")
    wrongComposite[9] = {
      ...wrongComposite[9]!,
      request: {
        ...wrongComposite[9]!.request,
        schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA as never,
      },
    }
    try {
      await evaluateCounterfactualNeighborhoodConformance(aggregateRequest(neighborhood, wrongComposite))
      throw new Error("expected wrong composite schema")
    } catch (error) {
      expect(error).toBeInstanceOf(NeighborhoodConformanceContractError)
      expect((error as NeighborhoodConformanceContractError).reason).toBe("wrong_composite_schema")
    }

    const badOperands = structuredClone(members)
    if (badOperands[9]!.route !== "cab_manifest_hash_diff") throw new Error("expected composite")
    badOperands[9] = {
      ...badOperands[9]!,
      request: {
        ...badOperands[9]!.request,
        operands: {
          first: { bytes: (badOperands[9]!.request.operands.first as { bytes: string }).bytes },
        } as never,
      },
    }
    try {
      await evaluateCounterfactualNeighborhoodConformance(aggregateRequest(neighborhood, badOperands))
      throw new Error("expected malformed composite")
    } catch (error) {
      expect(error).toBeInstanceOf(NeighborhoodConformanceContractError)
      expect((error as NeighborhoodConformanceContractError).reason).toBe(
        "malformed_manifest_difference_carrier",
      )
    }

    const mutatedExpected = structuredClone(members)
    if (mutatedExpected[2]!.route !== "single_vector") throw new Error("expected ordinary")
    const model = structuredClone(mutatedExpected[2]!.request.lane_a_model!)
    ;(model.expected as { challenged_verification: { ok: boolean } }).challenged_verification.ok = true
    mutatedExpected[2] = {
      ...mutatedExpected[2]!,
      request: {
        ...mutatedExpected[2]!.request,
        lane_a_model: model,
      },
    }
    await expect(
      evaluateCounterfactualNeighborhoodConformance(aggregateRequest(neighborhood, mutatedExpected)),
    ).rejects.toBeInstanceOf(ExpectedResultSetBindingError)

    const cross = structuredClone(members)
    if (cross[2]!.route !== "single_vector" || cross[0]!.route !== "single_vector") throw new Error("ordinary")
    cross[2] = {
      ...cross[2]!,
      request: {
        ...cross[2]!.request,
        lane_a_model: {
          ...cross[2]!.request.lane_a_model!,
          expected: structuredClone(cross[0]!.request.lane_a_model!.expected),
        },
      },
    }
    await expect(
      evaluateCounterfactualNeighborhoodConformance(aggregateRequest(neighborhood, cross)),
    ).rejects.toBeInstanceOf(ExpectedResultSetBindingError)
  })

  test("caller reorder and repeated runs are byte-identical; Lane D expected independence", async () => {
    const neighborhood = loadNeighborhood()
    const members = buildConformantMembers()
    const reordered = [...members].reverse()
    const a = await evaluateCounterfactualNeighborhoodConformance(aggregateRequest(neighborhood, members))
    const b = await evaluateCounterfactualNeighborhoodConformance(aggregateRequest(neighborhood, reordered))
    const c = await evaluateCounterfactualNeighborhoodConformance(aggregateRequest(neighborhood, members))
    expect(canonicalIdentityJson(a)).toBe(canonicalIdentityJson(b))
    expect(canonicalIdentityJson(a)).toBe(canonicalIdentityJson(c))

    const integrity = loadHandoffChallenged(
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    )
    const mutatedModel = structuredClone(integrity.model)
    ;(mutatedModel.expected as { challenged_verification: { ok: boolean } }).challenged_verification.ok = true
    const execA = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "verify_handoff_receipt_root",
      subject: integrity.challenge.subject!,
      challenge: integrity.challenge,
      lane_a_model: integrity.model,
      input: { evidence: integrity.challenged },
    })
    const execB = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "verify_handoff_receipt_root",
      subject: integrity.challenge.subject!,
      challenge: integrity.challenge,
      lane_a_model: mutatedModel,
      input: { evidence: integrity.challenged },
    })
    expect(execA).toEqual(execB)

    const man = readJson("conformance/counterfactual-audit-boundary-v0/vectors/V-MAN-HASH-DIFF.json") as {
      inputs: Array<{ value: string }>
    } & Record<string, unknown>
    const { model, challenge } = identityFromVector(man)
    const direct = await evaluateCabManifestHashDiffConformance({
      schema: CAB_MANIFEST_HASH_DIFF_EVALUATION_REQUEST_SCHEMA,
      surface: "counterfactual_audit_boundary",
      evaluation_operation: "manifest_hash_differs",
      challenge,
      lane_a_model: model,
      operands: {
        first: { bytes: man.inputs[0]!.value },
        second: { bytes: man.inputs[1]!.value },
      },
    })
    expect(direct.evaluation_state).toBe("evaluated")
    if (direct.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(direct.verdict).toBe("conformant")
  })

  test("Lane B SHA256 and frozen package digests remain unchanged", () => {
    const fixture = readJson("tests/fixtures/counterfactual-neighborhood-identity-v0/neighborhood.json") as {
      neighborhood: FrozenCounterfactualNeighborhoodV0
      expected_neighborhood_sha256: string
    }
    expect(fixture.expected_neighborhood_sha256).toBe(LANE_B_SHA256)
    expect(computeFrozenCounterfactualNeighborhoodSha256(fixture.neighborhood)).toBe(LANE_B_SHA256)
    const py = spawnSync(
      "python",
      [resolve(root, "tests/fixtures/counterfactual-neighborhood-identity-v0/verify_independent.py")],
      { cwd: root, encoding: "utf8" },
    )
    expect(py.status).toBe(0)
    expect(py.stdout.trim()).toBe(LANE_B_SHA256)

    const checks: Array<{ packageDir: string; fixture: string; child?: string; expected?: string }> = [
      {
        packageDir: "conformance/counterfactual-audit-boundary-v0",
        fixture: "7503d5cac003a23489f194c5521ef90b01ac0b2ce345a2cec57ad12ffeb274f8",
        expected: "db664c5e8da2f0fb6d1d94a036eab572ae2941ffeb5193624365d4bdbaeec24a",
      },
      {
        packageDir: "conformance/verifier-challenge-set-v0",
        fixture: "6a4f84a109f633559c7df2e9dd86092e00ce52a81c4a3dcd46c112175748e284",
        child: "945ec30015490b3d92c01177124be5eddcee18b99308d3aed7701fedff67d326",
      },
      {
        packageDir: "conformance/verifier-challenge-chronicle-admission-set-v0",
        fixture: "dbf062131278b8164373725442e069eb53328729058960b52213dd74b78c83c5",
        child: "55c8f203255bf97c40ab76255a95db3447bc2dc30ec961fd65f6a39eba12f22a",
      },
      {
        packageDir: "conformance/verifier-challenge-chronicle-continuity-set-v0",
        fixture: "77261f48e3a712536e3cd37f4384c0b62a5063a3c6be7cf14ac648848feea716",
        child: "4448c728b264cc51d369de7b42430205b9dfdabedb09a282c619e5a42e0d61ac",
      },
      {
        packageDir: "conformance/verifier-challenge-chronicle-checkpoint-local-set-v0",
        fixture: "2c5b171806a253c32495a819d011087c46f4cfb8bad27b0821f6abd280a6ef89",
        child: "5bcdef8fa4fdb24287e29efb273b4e1998e443047ea1251ec12e3c8097269e28",
      },
    ]
    for (const check of checks) {
      const manifest = readJson(`${check.packageDir}/manifest.json`) as { fixture_set_sha256: string }
      expect(manifest.fixture_set_sha256).toBe(check.fixture)
      const contract = readJson(`${check.packageDir}/contract.json`) as Record<string, unknown>
      if (check.expected) expect(contract.expected_result_set_sha256).toBe(check.expected)
      if (check.child) {
        const child =
          contract.child_identity_set_sha256 ??
          (contract.aggregate as { child_identity_set_sha256?: string } | undefined)
            ?.child_identity_set_sha256
        expect(child).toBe(check.child)
      }
    }
  })
})
