/** Independent cross-object-transformation-stability-v0 package audit. No production imports. */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
const PACKAGE = "conformance/cross-object-transformation-stability-v0"

const CLOSED_INVENTORY = new Set([
  "SPEC.md",
  "contract.json",
  "manifest.json",
  "generate_package.ts",
  "audit_package.ts",
  "verify_independent.py",
  "vectors/collection-checkpoint-matrix-set.json",
  "vectors/collection-portfolio-matrix-set.json",
  "cycles/collection-checkpoint-cycle-set.json",
  "cycles/collection-portfolio-cycle-set.json",
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

function auditProfile(
  contract: J,
  profileKey: "collection_checkpoint" | "collections_portfolio",
  matrixSet: J,
  cycleSet: J,
  expectedVectorCount: number,
  expectedCycleCount: number,
) {
  const profile = contract[profileKey] as J
  const vectorInventory = profile.vector_inventory as string[]
  const expectedClassification = profile.expected_classification as Record<string, string>
  const expectedAggregate = profile.expected_aggregate as J

  assert(vectorInventory.length === expectedVectorCount, `${profileKey} vector_inventory length`)
  assert(matrixSet.vector_count === expectedVectorCount, `${profileKey} matrixSet vector_count`)
  assert(matrixSet.pass === true, `${profileKey} matrixSet pass`)
  assert(JSON.stringify(matrixSet.aggregate) === JSON.stringify(expectedAggregate), `${profileKey} matrixSet aggregate`)

  const members = matrixSet.members as J[]
  assert(
    JSON.stringify(members.map((member) => member.vector_id)) === JSON.stringify(vectorInventory),
    `${profileKey} matrixSet vector order`,
  )

  // Independently re-tally the aggregate from the raw per-member
  // classifications -- never trust the frozen `aggregate`/`pass` fields
  // directly.
  const retallied: Record<string, number> = { stable: 0, history_sensitive: 0, unresolved: 0, out_of_domain: 0, violation: 0 }
  for (const member of members) {
    const observed = member.observed as J
    const vectorId = member.vector_id as string
    const classification = observed.classification as string
    assert(classification === expectedClassification[vectorId], `${profileKey} classification ${vectorId}`)
    assert(retallied[classification] !== undefined, `${profileKey} unknown classification ${classification}`)
    retallied[classification] = (retallied[classification] ?? 0) + 1
  }
  assert(JSON.stringify(retallied) === JSON.stringify(expectedAggregate), `${profileKey} independently re-tallied aggregate`)

  const cycleVectorInventory = profile.cycle_vector_inventory as string[]
  const cycleExpected = profile.cycle_expected as J
  assert(cycleSet.cycle_count === expectedCycleCount, `${profileKey} cycleSet cycle_count`)
  const cycles = cycleSet.cycles as J[]
  assert(
    JSON.stringify(cycles.map((c) => c.cycle_id)) === JSON.stringify(cycleVectorInventory),
    `${profileKey} cycleSet vector order`,
  )
  for (const entry of cycles) {
    const cycleId = entry.cycle_id as string
    const observed = entry.observed as J
    const exp = cycleExpected[cycleId] as J
    assert(observed.classification === exp.classification, `${profileKey} cycle classification ${cycleId}`)
    assert(observed.failed_edge_id === exp.failed_edge_id, `${profileKey} cycle failed_edge_id ${cycleId}`)
    assert(observed.failure_reason === exp.failure_reason, `${profileKey} cycle failure_reason ${cycleId}`)
    assert(
      JSON.stringify(observed.ordered_edge_ids) === JSON.stringify(exp.ordered_edge_ids),
      `${profileKey} cycle ordered_edge_ids ${cycleId}`,
    )
    assert(
      (observed.aggregate as J).completed_edges === exp.completed_edges,
      `${profileKey} cycle completed_edges ${cycleId}`,
    )
  }

  return { members, cycles, retalliedAggregate: retallied }
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
  const checkpointMatrixSet = readJson(`${PACKAGE}/vectors/collection-checkpoint-matrix-set.json`)
  const portfolioMatrixSet = readJson(`${PACKAGE}/vectors/collection-portfolio-matrix-set.json`)
  const checkpointCycleSet = readJson(`${PACKAGE}/cycles/collection-checkpoint-cycle-set.json`)
  const portfolioCycleSet = readJson(`${PACKAGE}/cycles/collection-portfolio-cycle-set.json`)

  assert(contract.schema === "cross_object_transformation_stability_package_contract.v0", "contract schema")
  assert(contract.package_id === "cross-object-transformation-stability-v0", "package_id")
  assert(contract.claim === "pairwise_cross_object_consistency", "claim")
  assert(contract.cycle_claim === "edgewise_pairwise_cross_object_consistency_closed_cycle", "cycle_claim")
  assert(contract.closure_claim === "pairwise_closure_sufficient_for_current_chronicle_composition", "closure_claim")

  const source = contract.source as J
  assert(source.base_merge_commit === "3fa8e96a9b3236c128ad0f20602ed84d2c615ea8", "source base_merge_commit")
  assert(source.chronicle_domain_blob_sha1 === "0e790911092546c62344f980e6b611542bcd00fe", "chronicle_domain_blob_sha1")
  assert(
    source.collection_checkpoint_module_blob_sha1 === "da1a0bca7e9ae36f2805a837cd9adaaec4d3ad7a",
    "collection_checkpoint_module_blob_sha1",
  )
  assert(
    source.collections_portfolio_module_blob_sha1 === "890ddb8d5a7e8ac8bd7dfc6c0682589d796393d9",
    "collections_portfolio_module_blob_sha1",
  )

  // --- manifest / digest closure ---
  const files = manifest.files as Array<{ path: string; sha256: string }>
  assert(Array.isArray(files) && files.length === 9, "manifest files count")
  const rows: string[] = []
  const paths: string[] = []
  for (const file of files) {
    const actual = shaBytes(readFileSync(resolve(ROOT, file.path)))
    assert(actual === file.sha256, `file digest ${file.path}`)
    assert(!file.path.endsWith("manifest.json"), "manifest must not hash itself")
    paths.push(file.path)
    rows.push(`${file.path}\t${actual}\n`)
  }
  assert(JSON.stringify(paths) === JSON.stringify([...paths].sort()), "manifest path order")
  const fixtureSetSha256 = shaBytes(Buffer.from(rows.join(""), "utf8"))
  assert(manifest.fixture_set_sha256 === fixtureSetSha256, "fixture_set_sha256")

  const checkpointMatrixBytes = readBytes(`${PACKAGE}/vectors/collection-checkpoint-matrix-set.json`)
  const portfolioMatrixBytes = readBytes(`${PACKAGE}/vectors/collection-portfolio-matrix-set.json`)
  const checkpointCycleBytes = readBytes(`${PACKAGE}/cycles/collection-checkpoint-cycle-set.json`)
  const portfolioCycleBytes = readBytes(`${PACKAGE}/cycles/collection-portfolio-cycle-set.json`)
  const digests = {
    collection_checkpoint_matrix_set_sha256: shaBytes(checkpointMatrixBytes),
    collections_portfolio_matrix_set_sha256: shaBytes(portfolioMatrixBytes),
    collection_checkpoint_cycle_set_sha256: shaBytes(checkpointCycleBytes),
    collections_portfolio_cycle_set_sha256: shaBytes(portfolioCycleBytes),
  }
  for (const [key, value] of Object.entries(digests)) {
    assert(manifest[key] === value, `manifest ${key}`)
    assert((contract.generated_digests as J)[key] === value, `contract generated_digests ${key}`)
  }
  // CR=0 for every package member (LF discipline).
  for (const file of files) {
    assert(!readFileSync(resolve(ROOT, file.path)).includes(0x0d), `CR found in ${file.path}`)
  }

  // --- Both profiles ---
  const checkpointResult = auditProfile(contract, "collection_checkpoint", checkpointMatrixSet, checkpointCycleSet, 11, 4)
  const portfolioResult = auditProfile(contract, "collections_portfolio", portfolioMatrixSet, portfolioCycleSet, 18, 5)

  // --- Combined aggregates: independently re-derived, not trusted ---
  const combinedFlat: Record<string, number> = {
    vector_count: 29,
    stable: checkpointResult.retalliedAggregate.stable! + portfolioResult.retalliedAggregate.stable!,
    history_sensitive:
      checkpointResult.retalliedAggregate.history_sensitive! + portfolioResult.retalliedAggregate.history_sensitive!,
    unresolved: checkpointResult.retalliedAggregate.unresolved! + portfolioResult.retalliedAggregate.unresolved!,
    out_of_domain: checkpointResult.retalliedAggregate.out_of_domain! + portfolioResult.retalliedAggregate.out_of_domain!,
    violation: checkpointResult.retalliedAggregate.violation! + portfolioResult.retalliedAggregate.violation!,
  }
  assert(JSON.stringify(combinedFlat) === JSON.stringify(contract.combined_flat_aggregate), "combined_flat_aggregate")

  function cycleTally(cycles: J[]): Record<string, number> {
    const counts: Record<string, number> = { stable: 0, history_sensitive: 0, unresolved: 0, out_of_domain: 0, violation: 0 }
    for (const entry of cycles) {
      const classification = (entry.observed as J).classification as string
      counts[classification] = (counts[classification] ?? 0) + 1
    }
    return counts
  }
  const checkpointCycleTally = cycleTally(checkpointResult.cycles)
  const portfolioCycleTally = cycleTally(portfolioResult.cycles)
  const combinedCycle: Record<string, number> = {
    cycle_count: 9,
    stable: checkpointCycleTally.stable! + portfolioCycleTally.stable!,
    history_sensitive: checkpointCycleTally.history_sensitive! + portfolioCycleTally.history_sensitive!,
    unresolved: checkpointCycleTally.unresolved! + portfolioCycleTally.unresolved!,
    out_of_domain: checkpointCycleTally.out_of_domain! + portfolioCycleTally.out_of_domain!,
    violation: checkpointCycleTally.violation! + portfolioCycleTally.violation!,
  }
  assert(JSON.stringify(combinedCycle) === JSON.stringify(contract.combined_cycle_aggregate), "combined_cycle_aggregate")

  // --- Closure implication, from the frozen evidence block ---
  const closure = contract.closure as J
  const evidence = closure.evidence as J
  assert((evidence.d_equals_p as boolean) === true, "closure evidence: D === P")
  assert((evidence.c_in_d as boolean) === true, "closure evidence: C in D")
  assert((evidence.c_in_p as boolean) === true, "closure evidence: C in P")
  assert((evidence.checkpoint_verifies as boolean) === true, "closure evidence: Checkpoint locally valid")
  // The implication itself: whenever D === P holds, C in D and C in P must
  // agree (this is what the closure claims, re-checked against the frozen
  // numbers rather than merely re-reading the boolean fields above).
  const derivedRefs = evidence.derived_collection_refs as string[]
  const storedRefs = evidence.stored_portfolio_refs as string[]
  const dEqualsPRecheck =
    derivedRefs.length === storedRefs.length && [...derivedRefs].sort().every((r, i) => r === [...storedRefs].sort()[i])
  assert(dEqualsPRecheck, "closure independent re-check: D === P")
  const cRef = evidence.checkpoint_collection_ref as string
  assert(derivedRefs.includes(cRef) === (evidence.c_in_d as boolean), "closure independent re-check: C in D")
  assert(storedRefs.includes(cRef) === (evidence.c_in_p as boolean), "closure independent re-check: C in P")

  // --- Locally-valid/globally-invalid evidence ---
  const lvgi = contract.locally_valid_globally_invalid_evidence as J
  const checkpointEvidence = lvgi.collection_checkpoint as J
  assert(checkpointEvidence.collection_verifies === true, "LVGI checkpoint: collection verifies")
  assert(checkpointEvidence.checkpoint_verifies === true, "LVGI checkpoint: checkpoint verifies")
  assert(checkpointEvidence.cross_link_match === false, "LVGI checkpoint: cross-link false")

  const portfolioEvidence = lvgi.collections_portfolio as J
  assert(portfolioEvidence.all_collections_verify === true, "LVGI portfolio: all collections verify")
  assert(portfolioEvidence.portfolio_verifies === true, "LVGI portfolio: portfolio verifies")
  assert(portfolioEvidence.cross_link_match === false, "LVGI portfolio: cross-link false")
  const dupDerived = portfolioEvidence.derived_collection_refs as string[]
  const dupStored = portfolioEvidence.stored_collection_refs as string[]
  assert(dupDerived.length === 2 && dupStored.length === 1, "LVGI portfolio: duplicate-preserving multiset cardinality")
  assert(dupDerived[0] === dupDerived[1], "LVGI portfolio: duplicate ref appears twice in derived multiset")
  assert(dupDerived[0] === dupStored[0], "LVGI portfolio: duplicate ref is the same ref stored once")

  console.log(
    JSON.stringify(
      {
        ok: true,
        package_id: "cross-object-transformation-stability-v0",
        fixture_set_sha256: fixtureSetSha256,
        ...digests,
        combined_flat_aggregate: combinedFlat,
        combined_cycle_aggregate: combinedCycle,
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
