/** Independent counterfactual-traversal-stability-v0 audit. No production imports. */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const PACKAGE = "conformance/counterfactual-traversal-stability-v0"
const PINNED_DCN_SHA256 = "37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d"
const EXPECTED_SCHEDULE_IDS = [
  "pi_canonical",
  "pi_reverse",
  "pi_composite_first",
  "pi_boundary_first",
  "pi_nonlocal_v0",
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
const PI_NONLOCAL = [
  "V-OBSERVED-NOT-VALIDATED",
  "V-MISSING-REQUIRED-INPUT",
  "V-CHRONICLE-PROOF-ROOT-MISMATCH",
  "V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH",
  "V-INTEGRITY-MISMATCH",
  "V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL",
  "V-CHRONICLE-PREDECESSOR-UNKNOWN",
  "V-CHRONICLE-SEQUENCE-GAP",
  "V-AT-NEST-OBJ",
  "V-MAN-HASH-DIFF",
] as const
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

  assert(contract.schema === "counterfactual_traversal_stability_package_contract.v0", "contract schema")
  assert(contract.package_id === "counterfactual-traversal-stability-v0", "package_id")
  assert(contract.reset_model === RESET_MODEL, "reset_model")
  assert(contract.dcn_sha256 === PINNED_DCN_SHA256, "dcn")
  assert(scheduleSet.schema === "receiptos.counterfactual_traversal_schedule_set.v0", "set schema")
  assert(scheduleSet.reset_model === RESET_MODEL, "set reset")
  assert(scheduleSet.dcn_sha256 === PINNED_DCN_SHA256, "set dcn")

  const schedules = scheduleSet.schedules as J[]
  assert(schedules.length === 5, "schedule_count")
  assert(
    schedules.map((entry) => entry.schedule_id).join(",") === EXPECTED_SCHEDULE_IDS.join(","),
    "schedule ids",
  )

  let slots = 0
  for (const schedule of schedules) {
    const ordered = schedule.ordered_vector_ids as unknown[]
    assertExactTen(ordered, String(schedule.schedule_id))
    const digest = shaBytes(Buffer.from(canonicalJson(ordered), "utf8"))
    assert(digest === schedule.ordered_vector_ids_sha256, `${schedule.schedule_id} digest`)
    slots += ordered.length
  }
  assert(slots === 50, "50 slots")

  const canonical = schedules[0]!
  assert(
    canonicalJson(canonical.ordered_vector_ids) === canonicalJson(CANONICAL_VECTOR_IDS),
    "pi_canonical",
  )
  assert(
    canonicalJson(schedules[1]!.ordered_vector_ids) ===
      canonicalJson([...CANONICAL_VECTOR_IDS].reverse()),
    "pi_reverse",
  )
  assert((schedules[2]!.ordered_vector_ids as string[])[0] === "V-MAN-HASH-DIFF", "composite first")
  assert((schedules[3]!.ordered_vector_ids as string[])[0] === "V-AT-NEST-OBJ", "boundary first")
  assert(canonicalJson(schedules[4]!.ordered_vector_ids) === canonicalJson(PI_NONLOCAL), "nonlocal")

  const setPreimage = {
    schema: "receiptos.counterfactual_traversal_schedule_set.v0",
    schedule_set_id: "counterfactual-traversal-schedule-set-v0",
    profile_id: "counterfactual-traversal-stability-v0",
    profile_version: "v0",
    dcn_sha256: PINNED_DCN_SHA256,
    member_count: 10,
    schedule_count: 5,
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
        package_id: "counterfactual-traversal-stability-v0",
        schedule_set_sha256: setDigest,
        fixture_set_sha256: fixture,
        dcn_sha256: PINNED_DCN_SHA256,
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
