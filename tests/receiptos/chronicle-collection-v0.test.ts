import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  createChronicleCollectionV0,
  createChronicleEntryV0,
  deriveCollectionRefFromChronicleCollection,
  verifyChronicleCollectionV0,
  type ChronicleCollectionV0,
  type ChronicleEntryV0,
  type HandoffEvidence,
  createPortableProofObjectV0,
} from "../../src/receiptos"

function fixturePath(name: string) {
  return resolve(import.meta.dir, "../../src/receiptos/fixtures", name)
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function demoEntry(id = "entry-demo"): ChronicleEntryV0 {
  return {
    schema: "chronicle_entry.v0",
    entry_id: id,
    source_system: "ReceiptOS",
    receipt_root: "0x" + "a".repeat(64),
    proof_object_ref: `receiptos://portable-proof-object/${id}`,
    evidence_capsule_ref: `embedded:${id}:evidence_capsule`,
    provenance_summary_ref: `embedded:${id}:provenance_summary`,
    created_from: "example://demo.json",
    labels: [],
    notes: null,
  }
}

describe("chronicle collection v0", () => {
  test("includes canonical Chronicle collection fields", () => {
    const collection = createChronicleCollectionV0(demoEntry(), {
      collectionId: "collection-demo",
      artifactRefs: ["entry-demo"],
    })

    expect(collection).toEqual({
      schema: "chronicle.collection.v0",
      collection_version: "chronicle.collection.v0",
      collection_id: "collection-demo",
      artifact_refs: ["entry-demo"],
      collection_root: collection.collection_root,
    })
    expect(collection.collection_root).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  test("collection_root is stable when artifact_refs order changes", () => {
    const a = createChronicleCollectionV0([demoEntry("entry-b"), demoEntry("entry-a")], {
      collectionId: "collection-demo",
      artifactRefs: ["entry-b", "entry-a"],
    })
    const b = createChronicleCollectionV0([demoEntry("entry-a"), demoEntry("entry-b")], {
      collectionId: "collection-demo",
      artifactRefs: ["entry-a", "entry-b"],
    })

    expect(a.collection_root).toBe(b.collection_root)
  })

  test("collection_root changes when collection_id changes", () => {
    const a = createChronicleCollectionV0(demoEntry(), { collectionId: "collection-a", artifactRefs: ["entry-a"] })
    const b = createChronicleCollectionV0(demoEntry(), { collectionId: "collection-b", artifactRefs: ["entry-a"] })

    expect(a.collection_root).not.toBe(b.collection_root)
  })

  test("collection_root changes when artifact_refs change", () => {
    const a = createChronicleCollectionV0(demoEntry(), { collectionId: "collection-demo", artifactRefs: ["entry-a"] })
    const b = createChronicleCollectionV0(demoEntry(), { collectionId: "collection-demo", artifactRefs: ["entry-b"] })

    expect(a.collection_root).not.toBe(b.collection_root)
  })

  test("collection_root does not change when non-root metadata changes", () => {
    const collection = createChronicleCollectionV0(demoEntry(), {
      collectionId: "collection-demo",
      artifactRefs: ["entry-a", "entry-b"],
    })

    const changed = {
      ...collection,
      metadata: {
        scorecard: 7,
        ownership: { wallet: "0x123" },
        rendered_at: "2026-06-27T00:00:00.000Z",
      },
    } satisfies ChronicleCollectionV0

    expect(verifyChronicleCollectionV0(collection).recomputed_collection_root).toBe(
      verifyChronicleCollectionV0(changed).recomputed_collection_root,
    )
  })

  test("verify collection ok path", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })
    const entry = createChronicleEntryV0(proof)
    const collection = createChronicleCollectionV0(entry)

    expect(verifyChronicleCollectionV0(collection)).toEqual({
      ok: true,
      collection_root: collection.collection_root,
      recomputed_collection_root: collection.collection_root,
    })
  })

  test("verify collection failure path", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })
    const entry = createChronicleEntryV0(proof)
    const collection = createChronicleCollectionV0(entry)
    const tampered = {
      ...collection,
      collection_root: `sha256:${"f".repeat(64)}`,
    }

    const result = verifyChronicleCollectionV0(tampered)
    expect(result.ok).toBe(false)
    expect(result.collection_root).toBe(tampered.collection_root)
    expect(result.recomputed_collection_root).toBe(collection.collection_root)
  })

  test("collection refs point to real collection objects", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })
    const entry = createChronicleEntryV0(proof)
    const collection = createChronicleCollectionV0(entry)

    expect(deriveCollectionRefFromChronicleCollection(collection)).toBe(`/collection/${encodeURIComponent(collection.collection_id)}`)
  })
})
