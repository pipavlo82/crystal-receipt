import { afterAll, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import {
  CANONICAL_DCN_VECTOR_IDS_V0,
  FROZEN_TRAVERSAL_SCHEDULES_V0,
  PI_NONLOCAL_V0_ORDERED_VECTOR_IDS,
  PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0,
  TRAVERSAL_RESET_MODEL_V0,
  TraversalScheduleContractError,
  authenticateFrozenTraversalSchedule,
  buildFrozenTraversalScheduleSet,
  computeOrderedVectorIdsSha256,
  computeTraversalScheduleSetSha256,
  getFrozenTraversalSchedule,
} from "../../src/receiptos/challenge/counterfactual-traversal-schedules"
import {
  COUNTERFACTUAL_TRAVERSAL_SCHEDULE_RESULT_SCHEMA,
  COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH,
  COUNTERFACTUAL_TRAVERSAL_STABILITY_RESULT_SCHEMA,
  TraversalStabilityError,
  executeAuthenticatedScheduleInProcess,
  runTraversalStabilityPackageGenerator,
  validateScheduleWorkerResult,
  verifyCounterfactualTraversalStability,
  verifyTraversalStabilityPackageIdentity,
  type SpawnScheduleWorkerFn,
  type TraversalScheduleWorkerResultV0,
} from "../../src/receiptos/challenge/counterfactual-traversal-stability"
import {
  compareMemberScheduleStability,
  isTraversalStabilityPass,
  type ComparableMemberObservationV0,
} from "../../src/receiptos/challenge/counterfactual-traversal-stability-compare"
import {
  PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0,
  evaluateCounterfactualNeighborhoodConformance,
} from "../../src/receiptos/challenge/counterfactual-neighborhood-conformance"
import { deriveCounterfactualNeighborhoodConformanceRequest } from "../../src/receiptos/challenge/counterfactual-materialized-input-derivation"
import { canonicalIdentityJson } from "../../src/receiptos/challenge/counterfactual-neighborhood"
import { verifyCounterfactualConformancePackage } from "../../src/receiptos/challenge/counterfactual-conformance-package"

const root = resolve(import.meta.dir, "../..")

const EXPECTED_SCHEDULE_IDS = [
  "pi_canonical",
  "pi_reverse",
  "pi_composite_first",
  "pi_boundary_first",
  "pi_nonlocal_v0",
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

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"))
}

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

describe("counterfactual traversal stability v0 — schedule identity", () => {
  test("exact package/schema/profile identity and five schedule ids", () => {
    const set = buildFrozenTraversalScheduleSet()
    expect(set.schema).toBe("receiptos.counterfactual_traversal_schedule_set.v0")
    expect(set.profile_id).toBe("counterfactual-traversal-stability-v0")
    expect(set.profile_version).toBe("v0")
    expect(set.schedule_set_id).toBe("counterfactual-traversal-schedule-set-v0")
    expect(set.reset_model).toBe(TRAVERSAL_RESET_MODEL_V0)
    expect(set.dcn_sha256).toBe(PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0)
    expect(set.schedules.map((entry) => entry.schedule_id)).toEqual([...EXPECTED_SCHEDULE_IDS])
    expect(set.schedule_set_sha256).toBe(PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0)
    expect(set.schedule_set_sha256).toBe(computeTraversalScheduleSetSha256())
  })

  test("canonical/reverse/composite/boundary/nonlocal schedules exact", () => {
    const canonical = getFrozenTraversalSchedule("pi_canonical").ordered_vector_ids
    expect(canonical).toEqual([...CANONICAL_DCN_VECTOR_IDS_V0])
    expect(getFrozenTraversalSchedule("pi_reverse").ordered_vector_ids).toEqual(
      [...CANONICAL_DCN_VECTOR_IDS_V0].reverse(),
    )
    const composite = getFrozenTraversalSchedule("pi_composite_first").ordered_vector_ids
    expect(composite[0]).toBe("V-MAN-HASH-DIFF")
    expect(composite.slice(1)).toEqual(CANONICAL_DCN_VECTOR_IDS_V0.filter((id) => id !== "V-MAN-HASH-DIFF"))
    const boundary = getFrozenTraversalSchedule("pi_boundary_first").ordered_vector_ids
    expect(boundary[0]).toBe("V-AT-NEST-OBJ")
    expect(boundary.slice(1)).toEqual(CANONICAL_DCN_VECTOR_IDS_V0.filter((id) => id !== "V-AT-NEST-OBJ"))
    expect(getFrozenTraversalSchedule("pi_nonlocal_v0").ordered_vector_ids).toEqual([
      ...PI_NONLOCAL_V0_ORDERED_VECTOR_IDS,
    ])
  })

  test("every schedule has ten unique canonical members and 50 total slots", () => {
    let slots = 0
    for (const schedule of FROZEN_TRAVERSAL_SCHEDULES_V0) {
      expect(schedule.member_count).toBe(10)
      expect(new Set(schedule.ordered_vector_ids).size).toBe(10)
      expect([...schedule.ordered_vector_ids].sort()).toEqual([...CANONICAL_DCN_VECTOR_IDS_V0].sort())
      expect(schedule.ordered_vector_ids_sha256).toBe(
        computeOrderedVectorIdsSha256(schedule.ordered_vector_ids),
      )
      slots += schedule.ordered_vector_ids.length
    }
    expect(slots).toBe(50)
  })

  test("nonlocal schedule literal and digest exact", () => {
    const schedule = getFrozenTraversalSchedule("pi_nonlocal_v0")
    expect(schedule.ordered_vector_ids_sha256).toBe(
      "62d965b95f8004f4229f25b8b50c399ea10f5b0840efdba97b351fb7ee33db65",
    )
    expect(schedule.ordered_vector_ids_sha256).toBe(
      computeOrderedVectorIdsSha256(PI_NONLOCAL_V0_ORDERED_VECTOR_IDS),
    )
  })

  test("authenticateFrozenTraversalSchedule rejects caller-supplied lists", () => {
    expect(() => authenticateFrozenTraversalSchedule("pi_unknown")).toThrow(TraversalScheduleContractError)
    const auth = authenticateFrozenTraversalSchedule("pi_reverse")
    expect(auth.ordered_vector_ids[0]).toBe("V-MAN-HASH-DIFF")
    expect(auth.reset_model).toBe(TRAVERSAL_RESET_MODEL_V0)
  })

  test("schedule-set digest mutation fails closed", () => {
    expect(PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0).toBe(
      "323f185857af8aeb8436d9ec15f24c0a53a9662f9fbe613526477ed243ed285d",
    )
    const mutated = structuredClone(FROZEN_TRAVERSAL_SCHEDULES_V0)
    // Local mutation of a copy must not match pinned digest when order changes.
    const swapped = {
      ...mutated[0]!,
      ordered_vector_ids: [...mutated[0]!.ordered_vector_ids].reverse(),
      ordered_vector_ids_sha256: computeOrderedVectorIdsSha256(
        [...mutated[0]!.ordered_vector_ids].reverse(),
      ),
    }
    const recomputed = computeTraversalScheduleSetSha256([
      swapped,
      ...mutated.slice(1),
    ] as typeof FROZEN_TRAVERSAL_SCHEDULES_V0)
    expect(recomputed).not.toBe(PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0)
  })
})

describe("counterfactual traversal stability v0 — generator/auditor", () => {
  test("generator --check zero drift and repeated runs byte-identical", () => {
    const first = runTraversalStabilityPackageGenerator({ mode: "check", repositoryRoot: root })
    const second = runTraversalStabilityPackageGenerator({ mode: "check", repositoryRoot: root })
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(first.schedule_set_sha256).toBe(second.schedule_set_sha256)
    expect(first.fixture_set_sha256).toBe(second.fixture_set_sha256)
    expect(canonicalIdentityJson(first.schedules)).toBe(canonicalIdentityJson(second.schedules))
  })

  test("cwd-independent generator check", () => {
    const dir = mkdtempSync(join(tmpdir(), "lane-k-cwd-"))
    tempDirs.push(dir)
    const fromOtherCwd = spawnSync(
      process.execPath,
      [resolve(root, `${COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH}/generate_package.ts`), "--check"],
      { cwd: dir, encoding: "utf8" },
    )
    expect(fromOtherCwd.status).toBe(0)
    const payload = JSON.parse(fromOtherCwd.stdout)
    expect(payload.ok).toBe(true)
  })

  test("independent auditors production_imports 0", () => {
    const ts = spawnSync(process.execPath, [
      resolve(root, `${COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH}/audit_package.ts`),
    ], { cwd: root, encoding: "utf8" })
    expect(ts.status).toBe(0)
    expect(JSON.parse(ts.stdout).production_imports).toBe(0)

    const py = spawnSync("python", [
      resolve(root, `${COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH}/verify_independent.py`),
    ], { cwd: root, encoding: "utf8" })
    expect(py.status).toBe(0)
    expect(JSON.parse(py.stdout).production_imports).toBe(0)
  })

  test("package identity verification", () => {
    const identity = verifyTraversalStabilityPackageIdentity(root)
    expect(identity.schedule_set_sha256).toBe(PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0)
  })
})

describe("counterfactual traversal stability v0 — comparison core", () => {
  test("controlled stateful comparison produces history_sensitive", () => {
    const canonical = observationStub("canonical")
    const scheduled = observationStub("scheduled-different")
    const comparison = compareMemberScheduleStability({
      schedule_id: "pi_reverse",
      canonical,
      scheduled,
    })
    expect(comparison.schedule_stability).toBe("history_sensitive")
    expect(comparison.canonical_match).toBe(false)
    expect(comparison.semantic_match).toBe(true)
  })

  test("controlled unresolved comparison produces unresolved", () => {
    const canonical = observationStub("canonical")
    const scheduled: ComparableMemberObservationV0 = {
      ...observationStub("x"),
      execution_state: "execution_unresolved",
      verdict: null,
      observed: null,
      normative_expected: null,
      failure_stage: "subject_invocation",
    }
    const comparison = compareMemberScheduleStability({
      schedule_id: "pi_canonical",
      canonical,
      scheduled,
    })
    expect(comparison.schedule_stability).toBe("unresolved")
    expect(comparison.canonical_match).toBeNull()
    expect(comparison.stability_axis).toBe("execution_unresolved")
  })
})

describe("counterfactual traversal stability v0 — worker/coordinator", () => {
  test("in-process schedule worker returns DCN-ordered members and schedule execution order", async () => {
    const result = await executeAuthenticatedScheduleInProcess({
      scheduleId: "pi_reverse",
      repositoryRoot: root,
    })
    expect(result.schema).toBe(COUNTERFACTUAL_TRAVERSAL_SCHEDULE_RESULT_SCHEMA)
    expect(result.members.map((member) => member.vector_id)).toEqual([...CANONICAL_DCN_VECTOR_IDS_V0])
    expect(result.execution_vector_ids).toEqual([...CANONICAL_DCN_VECTOR_IDS_V0].reverse())
    expect(result.members.every((member) => member.execution_state === "evaluated")).toBe(true)
    expect(result.members.every((member) => member.verdict === "conformant")).toBe(true)
    const nest = result.members.find((member) => member.vector_id === "V-AT-NEST-OBJ")
    expect(nest?.subject_contract_rejection).not.toBeNull()
    const composite = result.members.find((member) => member.vector_id === "V-MAN-HASH-DIFF")
    expect(composite?.route).toBe("cab_manifest_hash_diff")
  })

  test("fresh process per schedule, five distinct PIDs, sequential, no reuse", async () => {
    const { result, telemetry } = await verifyCounterfactualTraversalStability({
      repositoryRoot: root,
    })
    expect(result.schema).toBe(COUNTERFACTUAL_TRAVERSAL_STABILITY_RESULT_SCHEMA)
    expect(telemetry.worker_pids).toHaveLength(5)
    expect(new Set(telemetry.worker_pids).size).toBe(5)
    expect(telemetry.worker_reused).toBe(false)
    expect(telemetry.schedules_concurrent).toBe(false)
    expect(telemetry.schedule_ids).toEqual([...EXPECTED_SCHEDULE_IDS])
    expect(result.aggregate.scheduled_member_evaluations).toBe(50)
    expect(result.aggregate.stable).toBe(50)
    expect(result.aggregate.history_sensitive).toBe(0)
    expect(result.aggregate.unresolved).toBe(0)
    expect(isTraversalStabilityPass(result.aggregate)).toBe(true)
    expect(result.verdict).toBe("stable")
    expect(result.evaluation_state).toBe("evaluated")
    // PID must not appear in normative result.
    expect(JSON.stringify(result)).not.toMatch(/"pid"/)
    expect(canonicalIdentityJson(result.comparisons.map((entry) => entry.vector_id).slice(0, 10))).toBe(
      canonicalIdentityJson([...CANONICAL_DCN_VECTOR_IDS_V0]),
    )
  }, 600_000)

  test("repeat invocation byte-identical aggregate", async () => {
    const first = await verifyCounterfactualTraversalStability({ repositoryRoot: root })
    const second = await verifyCounterfactualTraversalStability({ repositoryRoot: root })
    expect(canonicalIdentityJson(first.result.aggregate)).toBe(
      canonicalIdentityJson(second.result.aggregate),
    )
    expect(canonicalIdentityJson(first.result.comparisons)).toBe(
      canonicalIdentityJson(second.result.comparisons),
    )
  }, 600_000)

  test("worker schema validation rejects malformed output", () => {
    const auth = authenticateFrozenTraversalSchedule("pi_canonical")
    expect(() => validateScheduleWorkerResult({ schema: "nope" }, auth)).toThrow(TraversalStabilityError)
  })

  test("controlled worker failure becomes bounded execution_unresolved orchestration error", async () => {
    const failingSpawn: SpawnScheduleWorkerFn = async () => {
      throw new TraversalStabilityError("worker_timeout")
    }
    await expect(
      verifyCounterfactualTraversalStability({
        repositoryRoot: root,
        spawnWorker: failingSpawn,
      }),
    ).rejects.toMatchObject({ reason: "worker_timeout" })
  })

  test("injected history_sensitive spawn path surfaces history_sensitive verdict", async () => {
    const real = await executeAuthenticatedScheduleInProcess({
      scheduleId: "pi_canonical",
      repositoryRoot: root,
    })
    const spawnWorker: SpawnScheduleWorkerFn = async ({ scheduleId }) => {
      const base = structuredClone(real) as TraversalScheduleWorkerResultV0
      const auth = authenticateFrozenTraversalSchedule(scheduleId)
      base.schedule_id = auth.schedule_id
      base.ordered_vector_ids_sha256 = auth.ordered_vector_ids_sha256
      base.execution_vector_ids = [...auth.ordered_vector_ids]
      if (scheduleId === "pi_reverse") {
        const target = base.members.find((member) => member.vector_id === "V-OBSERVED-NOT-VALIDATED")
        if (target?.scheduled_observed) {
          ;(target.scheduled_observed as { native_detail: Record<string, unknown> }).native_detail = {
            ...target.scheduled_observed.native_detail,
            injected: "history",
          }
        }
      }
      return { pid: Math.floor(Math.random() * 1_000_000) + 1, result: base }
    }
    // Ensure five distinct pids
    const used = new Set<number>()
    const distinctSpawn: SpawnScheduleWorkerFn = async (input) => {
      let out = await spawnWorker(input)
      while (used.has(out.pid)) {
        out = { ...out, pid: out.pid + 1 }
      }
      used.add(out.pid)
      return out
    }
    const { result } = await verifyCounterfactualTraversalStability({
      repositoryRoot: root,
      spawnWorker: distinctSpawn,
    })
    expect(result.verdict).toBe("history_sensitive")
    expect(result.aggregate.history_sensitive).toBeGreaterThan(0)
  })
})

describe("counterfactual traversal stability v0 — Lane H preservation and digests", () => {
  test("Lane H canonical output remains byte-identical across two calls", async () => {
    const request = deriveCounterfactualNeighborhoodConformanceRequest({ repositoryRoot: root })
    const first = await evaluateCounterfactualNeighborhoodConformance(structuredClone(request))
    const second = await evaluateCounterfactualNeighborhoodConformance(structuredClone(request))
    expect(canonicalIdentityJson(first)).toBe(canonicalIdentityJson(second))
    expect(first.verdict).toBe("conformant")
    expect(first.counts).toEqual({
      total_member_count: 10,
      conformant_count: 10,
      nonconformant_count: 0,
      unresolved_count: 0,
    })
  })

  test("umbrella package still verifies conformant 10/10 and digests unchanged", async () => {
    const verification = await verifyCounterfactualConformancePackage({ repositoryRoot: root })
    expect(verification.dcn_sha256).toBe(PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0)
    expect(verification.child_identity_set_sha256).toBe(
      "7bbe7e02247e4177af954b83f7b2c4a982f6f1ef3806e623b2d847aa3089be47",
    )
    expect(verification.fixture_set_sha256).toBe(
      "264870b880e3b37ff8f0d9bdbaa9a4f64242e92f6485316477d32bbf9b81904a",
    )
    expect(verification.aggregate.evaluation_state).toBe("evaluated")
    expect(verification.aggregate.verdict).toBe("conformant")
    expect(verification.aggregate.counts).toEqual({
      total_member_count: 10,
      conformant_count: 10,
      nonconformant_count: 0,
      unresolved_count: 0,
    })
  })

  test("caller reorder cannot become schedule authority", async () => {
    const request = deriveCounterfactualNeighborhoodConformanceRequest({ repositoryRoot: root })
    const reordered = {
      ...request,
      members: [...request.members].reverse(),
    }
    const auth = authenticateFrozenTraversalSchedule("pi_canonical")
    const { evaluateCounterfactualNeighborhoodUnderAuthenticatedSchedule } = await import(
      "../../src/receiptos/challenge/counterfactual-neighborhood-conformance"
    )
    const bundle = await evaluateCounterfactualNeighborhoodUnderAuthenticatedSchedule(reordered, auth)
    expect(bundle.execution_vector_ids).toEqual([...CANONICAL_DCN_VECTOR_IDS_V0])
    expect(bundle.members.map((member) => member.vector_id)).toEqual([...CANONICAL_DCN_VECTOR_IDS_V0])
  })

  test("raw diagnostic strings never leak from worker failure envelope", async () => {
    const worker = resolve(root, `${COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH}/run_schedule_worker.ts`)
    const bad = spawnSync(process.execPath, [worker, "--schedule-id", "not-a-schedule", "--repository-root", root], {
      cwd: root,
      encoding: "utf8",
    })
    expect(bad.status).not.toBe(0)
    const payload = JSON.parse(bad.stdout)
    expect(payload.ok).toBe(false)
    expect(typeof payload.reason).toBe("string")
    expect(JSON.stringify(payload)).not.toMatch(/Error:|at |\\\\Users\\|stack/i)
  })
})
