import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  createChronicleCollectionV0,
  createChronicleEntryV0,
  createChroniclePortfolioV0,
  deriveCollectionRefFromChronicleCollection,
  verifyChroniclePortfolioV0,
  type ChronicleEntryV0,
  type ChroniclePortfolioV0,
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

describe("chronicle portfolio v0", () => {
  test("includes canonical Chronicle schema field", () => {
    const collection = createChronicleCollectionV0(demoEntry(), {
      collectionId: "collection-demo",
      artifactRefs: ["entry-demo"],
    })
    const portfolio = createChroniclePortfolioV0(collection, {
      portfolioId: "portfolio-demo",
      collectionRefs: [deriveCollectionRefFromChronicleCollection(collection)],
    })

    expect(portfolio.schema).toBe("chronicle_portfolio.v0")
    expect(portfolio.portfolio_version).toBe("chronicle_portfolio.v0")
  })

  test("portfolio_root is stable when collection_refs order changes", () => {
    const portfolioA = createChroniclePortfolioV0(createChronicleCollectionV0(demoEntry("entry-a"), { collectionId: "collection-a", artifactRefs: ["entry-a"] }), {
      portfolioId: "portfolio-demo",
      collectionRefs: ["/collection/collection-b", "/collection/collection-a"],
    })
    const portfolioB = createChroniclePortfolioV0(createChronicleCollectionV0(demoEntry("entry-a"), { collectionId: "collection-a", artifactRefs: ["entry-a"] }), {
      portfolioId: "portfolio-demo",
      collectionRefs: ["/collection/collection-a", "/collection/collection-b"],
    })

    expect(portfolioA.portfolio_root).toBe(portfolioB.portfolio_root)
  })

  test("portfolio_root changes when portfolio_id changes", () => {
    const collection = createChronicleCollectionV0(demoEntry(), { collectionId: "collection-a", artifactRefs: ["entry-a"] })
    const ref = deriveCollectionRefFromChronicleCollection(collection)
    const a = createChroniclePortfolioV0(collection, { portfolioId: "portfolio-a", collectionRefs: [ref] })
    const b = createChroniclePortfolioV0(collection, { portfolioId: "portfolio-b", collectionRefs: [ref] })

    expect(a.portfolio_root).not.toBe(b.portfolio_root)
  })

  test("portfolio_root changes when collection_refs change", () => {
    const collection = createChronicleCollectionV0(demoEntry(), { collectionId: "collection-a", artifactRefs: ["entry-a"] })
    const a = createChroniclePortfolioV0(collection, { portfolioId: "portfolio-demo", collectionRefs: ["/collection/collection-a"] })
    const b = createChroniclePortfolioV0(collection, { portfolioId: "portfolio-demo", collectionRefs: ["/collection/collection-b"] })

    expect(a.portfolio_root).not.toBe(b.portfolio_root)
  })

  test("portfolio_root does not change when non-root metadata/render fields change", () => {
    const collection = createChronicleCollectionV0(demoEntry(), { collectionId: "collection-a", artifactRefs: ["entry-a"] })
    const portfolio = createChroniclePortfolioV0(collection, {
      portfolioId: "portfolio-demo",
      collectionRefs: ["/collection/collection-a", "/collection/collection-b"],
    })

    const changed = {
      ...portfolio,
      metadata: {
        scorecard: 1,
        render: { theme: "minimal" },
        ownership: { wallet: "0x456" },
        nft: true,
        rendered_at: "2026-06-27T00:00:00.000Z",
      },
    } satisfies ChroniclePortfolioV0

    expect(verifyChroniclePortfolioV0(portfolio).recomputed_portfolio_root).toBe(
      verifyChroniclePortfolioV0(changed).recomputed_portfolio_root,
    )
  })

  test("Chronicle-native roots use sha256:<hex> encoding", () => {
    const collection = createChronicleCollectionV0(demoEntry(), { collectionId: "collection-a", artifactRefs: ["entry-a"] })
    const portfolio = createChroniclePortfolioV0(collection, {
      portfolioId: "portfolio-demo",
      collectionRefs: ["/collection/collection-a"],
    })

    expect(portfolio.portfolio_root).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  test("verify portfolio ok path", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })
    const entry = createChronicleEntryV0(proof)
    const collection = createChronicleCollectionV0(entry)
    const portfolio = createChroniclePortfolioV0(collection)

    expect(verifyChroniclePortfolioV0(portfolio)).toEqual({
      ok: true,
      portfolio_root: portfolio.portfolio_root,
      recomputed_portfolio_root: portfolio.portfolio_root,
    })
  })

  test("verify portfolio failure path", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })
    const entry = createChronicleEntryV0(proof)
    const collection = createChronicleCollectionV0(entry)
    const portfolio = createChroniclePortfolioV0(collection)
    const tampered = {
      ...portfolio,
      portfolio_root: `sha256:${"f".repeat(64)}`,
    }

    const result = verifyChroniclePortfolioV0(tampered)
    expect(result.ok).toBe(false)
    expect(result.portfolio_root).toBe(tampered.portfolio_root)
    expect(result.recomputed_portfolio_root).toBe(portfolio.portfolio_root)
  })

  test("portfolio collection_refs reference real collection objects", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })
    const entry = createChronicleEntryV0(proof)
    const collection = createChronicleCollectionV0(entry)
    const portfolio = createChroniclePortfolioV0(collection)

    expect(portfolio.collection_refs).toEqual([deriveCollectionRefFromChronicleCollection(collection)])
  })
})
