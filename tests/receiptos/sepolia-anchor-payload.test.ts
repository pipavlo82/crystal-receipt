import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { prepareSepoliaAnchorPayload } from "../../src/receiptos/anchor/sepolia-payload"
import type { HandoffEvidence, SepoliaAnchorPayload } from "../../src/receiptos/schema/types"

function readEvidence(name: string): HandoffEvidence {
  return JSON.parse(readFileSync(resolve(import.meta.dir, "../../src/receiptos/fixtures", name), "utf8")) as HandoffEvidence
}

function readPayloadFixture(name: string): SepoliaAnchorPayload {
  return JSON.parse(readFileSync(resolve(import.meta.dir, "../../src/receiptos/fixtures", name), "utf8")) as SepoliaAnchorPayload
}

describe("receiptos sepolia anchor payload", () => {
  test("valid local Merkle evidence produces exact expected payload fixture", () => {
    const evidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    const expected = readPayloadFixture("sepolia-anchor-payload.sample.json")
    expect(prepareSepoliaAnchorPayload(evidence)).toEqual(expected)
  })

  test("missing local Merkle proof fails", () => {
    const evidence = readEvidence("session-evidence.sample.json")
    expect(() => prepareSepoliaAnchorPayload(evidence)).toThrow("merkle proof must be attached before preparing Sepolia payload")
  })

  test("malformed roots fail", () => {
    const evidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    expect(() => prepareSepoliaAnchorPayload({
      ...evidence,
      anchor: {
        ...evidence.anchor,
        merkle_root: "0x1234",
      },
    })).toThrow("invalid merkle_root: 0x1234")
  })

  test("invalid merkle proof shape fails", () => {
    const evidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    expect(() => prepareSepoliaAnchorPayload({
      ...evidence,
      anchor: {
        ...evidence.anchor,
        merkle_proof: null as unknown as string[],
      },
    })).toThrow("anchor.merkle_proof must be an array")
  })

  test("output is pure data only", () => {
    const evidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    const payload = prepareSepoliaAnchorPayload(evidence)
    expect(payload.schema).toBe("stealth.receipt_anchor.onchain_payload.v1")
    expect(payload.network).toBe("sepolia")
    expect(payload.anchor_target).toBe("onchain")
  })
})
