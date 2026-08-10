/** Independent counterfactual-traversal-stability-v1 audit. No production imports. */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const PACKAGE = "conformance/counterfactual-traversal-stability-v1"
const PINNED_DCN_SHA256 = "37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d"
const PRESERVED_V0_SCHEDULE_SET =
  "323f185857af8aeb8436d9ec15f24c0a53a9662f9fbe613526477ed243ed285d"
const PRESERVED_V0_FIXTURE = "04821850899ad432bbe50c8d7e08659f387c3c9860d9324aaa106dd1c7ccb201"
const EXPECTED_SCHEDULE_IDS = [
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
const CANONICAL_VECTOR_IDS = [
  "V-OBSERVED-NOT-VALIDATED",
  "V-MISSING-REQUIRED-INPUT",
  "V-INTEGRITY-MISMATCH",
  "V-CHRONICLE-PROOF-ROOT-MISMATCH",
  "V-CHRONICLE-PREDECESSOR-UNKNOWN",
  "V-CHRONICLE-SEQUENCE-GAP",
  "V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH",
  "V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL",
  "V-AT-NEST-OBJ",
  "V-MAN-HASH-DIFF",
] as const
const PRESERVED_V0_DIGESTS: Record<string, string> = {
  pi_canonical: "10fe5ab9156154a5a03b369a75cd8d6782da68149be97acb3ad645c9d86c95c7",
  pi_reverse: "5bf691951414804217d0830215d699a5eaf61167fb782cf5388350afe6635f84",
  pi_composite_first: "7545c4b2309b2e996b6139b75eb663932b0b906d25bccc4713974e7723ce5038",
  pi_boundary_first: "4d4d5c88a7295de490fcd2d186e28e03503d3ef5f0bfdd0ecb92637a6eb49480",
  pi_nonlocal_v0: "62d965b95f8004f4229f25b8b50c399ea10f5b0840efdba97b351fb7ee33db65",
}
const COLD_START_FIRST: Record<string, string> = {
  "cold_start_missing-required-input": "V-MISSING-REQUIRED-INPUT",
  "cold_start_integrity-mismatch": "V-INTEGRITY-MISMATCH",
  "cold_start_chronicle-proof-root-mismatch": "V-CHRONICLE-PROOF-ROOT-MISMATCH",
  "cold_start_chronicle-predecessor-unknown": "V-CHRONICLE-PREDECESSOR-UNKNOWN",
  "cold_start_chronicle-sequence-gap": "V-CHRONICLE-SEQUENCE-GAP",
  "cold_start_chronicle-checkpoint-root-mismatch": "V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH",
  "cold_start_chronicle-checkpoint-entry-refs-noncanonical":
    "V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL",
}
const CLOSED_INVENTORY = new Set([
  "SPEC.md",
  "contract.json",
  "manifest.json",
  "schedules/schedule-set.json",
  "generate_package.ts",
  "verify_independent.py",
  "audit_package.ts",
  "run_schedule_worker.ts",
])
const RESET_MODEL = "fresh_process_per_schedule_shared_process_within_schedule"

type J = Record<string, unknown>
const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message)
}

const shaBytes = (bytes: Uint8Array | Buffer) => createHash("sha256").update(bytes).digest("hex")
const readBytes = (repositoryPath: string) => readFileSync(resolve(ROOT, repositoryPath))
const readJson = (repositoryPath: string) => JSON.parse(readBytes(repositoryPath).toString("utf8")) as J

const canonicalJson = (value: unknown): string => {
  if (value === null) return "null"
  if (value === true) return "true"
  if (value === false) return "false"
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number") return String(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`
  }
  throw new Error(`non-canonical json value: ${typeof value}`)
}

function listFiles(dir: string, base: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === "__pycache__" || entry === "node_modules") continue
    const abs = join(dir, entry)
    const rel = relative(base, abs).replaceAll("\\", "/")
    if (statSync(abs).isDirectory()) out.push(...listFiles(abs, base))
    else out.push(rel)
  }
  return out.sort()
}

function assertExactTen(ordered: unknown[], label: string): void {
  assert(ordered.length === 10, `${label} count`)
  const seen = new Set<string>()
  for (const id of ordered) {
    assert(typeof id === "string", `${label} type`)
    assert((CANONICAL_VECTOR_IDS as readonly string[]).includes(id), `${label} unknown`)
    assert(!seen.has(id), `${label} duplicate`)
    seen.add(id)
  }
  for (const id of CANONICAL_VECTOR_IDS) assert(seen.has(id), `${label} missing ${id}`)
}

function main(): void {
  const packageAbs = resolve(ROOT, PACKAGE)
  assert(existsSync(packageAbs), "package missing")
  const onDisk = new Set(listFiles(packageAbs, packageAbs))
  assert(
    [...CLOSED_INVENTORY].every((path) => onDisk.has(path)) &&
      [...onDisk].every((path) => CLOSED_INVENTORY.has(path)),
    "closed inventory mismatch",
  )

  const contract = readJson(`${PACKAGE}/contract.json`)
  const manifest = readJson(`${PACKAGE}/manifest.json`)
  const scheduleSet = readJson(`${PACKAGE}/schedules/schedule-set.json`)

  assert(contract.schema === "counterfactual_traversal_stability_package_contract.v1", "contract schema")
  assert(contract.package_id === "counterfactual-traversal-stability-v1", "package_id")
  assert(contract.reset_model === RESET_MODEL, "reset_model")
  assert(contract.dcn_sha256 === PINNED_DCN_SHA256, "dcn")
  const runner = contract.runner as J
  assert(runner.process_launch_count === 12, "process_launch_count")
  assert(
    runner.process_isolation ===
      "exactly_one_fresh_spawn_per_authenticated_schedule_sequential_no_cross_schedule_reuse",
    "process_isolation",
  )
  assert(
    runner.pid_telemetry === "non_normative_may_repeat_never_enters_result_identity",
    "pid_telemetry",
  )
  const forbidden = contract.forbidden_semantics as string[]
  assert(forbidden.includes("numeric_pid_uniqueness_as_process_identity"), "forbid pid uniqueness")
  assert(forbidden.includes("caller_claimed_process_launch_count"), "forbid caller launch count")
  assert(scheduleSet.schema === "receiptos.counterfactual_traversal_schedule_set.v1", "set schema")
  assert(scheduleSet.reset_model === RESET_MODEL, "set reset")
  assert(scheduleSet.dcn_sha256 === PINNED_DCN_SHA256, "set dcn")
  assert(scheduleSet.schedule_count === 12, "set schedule_count")

  const schedules = scheduleSet.schedules as J[]
  assert(schedules.length === 12, "schedule_count")
  assert(
    schedules.map((entry) => entry.schedule_id).join(",") === EXPECTED_SCHEDULE_IDS.join(","),
    "schedule ids",
  )

  let slots = 0
  const firstPositions = new Map<string, string[]>()
  for (const id of CANONICAL_VECTOR_IDS) firstPositions.set(id, [])

  for (const schedule of schedules) {
    const ordered = schedule.ordered_vector_ids as unknown[]
    assertExactTen(ordered, String(schedule.schedule_id))
    const digest = shaBytes(Buffer.from(canonicalJson(ordered), "utf8"))
    assert(digest === schedule.ordered_vector_ids_sha256, `${schedule.schedule_id} digest`)
    slots += ordered.length
    const first = ordered[0] as string
    firstPositions.get(first)!.push(String(schedule.schedule_id))
    const preserved = PRESERVED_V0_DIGESTS[String(schedule.schedule_id)]
    if (preserved !== undefined) {
      assert(digest === preserved, `${schedule.schedule_id} preserved v0 digest`)
    }
    const coldFirst = COLD_START_FIRST[String(schedule.schedule_id)]
    if (coldFirst !== undefined) {
      assert(first === coldFirst, `${schedule.schedule_id} cold-start first`)
      const remainder = CANONICAL_VECTOR_IDS.filter((id) => id !== coldFirst)
      assert(
        canonicalJson(ordered.slice(1)) === canonicalJson(remainder),
        `${schedule.schedule_id} cold-start remainder`,
      )
    }
  }
  assert(slots === 120, "120 slots")

  const missing = CANONICAL_VECTOR_IDS.filter((id) => (firstPositions.get(id) ?? []).length === 0)
  assert(missing.length === 0, `first-position missing: ${missing.join(",")}`)

  const coverage = contract.first_position_coverage as J
  assert(coverage.schedule_count === 12, "coverage schedule_count")
  assert(coverage.member_count === 10, "coverage member_count")
  assert(coverage.scheduled_member_evaluations === 120, "coverage evaluations")
  assert(coverage.first_position_member_count === 10, "coverage member count")
  assert(coverage.first_position_covered === 10, "coverage covered")
  assert(Array.isArray(coverage.first_position_missing) && coverage.first_position_missing.length === 0, "coverage missing")

  const setPreimage = {
    schema: "receiptos.counterfactual_traversal_schedule_set.v1",
    schedule_set_id: "counterfactual-traversal-schedule-set-v1",
    profile_id: "counterfactual-traversal-stability-v1",
    profile_version: "v1",
    dcn_sha256: PINNED_DCN_SHA256,
    member_count: 10,
    schedule_count: 12,
    reset_model: RESET_MODEL,
    canonical_vector_ids: CANONICAL_VECTOR_IDS,
    schedules: schedules.map((schedule) => ({
      schedule_id: schedule.schedule_id,
      ordered_vector_ids: schedule.ordered_vector_ids,
      ordered_vector_ids_sha256: schedule.ordered_vector_ids_sha256,
    })),
  }
  const setDigest = shaBytes(Buffer.from(canonicalJson(setPreimage), "utf8"))
  assert(setDigest === scheduleSet.schedule_set_sha256, "schedule_set digest")
  assert(contract.schedule_set_sha256 === setDigest, "contract schedule_set digest")
  assert(manifest.schedule_set_sha256 === setDigest, "manifest schedule_set digest")

  const preservedV0 = contract.preserved_v0_profile as J
  assert(preservedV0.schedule_set_sha256 === PRESERVED_V0_SCHEDULE_SET, "preserved v0 set")
  assert(preservedV0.fixture_set_sha256 === PRESERVED_V0_FIXTURE, "preserved v0 fixture")

  const v0Manifest = readJson("conformance/counterfactual-traversal-stability-v0/manifest.json")
  assert(v0Manifest.schedule_set_sha256 === PRESERVED_V0_SCHEDULE_SET, "live v0 set")
  assert(v0Manifest.fixture_set_sha256 === PRESERVED_V0_FIXTURE, "live v0 fixture")

  const files = manifest.files as Array<{ path: string; sha256: string }>
  assert(Array.isArray(files) && files.length > 0, "manifest files")
  const rows: string[] = []
  const paths: string[] = []
  for (const file of files) {
    const actual = shaBytes(readFileSync(resolve(ROOT, file.path)))
    assert(actual === file.sha256, `file digest ${file.path}`)
    paths.push(file.path)
    rows.push(`${file.path}\t${actual}\n`)
  }
  assert(canonicalJson(paths) === canonicalJson([...paths].sort()), "manifest path order")
  const fixture = shaBytes(Buffer.from(rows.join(""), "utf8"))
  assert(manifest.fixture_set_sha256 === fixture, "fixture digest")

  const productionImports = 0
  console.log(
    JSON.stringify(
      {
        ok: true,
        package_id: "counterfactual-traversal-stability-v1",
        schedule_set_sha256: setDigest,
        fixture_set_sha256: fixture,
        dcn_sha256: PINNED_DCN_SHA256,
        first_position_covered: 10,
        production_imports: productionImports,
      },
      null,
      2,
    ),
  )
}

try {
  main()
} catch (error) {
  console.log(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "audit_failed" }))
  process.exit(1)
}
