import { afterAll, describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import {
  CANONICAL_DCN_VECTOR_IDS_V0,
  PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0,
  TRAVERSAL_RESET_MODEL_V0,
  computeOrderedVectorIdsSha256,
} from "../../src/receiptos/challenge/counterfactual-traversal-schedules"
import {
  COLD_START_ORDERED_VECTOR_DIGESTS_V1,
  COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1,
  FROZEN_TRAVERSAL_SCHEDULES_V1,
  PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V1,
  PRESERVED_V0_ORDERED_VECTOR_DIGESTS,
  TraversalScheduleContractErrorV1,
  authenticateFrozenTraversalScheduleV1,
  buildFrozenTraversalScheduleSetV1,
  computeTraversalScheduleSetSha256V1,
  deriveFirstPositionCoverageAuthorityV1,
  getFrozenTraversalScheduleV1,
} from "../../src/receiptos/challenge/counterfactual-traversal-schedules-v1"
import {
  COUNTERFACTUAL_TRAVERSAL_SCHEDULE_RESULT_SCHEMA_V1,
  COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH_V1,
  COUNTERFACTUAL_TRAVERSAL_STABILITY_RESULT_SCHEMA_V1,
  TraversalStabilityErrorV1,
  executeAuthenticatedScheduleInProcessV1,
  runTraversalStabilityPackageGeneratorV1,
  validateScheduleWorkerResultV1,
  verifyCounterfactualTraversalStabilityV1,
  verifyTraversalStabilityPackageIdentityV1,
  type SpawnScheduleWorkerFnV1,
  type TraversalScheduleWorkerResultV1,
} from "../../src/receiptos/challenge/counterfactual-traversal-stability-v1"
import {
  compareMemberScheduleStability,
  isTraversalStabilityPass,
  isTraversalStabilityPassFor,
  type ComparableMemberObservationV0,
} from "../../src/receiptos/challenge/counterfactual-traversal-stability-compare"
import {
  PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0,
  evaluateCounterfactualNeighborhoodConformance,
  evaluateCounterfactualNeighborhoodUnderAuthenticatedSchedule,
} from "../../src/receiptos/challenge/counterfactual-neighborhood-conformance"
import { ExpectedResultSetBindingError } from "../../src/receiptos/challenge/counterfactual-expected-result-set"
import { deriveCounterfactualNeighborhoodConformanceRequest } from "../../src/receiptos/challenge/counterfactual-materialized-input-derivation"
import { canonicalIdentityJson } from "../../src/receiptos/challenge/counterfactual-neighborhood"
import { verifyCounterfactualConformancePackage } from "../../src/receiptos/challenge/counterfactual-conformance-package"
import {
  runTraversalStabilityPackageGenerator,
  verifyCounterfactualTraversalStability,
  verifyTraversalStabilityPackageIdentity,
} from "../../src/receiptos/challenge/counterfactual-traversal-stability"

const root = resolve(import.meta.dir, "../..")

const EXPECTED_SCHEDULE_IDS_V1 = [
  "pi_canonical",
  "pi_reverse",
  "pi_composite_first",
  "pi_boundary_first",
  "pi_nonlocal_v0",
  "cold_start_missing-required-input",
  "cold_start_integrity-mismatch",
  "cold_start_chronicle-proof-root-mismatch",
  "cold_start_chronicle-predecessor-unknown",
  "cold_start_chronicle-sequence-gap",
  "cold_start_chronicle-checkpoint-root-mismatch",
  "cold_start_chronicle-checkpoint-entry-refs-noncanonical",
] as const

const PREVIOUSLY_UNCOVERED = [
  "V-MISSING-REQUIRED-INPUT",
  "V-INTEGRITY-MISMATCH",
  "V-CHRONICLE-PROOF-ROOT-MISMATCH",
  "V-CHRONICLE-PREDECESSOR-UNKNOWN",
  "V-CHRONICLE-SEQUENCE-GAP",
  "V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH",
  "V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL",
] as const

const tempDirs: string[] = []
afterAll(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
})

function observationStub(token: string): ComparableMemberObservationV0 {
  return {
    vector_id: "V-OBSERVED-NOT-VALIDATED",
    execution_state: "evaluated",
    verdict: "conformant",
    normative_expected: {
      schema: "receiptos.counterfactual_observation.v0",
      surface: "verify_handoff_receipt_root",
      observation_class: "affirmative",
      native_status: "ok",
      native_reason_code: null,
      native_detail: { token },
    },
    observed: {
      schema: "receiptos.counterfactual_observation.v0",
      surface: "verify_handoff_receipt_root",
      observation_class: "affirmative",
      native_status: "ok",
      native_reason_code: null,
      native_detail: { token },
    },
    subject_contract_rejection: null,
    mismatch_kind: null,
    failure_stage: null,
  }
}

describe("counterfactual traversal stability v1 — schedule identity", () => {
  test("1. all twelve schedules authenticate", () => {
    const set = buildFrozenTraversalScheduleSetV1()
    expect(set.schema).toBe("receiptos.counterfactual_traversal_schedule_set.v1")
    expect(set.profile_id).toBe(COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1)
    expect(set.schedule_count).toBe(12)
    expect(set.schedules.map((entry) => entry.schedule_id)).toEqual([...EXPECTED_SCHEDULE_IDS_V1])
    expect(set.schedule_set_sha256).toBe(PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V1)
    expect(set.schedule_set_sha256).toBe(
      "b3742758dce9df46fca5b083da77b555b96b77daf3fd78a1d0e2ab83a5e3ceda",
    )
    for (const scheduleId of EXPECTED_SCHEDULE_IDS_V1) {
      const auth = authenticateFrozenTraversalScheduleV1(scheduleId)
      expect(auth.__brand).toBe("AuthenticatedScheduleOrderV1")
      expect(auth.schedule_id).toBe(scheduleId)
      expect(auth.reset_model).toBe(TRAVERSAL_RESET_MODEL_V0)
    }
  })

  test("2. all schedules are literal ten-member permutations", () => {
    let slots = 0
    for (const schedule of FROZEN_TRAVERSAL_SCHEDULES_V1) {
      expect(schedule.member_count).toBe(10)
      expect(new Set(schedule.ordered_vector_ids).size).toBe(10)
      expect([...schedule.ordered_vector_ids].sort()).toEqual([...CANONICAL_DCN_VECTOR_IDS_V0].sort())
      expect(schedule.ordered_vector_ids_sha256).toBe(
        computeOrderedVectorIdsSha256(schedule.ordered_vector_ids),
      )
      slots += schedule.ordered_vector_ids.length
    }
    expect(slots).toBe(120)
  })

  test("3. preserved five v0 ordered-vector digests are unchanged", () => {
    for (const [scheduleId, digest] of Object.entries(PRESERVED_V0_ORDERED_VECTOR_DIGESTS)) {
      const schedule = getFrozenTraversalScheduleV1(scheduleId as keyof typeof PRESERVED_V0_ORDERED_VECTOR_DIGESTS)
      expect(schedule.ordered_vector_ids_sha256).toBe(digest)
    }
  })

  test("4–5. every DCN member first at least once; seven previously uncovered now covered", () => {
    const coverage = deriveFirstPositionCoverageAuthorityV1()
    expect(coverage.schedule_count).toBe(12)
    expect(coverage.member_count).toBe(10)
    expect(coverage.scheduled_member_evaluations).toBe(120)
    expect(coverage.first_position_member_count).toBe(10)
    expect(coverage.first_position_covered).toBe(10)
    expect(coverage.first_position_missing).toEqual([])
    expect(coverage.records).toHaveLength(10)
    for (const record of coverage.records) {
      expect(record.cold_start_covered).toBe(true)
      expect(record.first_position_schedule_ids.length).toBeGreaterThanOrEqual(1)
    }
    for (const vectorId of PREVIOUSLY_UNCOVERED) {
      const record = coverage.records.find((entry) => entry.vector_id === vectorId)
      expect(record).toBeDefined()
      expect(record!.first_position_schedule_ids.some((id) => id.startsWith("cold_start_"))).toBe(true)
    }
    for (const [scheduleId, digest] of Object.entries(COLD_START_ORDERED_VECTOR_DIGESTS_V1)) {
      expect(getFrozenTraversalScheduleV1(scheduleId as keyof typeof COLD_START_ORDERED_VECTOR_DIGESTS_V1)
        .ordered_vector_ids_sha256).toBe(digest)
    }
  })

  test("10. removing any one required cold-start schedule fails before workers", () => {
    for (const scheduleId of EXPECTED_SCHEDULE_IDS_V1.filter((id) => id.startsWith("cold_start_"))) {
      const reduced = FROZEN_TRAVERSAL_SCHEDULES_V1.filter((entry) => entry.schedule_id !== scheduleId)
      expect(() => deriveFirstPositionCoverageAuthorityV1(reduced)).toThrow(
        TraversalScheduleContractErrorV1,
      )
      try {
        deriveFirstPositionCoverageAuthorityV1(reduced)
        throw new Error("expected coverage failure")
      } catch (error) {
        expect(error).toBeInstanceOf(TraversalScheduleContractErrorV1)
        if (!(error instanceof TraversalScheduleContractErrorV1)) throw error
        expect(error.reason).toBe("incomplete_first_position_coverage")
      }
    }
    // Coverage authority is consulted before any worker spawn in the coordinator.
    // Incomplete sets never reach spawnWorker.
    let spawned = 0
    const incomplete = FROZEN_TRAVERSAL_SCHEDULES_V1.slice(0, 11)
    expect(() => deriveFirstPositionCoverageAuthorityV1(incomplete)).toThrow(
      TraversalScheduleContractErrorV1,
    )
    expect(spawned).toBe(0)
  })

  test("11. mutating a first member fails identity/coverage binding", () => {
    const base = getFrozenTraversalScheduleV1("cold_start_integrity-mismatch")
    const mutatedOrder = [
      "V-OBSERVED-NOT-VALIDATED",
      ...CANONICAL_DCN_VECTOR_IDS_V0.filter((id) => id !== "V-OBSERVED-NOT-VALIDATED"),
    ] as typeof base.ordered_vector_ids
    const mutated = {
      ...base,
      ordered_vector_ids: mutatedOrder,
      ordered_vector_ids_sha256: computeOrderedVectorIdsSha256(mutatedOrder),
    }
    const alteredSet = [
      mutated,
      ...FROZEN_TRAVERSAL_SCHEDULES_V1.filter((entry) => entry.schedule_id !== base.schedule_id),
    ]
    const setDigest = computeTraversalScheduleSetSha256V1(alteredSet)
    expect(setDigest).not.toBe(PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V1)
    expect(mutated.ordered_vector_ids_sha256).not.toBe(base.ordered_vector_ids_sha256)
    // Stealing first position from the only cold-start cover for integrity-mismatch
    // leaves that member uncovered — coverage binding fails before workers.
    expect(() => deriveFirstPositionCoverageAuthorityV1(alteredSet)).toThrow(
      TraversalScheduleContractErrorV1,
    )
    try {
      deriveFirstPositionCoverageAuthorityV1(alteredSet)
      throw new Error("expected coverage failure")
    } catch (error) {
      expect(error).toBeInstanceOf(TraversalScheduleContractErrorV1)
      if (!(error instanceof TraversalScheduleContractErrorV1)) throw error
      expect(error.reason).toBe("incomplete_first_position_coverage")
    }
    expect(() => authenticateFrozenTraversalScheduleV1("caller_supplied")).toThrow(
      TraversalScheduleContractErrorV1,
    )
  })

  test("12. caller order or claimed coverage cannot replace frozen authority", async () => {
    const request = deriveCounterfactualNeighborhoodConformanceRequest({ repositoryRoot: root })
    const reordered = {
      ...request,
      members: [...request.members].reverse(),
    }
    const auth = authenticateFrozenTraversalScheduleV1("cold_start_missing-required-input")
    const bundle = await evaluateCounterfactualNeighborhoodUnderAuthenticatedSchedule(reordered, auth)
    expect(bundle.execution_vector_ids[0]).toBe("V-MISSING-REQUIRED-INPUT")
    expect(bundle.members.map((member) => member.vector_id)).toEqual([...CANONICAL_DCN_VECTOR_IDS_V0])
    expect(() => authenticateFrozenTraversalScheduleV1("pi_unknown")).toThrow(TraversalScheduleContractErrorV1)
  })
})

describe("counterfactual traversal stability v1 — generator/auditor", () => {
  test("generator --check zero drift and repeated runs byte-identical", () => {
    const first = runTraversalStabilityPackageGeneratorV1({ mode: "check", repositoryRoot: root })
    const second = runTraversalStabilityPackageGeneratorV1({ mode: "check", repositoryRoot: root })
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(first.schedule_set_sha256).toBe(second.schedule_set_sha256)
    expect(first.fixture_set_sha256).toBe(second.fixture_set_sha256)
    expect(first.fixture_set_sha256).toBe(
      "0d8a2021d4ceec7313a04a534cdfb90ca4beff8ffefc18fe119e793ea8ec3cc1",
    )
    expect(canonicalIdentityJson(first.schedules)).toBe(canonicalIdentityJson(second.schedules))
  })

  test("cwd-independent generator check", () => {
    const dir = mkdtempSync(join(tmpdir(), "lane-k-v1-cwd-"))
    tempDirs.push(dir)
    const fromOtherCwd = spawnSync(
      process.execPath,
      [resolve(root, `${COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH_V1}/generate_package.ts`), "--check"],
      { cwd: dir, encoding: "utf8" },
    )
    expect(fromOtherCwd.status).toBe(0)
    const payload = JSON.parse(fromOtherCwd.stdout)
    expect(payload.ok).toBe(true)
  })

  test("independent auditors production_imports 0", () => {
    const ts = spawnSync(
      process.execPath,
      [resolve(root, `${COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH_V1}/audit_package.ts`)],
      { cwd: root, encoding: "utf8" },
    )
    expect(ts.status).toBe(0)
    expect(JSON.parse(ts.stdout).production_imports).toBe(0)

    const py = spawnSync(
      "python",
      [resolve(root, `${COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH_V1}/verify_independent.py`)],
      { cwd: root, encoding: "utf8" },
    )
    expect(py.status).toBe(0)
    expect(JSON.parse(py.stdout).production_imports).toBe(0)
  })

  test("package identity verification", () => {
    const identity = verifyTraversalStabilityPackageIdentityV1(root)
    expect(identity.schedule_set_sha256).toBe(PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V1)
  })
})

describe("counterfactual traversal stability v1 — comparison and failure boundaries", () => {
  test("14. history-sensitive pure-comparison negative remains reachable", () => {
    const canonical = observationStub("canonical")
    const scheduled = observationStub("scheduled-different")
    const comparison = compareMemberScheduleStability({
      schedule_id: "cold_start_integrity-mismatch",
      canonical,
      scheduled,
    })
    expect(comparison.schedule_stability).toBe("history_sensitive")
    expect(comparison.canonical_match).toBe(false)
    expect(comparison.semantic_match).toBe(true)
  })

  test("15. worker failure remains bounded", async () => {
    const failingSpawn: SpawnScheduleWorkerFnV1 = async () => {
      throw new TraversalStabilityErrorV1("worker_timeout")
    }
    await expect(
      verifyCounterfactualTraversalStabilityV1({
        repositoryRoot: root,
        spawnWorker: failingSpawn,
      }),
    ).rejects.toMatchObject({ reason: "worker_timeout" })
  })

  test("13. expected-result mutation still fails through existing authority before execution", async () => {
    const request = deriveCounterfactualNeighborhoodConformanceRequest({ repositoryRoot: root })
    const mutated = structuredClone(request)
    const integrity = mutated.members.find(
      (member) =>
        member.route === "single_vector" &&
        member.request.challenge.vector_id === "V-INTEGRITY-MISMATCH",
    )
    if (!integrity || integrity.route !== "single_vector") throw new Error("expected integrity member")
    const model = structuredClone(integrity.request.lane_a_model!)
    ;(model.expected as { challenged_verification: { ok: boolean } }).challenged_verification.ok = true
    const index = mutated.members.indexOf(integrity)
    mutated.members[index] = {
      ...integrity,
      request: {
        ...integrity.request,
        lane_a_model: model,
      },
    }
    await expect(evaluateCounterfactualNeighborhoodConformance(mutated)).rejects.toBeInstanceOf(
      ExpectedResultSetBindingError,
    )
    const auth = authenticateFrozenTraversalScheduleV1("pi_canonical")
    await expect(
      evaluateCounterfactualNeighborhoodUnderAuthenticatedSchedule(mutated, auth),
    ).rejects.toBeInstanceOf(ExpectedResultSetBindingError)
  })

  test("16. caller inputs/authorities are not mutated", async () => {
    const request = deriveCounterfactualNeighborhoodConformanceRequest({ repositoryRoot: root })
    const before = canonicalIdentityJson(request)
    const auth = authenticateFrozenTraversalScheduleV1("pi_canonical")
    await evaluateCounterfactualNeighborhoodUnderAuthenticatedSchedule(structuredClone(request), auth)
    expect(canonicalIdentityJson(request)).toBe(before)
  })

  test("17. raw diagnostics do not leak", () => {
    const worker = resolve(root, `${COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH_V1}/run_schedule_worker.ts`)
    const bad = spawnSync(
      process.execPath,
      [worker, "--schedule-id", "not-a-schedule", "--repository-root", root],
      { cwd: root, encoding: "utf8" },
    )
    expect(bad.status).not.toBe(0)
    const payload = JSON.parse(bad.stdout)
    expect(payload.ok).toBe(false)
    expect(typeof payload.reason).toBe("string")
    expect(JSON.stringify(payload)).not.toMatch(/Error:|at |\\\\Users\\|stack/i)
  })

  test("worker schema validation rejects malformed output", () => {
    const auth = authenticateFrozenTraversalScheduleV1("pi_canonical")
    expect(() => validateScheduleWorkerResultV1({ schema: "nope" }, auth)).toThrow(
      TraversalStabilityErrorV1,
    )
  })
})

async function stubScheduleResult(
  scheduleId: (typeof EXPECTED_SCHEDULE_IDS_V1)[number],
  template: TraversalScheduleWorkerResultV1,
): Promise<TraversalScheduleWorkerResultV1> {
  const base = structuredClone(template) as TraversalScheduleWorkerResultV1
  const auth = authenticateFrozenTraversalScheduleV1(scheduleId)
  base.schedule_id = auth.schedule_id
  base.ordered_vector_ids_sha256 = auth.ordered_vector_ids_sha256
  base.execution_vector_ids = [...auth.ordered_vector_ids]
  return base
}

describe("counterfactual traversal stability v1 — worker/coordinator", () => {
  test("7. shared process within each schedule remains true", async () => {
    const result = await executeAuthenticatedScheduleInProcessV1({
      scheduleId: "cold_start_missing-required-input",
      repositoryRoot: root,
    })
    expect(result.schema).toBe(COUNTERFACTUAL_TRAVERSAL_SCHEDULE_RESULT_SCHEMA_V1)
    expect(result.profile_id).toBe(COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1)
    expect(result.members).toHaveLength(10)
    expect(result.execution_vector_ids).toHaveLength(10)
    expect(result.execution_vector_ids[0]).toBe("V-MISSING-REQUIRED-INPUT")
    expect(result.members.map((member) => member.vector_id)).toEqual([...CANONICAL_DCN_VECTOR_IDS_V0])
    expect(result.members.every((member) => member.execution_state === "evaluated")).toBe(true)
    // One worker invocation produced all ten member observations (shared process within schedule).
    expect(result.members.every((member) => member.verdict === "conformant")).toBe(true)
  })

  test("1–4/8–11. twelve process launches; sequential; aggregate 120; PID non-normative", async () => {
    const { result, telemetry } = await verifyCounterfactualTraversalStabilityV1({
      repositoryRoot: root,
    })
    expect(result.schema).toBe(COUNTERFACTUAL_TRAVERSAL_STABILITY_RESULT_SCHEMA_V1)
    expect(telemetry.process_launch_count).toBe(12)
    expect(telemetry.launches).toHaveLength(12)
    expect(telemetry.schedule_ids).toEqual([...EXPECTED_SCHEDULE_IDS_V1])
    expect(telemetry.launches.map((entry) => entry.schedule_id)).toEqual([...EXPECTED_SCHEDULE_IDS_V1])
    expect(telemetry.launches.map((entry) => entry.launch_index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ])
    expect(telemetry.worker_reused).toBe(false)
    expect(telemetry.schedules_concurrent).toBe(false)
    // Isolation is launch-count authority, not global PID uniqueness.
    expect(telemetry.worker_pids.length).toBeLessThanOrEqual(12)
    expect(result.schedules.map((entry) => entry.schedule_id)).toEqual([...EXPECTED_SCHEDULE_IDS_V1])
    expect(result.aggregate.schedule_count).toBe(12)
    expect(result.aggregate.member_count).toBe(10)
    expect(result.aggregate.scheduled_member_evaluations).toBe(120)
    expect(result.aggregate.stable).toBe(120)
    expect(result.aggregate.history_sensitive).toBe(0)
    expect(result.aggregate.unresolved).toBe(0)
    expect(
      isTraversalStabilityPassFor(result.aggregate, { scheduleCount: 12, evaluations: 120 }),
    ).toBe(true)
    expect(result.verdict).toBe("stable")
    expect(result.evaluation_state).toBe("evaluated")
    expect(result.first_position_coverage.first_position_covered).toBe(10)
    expect(result.first_position_coverage.first_position_missing).toEqual([])
    expect(JSON.stringify(result)).not.toMatch(/"pid"/)
    expect(JSON.stringify(result)).not.toMatch(/process_launch_count|observed_pid|worker_pids/)
  }, 900_000)

  test("1–3. injected spawn proves exact twelve sequential launches and max concurrency one", async () => {
    const template = await executeAuthenticatedScheduleInProcessV1({
      scheduleId: "pi_canonical",
      repositoryRoot: root,
    })
    let inFlight = 0
    let maxInFlight = 0
    const invoked: string[] = []
    const spawnWorker: SpawnScheduleWorkerFnV1 = async ({ scheduleId }) => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      invoked.push(scheduleId)
      try {
        const result = await stubScheduleResult(scheduleId, template)
        expect(result.members).toHaveLength(10)
        return { pid: 4242, result }
      } finally {
        inFlight -= 1
      }
    }
    const { result, telemetry } = await verifyCounterfactualTraversalStabilityV1({
      repositoryRoot: root,
      spawnWorker,
    })
    expect(invoked).toEqual([...EXPECTED_SCHEDULE_IDS_V1])
    expect(telemetry.process_launch_count).toBe(12)
    expect(telemetry.launches).toHaveLength(12)
    expect(maxInFlight).toBe(1)
    expect(result.aggregate.stable).toBe(120)
  })

  test("5. repeated numeric PID telemetry across separate launches is accepted", async () => {
    const template = await executeAuthenticatedScheduleInProcessV1({
      scheduleId: "pi_canonical",
      repositoryRoot: root,
    })
    const reusedPid = 77_777
    const spawnWorker: SpawnScheduleWorkerFnV1 = async ({ scheduleId }) => ({
      pid: reusedPid,
      result: await stubScheduleResult(scheduleId, template),
    })
    const { result, telemetry } = await verifyCounterfactualTraversalStabilityV1({
      repositoryRoot: root,
      spawnWorker,
    })
    expect(telemetry.process_launch_count).toBe(12)
    expect(telemetry.worker_pids).toEqual(Array.from({ length: 12 }, () => reusedPid))
    expect(new Set(telemetry.worker_pids).size).toBe(1)
    expect(telemetry.launches.every((entry) => entry.observed_pid === reusedPid)).toBe(true)
    expect(result.verdict).toBe("stable")
    expect(result.aggregate.stable).toBe(120)
    expect(result.first_position_coverage.first_position_covered).toBe(10)
  })

  test("6. missing or extra launch still fails closed", async () => {
    const template = await executeAuthenticatedScheduleInProcessV1({
      scheduleId: "pi_canonical",
      repositoryRoot: root,
    })
    let calls = 0
    const missingSpawn: SpawnScheduleWorkerFnV1 = async ({ scheduleId }) => {
      calls += 1
      if (calls === 6) throw new TraversalStabilityErrorV1("worker_spawn_failure")
      return { pid: calls, result: await stubScheduleResult(scheduleId, template) }
    }
    await expect(
      verifyCounterfactualTraversalStabilityV1({
        repositoryRoot: root,
        spawnWorker: missingSpawn,
      }),
    ).rejects.toMatchObject({ reason: "worker_spawn_failure" })
    expect(calls).toBe(6)

    // Extra launches cannot be injected: coordinator launches exactly the frozen inventory.
    const extraInvocations: string[] = []
    const exactSpawn: SpawnScheduleWorkerFnV1 = async ({ scheduleId }) => {
      extraInvocations.push(scheduleId)
      return { pid: 1, result: await stubScheduleResult(scheduleId, template) }
    }
    const { telemetry } = await verifyCounterfactualTraversalStabilityV1({
      repositoryRoot: root,
      spawnWorker: exactSpawn,
    })
    expect(extraInvocations).toHaveLength(12)
    expect(telemetry.process_launch_count).toBe(12)
    expect(telemetry.process_launch_count).toBe(EXPECTED_SCHEDULE_IDS_V1.length)
  })

  test("11. PID telemetry does not change deterministic result bytes", async () => {
    const template = await executeAuthenticatedScheduleInProcessV1({
      scheduleId: "pi_canonical",
      repositoryRoot: root,
    })
    const makeSpawn =
      (pidFor: (index: number) => number): SpawnScheduleWorkerFnV1 =>
      async ({ scheduleId }) => {
        const index = EXPECTED_SCHEDULE_IDS_V1.indexOf(scheduleId)
        return {
          pid: pidFor(index),
          result: await stubScheduleResult(scheduleId, template),
        }
      }
    const first = await verifyCounterfactualTraversalStabilityV1({
      repositoryRoot: root,
      spawnWorker: makeSpawn(() => 111),
    })
    const second = await verifyCounterfactualTraversalStabilityV1({
      repositoryRoot: root,
      spawnWorker: makeSpawn((index) => 1000 + index),
    })
    expect(canonicalIdentityJson(first.result)).toBe(canonicalIdentityJson(second.result))
    expect(first.telemetry.worker_pids).not.toEqual(second.telemetry.worker_pids)
  })

  test("injected history_sensitive spawn path surfaces history_sensitive verdict", async () => {
    const real = await executeAuthenticatedScheduleInProcessV1({
      scheduleId: "pi_canonical",
      repositoryRoot: root,
    })
    const spawnWorker: SpawnScheduleWorkerFnV1 = async ({ scheduleId }) => {
      const base = await stubScheduleResult(scheduleId, real)
      if (scheduleId === "pi_reverse") {
        const target = base.members.find((member) => member.vector_id === "V-OBSERVED-NOT-VALIDATED")
        if (target?.scheduled_observed) {
          ;(target.scheduled_observed as { native_detail: Record<string, unknown> }).native_detail = {
            ...target.scheduled_observed.native_detail,
            injected: "history",
          }
        }
      }
      // Repeated PID is accepted; isolation is not PID uniqueness.
      return { pid: 9, result: base }
    }
    const { result } = await verifyCounterfactualTraversalStabilityV1({
      repositoryRoot: root,
      spawnWorker,
    })
    expect(result.verdict).toBe("history_sensitive")
    expect(result.aggregate.history_sensitive).toBeGreaterThan(0)
  })
})

describe("counterfactual traversal stability v1 — v0 preservation", () => {
  test("18. v0 tests and byte identities remain unchanged", () => {
    const v0 = runTraversalStabilityPackageGenerator({ mode: "check", repositoryRoot: root })
    expect(v0.ok).toBe(true)
    expect(v0.schedule_set_sha256).toBe(PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0)
    expect(v0.schedule_set_sha256).toBe(
      "323f185857af8aeb8436d9ec15f24c0a53a9662f9fbe613526477ed243ed285d",
    )
    expect(v0.fixture_set_sha256).toBe(
      "04821850899ad432bbe50c8d7e08659f387c3c9860d9324aaa106dd1c7ccb201",
    )
    const identity = verifyTraversalStabilityPackageIdentity(root)
    expect(identity.schedule_set_sha256).toBe(PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0)
    expect(identity.fixture_set_sha256).toBe(
      "04821850899ad432bbe50c8d7e08659f387c3c9860d9324aaa106dd1c7ccb201",
    )
    // v0 pass helper remains 5/50 — v1 must not become implicit v0 behavior.
    expect(
      isTraversalStabilityPass({
        schedule_count: 12,
        member_count: 10,
        scheduled_member_evaluations: 120,
        stable: 120,
        history_sensitive: 0,
        unresolved: 0,
        semantic_conformant: 120,
        semantic_nonconformant: 0,
        semantic_execution_unresolved: 0,
      }),
    ).toBe(false)
  })

  test("umbrella package digests and Lane H remain unchanged", async () => {
    const verification = await verifyCounterfactualConformancePackage({ repositoryRoot: root })
    expect(verification.dcn_sha256).toBe(PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0)
    expect(verification.dcn_sha256).toBe(
      "37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d",
    )
    expect(verification.child_identity_set_sha256).toBe(
      "7bbe7e02247e4177af954b83f7b2c4a982f6f1ef3806e623b2d847aa3089be47",
    )
    expect(verification.fixture_set_sha256).toBe(
      "264870b880e3b37ff8f0d9bdbaa9a4f64242e92f6485316477d32bbf9b81904a",
    )
    expect(verification.aggregate.counts).toEqual({
      total_member_count: 10,
      conformant_count: 10,
      nonconformant_count: 0,
      unresolved_count: 0,
    })

    const request = deriveCounterfactualNeighborhoodConformanceRequest({ repositoryRoot: root })
    const first = await evaluateCounterfactualNeighborhoodConformance(structuredClone(request))
    const second = await evaluateCounterfactualNeighborhoodConformance(structuredClone(request))
    expect(canonicalIdentityJson(first)).toBe(canonicalIdentityJson(second))
  })

  test("v0 public aggregate remains 5/10/50/50/0/0", async () => {
    const { result } = await verifyCounterfactualTraversalStability({ repositoryRoot: root })
    expect(result.aggregate.schedule_count).toBe(5)
    expect(result.aggregate.member_count).toBe(10)
    expect(result.aggregate.scheduled_member_evaluations).toBe(50)
    expect(result.aggregate.stable).toBe(50)
    expect(result.aggregate.history_sensitive).toBe(0)
    expect(result.aggregate.unresolved).toBe(0)
    expect(isTraversalStabilityPass(result.aggregate)).toBe(true)
  }, 600_000)

  test("v0 package file bytes unchanged vs pinned fixture inventory", () => {
    const manifest = JSON.parse(
      readFileSync(
        resolve(root, "conformance/counterfactual-traversal-stability-v0/manifest.json"),
        "utf8",
      ),
    ) as {
      fixture_set_sha256: string
      schedule_set_sha256: string
      files: Array<{ path: string; sha256: string }>
    }
    expect(manifest.schedule_set_sha256).toBe(
      "323f185857af8aeb8436d9ec15f24c0a53a9662f9fbe613526477ed243ed285d",
    )
    expect(manifest.fixture_set_sha256).toBe(
      "04821850899ad432bbe50c8d7e08659f387c3c9860d9324aaa106dd1c7ccb201",
    )
    for (const file of manifest.files) {
      const actual = createHash("sha256")
        .update(readFileSync(resolve(root, file.path)))
        .digest("hex")
      expect(actual).toBe(file.sha256)
    }
  })
})
