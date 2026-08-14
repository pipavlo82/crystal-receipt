import { describe, expect, test } from "bun:test"
import { execFileSync, spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  createChronicleCheckpointV0,
  createChronicleCollectionV0,
  createChroniclePortfolioV0,
  deriveCollectionRefFromChronicleCollection,
} from "../../src/receiptos/capsule/chronicle-portfolio-v0"
import {
  evaluateChronicleCollectionCheckpointTransformationCycleVectorV0,
  evaluateChronicleCollectionCheckpointTransformationMatrixV0,
} from "../../src/receiptos/challenge/transformation-stability-chronicle-collection-checkpoint"
import {
  evaluateChronicleCollectionsPortfolioTransformationCycleVectorV0,
  evaluateChronicleCollectionsPortfolioTransformationMatrixV0,
} from "../../src/receiptos/challenge/transformation-stability-chronicle-collection-portfolio"

const root = resolve(import.meta.dir, "../..")
const PACKAGE = "conformance/cross-object-transformation-stability-v0"

const readJson = (relativePath: string) => JSON.parse(readFileSync(resolve(root, relativePath), "utf8"))

const CHECKPOINT_VECTOR_IDS = [
  "stable_coordinated_roundtrip",
  "collection_artifact_refs_reorder_stable",
  "upstream_mutation_without_downstream_update",
  "downstream_reference_tamper_recomputed",
  "coordinated_upstream_downstream_update",
  "collection_metadata_forbidden_mutation",
  "stored_checkpoint_root_tamper",
  "stored_collection_root_tamper",
  "collection_schema_literal_mutation",
  "invalid_genesis_out_of_domain",
  "entry_refs_recompute_unresolved",
]

const CHECKPOINT_CYCLE_IDS = [
  "stable_multi_edge_roundtrip_reorder",
  "cross_link_mutation_then_restore",
  "invalid_start_out_of_domain",
  "entry_refs_corrupt_unresolved",
]

const PORTFOLIO_VECTOR_IDS = [
  "stable_canonical_roundtrip",
  "collections_and_refs_reorder_stable",
  "upstream_collection_mutation_without_portfolio_update",
  "downstream_portfolio_ref_tamper_recomputed",
  "coordinated_collection_and_portfolio_update",
  "missing_portfolio_ref",
  "extra_portfolio_ref",
  "replace_bundled_collection_with_other_valid_collection",
  "duplicate_collection_ref_multiset_mismatch",
  "collection_metadata_forbidden_mutation",
  "portfolio_metadata_forbidden_mutation",
  "collection_schema_literal_mutation",
  "portfolio_schema_literal_mutation",
  "stored_collection_root_tamper",
  "stored_portfolio_root_tamper",
  "empty_collections_out_of_domain",
  "collection_artifact_refs_corrupt_unresolved",
  "portfolio_collection_refs_corrupt_unresolved",
]

const PORTFOLIO_CYCLE_IDS = [
  "stable_multi_edge_roundtrip_reorder",
  "cross_link_mutation_then_restore",
  "link_only_mutation_then_restore",
  "invalid_start_out_of_domain",
  "collections_corrupt_unresolved",
]

const COMBINED_FLAT_AGGREGATE = {
  vector_count: 29,
  stable: 4,
  history_sensitive: 0,
  unresolved: 3,
  out_of_domain: 2,
  violation: 20,
}

const COMBINED_CYCLE_AGGREGATE = {
  cycle_count: 9,
  stable: 2,
  history_sensitive: 0,
  unresolved: 2,
  out_of_domain: 2,
  violation: 3,
}

// Chronicle-native fixtures only, rebuilt locally from already-exported
// constructors -- byte-for-byte the same recipe as each profile's own
// merged test file and as conformance/.../generate_package.ts. No private
// helper is imported from either profile module or its test file.
function buildCheckpointFixture() {
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

function buildPortfolioFixture() {
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

describe("cross-object transformation stability v0 conformance package", () => {
  test("generator reports zero drift", () => {
    const result = spawnSync("bun", [`${PACKAGE}/generate_package.ts`, "--check"], { cwd: root, encoding: "utf8" })
    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.drifted_paths).toEqual([])
  })

  test("independent TypeScript auditor passes with zero production imports", () => {
    const result = spawnSync("bun", [`${PACKAGE}/audit_package.ts`], { cwd: root, encoding: "utf8" })
    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.production_imports).toBe(0)
  })

  test("independent Python auditor passes with zero production imports", () => {
    const result = spawnSync("python", [`${PACKAGE}/verify_independent.py`], { cwd: root, encoding: "utf8" })
    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.production_imports).toBe(0)
  })

  test("contract pins exact source authentication", () => {
    const contract = readJson(`${PACKAGE}/contract.json`)
    expect(contract.claim).toBe("pairwise_cross_object_consistency")
    expect(contract.cycle_claim).toBe("edgewise_pairwise_cross_object_consistency_closed_cycle")
    expect(contract.closure_claim).toBe("pairwise_closure_sufficient_for_current_chronicle_composition")
    expect(contract.source.base_merge_commit).toBe("3fa8e96a9b3236c128ad0f20602ed84d2c615ea8")
    expect(contract.source.chronicle_domain_blob_sha1).toBe("0e790911092546c62344f980e6b611542bcd00fe")
    expect(contract.source.collection_checkpoint_module_blob_sha1).toBe("da1a0bca7e9ae36f2805a837cd9adaaec4d3ad7a")
    expect(contract.source.collections_portfolio_module_blob_sha1).toBe("890ddb8d5a7e8ac8bd7dfc6c0682589d796393d9")
  })

  test("pinned blob OIDs resolve at HEAD for the current tree", () => {
    const paths = [
      "src/receiptos/capsule/chronicle-portfolio-v0.ts",
      "src/receiptos/challenge/transformation-stability-chronicle-collection-checkpoint.ts",
      "src/receiptos/challenge/transformation-stability-chronicle-collection-portfolio.ts",
    ]
    const expected = [
      "0e790911092546c62344f980e6b611542bcd00fe",
      "da1a0bca7e9ae36f2805a837cd9adaaec4d3ad7a",
      "890ddb8d5a7e8ac8bd7dfc6c0682589d796393d9",
    ]
    for (let i = 0; i < paths.length; i += 1) {
      const oid = execFileSync("git", ["rev-parse", `HEAD:${paths[i]}`], { cwd: root, encoding: "utf8" }).trim()
      expect(oid).toBe(expected[i])
    }
  })

  test("Collection -> Checkpoint: exact frozen inventory and aggregate", () => {
    const contract = readJson(`${PACKAGE}/contract.json`)
    expect(contract.collection_checkpoint.vector_inventory).toEqual(CHECKPOINT_VECTOR_IDS)
    expect(contract.collection_checkpoint.expected_aggregate).toEqual({
      stable: 2,
      history_sensitive: 0,
      unresolved: 1,
      out_of_domain: 1,
      violation: 7,
    })
    expect(contract.collection_checkpoint.cycle_vector_inventory).toEqual(CHECKPOINT_CYCLE_IDS)
  })

  test("Collections -> Portfolio: exact frozen inventory and aggregate", () => {
    const contract = readJson(`${PACKAGE}/contract.json`)
    expect(contract.collections_portfolio.vector_inventory).toEqual(PORTFOLIO_VECTOR_IDS)
    expect(contract.collections_portfolio.expected_aggregate).toEqual({
      stable: 2,
      history_sensitive: 0,
      unresolved: 2,
      out_of_domain: 1,
      violation: 13,
    })
    expect(contract.collections_portfolio.cycle_vector_inventory).toEqual(PORTFOLIO_CYCLE_IDS)
  })

  test("combined flat and cycle aggregates match the mechanically derived sums", () => {
    const contract = readJson(`${PACKAGE}/contract.json`)
    expect(contract.combined_flat_aggregate).toEqual(COMBINED_FLAT_AGGREGATE)
    expect(contract.combined_cycle_aggregate).toEqual(COMBINED_CYCLE_AGGREGATE)
  })

  test("frozen Collection -> Checkpoint matrix set matches a fresh live recompute", async () => {
    const fixture = buildCheckpointFixture()
    const live = await evaluateChronicleCollectionCheckpointTransformationMatrixV0(fixture)
    const frozen = readJson(`${PACKAGE}/vectors/collection-checkpoint-matrix-set.json`)

    expect(frozen.aggregate).toEqual(live.aggregate)
    expect(frozen.pass).toBe(true)
    expect(frozen.members.map((m: { vector_id: string }) => m.vector_id)).toEqual(
      live.members.map((m) => m.vector_id),
    )
    for (let i = 0; i < live.members.length; i += 1) {
      expect(frozen.members[i].observed.classification).toBe(live.members[i]!.observed.classification)
    }
  })

  test("frozen Collections -> Portfolio matrix set matches a fresh live recompute", async () => {
    const fixture = buildPortfolioFixture()
    const live = await evaluateChronicleCollectionsPortfolioTransformationMatrixV0(fixture)
    const frozen = readJson(`${PACKAGE}/vectors/collection-portfolio-matrix-set.json`)

    expect(frozen.aggregate).toEqual(live.aggregate)
    expect(frozen.pass).toBe(true)
    expect(frozen.members.map((m: { vector_id: string }) => m.vector_id)).toEqual(
      live.members.map((m) => m.vector_id),
    )
    for (let i = 0; i < live.members.length; i += 1) {
      expect(frozen.members[i].observed.classification).toBe(live.members[i]!.observed.classification)
    }
  })

  test("frozen Collection -> Checkpoint cycle set matches a fresh live recompute", async () => {
    const fixture = buildCheckpointFixture()
    const frozen = readJson(`${PACKAGE}/cycles/collection-checkpoint-cycle-set.json`)
    expect(frozen.cycles.map((c: { cycle_id: string }) => c.cycle_id)).toEqual(CHECKPOINT_CYCLE_IDS)
    for (const entry of frozen.cycles as Array<{ cycle_id: string; observed: { classification: string } }>) {
      const live = await evaluateChronicleCollectionCheckpointTransformationCycleVectorV0(
        entry.cycle_id as (typeof CHECKPOINT_CYCLE_IDS)[number],
        fixture,
      )
      expect(live.classification).toBe(entry.observed.classification)
    }
  })

  test("frozen Collections -> Portfolio cycle set matches a fresh live recompute", async () => {
    const fixture = buildPortfolioFixture()
    const frozen = readJson(`${PACKAGE}/cycles/collection-portfolio-cycle-set.json`)
    expect(frozen.cycles.map((c: { cycle_id: string }) => c.cycle_id)).toEqual(PORTFOLIO_CYCLE_IDS)
    for (const entry of frozen.cycles as Array<{ cycle_id: string; observed: { classification: string } }>) {
      const live = await evaluateChronicleCollectionsPortfolioTransformationCycleVectorV0(
        entry.cycle_id as (typeof PORTFOLIO_CYCLE_IDS)[number],
        fixture,
      )
      expect(live.classification).toBe(entry.observed.classification)
    }
  })

  test("endpoint closure cannot erase the intermediate violation, for both cycle sets", () => {
    const checkpointCycles = readJson(`${PACKAGE}/cycles/collection-checkpoint-cycle-set.json`)
    const checkpointEntry = checkpointCycles.cycles.find(
      (c: { cycle_id: string }) => c.cycle_id === "cross_link_mutation_then_restore",
    )
    expect(checkpointEntry.observed.ordered_edge_ids.length).toBe(2)
    expect(checkpointEntry.observed.edges.length).toBe(1)
    expect(checkpointEntry.observed.edges[0].edge_id).toBe("mutate-collection-id-stale-ref")
    expect(checkpointEntry.observed.classification).toBe("violation")

    const portfolioCycles = readJson(`${PACKAGE}/cycles/collection-portfolio-cycle-set.json`)
    for (const cycleId of ["cross_link_mutation_then_restore", "link_only_mutation_then_restore"]) {
      const entry = portfolioCycles.cycles.find((c: { cycle_id: string }) => c.cycle_id === cycleId)
      expect(entry.observed.ordered_edge_ids.length).toBe(2)
      expect(entry.observed.edges.length).toBe(1)
      expect(entry.observed.classification).toBe("violation")
    }
  })

  test("closure evidence: D === P and C in D implies C in P, on real recomputed data", () => {
    const contract = readJson(`${PACKAGE}/contract.json`)
    const evidence = contract.closure.evidence
    expect(evidence.d_equals_p).toBe(true)
    expect(evidence.c_in_d).toBe(true)
    expect(evidence.c_in_p).toBe(true)
    expect(evidence.checkpoint_verifies).toBe(true)
    // Re-derive the implication directly rather than trusting the booleans.
    const derived = [...evidence.derived_collection_refs].sort()
    const stored = [...evidence.stored_portfolio_refs].sort()
    expect(derived).toEqual(stored)
    expect(derived).toContain(evidence.checkpoint_collection_ref)
    expect(stored).toContain(evidence.checkpoint_collection_ref)
  })

  test("locally-valid/globally-invalid evidence is frozen for both profiles", () => {
    const contract = readJson(`${PACKAGE}/contract.json`)
    const checkpointEvidence = contract.locally_valid_globally_invalid_evidence.collection_checkpoint
    expect(checkpointEvidence.collection_verifies).toBe(true)
    expect(checkpointEvidence.checkpoint_verifies).toBe(true)
    expect(checkpointEvidence.cross_link_match).toBe(false)

    const portfolioEvidence = contract.locally_valid_globally_invalid_evidence.collections_portfolio
    expect(portfolioEvidence.all_collections_verify).toBe(true)
    expect(portfolioEvidence.portfolio_verifies).toBe(true)
    expect(portfolioEvidence.cross_link_match).toBe(false)
    // Duplicate-preserving multiset evidence: two derived refs (same value,
    // counted twice) against one stored ref -- a cardinality mismatch, not
    // a membership mismatch.
    expect(portfolioEvidence.derived_collection_refs).toEqual([
      "/collection/collection-alpha",
      "/collection/collection-alpha",
    ])
    expect(portfolioEvidence.stored_collection_refs).toEqual(["/collection/collection-alpha"])
  })

  test("triple-object composition is explicitly forbidden semantics", () => {
    const contract = readJson(`${PACKAGE}/contract.json`)
    expect(contract.forbidden_semantics).toContain("triple_object_composition_implementation")
    expect(contract.forbidden_semantics).toContain("closure_claim_generalization_beyond_current_observables")
    expect(contract.forbidden_semantics).toContain("duplicate_ref_set_collapsing")
    expect(contract.forbidden_semantics).toContain("endpoint_equality_erases_intermediate_violation")
  })

  test("package member files are LF-only (CR=0)", () => {
    const manifest = readJson(`${PACKAGE}/manifest.json`)
    for (const file of manifest.files as Array<{ path: string }>) {
      const bytes = readFileSync(resolve(root, file.path))
      expect(bytes.includes(0x0d)).toBe(false)
    }
  })

  test("manifest does not hash itself and covers exactly the closed inventory", () => {
    const manifest = readJson(`${PACKAGE}/manifest.json`)
    const paths = (manifest.files as Array<{ path: string }>).map((f) => f.path)
    expect(paths.length).toBe(9)
    expect(paths.some((p) => p.endsWith("manifest.json"))).toBe(false)
    expect(paths).toEqual([...paths].sort())
  })
})
