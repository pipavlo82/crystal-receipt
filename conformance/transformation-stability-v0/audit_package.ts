/** Independent transformation-stability-v0 package audit. No production imports. */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const PACKAGE = "conformance/transformation-stability-v0"
const HANDOFF_VECTOR_IDS = [
  "H-ROUNDTRIP-STABLE",
  "H-KEY-ORDER-REVERSE",
  "H-NORMATIVE-SESSION-ID-MUTATION",
  "H-FORBIDDEN-ANCHOR-CONTRACT-MUTATION",
  "H-SOURCE-SCHEMA-MISMATCH",
  "H-TARGET-RECOMPUTE-UNRESOLVED",
] as const
const EXPECTED_AGGREGATE = {
  stable: 2,
  history_sensitive: 0,
  unresolved: 1,
  out_of_domain: 1,
  violation: 2,
} as const
const CYCLE_VECTOR_IDS = [
  "stable_closed_cycle",
  "intermediate_violation_restored_endpoint",
  "failed_applicability_out_of_domain",
  "recompute_unresolved_worker_timeout",
] as const
const CLOSED_INVENTORY = new Set([
  "SPEC.md",
  "contract.json",
  "manifest.json",
  "generate_package.ts",
  "verify_independent.py",
  "audit_package.ts",
  "vectors/handoff-matrix-set.json",
  "cycles/cycle-set.json",
])

type J = Record<string, unknown>
const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message)
}

const shaBytes = (bytes: Uint8Array | Buffer) => createHash("sha256").update(bytes).digest("hex")
const readBytes = (repositoryPath: string) => readFileSync(resolve(ROOT, repositoryPath))
const readJson = (repositoryPath: string) => JSON.parse(readBytes(repositoryPath).toString("utf8")) as J

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
  const matrixSet = readJson(`${PACKAGE}/vectors/handoff-matrix-set.json`)
  const cycleSet = readJson(`${PACKAGE}/cycles/cycle-set.json`)

  assert(contract.schema === "transformation_stability_package_contract.v0", "contract schema")
  assert(contract.package_id === "transformation-stability-v0", "package_id")
  assert(contract.claim === "normative_preservation", "claim")

  // --- manifest / digest closure ---
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
  assert(JSON.stringify(paths) === JSON.stringify([...paths].sort()), "manifest path order")
  const fixtureSetSha256 = shaBytes(Buffer.from(rows.join(""), "utf8"))
  assert(manifest.fixture_set_sha256 === fixtureSetSha256, "fixture_set_sha256")

  const matrixBytes = readBytes(`${PACKAGE}/vectors/handoff-matrix-set.json`)
  const cycleBytes = readBytes(`${PACKAGE}/cycles/cycle-set.json`)
  const handoffMatrixSetSha256 = shaBytes(matrixBytes)
  const cycleSetSha256 = shaBytes(cycleBytes)
  assert(manifest.handoff_matrix_set_sha256 === handoffMatrixSetSha256, "manifest handoff_matrix_set_sha256")
  assert(manifest.cycle_set_sha256 === cycleSetSha256, "manifest cycle_set_sha256")
  const contractDigests = contract.generated_digests as J
  assert(contractDigests.handoff_matrix_set_sha256 === handoffMatrixSetSha256, "contract handoff_matrix_set_sha256")
  assert(contractDigests.cycle_set_sha256 === cycleSetSha256, "contract cycle_set_sha256")

  // --- Handoff matrix authority ---
  const handoffMatrix = contract.handoff_matrix as J
  assert(handoffMatrix.fixture_blob_sha1 === "a5dbda7662aa95a92a3befa3df28a666319e6740", "fixture_blob_sha1")
  assert(
    handoffMatrix.sample_receipt_root ===
      "0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc",
    "sample_receipt_root",
  )
  assert(
    handoffMatrix.normative_session_id_mutation_root ===
      "0x41479b4374e63fb0d9f42c03323c6949458a67cadb728e5a2d187c59582bf53e",
    "normative_session_id_mutation_root",
  )
  assert(
    handoffMatrix.anchor_contract_mutation_root === handoffMatrix.sample_receipt_root,
    "anchor_contract_mutation_root equals sample root",
  )
  assert(
    JSON.stringify(handoffMatrix.vector_inventory) === JSON.stringify(HANDOFF_VECTOR_IDS),
    "handoff vector inventory/order",
  )
  assert(
    JSON.stringify(handoffMatrix.expected_aggregate) === JSON.stringify(EXPECTED_AGGREGATE),
    "handoff expected_aggregate",
  )

  assert(matrixSet.vector_count === 6, "matrixSet vector_count")
  assert(matrixSet.pass === true, "matrixSet pass")
  assert(JSON.stringify(matrixSet.aggregate) === JSON.stringify(EXPECTED_AGGREGATE), "matrixSet aggregate")
  const members = matrixSet.members as J[]
  assert(
    JSON.stringify(members.map((member) => member.vector_id)) === JSON.stringify(HANDOFF_VECTOR_IDS),
    "matrixSet vector order",
  )
  const memberByExpected: Record<string, string> = {
    "H-ROUNDTRIP-STABLE": "stable",
    "H-KEY-ORDER-REVERSE": "stable",
    "H-NORMATIVE-SESSION-ID-MUTATION": "violation",
    "H-FORBIDDEN-ANCHOR-CONTRACT-MUTATION": "violation",
    "H-SOURCE-SCHEMA-MISMATCH": "out_of_domain",
    "H-TARGET-RECOMPUTE-UNRESOLVED": "unresolved",
  }
  for (const member of members) {
    const observed = member.observed as J
    assert(
      observed.classification === memberByExpected[member.vector_id as string],
      `matrixSet classification ${member.vector_id}`,
    )
  }
  const anchorMember = members.find((m) => m.vector_id === "H-FORBIDDEN-ANCHOR-CONTRACT-MUTATION")!
  const anchorObserved = anchorMember.observed as J
  assert(anchorObserved.normative_match === true, "anchor mutation preserves N")
  assert(anchorObserved.forbidden_variant_match === false, "anchor mutation violates F")

  // --- Closed cycle authority ---
  const cycle = contract.cycle as J
  assert(
    JSON.stringify(cycle.cycle_vector_inventory) === JSON.stringify(CYCLE_VECTOR_IDS),
    "cycle vector inventory/order",
  )
  assert(cycleSet.cycle_count === 4, "cycleSet cycle_count")
  const cycles = cycleSet.cycles as J[]
  assert(
    JSON.stringify(cycles.map((c) => c.cycle_id)) === JSON.stringify(CYCLE_VECTOR_IDS),
    "cycleSet vector order",
  )
  const expected = cycle.expected as J
  for (const entry of cycles) {
    const cycleId = entry.cycle_id as string
    const observed = entry.observed as J
    const exp = expected[cycleId] as J
    assert(observed.classification === exp.classification, `cycle classification ${cycleId}`)
    assert(observed.failed_edge_id === exp.failed_edge_id, `cycle failed_edge_id ${cycleId}`)
    assert(observed.failure_reason === exp.failure_reason, `cycle failure_reason ${cycleId}`)
  }

  const intermediate = cycles.find((c) => c.cycle_id === "intermediate_violation_restored_endpoint")!
  const intermediateObserved = intermediate.observed as J
  const intermediateEdges = intermediateObserved.edges as J[]
  assert(intermediateEdges.length === 1, "intermediate cycle terminates at first violating edge")
  assert(intermediateEdges[0]!.edge_id === "flip", "intermediate cycle first edge is flip")
  assert(
    (intermediate.input as J).edges instanceof Array &&
      ((intermediate.input as J).edges as unknown[]).length === 2,
    "intermediate cycle input still declares both edges (endpoint never reached)",
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        package_id: "transformation-stability-v0",
        fixture_set_sha256: fixtureSetSha256,
        handoff_matrix_set_sha256: handoffMatrixSetSha256,
        cycle_set_sha256: cycleSetSha256,
        production_imports: 0,
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
