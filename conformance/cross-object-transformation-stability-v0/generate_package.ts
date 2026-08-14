#!/usr/bin/env bun
/**
 * Deterministic Cross-Object Transformation Stability v0 conformance package
 * generator.
 *
 * Package-local only. Imports the already-merged PR #187
 * (Collection -> Checkpoint) and PR #191 (Collections -> Portfolio)
 * cross-object Transformation Stability evaluators, and the frozen Chronicle
 * domain constructors, read-only to materialize a frozen, byte-deterministic
 * package snapshot. Adds no exports to src/** and changes no implementation
 * semantics. Freezes two already-merged pairwise profiles; does not
 * implement a third, triple-object evaluator (see SPEC.md "Closure").
 *
 * Usage:
 *   bun conformance/cross-object-transformation-stability-v0/generate_package.ts --check
 *   bun conformance/cross-object-transformation-stability-v0/generate_package.ts --write
 */
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  createChronicleCheckpointV0,
  createChronicleCollectionV0,
  createChroniclePortfolioV0,
  deriveCollectionRefFromChronicleCollection,
  sortCollectionRefs,
  verifyChronicleCheckpointV0,
  verifyChronicleCollectionV0,
  verifyChroniclePortfolioV0,
} from "../../src/receiptos/capsule/chronicle-portfolio-v0"
import {
  CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_CYCLE_VECTORS_V0,
  evaluateChronicleCollectionCheckpointTransformationCycleVectorV0,
  evaluateChronicleCollectionCheckpointTransformationMatrixV0,
  type ChronicleCollectionCheckpointBundleV0,
} from "../../src/receiptos/challenge/transformation-stability-chronicle-collection-checkpoint"
import {
  CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_CYCLE_VECTORS_V0,
  evaluateChronicleCollectionsPortfolioTransformationCycleVectorV0,
  evaluateChronicleCollectionsPortfolioTransformationMatrixV0,
  type ChronicleCollectionsPortfolioBundleV0,
} from "../../src/receiptos/challenge/transformation-stability-chronicle-collection-portfolio"

const HERE = resolve(fileURLToPath(new URL(".", import.meta.url)))
const ROOT = resolve(HERE, "../..")
const PACKAGE_DIR = resolve(ROOT, "conformance/cross-object-transformation-stability-v0")

function usage(): never {
  console.error(
    "Usage: bun conformance/cross-object-transformation-stability-v0/generate_package.ts --check|--write",
  )
  process.exit(2)
}

const modeArg = process.argv[2]
if (modeArg !== "--check" && modeArg !== "--write") usage()
const mode = modeArg === "--check" ? "check" : "write"

// ---------------------------------------------------------------------------
// Package-local fixtures. These are byte-for-byte the same fixture recipes
// already used (and tested) by each merged profile's own focused test file
// (tests/receiptos/transformation-stability-chronicle-collection-checkpoint.test.ts
// and tests/receiptos/transformation-stability-chronicle-collection-portfolio.test.ts).
// No private helper is imported from either test file or profile module;
// both fixtures are rebuilt here using only the already-exported Chronicle
// domain constructors.
// ---------------------------------------------------------------------------

function buildCollectionCheckpointFixture(): ChronicleCollectionCheckpointBundleV0 {
  const collection = createChronicleCollectionV0(
    {
      schema: "chronicle_entry.v0",
      entry_id: "entry-a",
      source_system: "ReceiptOS",
      receipt_root: `0x${"a".repeat(64)}`,
      proof_object_ref: "receiptos://portable-proof-object/entry-a",
      evidence_capsule_ref: "embedded:entry-a:evidence_capsule",
      provenance_summary_ref: "embedded:entry-a:provenance_summary",
      created_from: null,
      labels: [],
      notes: null,
    },
    { collectionId: "collection-a", artifactRefs: ["entry-b", "entry-a"] },
  )
  const collectionRef = deriveCollectionRefFromChronicleCollection(collection)
  const checkpoint = createChronicleCheckpointV0({
    checkpointId: "checkpoint-1",
    collectionRef,
    entryRefs: ["entry-a"],
    prevCheckpoint: "checkpoint-0",
    sequence: 1,
  })
  return { collection, checkpoint }
}

function buildCollectionsPortfolioFixture(): ChronicleCollectionsPortfolioBundleV0 {
  const collectionA = createChronicleCollectionV0(
    {
      schema: "chronicle_entry.v0",
      entry_id: "entry-alpha",
      source_system: "ReceiptOS",
      receipt_root: `0x${"a".repeat(64)}`,
      proof_object_ref: "receiptos://portable-proof-object/entry-alpha",
      evidence_capsule_ref: "embedded:entry-alpha:evidence_capsule",
      provenance_summary_ref: "embedded:entry-alpha:provenance_summary",
      created_from: null,
      labels: [],
      notes: null,
    },
    { collectionId: "collection-alpha", artifactRefs: ["entry-alpha-2", "entry-alpha-1"] },
  )
  const collectionB = createChronicleCollectionV0(
    {
      schema: "chronicle_entry.v0",
      entry_id: "entry-beta",
      source_system: "ReceiptOS",
      receipt_root: `0x${"b".repeat(64)}`,
      proof_object_ref: "receiptos://portable-proof-object/entry-beta",
      evidence_capsule_ref: "embedded:entry-beta:evidence_capsule",
      provenance_summary_ref: "embedded:entry-beta:provenance_summary",
      created_from: null,
      labels: [],
      notes: null,
    },
    { collectionId: "collection-beta", artifactRefs: ["entry-beta-1"] },
  )
  const portfolio = createChroniclePortfolioV0([collectionA, collectionB], { portfolioId: "portfolio-1" })
  return { collections: [collectionA, collectionB], portfolio }
}

// ---------------------------------------------------------------------------
// Digest helpers (audit-convention canonical JSON; independent of production
// canonicalizer, matches the convention already used by every existing
// conformance package's generate_package.ts / audit_package.ts).
// ---------------------------------------------------------------------------

const shaBytes = (bytes: Uint8Array | Buffer) => createHash("sha256").update(bytes).digest("hex")

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

async function main() {
  const checkpointFixture = buildCollectionCheckpointFixture()
  const portfolioFixture = buildCollectionsPortfolioFixture()

  // --- Flat matrices: materialized directly from each profile's own public
  // matrix evaluator. No comparison logic is reimplemented here. ---

  const checkpointMatrix = await evaluateChronicleCollectionCheckpointTransformationMatrixV0(checkpointFixture)
  const portfolioMatrix = await evaluateChronicleCollectionsPortfolioTransformationMatrixV0(portfolioFixture)

  const checkpointMatrixDoc = {
    schema: checkpointMatrix.schema,
    matrix_id: checkpointMatrix.matrix_id,
    vector_count: checkpointMatrix.vector_count,
    aggregate: checkpointMatrix.aggregate,
    pass: checkpointMatrix.pass,
    members: checkpointMatrix.members,
  }
  const portfolioMatrixDoc = {
    schema: portfolioMatrix.schema,
    matrix_id: portfolioMatrix.matrix_id,
    vector_count: portfolioMatrix.vector_count,
    aggregate: portfolioMatrix.aggregate,
    pass: portfolioMatrix.pass,
    members: portfolioMatrix.members,
  }

  // --- Closed cycles: one evaluation per frozen cycle_id, in the profile's
  // own normative order, via each profile's own public cycle evaluator. ---

  const checkpointCycles: Array<{ cycle_id: string; observed: unknown }> = []
  for (const spec of CHRONICLE_COLLECTION_CHECKPOINT_TRANSFORMATION_CYCLE_VECTORS_V0) {
    const observed = await evaluateChronicleCollectionCheckpointTransformationCycleVectorV0(
      spec.vector_id,
      checkpointFixture,
    )
    checkpointCycles.push({ cycle_id: spec.vector_id, observed })
  }
  const checkpointCycleDoc = {
    schema: "receiptos.cross_object_transformation_stability_cycle_set.v0",
    profile: "collection_checkpoint",
    cycle_count: checkpointCycles.length,
    cycles: checkpointCycles,
  }

  const portfolioCycles: Array<{ cycle_id: string; observed: unknown }> = []
  for (const spec of CHRONICLE_COLLECTIONS_PORTFOLIO_TRANSFORMATION_CYCLE_VECTORS_V0) {
    const observed = await evaluateChronicleCollectionsPortfolioTransformationCycleVectorV0(
      spec.vector_id,
      portfolioFixture,
    )
    portfolioCycles.push({ cycle_id: spec.vector_id, observed })
  }
  const portfolioCycleDoc = {
    schema: "receiptos.cross_object_transformation_stability_cycle_set.v0",
    profile: "collections_portfolio",
    cycle_count: portfolioCycles.length,
    cycles: portfolioCycles,
  }

  const checkpointMatrixPath = resolve(PACKAGE_DIR, "vectors/collection-checkpoint-matrix-set.json")
  const portfolioMatrixPath = resolve(PACKAGE_DIR, "vectors/collection-portfolio-matrix-set.json")
  const checkpointCyclePath = resolve(PACKAGE_DIR, "cycles/collection-checkpoint-cycle-set.json")
  const portfolioCyclePath = resolve(PACKAGE_DIR, "cycles/collection-portfolio-cycle-set.json")
  const manifestPath = resolve(PACKAGE_DIR, "manifest.json")
  const contractPath = resolve(PACKAGE_DIR, "contract.json")

  const checkpointMatrixBytes = serialize(checkpointMatrixDoc)
  const portfolioMatrixBytes = serialize(portfolioMatrixDoc)
  const checkpointCycleBytes = serialize(checkpointCycleDoc)
  const portfolioCycleBytes = serialize(portfolioCycleDoc)

  const checkpointMatrixSetSha256 = shaBytes(Buffer.from(checkpointMatrixBytes, "utf8"))
  const portfolioMatrixSetSha256 = shaBytes(Buffer.from(portfolioMatrixBytes, "utf8"))
  const checkpointCycleSetSha256 = shaBytes(Buffer.from(checkpointCycleBytes, "utf8"))
  const portfolioCycleSetSha256 = shaBytes(Buffer.from(portfolioCycleBytes, "utf8"))

  const drifted: string[] = []
  const contract = JSON.parse(readFileSync(contractPath, "utf8"))

  // --- Fixtures: frozen raw JSON, so both auditors can independently
  // recompute every Chronicle root from committed inputs without ever
  // calling a TS constructor. ---
  const fixtures = {
    collection_checkpoint: {
      collection: checkpointFixture.collection,
      checkpoint: checkpointFixture.checkpoint,
    },
    collections_portfolio: {
      collections: portfolioFixture.collections,
      portfolio: portfolioFixture.portfolio,
    },
  }
  if (JSON.stringify(contract.fixtures) !== JSON.stringify(fixtures)) {
    drifted.push("contract.json:fixtures")
  }

  const expectDigest = (label: string, expected: unknown, actual: unknown) => {
    if (expected !== actual) drifted.push(label)
  }
  expectDigest(
    "contract.json:generated_digests.collection_checkpoint_matrix_set_sha256",
    contract.generated_digests?.collection_checkpoint_matrix_set_sha256,
    checkpointMatrixSetSha256,
  )
  expectDigest(
    "contract.json:generated_digests.collections_portfolio_matrix_set_sha256",
    contract.generated_digests?.collections_portfolio_matrix_set_sha256,
    portfolioMatrixSetSha256,
  )
  expectDigest(
    "contract.json:generated_digests.collection_checkpoint_cycle_set_sha256",
    contract.generated_digests?.collection_checkpoint_cycle_set_sha256,
    checkpointCycleSetSha256,
  )
  expectDigest(
    "contract.json:generated_digests.collections_portfolio_cycle_set_sha256",
    contract.generated_digests?.collections_portfolio_cycle_set_sha256,
    portfolioCycleSetSha256,
  )

  function expectAggregate(label: string, expected: unknown, actual: Record<string, number>) {
    const exp = expected as Record<string, number> | undefined
    if (!exp) {
      drifted.push(`${label} (missing)`)
      return
    }
    for (const key of Object.keys(actual)) {
      if (exp[key] !== actual[key]) drifted.push(`${label}.${key}`)
    }
  }
  expectAggregate(
    "contract.json:collection_checkpoint.expected_aggregate",
    contract.collection_checkpoint?.expected_aggregate,
    checkpointMatrix.aggregate,
  )
  expectAggregate(
    "contract.json:collections_portfolio.expected_aggregate",
    contract.collections_portfolio?.expected_aggregate,
    portfolioMatrix.aggregate,
  )

  // Combined aggregates are derived mechanically from the two live matrix /
  // cycle results, never hand-adjusted.
  const combinedFlatAggregate = {
    vector_count: checkpointMatrix.vector_count + portfolioMatrix.vector_count,
    stable: checkpointMatrix.aggregate.stable + portfolioMatrix.aggregate.stable,
    history_sensitive: checkpointMatrix.aggregate.history_sensitive + portfolioMatrix.aggregate.history_sensitive,
    unresolved: checkpointMatrix.aggregate.unresolved + portfolioMatrix.aggregate.unresolved,
    out_of_domain: checkpointMatrix.aggregate.out_of_domain + portfolioMatrix.aggregate.out_of_domain,
    violation: checkpointMatrix.aggregate.violation + portfolioMatrix.aggregate.violation,
  }
  function tally(cycles: Array<{ observed: unknown }>) {
    const counts = { stable: 0, history_sensitive: 0, unresolved: 0, out_of_domain: 0, violation: 0 }
    for (const entry of cycles) {
      const classification = (entry.observed as { classification: keyof typeof counts }).classification
      counts[classification] += 1
    }
    return counts
  }
  const checkpointCycleTally = tally(checkpointCycles)
  const portfolioCycleTally = tally(portfolioCycles)
  const combinedCycleAggregate = {
    cycle_count: checkpointCycles.length + portfolioCycles.length,
    stable: checkpointCycleTally.stable + portfolioCycleTally.stable,
    history_sensitive: checkpointCycleTally.history_sensitive + portfolioCycleTally.history_sensitive,
    unresolved: checkpointCycleTally.unresolved + portfolioCycleTally.unresolved,
    out_of_domain: checkpointCycleTally.out_of_domain + portfolioCycleTally.out_of_domain,
    violation: checkpointCycleTally.violation + portfolioCycleTally.violation,
  }

  expectAggregate("contract.json:combined_flat_aggregate", contract.combined_flat_aggregate, combinedFlatAggregate)
  expectAggregate("contract.json:combined_cycle_aggregate", contract.combined_cycle_aggregate, combinedCycleAggregate)

  // --- Closure evidence: D === P and C in D implies C in P, recomputed live
  // against the Collections -> Portfolio fixture plus one standalone,
  // independently valid Checkpoint referencing one of its two Collections.
  // Never reused/imported from either profile's private helpers. ---

  const derivedRefs = sortCollectionRefs(
    portfolioFixture.collections.map(deriveCollectionRefFromChronicleCollection),
  )
  const storedRefs = sortCollectionRefs(portfolioFixture.portfolio.collection_refs)
  const dEqualsP =
    derivedRefs.length === storedRefs.length && derivedRefs.every((ref, index) => ref === storedRefs[index])
  const closureCollectionRef = deriveCollectionRefFromChronicleCollection(portfolioFixture.collections[0]!)
  const closureCheckpoint = createChronicleCheckpointV0({
    checkpointId: "closure-checkpoint-0",
    collectionRef: closureCollectionRef,
    entryRefs: [],
    prevCheckpoint: null,
    sequence: 0,
  })
  const cInD = derivedRefs.includes(closureCheckpoint.collection_ref)
  const cInP = storedRefs.includes(closureCheckpoint.collection_ref)
  const closureEvidence = {
    derived_collection_refs: derivedRefs,
    stored_portfolio_refs: storedRefs,
    checkpoint_collection_ref: closureCheckpoint.collection_ref,
    d_equals_p: dEqualsP,
    c_in_d: cInD,
    c_in_p: cInP,
    checkpoint_verifies: verifyChronicleCheckpointV0(closureCheckpoint).ok,
  }
  const expectedClosure = contract.closure?.evidence as Record<string, unknown> | undefined
  if (JSON.stringify(expectedClosure) !== JSON.stringify(closureEvidence)) {
    drifted.push("contract.json:closure.evidence")
  }

  // --- Locally-valid/globally-invalid evidence: recomputed live via the
  // exact same mutation recipes each profile's own frozen vector already
  // exercises (upstream_mutation_without_downstream_update /
  // duplicate_collection_ref_multiset_mismatch), using only already-reused
  // low-level verifiers -- not a third evaluator. ---

  const mutatedCollection = { ...checkpointFixture.collection, collection_id: `${checkpointFixture.collection.collection_id}-mutated` }
  mutatedCollection.collection_root = verifyChronicleCollectionV0(mutatedCollection).recomputed_collection_root
  const checkpointEvidence = {
    vector_id: "upstream_mutation_without_downstream_update",
    collection_verifies: verifyChronicleCollectionV0(mutatedCollection).ok,
    checkpoint_verifies: verifyChronicleCheckpointV0(checkpointFixture.checkpoint).ok,
    cross_link_match:
      deriveCollectionRefFromChronicleCollection(mutatedCollection) === checkpointFixture.checkpoint.collection_ref,
  }

  const duplicateCollection = { ...portfolioFixture.collections[0]! }
  const singleRef = deriveCollectionRefFromChronicleCollection(portfolioFixture.collections[0]!)
  const dupPortfolioVerification = verifyChroniclePortfolioV0({
    ...portfolioFixture.portfolio,
    collection_refs: [singleRef],
  })
  const dupPortfolio = { ...portfolioFixture.portfolio, collection_refs: [singleRef], portfolio_root: dupPortfolioVerification.recomputed_portfolio_root }
  const dupDerivedRefs = sortCollectionRefs(
    [portfolioFixture.collections[0]!, duplicateCollection].map(deriveCollectionRefFromChronicleCollection),
  )
  const dupStoredRefs = sortCollectionRefs(dupPortfolio.collection_refs)
  const portfolioEvidence = {
    vector_id: "duplicate_collection_ref_multiset_mismatch",
    all_collections_verify:
      verifyChronicleCollectionV0(portfolioFixture.collections[0]!).ok && verifyChronicleCollectionV0(duplicateCollection).ok,
    portfolio_verifies: verifyChroniclePortfolioV0(dupPortfolio).ok,
    derived_collection_refs: dupDerivedRefs,
    stored_collection_refs: dupStoredRefs,
    cross_link_match:
      dupDerivedRefs.length === dupStoredRefs.length && dupDerivedRefs.every((ref, i) => ref === dupStoredRefs[i]),
  }

  const expectedLVGI = contract.locally_valid_globally_invalid_evidence as Record<string, unknown> | undefined
  if (JSON.stringify(expectedLVGI?.collection_checkpoint) !== JSON.stringify(checkpointEvidence)) {
    drifted.push("contract.json:locally_valid_globally_invalid_evidence.collection_checkpoint")
  }
  if (JSON.stringify(expectedLVGI?.collections_portfolio) !== JSON.stringify(portfolioEvidence)) {
    drifted.push("contract.json:locally_valid_globally_invalid_evidence.collections_portfolio")
  }

  function checkOrWrite(path: string, relLabel: string, bytes: string) {
    if (mode === "write") {
      writeFileSync(path, bytes, "utf8")
      return
    }
    let onDisk: string | null = null
    try {
      onDisk = readFileSync(path, "utf8")
    } catch {
      onDisk = null
    }
    if (onDisk !== bytes) drifted.push(relLabel)
  }

  checkOrWrite(
    checkpointMatrixPath,
    "conformance/cross-object-transformation-stability-v0/vectors/collection-checkpoint-matrix-set.json",
    checkpointMatrixBytes,
  )
  checkOrWrite(
    portfolioMatrixPath,
    "conformance/cross-object-transformation-stability-v0/vectors/collection-portfolio-matrix-set.json",
    portfolioMatrixBytes,
  )
  checkOrWrite(
    checkpointCyclePath,
    "conformance/cross-object-transformation-stability-v0/cycles/collection-checkpoint-cycle-set.json",
    checkpointCycleBytes,
  )
  checkOrWrite(
    portfolioCyclePath,
    "conformance/cross-object-transformation-stability-v0/cycles/collection-portfolio-cycle-set.json",
    portfolioCycleBytes,
  )

  // manifest.json covers every other authored/generated package file, sorted
  // by repo path (manifest path order is part of package authority). It
  // never hashes itself.
  const manifestMembers = [
    "SPEC.md",
    "contract.json",
    "generate_package.ts",
    "audit_package.ts",
    "verify_independent.py",
    "vectors/collection-checkpoint-matrix-set.json",
    "vectors/collection-portfolio-matrix-set.json",
    "cycles/collection-checkpoint-cycle-set.json",
    "cycles/collection-portfolio-cycle-set.json",
  ].sort((a, b) => {
    const left = `conformance/cross-object-transformation-stability-v0/${a}`
    const right = `conformance/cross-object-transformation-stability-v0/${b}`
    return left < right ? -1 : left > right ? 1 : 0
  })

  const rows: string[] = []
  const files: Array<{ path: string; sha256: string }> = []
  for (const member of manifestMembers) {
    const absPath = resolve(PACKAGE_DIR, member)
    const bytes =
      member === "vectors/collection-checkpoint-matrix-set.json"
        ? Buffer.from(checkpointMatrixBytes, "utf8")
        : member === "vectors/collection-portfolio-matrix-set.json"
          ? Buffer.from(portfolioMatrixBytes, "utf8")
          : member === "cycles/collection-checkpoint-cycle-set.json"
            ? Buffer.from(checkpointCycleBytes, "utf8")
            : member === "cycles/collection-portfolio-cycle-set.json"
              ? Buffer.from(portfolioCycleBytes, "utf8")
              : readFileSync(absPath)
    const digest = shaBytes(bytes)
    const repoPath = `conformance/cross-object-transformation-stability-v0/${member}`
    files.push({ path: repoPath, sha256: digest })
    rows.push(`${repoPath}\t${digest}\n`)
  }
  const fixtureSetSha256 = shaBytes(Buffer.from(rows.join(""), "utf8"))

  const manifestDoc = {
    schema: "cross_object_transformation_stability_package_fixture_manifest.v0",
    package_id: "cross-object-transformation-stability-v0",
    version: "v0",
    file_count: files.length,
    files,
    fixture_set_sha256: fixtureSetSha256,
    collection_checkpoint_matrix_set_sha256: checkpointMatrixSetSha256,
    collections_portfolio_matrix_set_sha256: portfolioMatrixSetSha256,
    collection_checkpoint_cycle_set_sha256: checkpointCycleSetSha256,
    collections_portfolio_cycle_set_sha256: portfolioCycleSetSha256,
  }
  const manifestBytes = serialize(manifestDoc)
  checkOrWrite(manifestPath, "conformance/cross-object-transformation-stability-v0/manifest.json", manifestBytes)

  const ok = drifted.length === 0
  console.log(
    JSON.stringify(
      {
        mode,
        ok,
        drifted_paths: drifted,
        fixture_set_sha256: fixtureSetSha256,
        collection_checkpoint_matrix_set_sha256: checkpointMatrixSetSha256,
        collections_portfolio_matrix_set_sha256: portfolioMatrixSetSha256,
        collection_checkpoint_cycle_set_sha256: checkpointCycleSetSha256,
        collections_portfolio_cycle_set_sha256: portfolioCycleSetSha256,
        combined_flat_aggregate: combinedFlatAggregate,
        combined_cycle_aggregate: combinedCycleAggregate,
        checkpoint_matrix_pass: checkpointMatrix.pass,
        portfolio_matrix_pass: portfolioMatrix.pass,
        closure_evidence: closureEvidence,
        collection_checkpoint_evidence: checkpointEvidence,
        collections_portfolio_evidence: portfolioEvidence,
        fixtures,
      },
      null,
      2,
    ),
  )
  process.exit(ok || mode === "write" ? 0 : 1)
}

main().catch((error) => {
  console.log(
    JSON.stringify(
      { ok: false, reason: error instanceof Error ? error.message : "package_materialization_failure" },
      null,
      2,
    ),
  )
  process.exit(1)
})
