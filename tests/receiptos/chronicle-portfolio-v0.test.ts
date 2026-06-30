import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  createChronicleEntryV0,
  createChroniclePortfolioV0,
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

function demoEntry(): ChronicleEntryV0 {
  return {
    schema: "chronicle_entry.v0",
    entry_id: "entry-demo",
    source_system: "ReceiptOS",
    receipt_root: "0x" + "a".repeat(64),
    proof_object_ref: "receiptos://portable-proof-object/proofobj-demo",
    evidence_capsule_ref: "embedded:proofobj-demo:evidence_capsule",
    provenance_summary_ref: "embedded:proofobj-demo:provenance_summary",
    created_from: "example://demo.json",
    labels: [],
    notes: null,
  }
}

describe("chronicle portfolio v0", () => {
  test("includes canonical Chronicle schema field", () => {
    const portfolio = createChroniclePortfolioV0(demoEntry(), {
      portfolioId: "portfolio-demo",
      collectionRefs: ["entry-demo"],
    })

    expect(portfolio.schema).toBe("chronicle_portfolio.v0")
    expect(portfolio.portfolio_version).toBe("chronicle_portfolio.v0")
  })

  test("portfolio_root is stable when collection_refs order changes", () => {
    const a = createChroniclePortfolioV0(demoEntry(), {
      portfolioId: "portfolio-demo",
      collectionRefs: ["entry-b", "entry-a"],
    })
    const b = createChroniclePortfolioV0(demoEntry(), {
      portfolioId: "portfolio-demo",
      collectionRefs: ["entry-a", "entry-b"],
    })

    expect(a.portfolio_root).toBe(b.portfolio_root)
  })

  test("portfolio_root changes when portfolio_id changes", () => {
    const a = createChroniclePortfolioV0(demoEntry(), { portfolioId: "portfolio-a", collectionRefs: ["entry-a"] })
    const b = createChroniclePortfolioV0(demoEntry(), { portfolioId: "portfolio-b", collectionRefs: ["entry-a"] })

    expect(a.portfolio_root).not.toBe(b.portfolio_root)
  })

  test("portfolio_root changes when collection_refs change", () => {
    const a = createChroniclePortfolioV0(demoEntry(), { portfolioId: "portfolio-demo", collectionRefs: ["entry-a"] })
    const b = createChroniclePortfolioV0(demoEntry(), { portfolioId: "portfolio-demo", collectionRefs: ["entry-b"] })

    expect(a.portfolio_root).not.toBe(b.portfolio_root)
  })

  test("portfolio_root does not change when non-root metadata/render fields change", () => {
    const portfolio = createChroniclePortfolioV0(demoEntry(), {
      portfolioId: "portfolio-demo",
      collectionRefs: ["entry-a", "entry-b"],
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
    const portfolio = createChroniclePortfolioV0(demoEntry(), {
      portfolioId: "portfolio-demo",
      collectionRefs: ["entry-a"],
    })

    expect(portfolio.portfolio_root).toMatch(/^sha256:[0-9a-f]{64}$/)
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
      portfolio_root: `sha256:${"f".repeat(64)}`,
    }

    const result = verifyChroniclePortfolioV0(tampered)
    expect(result.ok).toBe(false)
    expect(result.portfolio_root).toBe(tampered.portfolio_root)
    expect(result.recomputed_portfolio_root).toBe(portfolio.portfolio_root)
  })

  test("current pre-collection bridge still derives collection_refs from entry_id", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })
    const entry = createChronicleEntryV0(proof)
    const portfolio = createChroniclePortfolioV0(entry)

    expect(portfolio.collection_refs).toEqual([entry.entry_id])
  })
})
