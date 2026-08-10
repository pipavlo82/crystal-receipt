/**
 * Counterfactual Conformance v0 — Lane K traversal stability coordinator.
 *
 * Parent authenticates the frozen schedule package/set, reconstructs the
 * Counterfactual Conformance package/DCN, validates all five schedules, then
 * spawns one fresh Bun process per schedule (sequential, no reuse).
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
  AuthenticatedScheduleOrderV0,
  CANONICAL_DCN_VECTOR_IDS_V0,
  COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID,
  COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_SCHEMA,
  COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID,
  COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION,
  FROZEN_TRAVERSAL_SCHEDULES_V0,
  PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0,
  TRAVERSAL_RESET_MODEL_V0,
  TraversalScheduleContractError,
  assertFrozenScheduleSetIntegrity,
  authenticateFrozenTraversalSchedule,
  buildFrozenTraversalScheduleSet,
  computeOrderedVectorIdsSha256,
  computeTraversalScheduleSetSha256,
  type TraversalScheduleIdV0,
} from "./counterfactual-traversal-schedules"
import {
  aggregateTraversalStability,
  compareMemberScheduleStability,
  isTraversalStabilityPass,
  type ComparableMemberObservationV0,
  type MemberStabilityComparisonV0,
  type TraversalStabilityAggregateV0,
} from "./counterfactual-traversal-stability-compare"

export const COUNTERFACTUAL_TRAVERSAL_STABILITY_RESULT_SCHEMA =
  "receiptos.counterfactual_traversal_stability_result.v0" as const

export const COUNTERFACTUAL_TRAVERSAL_SCHEDULE_RESULT_SCHEMA =
  "receiptos.counterfactual_traversal_schedule_result.v0" as const

export const COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH =
  "conformance/counterfactual-traversal-stability-v0" as const

export const LANE_K_WORKER_TIMEOUT_MS_V0 = 120_000 as const

export type TraversalWorkerFailureReasonV0 =
  | "worker_spawn_failure"
  | "worker_timeout"
  | "worker_exit_failure"
  | "worker_output_missing"
  | "worker_output_malformed"
  | "worker_schema_mismatch"
  | "schedule_identity_mismatch"
  | "schedule_execution_unresolved"

export class TraversalStabilityError extends Error {
  readonly code = "traversal_stability_error" as const
  readonly reason: string

  constructor(reason: string) {
    super("traversal stability failed")
    this.name = "TraversalStabilityError"
    this.reason = reason
  }
}

export type TraversalScheduleWorkerResultV0 = {
  readonly schema: typeof COUNTERFACTUAL_TRAVERSAL_SCHEDULE_RESULT_SCHEMA
  readonly schedule_id: TraversalScheduleIdV0
  readonly ordered_vector_ids_sha256: string
  readonly schedule_set_sha256: string
  readonly dcn_sha256: string
  readonly reset_model: typeof TRAVERSAL_RESET_MODEL_V0
  readonly profile_id: typeof COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID
  readonly profile_version: typeof COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION
  readonly execution_vector_ids: readonly string[]
  readonly members: readonly ScheduledMemberObservationV0[]
}

export type TraversalStabilityResultV0 = {
  readonly schema: typeof COUNTERFACTUAL_TRAVERSAL_STABILITY_RESULT_SCHEMA
  readonly profile_id: typeof COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID
  readonly profile_version: typeof COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION
  readonly schedule_set_id: typeof COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID
  readonly schedule_set_sha256: string
  readonly dcn_sha256: string
  readonly reset_model: typeof TRAVERSAL_RESET_MODEL_V0
  readonly evaluation_state: "evaluated" | "execution_unresolved"
  readonly verdict: "stable" | "history_sensitive" | null
  readonly aggregate: TraversalStabilityAggregateV0
  readonly comparisons: readonly MemberStabilityComparisonV0[]
  readonly schedules: readonly {
    readonly schedule_id: TraversalScheduleIdV0
    readonly ordered_vector_ids_sha256: string
    readonly execution_vector_ids: readonly string[]
  }[]
}

/** Non-normative parent-side telemetry for integration tests only. */
export type TraversalStabilityRunTelemetryV0 = {
  readonly worker_pids: readonly number[]
  readonly schedule_ids: readonly TraversalScheduleIdV0[]
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

export function validateScheduleWorkerResult(
  value: unknown,
  expectedSchedule: AuthenticatedScheduleOrderV0,
): TraversalScheduleWorkerResultV0 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TraversalStabilityError("worker_schema_mismatch")
  }
  const object = value as Record<string, unknown>
  if (object.schema !== COUNTERFACTUAL_TRAVERSAL_SCHEDULE_RESULT_SCHEMA) {
    throw new TraversalStabilityError("worker_schema_mismatch")
  }
  if (object.schedule_id !== expectedSchedule.schedule_id) {
    throw new TraversalStabilityError("schedule_identity_mismatch")
  }
  if (object.ordered_vector_ids_sha256 !== expectedSchedule.ordered_vector_ids_sha256) {
    throw new TraversalStabilityError("schedule_identity_mismatch")
  }
  if (object.schedule_set_sha256 !== expectedSchedule.schedule_set_sha256) {
    throw new TraversalStabilityError("schedule_identity_mismatch")
  }
  if (object.dcn_sha256 !== PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0) {
    throw new TraversalStabilityError("schedule_identity_mismatch")
  }
  if (object.reset_model !== TRAVERSAL_RESET_MODEL_V0) {
    throw new TraversalStabilityError("schedule_identity_mismatch")
  }
  if (!Array.isArray(object.members) || object.members.length !== 10) {
    throw new TraversalStabilityError("worker_schema_mismatch")
  }
  if (!Array.isArray(object.execution_vector_ids)) {
    throw new TraversalStabilityError("worker_schema_mismatch")
  }
  if (
    canonicalIdentityJson(object.execution_vector_ids) !==
    canonicalIdentityJson(expectedSchedule.ordered_vector_ids)
  ) {
    throw new TraversalStabilityError("schedule_identity_mismatch")
  }
  for (let i = 0; i < CANONICAL_DCN_VECTOR_IDS_V0.length; i += 1) {
    const member = object.members[i] as ScheduledMemberObservationV0
    if (!member || member.vector_id !== CANONICAL_DCN_VECTOR_IDS_V0[i]) {
      throw new TraversalStabilityError("worker_schema_mismatch")
    }
  }
  return value as TraversalScheduleWorkerResultV0
}

/**
 * In-process schedule execution used by the worker process entrypoint.
 * Fresh Lane I request, full preflight, schedule-order evaluation, DCN-order serialize.
 */
export async function executeAuthenticatedScheduleInProcess(options: {
  readonly scheduleId: string
  readonly repositoryRoot?: string
}): Promise<TraversalScheduleWorkerResultV0> {
  const repositoryRoot = resolve(options.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT)
  assertFrozenScheduleSetIntegrity()
  const authenticated = authenticateFrozenTraversalSchedule(options.scheduleId)
  verifyUmbrellaPackageIdentity(repositoryRoot)
  const request = deriveCounterfactualNeighborhoodConformanceRequest({ repositoryRoot })
  const bundle: ScheduledNeighborhoodObservationBundleV0 =
    await evaluateCounterfactualNeighborhoodUnderAuthenticatedSchedule(request, authenticated)
  return {
    schema: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_RESULT_SCHEMA,
    schedule_id: authenticated.schedule_id,
    ordered_vector_ids_sha256: authenticated.ordered_vector_ids_sha256,
    schedule_set_sha256: authenticated.schedule_set_sha256,
    dcn_sha256: bundle.neighborhood_sha256,
    reset_model: TRAVERSAL_RESET_MODEL_V0,
    profile_id: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID,
    profile_version: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION,
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

export type SpawnScheduleWorkerFn = (input: {
  readonly scheduleId: TraversalScheduleIdV0
  readonly repositoryRoot: string
  readonly workerScriptPath: string
  readonly timeoutMs: number
}) => Promise<{
  readonly pid: number
  readonly result: TraversalScheduleWorkerResultV0
}>

const defaultSpawnScheduleWorker: SpawnScheduleWorkerFn = async ({
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
          // Keep child deterministic; never trust caller schedule env.
          RECEIPTOS_LANE_K_WORKER: "1",
        },
      },
    )
  } catch {
    throw new TraversalStabilityError("worker_spawn_failure")
  }

  const pid = proc.pid
  if (typeof pid !== "number" || !Number.isFinite(pid)) {
    throw new TraversalStabilityError("worker_spawn_failure")
  }

  const { stdout, exitCode, timedOut } = await readWorkerStdout(proc, timeoutMs)
  // Drain stderr without leaking into normative result.
  try {
    await new Response(proc.stderr).text()
  } catch {
    // ignore
  }

  if (timedOut) {
    throw new TraversalStabilityError("worker_timeout")
  }
  if (exitCode !== 0) {
    throw new TraversalStabilityError("worker_exit_failure")
  }
  if (!stdout || stdout.trim().length === 0) {
    throw new TraversalStabilityError("worker_output_missing")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new TraversalStabilityError("worker_output_malformed")
  }

  const authenticated = authenticateFrozenTraversalSchedule(scheduleId)
  return {
    pid,
    result: validateScheduleWorkerResult(parsed, authenticated),
  }
}

function buildComparisons(
  scheduleResults: readonly TraversalScheduleWorkerResultV0[],
): MemberStabilityComparisonV0[] {
  const canonical = scheduleResults.find((entry) => entry.schedule_id === "pi_canonical")
  if (!canonical) {
    throw new TraversalStabilityError("schedule_identity_mismatch")
  }
  const canonicalById = new Map(canonical.members.map((member) => [member.vector_id, member]))
  const comparisons: MemberStabilityComparisonV0[] = []
  for (const schedule of scheduleResults) {
    for (const vectorId of CANONICAL_DCN_VECTOR_IDS_V0) {
      const scheduled = schedule.members.find((member) => member.vector_id === vectorId)
      const baseline = canonicalById.get(vectorId)
      if (!scheduled || !baseline) {
        throw new TraversalStabilityError("worker_schema_mismatch")
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

export async function verifyCounterfactualTraversalStability(options?: {
  readonly repositoryRoot?: string
  readonly workerScriptPath?: string
  readonly timeoutMs?: number
  readonly spawnWorker?: SpawnScheduleWorkerFn
}): Promise<{
  readonly result: TraversalStabilityResultV0
  readonly telemetry: TraversalStabilityRunTelemetryV0
}> {
  const repositoryRoot = resolve(options?.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT)
  const timeoutMs = options?.timeoutMs ?? LANE_K_WORKER_TIMEOUT_MS_V0
  const workerScriptPath = resolve(
    options?.workerScriptPath ??
      join(repositoryRoot, COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH, "run_schedule_worker.ts"),
  )
  const spawnWorker = options?.spawnWorker ?? defaultSpawnScheduleWorker

  try {
    assertFrozenScheduleSetIntegrity()
  } catch (error) {
    if (error instanceof TraversalScheduleContractError) {
      throw new TraversalStabilityError(error.reason)
    }
    throw error
  }

  verifyTraversalStabilityPackageIdentity(repositoryRoot)
  verifyUmbrellaPackageIdentity(repositoryRoot)

  if (COUNTERFACTUAL_CONFORMANCE_PACKAGE_ID !== "counterfactual-conformance-v0") {
    throw new TraversalStabilityError("package_identity_mismatch")
  }

  const scheduleIds = FROZEN_TRAVERSAL_SCHEDULES_V0.map((entry) => entry.schedule_id)
  for (const scheduleId of scheduleIds) {
    authenticateFrozenTraversalSchedule(scheduleId)
  }

  const workerPids: number[] = []
  const scheduleResults: TraversalScheduleWorkerResultV0[] = []

  for (const scheduleId of scheduleIds) {
    try {
      const spawned = await spawnWorker({
        scheduleId,
        repositoryRoot,
        workerScriptPath,
        timeoutMs,
      })
      workerPids.push(spawned.pid)
      scheduleResults.push(spawned.result)
    } catch (error) {
      if (error instanceof TraversalStabilityError) throw error
      throw new TraversalStabilityError("worker_spawn_failure")
    }
  }

  if (workerPids.length !== 5 || new Set(workerPids).size !== 5) {
    throw new TraversalStabilityError("worker_spawn_failure")
  }

  const comparisons = buildComparisons(scheduleResults)
  const aggregate = aggregateTraversalStability(comparisons, 5, 10)
  const pass = isTraversalStabilityPass(aggregate)
  const hasHistorySensitive = aggregate.history_sensitive > 0
  const hasUnresolved = aggregate.unresolved > 0

  const result: TraversalStabilityResultV0 = {
    schema: COUNTERFACTUAL_TRAVERSAL_STABILITY_RESULT_SCHEMA,
    profile_id: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID,
    profile_version: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION,
    schedule_set_id: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID,
    schedule_set_sha256: PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0,
    dcn_sha256: PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0,
    reset_model: TRAVERSAL_RESET_MODEL_V0,
    evaluation_state: hasUnresolved ? "execution_unresolved" : "evaluated",
    verdict: hasUnresolved ? null : hasHistorySensitive ? "history_sensitive" : pass ? "stable" : "history_sensitive",
    aggregate,
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
      worker_pids: workerPids,
      schedule_ids: scheduleIds,
      worker_reused: false,
      schedules_concurrent: false,
    },
  }
}

// --- Package identity / generator ------------------------------------------------

const CLOSED_PACKAGE_FILES = [
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
  const sorted = [...files].sort((a, b) =>
    Buffer.from(a.path).compare(Buffer.from(b.path)),
  )
  const rows = sorted.map((file) => `${file.path}\t${file.sha256}\n`)
  return sha256Bytes(Buffer.from(rows.join(""), "utf8"))
}

function buildContract(): Record<string, unknown> {
  const set = buildFrozenTraversalScheduleSet()
  return {
    schema: "counterfactual_traversal_stability_package_contract.v0",
    package_id: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID,
    version: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION,
    profile_id: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID,
    profile_version: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION,
    schedule_set_id: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_ID,
    schedule_set_schema: COUNTERFACTUAL_TRAVERSAL_SCHEDULE_SET_SCHEMA,
    schedule_set_sha256: set.schedule_set_sha256,
    dcn_sha256: PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0,
    member_count: 10,
    schedule_count: 5,
    reset_model: TRAVERSAL_RESET_MODEL_V0,
    runner: {
      schema: "receiptos.counterfactual_traversal_stability_runner.v0",
      version: "v0",
      module_path: "src/receiptos/challenge/counterfactual-traversal-stability.ts",
      worker_module_path: `${COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH}/run_schedule_worker.ts`,
      worker_timeout_ms: LANE_K_WORKER_TIMEOUT_MS_V0,
    },
    counterfactual_conformance_package: {
      package_id: "counterfactual-conformance-v0",
      package_path: "conformance/counterfactual-conformance-v0",
      dcn_sha256: PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0,
      child_identity_set_sha256: "7bbe7e02247e4177af954b83f7b2c4a982f6f1ef3806e623b2d847aa3089be47",
      fixture_set_sha256: "264870b880e3b37ff8f0d9bdbaa9a4f64242e92f6485316477d32bbf9b81904a",
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
    ],
  }
}

function stableJsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")
}

export function runTraversalStabilityPackageGenerator(options: {
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
  const packageAbs = join(repositoryRoot, COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH)
  assertFrozenScheduleSetIntegrity()
  const set = buildFrozenTraversalScheduleSet()
  if (set.schedule_set_sha256 !== PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0) {
    throw new TraversalStabilityError("schedule_set_digest_mismatch")
  }

  const artifacts: Record<string, Buffer> = {
    "contract.json": stableJsonBytes(buildContract()),
    "schedules/schedule-set.json": stableJsonBytes(set),
  }

  // SPEC and scripts are hand-authored; generator only owns identity artifacts.
  const drifted: string[] = []
  for (const [rel, bytes] of Object.entries(artifacts)) {
    const abs = join(packageAbs, rel)
    if (options.mode === "write") {
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, bytes)
    } else {
      if (!existsSync(abs)) {
        drifted.push(`${COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH}/${rel}`)
        continue
      }
      const existing = readFileSync(abs)
      if (!existing.equals(bytes)) {
        drifted.push(`${COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH}/${rel}`)
      }
    }
  }

  const manifestFiles = CLOSED_PACKAGE_FILES.filter((path) => path !== "manifest.json")
    .map((path) => {
      const abs = join(packageAbs, path)
      if (!existsSync(abs)) {
        throw new TraversalStabilityError("package_materialization_failure")
      }
      return {
        path: normalizeRel(`${COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH}/${path}`),
        sha256: sha256Bytes(readFileSync(abs)),
      }
    })
    .sort((a, b) => Buffer.from(a.path).compare(Buffer.from(b.path)))

  const fixture_set_sha256 = fixtureSetSha256FromManifestFiles(manifestFiles)
  const manifest = {
    schema: "counterfactual_traversal_stability_package_fixture_manifest.v0",
    package_id: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID,
    version: COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_VERSION,
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
    drifted.push(`${COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH}/manifest.json`)
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

export function verifyTraversalStabilityPackageIdentity(repositoryRoot: string): {
  readonly fixture_set_sha256: string
  readonly schedule_set_sha256: string
} {
  const packageAbs = join(repositoryRoot, COUNTERFACTUAL_TRAVERSAL_STABILITY_PACKAGE_PATH)
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

  if (contract.package_id !== COUNTERFACTUAL_TRAVERSAL_STABILITY_PROFILE_ID) {
    throw new TraversalStabilityError("package_identity_mismatch")
  }
  if (contract.schedule_set_sha256 !== PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0) {
    throw new TraversalStabilityError("schedule_set_digest_mismatch")
  }
  if (contract.reset_model !== TRAVERSAL_RESET_MODEL_V0) {
    throw new TraversalStabilityError("package_identity_mismatch")
  }
  if (contract.dcn_sha256 !== PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0) {
    throw new TraversalStabilityError("dcn_digest_mismatch")
  }
  if (scheduleSet.schedule_set_sha256 !== PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0) {
    throw new TraversalStabilityError("schedule_set_digest_mismatch")
  }
  if (computeTraversalScheduleSetSha256() !== PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0) {
    throw new TraversalStabilityError("schedule_set_digest_mismatch")
  }

  const files = manifest.files as Array<{ path: string; sha256: string }>
  if (!Array.isArray(files) || files.length === 0) {
    throw new TraversalStabilityError("fixture_digest_mismatch")
  }
  for (const file of files) {
    const abs = join(repositoryRoot, file.path)
    if (!existsSync(abs) || sha256Bytes(readFileSync(abs)) !== file.sha256) {
      throw new TraversalStabilityError("fixture_digest_mismatch")
    }
  }
  const fixture = fixtureSetSha256FromManifestFiles(files)
  if (manifest.fixture_set_sha256 !== fixture) {
    throw new TraversalStabilityError("fixture_digest_mismatch")
  }

  // Reject caller-shaped authority fields if present on contract.
  if ("caller_schedules" in contract || "caller_reset_model" in contract) {
    throw new TraversalStabilityError("package_identity_mismatch")
  }

  for (const schedule of FROZEN_TRAVERSAL_SCHEDULES_V0) {
    if (computeOrderedVectorIdsSha256(schedule.ordered_vector_ids) !== schedule.ordered_vector_ids_sha256) {
      throw new TraversalStabilityError("schedule_digest_mismatch")
    }
  }

  return {
    fixture_set_sha256: fixture,
    schedule_set_sha256: PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0,
  }
}

export {
  authenticateFrozenTraversalSchedule,
  buildFrozenTraversalScheduleSet,
  computeOrderedVectorIdsSha256,
  computeTraversalScheduleSetSha256,
  PINNED_TRAVERSAL_SCHEDULE_SET_SHA256_V0,
  FROZEN_TRAVERSAL_SCHEDULES_V0,
  TRAVERSAL_RESET_MODEL_V0,
}
