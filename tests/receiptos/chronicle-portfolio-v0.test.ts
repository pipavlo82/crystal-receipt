import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  createChronicleEntryV0,
  createChroniclePortfolioV0,
  verifyChroniclePortfolioV0,
  type ChroniclePortfolioV0,
  type HandoffEvidence,
  type PortableProofObjectV0,
  createPortableProofObjectV0,
} from "../../src/receiptos"

function fixturePath(name: string) {
  return resolve(import.meta.dir, "../../src/receiptos/fixtures", name)
}

function examplePath(name: string) {
  return resolve(import.meta.dir, "../../examples", name)
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

describe("chronicle portfolio v0", () => {
  test("portfolio_root is stable when collection_refs order changes", () => {
    const a: ChroniclePortfolioV0 = {
      portfolio_version: "chronicle_portfolio.v0",
      portfolio_id: "portfolio-demo",
      collection_refs: ["chronicle://collection/b", "chronicle://collection/a"],
      portfolio_root: "",
    }
    const b: ChroniclePortfolioV0 = {
      ...a,
      collection_refs: ["chronicle://collection/a", "chronicle://collection/b"],
    }

    a.portfolio_root = verifyChroniclePortfolioV0({ ...a, portfolio_root: createChroniclePortfolioV0({
      schema: "chronicle_entry.v0",
      entry_id: "entry-demo",
      created_at: new Date(0).toISOString(),
      relation_type: "imported",
      project_refs: [],
      proof_object_refs: [],
      metadata: {
        label: "demo",
        session_id: "demo",
        position_id: "demo",
        directory: "demo",
        source_evidence_ref: "demo",
        producer_runtime: "demo",
        source_schema: "demo",
      },
    }, { portfolioId: a.portfolio_id, collectionRefs: a.collection_refs }).portfolio_root }).portfolio_root
    b.portfolio_root = createChroniclePortfolioV0({
      schema: "chronicle_entry.v0",
      entry_id: "entry-demo",
      created_at: new Date(0).toISOString(),
      relation_type: "imported",
      project_refs: [],
      proof_object_refs: [],
      metadata: {
        label: "demo",
        session_id: "demo",
        position_id: "demo",
        directory: "demo",
        source_evidence_ref: "demo",
        producer_runtime: "demo",
        source_schema: "demo",
      },
    }, { portfolioId: b.portfolio_id, collectionRefs: b.collection_refs }).portfolio_root

    expect(a.portfolio_root).toBe(b.portfolio_root)
  })

  test("portfolio_root changes when portfolio_id changes", () => {
    const baseEntry = {
      schema: "chronicle_entry.v0" as const,
      entry_id: "entry-demo",
      created_at: new Date(0).toISOString(),
      relation_type: "imported",
      project_refs: [],
      proof_object_refs: [],
      metadata: {
        label: "demo",
        session_id: "demo",
        position_id: "demo",
        directory: "demo",
        source_evidence_ref: "demo",
        producer_runtime: "demo",
        source_schema: "demo",
      },
    }

    const a = createChroniclePortfolioV0(baseEntry, { portfolioId: "portfolio-a", collectionRefs: ["chronicle://collection/a"] })
    const b = createChroniclePortfolioV0(baseEntry, { portfolioId: "portfolio-b", collectionRefs: ["chronicle://collection/a"] })

    expect(a.portfolio_root).not.toBe(b.portfolio_root)
  })

  test("portfolio_root changes when collection_refs change", () => {
    const baseEntry = {
      schema: "chronicle_entry.v0" as const,
      entry_id: "entry-demo",
      created_at: new Date(0).toISOString(),
      relation_type: "imported",
      project_refs: [],
      proof_object_refs: [],
      metadata: {
        label: "demo",
        session_id: "demo",
        position_id: "demo",
        directory: "demo",
        source_evidence_ref: "demo",
        producer_runtime: "demo",
        source_schema: "demo",
      },
    }

    const a = createChroniclePortfolioV0(baseEntry, { portfolioId: "portfolio-demo", collectionRefs: ["chronicle://collection/a"] })
    const b = createChroniclePortfolioV0(baseEntry, { portfolioId: "portfolio-demo", collectionRefs: ["chronicle://collection/b"] })

    expect(a.portfolio_root).not.toBe(b.portfolio_root)
  })

  test("portfolio_root does not change when non-root metadata/render fields change", () => {
    const portfolio = {
      portfolio_version: "chronicle_portfolio.v0",
      portfolio_id: "portfolio-demo",
      collection_refs: ["chronicle://collection/a"],
      portfolio_root: createChroniclePortfolioV0({
        schema: "chronicle_entry.v0",
        entry_id: "entry-demo",
        created_at: new Date(0).toISOString(),
        relation_type: "imported",
        project_refs: [],
        proof_object_refs: [],
        metadata: {
          label: "demo",
          session_id: "demo",
          position_id: "demo",
          directory: "demo",
          source_evidence_ref: "demo",
          producer_runtime: "demo",
          source_schema: "demo",
        },
      }, { portfolioId: "portfolio-demo", collectionRefs: ["chronicle://collection/a"] }).portfolio_root,
      metadata: {
        scorecard: 99,
        render: { theme: "glass" },
        ownership: { wallet: "0x123" },
      },
    } satisfies ChroniclePortfolioV0

    const changed = {
      ...portfolio,
      metadata: {
        scorecard: 1,
        render: { theme: "minimal" },
        ownership: { wallet: "0x456" },
        nft: true,
      },
    } satisfies ChroniclePortfolioV0

    expect(verifyChroniclePortfolioV0(portfolio).recomputed_portfolio_root).toBe(
      verifyChroniclePortfolioV0(changed).recomputed_portfolio_root,
    )
  })

  test("verify portfolio ok path", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })
    const entry = createChronicleEntryV0(proof)
    const portfolio = createChroniclePortfolioV0(entry)

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
    const portfolio = createChroniclePortfolioV0(entry)
    const tampered = {
      ...portfolio,
      portfolio_root: "0x" + "f".repeat(64),
    }

    const result = verifyChroniclePortfolioV0(tampered)
    expect(result.ok).toBe(false)
    expect(result.portfolio_root).toBe(tampered.portfolio_root)
    expect(result.recomputed_portfolio_root).toBe(portfolio.portfolio_root)
  })

  test("builder reproduces the canonical chronicle portfolio example", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })
    const entry = createChronicleEntryV0(proof)
    const portfolio = createChroniclePortfolioV0(entry)
    const expected = readJson<ChroniclePortfolioV0>(examplePath("chronicle-portfolio-v0.json"))

    expect(portfolio).toEqual(expected)
  })
})
