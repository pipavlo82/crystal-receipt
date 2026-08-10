/**
 * Counterfactual Traversal Stability v1 — cold-start coverage profile.
 *
 * Append-only relative to v0. Authenticates the twelve-schedule frozen set
 * (five preserved v0 permutations + seven cold_start_* schedules), proves
 * first-position coverage 10/10, then spawns one fresh Bun process per schedule.
 */

import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { canonicalIdentityJson } from "./counterfactual-neighborhood"
import {
  PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0,
  evaluateCounterfactualNeighborhoodUnderAuthenticatedSchedule,
  type ScheduledMemberObservationV0,
  type ScheduledNeighborhoodObservationBundleV0,
} from "./counterfactual-neighborhood-conformance"
import { deriveCounterfactualNeighborhoodConformanceRequest } from "./counterfactual-materialized-input-derivation"
import { verifyUmbrellaPackageIdentity } from "./counterfactual-conformance-package"
import { COUNTERFACTUAL_CONFORMANCE_PACKAGE_ID } from "./counterfactual-dcn-generator"
import {
  CANONICAL_DCN_VECTOR_IDS_V0,
  TRAVERSAL_RESET_MODEL_V0,
  computeOrderedVectorIdsSha256,
} from "./counterfactual-traversal-schedules"
import {
  AuthenticatedScheduleOrderV1,
  COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID_V1,
  COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_SCHEMA_V1,
  COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1,
  COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION_V1,
  FROZEN_TRAVERSAL_SCHEDULES_V1,
  PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V1,
  TraversalScheduleContractErrorV1,
  assertFrozenScheduleSetIntegrityV1,
  authenticateFrozenTraversalScheduleV1,
  buildFrozenTraversalScheduleSetV1,
  computeTraversalScheduleSetSha256V1,
  deriveFirstPositionCoverageAuthorityV1,
  type FirstPositionCoverageAuthorityV1,
  type TraversalScheduleIdV1,
} from "./counterfactual-traversal-schedules-v1"
import {
  aggregateTraversalStability,
  compareMemberScheduleStability,
  isTraversalStabilityPassFor,
  type ComparableMemberObservationV0,
  type MemberStabilityComparisonV0,
  type TraversalStabilityAggregateV0,
} from "./counterfactual-traversal-stability-compare"

export const COUNTERFACTUAL_TRAVERSAL_STABILITY_RESULT_SCHEMA_V1 =
  "receiptos.counterfactual_traversal_stability_result.v1" as const

export const COUNTERFACTUAL_TRAVERSAL_SCHEDULE_RESULT_SCHEMA_V1 =
  "receiptos.counterfactual_traversal_schedule_result.v1" as const

export const COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH_V1 =
  "conformance/counterfactual-traversal-stability-v1" as const

export const LANE_K_WORKER_TIMEOUT_MS_V1 = 120_000 as const

export const EXPECTED_TRAVERSAL_V1_SCHEDULE_COUNT = 12 as const
export const EXPECTED_TRAVERSAL_V1_EVALUATIONS = 120 as const

export class TraversalStabilityErrorV1 extends Error {
  readonly code = "traversal_stability_error_v1" as const
  readonly reason: string

  constructor(reason: string) {
    super("traversal stability v1 failed")
    this.name = "TraversalStabilityErrorV1"
    this.reason = reason
  }
}

export type TraversalScheduleWorkerResultV1 = {
  readonly schema: typeof COUNTERFACTUAL_TRAVERSAL_SCHEDULE_RESULT_SCHEMA_V1
  readonly schedule_id: TraversalScheduleIdV1
  readonly ordered_vector_ids_sha256: string
  readonly schedule_set_sha256: string
  readonly dcn_sha256: string
  readonly reset_model: typeof TRAVERSAL_RESET_MODEL_V0
  readonly profile_id: typeof COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1
  readonly profile_version: typeof COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION_V1
  readonly execution_vector_ids: readonly string[]
  readonly members: readonly ScheduledMemberObservationV0[]
}

export type TraversalStabilityResultV1 = {
  readonly schema: typeof COUNTERFACTUAL_TRAVERSAL_STABILITY_RESULT_SCHEMA_V1
  readonly profile_id: typeof COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1
  readonly profile_version: typeof COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION_V1
  readonly schedule_set_id: typeof COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID_V1
  readonly schedule_set_sha256: string
  readonly dcn_sha256: string
  readonly reset_model: typeof TRAVERSAL_RESET_MODEL_V0
  readonly evaluation_state: "evaluated" | "execution_unresolved"
  readonly verdict: "stable" | "history_sensitive" | null
  readonly aggregate: TraversalStabilityAggregateV0
  readonly first_position_coverage: FirstPositionCoverageAuthorityV1
  readonly comparisons: readonly MemberStabilityComparisonV0[]
  readonly schedules: readonly {
    readonly schedule_id: TraversalScheduleIdV1
    readonly ordered_vector_ids_sha256: string
    readonly execution_vector_ids: readonly string[]
  }[]
}

/** One authenticated schedule-process launch observation (PIDs non-normative). */
export type TraversalProcessLaunchRecordV1 = {
  readonly schedule_id: TraversalScheduleIdV1
  readonly launch_index: number
  /** Observed OS PID when available; never enters result identity. */
  readonly observed_pid: number | null
}

/**
 * Non-normative parent-side telemetry for integration tests only.
 * Process isolation is proved by authenticated launch count/order, not PID uniqueness.
 */
export type TraversalStabilityRunTelemetryV1 = {
  readonly process_launch_count: typeof EXPECTED_TRAVERSAL_V1_SCHEDULE_COUNT
  readonly launches: readonly TraversalProcessLaunchRecordV1[]
  readonly schedule_ids: readonly TraversalScheduleIdV1[]
  /** Optional PID list parallel to launches; may contain repeats. */
  readonly worker_pids: readonly number[]
  readonly worker_reused: false
  readonly schedules_concurrent: false
}

const DEFAULT_REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)))

function sha256Bytes(bytes: Buffer | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function cloneJson<T>(value: T): T {
  return structuredClone(value)
}

function toComparable(member: ScheduledMemberObservationV0): ComparableMemberObservationV0 {
  return {
    vector_id: member.vector_id,
    execution_state: member.execution_state,
    verdict: member.verdict,
    normative_expected: member.normative_expected,
    observed: member.scheduled_observed,
    subject_contract_rejection: member.subject_contract_rejection,
    mismatch_kind: member.mismatch_kind,
    failure_stage: member.failure_stage,
  }
}

export function validateScheduleWorkerResultV1(
  value: unknown,
  expectedSchedule: AuthenticatedScheduleOrderV1,
): TraversalScheduleWorkerResultV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TraversalStabilityErrorV1("worker_schema_mismatch")
  }
  const object = value as Record<string, unknown>
  if (object.schema !== COUNTERFACTUAL_TRAVERSAL_SCHEDULE_RESULT_SCHEMA_V1) {
    throw new TraversalStabilityErrorV1("worker_schema_mismatch")
  }
  if (object.schedule_id !== expectedSchedule.schedule_id) {
    throw new TraversalStabilityErrorV1("schedule_identity_mismatch")
  }
  if (object.ordered_vector_ids_sha256 !== expectedSchedule.ordered_vector_ids_sha256) {
    throw new TraversalStabilityErrorV1("schedule_identity_mismatch")
  }
  if (object.schedule_set_sha256 !== expectedSchedule.schedule_set_sha256) {
    throw new TraversalStabilityErrorV1("schedule_identity_mismatch")
  }
  if (object.dcn_sha256 !== PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0) {
    throw new TraversalStabilityErrorV1("schedule_identity_mismatch")
  }
  if (object.reset_model !== TRAVERSAL_RESET_MODEL_V0) {
    throw new TraversalStabilityErrorV1("schedule_identity_mismatch")
  }
  if (object.profile_id !== COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1) {
    throw new TraversalStabilityErrorV1("schedule_identity_mismatch")
  }
  if (!Array.isArray(object.members) || object.members.length !== 10) {
    throw new TraversalStabilityErrorV1("worker_schema_mismatch")
  }
  if (!Array.isArray(object.execution_vector_ids)) {
    throw new TraversalStabilityErrorV1("worker_schema_mismatch")
  }
  if (
    canonicalIdentityJson(object.execution_vector_ids) !==
    canonicalIdentityJson(expectedSchedule.ordered_vector_ids)
  ) {
    throw new TraversalStabilityErrorV1("schedule_identity_mismatch")
  }
  for (let i = 0; i < CANONICAL_DCN_VECTOR_IDS_V0.length; i += 1) {
    const member = object.members[i] as ScheduledMemberObservationV0
    if (!member || member.vector_id !== CANONICAL_DCN_VECTOR_IDS_V0[i]) {
      throw new TraversalStabilityErrorV1("worker_schema_mismatch")
    }
  }
  return value as TraversalScheduleWorkerResultV1
}

/**
 * In-process schedule execution used by the v1 worker process entrypoint.
 */
export async function executeAuthenticatedScheduleInProcessV1(options: {
  readonly scheduleId: string
  readonly repositoryRoot?: string
}): Promise<TraversalScheduleWorkerResultV1> {
  const repositoryRoot = resolve(options.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT)
  assertFrozenScheduleSetIntegrityV1()
  const authenticated = authenticateFrozenTraversalScheduleV1(options.scheduleId)
  verifyUmbrellaPackageIdentity(repositoryRoot)
  const request = deriveCounterfactualNeighborhoodConformanceRequest({ repositoryRoot })
  const bundle: ScheduledNeighborhoodObservationBundleV0 =
    await evaluateCounterfactualNeighborhoodUnderAuthenticatedSchedule(request, authenticated)
  return {
    schema: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_RESULT_SCHEMA_V1,
    schedule_id: authenticated.schedule_id,
    ordered_vector_ids_sha256: authenticated.ordered_vector_ids_sha256,
    schedule_set_sha256: authenticated.schedule_set_sha256,
    dcn_sha256: bundle.neighborhood_sha256,
    reset_model: TRAVERSAL_RESET_MODEL_V0,
    profile_id: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1,
    profile_version: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION_V1,
    execution_vector_ids: bundle.execution_vector_ids,
    members: bundle.members,
  }
}

async function readWorkerStdout(
  proc: ReturnType<typeof Bun.spawn>,
  timeoutMs: number,
): Promise<{ stdout: string; exitCode: number | null; timedOut: boolean }> {
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    try {
      proc.kill()
    } catch {
      // ignore
    }
  }, timeoutMs)
  try {
    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited
    return { stdout, exitCode, timedOut }
  } finally {
    clearTimeout(timer)
  }
}

export type SpawnScheduleWorkerFnV1 = (input: {
  readonly scheduleId: TraversalScheduleIdV1
  readonly repositoryRoot: string
  readonly workerScriptPath: string
  readonly timeoutMs: number
}) => Promise<{
  readonly pid: number
  readonly result: TraversalScheduleWorkerResultV1
}>

const defaultSpawnScheduleWorkerV1: SpawnScheduleWorkerFnV1 = async ({
  scheduleId,
  repositoryRoot,
  workerScriptPath,
  timeoutMs,
}) => {
  let proc: ReturnType<typeof Bun.spawn>
  try {
    proc = Bun.spawn(
      [process.execPath, workerScriptPath, "--schedule-id", scheduleId, "--repository-root", repositoryRoot],
      {
        cwd: repositoryRoot,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          RECEIPTOS_LANE_K_WORKER_V1: "1",
        },
      },
    )
  } catch {
    throw new TraversalStabilityErrorV1("worker_spawn_failure")
  }

  const pid = proc.pid
  if (typeof pid !== "number" || !Number.isFinite(pid)) {
    throw new TraversalStabilityErrorV1("worker_spawn_failure")
  }

  const { stdout, exitCode, timedOut } = await readWorkerStdout(proc, timeoutMs)
  try {
    await new Response(proc.stderr).text()
  } catch {
    // ignore
  }

  if (timedOut) {
    throw new TraversalStabilityErrorV1("worker_timeout")
  }
  if (exitCode !== 0) {
    throw new TraversalStabilityErrorV1("worker_exit_failure")
  }
  if (!stdout || stdout.trim().length === 0) {
    throw new TraversalStabilityErrorV1("worker_output_missing")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new TraversalStabilityErrorV1("worker_output_malformed")
  }

  const authenticated = authenticateFrozenTraversalScheduleV1(scheduleId)
  return {
    pid,
    result: validateScheduleWorkerResultV1(parsed, authenticated),
  }
}

function buildComparisonsV1(
  scheduleResults: readonly TraversalScheduleWorkerResultV1[],
): MemberStabilityComparisonV0[] {
  const canonical = scheduleResults.find((entry) => entry.schedule_id === "pi_canonical")
  if (!canonical) {
    throw new TraversalStabilityErrorV1("schedule_identity_mismatch")
  }
  const canonicalById = new Map(canonical.members.map((member) => [member.vector_id, member]))
  const comparisons: MemberStabilityComparisonV0[] = []
  for (const schedule of scheduleResults) {
    for (const vectorId of CANONICAL_DCN_VECTOR_IDS_V0) {
      const scheduled = schedule.members.find((member) => member.vector_id === vectorId)
      const baseline = canonicalById.get(vectorId)
      if (!scheduled || !baseline) {
        throw new TraversalStabilityErrorV1("worker_schema_mismatch")
      }
      comparisons.push(
        compareMemberScheduleStability({
          schedule_id: schedule.schedule_id,
          canonical: toComparable(baseline),
          scheduled: toComparable(scheduled),
        }),
      )
    }
  }
  return comparisons
}

export async function verifyCounterfactualTraversalStabilityV1(options?: {
  readonly repositoryRoot?: string
  readonly workerScriptPath?: string
  readonly timeoutMs?: number
  readonly spawnWorker?: SpawnScheduleWorkerFnV1
}): Promise<{
  readonly result: TraversalStabilityResultV1
  readonly telemetry: TraversalStabilityRunTelemetryV1
}> {
  const repositoryRoot = resolve(options?.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT)
  const timeoutMs = options?.timeoutMs ?? LANE_K_WORKER_TIMEOUT_MS_V1
  const workerScriptPath = resolve(
    options?.workerScriptPath ??
      join(repositoryRoot, COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH_V1, "run_schedule_worker.ts"),
  )
  const spawnWorker = options?.spawnWorker ?? defaultSpawnScheduleWorkerV1

  try {
    assertFrozenScheduleSetIntegrityV1()
  } catch (error) {
    if (error instanceof TraversalScheduleContractErrorV1) {
      throw new TraversalStabilityErrorV1(error.reason)
    }
    throw error
  }

  let firstPositionCoverage: FirstPositionCoverageAuthorityV1
  try {
    firstPositionCoverage = deriveFirstPositionCoverageAuthorityV1()
  } catch (error) {
    if (error instanceof TraversalScheduleContractErrorV1) {
      throw new TraversalStabilityErrorV1(error.reason)
    }
    throw error
  }

  verifyTraversalStabilityPackageIdentityV1(repositoryRoot)
  verifyUmbrellaPackageIdentity(repositoryRoot)

  if (COUNTERFACTUAL_CONFORMANCE_PACKAGE_ID !== "counterfactual-conformance-v0") {
    throw new TraversalStabilityErrorV1("package_identity_mismatch")
  }

  const scheduleIds = FROZEN_TRAVERSAL_SCHEDULES_V1.map((entry) => entry.schedule_id)
  for (const scheduleId of scheduleIds) {
    authenticateFrozenTraversalScheduleV1(scheduleId)
  }

  const launches: TraversalProcessLaunchRecordV1[] = []
  const workerPids: number[] = []
  const scheduleResults: TraversalScheduleWorkerResultV1[] = []

  // Sequential launches: at most one authenticated schedule process in flight.
  for (let launchIndex = 0; launchIndex < scheduleIds.length; launchIndex += 1) {
    const scheduleId = scheduleIds[launchIndex]!
    try {
      const spawned = await spawnWorker({
        scheduleId,
        repositoryRoot,
        workerScriptPath,
        timeoutMs,
      })
      if (spawned.result.schedule_id !== scheduleId) {
        throw new TraversalStabilityErrorV1("schedule_identity_mismatch")
      }
      const observedPid =
        typeof spawned.pid === "number" && Number.isFinite(spawned.pid) ? spawned.pid : null
      launches.push({
        schedule_id: scheduleId,
        launch_index: launchIndex,
        observed_pid: observedPid,
      })
      if (observedPid !== null) workerPids.push(observedPid)
      scheduleResults.push(spawned.result)
    } catch (error) {
      if (error instanceof TraversalStabilityErrorV1) throw error
      throw new TraversalStabilityErrorV1("worker_spawn_failure")
    }
  }

  // Exactly twelve authenticated launches — not twelve unique numeric PIDs.
  if (
    launches.length !== EXPECTED_TRAVERSAL_V1_SCHEDULE_COUNT ||
    scheduleResults.length !== EXPECTED_TRAVERSAL_V1_SCHEDULE_COUNT
  ) {
    throw new TraversalStabilityErrorV1("worker_spawn_failure")
  }
  for (let i = 0; i < scheduleIds.length; i += 1) {
    if (launches[i]!.schedule_id !== scheduleIds[i] || scheduleResults[i]!.schedule_id !== scheduleIds[i]) {
      throw new TraversalStabilityErrorV1("schedule_identity_mismatch")
    }
  }

  const comparisons = buildComparisonsV1(scheduleResults)
  const aggregate = aggregateTraversalStability(
    comparisons,
    EXPECTED_TRAVERSAL_V1_SCHEDULE_COUNT,
    10,
  )
  const pass = isTraversalStabilityPassFor(aggregate, {
    scheduleCount: EXPECTED_TRAVERSAL_V1_SCHEDULE_COUNT,
    evaluations: EXPECTED_TRAVERSAL_V1_EVALUATIONS,
  })
  const hasHistorySensitive = aggregate.history_sensitive > 0
  const hasUnresolved = aggregate.unresolved > 0

  const result: TraversalStabilityResultV1 = {
    schema: COUNTERFACTUAL_TRAVERSAL_STABILITY_RESULT_SCHEMA_V1,
    profile_id: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1,
    profile_version: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION_V1,
    schedule_set_id: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID_V1,
    schedule_set_sha256: PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V1,
    dcn_sha256: PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0,
    reset_model: TRAVERSAL_RESET_MODEL_V0,
    evaluation_state: hasUnresolved ? "execution_unresolved" : "evaluated",
    verdict: hasUnresolved ? null : hasHistorySensitive ? "history_sensitive" : pass ? "stable" : "history_sensitive",
    aggregate,
    first_position_coverage: cloneJson(firstPositionCoverage),
    comparisons: comparisons.map((entry) => cloneJson(entry)),
    schedules: scheduleResults.map((entry) => ({
      schedule_id: entry.schedule_id,
      ordered_vector_ids_sha256: entry.ordered_vector_ids_sha256,
      execution_vector_ids: entry.execution_vector_ids,
    })),
  }

  return {
    result,
    telemetry: {
      process_launch_count: EXPECTED_TRAVERSAL_V1_SCHEDULE_COUNT,
      launches,
      schedule_ids: scheduleIds,
      worker_pids: workerPids,
      worker_reused: false,
      schedules_concurrent: false,
    },
  }
}

// --- Package identity / generator ------------------------------------------------

const CLOSED_PACKAGE_FILES_V1 = [
  "SPEC.md",
  "contract.json",
  "manifest.json",
  "schedules/schedule-set.json",
  "generate_package.ts",
  "audit_package.ts",
  "verify_independent.py",
  "run_schedule_worker.ts",
] as const

function normalizeRel(path: string): string {
  return path.replaceAll("\\", "/")
}

function fixtureSetSha256FromManifestFiles(
  files: readonly { readonly path: string; readonly sha256: string }[],
): string {
  const sorted = [...files].sort((a, b) => Buffer.from(a.path).compare(Buffer.from(b.path)))
  const rows = sorted.map((file) => `${file.path}\t${file.sha256}\n`)
  return sha256Bytes(Buffer.from(rows.join(""), "utf8"))
}

function buildContractV1(): Record<string, unknown> {
  const set = buildFrozenTraversalScheduleSetV1()
  const coverage = deriveFirstPositionCoverageAuthorityV1(set.schedules)
  return {
    schema: "counterfactual_traversal_stability_package_contract.v1",
    package_id: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1,
    version: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION_V1,
    profile_id: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1,
    profile_version: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION_V1,
    schedule_set_id: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID_V1,
    schedule_set_schema: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_SCHEMA_V1,
    schedule_set_sha256: set.schedule_set_sha256,
    dcn_sha256: PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0,
    member_count: 10,
    schedule_count: 12,
    scheduled_member_evaluations: 120,
    reset_model: TRAVERSAL_RESET_MODEL_V0,
    first_position_coverage: coverage,
    runner: {
      schema: "receiptos.counterfactual_traversal_stability_runner.v1",
      version: "v1",
      module_path: "src/receiptos/challenge/counterfactual-traversal-stability-v1.ts",
      worker_module_path: `${COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH_V1}/run_schedule_worker.ts`,
      worker_timeout_ms: LANE_K_WORKER_TIMEOUT_MS_V1,
      process_launch_count: 12,
      process_isolation:
        "exactly_one_fresh_spawn_per_authenticated_schedule_sequential_no_cross_schedule_reuse",
      pid_telemetry: "non_normative_may_repeat_never_enters_result_identity",
    },
    counterfactual_conformance_package: {
      package_id: "counterfactual-conformance-v0",
      package_path: "conformance/counterfactual-conformance-v0",
      dcn_sha256: PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0,
      child_identity_set_sha256: "7bbe7e02247e4177af954b83f7b2c4a982f6f1ef3806e623b2d847aa3089be47",
      fixture_set_sha256: "264870b880e3b37ff8f0d9bdbaa9a4f64242e92f6485316477d32bbf9b81904a",
    },
    preserved_v0_profile: {
      package_id: "counterfactual-traversal-stability-v0",
      schedule_set_sha256: "323f185857af8aeb8436d9ec15f24c0a53a9662f9fbe613526477ed243ed285d",
      fixture_set_sha256: "04821850899ad432bbe50c8d7e08659f387c3c9860d9324aaa106dd1c7ccb201",
      schedule_count: 5,
      scheduled_member_evaluations: 50,
    },
    canonical_vector_ids: CANONICAL_DCN_VECTOR_IDS_V0,
    schedules: set.schedules.map((schedule) => ({
      schedule_id: schedule.schedule_id,
      ordered_vector_ids: schedule.ordered_vector_ids,
      ordered_vector_ids_sha256: schedule.ordered_vector_ids_sha256,
    })),
    hash_algorithm: "sha256-lowercase-hex",
    fixture_set_recipe:
      "Sorted member paths except manifest.json: <path>\\t<file-sha256>\\n concatenated UTF-8 then SHA-256.",
    forbidden_semantics: [
      "all_history_independence",
      "universal_verifier_correctness",
      "schedule_redefines_dcn_membership",
      "schedule_changes_expected_authority",
      "schedule_dependence_as_semantic_class",
      "caller_supplied_schedule_authority",
      "silent_reinterpretation_of_v0",
      "numeric_pid_uniqueness_as_process_identity",
      "caller_claimed_process_launch_count",
    ],
  }
}

function stableJsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")
}

export function runTraversalStabilityPackageGeneratorV1(options: {
  readonly mode: "check" | "write"
  readonly repositoryRoot?: string
}): {
  readonly mode: "check" | "write"
  readonly ok: boolean
  readonly schedule_set_sha256: string
  readonly fixture_set_sha256: string
  readonly drifted_paths: string[]
  readonly schedules: readonly { schedule_id: string; ordered_vector_ids_sha256: string }[]
} {
  const repositoryRoot = resolve(options.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT)
  const packageAbs = join(repositoryRoot, COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH_V1)
  assertFrozenScheduleSetIntegrityV1()
  const set = buildFrozenTraversalScheduleSetV1()
  if (set.schedule_set_sha256 !== PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V1) {
    throw new TraversalStabilityErrorV1("schedule_set_digest_mismatch")
  }

  const artifacts: Record<string, Buffer> = {
    "contract.json": stableJsonBytes(buildContractV1()),
    "schedules/schedule-set.json": stableJsonBytes(set),
  }

  const drifted: string[] = []
  for (const [rel, bytes] of Object.entries(artifacts)) {
    const abs = join(packageAbs, rel)
    if (options.mode === "write") {
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, bytes)
    } else {
      if (!existsSync(abs)) {
        drifted.push(`${COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH_V1}/${rel}`)
        continue
      }
      const existing = readFileSync(abs)
      if (!existing.equals(bytes)) {
        drifted.push(`${COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH_V1}/${rel}`)
      }
    }
  }

  const manifestFiles = CLOSED_PACKAGE_FILES_V1.filter((path) => path !== "manifest.json")
    .map((path) => {
      const abs = join(packageAbs, path)
      if (!existsSync(abs)) {
        throw new TraversalStabilityErrorV1("package_materialization_failure")
      }
      return {
        path: normalizeRel(`${COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH_V1}/${path}`),
        sha256: sha256Bytes(readFileSync(abs)),
      }
    })
    .sort((a, b) => Buffer.from(a.path).compare(Buffer.from(b.path)))

  const fixture_set_sha256 = fixtureSetSha256FromManifestFiles(manifestFiles)
  const manifest = {
    schema: "counterfactual_traversal_stability_package_fixture_manifest.v1",
    package_id: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1,
    version: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION_V1,
    file_count: manifestFiles.length,
    files: manifestFiles,
    fixture_set_sha256,
    schedule_set_sha256: set.schedule_set_sha256,
    dcn_sha256: PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0,
  }
  const manifestBytes = stableJsonBytes(manifest)
  const manifestAbs = join(packageAbs, "manifest.json")
  if (options.mode === "write") {
    writeFileSync(manifestAbs, manifestBytes)
  } else if (!existsSync(manifestAbs) || !readFileSync(manifestAbs).equals(manifestBytes)) {
    drifted.push(`${COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH_V1}/manifest.json`)
  }

  return {
    mode: options.mode,
    ok: drifted.length === 0,
    schedule_set_sha256: set.schedule_set_sha256,
    fixture_set_sha256,
    drifted_paths: drifted,
    schedules: set.schedules.map((schedule) => ({
      schedule_id: schedule.schedule_id,
      ordered_vector_ids_sha256: schedule.ordered_vector_ids_sha256,
    })),
  }
}

export function verifyTraversalStabilityPackageIdentityV1(repositoryRoot: string): {
  readonly fixture_set_sha256: string
  readonly schedule_set_sha256: string
} {
  const packageAbs = join(repositoryRoot, COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH_V1)
  const contract = JSON.parse(readFileSync(join(packageAbs, "contract.json"), "utf8")) as Record<
    string,
    unknown
  >
  const manifest = JSON.parse(readFileSync(join(packageAbs, "manifest.json"), "utf8")) as Record<
    string,
    unknown
  >
  const scheduleSet = JSON.parse(
    readFileSync(join(packageAbs, "schedules/schedule-set.json"), "utf8"),
  ) as Record<string, unknown>

  if (contract.package_id !== COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID_V1) {
    throw new TraversalStabilityErrorV1("package_identity_mismatch")
  }
  if (contract.schedule_set_sha256 !== PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V1) {
    throw new TraversalStabilityErrorV1("schedule_set_digest_mismatch")
  }
  if (contract.reset_model !== TRAVERSAL_RESET_MODEL_V0) {
    throw new TraversalStabilityErrorV1("package_identity_mismatch")
  }
  if (contract.dcn_sha256 !== PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0) {
    throw new TraversalStabilityErrorV1("dcn_digest_mismatch")
  }
  if (scheduleSet.schedule_set_sha256 !== PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V1) {
    throw new TraversalStabilityErrorV1("schedule_set_digest_mismatch")
  }
  if (computeTraversalScheduleSetSha256V1() !== PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V1) {
    throw new TraversalStabilityErrorV1("schedule_set_digest_mismatch")
  }

  const files = manifest.files as Array<{ path: string; sha256: string }>
  if (!Array.isArray(files) || files.length === 0) {
    throw new TraversalStabilityErrorV1("fixture_digest_mismatch")
  }
  for (const file of files) {
    const abs = join(repositoryRoot, file.path)
    if (!existsSync(abs) || sha256Bytes(readFileSync(abs)) !== file.sha256) {
      throw new TraversalStabilityErrorV1("fixture_digest_mismatch")
    }
  }
  const fixture = fixtureSetSha256FromManifestFiles(files)
  if (manifest.fixture_set_sha256 !== fixture) {
    throw new TraversalStabilityErrorV1("fixture_digest_mismatch")
  }

  if ("caller_schedules" in contract || "caller_reset_model" in contract) {
    throw new TraversalStabilityErrorV1("package_identity_mismatch")
  }

  for (const schedule of FROZEN_TRAVERSAL_SCHEDULES_V1) {
    if (computeOrderedVectorIdsSha256(schedule.ordered_vector_ids) !== schedule.ordered_vector_ids_sha256) {
      throw new TraversalStabilityErrorV1("schedule_digest_mismatch")
    }
  }

  deriveFirstPositionCoverageAuthorityV1()

  return {
    fixture_set_sha256: fixture,
    schedule_set_sha256: PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V1,
  }
}

export {
  authenticateFrozenTraversalScheduleV1,
  buildFrozenTraversalScheduleSetV1,
  computeOrderedVectorIdsSha256,
  computeTraversalScheduleSetSha256V1,
  deriveFirstPositionCoverageAuthorityV1,
  PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V1,
  FROZEN_TRAVERSAL_SCHEDULES_V1,
  TRAVERSAL_RESET_MODEL_V0,
}
