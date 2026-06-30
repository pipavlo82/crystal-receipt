import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { canonicalize, sha256, computeChronicleCollectionRoot, computeChroniclePortfolioRoot } from "../../src/receiptos"

type RootVector = { name: string; input: Record<string, unknown>; expected_root: string }
type RootFixture = { artifact: RootVector[]; collection: RootVector[]; portfolio: RootVector[] }

const fixturePath = resolve(import.meta.dir, "../fixtures/chronicle-root-golden-vectors.json")
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as RootFixture

function computeArtifactRootForGoldenVector(input: Record<string, unknown>) {
  return `sha256:${sha256(canonicalize({
    artifact_version: input.artifact_version,
    artifact_scope: input.artifact_scope,
    position_id: input.position_id,
    entry_refs: Array.isArray(input.entry_refs) ? [...input.entry_refs as string[]].sort((a, b) => a.localeCompare(b)) : [],
    receipt_refs: Array.isArray(input.receipt_refs) ? [...input.receipt_refs as string[]].sort((a, b) => a.localeCompare(b)) : [],
  }))}`
}

describe("chronicle root golden vectors", () => {
  for (const vector of fixture.collection) {
    test(`collection ${vector.name}`, () => {
      expect(computeChronicleCollectionRoot(vector.input as any)).toBe(vector.expected_root)
    })
  }

  for (const vector of fixture.portfolio) {
    test(`portfolio ${vector.name}`, () => {
      expect(computeChroniclePortfolioRoot(vector.input as any)).toBe(vector.expected_root)
    })
  }

  for (const vector of fixture.artifact) {
    test(`artifact ${vector.name}`, () => {
      expect(computeArtifactRootForGoldenVector(vector.input)).toBe(vector.expected_root)
    })
  }
})
